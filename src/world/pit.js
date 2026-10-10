import * as THREE from 'three';
import { WIDTH } from './track.js';
import { createPeople } from './people.js';

// The pit lane in front of the team garages, one painted box and one crew per team.
// The car leaves the track before the first garage, stops in front of the garage of the project
// being read, and the crew does a pit stop: jacks up, wheels off and on, jacks down, lollipop up.

export const PIT_LATERAL = 10.5; // metres from the track's centre line to the middle of the pit lane
const ENTRY = [0.385, 0.42]; // lap fractions where the car moves into the lane
const EXIT = [0.52, 0.555];

// Duration of each phase, seconds.
const T = { lift: 0.3, off: 0.45, on: 0.5, drop: 0.25, go: 0.35 };
const TOTAL = T.lift + T.off + T.on + T.drop + T.go;
const WHEELS = [
  [0.82, 1.75],
  [-0.82, 1.75],
  [0.79, -1.6],
  [-0.79, -1.6],
];

export function pitLateral(u) {
  return PIT_LATERAL * smooth(ENTRY[0], ENTRY[1], u) * (1 - smooth(EXIT[0], EXIT[1], u));
}

export function buildPits({ track, nodes, boxes }) {
  const group = new THREE.Group();

  // Lane surface, from the track edge out to the garages, plus its white edge line.
  const lane = new THREE.Mesh(
    outwardRibbon(track, WIDTH / 2, PIT_LATERAL + 3.4, 0.025, ENTRY[0] - 0.01, EXIT[1] + 0.01),
    new THREE.MeshStandardMaterial({ color: 0x1a1d24, roughness: 0.6, side: THREE.DoubleSide }),
  );
  const line = new THREE.Mesh(
    outwardRibbon(track, PIT_LATERAL - 3.3, PIT_LATERAL - 3.1, 0.035, ENTRY[1], EXIT[0]),
    new THREE.MeshBasicMaterial({ color: 0xc9d0dc, side: THREE.DoubleSide }),
  );
  group.add(lane, line);

  const people = createPeople(nodes.length * 11);
  group.add(people.group);
  const gear = equipment();

  const crews = nodes.map((node, i) => {
    const u = boxes[i];
    const frame = new THREE.Group();
    track.beside(u, PIT_LATERAL, frame.position);
    frame.lookAt(track.beside(u + 0.001, PIT_LATERAL, new THREE.Vector3())); // +z = forward along the lane
    // xSign: +1 when local +x points to the garages.
    const outward = track.outward(u, new THREE.Vector3());
    const xSign = new THREE.Vector3(1, 0, 0).applyQuaternion(frame.quaternion).dot(outward) > 0 ? 1 : -1;
    group.add(frame);

    const color = new THREE.Color(node.color);
    frame.add(boxMarking(color));
    // Pit lanes are brightly lit: a white light over each box.
    const light = new THREE.PointLight(0xf2f6ff, 70, 16, 1.5);
    light.position.set(0, 6.5, 0);
    frame.add(light);

    const crew = { frame, members: [], xSign };
    const member = (role, x, z, facing, extra = {}) => {
      const anchor = new THREE.Group();
      anchor.position.set(x, 0, z);
      anchor.rotation.y = facing;
      frame.add(anchor);
      const person = people.add(anchor, color);
      crew.members.push({ role, person, anchor, home: anchor.position.clone(), facing, ...extra });
      return person;
    };

    // Four wheel guns, four tyre carriers.
    for (const [wx, wz] of WHEELS) {
      const side = Math.sign(wx);
      const gunner = member('gun', side * 1.62, wz, -side * (Math.PI / 2), { side });
      const gun = gear.gun(color);
      gunner.joints.wristR.add(gun.object);
      crew.members.at(-1).gun = gun;
      const carrier = member('carry', side * 2.5, wz + (wz > 0 ? 0.65 : -0.65), -side * (Math.PI / 2) + (wz > 0 ? 0.35 : -0.35) * side, { side });
      carrier.joints.spine.add(gear.tyre(color, [0, 0.27, 0.36]));
    }
    // Front and rear jack.
    const frontJack = gear.jack();
    frontJack.object.position.set(0, 0, 3.05);
    const rearJack = gear.jack();
    rearJack.object.position.set(0, 0, -3.0);
    rearJack.object.rotation.y = Math.PI;
    frame.add(frontJack.object, rearJack.object);
    member('jack', 0, 4.45, Math.PI);
    member('jack', 0, -4.4, 0);
    crew.jacks = [frontJack, rearJack];
    // The lollipop man stands on the track side, ahead of the car.
    const lolly = member('lolly', -1.95 * xSign, 3.45, Math.PI + 0.55 * xSign);
    const board = gear.lollipop();
    lolly.joints.wristR.add(board.object);
    crew.board = board;
    // Spare tyres in their blankets by the garage.
    for (let k = 0; k < 4; k++) {
      const spare = gear.blanket(color);
      spare.position.set(3.7 * xSign, 0.18, -2.4 + k * 1.6);
      frame.add(spare);
    }
    return crew;
  });

  let active = -1;
  let start = 0;
  let reported = false;
  let duration = 0;

  function poseCrew(crew, t, elapsed) {
    const busy = t >= 0 && t < TOTAL;
    const ph = phases(t);
    const lifted = ph.lift / 0.16;
    for (const m of crew.members) {
      if (m.role === 'gun') {
        // Crouch onto the wheel, step back as it comes off, gun spinning while it works.
        const k = busy ? Math.min(1, t / 0.2) : 0;
        people.pose(m.person, 'ready', 'gun', k, elapsed);
        m.anchor.position.x = m.home.x + m.side * ph.out * 0.55;
        m.gun.spin(busy && ph.out > 0 && ph.out < 1 ? elapsed * 40 : 0);
      } else if (m.role === 'carry') {
        people.pose(m.person, 'carry', 'carry', 0, elapsed);
        m.anchor.position.x = m.home.x - m.side * ph.out * 0.35;
      } else if (m.role === 'jack') {
        people.pose(m.person, 'jack', 'jackPush', lifted, elapsed);
      } else if (m.role === 'lolly') {
        const up = t >= TOTAL - T.go ? Math.min(1, (t - (TOTAL - T.go)) / 0.2) : 0;
        people.pose(m.person, 'lolly', 'lollyUp', up, elapsed);
        crew.board.set(up > 0.5);
      }
    }
    for (const jack of crew.jacks) jack.set(lifted);
  }

  // Everyone starts in position.
  crews.forEach((crew) => poseCrew(crew, -1, 0));
  people.sync();

  return {
    group,
    // box: index of the box where the car is stopped (-1 = none). Returns the car's lift and wheel offset,
    // and an event when the stop is over.
    update(elapsed, box, animated) {
      if (box !== active) {
        active = box;
        start = elapsed;
        reported = false;
        duration = TOTAL + 0.2 + Math.random() * 0.5;
      }
      const result = { lift: 0, out: 0, event: null };
      crews.forEach((crew, i) => {
        const t = i === active && animated ? elapsed - start : -1;
        if (i === active) Object.assign(result, phases(t));
        poseCrew(crew, t, animated ? elapsed : 0);
      });
      people.sync();
      if (active >= 0 && animated && !reported && elapsed - start > TOTAL) {
        reported = true;
        result.event = { type: 'pit', index: active, seconds: duration };
      }
      return result;
    },
  };
}

