import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Articulated people (pit crews) drawn with one InstancedMesh per body part:
// each person is a tree of invisible joints; every frame the joints' world matrices are copied
// into the instances. 30+ people cost a dozen draw calls.
//
// A person faces +z, with their left on +x. Proportions of someone about 1.80 m tall.

const THIGH = 0.44;
const SHIN = 0.42;
const ANKLE = 0.08; // ankle height above the sole

// Joint rotations (radians, x/y/z) for each pose. Missing joints stay at 0.
// x on a hanging limb: negative swings it forward. Knees bend with positive x, elbows with negative x.
export const POSES = {
  stand: {
    spine: [0.04, 0, 0],
    head: [-0.04, 0, 0],
    shoulderL: [0.05, 0, 0.12],
    shoulderR: [0.05, 0, -0.12],
    elbowL: [-0.25, 0, 0],
    elbowR: [-0.25, 0, 0],
    hipL: [0, 0, 0.04],
    hipR: [0, 0, -0.04],
    kneeL: [0.05, 0, 0],
    kneeR: [0.05, 0, 0],
  },
  ready: {
    spine: [0.38, 0, 0],
    head: [-0.32, 0, 0],
    shoulderL: [-0.75, 0, 0.18],
    shoulderR: [-0.85, 0, -0.18],
    elbowL: [-0.7, 0, 0],
    elbowR: [-0.55, 0, 0],
    hipL: [-0.7, 0, 0.14],
    hipR: [-0.7, 0, -0.14],
    kneeL: [1.15, 0, 0],
    kneeR: [1.15, 0, 0],
  },
  gun: {
    spine: [0.6, 0, 0],
    head: [-0.5, 0, 0],
    shoulderL: [-1.05, 0, 0.22],
    shoulderR: [-1.2, 0, -0.22],
    elbowL: [-0.45, 0, 0],
    elbowR: [-0.35, 0, 0],
    hipL: [-1.35, 0, 0.28],
    hipR: [-1.35, 0, -0.28],
    kneeL: [2.15, 0, 0],
    kneeR: [2.15, 0, 0],
  },
  carry: {
    spine: [0.12, 0, 0],
    head: [-0.1, 0, 0],
    shoulderL: [-0.55, 0, 0.32],
    shoulderR: [-0.55, 0, -0.32],
    elbowL: [-1.15, 0, 0],
    elbowR: [-1.15, 0, 0],
    hipL: [-0.25, 0, 0.06],
    hipR: [0.15, 0, -0.06],
    kneeL: [0.35, 0, 0],
    kneeR: [0.1, 0, 0],
  },
  jack: {
    spine: [0.45, 0, 0],
    head: [-0.35, 0, 0],
    shoulderL: [-1.0, 0, 0.12],
    shoulderR: [-1.0, 0, -0.12],
    elbowL: [-0.25, 0, 0],
    elbowR: [-0.25, 0, 0],
    hipL: [-0.55, 0, 0.06],
    hipR: [0.3, 0, -0.06],
    kneeL: [0.75, 0, 0],
    kneeR: [0.15, 0, 0],
  },
  jackPush: {
    spine: [0.8, 0, 0],
    head: [-0.6, 0, 0],
    shoulderL: [-0.75, 0, 0.12],
    shoulderR: [-0.75, 0, -0.12],
    elbowL: [-0.1, 0, 0],
    elbowR: [-0.1, 0, 0],
    hipL: [-0.85, 0, 0.06],
    hipR: [0.38, 0, -0.06],
    kneeL: [1.15, 0, 0],
    kneeR: [0.3, 0, 0],
  },
  lolly: {
    spine: [0.06, 0, 0],
    head: [-0.04, 0, 0],
    shoulderL: [0.05, 0, 0.14],
    shoulderR: [-1.3, 0, -0.12],
    elbowL: [-0.25, 0, 0],
    elbowR: [-0.2, 0, 0],
    hipL: [-0.15, 0, 0.06],
    hipR: [0.1, 0, -0.06],
    kneeL: [0.15, 0, 0],
    kneeR: [0.05, 0, 0],
  },
  lollyUp: {
    spine: [-0.05, 0, 0],
    head: [-0.15, 0, 0],
    shoulderL: [0.05, 0, 0.14],
    shoulderR: [-2.75, 0, -0.18],
    elbowL: [-0.25, 0, 0],
    elbowR: [-0.1, 0, 0],
    hipL: [-0.15, 0, 0.06],
    hipR: [0.1, 0, -0.06],
    kneeL: [0.15, 0, 0],
    kneeR: [0.05, 0, 0],
  },
};

