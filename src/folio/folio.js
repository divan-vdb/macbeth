// The Folio: the whole play beside the game. Each scene is shown in full; the
// lines are in pale ink until they are spoken in the game, when the Folio writes
// them in. A portrait for each speaker, tap-to-explain glossary words, a note on
// each scene, and a contents list to read any scene of the play.
import { NOTES, GLOSS, GLOSSARY } from './scenes.js';
import { CHARACTERS, portraitHTML, portraitLarge } from './characters.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ACT_N = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function mountFolio(root, { play, sceneId = '1.1', onReadScroll, onShowOnMap } = {}) {
  // scenes by id ('1.3'), in order
  const order = [];
  const scenes = {};
  if (play)
    play.acts.forEach((a, ai) =>
      a.scenes.forEach((s, si) => {
        const id = `${ai + 1}.${si + 1}`;
        order.push(id);
        scenes[id] = { ...s, id, act: a.n, num: si + 1 };
      }),
    );
  let shown = null;
  // ink: scenes fully written, and how far the scene being played has got
  const written = new Set();
  const reached = {};
  let speaking = null;

  root.innerHTML = `
    <nav class="tabs" role="tablist">
      <button type="button" role="tab" data-tab="play" class="on">The Play</button>
      <button type="button" role="tab" data-tab="tasks">Tasks<i class="badge" hidden></i></button>
      <button type="button" role="tab" data-tab="scrolls">Scrolls</button>
    </nav>
    <section class="pane pane-play">
    <header>
      <div class="act-row">
        <button type="button" class="nav-prev" aria-label="Previous scene">&lsaquo;</button>
        <button type="button" class="act" aria-label="All scenes"></button>
        <button type="button" class="nav-next" aria-label="Next scene">&rsaquo;</button>
      </div>
      <h1>Macbeth</h1>
      <div class="loc"></div>
      <button type="button" class="note-btn">About this scene</button>
    </header>
    <div class="text"></div>
    <div class="contents" hidden></div>
    <div class="card" hidden>
      <button type="button" class="card-close" aria-label="Close">&times;</button>
      <div class="card-inner"></div>
    </div>
    <footer>Tap a portrait or an underlined word to learn more</footer>
    </section>
    <section class="pane pane-tasks" hidden><div class="pane-inner"><p class="empty">No tasks yet. Ravens bring word of what must be done.</p></div></section>
    <section class="pane pane-scrolls" hidden><div class="pane-inner"><p class="empty">No scrolls yet.</p></div></section>`;

  const $ = (s) => root.querySelector(s);
  const card = $('.card'), inner = $('.card-inner'), textEl = $('.text'), contents = $('.contents');
  let active = null;

  // ---------- one scene's text, with glossary marks and line numbers every five lines
  function glossed(sceneId) {
    const marks = (GLOSS[sceneId] || []).filter(([, k]) => GLOSSARY[k]).map(([phrase, key]) => ({ phrase: esc(phrase), key, used: false }));
    return (t) => {
      let h = esc(t);
      for (const m of marks) {
        if (m.used) continue;
        const at = h.indexOf(m.phrase);
        if (at < 0) continue;
        m.used = true;
        h = `${h.slice(0, at)}<button type="button" class="gl" data-term="${m.key}">${m.phrase}</button>${h.slice(at + m.phrase.length)}`;
      }
      return h;
    };
  }
  function render(id) {
    const s = scenes[id];
    if (!s) return;
    shown = id;
    const mark = glossed(id);
    let n = 0;
    const line = (t, aside) => {
      n++;
      return `<span class="ln${aside ? ' aside' : ''}"${n % 5 === 0 ? ` data-n="${n}"` : ''}>${mark(t)}</span>`;
    };
    const body = s.items
      .map((it, i) => {
        if (it.dir) return `<p class="sd" data-i="${i}">${esc(it.dir)}</p>`;
        let aside = false;
        const lines = it.lines
          .map((l) => {
            if (typeof l === 'string') return line(l, aside);
            if (l.dir) {
              aside = false;
              return `<span class="sd-in">${esc(l.dir)}</span>`;
            }
            aside = /aside/i.test(l.d);
            return `<span class="sd-in">${esc(l.d)}</span>${line(l.t, aside)}`;
          })
          .join('');
        const who = it.who.split(' and ')[0];
        return `<div class="speech" data-i="${i}">${portraitHTML(CHARACTERS[it.who] ? it.who : who)}<div class="lines"><button type="button" class="sp" data-char="${CHARACTERS[it.who] ? it.who : who}">${esc(it.who)}</button>${lines}</div></div>`;
      })
      .join('');
    const intro = written.has(id) || reached[id] !== undefined ? '' : `<p class="unwritten">This page is not yet written in the game. Play on, or read ahead.</p>`;
    textEl.innerHTML = intro + body;
    $('.act').innerHTML = `Act ${s.act} &middot; Scene ${ROMAN[s.num]} <i>&#9662;</i>`;
    const loc = s.loc.replace(/\.$/, '');
    const g = (GLOSS[id] || []).find(([p]) => loc.startsWith(p));
    $('.loc').innerHTML = g ? `<button type="button" class="gl" data-term="${g[1]}">${esc(g[0])}</button>${esc(loc.slice(g[0].length))}.` : `${esc(loc)}.`;
    $('.note-btn').hidden = !NOTES[id];
    $('.nav-prev').disabled = order.indexOf(id) <= 0;
    $('.nav-next').disabled = order.indexOf(id) >= order.length - 1;
    applyInk();
    textEl.scrollTop = 0;
    close();
    contents.hidden = true;
  }
  // pale ink for what is still to come in the game
  function applyInk() {
    const id = shown;
    const full = written.has(id);
    const upTo = reached[id];
    root.querySelectorAll('.text [data-i]').forEach((el) => {
      const i = Number(el.dataset.i);
      el.classList.toggle('faint', !full && !(upTo !== undefined && i <= upTo));
      el.classList.toggle('speaking', speaking && speaking.scene === id && speaking.item === i);
    });
  }

  // ---------- contents: every scene of the play
  function showContents() {
    const html = play.acts
      .map((a, ai) => `<h3>Act ${a.n}</h3><ol>${a.scenes
        .map((s, si) => {
          const id = `${ai + 1}.${si + 1}`;
          const state = written.has(id) ? 'written' : reached[id] !== undefined ? 'writing' : '';
          return `<li><button type="button" data-goto="${id}" class="${state}${id === shown ? ' here' : ''}"><b>Scene ${ROMAN[si + 1]}</b> ${esc(s.loc.replace(/\.$/, ''))}${state === 'written' ? ' <em>written</em>' : state === 'writing' ? ' <em>being written</em>' : ''}</button></li>`;
        })
        .join('')}</ol>`)
      .join('');
    contents.innerHTML = `<button type="button" class="contents-close" aria-label="Close">&times;</button><h2>The Tragedy of Macbeth</h2>${html}<p class="src">${esc(play.source)}</p>`;
    contents.hidden = false;
    const here = contents.querySelector('.here');
    if (here) here.scrollIntoView({ block: 'center' });
  }

  const open = (html, el) => {
    if (active) active.classList.remove('active');
    active = el || null;
    if (active) active.classList.add('active');
    inner.innerHTML = html;
    card.hidden = false;
    card.scrollTop = 0;
  };
  function close() {
    card.hidden = true;
    if (active) active.classList.remove('active');
    active = null;
  }

  // ---------- tabs: the play itself, the tasks the ravens have set, the scrolls received
  const tabs = root.querySelectorAll('.tabs button');
  const panes = { play: $('.pane-play'), tasks: $('.pane-tasks'), scrolls: $('.pane-scrolls') };
  const badge = $('.badge');
  let current = 'play', mode = 'learn';
  const showTab = (name) => {
    if (mode === 'play' && name === 'play') name = 'tasks';
    current = name;
    tabs.forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
    for (const k in panes) panes[k].hidden = k !== name;
    if (name === 'tasks') badge.hidden = true;
    close();
  };
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  root.addEventListener('click', (e) => {
    const sc = e.target.closest('[data-scroll]');
    if (sc) return onReadScroll && onReadScroll(sc.dataset.scroll);
    const mp = e.target.closest('[data-map]');
    if (mp) return onShowOnMap && onShowOnMap(mp.dataset.map);
    const go = e.target.closest('[data-goto]');
    if (go) return render(go.dataset.goto);
    if (e.target.closest('.contents-close')) return (contents.hidden = true);
    if (e.target.closest('.act')) return contents.hidden ? showContents() : (contents.hidden = true);
    if (e.target.closest('.nav-prev')) return render(order[order.indexOf(shown) - 1]);
    if (e.target.closest('.nav-next')) return render(order[order.indexOf(shown) + 1]);
    const gl = e.target.closest('.gl');
    const ch = e.target.closest('[data-char]');
    if (gl) {
      const g = GLOSSARY[gl.dataset.term];
      if (g) open(`<div class="kind">Glossary</div><h2>${g.term}</h2><p>${g.text}</p>`, gl);
      return;
    }
    if (ch) {
      const c = CHARACTERS[ch.dataset.char];
      if (c) open(`<div class="who">${portraitLarge(ch.dataset.char)}<div><div class="kind">${c.role}</div><h2>${c.name}</h2></div></div><p>${c.about}</p>`, ch);
      return;
    }
    if (e.target.closest('.note-btn')) {
      const s = scenes[shown];
      open(`<div class="kind">Act ${s.act}, Scene ${ROMAN[s.num]}</div><h2>About this scene</h2><p>${NOTES[shown].note}</p>`);
      return;
    }
    if (e.target.closest('.card-close') || !e.target.closest('.card')) close();
  });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-char][tabindex]')) e.target.click();
    if (e.key === 'Escape') {
      close();
      contents.hidden = true;
    }
  });

  render(scenes[sceneId] ? sceneId : order[0]);

  return {
    showTab,
    // groups: [{ title, items: [{ id, text, done, active, count, target }] }]
    setTasks(groups, { fresh = false } = {}) {
      const box = panes.tasks.querySelector('.pane-inner');
      if (!groups.length) return;
      box.innerHTML = groups
        .map((g) => `<h3>${g.title}</h3><ul class="tasklist">${g.items
          .map((t) => `<li class="${t.done ? 'done' : ''}${t.active ? ' active' : ''}"><span>${t.text}${t.target ? ` <em>${Math.min(t.count, t.target)}/${t.target}</em>` : ''}</span>${!t.done && t.id ? `<button type="button" data-map="${t.id}" title="Show on the map">Map</button>` : ''}</li>`)
          .join('')}</ul>`)
        .join('');
      if (fresh && current !== 'tasks') badge.hidden = false;
    },
    // list: [{ id, title, sign }]
    setScrolls(list) {
      const box = panes.scrolls.querySelector('.pane-inner');
      if (!list.length) return;
      box.innerHTML = list.map((x) => `<button type="button" class="scroll-item" data-scroll="${x.id}"><b>${x.title}</b><i>${x.sign}</i></button>`).join('');
    },
    setMode(m) {
      mode = m;
      root.classList.toggle('play-only', m === 'play');
      tabs[0].hidden = m === 'play';
      if (m === 'play' && current === 'play') showTab('tasks');
      if (m === 'learn' && current !== 'play') showTab('play');
    },
    // ---------- the Folio writes itself as the play is spoken
    goto(id) {
      if (scenes[id] && shown !== id) render(id);
    },
    // a line (speech or direction) of a scene has been spoken: ink it, and follow it
    ink(id, item) {
      if (!scenes[id]) return;
      if (reached[id] === undefined || item > reached[id]) reached[id] = item;
      speaking = { scene: id, item };
      if (shown !== id) render(id);
      else {
        const un = textEl.querySelector('.unwritten');
        if (un) un.remove();
        applyInk();
      }
      const el = textEl.querySelector(`[data-i="${item}"]`);
      if (el) {
        el.classList.remove('inking');
        void el.offsetWidth;
        el.classList.add('inking');
        if (!panes.play.hidden && !root.classList.contains('closed') && card.hidden && contents.hidden) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
    // a scene finished: every line of it is written
    finish(id) {
      written.add(id);
      delete reached[id];
      if (speaking && speaking.scene === id) speaking = null;
      if (shown === id) applyInk();
    },
    stopSpeaking() {
      speaking = null;
      applyInk();
    },
    // saved state: { written: [ids], reached: { id: item } }
    get inkState() {
      return { written: [...written], reached: { ...reached } };
    },
    set inkState(v) {
      written.clear();
      for (const id of (v && v.written) || []) written.add(id);
      for (const k in reached) delete reached[k];
      Object.assign(reached, (v && v.reached) || {});
      render(shown);
    },
    get shown() {
      return shown;
    },
  };
}
