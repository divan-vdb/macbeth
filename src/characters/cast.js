// Builds the cast from the CC0 Quaternius parts: an outfit (with its skeleton),
// a head cut from the base body, hair and brows, all bound to one skeleton,
// then costume props and an animation mixer driven by movement speed.
// Specs follow the character look guide and the Green.png style target.
import * as THREE from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { makeSword, makeCirclet, cloakTexture, gownTexture, makeBelt, makeBrooch, ragTexture, makeBoneNecklace, makeStaff } from './props.js';
import { createCloth } from './cloth.js';
import { agedFaceTexture } from './aging.js';

const BASE = new URL('../../assets/models/', import.meta.url).href;
const loader = new GLTFLoader();
// Load textures through <img> (blob: URLs are allowed by the host) rather than fetch().
loader.register((parser) => {
  parser.textureLoader = new THREE.TextureLoader(parser.options.manager);
  return { name: 'MACBETH_img_textures' };
});
function b64ToBuffer(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
// Each model is a GLB wrapped in JSON as base64: the host serves .json but not .glb,
// and its security policy blocks data: URLs, so we decode here and parse the bytes directly.
async function fetchModel(name) {
  const res = await fetch(`${BASE}${name}.json`);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  const { glb } = await res.json();
  return new Promise((resolve, reject) => loader.parse(b64ToBuffer(glb), BASE, resolve, reject));
}
// A replacement colour texture for one outfit material (small WebP in JSON), so
// several characters can share one outfit model in different colours.
async function fetchDye(name) {
  const res = await fetch(`${BASE}${name}.json`);
  const { webp, for: matName } = await res.json();
  const img = new Image();
  img.src = 'data:image/webp;base64,' + webp;
  await img.decode();
  const tex = new THREE.Texture(img);
  tex.flipY = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return { tex, matName };
}
const dyes = new Map();
const dye = (name) => {
  if (!dyes.has(name)) dyes.set(name, fetchDye(name));
  return dyes.get(name);
};

const cache = new Map();
const load = (name) => {
  if (!cache.has(name)) cache.set(name, fetchModel(name));
  return cache.get(name);
};
// other models (the animals) come through the same loader
export const loadModel = load;
const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

export const SPECS = {
  macbeth: {
    outfit: 'outfit_macbeth', head: 'head_male', parts: ['hair_simpleparted', 'hair_beard', 'eyebrows_regular'],
    hide: ['Hood'], height: 1.86, hair: '#17100b',
    cloak: { color: '#7c1616', trim: 'rgba(176,128,44,0.95)', length: 1.2 }, sword: true, idle: 'Idle_Loop', torso: 0.16,
  },
  banquo: {
    outfit: 'outfit_banquo', head: 'head_male', parts: ['hair_long', 'hair_beard', 'eyebrows_regular'],
    hide: ['Hood', 'Pauldron'], height: 1.83, hair: '#3a2618',
    cloak: { color: '#3b4a63', trim: 'rgba(150,120,70,0.9)', length: 1.15 }, sword: true, idle: 'Idle_Loop', torso: 0.16,
  },
  // Ross and Angus, the king's messengers: the Ranger outfit dyed teal, and charcoal and silver
  ross: {
    outfit: 'outfit_banquo', dye: 'dye_ross', head: 'head_male', parts: ['hair_simpleparted', 'eyebrows_regular'],
    hide: ['Hood'], height: 1.8, hair: '#3a2416',
    cloak: { color: '#123f42', trim: 'rgba(200,170,90,0.95)', length: 1.1 }, sword: true, idle: 'Idle_Loop', torso: 0.15,
  },
  // the Captain of the training yard: bald, grey-bearded, arms folded, a short dark cloak
  captain: {
    outfit: 'outfit_banquo', dye: 'dye_captain', head: 'head_male', parts: ['hair_beard', 'eyebrows_regular'],
    hide: ['Hood'], height: 1.82, hair: '#8f877a',
    cloak: { color: '#2b2418', trim: 'rgba(120,96,60,0.9)', length: 0.95 }, sword: true, idle: 'Idle_FoldArms_Loop', torso: 0.17,
  },
  angus: {
    outfit: 'outfit_banquo', dye: 'dye_angus', head: 'head_male', parts: ['hair_long', 'hair_beard', 'eyebrows_regular'],
    hide: ['Hood', 'Pauldron'], height: 1.78, hair: '#d6d1c6',
    cloak: { color: '#2a2d33', trim: 'rgba(185,188,192,0.9)', length: 1.15 }, sword: true, idle: 'Idle_Loop', torso: 0.16,
  },
  ladymacbeth: {
    outfit: 'outfit_ladymacbeth', head: 'head_female', parts: ['hair_long', 'eyebrows_female'],
    hide: ['Feet', 'Legs'], height: 1.72, hair: '#120c09', circlet: true, gown: { color: '#6a0e13' }, idle: 'Idle_FoldArms_Loop', torso: 0.13,
  },
  // The Weird Sisters share one hooded outfit, dyed three ways, over ragged
  // robes and shawls. See the character look guide.
  witch1: {
    // the leader: green-tinged skin, long grey hair, hands raised over the cauldron
    outfit: 'outfit_witch', head: 'head_female', parts: ['hair_long', 'eyebrows_female'],
    hide: ['Pauldron', 'Legs', 'Feet', 'Bracer', 'Belt'], height: 1.66, hair: '#8a877c', skin: '#a9b892',
    cloak: { color: '#28301c', length: 1.05, ragged: 1 }, gown: { color: '#333d24', ragged: 2, rope: true },
    aged: { seed: 1, wart: true }, idle: 'Spell_Simple_Idle_Loop', torso: 0.13, fit: ['Body', 'Arms', 'Hood'],
  },
  witch2: {
    // dark hair, bone jewellery, hunched and swaying
    outfit: 'outfit_witch', dye: 'dye_witch2', head: 'head_female', parts: ['hair_long', 'eyebrows_female'],
    hide: ['Pauldron', 'Legs', 'Feet', 'Belt'], height: 1.62, hair: '#16110d', skin: '#c4a487',
    cloak: { color: '#2c120e', length: 1.0, ragged: 3 }, gown: { color: '#3d1a14', ragged: 4, rope: true },
    necklace: true, aged: { seed: 2, markings: '28,34,52' }, idle: 'Zombie_Idle_Loop', torso: 0.13, fit: ['Body', 'Arms', 'Hood'],
  },
  witch3: {
    // bare-headed: wild grey-white hair, a thin silver circlet, a twisted staff
    outfit: 'outfit_witch', dye: 'dye_witch3', head: 'head_female', parts: ['hair_long', 'eyebrows_female'],
    hide: ['Pauldron', 'Legs', 'Feet', 'Hood', 'Belt'], height: 1.68, hair: '#d2cec4', skin: '#cdc6b8',
    cloak: { color: '#25292f', length: 1.08, ragged: 5 }, gown: { color: '#30353c', ragged: 6, rope: true },
    circlet: '#b9bcc0', staff: true, aged: { seed: 3 }, idle: 'Idle_Torch_Loop', torso: 0.13,
  },
};

// Keep only the triangles of the base body that belong to the head and neck.
function keepHead(mesh) {
  const g = mesh.geometry;
  const sj = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const head = new Uint8Array(sj.count);
  for (let v = 0; v < sj.count; v++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) {
      const w = sw.getComponent(v, k);
      if (w > bw) {
        bw = w;
        best = sj.getComponent(v, k);
      }
    }
    head[v] = names[best] === 'Head' || names[best] === 'neck_01' ? 1 : 0;
  }
  const src = g.index.array, out = [];
  for (let i = 0; i < src.length; i += 3) if (head[src[i]] && head[src[i + 1]] && head[src[i + 2]]) out.push(src[i], src[i + 1], src[i + 2]);
  const ng = g.clone();
  ng.setIndex(out);
  mesh.geometry = ng;
}

