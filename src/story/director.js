// The story director: plays the play's scenes in the world. Each line is voiced
// (or timed for reading when voices are off), shown as a subtitle with the
// speaker's portrait, and written into the Folio as it is spoken. In a cinematic
// the view is letterboxed and the camera is placed shot by shot; on the move
// ("walk and talk") the player keeps control and only the subtitles show.
// Any line can be skipped, or the rest of a scene.
import * as THREE from 'three/webgpu';
import * as audio from '../audio.js';
import { CHARACTERS, portraitSmall } from '../folio/characters.js';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const ease = (t) => t * t * (3 - 2 * t);

export function createDirector({ scene, camera, heightAt, folio, hud, segments, voiceBase, onPause }) {
  // a soft moonlit fill that travels with the camera in cinematics, so faces read
  // against the night (added once at the start, so no shader changes mid-game)
  const fill = new THREE.PointLight(new THREE.Color().setStyle('#b4c4e6', THREE.SRGBColorSpace), 0, 10, 1.4);
  if (scene) scene.add(fill);
  // ---------- the subtitles and letterbox
  const el = document.createElement('div');
  el.className = 'story';
  el.innerHTML = `
    <div class="letterbox top"></div><div class="letterbox bottom"></div>
    <div class="mood"></div>
    <div class="subs" hidden>
      <div class="subs-who"></div>
      <div class="subs-say"></div>
      <div class="subs-btns">
        <button type="button" class="subs-pause" aria-label="Pause">&#10074;&#10074; Pause</button>
        <button type="button" class="subs-next" aria-label="Next line">Next &#9656;</button>
        <button type="button" class="subs-skip">Skip scene &#9656;&#9656;</button>
      </div>
    </div>
    <div class="chapter" hidden></div>
    <div class="curtain left"></div><div class="curtain right"></div><div class="valance"></div>`;
  document.body.appendChild(el);
  const subs = el.querySelector('.subs'), who = el.querySelector('.subs-who'), say = el.querySelector('.subs-say');
  const chapter = el.querySelector('.chapter');

  // segments by key (from assets/text/act1.json)
  const seg = {};
  const partOf = {};
  for (const part in segments || {}) for (const s of segments[part]) (seg[s.key] = s), (partOf[s.key] = part);

  let cine = false, running = false, skipping = false;
  let nextLine = null; // resolves the line being spoken early
  let handle = null; // the clip playing
  let mood = 0, moodTarget = 0;

  function setCine(on) {
    cine = on;
    document.body.classList.toggle('cine', on);
    if (hud) hud.hidden(on);
    if (!on && shot) blendOut = 0.7;
    if (!on) shot = null;
  }
  const next = () => nextLine && nextLine();
  el.querySelector('.subs-pause').addEventListener('click', () => onPause && onPause());
  el.querySelector('.subs-next').addEventListener('click', next);
  el.querySelector('.subs-skip').addEventListener('click', () => {
    skipping = true;
    next();
  });
  subs.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener(
    'keydown',
    (e) => {
      if (!running || e.repeat) return;
      if ((cine && e.code === 'Space') || e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        next();
      }
    },
    true,
  );

  // ---------- one line of the play: voice, subtitle pages, Folio ink, speaker's gesture
  // waits run on the director's clock, which stands still while the game is paused
  let clock = 0;
  const timers = [];
  const timer = (sec) => new Promise((r) => timers.push({ at: clock + sec, r }));
  const sleep = (sec) =>
    new Promise((r) => {
      const t = { at: clock + sec, r };
      timers.push(t);
      nextLine = () => {
        const i = timers.indexOf(t);
        if (i >= 0) timers.splice(i, 1);
        r();
      };
    });
  function pages(lines) {
    // two or three verse lines a page, so long speeches can be read as they are heard
    const out = [];
    let cur = [];
    for (const l of lines) {
      cur.push(l);
      const len = cur.join(' ').length;
      if (cur.length >= 3 || len > 96) {
        out.push(cur);
        cur = [];
      }
    }
    if (cur.length) out.push(cur);
    return out;
  }
  async function speak(key, { actors = {}, onLine } = {}) {
    const s = seg[key];
    if (!s) return;
    if (s.scene && folio) folio.ink(s.scene, s.item);
    if (skipping) return;
    const narr = !!s.narration;
    const ch = narr ? 'narration' : 'voices';
    let buf = null;
    if (audio.soundOn() && audio.channelLevel(ch) > 0.01) buf = await audio.bankClip(voiceBase + partOf[key] + '.json', key);
    if (skipping) return;
    // the speaker's portrait and name; asides are thoughts, in italics
    const c = CHARACTERS[s.who];
    who.innerHTML = `${portraitSmall(s.who)}<b>${esc(c ? c.name : s.who)}</b>${s.aside ? '<i>aside</i>' : ''}`;
    subs.className = `subs${narr ? ' narration' : ''}${s.aside ? ' aside' : ''}${s.fx ? ' fx' : ''}`;
    subs.hidden = false;
    // the speaker talks with their hands; an aside darkens the world around Macbeth
    const speakers = s.who === 'All' ? ['witch1', 'witch2', 'witch3'] : [actorId(s.who)];
    for (const id of speakers) actors[id] && actors[id].talk && actors[id].talk(true);
    if (s.aside) moodTarget = 1;
    if (onLine) onLine(s);

    const ps = pages(s.lines);
    const chars = ps.map((p) => p.join(' ').length);
    const total = chars.reduce((a, b) => a + b, 0);
    if (s.fx && !buf) return; // a cackle with the sound off: nothing to read
    const length = buf ? buf.duration : ps.reduce((a, p, i) => a + 0.9 + chars[i] * 0.055, 0);
    let ended = false;
    if (buf) {
      audio.duck(true);
      handle = audio.playBuffer(buf, { ch });
      handle.done.then(() => (ended = true));
    }
    let cut = false;
    for (let i = 0; i < ps.length && !cut; i++) {
      say.innerHTML = s.fx ? `<span>(${esc(s.lines[0])})</span>` : ps[i].map((l) => `<span>${esc(l)}</span>`).join('');
      say.classList.remove('fresh');
      void say.offsetWidth;
      say.classList.add('fresh');
      const t0 = performance.now();
      const dur = buf ? (length * chars[i]) / total : 0.9 + chars[i] * 0.055;
      await sleep(dur);
      if (performance.now() - t0 < dur * 1000 - 30) cut = true; // skipped
    }
    if (buf && !cut && !ended) await Promise.race([handle.done, timer(0.4)]);
    if (handle) handle.stop();
    handle = null;
    audio.duck(false);
    for (const id of speakers) actors[id] && actors[id].talk && actors[id].talk(false);
    if (s.aside) moodTarget = 0;
    // a short breath between speakers; the sisters leave longer silences between them
    const hag = /Witch|^All$/.test(s.who);
    if (!cut && !skipping) await sleep(hag ? 0.45 : buf ? 0.12 : 0.15);
  }

  // ---------- running a scene: a list of steps
  //   { say: key }  a line           { dir: 'scene.item', text }  a stage direction, inked (shown briefly)
  //   { do: fn }    an event (always runs, even when skipped)      { wait: s }
  //   { shot: {from, at, drift, fov} } place the camera           { cine: bool }
  async function run(steps, { actors = {}, onLine } = {}) {
    running = true;
    skipping = false;
    try {
      for (let n = 0; n < steps.length; n++) {
        const st = steps[n];
        // decode the next line while this one plays
        if (audio.soundOn())
          for (const ahead of steps.slice(n + 1).filter((x) => x.say).slice(0, 2))
            if (seg[ahead.say]) audio.bankClip(voiceBase + partOf[ahead.say] + '.json', ahead.say);
        if (st.cine !== undefined) setCine(st.cine);
        if (st.shot && !skipping) setShot(st.shot);
        if (st.do) await st.do();
        if (st.dir) {
          const [a, b, i] = st.dir.split('.');
          if (folio) folio.ink(`${a}.${b}`, Number(i));
          if (st.text && !skipping) {
            who.innerHTML = '';
            subs.className = 'subs direction';
            subs.hidden = false;
            say.innerHTML = `<span>${esc(st.text)}</span>`;
            await sleep(st.hold || 1.0);
          }
        }
        if (st.say) await speak(st.say, { actors, onLine });
        if (st.wait && !skipping) await sleep(st.wait);
      }
    } finally {
      subs.hidden = true;
      running = false;
      skipping = false;
      nextLine = null;
      moodTarget = 0;
      setCine(false);
      if (folio) folio.stopSpeaking();
    }
  }

  // ---------- the camera
  let shot = null, blendOut = 0;
  const lastPos = new THREE.Vector3(), lastLook = new THREE.Vector3();
  const v = new THREE.Vector3(), w = new THREE.Vector3();
  const val = (x) => (typeof x === 'function' ? x() : x);
  function setShot(s) {
    shot = { ...s, t: 0, dur: s.dur || 6 };
  }
  // call after the player's camera has been placed: overrides it in a cinematic,
  // and eases back from the last shot afterwards
  function update(dt, real = dt) {
    clock += real;
    for (let i = timers.length - 1; i >= 0; i--)
      if (timers[i].at <= clock) {
        const t = timers[i];
        timers.splice(i, 1);
        t.r();
      }
    mood += (moodTarget - mood) * Math.min(1, dt * 1.6);
    fill.intensity += ((cine ? 7 : 0) - fill.intensity) * Math.min(1, dt * 2);
    el.style.setProperty('--mood', mood.toFixed(3));
    if (cine && shot) {
      shot.t += dt;
      const k = ease(Math.min(1, shot.t / shot.dur));
      const from = val(shot.from), at = val(shot.at);
      v.copy(from);
      if (shot.drift) v.lerp(w.copy(from).lerp(at, shot.drift), k); // a slow push in
      if (shot.rise) v.y += shot.rise * k;
      const ground = heightAt(v.x, v.z) + 0.4;
      if (v.y < ground) v.y = ground;
      camera.position.copy(v);
      camera.lookAt(at);
      fill.position.copy(v).lerp(at, 0.25).add(w.set(0, 0.5, 0));
      lastPos.copy(camera.position);
      lastLook.copy(at);
    } else if (blendOut > 0) {
      const k = blendOut / 0.7;
      blendOut = Math.max(0, blendOut - dt);
      const target = w.copy(camera.position);
      camera.getWorldDirection(v);
      const look = v.multiplyScalar(4).add(target);
      camera.position.lerpVectors(target, lastPos, ease(k));
      camera.lookAt(look.lerp(lastLook, ease(k)));
    }
  }

  // ---------- chapter cards: "Act I · Scene III — A heath near Forres". A new scene opens
  // as in a theatre: the curtains swing shut, the title is announced, and they part.
  async function card(top, title, sub, secs = 3.6) {
    const scene = /Scene/.test(top);
    if (scene) {
      el.classList.add('curtains-shut');
      await timer(0.55);
      audio.sfx('curtain');
    }
    chapter.innerHTML = `<div class="ch-top">${top}</div><div class="ch-title">${title}</div>${sub ? `<div class="ch-sub">${sub}</div>` : ''}`;
    chapter.hidden = false;
    chapter.classList.remove('show');
    void chapter.offsetWidth;
    chapter.classList.add('show');
    if (scene) {
      await timer(0.9);
      el.classList.remove('curtains-shut');
    }
    await timer(secs);
    chapter.classList.remove('show');
    await timer(0.7);
    chapter.hidden = true;
  }

  return {
    run,
    update,
    card,
    setCine,
    setShot,
    get cine() {
      return cine;
    },
    get running() {
      return running;
    },
    get skipping() {
      return skipping;
    },
    has: (key) => !!seg[key],
    // more lines from another bank (the yard's Captain, later acts)
    addLines(part, list) {
      for (const s of list || []) (seg[s.key] = s), (partOf[s.key] = part);
    },
    wait: timer,
    // warm up a part's voices before they are needed
    preload(part) {
      audio.loadBank(voiceBase + part + '.json');
    },
  };
}

