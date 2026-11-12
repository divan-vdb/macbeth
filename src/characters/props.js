// Costume pieces the CC0 outfits don't include: a flowing cloak pinned with a
// round brooch, a sword at the hip, and a gold circlet.  Textures are painted
// in code to match the Green.png style: worn wool, gold trim, gold flecks.
import * as THREE from 'three/webgpu';
import { tileFbm, tileNoise, mulberry32 } from '../world/noise.js';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

export function cloakTexture(base, trim) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(256, 256);
  const c = srgb(base);
  const [r0, g0, b0] = [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2) * 255);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const n = tileFbm((x / 256) * 6, (y / 256) * 6, 6, 5, 401);
      const fold = tileNoise((x / 256) * 10, (y / 256) * 1.5, 10, 403) * 0.22;
      const weave = Math.sin(x * 1.7) * Math.sin(y * 1.7) * 0.035;
      const l = 0.62 + n * 0.5 + weave - fold;
      const i = (y * 256 + x) * 4;
      img.data[i] = Math.min(255, r0 * l);
      img.data[i + 1] = Math.min(255, g0 * l);
      img.data[i + 2] = Math.min(255, b0 * l);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // worn, slightly ragged hem with a trim band
  g.fillStyle = trim;
  g.fillRect(0, 238, 256, 7);
  const rand = mulberry32(11);
  // frayed, darkened hem
  for (let x = 0; x < 256; x += 2) {
    g.fillStyle = `rgba(20,10,8,${0.35 + rand() * 0.4})`;
    g.fillRect(x, 247 + rand() * 4, 2, 10);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = `rgba(${200 + rand() * 40},${150 + rand() * 40},${60 + rand() * 30},${0.2 + rand() * 0.4})`;
    g.fillRect(rand() * 256, rand() * 256, 1.2, 1.2);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// An open cone of cloth hung from the shoulders, deformed each frame so it
// streams back with speed and ripples in the wind.  Local axes: +y up, +z forward.
export function makeCloak({ color = '#7a1414', trim = 'rgba(176,128,44,0.95)', width = 0.27, hem = 0.42, length = 1.25 }) {
  const geo = new THREE.CylinderGeometry(width, hem, length, 20, 12, true, Math.PI / 2 - 0.5, Math.PI + 1.0);
  geo.scale(1.1, 1, 0.55);
  geo.translate(0, -length / 2, -0.03);
  const map = cloakTexture(color, trim);
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.93, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  const base = Float32Array.from(geo.attributes.position.array);
  const brooch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: srgb('#b8892e'), metalness: 0.95, roughness: 0.3 })
  );
  brooch.position.set(0.15, -0.02, 0.12);
  mesh.add(brooch);

  let t = 0, flow = 0;
  function update(dt, speed, airborne, wind, phase) {
    t += dt;
    const target = Math.min(1.2, speed / 3.4 + (airborne ? 0.6 : 0) + wind * 0.25);
    flow += (target - flow) * Math.min(1, dt * 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const d = Math.min(1, Math.max(0, -by / length)); // 0 at the collar, 1 at the hem
      const back = bz < 0 ? 1 : 0.3;
      const ripple = Math.sin(t * 3.1 + d * 4 + bx * 6) * 0.022 * d * (0.4 + flow);
      const stream = flow * d ** 1.4 * 0.5 * back;
      const swing = Math.sin(phase) * 0.035 * d * Math.min(1, speed);
      pos.setXYZ(i, bx + ripple + swing, by + stream * 0.4 * d, bz - stream + ripple * 0.5);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return { mesh, update };
}

// A plain cruciform sword in a leather scabbard
export function makeSword() {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: srgb('#3a2414'), roughness: 0.75 });
  const brass = new THREE.MeshStandardMaterial({ color: srgb('#a8803a'), metalness: 0.9, roughness: 0.35 });
  const add = (geo, mat, y) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    g.add(m);
  };
  add(new THREE.CylinderGeometry(0.022, 0.015, 0.86, 8), leather, -0.46);
  add(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), brass, -0.88);
  add(new THREE.BoxGeometry(0.19, 0.022, 0.03), brass, -0.02);
  add(new THREE.CylinderGeometry(0.014, 0.016, 0.14, 8), leather, 0.07);
  add(new THREE.SphereGeometry(0.025, 10, 8), brass, 0.15);
  // the last three pieces are the hilt, hidden while the sword is in Macbeth's hand
  g.children.slice(-3).forEach((m) => (m.userData.hilt = true));
  g.name = 'scabbard';
  return g;
}

