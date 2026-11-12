// The raven messenger: it comes in high over the heath on slow, deep wingbeats,
// glides, brakes with its tail fanned and feet down, lands a few steps in front
// of Macbeth, caws, lays down the sealed scroll it carried in its beak, looks
// about, and is gone again into the dark.
import * as THREE from 'three/webgpu';
import { makeScroll } from '../characters/props.js';
import { sfx } from '../audio.js';
import { createRavenModel } from './ravenModel.js';

export function createRaven(scene, heightAt) {
  const { bird, setPose, mouth } = createRavenModel();
  bird.visible = false;
  scene.add(bird);
  let state = 'idle', t = 0, phase = 0, lastFlap = 0;
  let path = null, dur = 1, onDrop = null, scroll = null, look = 0;
  const P = new THREE.Vector3(), Q = new THREE.Vector3();
  const curve = (a, b, lift) => {
    const mid = a.clone().lerp(b, 0.55);
    mid.y += lift;
    return new THREE.QuadraticBezierCurve3(a, mid, b);
  };

  return {
    get busy() {
      return state !== 'idle';
    },
    // bring a scroll to a spot near `target` (on the ground); drop(scrollMesh) when it is laid down
    deliver(target, approachFrom, drop) {
      const land = target.clone();
      land.y = heightAt(land.x, land.z) + 0.125;
      const start = target.clone().addScaledVector(approachFrom, 40);
      start.y = land.y + 24;
      path = curve(start, land, 5);
      dur = 7;
      t = 0;
      state = 'in';
      onDrop = drop;
      bird.visible = true;
      scroll = makeScroll();
      scroll.scale.setScalar(0.75);
      mouth.add(scroll);
    },
    update(dt) {
      if (state === 'idle') return;
      t += dt;
      if (state === 'in' || state === 'out') {
        const k = Math.min(1, t / dur);
        const e = state === 'in' ? 1 - Math.pow(1 - k, 2.1) : k * k;
        path.getPoint(e, P);
        path.getPoint(Math.min(1, e + 0.015), Q);
        bird.position.copy(P);
        const dx = Q.x - P.x, dz = Q.z - P.z;
        if (dx * dx + dz * dz > 1e-7) bird.rotation.y = Math.atan2(dx, dz);
        const braking = state === 'in' && k > 0.8;
        const climbing = state === 'out' && k < 0.45;
        const cruiseBeat = state === 'in' && k < 0.3;
        const beating = braking || climbing || cruiseBeat;
        // slow, deep, rowing wingbeats (about 3 a second); quicker when braking or taking off
        phase += dt * (braking || climbing ? 17 : beating ? 13 : 0);
        const sn = Math.sin(phase), cs = Math.cos(phase);
        const descent = THREE.MathUtils.clamp((P.y - Q.y) * 8, -0.4, 0.5);
        bird.rotation.x = braking ? THREE.MathUtils.lerp(descent, -0.75, (k - 0.8) / 0.2) : descent;
        bird.rotation.z = Math.sin(t * 0.9) * 0.12 * (beating ? 0.3 : 1); // banking as it glides
        if (beating) {
          setPose({
            elev: sn * 0.85 + 0.15,
            fold: Math.max(0, cs) * 0.38, // the wrist flexes on the upstroke
            fan: 1 - Math.max(0, cs) * 0.5,
            tail: braking ? 1 : 0.25,
            legs: braking ? Math.min(1, (k - 0.85) / 0.1) : 0,
            headPitch: braking ? 0.5 : 0.1,
          });
          if (sn > 0.95 && performance.now() - lastFlap > 160) {
            lastFlap = performance.now();
            sfx('flap');
          }
        } else {
          // gliding: wings level with a slight lift at the tips, primaries spread
          setPose({ elev: 0.12 + Math.sin(t * 1.3) * 0.03, fold: 0, fan: 0.9, tail: 0.3, headPitch: 0.15 });
        }
        if (k >= 1) {
          if (state === 'in') {
            state = 'landed';
            t = 0;
            bird.rotation.set(0, bird.rotation.y, 0);
          } else {
            state = 'idle';
            bird.visible = false;
          }
        }
      } else if (state === 'landed') {
        // settle: a little hop, wings folded, then look about
        const hop = t < 0.35 ? Math.sin((t / 0.35) * Math.PI) * 0.04 : 0;
        bird.position.y = heightAt(bird.position.x, bird.position.z) + 0.125 + hop;
        look = Math.sin(t * 1.7) * 0.6 + Math.sin(t * 4.1) * 0.15;
        const caw = t > 0.6 && t < 1.25;
        setPose({
          fold: Math.min(1, t * 3),
          fan: 0,
          tail: 0.05,
          legs: 1,
          pitch: -0.42 + (caw ? Math.sin((t - 0.6) * 9.6) * 0.12 : 0),
          headYaw: t < 1.4 ? 0 : look,
          headPitch: caw ? -0.25 : 0.25,
        });
        if (t > 0.6 && t - dt <= 0.6) sfx('caw');
        // lower the head and lay the scroll down
        if (t > 1.6 && scroll && scroll.parent === mouth) {
          const w = new THREE.Vector3();
          scroll.getWorldPosition(w);
          mouth.remove(scroll);
          scroll.scale.setScalar(0.9);
          scroll.position.set(w.x, heightAt(w.x, w.z) + 0.025, w.z);
          scroll.rotation.set(0, bird.rotation.y + Math.PI / 2 + 0.3, 0);
          scene.add(scroll);
          if (onDrop) onDrop(scroll);
        }
        if (t > 3.6) {
          state = 'out';
          t = 0;
          dur = 7;
          const from = bird.position.clone();
          const away = new THREE.Vector3(Math.sin(bird.rotation.y + 2.4), 0, Math.cos(bird.rotation.y + 2.4));
          const to = from.clone().addScaledVector(away, 60);
          to.y += 32;
          path = curve(from, to, 3);
        }
      }
    },
  };
}
