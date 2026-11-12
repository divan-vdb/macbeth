// The Weird Sisters' cauldron: a pot-bellied iron cauldron on three stubby
// legs over a few embers, its brew glowing witch-green, with green vapour
// curling up and a soft green light on the witches' faces.
import * as THREE from 'three/webgpu';
import { Particles } from './fire.js';
import { smokeTexture, glowTexture, rockTextures, flameTexture, barkTextures, logEndTextures } from './textures.js';
import { mulberry32 } from './noise.js';

const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);

export function createCauldron() {
  const group = new THREE.Group();
  const rand = mulberry32(4401);
  // iron, pitted and rusted: reuse the painted rock texture's normal map for the pitting
  const rock = rockTextures(31);
  const iron = new THREE.MeshStandardMaterial({ color: srgb('#24211f'), metalness: 0.75, roughness: 0.62, normalMap: rock.normalMap });
  iron.normalScale.set(0.6, 0.6);
  const prof = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14; // bottom to rim
    const r = 0.06 + Math.sin(t * Math.PI * 0.92) * 0.36 + (t > 0.85 ? (t - 0.85) * 0.25 : 0);
    prof.push(new THREE.Vector2(r, t * 0.55));
  }
  prof.push(new THREE.Vector2(prof[prof.length - 1].x + 0.03, 0.55)); // the lip
  prof.push(new THREE.Vector2(prof[prof.length - 2].x + 0.01, 0.53));
  const pot = new THREE.Mesh(new THREE.LatheGeometry(prof, 32), iron);
  pot.material.side = THREE.DoubleSide;
  pot.position.y = 0.16;
  pot.castShadow = pot.receiveShadow = true;
  group.add(pot);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.22, 7), iron);
    leg.position.set(Math.cos(a) * 0.22, 0.1, Math.sin(a) * 0.22);
    leg.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    group.add(leg);
  }
  // two ring handles
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16), iron);
    h.position.set(s * 0.42, 0.6, 0);
    h.rotation.y = Math.PI / 2;
    group.add(h);
  }
  // the brew: a glowing surface just below the rim
  const brewMat = new THREE.MeshStandardMaterial({ color: srgb('#0d2a0c'), emissive: srgb('#5cff4a'), emissiveIntensity: 1.6, roughness: 0.2 });
  const brew = new THREE.Mesh(new THREE.CircleGeometry(0.25, 28).rotateX(-Math.PI / 2), brewMat);
  brew.position.y = 0.64;
  group.add(brew);
  // A small cooking fire under the pot: split logs laid like spokes, their
  // ends charred and glowing, a bed of embers, and flames licking up the iron.
  const bt = barkTextures(), et = logEndTextures();
  const glowCol = srgb('#ff6a22');
  const bark = new THREE.MeshStandardMaterial({ map: bt.map, normalMap: bt.normalMap, emissiveMap: bt.emissiveMap, emissive: glowCol, emissiveIntensity: 1.4, roughness: 1 });
  const ends = new THREE.MeshStandardMaterial({ map: et.map, emissiveMap: et.emissiveMap, emissive: glowCol, emissiveIntensity: 1.6, roughness: 1 });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + rand() * 0.4;
    const len = 0.42 + rand() * 0.16;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.03 + rand() * 0.012, 0.038 + rand() * 0.012, len, 10, 1), [bark, ends, ends]);
    // inner end in the fire, outer end resting on the ground
    log.position.set(Math.cos(a) * (len / 2 - 0.02), 0.045, Math.sin(a) * (len / 2 - 0.02));
    log.rotation.set(0, -a, Math.PI / 2 - 0.12);
    log.rotateY(rand() * Math.PI);
    log.castShadow = true;
    group.add(log);
  }
  const emberMat = new THREE.MeshStandardMaterial({ color: srgb('#1c0e08'), emissive: srgb('#ff4a12'), emissiveIntensity: 1.5, roughness: 1 });
  const embers = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), emberMat, 26);
  const m4 = new THREE.Matrix4(), eq = new THREE.Quaternion(), ee = new THREE.Euler();
  for (let i = 0; i < 26; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 0.2;
    const sz = 0.012 + rand() * 0.022;
    m4.compose(new THREE.Vector3(Math.cos(a) * r, sz * 0.5, Math.sin(a) * r), eq.setFromEuler(ee.set(rand() * 3, rand() * 3, rand() * 3)), new THREE.Vector3(sz, sz * 0.7, sz));
    embers.setMatrixAt(i, m4);
  }
  group.add(embers);
  // the warm glow of the ember bed on the ground
  const bed = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: glowTexture(64, 0.25), color: srgb('#ff6a22'), transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  bed.position.y = 0.012;
  group.add(bed);
  const HOT = new THREE.Color(1, 0.62, 0.22), MID = new THREE.Color(1, 0.3, 0.04), COOL = new THREE.Color(0.35, 0.04, 0);
  const flames = new Particles(
    34,
    flameTexture(),
    THREE.AdditiveBlending,
    (q) => {
      const a = Math.random() * Math.PI * 2, r = 0.12 + Math.sqrt(Math.random()) * 0.26;
      q.pos.set(Math.cos(a) * r, 0.04, Math.sin(a) * r);
      // flames hug the pot: they climb outward and up around its belly
      q.vel.set(Math.cos(a) * 0.22, 0.55 + Math.random() * 0.45, Math.sin(a) * 0.22);
      q.life = 0.35 + Math.random() * 0.35;
      q.size = 0.13 + Math.random() * 0.1;
      q.seed = Math.random() * 100;
    },
    (q, k, dt, t, c) => {
      const wob = Math.sin(t * 9 + q.seed) * 0.5 + Math.sin(t * 15 + q.seed * 2) * 0.3;
      q.pos.addScaledVector(q.vel, dt);
      q.pos.x += wob * 0.12 * dt;
      q.vel.y += 0.5 * dt;
      const grow = Math.sin(Math.PI * Math.min(1, k * 1.3)) ** 0.6;
      const size = q.size * grow * (1 - k * 0.5);
      if (k < 0.4) c.copy(HOT).lerp(MID, k / 0.4);
      else c.copy(MID).lerp(COOL, (k - 0.4) / 0.6);
      c.multiplyScalar((1 - k) ** 1.1 * 0.75);
      return { sx: size, sy: size * 1.8, roll: wob * 0.2 };
    },
    3
  );
  group.add(flames.mesh);

  // green vapour curling up off the brew
  const GREEN = srgb('#7dff6a'), DARK = srgb('#1c2a22');
  const vapour = new Particles(
    14,
    smokeTexture(),
    THREE.AdditiveBlending,
    (q) => {
      q.pos.set((Math.random() - 0.5) * 0.4, 0.66, (Math.random() - 0.5) * 0.4);
      q.vel.set((Math.random() - 0.5) * 0.08, 0.28 + Math.random() * 0.2, (Math.random() - 0.5) * 0.08);
      q.life = 2.6 + Math.random() * 1.8;
      q.size = 0.3 + Math.random() * 0.25;
      q.seed = Math.random() * 6;
    },
    (q, k, dt, t, c) => {
      q.pos.addScaledVector(q.vel, dt);
      q.pos.x += Math.sin(t * 1.3 + q.seed) * 0.05 * dt;
      const size = q.size * (1 + k * 2.2);
      c.copy(GREEN).lerp(DARK, k).multiplyScalar(0.55 * (1 - k) * Math.min(1, k * 6));
      return { sx: size, sy: size, roll: q.seed + k * 2 };
    },
    3
  );
  group.add(vapour.mesh);
  // a soft glow sprite over the brew and the witch-light itself
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    new THREE.MeshBasicMaterial({ map: glowTexture(64, 0.1), color: srgb('#5cff4a'), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  halo.position.y = 0.75;
  group.add(halo);
  const light = new THREE.PointLight(srgb('#7dff6a'), 6, 7, 2);
  light.position.y = 0.95;
  group.add(light);

  let t = 0;
  const update = (dt, camera) => {
    t += dt;
    vapour.update(dt, camera, t);
    flames.update(dt, camera, t);
    const heat = 0.85 + Math.sin(t * 2.3) * 0.12 + Math.sin(t * 6.1) * 0.08 + Math.random() * 0.08;
    bark.emissiveIntensity = 1.4 * heat;
    ends.emissiveIntensity = 1.6 * heat;
    emberMat.emissiveIntensity = 1.5 * heat;
    bed.material.opacity = 0.5 + heat * 0.15;
    halo.quaternion.copy(camera.quaternion);
    const bub = 0.85 + Math.sin(t * 3.1) * 0.1 + Math.sin(t * 7.3 + 1) * 0.06;
    brewMat.emissiveIntensity = 1.6 * bub;
    light.intensity = 6 * bub;
  };
  return { group, update, light };
}
