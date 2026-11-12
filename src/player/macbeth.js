// Macbeth, built in code to match the cast reference: dark wavy hair and beard,
// blood-red cloak, dark leather and iron armour with gold filigree, sword at the hip.
// A stand-in until Phase 4 brings a rigged CC0 model dressed the same way.
// Animation is procedural: idle breathing, walk, run and jump, with a cloak that flows.
import * as THREE from 'three/webgpu';
import { tileFbm, tileNoise, mulberry32 } from '../world/noise.js';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

function canvasTex(w, h, paint, repeat = 1) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Gold flecks like the worn gilt in the reference art
function flecks(g, w, h, n, seed) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${200 + r() * 40},${150 + r() * 40},${60 + r() * 30},${0.25 + r() * 0.5})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 1.5, 1 + r() * 1.5);
  }
}

function leatherTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = tileFbm((x / w) * 8, (y / h) * 8, 8, 5, 301);
        const l = 0.1 + n * 0.12;
        const i = (y * w + x) * 4;
        img.data[i] = l * 255 * 1.15;
        img.data[i + 1] = l * 255 * 0.92;
        img.data[i + 2] = l * 255 * 0.75;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // stitched panels
    g.strokeStyle = 'rgba(0,0,0,0.6)';
    g.lineWidth = 2;
    for (let x = 32; x < w; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.strokeStyle = 'rgba(190,150,80,0.35)';
    g.setLineDash([3, 4]);
    g.lineWidth = 1;
    for (let x = 36; x < w; x += 64) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
    g.setLineDash([]);
    // gold filigree scrolls
    const r = mulberry32(17);
    g.strokeStyle = 'rgba(205,160,70,0.55)';
    g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) {
      const cx = r() * w, cy = r() * h, rad = 6 + r() * 12;
      g.beginPath();
      g.arc(cx, cy, rad, r() * 6, r() * 6 + 3.5);
      g.stroke();
      g.beginPath();
      g.arc(cx + rad * 1.4, cy, rad * 0.6, r() * 6, r() * 6 + 3);
      g.stroke();
    }
    flecks(g, w, h, 500, 5);
  });
}

function cloakTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const weave = (Math.sin(x * 1.6) * Math.sin(y * 1.6)) * 0.04;
        const n = tileFbm((x / w) * 6, (y / h) * 6, 6, 5, 401);
        const fold = tileNoise((x / w) * 10, (y / h) * 1.5, 10, 403) * 0.12;
        const l = 0.55 + n * 0.35 + weave - fold;
        const i = (y * w + x) * 4;
        img.data[i] = Math.min(255, l * 200);
        img.data[i + 1] = l * 26;
        img.data[i + 2] = l * 24;
        img.data[i + 3] = 255;
      }
    g.putImageData(img, 0, 0);
    // gold border along the hem (bottom of the texture)
    g.fillStyle = 'rgba(176,128,44,0.95)';
    g.fillRect(0, h - 14, w, 10);
    g.strokeStyle = 'rgba(90,60,15,0.9)';
    g.lineWidth = 1;
    for (let x = 0; x < w; x += 8) {
      g.beginPath();
      g.arc(x + 4, h - 9, 3, 0, Math.PI * 2);
      g.stroke();
    }
    flecks(g, w, h, 260, 9);
  });
}

