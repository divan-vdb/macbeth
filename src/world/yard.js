// The Captain's training yard, west of the stone circle: a fenced square of trampled
// earth with straw men and wooden dummies for the sword, a quintain that swings back
// at the careless, straw butts for the spear, clay pots for stones, a weapon rack and
// two braziers. Every target answers a blow: it rocks, sheds straw or chips, and sounds
// true to what it is made of.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { barkTextures } from './textures.js';
import { createFire } from './fire.js';
import { mulberry32, fbm } from './noise.js';
import { makeSpear, makeSword } from '../characters/props.js';
import { impact, sfx } from '../audio.js';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

// ---------- painted textures
function canvasTex(w, h, paint, repeat = false) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  paint(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
const strawTex = () =>
  canvasTex(256, 256, (g, w, h) => {
    const r = mulberry32(5);
    g.fillStyle = '#8a6f2c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, len = 20 + r() * 60;
      const c = 150 + r() * 80;
      g.strokeStyle = `rgba(${c},${c * 0.8},${c * 0.38},${0.5 + r() * 0.5})`;
      g.lineWidth = 0.8 + r() * 1.6;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 8, y + len);
      g.stroke();
    }
  }, true);
const burlapTex = () =>
  canvasTex(128, 128, (g, w, h) => {
    const r = mulberry32(9);
    g.fillStyle = '#7d6644';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 3) {
      g.fillStyle = `rgba(60,44,24,${0.25 + r() * 0.2})`;
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 3) {
      g.fillStyle = `rgba(150,124,82,${0.2 + r() * 0.2})`;
      g.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(40,28,14,${r() * 0.25})`;
      g.beginPath();
      g.arc(r() * w, r() * h, 2 + r() * 8, 0, 6.3);
      g.fill();
    }
  }, true);
// a scarecrow's face, daubed in soot on the sack
const sackFaceTex = () =>
  canvasTex(256, 128, (g, w, h) => {
    g.drawImage(burlapTex().image, 0, 0, w, h);
    g.strokeStyle = 'rgba(18,12,8,0.85)';
    g.lineCap = 'round';
    g.lineWidth = 7;
    // eyes: two crosses; a stitched grin
    for (const ex of [0.43, 0.57]) {
      const x = ex * w, y = 0.42 * h;
      g.beginPath();
      g.moveTo(x - 9, y - 9);
      g.lineTo(x + 9, y + 9);
      g.moveTo(x + 9, y - 9);
      g.lineTo(x - 9, y + 9);
      g.stroke();
    }
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0.4 * w, 0.66 * h);
    g.quadraticCurveTo(0.5 * w, 0.76 * h, 0.6 * w, 0.66 * h);
    g.stroke();
    for (let i = 0; i < 6; i++) {
      const x = 0.41 * w + i * 0.036 * w;
      g.beginPath();
      g.moveTo(x, 0.64 * h);
      g.lineTo(x, 0.74 * h);
      g.stroke();
    }
  });
const woodTex = (seed = 3, base = '#6b4a2b') =>
  canvasTex(128, 256, (g, w, h) => {
    const r = mulberry32(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 2) {
      const v = fbm(x * 0.05 + seed, 0.5, 3);
      g.fillStyle = `rgba(30,18,8,${0.15 + v * 0.35})`;
      g.fillRect(x, 0, 1 + r() * 1.5, h);
    }
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = 'rgba(25,14,6,0.6)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 4 + r() * 6, 10 + r() * 14, 0, 0, 6.3);
      g.stroke();
    }
    // nicks and cuts from years of practice
    for (let i = 0; i < 30; i++) {
      g.strokeStyle = `rgba(${200 + r() * 40},${160 + r() * 40},${110 + r() * 30},${0.4 + r() * 0.4})`;
      g.lineWidth = 1 + r();
      const x = r() * w, y = r() * h;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 8);
      g.stroke();
    }
  }, true);
const ringsTex = () =>
  canvasTex(256, 256, (g, w, h) => {
    g.drawImage(strawTex().image, 0, 0, w, h);
    const rings = ['#e8dcc0', '#1d1712', '#e8dcc0', '#8e1b14', '#e8dcc0', '#8e1b14'];
    rings.forEach((c, i) => {
      g.fillStyle = c;
      g.globalAlpha = 0.82;
      g.beginPath();
      g.arc(w / 2, h / 2, (w / 2) * (1 - i / rings.length) * 0.96, 0, 6.3);
      g.fill();
    });
    g.globalAlpha = 1;
    g.fillStyle = '#d8b04a';
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.05, 0, 6.3);
    g.fill();
  });
const dirtTex = () =>
  canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(17);
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const n = fbm(x * 0.02, y * 0.02, 4), m = fbm(x * 0.15 + 5, y * 0.15, 2);
        const dx = (x / w - 0.5) * 2, dy = (y / h - 0.5) * 2;
        const edge = Math.max(Math.abs(dx), Math.abs(dy));
        const a = Math.max(0, Math.min(1, (1 - edge) * 4.5 - (n - 0.5) * 2.2));
        const i = (y * w + x) * 4;
        const v = 70 + n * 50 + m * 25;
        img.data[i] = v * 1.05;
        img.data[i + 1] = v * 0.86;
        img.data[i + 2] = v * 0.62;
        img.data[i + 3] = a * 235;
      }
    g.putImageData(img, 0, 0);
    // boot prints and scuffs
    for (let i = 0; i < 220; i++) {
      g.fillStyle = `rgba(40,28,16,${0.15 + r() * 0.2})`;
      g.beginPath();
      g.ellipse(r() * w, r() * h, 3 + r() * 3, 6 + r() * 4, r() * 6, 0, 6.3);
      g.fill();
    }
  });
const clayTex = () =>
  canvasTex(128, 128, (g, w, h) => {
    const r = mulberry32(23);
    g.fillStyle = '#9a5634';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(${60 + r() * 80},${30 + r() * 30},${15 + r() * 20},${r() * 0.3})`;
      g.fillRect(r() * w, r() * h, 2 + r() * 4, 1 + r() * 2);
    }
    g.strokeStyle = 'rgba(40,18,8,0.5)';
    for (let y = 30; y < h; y += 26) {
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  }, true);

