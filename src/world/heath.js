import * as THREE from 'three/webgpu';
import { uniform, positionLocal, uv, time, sin, vec3, instanceIndex } from 'three/tsl';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm, fbm3, valueNoise, mulberry32, smoothstep } from './noise.js';
import { rockTextures, groundTextures, grassTexture, ashTexture, barkTextures, logEndTextures } from './textures.js';

export const HEATH_SIZE = 240;
const SEGMENTS = 120;

// Ground height: a level clearing for the stone circle, rolling moor beyond.
export function heightAt(x, z) {
  const r = Math.hypot(x, z);
  const hills = smoothstep(16, 55, r);
  const big = fbm(x * 0.018 + 11.3, z * 0.018 - 4.1) - 0.45;
  const small = (valueNoise(x * 0.25, z * 0.25) - 0.5) * smoothstep(2.5, 6, r);
  return big * 22 * hills + small * 0.35 + hills * 2.5;
}

// Where heather grows rather than grass (0 grass .. 1 heather)
export function patchAt(x, z) {
  return smoothstep(0.42, 0.62, fbm(x * 0.06 + 3.7, z * 0.06 + 9.2, 3));
}

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
const HEATHER = srgb('#6e4c62');
const GRASS = srgb('#55663a');
const DRY = srgb('#86774c');
const ROCK = srgb('#77756f');

export function buildTerrain() {
  const geo = new THREE.PlaneGeometry(HEATH_SIZE, HEATH_SIZE, SEGMENTS, SEGMENTS);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = heightAt(x, z);
    pos.setY(i, h);
    c.copy(GRASS).lerp(HEATHER, patchAt(x, z));
    c.lerp(DRY, smoothstep(0.55, 0.8, fbm(x * 0.03 - 7, z * 0.03 + 2, 3)) * 0.6);
    c.lerp(ROCK, smoothstep(9, 16, h) * 0.7);
    const shade = 0.9 + valueNoise(x * 0.9, z * 0.9) * 0.2;
    colors[i * 3] = c.r * shade;
    colors[i * 3 + 1] = c.g * shade;
    colors[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const { map, normalMap } = groundTextures();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.96,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  return mesh;
}

// Displace by a function of position only, so vertices shared between faces
// move together and the surface stays closed (no gaps between faces).
function roughen(geo, amount, freq, seed, taper = 0) {
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const hgt = bb.max.y - bb.min.y || 1;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = fbm3(v.x * freq + seed, v.y * freq - seed, v.z * freq + seed * 0.5, 4) - 0.5;
    const dir = v.clone().setY(v.y * 0.35).normalize();
    v.addScaledVector(dir, n * amount);
    if (taper) {
      const k = 1 - taper * ((v.y - bb.min.y) / hgt);
      v.x *= k;
      v.z *= k;
    }
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

export function boulderGeometry(size, seed) {
  let geo = new THREE.IcosahedronGeometry(size, 2);
  geo.deleteAttribute('normal');
  geo = mergeVertices(geo);
  geo.scale(1, 0.72, 1);
  return roughen(geo, size * 0.55, 1.4 / size, seed);
}

let rockMat = null;
export function rockMaterial() {
  if (!rockMat) {
    const { map, normalMap } = rockTextures();
    rockMat = new THREE.MeshStandardMaterial({ map, normalMap, normalScale: new THREE.Vector2(1.2, 1.2), roughness: 0.92 });
  }
  return rockMat;
}

// The standing stones and scattered boulders. Returns meshes and physics shapes.
export function buildStones() {
  const rand = mulberry32(1606);
  const group = new THREE.Group();
  const mat = rockMaterial();
  const solids = [];

  const ring = 7;
  for (let i = 0; i < ring; i++) {
    const a = (i / ring) * Math.PI * 2 + 0.3;
    const r = 10 + rand() * 1.5;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const w = 1.1 + rand() * 0.6, hgt = 2.8 + rand() * 1.8, d = 0.65 + rand() * 0.3;
    const geo = roughen(new THREE.BoxGeometry(w, hgt, d, 4, 8, 3), 0.32, 0.9, i * 3.7, 0.28);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, heightAt(x, z) + hgt / 2 - 0.35, z);
    m.rotation.set((rand() - 0.5) * 0.12, -a + Math.PI / 2, (rand() - 0.5) * 0.12);
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    solids.push({ kind: 'box', size: [w / 2, hgt / 2, d / 2], position: m.position.clone(), quaternion: m.quaternion.clone() });
  }

  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = 16 + rand() * 60;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const s = 0.6 + rand() * 2.2;
    const m = new THREE.Mesh(boulderGeometry(s, i * 1.9), mat);
    m.position.set(x, heightAt(x, z) + s * 0.15, z);
    m.rotation.y = rand() * Math.PI * 2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    solids.push({ kind: 'ball', size: [s * 0.75], position: m.position.clone(), quaternion: m.quaternion.clone() });
  }
  return { group, solids };
}