function capsule(r, len, mat, y = 0) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat);
  m.position.y = y;
  m.castShadow = true;
  return m;
}
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function buildMacbeth() {
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: srgb('#b98868'), roughness: 0.62 }),
    hair: new THREE.MeshStandardMaterial({ color: srgb('#15100c'), roughness: 0.85 }),
    leather: new THREE.MeshStandardMaterial({ map: leatherTexture(), roughness: 0.72 }),
    plate: new THREE.MeshStandardMaterial({ color: srgb('#2b2a2f'), metalness: 0.7, roughness: 0.42 }),
    gold: new THREE.MeshStandardMaterial({ color: srgb('#b8892e'), metalness: 0.95, roughness: 0.32 }),
    cloth: new THREE.MeshStandardMaterial({ color: srgb('#2a201b'), roughness: 0.9 }),
    boot: new THREE.MeshStandardMaterial({ color: srgb('#1c140f'), roughness: 0.7 }),
    cloak: new THREE.MeshStandardMaterial({ map: cloakTexture(), roughness: 0.92, side: THREE.DoubleSide }),
    eye: new THREE.MeshStandardMaterial({ color: srgb('#120c08'), roughness: 0.3 }),
  };

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ----- legs (pivot at the hip)
  const HIP_Y = 0.96;
  const legs = [];
  for (const side of [1, -1]) {
    const hip = new THREE.Group();
    hip.position.set(0.1 * side, HIP_Y, 0);
    hip.add(capsule(0.088, 0.3, mats.cloth, -0.2));
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    knee.add(capsule(0.072, 0.28, mats.leather, -0.19));
    const greave = mesh(new THREE.CylinderGeometry(0.082, 0.075, 0.26, 10, 1, true), mats.plate, 0, -0.16, 0.012);
    knee.add(greave);
    const boot = mesh(new THREE.BoxGeometry(0.13, 0.11, 0.27, 2, 1, 2), mats.boot, 0, -0.42, 0.05);
    knee.add(boot);
    knee.add(mesh(new THREE.TorusGeometry(0.075, 0.009, 6, 16).rotateX(Math.PI / 2), mats.gold, 0, -0.04, 0.0));
    hip.add(knee);
    body.add(hip);
    legs.push({ hip, knee, side });
  }

  // ----- torso (pivot at the waist)
  const torso = new THREE.Group();
  torso.position.y = HIP_Y;
  body.add(torso);
  // tunic skirt over the thighs
  const skirt = mesh(new THREE.CylinderGeometry(0.2, 0.27, 0.34, 14, 1, true), mats.leather, 0, -0.14, 0);
  torso.add(skirt);
  torso.add(mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.2, 14), mats.cloth, 0, 0.08, 0));
  const chest = mesh(new THREE.CapsuleGeometry(0.16, 0.2, 6, 14), mats.leather, 0, 0.36, 0);
  chest.scale.set(1.35, 1, 0.82);
  torso.add(chest);
  // breastplate and its gold rim
  const plateGeo = new THREE.SphereGeometry(0.2, 18, 10, -Math.PI / 2, Math.PI, 0.35, 1.5);
  const breast = mesh(plateGeo, mats.plate, 0, 0.36, 0.035);
  breast.scale.set(1.12, 1.05, 0.72);
  torso.add(breast);
  torso.add(mesh(new THREE.TorusGeometry(0.165, 0.012, 6, 24, Math.PI).rotateZ(Math.PI), mats.gold, 0, 0.26, 0.1));
  // belt with buckle
  torso.add(mesh(new THREE.TorusGeometry(0.19, 0.022, 6, 24).rotateX(Math.PI / 2), mats.leather, 0, 0.0, 0));
  torso.add(mesh(new THREE.BoxGeometry(0.07, 0.05, 0.02), mats.gold, 0, 0.0, 0.195));
  // neck and head
  torso.add(capsule(0.058, 0.06, mats.skin, 0.6));
  const head = new THREE.Group();
  head.position.y = 0.73;
  torso.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.112, 20, 16), mats.skin);
  skull.scale.set(0.92, 1.08, 1.0);
  head.add(skull);
  const hair = mesh(new THREE.SphereGeometry(0.122, 20, 14, 0, Math.PI * 2, 0, 1.75), mats.hair, 0, 0.02, -0.012);
  hair.scale.set(0.98, 1.05, 1.08);
  hair.rotation.x = -0.35;
  head.add(hair);
  const nape = mesh(new THREE.SphereGeometry(0.1, 14, 10), mats.hair, 0, -0.05, -0.06);
  nape.scale.set(1.0, 0.9, 0.7);
  head.add(nape);
  const beard = mesh(new THREE.SphereGeometry(0.1, 16, 12, 0, Math.PI * 2, 1.8, 1.3), mats.hair, 0, 0.0, 0.02);
  beard.scale.set(0.95, 1.05, 1.05);
  head.add(beard);
  head.add(mesh(new THREE.ConeGeometry(0.018, 0.05, 6).rotateX(Math.PI / 2 + 0.3), mats.skin, 0, 0.0, 0.112));
  for (const s of [1, -1]) {
    head.add(mesh(new THREE.SphereGeometry(0.013, 8, 6), mats.eye, 0.038 * s, 0.022, 0.098));
    head.add(mesh(new THREE.BoxGeometry(0.045, 0.012, 0.02).rotateZ(0.18 * s), mats.hair, 0.04 * s, 0.045, 0.1));
  }

  // ----- arms (pivot at the shoulder)
  const arms = [];
  for (const side of [1, -1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.255 * side, 0.52, 0);
    shoulder.add(capsule(0.062, 0.2, mats.leather, -0.15));
    const pauldron = mesh(new THREE.SphereGeometry(0.105, 14, 10, 0, Math.PI * 2, 0, 1.45), mats.plate, 0.012 * side, 0.0, 0);
    pauldron.scale.set(1.1, 0.85, 1.15);
    pauldron.rotation.z = -0.35 * side;
    shoulder.add(pauldron);
    shoulder.add(mesh(new THREE.TorusGeometry(0.1, 0.009, 6, 18).rotateX(Math.PI / 2).rotateZ(-0.35 * side), mats.gold, 0.035 * side, -0.035, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.31;
    elbow.add(capsule(0.052, 0.18, mats.cloth, -0.12));
    elbow.add(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.15, 10), mats.plate, 0, -0.14, 0));
    elbow.add(mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 14).rotateX(Math.PI / 2), mats.gold, 0, -0.07, 0));
    const hand = mesh(new THREE.SphereGeometry(0.048, 10, 8), mats.leather, 0, -0.27, 0.01);
    hand.scale.set(0.85, 1.1, 0.8);
    elbow.add(hand);
    shoulder.add(elbow);
    torso.add(shoulder);
    arms.push({ shoulder, elbow, side });
  }

  // ----- sword in its scabbard on the left hip
  const sword = new THREE.Group();
  sword.position.set(0.22, -0.02, 0.02);
  sword.rotation.set(0.25, 0, 0.12);
  sword.add(mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.82, 8), mats.leather, 0, -0.44, 0));
  sword.add(mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), mats.gold, 0, -0.84, 0));
  sword.add(mesh(new THREE.BoxGeometry(0.17, 0.022, 0.03), mats.gold, 0, -0.02, 0));
  sword.add(mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.12, 8), mats.leather, 0, 0.06, 0));
  sword.add(mesh(new THREE.SphereGeometry(0.024, 8, 6), mats.gold, 0, 0.13, 0));
  torso.add(sword);

  // ----- the cloak: an open cone hung from the shoulders, deformed each frame
  const CLOAK_H = 1.22;
  const cloakGeo = new THREE.CylinderGeometry(0.3, 0.4, CLOAK_H, 18, 12, true, Math.PI / 2 - 0.45, Math.PI + 0.9);
  cloakGeo.scale(1.08, 1, 0.72);
  const cloak = new THREE.Mesh(cloakGeo, mats.cloak);
  cloak.position.set(0, 0.56 - CLOAK_H / 2, -0.02);
  cloak.castShadow = true;
  torso.add(cloak);
  const base = Float32Array.from(cloakGeo.attributes.position.array);
  // heavy fold at the collar
  torso.add(mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20, Math.PI * 1.3).rotateX(Math.PI / 2).rotateZ(Math.PI * 0.85), mats.cloak, 0, 0.56, -0.01));
  torso.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 12).rotateX(Math.PI / 2), mats.gold, 0.17, 0.53, 0.1));

  root.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });

  // ----- animation
  let phase = 0, t = 0;
  const s = { move: 0, run: 0, air: 0, flow: 0 };
  const lerp = (a, b, k) => a + (b - a) * k;

  function update(dt, st) {
    t += dt;
    const k = Math.min(1, dt * 8);
    const moving = Math.min(1, st.speed / 1.2);
    const running = Math.min(1, Math.max(0, (st.speed - 1.6) / 1.6));
    s.move = lerp(s.move, moving, k);
    s.run = lerp(s.run, running, k);
    s.air = lerp(s.air, st.grounded ? 0 : 1, Math.min(1, dt * 10));
    const stride = lerp(1.35, 2.2, s.run);
    phase += (st.speed / stride) * Math.PI * 2 * dt;

    const legSwing = lerp(0.5, 0.85, s.run) * s.move;
    const armSwing = lerp(0.42, 0.75, s.run) * s.move;
    for (const L of legs) {
      const ph = phase + (L.side > 0 ? 0 : Math.PI);
      const walkHip = -Math.sin(ph) * legSwing;
      const walkKnee = 0.06 + Math.max(0, Math.cos(ph)) * legSwing * 1.5;
      const airHip = L.side > 0 ? -0.75 : 0.15;
      const airKnee = L.side > 0 ? 1.1 : 0.45;
      L.hip.rotation.x = lerp(walkHip, airHip, s.air);
      L.knee.rotation.x = lerp(walkKnee, airKnee, s.air);
    }
    for (const A of arms) {
      const ph = phase + (A.side > 0 ? 0 : Math.PI);
      const swing = Math.sin(ph) * armSwing;
      const idle = Math.sin(t * 1.3 + A.side) * 0.02;
      A.shoulder.rotation.x = lerp(swing + idle, -0.35, s.air);
      A.shoulder.rotation.z = lerp(0.09 + s.run * 0.05, 0.55, s.air) * A.side;
      A.elbow.rotation.x = lerp(-0.18 - s.run * 1.0 - Math.max(0, -Math.sin(ph)) * 0.3 * s.move, -0.6, s.air);
    }
    const breathe = Math.sin(t * 1.6) * 0.012 * (1 - s.move);
    body.position.y = Math.abs(Math.sin(phase)) * lerp(0.03, 0.065, s.run) * s.move * (1 - s.air) + breathe;
    torso.rotation.x = 0.04 + s.move * 0.05 + s.run * 0.14 + breathe;
    torso.rotation.y = Math.sin(phase) * 0.09 * s.move;
    chest.scale.y = 1 + breathe * 2;
    head.rotation.x = -torso.rotation.x * 0.6;
    head.rotation.y = Math.sin(t * 0.37) * 0.15 * (1 - s.move);

    // cloak streams back with speed, lifts in the air, ripples in the wind
    const flowTarget = Math.min(1.2, st.speed / 3.4 + s.air * 0.6 + (st.wind || 0) * 0.25);
    s.flow = lerp(s.flow, flowTarget, Math.min(1, dt * 3));
    const pos = cloakGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const d = Math.min(1, Math.max(0, (CLOAK_H / 2 - by) / CLOAK_H)); // 0 at the collar, 1 at the hem
      const back = bz < 0 ? 1 : 0.35;
      const ripple = Math.sin(t * 3.1 + d * 4 + bx * 6) * 0.025 * d * (0.4 + s.flow);
      const stream = s.flow * d ** 1.4 * 0.55 * back;
      const swing = Math.sin(phase * 0.5) * 0.04 * d * s.move;
      pos.setXYZ(i, bx + ripple + swing, by + stream * 0.45 * d, bz - stream + ripple * 0.5);
    }
    pos.needsUpdate = true;
    cloakGeo.computeVertexNormals();
  }

  return { root, update, height: 1.82 };
}
