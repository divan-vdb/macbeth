// Turns the Quaternius CC0 source files into compact GLBs for the web:
// textures shrunk for phones and converted to WebP, outfits recoloured per
// character (cloth dyed by hue, leather left alone), and only the animation
// clips we use.  Usage: node build-models.mjs <srcDir> <outDir>
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions';
import { prune, dedup, resample } from '@gltf-transform/functions';

const [SRC, OUT] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);

// A few texture files are referenced under slightly different names: provide them.
const alias = [
  ['base/T_Hair_1_Normal.png', 'base/T_Hair_1_Normal_png.png'],
  ['base/T_Eye_Normal.png', 'base/T_Eye_Normal_png.png'],
  ['hair/T_Hair_2_Normal.png', 'base/T_Hair_2_Normal.png'],
  ['hair/T_Hair_2_BaseColor.png', 'base/T_Hair_2_BaseColor.png'],
];
for (const [from, to] of alias) if (!fs.existsSync(path.join(SRC, to))) fs.copyFileSync(path.join(SRC, from), path.join(SRC, to));

// ---------- colour helpers
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

function sizeFor(name) {
  const n = name.toLowerCase();
  if (n.includes('eye')) return 256;
  if (n.includes('hair')) return 512;
  if (n.includes('orm') || n.includes('rough')) return 512;
  return 1024;
}

async function convert(srcRel, outName, opts = {}) {
  const doc = await io.read(path.join(SRC, srcRel));
  doc.createExtension(EXTTextureWebP).setRequired(true);
  for (const tex of doc.getRoot().listTextures()) {
    const uri = tex.getURI() || tex.getName() || 'tex';
    const size = sizeFor(uri);
    const rule = (opts.recolor || []).find((r) => uri.includes(r.match));
    const img = tex.getImage();
    const out = rule
      ? await recolor(img, size, rule.rules)
      : await sharp(img).resize(size, size).webp({ quality: uri.toLowerCase().includes('normal') ? 90 : 82 }).toBuffer();
    tex.setImage(out).setMimeType('image/webp').setURI(path.basename(uri).replace(/\.png$/i, '.webp'));
  }
  if (opts.keepAnimations === false) for (const a of doc.getRoot().listAnimations()) a.dispose();
  await doc.transform(dedup(), prune());
  const file = path.join(OUT, outName);
  await io.write(file, doc);
  console.log(outName, (fs.statSync(file).size / 1e6).toFixed(2), 'MB');
}

async function clips(srcRel, outName, keep) {
  const doc = await io.read(path.join(SRC, srcRel));
  const root = doc.getRoot();
  for (const a of root.listAnimations()) {
    if (keep.includes(a.getName())) continue;
    for (const c of a.listChannels()) c.dispose();
    for (const smp of a.listSamplers()) {
      const i = smp.getInput(), o = smp.getOutput();
      smp.dispose();
      if (i && i.listParents().length <= 1) i.dispose();
      if (o && o.listParents().length <= 1) o.dispose();
    }
    a.dispose();
  }
  for (const n of root.listNodes()) {
    if (n.getMesh()) n.setMesh(null);
    if (n.getSkin()) n.setSkin(null);
  }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const t of root.listTextures()) t.dispose();
  for (const m of root.listMaterials()) m.dispose();
  // Keep bone rotations, plus movement for the hips only; drop scale tracks.
  for (const a of root.listAnimations()) {
    for (const ch of a.listChannels()) {
      const p = ch.getTargetPath(), n = ch.getTargetNode() && ch.getTargetNode().getName();
      if (p === 'scale' || (p === 'translation' && n !== 'pelvis' && n !== 'root')) {
        const smp = ch.getSampler();
        ch.dispose();
        if (smp) {
          const i = smp.getInput(), o = smp.getOutput();
          smp.dispose();
          if (o) o.dispose();
          if (i && i.listParents().length <= 1) i.dispose();
        }
      }
    }
  }
  await doc.transform(resample({ tolerance: 1e-4 }), prune({ keepLeaves: true }));
  const file = path.join(OUT, outName);
  await io.write(file, doc);
  console.log(outName, (fs.statSync(file).size / 1e6).toFixed(2), 'MB', root.listAnimations().map((a) => a.getName()).join(', '));
}

