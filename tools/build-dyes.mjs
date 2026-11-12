// Dye files: a recoloured Ranger cloth texture (WebP, base64 in JSON) that lets
// several characters share one outfit model in different colours (src/characters/cast.js).
// usage: node build-dyes.mjs <assets-src> <assets/models>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const [SRC, OUT] = process.argv.slice(2);
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
}
const inHue = (h, a, b) => (a <= b ? h >= a && h <= b : h >= a || h <= b);

// rules: [{ hue:[a,b], minSat, minVal?, maxSat?, to:{ h?, s?(scale), v?(scale), sSet?, vSet? } }]
async function recolor(buf, size, rules) {
  const { data, info } = await sharp(buf).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    let [h, s, v] = rgb2hsv(r, g, b);
    for (const R of rules) {
      if (!inHue(h, R.hue[0], R.hue[1]) || s < (R.minSat ?? 0) || s > (R.maxSat ?? 1) || v < (R.minVal ?? 0)) continue;
      if (R.to.h !== undefined) h = R.to.h;
      s = Math.min(1, R.to.sSet ?? s * (R.to.s ?? 1));
      v = Math.min(1, v * (R.to.v ?? 1));
      const [nr, ng, nb] = hsv2rgb(h, s, v);
      data[i] = nr * 255;
      data[i + 1] = ng * 255;
      data[i + 2] = nb * 255;
      break;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).webp({ quality: 82 }).toBuffer();
}

const GREEN = [70, 175];
const DYES = {
  // Ross: a quick messenger in deep sea teal, good leather
  dye_ross: [
    { hue: GREEN, minSat: 0.18, to: { h: 183, s: 0.85, v: 0.6 } },
    { hue: [10, 50], minSat: 0.2, to: { s: 0.9, v: 0.7 } },
  ],
  // Angus: an older lord in charcoal and silver-grey
  dye_angus: [
    { hue: GREEN, minSat: 0.18, to: { h: 220, sSet: 0.1, v: 0.62 } },
    { hue: [10, 50], minSat: 0.2, to: { s: 0.45, v: 0.48 } },
  ],
};
const png = fs.readFileSync(path.join(SRC, 'outfits/T_Ranger_BaseColor.png'));
for (const [name, rules] of Object.entries(DYES)) {
  const webp = await recolor(png, 1024, rules);
  fs.writeFileSync(path.join(OUT, name + '.json'), JSON.stringify({ format: 'webp-base64', for: 'MI_Ranger', webp: webp.toString('base64') }));
  console.log(name, webp.length);
}