// Ground-level fire pit: ash bed, a packed ring of stones, logs and glowing embers.
export function buildFirePit() {
  const rand = mulberry32(1040);
  const group = new THREE.Group();
  const solids = [];
  const y0 = heightAt(0, 0);
  group.position.y = y0;
  const mat = rockMaterial();

  const ash = new THREE.Mesh(
    new THREE.CircleGeometry(1.35, 32).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: ashTexture(), transparent: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2 })
  );
  ash.position.y = 0.02;
  ash.receiveShadow = true;
  group.add(ash);

  const addRock = (x, z, s, seed, sink = 0.35) => {
    const m = new THREE.Mesh(boulderGeometry(s, seed), mat);
    m.position.set(x, s * (0.72 - sink) * 0.72, z);
    m.rotation.y = rand() * Math.PI * 2;
    m.castShadow = m.receiveShadow = true;
    group.add(m);
    solids.push({ kind: 'ball', size: [s * 0.7], position: new THREE.Vector3(x, y0 + m.position.y, z), quaternion: m.quaternion.clone() });
  };
  // Tight inner ring, then a second packed course behind it
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rand() * 0.1;
    addRock(Math.cos(a) * 1.2, Math.sin(a) * 1.2, 0.26 + rand() * 0.12, 100 + i);
  }
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.15 + rand() * 0.1;
    addRock(Math.cos(a) * 1.58, Math.sin(a) * 1.58, 0.22 + rand() * 0.14, 200 + i, 0.5);
  }
  // A few big boulders to sit on
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.6 + rand() * 0.4;
    addRock(Math.cos(a) * 3.4, Math.sin(a) * 3.4, 0.55 + rand() * 0.25, 300 + i, 0.25);
  }

  // Logs: a small teepee over two cross-laid logs, barked and charred at the ends
  const bt = barkTextures();
  const et = logEndTextures();
  const glow = srgb('#ff6a22');
  const bark = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, emissiveMap: bt.emissiveMap, emissive: glow, emissiveIntensity: 1.6, roughness: 1, metalness: 0 });
  bark.normalScale.set(1.1, 1.1);
  const endGrain = new THREE.MeshStandardMaterial({ map: et.map, emissiveMap: et.emissiveMap, emissive: glow, emissiveIntensity: 1.8, roughness: 1 });
  const logMats = [bark, endGrain, endGrain];
  // a slightly crooked, uneven round log rather than a perfect tube
  const logGeometry = (r0, r1, len, seed) => {
    const geo = new THREE.CylinderGeometry(r0, r1, len, 16, 6);
    const pos = geo.attributes.position;
    const lr = mulberry32(seed);
    const bendX = (lr() - 0.5) * 0.06, bendZ = (lr() - 0.5) * 0.06, ph = lr() * 6;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const t = y / len + 0.5;
      const a = Math.atan2(z, x);
      const bump = 1 + 0.06 * Math.sin(a * 3 + ph + t * 4) * Math.sin(t * 9 + ph) + 0.03 * Math.sin(a * 7 + t * 13);
      const curve = Math.sin(t * Math.PI);
      pos.setXYZ(i, x * bump + bendX * curve, y, z * bump + bendZ * curve);
    }
    geo.computeVertexNormals();
    return geo;
  };
  // a log of length L lying from point B to point T, spun about its own axis
  const Y = new THREE.Vector3(0, 1, 0);
  const placeLog = (geo, B, T) => {
    const log = new THREE.Mesh(geo, logMats);
    const dir = T.clone().sub(B).normalize();
    log.position.copy(B).add(T).multiplyScalar(0.5);
    log.quaternion.setFromUnitVectors(Y, dir);
    log.rotateY(rand() * Math.PI * 2);
    log.castShadow = true;
    group.add(log);
  };
  // the teepee: five split logs of different lengths and girths, feet in the
  // embers, tops leaning together
  const teepee = [
    [0.92, 0.44, 0.07, 0.09],
    [0.7, 0.38, 0.06, 0.075],
    [1.05, 0.5, 0.075, 0.095],
    [0.62, 0.36, 0.055, 0.07],
    [0.84, 0.42, 0.065, 0.085],
  ];
  teepee.forEach(([L, rb, r0, r1], i) => {
    const a = (i / teepee.length) * Math.PI * 2 + 0.4 + (rand() - 0.5) * 0.35;
    const rt = 0.05 + rand() * 0.04;
    const B = new THREE.Vector3(Math.cos(a) * rb, 0.05, Math.sin(a) * rb);
    const T = new THREE.Vector3(Math.cos(a + 0.15) * rt, 0.05 + Math.sqrt(Math.max(0.05, L * L - (rb - rt) ** 2)), Math.sin(a + 0.15) * rt);
    placeLog(logGeometry(r0, r1, L, 500 + i), B, T);
  });
  // two thicker logs laid across the bottom, one long, one shorter
  [[1.2, 0.1, 0.12, 0.3, 0.1], [0.86, 0.085, 0.1, 2.2, 0.17]].forEach(([L, r0, r1, a, y], i) => {
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)).multiplyScalar(L / 2);
    const c = new THREE.Vector3((rand() - 0.5) * 0.1, y, (rand() - 0.5) * 0.1);
    placeLog(logGeometry(r0, r1, L, 520 + i), c.clone().sub(d), c.clone().add(d));
  });
  // and a few short chunks burnt down in the embers
  for (let i = 0; i < 3; i++) {
    const L = 0.28 + rand() * 0.18, a = rand() * Math.PI * 2, r = 0.15 + rand() * 0.2;
    const c = new THREE.Vector3(Math.cos(a) * r, 0.05, Math.sin(a) * r);
    const d = new THREE.Vector3(Math.cos(a + 1.2 + rand()), 0.15 * (rand() - 0.5), Math.sin(a + 1.2 + rand())).normalize().multiplyScalar(L / 2);
    placeLog(logGeometry(0.045 + rand() * 0.015, 0.055 + rand() * 0.015, L, 540 + i), c.clone().sub(d), c.clone().add(d));
  }

  // Embers that pulse with heat
  // coals: lumps of black char with heat glowing in the cracks, not bright blobs
  const emberMat = new THREE.MeshStandardMaterial({ map: et.map, color: srgb('#4a3a32'), emissive: srgb('#ff5216'), emissiveMap: et.emissiveMap, emissiveIntensity: 3, roughness: 1 });
  const coalGeo = new THREE.DodecahedronGeometry(0.05, 1);
  {
    const cp = coalGeo.attributes.position;
    for (let i = 0; i < cp.count; i++) {
      const k = 1 + Math.sin(cp.getX(i) * 70) * 0.12 + Math.sin(cp.getZ(i) * 55 + 1) * 0.1;
      cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.7, cp.getZ(i) * k);
    }
    coalGeo.computeVertexNormals();
  }
  const embers = new THREE.InstancedMesh(coalGeo, emberMat, 46);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3();
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.7;
    q.setFromEuler(e.set(rand() * 3, rand() * 3, rand() * 3));
    s.setScalar(0.45 + rand() * 0.9);
    m4.compose(new THREE.Vector3(Math.cos(a) * r, 0.025 + rand() * 0.03, Math.sin(a) * r), q, s);
    embers.setMatrixAt(i, m4);
  }
  group.add(embers);

  let t = 0;
  const update = (dt) => {
    t += dt;
    emberMat.emissiveIntensity = 3 + Math.sin(t * 2.1) * 0.6 + Math.sin(t * 5.7) * 0.35 + Math.random() * 0.3;
    bark.emissiveIntensity = 1.3 + Math.sin(t * 1.7) * 0.35 + Math.sin(t * 4.3) * 0.2;
    endGrain.emissiveIntensity = bark.emissiveIntensity * 1.15;
  };
  return { group, solids, update, y0 };
}

