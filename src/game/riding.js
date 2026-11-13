// Riding. Macbeth's mare waits at a hitching rail just north of the Captain's yard. He
// mounts from her near (left) side as a horseman does, sits deep with his hands on the
// reins, and rides at a walk, a canter or (spurred on) a gallop until she is blown. A
// whistle (H, or the Horse button) calls her to him. The Captain's riding course, a loop
// of flagged gates round the yard, is laid out here too.
import * as THREE from 'three/webgpu';
import { createHorse, GAIT } from './horse.js';
import { createBeacon } from './beacon.js';
import { sfx } from '../audio.js';

// the hitching rail (posts along z) and where she stands tied to it, facing it
export const HITCH = { x: -8.6, z: 15.2 };
const TIED = { x: -6.9, z: 15.2, yaw: -Math.PI / 2 };
// the Captain's course: a loop of eight gates round the yard, kept clear of the boulders
const GATES = [[-9.5, 22], [-15, 29.5], [-24.5, 30.5], [-35.5, 24], [-36, 12.5], [-35, 0.5], [-26, -8], [-14.5, -8.5]];

export function createRiding({ scene, heightAt, RAPIER, world, player, macbeth, game, camera, isTouch, onEvent = () => {}, narrow = false }) {
  const T = (desk, touch) => (isTouch ? touch : desk);
  const fixed = (s) => {
    const d = s.kind === 'box' ? RAPIER.ColliderDesc.cuboid(...s.size) : RAPIER.ColliderDesc.ball(s.size[0]);
    d.setTranslation(s.position.x, s.position.y, s.position.z);
    if (s.quaternion) d.setRotation({ x: s.quaternion.x, y: s.quaternion.y, z: s.quaternion.z, w: s.quaternion.w });
    world.createCollider(d);
  };
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b4632, roughness: 0.95 });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x3e2f22, roughness: 1 });
  const rope = new THREE.MeshStandardMaterial({ color: 0x9c8660, roughness: 1 });

  // ---------- the hitching rail, a water trough and a heap of hay
  {
    const g = new THREE.Group();
    const y0 = heightAt(HITCH.x, HITCH.z);
    g.position.set(HITCH.x, y0, HITCH.z);
    for (const dz of [-1.3, 1.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 1.25, 8), wood);
      post.position.set(0, 0.6, dz);
      post.rotation.z = (Math.random() - 0.5) * 0.05;
      g.add(post);
      fixed({ kind: 'box', size: [0.1, 0.65, 0.1], position: new THREE.Vector3(HITCH.x, y0 + 0.62, HITCH.z + dz) });
    }
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 2.9, 8), wood);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(0, 1.05, 0);
    g.add(rail);
    fixed({ kind: 'box', size: [0.08, 0.08, 1.45], position: new THREE.Vector3(HITCH.x, y0 + 1.05, HITCH.z) });
    // the tether knotted round the rail
    const knot = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.02, 5, 10), rope);
    knot.position.set(0, 1.05, 0.15);
    knot.rotation.y = Math.PI / 2;
    g.add(knot);
    // a trough hollowed from a log, with water in it
    const trough = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.38, 1.6), darkWood);
    body.position.y = 0.19;
    trough.add(body);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.46), new THREE.MeshStandardMaterial({ color: 0x1d2a2c, roughness: 0.08, metalness: 0.3 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.385;
    trough.add(water);
    trough.position.set(-0.75, 0, 2.6);
    g.add(trough);
    fixed({ kind: 'box', size: [0.28, 0.2, 0.8], position: new THREE.Vector3(HITCH.x - 0.75, y0 + 0.2, HITCH.z + 2.6) });
    // hay: a loose heap of pale stalks
    const hay = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb59a5a, roughness: 1 }));
    hay.scale.set(1, 0.55, 1.2);
    hay.position.set(1.3, 0, -2.2);
    g.add(hay);
    g.traverse((o) => o.isMesh && (o.castShadow = o.receiveShadow = true));
    scene.add(g);
  }

  // ---------- the course: eight gates of two flagged posts, each turned across the way through
  const flagTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 32;
    const c = cv.getContext('2d');
    c.fillStyle = '#8e1a17';
    c.fillRect(0, 0, 64, 32);
    c.fillStyle = '#c99a3c';
    c.fillRect(0, 13, 64, 6);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const flagMat = new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.9, side: THREE.DoubleSide });
  const flags = [];
  const gates = GATES.map(([x, z], i) => {
    const prev = i ? GATES[i - 1] : [TIED.x, TIED.z];
    const next = GATES[i + 1] || [x + (x - prev[0]), z + (z - prev[1])];
    const dir = new THREE.Vector2(next[0] - prev[0], next[1] - prev[1]).normalize();
    const across = new THREE.Vector2(-dir.y, dir.x);
    const half = 1.9;
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const px = x + across.x * half * s, pz = z + across.y * half * s;
      const py = heightAt(px, pz);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 2.3, 7), wood);
      post.position.set(px, py + 1.1, pz);
      post.castShadow = true;
      g.add(post);
      fixed({ kind: 'ball', size: [0.12], position: new THREE.Vector3(px, py + 0.5, pz) });
      // a pennant streaming from the top, numbered by its order (a knot of rope for each)
      const geo = new THREE.PlaneGeometry(0.62, 0.34, 6, 1);
      geo.translate(0.31, 0, 0);
      const f = new THREE.Mesh(geo, flagMat);
      f.position.set(px, py + 2.05, pz);
      f.castShadow = !narrow;
      g.add(f);
      flags.push({ mesh: f, base: geo.attributes.position.array.slice(), phase: Math.random() * 6 });
      for (let k = 0; k <= i; k++) {
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 4), rope);
        kn.position.set(px, py + 1.75 - k * 0.09, pz);
        g.add(kn);
      }
    }
    scene.add(g);
    return { x, z, dir, across, half, group: g };
  });
  const beacon = createBeacon('objective', { height: 6, width: 1.0 });
  beacon.group.visible = false;
  scene.add(beacon.group);
  let course = { on: false, next: 0, times: [] };
  const lastPos = new THREE.Vector2();
  function gateCrossed(g, a, b) {
    // did the rider's path from a to b cross the line between the posts?
    const da = (a.x - g.x) * g.dir.x + (a.y - g.z) * g.dir.y;
    const db = (b.x - g.x) * g.dir.x + (b.y - g.z) * g.dir.y;
    if (da > 0 || db < 0) return false;
    const t = da / (da - db);
    const cx = a.x + (b.x - a.x) * t, cz = a.y + (b.y - a.y) * t;
    return Math.abs((cx - g.x) * g.across.x + (cz - g.z) * g.across.y) < g.half + 0.35;
  }

  // ---------- the mare
  let horse = null, spot = null;
  let mode = 'foot'; // 'mounting', 'riding', 'dismounting'
  let t = 0, wind = 100, blown = false, runHeld = 0, gaitName = 'stand', poseW = 0, lean = 0;
  let owned = false, galloped = false;
  const from = new THREE.Vector3(), side = new THREE.Vector3(), pelvisStart = new THREE.Vector3(), target = new THREE.Vector3();
  const seatP = new THREE.Vector3(), seatQ = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  const offL = new THREE.Vector3(0, 0.95, 0); // the rider's hips above his root, kept up to date
  const hands = [new THREE.Vector3(), new THREE.Vector3()];
  const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), qc = new THREE.Quaternion(), ident = new THREE.Quaternion();
  const bones = macbeth.bones;
  const ease = (x) => x * x * (3 - 2 * x);

  // the rider's seat laid over the sitting pose: thighs round her barrel, heels down,
  // hands low in front on the reins, and a forward lean that grows with the pace
  const L = (x, y, z) => new THREE.Vector3(x, y, z).normalize();
  const SEAT = [
    ['thigh_l', 'calf_l', L(0.46, -0.6, 0.62)], ['thigh_r', 'calf_r', L(-0.46, -0.6, 0.62)],
    ['calf_l', 'foot_l', L(0.1, -0.95, -0.22)], ['calf_r', 'foot_r', L(-0.1, -0.95, -0.22)],
    ['foot_l', 'ball_l', L(0.12, -0.3, 0.95)], ['foot_r', 'ball_r', L(-0.12, -0.3, 0.95)],
    ['upperarm_l', 'lowerarm_l', L(0.16, -0.88, 0.38)], ['upperarm_r', 'lowerarm_r', L(-0.16, -0.88, 0.38)],
    ['lowerarm_l', 'hand_l', L(-0.32, -0.12, 0.94)], ['lowerarm_r', 'hand_r', L(0.32, -0.12, 0.94)],
  ].filter(([a, b]) => bones[a] && bones[b]);
  function aim(bone, child, dirLocal, w) {
    v1.copy(dirLocal).applyQuaternion(macbeth.root.quaternion);
    bone.getWorldPosition(v2);
    const cur = child.getWorldPosition(new THREE.Vector3()).sub(v2).normalize();
    qa.setFromUnitVectors(cur, v1);
    if (w < 1) qa.copy(ident).slerp(qa, w);
    turnBone(bone, qa);
  }
  function turnBone(bone, qWorld) {
    bone.getWorldQuaternion(qb);
    bone.parent.getWorldQuaternion(qc);
    bone.quaternion.copy(qc.invert().multiply(qWorld.clone().multiply(qb)));
    bone.updateMatrixWorld(true);
  }
  const spineDir = new THREE.Vector3(), neckDir = new THREE.Vector3(0, 1, 0.2).normalize();
  function riderPose() {
    if (poseW <= 0.001) return;
    // sit up (the sitting clip slouches), leaning forward into the pace; head up, eyes ahead
    if (bones.spine_01 && bones.neck_01) aim(bones.spine_01, bones.neck_01, spineDir.set(0, 1, lean).normalize(), poseW);
    if (bones.neck_01 && bones.Head) aim(bones.neck_01, bones.Head, neckDir, poseW);
    for (const [a, b, d] of SEAT) aim(bones[a], bones[b], d, poseW);
  }
  // keep the rider's hips on the saddle: place his root from where his hips sat last frame
  function placeRider(dt, pelvisAt, quat, opts = {}) {
    macbeth.root.quaternion.copy(quat);
    macbeth.root.position.copy(pelvisAt).sub(v1.copy(offL).applyQuaternion(quat));
    macbeth.root.updateMatrixWorld(true);
    macbeth.update(dt, { speed: opts.speed || 0, grounded: true, wind: opts.wind || 0, pose: opts.pose ? riderPose : null });
    if (bones.pelvis) {
      // correct for any drift in the pose, and remember the hips' place for next time
      bones.pelvis.getWorldPosition(v2);
      const d = v1.copy(pelvisAt).sub(v2);
      macbeth.root.position.add(d);
      macbeth.root.updateMatrixWorld(true);
      offL.copy(pelvisAt).sub(macbeth.root.position).applyQuaternion(q1.copy(quat).invert());
    }
  }

  const ride = {
    heading: 0, speed: 0, locked: true,
    turnRate: (v) => (v < 2.6 ? 2.1 : v < 6 ? 1.5 : 1.1),
    gait(input, dt, mag) {
      if (!input) {
        runHeld = 0;
        setGait('stand');
        wind = Math.min(100, wind + 16 * dt);
        if (blown && wind > 45) blown = false;
        return 0;
      }
      runHeld = input.run ? runHeld + dt : 0;
      const g = input.run ? (runHeld > 1.0 && !blown ? 'gallop' : 'canter') : 'walk';
      if (g === 'gallop') {
        wind = Math.max(0, wind - 9 * dt);
        if (wind <= 0 && !blown) {
          blown = true;
          sfx('snort');
          game.toast('Your mare is blown. Ease her to a canter and she will get her wind back.', 'warn');
        }
      } else wind = Math.min(100, wind + (g === 'walk' ? 14 : 5) * dt);
      if (blown && wind > 45) blown = false;
      setGait(g);
      return g === 'walk' ? GAIT.walk.speed * Math.max(0.45, Math.min(1, mag / 0.75)) : GAIT[g].speed;
    },
    frame(dt, ground, heading, speed, w) {
      horse.drive(ground.x, ground.z, heading, speed);
      horse.update(dt, { camera, surface: 'heath' });
      horse.seat(seatP, seatQ);
      const pelvisSeat = target.copy(seatP).addScaledVector(up.set(0, 1, 0).applyQuaternion(seatQ), 0.06);
      if (mode === 'mounting') mountFrame(dt, pelvisSeat, w);
      else if (mode === 'dismounting') dismountFrame(dt, pelvisSeat, w);
      else {
        const wantLean = gaitName === 'gallop' ? 0.5 : gaitName === 'canter' ? 0.26 : 0.08;
        lean += (wantLean - lean) * Math.min(1, dt * 3);
        placeRider(dt, pelvisSeat, seatQ, { pose: true, wind: w });
        bones.hand_r.getWorldPosition(hands[0]);
        bones.hand_l.getWorldPosition(hands[1]);
        horse.reins(hands);
        courseCheck(ground);
      }
    },
  };
  function setGait(g) {
    if (g === gaitName) return;
    if (g === 'gallop') {
      if (Math.random() < 0.6) sfx('whinny');
      if (!galloped) {
        galloped = true;
        onEvent('gallop');
      }
    }
    gaitName = g;
  }

  // mounting: step to her near side, then up into the saddle
  const MOUNT_WALK = 0.5, MOUNT_RISE = 0.85;
  function mountFrame(dt, pelvisSeat, w) {
    t += dt;
    const hy = horse.state.yaw;
    yawQ.setFromAxisAngle(up.set(0, 1, 0), hy);
    // her near side, level with the stirrup
    side.set(0.78, 0, 0.12).applyQuaternion(yawQ).add(horse.root.position);
    side.y = heightAt(side.x, side.z);
    if (t < MOUNT_WALK) {
      const k = ease(t / MOUNT_WALK);
      macbeth.root.position.lerpVectors(from, side, k);
      macbeth.root.quaternion.slerpQuaternions(fromQ, yawQ, k);
      macbeth.update(dt, { speed: from.distanceTo(side) / MOUNT_WALK, grounded: true, wind: w });
      if (bones.pelvis) bones.pelvis.getWorldPosition(pelvisStart);
      horse.reins(null);
      return;
    }
    if (!rose) {
      rose = true;
      macbeth.setIdle('Sitting_Idle_Loop');
      sfx('saddle');
    }
    const k = Math.min(1, (t - MOUNT_WALK) / MOUNT_RISE);
    const e = ease(k);
    poseW = e;
    lean = 0.08 * e;
    const at = v2.lerpVectors(pelvisStart, pelvisSeat, e).addScaledVector(up.set(0, 1, 0), Math.sin(e * Math.PI) * 0.28);
    placeRider(dt, at.clone(), q1.slerpQuaternions(yawQ, seatQ, e).clone(), { pose: true, wind: w });
    if (k >= 1) {
      mode = 'riding';
      ride.locked = false;
      poseW = 1;
      game.tip('ride', T('Steer with W A S D (or the mouse and W). Hold Shift to canter, keep holding to gallop. E to dismount. H whistles for her.', 'Push the stick where you want to go; push to the edge to canter, hold it there to gallop. Tap the button to dismount.'));
      onEvent('mounted');
    } else horse.reins(null);
  }
  const fromQ = new THREE.Quaternion();
  let rose = false;
  function mount() {
    if (!horse || mode !== 'foot' || game.state.dead) return;
    if (game.equipped !== 'fists') game.equip('fists', true);
    from.copy(macbeth.root.position);
    fromQ.copy(macbeth.root.quaternion);
    horse.setRider(true);
    ride.heading = horse.state.yaw;
    player.setRide(ride);
    player.teleport(horse.state.x, horse.state.z);
    ride.locked = true;
    mode = 'mounting';
    t = 0;
    rose = false;
    macbeth.clothColliders(() => horse.backCapsule());
    poseW = 0;
    owned = true;
    horse.state.tied = false;
  }

  // dismounting: swing down on the near side
  const DISMOUNT = 0.9;
  function dismountFrame(dt, pelvisSeat, w) {
    t += dt;
    const k = Math.min(1, t / DISMOUNT);
    const e = ease(k);
    yawQ.setFromAxisAngle(up.set(0, 1, 0), horse.state.yaw);
    side.set(0.95, 0, 0.1).applyQuaternion(yawQ).add(horse.root.position);
    side.y = heightAt(side.x, side.z);
    const standHips = v2.copy(side).add(up.set(0, 0.93, 0));
    poseW = 1 - e;
    const at = new THREE.Vector3().lerpVectors(pelvisSeat, standHips, e).addScaledVector(up.set(0, 1, 0), Math.sin(e * Math.PI) * 0.2);
    placeRider(dt, at, q1.slerpQuaternions(seatQ, yawQ, e).clone(), { pose: true, wind: w });
    horse.reins(null);
    if (k >= 1) finishDismount(side);
  }
  function finishDismount(at) {
    mode = 'foot';
    macbeth.clothColliders(null);
    poseW = 0;
    lean = 0;
    macbeth.setIdle('Idle_Loop');
    const yaw = horse.state.yaw;
    player.setRide(null);
    player.teleport(at.x, at.z);
    player.setFacing(yaw);
    macbeth.root.quaternion.identity();
    macbeth.root.rotation.set(0, yaw, 0);
    horse.setRider(false);
    horse.state.speed = 0;
    setGait('stand');
  }
  function dismount(instant = false) {
    if (mode === 'foot' || mode === 'dismounting') return;
    if (instant) {
      yawQ.setFromAxisAngle(up.set(0, 1, 0), horse.state.yaw);
      const at = side.set(1.1, 0, 0).applyQuaternion(yawQ).add(horse.root.position);
      finishDismount(at.clone());
      horse.reins(null);
      return;
    }
    if (player.speed > 2.8) return game.toast('Rein her in to a walk before you get down.', 'warn');
    sfx('saddle');
    ride.locked = true;
    mode = 'dismounting';
    t = 0;
  }

  function call() {
    if (!horse || mode !== 'foot') return;
    const p = player.position;
    const d = Math.hypot(horse.state.x - p.x, horse.state.z - p.z);
    sfx('whistle');
    if (d < 4) return;
    setTimeout(() => sfx(d > 20 ? 'whinny' : 'snort'), 650);
    horse.call(p.x, p.z);
    owned = true;
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT') return;
    if (e.code === 'KeyH') call();
  });

  // ---------- the course: the next gate glows; passing it in order counts
  function courseCheck(ground) {
    const b = new THREE.Vector2(ground.x, ground.z);
    if (course.on && course.next < gates.length && lastPos.lengthSq() > 0) {
      const g = gates[course.next];
      if (gateCrossed(g, lastPos, b)) {
        course.next++;
        sfx('objective');
        onEvent('gate', { index: course.next, of: gates.length });
      }
    }
    lastPos.copy(b);
  }
  let flagT = 0;
  function updateFlags(dt) {
    flagT += dt;
    // pennants stream with the wind, more at the tip than at the post
    for (const f of flags) {
      const pos = f.mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = f.base[i * 3];
        const k = bx / 0.62;
        pos.array[i * 3 + 2] = Math.sin(flagT * 6 + f.phase - bx * 7) * 0.07 * k;
        pos.array[i * 3 + 1] = f.base[i * 3 + 1] - k * 0.06;
      }
      pos.needsUpdate = true;
    }
  }

  const ready = createHorse({ scene, heightAt, RAPIER, world, at: TIED, yaw: TIED.yaw, narrow }).then((h) => {
    horse = h;
    horse.reins(null);
    spot = game.addSpot({ id: 'horse', pos: horse.root.position, radius: 3.3, label: 'Mount your horse', act: () => (mode === 'foot' ? mount() : dismount()) });
    if (pending) api.set(pending);
    return h;
  });
  let pending = null;

  const api = {
    ready,
    gates,
    get horse() {
      return horse;
    },
    get mounted() {
      return mode !== 'foot';
    },
    get riding() {
      return mode === 'riding';
    },
    get wind() {
      return wind;
    },
    get gait() {
      return gaitName;
    },
    get owned() {
      return owned;
    },
    mount,
    dismount,
    call,
    // out of a scene's way: she trots off a little and waits
    sendAway() {
      if (!horse || mode !== 'foot') return;
      const y = horse.state.yaw;
      const x = horse.state.x - Math.sin(y) * 9, z = horse.state.z - Math.cos(y) * 9;
      horse.place(x, z, y);
    },
    // the course
    startCourse() {
      course = { on: true, next: 0 };
      lastPos.set(0, 0);
    },
    stopCourse() {
      course.on = false;
    },
    get nextGate() {
      return course.on && course.next < gates.length ? gates[course.next] : null;
    },
    update(dt) {
      updateFlags(dt);
      if (!horse) return;
      if (mode === 'foot') {
        horse.update(dt, { camera, surface: 'heath' });
        horse.reins(null);
        wind = Math.min(100, wind + 10 * dt);
      }
      // the prompt: get up, or get down
      if (spot) {
        spot.label = mode === 'foot' ? 'Mount your horse' : player.speed > 2.8 ? 'Rein in to dismount' : 'Dismount';
        spot.radius = mode === 'foot' ? 3.3 : 50;
      }
      // the next gate glows
      const g = api.nextGate;
      beacon.group.visible = !!g;
      if (g) {
        beacon.group.position.set(g.x, heightAt(g.x, g.z), g.z);
        beacon.update(dt, camera, player.position);
      }
      if (document.body.classList.contains('riding') !== (mode !== 'foot')) document.body.classList.toggle('riding', mode !== 'foot');
      // a phone button to whistle for her when she is out of reach
      if (horseBtn) horseBtn.hidden = mode !== 'foot' || !owned || Math.hypot(horse.state.x - player.position.x, horse.state.z - player.position.z) < 6;
    },
    // saved with the game: where she was left, and whether she is Macbeth's to call
    get() {
      return horse ? { x: +horse.state.x.toFixed(2), z: +horse.state.z.toFixed(2), yaw: +horse.state.yaw.toFixed(2), owned, tied: horse.state.tied } : pending;
    },
    set(v) {
      if (!v) return;
      if (!horse) return void (pending = v);
      owned = !!v.owned;
      if (!v.tied && Number.isFinite(v.x)) {
        horse.place(v.x, v.z, v.yaw || 0);
        horse.state.tied = false;
      }
    },
  };
  const horseBtn = isTouch ? document.getElementById('btn-horse') : null;
  if (horseBtn) horseBtn.addEventListener('click', () => call());
  return api;
}
