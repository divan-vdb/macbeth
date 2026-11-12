// Particle fire: many soft flame puffs rising, shrinking and cooling from
// yellow to red, plus sparks and smoke. Organic because no two puffs match.
import * as THREE from 'three/webgpu';
import { flameTexture, smokeTexture, glowTexture } from './textures.js';

export class Particles {
  constructor(count, map, blending, spawn, step, renderOrder) {
    this.count = count;
    this.spawn = spawn;
    this.step = step;
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending, fog: true });
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), mat, count);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.p = Array.from({ length: count }, () => ({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), age: 0, life: 1, size: 1, seed: Math.random() }));
    this.p.forEach((q) => {
      this.spawn(q);
      q.age = Math.random() * q.life; // start mid-flight so the fire is lit from the first frame
    });
    this.m4 = new THREE.Matrix4();
    this.s = new THREE.Vector3();
    this.c = new THREE.Color();
    this.q = new THREE.Quaternion();
    this.roll = new THREE.Quaternion();
    this.z = new THREE.Vector3(0, 0, 1);
  }
  update(dt, camera, t) {
    for (let i = 0; i < this.count; i++) {
      const q = this.p[i];
      q.age += dt;
      if (q.age >= q.life) {
        this.spawn(q);
        q.age = 0;
      }
      const k = q.age / q.life;
      const out = this.step(q, k, dt, t, this.c);
      this.roll.setFromAxisAngle(this.z, out.roll || 0);
      this.q.copy(camera.quaternion).multiply(this.roll);
      this.s.set(out.sx, out.sy, 1);
      this.m4.compose(q.pos, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m4);
      this.mesh.setColorAt(i, this.c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const HOT = new THREE.Color(1.0, 0.86, 0.55);
const MID = new THREE.Color(1.0, 0.45, 0.1);
const COOL = new THREE.Color(0.45, 0.06, 0.0);

export function createFire(origin, narrow) {
  const group = new THREE.Group();
  group.position.copy(origin);

  const flames = new Particles(
    narrow ? 60 : 90,
    flameTexture(),
    THREE.AdditiveBlending,
    (q) => {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.42;
      q.pos.set(Math.cos(a) * r, 0.08, Math.sin(a) * r);
      q.vel.set(-q.pos.x * 0.6, 1.1 + Math.random() * 0.9, -q.pos.z * 0.6);
      q.life = 0.55 + Math.random() * 0.55 - r * 0.4;
      q.size = 0.38 + Math.random() * 0.3 - r * 0.25;
      q.seed = Math.random() * 100;
    },
    (q, k, dt, t, c) => {
      const wob = Math.sin(t * 7 + q.seed) * 0.5 + Math.sin(t * 13 + q.seed * 2) * 0.3;
      q.pos.addScaledVector(q.vel, dt);
      q.pos.x += wob * 0.35 * dt;
      q.pos.z += Math.cos(t * 6 + q.seed) * 0.3 * dt;
      q.vel.y += 0.6 * dt;
      const grow = Math.sin(Math.PI * Math.min(1, k * 1.25)) ** 0.6;
      const size = q.size * grow * (1 - k * 0.55);
      if (k < 0.4) c.copy(HOT).lerp(MID, k / 0.4);
      else c.copy(MID).lerp(COOL, (k - 0.4) / 0.6);
      c.multiplyScalar((1 - k) ** 1.1 * 0.85);
      return { sx: size, sy: size * 1.7, roll: wob * 0.25 };
    },
    3
  );

  const sparks = new Particles(
    narrow ? 18 : 30,
    glowTexture(32, 0.2),
    THREE.AdditiveBlending,
    (q) => {
      q.pos.set((Math.random() - 0.5) * 0.5, 0.3, (Math.random() - 0.5) * 0.5);
      q.vel.set((Math.random() - 0.5) * 0.9, 1.8 + Math.random() * 2.4, (Math.random() - 0.5) * 0.9);
      q.life = 0.9 + Math.random() * 1.6;
      q.size = 0.035 + Math.random() * 0.04;
      q.seed = Math.random() * 100;
    },
    (q, k, dt, t, c) => {
      q.vel.x += Math.sin(t * 5 + q.seed) * 1.5 * dt;
      q.vel.z += Math.cos(t * 4 + q.seed) * 1.5 * dt;
      q.vel.y -= 0.4 * dt;
      q.pos.addScaledVector(q.vel, dt);
      const flick = 0.6 + Math.abs(Math.sin(t * 30 + q.seed)) * 0.4;
      c.copy(MID).lerp(HOT, 0.4).multiplyScalar((1 - k) * flick * 1.6);
      return { sx: q.size, sy: q.size };
    },
    4
  );

  const smoke = new Particles(
    narrow ? 14 : 22,
    smokeTexture(),
    THREE.NormalBlending,
    (q) => {
      q.pos.set((Math.random() - 0.5) * 0.4, 1.3, (Math.random() - 0.5) * 0.4);
      q.vel.set((Math.random() - 0.5) * 0.15, 0.55 + Math.random() * 0.35, (Math.random() - 0.5) * 0.15);
      q.life = 3.5 + Math.random() * 2.5;
      q.size = 0.6 + Math.random() * 0.4;
      q.seed = Math.random() * 6;
    },
    (q, k, dt, t, c) => {
      q.pos.addScaledVector(q.vel, dt);
      q.pos.x += 0.25 * dt; // gentle drift downwind
      const size = q.size * (1 + k * 3.2);
      // fade into the night: glows warm near the fire, cools to the fog colour
      const warm = Math.max(0, 1 - k * 3);
      c.setRGB(0.09 + warm * 0.25, 0.085 + warm * 0.1, 0.09 + warm * 0.02).lerp(SMOKE_END, k);
      return { sx: size, sy: size, roll: q.seed + k * 1.5 };
    },
    2
  );
  smoke.mesh.material.opacity = 0.55;

  group.add(smoke.mesh, flames.mesh, sparks.mesh);

  // The fire's light: flickers and shifts so shadows move
  const light = new THREE.PointLight(new THREE.Color().setStyle('#ff8a3a', THREE.SRGBColorSpace), 55, 45, 2);
  light.position.set(0, 0.9, 0);
  if (!narrow) {
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.bias = -0.002;
    light.shadow.camera.near = 0.3;
  }
  group.add(light);

  let t = 0;
  const update = (dt, camera) => {
    t += dt;
    flames.update(dt, camera, t);
    sparks.update(dt, camera, t);
    smoke.update(dt, camera, t);
    const flick = 0.78 + Math.sin(t * 11.3) * 0.07 + Math.sin(t * 6.1 + 1.3) * 0.09 + Math.sin(t * 23.7) * 0.04 + Math.random() * 0.08;
    light.intensity = 58 * flick;
    light.position.set(Math.sin(t * 5.3) * 0.08, 0.85 + Math.sin(t * 7.9) * 0.06, Math.cos(t * 4.1) * 0.08);
  };
  return { group, update, light };
}

const SMOKE_END = new THREE.Color().setStyle('#26303f', THREE.SRGBColorSpace);
