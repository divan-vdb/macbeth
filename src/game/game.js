// The game layer on top of the world: Macbeth's health and stamina, his arsenal,
// things to pick up, glowing points of interest, the raven's scrolls and the
// tasks they set (kept in the Folio and on the map), the fire's bite, falling
// and rising again, first-time tips, and saving progress in the browser.
import * as THREE from 'three/webgpu';
import { createHud } from './hud.js';
import { createBeacon } from './beacon.js';
import { createRaven } from './raven.js';
import { openScroll } from './scroll.js';
import { createMap } from './map.js';
import { loadGame, saveGame } from './save.js';
import { makeBlade, makeSpear, makePebble, makeTonic } from '../characters/props.js';
import { glowTexture } from '../world/textures.js';
import { sfx, impact } from '../audio.js';
import { createCombat } from './combat.js';

const DEG = 180 / Math.PI;
const bearing = (dx, dz) => ((Math.atan2(dx, -dz) * DEG) + 360) % 360; // 0 = north (-z), 90 = east (+x)

// The Old Man's first letter. Our own words; read aloud in his voice.
const SCROLLS = {
  scroll1: {
    title: 'To Macbeth, Thane of Glamis',
    intro: "My lord. The battle is won, and the king will hear of your courage. But the night is not done with you yet, and the heath is no place for a careless man. Heed an old man's counsel:",
    tasks: [
      'Gather three stones from the heath. A stone thrown true has felled better men than you.',
      'Take up the spear that leans against the eastern standing stone.',
      "Find the healer's tonic by the northern stone, and keep it for the hour you bleed.",
      'Ready your sword, and feel its weight.',
      'Then seek the three sisters out on the heath, with Banquo at your side. They have been waiting for you, longer than you know.',
    ],
    outro: 'Mind the fire. It bites. And when the raven comes again, read what it brings.',
    sign: 'An old man who remembers',
    voice: 'assets/voice/scroll_oldman_1.json',
    group: "The Old Man's counsel",
  },
};