// Re-bind a skinned part onto the outfit's bones (matched by name).
function rebind(mesh, bones) {
  const sk = mesh.skeleton;
  const mapped = sk.bones.map((b) => bones[b.name] || bones.root);
  mesh.bind(new THREE.Skeleton(mapped, sk.boneInverses), mesh.bindMatrix);
}

// Attach an object to a bone so it sits at a given model-space pose in the rest pose.
function attach(obj, bone, model, pos, quat = new THREE.Quaternion()) {
  model.updateMatrixWorld(true);
  const want = new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
  const world = model.matrixWorld.clone().multiply(want);
  const local = bone.matrixWorld.clone().invert().multiply(world);
  local.decompose(obj.position, obj.quaternion, obj.scale);
  bone.add(obj);
}

let clipCache = null;
async function clips() {
  if (!clipCache) {
    clipCache = Promise.all([load('anims_ual1'), load('anims_ual2')]).then((gs) => {
      const all = {};
      for (const g of gs) for (const c of g.animations) all[c.name] = c;
      return all;
    });
  }
  return clipCache;
}

// Rest-pose surface points of the named outfit parts, in the character's space,
// limited to a band of heights (used to fit clothing onto the body).
function surfacePoints(model, wrap, names, y0, y1) {
  const out = [];
  const p = new THREE.Vector3();
  const inv = wrap.matrixWorld.clone().invert();
  model.traverse((o) => {
    if (!o.isSkinnedMesh || !o.visible || !names.some((n) => o.name.includes(n))) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const count = o.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) {
      o.getVertexPosition(i, p).applyMatrix4(m);
      if (p.y >= y0 && p.y <= y1) out.push(p.x, p.y, p.z);
    }
  });
  return out;
}