// Lift and wheel offset at t seconds into the stop.
function phases(t) {
  if (t < 0) return { lift: 0, out: 0 };
  let k = t;
  const lift = 0.16;
  if (k < T.lift) return { lift: lift * (k / T.lift), out: 0 };
  k -= T.lift;
  if (k < T.off) return { lift, out: smooth(0, T.off, k) };
  k -= T.off;
  if (k < T.on) return { lift, out: 1 - smooth(0, T.on, k) };
  k -= T.on;
  if (k < T.drop) return { lift: lift * (1 - k / T.drop), out: 0 };
  return { lift: 0, out: 0 };
}

// Wheel guns, jacks, lollipop, tyres: shared geometry and materials.
function equipment() {
  const dark = new THREE.MeshStandardMaterial({ color: 0x15181e, roughness: 0.45, metalness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, roughness: 0.3, metalness: 1 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.9 });
  const yellow = new THREE.MeshBasicMaterial({ color: 0xf5c518 });
  const gunBody = new THREE.CylinderGeometry(0.045, 0.05, 0.22, 12);
  const gunSocket = new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10);
  const gunGrip = new THREE.BoxGeometry(0.04, 0.1, 0.05);
  const tyreGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.3, 28).rotateZ(Math.PI / 2);
  const bandGeo = new THREE.TorusGeometry(0.26, 0.012, 6, 28).rotateY(Math.PI / 2);

  return {
    gun(color) {
      const object = new THREE.Group();
      const body = new THREE.Mesh(gunBody, dark);
      body.position.y = -0.13;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.03, 12), new THREE.MeshBasicMaterial({ color }));
      ring.position.y = -0.06;
      const socket = new THREE.Mesh(gunSocket, steel);
      socket.position.y = -0.29;
      const grip = new THREE.Mesh(gunGrip, dark);
      grip.position.set(0, -0.05, -0.05);
      object.add(body, ring, socket, grip);
      return { object, spin: (a) => (socket.rotation.y = a) };
    },
    tyre(color, position) {
      const g = new THREE.Group();
      g.position.set(...position);
      const tyre = new THREE.Mesh(tyreGeo, rubber);
      const band = new THREE.Mesh(bandGeo, yellow);
      band.position.x = 0.152;
      const band2 = band.clone();
      band2.position.x = -0.152;
      g.add(tyre, band, band2);
      return g;
    },
    blanket(color) {
      const g = new THREE.Group();
      const cover = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.36, 0.34, 28).rotateX(Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.85 }),
      );
      cover.position.y = 0.18;
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.362, 0.015, 6, 28), dark);
      strap.position.y = 0.18;
      g.add(cover, strap);
      g.rotation.y = Math.PI / 2;
      return g;
    },
    jack() {
      const object = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.16), dark);
      base.position.y = 0.1;
      const cradle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.05, 0.1), steel);
      cradle.position.set(0, 0.17, -0.05);
      object.add(base, cradle);
      for (const x of [-0.3, 0.3]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 12).rotateZ(Math.PI / 2), rubber);
        wheel.position.set(x, 0.06, 0.05);
        object.add(wheel);
      }
      // Long handle towards the jack man; it pivots down as he pushes.
      const pivot = new THREE.Group();
      pivot.position.set(0, 0.12, 0.05);
      const handle = rod([0, 0, 0], [0, 0.82, 1.05], 0.022, dark);
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8).rotateZ(Math.PI / 2), rubber);
      grip.position.set(0, 0.82, 1.05);
      pivot.add(handle, grip);
      object.add(pivot);
      return { object, set: (k) => (pivot.rotation.x = k * 0.32) };
    },
    lollipop() {
      const object = new THREE.Group();
      const pole = rod([0, -0.05, 0], [0, -1.45, 0], 0.016, dark);
      const mat = new THREE.MeshBasicMaterial({ color: 0xff2d3a, toneMapped: false, side: THREE.DoubleSide });
      // The disc hangs off the end of the pole and faces the driver (the hand's sideways axis).
      const board = new THREE.Mesh(new THREE.CircleGeometry(0.26, 28).rotateY(Math.PI / 2), mat);
      board.position.y = -1.7;
      object.add(pole, board);
      const red = new THREE.Color(0xff2d3a).multiplyScalar(1.6);
      const green = new THREE.Color(0x35e07a).multiplyScalar(1.6);
      return { object, set: (go) => mat.color.copy(go ? green : red) };
    },
  };
}

function rod(a, b, radius, material) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const dir = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 8), material);
  mesh.position.copy(start).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

// track.ribbon offsets towards the driver's right; this one offsets away from the infield.
function outwardRibbon(track, from, to, y, u0, u1) {
  const a = from * track.outSign;
  const b = to * track.outSign;
  return track.ribbon(Math.min(a, b), Math.max(a, b), y, u0, u1);
}

function boxMarking(color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.3), toneMapped: false });
  const w = 2.6;
  const l = 6.2;
  for (const [x, z, sx, sz] of [[w, 0, 0.12, l], [-w, 0, 0.12, l], [0, l / 2, w * 2, 0.12], [0, -l / 2, w * 2, 0.12]]) {
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz).rotateX(-Math.PI / 2), mat);
    bar.position.set(x, 0.04, z);
    g.add(bar);
  }
  // Front-wheel marks.
  for (const x of [0.82, -0.82]) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.1).rotateX(-Math.PI / 2), mat);
    mark.position.set(x, 0.04, 1.75 + 0.45);
    g.add(mark);
  }
  return g;
}

function smooth(a, b, t) {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
