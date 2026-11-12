// The on-screen game layer: health and stamina, the arsenal, the compass with
// objective markers, the to-do tracker, the interaction prompt, short notices,
// the wound vignette and the "fallen" screen. Plain DOM over the 3D view.

const ICONS = {
  fists: '<svg viewBox="0 0 32 32"><path d="M9 14c0-2 1-3 2.5-3S14 12 14 13v-2c0-1.4 1-2.4 2.3-2.4S18.6 9.6 18.6 11v1c0-1.3 1-2.3 2.3-2.3s2.3 1 2.3 2.3v2.2c0-1.2.9-2 2-2s2 .8 2 2V20c0 4-3 7-7.5 7h-2C12 27 9 24 9 20z" fill="currentColor"/></svg>',
  sword: '<svg viewBox="0 0 32 32"><path d="M24.5 3.5l4 4-12.8 12.8-4-4z" fill="currentColor"/><path d="M8.5 16.5l7 7-1.6 1.6-2-2-3.6 3.6.4 1.6-1.8 1.8-3.8-3.8 1.8-1.8 1.6.4 3.6-3.6-2-2z" fill="currentColor"/></svg>',
  spear: '<svg viewBox="0 0 32 32"><path d="M27.5 4.5c-.6 3.6-2.6 6.5-5.4 7.6l-1.6-1.6c1.1-2.8 4-4.8 7-6z" fill="currentColor"/><path d="M19.6 11.4l1 1L5.4 27.6l-1-1z" fill="currentColor"/><path d="M17 12.5l2.5 2.5-1 1-2.5-2.5z" fill="currentColor"/></svg>',
  stones: '<svg viewBox="0 0 32 32"><ellipse cx="12" cy="20" rx="7" ry="5" fill="currentColor"/><ellipse cx="21.5" cy="15" rx="5" ry="3.8" fill="currentColor" opacity=".8"/></svg>',
  tonic: '<svg viewBox="0 0 32 32"><path d="M13 4h6v3h-1v4.2c3.4 1.1 5.5 4 5.5 7.5 0 4.6-3.4 8.3-7.5 8.3s-7.5-3.7-7.5-8.3c0-3.5 2.1-6.4 5.5-7.5V7h-1z" fill="currentColor"/></svg>',
};
const KEYS = { fists: '1', sword: '2', spear: '3', stones: '4' };
const NAMES = { fists: 'Fists', sword: 'Sword', spear: 'Spear', stones: 'Stones' };

