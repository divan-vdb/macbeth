// Combat: blows with the sword and fists (light combos, a heavy blow, the block),
// and throws of the spear and stones that fly in a true arc, stick in what they hit
// and can be fetched back. Targets (training dummies now, foes later) register here.
import * as THREE from 'three/webgpu';
import { makePebble } from '../characters/props.js';
import { sfx, impact } from '../audio.js';

// clip, the moment the blow lands (clip seconds), playback speed, power, stamina, reach
const BLOWS = {
  sword: {
    light: [
      { clip: 'Sword_Regular_A', hit: 0.25, speed: 0.85, power: 1, cost: 6, reach: 1.9 },
      { clip: 'Sword_Regular_B', hit: 0.27, speed: 0.85, power: 1, cost: 6, reach: 1.9 },
      { clip: 'Sword_Regular_C', hit: 0.67, speed: 1.0, power: 1.6, cost: 10, reach: 2.0, to: 1.25 },
    ],
    heavy: { clip: 'Sword_Attack', hit: 0.38, speed: 0.9, power: 2.4, cost: 18, reach: 2.1, to: 1.1 },
  },
  fists: {
    light: [
      { clip: 'Punch_Jab', hit: 0.3, speed: 1.1, power: 0.5, cost: 4, reach: 1.25, to: 0.62 },
      { clip: 'Punch_Cross', hit: 0.25, speed: 1.0, power: 0.7, cost: 5, reach: 1.3, to: 0.7 },
    ],
    heavy: { clip: 'Melee_Hook', hit: 0.26, speed: 0.85, power: 1.3, cost: 10, reach: 1.3 },
  },
};
const THROW = { clip: 'OverhandThrow', release: 0.35, speed: 1.1, to: 0.95 };
const G = 12; // gravity for things in flight (a little lighter than the characters' snappier fall)

