import * as THREE from 'three';

// A generic open-wheel single-seater, F1-like but no real team or brand.
// The body is lofted through oval cross-sections, nose to gearbox.
// Local axes: +z forward, +y up, +x the car's left. Length ~5.4 m.

const FRONT_R = 0.33;
const REAR_R = 0.36;

export function createCar({ envMap }) {
  const car = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x1b212b,
    metalness: 0.6,
    roughness: 0.32,
    clearcoat: 0.7,
    clearcoatRoughness: 0.12,
    envMap,
    envMapIntensity: 0.35,
  });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0a0c10, roughness: 0.5, metalness: 0.35, envMap, envMapIntensity: 0.25 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2.2), toneMapped: false });

  // ---------- body ----------
  // [z, width, height, centre y]
  car.add(
    new THREE.Mesh(
      loft([
        [2.78, 0.12, 0.08, 0.22],
        [2.5, 0.2, 0.13, 0.24],
        [2.0, 0.3, 0.2, 0.28],
        [1.4, 0.42, 0.3, 0.33],
        [0.9, 0.52, 0.38, 0.38],
        [0.45, 0.6, 0.44, 0.42],
        [0.0, 0.62, 0.46, 0.43],
        [-0.28, 0.54, 0.84, 0.6],
        [-0.65, 0.5, 0.72, 0.55],
        [-1.2, 0.4, 0.5, 0.46],
        [-1.8, 0.28, 0.34, 0.4],
        [-2.3, 0.2, 0.22, 0.36],
        [-2.5, 0.14, 0.14, 0.34],
      ]),
      paint,
    ),
    // Neon waistline from the nose to the cockpit.
    new THREE.Mesh(
      loft([
        [2.45, 0.215, 0.022, 0.24],
        [2.0, 0.315, 0.022, 0.28],
        [1.4, 0.435, 0.022, 0.33],
        [0.9, 0.535, 0.022, 0.38],
        [0.45, 0.615, 0.022, 0.42],
      ]),
      neon,
    ),
  );

  // Sidepods, narrowing towards the back ("coke bottle"). [z, width, height, centre y, centre x]
  for (const side of [1, -1]) {
    car.add(
      new THREE.Mesh(
        loft([
          [0.55, 0.34, 0.28, 0.34, 0.5 * side],
          [0.3, 0.42, 0.36, 0.36, 0.5 * side],
          [-0.4, 0.4, 0.34, 0.35, 0.47 * side],
          [-1.0, 0.3, 0.26, 0.32, 0.4 * side],
          [-1.5, 0.16, 0.18, 0.28, 0.3 * side],
          [-1.8, 0.06, 0.1, 0.26, 0.24 * side],
        ]),
        paint,
      ),
    );
    // Dark air intake at the front of the sidepod.
    const intake = new THREE.Mesh(new THREE.CircleGeometry(0.15, 20).scale(1.1, 0.8, 1), carbon);
    intake.position.set(0.5 * side, 0.34, 0.56);
    // Mirror on a stalk.
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.04), carbon);
    mirror.position.set(0.42 * side, 0.66, 0.52);
    car.add(intake, mirror, rod([0.25 * side, 0.55, 0.5], [0.4 * side, 0.65, 0.52], 0.012, carbon));
  }

  // Floor.
  const floorShape = new THREE.Shape();
  floorShape.moveTo(-0.3, 1.25);
  floorShape.lineTo(-0.76, 0.6);
  floorShape.lineTo(-0.76, -1.45);
  floorShape.lineTo(-0.5, -2.2);
  floorShape.lineTo(0.5, -2.2);
  floorShape.lineTo(0.76, -1.45);
  floorShape.lineTo(0.76, 0.6);
  floorShape.lineTo(0.3, 1.25);
  const floor = new THREE.Mesh(new THREE.ExtrudeGeometry(floorShape, { depth: 0.03, bevelEnabled: false }).rotateX(Math.PI / 2), carbon);
  floor.position.y = 0.13;
  car.add(floor);

  // ---------- cockpit: driver, halo ----------
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 24, 16),
    new THREE.MeshPhysicalMaterial({ color: 0xe8eef7, roughness: 0.25, clearcoat: 1, envMap, envMapIntensity: 0.4 }),
  );
  helmet.position.set(0, 0.73, 0.04);
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.143, 24, 8, Math.PI / 2 - 0.85, 1.7, 1.15, 0.45),
    new THREE.MeshPhysicalMaterial({ color: 0x06121a, roughness: 0.05, metalness: 0.9, envMap, envMapIntensity: 0.8 }),
  );
  visor.position.copy(helmet.position);
  const helmetStripe = new THREE.Mesh(new THREE.TorusGeometry(0.141, 0.012, 6, 32, Math.PI), neon);
  helmetStripe.rotation.y = Math.PI / 2;
  helmetStripe.position.copy(helmet.position);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.31, 0.028, 8, 36, (Math.PI * 4) / 3).rotateX(Math.PI / 2).rotateY(Math.PI / 6),
    carbon,
  );
  halo.position.set(0, 0.87, 0.1);
  car.add(helmet, visor, helmetStripe, halo, rod([0, 0.87, 0.41], [0, 0.56, 0.62], 0.03, carbon));

  // ---------- wings ----------
  const frontWing = new THREE.Group();
  frontWing.position.set(0, 0.1, 2.52);
  const plane = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.025, 0.34), carbon);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.02, 0.18), paint);
  flap.position.set(0, 0.06, -0.17);
  flap.rotation.x = -0.35;
  frontWing.add(plane, flap);
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.2, 0.5), carbon);
    plate.position.set(0.98 * side, 0.08, -0.05);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.5), neon);
    edge.position.set(0.98 * side, 0.185, -0.05);
    frontWing.add(plate, edge);
  }
  car.add(frontWing);

  const rearWing = new THREE.Group();
  rearWing.position.set(0, 0, -2.42);
  const main = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.035, 0.3), carbon);
  main.position.y = 0.84;
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.025, 0.2), paint);
  top.position.set(0, 0.97, -0.1);
  top.rotation.x = 0.3;
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.025, 0.2), carbon);
  beam.position.y = 0.44;
  const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.42, 0.12), carbon);
  pylon.position.set(0, 0.63, 0.06);
  rearWing.add(main, top, beam, pylon);
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.55, 0.62), carbon);
    plate.position.set(0.53 * side, 0.78, -0.02);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.55, 0.02), neon);
    edge.position.set(0.53 * side, 0.78, 0.29);
    rearWing.add(plate, edge);
  }
  // Rear rain light, blinking.
  const rainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2d4a).multiplyScalar(3), toneMapped: false });
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.03), rainMat);
  rain.position.set(0, 0.36, -0.12);
  rearWing.add(rain);
  car.add(rearWing);

  // Engine cover fin with the number.
  const fin = profile([[-0.45, 0.98], [-2.2, 0.9], [-2.2, 0.62], [-1.2, 0.55]], 0.03, paint);
  car.add(fin);
  const number = numberTexture('10');
  for (const side of [1, -1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), new THREE.MeshBasicMaterial({ map: number, transparent: true }));
    decal.position.set(0.02 * side, 0.76, -1.45);
    decal.rotation.y = (side * Math.PI) / 2;
    car.add(decal);
  }
  const noseNumber = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.14), new THREE.MeshBasicMaterial({ map: number, transparent: true }));
  noseNumber.position.set(0, 0.43, 1.75);
  noseNumber.rotation.x = -Math.PI / 2 + 0.16;
  car.add(noseNumber);

  // ---------- wheels and suspension ----------
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.92 });
  const band = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xf5c518).multiplyScalar(1.1) });
  const wheels = [];
  for (const [x, z, r, w] of [
    [0.82, 1.75, FRONT_R, 0.3],
    [-0.82, 1.75, FRONT_R, 0.3],
    [0.79, -1.6, REAR_R, 0.4],
    [-0.79, -1.6, REAR_R, 0.4],
  ]) {
    const wheel = new THREE.Group();
    wheel.position.set(x, r, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 36).rotateZ(Math.PI / 2), rubber);
    const outer = Math.sign(x) * (w / 2 + 0.002);
    // Coloured compound band and a wheel cover on the outer sidewall.
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 0.72, r * 0.8, 36), band);
    ring.position.x = outer;
    ring.rotation.y = (Math.sign(x) * Math.PI) / 2;
    const cover = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 28), carbon);
    cover.position.x = outer + Math.sign(x) * 0.001;
    cover.rotation.y = (Math.sign(x) * Math.PI) / 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.004, r * 1.1, 0.05), neon);
    spoke.position.x = outer + Math.sign(x) * 0.003;
    wheel.add(tyre, ring, cover, spoke);
    wheels.push(wheel);
    car.add(wheel);
  }
  for (const side of [1, -1]) {
    car.add(
      rod([0.16 * side, 0.4, 1.95], [0.68 * side, 0.42, 1.76], 0.016, carbon),
      rod([0.16 * side, 0.3, 1.55], [0.68 * side, 0.27, 1.74], 0.016, carbon),
      rod([0.14 * side, 0.44, 1.7], [0.66 * side, 0.3, 1.78], 0.014, carbon),
      rod([0.26 * side, 0.44, -1.35], [0.6 * side, 0.46, -1.6], 0.016, carbon),
      rod([0.24 * side, 0.3, -1.85], [0.6 * side, 0.27, -1.6], 0.016, carbon),
    );
  }

  // Soft shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 6.2).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.position.y = 0.06;
  car.add(shadow);

  return {
    object: car,
    roll(distance) {
      for (const w of wheels) w.rotation.x += distance / w.position.y;
    },
    update(elapsed) {
      rainMat.color.setRGB(Math.sin(elapsed * 9) > 0 ? 3 : 0.3, 0.1, 0.15);
    },
  };
}

