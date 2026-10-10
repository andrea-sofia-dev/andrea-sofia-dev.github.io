import * as THREE from 'three';
import { WIDTH } from './track.js';

// A night Grand Prix in the city: start gantry, pit wall screen, one team garage per project,
// a grandstand full of phone flashes, floodlights, barriers and the skyline.

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export function buildBase({ track, nodes, screenTexture, spots }) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a3039, metalness: 0.6, roughness: 0.5 });

  group.add(ground(), skyline(), cityLights(), pools);

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
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH + 3.2, 0.08, 0.08),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2.4), toneMapped: false }),
  );
  strip.position.set(0, 6.1, -0.36);
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH + 2.6, 0.8),
    new THREE.MeshBasicMaterial({ map: signTexture('roma night gp', '#c9d3e2') }),
  );
  banner.position.set(0, 7.75, -0.36);
  banner.rotation.y = Math.PI;
  const gantryLight = new THREE.PointLight(0xcfe6ff, 30, 16, 1.8);
  gantryLight.position.set(0, 5.4, -2);
  gantry.add(beam, strip, banner, gantryLight);
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

  // ---------- pit wall screen with the terminal ----------
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

  // ---------- one team garage per project ----------
  const garages = nodes.map((node, i) => {
    const u = spots.garages[i];
    const g = garage(node, metal);
    track.beside(u, 18, g.group.position);
    faceTrack(track, g.group, u);
    group.add(g.group);
    return g;
  });

  // ---------- grandstand, floodlights, barriers ----------
  const stand = grandstand();
  stand.group.position.set(-34, 0, 19);
  stand.group.rotation.y = Math.PI; // facing the main straight
  group.add(stand.group);

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
    garages,
    screen,
    beams,
    update(elapsed) {
      stand.flash();
    },
  };
}

// Puts an object on the track at u, lateral metres off the centre line, facing forward.
export function placeOnTrack(track, object, u, lateral) {
  track.beside(u, lateral, object.position);
  track.at(u, _a, _b);
  object.lookAt(_a.copy(object.position).add(_b));
}

// Turns an object so that its +z side faces the track at u.
export function faceTrack(track, object, u) {
  track.at(u, _a);
  _a.y = object.position.y;
  object.lookAt(_a);
}

function garage(node, metal) {
  const W = 9;
  const H = 5;
  const D = 9;
  const color = new THREE.Color(node.color);
  const hex = `#${color.getHexString()}`;
  const group = new THREE.Group();
  const shell = new THREE.MeshStandardMaterial({ color: 0x1d222a, roughness: 0.7, metalness: 0.2 });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.3), shell);
  back.position.set(0, H / 2, -D / 2);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.4, D + 0.6), shell);
  roof.position.y = H + 0.2;
  group.add(back, roof);
  for (const side of [1, -1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, H, D), shell);
    wall.position.set((side * W) / 2, H / 2, 0);
    group.add(wall);
  }

  // Team colour on the back wall, glossy epoxy floor, tyre stacks.
  const teamWall = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 1, H - 1.4),
    new THREE.MeshStandardMaterial({ color: 0x0c0f14, emissive: color, emissiveIntensity: 0.3 }),
  );
  teamWall.position.set(0, H / 2 + 0.2, -D / 2 + 0.16);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.25, metalness: 0.4 }),
  );
  floor.position.y = 0.03;
  group.add(teamWall, floor);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9 });
  const bandMat = new THREE.MeshBasicMaterial({ color });
  for (const x of [-3.2, 3.2]) {
    for (let k = 0; k < 3; k++) {
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.38, 24), rubber);
      tyre.position.set(x, 0.2 + k * 0.4, -D / 2 + 1.1);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.02, 6, 24).rotateX(Math.PI / 2), bandMat);
      band.position.copy(tyre.position);
      group.add(tyre, band);
    }
  }

  // Half-open roller door, neon outline of the opening, team sign on the fascia.
  const door = new THREE.Mesh(new THREE.BoxGeometry(W - 0.6, 1.1, 0.12), metal);
  door.position.set(0, H - 0.6, D / 2 - 0.1);
  const outlinePts = [
    [-(W / 2 - 0.25), 0.05], [-(W / 2 - 0.25), H - 0.2], [W / 2 - 0.25, H - 0.2], [W / 2 - 0.25, 0.05],
  ].map(([x, y]) => new THREE.Vector3(x, y, D / 2 + 0.02));
  const outlineMat = new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(1.8), toneMapped: false });
  const outline = new THREE.Line(new THREE.BufferGeometry().setFromPoints(outlinePts), outlineMat);
  const fascia = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 1.3, 0.25), shell);
  fascia.position.set(0, H + 0.95, D / 2 + 0.2);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(W - 0.4, 1.0),
    new THREE.MeshBasicMaterial({ map: signTexture(node.label, hex), toneMapped: false }),
  );
  sign.position.set(0, H + 0.95, D / 2 + 0.34);
  group.add(door, outline, fascia, sign);

  const light = new THREE.PointLight(color, 40, 16, 1.8);
  light.position.set(0, H - 1, 0);
  group.add(light);

  const hit = new THREE.Mesh(new THREE.BoxGeometry(W, H + 2, D), new THREE.MeshBasicMaterial());
  hit.position.y = H / 2 + 1;
  hit.visible = false;
  hit.userData.id = node.id;
  group.add(hit);

  return {
    id: node.id,
    group,
    hit,
    glow(k) {
      outlineMat.color.copy(color).multiplyScalar(1.8 + k * 2.5);
      light.intensity = 40 + k * 90;
      teamWall.material.emissiveIntensity = 0.3 + k * 0.6;
    },
  };
}

