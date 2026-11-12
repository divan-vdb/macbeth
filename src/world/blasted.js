// The blasted heath of Act I, scene 3: a hollow on the road to Forres where a
// lightning-struck tree stands dead among a few stones, and mist lies on the
// ground. Also the sisters' mist: drifting banks, and bursts when they come and go.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { barkTextures } from './textures.js';
import { rockMaterial, boulderGeometry } from './heath.js';
import { mulberry32, fbm } from './noise.js';

// ---------- a dead tree, split and charred by lightning
function limb(from, dir, len, r0, r1, seed, char) {
  const geo = new THREE.CylinderGeometry(r1, r0, len, 9, 6, false);
  const pos = geo.attributes.position;
  const rand = mulberry32(seed);
  const bend = new THREE.Vector3((rand() - 0.5) * 0.3, 0, (rand() - 0.5) * 0.3).multiplyScalar(len);
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = y / len + 0.5;
    const a = Math.atan2(z, x);
    const bump = 1 + 0.12 * Math.sin(a * 3 + seed + t * 7) * Math.sin(t * 11 + seed);
    const s = Math.sin(t * Math.PI);
    pos.setXYZ(i, x * bump + bend.x * s, y, z * bump + bend.z * s);
    // charring: worse towards the tips and on the side the bolt came down
    const c = Math.min(1, char + t * 0.5 + Math.max(0, Math.cos(a - 0.8)) * 0.35 * t);
    const k = 1 - 0.78 * c;
    col[i * 3] = k;
    col[i * 3 + 1] = k * 0.95;
    col[i * 3 + 2] = k * 0.9;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  geo.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  geo.applyQuaternion(q);
  geo.translate(from.x, from.y, from.z);
  return geo;
}
function deadTree(seed) {
  const rand = mulberry32(seed);
  const geos = [];
  const up = new THREE.Vector3(0.08, 1, -0.05);
  const trunkLen = 4.4;
  geos.push(limb(new THREE.Vector3(0, -0.3, 0), up, trunkLen, 0.36, 0.17, seed, 0.15));
  // the split crown: two jagged stubs where the bolt tore the top away
  const top = up.clone().normalize().multiplyScalar(trunkLen - 0.3).add(new THREE.Vector3(0, -0.3, 0));
  geos.push(limb(top, new THREE.Vector3(0.35, 1, 0.1), 1.1, 0.15, 0.03, seed + 1, 0.7));
  geos.push(limb(top, new THREE.Vector3(-0.4, 1, -0.15), 0.8, 0.13, 0.02, seed + 2, 0.8));
  // gnarled branches reaching out, then up, like hands
  for (let i = 0; i < 5; i++) {
    const h = 1.6 + i * 0.55 + rand() * 0.2;
    const a = i * 2.4 + rand() * 0.6;
    const base = up.clone().normalize().multiplyScalar(h).add(new THREE.Vector3(0, -0.3, 0));
    const d = new THREE.Vector3(Math.cos(a), 0.55 + rand() * 0.5, Math.sin(a));
    const len = 1.5 + rand() * 1.1 - i * 0.12;
    const r = 0.11 - i * 0.012;
    geos.push(limb(base, d, len, r, r * 0.35, seed + 10 + i, 0.3));
    const tip = base.clone().addScaledVector(d.clone().normalize(), len * 0.85);
    for (let j = 0; j < 2; j++) {
      const b = j ? 1 : -1;
      const d2 = new THREE.Vector3(Math.cos(a + b * 0.7), 0.9 + rand() * 0.4, Math.sin(a + b * 0.7));
      geos.push(limb(tip, d2, 0.6 + rand() * 0.5, r * 0.4, 0.008, seed + 30 + i * 2 + j, 0.45));
    }
  }
  // roots clawing into the ground
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand();
    geos.push(limb(new THREE.Vector3(0, 0.25, 0), new THREE.Vector3(Math.cos(a), -0.35, Math.sin(a)), 1.0 + rand() * 0.5, 0.16, 0.03, seed + 50 + i, 0.1));
  }
  const bt = barkTextures(77);
  const mat = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, vertexColors: true, roughness: 1, metalness: 0 });
  mat.normalScale.set(1.3, 1.3);
  const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// ---------- mist: soft puffs that always face the view
let puffTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const n = 128, cv = document.createElement('canvas');
  cv.width = cv.height = n;
  const g = cv.getContext('2d');
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const dx = (x / n - 0.5) * 2, dy = (y / n - 0.5) * 2;
      const r = Math.hypot(dx, dy);
      const fall = Math.max(0, 1 - r) ** 1.6;
      const wisp = 0.55 + 0.45 * fbm(x * 0.06 + 3, y * 0.06 + 7, 4);
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(255, fall * wisp * 255);
    }
  g.putImageData(img, 0, 0);
  puffTex = new THREE.CanvasTexture(cv);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}
