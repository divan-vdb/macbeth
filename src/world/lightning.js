// Forked lightning. Each bolt is drawn fresh on a canvas: a jagged main channel
// with branches. Near bolts are crisp and bright; distant ones are thinner,
// dimmer and blurred by the rain and haze between, which gives the storm depth.
// Thunder follows after the time sound takes to travel the distance.
import * as THREE from 'three/webgpu';

const W = 256, H = 1024;

function jagged(x0, y0, x1, y1, rough, depth, rand) {
  let pts = [[x0, y0], [x1, y1]];
  let d = rough;
  for (let k = 0; k < depth; k++) {
    const np = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      np.push(a);
      np.push([(a[0] + b[0]) / 2 + (rand() - 0.5) * d, (a[1] + b[1]) / 2 + (rand() - 0.5) * d * 0.2]);
    }
    np.push(pts[pts.length - 1]);
    pts = np;
    d *= 0.56;
  }
  return pts;
}

function boltCanvas(near) {
  const rand = Math.random;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const main = jagged(W / 2 + (rand() - 0.5) * 40, 0, W / 2 + (rand() - 0.5) * W * 0.45, H, W * 0.38, 7, rand);
  const branches = [];
  const nb = 3 + Math.floor(rand() * 5);
  for (let i = 0; i < nb; i++) {
    const s = main[Math.floor((0.08 + rand() * 0.6) * main.length)];
    const side = rand() < 0.5 ? -1 : 1;
    const ex = s[0] + side * (30 + rand() * 90), ey = s[1] + 80 + rand() * 260;
    const b = jagged(s[0], s[1], ex, Math.min(ey, H * 0.95), 50, 5, rand);
    branches.push({ pts: b, w: 0.55 });
    if (rand() < 0.4) {
      const s2 = b[Math.floor(b.length * (0.3 + rand() * 0.4))];
      branches.push({ pts: jagged(s2[0], s2[1], s2[0] + side * (15 + rand() * 40), s2[1] + 40 + rand() * 100, 24, 4, rand), w: 0.35 });
    }
  }
  const stroke = (pts, width, style, blur) => {
    g.filter = blur > 0 ? `blur(${blur.toFixed(1)}px)` : 'none';
    g.strokeStyle = style;
    g.lineWidth = width;
    g.lineJoin = g.lineCap = 'round';
    g.beginPath();
    g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  };
  const haze = (1 - near) * 4.5; // extra blur for distance
  const passes = [
    { w: 16, blur: 12 + haze * 2, style: `rgba(130,150,255,${0.35 + near * 0.25})` },
    { w: 6, blur: 3 + haze, style: `rgba(200,212,255,${0.55 + near * 0.3})` },
    { w: 2.4 + near * 0.8, blur: haze * 0.8, style: `rgba(255,255,255,${0.6 + near * 0.4})` },
  ];
  for (const p of passes) {
    for (const b of branches) stroke(b.pts, p.w * b.w, p.style, p.blur);
    stroke(main, p.w, p.style, p.blur);
  }
  g.filter = 'none';
  return cv;
}

// Flicker pattern of a real strike: a leader, then 1-3 return strokes, then fade
function timeline() {
  const t = [[0, 0.0], [0.03, 1.0], [0.07, 0.25]];
  let at = 0.07;
  const restrikes = 1 + Math.floor(Math.random() * 3);
  for (let i = 0; i < restrikes; i++) {
    at += 0.04 + Math.random() * 0.07;
    t.push([at, 0.85 + Math.random() * 0.15]);
    at += 0.03 + Math.random() * 0.04;
    t.push([at, 0.2 + Math.random() * 0.2]);
  }
  t.push([at + 0.35, 0]);
  return t;
}
function sample(tl, time) {
  if (time >= tl[tl.length - 1][0]) return 0;
  for (let i = 0; i < tl.length - 1; i++) {
    if (time < tl[i + 1][0]) {
      const k = (time - tl[i][0]) / (tl[i + 1][0] - tl[i][0]);
      return tl[i][1] + (tl[i + 1][1] - tl[i][1]) * k;
    }
  }
  return 0;
}

export function createLightning(scene, camera, onThunder) {
  const geo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  const bolts = [];
  const light = new THREE.DirectionalLight(new THREE.Color(0.75, 0.82, 1), 0);
  scene.add(light, light.target);
  let next = 3 + Math.random() * 5;
  const forward = new THREE.Vector3();

  function strike(opts = {}) {
    camera.getWorldDirection(forward);
    const yaw = Math.random() < 0.75 ? Math.atan2(forward.z, forward.x) + (Math.random() - 0.5) * 2.2 : Math.random() * Math.PI * 2;
    const dist = opts.near ? 80 + Math.random() * 70 : 75 + 260 * Math.random() ** 0.8;
    const near = Math.max(0, Math.min(1, 1 - (dist - 75) / 260));
    const x = Math.cos(yaw) * dist, z = Math.sin(yaw) * dist;
    const height = 150 + Math.random() * 60;

    const map = new THREE.CanvasTexture(boltCanvas(near));
    map.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(camera.position.x + x, -6, camera.position.z + z);
    mesh.scale.set(height * (W / H) * (1.1 + Math.random() * 0.4), height, 1);
    mesh.renderOrder = -3;
    mesh.frustumCulled = false;
    scene.add(mesh);
    bolts.push({ mesh, mat, map, tl: timeline(), age: 0, near, dir: new THREE.Vector3(x, height * 0.6, z).normalize() });

    // Sound travels ~343 m/s: the further the bolt, the longer the wait
    if (onThunder) onThunder(dist / 343, near);
  }

  function update(dt) {
    next -= dt;
    if (next <= 0) {
      strike();
      if (Math.random() < 0.2) setTimeout(() => strike(), 600 + Math.random() * 1800);
      next = 5 + Math.random() * 17;
    }
    let flash = 0, nearFlash = 0;
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.age += dt;
      const v = sample(b.tl, b.age);
      b.mat.opacity = v * (0.45 + b.near * 0.55);
      b.mesh.rotation.y = Math.atan2(camera.position.x - b.mesh.position.x, camera.position.z - b.mesh.position.z);
      flash = Math.max(flash, v * (0.35 + b.near * 0.65));
      if (v * b.near > nearFlash) {
        nearFlash = v * b.near;
        light.position.copy(b.dir).multiplyScalar(100);
      }
      if (b.age > b.tl[b.tl.length - 1][0]) {
        scene.remove(b.mesh);
        b.map.dispose();
        b.mat.dispose();
        bolts.splice(i, 1);
      }
    }
    light.intensity = nearFlash * 5;
    return flash;
  }

  return { strike, update };
}