// A thin gold circlet with a small raised point at the front
export function makeCirclet(radius = 0.098, metal = '#c9a24a') {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: srgb(metal), metalness: 0.95, roughness: 0.28 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006, 6, 40).rotateX(Math.PI / 2), gold);
  const point = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 4), gold);
  point.position.set(0, 0.018, radius);
  const gem = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: srgb('#7a0f14'), roughness: 0.2 }));
  gem.position.set(0, 0.004, radius + 0.004);
  g.add(ring, point, gem);
  return g;
}

// A floor-length gown skirt: crimson velvet with a gold-embroidered front panel
// and hem, as in the Green.png Lady Macbeth.  Hung from the waist.

// Crimson velvet with a gold-embroidered panel down the front (u = 0) and a gold hem.
export function gownTexture(color = '#6e0f14') {
  const cv = document.createElement('canvas');
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(512, 256);
  const c = srgb(color);
  const [r0, g0, b0] = [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2) * 255);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 512; x++) {
      const pile = tileFbm((x / 512) * 16, (y / 256) * 4, 16, 4, 501);
      const fold = Math.sin((x / 512) * Math.PI * 2 * 9 + tileNoise((x / 512) * 6, (y / 256) * 2, 6, 503) * 3) * 0.12;
      const l = 0.7 + pile * 0.4 + fold;
      const i = (y * 512 + x) * 4;
      img.data[i] = Math.min(255, r0 * l);
      img.data[i + 1] = Math.min(255, g0 * l);
      img.data[i + 2] = Math.min(255, b0 * l);
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // gold embroidered panel down the front (u = 0, which wraps to both edges) and the hem
  const panel = (x0) => {
    g.fillStyle = 'rgba(160,110,36,0.95)';
    g.fillRect(x0, 0, 34, 256);
    g.strokeStyle = 'rgba(90,55,12,0.9)';
    g.lineWidth = 1.5;
    for (let y = 6; y < 256; y += 16) {
      g.beginPath();
      g.moveTo(x0 + 17, y);
      g.lineTo(x0 + 29, y + 8);
      g.lineTo(x0 + 17, y + 16);
      g.lineTo(x0 + 5, y + 8);
      g.closePath();
      g.stroke();
    }
  };
  panel(-17);
  panel(512 - 17);
  g.fillStyle = 'rgba(160,110,36,0.95)';
  g.fillRect(0, 236, 512, 12);
  const rand = mulberry32(21);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${200 + rand() * 40},${150 + rand() * 40},${60 + rand() * 30},${0.15 + rand() * 0.35})`;
    g.fillRect(rand() * 512, rand() * 256, 1.2, 1.2);
  }
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  return map;
}

// A gold belt and brooch for the waist of the gown.
export function makeBelt(rx = 0.16, rz = 0.13, rope = false) {
  if (rope) return makeRopeBelt(rx, rz);
  const belt = new THREE.Mesh(
    new THREE.TorusGeometry(1, 0.09, 6, 40).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: srgb('#a8803a'), metalness: 0.9, roughness: 0.35 })
  );
  belt.scale.set(rx + 0.012, 0.16, rz + 0.012);
  const brooch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: srgb('#c9a24a'), metalness: 0.95, roughness: 0.28 })
  );
  brooch.position.set(0, 0, rz + 0.02);
  const g = new THREE.Group();
  g.add(belt, brooch);
  return g;
}

// A round gold brooch pinning a cloak at the shoulder.
export function makeBrooch() {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.032, 0.014, 16).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: srgb('#b8892e'), metalness: 0.95, roughness: 0.3 })
  );
  m.castShadow = true;
  return m;
}

// ---------- the Weird Sisters

// Old, grimy wool with darns and patches, torn into tatters at the hem.
// The torn parts are transparent (use with alphaTest), so the cloth's own
// edge is ragged, not just painted.
export function ragTexture(color = '#2f3820', seed = 1) {
  const W = 512, H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const img = g.createImageData(W, H);
  const c = srgb(color);
  const [r0, g0, b0] = [c.r, c.g, c.b].map((v) => Math.pow(v, 1 / 2.2) * 255);
  const rand = mulberry32(700 + seed);
  // how far each strip of the hem has torn away (in pixels from the bottom)
  const tear = new Float32Array(W);
  let x = 0;
  while (x < W) {
    const w = 6 + Math.floor(rand() * 26), depth = 6 + rand() * 46;
    for (let i = 0; i < w && x < W; i++, x++) tear[x] = depth * (0.55 + 0.45 * Math.sin((i / w) * Math.PI));
  }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / H;
      const grime = tileFbm(u * 10, v * 5, 10, 5, 710 + seed);
      const weave = Math.sin(x * 1.9) * Math.sin(y * 1.9) * 0.05;
      const fold = Math.sin(u * Math.PI * 2 * 7 + tileNoise(u * 5, v * 2, 5, 720 + seed) * 3) * 0.1;
      const dirt = Math.max(0, v - 0.55) * 0.9; // mud creeping up from the hem
      let l = 0.55 + grime * 0.6 + weave + fold - dirt * 0.5;
      const i = (y * W + x) * 4;
      img.data[i] = Math.min(255, r0 * l + dirt * 18);
      img.data[i + 1] = Math.min(255, g0 * l + dirt * 14);
      img.data[i + 2] = Math.min(255, b0 * l + dirt * 8);
      // torn hem and a few moth holes are see-through
      const fromBottom = H - 1 - y;
      const hole = tileNoise(u * 22, v * 11, 22, 730 + seed) > 0.86 && v > 0.35;
      img.data[i + 3] = fromBottom < tear[x] + tileNoise(u * 40, v * 8, 40, 740 + seed) * 6 || hole ? 0 : 255;
    }
  g.putImageData(img, 0, 0);
  // darned patches in slightly different cloth
  for (let k = 0; k < 7; k++) {
    const px = rand() * W, py = 30 + rand() * 150, pw = 22 + rand() * 30, ph = 18 + rand() * 26;
    g.fillStyle = `rgba(${r0 * (0.7 + rand() * 0.5)},${g0 * (0.7 + rand() * 0.5)},${b0 * (0.7 + rand() * 0.4)},0.75)`;
    g.fillRect(px, py, pw, ph);
    g.strokeStyle = 'rgba(15,12,8,0.6)';
    g.setLineDash([3, 3]);
    g.strokeRect(px, py, pw, ph);
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// A twisted cord tied round the waist, ends hanging.
function makeRopeBelt(rx, rz) {
  const mat = new THREE.MeshStandardMaterial({ color: srgb('#5a4a32'), roughness: 1 });
  const g = new THREE.Group();
  for (let k = 0; k < 2; k++) {
    const pts = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.sin(a) * (rx + 0.014), Math.sin(a * 9 + k * Math.PI) * 0.004, Math.cos(a) * (rz + 0.014)));
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 64, 0.007, 5, true), mat));
  }
  for (const side of [-1, 1]) {
    const pts = [new THREE.Vector3(side * 0.03, 0, rz + 0.016), new THREE.Vector3(side * 0.045, -0.12, rz + 0.03), new THREE.Vector3(side * 0.04, -0.26, rz + 0.04)];
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.007, 5), mat));
  }
  return g;
}

// A cord of small bones and teeth worn round the neck.
export function makeBoneNecklace(rx = 0.085, rz = 0.08, drop = 0.07) {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color: srgb('#d8cdb0'), roughness: 0.7 });
  const cord = new THREE.MeshStandardMaterial({ color: srgb('#2a2018'), roughness: 1 });
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const a = -Math.PI * 0.62 + (i / 24) * Math.PI * 1.24; // front arc
    pts.push(new THREE.Vector3(Math.sin(a) * rx, -drop * Math.cos(a * 0.8) ** 2, Math.cos(a) * rz));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.0025, 4), cord));
  const rand = mulberry32(51);
  for (let i = 0; i < 11; i++) {
    const t = 0.08 + (i / 10) * 0.84;
    const p = curve.getPoint(t);
    const fang = i % 3 === 1;
    const m = new THREE.Mesh(fang ? new THREE.ConeGeometry(0.006, 0.03, 5) : new THREE.CapsuleGeometry(0.0045, 0.016 + rand() * 0.01, 2, 5), bone);
    m.position.copy(p).add(new THREE.Vector3(0, fang ? -0.016 : -0.01, 0.004));
    if (fang) m.rotation.x = Math.PI;
    m.rotation.z = (rand() - 0.5) * 0.4;
    g.add(m);
  }
  // a little bird skull at the centre
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), bone);
  skull.scale.set(1, 0.85, 1.2);
  skull.position.copy(curve.getPoint(0.5)).add(new THREE.Vector3(0, -0.02, 0.01));
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.03, 5), bone);
  beak.position.copy(skull.position).add(new THREE.Vector3(0, -0.022, 0.006));
  beak.rotation.x = Math.PI * 0.92;
  g.add(skull, beak);
  return g;
}

// A gnarled, twisting staff of dark wood, knotted at the top. Its axis is +y,
// with the grip (a fraction `grip` of the way up) at the origin.
export function makeStaff(length = 2.0, grip = 0.58) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = (t - grip) * length;
    pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.018 + Math.sin(t * 23) * 0.006, y, Math.cos(t * 7) * 0.016));
  }
  // the head curls over like a crook
  const top = pts[pts.length - 1];
  for (let i = 1; i <= 6; i++) {
    const a = (i / 6) * Math.PI * 1.25;
    pts.push(new THREE.Vector3(top.x + Math.sin(a) * 0.07, top.y + Math.sin(a * 0.5 + 0.3) * 0.08 - (i > 4 ? (i - 4) * 0.03 : 0), top.z + (1 - Math.cos(a)) * 0.02));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 120, 0.016, 7);
  // thicker at the foot, knots along the shaft
  const pos = geo.attributes.position;
  const p = new THREE.Vector3(), c = new THREE.Vector3();
  const rand = mulberry32(61);
  const knots = [0.3, 0.52, 0.71, 0.86].map((k) => k + rand() * 0.04);
  for (let i = 0; i < pos.count; i++) {
    const ring = Math.floor(i / 8) / 120;
    p.fromBufferAttribute(pos, i);
    curve.getPoint(Math.min(1, ring), c);
    let s = 1.15 - ring * 0.3;
    for (const k of knots) s += Math.exp(-((ring - k) ** 2) / 0.0003) * 0.6;
    p.sub(c).multiplyScalar(s).add(c);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geo.computeVertexNormals();
  const cv = document.createElement('canvas');
  cv.width = 64;
  cv.height = 256;
  const g = cv.getContext('2d');
  const img = g.createImageData(64, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 64; x++) {
      const n = tileFbm((x / 64) * 4, (y / 256) * 24, 4, 4, 77);
      const streak = Math.abs(Math.sin((x / 64) * Math.PI * 6 + n * 4));
      const l = 0.16 + n * 0.16 + streak * 0.06;
      const i = (y * 64 + x) * 4;
      img.data[i] = l * 255 * 1.1;
      img.data[i + 1] = l * 255 * 0.85;
      img.data[i + 2] = l * 255 * 0.62;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const staff = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
  staff.castShadow = true;
  return staff;
}

// ---------- the arsenal (all with the grip at the origin and the length along +y)

const steel = () => new THREE.MeshStandardMaterial({ color: srgb('#b9bec4'), metalness: 0.92, roughness: 0.28 });

// A long-bladed Scots sword: tapering double-edged blade with a fuller, brass
// crossguard and pommel, leather grip.
export function makeBlade() {
  const g = new THREE.Group();
  const brass = new THREE.MeshStandardMaterial({ color: srgb('#a8803a'), metalness: 0.9, roughness: 0.35 });
  const leather = new THREE.MeshStandardMaterial({ color: srgb('#3a2414'), roughness: 0.75 });
  const outline = new THREE.Shape();
  outline.moveTo(-0.026, 0);
  outline.lineTo(-0.022, 0.62);
  outline.quadraticCurveTo(-0.018, 0.74, 0, 0.82);
  outline.quadraticCurveTo(0.018, 0.74, 0.022, 0.62);
  outline.lineTo(0.026, 0);
  outline.lineTo(-0.026, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.004, bevelSegments: 1 }), steel());
  blade.geometry.translate(0, 0.09, -0.002);
  const fuller = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.5, 0.0095), new THREE.MeshStandardMaterial({ color: srgb('#7d8389'), metalness: 0.9, roughness: 0.4 }));
  fuller.position.y = 0.38;
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.022, 0.03), brass);
  guard.position.y = 0.08;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.016, 0.14, 8), leather);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.025, 10, 8), brass);
  pommel.position.y = -0.085;
  for (const m of [blade, fuller, guard, grip, pommel]) {
    m.castShadow = true;
    g.add(m);
  }
  g.name = 'blade';
  return g;
}

// An ash-shafted boar spear: leaf-shaped iron head with a crossbar below it
// (to stop a charging boar), leather grip, iron butt-cap. Grip at the origin.
export function makeSpear() {
  const g = new THREE.Group();
  const ash = new THREE.MeshStandardMaterial({ color: srgb('#8a6a44'), roughness: 0.8 });
  const iron = new THREE.MeshStandardMaterial({ color: srgb('#5d5f62'), metalness: 0.85, roughness: 0.45 });
  const leather = new THREE.MeshStandardMaterial({ color: srgb('#2e1d12'), roughness: 0.85 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.017, 2.0, 8), ash);
  shaft.position.y = 0.2;
  const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.26, 8), leather);
  const leaf = new THREE.Shape();
  leaf.moveTo(0, 0);
  leaf.quadraticCurveTo(0.05, 0.08, 0.034, 0.17);
  leaf.quadraticCurveTo(0.02, 0.25, 0, 0.32);
  leaf.quadraticCurveTo(-0.02, 0.25, -0.034, 0.17);
  leaf.quadraticCurveTo(-0.05, 0.08, 0, 0);
  const head = new THREE.Mesh(new THREE.ExtrudeGeometry(leaf, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.005, bevelSegments: 1 }), steel());
  head.geometry.translate(0, 0, -0.003);
  head.position.y = 1.27;
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.019, 0.1, 8), iron);
  socket.position.y = 1.22;
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 6), iron);
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 1.17;
  const butt = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 8), iron);
  butt.rotation.x = Math.PI;
  butt.position.y = -0.83;
  for (const m of [shaft, wrap, head, socket, bar, butt]) {
    m.castShadow = true;
    g.add(m);
  }
  g.name = 'spear';
  return g;
}

// A hand-sized stone off the heath.
export function makePebble(seed = 1, size = 0.055) {
  const geo = new THREE.DodecahedronGeometry(size, 1);
  const pos = geo.attributes.position;
  const rand = mulberry32(300 + seed);
  const sx = 0.85 + rand() * 0.4, sy = 0.6 + rand() * 0.3, sz = 0.8 + rand() * 0.35;
  for (let i = 0; i < pos.count; i++) {
    const n = 1 + (Math.sin(pos.getX(i) * 90 + seed) + Math.sin(pos.getZ(i) * 70 + seed * 2)) * 0.05;
    pos.setXYZ(i, pos.getX(i) * sx * n, pos.getY(i) * sy * n, pos.getZ(i) * sz * n);
  }
  geo.computeVertexNormals();
  const tone = 0.32 + rand() * 0.18;
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color(tone, tone * 0.97, tone * 0.92), roughness: 0.92, flatShading: true }));
  m.castShadow = true;
  m.name = 'pebble';
  return m;
}

// A healer's tonic: a small green-glass flask of red cordial, stoppered with cork.
export function makeTonic() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.034, 0.002], [0.042, 0.02], [0.044, 0.05], [0.036, 0.075], [0.016, 0.09], [0.013, 0.12], [0.016, 0.125]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), new THREE.MeshStandardMaterial({ color: srgb('#5f8a6a'), roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.45, depthWrite: false }));
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0, 5).map((v) => new THREE.Vector2(v.x * 0.92, v.y * 0.92)), 14), new THREE.MeshStandardMaterial({ color: srgb('#8a1020'), emissive: srgb('#5a0610'), emissiveIntensity: 0.6, roughness: 0.3 }));
  const cork = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.03, 8), new THREE.MeshStandardMaterial({ color: srgb('#a07a50'), roughness: 0.9 }));
  cork.position.y = 0.13;
  g.add(liquid, glass, cork);
  g.name = 'tonic';
  return g;
}

// A rolled parchment tied with cord and sealed with black wax.
export function makeScroll() {
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 12), new THREE.MeshStandardMaterial({ color: srgb('#d8c49a'), roughness: 0.9 }));
  paper.rotation.z = Math.PI / 2;
  const cord = new THREE.Mesh(new THREE.TorusGeometry(0.0235, 0.003, 4, 16), new THREE.MeshStandardMaterial({ color: srgb('#6a2a1a'), roughness: 1 }));
  cord.rotation.y = Math.PI / 2;
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 12), new THREE.MeshStandardMaterial({ color: srgb('#141014'), roughness: 0.35, metalness: 0.2 }));
  seal.rotation.x = Math.PI / 2;
  seal.position.z = 0.024;
  g.add(paper, cord, seal);
  g.traverse((m) => m.isMesh && (m.castShadow = true));
  g.name = 'scroll';
  return g;
}
