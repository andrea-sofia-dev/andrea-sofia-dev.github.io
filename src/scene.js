import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { Terminal } from './terminal.js';
import { Track, WIDTH } from './world/track.js';
import { createCar } from './world/car.js';
import { buildBase, lightPool, faceTrack } from './world/base.js';
import { buildStreet } from './world/street.js';
import { buildGym } from './world/gym.js';
import { buildPits, pitLateral, PIT_LATERAL } from './world/pit.js';

const BG = 0x04060b;
const SECTIONS = ['hero', 'how', 'projects', 'stack', 'contact'];
// Where the car stops for each section, as a fraction of the lap. The last one is just past the finish line.
const ANCHORS = [-0.012, 0.1, 0.47, 0.74, 1.015];
// Where things stand around the circuit.
const SPOTS = {
  screen: 0.112,
  garages: [0.43, 0.47, 0.51],
  gates: [0.04, 0.415, 0.705],
  trap: 0.6,
  gym: 0.74,
  floodlights: [0.03, 0.22, 0.3, 0.36, 0.6, 0.66, 0.84, 0.92],
};
const UP = new THREE.Vector3(0, 1, 0);
const TOP_SPEED = 70; // metres per second that count as "flat out"

// Vignette, a touch of film grain and chromatic aberration that grows with speed.
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, uSpeed: { value: 0 }, uTime: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSpeed;
    uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 c = vUv - 0.5;
      float d = dot(c, c);
      vec2 shift = c * d * (0.01 + uSpeed * 0.045);
      vec3 col = vec3(
        texture2D(tDiffuse, vUv + shift).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - shift).b
      );
      col *= 1.0 - d * (1.15 + uSpeed * 0.6);
      col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.025;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

