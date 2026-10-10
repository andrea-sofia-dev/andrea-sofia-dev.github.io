import * as THREE from 'three';
import { WIDTH } from './track.js';

// The airfield around the circuit: start gantry, big screen, control tower, radar,
// one hangar per project, floodlights, barriers, runway and the city lights far away.

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function buildBase({ track, nodes, screenTexture, spots }) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a3039, metalness: 0.6, roughness: 0.5 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x23272f, roughness: 0.95 });

  group.add(ground(), runway(), cityLights(), poolsLayer());

  // ---------- start gantry with five lights ----------
  const gantry = new THREE.Group();
  placeOnTrack(track, gantry, 0, 0);
  for (const side of [1, -1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7, 0.6), metal);
    pillar.position.set(side * (WIDTH / 2 + 1.4), 3.5, 0);
    gantry.add(pillar);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 3.4, 1.1, 0.7), metal);
  beam.position.y = 6.7;
  gantry.add(beam);
  // Neon strip under the beam and a sign facing the grid.
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH + 3.2, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2.4), toneMapped: false }),
  );
  strip.position.set(0, 6.1, -0.36);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH + 2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: signTexture('airfield circuit · roma', '#c9d3e2') }),
  );
  banner.position.set(0, 7.75, -0.36);
  banner.rotation.y = Math.PI;
  gantry.add(strip, banner);
  const gantryLight = new THREE.PointLight(0xcfe6ff, 30, 16, 1.8);
  gantryLight.position.set(0, 5.4, -2);
  gantry.add(gantryLight);
  const startLights = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a0306, toneMapped: false });
    const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.32, 24), mat);
    lamp.position.set((i - 2) * 1.15, 6.7, -0.36);
    lamp.rotation.y = Math.PI; // facing the grid
    gantry.add(lamp);
    startLights.push(mat);
  }
  group.add(gantry);

  // ---------- big screen with the terminal, control tower, radar ----------
  const screen = new THREE.Group();
  track.beside(spots.screen, 15, screen.position);
  faceTrack(track, screen, spots.screen);
  for (const side of [1, -1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.4, 0.5), metal);
    leg.position.set(side * 4.6, 1.7, -0.3);
    screen.add(leg);
  }
  const panel = new THREE.Mesh(new THREE.BoxGeometry(12.9, 8.1, 0.5), metal);
  panel.position.set(0, 7.3, -0.3);
  const display = new THREE.Mesh(
    new THREE.PlaneGeometry(12.2, 7.43),
    new THREE.MeshBasicMaterial({ map: screenTexture, toneMapped: false }),
  );
  display.position.set(0, 7.3, -0.04);
  const frame = new THREE.LineLoop(
    roundedRect(13.1, 8.3, 0.3),
    new THREE.LineBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2), toneMapped: false }),
  );
  frame.position.set(0, 7.3, 0);
  screen.add(panel, display, frame);
  group.add(screen);

  const tower = new THREE.Group();
  track.beside(spots.tower, 30, tower.position);
  faceTrack(track, tower, spots.tower);
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(3.6, 12, 3.6), concrete);
  shaft.position.y = 6;
  const cab = new THREE.Mesh(
    new THREE.BoxGeometry(6.6, 3, 6.6),
    new THREE.MeshStandardMaterial({ color: 0x071019, emissive: 0x2aa4c8, emissiveIntensity: 0.45, metalness: 0.8, roughness: 0.2 }),
  );
  cab.position.y = 13.5;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.4, 7.4), concrete);
  roof.position.y = 15.2;
  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2), metal);
  antenna.position.y = 17.4;
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2d3a, toneMapped: false });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), beaconMat);
  beacon.position.y = 19.6;
  tower.add(shaft, cab, roof, antenna, beacon);
  group.add(tower);

  const radar = new THREE.Group();
  track.beside(spots.radar, 24, radar.position);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7.4), metal);
  mast.position.y = 3.7;
  const head = new THREE.Group();
  head.position.y = 7.6;
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 28, 10, 0, Math.PI * 2, 0, 0.6).rotateX(-Math.PI / 2 + 0.35),
    new THREE.MeshStandardMaterial({ color: 0x9aa4b3, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }),
  );
  dish.position.z = 1.4;
  head.add(dish);
  radar.add(mast, head);
  group.add(radar);

  // ---------- one hangar per project ----------
  const hangars = nodes.map((node, i) => {
    const u = spots.hangars[i];
    const h = hangar(node, metal);
    track.beside(u, 19, h.group.position);
    faceTrack(track, h.group, u);
    group.add(h.group);
    return h;
  });

  // ---------- floodlights and barriers ----------
  const beams = new THREE.MeshBasicMaterial({
    color: 0x9fb8ff,
    transparent: true,
    opacity: 0.02,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (const u of spots.floodlights) group.add(floodlight(track, u, metal, beams));
  group.add(barriers(track));

  return {
    group,
    startLights,
    hangars,
    screen,
    tower,
    beams,
    update(elapsed) {
      head.rotation.y = elapsed * 0.9;
      beaconMat.color.setRGB(Math.sin(elapsed * 3) > 0.6 ? 3 : 0.15, 0, 0.04); // aircraft warning light
    },
  };
}

// Puts an object on the track at u, lateral metres off the centre line, facing forward.
function placeOnTrack(track, object, u, lateral) {
  track.beside(u, lateral, object.position);
  track.at(u, _a, _b);
  object.lookAt(_a.copy(object.position).add(_b));
}

// Turns an object so that its +z side faces the track at u.
function faceTrack(track, object, u) {
  track.at(u, _a);
  _a.y = object.position.y;
  object.lookAt(_a);
}

function hangar(node, metal) {
  const R = 5.5;
  const L = 12;
  const color = new THREE.Color(node.color);
  const group = new THREE.Group();

  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, L, 36, 1, true, -Math.PI / 2, Math.PI).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({
      color: 0x2c323c,
      metalness: 0.55,
      roughness: 0.45,
      map: ribsTexture(),
      side: THREE.DoubleSide,
    }),
  );
  const back = new THREE.Mesh(
    new THREE.CircleGeometry(R, 36, 0, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x0c0f14, emissive: color, emissiveIntensity: 0.25 }),
  );
  back.position.z = -L / 2;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(R * 2, L).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x111419, roughness: 0.8 }),
  );
  floor.position.y = 0.03;

  const archPts = [];
  for (let i = 0; i <= 36; i++) {
    const a = (i / 36) * Math.PI;
    archPts.push(new THREE.Vector3(Math.cos(a) * R, Math.sin(a) * R, L / 2 + 0.03));
  }
  const doorMat = new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(1.8), toneMapped: false });
  const door = new THREE.Line(new THREE.BufferGeometry().setFromPoints(archPts), doorMat);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(6.4, 1.1),
    new THREE.MeshBasicMaterial({ map: signTexture(node.label, `#${color.getHexString()}`), toneMapped: false }),
  );
  sign.position.set(0, 4.05, L / 2 + 0.05);

  const light = new THREE.PointLight(color, 45, 20, 1.8);
  light.position.set(0, 3.6, 0);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(R * 2, R, L), new THREE.MeshBasicMaterial());
  hit.position.y = R / 2;
  hit.visible = false;
  hit.userData.id = node.id;

  group.add(shell, back, floor, door, sign, light, hit);

  return {
    id: node.id,
    group,
    hit,
    markerHeight: R + 2.4,
    glow(k) {
      doorMat.color.copy(color).multiplyScalar(1.8 + k * 2.5);
      light.intensity = 45 + k * 90;
      back.material.emissiveIntensity = 0.25 + k * 0.5;
    },
  };
}

