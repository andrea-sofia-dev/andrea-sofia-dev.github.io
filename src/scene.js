import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Terminal } from './terminal.js';
import { Track } from './world/track.js';
import { createCar } from './world/car.js';
import { buildBase, lightPool } from './world/base.js';
import { buildGym } from './world/gym.js';

const BG = 0x04060b;
const SECTIONS = ['hero', 'how', 'projects', 'stack', 'contact'];
// Where the car stops for each section, as a fraction of the lap. The last one is just past the finish line.
const ANCHORS = [-0.012, 0.1, 0.47, 0.74, 1.015];
// Where things stand around the circuit.
const SPOTS = {
  screen: 0.112,
  tower: 0.05,
  radar: 0.165,
  hangars: [0.43, 0.47, 0.51],
  gym: 0.74,
  floodlights: [0.03, 0.22, 0.3, 0.36, 0.6, 0.66, 0.84, 0.92],
};
const UP = new THREE.Vector3(0, 1, 0);

export function createScene({ canvas, labelLayer, nodes, skills, scripts, lang, reducedMotion, onNodeHover, onNodeClick }) {
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

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ---------- night lighting ----------
  scene.add(new THREE.HemisphereLight(0x3b4a70, 0x050608, 0.6));
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.35);
  moon.position.set(-40, 60, 30);
  scene.add(moon);

  // ---------- the world ----------
  const track = new Track();
  scene.add(track.group);

  const terminal = new Terminal({ scripts, lang, animated: !reducedMotion });
  const base = buildBase({ track, nodes, screenTexture: terminal.texture, spots: SPOTS });
  scene.add(base.group);

  const gym = buildGym({ skills, signText: 'TRAINING AREA' });
  track.beside(SPOTS.gym, 17, gym.group.position);
  faceTrack(track, gym.group, SPOTS.gym);
  scene.add(gym.group);

  // Pools of light where the action is.
  const tmp = new THREE.Vector3();
  lightPool(track.beside(SPOTS.screen, 9, tmp), 9, 0x9fe8ff, 0.14);
  for (const u of SPOTS.hangars) lightPool(track.beside(u, 13, tmp), 7, 0xcfdcff, 0.12);
  lightPool(track.beside(SPOTS.gym, 16, tmp), 10, 0xffd9a8, 0.14);
  lightPool(track.beside(0, 0, tmp), 8, 0xcfdcff, 0.12);

  const car = createCar({ envMap });
  scene.add(car.object);

  // ---------- objective markers (A to E) ----------
  const objectives = [];
  function marker(letter, name, color, parent, height, link) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.style.setProperty('--c', color);
    el.innerHTML = '<span class="marker-tag"></span><span class="marker-text"><b></b><i></i></span>';
    el.querySelector('.marker-tag').textContent = letter;
    el.querySelector('b').textContent = name;
    const dist = el.querySelector('i');
    el.addEventListener('click', () => onNodeClick?.(link));
    el.addEventListener('pointerenter', () => setHovered(link));
    el.addEventListener('pointerleave', () => setHovered(null));
    const object = new CSS2DObject(el);
    object.position.set(0, height, 0);
    parent.add(object);
    objectives.push({ el, dist, object, link, metres: -1, world: new THREE.Vector3() });
  }
  marker('A', 'workflow', '#38e1ff', base.screen, 12.8, 'how');
  base.hangars.forEach((h, i) => {
    const color = `#${new THREE.Color(nodes[i].color).getHexString()}`;
    marker(String.fromCharCode(66 + i), nodes[i].label, color, h.group, h.markerHeight, h.id);
  });
  marker('E', 'training', '#f5a524', gym.group, 8, 'stack');
  // The objective each section is about (CoD-style "next objective").
  const CURRENT = [['how'], ['how'], nodes.map((n) => n.id), ['stack'], []];

  // ---------- rendering ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 0.6));
  composer.addPass(new OutputPass());
  let useBloom = true;
  const labels = new CSS2DRenderer({ element: labelLayer });

  let distanceScale = 1;
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, h);
    labels.setSize(w, h);
    camera.aspect = w / h;
    const portrait = camera.aspect < 1;
    camera.fov = portrait ? 55 : 42;
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
  const hangarMid = base.hangars[1].group.position.clone();
  const rackCentre = gym.group.localToWorld(new THREE.Vector3(0, 2.9, -3));

  // Each shot writes a camera position and a point to look at.
  const SHOTS = [
    (pos, look) => {
      // On the grid, behind the car, looking up at the start lights.
      frameAt(ANCHORS[0]);
      pos.copy(P).addScaledVector(F, -12).addScaledVector(O, 4.5).addScaledVector(UP, 3.4);
      look.copy(P).addScaledVector(F, 5).addScaledVector(UP, 2.6);
    },
    (pos, look) => {
      // The big screen with the agent session, the car parked in front.
      frameAt(ANCHORS[1]);
      pos.copy(P).addScaledVector(O, -11).addScaledVector(F, -12).addScaledVector(UP, 5.5);
      look.copy(screenCentre).lerp(P, 0.3);
    },
    (pos, look) => {
      // The three hangars, seen from the infield.
      frameAt(ANCHORS[2]);
      pos.copy(P).addScaledVector(O, -15).addScaledVector(F, -2).addScaledVector(UP, 8);
      look.copy(hangarMid).addScaledVector(UP, 2.5).addScaledVector(O, -3);
    },
    (pos, look) => {
      // The training area, close enough to read the plates.
      frameAt(ANCHORS[3]);
      pos.copy(rackCentre).addScaledVector(O, -15).addScaledVector(F, -5).addScaledVector(UP, 1.6);
      look.copy(rackCentre).addScaledVector(O, -2);
    },
    (pos, look) => {
      // Mission complete: the whole airfield from above.
      pos.copy(track.centre).add(tmp.set(8, 96, 78));
      look.copy(track.centre).add(tmp.set(4, 0, -6));
    },
  ];

  function chase(u, pos, look) {
    frameAt(u);
    pos.copy(car.object.position).addScaledVector(F, -10.5).addScaledVector(UP, 3.8).addScaledVector(O, 1.2);
    look.copy(car.object.position).addScaledVector(F, 9).addScaledVector(UP, 0.9);
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
  const hitTargets = base.hangars.map((h) => h.hit);

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
  const glow = new Map(base.hangars.map((h) => [h.id, 0]));
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

  function targetU(p) {
    const i = Math.min(Math.floor(p), ANCHORS.length - 1);
    const j = Math.min(i + 1, ANCHORS.length - 1);
    return THREE.MathUtils.lerp(ANCHORS[i], ANCHORS[j], holdEase(p - i));
  }

  function placeCar(u) {
    track.at(u, car.object.position, carDir);
    car.object.lookAt(tmp.copy(car.object.position).add(carDir));
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

  function updateMarkers() {
    const section = Math.round(progress);
    for (const o of objectives) {
      o.object.getWorldPosition(o.world);
      const metres = Math.round(o.world.distanceTo(car.object.position));
      if (metres !== o.metres) {
        o.metres = metres;
        o.dist.textContent = `${metres} m`;
      }
      o.el.classList.toggle('is-current', CURRENT[section]?.includes(o.link) ?? false);
      o.el.classList.toggle('is-hovered', hovered === o.link || linked === o.link);
    }
  }

  function updateGlow(dt) {
    for (const h of base.hangars) {
      const target = hovered === h.id || linked === h.id ? 1 : 0;
      const k = reducedMotion ? target : THREE.MathUtils.damp(glow.get(h.id), target, 8, dt);
      glow.set(h.id, k);
      h.glow(k);
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
    labels.render(scene, camera);
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
      updateMarkers();
      render();
      needsRender = false;
      return;
    }

    elapsed += dt;

    // Drive: the car eases towards the point the scroll asks for.
    const before = carU;
    carU = THREE.MathUtils.damp(carU, targetU(progress), 2.4, dt);
    placeCar(carU);
    car.roll((carU - before) * track.length);

    const driving = cameraFor(progress, desiredPos, desiredLook);
    parallax.lerp(parallaxTarget, 1 - Math.exp(-dt * 3));
    desiredPos.x += parallax.x * 0.6 * (1 - driving);
    desiredPos.y += parallax.y * 0.35 * (1 - driving);
    const ease = 1 - Math.exp(-dt * (driving > 0.5 ? 6 : 3.2));
    camera.position.lerp(desiredPos, ease);
    lookAt.lerp(desiredLook, ease);
    camera.lookAt(lookAt);

    // Thinner fog for the view from above.
    const overview = smooth(3.4, 4, progress);
    scene.fog.density = THREE.MathUtils.lerp(0.014, 0.003, overview);
    base.beams.opacity = 0.02 * (1 - overview); // light beams only read from the ground

    terminal.update(dt);
    base.update(elapsed);
    startLights(elapsed);
    updateGlow(dt);
    if (mouseOnCanvas) pick();
    updateMarkers();

    render();

    // After the first second, if frames are slow, drop the bloom and render at 1x.
    frames++;
    if (!qualityChecked && frames > 30) {
      measured += dt;
      if (frames === 120) {
        qualityChecked = true;
        if (measured / 90 > 1 / 40) {
          useBloom = false;
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
    highlight(id) {
      linked = id;
      needsRender = true;
    },
  };
}

function faceTrack(track, object, u) {
  const p = track.at(u, new THREE.Vector3());
  p.y = object.position.y;
  object.lookAt(p);
}

// Holds on each section while it is centred, moves in between.
function holdEase(t) {
  return smooth(0.15, 0.85, t);
}

function smooth(a, b, t) {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