export function createHud({ onEquip, onDrink, onInteract, onRise, touch }) {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="hud-vitals">
      <div class="bar health"><i></i></div>
      <div class="bar stamina"><i></i></div>
    </div>
    <div class="hud-compass"><div class="strip"></div><div class="needle"></div></div>
    <div class="hud-tracker" hidden><h4></h4><ul></ul></div>
    <div class="hud-arsenal">
      ${Object.keys(KEYS).map((k) => `<button class="slot" data-w="${k}" type="button" aria-label="${NAMES[k]}">${ICONS[k]}<b>${touch ? '' : KEYS[k]}</b><em></em></button>`).join('')}
      <button class="slot tonic" data-w="tonic" type="button" aria-label="Drink a tonic">${ICONS.tonic}<b>${touch ? '' : 'Q'}</b><em></em></button>
    </div>
    <button class="hud-prompt" type="button" hidden><kbd>${touch ? 'Tap' : 'E'}</kbd><span></span></button>
    <div class="hud-toasts"></div>
    <div class="hud-tip" hidden><svg viewBox="0 0 24 24"><path d="M20 2c-6 1-11 6-13 13l-2 7 2-1 2-5c4 0 8-3 10-8-2 1-4 1-5 1 2-1 4-3 6-7z" fill="currentColor"/></svg><span></span></div>
    <div class="hud-wound"></div>
    <div class="hud-fallen" hidden><h2>You have fallen</h2><p>The heath is cruel to the careless.</p><button type="button">Rise again</button></div>`;
  document.body.appendChild(root);
  const q = (s) => root.querySelector(s);
  const health = q('.bar.health i'), stamina = q('.bar.stamina i');
  const strip = q('.hud-compass .strip');
  const tracker = q('.hud-tracker'), trackerTitle = tracker.querySelector('h4'), trackerList = tracker.querySelector('ul');
  const prompt = q('.hud-prompt'), promptText = prompt.querySelector('span');
  const toasts = q('.hud-toasts'), wound = q('.hud-wound'), fallen = q('.hud-fallen');
  const tipEl = q('.hud-tip'), tipText = tipEl.querySelector('span');
  let tipTimer = 0;
  tipEl.addEventListener('click', () => (tipEl.hidden = true));
  const slots = {};
  root.querySelectorAll('.slot').forEach((b) => (slots[b.dataset.w] = b));

  for (const k of Object.keys(KEYS)) slots[k].addEventListener('click', () => onEquip(k));
  slots.tonic.addEventListener('click', () => onDrink());
  prompt.addEventListener('click', () => onInteract());
  fallen.querySelector('button').addEventListener('click', () => onRise());

  // compass: cardinal letters and ticks laid out over 360 degrees, scrolled with the view
  const PX = 2.2; // pixels per degree
  const marks = [];
  for (let d = 0; d < 360; d += 15) {
    const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d];
    const el = document.createElement('span');
    el.className = card ? 'card' : d % 45 === 0 ? 'tick big' : 'tick';
    el.textContent = card || '';
    strip.appendChild(el);
    marks.push({ el, deg: d });
  }
  const pins = new Map(); // id -> element

  let last = {};
  return {
    vitals(h, hMax, st, stMax) {
      const hp = Math.round((h / hMax) * 1000) / 10, sp = Math.round((st / stMax) * 1000) / 10;
      if (hp !== last.hp) health.style.width = `${(last.hp = hp)}%`;
      if (sp !== last.sp) stamina.style.width = `${(last.sp = sp)}%`;
      root.classList.toggle('tired', st < stMax * 0.2);
      root.classList.toggle('low', h < hMax * 0.3);
    },
    arsenal(state) {
      for (const k of Object.keys(KEYS)) {
        const owned = state.weapons[k];
        slots[k].hidden = !owned;
        slots[k].classList.toggle('on', state.equipped === k);
        slots[k].querySelector('em').textContent = k === 'stones' ? state.stones : '';
        slots[k].classList.toggle('empty', k === 'stones' && state.stones === 0);
      }
      slots.tonic.querySelector('em').textContent = state.tonics;
      slots.tonic.classList.toggle('empty', state.tonics === 0);
    },
    // yaw: the camera's heading in degrees (0 = north, clockwise); pins: [{id, deg, kind, dist}]
    compass(yaw, list) {
      const W = strip.clientWidth || 300;
      for (const m of marks) {
        let d = ((m.deg - yaw + 540) % 360) - 180;
        const x = W / 2 + d * PX;
        m.el.style.transform = `translateX(${x}px)`;
        m.el.style.opacity = Math.abs(d) > (W / 2 / PX) - 6 ? 0 : 1;
      }
      const seen = new Set();
      for (const p of list) {
        seen.add(p.id);
        let el = pins.get(p.id);
        if (!el) {
          el = document.createElement('i');
          el.className = `pin ${p.kind}`;
          el.innerHTML = '<u></u><small></small>';
          strip.appendChild(el);
          pins.set(p.id, el);
        }
        let d = ((p.deg - yaw + 540) % 360) - 180;
        const lim = W / 2 / PX - 4;
        const edge = Math.abs(d) > lim;
        d = Math.max(-lim, Math.min(lim, d));
        el.style.transform = `translateX(${W / 2 + d * PX}px)`;
        el.classList.toggle('edge', edge);
        el.querySelector('small').textContent = p.dist > 3 ? `${Math.round(p.dist)} m` : '';
      }
      for (const [id, el] of pins) if (!seen.has(id)) { el.remove(); pins.delete(id); }
    },
    todos(title, items) {
      tracker.hidden = !items.length;
      trackerTitle.textContent = title;
      trackerList.innerHTML = items
        .map((t) => `<li class="${t.done ? 'done' : ''}${t.active ? ' active' : ''}">${t.text}${t.target ? ` <span>${Math.min(t.count, t.target)}/${t.target}</span>` : ''}</li>`)
        .join('');
    },
    prompt(text) {
      if (!text) {
        prompt.hidden = true;
        return;
      }
      prompt.hidden = false;
      if (promptText.textContent !== text) promptText.textContent = text;
    },
    toast(text, kind = '') {
      const el = document.createElement('div');
      el.className = `toast ${kind}`;
      el.textContent = text;
      toasts.appendChild(el);
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3300);
      while (toasts.children.length > 3) toasts.firstChild.remove();
    },
    // a first-time tip, on a scrap of parchment, until read or after a while
    tip(text, secs = 8) {
      tipText.textContent = text;
      tipEl.hidden = false;
      tipEl.classList.remove('out');
      clearTimeout(tipTimer);
      tipTimer = setTimeout(() => {
        tipEl.classList.add('out');
        tipTimer = setTimeout(() => (tipEl.hidden = true), 500);
      }, secs * 1000);
    },
    wound(amount) {
      wound.style.opacity = Math.min(0.85, amount);
    },
    fallen(on) {
      fallen.hidden = !on;
      root.classList.toggle('dead', on);
    },
    hidden(on) {
      root.classList.toggle('hidden', on);
    },
  };
}