export function createGame({ scene, camera, player, macbeth, heightAt, solids, standing, cauldronAt, fireAt, isTouch, folio, settings, isCine = () => false, story = null, side = null, mount = null }) {
  const S = {
    health: 100, maxHealth: 100, stamina: 100, maxStamina: 100,
    stones: 0, maxStones: 10, tonics: 0,
    weapons: { fists: true, sword: true, spear: false, stones: true },
    equipped: 'fists',
    checkpoint: { x: player.position.x, z: player.position.z },
    dead: false,
  };
  let modal = false, began = false, exhausted = false, sinceRun = 0, sinceHurt = 99, healing = 0, burnTick = 0, wound = 0;
  let gathered = 0, saveTimer = 0, playTime = 0;
  const taken = new Set(); // ids of things picked up
  const tipsSeen = new Set();
  const received = {}; // scroll id -> 'read'
  const done = {};
  let tasks = [], title = '';
  // the story's own missions (Act I, scene 3 and on), shown above the scroll's tasks
  let storyGroup = null; // { title, tasks: [{ id, text, short }] }
  const sideGroups = new Map(); // key -> { title, tasks }
  let ravenHeld = false;
  const T = (desk, touch) => (isTouch ? touch : desk);

  const hud = createHud({
    touch: isTouch,
    onEquip: (k) => equip(k),
    onDrink: () => drink(),
    onInteract: () => interact(),
    onRise: () => rise(),
  });
  // first-time tips: each shown once (unless tips are turned off)
  const tip = (id, text) => {
    if (tipsSeen.has(id)) return;
    tipsSeen.add(id);
    if (settings.values.tips) hud.tip(text);
    save();
  };

  // ---------- interactables: anything with a prompt
  const things = [];
  const addThing = (t) => (things.push(t), t);
  const removeThing = (t) => {
    const i = things.indexOf(t);
    if (i >= 0) things.splice(i, 1);
    if (t.mesh) t.mesh.removeFromParent();
    if (t.beacon) t.beacon.dispose();
    if (t.glint) t.glint.removeFromParent();
  };
  let near = null;

  // a faint glint above small things lying in the heather, so they can be found
  const glintMat = new THREE.SpriteMaterial({ map: glowTexture(32, 0.3), color: 0xfff2c8, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 });
  const glint = (pos) => {
    const sp = new THREE.Sprite(glintMat);
    sp.scale.setScalar(0.22);
    sp.position.copy(pos).add(new THREE.Vector3(0, 0.12, 0));
    scene.add(sp);
    return sp;
  };

  // ---------- stones scattered over the heath
  const rand = mulberry(77);
  const clear = (x, z, m) => solids.every((s) => Math.hypot(x - s.position.x, z - s.position.z) > Math.max(...s.size) + m);
  for (let i = 0, tries = 0; i < 16 && tries < 400; tries++) {
    const a = rand() * Math.PI * 2, r = 4.5 + rand() * 13;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    if (!clear(x, z, 0.4) || Math.hypot(x - cauldronAt.x, z - cauldronAt.z) < 2) continue;
    const m = makePebble(i, 0.05 + rand() * 0.025);
    m.position.set(x, heightAt(x, z) + 0.025, z);
    m.rotation.y = rand() * 6;
    scene.add(m);
    const t = addThing({ id: `stone-${i}`, kind: 'stone', mesh: m, pos: m.position, radius: 1.4, label: 'Pick up the stone', glint: glint(m.position) });
    t.act = () => {
      if (S.stones >= S.maxStones) return hud.toast('Your pouch is full of stones.', 'warn');
      S.stones++;
      gathered++;
      take(t);
      sfx('pickup');
      hud.toast(`A stone, ${S.stones} in your pouch`);
      if (S.equipped === 'stones' && S.stones === 1) holdStone();
      tip('stones', T('Press 4 to ready your stones. Throwing comes with the fighting.', 'Tap the stones to ready them. Throwing comes with the fighting.'));
      progress();
    };
    i++;
  }

  // ---------- the boar spear, leaning on the eastern standing stone; a tonic at the northern
  const east = standing.reduce((a, b) => (b.position.x > a.position.x ? b : a));
  const north = standing.reduce((a, b) => (b.position.z < a.position.z ? b : a));
  const inward = (s, off) => {
    const d = new THREE.Vector3(-s.position.x, 0, -s.position.z).normalize();
    const p = s.position.clone().addScaledVector(d, Math.max(s.size[0], s.size[2]) + off);
    p.y = heightAt(p.x, p.z);
    return { p, d };
  };
  let spearObj = null;
  const takeSpear = () => {
    S.weapons.spear = true;
    if (spearObj) spearObj.removeFromParent();
    spearObj = makeSpear();
    macbeth.stow(spearObj, 'back');
  };
  const spearSpot = (() => {
    const { p, d } = inward(east, 0.16);
    const lean = new THREE.Group();
    const spear = makeSpear();
    spear.position.y = 0.86; // butt on the ground
    lean.add(spear);
    lean.position.copy(p);
    lean.rotation.y = Math.atan2(d.x, d.z);
    lean.rotateX(-0.2); // top resting against the stone
    scene.add(lean);
    const b = createBeacon('objective');
    b.group.position.copy(p);
    scene.add(b.group);
    const t = addThing({ id: 'spear', kind: 'spear', mesh: lean, pos: p, radius: 1.8, label: 'Take up the spear', beacon: b });
    t.act = () => {
      take(t);
      takeSpear();
      sfx('spear');
      hud.toast('The boar spear is yours', 'done');
      tip('spear', T('Press 3 to ready the spear; it rides on your back until then.', 'Tap the spear to ready it; it rides on your back until then.'));
      progress();
    };
    return p;
  })();
  const tonicSpot = (() => {
    const { p } = inward(north, 0.22);
    const m = makeTonic();
    m.position.copy(p);
    scene.add(m);
    const b = createBeacon('poi');
    b.group.position.copy(p);
    scene.add(b.group);
    const t = addThing({ id: 'tonic', kind: 'tonic', mesh: m, pos: p, radius: 1.5, label: "Take the healer's tonic", beacon: b });
    t.act = () => {
      S.tonics++;
      take(t);
      sfx('pickup');
      hud.toast("A healer's tonic", 'done');
      tip('tonic', T('When you are hurt, press Q to drink a tonic.', 'When you are hurt, tap the flask to drink a tonic.'));
      progress();
    };
    return p;
  })();
  function take(t) {
    taken.add(t.id);
    removeThing(t);
    save();
  }
  // the witches' cauldron glows green in the compass and on the heath
  const witchBeacon = createBeacon('witch', { height: 7, width: 1.1 });
  witchBeacon.group.position.set(cauldronAt.x, heightAt(cauldronAt.x, cauldronAt.z), cauldronAt.z);
  scene.add(witchBeacon.group);
  const beacons = () => [witchBeacon, ...things.filter((t) => t.beacon).map((t) => t.beacon)];

  // ---------- the arsenal
  let blade = null, pebble = null;
  function holdStone() {
    pebble = pebble || makePebble(99, 0.055);
    macbeth.hold(pebble);
  }
  function equip(k, quiet = false) {
    if (S.dead || modal) return;
    if (mount && mount.mounted) return hud.toast('Not while you are in the saddle.', 'warn');
    if (!S.weapons[k]) return hud.toast(k === 'spear' ? 'You have no spear yet.' : 'You have none.', 'warn');
    if (k === S.equipped) return;
    const prev = S.equipped;
    // put away what's in hand
    if (prev === 'sword') {
      macbeth.hold(null);
      macbeth.sheathed(true);
      macbeth.setIdle('Idle_Loop');
    } else if (prev === 'spear' && spearObj) {
      if (!S.spearOut) macbeth.stow(spearObj, 'back');
      macbeth.hold(null);
    } else macbeth.hold(null);
    S.equipped = k;
    if (k === 'sword') {
      blade = blade || makeBlade();
      macbeth.sheathed(false);
      macbeth.hold(blade);
      macbeth.setIdle('Sword_Idle');
      if (!quiet) sfx('draw');
      complete('sword');
      if (!quiet) tip('fight', T('Click to strike (F). Hold the click and let go for a heavy blow (R). Hold the right button to block (V).', 'Tap Strike to swing; hold it and let go for a heavy blow. Hold Block to guard.'));
    } else if (k === 'spear') {
      if (!S.spearOut) macbeth.hold(spearObj, { upright: true });
      if (!quiet) sfx('spear');
      if (!quiet) tip('throw', T('Aim with the view, then click to throw. Fetch the spear back afterwards.', 'Aim with the view, then tap Throw. Fetch the spear back afterwards.'));
    } else if (k === 'stones') {
      if (S.stones > 0) holdStone();
      if (!quiet && S.stones > 0) tip('throwstone', T('Aim with the view and click to throw a stone.', 'Aim with the view and tap Throw.'));
      else if (!quiet) hud.toast('Your pouch is empty. Gather stones from the heath.', 'warn');
      if (!quiet) sfx('stone');
    } else if (!quiet) sfx(prev === 'sword' ? 'sheathe' : 'fists');
    save();
  }
  function drink() {
    if (S.dead || modal) return;
    if (!S.tonics) return hud.toast('You have no tonic.', 'warn');
    if (S.health >= S.maxHealth) return hud.toast('You are not wounded.', 'warn');
    S.tonics--;
    healing += 55;
    sfx('drink');
    hud.toast('Warmth runs through you.');
    save();
  }

  // ---------- fighting: blows, the block, thrown spears and stones (see combat.js)
  S.spearOut = false;
  let spearPickup = null;
  function recoverSpear(t) {
    if (t) removeThing(t);
    spearPickup = null;
    S.spearOut = false;
    if (S.equipped === 'spear') macbeth.hold(spearObj, { upright: true });
    else macbeth.stow(spearObj, 'back');
    sfx('spear');
  }
  const combat = createCombat({
    scene, camera, player, macbeth, heightAt, solids, S, hud, tip, T,
    getSpear: () => spearObj,
    addPickup: ({ kind, mesh, label }) => {
      const pos = mesh.getWorldPosition(new THREE.Vector3());
      const t = addThing({ id: `thrown-${kind}-${Math.random().toString(36).slice(2, 7)}`, kind: 'thrown', mesh: null, pos, radius: kind === 'spear' ? 1.7 : 1.3, label, glint: kind === 'stone' ? glint(pos) : null });
      if (kind === 'spear') {
        spearPickup = t;
        t.act = () => recoverSpear(t);
      } else
        t.act = () => {
          if (S.stones >= S.maxStones) return hud.toast('Your pouch is full of stones.', 'warn');
          S.stones++;
          mesh.removeFromParent();
          removeThing(t);
          sfx('pickup');
          if (S.equipped === 'stones' && S.stones === 1) holdStone();
        };
    },
  });
  // a blow aimed at Macbeth: turned aside if he blocks facing it, otherwise it lands
  function hurtFrom({ amount, from }) {
    const p = player.position, f = macbeth.root.rotation.y;
    const a = Math.atan2(from.x - p.x, from.z - p.z);
    // a raised guard covers all but the back
    const facingIt = Math.abs(Math.atan2(Math.sin(a - f), Math.cos(a - f))) < 2.1;
    if (combat.blocking && facingIt) {
      S.stamina = Math.max(0, S.stamina - 10);
      impact('wood', 1);
      return true;
    }
    hurt(amount);
    if (!S.dead) macbeth.perform('Hit_Chest', { speed: 0.9 });
    const back = new THREE.Vector3(p.x - from.x, 0, p.z - from.z).normalize().multiplyScalar(3.5);
    player.push(back.x, back.z);
    return false;
  }

  // ---------- tasks, set by the raven's scrolls
  const markers = {
    stones: () => {
      let best = null, bd = Infinity;
      for (const t of things) if (t.kind === 'stone') {
        const d = t.pos.distanceToSquared(player.position);
        if (d < bd) (bd = d), (best = t.pos);
      }
      return best;
    },
    spear: () => (taken.has('spear') ? null : spearSpot),
    tonic: () => (taken.has('tonic') ? null : tonicSpot),
    witches: () => cauldronAt,
  };
  const pinKinds = {}; // marker id -> compass pin style
  function setTasksFromScroll1() {
    title = SCROLLS.scroll1.group;
    tasks = [
      { id: 'stones', text: 'Gather stones from the heath', short: 'three stones gathered' },
      { id: 'spear', text: 'Take up the spear by the eastern stone', short: 'the boar spear' },
      { id: 'tonic', text: "Find the healer's tonic by the northern stone", short: "the healer's tonic" },
      { id: 'sword', text: T('Ready your sword (press 2)', 'Ready your sword (tap the sword)'), short: 'sword in hand' },
      { id: 'witches', text: 'Seek the weird sisters on the heath, with Banquo', short: 'the weird sisters found' },
    ];
  }
  function complete(id) {
    if (done[id]) return;
    done[id] = true;
    const t = tasks.find((x) => x.id === id) || (storyGroup && storyGroup.tasks.find((x) => x.id === id)) || [...sideGroups.values()].map((g) => g.tasks.find((x) => x.id === id)).find(Boolean);
    if (t) {
      sfx('objective');
      hud.toast(`Done: ${t.short}`, 'done');
    }
    refreshTasks();
    save();
  }
  function progress() {
    if (gathered >= 3) complete('stones');
    if (S.weapons.spear) complete('spear');
    if (taken.has('tonic')) complete('tonic');
    refreshTasks();
  }
  function taskItems(list = tasks) {
    let activeSet = false;
    return list.map((t) => {
      const d = !!done[t.id];
      const active = !d && !activeSet;
      if (active) activeSet = true;
      return { id: t.id, text: t.text, done: d, active, count: t.id === 'stones' ? gathered : 0, target: t.id === 'stones' ? 3 : 0 };
    });
  }
  function refreshTasks(fresh = false) {
    const items = taskItems();
    const groups = [];
    let shown = tasks.length ? { title, items } : null;
    if (storyGroup) {
      const sItems = taskItems(storyGroup.tasks);
      groups.push({ title: storyGroup.title, items: sItems });
      if (sItems.some((t) => !t.done) || !shown) shown = { title: storyGroup.title, items: sItems };
    }
    if (tasks.length) groups.push({ title, items });
    for (const g of sideGroups.values()) {
      const gi = taskItems(g.tasks);
      groups.push({ title: g.title, items: gi });
      if (g.focus && gi.some((t) => !t.done)) shown = { title: g.title, items: gi };
    }
    if (shown) hud.todos(shown.title, shown.items);
    if (folio && groups.length) folio.setTasks(groups, { fresh });
  }
  // every open task, scroll and story alike, with where it is
  function openTasks() {
    const out = [];
    const add = (list) => {
      for (const t of taskItems(list)) if (!t.done && markers[t.id]) out.push({ ...t, label: list.find((x) => x.id === t.id).text.replace(/ \(.*\)$/, '') });
    };
    // a side quest shows only its current step on the compass
    const sideAdd = (g) => {
      const first = taskItems(g.tasks).find((t) => !t.done && markers[t.id]);
      if (first) out.push({ ...first, label: g.tasks.find((x) => x.id === first.id).text.replace(/ \(.*\)$/, '') });
    };
    for (const g of sideGroups.values()) if (g.focus) sideAdd(g);
    if (storyGroup) add(storyGroup.tasks);
    add(tasks);
    for (const g of sideGroups.values()) if (!g.focus) sideAdd(g);
    return out;
  }
  const mapMarkers = () => {
    const list = [];
    let firstOpen = true;
    for (const t of openTasks()) {
      const at = markers[t.id]();
      if (!at) continue;
      list.push({ id: t.id, label: t.label, at, kind: firstOpen ? 'objective' : 'poi' });
      firstOpen = false;
    }
    if (!tasks.length) {
      if (!taken.has('spear')) list.push({ id: 'spear', label: 'A spear', at: spearSpot, kind: 'objective' });
      if (!taken.has('tonic')) list.push({ id: 'tonic', label: 'A flask', at: tonicSpot, kind: 'poi' });
    }
    const sc = things.find((t) => t.kind === 'scroll');
    if (sc) list.push({ id: 'scroll', label: 'A scroll', at: sc.pos, kind: 'objective' });
    return list;
  };

  // ---------- the map
  const map = createMap({
    heightAt, solids, fireAt, cauldronAt,
    getMarkers: mapMarkers,
    getPlayer: () => {
      const r = macbeth.root.rotation.y;
      return { x: player.position.x, z: player.position.z, bearing: bearing(Math.sin(r), Math.cos(r)) };
    },
  });

  // ---------- the raven and its scrolls
  const raven = createRaven(scene, heightAt);
  let ravenTimer = Number(new URLSearchParams(location.search).get('raven')) || 7; // ?raven=s for testing
  function readScroll(id, first) {
    const sc = SCROLLS[id];
    modal = true;
    hud.hidden(true);
    openScroll({ ...sc, voice: settings.values.readAloud ? sc.voice : null }, () => {
      modal = false;
      hud.hidden(false);
      if (first) {
        received[id] = 'read';
        setTasksFromScroll1();
        if (S.equipped === 'sword') done.sword = true;
        progress();
        refreshTasks(true);
        if (folio) folio.setScrolls(Object.keys(received).map((k) => ({ id: k, title: SCROLLS[k].title, sign: SCROLLS[k].sign })));
        sfx('objective');
        save();
        tip('tasks', T('Your tasks are kept in the Folio and on the right. Follow the gold mark on the compass. Press M for the map.', 'Your tasks are kept in the Folio. Follow the gold mark on the compass, or open the Map.'));
      }
    });
  }
  function sendRaven() {
    const p = player.position;
    const yaw = player.yaw;
    const fwd = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    // beside Macbeth's path, not hidden behind him from the camera
    let spot = p.clone().addScaledVector(fwd, 1.6).addScaledVector(right, 1.3);
    if (!clear(spot.x, spot.z, 0.3)) spot = p.clone().addScaledVector(right, 1.6);
    raven.deliver(spot, fwd, (scroll) => {
      const t = addThing({ id: 'scroll1', kind: 'scroll', mesh: scroll, pos: scroll.position, radius: 2.3, label: 'Read the scroll', glint: glint(scroll.position) });
      t.act = () => {
        removeThing(t);
        readScroll('scroll1', true);
      };
      hud.toast('A raven has brought you a scroll');
      tip('scroll', T('A raven brings word. Walk to the scroll and press E to read it.', 'A raven brings word. Walk to the scroll and tap Read.'));
    });
  }

  function interact() {
    if (S.dead || modal || !near || isCine()) return;
    near.act();
    near = null;
    hud.prompt(null);
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.target.tagName === 'INPUT') return;
    if (map.isOpen || settings.isOpen) return;
    if (e.code === 'KeyE') interact();
    else if (e.code === 'KeyQ') drink();
    else if (e.code === 'Digit1') equip('fists');
    else if (e.code === 'Digit2') equip('sword');
    else if (e.code === 'Digit3') equip('spear');
    else if (e.code === 'Digit4') equip('stones');
  });

  function hurt(amount) {
    if (S.dead) return;
    S.health = Math.max(0, S.health - amount);
    sinceHurt = 0;
    wound = Math.min(1, wound + amount / 25);
    if (S.health <= 0) {
      S.dead = true;
      sfx('fall');
      setTimeout(() => hud.fallen(true), 700);
    }
  }
  function rise() {
    if (!S.dead) return;
    S.dead = false;
    S.health = S.maxHealth;
    S.stamina = S.maxStamina;
    healing = 0;
    wound = 0;
    hud.fallen(false);
    player.teleport(S.checkpoint.x, S.checkpoint.z);
    macbeth.settle();
    sfx('rise');
    save();
  }

  const crosshair = document.getElementById('crosshair');

  // ---------- saving and restoring
  function save() {
    if (!began) return;
    const p = player.position;
    saveGame({
      v: 1,
      health: Math.round(S.health), stones: S.stones, tonics: S.tonics, weapons: S.weapons, equipped: S.equipped,
      gathered, taken: [...taken], done, received, tips: [...tipsSeen],
      at: { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }, playTime: Math.round(playTime),
      story: story ? story.get() : null,
      side: side ? side.get() : null,
    });
  }
  function restore(d) {
    if (!d || d.v !== 1) return false;
    for (const id of d.taken || []) {
      const t = things.find((x) => x.id === id);
      if (t) {
        taken.add(id);
        removeThing(t);
      }
    }
    if (d.weapons && d.weapons.spear) takeSpear();
    S.stones = d.stones || 0;
    S.tonics = d.tonics || 0;
    S.health = Math.max(20, d.health || 100);
    gathered = d.gathered || 0;
    Object.assign(done, d.done || {});
    Object.assign(received, d.received || {});
    (d.tips || []).forEach((t) => tipsSeen.add(t));
    playTime = d.playTime || 0;
    if (received.scroll1) {
      setTasksFromScroll1();
      refreshTasks();
      if (folio) folio.setScrolls(Object.keys(received).map((k) => ({ id: k, title: SCROLLS[k].title, sign: SCROLLS[k].sign })));
      ravenTimer = 0;
    }
    if (d.at && Number.isFinite(d.at.x)) player.teleport(d.at.x, d.at.z);
    if (story) story.set(d.story || null);
    if (side) side.set(d.side || null);
    if (d.equipped && d.equipped !== 'fists') equip(d.equipped, true);
    return true;
  }
  addEventListener('pagehide', () => save());
  document.addEventListener('visibilitychange', () => document.hidden && save());

  // ?debug: let tests take things without walking to them
  if (/[?&]debug/.test(location.search))
    window.__game = { S, take: (kind) => { const t = things.find((x) => x.kind === kind); if (t) t.act(); }, hurt, equip, drink, done, save, map, things, player, scene, macbeth, combat };

  return {
    hud,
    map,
    get blocking() {
      return modal || S.dead || map.isOpen || settings.isOpen || isCine();
    },
    get began() {
      return began;
    },
    // ---------- for the story: its own tasks, markers, the raven held back for a cinematic
    complete,
    isDone: (id) => !!done[id],
    get trainingDone() {
      return ['stones', 'spear', 'tonic', 'sword'].every((k) => done[k]);
    },
    get hasCounsel() {
      return !!received.scroll1;
    },
    // side quests: their own group of tasks; focus puts them first in the tracker
    setGroup(key, groupTitle, list, { fresh = true, focus = false } = {}) {
      if (list) sideGroups.set(key, { title: groupTitle, tasks: list, focus });
      else sideGroups.delete(key);
      refreshTasks(fresh);
    },
    // a fixed place to use (a rack, a basket): stays after use
    addSpot({ id, pos, radius = 1.8, label, act }) {
      const t = addThing({ id, kind: 'spot', mesh: null, pos, radius, label });
      t.act = () => {
        act();
        near = null;
      };
      // keep it: re-add after the interaction removed nothing
      return t;
    },
    combat,
    equip: (k, quiet) => equip(k, quiet),
    hurtFrom,
    // the yard's rack: a practice spear (or your own, fetched back)
    rackSpear() {
      if (!S.weapons.spear) takeSpear();
      else if (S.spearOut) {
        if (spearPickup) {
          spearPickup.act = null;
          removeThing(spearPickup);
          spearPickup = null;
        }
        S.spearOut = false;
        if (S.equipped === 'spear') macbeth.hold(spearObj, { upright: true });
        else macbeth.stow(spearObj, 'back');
      }
      progress();
      equip('spear');
      sfx('spear');
    },
    fillPouch() {
      S.stones = S.maxStones;
      sfx('stone');
      if (S.equipped !== 'stones') equip('stones');
      else holdStone();
    },
    giveTonics(n) {
      S.tonics += n;
      sfx('drink');
    },
    get equipped() {
      return S.equipped;
    },
    setStoryTasks(groupTitle, list, { fresh = true } = {}) {
      storyGroup = list ? { title: groupTitle, tasks: list } : null;
      refreshTasks(fresh);
    },
    setMarker(id, fn, pin = 'objective') {
      markers[id] = fn;
      pinKinds[id] = pin;
    },
    holdRaven(on) {
      ravenHeld = on;
    },
    toast: (text, kind) => hud.toast(text, kind),
    tip,
    witchBeacon,
    save: () => save(),
    state: S,
    // start playing: fresh, or carrying on from the saved game
    begin(continueSaved) {
      began = true;
      if (continueSaved && restore(loadGame())) hud.toast('Welcome back to the heath');
      else tip('look', T('Drag with the mouse to look around. W A S D to walk, Shift to run.', 'Left thumb to walk, push further to run. Drag anywhere else to look around.'));
      save();
    },
    readScroll: (id) => SCROLLS[id] && received[id] && readScroll(id, false),
    showOnMap: (id) => map.open(id),
    // shape this frame's controls: no running when spent, jumping costs breath
    input(inp, dt) {
      if (modal || S.dead || map.isOpen || settings.isOpen || !began || isCine()) {
        combat.block(false);
        inp.x = inp.y = 0;
        inp.jump = inp.run = false;
        if (map.isOpen || settings.isOpen || isCine()) inp.lookX = inp.lookY = inp.zoom = 0;
        return inp;
      }
      // in the saddle: the horse takes the controls; no blows or jumps from her back
      if (mount && mount.mounted) {
        if (inp.attack) tip('saddlefight', T('Get down from the saddle (E) to fight.', 'Get down from the saddle to fight.'));
        inp.attack = null;
        inp.block = false;
        inp.jump = false;
        combat.block(false);
        return inp;
      }
      if (S.stamina <= 0) exhausted = true;
      if (exhausted && S.stamina > S.maxStamina * 0.3) exhausted = false;
      if (exhausted) inp.run = false;
      if (inp.jump) {
        if (S.stamina < 12) inp.jump = false;
        else S.stamina -= 12;
      }
      combat.block(!!inp.block);
      if (inp.attack) combat.attack(inp.attack);
      combat.input(inp);
      return inp;
    },
    update(dt) {
      const p = player.position;
      const moving = player.speed;
      if (began) playTime += dt;
      // stamina: running spends it, resting restores it (in the saddle, he rests)
      const riding = mount && mount.mounted;
      if (riding) {
        S.stamina = Math.min(S.maxStamina, S.stamina + 14 * dt);
      } else if (moving > 3.0) {
        S.stamina = Math.max(0, S.stamina - 15 * dt);
        sinceRun = 0;
        if (S.stamina < 30) tip('tired', 'Macbeth is short of breath: walk a while to recover.');
      } else {
        sinceRun += dt;
        if (sinceRun > 0.7) S.stamina = Math.min(S.maxStamina, S.stamina + (moving > 0.3 ? 14 : 24) * dt);
      }
      // health: tonics heal over a few seconds; small wounds close slowly on their own (up to half)
      if (healing > 0) {
        const h = Math.min(healing, 30 * dt);
        healing -= h;
        S.health = Math.min(S.maxHealth, S.health + h);
      }
      sinceHurt += dt;
      if (!S.dead && sinceHurt > 6 && S.health < S.maxHealth * 0.5) S.health = Math.min(S.maxHealth * 0.5, S.health + 1.5 * dt);
      // the fire bites anyone who stands in it
      if (!S.dead && Math.hypot(p.x - fireAt.x, p.z - fireAt.z) < 1.05 && p.y < heightAt(p.x, p.z) + 0.6) {
        hurt(26 * dt);
        burnTick -= dt;
        if (burnTick <= 0) {
          sfx('burn');
          burnTick = 0.45;
        }
        tip('fire', 'The fire bites! Step out of it.');
      }
      wound = Math.max(0, wound - dt * 0.8);
      hud.wound(wound + (S.health < 30 ? 0.25 + Math.sin(performance.now() / 250) * 0.08 : 0));

      // the raven comes once Macbeth has had a moment on the heath
      if (began && ravenTimer > 0 && !ravenHeld) {
        ravenTimer -= dt;
        if (ravenTimer <= 0) sendRaven();
      }
      raven.update(dt);
      combat.update(dt);
      const aim = combat.aiming && !modal && !isCine() && !S.dead;
      player.setAim(aim);
      if (crosshair) crosshair.hidden = !aim;
      if (began && playTime > 75) tip('settings', 'Narration, voices and the sounds of the world each have their own volume in Settings.');

      // nearest thing in reach
      let best = null, bd = Infinity;
      if (!modal && !S.dead && !isCine())
        for (const t of things) {
          const d = Math.hypot(t.pos.x - p.x, t.pos.z - p.z);
          if (d < t.radius && d < bd) (bd = d), (best = t);
        }
      near = best;
      hud.prompt(best ? best.label : null);
      if (best && best.kind !== 'scroll') tip('pickup', T('Press E to take things up.', 'Tap the button to take things up.'));

      // the glowing points of interest and the glint of things in the grass
      for (const b of beacons()) b.update(dt, camera, p);
      glintMat.opacity = 0.45 + Math.sin(performance.now() / 300) * 0.25;

      // compass: the view's heading, the witches, and the markers of open tasks
      const yaw = player.yaw;
      const heading = bearing(-Math.sin(yaw), -Math.cos(yaw));
      const pins = [];
      const pin = (id, at, kind) => at && pins.push({ id, kind, deg: bearing(at.x - p.x, at.z - p.z), dist: Math.hypot(at.x - p.x, at.z - p.z) });
      let first = true;
      for (const t of openTasks()) {
        pin(t.id, markers[t.id](), pinKinds[t.id] || (first ? 'objective' : 'poi'));
        first = false;
      }
      hud.compass(heading, pins);
      // on horseback the bar shows her wind
      if (riding) hud.vitals(S.health, S.maxHealth, mount.wind, 100);
      else hud.vitals(S.health, S.maxHealth, S.stamina, S.maxStamina);
      hud.arsenal(S);

      // keep the save fresh
      saveTimer += dt;
      if (saveTimer > 12) {
        saveTimer = 0;
        save();
      }
    },
  };
}

function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
