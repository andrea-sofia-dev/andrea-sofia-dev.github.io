import * as THREE from 'three';
import { WIDTH } from './track.js';
import { placeOnTrack } from './base.js';

// Video game bits on the circuit: CHECKPOINT arches before each stop,
// and rows of "?" item boxes that burst when the car drives through them.

const PIXEL = '"Press Start 2P", monospace';

export function buildArcade({ track, checkpoints, itemRows, animated }) {
  const group = new THREE.Group();
  const textures = [];

  // ---------- checkpoint arches ----------
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.6, metalness: 0.4 });
  const yellow = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd23f).multiplyScalar(1.3), toneMapped: false });
  const bannerTex = canvasTexture(1024, 128, (ctx) => {
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, 1024, 128);
    // Chequered borders.
    for (let x = 0; x < 1024; x += 16) {
      for (const y of [0, 112]) {
        ctx.fillStyle = (x / 16 + y / 16) % 2 ? '#e8eef7' : '#07080c';
        ctx.fillRect(x, y, 16, 16);
      }
    }
    ctx.fillStyle = '#ffd23f';
    ctx.font = `56px ${PIXEL}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHECKPOINT', 512, 68);
  });
  textures.push(bannerTex);
  for (const u of checkpoints) {
    const arch = new THREE.Group();
    placeOnTrack(track, arch, u, 0);
    for (const side of [1, -1]) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.2, 0.5), pillarMat);
      pillar.position.set(side * (WIDTH / 2 + 1), 3.1, 0);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 6.2, 0.06), yellow);
      edge.position.set(side * (WIDTH / 2 + 1) - side * 0.28, 3.1, -0.28);
      arch.add(pillar, edge);
    }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 3, 1.3, 0.3), [
      pillarMat, pillarMat, pillarMat, pillarMat,
      new THREE.MeshBasicMaterial({ map: bannerTex }),
      new THREE.MeshBasicMaterial({ map: bannerTex }),
    ]);
    banner.position.y = 6.4;
    arch.add(banner);
    group.add(arch);
  }

  // ---------- item boxes ----------
  const boxTex = canvasTexture(256, 256, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 256, 256);
    ['#ff5f7a', '#f5c518', '#5cf2b0', '#38e1ff', '#a78bfa'].forEach((c, i, all) => g.addColorStop(i / (all.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(6, 8, 14, 0.82)';
    ctx.fillRect(18, 18, 220, 220);
    ctx.fillStyle = '#ffffff';
    ctx.font = `150px ${PIXEL}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 136, 140);
  });
  textures.push(boxTex);
  const boxMat = new THREE.MeshStandardMaterial({
    map: boxTex,
    emissive: 0xffffff,
    emissiveMap: boxTex,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.92,
    roughness: 0.3,
  });
  const boxGeo = new THREE.BoxGeometry(1.1, 1.1, 1.1);
  const boxes = [];
  for (const u of itemRows) {
    for (const lateral of [-2.6, 0, 2.6]) {
      const mesh = new THREE.Mesh(boxGeo, boxMat);
      placeOnTrack(track, mesh, u, lateral);
      mesh.position.y = 1.3;
      mesh.rotation.set(0.6, Math.random() * Math.PI, 0.3);
      group.add(mesh);
      boxes.push({ mesh, home: mesh.position.clone(), poppedAt: -Infinity, phase: Math.random() * 6 });
    }
  }

  // The pixel font loads after the first draw: redraw then.
  document.fonts?.load(`20px ${PIXEL}`).then(() => {
    for (const t of textures) t.userData.draw();
  });

  return {
    group,
    update(elapsed, carPosition) {
      for (const b of boxes) {
        if (b.mesh.position.distanceTo(carPosition) < 1.8 && elapsed - b.poppedAt > 3) b.poppedAt = elapsed;
        const since = elapsed - b.poppedAt;
        // Burst: grow and vanish fast, come back after a while.
        let scale = 1;
        if (since < 0.18) scale = 1 + since * 4;
        else if (since < 2.6) scale = 0;
        else if (since < 3) scale = (since - 2.6) / 0.4;
        b.mesh.scale.setScalar(scale);
        if (animated) {
          b.mesh.rotation.y += 0.02;
          b.mesh.position.y = b.home.y + Math.sin(elapsed * 2 + b.phase) * 0.15;
        }
      }
    },
  };
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
    ctx.clearRect(0, 0, w, h);
    draw(ctx);
    t.needsUpdate = true;
  };
  t.userData.draw();
  return t;
}