// Wind-blown grass and heather tufts. `wind` is a 0..1 uniform the gust sound drives.
export function buildGrass(solids, narrow) {
  const rand = mulberry32(77);
  // Six one-sided planes (three crossed pairs, back to back) so every face is lit from the front
  const planes = [0, 1, 2, 3, 4, 5].map((k) => (k * Math.PI) / 3).map((a) => new THREE.PlaneGeometry(0.5, 0.18).translate(0, 0.09, 0).rotateY(a));
  const geo = mergeGeometries(planes);
  const nrm = geo.attributes.normal;
  for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, 0, 1, 0); // light tufts like the ground beneath

  const wind = uniform(0.25);
  const mat = new THREE.MeshStandardNodeMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.FrontSide, roughness: 0.9 });
  const bend = uv().y.mul(uv().y);
  const phase = instanceIndex.toFloat().mul(1.731);
  const wave = sin(time.mul(1.8).add(phase)).mul(0.55).add(sin(time.mul(3.1).add(phase.mul(0.37))).mul(0.25));
  const sway = wave.add(wind.mul(1.2)).mul(wind.add(0.12)).mul(bend).mul(0.1);
  mat.positionNode = positionLocal.add(vec3(sway, 0, sway.mul(0.45)));

  const count = narrow ? 4000 : 9000;
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  const grassCols = ['#647640', '#71803f', '#5a6a35', '#7f7b47'].map(srgb);
  const heatherCols = ['#7a5470', '#6a4660', '#86617a'].map(srgb);
  const blocked = (x, z) => {
    if (Math.hypot(x, z) < 2.1) return true;
    for (const s of solids) if (Math.hypot(x - s.position.x, z - s.position.z) < s.size[0] + 0.5) return true;
    return false;
  };
  let n = 0, tries = 0;
  while (n < count && tries < count * 4) {
    tries++;
    const r = Math.sqrt(rand()) * 58, a = rand() * Math.PI * 2;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (blocked(x, z)) continue;
    const heather = patchAt(x, z) > rand();
    p.set(x, heightAt(x, z) - 0.03, z);
    const k = 0.7 + rand() * 0.7;
    sc.set(k, k * (heather ? 0.75 : 0.8 + rand() * 0.8), k);
    m4.compose(p, q, sc);
    mesh.setMatrixAt(n, m4);
    const list = heather ? heatherCols : grassCols;
    col.copy(list[Math.floor(rand() * list.length)]).multiplyScalar(1.25 + rand() * 0.4);
    mesh.setColorAt(n, col);
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return { mesh, wind };
}

// Wooden crate texture painted on a canvas
export function crateMaterial() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.fillStyle = '#7b5530';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i % 2 ? '#8a6136' : '#734f2c';
    g.fillRect(0, i * 32 + 2, 128, 28);
  }
  g.strokeStyle = '#3d2814';
  g.lineWidth = 6;
  g.strokeRect(3, 3, 122, 122);
  g.beginPath();
  g.moveTo(6, 6);
  g.lineTo(122, 122);
  g.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
}
