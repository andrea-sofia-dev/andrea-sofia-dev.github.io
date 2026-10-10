import * as THREE from 'three';

// The paddock gym, open on the track side (local +z faces the track):
// a dark wall with LED strips, the plate rack (one plate per tool), a power rack with bench,
// a dumbbell rack, a turf lane with a sled, kettlebells and a tyre to flip.

// Olympic plate colours by weight.
const PLATE = {
  25: { color: '#c8262c', text: '#ffffff', radius: 0.78 },
  20: { color: '#1f5fd6', text: '#ffffff', radius: 0.78 },
  15: { color: '#e0ac12', text: '#14161b', radius: 0.72 },
  10: { color: '#169647', text: '#ffffff', radius: 0.64 },
  5: { color: '#e4e7ec', text: '#14161b', radius: 0.52 },
};

export function buildGym({ skills, signText }) {
  const group = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0x23272e, metalness: 0.85, roughness: 0.32 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xc3cad4, metalness: 1, roughness: 0.15 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0c0d10, roughness: 0.9 });
  const amber = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5a524).multiplyScalar(2), toneMapped: false });
  const cyan = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2), toneMapped: false });

  // ---------- floor, back wall, LED strips ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 13).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: rubberTexture(), roughness: 0.85 }),
  );
  floor.position.set(0, 0.04, -0.3);
  const turf = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 11).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: turfTexture(), roughness: 1 }),
  );
  turf.position.set(10.4, 0.05, -0.6);
  group.add(floor, turf);

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(26, 7.6, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.8, metalness: 0.2 }),
  );
  wall.position.set(0, 3.8, -6.4);
  group.add(wall);
  for (let x = -12; x <= 12; x += 2.4) {
    if (Math.abs(x) < 5.4) continue; // the plate rack stands there
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 6.6, 0.06), Math.round(x / 2.4) % 2 ? amber : cyan);
    strip.position.set(x, 3.6, -6.17);
    group.add(strip);
  }
  const topStrip = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.06, 0.06), amber);
  topStrip.position.set(0, 7.45, -6.17);
  group.add(topStrip);

  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 1.2),
    new THREE.MeshBasicMaterial({ map: signTexture(signText), toneMapped: false, transparent: true }),
  );
  sign.position.set(0, 6.55, -6.15);
  group.add(sign);

  // ---------- plate rack: three rows of four, facing the track ----------
  const rack = new THREE.Group();
  rack.position.z = -5.2;
  for (const x of [-4.7, 4.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.6, 0.16), steel);
    post.position.set(x, 2.8, 0);
    rack.add(post);
  }
  const rows = [4.6, 2.95, 1.3];
  for (const y of rows) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 0.12), steel);
    bar.position.set(0, y + 0.85, -0.05);
    rack.add(bar);
  }
  skills.forEach((skill, i) => {
    const spec = PLATE[skill.kg] || PLATE[10];
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius, spec.radius, 0.1, 48).rotateX(Math.PI / 2), [
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.45 }),
      new THREE.MeshStandardMaterial({ map: plateTexture(skill.name, skill.kg, spec), roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.45 }),
    ]);
    plate.position.set(-3.3 + (i % 4) * 2.2, rows[Math.floor(i / 4)], 0.12);
    plate.rotation.z = ((i * 0.7) % 0.5) - 0.25; // hung a bit crooked, like in a real gym
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4).rotateX(Math.PI / 2), chrome);
    peg.position.set(plate.position.x, plate.position.y, 0);
    rack.add(peg, plate);
  });
  group.add(rack);

  // ---------- power rack with a loaded bar, bench in front ----------
  const power = new THREE.Group();
  power.position.set(-8.2, 0, -2.6);
  for (const [x, z] of [[-0.75, -0.65], [0.75, -0.65], [-0.75, 0.65], [0.75, 0.65]]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.6, 0.09), steel);
    upright.position.set(x, 1.3, z);
    power.add(upright);
  }
  for (const z of [-0.65, 0.65]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.09, 0.09), steel);
    top.position.set(0, 2.6, z);
    power.add(top);
  }
  for (const x of [-0.75, 0.75]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 1.4), steel);
    side.position.set(x, 2.6, 0);
    const safety = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.5), chrome);
    safety.position.set(x, 0.75, 0);
    power.add(side, safety);
  }
  const pullUp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7).rotateZ(Math.PI / 2), chrome);
  pullUp.position.set(0, 2.5, 0.75);
  power.add(pullUp, barbell([['#c8262c', 0.45], ['#c8262c', 0.45], ['#1f5fd6', 0.4]], chrome, steel, 1.45, 0.66));
  const bench = new THREE.Group();
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 1.25), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.6 }));
  pad.position.y = 0.47;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.42, 1.0), steel);
  frame.position.y = 0.21;
  bench.add(pad, frame);
  bench.position.set(0, 0, 0.1);
  power.add(bench);
  power.rotation.y = 0.25;
  group.add(power);

  // ---------- dumbbell rack ----------
  const dumbbells = new THREE.Group();
  dumbbells.position.set(7, 0, -4.9);
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.06, 0.6), steel);
  shelf.position.set(0, 0.55, 0);
  const shelfHigh = shelf.clone();
  shelfHigh.position.set(0, 0.95, -0.25);
  dumbbells.add(shelf, shelfHigh);
  for (const x of [-2.1, 2.1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.8), steel);
    leg.position.set(x, 0.5, -0.1);
    dumbbells.add(leg);
  }
  for (let i = 0; i < 8; i++) {
    const high = i >= 4;
    const size = 0.09 + (i % 4) * 0.022;
    const db = dumbbell(size, chrome, rubber);
    db.position.set(-1.6 + (i % 4) * 1.05, (high ? 0.95 : 0.55) + size, high ? -0.25 : 0);
    dumbbells.add(db);
  }
  group.add(dumbbells);

  // ---------- turf lane with a sled ----------
  const sled = new THREE.Group();
  sled.position.set(10.4, 0, 1.2);
  for (const x of [-0.35, 0.35]) {
    const runner = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 1.2), steel);
    runner.position.set(x, 0.04, 0);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1), steel);
    post.position.set(x, 0.6, -0.4);
    post.rotation.x = -0.35;
    sled.add(runner, post);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.9), steel);
  deck.position.y = 0.1;
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45), chrome);
  horn.position.set(0, 0.33, 0.1);
  sled.add(deck, horn);
  for (let k = 0; k < 3; k++) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.07, 32),
      new THREE.MeshStandardMaterial({ color: k ? '#1f5fd6' : '#c8262c', roughness: 0.5 }),
    );
    p.position.set(0, 0.16 + k * 0.075, 0.1);
    sled.add(p);
  }
  group.add(sled);

  // ---------- tyre to flip, kettlebells ----------
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.42, 18, 48).rotateX(Math.PI / 2), rubber);
  tyre.position.set(-3.6, 0.42, 2.2);
  const tread = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.4, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: slickTexture(), transparent: true }),
  );
  tread.position.set(-3.6, 0.845, 2.2);
  group.add(tyre, tread);
  [['#c8262c', 0.26], ['#1f5fd6', 0.22], ['#e0ac12', 0.19], ['#169647', 0.17]].forEach(([color, r], i) => {
    const kb = kettlebell(color, r);
    kb.position.set(2.4 + i * 0.75, 0.04, 2.6 - i * 0.15);
    kb.rotation.y = i * 0.6;
    group.add(kb);
  });

  // ---------- light ----------
  const lamp = new THREE.PointLight(0xffd9a8, 70, 24, 1.6);
  lamp.position.set(0, 7, 2);
  const fill = new THREE.PointLight(0x38e1ff, 25, 18, 1.8);
  fill.position.set(8, 4, 0);
  group.add(lamp, fill);

  return { group };
}

