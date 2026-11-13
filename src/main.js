// Macbeth RPG: walk the blasted heath at night as Macbeth.
// Stone circle, fire pit, wind-blown grass, storm sky with lightning, physics
// crates, ambient sound, quality presets, and the Folio with portraits and glossary.

import * as THREE from 'three/webgpu';
import { buildTerrain, buildStones, buildFirePit, buildGrass, crateMaterial, heightAt } from './world/heath.js';
import { buildSky } from './world/sky.js';
import { createFire } from './world/fire.js';
import { createCauldron } from './world/cauldron.js';
import { createGame } from './game/game.js';
import { createSettings } from './game/settings.js';
import { showTitle } from './game/title.js';
import { loadGame, clearGame } from './game/save.js';
import { createLightning } from './world/lightning.js';
import * as audio from './audio.js';
import { mountFolio } from './folio/folio.js';
import { buildMacbeth } from './player/macbeth.js';
import { createCharacter } from './characters/cast.js';
import { createPlayer } from './player/player.js';
import { createInput, isTouch } from './player/input.js';
import { createQuality } from './quality.js';
import { buildBlastedHeath, createMist } from './world/blasted.js';
import { createDirector } from './story/director.js';
import { createStage } from './story/stage.js';
import { createAct1 } from './story/act1.js';
import { buildYard } from './world/yard.js';
import { createYardQuest } from './story/yardquest.js';

const $ = (id) => document.getElementById(id);
const diag = { renderer: $('d-renderer'), physics: $('d-physics'), fps: $('d-fps'), bodies: $('d-bodies'), screen: $('d-screen'), quality: $('d-quality'), error: $('d-error') };
const setDiag = (el, text, cls = '') => {
  el.textContent = text;
  el.className = cls;
};
const showError = (msg) => {
  msg = String(msg);
  if (msg.length > 180) msg = msg.slice(0, 180) + '…';
  diag.error.hidden = false;
  diag.error.textContent += (diag.error.textContent ? '\n' : '') + msg;
};
window.addEventListener('error', (e) => showError(String(e.message || e.error)));
window.addEventListener('unhandledrejection', (e) => showError('Promise: ' + ((e.reason && e.reason.message) || e.reason)));

const forceWebGL = location.hash === '#webgl';
const narrow = window.matchMedia('(max-width: 700px)').matches;
const srgb = (hex) => new THREE.Color().setStyle(hex, THREE.SRGBColorSpace);
if (isTouch) document.body.classList.add('touch');