function floodlight(track, u, metal, beams) {
  const g = new THREE.Group();
  track.beside(u, WIDTH / 2 + 6, g.position);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 13), metal);
  pole.position.y = 6.5;
  g.add(pole);

  const head = new THREE.Group();
  head.position.y = 13;
  const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1, 0.4), metal);
  const lamp = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 0.8),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf2ff).multiplyScalar(2.4), toneMapped: false }),
  );
  lamp.position.z = 0.21;
  head.add(box, lamp);
  g.add(head);

  // Aim at the track and draw a faint beam of light.
  const target = track.at(u, new THREE.Vector3());
  const local = target.clone().sub(g.position);
  head.lookAt(target);
  const top = new THREE.Vector3(0, 13, 0);
  const dir = local.clone().sub(top);
  const length = dir.length();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, length, 24, 1, true), beams);
  cone.position.copy(top).addScaledVector(dir, 0.5);
  cone.quaternion.setFromUnitVectors(UP, dir.clone().normalize().negate());
  g.add(cone);
  lightPool(target, 8, 0xcfdcff, 0.12);
  return g;
}

// Red and white blocks on the outside of every corner.
function barriers(track) {
  const spots = [];
  for (let i = 0; i < track.points.length - 1; i += 3) if (track.corner[i]) spots.push(i);
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1.1, 0.7, 0.5),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    spots.length,
  );
  const m = new THREE.Object3D();
  const red = new THREE.Color(0xb81d33);
  const white = new THREE.Color(0xd5dae2);
  spots.forEach((i, k) => {
    const p = track.points[i];
    const s = track.sides[i];
    m.position.copy(p).addScaledVector(s, (WIDTH / 2 + 3.2) * track.outSign);
    m.position.y = 0.35;
    m.lookAt(_a.copy(m.position).add(s));
    m.updateMatrix();
    mesh.setMatrixAt(k, m.matrix);
    mesh.setColorAt(k, k % 2 ? red : white);
  });
  return mesh;
}

