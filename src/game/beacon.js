// Glowing points of interest: a soft shaft of light rising from the spot, a glow
// on the ground and motes drifting up through it. Gold for objectives, pale blue
// for things worth finding, witch-green for the supernatural. The shaft fades as
// you arrive so it never blinds you.
import * as THREE from 'three/webgpu';
import { Particles } from '../world/fire.js';
import { glowTexture } from '../world/textures.js';

const COLORS = { objective: '#ffc85a', poi: '#a8d4ff', witch: '#7dff6a' };
let shaftTex = null;
function shaftTexture() {
  if (shaftTex) return shaftTex;
  const W = 64, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x / (W - 1)) * 2 - 1, v = 1 - y / (H - 1); // v: 0 bottom, 1 top
      const across = Math.exp(-u * u * 5);
      const up = Math.pow(1 - v, 1.6) * Math.min(1, v * 25 + 0.2);
      const a = across * up;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, a * 255);
    }
  g.putImageData(img, 0, 0);
  shaftTex = new THREE.CanvasTexture(cv);
  shaftTex.colorSpace = THREE.SRGBColorSpace;
  return shaftTex;
}

export function createBeacon(kind = 'objective', { height = 9, width = 1.3 } = {}) {
  const color = new THREE.Color().setStyle(COLORS[kind] || COLORS.objective, THREE.SRGBColorSpace);
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: shaftTexture(), color, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(width, height).translate(0, height / 2, 0), mat);
  const core = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.35, height * 0.8).translate(0, height * 0.4, 0), mat.clone());
  core.material.opacity = 0.7;
  const groundMat = new THREE.MeshBasicMaterial({ map: glowTexture(64, 0.15), color, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = 0.04;
  shaft.renderOrder = core.renderOrder = ground.renderOrder = 2;
  group.add(shaft, core, ground);
  const motes = new Particles(
    18,
    glowTexture(32, 0.25),
    THREE.AdditiveBlending,
    (q) => {
      const a = Math.random() * Math.PI * 2, r = Math.random() * width * 0.35;
      q.pos.set(Math.cos(a) * r, Math.random() * 0.4, Math.sin(a) * r);
      q.vel.set(0, 0.5 + Math.random() * 0.7, 0);
      q.life = 2.5 + Math.random() * 2.5;
      q.size = 0.04 + Math.random() * 0.05;
      q.seed = Math.random() * 10;
    },
    (q, k, dt, t, c) => {
      q.pos.addScaledVector(q.vel, dt);
      q.pos.x += Math.sin(t * 1.7 + q.seed) * 0.08 * dt;
      c.copy(color).multiplyScalar(Math.sin(Math.PI * k) * 0.9 * fade);
      return { sx: q.size, sy: q.size, roll: 0 };
    },
    2
  );
  group.add(motes.mesh);
  let t = Math.random() * 5, fade = 1;
  return {
    group,
    kind,
    update(dt, camera, playerPos) {
      t += dt;
      // face the camera around the vertical axis
      const yaw = Math.atan2(camera.position.x - group.position.x, camera.position.z - group.position.z);
      shaft.rotation.y = core.rotation.y = yaw;
      // fade as Macbeth arrives; breathe slowly
      const d = playerPos ? Math.hypot(playerPos.x - group.position.x, playerPos.z - group.position.z) : 99;
      fade = Math.min(1, Math.max(0.12, (d - 1.2) / 6));
      const breathe = 0.85 + Math.sin(t * 1.6) * 0.15;
      mat.opacity = 0.5 * fade * breathe;
      core.material.opacity = 0.65 * fade * breathe;
      groundMat.opacity = 0.55 + 0.2 * Math.sin(t * 2.1);
      motes.update(dt, camera, t);
    },
    dispose() {
      group.removeFromParent();
    },
  };
}