export function createMist(scene, heightAt) {
  const group = new THREE.Group();
  scene.add(group);
  const banks = [];
  const bursts = [];
  const make = (color, op) => {
    const m = new THREE.SpriteNodeMaterial({ map: puffTexture(), color, transparent: true, depthWrite: false, opacity: op, fog: true });
    const s = new THREE.Sprite(m);
    group.add(s);
    return s;
  };
  const tint = new THREE.Color().setStyle('#9aa6b8', THREE.SRGBColorSpace);
  // a bank of mist lying on the ground round a place
  function bank(at, { radius = 9, count = 22, density = 1, seed = 5 } = {}) {
    const rand = mulberry32(seed);
    const list = [];
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
      const s = make(tint, 0);
      const size = 3.5 + rand() * 4;
      s.scale.set(size, size * 0.42, 1);
      s.userData = { a, r, x: at.x + Math.cos(a) * r, z: at.z + Math.sin(a) * r, h: 0.25 + rand() * 0.7, sp: 0.04 + rand() * 0.08, ph: rand() * 6, op: 0.07 + rand() * 0.09 };
      s.material.rotation = rand() * 6;
      list.push(s);
    }
    const b = { at: at.clone(), list, density, target: density };
    banks.push(b);
    return {
      set(v) {
        b.target = v;
      },
    };
  }
  // a sudden swirl of mist, as the sisters come or go
  function burst(at, { count = 16, size = 1.2, spread = 1.4 } = {}) {
    for (let i = 0; i < count; i++) {
      const s = make(tint, 0);
      const a = Math.random() * Math.PI * 2;
      s.position.set(at.x + Math.cos(a) * Math.random() * 0.6, at.y + 0.3 + Math.random() * 1.6, at.z + Math.sin(a) * Math.random() * 0.6);
      s.userData = { t: 0, life: 2.4 + Math.random() * 1.2, vx: Math.cos(a) * spread, vz: Math.sin(a) * spread, vy: 0.3 + Math.random() * 0.5, size, spin: (Math.random() - 0.5) * 0.8 };
      s.material.rotation = Math.random() * 6;
      bursts.push(s);
    }
  }
  let time = 0;
  function update(dt) {
    time += dt;
    for (const b of banks) {
      b.density += (b.target - b.density) * Math.min(1, dt * 0.6);
      for (const s of b.list) {
        const u = s.userData;
        const drift = time * u.sp;
        const x = u.x + Math.cos(u.ph + drift) * 0.9, z = u.z + Math.sin(u.ph + drift * 0.8) * 0.9;
        s.position.set(x, heightAt(x, z) + u.h, z);
        s.material.opacity = u.op * b.density;
        s.material.rotation += dt * 0.02;
        s.visible = b.density > 0.01;
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const s = bursts[i], u = s.userData;
      u.t += dt;
      const k = u.t / u.life;
      s.position.x += u.vx * dt * (1 - k);
      s.position.z += u.vz * dt * (1 - k);
      s.position.y += u.vy * dt;
      const sz = u.size * (1 + k * 3);
      s.scale.set(sz, sz, 1);
      s.material.opacity = 0.42 * Math.sin(Math.PI * Math.min(1, k * 1.3)) * (1 - k * 0.3);
      s.material.rotation += u.spin * dt;
      if (k >= 1) {
        group.remove(s);
        s.material.dispose();
        bursts.splice(i, 1);
      }
    }
  }
  return { bank, burst, update };
}

// ---------- the hollow itself
export function buildBlastedHeath(at, heightAt, toward = new THREE.Vector3()) {
  const group = new THREE.Group();
  const solids = [];
  const y = heightAt(at.x, at.z);
  const tree = deadTree(313);
  tree.position.set(at.x, y, at.z);
  tree.rotation.y = 0.7;
  group.add(tree);
  solids.push({ kind: 'ball', size: [0.42], position: new THREE.Vector3(at.x, y + 0.5, at.z), quaternion: new THREE.Quaternion() });
  // a fallen limb, and a ring of old stones half sunk in the heather
  const rand = mulberry32(919);
  const mat = rockMaterial();
  const open = Math.atan2(toward.z - at.z, toward.x - at.x); // the way in is left clear
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.4 + rand() * 0.3;
    if (Math.abs(Math.atan2(Math.sin(a - open), Math.cos(a - open))) < 1.1) continue;
    const r = 4.6 + rand() * 1.2;
    const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
    const s = 0.35 + rand() * 0.35;
    const m = new THREE.Mesh(boulderGeometry(s, 40 + i), mat);
    m.position.set(x, heightAt(x, z) + s * 0.1, z);
    m.rotation.y = rand() * 6;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    solids.push({ kind: 'ball', size: [s * 0.75], position: m.position.clone(), quaternion: m.quaternion.clone() });
  }
  return { group, solids, treeAt: new THREE.Vector3(at.x, y, at.z) };
}
