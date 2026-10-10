import * as THREE from 'three';
import { WIDTH } from './track.js';

// The pit lane in front of the team garages, one painted box and one crew per team.
// The car leaves the track before the first garage, stops in front of the garage of the project
// being read, and the crew does a pit stop: jacks up, wheels off and on, jacks down, lollipop up.

export const PIT_LATERAL = 10.5; // metres from the track's centre line to the middle of the pit lane
const ENTRY = [0.385, 0.42]; // lap fractions where the car moves into the lane
const EXIT = [0.52, 0.555];

// Duration of each phase, seconds.
const T = { lift: 0.3, off: 0.45, on: 0.5, drop: 0.25, go: 0.35 };
const TOTAL = T.lift + T.off + T.on + T.drop + T.go;

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

  const crews = nodes.map((node, i) => {
    const u = boxes[i];
    const frame = new THREE.Group();
    track.beside(u, PIT_LATERAL, frame.position);
    const ahead = track.beside(u + 0.001, PIT_LATERAL, new THREE.Vector3());
    frame.lookAt(ahead); // +z = forward along the lane, like the car
    // xSign: which way local +x points, garage side or track side.
    const outward = track.outward(u, new THREE.Vector3());
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(frame.quaternion);
    const xSign = localX.dot(outward) > 0 ? 1 : -1;
    group.add(frame);

    const color = new THREE.Color(node.color);
    frame.add(boxMarking(color));

    // Crew: four wheel men, front and rear jack, lollipop. Positions in the box frame.
    const members = [];
    const add = (role, x, z, facing) => {
      const m = crewMember(color);
      m.position.set(x * xSign, 0, z);
      m.rotation.y = facing;
      m.userData = { role, home: m.position.clone(), facing };
      frame.add(m);
      members.push(m);
    };
    for (const [x, z] of [[1.9, 1.75], [-1.9, 1.75], [1.9, -1.6], [-1.9, -1.6]]) {
      add('wheel', x, z, Math.atan2(-x * xSign, 0));
    }
    add('jack-front', 0, 3.9, Math.PI);
    add('jack-rear', 0, -3.6, 0);
    const lolly = crewMember(color);
    lolly.position.set(-1.7 * xSign, 0, 3.4);
    lolly.rotation.y = Math.PI + 0.5 * xSign;
    const pole = new THREE.Group();
    pole.position.set(0, 1.15, 0.2);
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6), new THREE.MeshStandardMaterial({ color: 0x20242b }));
    stick.position.y = 0.8;
    const boardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff2d3a).multiplyScalar(1.6), toneMapped: false, side: THREE.DoubleSide });
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), boardMat);
    board.position.y = 1.6;
    pole.add(stick, board);
    pole.rotation.x = 1.2; // lowered in front of the car
    lolly.add(pole);
    frame.add(lolly);

    return { frame, members, pole, boardMat, xSign };
  });

  let active = -1;
  let start = 0;
  let reported = false;
  let duration = 0;

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
        const phase = phases(t);
        result.lift = i === active ? phase.lift : result.lift;
        result.out = i === active ? phase.out : result.out;
        for (const m of crew.members) {
          const busy = t >= 0 && t < TOTAL;
          // Wheel men step in and crouch while the wheels are off; jack men lean on the jacks.
          const lean = busy ? (m.userData.role === 'wheel' ? 0.55 : 0.35) : 0;
          m.rotation.x = THREE.MathUtils.damp(m.rotation.x, lean, 10, 1 / 60);
          // Wheel men step back as the wheels come out.
          m.position.x = m.userData.home.x + Math.sign(m.userData.home.x) * phase.out * 0.6;
        }
        // Lollipop: down and red until the car may go, then up and green.
        const up = t >= TOTAL - T.go ? 1 : 0;
        crew.pole.rotation.x = THREE.MathUtils.damp(crew.pole.rotation.x, up ? -0.2 : 1.2, 12, 1 / 60);
        crew.boardMat.color.set(up ? 0x35e07a : 0xff2d3a).multiplyScalar(1.6);
      });
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

function crewMember(color) {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161b, roughness: 0.5 });
  for (const x of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.55, 4, 8), suit);
    leg.position.set(x, 0.37, 0);
    g.add(leg);
  }
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10), suit);
  torso.position.y = 1.0;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), new THREE.MeshStandardMaterial({ color: 0xe8eef7, roughness: 0.3 }));
  helmet.position.y = 1.45;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.152, 16, 8, Math.PI / 2 - 0.8, 1.6, 1.2, 0.5), dark);
  visor.position.y = 1.45;
  g.add(torso, helmet, visor);
  for (const x of [-0.24, 0.24]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.4, 4, 8), suit);
    arm.position.set(x, 1.0, 0.12);
    arm.rotation.x = -0.6;
    g.add(arm);
  }
  // Wheel gun / jack handle in the hands.
  const tool = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.32, 10).rotateX(Math.PI / 2), dark);
  tool.position.set(0, 0.85, 0.42);
  g.add(tool);
  return g;
}

function smooth(a, b, t) {
  const x = THREE.MathUtils.clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}
