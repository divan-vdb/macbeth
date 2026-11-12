// Night sky: gradient dome, stars of many sizes and brightnesses with a gentle
// twinkle, the Milky Way, a moon with a halo, drifting clouds and far hills.
import * as THREE from 'three/webgpu';
import { glowTexture, starTexture, moonTexture, cloudTexture, milkyTexture } from './textures.js';
import { fbm, mulberry32, smoothstep } from './noise.js';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
const R = 380;

// Quads that face the centre of the dome (the camera is always near it)
function facingQuad(p, size, rotation = 0) {
  const n = p.clone().normalize();
  const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  let t1 = new THREE.Vector3().crossVectors(up, n).normalize();
  let t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
  if (rotation) {
    const c = Math.cos(rotation), s = Math.sin(rotation);
    const a = t1.clone().multiplyScalar(c).addScaledVector(t2, s);
    const b = t2.clone().multiplyScalar(c).addScaledVector(t1, -s);
    t1 = a;
    t2 = b;
  }
  const sx = Array.isArray(size) ? size[0] : size, sy = Array.isArray(size) ? size[1] : size;
  return [
    p.clone().addScaledVector(t1, -sx).addScaledVector(t2, -sy),
    p.clone().addScaledVector(t1, sx).addScaledVector(t2, -sy),
    p.clone().addScaledVector(t1, sx).addScaledVector(t2, sy),
    p.clone().addScaledVector(t1, -sx).addScaledVector(t2, sy),
  ];
}