async function main() {
  // The Folio (the play, the tasks, the scrolls) and the settings
  // the play's text, for the Folio and the story's subtitles
  audio.setMusicBase(new URL('../assets/music/', import.meta.url).href);
  const loadJSON = (path) => fetch(new URL(path, import.meta.url)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const [play, act1Lines, yardLines] = await Promise.all([loadJSON('../assets/text/play.json'), loadJSON('../assets/text/act1.json'), loadJSON('../assets/text/yard.json')]);
  if (!play) showError('The play text could not be loaded');
  const folioApi = mountFolio($('folio'), {
    play,
    sceneId: '1.1',
    onReadScroll: (id) => game && game.readScroll(id),
    onShowOnMap: (id) => game && game.showOnMap(id),
  });
  const settings = createSettings({
    extras: ['btn-quality', 'btn-stats', 'btn-thunder', 'btn-crates'].map((id) => $(id)),
    onMode: (m) => folioApi.setMode(m),
    onNewGame: () => {
      clearGame();
      location.reload();
    },
  });
  folioApi.setMode(settings.values.mode);
  $('hint').textContent = isTouch
    ? 'Left thumb to walk (push further to run) · drag to look · pinch to zoom · tap a weapon to ready it'
    : 'WASD to walk · Shift to run · Space to jump · E to take or read · 1-4 weapons · Q drink a tonic · drag to look · P to pause';

  const scene = new THREE.Scene();
  const fogColor = srgb('#26303f');
  scene.background = fogColor;
  scene.fog = new THREE.FogExp2(fogColor, 0.02);

  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1200);
  camera.position.set(0, 3, 12);

  const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  $('app').appendChild(renderer.domElement);
  await renderer.init();
  const isWebGPU = !!(renderer.backend && renderer.backend.isWebGPUBackend);
  setDiag(diag.renderer, isWebGPU ? 'WebGPU' : forceWebGL ? 'WebGL 2 (forced)' : 'WebGL 2 (fallback)', isWebGPU ? 'ok' : 'warn');

  // Moonlight from the side, a dim sky fill
  const moonDir = new THREE.Vector3(32, 42, -6).normalize();
  const hemi = new THREE.HemisphereLight(srgb('#6c7fa0'), srgb('#2b2219'), 1.2);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(srgb('#a9bde0'), 2.0);
  moon.castShadow = true;
  moon.shadow.mapSize.set(narrow ? 1024 : 2048, narrow ? 1024 : 2048);
  Object.assign(moon.shadow.camera, { left: -26, right: 26, top: 26, bottom: -26, near: 1, far: 160 });
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.04;
  scene.add(moon, moon.target);

  // World
  const sky = buildSky(moonDir, narrow);
  scene.add(sky.group);
  const terrain = buildTerrain();
  scene.add(terrain);
  const stones = buildStones();
  scene.add(stones.group);
  const pit = buildFirePit();
  scene.add(pit.group);
  // the blasted hollow of Act I, scene 3, on the road to Forres (south-east of the stones),
  // in the clear between the boulders
  const hollowSpot = (() => {
    for (let step = 0; step < 80; step++) {
      const a = 2.62 + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.03, r = 58 + (step % 7) - 3;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (stones.solids.every((o) => Math.hypot(x - o.position.x, z - o.position.z) > 9)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(30, 0, -52);
  })();
  const hollow = buildBlastedHeath(hollowSpot, heightAt, new THREE.Vector3(0, 0, 0));
  scene.add(hollow.group);
  const mist = createMist(scene, heightAt);
  // the Captain's training yard, west of the stones on a level stretch of heath. Its targets
  // join the fighting once the game exists (they wait in a queue until then).
  let game = null, yardQuest = null, player = null;
  const yardTargets = [];
  const yardCentre = new THREE.Vector3(-20, 0, 6);
  const yard = buildYard({
    scene, heightAt, narrow, center: yardCentre,
    combat: { addTarget: (t) => (yardTargets.push(t), t) },
    onEvent: (type, d) => yardQuest && yardQuest.onEvent(type, d),
    hurtPlayer: (h) => (game ? game.hurtFrom(h) : false),
    player: { get position() { return player ? player.position : new THREE.Vector3(0, -99, 0); } },
  });
  const grass = buildGrass([...stones.solids, ...pit.solids, ...hollow.solids, ...yard.solids, { kind: 'ball', size: [9.5], position: yardCentre, quaternion: new THREE.Quaternion() }], narrow);
  scene.add(grass.mesh);
  const fire = createFire(new THREE.Vector3(0, pit.y0, 0), narrow);
  scene.add(fire.group);
  const lightning = createLightning(scene, camera, (delay, near) => setTimeout(() => audio.thunder(near), delay * 1000));

  // Physics
  let RAPIER = null, world = null;
  try {
    RAPIER = (await import('@dimforge/rapier3d-compat')).default;
    await RAPIER.init();
    // Stronger than Earth gravity: at this scale real gravity reads as slow motion
    world = new RAPIER.World({ x: 0, y: -19.6, z: 0 });
    world.timestep = 1 / 60;
    const tg = terrain.geometry;
    world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(tg.attributes.position.array), new Uint32Array(tg.index.array)));
    for (const s of [...stones.solids, ...pit.solids, ...hollow.solids, ...yard.colliders]) {
      const d = s.kind === 'box' ? RAPIER.ColliderDesc.cuboid(...s.size) : RAPIER.ColliderDesc.ball(s.size[0]);
      d.setTranslation(s.position.x, s.position.y, s.position.z);
      d.setRotation({ x: s.quaternion.x, y: s.quaternion.y, z: s.quaternion.z, w: s.quaternion.w });
      world.createCollider(d);
    }
    const v = typeof RAPIER.version === 'function' ? ' ' + RAPIER.version() : '';
    setDiag(diag.physics, `Rapier${v} ready`, 'ok');
  } catch (err) {
    world = null;
    setDiag(diag.physics, 'failed to load', 'bad');
    showError('Physics: ' + (err && err.message ? err.message : err));
  }

  // Macbeth, standing outside the stone circle, facing the fire
  const input = createInput(renderer.domElement, { stickZone: $('stick-zone'), stickBase: $('stick-base'), stickKnob: $('stick-knob'), jumpBtn: $('btn-jump') });
  let cauldron = null, stage = null, loadActor = null, act1 = null;
  let macbethChar = null;
  if (world) {
    var hint = $('hint');
    var hintText = hint.textContent;
    hint.textContent = 'Summoning the cast…';
    let macbeth;
    try {
      macbeth = await createCharacter('macbeth', {
      ground: heightAt,
      // footsteps follow Macbeth's actual feet; stone and ash round the fire sound grittier
      onStep: (side, speed, heavy) => {
        const p = macbeth.root.position;
        audio.footstep({ side, speed, heavy, surface: Math.hypot(p.x, p.z) < 2.4 ? 'stone' : 'heath' });
      },
    });
    } catch (err) {
      showError('Characters: ' + (err && err.message ? err.message : err));
      macbeth = buildMacbeth(); // the old code-built stand-in, if the models can't load
    }
    hint.textContent = hintText;
    if (macbeth.hold) macbethChar = macbeth;
    // ?at=x,z starts Macbeth somewhere else (handy for checking a spot)
    const at = (new URLSearchParams(location.search).get('at') || '0,15').split(',').map(Number);
    const [sx, sz] = at.length === 2 && at.every(Number.isFinite) ? at : [0, 15];
    player = createPlayer({ RAPIER, world, scene, camera, avatar: macbeth, start: new THREE.Vector3(sx, heightAt(sx, sz), sz), heightAt, camDist: innerWidth < innerHeight ? 7.5 : 5.2 });
    player.faceTowards(0, 0);

    // Banquo waits by the fire; the Weird Sisters stand round their cauldron inside
    // the stone circle, on the far side of the fire. Lady Macbeth waits at Inverness (scene 5).
    const solids = [...stones.solids, ...pit.solids, ...hollow.solids, ...yard.solids];
    const clearSpot = (angle, r, margin = 0.55) => {
      for (let step = 0; step < 60; step++) {
        const a = angle + (step % 2 ? 1 : -1) * Math.ceil(step / 2) * 0.05;
        const x = Math.sin(a) * r, z = Math.cos(a) * r;
        const free = solids.every((s) => Math.hypot(x - s.position.x, z - s.position.z) > Math.max(...s.size) / 0.7 + margin);
        if (free) return [x, z];
      }
      return [Math.sin(angle) * r, Math.cos(angle) * r];
    };
    stage = createStage({ heightAt, solids, macbeth });
    // load one of the cast onto the stage (hidden until the story shows them)
    const loading = new Map();
    loadActor = (id, x = 0, z = 0, yaw = 0, visible = false) => {
      if (!loading.has(id))
        loading.set(id, createCharacter(id, { ground: heightAt }).then((c) => {
          c.root.position.set(x, heightAt(x, z), z);
          c.root.rotation.y = yaw;
          c.root.visible = visible;
          c.root.updateMatrixWorld(true);
          c.settle();
          scene.add(c.root);
          const col = world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.28).setTranslation(x, heightAt(x, z) + 0.85, z));
          col.setEnabled(visible);
          stage.add(id, c, col);
          if (act1) act1.joined(id);
          return c;
        }).catch((err) => showError(`${id}: ` + (err && err.message ? err.message : err))));
      return loading.get(id);
    };
    const castReady = [];
    {
      const [x, z] = clearSpot(0.9, 2.6);
      castReady.push(loadActor('banquo', x, z, Math.atan2(-x, -z) + 0.5, true));
    }
    const [kx, kz] = clearSpot(Math.PI + 0.35, 6.4, 1.7);
    cauldron = createCauldron();
    cauldron.group.position.set(kx, heightAt(kx, kz), kz);
    scene.add(cauldron.group);
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.4, 0.45).setTranslation(kx, heightAt(kx, kz) + 0.4, kz));
    const toFire = Math.atan2(-kx, -kz); // the side of the cauldron facing the fire
    for (const [id, a] of [['witch1', toFire + Math.PI], ['witch2', toFire + Math.PI - 2.1], ['witch3', toFire + Math.PI + 2.1]]) {
      const x = kx + Math.sin(a) * 0.95, z = kz + Math.cos(a) * 0.95;
      castReady.push(loadActor(id, x, z, Math.atan2(kx - x, kz - z), true)); // facing the cauldron
    }
    hint.textContent = 'Summoning the cast…';
    await Promise.all(castReady);
    hint.textContent = hintText;
  }

  // The game itself: health and stamina, the arsenal, pickups, points of
  // interest, the raven and its scrolls (only with the full 3D Macbeth)
  let director = null;
  if (player && macbethChar && cauldron) {
    try {
      game = createGame({
        scene, camera, player, macbeth: macbethChar, heightAt, isTouch,
        solids: [...stones.solids, ...pit.solids, ...hollow.solids],
        standing: stones.solids.filter((s) => s.kind === 'box'),
        cauldronAt: cauldron.group.position,
        fireAt: new THREE.Vector3(0, 0, 0),
        folio: folioApi, settings,
        isCine: () => !!(director && director.cine),
        story: { get: () => (act1 ? act1.get() : null), set: (v) => act1 && act1.set(v) },
        side: { get: () => (yardQuest ? yardQuest.get() : null), set: (v) => yardQuest && yardQuest.set(v) },
      });
      for (const t of yardTargets) game.combat.addTarget(t);
      // the play, staged: lines, cameras, the Folio writing itself
      director = createDirector({ onPause: () => setPaused(true), scene, camera, heightAt, folio: folioApi, hud: game.hud, segments: act1Lines || {}, voiceBase: new URL('../assets/voice/', import.meta.url).href });
      act1 = createAct1({
        director, game, stage, folio: folioApi, segments: act1Lines || {}, lightning, mist, hollow,
        cauldronAt: cauldron.group.position, fireAt: new THREE.Vector3(0, 0, 0), player, macbeth: macbethChar, heightAt, camera, loadActor,
      });
      scene.add(act1.roadBeacon.group);
      director.addLines('yard', yardLines && yardLines.yard);
      yardQuest = createYardQuest({ game, director, yard, stage, player, loadActor, isTouch });
      if (/[?&]debug/.test(location.search)) window.__story = { act1, director, stage, folio: folioApi, yard };
    } catch (err) {
      showError('Game: ' + (err && err.message ? err.message : err));
    }
  }

  // Crates, dropped from the sky around Macbeth
  const crateGeo = new THREE.BoxGeometry(1, 1, 1);
  const crateMat = crateMaterial();
  const crates = [];
  const MAX_CRATES = narrow ? 40 : 80;
  const q = new THREE.Quaternion(), e = new THREE.Euler();
  function spawnCrate() {
    if (!world) return;
    const c = player ? player.position : new THREE.Vector3();
    const s = 0.55 + Math.random() * 0.6;
    const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 4;
    const x = c.x + Math.cos(a) * r, z = c.z + Math.sin(a) * r, y = heightAt(x, z) + 9 + Math.random() * 9;
    q.setFromEuler(e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3));
    const mesh = new THREE.Mesh(crateGeo, crateMat);
    mesh.scale.setScalar(s);
    mesh.position.set(x, y, z);
    mesh.quaternion.copy(q);
    mesh.castShadow = mesh.receiveShadow = true;
    scene.add(mesh);
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
        .setLinvel(0, -7, 0)
        .setAngvel({ x: Math.random() * 6 - 3, y: Math.random() * 6 - 3, z: Math.random() * 6 - 3 })
    );
    world.createCollider(RAPIER.ColliderDesc.cuboid(s / 2, s / 2, s / 2).setFriction(0.8).setRestitution(0.2).setDensity(0.6), body);
    crates.push({ mesh, body });
    if (crates.length > MAX_CRATES) removeCrate(crates.shift());
  }
  function removeCrate(c) {
    scene.remove(c.mesh);
    world.removeRigidBody(c.body);
  }
  const dropCrates = (n) => {
    for (let i = 0; i < n; i++) setTimeout(spawnCrate, i * 50);
  };

  // Quality presets
  const btnQuality = $('btn-quality');
  const quality = createQuality({
    renderer, grass, fire, narrow,
    onChange: (l) => {
      setDiag(diag.quality, l);
      btnQuality.textContent = `Quality: ${l}`;
    },
  });

  // The title card: continue or start (learn the play / just play). Its tap also
  // starts the sound, so the Old Man can be heard.
  const begin = (choice) => {
    startSound();
    if (choice !== 'continue') {
      clearGame();
      settings.set('mode', choice);
      folioApi.setMode(choice);
    }
    setFolio(!narrow && settings.values.mode === 'learn');
    if (game) game.begin(choice === 'continue');
    if (act1) act1.begin(choice !== 'continue');
    if (yardQuest) yardQuest.begin();
  };
  if (game) showTitle({ hasSave: !!loadGame(), onChoose: begin });

  // Pause: any time, mid-line included. The world, the story, the voices and the sounds all
  // stop where they are, and carry on from there.
  let paused = false;
  const pauseView = document.createElement('div');
  pauseView.className = 'overlay pause-view';
  pauseView.hidden = true;
  pauseView.innerHTML = `<div class="inner"><h1>Paused</h1><div class="sub"></div>
    <div class="choices"><button type="button" data-p="resume">Resume</button><button type="button" data-p="folio">The Folio</button><button type="button" data-p="settings">Settings</button></div>
    <div class="note">P or Esc to resume</div></div>`;
  document.body.appendChild(pauseView);
  function setPaused(on) {
    if (on === paused || !game || !game.began) return;
    paused = on;
    pauseView.hidden = !on;
    pauseView.classList.remove('reading');
    document.body.classList.toggle('paused', on);
    audio.pauseAll(on);
    if (on) {
      const sc = folioApi.shown ? folioApi.shown.split('.') : null;
      pauseView.querySelector('.sub').textContent = sc ? `Act ${['', 'I', 'II', 'III', 'IV', 'V'][sc[0]]}, Scene ${['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'][sc[1]]}` : '';
    }
  }
  pauseView.addEventListener('click', (e) => {
    const b = e.target.closest('[data-p]');
    if (!b) return;
    if (b.dataset.p === 'resume') setPaused(false);
    if (b.dataset.p === 'settings') settings.open();
    if (b.dataset.p === 'folio') {
      // read while paused: the menu shrinks to a small bar so the Folio is clear
      setFolio(true);
      pauseView.classList.add('reading');
    }
  });
  $('btn-pause').addEventListener('click', () => setPaused(!paused));
  $('btn-map').addEventListener('click', () => game && game.map.toggle());
  $('btn-settings').addEventListener('click', () => (settings.isOpen ? settings.close() : settings.open()));
  window.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.target.tagName === 'INPUT' || document.querySelector('.scroll-view, .title-view')) return;
    if (e.code === 'KeyP' || (e.code === 'Escape' && (paused || (director && director.running)) && !settings.isOpen)) {
      e.preventDefault();
      return setPaused(!paused);
    }
    if (paused && e.code !== 'Escape') return;
    if (e.code === 'KeyM' && game && !settings.isOpen) game.map.toggle();
    if (e.code === 'Escape' && game && !game.map.isOpen) settings.isOpen ? settings.close() : settings.open();
  });

  // Buttons. Sound starts on the first touch (a browser rule).
  const folio = $('folio'), btnFolio = $('btn-folio'), btnSound = $('btn-sound'), btnStats = $('btn-stats'), diagEl = $('diag');
  const setFolio = (open) => {
    folio.classList.toggle('closed', !open);
    btnFolio.setAttribute('aria-pressed', String(open));
  };
  setFolio(!narrow);
  const setStats = (on) => {
    diagEl.classList.toggle('hidden', !on);
    btnStats.setAttribute('aria-pressed', String(on));
  };
  setStats(false); // Settings > Stats shows the frame rate
  btnFolio.addEventListener('click', () => setFolio(folio.classList.contains('closed')));
  btnStats.addEventListener('click', () => setStats(diagEl.classList.contains('hidden')));
  $('btn-crates').addEventListener('click', () => dropCrates(8));
  $('btn-thunder').addEventListener('click', () => {
    startSound();
    lightning.strike({ near: true });
  });
  btnQuality.addEventListener('click', () => {
    quality.cycle();
  });
  const refreshSound = () => {
    const on = !audio.isMuted();
    btnSound.textContent = on ? 'Sound: on' : 'Sound: off';
    btnSound.setAttribute('aria-pressed', String(on));
  };
  let soundStarted = false;
  function startSound() {
    if (soundStarted) return;
    soundStarted = true;
    audio.start();
    refreshSound();
  }
  const firstTouch = () => {
    startSound();
    $('hint').style.opacity = '0';
  };
  renderer.domElement.addEventListener('pointerdown', firstTouch, { once: true });
  $('stick-zone').addEventListener('pointerdown', firstTouch, { once: true });
  window.addEventListener('keydown', firstTouch, { once: true });
  window.addEventListener('pointerdown', () => startSound(), { once: true }); // any tap, even on the HUD
  btnSound.addEventListener('click', () => {
    if (!soundStarted) return startSound();
    audio.setMuted(!audio.isMuted());
    refreshSound();
  });
  // phones: Strike (tap; hold and let go for a heavy blow) and Block (hold)
  {
    const strike = $('btn-strike'), blockBtn = $('btn-block');
    let t0 = 0;
    strike.addEventListener('pointerdown', (e) => {
      t0 = performance.now();
      e.preventDefault();
    });
    strike.addEventListener('pointerup', () => input.strike(performance.now() - t0 > 380 ? 'heavy' : 'light'));
    blockBtn.addEventListener('pointerdown', (e) => {
      input.holdBlock(true);
      e.preventDefault();
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) blockBtn.addEventListener(ev, () => input.holdBlock(false));
  }
  // let Space jump rather than re-press the last button clicked
  document.querySelectorAll('.controls button').forEach((b) => b.addEventListener('click', () => b.blur()));

  const updateScreen = () => setDiag(diag.screen, `${innerWidth}×${innerHeight} @${renderer.getPixelRatio().toFixed(1)}x`);
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    updateScreen();
  });
  updateScreen();

  // Main loop
  const fireDir = new THREE.Vector3(), fireFwd = new THREE.Vector3(), fireRight = new THREE.Vector3();
  const hemiBase = hemi.intensity;
  let fightLabel = '';
  let last = performance.now(), acc = 0, frames = 0, fpsTime = 0, wind = 0.2, fps = 60;
  renderer.setAnimationLoop(() => {
    const now = performance.now();
    const real = Math.min(0.5, (now - last) / 1000);
    const dt = Math.min(0.1, real);
    last = now;
    if (paused) {
      input.read(dt); // drain the input so nothing is stored up for later
      renderer.render(scene, camera);
      return;
    }

    const inp = input.read(dt);
    if (game) game.input(inp, dt);
    if (player) player.look(inp);

    if (world) {
      acc += dt;
      let steps = 0;
      while (acc >= world.timestep && steps < 5) {
        if (player) player.step(world.timestep, inp);
        inp.jump = false;
        world.step();
        acc -= world.timestep;
        steps++;
      }
      if (steps === 5) acc = 0;
      for (let i = crates.length - 1; i >= 0; i--) {
        const c = crates[i];
        const t = c.body.translation(), r = c.body.rotation();
        c.mesh.position.set(t.x, t.y, t.z);
        c.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        if (t.y < -60) {
          removeCrate(c);
          crates.splice(i, 1);
        }
      }
    }

    wind += (audio.windLevel() - wind) * Math.min(1, dt * 1.5);
    grass.wind.value = wind;
    if (player) player.frame(dt, wind);
    if (game) game.update(dt);
    // the rest of the cast (characters far from the camera skip their cloth simulation)
    if (stage) stage.update(dt, wind, camera);
    if (act1) act1.update(dt);
    yard.update(dt, camera);
    if (yardQuest) yardQuest.update(dt);
    // the score follows the story: its scenes first, then the yard's march, else the heath
    if (game && game.began) audio.setMusic((act1 && act1.musicCue) || (yardQuest && yardQuest.inYard ? 'yard' : 'heath'));
    if (director) director.update(dt, real);
    if (game && isTouch) {
      const lbl = game.combat.aiming ? 'Throw' : 'Strike';
      if (fightLabel !== lbl) $('btn-strike').textContent = fightLabel = lbl;
    }
    if (cauldron) cauldron.update(dt, camera);

    // keep the moon's shadow centred on Macbeth
    const focus = player ? player.position : fire.group.position;
    moon.target.position.set(Math.round(focus.x), 0, Math.round(focus.z));
    moon.position.copy(moon.target.position).addScaledVector(moonDir, 60);

    const flash = lightning.update(dt);
    hemi.intensity = hemiBase + flash * 6;
    sky.group.position.set(camera.position.x, 0, camera.position.z);
    sky.update(dt, flash);
    pit.update(dt);
    fire.update(dt, camera);
    // the fire's sound: loudness falls off with distance (about 1/d), panned to where it is
    {
      const fp = fire.group.position;
      const d = Math.hypot(focus.x - fp.x, focus.z - fp.z);
      camera.getWorldDirection(fireDir);
      const toFire = fireDir.set(fp.x - camera.position.x, 0, fp.z - camera.position.z).normalize();
      const fwd = camera.getWorldDirection(fireFwd);
      const right = fireRight.set(-fwd.z, 0, fwd.x).normalize();
      audio.setFireProximity(Math.min(1, 1.6 / (d + 0.6)) * (d > 45 ? 0 : 1), toFire.dot(right));
    }

    renderer.render(scene, camera);

    frames++;
    fpsTime += dt;
    if (fpsTime >= 0.5) {
      fps = Math.round(frames / fpsTime);
      setDiag(diag.fps, `${fps} fps`, fps >= 50 ? 'ok' : fps >= 28 ? 'warn' : 'bad');
      setDiag(diag.bodies, `${crates.length} crates`);
      frames = 0;
      fpsTime = 0;
    }
    quality.tick(dt, fps);
  });
}

main().catch((err) => {
  setDiag(diag.renderer, 'failed to start', 'bad');
  showError('Start-up: ' + (err && err.message ? err.message : err));
});
