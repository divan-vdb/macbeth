// Macbeth's horse: a dark bay from the CC0 Quaternius animal pack, saddled and bridled in
// code (a saddle cloth in Macbeth's red with a gold border, a leather saddle, stirrups,
// girth, bridle and reins). She walks, canters and gallops, blends her gaits by speed,
// leans into slopes, grazes and shakes her head when left alone, comes when called, and
// her hoofbeats are timed from her own legs.
import * as THREE from 'three/webgpu';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { loadModel } from '../characters/cast.js';
import { cloakTexture } from '../characters/props.js';
import { hoof, sfx } from '../audio.js';

const SCALE = 0.48; // the model's back stands 3.41 units high: 1.64 m at the saddle
// gaits: ground speed (m/s), the clip, and its playback rate at that speed
export const GAIT = {
  walk: { speed: 1.6 },
  canter: { speed: 4.6 },
  gallop: { speed: 8.8 },
};
const RADIUS = 0.62, HALF = 0.42; // her collider while she stands or comes to a call

export async function createHorse({ scene, heightAt, RAPIER, world, at, yaw = 0, narrow = false }) {
  const gltf = await loadModel('horse');
  const model = gltf.scene;
  model.scale.setScalar(SCALE);
  const root = new THREE.Group();
  root.rotation.order = 'YXZ';
  root.add(model);
  scene.add(root);
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material && o.material.isMeshStandardMaterial) {
        o.material.roughness = /Eye/.test(o.material.name) ? 0.25 : /Hooves/.test(o.material.name) ? 0.6 : 0.78;
        o.material.metalness = 0;
      }
    }
  });
  const B = {};
  model.traverse((o) => o.isBone && (B[o.name] = o));
  model.updateMatrixWorld(true);

  // ---------- tack, built in the model's own units (it is scaled with her) and carried by her bones
  const leather = new THREE.MeshStandardMaterial({ color: 0x3b2414, roughness: 0.62 });
  const darkLeather = new THREE.MeshStandardMaterial({ color: 0x24160d, roughness: 0.7 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x77726a, roughness: 0.38, metalness: 0.85 });
  const clothTex = cloakTexture('#7c1616', 'rgba(176,128,44,0.95)');
  clothTex.wrapS = THREE.ClampToEdgeWrapping;
  const cloth = new THREE.MeshStandardMaterial({ map: clothTex, roughness: 0.92, side: THREE.DoubleSide });
  const tack = new THREE.Group();
  model.add(tack);
  const put = (mesh, x, y, z, rx = 0, ry = 0, rz = 0) => {
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    mesh.castShadow = true;
    tack.add(mesh);
    return mesh;
  };
  // a band that wraps the barrel: part of an ellipse round (0, cy), from angle a0 to a1
  // (0 = the top of her back), running along z from z0 to z1
  function wrapBand(cy, rx, ry, a0, a1, z0, z1, mat, segs = 24, hem = 0) {
    const g = new THREE.BufferGeometry();
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= segs; i++) {
      const a = a0 + ((a1 - a0) * i) / segs;
      for (let j = 0; j <= 1; j++) {
        const z = j ? z1 : z0;
        // a little flare at the hem, as cloth falls away from the body
        const flare = 1 + Math.max(0, Math.abs(a) - 0.9) * hem;
        pos.push(Math.sin(a) * rx * flare, cy + Math.cos(a) * ry, z);
        uv.push(i / segs, j);
      }
    }
    for (let i = 0; i < segs; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  }
  // the barrel under the saddle: top 3.41, belly 2.03, half-width 0.53 (model units)
  const CY = 2.72;
  // saddle cloth: red wool to below the saddle flaps, the gold border at its hem
  const blanket = put(wrapBand(CY, 0.575, 0.735, -1.25, 1.25, -0.55, 0.85, cloth, 24, 0.1), 0, 0, 0);
  blanket.geometry.attributes.uv.array.forEach((v, i, a) => {
    // map the cloth's hem (the texture's bottom band) to both lower edges
    if (i % 2 === 1) a[i] = 1 - Math.abs((a[i - 1] - 0.5) * 2) * 0.96;
  });
  // girth: under the belly, just behind the forelegs
  put(wrapBand(CY, 0.565, 0.725, 1.1, Math.PI * 2 - 1.1, 0.42, 0.56, darkLeather, 18), 0, 0, 0);
  // the saddle: seat, raised pommel and cantle, and the skirts over the cloth
  put(new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.12, 0.98, 3, 0.05), leather), 0, 3.47, 0.16);
  put(new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.2, 0.17, 3, 0.06), leather), 0, 3.58, 0.62, -0.35);
  const cantle = put(new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.055, 6, 14, Math.PI), leather), 0, 3.5, -0.3, -0.25);
  cantle.scale.set(1, 0.55, 1);
  for (const s of [-1, 1]) {
    put(new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.5, 0.66, 2, 0.02), leather), s * 0.575, 3.16, 0.16, 0, 0, s * 0.32);
    // stirrup leather and iron
    put(new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.86, 0.07), darkLeather), s * 0.66, 2.78, 0.26, 0, 0, s * 0.06);
    const st = put(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.022, 6, 12), iron), s * 0.7, 2.26, 0.26, 0, Math.PI / 2, 0);
    st.scale.set(1, 1.15, 1);
    put(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.16), iron), s * 0.7, 2.16, 0.26);
  }
  // breast collar strap across the chest
  put(wrapBand(2.85, 0.5, 0.55, -1.0, 1.0, 1.38, 1.48, darkLeather, 12), 0, 0, 0).rotation.x = 0.35;
  // carry the saddle and cloth with the middle of her back
  const back = B.Torso2 || B.Torso;
  back.attach(tack);
  // the seat: where a rider's hips sit (the saddle's top, centred)
  const seat = new THREE.Object3D();
  seat.position.set(0, 3.53, 0.12);
  model.add(seat);
  back.attach(seat);

  // bridle on the head: noseband, cheekpieces, browband, crown, and the bit rings
  const bridle = new THREE.Group();
  model.add(bridle);
  const strap = (a, b, w = 0.05, t = 0.02, grp = bridle) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, t, A.distanceTo(Bv)), darkLeather);
    m.position.copy(A).add(Bv).multiplyScalar(0.5);
    m.lookAt(m.position.clone().add(Bv.clone().sub(A)));
    m.castShadow = true;
    grp.add(m);
    return m;
  };
  const nose = new THREE.Mesh(new THREE.TorusGeometry(1, 0.022, 5, 20), darkLeather);
  nose.scale.set(0.215, 0.3, 1);
  nose.position.set(0, 3.86, 3.02);
  nose.rotation.x = 0.82;
  bridle.add(nose);
  for (const s of [-1, 1]) {
    strap([s * 0.205, 3.9, 2.98], [s * 0.235, 4.42, 2.5]);
    strap([s * 0.235, 4.42, 2.5], [s * 0.05, 4.63, 2.5]);
    strap([s * 0.23, 4.38, 2.58], [0, 4.46, 2.74]);
    strap([s * 0.2, 3.88, 3.02], [s * 0.17, 3.6, 3.18], 0.04);
  }
  const bits = [-1, 1].map((s) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 5, 10), iron);
    r.position.set(s * 0.175, 3.58, 3.2);
    r.rotation.y = Math.PI / 2;
    bridle.add(r);
    return r;
  });
  B.Head.attach(bridle);
  const pommelAnchor = new THREE.Object3D();
  pommelAnchor.position.set(0, 3.66, 0.66);
  model.add(pommelAnchor);
  back.attach(pommelAnchor);

  // reins: two thin leather lines in the world from the bit to the rider's hands
  // (or, with no rider, looped over her neck to the pommel)
  const reinGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 1, 5, 1, true);
  reinGeo.translate(0, 0.5, 0);
  reinGeo.rotateX(Math.PI / 2);
  const reins = [0, 1].map(() => {
    const m = new THREE.Mesh(reinGeo, darkLeather);
    m.castShadow = !narrow;
    scene.add(m);
    return m;
  });
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vm = new THREE.Vector3();
  function setRein(m, a, b) {
    m.position.copy(a);
    m.scale.set(1, 1, Math.max(0.01, a.distanceTo(b)));
    m.lookAt(b);
  }

  // ---------- animation: gaits blended by speed, idle habits, and one-shots
  const mixer = new THREE.AnimationMixer(model);
  const clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  const A = {};
  for (const n of ['Idle', 'Idle_2', 'Idle_Headlow', 'Eating', 'Walk', 'Gallop']) {
    A[n] = mixer.clipAction(clips[n]);
    A[n].play();
    A[n].setEffectiveWeight(n === 'Idle' ? 1 : 0);
  }
  const W = { Idle: 1, Idle_2: 0, Idle_Headlow: 0, Eating: 0, Walk: 0, Gallop: 0 };
  let habit = 'Idle', habitLeft = 6;
  let shot = null; // a one-shot (a rear, a start) over everything else

  // hoofbeats: the moment each hoof meets the ground, measured from the clips at load
  function contacts(clip) {
    const legs = [['FrontLowerLegL', 'FFL'], ['FrontLowerLegR', 'FFR'], ['BackLowerLegL', 'FFBL'], ['BackLowerLegR', 'FFBR']];
    const off = legs.map(([b, t]) => {
      const q = new THREE.Quaternion();
      B[b].getWorldQuaternion(q);
      return new THREE.Vector3().setFromMatrixPosition(B[t].matrixWorld).sub(new THREE.Vector3().setFromMatrixPosition(B[b].matrixWorld)).applyQuaternion(q.invert());
    });
    const a = mixer.clipAction(clips[clip].clone());
    for (const n in A) A[n].setEffectiveWeight(0);
    a.play();
    const N = 96, ys = legs.map(() => []);
    const q = new THREE.Quaternion(), p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      a.time = (clips[clip].duration * i) / N;
      mixer.update(0);
      model.updateMatrixWorld(true);
      legs.forEach(([b], k) => {
        B[b].getWorldQuaternion(q);
        p.setFromMatrixPosition(B[b].matrixWorld).add(off[k].clone().applyQuaternion(q));
        ys[k].push(p.y);
      });
    }
    a.stop();
    mixer.uncacheAction(a.getClip());
    const out = [];
    ys.forEach((y, k) => {
      const mn = Math.min(...y), mx = Math.max(...y), th = mn + (mx - mn) * 0.15;
      for (let i = 0; i < N; i++) if (y[(i + N - 1) % N] > th && y[i] <= th) out.push({ t: i / N, leg: k });
    });
    return out.sort((x, y) => x.t - y.t);
  }
  const beats = { Walk: contacts('Walk'), Gallop: contacts('Gallop') };
  for (const n in A) A[n].setEffectiveWeight(W[n]);
  mixer.update(0);
  const lastPhase = { Walk: 0, Gallop: 0 };

  // ---------- her body in the world (while she stands, grazes or comes to a call)
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(at.x, heightAt(at.x, at.z) + HALF + RADIUS, at.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS), body);
  const cc = world.createCharacterController(0.03);
  cc.enableAutostep(0.4, 0.25, false);
  cc.enableSnapToGround(0.5);
  cc.setMaxSlopeClimbAngle((42 * Math.PI) / 180);

  const st = {
    x: at.x, z: at.z, yaw, speed: 0, pitch: 0,
    rider: false, // carried by the player's controller while ridden
    goal: null, // { x, z, stop } when called
    tied: true,
  };
  const avoid = { t: 0, dir: 1, stuck: 0, tries: 0 };
  root.position.set(at.x, heightAt(at.x, at.z), at.z);
  root.rotation.y = yaw;

  // where she is on the ground, turned and pitched to the slope under her
  function placeRoot(dt) {
    const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw);
    const hf = heightAt(st.x + fx * 1.1, st.z + fz * 1.1), hb = heightAt(st.x - fx * 1.1, st.z - fz * 1.1);
    st.pitch += (Math.atan2(hf - hb, 2.2) - st.pitch) * Math.min(1, dt * 6);
    root.position.set(st.x, (hf + hb) * 0.5, st.z);
    root.rotation.y = st.yaw;
    root.rotation.x = -st.pitch;
  }

  function update(dt, { camera, surface = 'heath' } = {}) {
    // riderless: stand, graze, or come when called
    if (!st.rider) {
      let want = 0;
      if (st.goal) {
        const dx = st.goal.x - st.x, dz = st.goal.z - st.z, d = Math.hypot(dx, dz);
        if (d < (st.goal.stop || 2.8)) {
          st.goal = null;
          if (st.speed > 3) sfx('snort');
        } else {
          want = d > 14 ? GAIT.canter.speed : GAIT.walk.speed * Math.min(1, 0.5 + d / 6);
          // stepping round a stone that blocked her: bear off to one side for a moment
          if (avoid.t > 0) avoid.t -= dt;
          const target = Math.atan2(dx, dz) + (avoid.t > 0 ? avoid.dir * 1.15 : 0);
          const dy = Math.atan2(Math.sin(target - st.yaw), Math.cos(target - st.yaw));
          st.yaw += Math.max(-1, Math.min(1, dy)) * Math.min(1, dt * 2.6);
          if (Math.abs(dy) > 1.2) want *= 0.4;
        }
      }
      st.speed += (want - st.speed) * Math.min(1, dt * (want > st.speed ? 1.4 : 3));
      if (st.speed > 0.02) {
        const p = body.translation();
        cc.computeColliderMovement(collider, { x: Math.sin(st.yaw) * st.speed * dt, y: -9.8 * dt, z: Math.cos(st.yaw) * st.speed * dt });
        const m = cc.computedMovement();
        const nx = p.x + m.x, nz = p.z + m.z;
        const ny = Math.max(p.y + m.y, heightAt(nx, nz) + HALF + RADIUS - 0.05);
        body.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
        // blocked by a stone: she bears off round it, and gives up after a few tries
        const moved = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
        if (st.goal && moved < st.speed * 0.3 && st.speed > 0.6) {
          avoid.stuck += dt;
          if (avoid.stuck > 0.25 && avoid.t <= 0) {
            avoid.tries++;
            avoid.t = 1.3;
            avoid.dir = avoid.tries % 2 ? 1 : -1;
            avoid.stuck = 0;
            if (avoid.tries > 5) st.goal = null;
          }
        } else avoid.stuck = 0;
        st.x = nx;
        st.z = nz;
      }
    }
    placeRoot(dt);

    // gait weights from speed
    const sp = st.speed;
    const tgt = { Idle: 0, Idle_2: 0, Idle_Headlow: 0, Eating: 0, Walk: 0, Gallop: 0 };
    if (sp < 0.12) {
      habitLeft -= dt;
      if (habitLeft <= 0) {
        // her habits when standing: grazing (not with a rider), a toss of the head, a look about
        const pool = st.rider ? ['Idle', 'Idle', 'Idle_2'] : ['Idle', 'Eating', 'Eating', 'Idle_2', 'Idle_Headlow'];
        habit = pool[Math.floor(Math.random() * pool.length)];
        habitLeft = habit === 'Eating' ? 6 + Math.random() * 6 : 3.3 + Math.random() * 3;
        if (habit === 'Idle_2' && Math.random() < 0.5) setTimeout(() => sfx('snort'), 600);
        A[habit].time = 0;
      }
      if (st.rider && habit === 'Eating') habit = 'Idle';
      tgt[habit] = 1;
    } else if (sp < 2.6) {
      tgt.Walk = Math.min(1, sp / 0.5);
      tgt.Idle = 1 - tgt.Walk;
    } else {
      tgt.Gallop = Math.min(1, (sp - 2.6) / 1.2);
      tgt.Walk = 1 - tgt.Gallop;
    }
    const k = Math.min(1, dt * 5);
    for (const n in W) {
      W[n] += (tgt[n] - W[n]) * k;
      A[n].setEffectiveWeight(W[n] * (shot ? 1 - shot.w : 1));
    }
    A.Walk.timeScale = sp > 0.05 ? Math.min(2.2, Math.max(0.6, (sp / GAIT.walk.speed) * 1.45)) : 1;
    A.Gallop.timeScale = Math.min(1.6, Math.max(0.8, 0.75 + (sp - 3) * 0.12));
    if (shot) {
      shot.t += dt;
      shot.w = Math.min(1, shot.t / 0.15) * Math.min(1, (shot.end - shot.t) / 0.2);
      shot.a.setEffectiveWeight(Math.max(0, shot.w));
      if (shot.t >= shot.end) {
        shot.a.stop();
        shot = null;
      }
    }
    mixer.update(dt);
    root.updateMatrixWorld(true);

    // hoofbeats from whichever gait is carrying her
    for (const n of ['Walk', 'Gallop']) {
      if (W[n] < 0.35 || sp < 0.15) {
        lastPhase[n] = (A[n].time / A[n].getClip().duration) % 1;
        continue;
      }
      const ph = (A[n].time / A[n].getClip().duration) % 1;
      const prev = lastPhase[n];
      for (const b of beats[n]) {
        const crossed = prev <= ph ? b.t > prev && b.t <= ph : b.t > prev || b.t <= ph;
        if (crossed) {
          let pan = 0, dist = 0;
          if (camera) {
            const c = camera.position;
            dist = Math.hypot(st.x - c.x, st.z - c.z);
            const r = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            pan = Math.max(-1, Math.min(1, ((st.x - c.x) * r.x + (st.z - c.z) * r.z) / Math.max(4, dist)));
          }
          hoof({ gait: n === 'Walk' ? 'walk' : sp > 6.5 ? 'gallop' : 'canter', front: b.leg < 2, pan, dist, surface: typeof surface === 'function' ? surface(st.x, st.z) : surface });
        }
      }
      lastPhase[n] = ph;
    }
  }

  const tmpQ = new THREE.Quaternion();
  // her back as a capsule in the world, for a rider's cloak to fall over
  const backA = new THREE.Vector3(), backB = new THREE.Vector3();
  const back0 = new THREE.Vector3(0, 2.78, -1.35), back1 = new THREE.Vector3(0, 2.86, 0.95);
  const backCap = [{ a: backA, b: backB, r: 0.31 }];
  return {
    backCapsule() {
      backA.copy(back0).applyMatrix4(model.matrixWorld);
      backB.copy(back1).applyMatrix4(model.matrixWorld);
      return backCap;
    },
    root,
    bones: B,
    state: st,
    get position() {
      return root.position;
    },
    update,
    // the reins: to the rider's hands, or looped up to the pommel
    reins(hands) {
      bits.forEach((b, i) => {
        b.getWorldPosition(va);
        if (hands) vb.copy(hands[i]);
        else pommelAnchor.getWorldPosition(vb).add(vm.set(i ? -0.06 : 0.06, 0, 0));
        setRein(reins[i], va, vb);
      });
    },
    // where a rider sits, in the world
    seat(pos, quat) {
      seat.getWorldPosition(pos);
      seat.getWorldQuaternion(quat || tmpQ);
    },
    // move her bodily (a respawn, a mount and dismount)
    place(x, z, y = st.yaw) {
      st.x = x;
      st.z = z;
      st.yaw = y;
      body.setTranslation({ x, y: heightAt(x, z) + HALF + RADIUS, z }, true);
      placeRoot(1);
    },
    // ridden: her own collider steps aside (the rider's controller carries her)
    setRider(on) {
      st.rider = on;
      st.goal = null;
      collider.setEnabled(!on);
      if (!on) body.setTranslation({ x: st.x, y: heightAt(st.x, st.z) + HALF + RADIUS, z: st.z }, true);
    },
    // driven by the rider's controller
    drive(x, z, yaw, speed) {
      st.x = x;
      st.z = z;
      st.yaw = yaw;
      st.speed = speed;
    },
    call(x, z) {
      st.tied = false;
      st.goal = { x, z, stop: 2.4 };
      avoid.tries = 0;
      avoid.t = 0;
    },
    // a one-shot over everything: a rear ('Attack_Kick'), a start ('Idle_HitReact1')
    play(name, speed = 1) {
      if (!clips[name] || shot) return;
      const a = mixer.clipAction(clips[name]);
      a.reset();
      a.setLoop(THREE.LoopOnce, 1);
      a.timeScale = speed;
      a.play();
      shot = { a, t: 0, w: 0, end: clips[name].duration / speed };
    },
    get busy() {
      return !!shot;
    },
  };
}
