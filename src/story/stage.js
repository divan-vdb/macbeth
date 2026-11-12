// The stage: the cast who are not the player. Places them, shows and hides them,
// turns them to face someone, walks them to a mark (steering round stones), and
// lets companions follow Macbeth across the heath. Drives their animation.
import * as THREE from 'three/webgpu';

const WALK = 2.1, JOG = 4.6;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function createStage({ heightAt, solids, macbeth }) {
  const cast = new Map(); // id -> { c, collider, yaw, target, path, follow, moving, resolve }
  const tmp = new THREE.Vector3();

  function add(id, c, collider = null) {
    const a = { c, collider, yaw: c.root.rotation.y, path: null, follow: null, moving: 0, resolve: null, lookAt: null };
    cast.set(id, a);
    return a;
  }
  const get = (id) => (id === 'macbeth' ? macbeth : cast.has(id) ? cast.get(id).c : null);
  const syncCollider = (a) => {
    if (!a.collider) return;
    const p = a.c.root.position;
    a.collider.setTranslation({ x: p.x, y: p.y + 0.85, z: p.z });
  };
  function place(id, x, z, yaw) {
    const a = cast.get(id);
    if (!a) return;
    a.c.root.position.set(x, heightAt(x, z), z);
    if (yaw !== undefined) a.c.root.rotation.y = a.yaw = yaw;
    a.path = null;
    a.moving = 0;
    a.c.root.updateMatrixWorld(true);
    a.c.settle();
    syncCollider(a);
  }
  function show(id, on) {
    const a = cast.get(id);
    if (!a) return;
    a.c.root.visible = on;
    if (a.collider) a.collider.setEnabled(on && !a.follow);
  }
  // turn to face a point (or an actor, kept up to date)
  function face(id, target) {
    const a = cast.get(id);
    if (!a) return;
    a.lookAt = target;
  }
  const yawTo = (from, x, z) => Math.atan2(x - from.x, z - from.z);
  // walk to a mark through optional waypoints; resolves on arrival
  function walkTo(id, points, { speed = WALK } = {}) {
    const a = cast.get(id);
    if (!a) return Promise.resolve();
    a.path = points.map(([x, z]) => new THREE.Vector3(x, 0, z));
    a.speed = speed;
    // never keep a scene waiting: if the way is blocked, arrive anyway
    let len = 0, prev = a.c.root.position;
    for (const q of a.path) (len += Math.hypot(q.x - prev.x, q.z - prev.z)), (prev = q);
    a.deadline = performance.now() + ((len / speed) * 1.6 + 3) * 1000;
    a.lookAt = null;
    if (a.collider) a.collider.setEnabled(false);
    if (a.resolve) a.resolve();
    return new Promise((r) => (a.resolve = r));
  }
  // follow Macbeth at an offset: side (+ right), back (behind him)
  function follow(id, opts) {
    const a = cast.get(id);
    if (!a) return;
    a.follow = opts ? { side: 1.2, back: 1.6, ...opts, going: false } : null;
    a.path = null;
    if (a.collider) a.collider.setEnabled(!opts && a.c.root.visible);
  }
  // steer away from stones near the way ahead
  function steer(p, dir) {
    for (const s of solids) {
      const r = (s.kind === 'box' ? Math.max(s.size[0], s.size[2]) * 1.2 : s.size[0]) + 0.55;
      const dx = p.x + dir.x * 0.9 - s.position.x, dz = p.z + dir.z * 0.9 - s.position.z;
      const d = Math.hypot(dx, dz);
      if (d < r + 0.6) {
        const push = (1 - d / (r + 0.6)) * 2.2;
        dir.x += (dx / (d || 1)) * push;
        dir.z += (dz / (d || 1)) * push;
      }
    }
    const l = Math.hypot(dir.x, dir.z) || 1;
    dir.x /= l;
    dir.z /= l;
    return dir;
  }

  function update(dt, wind, camera) {
    const mp = macbeth.root.position;
    for (const [, a] of cast) {
      const p = a.c.root.position;
      let want = null, speed = 0;
      if (a.path && a.path.length && performance.now() > a.deadline) {
        const end = a.path[a.path.length - 1];
        p.set(end.x, heightAt(end.x, end.z), end.z);
        a.path = [end];
      }
      if (a.path && a.path.length) {
        const t = a.path[0];
        const d = Math.hypot(t.x - p.x, t.z - p.z);
        if (d < (a.path.length > 1 ? 0.8 : 0.25)) {
          a.path.shift();
          if (!a.path.length) {
            a.path = null;
            if (a.collider && a.c.root.visible) {
              syncCollider(a);
              a.collider.setEnabled(true);
            }
            if (a.resolve) a.resolve();
            a.resolve = null;
          }
        } else {
          want = tmp.set(t.x - p.x, 0, t.z - p.z).normalize();
          speed = a.speed * Math.min(1, d / 0.6 + 0.3);
        }
      } else if (a.follow && a.c.root.visible) {
        const f = a.follow;
        const yaw = macbeth.root.rotation.y;
        const fx = Math.sin(yaw), fz = Math.cos(yaw);
        const tx = mp.x - fx * f.back + fz * f.side, tz = mp.z - fz * f.back - fx * f.side;
        const d = Math.hypot(tx - p.x, tz - p.z);
        if (d > 30) {
          // fallen far behind: catch up out of sight
          place([...cast.entries()].find(([, v]) => v === a)[0], mp.x - fx * 9, mp.z - fz * 9, yaw);
        } else {
          if (d > 1.1) f.going = true;
          if (d < 0.35) f.going = false;
          if (f.going) {
            want = tmp.set(tx - p.x, 0, tz - p.z).normalize();
            speed = d > 5 ? JOG : Math.min(WALK * 1.15, 0.8 + d * 1.2);
          } else a.lookAt = { x: p.x + fx, z: p.z + fz };
        }
      }
      if (want) {
        steer(p, want);
        const nx = p.x + want.x * speed * dt, nz = p.z + want.z * speed * dt;
        p.set(nx, heightAt(nx, nz), nz);
        a.yaw += wrapAngle(Math.atan2(want.x, want.z) - a.yaw) * Math.min(1, dt * 8);
        a.moving += (speed - a.moving) * Math.min(1, dt * 8);
      } else {
        a.moving += (0 - a.moving) * Math.min(1, dt * 10);
        if (a.lookAt) {
          const L = typeof a.lookAt === 'function' ? a.lookAt() : a.lookAt.root ? a.lookAt.root.position : a.lookAt;
          a.yaw += wrapAngle(yawTo(p, L.x, L.z) - a.yaw) * Math.min(1, dt * 4);
        }
      }
      a.c.root.rotation.y = a.yaw;
      if (a.c.root.visible)
        a.c.update(dt, { speed: a.moving < 0.05 ? 0 : a.moving, grounded: true, wind, cloth: p.distanceToSquared(camera.position) < 900 });
    }
  }

  return { add, get, place, show, face, walkTo, follow, update, has: (id) => cast.has(id) };
}
