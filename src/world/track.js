import * as THREE from 'three';

// The circuit sits on an old military airfield: its main straight runs along the runway (z = 0).
const LAYOUT = [
  [-24, 0], [0, 0], [28, 0], [44, -3], [52, -14], [48, -27], [34, -31], [22, -38], [8, -47],
  [-10, -46], [-22, -36], [-38, -40], [-53, -31], [-57, -15], [-46, 0],
];
export const WIDTH = 9;
const SAMPLES = 800;

const _t = new THREE.Vector3();
const _s = new THREE.Vector3();

export class Track {
  constructor() {
    this.curve = new THREE.CatmullRomCurve3(
      LAYOUT.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
    );
    this.length = this.curve.getLength();

    // Evenly spaced samples: point, heading and the driver's right-hand side.
    this.points = [];
    this.sides = [];
    this.tangents = [];
    for (let i = 0; i <= SAMPLES; i++) {
      const u = (i % SAMPLES) / SAMPLES;
      const t = this.curve.getTangentAt(u);
      this.points.push(this.curve.getPointAt(u));
      this.tangents.push(t);
      this.sides.push(new THREE.Vector3(-t.z, 0, t.x));
    }

    // On a simple loop the infield is always on the same side.
    const probe = this.points[0].clone().addScaledVector(this.sides[0], 2);
    this.outSign = insidePolygon(probe, this.points) ? -1 : 1;
    this.centre = new THREE.Box3().setFromPoints(this.points).getCenter(new THREE.Vector3());

    // Corners get kerbs and barriers.
    const turn = this.tangents.map((t, i) => (i < SAMPLES ? t.angleTo(this.tangents[i + 1]) : 0));
    this.corner = turn.map((_, i) => {
      for (let k = -10; k <= 10; k++) if (turn[(i + k + SAMPLES) % SAMPLES] > 0.011) return true;
      return false;
    });

    this.group = new THREE.Group();
    this.build();
  }

  // Position (and heading) at u. u can be any number: it wraps around the lap.
  at(u, pos, tangent) {
    const w = ((u % 1) + 1) % 1;
    this.curve.getPointAt(w, pos);
    if (tangent) this.curve.getTangentAt(w, tangent);
    return pos;
  }

  // A point beside the track. lateral > 0 is outside the infield.
  beside(u, lateral, target) {
    this.at(u, target, _t);
    return target.add(_s.set(-_t.z, 0, _t.x).multiplyScalar(lateral * this.outSign));
  }

  // Unit vector pointing away from the infield at u.
  outward(u, target) {
    this.at(u, _s, _t);
    return target.set(-_t.z, 0, _t.x).multiplyScalar(this.outSign);
  }

  build() {
    // The scene makes it slightly see-through when a wet-road mirror lies underneath.
    this.asphalt = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.55, metalness: 0.1 });
    const paint = new THREE.MeshBasicMaterial({ color: 0x9aa2b0 });
    this.group.add(
      new THREE.Mesh(this.ribbon(-WIDTH / 2, WIDTH / 2, 0.03), this.asphalt),
      new THREE.Mesh(this.ribbon(WIDTH / 2 - 0.45, WIDTH / 2 - 0.25, 0.04), paint),
      new THREE.Mesh(this.ribbon(-WIDTH / 2 + 0.25, -WIDTH / 2 + 0.45, 0.04), paint),
      this.kerbs(),
      this.startLine(),
    );
  }

  // A strip that follows the track, `from` to `to` metres off the centre line, between lap fractions u0 and u1.
  // uv.x goes across (0 to 1), uv.y along the track in metres. With xy = true the strip lies in the
  // local XY plane (for a mirror, which must be rotated flat afterwards).
  ribbon(from, to, y, u0 = 0, u1 = 1, xy = false) {
    const i0 = Math.round(u0 * SAMPLES);
    const i1 = Math.round(u1 * SAMPLES);
    const n = i1 - i0;
    const pos = new Float32Array((n + 1) * 6);
    const uv = new Float32Array((n + 1) * 4);
    const step = this.length / SAMPLES;
    for (let k = 0; k <= n; k++) {
      const i = (((i0 + k) % SAMPLES) + SAMPLES) % SAMPLES;
      const p = this.points[i];
      const s = this.sides[i];
      const ax = p.x + s.x * from;
      const az = p.z + s.z * from;
      const bx = p.x + s.x * to;
      const bz = p.z + s.z * to;
      pos.set(xy ? [ax, -az, 0, bx, -bz, 0] : [ax, y, az, bx, y, bz], k * 6);
      uv.set([0, k * step, 1, k * step], k * 4);
    }
    const index = [];
    for (let k = 0; k < n; k++) {
      const a = k * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
  }

  // Red and white kerbs on both sides of every corner.
  kerbs() {
    const pos = [];
    const col = [];
    const red = new THREE.Color(0xc8203a);
    const white = new THREE.Color(0xdfe4ec);
    for (let i = 0; i < SAMPLES; i++) {
      if (!this.corner[i]) continue;
      const c = Math.floor(i / 4) % 2 ? red : white;
      for (const sign of [1, -1]) {
        const a = (WIDTH / 2) * sign;
        const b = (WIDTH / 2 + 1.3) * sign;
        const p0 = this.points[i].clone().addScaledVector(this.sides[i], a);
        const p1 = this.points[i].clone().addScaledVector(this.sides[i], b);
        const p2 = this.points[i + 1].clone().addScaledVector(this.sides[i + 1], a);
        const p3 = this.points[i + 1].clone().addScaledVector(this.sides[i + 1], b);
        for (const p of [p0, p1, p2, p1, p3, p2]) {
          pos.push(p.x, 0.05, p.z);
          col.push(c.r, c.g, c.b);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geometry.computeVertexNormals();
    return new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }),
    );
  }

  // Chequered start/finish line at u = 0.
  startLine() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const ctx = c.getContext('2d');
    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 2; y++) {
        ctx.fillStyle = (x + y) % 2 ? '#0c0d10' : '#e8ecf2';
        ctx.fillRect(x * 16, y * 16, 16, 16);
      }
    }
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(WIDTH, WIDTH / 8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texture }),
    );
    this.at(0, line.position, _t);
    line.position.y = 0.045;
    line.lookAt(line.position.clone().add(_t));
    return line;
  }
}

function insidePolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
}