// ---------- palettes (see the character look guide)
const GREEN = [70, 175];
const macbeth = [
  { match: 'T_Ranger_BaseColor', rules: [
    { hue: GREEN, minSat: 0.18, to: { h: 357, s: 1.05, v: 0.78 } }, // green cloth -> blood red
    { hue: [10, 50], minSat: 0.2, to: { s: 0.85, v: 0.62 } }, // leather -> darker, browner
  ] },
];
const banquo = [
  { match: 'T_Ranger_BaseColor', rules: [
    { hue: GREEN, minSat: 0.18, to: { h: 214, s: 0.5, v: 0.78 } }, // green cloth -> slate blue
    { hue: [10, 50], minSat: 0.2, to: { s: 0.8, v: 0.8 } },
  ] },
];
const ladyM = [
  { match: 'T_Peasant_BaseColor', rules: [
    { hue: [0, 360], maxSat: 0.28, minVal: 0.55, to: { h: 350, sSet: 0.62, v: 0.55 } }, // pale linen -> dark crimson sleeves
    { hue: [0, 360], minSat: 0.12, to: { h: 352, s: 1.4, v: 0.7 } }, // browns -> deep crimson velvet
  ] },
];

// The Weird Sisters: the Female Ranger (hooded) dyed to dark, worn witch colours
const witchPalette = (h, s, v) => [
  { match: 'T_Ranger_BaseColor', rules: [
    { hue: GREEN, minSat: 0.18, to: { h, s, v } }, // green cloth -> the witch's colour
    { hue: [10, 50], minSat: 0.2, to: { s: 0.55, v: 0.5 } }, // leather -> old, dark, greyed
  ] },
];
const witch1 = witchPalette(78, 0.55, 0.5); // moss green
const witch2 = witchPalette(8, 0.75, 0.42); // dried-blood brown
const witch3 = witchPalette(215, 0.18, 0.55); // ash grey

const CLIPS_ONLY = process.argv.includes('--clips-only');
const WITCHES = process.argv.includes('--witches');
if (WITCHES) {
await convert('outfits/Female_Ranger.gltf', 'outfit_witch1.glb', { recolor: witch1 });
await convert('outfits/Female_Ranger.gltf', 'outfit_witch2.glb', { recolor: witch2 });
await convert('outfits/Female_Ranger.gltf', 'outfit_witch3.glb', { recolor: witch3 });
}
if (!CLIPS_ONLY && !WITCHES) {
await convert('outfits/Male_Ranger.gltf', 'outfit_macbeth.glb', { recolor: macbeth });
await convert('outfits/Male_Ranger.gltf', 'outfit_banquo.glb', { recolor: banquo });
await convert('outfits/Female_Peasant.gltf', 'outfit_ladymacbeth.glb', { recolor: ladyM });
await convert('base/Superhero_Male_FullBody.gltf', 'head_male.glb');
await convert('base/Superhero_Female_FullBody.gltf', 'head_female.glb');
for (const h of ['Hair_Beard', 'Hair_SimpleParted', 'Hair_Long', 'Hair_Buns', 'Eyebrows_Regular', 'Eyebrows_Female']) {
 await convert(`hair/${h}.gltf`, `${h.toLowerCase()}.glb`);
}
}
await clips('anims/UAL1_Standard.glb', 'anims_ual1.glb', ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land', 'Idle_Talking_Loop', 'Walk_Formal_Loop', 'Sword_Idle', 'Spell_Simple_Idle_Loop', 'Idle_Torch_Loop']);
await clips('anims/UAL2_Standard.glb', 'anims_ual2.glb', ['Idle_FoldArms_Loop', 'Idle_Lantern_Loop', 'Zombie_Idle_Loop']);
