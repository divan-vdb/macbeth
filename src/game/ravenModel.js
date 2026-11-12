// A common raven, built in code: a smooth lofted body and head covered in
// small scalloped feathers, a heavy arched beak, shaggy throat hackles, and
// articulated wings made of individual flight feathers (fingered primaries,
// secondaries, coverts) over a long wedge-shaped tail. Black plumage with the
// blue-violet sheen ravens have in low light. Facing +z, about 0.6 m long.
//
// setPose({ elev, fold, fan, tail, legs, headYaw, headPitch }) drives it:
//   elev  wing elevation (radians, + up)      fold  0 spread .. 1 folded on the back
//   fan   primaries spread 0..1               tail  tail spread 0..1
//   legs  0 tucked .. 1 down                  headYaw/headPitch  look about
import * as THREE from 'three/webgpu';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
let shared = null;

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return [cv, cv.getContext('2d')];
}

// Small contour feathers in overlapping scalloped rows, with a height map for relief
function plumageTextures() {
  const N = 256;
  const [cv, g] = canvas(N, N);
  const h = new Float32Array(N * N);
  const img = g.createImageData(N, N);
  const rows = 8, cols = 6;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const v = (y / N) * rows, row = Math.floor(v), fv = v - row;
      const u = (x / N) * cols + (row % 2) * 0.5, fu = u - Math.floor(u);
      // each feather: a rounded tip pointing back along the body (down the texture)
      const dx = (fu - 0.5) * 2, dy = fv;
      const r = Math.hypot(dx * 0.9, (dy - 0.15) * 1.05);
      const inside = Math.max(0, 1 - r);
      const edge = Math.min(1, Math.abs(r - 0.92) * 12);
      const barbs = 0.5 + 0.5 * Math.sin((dx * 3 + dy * 9) * 6);
      const hh = inside * 0.8 + barbs * 0.06;
      h[y * N + x] = hh;
      const l = 10 + inside * 16 + barbs * 6 - (1 - edge) * 6;
      const i = (y * N + x) * 4;
      img.data[i] = l * 0.9;
      img.data[i + 1] = l * 0.92;
      img.data[i + 2] = l * 1.08;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // normal map from the heights
  const [ncv, ng] = canvas(N, N);
  const nimg = ng.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const hx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)];
      const hy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -hx * 3, ny = -hy * 3, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * N + x) * 4;
      nimg.data[i] = (nx / l * 0.5 + 0.5) * 255;
      nimg.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      nimg.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      nimg.data[i + 3] = 255;
    }
  ng.putImageData(nimg, 0, 0);
  const map = new THREE.CanvasTexture(cv), normalMap = new THREE.CanvasTexture(ncv);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, normalMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, normalMap };
}