export function actorId(name) {
  return { 'First Witch': 'witch1', 'Second Witch': 'witch2', 'Third Witch': 'witch3', Macbeth: 'macbeth', Banquo: 'banquo', Ross: 'ross', Angus: 'angus' }[name] || name;
}

// ---------- shots, from the actors' positions (an actor faces +z when rotation.y is 0)
const head = (a) => new THREE.Vector3(a.root.position.x, a.root.position.y + a.height * 0.93, a.root.position.z);
const fwd = (a) => new THREE.Vector3(Math.sin(a.root.rotation.y), 0, Math.cos(a.root.rotation.y));
// in front of an actor's face, a little to one side
export function faceShot(a, { dist = 1.7, side = 0.45, up = 0.05, drift = 0.08, dur = 8 } = {}) {
  return {
    from: () => {
      const f = fwd(a);
      return head(a).addScaledVector(f, dist).add(new THREE.Vector3(f.z, 0, -f.x).multiplyScalar(side)).add(new THREE.Vector3(0, up, 0));
    },
    at: () => head(a).add(new THREE.Vector3(0, -0.24, 0)), // the face above the subtitles
    drift,
    dur,
  };
}
// over one actor's shoulder, looking at another's face
export function overShoulder(over, at, { back = 1.25, side = 0.55, up = 0.18, drift = 0.06, dur = 8 } = {}) {
  return {
    from: () => {
      const o = head(over), t = head(at);
      const dir = t.clone().sub(o).setY(0).normalize();
      return o.addScaledVector(dir, -back).add(new THREE.Vector3(dir.z, 0, -dir.x).multiplyScalar(side)).add(new THREE.Vector3(0, up, 0));
    },
    at: () => head(at).add(new THREE.Vector3(0, -0.2, 0)),
    drift,
    dur,
  };
}
// a wide view of a group, from a bearing round their centre
export function wideShot(actors, { dist = 7, up = 2.2, bearing = 0, drift = 0.06, dur = 10, look = 1.2 } = {}) {
  const centre = () => {
    const c = new THREE.Vector3();
    for (const a of actors) c.add(a.root.position);
    return c.divideScalar(actors.length);
  };
  return {
    from: () => {
      const c = centre();
      return c.add(new THREE.Vector3(Math.sin(bearing) * dist, up, Math.cos(bearing) * dist));
    },
    at: () => centre().add(new THREE.Vector3(0, look, 0)),
    drift,
    dur,
  };
}