// ---------- debris: straw, chips and shards thrown off by blows
function createDebris(scene) {
  const kinds = {
    straw: { geo: new THREE.PlaneGeometry(0.012, 0.09), color: '#c9a654' },
    wood: { geo: new THREE.BoxGeometry(0.03, 0.012, 0.05), color: '#8a6a44' },
    clay: { geo: new THREE.BoxGeometry(0.05, 0.012, 0.04), color: '#9a5634' },
  };
  const pools = {};
  for (const k in kinds) {
    const mat = new THREE.MeshStandardMaterial({ color: srgb(kinds[k].color), roughness: 0.9, side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(kinds[k].geo, mat, 80);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    const ps = Array.from({ length: 80 }, () => ({ pos: new THREE.Vector3(0, -99, 0), vel: new THREE.Vector3(), rot: new THREE.Euler(), spin: new THREE.Vector3(), life: 0, rest: false }));
    scene.add(mesh);
    pools[k] = { mesh, ps, next: 0 };
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
  return {
    burst(kind, at, dir, n = 14, force = 1) {
      const pool = pools[kind];
      for (let i = 0; i < n; i++) {
        const p = pool.ps[pool.next];
        pool.next = (pool.next + 1) % pool.ps.length;
        p.pos.copy(at);
        p.vel.set((Math.random() - 0.5) * 2.2, 1 + Math.random() * 2.4, (Math.random() - 0.5) * 2.2).addScaledVector(dir, 1.5 + Math.random() * 2.5).multiplyScalar(force);
        p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        p.spin.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
        p.life = 6 + Math.random() * 4;
        p.rest = false;
      }
    },
    update(dt, heightAt) {
      for (const k in pools) {
        const { mesh, ps } = pools[k];
        for (let i = 0; i < ps.length; i++) {
          const p = ps[i];
          if (p.life > 0) {
            p.life -= dt;
            if (!p.rest) {
              p.vel.y -= 9.8 * dt;
              if (k === 'straw') p.vel.multiplyScalar(1 - dt * 2.5); // straw flutters down
              p.pos.addScaledVector(p.vel, dt);
              p.rot.x += p.spin.x * dt;
              p.rot.y += p.spin.y * dt;
              p.rot.z += p.spin.z * dt;
              const g = heightAt(p.pos.x, p.pos.z) + 0.01;
              if (p.pos.y < g) {
                p.pos.y = g;
                p.rest = true;
                p.rot.x = Math.PI / 2;
              }
            }
            if (p.life <= 0) p.pos.y = -99;
          }
          q.setFromEuler(p.rot);
          m4.compose(p.pos, q, one);
          mesh.setMatrixAt(i, m4);
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    },
  };
}

// ---------- the yard
export function buildYard({ scene, heightAt, combat, center, narrow, onEvent = () => {}, hurtPlayer, player }) {
  const group = new THREE.Group();
  scene.add(group);
  const C = center;
  const gy = (x, z) => heightAt(x, z);
  const colliders = []; // boxes for the physics: fence rails and posts
  const solids = []; // for steering and the grass
  const debris = createDebris(scene);
  const bt = barkTextures(41);
  const logMat = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, roughness: 1 });
  const planed = new THREE.MeshStandardMaterial({ map: woodTex(3), roughness: 0.85 });
  const darkWood = new THREE.MeshStandardMaterial({ map: woodTex(8, '#4a3220'), roughness: 0.9 });
  const straw = new THREE.MeshStandardMaterial({ map: strawTex(), roughness: 1, color: srgb('#e8d8a8') });
  const sack = new THREE.MeshStandardMaterial({ map: burlapTex(), roughness: 1 });
  const rope = new THREE.MeshStandardMaterial({ color: srgb('#5a4630'), roughness: 1 });
  const iron = new THREE.MeshStandardMaterial({ color: srgb('#3a3936'), roughness: 0.55, metalness: 0.8 });
  const put = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true;
    return mesh;
  };
  const cyl = (r0, r1, h, mat, seg = 10) => new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), mat);

  // trampled earth underfoot, following the lie of the ground
  {
    const W = 20, D = 16;
    const geo = new THREE.PlaneGeometry(W, D, 40, 32);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i) + C.x, z = p.getZ(i) + C.z;
      p.setY(i, gy(x, z) + 0.03);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: dirtTex(), transparent: true, roughness: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(C.x, 0, C.z);
    m.receiveShadow = true;
    group.add(m);
  }

  // the fence: split-log posts and two rails, open on the east side facing the stones
  {
    const x0 = C.x - 9, x1 = C.x + 9, z0 = C.z - 7, z1 = C.z + 7;
    const gate = [C.z - 2, C.z + 2];
    const runs = [
      [[x0, z0], [x1, z0]],
      [[x0, z1], [x1, z1]],
      [[x0, z0], [x0, z1]],
      [[x1, z0], [x1, gate[0]]],
      [[x1, gate[1]], [x1, z1]],
    ];
    const rand = mulberry32(31);
    const parts = [];
    const bake = (m) => {
      m.updateMatrix();
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrix);
      parts.push(g);
    };
    for (const [[ax, az], [bx, bz]] of runs) {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.round(len / 2.2));
      for (let i = 0; i <= n; i++) {
        const x = ax + ((bx - ax) * i) / n, z = az + ((bz - az) * i) / n;
        const h = 1.25 + rand() * 0.15;
        const post = put(cyl(0.07, 0.085, h, logMat, 7), x, gy(x, z) + h / 2 - 0.1, z);
        post.rotation.set((rand() - 0.5) * 0.06, rand() * 6, (rand() - 0.5) * 0.06);
        bake(post);
        if (i < n) {
          const nx = ax + ((bx - ax) * (i + 1)) / n, nz = az + ((bz - az) * (i + 1)) / n;
          const seg = Math.hypot(nx - x, nz - z);
          for (const hh of [0.5, 0.95]) {
            const y0 = gy(x, z) + hh, y1 = gy(nx, nz) + hh;
            const rail = put(cyl(0.04, 0.045, seg + 0.2, logMat, 6), (x + nx) / 2, (y0 + y1) / 2, (z + nz) / 2);
            rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx - x, y1 - y0, nz - z).normalize());
            bake(rail);
          }
          const yaw = Math.atan2(nx - x, nz - z);
          colliders.push({ kind: 'box', size: [0.06, 0.6, seg / 2], position: new THREE.Vector3((x + nx) / 2, gy(x, z) + 0.6, (z + nz) / 2), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)) });
        }
      }
    }
    const fence = new THREE.Mesh(mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g))), logMat);
    fence.castShadow = fence.receiveShadow = true;
    group.add(fence);
  }

  // ---------- targets that rock when struck (a damped spring on a pivot at the base)
  const swayers = [];
  function swayer(obj, { stiff = 40, damp = 4.5, max = 0.45 } = {}) {
    const s = { obj, lx: 0, lz: 0, vx: 0, vz: 0, stiff, damp, max };
    swayers.push(s);
    return {
      push(dir, power) {
        s.vx += dir.z * power * 2.6;
        s.vz += -dir.x * power * 2.6;
      },
    };
  }
  const dummies = [];
  function addDummy(kind, x, z, yaw) {
    const g = new THREE.Group();
    g.position.set(x, gy(x, z) - 0.05, z);
    g.rotation.y = yaw;
    const pivot = new THREE.Group();
    g.add(pivot);
    let headY = 1.65, mat = 'straw', radius = 0.3;
    if (kind === 'straw') {
      pivot.add(put(cyl(0.05, 0.06, 2.0, logMat, 7), 0, 1.0, 0));
      const arms = put(cyl(0.035, 0.035, 1.3, logMat, 6), 0, 1.42, 0);
      arms.rotation.z = Math.PI / 2;
      pivot.add(arms);
      // the bound straw body, arms and the sack head with its soot face
      const body = put(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 0.8, 14, 4), straw), 0, 1.02, 0);
      body.scale.z = 0.8;
      pivot.add(body);
      for (const s of [-1, 1]) {
        const a = put(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.5, 8), straw), s * 0.38, 1.42, 0);
        a.rotation.z = Math.PI / 2;
        pivot.add(a);
        const tuft = put(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 7), straw), s * 0.68, 1.42, 0);
        tuft.rotation.z = -s * Math.PI / 2;
        pivot.add(tuft);
      }
      for (const y of [0.7, 1.05, 1.33]) {
        const band = put(new THREE.Mesh(new THREE.TorusGeometry(y === 1.33 ? 0.13 : 0.2, 0.012, 5, 18), rope), 0, y, 0);
        band.rotation.x = Math.PI / 2;
        band.scale.y = 0.8;
        pivot.add(band);
      }
      const faceMat = new THREE.MeshStandardMaterial({ map: sackFaceTex(), roughness: 1 });
      const head = put(new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), faceMat), 0, 1.62, 0);
      head.scale.set(1, 1.12, 0.92);
      head.rotation.y = -Math.PI / 2;
      pivot.add(head);
      const neck = put(new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 5, 12), rope), 0, 1.5, 0);
      neck.rotation.x = Math.PI / 2;
      pivot.add(neck);
      pivot.add(put(new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.2, 9), straw), 0, 1.78, 0));
      mat = 'straw';
    } else if (kind === 'wooden') {
      // a carved wooden man: thick body post, crossbar arms, a round head, all scarred
      pivot.add(put(cyl(0.11, 0.13, 1.5, planed, 10), 0, 0.75, 0));
      const arms = put(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.09), planed), 0, 1.25, 0);
      pivot.add(arms);
      for (const s of [-1, 1]) pivot.add(put(new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.32, 0.09), planed), s * 0.46, 1.08, 0));
      pivot.add(put(new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), planed), 0, 1.66, 0));
      pivot.add(put(cyl(0.05, 0.06, 0.14, darkWood, 8), 0, 1.5, 0));
      headY = 1.6;
      mat = 'wood';
      radius = 0.25;
    } else if (kind === 'sticks') {
      // a stick figure lashed from ash poles: legs astride, arms out, a twig-bundle head
      const pole = (len, r, x, y, z, rx, rz) => {
        const m = put(cyl(r, r, len, logMat, 6), x, y, z);
        m.rotation.set(rx, 0, rz);
        pivot.add(m);
      };
      pole(1.1, 0.035, 0, 1.1, 0, 0, 0);
      pole(0.9, 0.03, -0.13, 0.42, 0, 0, 0.3);
      pole(0.9, 0.03, 0.13, 0.42, 0, 0, -0.3);
      pole(1.15, 0.028, 0, 1.36, 0, 0, Math.PI / 2 - 0.2);
      for (const y of [0.88, 1.36]) {
        const lash = put(new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 10), rope), 0, y, 0);
        lash.rotation.x = Math.PI / 2;
        pivot.add(lash);
      }
      const head = put(new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 1), darkWood), 0, 1.72, 0);
      pivot.add(head);
      headY = 1.6;
      mat = 'wood';
      radius = 0.24;
    } else if (kind === 'pell') {
      // the pell: a plain post hacked by a thousand blows
      pivot.add(put(cyl(0.13, 0.15, 1.75, planed, 12), 0, 0.875, 0));
      const hoop = put(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 5, 16), iron), 0, 1.6, 0);
      hoop.rotation.x = Math.PI / 2;
      pivot.add(hoop);
      mat = 'wood';
      radius = 0.2;
      headY = 1.4;
    }
    group.add(g);
    const sw = swayer(pivot, kind === 'straw' ? { stiff: 30, damp: 3.2, max: 0.5 } : { stiff: 70, damp: 6, max: 0.18 });
    const d = { kind, g, hits: 0 };
    solids.push({ kind: 'ball', size: [radius + 0.1], position: new THREE.Vector3(x, gy(x, z) + 0.8, z), quaternion: new THREE.Quaternion() });
    colliders.push({ kind: 'ball', size: [radius], position: new THREE.Vector3(x, gy(x, z) + 0.9, z), quaternion: new THREE.Quaternion() });
    combat.addTarget({
      id: `dummy-${dummies.length}`,
      kind,
      melee: true,
      catches: true,
      sticks: kind === 'straw',
      radius,
      center: () => new THREE.Vector3(x, gy(x, z) + headY - 0.45, z),
      holdSpear: (m) => pivot.attach(m),
      hit: ({ weapon, power, dir, point, heavy, thrown }) => {
        d.hits++;
        sw.push(dir, power * (kind === 'straw' ? 1 : 0.5));
        const sound = weapon === 'fists' ? (kind === 'straw' ? 'sack' : 'wood') : weapon === 'stone' ? (mat === 'wood' ? 'wood' : 'sack') : mat;
        impact(sound, 0.7 + power * 0.25);
        if (weapon !== 'fists') debris.burst(mat === 'wood' ? 'wood' : 'straw', point, dir, mat === 'wood' ? 6 + power * 3 : 10 + power * 6, 0.8 + power * 0.15);
        onEvent('strike', { kind, weapon, heavy: !!heavy, thrown: !!thrown });
      },
    });
    dummies.push(d);
    return d;
  }
  // two straw men, a carved wooden man, a stick figure and a pell, in a row facing the yard
  const rowZ = C.z - 4.2;
  addDummy('straw', C.x + 4.5, rowZ, 0);
  addDummy('straw', C.x + 1.5, rowZ, 0);
  addDummy('wooden', C.x - 1.5, rowZ, 0);
  addDummy('sticks', C.x - 4.5, rowZ, 0);
  addDummy('pell', C.x - 7, rowZ + 0.6, 0);

  // ---------- the quintain: strike its shield and the arm swings round, and the sandbag
  // on the far end comes for you. Block it with the sword, or step back.
  const Q = new THREE.Vector3(C.x + 0.5, gy(C.x + 0.5, C.z + 0.5), C.z + 0.5);
  const quintain = { yaw: 0.6, w: 0, cool: 0 };
  {
    const base = new THREE.Group();
    base.position.copy(Q);
    group.add(base);
    base.add(put(cyl(0.1, 0.13, 2.0, logMat, 9), 0, 1.0, 0));
    for (let i = 0; i < 3; i++) {
      const strut = put(cyl(0.04, 0.05, 0.9, logMat, 6), Math.sin(i * 2.1) * 0.3, 0.3, Math.cos(i * 2.1) * 0.3);
      strut.rotation.set(Math.cos(i * 2.1) * 0.7, 0, -Math.sin(i * 2.1) * 0.7);
      base.add(strut);
    }
    const arm = new THREE.Group();
    arm.position.y = 1.95;
    base.add(arm);
    const beam = put(new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.1), planed), 0, 0, 0);
    arm.add(beam);
    arm.add(put(cyl(0.05, 0.05, 0.12, iron, 8), 0, 0.02, 0));
    // the shield: oak boards in an iron rim, at one end
    const shield = new THREE.Group();
    shield.position.set(1.12, -0.42, 0);
    arm.add(shield);
    const disc = put(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 20), planed), 0, 0, 0);
    disc.rotation.x = Math.PI / 2;
    shield.add(disc);
    shield.add(put(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.022, 6, 24), iron), 0, 0, 0));
    for (const zz of [-1, 1]) {
      const boss = put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), iron), 0, 0, zz * 0.03);
      boss.scale.z = 0.45;
      shield.add(boss);
    }
    shield.add(put(cyl(0.012, 0.012, 0.42, rope, 5), 0, 0.3, 0));
    // the sandbag on its rope at the other end
    const bag = put(new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), sack), -1.12, -0.62, 0);
    bag.scale.set(0.9, 1.25, 0.9);
    arm.add(bag);
    arm.add(put(cyl(0.012, 0.012, 0.45, rope, 5), -1.12, -0.28, 0));
    quintain.arm = arm;
    colliders.push({ kind: 'ball', size: [0.16], position: Q.clone().add(new THREE.Vector3(0, 0.9, 0)), quaternion: new THREE.Quaternion() });
    solids.push({ kind: 'ball', size: [0.3], position: Q.clone().add(new THREE.Vector3(0, 0.9, 0)), quaternion: new THREE.Quaternion() });
    const shieldPos = () => new THREE.Vector3(Q.x + Math.cos(quintain.yaw) * 1.12, Q.y + 1.53, Q.z - Math.sin(quintain.yaw) * 1.12);
    combat.addTarget({
      id: 'quintain',
      kind: 'quintain',
      melee: true,
      catches: true,
      radius: 0.34,
      center: shieldPos,
      hit: ({ weapon, power, dir, point }) => {
        // a blow on the shield drives the arm round; which way depends on the side struck
        const s = shieldPos();
        const tangent = new THREE.Vector3(-Math.sin(quintain.yaw), 0, -Math.cos(quintain.yaw));
        const sign = Math.sign(dir.dot(tangent)) || 1;
        quintain.w += sign * (2.6 + power * 1.0);
        impact(weapon === 'fists' ? 'wood' : 'metal', 0.6 + power * 0.3);
        debris.burst('wood', point, dir, 4, 0.7);
        onEvent('quintain', { weapon });
        void s;
      },
    });
  }
  function updateQuintain(dt) {
    const q = quintain;
    q.w *= Math.exp(-dt * 0.42); // friction on the iron pin: a well-greased quintain spins long
    const from = q.yaw;
    q.yaw += q.w * dt;
    q.arm.rotation.y = q.yaw;
    q.cool -= dt;
    // the sandbag sweeps a circle: anyone standing in its path when it comes round is struck
    // (checked along the whole arc it swept this frame, so a fast swing cannot pass through)
    if (Math.abs(q.w) > 1.6 && q.cool <= 0 && player) {
      const p = player.position;
      let bx = 0, bz = 0, best = Infinity;
      for (let i = 1; i <= 6; i++) {
        const y = from + ((q.yaw - from) * i) / 6;
        const x = Q.x - Math.cos(y) * 1.12, z = Q.z + Math.sin(y) * 1.12;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < best) (best = d), (bx = x), (bz = z);
      }
      if (best < 0.8) {
        q.cool = 0.8;
        const dir = new THREE.Vector3(Math.sin(q.yaw), 0, Math.cos(q.yaw)).multiplyScalar(Math.sign(q.w));
        const blocked = hurtPlayer ? hurtPlayer({ amount: 6 + Math.abs(q.w) * 1.5, from: new THREE.Vector3(bx, p.y, bz), dir, source: 'quintain' }) : false;
        impact('sack', 1.2);
        q.w *= blocked ? -0.4 : 0.5;
        onEvent(blocked ? 'quintainBlocked' : 'quintainHit', {});
      }
    }
  }

  // ---------- the throwing range: a line marked with stakes and rope, three straw butts
  const lineX = C.x + 6.5;
  {
    const z0 = C.z + 3.2, z1 = C.z + 6.4;
    for (const z of [z0, z1]) group.add(put(cyl(0.03, 0.04, 0.6, logMat, 6), lineX, gy(lineX, z) + 0.2, z));
    const r = put(cyl(0.01, 0.01, z1 - z0, rope, 4), lineX, gy(lineX, (z0 + z1) / 2) + 0.42, (z0 + z1) / 2);
    r.rotation.x = Math.PI / 2;
    group.add(r);
  }
  const ringMat = new THREE.MeshStandardMaterial({ map: ringsTex(), roughness: 1 });
  const butts = [];
  for (const [dx, dz] of [[-6, 4.8], [-10.5, 4.2], [-14.5, 5.4]]) {
    const x = lineX + dx, z = C.z + dz;
    const g = new THREE.Group();
    g.position.set(x, gy(x, z), z);
    g.rotation.y = Math.PI / 2; // facing the line, to the east
    group.add(g);
    for (const s of [-1, 1]) {
      const leg = put(cyl(0.035, 0.04, 1.6, logMat, 6), s * 0.38, 0.75, -0.18);
      leg.rotation.x = 0.22;
      g.add(leg);
    }
    const back = put(cyl(0.035, 0.04, 1.4, logMat, 6), 0, 0.65, -0.5);
    back.rotation.x = -0.45;
    g.add(back);
    const disc = put(new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.2, 28), [straw, ringMat, straw]), 0, 1.1, 0);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
    const sw = swayer(g, { stiff: 60, damp: 5, max: 0.12 });
    const centre = new THREE.Vector3(x, gy(x, z) + 1.1, z);
    butts.push({ g, centre });
    combat.addTarget({
      id: `butt-${butts.length}`,
      kind: 'butt',
      melee: false,
      catches: true,
      sticks: true,
      radius: 0.48,
      center: () => centre,
      holdSpear: (m) => g.attach(m),
      hit: ({ weapon, power, dir, point }) => {
        sw.push(dir, power * 0.3);
        impact(weapon === 'spear' ? 'straw' : 'sack', 1);
        debris.burst('straw', point, dir.clone().negate(), 8, 0.6);
        // how near the gold? rings every tenth of a metre
        const off = Math.hypot(point.y - centre.y, point.z - centre.z);
        const ring = off < 0.06 ? 'gold' : off < 0.16 ? 'red' : off < 0.32 ? 'black' : 'straw';
        onEvent('butt', { weapon, ring, distance: Math.abs(lineX - x) });
      },
    });
  }

  // ---------- clay pots on a plank shelf for the stones
  const potMat = new THREE.MeshStandardMaterial({ map: clayTex(), roughness: 0.85 });
  const potProfile = [[0, 0], [0.06, 0], [0.1, 0.03], [0.12, 0.09], [0.11, 0.16], [0.07, 0.21], [0.055, 0.25], [0.065, 0.27]].map(([r, y]) => new THREE.Vector2(r, y));
  const potGeo = new THREE.LatheGeometry(potProfile, 14);
  const shelf = { x: C.x - 8.2, z0: C.z - 1.6, z1: C.z + 1.6 };
  {
    for (const z of [shelf.z0 + 0.2, shelf.z1 - 0.2])
      for (const dx of [-0.25, 0.25]) group.add(put(cyl(0.04, 0.05, 0.8, logMat, 6), shelf.x + dx, gy(shelf.x, z) + 0.4, z));
    const plank = put(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, shelf.z1 - shelf.z0), darkWood), shelf.x, gy(shelf.x, C.z) + 0.8, C.z);
    group.add(plank);
  }
  const pots = [];
  for (let i = 0; i < 5; i++) {
    const z = shelf.z0 + 0.35 + i * ((shelf.z1 - shelf.z0 - 0.7) / 4);
    const m = put(new THREE.Mesh(potGeo, potMat), shelf.x, gy(shelf.x, C.z) + 0.825, z);
    m.scale.setScalar(0.9 + Math.random() * 0.3);
    group.add(m);
    const pot = { m, broken: false, timer: 0 };
    pots.push(pot);
    combat.addTarget({
      id: `pot-${i}`,
      kind: 'pot',
      melee: true,
      catches: true,
      radius: 0.13,
      center: () => m.position.clone().add(new THREE.Vector3(0, 0.12, 0)),
      hit: ({ dir, point, weapon }) => {
        if (pot.broken) return;
        pot.broken = true;
        pot.timer = 25;
        m.visible = false;
        impact('clay', 1.2);
        debris.burst('clay', point, dir, 14, 1);
        onEvent('pot', { weapon });
      },
    });
  }
  // a broken pot is quietly replaced while no one is looking
  const potsUpdate = (dt) => {
    for (const p of pots)
      if (p.broken) {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.broken = false;
          p.m.visible = true;
        }
      }
  };

  // ---------- the weapon rack by the gate: practice spears and swords
  const rackAt = new THREE.Vector3(C.x + 6.6, 0, C.z + 6.2);
  rackAt.y = gy(rackAt.x, rackAt.z);
  {
    const g = new THREE.Group();
    g.position.copy(rackAt);
    g.rotation.y = Math.PI;
    group.add(g);
    for (const s of [-1, 1]) {
      const leg = put(new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), darkWood), s * 0.8, 0.72, 0);
      g.add(leg);
    }
    for (const y of [0.35, 1.25]) g.add(put(new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.12), darkWood), 0, y, 0));
    for (let i = 0; i < 3; i++) {
      const sp = makeSpear();
      sp.position.set(-0.6 + i * 0.22, 0.1, 0.06);
      sp.rotation.z = 0.08;
      g.add(sp);
    }
    for (let i = 0; i < 2; i++) {
      const sw = makeSword();
      sw.position.set(0.3 + i * 0.25, 0.35, 0.06);
      sw.rotation.set(0, 0, Math.PI);
      g.add(sw);
    }
    colliders.push({ kind: 'box', size: [0.9, 0.75, 0.1], position: rackAt.clone().add(new THREE.Vector3(0, 0.75, 0)), quaternion: new THREE.Quaternion() });
  }

  // ---------- two braziers at the gate: iron bowls of burning logs
  const fires = [];
  for (const [dz, lit] of [[-2.6, true], [2.6, !narrow]]) {
    const x = C.x + 9.6, z = C.z + dz;
    const g = new THREE.Group();
    g.position.set(x, gy(x, z), z);
    group.add(g);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = put(cyl(0.02, 0.025, 1.05, iron, 6), Math.sin(a) * 0.2, 0.48, Math.cos(a) * 0.2);
      leg.rotation.set(Math.cos(a) * 0.32, 0, -Math.sin(a) * 0.32);
      g.add(leg);
    }
    const bowl = put(new THREE.Mesh(new THREE.LatheGeometry([[0.05, 0], [0.24, 0.06], [0.33, 0.2], [0.36, 0.26]].map(([r, y]) => new THREE.Vector2(r, y)), 18), iron), 0, 0.88, 0);
    g.add(bowl);
    for (let i = 0; i < 4; i++) {
      const log = put(cyl(0.035, 0.04, 0.42 + i * 0.05, logMat, 6), (Math.random() - 0.5) * 0.1, 1.08, (Math.random() - 0.5) * 0.1);
      log.rotation.set(0.6 + i * 0.3, i * 1.6, 0.4);
      g.add(log);
    }
    const f = createFire(new THREE.Vector3(x, gy(x, z) + 1.0, z), narrow, { scale: 0.32, power: 0.5, light: lit, shadows: false });
    scene.add(f.group);
    fires.push(f);
    colliders.push({ kind: 'ball', size: [0.3], position: new THREE.Vector3(x, gy(x, z) + 0.8, z), quaternion: new THREE.Quaternion() });
  }

  const captainAt = new THREE.Vector3(C.x + 7.6, 0, C.z + 1.0);
  captainAt.y = gy(captainAt.x, captainAt.z);

  return {
    group,
    colliders,
    solids,
    rackAt,
    captainAt,
    gateAt: new THREE.Vector3(C.x + 9.5, gy(C.x + 9.5, C.z), C.z),
    lineX,
    quintainAt: Q,
    shelfAt: new THREE.Vector3(shelf.x, gy(shelf.x, C.z), C.z),
    dummyRowZ: rowZ,
    debris,
    update(dt, camera) {
      for (const s of swayers) {
        s.vx += (-s.stiff * s.lx - s.damp * s.vx) * dt;
        s.vz += (-s.stiff * s.lz - s.damp * s.vz) * dt;
        s.lx = THREE.MathUtils.clamp(s.lx + s.vx * dt, -s.max, s.max);
        s.lz = THREE.MathUtils.clamp(s.lz + s.vz * dt, -s.max, s.max);
        s.obj.rotation.x = s.lx;
        s.obj.rotation.z = s.lz;
      }
      updateQuintain(dt);
      potsUpdate(dt);
      debris.update(dt, heightAt);
      for (const f of fires) f.update(dt, camera);
    },
    // the quintain set spinning by the Captain, to test a block
    spinQuintain(w = 4) {
      quintain.w = w;
    },
    get quintainState() {
      return { w: +quintain.w.toFixed(2), yaw: +quintain.yaw.toFixed(2), cool: +quintain.cool.toFixed(2) };
    },
    get quintainSpinning() {
      return Math.abs(quintain.w) > 1.2;
    },
  };
}