function quadMesh(items, map, opacityScale = 1) {
  const pos = new Float32Array(items.length * 12);
  const col = new Float32Array(items.length * 12);
  const uvs = new Float32Array(items.length * 8);
  const idx = new Uint32Array(items.length * 6);
  items.forEach((it, i) => {
    it.corners.forEach((v, k) => {
      pos.set([v.x, v.y, v.z], i * 12 + k * 3);
      col.set([it.color.r * opacityScale, it.color.g * opacityScale, it.color.b * opacityScale], i * 12 + k * 3);
    });
    uvs.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
    const b = i * 4;
    idx.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const mat = new THREE.MeshBasicMaterial({ map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return mesh;
}

export function buildSky(moonDir, narrow) {
  const group = new THREE.Group();
  const rand = mulberry32(42);

  // Dome: deep zenith, hazy horizon, a little brighter around the moon
  const domeGeo = new THREE.SphereGeometry(R + 10, 48, 24);
  const dp = domeGeo.attributes.position;
  const dc = new Float32Array(dp.count * 3);
  const horizon = srgb('#33405a'), zenith = srgb('#04070e'), moonGlow = srgb('#3d4c66');
  const c = new THREE.Color(), v = new THREE.Vector3();
  for (let i = 0; i < dp.count; i++) {
    v.fromBufferAttribute(dp, i).normalize();
    c.copy(horizon).lerp(zenith, smoothstep(-0.02, 0.55, v.y));
    c.lerp(moonGlow, Math.max(0, v.dot(moonDir)) ** 12 * 0.8);
    dc.set([c.r, c.g, c.b], i * 3);
  }
  domeGeo.setAttribute('color', new THREE.BufferAttribute(dc, 3));
  const dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.renderOrder = -10;
  group.add(dome);

  // Milky Way plane, tilted across the sky
  const galaxyNormal = new THREE.Vector3(0.35, 0.55, 0.76).normalize();
  const gA = new THREE.Vector3().crossVectors(galaxyNormal, new THREE.Vector3(0, 1, 0)).normalize();
  const gB = new THREE.Vector3().crossVectors(galaxyNormal, gA).normalize();

  // Stars: thousands of faint pin-pricks, fewer brighter ones, a handful of
  // bright stars; crisp points with a faint skirt of light, not glowing orbs.
  // Colours run from blue-white through white to pale gold and the odd orange giant.
  const starCount = narrow ? 2800 : 4600;
  const tints = [srgb('#d4e0ff'), srgb('#e8eeff'), srgb('#ffffff'), srgb('#ffffff'), srgb('#ffffff'), srgb('#fff7ee')];
  const stars = [];
  const twinkle = [];
  for (let i = 0; i < starCount; i++) {
    let p;
    if (rand() < 0.45) {
      const ang = rand() * Math.PI * 2, spread = (rand() + rand() + rand() - 1.5) * 0.22;
      p = gA.clone().multiplyScalar(Math.cos(ang)).addScaledVector(gB, Math.sin(ang)).addScaledVector(galaxyNormal, spread).normalize();
    } else {
      const u = rand() * 2 - 1, ang = rand() * Math.PI * 2;
      p = new THREE.Vector3(Math.sqrt(1 - u * u) * Math.cos(ang), Math.abs(u), Math.sqrt(1 - u * u) * Math.sin(ang));
    }
    if (p.y < 0.03) continue;
    const mag = rand() ** 10; // brightness: almost all faint
    const size = 0.75 + mag * 1.5 + rand() * 0.2;
    const fade = smoothstep(0.02, 0.25, p.y); // dimmed by the thick air near the horizon
    const bright = (0.18 + rand() * 0.26 + mag * 1.25) * fade;
    let tint = tints[Math.floor(rand() * tints.length)];
    if (mag > 0.45 && rand() < 0.2) tint = srgb('#ffd6a8'); // the odd orange giant
    const color = tint.clone().multiplyScalar(bright);
    stars.push({ corners: facingQuad(p.multiplyScalar(R), size), color });
    if (rand() < 0.3 + mag) twinkle.push({ i: stars.length - 1, base: color.clone(), f: 1.5 + rand() * 4, ph: rand() * 10 });
  }
  const starMesh = quadMesh(stars, starTexture(64));
  starMesh.renderOrder = -8;
  group.add(starMesh);

  // Milky Way haze: soft overlapping streaks along the band
  const haze = [];
  // many soft, overlapping patches scattered across the band, so it has no edges
  for (let i = 0; i < 64; i++) {
    const ang = (i / 64) * Math.PI * 2 + rand() * 0.25;
    const off = (rand() + rand() - 1) * 0.12;
    const p = gA.clone().multiplyScalar(Math.cos(ang)).addScaledVector(gB, Math.sin(ang)).addScaledVector(galaxyNormal, off).normalize();
    if (p.y < 0.0) continue;
    const tangent = gA.clone().multiplyScalar(-Math.sin(ang)).addScaledVector(gB, Math.cos(ang));
    const n = p.clone();
    const up = Math.abs(n.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const t1 = new THREE.Vector3().crossVectors(up, n).normalize();
    const t2 = new THREE.Vector3().crossVectors(n, t1).normalize();
    const rot = Math.atan2(tangent.dot(t2), tangent.dot(t1)) + (rand() - 0.5) * 0.5;
    const strength = (0.012 + rand() * 0.016) * smoothstep(0.0, 0.35, p.y) * (1 - Math.abs(off) * 3);
    haze.push({ corners: facingQuad(p.multiplyScalar(R - 5), [45 + rand() * 45, 22 + rand() * 22], rot), color: new THREE.Color(0.82, 0.86, 1).multiplyScalar(strength) });
  }
  const hazeMesh = quadMesh(haze, milkyTexture());
  hazeMesh.renderOrder = -9;
  group.add(hazeMesh);

  // Moon and halo, placed where the moonlight comes from
  const moonPos = moonDir.clone().multiplyScalar(R - 30);
  const moon = new THREE.Mesh(new THREE.SphereGeometry(7, 32, 16), new THREE.MeshBasicMaterial({ map: moonTexture(), fog: false }));
  moon.position.copy(moonPos);
  moon.renderOrder = -7;
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: glowTexture(128, 0.05), color: srgb('#8fa4c8'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.55 })
  );
  halo.scale.setScalar(110);
  halo.position.copy(moonPos.clone().multiplyScalar(1.01));
  halo.lookAt(0, 0, 0);
  halo.renderOrder = -6;
  group.add(moon, halo);

  // Cloud layer: drifts slowly, lights up when lightning strikes
  const cloudMat = new THREE.MeshBasicMaterial({ map: cloudTexture(), color: srgb('#2a3346'), transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), cloudMat);
  clouds.rotation.x = Math.PI / 2;
  clouds.position.y = 240;
  clouds.renderOrder = -5;
  group.add(clouds);
  const cloudBase = cloudMat.color.clone();

  // Two rings of far hills, the farther one hazier, for depth on the horizon
  const ridge = (radius, minH, maxH, seed, col) => {
    const segs = 160;
    const pos = new Float32Array((segs + 1) * 6);
    const cols = new Float32Array((segs + 1) * 6);
    const idx = [];
    const low = col.clone().lerp(horizon, 0.5);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const x = Math.cos(a) * radius, z = Math.sin(a) * radius;
      const h = minH + (maxH - minH) * fbm(Math.cos(a) * 3 + seed, Math.sin(a) * 3 - seed, 5) ** 1.6 * 1.4;
      pos.set([x, -15, z, x, h, z], i * 6);
      cols.set([low.r, low.g, low.b, col.r, col.g, col.b], i * 6);
      if (i < segs) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.renderOrder = -4;
    return m;
  };
  group.add(ridge(360, 10, 60, 5.1, srgb('#1e2737')), ridge(300, 4, 34, 9.7, srgb('#141b26')));

  // Twinkle and drift
  const colAttr = starMesh.geometry.attributes.color;
  let t = 0, frame = 0;
  const update = (dt, flash) => {
    t += dt;
    clouds.rotation.z += dt * 0.004;
    cloudMat.color.copy(cloudBase).multiplyScalar(1 + flash * 5);
    if (frame++ % 2) return;
    for (const tw of twinkle) {
      const k = 0.85 + Math.sin(t * tw.f + tw.ph) * 0.1 + Math.sin(t * tw.f * 2.7 + tw.ph) * 0.06;
      for (let j = 0; j < 4; j++) colAttr.setXYZ(tw.i * 4 + j, tw.base.r * k, tw.base.g * k, tw.base.b * k);
    }
    colAttr.needsUpdate = true;
  };
  return { group, update, horizon };
}