// Stepped grandstand with a canopy; the crowd's phones flash at random.
function grandstand() {
  const group = new THREE.Group();
  const LENGTH = 56;
  const ROWS = 8;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.9 });
  for (let k = 0; k < ROWS; k++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(LENGTH, 0.6 + k * 0.75, 1.3), concrete);
    step.position.set(0, (0.6 + k * 0.75) / 2, -k * 1.3);
    group.add(step);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(LENGTH + 2, 0.25, 12), concrete);
  canopy.position.set(0, 9.4, -5);
  canopy.rotation.x = -0.08;
  const canopyLight = new THREE.Mesh(
    new THREE.BoxGeometry(LENGTH, 0.06, 0.06),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff1d6).multiplyScalar(2), toneMapped: false }),
  );
  canopyLight.position.set(0, 9.05, 0.8);
  group.add(canopy, canopyLight);
  for (let x = -LENGTH / 2; x <= LENGTH / 2; x += 14) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.4, 9.4, 0.4), concrete);
    column.position.set(x, 4.7, -10.5);
    group.add(column);
  }

  const count = 1500;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const shirts = [0x38e1ff, 0xa78bfa, 0x5cf2b0, 0xff5f7a, 0xf5c518, 0xe8eef7].map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) {
    const row = i % ROWS;
    positions.set([(Math.random() - 0.5) * (LENGTH - 1), 0.6 + row * 0.75 + 0.45, -row * 1.3 + (Math.random() - 0.5) * 0.4], i * 3);
    const c = shirts[i % shirts.length];
    const k = 0.18 + Math.random() * 0.2;
    base.set([c.r * k, c.g * k, c.b * k], i * 3);
  }
  colors.set(base);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const crowd = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ size: 0.42, vertexColors: true, toneMapped: false, map: dotTexture(), transparent: true, depthWrite: false }),
  );
  group.add(crowd);

  const lit = [];
  return {
    group,
    flash() {
      const attr = geometry.attributes.color;
      for (const i of lit) attr.array.set(base.subarray(i * 3, i * 3 + 3), i * 3);
      lit.length = 0;
      for (let n = 0; n < 6; n++) {
        const i = Math.floor(Math.random() * count);
        attr.array.set([3, 3, 3], i * 3);
        lit.push(i);
      }
      attr.needsUpdate = true;
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
  head.lookAt(target);
  const top = new THREE.Vector3(0, 13, 0);
  const dir = target.clone().sub(g.position).sub(top);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, dir.length(), 24, 1, true), beams);
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
  return new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 1 }),
  );
}

// City blocks with lit windows all around the circuit.
function skyline() {
  const count = 90;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
    new THREE.MeshStandardMaterial({
      color: 0x07090d,
      emissive: 0xffffff,
      emissiveMap: windowsTexture(),
      emissiveIntensity: 0.45,
      fog: false,
    }),
    count,
  );
  const m = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.05;
    const r = 200 + Math.random() * 50;
    m.position.set(Math.cos(a) * r, 0, Math.sin(a) * r - 20);
    m.scale.set(10 + Math.random() * 14, 10 + Math.random() ** 2 * 45, 8 + Math.random() * 10);
    m.rotation.y = -a;
    m.updateMatrix();
    mesh.setMatrixAt(i, m.matrix);
  }
  return mesh;
}

function cityLights() {
  const count = 900;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const warm = [new THREE.Color(0xffc27a), new THREE.Color(0xfff1d6), new THREE.Color(0x9fd8ff)];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 120 + Math.random() * 30;
    positions.set([Math.cos(a) * r, Math.random() ** 3 * 6 + 0.3, Math.sin(a) * r - 20], i * 3);
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
      size: 0.8,
      map: dotTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
}

// Pools of light on the ground (cheaper than real lights).
const pools = new THREE.Group();
let poolTex = null;
export function lightPool(position, radius, color = 0xcfdcff, opacity = 0.14) {
  poolTex ??= dotTexture();
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

// ---------- small textures ----------

let dot = null;
function dotTexture() {
  if (dot) return dot;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  dot = new THREE.CanvasTexture(c);
  return dot;
}

function windowsTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 4; y < 128; y += 8) {
    for (let x = 4; x < 64; x += 8) {
      if (Math.random() < 0.35) {
        ctx.fillStyle = Math.random() < 0.7 ? '#ffcf8a' : '#9fd8ff';
        ctx.globalAlpha = 0.4 + Math.random() * 0.6;
        ctx.fillRect(x, y, 4, 4);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function signTexture(text, color) {
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