function ground() {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 1 }),
  );
  return mesh;
}

// The old runway under the main straight, with its markings and edge lights.
function runway() {
  const g = new THREE.Group();
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(190, 30).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.95 }),
  );
  strip.position.set(-8, 0.01, 0);
  g.add(strip);

  const paint = new THREE.MeshBasicMaterial({ color: 0x8d95a3 });
  for (const z of [-14.4, 14.4]) {
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(186, 0.4).rotateX(-Math.PI / 2), paint);
    edge.position.set(-8, 0.02, z);
    g.add(edge);
  }
  // Threshold "piano keys" at both ends.
  for (const x of [-98, 82]) {
    for (let k = 0; k < 8; k++) {
      const key = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.2).rotateX(-Math.PI / 2), paint);
      key.position.set(x, 0.02, -12 + k * 3.4);
      g.add(key);
    }
  }
  for (const [text, x, rot] of [['27', -84, -Math.PI / 2], ['09', 68, Math.PI / 2]]) {
    const number = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: numberTexture(text), transparent: true }),
    );
    number.position.set(x, 0.02, 0);
    number.rotation.y = rot;
    g.add(number);
  }

  // Edge lights: white along the runway, blue along the taxiway.
  const positions = [];
  const colors = [];
  for (let x = -100; x <= 84; x += 8) {
    for (const z of [-15.5, 15.5]) {
      positions.push(x, 0.2, z);
      colors.push(1.8, 1.7, 1.4);
    }
  }
  for (let x = -40; x <= 60; x += 5) {
    positions.push(x, 0.2, 34);
    colors.push(0.3, 0.6, 2.6);
  }
  const lights = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    positions.length / 3,
  );
  const m = new THREE.Object3D();
  for (let i = 0; i < positions.length / 3; i++) {
    m.position.fromArray(positions, i * 3);
    m.updateMatrix();
    lights.setMatrixAt(i, m.matrix);
    lights.setColorAt(i, new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]));
  }
  g.add(lights);
  return g;
}

// Pools of light on the ground (cheaper than real lights), shared texture.
let poolTex = null;
const pools = new THREE.Group();
export function lightPool(position, radius, color = 0xcfdcff, opacity = 0.14) {
  poolTex ??= radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const pool = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      map: poolTex,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  pool.position.set(position.x, 0.06, position.z);
  pools.add(pool);
  return pool;
}
function poolsLayer() {
  return pools;
}

function cityLights() {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const warm = [new THREE.Color(0xffc27a), new THREE.Color(0xfff1d6), new THREE.Color(0x9fd8ff)];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 170 + Math.random() * 60;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = Math.random() ** 3 * 9 + 0.3;
    positions[i * 3 + 2] = Math.sin(a) * r - 20;
    const c = warm[i % 3];
    const k = 0.5 + Math.random() * 1.2;
    colors.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return new THREE.Points(
    geometry,
    new THREE.PointsMaterial({
      size: 0.9,
      map: radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)'),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
}

// ---------- small textures ----------

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function ribsTexture() {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 128;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 128; y += 8) {
    ctx.fillStyle = '#d0d6df';
    ctx.fillRect(0, y, 16, 5);
    ctx.fillStyle = '#7d8592';
    ctx.fillRect(0, y + 5, 16, 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text, color) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 110;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#05070c';
  ctx.fillRect(0, 0, 640, 110);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 628, 98);
  ctx.fillStyle = color;
  ctx.font = '700 56px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), 320, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function numberTexture(text) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(141, 149, 163, 0.9)';
  ctx.font = '700 200px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedRect(w, h, r, steps = 6) {
  const x = w / 2 - r;
  const y = h / 2 - r;
  const pts = [];
  for (const [cx, cy, start] of [[x, y, 0], [-x, y, Math.PI / 2], [-x, -y, Math.PI], [x, -y, Math.PI * 1.5]]) {
    for (let i = 0; i <= steps; i++) {
      const a = start + (i / steps) * (Math.PI / 2);
      pts.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0));
    }
  }
  return new THREE.BufferGeometry().setFromPoints(pts);
}
