// Quaternius animal (glTF with embedded buffers) -> a lean GLB for the game: keeps only the
// clips we use, resamples and dedupes the keyframes, welds the mesh.
// usage: node build-animal.mjs <in.gltf> <out.glb> Clip1,Clip2,...
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, resample, weld } from '@gltf-transform/functions';
const [src, dst, keepArg] = process.argv.slice(2);
const keep = new Set((keepArg || '').split(',').filter(Boolean));
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(src);
for (const a of doc.getRoot().listAnimations()) if (keep.size && !keep.has(a.getName())) a.dispose();
await doc.transform(resample({ tolerance: 1e-4 }), dedup(), weld(), prune());
await io.write(dst, doc);
console.log(dst, doc.getRoot().listAnimations().map((a) => a.getName()).join(' '));