export function createCombat({ scene, camera, player, macbeth, heightAt, solids, S, hud, tip, T, getSpear, onSpearThrown, onStoneThrown, addPickup }) {
  const targets = [];
  const projectiles = [];
  let combo = 0, comboUntil = 0, queued = null, blocking = false, aiming = false;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const now = () => performance.now() / 1000;

  // ---------- targets: { id, center(): Vector3, radius, height, hit(info), solid?, kind }
  const addTarget = (t) => (targets.push(t), t);
  const removeTarget = (t) => {
    const i = targets.indexOf(t);
    if (i >= 0) targets.splice(i, 1);
  };

  // ---------- melee
  const facing = () => macbeth.root.rotation.y;
  function nearestInFront(reach, cone = 1.25) {
    const p = player.position, f = facing();
    let best = null, bd = Infinity;
    for (const t of targets) {
      if (!t.melee) continue;
      const c = t.center();
      const dx = c.x - p.x, dz = c.z - p.z;
      const d = Math.hypot(dx, dz) - t.radius;
      if (d > reach) continue;
      const da = Math.abs(Math.atan2(Math.sin(Math.atan2(dx, dz) - f), Math.cos(Math.atan2(dx, dz) - f)));
      if (da > cone) continue;
      if (d < bd) (bd = d), (best = t);
    }
    return best;
  }
  // turn to the nearest target within a few steps before swinging (a soft lock)
  function turnToTarget() {
    const p = player.position, f = facing();
    let best = null, bd = 3.2;
    for (const t of targets) {
      if (!t.melee) continue;
      const c = t.center();
      const d = Math.hypot(c.x - p.x, c.z - p.z) - t.radius;
      const a = Math.atan2(c.x - p.x, c.z - p.z);
      const da = Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f)));
      if (d < bd && da < 1.9) (bd = d), (best = a);
    }
    if (best !== null) player.setFacing(best);
  }
  function strike(blow, weapon) {
    const t = nearestInFront(blow.reach);
    if (!t) {
      sfx(weapon === 'sword' ? 'swish' : 'whoosh');
      return;
    }
    const c = t.center();
    const dir = tmp.set(c.x - player.position.x, 0, c.z - player.position.z).normalize().clone();
    t.hit({ weapon, power: blow.power, dir, point: c.clone().add(new THREE.Vector3(0, 0.1, 0)).addScaledVector(dir, -t.radius * 0.8), heavy: blow.power >= 2 });
  }
  function attack(kind) {
    if (S.dead || blocking) return;
    const w = S.equipped;
    if (w === 'spear' || w === 'stones') {
      if (kind === 'light' || kind === 'heavy') throwIt(w);
      return;
    }
    const set = BLOWS[w === 'sword' ? 'sword' : 'fists'];
    if (macbeth.busy()) {
      // a press during a blow is kept and follows it (a light press chains the combo;
      // a heavy press waits for the swing to finish, so no blow is ever lost)
      queued = kind === 'heavy' ? 'heavy' : queued || 'light';
      return;
    }
    let blow;
    if (kind === 'heavy') blow = set.heavy;
    else {
      if (now() > comboUntil) combo = 0;
      blow = set.light[combo % set.light.length];
      combo++;
    }
    if (S.stamina < blow.cost) {
      hud.toast('Out of breath. Step back and recover.', 'warn');
      return;
    }
    S.stamina -= blow.cost;
    turnToTarget();
    const weapon = w === 'sword' ? 'sword' : 'fists';
    macbeth.perform(blow.clip, {
      speed: blow.speed,
      to: blow.to || null,
      events: [
        { t: Math.max(0, blow.hit - 0.12), fn: () => sfx(weapon === 'sword' ? 'swish' : 'whoosh') },
        { t: blow.hit, fn: () => strike(blow, weapon) },
      ],
      done: () => {
        comboUntil = now() + 0.55;
        if (queued) {
          const next = queued;
          queued = null;
          attack(next);
        }
      },
    });
  }
  function block(on) {
    if (on === blocking) return;
    // a raised guard cuts short whatever blow is finishing (but not a throw in flight)
    if (on && (S.dead || (S.equipped !== 'sword' && S.equipped !== 'fists') || macbeth.action === 'OverhandThrow')) return;
    blocking = on;
    if (on) macbeth.perform('Sword_Block', { hold: 0.3, fadeIn: 0.05 });
    else macbeth.release();
  }

  // ---------- aim: the point under the middle of the screen
  const ray = new THREE.Ray();
  function aimPoint() {
    camera.getWorldDirection(tmp2);
    ray.set(camera.position, tmp2);
    let best = 60, hitT = null;
    for (const t of targets) {
      if (!t.catches) continue;
      const c = t.center();
      const r = t.radius + 0.1;
      const v = ray.closestPointToPoint(c, tmp);
      if (v.distanceTo(c) < r) {
        const d = camera.position.distanceTo(v);
        // a cast aimed across a target is drawn towards its middle, as a practised arm would
        if (d < best && d > 1) (best = d), (hitT = v.clone().lerp(c, 0.65));
      }
    }
    if (hitT) return hitT;
    // walk along the view until it meets the ground
    for (let d = 2; d < 60; d += 0.5) {
      const q = tmp.copy(camera.position).addScaledVector(tmp2, d);
      if (q.y < heightAt(q.x, q.z)) return q.clone();
    }
    return camera.position.clone().addScaledVector(tmp2, 40);
  }
  // the launch velocity that carries a throw from a to b at a given speed (the lower arc)
  function launch(a, b, speed) {
    const dx = b.x - a.x, dz = b.z - a.z, dy = b.y - a.y;
    const d = Math.hypot(dx, dz);
    const v2 = speed * speed;
    const disc = v2 * v2 - G * (G * d * d + 2 * dy * v2);
    const ang = disc >= 0 ? Math.atan((v2 - Math.sqrt(disc)) / (G * d)) : Math.PI / 4;
    const h = new THREE.Vector3(dx, 0, dz).normalize();
    return h.multiplyScalar(Math.cos(ang) * speed).setY(Math.sin(ang) * speed);
  }

  // ---------- throwing
  function throwIt(w) {
    if (macbeth.busy() || S.dead) return;
    if (w === 'spear' && (!getSpear() || S.spearOut)) return hud.toast(S.spearOut ? 'Your spear lies where it fell. Fetch it, or take one from a rack.' : 'You have no spear.', 'warn');
    if (w === 'stones' && S.stones <= 0) return hud.toast('Your pouch is empty. Gather stones from the heath.', 'warn');
    if (S.stamina < 8) return hud.toast('Out of breath. Step back and recover.', 'warn');
    S.stamina -= 8;
    const target = aimPoint();
    player.setFacing(Math.atan2(target.x - player.position.x, target.z - player.position.z));
    const spear = w === 'spear' ? getSpear() : null;
    if (spear) macbeth.hold(spear); // the grip shifts: the shaft runs along the arm for the throw
    macbeth.perform(THROW.clip, {
      speed: THROW.speed,
      to: THROW.to,
      events: [
        { t: THROW.release - 0.1, fn: () => sfx('whoosh') },
        {
          t: THROW.release,
          fn: () => {
            const from = new THREE.Vector3().setFromMatrixPosition(macbeth.bones.hand_r.matrixWorld);
            const aim = aimPoint();
            if (w === 'spear') {
              macbeth.hold(null);
              scene.attach(spear);
              spear.position.copy(from);
              const vel = launch(from, aim, 21);
              projectiles.push({ kind: 'spear', mesh: spear, vel, life: 10, prev: from.clone(), p0: from.clone(), v0: vel.clone(), t: 0 });
              S.spearOut = true;
              if (onSpearThrown) onSpearThrown();
            } else {
              S.stones--;
              if (S.stones <= 0) macbeth.hold(null);
              const m = makePebble(Math.floor(Math.random() * 999), 0.06);
              m.position.copy(from);
              scene.add(m);
              const vel = launch(from, aim, 17);
              projectiles.push({ kind: 'stone', mesh: m, vel, life: 8, prev: from.clone(), p0: from.clone(), v0: vel.clone(), t: 0, spin: new THREE.Vector3(Math.random() * 9, Math.random() * 9, 0) });
              if (onStoneThrown) onStoneThrown();
            }
          },
        },
      ],
    });
  }

  const UP = new THREE.Vector3(0, 1, 0);
  function updateProjectiles(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const pr = projectiles[i];
      if (pr.stuck) continue;
      pr.life -= dt;
      pr.prev.copy(pr.mesh.position);
      // the true arc: from where it left the hand, by the time since (exact at any frame rate)
      pr.t += dt;
      pr.mesh.position.copy(pr.p0).addScaledVector(pr.v0, pr.t);
      pr.mesh.position.y -= 0.5 * G * pr.t * pr.t;
      pr.vel.copy(pr.v0);
      pr.vel.y -= G * pr.t;
      const p = pr.mesh.position;
      const rebound = (v) => {
        // after a glance or a bounce the arc starts afresh from here
        pr.p0.copy(p);
        pr.v0.copy(v);
        pr.t = 0;
      };
      if (pr.kind === 'spear') pr.mesh.quaternion.setFromUnitVectors(UP, tmp.copy(pr.vel).normalize());
      else pr.mesh.rotation.x += pr.spin.x * dt;
      // what did it meet on the way?
      let hit = null;
      for (const t of targets) {
        if (!t.catches) continue;
        const c = t.center();
        const seg = tmp.copy(p).sub(pr.prev);
        const L = seg.length() || 1e-6;
        seg.divideScalar(L);
        const proj = THREE.MathUtils.clamp(tmp2.copy(c).sub(pr.prev).dot(seg), 0, L);
        const closest = pr.prev.clone().addScaledVector(seg, proj);
        if (closest.distanceTo(c) < t.radius + (pr.kind === 'spear' ? 0.1 : 0.05)) {
          hit = { t, point: closest };
          break;
        }
      }
      if (hit) {
        const dir = pr.vel.clone().setY(0).normalize();
        hit.t.hit({ weapon: pr.kind, power: pr.kind === 'spear' ? 2 : 0.6, dir, point: hit.point, thrown: true, speed: pr.vel.length() });
        if (pr.kind === 'spear' && hit.t.sticks) {
          // the head buries itself: stop where it struck, a hand's depth in
          p.copy(hit.point).addScaledVector(tmp.copy(pr.vel).normalize(), 0.18);
          stick(pr, hit.t);
          projectiles.splice(i, 1);
          continue;
        }
        rebound(pr.vel.clone().multiplyScalar(-0.25).setY(1.5)); // glances off
      }
      // standing stones and boulders turn things aside
      for (const s of solids) {
        const r = s.kind === 'box' ? Math.max(s.size[0], s.size[2]) : s.size[0];
        if (Math.hypot(p.x - s.position.x, p.z - s.position.z) < r && p.y < s.position.y + (s.kind === 'box' ? s.size[1] : r)) {
          p.copy(pr.prev);
          rebound(new THREE.Vector3(-pr.vel.x * 0.25, Math.abs(pr.vel.y) * 0.2, -pr.vel.z * 0.25));
          impact('stone', 0.6);
          break;
        }
      }
      const g = heightAt(p.x, p.z);
      if (p.y < g + (pr.kind === 'stone' ? 0.04 : 0.05)) {
        if (pr.kind === 'spear' && pr.vel.length() > 6) {
          // point first into the turf
          p.y = g - 0.12;
          impact('turf', 0.8);
          stick(pr, null);
          projectiles.splice(i, 1);
          continue;
        }
        p.y = g + 0.04;
        if (pr.vel.length() > 3) {
          rebound(new THREE.Vector3(pr.vel.x * 0.35, Math.abs(pr.vel.y) * 0.3, pr.vel.z * 0.35));
          impact('turf', 0.4);
        } else {
          rest(pr);
          projectiles.splice(i, 1);
          continue;
        }
      }
      if (pr.life <= 0) {
        rest(pr);
        projectiles.splice(i, 1);
      }
    }
  }
  // a spear stuck fast: it can be pulled out and taken back
  function stick(pr, target) {
    pr.stuck = true;
    if (target && target.holdSpear) target.holdSpear(pr.mesh);
    addPickup({ kind: 'spear', mesh: pr.mesh, label: 'Pull out your spear' });
  }
  function rest(pr) {
    if (pr.kind === 'stone') addPickup({ kind: 'stone', mesh: pr.mesh, label: 'Pick up the stone' });
    else addPickup({ kind: 'spear', mesh: pr.mesh, label: 'Take up your spear' });
  }

  return {
    addTarget,
    removeTarget,
    attack,
    block,
    get blocking() {
      return blocking;
    },
    // the aiming view for throwing weapons
    get aiming() {
      return (S.equipped === 'spear' && !S.spearOut) || (S.equipped === 'stones' && S.stones > 0);
    },
    // shape movement while fighting: rooted in a blow, slow behind the block
    input(inp) {
      const a = macbeth.action;
      if (blocking) {
        inp.x *= 0.35;
        inp.y *= 0.35;
        inp.run = false;
        inp.jump = false;
      } else if (a && a !== 'Sword_Block') {
        inp.x *= 0.15;
        inp.y *= 0.15;
        inp.run = false;
        inp.jump = false;
      }
    },
    update(dt) {
      updateProjectiles(dt);
    },
    // for tests: where the view aims, and what is in flight
    debug: () => ({
      aim: aimPoint().toArray().map((v) => +v.toFixed(2)),
      cam: camera.position.toArray().map((v) => +v.toFixed(2)),
      flying: projectiles.map((p) => ({ kind: p.kind, pos: p.mesh.position.toArray().map((v) => +v.toFixed(2)), vel: p.vel.toArray().map((v) => +v.toFixed(1)) })),
      targets: targets.filter((t) => t.catches && t.kind === 'butt').map((t) => t.center().toArray().map((v) => +v.toFixed(2))),
    }),
  };
}
