// Every texture is painted in code on a canvas: no image files, no downloads, no cost.
import * as THREE from 'three/webgpu';
import { tileFbm, tileNoise, mulberry32, smoothstep } from './noise.js';

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, g: cv.getContext('2d') };
}

function tex(cv, { srgb = true, repeat = 1 } = {}) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

// Height field (0..1) -> tangent-space normal map, wrapping at the edges.
function normalFromHeight(h, n, strength) {
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  const at = (x, y) => h[((y + n) % n) * n + ((x + n) % n)];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * n + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return cv;
}

// Weathered granite with cracks and pale lichen
export function rockTextures(seed = 7) {
  const n = 256, P = 6;
  const h = new Float32Array(n * n);
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  const rand = mulberry32(seed);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * P, v = (y / n) * P;
      const base = tileFbm(u, v, P, 6, seed);
      const ridge = 1 - Math.abs(tileNoise(u * 2, v * 2, P * 2, seed + 3) * 2 - 1);
      const crack = smoothstep(0.93, 0.99, ridge);
      const height = base - crack * 0.1;
      h[y * n + x] = height;
      const lichen = smoothstep(0.58, 0.7, tileFbm(u * 1.5, v * 1.5, P * 1.5, 4, seed + 9));
      const speck = (rand() - 0.5) * 0.08;
      let r = 0.42 + base * 0.32 + speck, gg = 0.41 + base * 0.31 + speck, b = 0.38 + base * 0.29 + speck;
      r -= crack * 0.05; gg -= crack * 0.05; b -= crack * 0.045;
      const pale = tileNoise(u * 6, v * 6, P * 6, seed + 5) > 0.5;
      const lr = pale ? 0.78 : 0.56, lg = pale ? 0.77 : 0.6, lb = pale ? 0.64 : 0.36;
      r += (lr - r) * lichen * 0.8; gg += (lg - gg) * lichen * 0.8; b += (lb - b) * lichen * 0.8;
      const i = (y * n + x) * 4;
      img.data[i] = Math.max(0, Math.min(1, r)) * 255;
      img.data[i + 1] = Math.max(0, Math.min(1, gg)) * 255;
      img.data[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return { map: tex(cv), normalMap: tex(normalFromHeight(h, n, 6), { srgb: false }) };
}

// Close-cropped moorland turf. Kept near-neutral: the terrain's vertex colours supply the hue.
export function groundTextures() {
  const n = 256, P = 8;
  const h = new Float32Array(n * n);
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * P, v = (y / n) * P;
      const clump = tileFbm(u, v, P, 5, 21);
      const fine = tileNoise(u * 8, v * 8, P * 8, 23);
      h[y * n + x] = clump * 0.7 + fine * 0.3;
      const l = 0.72 + clump * 0.35 + (fine - 0.5) * 0.12;
      const i = (y * n + x) * 4;
      img.data[i] = l * 230;
      img.data[i + 1] = l * 236;
      img.data[i + 2] = l * 212;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  // Short grass strokes, drawn wrapped so the tile repeats without seams
  const rand = mulberry32(99);
  g.lineCap = 'round';
  for (let k = 0; k < 1500; k++) {
    const x = rand() * n, y = rand() * n;
    const len = 2 + rand() * 6, ang = -Math.PI / 2 + (rand() - 0.5) * 1.2;
    const light = rand() > 0.5;
    g.strokeStyle = light ? `rgba(255,255,235,${0.12 + rand() * 0.15})` : `rgba(40,45,25,${0.1 + rand() * 0.15})`;
    g.lineWidth = 0.8 + rand();
    for (const ox of [-n, 0, n]) {
      for (const oy of [-n, 0, n]) {
        g.beginPath();
        g.moveTo(x + ox, y + oy);
        g.lineTo(x + ox + Math.cos(ang) * len, y + oy + Math.sin(ang) * len);
        g.stroke();
      }
    }
  }
  return { map: tex(cv, { repeat: 48 }), normalMap: tex(normalFromHeight(h, n, 4), { srgb: false, repeat: 48 }) };
}

// Blades for grass tufts, near-white so instance colours tint them
export function grassTexture() {
  const { cv, g } = canvas(128, 128);
  const rand = mulberry32(5);
  for (let k = 0; k < 16; k++) {
    const bx = 8 + rand() * 112, tipX = bx + (rand() - 0.5) * 50, tipY = 6 + rand() * 50, w = 2 + rand() * 3;
    const grad = g.createLinearGradient(0, 128, 0, tipY);
    grad.addColorStop(0, 'rgb(165,172,140)');
    grad.addColorStop(1, `rgb(${225 + rand() * 30},${230 + rand() * 25},${200 + rand() * 30})`);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(bx - w, 128);
    g.quadraticCurveTo(bx - w * 0.5, (128 + tipY) / 2, tipX, tipY);
    g.quadraticCurveTo(bx + w * 0.5, (128 + tipY) / 2, bx + w, 128);
    g.closePath();
    g.fill();
  }
  const t = tex(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Ash and charcoal for the fire pit floor, fading out at the rim
export function ashTexture() {
  const n = 128;
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x / n - 0.5, dy = y / n - 0.5;
      const r = Math.hypot(dx, dy) * 2;
      const nz = tileFbm((x / n) * 6, (y / n) * 6, 6, 4, 41);
      const ash = 0.12 + nz * 0.35 + smoothstep(0.3, 0.9, r) * 0.15;
      const i = (y * n + x) * 4;
      img.data[i] = ash * 255;
      img.data[i + 1] = ash * 245;
      img.data[i + 2] = ash * 235;
      img.data[i + 3] = (1 - smoothstep(0.75, 1.0, r + (nz - 0.5) * 0.2)) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = tex(cv);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

// Bark for the logs
// Firewood: plated, furrowed bark (like old oak or pine), charred and checked
// toward both ends, plus an emissive map so the cracks in the char glow.
const hash1 = (i, s) => {
  const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const barkCache = new Map();
export function barkTextures(seed = 61) {
  if (!barkCache.has(seed)) barkCache.set(seed, paintBark(seed));
  return barkCache.get(seed);
}
function paintBark(seed) {
  const n = 256;
  const h = new Float32Array(n * n);
  const { cv, g } = canvas(n, n);
  const { cv: ecv, g: eg } = canvas(n, n);
  const img = g.createImageData(n, n), eimg = eg.createImageData(n, n);
  const rand = mulberry32(seed);
  const STRIPS = 9; // bark ridges round the log
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = x / n, v = y / n; // u wraps round the log, v runs along it
      // ridges of bark run along the log, wandering a little
      const uu = u * STRIPS + (tileFbm(u * 3, v * 2.5, 3, 3, seed + 1) - 0.5) * 1.1;
      const strip = ((Math.floor(uu) % STRIPS) + STRIPS) % STRIPS;
      const fu = uu - Math.floor(uu);
      const across = Math.min(fu, 1 - fu); // 0 at a furrow, 0.5 mid-ridge
      // each ridge breaks into plates of its own length
      const vv = v * (5 + hash1(strip, seed) * 4) + hash1(strip, seed + 1) * 3 + (tileFbm(u * 8, v * 3, 8, 2, seed + 2) - 0.5) * 0.4;
      const fv = vv - Math.floor(vv);
      const along = Math.min(fv, 1 - fv);
      const grain = tileFbm(u * 48, v * 5, 48, 3, seed + 3);
      const furrow = 1 - smoothstep(0.02, 0.14, across);
      const crackAcross = (1 - smoothstep(0.0, 0.035, along)) * smoothstep(0.08, 0.2, across);
      const plateTop = smoothstep(0.05, 0.3, across);
      let height = plateTop * (0.75 + grain * 0.25) - crackAcross * 0.35;
      // colours: weathered grey-brown plates, warm dark furrows
      const weather = tileFbm(u * 6, v * 4, 6, 3, seed + 4);
      const speck = (rand() - 0.5) * 0.04;
      let r = 0.25 + grain * 0.1 + weather * 0.1 + speck, gg = 0.2 + grain * 0.08 + weather * 0.08 + speck, b = 0.15 + grain * 0.06 + weather * 0.06 + speck;
      const lichen = smoothstep(0.64, 0.78, tileFbm(u * 5, v * 3, 5, 4, seed + 8)) * plateTop;
      r += (0.5 - r) * lichen * 0.5; gg += (0.52 - gg) * lichen * 0.5; b += (0.4 - b) * lichen * 0.5;
      const dark = Math.max(furrow, crackAcross);
      r += (0.1 - r) * dark; gg += (0.055 - gg) * dark; b += (0.03 - b) * dark;
      // char creeping in from both ends, with an uneven edge, scorched beyond it
      const edge = Math.min(v, 1 - v) + (tileFbm(u * 3, v * 1.5, 3, 3, seed + 10) - 0.5) * 0.22 + (tileFbm(u * 12, v * 6, 12, 2, seed + 9) - 0.5) * 0.05;
      const char = 1 - smoothstep(0.1, 0.2, edge);
      const scorch = 1 - smoothstep(0.14, 0.34, edge);
      r *= 1 - scorch * 0.5; gg *= 1 - scorch * 0.55; b *= 1 - scorch * 0.6;
      // checked, blocky "alligator" char
      const rowF = v * 26 + (tileFbm(u * 6, v * 4, 6, 2, seed + 11) - 0.5) * 1.4;
      const row = Math.floor(rowF);
      const colF = u * 18 + hash1(row, seed + 5) * 0.9 + (tileFbm(u * 4, v * 8, 4, 2, seed + 12) - 0.5) * 1.2;
      const cu = colF - Math.floor(colF), cvv = rowF - row;
      const check = Math.max(1 - smoothstep(0, 0.07, Math.min(cu, 1 - cu)), 1 - smoothstep(0, 0.09, Math.min(cvv, 1 - cvv)));
      const blockTop = 0.07 + grain * 0.06 + hash1(row * 31 + Math.floor(colF), seed + 6) * 0.05;
      const cr = blockTop * (1 - check * 0.8);
      r += (cr - r) * char; gg += (cr * 0.95 - gg) * char; b += (cr * 0.9 - b) * char;
      height = height * (1 - char) + (0.7 - check * 0.6) * char;
      h[y * n + x] = height;
      const i = (y * n + x) * 4;
      img.data[i] = Math.max(0, Math.min(1, r)) * 255;
      img.data[i + 1] = Math.max(0, Math.min(1, gg)) * 255;
      img.data[i + 2] = Math.max(0, Math.min(1, b)) * 255;
      img.data[i + 3] = 255;
      // glow lives deep in the checks, nearest the burning ends
      const hot = 1 - smoothstep(0.02, 0.13, edge);
      const flick = 0.25 + smoothstep(0.35, 0.7, tileFbm(u * 7, v * 5, 7, 2, seed + 13));
      const heat = (char * check * hot * 0.9 + char * hot * hot * 0.08) * flick;
      eimg.data[i] = Math.min(1, heat) * 255;
      eimg.data[i + 1] = Math.min(1, heat * 0.36) * 255;
      eimg.data[i + 2] = Math.min(1, heat * 0.07) * 255;
      eimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  eg.putImageData(eimg, 0, 0);
  return { map: tex(cv), normalMap: tex(normalFromHeight(h, n, 4), { srgb: false }), emissiveMap: tex(ecv) };
}

// The cut end of a burning log: growth rings, radial checks and glowing char.
const endCache = new Map();
export function logEndTextures(seed = 71) {
  if (!endCache.has(seed)) endCache.set(seed, paintLogEnd(seed));
  return endCache.get(seed);
}
function paintLogEnd(seed) {
  const n = 128;
  const { cv, g } = canvas(n, n);
  const { cv: ecv, g: eg } = canvas(n, n);
  const img = g.createImageData(n, n), eimg = eg.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = x / n - 0.5, dy = y / n - 0.5;
      const rr = Math.hypot(dx, dy) * 2; // 0 centre, 1 bark
      const a = Math.atan2(dy, dx) / (Math.PI * 2) + 0.5;
      const wob = (tileFbm(a * 6, rr * 2, 6, 3, seed) - 0.5) * 0.06;
      const rings = 0.5 + 0.5 * Math.sin((rr + wob) * 64);
      const spoke = a * 7 + (tileFbm(a * 5, rr * 3, 5, 2, seed + 2) - 0.5) * 0.5;
      const fs = spoke - Math.floor(spoke);
      const crack = (1 - smoothstep(0, 0.05, Math.min(fs, 1 - fs))) * smoothstep(0.2, 0.45, rr) * (1 - smoothstep(0.86, 0.9, rr));
      const barkRim = smoothstep(0.86, 0.9, rr);
      const l = (0.08 + rings * 0.03) * (1 - crack * 0.8) * (1 - barkRim * 0.4);
      const i = (y * n + x) * 4;
      img.data[i] = l * 255 * 1.05;
      img.data[i + 1] = l * 255;
      img.data[i + 2] = l * 255 * 0.92;
      img.data[i + 3] = 255;
      const heat = Math.min(1, crack * 0.85 + (1 - smoothstep(0.0, 0.8, rr)) * rings * 0.12);
      eimg.data[i] = heat * 255;
      eimg.data[i + 1] = heat * 0.36 * 255;
      eimg.data[i + 2] = heat * 0.07 * 255;
      eimg.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  eg.putImageData(eimg, 0, 0);
  return { map: tex(cv), emissiveMap: tex(ecv) };
}

// Soft round glow (stars, halos, sparks)
// A star as a lens sees it: a tight bright point with only a faint skirt of light.
export function starTexture(size = 64) {
  const { cv, g } = canvas(size, size);
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
      const a = Math.min(1, Math.exp(-((r / 0.2) ** 2)) + 0.05 * Math.exp(-((r / 0.55) ** 2))) * Math.max(0, 1 - r);
      const i = (y * size + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a * 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function glowTexture(size = 64, core = 0.15) {
  const { cv, g } = canvas(size, size);
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(core, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Teardrop flame puff with ragged edges
export function flameTexture() {
  const w = 64, h = 128;
  const { cv, g } = canvas(w, h);
  g.save();
  g.translate(w / 2, h * 0.68);
  g.scale(1, 2.1);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, w / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.18)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, w / 2, 0, Math.PI * 2);
  g.fill();
  g.restore();
  const img = g.getImageData(0, 0, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4 + 3;
      img.data[i] *= 0.55 + tileNoise((x / w) * 6, (y / h) * 12, 64, 77) * 0.6;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Soft billowing smoke puff
export function smokeTexture() {
  const n = 64;
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const r = Math.hypot(x / n - 0.5, y / n - 0.5) * 2;
      const nz = tileFbm((x / n) * 4, (y / n) * 4, 4, 4, 88);
      const a = Math.max(0, 1 - r) ** 1.5 * (0.4 + nz * 0.9);
      const i = (y * n + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(1, a) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The moon's face: pale disc with darker seas and a few craters
export function moonTexture() {
  const w = 256, h = 128;
  const { cv, g } = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sea = smoothstep(0.5, 0.62, tileFbm((x / w) * 8, (y / h) * 4, 8, 5, 31));
      const fine = tileNoise((x / w) * 64, (y / h) * 32, 64, 33);
      const l = 0.92 - sea * 0.28 + (fine - 0.5) * 0.06;
      const i = (y * w + x) * 4;
      img.data[i] = l * 240;
      img.data[i + 1] = l * 242;
      img.data[i + 2] = l * 246;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const rand = mulberry32(12);
  for (let k = 0; k < 40; k++) {
    const x = rand() * w, y = 10 + rand() * (h - 20), r = 1 + rand() * 4;
    g.strokeStyle = 'rgba(120,120,130,0.35)';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Overcast cloud layer: patchy, thinning out towards its edge
export function cloudTexture() {
  const n = 512, P = 5;
  const { cv, g } = canvas(n, n);
  const img = g.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x / n) * P, v = (y / n) * P;
      const c = tileFbm(u, v, P, 6, 51);
      const edge = 1 - smoothstep(0.55, 1.0, Math.hypot(x / n - 0.5, y / n - 0.5) * 2);
      const a = smoothstep(0.46, 0.72, c) * edge;
      const l = 0.75 + (c - 0.5) * 0.6;
      const i = (y * n + x) * 4;
      img.data[i] = l * 255;
      img.data[i + 1] = l * 255;
      img.data[i + 2] = l * 255;
      img.data[i + 3] = a * 235;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Milky Way haze: a long soft streak
export function milkyTexture() {
  const w = 256, h = 64;
  const { cv, g } = canvas(w, h);
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const across = Math.exp(-(((y / h - 0.5) * 3.2) ** 2)) * smoothstep(0, 0.3, Math.min(y / h, 1 - y / h)); // fades to nothing at the edges
      const along = Math.sin((x / w) * Math.PI);
      const nz = tileFbm((x / w) * 8, (y / h) * 2, 8, 5, 71);
      const dust = smoothstep(0.5, 0.78, tileFbm((x / w) * 16, (y / h) * 4, 16, 4, 73));
      const a = across * along * (0.35 + nz * 0.9) * (1 - dust * 0.4);
      const i = (y * w + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.min(1, a) * 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