export function createScene({
  canvas,
  labelLayer,
  nodes,
  skills,
  scripts,
  lang,
  reducedMotion,
  onNodeHover,
  onNodeClick,
  onEvent,
  onFrame,
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch {
    return null; // no WebGL: the page stays a plain (and complete) HTML page
  }

  const small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.debug.checkShaderErrors = import.meta.env.DEV; // skip the slow (and noisy) shader log in production

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.014);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 600);
  scene.add(camera); // the speed lines ride with it
  let baseFov = 42;

  const envMap = nightEnvironment(renderer);

  // ---------- night lighting ----------
  scene.add(new THREE.HemisphereLight(0x3b4a70, 0x050608, 0.6));
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
  moon.position.set(-40, 60, 30);
  scene.add(moon);

  // ---------- the world ----------
  const track = new Track();
  scene.add(track.group);

  // Wet asphalt: a mirror the shape of the track, seen through a slightly transparent road.
  let mirror = null;
  if (!small) {
    mirror = new Reflector(track.ribbon(-WIDTH / 2, WIDTH / 2, 0, 0, 1, true), {
      clipBias: 0.003,
      textureWidth: 512,
      textureHeight: 512,
      color: 0x5d6472,
      multisample: 0,
    });
    mirror.material.side = THREE.DoubleSide;
    mirror.rotation.x = -Math.PI / 2;
    mirror.position.y = 0.005;
    scene.add(mirror);
    track.asphalt.transparent = true;
    track.asphalt.opacity = 0.72;
  }

  const terminal = new Terminal({ scripts, lang, animated: !reducedMotion });
  const base = buildBase({ track, nodes, screenTexture: terminal.texture, spots: SPOTS });
  scene.add(base.group);

  const gym = buildGym({ skills, signText: 'DRIVER TRAINING' });
  track.beside(SPOTS.gym, 17, gym.group.position);
  faceTrack(track, gym.group, SPOTS.gym);
  scene.add(gym.group);

  const street = buildStreet({ track, gates: SPOTS.gates, trap: SPOTS.trap });
  scene.add(street.group);

  const pits = buildPits({ track, nodes, boxes: SPOTS.garages });
  scene.add(pits.group);
  // In the projects section the car stops in front of the garage of the project being read.
  let activeBox = 1;
  ANCHORS[2] = SPOTS.garages[activeBox];

  // Pools of light where the action is.
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  lightPool(track.beside(SPOTS.screen, 9, tmp), 9, 0x9fe8ff, 0.14);
  for (const u of SPOTS.garages) lightPool(track.beside(u, 12, tmp), 7, 0xcfdcff, 0.12);
  lightPool(track.beside(0, 0, tmp), 8, 0xcfdcff, 0.12);

  const car = createCar({ envMap });
  scene.add(car.object);

  const speedLines = makeSpeedLines(small ? 40 : 90);
  camera.add(speedLines.group);

  // ---------- rendering ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.6));
  composer.addPass(new OutputPass());
  const finish = new ShaderPass(FinishShader);
  composer.addPass(finish);
  let useBloom = true;

  let distanceScale = 1;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    mirror?.getRenderTarget().setSize(Math.round(w * pixelRatio * 0.5), Math.round(h * pixelRatio * 0.5));
    camera.aspect = w / h;
    const portrait = camera.aspect < 1;
    baseFov = portrait ? 55 : 42;
    camera.fov = baseFov;
    distanceScale = portrait ? 1 + (1 - camera.aspect) * 0.9 : 1;
    // Wide screens: the text panel ends ~580 px from the left, so the scene centres in the space after it.
    // Narrow screens: text at the bottom, so the scene moves up.
    if (w >= 900) camera.setViewOffset(w, h, -(Math.min(w * 0.05, 72) + 580) / 2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.26, w, h);
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  // ---------- camera shots ----------
  const P = new THREE.Vector3();
  const F = new THREE.Vector3();
  const O = new THREE.Vector3();
  function frameAt(u) {
    track.at(u, P, F);
    track.outward(u, O);
  }
  base.group.updateMatrixWorld(true);
  gym.group.updateMatrixWorld(true);
  const screenCentre = base.screen.localToWorld(new THREE.Vector3(0, 7.3, 0));
  const rackCentre = gym.group.localToWorld(new THREE.Vector3(0, 2.9, -5.2));

  // Each shot writes a camera position and a point to look at.
  const SHOTS = [
    (pos, look) => {
      // On the grid, behind the car, looking up at the start lights.
      frameAt(ANCHORS[0]);
      pos.copy(P).addScaledVector(F, -12).addScaledVector(O, 4.5).addScaledVector(UP, 3.4);
      look.copy(P).addScaledVector(F, 5).addScaledVector(UP, 2.6);
    },
    (pos, look) => {
      // The pit wall screen with the agent session, the car parked in front.
      frameAt(ANCHORS[1]);
      pos.copy(P).addScaledVector(O, -11).addScaledVector(F, -12).addScaledVector(UP, 5.5);
      look.copy(screenCentre).lerp(P, 0.3).addScaledVector(UP, 1.2);
    },
    (pos, look) => {
      // The pit box in front of the garage of the project being read: three-quarter view from the track.
      frameAt(ANCHORS[2]);
      const box = track.beside(ANCHORS[2], PIT_LATERAL, tmp2);
      pos.copy(box).addScaledVector(O, -9.5).addScaledVector(F, 7).addScaledVector(UP, 4.2);
      look.copy(box).addScaledVector(O, 1.2).addScaledVector(UP, 0.9);
    },
    (pos, look) => {
      // The paddock gym, close enough to read the plates.
      frameAt(ANCHORS[3]);
      pos.copy(rackCentre).addScaledVector(O, -21).addScaledVector(F, -6).addScaledVector(UP, 2.6);
      look.copy(rackCentre).addScaledVector(O, -4).addScaledVector(UP, -0.6);
    },
    (pos, look) => {
      // Finish: the whole circuit from above.
      pos.copy(track.centre).add(tmp.set(8, 96, 78));
      look.copy(track.centre).add(tmp.set(4, 0, -6));
    },
  ];

  function chase(u, pos, look) {
    frameAt(u);
    pos.copy(car.object.position).addScaledVector(carDir, -10.5).addScaledVector(UP, 3.4).addScaledVector(O, 1.2);
    look.copy(car.object.position).addScaledVector(carDir, 9).addScaledVector(UP, 0.9);
  }

  // ---------- interaction ----------
  let progress = 0;
  let hovered = null;
  let linked = null;
  let needsRender = true;
  const pointer = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();
  let mouseOnCanvas = false;
  const raycaster = new THREE.Raycaster();
  const hitTargets = base.garages.map((g) => g.hit);

  function setHovered(id) {
    if (hovered === id) return;
    hovered = id;
    canvas.style.cursor = id ? 'pointer' : '';
    onNodeHover?.(id);
    needsRender = true;
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      parallaxTarget.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    },
    { passive: true },
  );
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouseOnCanvas = true;
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    if (reducedMotion) pick();
  });
  canvas.addEventListener('pointerleave', () => {
    mouseOnCanvas = false;
    setHovered(null);
  });
  canvas.addEventListener('click', (e) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const id = pick(false);
    if (id) onNodeClick?.(id);
  });

  function pick(updateHover = true) {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitTargets, false)[0];
    const id = hit ? hit.object.userData.id : null;
    if (updateHover) setHovered(id);
    return id;
  }

  // ---------- animation ----------
  const timer = new THREE.Timer();
  timer.connect(document);
  let elapsed = 0;
  let carU = ANCHORS[0];
  let speed = 0; // 0 to 1
  const glow = new Map(base.garages.map((g) => [g.id, 0]));
  const shotPos = new THREE.Vector3();
  const shotLook = new THREE.Vector3();
  const chasePos = new THREE.Vector3();
  const chaseLook = new THREE.Vector3();
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const carDir = new THREE.Vector3();
  let frames = 0;
  let measured = 0;
  // ?hq keeps full quality (used to capture the preview image on a slow headless GPU).
  let qualityChecked = new URLSearchParams(location.search).has('hq');
  let lastSection = -1;
  let wentGreen = false;
  let finished = false;
  let topKmh = 0;
  const emit = (event) => onEvent?.(event);

  function targetU(p) {
    const i = Math.min(Math.floor(p), ANCHORS.length - 1);
    const j = Math.min(i + 1, ANCHORS.length - 1);
    return THREE.MathUtils.lerp(ANCHORS[i], ANCHORS[j], holdEase(p - i));
  }

  // On the track, or in the pit lane between the entry and the exit.
  function placeCar(u) {
    track.beside(u, pitLateral(u), car.object.position);
    track.beside(u + 0.0015, pitLateral(u + 0.0015), tmp);
    carDir.copy(tmp).sub(car.object.position).normalize();
    car.object.lookAt(tmp);
  }

  // Camera: the section's shot while the section is centred, a chase camera while driving between them.
  function cameraFor(p, pos, look) {
    const i = Math.min(Math.floor(p), SHOTS.length - 1);
    const t = p - i;
    const last = i === SHOTS.length - 1;
    const driving = last ? 0 : smooth(0.1, 0.3, t) * (1 - smooth(0.7, 0.9, t));
    SHOTS[t < 0.5 || last ? i : i + 1](shotPos, shotLook);
    if (driving > 0) {
      chase(carU, chasePos, chaseLook);
      shotPos.lerp(chasePos, driving);
      shotLook.lerp(chaseLook, driving);
    }
    // On portrait screens, step back so the scene still fits.
    pos.copy(shotPos).sub(shotLook).multiplyScalar(distanceScale).add(shotLook);
    look.copy(shotLook);
    return driving;
  }

  function updateGlow(dt) {
    for (const g of base.garages) {
      const target = hovered === g.id || linked === g.id ? 1 : 0;
      const k = reducedMotion ? target : THREE.MathUtils.damp(glow.get(g.id), target, 8, dt);
      glow.set(g.id, k);
      g.glow(k);
    }
  }

  // Five reds come on one by one, then all go out.
  function startLights(t) {
    base.startLights.forEach((mat, i) => {
      const on = !reducedMotion && t > 0.6 + i * 0.55 && t < 3.6;
      mat.color.setRGB(on ? 3.2 : 0.1, on ? 0.05 : 0.01, on ? 0.08 : 0.02);
    });
  }

  function render() {
    if (useBloom) composer.render();
    else renderer.render(scene, camera);
  }

  function tick(timestamp) {
    timer.update(timestamp);
    const dt = Math.min(timer.getDelta(), 0.05);

    if (reducedMotion) {
      if (!needsRender) return;
      const section = Math.round(progress);
      carU = ANCHORS[section];
      placeCar(carU);
      cameraFor(section, camera.position, lookAt);
      camera.lookAt(lookAt);
      startLights(0);
      updateGlow(dt);
      render();
      needsRender = false;
      return;
    }

    elapsed += dt;

    // Drive: the car eases towards the point the scroll asks for.
    const before = carU;
    carU = THREE.MathUtils.damp(carU, targetU(progress), 2.4, dt);
    placeCar(carU);
    const metres = (carU - before) * track.length;
    car.roll(metres);
    speed = THREE.MathUtils.damp(speed, Math.min(Math.abs(metres) / Math.max(dt, 1e-3) / TOP_SPEED, 1), 4, dt);

    const driving = cameraFor(progress, desiredPos, desiredLook);
    parallax.lerp(parallaxTarget, 1 - Math.exp(-dt * 3));
    desiredPos.x += parallax.x * 0.6 * (1 - driving);
    desiredPos.y += parallax.y * 0.35 * (1 - driving);
    // A little shake at full speed.
    desiredPos.y += Math.sin(elapsed * 41) * 0.03 * speed;
    const ease = 1 - Math.exp(-dt * (driving > 0.5 ? 6 : 3.2));
    camera.position.lerp(desiredPos, ease);
    lookAt.lerp(desiredLook, ease);
    camera.lookAt(lookAt);
    // The view widens with speed.
    const fov = baseFov + speed * 9;
    if (Math.abs(camera.fov - fov) > 0.05) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // Thinner fog for the view from above.
    const overview = smooth(3.4, 4, progress);
    scene.fog.density = THREE.MathUtils.lerp(0.014, 0.003, overview);
    base.beams.opacity = 0.02 * (1 - overview); // light beams only read from the ground

    terminal.update(dt);
    base.update(elapsed);
    car.update(elapsed, speed);
    speedLines.update(dt, speed);
    const kmh = Math.round(speed * 320);
    topKmh = Math.max(topKmh, kmh);
    for (const event of street.update(elapsed, car.object.position, speed)) emit({ ...event, kmh });

    // Pit stop: once the car has stopped in a box, the crew goes to work.
    const parked = Math.round(progress) === 2 && Math.abs(carU - ANCHORS[2]) < 0.0012 && speed < 0.04;
    const pit = pits.update(elapsed, parked ? activeBox : -1, true);
    car.pit(pit.lift, pit.out);
    if (pit.event) emit({ ...pit.event, id: nodes[pit.event.index].id });

    // Race events: lights out, chequered flag.
    if (!wentGreen && elapsed > 3.6) {
      wentGreen = true;
      emit({ type: 'go' });
    }
    if (!finished && carU > 1.002 && Math.round(progress) === 4) {
      finished = true;
      emit({ type: 'finish', topKmh });
    } else if (finished && carU < 0.95) {
      finished = false;
    }
    onFrame?.({ kmh, speed, x: car.object.position.x, z: car.object.position.z, heading: Math.atan2(carDir.x, carDir.z) });
    finish.uniforms.uSpeed.value = speed;
    finish.uniforms.uTime.value = elapsed % 10;
    startLights(elapsed);
    updateGlow(dt);
    if (mouseOnCanvas) pick();

    render();

    // After the first second, if frames are slow, drop the mirror and the bloom and render at 1x.
    frames++;
    if (!qualityChecked && frames > 30) {
      measured += dt;
      if (frames === 120) {
        qualityChecked = true;
        if (measured / 90 > 1 / 40) {
          useBloom = false;
          if (mirror) {
            scene.remove(mirror);
            track.asphalt.opacity = 1;
            track.asphalt.transparent = false;
            mirror = null;
          }
          pixelRatio = 1;
          renderer.setPixelRatio(1);
          resize();
        }
      }
    }
  }

  placeCar(carU);
  cameraFor(0, camera.position, lookAt);
  camera.lookAt(lookAt);
  resize();
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(tick);

  return {
    setProgress(p) {
      const section = Math.round(p);
      if (section !== lastSection) {
        lastSection = section;
        labelLayer.dataset.section = SECTIONS[section] || 'hero';
        needsRender = true;
      }
      progress = p;
    },
    setLanguage(l) {
      terminal.setLang(l);
      needsRender = true;
    },
    // The project card being read: the car pits at its garage.
    setActiveProject(id) {
      const index = nodes.findIndex((n) => n.id === id);
      if (index < 0 || index === activeBox) return;
      activeBox = index;
      ANCHORS[2] = SPOTS.garages[index];
      needsRender = true;
    },
    // Everything the minimap draws, in world x/z.
    map() {
      const v = new THREE.Vector3();
      const xz = (p) => [p.x, p.z];
      const pitLane = [];
      for (let u = 0.385; u <= 0.555; u += 0.005) pitLane.push(xz(track.beside(u, pitLateral(u), v)));
      return {
        track: track.points.map(xz),
        pitLane,
        gates: SPOTS.gates.map((u) => xz(track.at(u, v))),
        garages: base.garages.map((g, i) => ({ at: xz(g.group.position), color: nodes[i].color })),
        trap: xz(track.at(SPOTS.trap, v)),
        finish: xz(track.at(0, v)),
      };
    },
    highlight(id) {
      linked = id;
      needsRender = true;
    },
  };
}

