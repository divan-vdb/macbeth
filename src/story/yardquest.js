// Side quest: the Captain's Yard. An old soldier drills Macbeth in the weapons he will
// need: sword blows on straw and wood, a heavy blow, blocking the quintain, casting the
// spear into the butts, and stones at the pots. His lessons are voiced; the steps are
// tracked in the Folio and on the compass; progress is saved with the game.
import * as THREE from 'three/webgpu';
import { sfx } from '../audio.js';

const STEPS = ['meet', 'light', 'heavy', 'block', 'spear', 'stones', 'done'];
const NEED = { light: 5, heavy: 2, block: 2, spear: 3, stones: 3 };

export function createYardQuest({ game, director, yard, stage, player, loadActor, isTouch }) {
  let step = 'meet', count = 0, busy = false, gold = false, bagWarned = false, again = false;
  const T = (desk, touch) => (isTouch ? touch : desk);
  const cap = yard.captainAt;
  let captain = null;
  loadActor('captain', cap.x, cap.z, Math.PI / 2, true).then((c) => {
    captain = c;
    stage.face('captain', stage.get('macbeth') || null);
  });
  const say = async (key) => {
    // the Captain speaks as you train: subtitles only, you keep your feet
    if (!director.has(key)) return;
    while (director.running) await director.wait(0.5);
    busy = true;
    await director.run([{ say: key }], { actors: { captain: stage.get('captain') } });
    busy = false;
  };

  const TEXT = {
    meet: 'Report to the Captain in the training yard',
    light: T('Strike the straw men with your sword (click)', 'Strike the straw men with your sword (tap Strike)'),
    heavy: T('Land heavy blows on the wooden man or the pell (hold the click, let go)', 'Land heavy blows on the wooden man or the pell (hold Strike, let go)'),
    block: T('Strike the quintain’s shield, then block the sandbag (hold the right button)', 'Strike the quintain’s shield, then block the sandbag (hold Block)'),
    spear: 'Take a spear from the rack and cast it into the straw butts from the rope',
    stones: 'Fill your pouch at the basket and break the clay pots with stones',
  };
  function tasks() {
    const list = [];
    for (const s of STEPS) {
      if (s === 'done') break;
      list.push({ id: `yard-${s}`, text: TEXT[s] + (NEED[s] && s === step ? ` (${count}/${NEED[s]})` : ''), short: TEXT[s].split(' (')[0].toLowerCase() });
    }
    return list;
  }
  const markerFor = {
    'yard-meet': () => cap,
    'yard-light': () => new THREE.Vector3(cap.x - 4, cap.y, yard.dummyRowZ),
    'yard-heavy': () => new THREE.Vector3(cap.x - 10.5, cap.y, yard.dummyRowZ),
    'yard-block': () => yard.quintainAt,
    'yard-spear': () => (game.equipped === 'spear' ? new THREE.Vector3(yard.lineX, cap.y, cap.z + 3.8) : yard.rackAt),
    'yard-stones': () => new THREE.Vector3(yard.lineX - 0.6, cap.y, cap.z + 2.6),
  };
  for (const id in markerFor) game.setMarker(id, markerFor[id], id === 'yard-meet' ? 'poi' : 'objective');
  function refresh(fresh = false) {
    const list = tasks();
    STEPS.slice(0, STEPS.indexOf(step)).forEach((s) => s !== 'done' && game.complete(`yard-${s}`));
    game.setGroup('yard', 'Side quest: The Captain’s Yard', step === 'done' ? list : list, { fresh, focus: step !== 'meet' && step !== 'done' });
  }
  function advance(next, line) {
    if (step !== 'done') game.complete(`yard-${step}`);
    step = next;
    count = 0;
    sfx('objective');
    refresh(true);
    if (line) say(line);
    game.save();
  }

  // the yard's fixed places: the spear rack and a basket of throwing stones
  game.addSpot({ id: 'yard-rack', pos: yard.rackAt.clone(), radius: 1.9, label: 'Take a spear from the rack', act: () => game.rackSpear() });
  game.addSpot({ id: 'yard-basket', pos: new THREE.Vector3(yard.lineX - 0.6, cap.y, cap.z + 2.6), radius: 1.7, label: 'Fill your pouch with stones', act: () => game.fillPouch() });

  // what happens in the yard
  function onEvent(type, d) {
    if (step === 'light' && type === 'strike' && d.weapon === 'sword' && !d.heavy && d.kind === 'straw') {
      count++;
      if (count >= NEED.light) advance('heavy', 'cap.light');
      else refresh();
    } else if (step === 'heavy' && type === 'strike' && d.weapon === 'sword' && d.heavy && (d.kind === 'wooden' || d.kind === 'pell' || d.kind === 'sticks')) {
      count++;
      if (count >= NEED.heavy) advance('block', 'cap.heavy');
      else refresh();
    } else if (step === 'block' && type === 'quintainBlocked') {
      count++;
      if (count >= NEED.block) advance('spear', 'cap.block');
      else refresh();
    } else if (step === 'block' && type === 'quintainHit' && !bagWarned) {
      bagWarned = true;
      say('cap.bag');
    } else if (step === 'spear' && type === 'butt' && d.weapon === 'spear') {
      count++;
      if (d.ring === 'gold' && !gold) {
        gold = true;
        say('cap.gold');
      }
      if (count >= NEED.spear) advance('stones', 'cap.spear');
      else refresh();
    } else if (step === 'stones' && type === 'pot' && d.weapon === 'stone') {
      count++;
      if (count >= NEED.stones) {
        advance('done', 'cap.done');
        game.giveTonics(2);
        game.toast('The Captain gives you two healing tonics', 'done');
      } else refresh();
    }
  }

  return {
    onEvent,
    get() {
      return { step, count, gold };
    },
    set(v) {
      if (!v || !STEPS.includes(v.step)) return;
      step = v.step;
      count = v.count || 0;
      gold = !!v.gold;
      refresh();
    },
    begin() {
      refresh();
    },
    // music for the yard, and the Captain's welcome
    get inYard() {
      const p = player.position;
      return Math.abs(p.x - (cap.x - 7.6)) < 10 && Math.abs(p.z - (cap.z - 1)) < 8;
    },
    update() {
      if (busy || director.running || !game.began || game.blocking) return;
      const p = player.position;
      const d = Math.hypot(p.x - cap.x, p.z - cap.z);
      if (step === 'meet' && d < 7) {
        advance('light', 'cap.greet');
        if (game.equipped !== 'sword') game.toast(T('Draw your sword: press 2', 'Draw your sword: tap the sword'));
      } else if (step === 'done' && d < 4 && !again) {
        again = true;
        say('cap.again');
      }
      if (step === 'done' && d > 15) again = false;
      if (captain && d < 14) stage.face('captain', stage.get('macbeth'));
    },
  };
}