function barbell(plates, chrome, steel, width, y) {
  const bar = new THREE.Group();
  bar.position.y = y + 0.85;
  bar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.3, 12).rotateZ(Math.PI / 2), chrome));
  for (const side of [1, -1]) {
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.06, 16).rotateZ(Math.PI / 2), steel);
    collar.position.x = side * (width / 2 + 0.08);
    bar.add(collar);
    plates.forEach(([color, r], k) => {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.07, 36).rotateZ(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color, roughness: 0.45 }),
      );
      plate.position.x = side * (width / 2 + 0.15 + k * 0.075);
      bar.add(plate);
    });
  }
  return bar;
}

function dumbbell(size, chrome, rubber) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 10).rotateZ(Math.PI / 2), chrome));
  for (const side of [1, -1]) {
    const head = new THREE.Mesh(new THREE.CylinderGeometry(size, size, 0.13, 6).rotateZ(Math.PI / 2), rubber);
    head.position.x = side * 0.2;
    g.add(head);
  }
  return g;
}

function kettlebell(color, r) {
  const kb = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat);
  ball.position.y = r;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, r * 0.13, 8, 20, Math.PI), mat);
  handle.position.y = r * 1.75;
  kb.add(ball, handle);
  return kb;
}

// ---------- textures ----------

function plateTexture(name, kg, spec) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, 0, 512, 512);
  // Raised rim, inner ring and steel hub.
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(256, 256, 238, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(256, 256, 150, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#c3cad4';
  ctx.beginPath();
  ctx.arc(256, 256, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242b';
  ctx.beginPath();
  ctx.arc(256, 256, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = spec.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 64;
  const font = (s) => `800 ${s}px "Space Grotesk Variable", system-ui, sans-serif`;
  ctx.font = font(size);
  while (ctx.measureText(name).width > 360 && size > 30) ctx.font = font((size -= 4));
  ctx.fillText(name, 256, 160);
  ctx.font = '700 46px "JetBrains Mono Variable", Consolas, monospace';
  ctx.fillText(`${kg} KG`, 256, 368);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2; // the cylinder cap maps the canvas sideways
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 154;
  const ctx = c.getContext('2d');
  const draw = () => {
    ctx.clearRect(0, 0, 1024, 154);
    ctx.fillStyle = '#ffc861';
    ctx.shadowColor = '#f5a524';
    ctx.shadowBlur = 26;
    ctx.font = 'italic 700 104px "Chakra Petch", "Space Grotesk Variable", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 512, 82);
  };
  draw();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  // Redraw once the game font is ready.
  document.fonts?.load('italic 700 40px "Chakra Petch"').then(() => {
    draw();
    t.needsUpdate = true;
  });
  return t;
}

function rubberTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#111317';
  ctx.fillRect(0, 0, 256, 256);
  // Speckles like recycled rubber flooring.
  for (let i = 0; i < 1400; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#1c1f25' : '#0a0b0e';
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = '#06070a';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 128) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6.5, 3.2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function turfTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f4d2b';
  ctx.fillRect(0, 0, 64, 256);
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? '#27603a' : '#173d22';
    ctx.fillRect(Math.random() * 64, Math.random() * 256, 1, 3);
  }
  ctx.fillStyle = '#e8eef7';
  for (let y = 0; y < 256; y += 64) ctx.fillRect(0, y, 64, 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function slickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.translate(128, 128);
  ctx.fillStyle = '#f5c518';
  ctx.font = '700 22px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  for (const a of [0, Math.PI]) {
    ctx.save();
    ctx.rotate(a);
    ctx.fillText('SLICK · DRY', 0, -100);
    ctx.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