const JOINTS = ['spine', 'neck', 'head', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR', 'hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR'];

export function createPeople(capacity) {
  const group = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const helmet = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5 });
  const visor = new THREE.MeshStandardMaterial({ color: 0x05080d, roughness: 0.08, metalness: 0.9 });

  // One InstancedMesh per part type. [geometry, material, instances per person, team-coloured?]
  const PARTS = {
    pelvis: [loftY([[-0.1, 0.3, 0.2], [0, 0.33, 0.21], [0.08, 0.31, 0.2]]), suit, 1, true],
    belt: [loftY([[0.0, 0.322, 0.215], [0.06, 0.326, 0.216]]), black, 1, false],
    torso: [
      loftY([[0, 0.31, 0.2], [0.12, 0.29, 0.19], [0.26, 0.33, 0.21], [0.38, 0.39, 0.22], [0.46, 0.42, 0.2], [0.5, 0.36, 0.17], [0.53, 0.14, 0.12]]),
      suit,
      1,
      true,
    ],
    band: [loftY([[0.29, 0.362, 0.226], [0.335, 0.374, 0.23]]), white, 1, false],
    neck: [loftY([[0, 0.1, 0.1], [0.11, 0.09, 0.09]]), suit, 1, true],
    head: [new THREE.SphereGeometry(0.125, 18, 14).scale(1, 1.08, 1.1), helmet, 1, true],
    visor: [new THREE.SphereGeometry(0.128, 18, 8, Math.PI / 2 - 0.85, 1.7, 1.2, 0.48).scale(1, 1.08, 1.1), visor, 1, false],
    upperArm: [loftY([[-0.3, 0.075, 0.08], [-0.15, 0.09, 0.095], [0, 0.1, 0.105]]), suit, 2, true],
    forearm: [loftY([[-0.27, 0.058, 0.062], [-0.12, 0.072, 0.075], [0, 0.076, 0.08]]), suit, 2, true],
    hand: [loftY([[-0.1, 0.055, 0.03], [-0.05, 0.085, 0.042], [0, 0.07, 0.048]]), black, 2, false],
    thigh: [loftY([[-0.44, 0.1, 0.11], [-0.22, 0.14, 0.15], [0, 0.16, 0.17]]), suit, 2, true],
    stripe: [new THREE.BoxGeometry(0.012, 0.36, 0.035), white, 2, false],
    shin: [loftY([[-0.42, 0.075, 0.08], [-0.3, 0.1, 0.11], [-0.1, 0.1, 0.11], [0, 0.1, 0.105]]), suit, 2, true],
    foot: [new RoundedBoxGeometry(0.11, 0.09, 0.27, 2, 0.03).translate(0, -0.035, 0.06), black, 2, false],
  };
  const meshes = {};
  for (const [name, [geometry, material, perPerson, coloured]] of Object.entries(PARTS)) {
    const mesh = new THREE.InstancedMesh(geometry, material, capacity * perPerson);
    mesh.count = 0;
    mesh.frustumCulled = false;
    if (coloured) mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * perPerson * 3), 3);
    meshes[name] = mesh;
    group.add(mesh);
  }

  const people = [];

  function part(name, parent, color, position = [0, 0, 0]) {
    const object = new THREE.Object3D();
    object.position.set(...position);
    parent.add(object);
    const mesh = meshes[name];
    const index = mesh.count++;
    if (mesh.instanceColor) mesh.setColorAt(index, color);
    return { mesh, index, object };
  }

  return {
    group,
    // Adds a person to `parent` (an Object3D in the scene). Returns its root and its joints.
    add(parent, color) {
      const c = new THREE.Color(color);
      const root = new THREE.Object3D();
      parent.add(root);
      const j = {};
      const joint = (name, p, pos) => {
        const o = new THREE.Object3D();
        o.position.set(...pos);
        p.add(o);
        j[name] = o;
        return o;
      };
      const hips = joint('hips', root, [0, THIGH + SHIN + ANKLE + 0.02, 0]);
      const parts = [part('pelvis', hips, c), part('belt', hips, c)];
      const spine = joint('spine', hips, [0, 0.06, 0]);
      parts.push(part('torso', spine, c), part('band', spine, c));
      const neck = joint('neck', spine, [0, 0.52, 0]);
      parts.push(part('neck', neck, c));
      const head = joint('head', neck, [0, 0.17, 0.01]);
      parts.push(part('head', head, c), part('visor', head, c));
      for (const [side, s] of [['L', 1], ['R', -1]]) {
        const shoulder = joint(`shoulder${side}`, spine, [0.205 * s, 0.44, 0]);
        parts.push(part('upperArm', shoulder, c));
        const elbow = joint(`elbow${side}`, shoulder, [0, -0.3, 0]);
        parts.push(part('forearm', elbow, c));
        const wrist = joint(`wrist${side}`, elbow, [0, -0.27, 0]);
        parts.push(part('hand', wrist, c));
        const hip = joint(`hip${side}`, hips, [0.1 * s, -0.02, 0]);
        parts.push(part('thigh', hip, c), part('stripe', hip, c, [0.079 * s, -0.22, 0]));
        const knee = joint(`knee${side}`, hip, [0, -THIGH, 0]);
        parts.push(part('shin', knee, c));
        const ankle = joint(`ankle${side}`, knee, [0, -SHIN, 0]);
        parts.push(part('foot', ankle, c));
      }
      const person = { root, joints: j, parts, breath: Math.random() * 6 };
      people.push(person);
      return person;
    },

    // Blend between two poses (k from 0 to 1), keep the feet flat on the ground, add a little life.
    pose(person, a, b = a, k = 0, elapsed = 0) {
      const pa = POSES[a];
      const pb = POSES[b];
      for (const name of JOINTS) {
        const ra = pa[name] || ZERO;
        const rb = pb[name] || ZERO;
        const o = person.joints[name];
        if (!o) continue;
        o.rotation.set(lerp(ra[0], rb[0], k), lerp(ra[1], rb[1], k), lerp(ra[2], rb[2], k));
      }
      const j = person.joints;
      // Breathing and a slight sway.
      const t = elapsed + person.breath;
      j.spine.rotation.x += Math.sin(t * 1.7) * 0.02;
      j.spine.rotation.z += Math.sin(t * 0.6) * 0.015;
      // Feet flat: the ankle cancels the leg's rotation; the hips sit at the height the legs allow.
      let height = 0;
      for (const side of ['L', 'R']) {
        const h = j[`hip${side}`].rotation.x;
        const kn = j[`knee${side}`].rotation.x;
        j[`ankle${side}`].rotation.x = -(h + kn);
        height += THIGH * Math.cos(h) + SHIN * Math.cos(h + kn) + ANKLE + 0.02;
      }
      j.hips.position.y = height / 2;
    },

    // Copy every joint's world matrix into its instance.
    sync() {
      for (const person of people) {
        person.root.updateWorldMatrix(true, true); // the anchor above may have moved too
        for (const p of person.parts) p.mesh.setMatrixAt(p.index, p.object.matrixWorld);
      }
      for (const mesh of Object.values(meshes)) {
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
    },
  };
}

const ZERO = [0, 0, 0];
const lerp = (a, b, k) => a + (b - a) * k;

// Surface through superellipse rings stacked along y: [y, width (x), depth (z)].
function loftY(sections, segments = 16, power = 2.3) {
  const positions = [];
  const ring = ([y, w, d]) => {
    const pts = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const c = Math.cos(a);
      const s = Math.sin(a);
      pts.push(Math.sign(c) * Math.abs(c) ** (2 / power) * (w / 2), y, Math.sign(s) * Math.abs(s) ** (2 / power) * (d / 2));
    }
    return pts;
  };
  for (const s of sections) positions.push(...ring(s));
  const index = [];
  for (let k = 0; k < sections.length - 1; k++) {
    for (let i = 0; i < segments; i++) {
      const a = k * segments + i;
      const b = k * segments + ((i + 1) % segments);
      index.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  for (const [k, top] of [[0, false], [sections.length - 1, true]]) {
    const start = positions.length / 3;
    positions.push(0, sections[k][0], 0, ...ring(sections[k]));
    for (let i = 0; i < segments; i++) {
      const p = start + 1 + i;
      const q = start + 1 + ((i + 1) % segments);
      if (top) index.push(start, q, p);
      else index.push(start, p, q);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}