// A dark studio with neon panels: what the car's paint and the chrome reflect.
function nightEnvironment(renderer) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x020306);
  const panel = (color, strength, position, size) => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(...size),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(strength), side: THREE.DoubleSide }),
    );
    mesh.position.set(...position);
    mesh.lookAt(0, 0, 0);
    env.add(mesh);
  };
  panel(0xfff1d6, 5, [0, 9, 0], [14, 3]);
  panel(0x38e1ff, 4, [9, 2, 2], [1.5, 8]);
  panel(0xff3da5, 3, [-9, 2, -2], [1.5, 7]);
  panel(0xa78bfa, 2.5, [0, 3, -9], [10, 1.2]);
  panel(0xf5a524, 2, [2, 1, 9], [8, 1]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.02).texture;
  pmrem.dispose();
  return texture;
}

// Thin streaks rushing past the camera at speed.
function makeSpeedLines(count) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: 0xcfefff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.02, 0.02, 4), material, count);
  const items = [];
  const m = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 5;
    items.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.6, z: -Math.random() * 60 });
  }
  group.add(mesh);
  return {
    group,
    update(dt, speed) {
      material.opacity = THREE.MathUtils.smoothstep(speed, 0.35, 1) * 0.5;
      mesh.visible = material.opacity > 0.01;
      if (!mesh.visible) return;
      items.forEach((it, i) => {
        it.z += dt * 90 * speed;
        if (it.z > 2) it.z -= 62;
        m.position.set(it.x, it.y, it.z);
        m.updateMatrix();
        mesh.setMatrixAt(i, m.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

// Holds on each section while it is centred, moves in between.
function holdEase(t) {
  return smooth(0.15, 0.85, t);
}

function smooth(a, b, t) {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
