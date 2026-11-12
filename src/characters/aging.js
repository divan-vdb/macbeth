// Ages a face: paints wrinkles, sunken eyes, hollow cheeks, folds and spots
// onto a copy of the head's colour texture, so the shared young CC0 head can
// play an old crone. Positions are in the Quaternius female base texture's
// layout, where the face sits in the top-left corner (measured on a 512 map).
import * as THREE from 'three/webgpu';
import { mulberry32 } from '../world/noise.js';

const EYE_L = [66, 90], EYE_R = [118, 90], NOSE = [92, 112], MOUTH = [92, 134];

export function agedFaceTexture(src, { seed = 1, wart = false, markings = null } = {}) {
  const img = src.image;
  const N = Math.min(img.width || 1024, 1024);
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  g.drawImage(img, 0, 0, N, N);
  const k = N / 512;
  const P = (x, y) => [x * k, y * k];
  const rand = mulberry32(900 + seed);
  const shade = (x, y, r, a, col = '38,24,20') => {
    const [cx, cy] = P(x, y);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r * k);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, r * k, 0, Math.PI * 2);
    g.fill();
  };
  const line = (pts, w, a, col = '45,28,22') => {
    g.strokeStyle = `rgba(${col},${a})`;
    g.lineWidth = w * k;
    g.lineCap = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => (i ? g.lineTo(...P(x, y)) : g.moveTo(...P(x, y))));
    g.stroke();
  };
  const arc = (cx, cy, half, sag, n = 8) => Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 2 - 1;
    return [cx + t * half, cy + sag * (1 - t * t)];
  });
  const crease = (pts, w = 0.9, a = 0.5) => {
    // a dark groove with a faint highlight just above it reads as a wrinkle
    line(pts.map(([x, y]) => [x, y - 0.8]), w * 0.6, a * 0.15, '235,210,190');
    line(pts, w, a);
  };

  // old skin loses its colour: pull the face towards grey before tinting
  g.save();
  g.globalCompositeOperation = 'saturation';
  g.fillStyle = 'rgba(128,128,128,0.55)';
  g.fillRect(0, 0, 180 * k, 172 * k);
  g.restore();
  g.filter = 'blur(' + (0.5 * k).toFixed(1) + 'px)';
  // weathered, uneven skin over the whole face
  for (let i = 0; i < 260; i++) shade(10 + rand() * 165, 10 + rand() * 155, 3 + rand() * 9, 0.05 + rand() * 0.08, rand() < 0.5 ? '70,45,30' : '30,35,20');
  // deep-set eyes with heavy bags beneath
  for (const [ex, ey] of [EYE_L, EYE_R]) {
    shade(ex, ey, 22, 0.62);
    shade(ex, ey + 10, 12, 0.35);
    crease(arc(ex, ey + 7, 10, 4), 0.8, 0.45);
    crease(arc(ex, ey + 12, 8, 3), 0.7, 0.3);
  }
  // crow's feet
  for (const [ex, ey, d] of [[EYE_L[0] - 14, EYE_L[1], -1], [EYE_R[0] + 14, EYE_R[1], 1]])
    for (let j = -1; j <= 1; j++) crease([[ex, ey + j * 2], [ex + d * 9, ey + j * 5 - 1]], 0.7, 0.45);
  // furrowed brow and forehead lines
  for (let j = 0; j < 4; j++) {
    const y = 48 + j * 7;
    const pts = [];
    for (let x = 58; x <= 126; x += 4) pts.push([x, y + Math.sin(x * 0.11 + j) * 1.4]);
    crease(pts, 0.9, 0.42);
  }
  crease([[86, 71], [87, 75], [88, 79]], 0.7, 0.32);
  crease([[98, 71], [97, 75], [96, 79]], 0.7, 0.32);
  // hollow cheeks and temples
  shade(50, 120, 18, 0.3);
  shade(134, 120, 18, 0.3);
  shade(40, 80, 14, 0.3);
  shade(144, 80, 14, 0.3);
  // deep folds from the nose to a downturned mouth
  crease([[84, 116], [78, 126], [79, 138]], 1, 0.42);
  crease([[100, 116], [106, 126], [105, 138]], 1, 0.42);
  crease([[82, 136], [80, 141]], 0.7, 0.35);
  crease([[102, 136], [104, 141]], 0.7, 0.35);
  // thin, pale lips and a wrinkled upper lip
  shade(MOUTH[0], MOUTH[1], 9, 0.35, '120,95,85');
  for (let j = -2; j <= 2; j++) crease([[MOUTH[0] + j * 3, MOUTH[1] - 7], [MOUTH[0] + j * 3.4, MOUTH[1] - 4]], 0.4, 0.14);
  // chin creases and a sagging jaw line
  crease([[84, 150], [92, 153], [100, 150]], 0.8, 0.3);
  shade(66, 152, 10, 0.2);
  shade(118, 152, 10, 0.2);
  // age spots
  for (let i = 0; i < 18; i++) shade(30 + rand() * 125, 30 + rand() * 120, 1.2 + rand() * 2, 0.35 + rand() * 0.3, '90,55,30');
  if (wart) {
    shade(NOSE[0] + 5, NOSE[1] - 2, 2.6, 0.9, '95,70,50');
    shade(NOSE[0] + 4.4, NOSE[1] - 2.6, 1.2, 0.6, '170,140,115');
  }
  // painted marks (woad-dark lines across the eyes, chin stripes)
  if (markings) {
    const col = markings;
    line([[48, 92], [56, 88], [128, 88], [138, 92]], 3.2, 0.75, col);
    line([[60, 100], [56, 116]], 2, 0.75, col);
    line([[124, 100], [128, 116]], 2, 0.75, col);
    for (const x of [86, 92, 98]) line([[x, 142], [x, 160]], 1.6, 0.75, col);
    line([[92, 40], [92, 62]], 2.2, 0.7, col);
  }

  g.filter = 'none';
  const t = new THREE.CanvasTexture(cv);
  t.flipY = src.flipY;
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = src.wrapS;
  t.wrapT = src.wrapT;
  return t;
}
