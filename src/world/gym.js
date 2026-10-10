import * as THREE from 'three';

// The base's training area: a plate rack with one plate per tool, a squat rack,
// kettlebells and a tyre to flip. Local +z faces the track.

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
  const steel = new THREE.MeshStandardMaterial({ color: 0x3a414c, metalness: 0.8, roughness: 0.35 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xb7bfcb, metalness: 1, roughness: 0.18 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0c0f, roughness: 0.95 });

  // Rubber floor.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 11).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: tilesTexture(), roughness: 0.95 }),
  );
  floor.position.set(0, 0.04, -0.5);
  group.add(floor);

  // Plate rack: three rows of four, facing the track.
  for (const x of [-4.7, 4.7]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 5.6, 0.16), steel);
    post.position.set(x, 2.8, -3);
    group.add(post);
  }
  const rows = [4.6, 2.95, 1.3];
  for (const y of rows) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.12, 0.12), steel);
    bar.position.set(0, y + 0.85, -3.05);
    group.add(bar);
  }
  skills.forEach((skill, i) => {
    const spec = PLATE[skill.kg] || PLATE[10];
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius, spec.radius, 0.1, 48).rotateX(Math.PI / 2), [
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5 }),
      new THREE.MeshStandardMaterial({ map: plateTexture(skill.name, skill.kg, spec), roughness: 0.55 }),
      new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.5 }),
    ]);
    plate.position.set(-3.3 + (i % 4) * 2.2, rows[Math.floor(i / 4)], -2.9);
    plate.rotation.z = (i * 0.7) % 0.5; // hung a bit crooked, like in a real gym
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4).rotateX(Math.PI / 2), chrome);
    peg.position.set(plate.position.x, plate.position.y, -3);
    group.add(peg, plate);
  });

  // Sign over the rack.
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(7, 1.05),
    new THREE.MeshBasicMaterial({ map: stencilTexture(signText), toneMapped: false }),
  );
  sign.position.set(0, 6.25, -3.05);
  group.add(sign);

  // Squat rack with a loaded bar.
  const rack = new THREE.Group();
  rack.position.set(-7.6, 0, 0.2);
  rack.rotation.y = 0.35;
  for (const [x, z] of [[-0.7, -0.6], [0.7, -0.6], [-0.7, 0.6], [0.7, 0.6]]) {
    const upright = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.7, 0.1), steel);
    upright.position.set(x, 1.35, z);
    rack.add(upright);
  }
  for (const z of [-0.6, 0.6]) {
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.1), steel);
    top.position.set(0, 2.7, z);
    rack.add(top);
  }
  const bar = new THREE.Group();
  bar.position.set(0, 1.55, 0.62);
  bar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 2.3, 12).rotateZ(Math.PI / 2), chrome));
  for (const side of [1, -1]) {
    for (let k = 0; k < 2; k++) {
      const plate = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.45, 0.07, 32).rotateZ(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: k ? '#1f5fd6' : '#c8262c', roughness: 0.5 }),
      );
      plate.position.x = side * (0.86 + k * 0.08);
      bar.add(plate);
    }
  }
  rack.add(bar);
  group.add(rack);

  // Tyre for flips: a racing slick laid flat.
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.42, 18, 48).rotateX(Math.PI / 2), rubber);
  tyre.position.set(7.4, 0.42, 0.8);
  group.add(tyre);
  const sidewall = new THREE.Mesh(
    new THREE.RingGeometry(0.7, 1.4, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: slickTexture(), transparent: true }),
  );
  sidewall.position.set(7.4, 0.845, 0.8);
  group.add(sidewall);

  // Kettlebells.
  [['#c8262c', 0.26], ['#1f5fd6', 0.22], ['#e0ac12', 0.19]].forEach(([color, r], i) => {
    const kb = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.2 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), mat);
    ball.position.y = r;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(r * 0.62, r * 0.13, 8, 20, Math.PI), mat);
    handle.position.y = r * 1.75;
    kb.add(ball, handle);
    kb.position.set(4.2 + i * 0.75, 0.04, 1.6 - i * 0.2);
    kb.rotation.y = i * 0.6;
    group.add(kb);
  });

  // Warm work light over the rack.
  const lamp = new THREE.PointLight(0xffd9a8, 60, 22, 1.7);
  lamp.position.set(0, 7.5, 2);
  group.add(lamp);

  return { group };
}

// ---------- textures ----------

function plateTexture(name, kg, spec) {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, 0, 512, 512);
  // Raised rim and inner ring.
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 22;
  ctx.beginPath();
  ctx.arc(256, 256, 238, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(256, 256, 150, 0, Math.PI * 2);
  ctx.stroke();
  // Hub.
  ctx.fillStyle = '#b7bfcb';
  ctx.beginPath();
  ctx.arc(256, 256, 44, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242b';
  ctx.beginPath();
  ctx.arc(256, 256, 26, 0, Math.PI * 2);
  ctx.fill();
  // Name above the hub, weight below.
  ctx.fillStyle = spec.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = 64;
  ctx.font = `800 ${size}px "Space Grotesk Variable", system-ui, sans-serif`;
  while (ctx.measureText(name).width > 360 && size > 30) {
    size -= 4;
    ctx.font = `800 ${size}px "Space Grotesk Variable", system-ui, sans-serif`;
  }
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

function stencilTexture(text) {
  const c = document.createElement('canvas');
  c.width = 700;
  c.height = 105;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0c0d10';
  ctx.fillRect(0, 0, 700, 105);
  // Hazard stripes on both ends.
  for (let x = -20; x < 700; x += 26) {
    if (x > 70 && x < 610) continue;
    ctx.fillStyle = '#f5a524';
    ctx.beginPath();
    ctx.moveTo(x, 105);
    ctx.lineTo(x + 13, 105);
    ctx.lineTo(x + 33, 0);
    ctx.lineTo(x + 20, 0);
    ctx.fill();
  }
  ctx.fillStyle = '#f5a524';
  ctx.font = '700 58px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 350, 56);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function tilesTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#121418';
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = '#05060a';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 256);
    ctx.moveTo(0, i);
    ctx.lineTo(256, i);
    ctx.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 3);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function slickTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.translate(128, 128);
  ctx.fillStyle = '#e0ac12';
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