// One flight feather: a quill, a stiff shaft and soft vanes with fine barbs and a
// few splits; the leading vane narrows toward the tip (the "fingers" of a raven's wing).
function featherTexture() {
  const W = 64, H = 256;
  const [cv, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const splits = [0.33, 0.52, 0.71, 0.8];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const v = 1 - y / (H - 1); // 0 base .. 1 tip
      const u = (x / (W - 1)) * 2 - 1; // -1 leading .. 1 trailing
      const base = Math.min(1, v / 0.12);
      const tip = v > 0.86 ? Math.sqrt(Math.max(0, 1 - ((v - 0.86) / 0.14) ** 2)) : 1;
      const lead = 0.55 * base * tip * (v > 0.55 ? 1 - (v - 0.55) * 0.9 : 1); // emarginated
      const trail = 0.95 * base * tip;
      const inVane = u < 0 ? -u < lead : u < trail;
      const shaft = Math.abs(u) < 0.06 && v < 0.97;
      let a = inVane || shaft ? 1 : 0;
      // a few splits in the vane, angled toward the tip
      for (const s of splits) if (Math.abs(v - s - Math.abs(u) * 0.08) < 0.006 && Math.abs(u) > 0.3) a = 0;
      const barb = 0.5 + 0.5 * Math.sin((v * 140 - Math.abs(u) * 18));
      let l = shaft ? 46 : 14 + barb * 9 + (1 - Math.abs(u)) * 6;
      const i = (y * W + x) * 4;
      img.data[i] = l * 0.92;
      img.data[i + 1] = l * 0.95;
      img.data[i + 2] = l * 1.1;
      img.data[i + 3] = a * 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function materials() {
  if (shared) return shared;
  const plume = plumageTextures();
  const sheen = { sheen: 0.25, sheenColor: srgb('#28326e'), sheenRoughness: 0.6, iridescence: 0.18, iridescenceIOR: 1.3, iridescenceThicknessRange: [300, 380] };
  const body = new THREE.MeshPhysicalMaterial({ map: plume.map, normalMap: plume.normalMap, roughness: 0.42, metalness: 0.05, ...sheen });
  body.normalScale.set(0.9, 0.9);
  const head = body.clone();
  head.map = plume.map.clone();
  head.normalMap = plume.normalMap.clone();
  head.map.repeat.set(5, 4);
  head.normalMap.repeat.set(5, 4);
  body.map.repeat.set(4, 6);
  body.normalMap.repeat.set(4, 6);
  // flight feathers: satin rather than glossy, so thin cards never flash white edge-on
  const feather = new THREE.MeshPhysicalMaterial({ map: featherTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.0, iridescence: 0.12, iridescenceIOR: 1.3, iridescenceThicknessRange: [300, 380] });
  const beak = new THREE.MeshStandardMaterial({ color: srgb('#121214'), roughness: 0.32, metalness: 0.2 });
  const eye = new THREE.MeshStandardMaterial({ color: srgb('#1a0f08'), roughness: 0.05, metalness: 0.3 });
  const leg = new THREE.MeshStandardMaterial({ color: srgb('#141416'), roughness: 0.55, metalness: 0.1 });
  shared = { body, head, feather, beak, eye, leg };
  return shared;
}

// A tube through cross-sections {z, y, rx, ry, low} (low: extra depth below the centre line)
function loft(stations, segs = 18) {
  const pos = [], uv = [], idx = [];
  const n = stations.length;
  stations.forEach((s, i) => {
    for (let j = 0; j <= segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      const sy = Math.sin(a);
      const ry = sy < 0 ? s.ry * (s.low || 1) : s.ry;
      pos.push(Math.cos(a) * s.rx, s.y + sy * ry, s.z);
      uv.push(j / segs, i / (n - 1));
    }
  });
  for (let i = 0; i < n - 1; i++)
    for (let j = 0; j < segs; j++) {
      const a = i * (segs + 1) + j, b = a + segs + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const featherGeo = new Map();
function feather(width, length) {
  const key = `${width}|${length}`;
  if (!featherGeo.has(key)) featherGeo.set(key, new THREE.PlaneGeometry(width, length).rotateX(-Math.PI / 2).translate(0, 0, -length / 2));
  return new THREE.Mesh(featherGeo.get(key), materials().feather);
}

export function createRavenModel() {
  const M = materials();
  const bird = new THREE.Group();
  const posed = new THREE.Group(); // pitches the whole bird (perching stance)
  bird.add(posed);

  // body, from the base of the tail to the neck
  const body = new THREE.Mesh(loft([
    { z: -0.17, y: 0.004, rx: 0.004, ry: 0.004 },
    { z: -0.16, y: 0.004, rx: 0.024, ry: 0.018 },
    { z: -0.12, y: 0.0, rx: 0.045, ry: 0.038, low: 1.1 },
    { z: -0.06, y: -0.006, rx: 0.062, ry: 0.056, low: 1.15 },
    { z: 0.0, y: -0.008, rx: 0.068, ry: 0.064, low: 1.2 },
    { z: 0.055, y: 0.002, rx: 0.062, ry: 0.062, low: 1.22 },
    { z: 0.1, y: 0.026, rx: 0.046, ry: 0.052, low: 1.25 },
    { z: 0.135, y: 0.05, rx: 0.037, ry: 0.043, low: 1.2 },
  ]), M.body);
  posed.add(body);

  // shaggy throat hackles, a raven's mark
  for (let i = 0; i < 7; i++) {
    const f = feather(0.022, 0.05 + (i % 3) * 0.008);
    f.position.set((i - 3) * 0.008, 0.0 - Math.abs(i - 3) * 0.003, 0.12 - Math.abs(i - 3) * 0.004);
    f.rotation.set(1.2 + (i % 2) * 0.15, (i - 3) * 0.12, 0);
    posed.add(f);
  }

  // head, pivoting at the neck
  const neck = new THREE.Group();
  neck.position.set(0, 0.05, 0.13);
  posed.add(neck);
  const head = new THREE.Mesh(loft([
    { z: -0.01, y: 0.0, rx: 0.036, ry: 0.042 },
    { z: 0.02, y: 0.014, rx: 0.038, ry: 0.04 },
    { z: 0.05, y: 0.018, rx: 0.037, ry: 0.038 },
    { z: 0.075, y: 0.013, rx: 0.03, ry: 0.031 },
    { z: 0.092, y: 0.008, rx: 0.022, ry: 0.027 },
    { z: 0.096, y: 0.008, rx: 0.004, ry: 0.004 },
  ]), M.head);
  neck.add(head);
  // the heavy, arched beak
  const beak = new THREE.Mesh(loft([
    { z: 0.086, y: 0.008, rx: 0.017, ry: 0.024 },
    { z: 0.11, y: 0.004, rx: 0.014, ry: 0.02 },
    { z: 0.135, y: -0.003, rx: 0.01, ry: 0.014 },
    { z: 0.155, y: -0.012, rx: 0.006, ry: 0.008 },
    { z: 0.166, y: -0.021, rx: 0.002, ry: 0.003 },
    { z: 0.168, y: -0.026, rx: 0.0005, ry: 0.0005 },
  ], 12), M.beak);
  neck.add(beak);
  // bristly nasal feathers lying over the base of the beak
  for (const s of [-1, 1]) {
    const f = feather(0.018, 0.035);
    f.position.set(s * 0.009, 0.028, 0.072);
    f.rotation.set(-Math.PI + 0.25, s * 0.25, 0);
    neck.add(f);
  }
  // where something carried in the beak is held
  const mouth = new THREE.Group();
  mouth.position.set(0, -0.012, 0.125);
  neck.add(mouth);
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 10, 8), M.eye);
    eye.position.set(s * 0.032, 0.026, 0.05);
    neck.add(eye);
  }

  // wings: shoulder -> arm -> elbow -> forearm -> wrist -> hand, feathers on each
  const wings = [];
  for (const s of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(s * 0.042, 0.04, 0.045);
    shoulder.rotation.order = 'ZYX';
    const elbow = new THREE.Group();
    elbow.position.set(s * 0.075, 0, -0.012);
    const wrist = new THREE.Group();
    wrist.position.set(s * 0.11, 0, 0.008);
    shoulder.add(elbow);
    elbow.add(wrist);
    posed.add(shoulder);
    // tertials and secondaries along the arm and forearm
    const sec = [];
    for (let i = 0; i < 4; i++) {
      const f = feather(0.048, 0.13);
      f.position.set(s * (0.01 + i * 0.016), -0.002 - i * 0.0004, 0);
      f.rotation.y = -s * 0.06;
      shoulder.add(f);
      sec.push({ f, base: -s * 0.08, fold: -s * 1.15 });
    }
    for (let i = 0; i < 10; i++) {
      const f = feather(0.05, 0.155 - i * 0.002);
      f.position.set(s * (0.006 + i * 0.0108), 0.0005 * i, 0.002);
      elbow.add(f);
      sec.push({ f, base: -s * 0.02 * i, fold: s * 1.4 });
    }
    // primaries off the hand, fanning out to the "fingers"
    const prim = [];
    const lens = [0.19, 0.205, 0.22, 0.235, 0.245, 0.255, 0.262, 0.26, 0.245, 0.21];
    for (let i = 0; i < 10; i++) {
      const f = feather(0.042, lens[i]);
      f.position.set(s * (0.004 + i * 0.009), 0.001 * i, 0.004);
      wrist.add(f);
      prim.push({ f, i });
    }
    // coverts laid over the bases of the flight feathers
    for (let i = 0; i < 9; i++) {
      const f = feather(0.04, 0.07);
      f.position.set(s * (0.008 + i * 0.012), 0.006, 0.006);
      elbow.add(f);
      sec.push({ f, base: -s * 0.03 * i, fold: s * 1.4 });
    }
    for (let i = 0; i < 6; i++) {
      const f = feather(0.035, 0.065);
      f.position.set(s * (0.006 + i * 0.012), 0.006, 0.008);
      wrist.add(f);
      sec.push({ f, base: -s * (0.15 + i * 0.12), fold: -s * 1.45 });
    }
    for (let i = 0; i < 5; i++) {
      const f = feather(0.04, 0.05);
      f.position.set(s * (0.01 + i * 0.014), 0.008, 0.012);
      shoulder.add(f);
      sec.push({ f, base: -s * 0.05, fold: -s * 1.15 });
    }
    wings.push({ s, shoulder, elbow, wrist, sec, prim });
  }

  // a long wedge-shaped tail of twelve feathers
  const tailRoot = new THREE.Group();
  tailRoot.position.set(0, 0.008, -0.15);
  posed.add(tailRoot);
  const tail = [];
  for (let i = 0; i < 12; i++) {
    const k = (i - 5.5) / 5.5; // -1..1
    const f = feather(0.046, 0.235 - Math.abs(k) * 0.05);
    f.position.set(k * 0.012, 0.001 * (6 - Math.abs(i - 5.5)), 0);
    tailRoot.add(f);
    tail.push({ f, k });
  }
  for (let i = 0; i < 5; i++) {
    const f = feather(0.04, 0.08);
    f.position.set((i - 2) * 0.012, 0.012, 0.03);
    tailRoot.add(f);
  }

  // legs: scaly black tarsi, three toes forward and one back, curved claws
  const legs = new THREE.Group();
  const tarsus = new THREE.CylinderGeometry(0.006, 0.007, 0.07, 6).translate(0, -0.035, 0);
  const toe = new THREE.CylinderGeometry(0.0035, 0.004, 1, 5).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  const claw = new THREE.ConeGeometry(0.003, 0.012, 5).rotateX(Math.PI / 2 + 0.5);
  for (const s of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(s * 0.026, -0.05, 0.015);
    leg.add(new THREE.Mesh(tarsus, M.leg));
    for (const [a, len] of [[-0.4, 0.04], [0, 0.048], [0.4, 0.04], [Math.PI, 0.032]]) {
      const t = new THREE.Mesh(toe, M.leg);
      t.scale.set(1, 1, len);
      t.position.y = -0.07;
      t.rotation.y = a;
      const c = new THREE.Mesh(claw, M.leg);
      c.position.set(Math.sin(a) * len, -0.072, Math.cos(a) * len);
      c.rotation.y = a;
      leg.add(t, c);
    }
    legs.add(leg);
  }
  posed.add(legs);

  bird.traverse((m) => m.isMesh && (m.castShadow = true));

  const lerp = THREE.MathUtils.lerp;
  function setPose({ elev = 0, fold = 0, fan = 1, tail: spread = 0.2, legs: down = 0, headYaw = 0, headPitch = 0, pitch = 0 } = {}) {
    for (const w of wings) {
      const s = w.s;
      // folded: the arm sweeps back, the forearm forward, the hand back along the body
      w.shoulder.rotation.set(0, s * lerp(0.05, 1.15, fold), s * lerp(elev, -0.15, fold));
      w.elbow.rotation.y = -s * lerp(0, 2.55, fold);
      w.wrist.rotation.y = s * lerp(0, 2.85, fold);
      const f = Math.max(0, fan) * (1 - fold);
      for (const p of w.prim) p.f.rotation.y = lerp(-s * ((p.i / 9) * lerp(0.1, 1.35, f) - 0.04), -s * (1.45 - p.i * 0.012), fold);
      for (const q of w.sec) q.f.rotation.y = lerp(q.base, q.fold, fold);
    }
    for (const t of tail) t.f.rotation.y = -t.k * lerp(0.08, 0.62, spread);
    tailRoot.rotation.x = lerp(0.04, -0.15, spread);
    legs.visible = down > 0.05;
    legs.scale.y = Math.max(0.05, down);
    neck.rotation.set(headPitch, headYaw, 0);
    posed.rotation.x = pitch;
  }
  setPose();
  return { bird, setPose, mouth };
}
