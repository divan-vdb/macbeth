// Settings: separate volumes for the Old Man's narration, the characters'
// voices, music, the sounds of the world and the game's effects; whether the
// narration is read aloud; learn-the-play or just-play; tips; a new game.
import { loadSettings, saveSettings } from './save.js';
import { setChannelVolume } from '../audio.js';

export const DEFAULTS = { narration: 1, voices: 1, music: 0.8, ambient: 1, effects: 1, readAloud: true, mode: 'learn', tips: true };
const VOLUMES = [
  ['narration', 'Narration (the Old Man)'],
  ['voices', 'Character voices'],
  ['music', 'Music'],
  ['ambient', 'World sounds (wind, fire, night)'],
  ['effects', 'Effects and footsteps'],
];

export function createSettings({ onMode, onNewGame, extras = [] }) {
  const values = { ...DEFAULTS, ...(loadSettings() || {}) };
  const apply = () => {
    for (const [k] of VOLUMES) setChannelVolume(k, values[k]);
  };
  apply();
  const view = document.createElement('div');
  view.className = 'overlay settings-view';
  view.hidden = true;
  view.innerHTML = `
    <div class="panel" role="dialog" aria-label="Settings">
      <button type="button" class="x" aria-label="Close">&times;</button>
      <h2>Settings</h2>
      <h3>VOICES AND SOUND</h3>
      ${VOLUMES.map(([k, label]) => `<label class="vol">${label}<input type="range" min="0" max="1" step="0.05" data-k="${k}"><output></output></label>`).join('')}
      <label class="check"><input type="checkbox" data-k="readAloud"> Read the narration aloud</label>
      <h3>HOW YOU PLAY</h3>
      <div class="modes">
        <button type="button" data-mode="learn">Play and learn the play<small>The Folio follows each scene, with notes and a glossary</small></button>
        <button type="button" data-mode="play">Just play<small>The story and the game; the play's text stays in the background</small></button>
      </div>
      <label class="check" style="margin-top:12px"><input type="checkbox" data-k="tips"> Show tips</label>
      <h3>PICTURE AND TESTS</h3>
      <div class="extras"></div>
      <h3>ABOUT THIS GAME</h3>
      <details class="about">
        <summary>Macbeth, a game by Divan van den Berg</summary>
        <p>In 2007, in his final year of high school, Divan read <i>Macbeth</i> in English class. This game goes back to it: a world to walk, fight and explore, where you can come to know Shakespeare’s play while you live it. It was brought to life through a collective approach, bringing together coding, design and AI.</p>
        <p class="disclaimer">The game aims to stay true to the original play, but some placements, names, characters’ appearances and events differ from it, because this is also an interactive online game. <i>The Tragedy of Macbeth</i> was written by William Shakespeare (1564–1616), and all credit for the original play and its words belongs to him. The text used here is in the public domain.</p>
        <p class="credits">Characters and the horse: Quaternius (CC0). 3D engine: three.js (MIT). Physics: Rapier (Apache 2.0). Voices: made with the open Kokoro speech model (Apache 2.0) and shaped with the WORLD vocoder (BSD). Play text: the public-domain Moby Shakespeare, with markup by Jon Bosak. Fonts: Cinzel and IM Fell English (SIL Open Font Licence).</p>
      </details>
      <div class="foot">
        <button type="button" class="act-btn danger" data-a="new">Start a new game</button>
        <button type="button" class="act-btn" data-a="close">Done</button>
      </div>
    </div>`;
  document.body.appendChild(view);
  const ex = view.querySelector('.extras');
  for (const el of extras) {
    el.classList.add('act-btn');
    ex.appendChild(el);
  }
  const sync = () => {
    view.querySelectorAll('input[type=range]').forEach((r) => {
      r.value = values[r.dataset.k];
      r.nextElementSibling.textContent = Math.round(values[r.dataset.k] * 100);
    });
    view.querySelectorAll('input[type=checkbox]').forEach((c) => (c.checked = !!values[c.dataset.k]));
    view.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('on', b.dataset.mode === values.mode));
  };
  const store = () => saveSettings(values);
  view.addEventListener('input', (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    values[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value);
    if (e.target.type === 'range') {
      e.target.nextElementSibling.textContent = Math.round(values[k] * 100);
      setChannelVolume(k, values[k]);
    }
    store();
  });
  let confirmNew = false;
  view.addEventListener('click', (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) {
      values.mode = m.dataset.mode;
      store();
      sync();
      onMode && onMode(values.mode);
      return;
    }
    const a = e.target.closest('[data-a]');
    if (e.target === view || e.target.closest('.x') || (a && a.dataset.a === 'close')) return api.close();
    if (a && a.dataset.a === 'new') {
      if (!confirmNew) {
        confirmNew = true;
        a.textContent = 'Tap again to lose your progress';
        return;
      }
      onNewGame && onNewGame();
    }
  });
  const api = {
    values,
    get isOpen() {
      return !view.hidden;
    },
    open() {
      confirmNew = false;
      view.querySelector('[data-a=new]').textContent = 'Start a new game';
      sync();
      view.hidden = false;
    },
    close() {
      view.hidden = true;
    },
    set(k, v) {
      values[k] = v;
      store();
      apply();
    },
  };
  return api;
}
