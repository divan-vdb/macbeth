// Act I, scenes 1 to 3, played in the world.
//   1.1  After the title: the Old Man by his fire, then the sisters at their cauldron
//        in the storm. They vanish into the fog, and the raven brings his counsel.
//   1.2  When Macbeth has trained (or nears the hollow): the Old Man's hearth. He
//        tells what passed at the king's camp, and we hear it.
//   1.3  Banquo walks with Macbeth to the blasted hollow on the road to Forres.
//        The sisters' tale is overheard on the approach, then the prophecies,
//        their vanishing, and Ross and Angus with the news of Cawdor.
//   Then the road to Forres, where the next chapter begins.
import * as THREE from 'three/webgpu';
import { actorId, faceShot, overShoulder, wideShot } from './director.js';
import { createBeacon } from '../game/beacon.js';
import { sfx } from '../audio.js';

const STEPS = ['s11', 'train', 'walk', 'forres', 'end'];

export function createAct1({ director, game, stage, folio, segments, lightning, mist, hollow, cauldronAt, fireAt, player, macbeth, heightAt, camera, loadActor }) {
  let step = 's11';
  let busy = false, partA = 'todo', banquoWalk = false;
  let cue = null; // the score the story asks for (the heath's own music otherwise)
  const H = hollow.treeAt;
  // the hollow's frame: f points back the way the party comes (from the stone circle)
  const f = new THREE.Vector3(fireAt.x - H.x, 0, fireAt.z - H.z).normalize();
  const side = new THREE.Vector3(f.z, 0, -f.x);
  const spot = (fwd, s) => [H.x + f.x * fwd + side.x * s, H.z + f.z * fwd + side.z * s];
  const WITCH_SPOTS = { witch1: spot(1.9, 0), witch2: spot(2.15, -1.55), witch3: spot(2.15, 1.55) };
  const MAC = spot(5.6, -0.75), BANQ = spot(5.6, 0.85);
  const ROSS = spot(3.0, -0.95), ANGUS = spot(3.1, 1.15);
  const ROAD = new THREE.Vector3(H.x - f.x * 42, 0, H.z - f.z * 42);
  ROAD.y = heightAt(ROAD.x, ROAD.z);
  const WITCHES = ['witch1', 'witch2', 'witch3'];
  const A = (name) => stage.get(actorId(name));
  const dist = (x, z) => Math.hypot(player.position.x - x, player.position.z - z);
  const after = (s) => director.wait(s); // stands still while paused

  const bank = mist.bank(H, { radius: 11, count: 26, density: 0.35, seed: 13 });
  const roadBeacon = createBeacon('objective', { height: 6, width: 0.9 });
  roadBeacon.group.position.copy(ROAD);
  roadBeacon.group.visible = false;
  game.witchBeacon.group.visible = false;
  // put the beacon's own scene in place: the beacon module expects to be added by its owner
  roadBeacon.group.userData.story = true;

  // ---------- the cast on and off the stage
  function witchesAt(where) {
    WITCHES.forEach((id, i) => {
      const c = stage.get(id);
      if (!c) return;
      if (where === 'cauldron') return; // they keep the places main.js gave them
      if (where === 'hollow') {
        const [x, z] = WITCH_SPOTS[id];
        stage.place(id, x, z, Math.atan2(H.x - x, H.z - z) + (i - 1) * 0.6);
        stage.show(id, true);
      } else stage.show(id, false);
    });
  }
  function vanish(where) {
    lightning.strike({ near: true });
    sfx('vanish');
    for (const id of WITCHES) {
      const c = stage.get(id);
      if (c && c.root.visible) mist.burst(c.root.position);
    }
    director.wait(0.65).then(() => WITCHES.forEach((id) => stage.show(id, false)));
    if (where === 'hollow') {
      bank.set(0.3);
      game.witchBeacon.group.visible = false;
    }
  }
  // the scene's actors for the director (speakers talk with their hands)
  const actors = () => ({ macbeth, banquo: stage.get('banquo'), ross: stage.get('ross'), angus: stage.get('angus'), witch1: stage.get('witch1'), witch2: stage.get('witch2'), witch3: stage.get('witch3') });

  // ---------- shots chosen line by line: who speaks, and to whom
  let turn = 0, last = null;
  const TO_BANQUO = new Set(['1.3.25', '1.3.26', '1.3.27', '1.3.28']);
  function autoShot(s) {
    if (s.narration) return null;
    const mac = macbeth;
    if (s.aside) return faceShot(mac, { dist: 1.05, side: (turn++ % 2 ? 0.22 : -0.22), drift: 0.2, dur: s.dur + 1 });
    if (s.who === 'All') return wideShot(WITCHES.map(stage.get), { bearing: Math.atan2(f.x, f.z), dist: 5.2, up: 1.5, look: 1.3, dur: s.dur + 1 });
    const sp = A(s.who);
    if (!sp) return null;
    let listener = null;
    if (/Witch/.test(s.who)) listener = s.scene === '1.1' ? stage.get(actorId(last && /Witch/.test(last) && last !== s.who ? last : s.who === 'First Witch' ? 'Second Witch' : 'First Witch')) : TO_BANQUO.has(s.key) ? stage.get('banquo') : mac;
    else if (last && last !== s.who && A(last)) listener = A(last);
    else listener = s.who === 'Macbeth' ? stage.get('banquo') : mac;
    last = s.who;
    const t = turn++;
    if (!listener || t % 3 === 1) return faceShot(sp, { side: t % 2 ? 0.5 : -0.5, dur: s.dur + 1 });
    return overShoulder(listener, sp, { side: t % 2 ? -0.55 : 0.55, dur: s.dur + 1 });
  }
  // a part's lines as director steps, with extra events and shots by key
  function stepsFor(part, on = {}, skip = new Set()) {
    return (segments[part] || [])
      .filter((s) => !skip.has(s.key))
      .map((s) => {
        const h = on[s.key] || {};
        const st = s.dir ? { dir: s.key, text: h.text === false || /^Exe?unt|^Exit/.test(s.dir) ? null : s.dir } : { say: s.key };
        if (!s.dir) st.shot = h.shot !== undefined ? h.shot : autoShot(s);
        else if (h.shot) st.shot = h.shot;
        if (h.do) st.do = h.do;
        if (h.wait) st.wait = h.wait;
        if (h.cine !== undefined) st.cine = h.cine;
        return st;
      });
  }
  const at = (x, y, z) => new THREE.Vector3(x, y, z);
  // the Old Man's hearth: low by the camp fire, circling slowly
  const hearth = (a0, r = 1.5, h = 0.55, look = 0.35) => {
    const t0 = performance.now();
    const fy = heightAt(fireAt.x, fireAt.z);
    return {
      from: () => {
        const a = a0 + ((performance.now() - t0) / 1000) * 0.035;
        return at(fireAt.x + Math.sin(a) * r, fy + h, fireAt.z + Math.cos(a) * r);
      },
      at: () => at(fireAt.x, fy + look, fireAt.z),
      dur: 60,
    };
  };

  // ---------- Act I, scene 1
  async function play11() {
    busy = true;
    step = 's11';
    game.holdRaven(true);
    folio.goto('1.1');
    witchesAt('cauldron');
    const k = cauldronAt;
    const ky = heightAt(k.x, k.z);
    const toFire = Math.atan2(fireAt.x - k.x, fireAt.z - k.z);
    cue = 'hearth';
    await director.run(
      [
        { cine: true, shot: hearth(0.4, 2.7, 0.95, 0.55), say: 'n.open' },
        ...stepsFor('act1_s11', {
          '1.1.0': {
            shot: { from: at(k.x + Math.sin(toFire) * 5.5, ky + 1.1, k.z + Math.cos(toFire) * 5.5), at: at(k.x, ky + 1.1, k.z), drift: 0.18, dur: 9 },
            do: () => {
              cue = 'witches';
              lightning.strike({ near: true });
              if (!director.skipping) director.card('Act I &middot; Scene I', 'A desert place', 'Thunder and lightning');
            },
            wait: 1.2,
          },
          '1.1.11': { do: () => vanish('cauldron'), wait: 0.4 },
          'fx.11cackle': { shot: null },
          'n.11end': { shot: { from: at(k.x + Math.sin(toFire) * 3.2, ky + 2.4, k.z + Math.cos(toFire) * 3.2), at: at(k.x, ky + 0.6, k.z), drift: -0.25, dur: 14 } },
        }, new Set(['n.open'])),
      ],
      { actors: actors() },
    );
    folio.finish('1.1');
    cue = null;
    step = 'train';
    arrange();
    game.holdRaven(false);
    busy = false;
    game.save();
  }

  // ---------- Act I, scene 2: the Old Man tells it by his fire
  async function play12() {
    busy = true;
    cue = 'hearth';
    folio.goto('1.2');
    await director.run(
      stepsFor('act1_s12', {
        'n.12a': {
          cine: true,
          shot: hearth(2.2, 2.6, 0.85, 0.5),
          do: () => {
            if (!director.skipping) director.card('Act I &middot; Scene II', 'A camp near Forres', 'As the Old Man tells it'); // the Old Man begins as the curtain rises
          },
        },
        '1.2.3b': { shot: hearth(3.6, 2.2, 0.7, 0.4) },
        '1.2.4': { shot: null },
        'n.12b': { shot: hearth(5.0, 3.0, 1.3, 0.45) },
        '1.2.12': { shot: hearth(0.7, 2.3, 0.75, 0.5) },
        '1.2.13': { shot: null }, '1.2.14': { shot: null }, '1.2.15': { shot: null }, '1.2.17': { shot: hearth(1.9, 2.1, 0.6, 0.35) },
        '1.2.18': { shot: null }, '1.2.19': { shot: null },
        'n.12c': { shot: hearth(4.2, 3.2, 1.5, 0.45) },
      }),
      { actors: actors() },
    );
    folio.finish('1.2');
    cue = null;
    step = 'walk';
    arrange();
    busy = false;
    game.toast('Banquo walks with you', 'done');
    game.save();
    // the Old Man speaks as you walk
    director.run([{ say: 'n.walk' }], { actors: actors() });
  }

  // ---------- Act I, scene 3, part A: overheard on the approach
  async function playPartA() {
    partA = 'playing';
    cue = 'witches';
    folio.goto('1.3');
    for (const id of WITCHES) stage.face(id, { x: H.x + f.x * 2, z: H.z + f.z * 2 }); // conferring
    const towardParty = () => WITCHES.forEach((id) => stage.face(id, macbeth));
    await director.run(
      stepsFor('act1_s13a', {
        '1.3.0': { do: () => {
          lightning.strike({ near: false });
          bank.set(1);
          if (!director.skipping) director.card('Act I &middot; Scene III', 'A heath near Forres', null, 3);
        } },
        '1.3.11': { do: () => {
          sfx('drum');
          towardParty();
        }, wait: 0.6 },
        '1.3.13': { do: towardParty },
      }, new Set(['n.walk'])),
      { actors: actors() },
    );
    partA = 'done';
  }

  // ---------- Act I, scene 3, parts B and C: the prophecies, and the news of Cawdor
  let arrivals = null;
  function rossAndAngus() {
    if (!stage.has('ross') || !stage.has('angus')) return Promise.resolve();
    sfx('hooves');
    const from = (s) => [H.x - f.x * 22 + side.x * s, H.z - f.z * 22 + side.z * s];
    const round = (s) => [H.x - f.x * 1.5 + side.x * s, H.z - f.z * 1.5 + side.z * s];
    stage.place('ross', ...from(-3.5), Math.atan2(f.x, f.z));
    stage.place('angus', ...from(-5), Math.atan2(f.x, f.z));
    stage.show('ross', true);
    stage.show('angus', true);
    const r = stage.walkTo('ross', [round(-4.2), ROSS]);
    const a = after(1.2).then(() => stage.walkTo('angus', [round(-5.4), ANGUS]));
    return Promise.all([r, a]).then(() => {
      stage.face('ross', macbeth);
      stage.face('angus', macbeth);
    });
  }
  async function playParts() {
    busy = true;
    cue = 'witches';
    const banquo = stage.get('banquo');
    const pair = [macbeth, banquo];
    const behindWitches = { from: () => at(H.x + f.x * 0.6 + side.x * 0.9, H.y + 1.9, H.z + f.z * 0.6 + side.z * 0.9), at: () => at((MAC[0] + BANQ[0]) / 2, H.y + 1.4, (MAC[1] + BANQ[1]) / 2), drift: 0.12, dur: 6 };
    const wideAll = (bearingOff = 0) => wideShot([...pair, ...['ross', 'angus'].map(stage.get).filter(Boolean)], { bearing: Math.atan2(side.x, side.z) + bearingOff, dist: 7.5, up: 2.4, dur: 12 });
    await director.run(
      [
        {
          cine: true,
          do: () => {
            // the party takes its marks before the sisters
            stage.follow('banquo', null);
            player.teleport(...MAC);
            player.faceTowards(H.x + f.x * 2, H.z + f.z * 2);
            macbeth.settle();
            stage.place('banquo', ...BANQ, Math.atan2(H.x - BANQ[0], H.z - BANQ[1]));
            stage.face('banquo', stage.get('witch1'));
            WITCHES.forEach((id) => stage.face(id, macbeth));
            if (stage.has('ross')) stage.show('ross', false), stage.show('angus', false);
          },
        },
        ...stepsFor('act1_s13b', {
          '1.3.14': { shot: behindWitches, wait: 0.2 },
          '1.3.15': { shot: faceShot(macbeth, { dist: 1.6, side: -0.35, drift: 0.12, dur: 5 }) },
          '1.3.29': { shot: faceShot(macbeth, { dist: 1.4, side: 0.4, drift: 0.16, dur: 26 }) },
          '1.3.30': { shot: wideShot(pair, { bearing: Math.atan2(-f.x, -f.z) + 0.3, dist: 6, up: 1.8, dur: 6 }), do: () => {
            cue = 'prophecy';
            vanish('hollow');
          }, wait: 0.3 },
          'fx.13vanish': { shot: null },
          '1.3.33': { do: () => {
            arrivals = rossAndAngus(); // they walk in while the friends talk
          } },
          '1.3.37': { do: () => {
            stage.face('banquo', { x: H.x - f.x * 10, z: H.z - f.z * 10 });
          } },
        }),
        ...stepsFor('act1_s13c', {
          '1.3.38': {
            shot: { from: () => at(BANQ[0] + side.x * 1.4 + f.x * 1.2, H.y + 1.7, BANQ[1] + side.z * 1.4 + f.z * 1.2), at: () => (stage.get('ross') ? stage.get('ross').root.position.clone().add(at(0, 1.4, 0)) : H), dur: 10 },
            do: async () => {
              if (!arrivals) arrivals = rossAndAngus();
              await Promise.race([arrivals, after(9)]);
              if (stage.has('ross')) {
                stage.place('ross', ...ROSS, Math.atan2(MAC[0] - ROSS[0], MAC[1] - ROSS[1]));
                stage.place('angus', ...ANGUS, Math.atan2(MAC[0] - ANGUS[0], MAC[1] - ANGUS[1]));
                stage.face('ross', macbeth);
                stage.face('angus', macbeth);
              }
              stage.face('banquo', stage.get('ross') || macbeth);
            },
          },
          '1.3.45b': { shot: wideAll(0.2) },
          '1.3.48': { shot: wideShot([banquo, ...['ross', 'angus'].map(stage.get).filter(Boolean)], { bearing: Math.atan2(-side.x, -side.z) + 0.5, dist: 5.5, up: 1.7, dur: 4 }) },
          '1.3.55': { shot: wideAll(-0.4) },
          'n.13end': {
            shot: { from: () => at(H.x + f.x * 14 + side.x * 6, H.y + 9, H.z + f.z * 14 + side.z * 6), at: () => at(MAC[0], H.y + 1, MAC[1]), drift: -0.2, rise: 5, dur: 18 },
            do: () => {
              stage.follow('banquo', { side: -1.2, back: 1.5 });
              stage.follow('ross', { side: 1.3, back: 2.2 });
              stage.follow('angus', { side: -0.1, back: 3.2 });
            },
          },
        }),
      ],
      { actors: actors(), onLine: () => {} },
    );
    folio.finish('1.3');
    cue = null;
    game.complete('witches');
    step = 'forres';
    arrange();
    busy = false;
    game.save();
    director.card('Act I &middot; Scene III', 'Two truths are told', 'The road to Forres lies open', 3.4);
  }

  async function finale() {
    busy = true;
    step = 'end';
    game.complete('forres');
    arrange();
    game.save();
    await director.card('To be continued', 'Act I &middot; Scene IV', 'Forres. The palace, where the king waits to thank Macbeth', 5);
    game.toast('The next chapter is being written. Explore the heath meanwhile.', 'done');
    busy = false;
  }

  // ---------- set the world to match the step (new game, a scene's end, or a saved game)
  function arrange() {
    const banquoReady = stage.has('banquo');
    roadBeacon.group.visible = false;
    game.witchBeacon.group.visible = false;
    if (step === 's11') {
      WITCHES.forEach((id) => stage.show(id, true));
    } else if (step === 'train') {
      witchesAt('none');
      game.setMarker('witches', () => H, 'witch');
    } else if (step === 'walk') {
      witchesAt('hollow');
      bank.set(0.8);
      game.witchBeacon.group.position.copy(H);
      game.witchBeacon.group.visible = true;
      game.setMarker('witches', () => H, 'witch');
      if (banquoReady) stage.follow('banquo', { side: -1.2, back: 1.5 });
      banquoWalk = true;
      if (loadActor) {
        loadActor('ross');
        loadActor('angus');
      }
    } else if (step === 'forres' || step === 'end') {
      witchesAt('none');
      bank.set(0.3);
      if (banquoReady) stage.follow('banquo', { side: -1.2, back: 1.5 });
      game.setMarker('forres', () => ROAD);
      game.setStoryTasks('Act I: The road to Forres', [{ id: 'forres', text: 'Make for Forres with Banquo, Ross and Angus', short: 'the road to Forres' }], { fresh: step === 'forres' });
      if (step === 'forres') roadBeacon.group.visible = true;
      if (loadActor)
        for (const id of ['ross', 'angus'])
          loadActor(id).then(() => {
            if (step !== 'forres' && step !== 'end') return;
            if (!stage.get(id).root.visible) {
              const m = macbeth.root.position;
              stage.place(id, m.x - 2 + (id === 'ross' ? 1 : -1), m.z + 2);
              stage.show(id, true);
            }
            stage.follow(id, id === 'ross' ? { side: 1.3, back: 2.2 } : { side: -0.1, back: 3.2 });
          });
    }
  }

  return {
    // after the title card: a new game opens with scene 1; a saved one carries on
    begin(fresh) {
      if (fresh) {
        step = 's11';
        folio.inkState = null;
      }
      if (step === 's11') play11();
      else arrange();
    },
    get() {
      return { step, ink: folio.inkState };
    },
    set(v) {
      if (!v || !STEPS.includes(v.step)) return;
      step = v.step;
      folio.inkState = v.ink;
      arrange();
    },
    // a companion who arrived late (the cast load while the game starts)
    joined(id) {
      if (id === 'banquo' && banquoWalk) arrange();
    },
    update(dt) {
      mist.update(dt);
      if (roadBeacon.group.visible) roadBeacon.update(dt, camera, player.position);
      if (busy || director.running || !game.began || game.blocking) return;
      const p = player.position;
      if (step === 'train' && game.hasCounsel && (game.trainingDone || dist(H.x, H.z) < 40)) play12();
      else if (step === 'walk') {
        const d = dist(H.x, H.z);
        if (partA === 'todo' && d < 26) playPartA();
        else if (partA === 'done' && d < 11) playParts();
      } else if (step === 'forres' && Math.hypot(p.x - ROAD.x, p.z - ROAD.z) < 7) finale();
    },
    // in the middle of the overheard tale, walking right up to them: hold the moment
    get approachClose() {
      return step === 'walk' && partA === 'playing' && dist(H.x, H.z) < 7.5;
    },
    roadBeacon,
    hollowAt: H,
    get musicCue() {
      return cue;
    },
    road: ROAD,
    get step() {
      return step;
    },
  };
}
