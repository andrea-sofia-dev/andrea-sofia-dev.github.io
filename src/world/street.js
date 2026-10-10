import * as THREE from 'three';
import { WIDTH } from './track.js';
import { placeOnTrack } from './base.js';

// Street-racing game bits: light gates for checkpoints with route arrows on the asphalt
// before them, and a speed trap camera that flashes when the car goes past.

const GAME_FONT = '"Chakra Petch", "Space Grotesk Variable", sans-serif';

const curtainShader = {
  uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x38e1ff) }, uBoost: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uBoost;
    varying vec2 vUv;
    void main() {
      float edges = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
      float rise = mix(1.0, 0.08, vUv.y);
      float lines = 0.5 + 0.5 * sin(vUv.y * 48.0 - uTime * 5.0);
      float a = edges * rise * (0.16 + 0.1 * lines) * (1.0 + uBoost * 3.0);
      gl_FragColor = vec4(uColor * 1.8, a);
    }
  `,
};

export function buildStreet({ track, gates, trap }) {
  const group = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.5, metalness: 0.6 });
  const neon = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x38e1ff).multiplyScalar(2.2), toneMapped: false });
  const textures = [];

  // ---------- light gates ----------
  const labelTex = canvasTexture(1024, 160, (ctx) => {
    ctx.clearRect(0, 0, 1024, 160);
    ctx.fillStyle = '#e8f9ff';
    ctx.shadowColor = '#38e1ff';
    ctx.shadowBlur = 24;
    ctx.font = `italic 700 104px ${GAME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHECKPOINT', 512, 84);
  });
  textures.push(labelTex);

  const curtains = [];
  for (const u of gates) {
    const gate = new THREE.Group();
    placeOnTrack(track, gate, u, 0);
    for (const side of [1, -1]) {
      const x = side * (WIDTH / 2 + 1.1);
      const pylon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 7, 0.55), dark);
      pylon.position.set(x, 3.5, 0);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.6, 0.58), neon);
      strip.position.set(x - side * 0.25, 3.5, 0);
      gate.add(pylon, strip);
    }
    const material = new THREE.ShaderMaterial({
      ...curtainShader,
      uniforms: THREE.UniformsUtils.clone(curtainShader.uniforms),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const curtain = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH + 1.6, 6.6), material);
    curtain.position.y = 3.3;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(6.4, 1),
      new THREE.MeshBasicMaterial({ map: labelTex, transparent: true, depthWrite: false }),
    );
    label.position.y = 7.6;
    label.rotation.y = Math.PI; // readable by the car coming towards the gate
    gate.add(curtain, label);
    group.add(gate);
    curtains.push({ material, position: gate.position, passedAt: -Infinity });

    // Route arrows on the asphalt leading into the gate.
    const arrows = new THREE.Mesh(
      track.ribbon(-1.6, 1.6, 0.05, u - 0.06, u - 0.004),
      new THREE.MeshBasicMaterial({
        map: arrowsTexture(),
        color: new THREE.Color(0x38e1ff).multiplyScalar(1.6),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    group.add(arrows);
    curtains.at(-1).arrows = arrows.material.map;
  }

  // ---------- speed trap ----------
  const camera = new THREE.Group();
  track.beside(trap, WIDTH / 2 + 3.2, camera.position);
  track.at(trap, _p);
  camera.lookAt(_p.setY(0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 5.2), dark);
  pole.position.y = 2.6;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.9), dark);
  box.position.set(0, 5.3, 0.2);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0x222831, toneMapped: false });
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), flashMat);
  lens.position.set(0, 5.3, 0.66);
  const signTex = canvasTexture(512, 256, (ctx) => {
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 10;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.fillStyle = '#ffd23f';
    ctx.font = `italic 700 92px ${GAME_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('SPEED', 256, 92);
    ctx.fillText('TRAP', 256, 178);
  });
  textures.push(signTex);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.8), new THREE.MeshBasicMaterial({ map: signTex }));
  sign.position.set(0, 3.9, 0.15);
  const flashLight = new THREE.PointLight(0xffffff, 0, 30, 1.6);
  flashLight.position.set(0, 5.3, 1.2);
  camera.add(pole, box, lens, sign, flashLight);
  group.add(camera);
  const trapState = { position: camera.position, firedAt: -Infinity };

  // The game font may load after the first draw: redraw then.
  document.fonts?.load(`italic 700 40px ${GAME_FONT}`).then(() => textures.forEach((t) => t.userData.draw()));

  return {
    group,
    // Returns the events of this frame: gates crossed, speed trap fired.
    update(elapsed, carPosition, speed) {
      const events = [];
      curtains.forEach((c, i) => {
        c.material.uniforms.uTime.value = elapsed;
        c.arrows.offset.y = -elapsed * 1.6;
        if (_p.copy(c.position).setY(0).distanceTo(carPosition) < 2.5 && elapsed - c.passedAt > 4) {
          c.passedAt = elapsed;
          events.push({ type: 'gate', index: i });
        }
        c.material.uniforms.uBoost.value = Math.max(0, 1 - (elapsed - c.passedAt) * 2);
      });
      if (_p.copy(trapState.position).setY(0).distanceTo(carPosition) < 7 && elapsed - trapState.firedAt > 4 && speed > 2) {
        trapState.firedAt = elapsed;
        events.push({ type: 'trap' });
      }
      const flash = Math.max(0, 1 - (elapsed - trapState.firedAt) * 5);
      flashLight.intensity = flash * 400;
      flashMat.color.setScalar(0.12 + flash * 4);
      return events;
    },
  };
}

const _p = new THREE.Vector3();

function arrowsTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 16;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // A chevron pointing along +v, the driving direction (canvas top = high v).
  ctx.beginPath();
  ctx.moveTo(24, 88);
  ctx.lineTo(64, 40);
  ctx.lineTo(104, 88);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1 / 3.2); // one chevron every 3.2 m
  return t;
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.userData.draw = () => {
    draw(ctx);
    t.needsUpdate = true;
  };
  t.userData.draw();
  return t;
}