export async function createCharacter(id, opts = {}) {
  const spec = SPECS[id];
  const [outfitG, headG, dyed, ...partGs] = await Promise.all([load(spec.outfit), load(spec.head), spec.dye ? dye(spec.dye) : null, ...spec.parts.map(load)]);
  const anims = await clips();

  const model = cloneSkinned(outfitG.scene);
  const bones = {};
  let anchor = null;
  model.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isSkinnedMesh) {
      if (!anchor) anchor = o.parent;
      if (spec.hide.some((h) => o.name.includes(h) || (o.parent && o.parent.name.includes(h)))) o.visible = false;
    }
  });

  // head, hair and brows onto the same skeleton
  const hairTint = srgb(spec.hair);
  for (const g of [headG, ...partGs]) {
    const part = cloneSkinned(g.scene);
    const meshes = [];
    part.traverse((o) => o.isSkinnedMesh && meshes.push(o));
    for (const m of meshes) {
      const matName = (m.material && m.material.name) || '';
      if (/Superhero/.test(matName)) keepHead(m);
      if (/Hair/.test(matName)) {
        m.material = m.material.clone();
        m.material.color.copy(hairTint);
      }
      rebind(m, bones);
      anchor.add(m);
    }
  }
  // per-character colours on shared models: a dyed outfit, a skin tone
  const skinTint = spec.skin ? srgb(spec.skin) : null;
  model.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const name = o.material.name || '';
    if (dyed && name === dyed.matName) {
      o.material = o.material.clone();
      o.material.map = dyed.tex;
    }
    if (skinTint && /Superhero|Regular_(Fe)?[Mm]ale/.test(name)) {
      o.material = o.material.clone();
      o.material.color.copy(skinTint);
      if (spec.aged && /Superhero/.test(name) && o.material.map) o.material.map = agedFaceTexture(o.material.map, spec.aged);
    }
  });
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
    }
  });

  // scale to the character's height, feet on the ground
  const wrap = new THREE.Group();
  wrap.add(model);
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model, true);
  const h = box.max.y - box.min.y;
  const s = spec.height / h;
  model.scale.multiplyScalar(s);
  model.position.y = -box.min.y * s;
  model.updateMatrixWorld(true);

  // costume props, placed in the rest pose then carried by their bones
  const v = (n) => new THREE.Vector3().setFromMatrixPosition(bones[n].matrixWorld).applyMatrix4(wrap.matrixWorld.clone().invert());
  // Body shapes the cloth drapes over (world space, recomputed every step)
  const P = {};
  const wp = (n) => (P[n] || (P[n] = new THREE.Vector3())).setFromMatrixPosition(bones[n].matrixWorld);
  const up = new THREE.Vector3();
  const torsoR = spec.torso || 0.16;
  let extraColliders = null; // more shapes for the cloth to rest on (a horse's back)
  const colliders = () => {
    const pel = wp('pelvis'), neck = wp('neck_01');
    up.copy(pel).lerp(neck, 0.18);
    const more = extraColliders ? extraColliders() : [];
    return [
      ...more,
      { a: up, b: neck, r: torsoR },
      { a: pel, b: pel, r: torsoR + 0.04 },
      { a: wp('thigh_l'), b: wp('calf_l'), r: 0.095 },
      { a: P.calf_l, b: wp('foot_l'), r: 0.075 },
      { a: wp('thigh_r'), b: wp('calf_r'), r: 0.095 },
      { a: P.calf_r, b: wp('foot_r'), r: 0.075 },
      // across the shoulders and down the upper arms, so a cape rests on them
      { a: wp('upperarm_l'), b: wp('upperarm_r'), r: torsoR * 0.5 },
      { a: P.upperarm_l, b: wp('lowerarm_l'), r: torsoR * 0.42 },
      { a: P.upperarm_r, b: wp('lowerarm_r'), r: torsoR * 0.42 },
    ];
  };
  const ground = opts.ground || (() => 0);
  const clothes = [];
  let clothReady = false;

  if (spec.cloak) {
    // the top edge follows the back of the neck and rests on both shoulders
    const neck = v('neck_01'), ul = v('upperarm_l'), ur = v('upperarm_r');
    const half = Math.abs(ul.x - ur.x) / 2;
    // Fit the top edge to the outfit itself: round the back of the neck and over
    // the shoulders, sitting just on top of whatever the tunic has there.
    const pts = surfacePoints(model, wrap, spec.fit || ['Body', 'Arms'], neck.y - 0.3, neck.y + 0.04);
    const anchors = [];
    const COLS = 13;
    for (let c = 0; c < COLS; c++) {
      const th = -1.9 + (3.8 * c) / (COLS - 1); // 0 = straight down the back
      const side = Math.abs(Math.sin(th));
      // how far the body reaches out in this direction, just below the neck
      let reach = 0;
      for (let i = 0; i < pts.length; i += 3) {
        const dx = pts[i] - neck.x, dz = -(pts[i + 2] - neck.z);
        if (pts[i + 1] < neck.y - 0.16) continue;
        if (Math.abs(Math.atan2(dx, dz) - th) < 0.14) reach = Math.max(reach, Math.hypot(dx, dz));
      }
      const r = Math.min(reach || 0.12, Math.hypot(Math.sin(th) * half * 1.02, Math.cos(th) * 0.13)) + 0.012;
      const x = neck.x + Math.sin(th) * r, z = neck.z - Math.cos(th) * r;
      // and how high it rises there
      let top = -Infinity;
      for (let i = 0; i < pts.length; i += 3) if (Math.hypot(pts[i] - x, pts[i + 2] - z) < 0.035) top = Math.max(top, pts[i + 1]);
      const y = top > -Infinity ? Math.min(top + 0.012, neck.y + 0.01) : neck.y - 0.02 - 0.07 * side;
      anchors.push(new THREE.Vector3(x, y, z));
    }
    const rag = spec.cloak.ragged;
    const map = rag ? ragTexture(spec.cloak.color, rag) : cloakTexture(spec.cloak.color, spec.cloak.trim);
    const cut = rag ? { alphaTest: 0.5 } : {};
    const outer = new THREE.MeshStandardMaterial({ map, roughness: 0.93, side: THREE.BackSide, ...cut });
    const lining = new THREE.MeshStandardMaterial({ map, color: 0x8a7f7a, roughness: 0.95, side: THREE.FrontSide, ...cut });
    const cloak = createCloth({
      bone: bones.spine_03, anchors, length: spec.cloak.length, rows: 14, widen: 1.35, restBack: 0.1, shape: 0.025, yoke: 0.22,
      material: outer, innerMaterial: lining, colliders, ground, model: wrap,
    });
    wrap.add(cloak.mesh);
    clothes.push(cloak);
    if (!rag) attach(makeBrooch(), bones.spine_03, wrap, new THREE.Vector3(neck.x + half * 0.75, neck.y - 0.08, neck.z + 0.09));
  }
  if (spec.sword) {
    const hip = v('pelvis');
    attach(makeSword(), bones.pelvis, wrap, new THREE.Vector3(0.23, hip.y + 0.04, hip.z - 0.03), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.32, 0, 0.12)));
  }
  // Where things are carried on the body, measured now in the rest pose: a long
  // weapon slung diagonally across the back, over the cloak.
  const slots = {};
  {
    const neck = v('neck_01');
    const at = new THREE.Matrix4().compose(
      new THREE.Vector3(neck.x - 0.12, neck.y - 0.6, neck.z - 0.2),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, -0.5)),
      new THREE.Vector3(1, 1, 1)
    );
    slots.back = { bone: bones.spine_03, local: new THREE.Matrix4().copy(bones.spine_03.matrixWorld).invert().multiply(wrap.matrixWorld).multiply(at) };
  }
  if (spec.circlet) {
    const head = v('Head');
    attach(typeof spec.circlet === 'string' ? makeCirclet(0.098, spec.circlet) : makeCirclet(), bones.Head, wrap, new THREE.Vector3(0, head.y + 0.148, head.z - 0.004));
  }
  if (spec.necklace) {
    const neck = v('neck_01');
    attach(makeBoneNecklace(), bones.spine_03, wrap, new THREE.Vector3(neck.x, neck.y - 0.03, neck.z + 0.005));
  }

  if (spec.gown) {
    // a full skirt pinned around the waist, falling to the floor
    const hip = v('pelvis');
    const y = hip.y + 0.13, rx = 0.15, rz = 0.125;
    const anchors = [];
    const COLS = 24;
    for (let c = 0; c < COLS; c++) {
      const th = (c / COLS) * Math.PI * 2; // 0 = front
      anchors.push(new THREE.Vector3(hip.x + Math.sin(th) * rx, y, hip.z + 0.01 + Math.cos(th) * rz));
    }
    const rag = spec.gown.ragged;
    const gmap = rag ? ragTexture(spec.gown.color, rag) : gownTexture(spec.gown.color);
    const cut = rag ? { alphaTest: 0.5 } : {};
    const outer = new THREE.MeshStandardMaterial({ map: gmap, roughness: rag ? 0.95 : 0.8, side: THREE.FrontSide, ...cut });
    const innerSide = new THREE.MeshStandardMaterial({ color: rag ? 0x0d0b09 : 0x2a0709, map: rag ? gmap : null, roughness: 1, side: THREE.BackSide, ...cut });
    const gown = createCloth({
      bone: bones.pelvis, anchors, length: y - 0.03, rows: 13, loop: true, widen: 2.2, restOut: 0.1, shape: 0.06, yoke: 0.15,
      material: outer, innerMaterial: innerSide, colliders, ground, model: wrap,
    });
    wrap.add(gown.mesh);
    clothes.push(gown);
    attach(makeBelt(rx, rz, spec.gown.rope), bones.pelvis, wrap, new THREE.Vector3(hip.x, y + 0.005, hip.z + 0.01));
  }

  // animation
  const mixer = new THREE.AnimationMixer(model);
  const act = (name, loop = true) => {
    const c = anims[name];
    if (!c) return null;
    const a = mixer.clipAction(c);
    a.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.enabled = true;
    a.setEffectiveWeight(0);
    a.play();
    return a;
  };
  const A = { idle: act(spec.idle) || act('Idle_Loop'), walk: act('Walk_Loop'), jog: act('Jog_Fwd_Loop'), air: act('Jump_Loop') };
  A.idle.setEffectiveWeight(1);
  if (spec.staff) {
    // A staff held upright in the left hand: pose the idle, then set the staff
    // so it stands straight up through the fist; after that it moves with the hand.
    mixer.update(0);
    wrap.updateMatrixWorld(true);
    const hand = bones.hand_l;
    const fist = new THREE.Vector3().setFromMatrixPosition(hand.matrixWorld)
      .lerp(new THREE.Vector3().setFromMatrixPosition(bones.middle_01_l.matrixWorld), 0.75);
    const staff = makeStaff();
    staff.name = 'staff';
    const want = new THREE.Matrix4().compose(fist, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.08, 0, -0.06)), new THREE.Vector3(1, 1, 1));
    new THREE.Matrix4().copy(hand.matrixWorld).invert().multiply(want).decompose(staff.position, staff.quaternion, staff.scale);
    hand.add(staff);
  }
  const w = { idle: 1, walk: 0, jog: 0, air: 0 };
  const WALK = 2.1, JOG = 5.4;

  function update(dt, st = { speed: 0, grounded: true, wind: 0 }) {
    const sp = st.speed || 0;
    const tgt = { idle: 0, walk: 0, jog: 0, air: 0 };
    if (!st.grounded) tgt.air = 1;
    else if (sp < 0.08) tgt.idle = 1;
    else if (sp <= WALK) {
      tgt.walk = Math.min(1, sp / (WALK * 0.6));
      tgt.idle = 1 - tgt.walk;
    } else {
      tgt.jog = Math.min(1, (sp - WALK) / (JOG - WALK));
      tgt.walk = 1 - tgt.jog;
    }
    const k = Math.min(1, dt * 9);
    // a one-shot action (a blow, a throw, a block) takes over from the base blend
    let target = 0;
    if (cur) {
      const t = cur.a.time;
      for (const e of cur.events) if (!e.fired && t >= e.t) {
        e.fired = true;
        e.fn();
      }
      if (cur.hold !== null && t >= cur.hold) {
        cur.a.time = cur.hold;
        cur.a.paused = true;
      }
      const left = cur.end - t;
      target = cur.hold !== null ? 1 : left > cur.fadeOut ? 1 : Math.max(0, left / cur.fadeOut);
      if (t >= cur.end - 1e-3 && cur.hold === null) {
        cur.a.setEffectiveWeight(0);
        cur.a.stop();
        const done = cur.done;
        cur = null;
        target = 0;
        if (done) done();
      }
    }
    aw += (target - aw) * Math.min(1, dt * (target > aw ? 1 / Math.max(0.02, cur ? cur.fadeIn : 0.1) : 10));
    if (cur) cur.a.setEffectiveWeight(aw);
    for (const n in w) {
      w[n] += (tgt[n] - w[n]) * k;
      if (A[n]) A[n].setEffectiveWeight(w[n] * (1 - aw));
    }
    // match foot speed to ground speed
    if (A.walk) A.walk.timeScale = sp > 0.05 ? Math.min(1.8, Math.max(0.6, sp / 1.3)) : 1;
    if (A.jog) A.jog.timeScale = sp > WALK ? Math.min(1.8, Math.max(0.7, sp / 3.3)) : 1;
    mixer.update(dt);
    wrap.updateMatrixWorld(true);
    // a pose laid over the animation (the rider's seat on a horse)
    if (st.pose) {
      st.pose(bones);
      wrap.updateMatrixWorld(true);
    }
    if (opts.onStep && !st.pose) footfalls(dt, sp, st.grounded !== false);
    if (st.cloth !== false || !clothReady) {
      for (const c of clothes) c.update(dt, st.wind || 0);
      clothReady = true;
    }
  }

  // Footfalls, timed from the animations themselves so each sound lands exactly
  // when a foot does at any frame rate: at load we sample the walk and jog cycles,
  // note the moment each foot reaches the ground, then fire a step whenever the
  // playing cycle passes one of those moments. Landing from a jump is a heavy step.
  const contacts = opts.onStep ? footContacts() : null;
  const lastPhase = { walk: 0, jog: 0 };
  let wasGrounded = true;
  function footContacts() {
    const out = {};
    for (const name of ['walk', 'jog']) {
      const a = A[name];
      if (!a) continue;
      for (const n in A) if (A[n]) A[n].setEffectiveWeight(n === name ? 1 : 0);
      const N = 96, dur = a.getClip().duration;
      const hs = [[], []];
      for (let i = 0; i < N; i++) {
        a.time = (i / N) * dur;
        mixer.update(0);
        wrap.updateMatrixWorld(true);
        hs[0].push(bones.foot_l.matrixWorld.elements[13]);
        hs[1].push(bones.foot_r.matrixWorld.elements[13]);
      }
      out[name] = [];
      hs.forEach((h, k) => {
        // one strike per foot per cycle: the first moment after the foot's
        // highest swing that it comes down to (nearly) its lowest point
        const lo = Math.min(...h), hi = Math.max(...h), touch = lo + (hi - lo) * 0.12;
        let i = h.indexOf(hi);
        for (let n = 0; n < N && h[i] > touch; n++) i = (i + 1) % N;
        out[name].push({ at: i / N, side: k ? 1 : -1 });
      });
      a.time = 0;
    }
    for (const n in A) if (A[n]) A[n].setEffectiveWeight(n === 'idle' ? 1 : 0);
    mixer.update(0);
    return out;
  }
  function footfalls(dt, sp, grounded) {
    const name = w.jog > w.walk ? 'jog' : 'walk';
    const a = A[name];
    if (a && contacts[name]) {
      const dur = a.getClip().duration;
      const ph = (a.time % dur) / dur, prev = lastPhase[name];
      if (grounded && sp > 0.35 && w[name] > 0.3) {
        for (const c of contacts[name]) {
          const crossed = prev <= ph ? c.at > prev && c.at <= ph : c.at > prev || c.at <= ph;
          if (crossed) opts.onStep(c.side, sp, false);
        }
      }
      lastPhase.walk = A.walk ? (A.walk.time % A.walk.getClip().duration) / A.walk.getClip().duration : 0;
      lastPhase.jog = A.jog ? (A.jog.time % A.jog.getClip().duration) / A.jog.getClip().duration : 0;
    }
    if (grounded && !wasGrounded) opts.onStep(0, sp, true);
    wasGrounded = grounded;
  }

  // call after moving a character somewhere new, so its clothes re-drape there
  const settle = () => clothes.forEach((c) => c.reset());

  // ---------- carrying and holding things
  // Put a weapon or object in the right hand: its +y axis runs through the fist
  // (across the knuckles, out past the thumb), its x axis along the back of the hand.
  let held = null;
  // upright: stand it straight up through the fist instead (a spear or staff carried at rest)
  function hold(obj, { upright = false } = {}) {
    if (held && held.parent) held.parent.remove(held);
    held = null;
    if (!obj) return;
    wrap.updateMatrixWorld(true);
    const P = (b) => new THREE.Vector3().setFromMatrixPosition(bones[b].matrixWorld);
    const hand = P('hand_r'), mid = P('middle_01_r');
    const axis = P('index_01_r').sub(P('pinky_01_r')).normalize();
    const fingers = mid.clone().sub(hand);
    fingers.addScaledVector(axis, -fingers.dot(axis)).normalize();
    const z = new THREE.Vector3().crossVectors(fingers, axis);
    const grip = hand.clone().lerp(mid, 0.85).addScaledVector(z, -0.018);
    const world = new THREE.Matrix4().makeBasis(fingers, axis, z).setPosition(grip);
    if (upright) {
      // straight up, leaning a touch forward, the way a soldier carries a spear at ease
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(wrap.getWorldQuaternion(new THREE.Quaternion()));
      const up = new THREE.Vector3(0, 1, 0).addScaledVector(fwd, 0.12).normalize();
      const side = new THREE.Vector3().crossVectors(up, fwd).normalize();
      const front = new THREE.Vector3().crossVectors(side, up);
      world.makeBasis(side, up, front).setPosition(grip);
    }
    new THREE.Matrix4().copy(bones.hand_r.matrixWorld).invert().multiply(world).decompose(obj.position, obj.quaternion, obj.scale);
    bones.hand_r.add(obj);
    held = obj;
  }
  function stow(obj, slot = 'back') {
    const sl = slots[slot];
    if (!sl || !obj) return;
    if (obj.parent) obj.parent.remove(obj);
    sl.local.decompose(obj.position, obj.quaternion, obj.scale);
    sl.bone.add(obj);
  }
  // swap the standing pose (e.g. a guard stance with the sword drawn)
  function setIdle(name) {
    const a = act(name);
    if (!a || a === A.idle) return;
    a.play();
    a.setEffectiveWeight(A.idle.getEffectiveWeight());
    A.idle.setEffectiveWeight(0);
    A.idle = a;
  }
  // show or hide the hilt in the scabbard (hidden while the sword is drawn)
  function sheathed(on) {
    wrap.traverse((o) => o.userData.hilt && (o.visible = on));
  }

  // one-shot actions: perform(clip, { speed, events: [{ t, fn }], hold: seconds | null, from, to, done })
  // plays the clip once over everything else; hold pauses it at a pose until release()
  let cur = null, aw = 0;
  function perform(name, { speed = 1, fadeIn = 0.06, fadeOut = 0.14, events = [], hold = null, from = 0, to = null, done = null } = {}) {
    const a = act(name, false);
    if (!a) return null;
    if (cur && cur.a !== a) {
      cur.a.setEffectiveWeight(0);
      cur.a.stop();
    }
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.enabled = true;
    a.play();
    a.time = from;
    cur = { a, name, end: to != null ? to : a.getClip().duration, events: events.map((e) => ({ ...e, fired: false })), hold, fadeIn, fadeOut, done };
    return cur;
  }
  function release() {
    if (!cur) return;
    cur.hold = null;
    cur.a.paused = false;
  }
  const busy = () => !!cur;
  // where a bone is at each moment of a clip (to time blows to the frame a swing lands)
  function probe(name, bone = 'hand_r', N = 60) {
    const a = act(name, false);
    if (!a) return null;
    for (const n in A) if (A[n]) A[n].setEffectiveWeight(0);
    a.setEffectiveWeight(1);
    a.play();
    const dur = a.getClip().duration, out = [];
    for (let i = 0; i <= N; i++) {
      a.time = (i / N) * dur;
      mixer.update(0);
      wrap.updateMatrixWorld(true);
      const e = bones[bone].matrixWorld.elements;
      out.push([+(a.time).toFixed(3), +e[12].toFixed(3), +e[13].toFixed(3), +e[14].toFixed(3)]);
    }
    a.setEffectiveWeight(0);
    a.stop();
    A.idle.setEffectiveWeight(1);
    return out;
  }

  // speaking: talk with the hands (the sisters keep their own uncanny idles)
  const talk = (on) => setIdle(on && !/witch/.test(id) ? 'Idle_Talking_Loop' : spec.idle);
  return { root: wrap, update, settle, height: spec.height, id, bones, hold, stow, setIdle, sheathed, talk, perform, release, busy, probe,
    clothColliders: (fn) => (extraColliders = fn),
    get action() {
      return cur ? cur.name : null;
    } };
}
