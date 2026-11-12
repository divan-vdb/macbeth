// GLB -> {"format":"glb-base64","glb":"..."} JSON wrapper. Some static hosts serve .json but
// not .glb/.bin, and strict security policies block fetching data: URIs, so the game decodes the base64
// itself and hands the bytes straight to GLTFLoader.parse (see src/characters/cast.js).
import fs from 'fs';
import path from 'path';
const [src, dst] = process.argv.slice(2);
fs.mkdirSync(dst, { recursive: true });
for (const f of fs.readdirSync(src).filter((n) => n.endsWith('.glb'))) {
  const b = fs.readFileSync(path.join(src, f));
  if (b.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB: ' + f);
  const out = path.join(dst, f.replace(/\.glb$/, '.json'));
  fs.writeFileSync(out, JSON.stringify({ format: 'glb-base64', glb: b.toString('base64') }));
  console.log(path.basename(out), (fs.statSync(out).size / 1e6).toFixed(2), 'MB');
}