// Surface through superellipse cross-sections: [z, width, height, centre y, centre x?].
function loft(sections, segments = 28, power = 2.6) {
  const positions = [];
  const ring = (z, w, h, y, x = 0) => {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pts.push(x + Math.sign(c) * Math.abs(c) ** (2 / power) * (w / 2), y + Math.sign(s) * Math.abs(s) ** (2 / power) * (h / 2), z);
    }
    return pts;
  };
  for (const s of sections) positions.push(...ring(...s));
  const index = [];
  for (let k = 0; k < sections.length - 1; k++) {
    for (let i = 0; i < segments; i++) {
      const a = k * segments + i;
      const b = k * segments + ((i + 1) % segments);
      const c = a + segments;
      const d = b + segments;
      index.push(a, c, b, b, c, d);
    }
  }
  // Flat caps at both ends, with their own vertices.
  for (const [k, front] of [[0, true], [sections.length - 1, false]]) {
    const [z, , , y, x = 0] = sections[k];
    const start = positions.length / 3;
    positions.push(x, y, z, ...ring(...sections[k]));
    for (let i = 0; i < segments; i++) {
      const p = start + 1 + i;
      const q = start + 1 + ((i + 1) % segments);
      if (front) index.push(start, p, q);
      else index.push(start, q, p);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

// A thin cylinder from a to b (suspension arms, mirror stalks).
function rod(a, b, radius, material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 6), material);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// Extrudes a side profile ([forward, up] points) across the car's width.
function profile(points, width, material) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: width, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(width / 2, 0, 0);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function numberTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#38e1ff';
  ctx.font = 'italic 800 110px "Space Grotesk Variable", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
