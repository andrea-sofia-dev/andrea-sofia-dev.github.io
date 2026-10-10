import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { Terminal } from './terminal.js';

const BG = 0x05070c;
const SECTIONS = ['hero', 'how', 'projects', 'stack', 'contact'];
const SKILLS_CENTER = new THREE.Vector3(-12, 1, 2.5);

// One camera shot per page section, in order.
const SHOTS = [
  { pos: new THREE.Vector3(0, 1.0, 10.5), look: new THREE.Vector3(0, 0.2, 0) },
  { pos: new THREE.Vector3(0.4, 0.25, 6.3), look: new THREE.Vector3(0, 0.05, 0) },
  { pos: new THREE.Vector3(2.8, 4.6, 11), look: new THREE.Vector3(0.3, -0.2, 0) },
  { pos: SKILLS_CENTER.clone().add(new THREE.Vector3(2.4, 0.8, 5.6)), look: SKILLS_CENTER.clone() },
  { pos: new THREE.Vector3(0, 7.5, 15.5), look: new THREE.Vector3(0, -0.6, 0) },
];

const LINK_SEGMENTS = 32;

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
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.FogExp2(BG, 0.042);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  camera.position.copy(SHOTS[0].pos);
  const lookAt = SHOTS[0].look.clone();
  camera.lookAt(lookAt);

  // ---------- lights ----------
  scene.add(new THREE.HemisphereLight(0x5a6ea8, BG, 0.9));
  const key = new THREE.PointLight(0x38e1ff, 26, 0, 2);
  key.position.set(-3.2, 2.2, 3);
  const rim = new THREE.PointLight(0xa78bfa, 22, 0, 2);
  rim.position.set(3.6, -0.8, 2.4);
  const sun = new THREE.DirectionalLight(0xffffff, 0.5);
  sun.position.set(2, 4, 6);
  scene.add(key, rim, sun);

  // ---------- the terminal ----------
  const terminal = new Terminal({ scripts, lang, animated: !reducedMotion });
  const monitor = new THREE.Group();
  scene.add(monitor);

  const body = new THREE.Mesh(
    new RoundedBoxGeometry(3.42, 2.17, 0.16, 4, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x0d1320, metalness: 0.75, roughness: 0.32 }),
  );
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.95),
    new THREE.MeshBasicMaterial({ map: terminal.texture, toneMapped: false }),
  );
  screen.position.z = 0.082;
  const frame = new THREE.LineLoop(
    roundedRect(3.5, 2.25, 0.11),
    new THREE.LineBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(1.8), toneMapped: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 6.5),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.position.z = -0.8;
  monitor.add(halo, body, screen, frame);

  // ---------- projects orbiting the terminal ----------
  const hitTargets = [];
  const packetGeometry = new THREE.SphereGeometry(0.035, 8, 6);
  const curve = new THREE.QuadraticBezierCurve3();
  const tmp = new THREE.Vector3();

  const orbiting = nodes.map((node, i) => {
    const color = new THREE.Color(node.color);
    const group = new THREE.Group();

    const core = new THREE.Mesh(
      shapeGeometry(node.shape),
      new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.9,
        roughness: 0.35,
        metalness: 0.2,
        flatShading: true,
      }),
    );
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.52, 1)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
    );
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 8), new THREE.MeshBasicMaterial());
    hit.visible = false; // still hit by the raycaster
    hit.userData.id = node.id;
    hitTargets.push(hit);

    const el = document.createElement('div');
    el.className = 'node-label';
    el.style.setProperty('--c', `#${color.getHexString()}`);
    const tag = document.createElement('span');
    tag.textContent = node.label;
    el.append(tag);
    tag.addEventListener('click', () => onNodeClick?.(node.id));
    tag.addEventListener('pointerenter', () => setHovered(node.id));
    tag.addEventListener('pointerleave', () => setHovered(null));
    const label = new CSS2DObject(el);
    label.position.set(0, 0.78, 0);
    label.userData.tag = tag;

    group.add(core, shell, hit, label);
    scene.add(group);

    const link = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array((LINK_SEGMENTS + 1) * 3), 3),
      ),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3 }),
    );
    link.frustumCulled = false;
    scene.add(link);

    const packets = [0, 0.5].map((offset) => {
      const mesh = new THREE.Mesh(
        packetGeometry,
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.2), toneMapped: false }),
      );
      scene.add(mesh);
      return { mesh, offset };
    });

    return {
      id: node.id,
      group,
      label,
      core,
      shell,
      link,
      packets,
      glow: 0,
      orbit: {
        // Same angular speed for all, so the nodes keep their spacing and never run into each other.
        radius: [3.3, 3.4, 3.75, 3.35][i % 4],
        speed: 0.1,
        phase: 0.6 + (i * Math.PI * 2) / nodes.length,
        height: [0.95, -0.75, 0.25, -0.2][i % 4],
      },
    };
  });

  // ---------- skills constellation ----------
  const constellation = new THREE.Group();
  constellation.position.copy(SKILLS_CENTER);
  scene.add(constellation);

  const points = fibonacciSphere(skills.length, 1.75);
  const palette = [0x38e1ff, 0xa78bfa, 0x5cf2b0];
  const starGeometry = new THREE.OctahedronGeometry(0.075, 0);
  const skillLabels = skills.map((name, i) => {
    const star = new THREE.Mesh(
      starGeometry,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(palette[i % palette.length]).multiplyScalar(1.6),
        toneMapped: false,
      }),
    );
    star.position.copy(points[i]);
    const el = document.createElement('div');
    el.className = 'skill-label';
    const text = document.createElement('span');
    text.textContent = name;
    el.append(text);
    const label = new CSS2DObject(el);
    label.position.copy(points[i]).multiplyScalar(1.14);
    constellation.add(star, label);
    return { label, text };
  });

  const segments = [];
  const joined = new Set();
  points.forEach((p, i) => {
    points
      .map((q, j) => [j, p.distanceTo(q)])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .forEach(([j]) => {
        const id = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (joined.has(id)) return;
        joined.add(id);
        segments.push(p, points[j]);
      });
  });
  constellation.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints(segments),
      new THREE.LineBasicMaterial({ color: 0x7088d0, transparent: true, opacity: 0.4 }),
    ),
    new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.75, 2),
      new THREE.MeshBasicMaterial({ color: 0x2a3a5c, wireframe: true, transparent: true, opacity: 0.16 }),
    ),
  );

  // ---------- floor grid and floating dust ----------
  const grid = new THREE.GridHelper(90, 90, 0x1f6f8b, 0x15233a);
  grid.position.y = -2.6;
  grid.material.transparent = true;
  grid.material.opacity = 0.55;
  scene.add(grid);

  const dust = makeDust(small ? 700 : 1800);
  scene.add(dust);

  // ---------- rendering ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.68, 0.45, 0.3);
  composer.addPass(bloom);
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
    camera.fov = portrait ? 50 : 42;
    distanceScale = portrait ? 1 + (1 - camera.aspect) * 1.3 : 1;
    // Wide screens: the text panel ends ~580 px from the left, so the scene centres in the space after it.
    // Narrow screens: text at the bottom, so the scene moves up.
    if (w >= 900) camera.setViewOffset(w, h, -(Math.min(w * 0.05, 72) + 580) / 2, 0, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.26, w, h);
    camera.updateProjectionMatrix();
    needsRender = true;
  }

  // ---------- interaction ----------
  let progress = 0; // scroll position as a float section index
  let hovered = null; // node under the mouse
  let linked = null; // node whose card is hovered or focused
  let needsRender = true;
  const pointer = new THREE.Vector2();
  const parallax = new THREE.Vector2();
  const parallaxTarget = new THREE.Vector2();
  let mouseOnCanvas = false;
  const raycaster = new THREE.Raycaster();
  const occluder = new THREE.Raycaster();
  const toNode = new THREE.Vector3();

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
  const desiredPos = new THREE.Vector3();
  const desiredLook = new THREE.Vector3();
  const toCamera = new THREE.Vector3();
  const starWorld = new THREE.Vector3();
  const timer = new THREE.Timer();
  timer.connect(document); // no time jump after the tab was hidden
  let elapsed = 0;
  let frames = 0;
  let measured = 0;
  // ?hq keeps full quality (used to capture the preview image on a slow headless GPU).
  let qualityChecked = new URLSearchParams(location.search).has('hq');

  function shotAt(p, outPos, outLook) {
    const i = Math.min(Math.floor(p), SHOTS.length - 1);
    const j = Math.min(i + 1, SHOTS.length - 1);
    const t = holdEase(p - i);
    outLook.lerpVectors(SHOTS[i].look, SHOTS[j].look, t);
    outPos.lerpVectors(SHOTS[i].pos, SHOTS[j].pos, t);
    // On portrait screens, step back so the scene still fits.
    outPos.sub(outLook).multiplyScalar(distanceScale).add(outLook);
  }

  function placeNodes(dt) {
    for (const o of orbiting) {
      const a = o.orbit.phase + elapsed * o.orbit.speed;
      o.group.position.set(
        Math.cos(a) * o.orbit.radius * 0.85,
        o.orbit.height + Math.sin(elapsed * 0.8 + o.orbit.phase) * 0.15,
        Math.sin(a) * o.orbit.radius * 0.8,
      );
      o.core.rotation.set(elapsed * 0.4, elapsed * 0.6, 0);
      o.shell.rotation.set(-elapsed * 0.2, -elapsed * 0.3, 0);

      // Fade the label while the node is behind the monitor.
      toNode.copy(o.group.position).sub(camera.position);
      occluder.far = toNode.length();
      occluder.set(camera.position, toNode.normalize());
      const hidden = occluder.intersectObject(body, false).length > 0;
      if (hidden !== o.hidden) {
        o.hidden = hidden;
        o.label.userData.tag.style.opacity = hidden ? '0.15' : '';
      }

      const target = hovered === o.id || linked === o.id ? 1 : 0;
      o.glow = reducedMotion ? target : THREE.MathUtils.damp(o.glow, target, 8, dt);
      o.group.scale.setScalar(1 + o.glow * 0.35);
      o.core.material.emissiveIntensity = 0.9 + o.glow * 1.8;
      o.shell.material.opacity = 0.45 + o.glow * 0.45;
      o.link.material.opacity = 0.3 + o.glow * 0.5;

      // Curved link from the terminal to the node, with two packets travelling along it.
      curve.v0.set(0, monitor.position.y, -0.1);
      curve.v2.copy(o.group.position);
      curve.v1.copy(curve.v0).lerp(curve.v2, 0.5);
      curve.v1.y += 0.9;
      const attr = o.link.geometry.attributes.position;
      for (let k = 0; k <= LINK_SEGMENTS; k++) {
        curve.getPoint(k / LINK_SEGMENTS, tmp);
        attr.setXYZ(k, tmp.x, tmp.y, tmp.z);
      }
      attr.needsUpdate = true;
      for (const p of o.packets) curve.getPoint((elapsed * 0.32 + p.offset) % 1, p.mesh.position);
    }
  }

  // Labels on the far side of the constellation fade out.
  function shadeSkillLabels() {
    toCamera.copy(camera.position).sub(SKILLS_CENTER).normalize();
    for (const s of skillLabels) {
      s.label.getWorldPosition(starWorld).sub(SKILLS_CENTER).normalize();
      const facing = starWorld.dot(toCamera);
      s.text.style.opacity = (0.2 + 0.8 * THREE.MathUtils.smoothstep(facing, -0.4, 0.6)).toFixed(2);
    }
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
      // No camera flights and no idle animation: cut to the section's shot, draw only on change.
      if (!needsRender) return;
      shotAt(Math.round(progress), camera.position, lookAt);
      camera.lookAt(lookAt);
      placeNodes(0);
      shadeSkillLabels();
      render();
      needsRender = false;
      return;
    }

    elapsed += dt;

    shotAt(progress, desiredPos, desiredLook);
    parallax.lerp(parallaxTarget, 1 - Math.exp(-dt * 3));
    desiredPos.x += parallax.x * 0.45;
    desiredPos.y += parallax.y * 0.28;
    const ease = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(desiredPos, ease);
    lookAt.lerp(desiredLook, ease);
    camera.lookAt(lookAt);

    monitor.position.y = Math.sin(elapsed * 0.9) * 0.07;
    monitor.rotation.y = Math.sin(elapsed * 0.35) * 0.06;
    terminal.update(dt);

    placeNodes(dt);
    if (mouseOnCanvas) pick();

    constellation.rotation.y += dt * 0.08;
    shadeSkillLabels();
    dust.rotation.y += dt * 0.004;

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

  resize();
  window.addEventListener('resize', resize);
  renderer.setAnimationLoop(tick);

  return {
    setProgress(p) {
      const section = SECTIONS[Math.round(p)] || 'hero';
      if (labelLayer.dataset.section !== section) labelLayer.dataset.section = section;
      if (reducedMotion && Math.round(p) !== Math.round(progress)) needsRender = true;
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

// Camera holds on each shot while its section is centred, then moves between them.
function holdEase(t) {
  const x = THREE.MathUtils.clamp((t - 0.15) / 0.7, 0, 1);
  return x * x * (3 - 2 * x);
}

function shapeGeometry(shape) {
  if (shape === 'octahedron') return new THREE.OctahedronGeometry(0.34, 0);
  if (shape === 'dodecahedron') return new THREE.DodecahedronGeometry(0.3, 0);
  if (shape === 'tetrahedron') return new THREE.TetrahedronGeometry(0.38, 0);
  return new THREE.IcosahedronGeometry(0.32, 0);
}

function roundedRect(w, h, r, steps = 6) {
  const x = w / 2 - r;
  const y = h / 2 - r;
  const corners = [
    [x, y, 0],
    [-x, y, Math.PI / 2],
    [-x, -y, Math.PI],
    [x, -y, Math.PI * 1.5],
  ];
  const pts = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}

function fibonacciSphere(n, radius) {
  const pts = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = golden * i;
    pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(radius));
  }
  return pts;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(56, 225, 255, 0.55)');
  g.addColorStop(0.35, 'rgba(120, 140, 255, 0.22)');
  g.addColorStop(0.7, 'rgba(167, 139, 250, 0.06)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeDust(count) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const tints = [new THREE.Color(0x38e1ff), new THREE.Color(0xa78bfa), new THREE.Color(0xc8d4ff)];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(70);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(-2.4, 16);
    positions[i * 3 + 2] = THREE.MathUtils.randFloat(-40, 10);
    const c = tints[i % tints.length];
    const k = THREE.MathUtils.randFloat(0.35, 1);
    colors[i * 3] = c.r * k;
    colors[i * 3 + 1] = c.g * k;
    colors[i * 3 + 2] = c.b * k;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);

  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.09,
      map: new THREE.CanvasTexture(c),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
}
