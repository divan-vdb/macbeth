// Cloth that moves like cloth: a grid of particles (Verlet integration) pinned
// along its top edge to a bone (shoulders for a cape, the waist for a gown).
// Gravity, gusting wind and the character's own motion move it; distance
// constraints keep it woven together; capsules around the torso and legs keep
// it outside the body, so it drapes over the back and swings around the legs.
// A weak pull toward its resting shape stops it collapsing into a rope.
import * as THREE from 'three/webgpu';

const G = -9.8;
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpP = new THREE.Vector3();

export function createCloth({
  bone, // the bone the top edge is pinned to
  anchors, // model-space rest positions of the top edge (one per column)
  length, // how far it hangs
  rows = 14,
  loop = false, // true for a skirt (columns wrap around)
  widen = 1.3, // how much wider the hem is than the top edge
  restOut = 0.0, // outward flare of the resting shape at the hem (gown)
  restBack = 0.0, // backward offset of the resting shape at the hem (cape)
  shape = 0.02, // strength of the pull toward the resting shape
  yoke = 0.0, // extra hold on the top few rows, so a cape sits on the shoulders like a mantle
  material,
  innerMaterial = null,
  colliders, // () => [{ a: Vector3, b: Vector3, r }] in world space
  ground, // (x, z) => y
  model, // the character's root Group (model space)
}) {
  const cols = anchors.length;
  const N = cols * rows;
  const pos = new Float32Array(N * 3), prev = new Float32Array(N * 3);
  const restLocal = new Float32Array(N * 3); // rest shape in bone space
  const anchorLocal = []; // top edge in bone space

  // Rest shape in model space, then into the bone's space (rest pose).
  model.updateMatrixWorld(true);
  const boneInv = bone.matrixWorld.clone().invert();
  const modelM = model.matrixWorld;
  const centre = anchors.reduce((s, a) => s.add(a), new THREE.Vector3()).multiplyScalar(1 / cols);
  for (let r = 0; r < rows; r++) {
    const k = r / (rows - 1);
    for (let c = 0; c < cols; c++) {
      const a = anchors[c];
      const out = tmpA.set(a.x - centre.x, 0, a.z - centre.z);
      const len = out.length() || 1;
      out.multiplyScalar(1 / len);
      const p = new THREE.Vector3(
        a.x + out.x * (len * (widen - 1) * k + restOut * k * k),
        a.y - length * k,
        a.z + out.z * (len * (widen - 1) * k + restOut * k * k) - restBack * k * k
      );
      const w = p.clone().applyMatrix4(modelM);
      const i = (r * cols + c) * 3;
      pos[i] = prev[i] = w.x;
      pos[i + 1] = prev[i + 1] = w.y;
      pos[i + 2] = prev[i + 2] = w.z;
      const l = w.clone().applyMatrix4(boneInv);
      restLocal.set([l.x, l.y, l.z], i);
      if (r === 0) anchorLocal.push(l);
    }
  }

  // Constraints: structural, shear and bending, with rest lengths from the rest shape.
  const cons = [];
  const idx = (r, c) => r * cols + (loop ? (c + cols) % cols : c);
  const dist = (i, j) => Math.hypot(pos[i * 3] - pos[j * 3], pos[i * 3 + 1] - pos[j * 3 + 1], pos[i * 3 + 2] - pos[j * 3 + 2]);
  const add = (i, j, stiff = 1) => cons.push([i, j, dist(i, j), stiff]);
  const cmax = loop ? cols : cols - 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cmax; c++) add(idx(r, c), idx(r, c + 1));
    if (r < rows - 1) for (let c = 0; c < cols; c++) add(idx(r, c), idx(r + 1, c));
    if (r < rows - 1)
      for (let c = 0; c < cmax; c++) {
        add(idx(r, c), idx(r + 1, c + 1), 0.6);
        add(idx(r, c + 1), idx(r + 1, c), 0.6);
      }
    if (r < rows - 2) for (let c = 0; c < cols; c++) add(idx(r, c), idx(r + 2, c), 0.35);
  }

  // Render mesh (positions are written in the character's local space each frame)
  const geo = new THREE.BufferGeometry();
  const vtx = new Float32Array(N * 3);
  const uv = new Float32Array(N * 2);
  const tri = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      uv.set([loop ? c / cols : c / (cols - 1), 1 - r / (rows - 1)], (r * cols + c) * 2);
      if (r < rows - 1 && (loop || c < cols - 1)) {
        const a = idx(r, c), b = idx(r, c + 1), d = idx(r + 1, c), e = idx(r + 1, c + 1);
        tri.push(a, d, b, b, d, e);
      }
    }
  geo.setAttribute('position', new THREE.BufferAttribute(vtx, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(tri);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  let inner = null;
  if (innerMaterial) {
    inner = new THREE.Mesh(geo, innerMaterial);
    inner.frustumCulled = false;
    mesh.add(inner);
  }

  const windDir = new THREE.Vector3(1, 0, 0.35).normalize();
  let t = 0, acc = 0, settled = false;
  const STEP = 1 / 60;

  function simulate(dt, wind) {
    t += dt;
    const bm = bone.matrixWorld;
    const caps = colliders();
    const strength = 0.6 + wind * 5.5;
    const dt2 = dt * dt;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const p = r * cols + c, i = p * 3;
        if (r === 0) {
          tmpP.copy(anchorLocal[c]).applyMatrix4(bm);
          prev[i] = pos[i];
          prev[i + 1] = pos[i + 1];
          prev[i + 2] = pos[i + 2];
          pos[i] = tmpP.x;
          pos[i + 1] = tmpP.y;
          pos[i + 2] = tmpP.z;
          continue;
        }
        const vx = (pos[i] - prev[i]) * 0.985, vy = (pos[i + 1] - prev[i + 1]) * 0.985, vz = (pos[i + 2] - prev[i + 2]) * 0.985;
        const k = r / (rows - 1);
        const flutter = 0.55 + 0.45 * Math.sin(t * 2.3 + c * 0.9 + r * 0.6) * Math.sin(t * 0.7 + c * 0.3);
        const wf = strength * flutter * (0.3 + k);
        prev[i] = pos[i];
        prev[i + 1] = pos[i + 1];
        prev[i + 2] = pos[i + 2];
        pos[i] += vx + windDir.x * wf * dt2;
        pos[i + 1] += vy + G * dt2;
        pos[i + 2] += vz + windDir.z * wf * dt2;
        // gentle pull toward the resting drape
        tmpP.set(restLocal[i], restLocal[i + 1], restLocal[i + 2]).applyMatrix4(bm);
        const s = shape * (1 - k * 0.5) + yoke * (1 - k) ** 4;
        pos[i] += (tmpP.x - pos[i]) * s;
        pos[i + 1] += (tmpP.y - pos[i + 1]) * s;
        pos[i + 2] += (tmpP.z - pos[i + 2]) * s;
      }
    for (let it = 0; it < 4; it++) {
      for (const [a, b, rest, stiff] of cons) {
        const ia = a * 3, ib = b * 3;
        const dx = pos[ib] - pos[ia], dy = pos[ib + 1] - pos[ia + 1], dz = pos[ib + 2] - pos[ia + 2];
        const d = Math.hypot(dx, dy, dz) || 1e-6;
        const diff = ((d - rest) / d) * 0.5 * stiff;
        const pinA = a < cols, pinB = b < cols;
        const wa = pinA ? 0 : pinB ? 2 : 1, wb = pinB ? 0 : pinA ? 2 : 1;
        pos[ia] += dx * diff * wa;
        pos[ia + 1] += dy * diff * wa;
        pos[ia + 2] += dz * diff * wa;
        pos[ib] -= dx * diff * wb;
        pos[ib + 1] -= dy * diff * wb;
        pos[ib + 2] -= dz * diff * wb;
      }
      // keep the cloth outside the body and above the ground
      for (let p = cols; p < N; p++) {
        const i = p * 3;
        tmpP.set(pos[i], pos[i + 1], pos[i + 2]);
        for (const cap of caps) {
          tmpA.subVectors(cap.b, cap.a);
          const l2 = tmpA.lengthSq() || 1e-6;
          const h = Math.max(0, Math.min(1, tmpB.subVectors(tmpP, cap.a).dot(tmpA) / l2));
          tmpB.copy(cap.a).addScaledVector(tmpA, h);
          const dx = tmpP.x - tmpB.x, dy = tmpP.y - tmpB.y, dz = tmpP.z - tmpB.z;
          const d = Math.hypot(dx, dy, dz);
          if (d < cap.r && d > 1e-5) {
            const push = (cap.r - d) / d;
            tmpP.x += dx * push;
            tmpP.y += dy * push;
            tmpP.z += dz * push;
          }
        }
        const gy = ground(tmpP.x, tmpP.z) + 0.02;
        if (tmpP.y < gy) tmpP.y = gy;
        pos[i] = tmpP.x;
        pos[i + 1] = tmpP.y;
        pos[i + 2] = tmpP.z;
      }
    }
  }

  const inv = new THREE.Matrix4();
  function update(dt, wind = 0) {
    // If the character jumped somewhere (placed, respawned), re-drape from the rest shape.
    tmpP.copy(anchorLocal[0]).applyMatrix4(bone.matrixWorld);
    if (Math.hypot(tmpP.x - pos[0], tmpP.y - pos[1], tmpP.z - pos[2]) > 1) settled = false;
    if (!settled) {
      place();
      for (let i = 0; i < 90; i++) simulate(STEP, wind); // let it fall into place unseen
      settled = true;
    }
    acc += Math.min(dt, 0.1);
    let n = 0;
    while (acc >= STEP && n < 4) {
      simulate(STEP, wind);
      acc -= STEP;
      n++;
    }
    if (n === 4) acc = 0;
    // write into the character's local space for rendering
    inv.copy(mesh.parent ? mesh.parent.matrixWorld : model.matrixWorld).invert();
    for (let p = 0; p < N; p++) {
      const i = p * 3;
      tmpP.set(pos[i], pos[i + 1], pos[i + 2]).applyMatrix4(inv);
      vtx[i] = tmpP.x;
      vtx[i + 1] = tmpP.y;
      vtx[i + 2] = tmpP.z;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  }

  // Put every particle at its resting drape for the bone's current pose.
  function place() {
    const bm = bone.matrixWorld;
    for (let p = 0; p < N; p++) {
      const i = p * 3;
      tmpP.set(restLocal[i], restLocal[i + 1], restLocal[i + 2]).applyMatrix4(bm);
      pos[i] = prev[i] = tmpP.x;
      pos[i + 1] = prev[i + 1] = tmpP.y;
      pos[i + 2] = prev[i + 2] = tmpP.z;
    }
  }

  return { mesh, update, reset: () => (settled = false) };
}
