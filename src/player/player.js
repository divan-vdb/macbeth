// The player: a capsule moved by Rapier's kinematic character controller
// (walks up slopes and small steps, slides off steep ones, pushes crates),
// with a third-person camera that orbits behind and pulls in rather than
// passing through stones.
import * as THREE from 'three/webgpu';

const WALK = 2.1, RUN = 5.4, JUMP = 6.4, GRAVITY = -19.6; // a purposeful stride and a sprint
const RADIUS = 0.3, HALF = 0.6; // capsule: 1.8 m tall in total

export function createPlayer({ RAPIER, world, scene, camera, avatar, start, heightAt, camDist = 5.2 }) {
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(start.x, start.y + HALF + RADIUS + 0.05, start.z));
  const collider = world.createCollider(RAPIER.ColliderDesc.capsule(HALF, RADIUS).setFriction(0.5), body);
  const cc = world.createCharacterController(0.02);
  cc.enableAutostep(0.35, 0.2, false);
  cc.enableSnapToGround(0.4);
  cc.setMaxSlopeClimbAngle((48 * Math.PI) / 180);
  cc.setMinSlopeSlideAngle((55 * Math.PI) / 180);
  cc.setApplyImpulsesToDynamicBodies(true);
  cc.setCharacterMass(85);

  scene.add(avatar.root);

  let vy = 0, grounded = false, coyote = 0;
  let speed = 0, facing = 0;
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  // camera rig
  const cam = { yaw: Math.PI, pitch: 0.28, dist: camDist, curDist: camDist, target: new THREE.Vector3(), side: 0, aim: false };
  const ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });

  let next = { x: start.x, y: start.y + HALF + RADIUS, z: start.z };
  let half = HALF, radius = RADIUS; // the capsule's current size (bigger on horseback)
  // riding: { heading, speed, locked, gait(input, dt, mag) -> m/s, turnRate(speed), frame(dt, ground, heading, speed, wind) }
  let ride = null, lastLook = 0;
  function setShape(h, r) {
    const p = body.translation();
    const bottom = p.y - (half + radius);
    half = h;
    radius = r;
    collider.setHalfHeight(h);
    collider.setRadius(r);
    const y = bottom + h + r;
    body.setTranslation({ x: p.x, y, z: p.z }, true);
    next = { x: p.x, y, z: p.z };
  }

  // once per frame: turn and zoom the camera
  function look(input) {
    cam.yaw -= input.lookX * 0.0042;
    cam.pitch = Math.min(1.25, Math.max(-0.35, cam.pitch + input.lookY * 0.0032));
    cam.dist = Math.min(14, Math.max(2.2, cam.dist + input.zoom));
    if (Math.abs(input.lookX) + Math.abs(input.lookY) > 0.5) lastLook = performance.now();
  }

  // once per physics step (1/60 s): move the capsule
  function step(dt, input) {

    // desired horizontal velocity, relative to where the camera looks
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw); // camera forward on the ground
    const rx = -fz, rz = fx; // camera right
    const mag = Math.min(1, Math.hypot(input.x, input.y));
    if (ride) {
      // on horseback: push where you want her to go (as seen from the camera); she turns
      // towards it as fast as her gait allows and keeps to her pace
      const go = mag > 0.12 && !ride.locked;
      let want = ride.heading;
      if (go) want = Math.atan2(fx * input.y + rx * input.x, fz * input.y + rz * input.x);
      const dh = Math.atan2(Math.sin(want - ride.heading), Math.cos(want - ride.heading));
      const turn = ride.turnRate(ride.speed) * dt;
      ride.heading += Math.max(-turn, Math.min(turn, dh));
      const top = ride.gait(go ? input : null, dt, mag);
      const target = go ? top * (0.3 + 0.7 * Math.max(0, Math.cos(dh))) : 0;
      ride.speed += (target - ride.speed) * Math.min(1, (target > ride.speed ? 1.3 : 2.2) * dt);
      vel.x = Math.sin(ride.heading) * ride.speed;
      vel.z = Math.cos(ride.heading) * ride.speed;
      // the view swings in behind her while she moves and the player leaves it be
      if (ride.speed > 1.2 && performance.now() - lastLook > 1400) {
        const d = Math.atan2(Math.sin(ride.heading + Math.PI - cam.yaw), Math.cos(ride.heading + Math.PI - cam.yaw));
        cam.yaw += d * Math.min(1, dt * (0.6 + ride.speed * 0.12));
      }
    } else {
      const top = input.run ? RUN : WALK;
      tmp.set(fx * input.y + rx * input.x, 0, fz * input.y + rz * input.x);
      if (tmp.lengthSq() > 0) tmp.normalize().multiplyScalar(top * Math.max(mag, input.run ? 1 : mag));
      const accel = grounded ? 14 : 4;
      vel.x += (tmp.x - vel.x) * Math.min(1, accel * dt);
      vel.z += (tmp.z - vel.z) * Math.min(1, accel * dt);
    }

    // gravity and jumping (a short grace period after leaving an edge)
    coyote = grounded ? 0.12 : Math.max(0, coyote - dt);
    if (input.jump && coyote > 0 && !ride) {
      vy = JUMP;
      coyote = 0;
      grounded = false;
    }
    vy += GRAVITY * dt;

    const desired = { x: vel.x * dt, y: vy * dt, z: vel.z * dt };
    cc.computeColliderMovement(collider, desired);
    const m = cc.computedMovement();
    const p = body.translation();
    next = { x: p.x + m.x, y: p.y + m.y, z: p.z + m.z };
    // never fall through the world
    const floor = heightAt(next.x, next.z) + half + radius - 0.05;
    if (next.y < floor - 1) next.y = floor;
    body.setNextKinematicTranslation(next);
    grounded = cc.computedGrounded();
    if (grounded && vy < 0) vy = -1;
    if (m.y < desired.y * 0.5 && vy > 0) vy = 0; // bumped head

    speed = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4);
    if (ride) {
      // pulled up short by a stone: she stops pressing into it
      if (speed < ride.speed * 0.5 && ride.speed > 1) ride.speed = Math.max(speed, ride.speed * 0.9);
      facing = ride.heading;
    } else if (speed > 0.3) facing = Math.atan2(vel.x, vel.z);
  }

  // once per frame: place and animate the figure, then the camera
  function frame(dt, wind) {
    if (ride) {
      // the horse carries the rider: she is placed where the capsule stands, he on her back
      ride.frame(dt, { x: next.x, y: next.y - half - radius, z: next.z }, ride.heading, speed, wind);
      updateCamera(dt);
      return;
    }
    avatar.root.position.set(next.x, next.y - HALF - RADIUS, next.z);
    let dy = facing - avatar.root.rotation.y;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    avatar.root.rotation.y += dy * Math.min(1, dt * 10);
    avatar.update(dt, { speed: Math.min(speed, RUN), grounded, wind });
    updateCamera(dt);
  }

  function updateCamera(dt) {
    const p = avatar.root.position;
    // aiming a throw: the view moves over Macbeth's right shoulder so the middle of the screen is clear
    cam.side += ((cam.aim ? 0.62 : 0) - cam.side) * Math.min(1, dt * 6);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    cam.target.lerp(tmp.set(p.x + rx * cam.side, p.y + 1.55 + cam.side * 0.12, p.z + rz * cam.side), Math.min(1, dt * 12));
    const dir = new THREE.Vector3(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch));
    // pull in if a stone or crate is between the head and the camera
    ray.origin = { x: cam.target.x, y: cam.target.y, z: cam.target.z };
    ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = world.castRay(ray, cam.dist, true, undefined, undefined, collider);
    const far = cam.aim ? Math.min(cam.dist, 3.4) : cam.dist + (ride ? 1.9 : 0);
    const want = hit ? Math.max(0.6, Math.min(far, hit.timeOfImpact - 0.25)) : far;
    cam.curDist += (want - cam.curDist) * Math.min(1, dt * (want < cam.curDist ? 20 : 4));
    camera.position.copy(cam.target).addScaledVector(dir, cam.curDist);
    const ground = heightAt(camera.position.x, camera.position.z) + 0.35;
    if (camera.position.y < ground) camera.position.y = ground;
    camera.lookAt(cam.target);
  }

  return {
    look,
    step,
    frame,
    get position() {
      return avatar.root.position;
    },
    get speed() {
      return speed;
    },
    // put Macbeth somewhere at once (a respawn), standing on the ground
    teleport(x, z) {
      const y = heightAt(x, z) + half + radius + 0.05;
      body.setTranslation({ x, y, z }, true);
      next = { x, y, z };
      vel.set(0, 0, 0);
      vy = 0;
      speed = 0;
      if (!ride) avatar.root.position.set(x, y - half - radius, z);
      cam.target.set(x, y - half - radius + 1.55, z);
    },
    // mount (a ride object) or dismount (null): the capsule grows to a horse's size
    setRide(r) {
      if (r) {
        setShape(0.42, 0.62);
        r.heading = r.heading ?? facing;
        r.speed = 0;
      } else setShape(HALF, RADIUS);
      ride = r;
      vel.set(0, 0, 0);
    },
    get ride() {
      return ride;
    },
    get facing() {
      return facing;
    },
    get yaw() {
      return cam.yaw;
    },
    // turn Macbeth (not the view) to a heading, as when he squares up to a target
    setFacing(yaw) {
      facing = yaw;
    },
    setAim(on) {
      cam.aim = on;
    },
    // a shove (a blow that lands): carried by the controller, dying away quickly
    push(x, z) {
      vel.x += x;
      vel.z += z;
    },
    faceTowards(x, z) {
      cam.yaw = Math.atan2(avatar.root.position.x - x, avatar.root.position.z - z);
      facing = cam.yaw + Math.PI;
      avatar.root.rotation.y = facing;
      avatar.root.position.set(next.x, next.y - HALF - RADIUS, next.z);
      cam.target.set(next.x, next.y - HALF - RADIUS + 1.55, next.z);
    },
  };
}
