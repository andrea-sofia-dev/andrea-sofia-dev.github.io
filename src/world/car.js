import * as THREE from 'three';

// A generic endurance prototype built from extruded side profiles. No real brand.
// Local axes: +z forward, +y up, +x the car's left. Length ~4.7 m.

const WHEEL_RADIUS = 0.36;

export function createCar({ envMap }) {
  const car = new THREE.Group();

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0x232a35,
    metalness: 0.65,
    roughness: 0.34,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    envMap,
    envMapIntensity: 0.3,
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x04070b,
    metalness: 0.9,
    roughness: 0.06,
    envMap,
    envMapIntensity: 0.5,
  });
  const carbon = new THREE.MeshStandardMaterial({ color: 0x0b0d11, roughness: 0.55, metalness: 0.3 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2.2), toneMapped: false });

  // Central tub, cockpit canopy and the fin on the engine cover.
  car.add(
    profile(
      [[2.35, 0.24], [1.6, 0.42], [0.9, 0.62], [-1.0, 0.7], [-2.3, 0.8], [-2.36, 0.3], [-2.2, 0.14], [2.2, 0.14]],
      1.36,
      paint,
      0.05,
    ),
    profile([[0.86, 0.64], [0.2, 1.1], [-0.6, 1.12], [-1.36, 0.72]], 1.0, glass, 0.04),
    profile([[-0.55, 1.04], [-2.05, 1.1], [-2.05, 0.78], [-1.1, 0.78]], 0.05, paint, 0.01),
  );

  // Fenders with arches over the wheels.
  for (const side of [1, -1]) {
    const front = profile(
      [
        [2.32, 0.36], [2.3, 0.5], [1.95, 0.78], [1.45, 0.93], [0.95, 0.85], [0.72, 0.6], [0.72, 0.36],
        ...arch(1.45),
      ],
      0.38,
      paint,
      0.04,
    );
    const rear = profile(
      [
        [-0.75, 0.36], [-0.8, 0.62], [-1.2, 0.9], [-1.8, 0.99], [-2.34, 0.95], [-2.36, 0.36],
        ...arch(-1.5),
      ],
      0.4,
      paint,
      0.04,
    );
    front.position.x = rear.position.x = side * 0.87;
    car.add(front, rear);

    // Neon line along the side skirt, and a slit headlight on the fender slope.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 1.45), neon);
    stripe.position.set(side * 0.76, 0.2, -0.02);
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.025, 0.16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8f4ff).multiplyScalar(3), toneMapped: false }),
    );
    headlight.position.set(side * 0.87, 0.715, 2.08);
    headlight.rotation.x = 0.675;
    car.add(stripe, headlight);
  }

  // Rear wing.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.05, 0.42), carbon);
  wing.position.set(0, 1.16, -2.08);
  car.add(wing);
  for (const side of [1, -1]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.42, 0.62), carbon);
    plate.position.set(side * 0.98, 1.02, -2.05);
    const edge = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.62), neon);
    edge.position.set(side * 0.98, 1.24, -2.05);
    car.add(plate, edge);
  }

  // Splitter, diffuser and the red light bar across the tail.
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.04, 0.35), carbon);
  splitter.position.set(0, 0.12, 2.2);
  const taillight = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.05, 0.04),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2d4a).multiplyScalar(2.6), toneMapped: false }),
  );
  taillight.position.set(0, 0.84, -2.38);
  car.add(splitter, taillight);

  // Number on both sides of the tub.
  const number = numberTexture();
  for (const side of [1, -1]) {
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(1.1, 0.42),
      new THREE.MeshBasicMaterial({ map: number, transparent: true }),
    );
    decal.position.set(side * 0.745, 0.44, -0.05);
    decal.rotation.y = side * (Math.PI / 2);
    car.add(decal);
  }

  // Wheels.
  const tyre = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.32, 28).rotateZ(Math.PI / 2);
  const rim = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 18).rotateZ(Math.PI / 2);
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0c, roughness: 0.9 });
  const alloy = new THREE.MeshStandardMaterial({ color: 0x8c95a3, metalness: 1, roughness: 0.3, envMap, envMapIntensity: 0.5 });
  const wheels = [];
  for (const [x, z] of [[0.87, 1.45], [-0.87, 1.45], [0.87, -1.5], [-0.87, -1.5]]) {
    const wheel = new THREE.Group();
    const spokes = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.44, 0.06), carbon);
    wheel.add(new THREE.Mesh(tyre, rubber), new THREE.Mesh(rim, alloy), spokes);
    wheel.position.set(x, WHEEL_RADIUS, z);
    wheels.push(wheel);
    car.add(wheel);
  }

  // Soft shadow under the car.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 5.8).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.position.y = 0.06;
  car.add(shadow);

  // Headlight beam on the track ahead.
  const beam = new THREE.SpotLight(0xdde9ff, 70, 40, 0.42, 0.6, 1.6);
  beam.position.set(0, 0.7, 2.0);
  beam.target.position.set(0, 0, 14);
  car.add(beam, beam.target);

  return {
    object: car,
    // Spin the wheels by the distance travelled.
    roll(distance) {
      for (const w of wheels) w.rotation.x += distance / WHEEL_RADIUS;
    },
  };
}

// Points of a wheel arch around a wheel centred at z = cz (going front to back along the bottom edge).
function arch(cz) {
  const r = WHEEL_RADIUS + 0.06;
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    pts.push([cz + Math.cos(a) * r, WHEEL_RADIUS + Math.sin(a) * r]);
  }
  return pts;
}

// Extrudes a side profile ([forward, up] points) across the car's width.
function profile(points, width, material, bevel) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const depth = Math.max(width - bevel * 2, 0.001);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 1,
  });
  geometry.rotateY(-Math.PI / 2); // shape x → forward, extrusion → across
  geometry.translate(depth / 2, 0, 0);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function numberTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(232, 238, 247, 0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 88, 14);
  ctx.fill();
  ctx.fillStyle = '#0b0d11';
  ctx.font = '800 64px "JetBrains Mono Variable", Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AS·10', 128, 52);
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
