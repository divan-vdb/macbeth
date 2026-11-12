// Night ambience, synthesised with the Web Audio API: no audio files, no loops
// you can hear. Wind arrives in gusts and dies away; crickets sing in spells and
// fall silent; the fire crackles; an owl calls now and then; thunder rolls in
// from the distance. Browsers only allow sound after a tap, so start() is called
// from the first touch or click.

let ctx = null, master = null, verb = null, noise = null;
let started = false, muted = false;
let fireLevel = 0;
const gust = { start: 0, rise: 1, hold: 0, fall: 1, peak: 0 };

function makeNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return buf;
}
function whiteNoise(seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
const rnd = (a, b) => a + Math.random() * (b - a);
const later = (sec, fn) => setTimeout(fn, sec * 1000);

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    // A simple echo to give distant sounds space across the moor
    verb = ctx.createDelay(1.0);
    verb.delayTime.value = 0.23;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1800;
    verb.connect(tone).connect(fb).connect(verb);
    tone.connect(master);
    noise = { brown: makeNoise(12), white: whiteNoise(2) };
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------- wind: gusts that build, hold, and die away at random intervals
function startWind() {
  const src = ctx.createBufferSource();
  src.buffer = noise.brown;
  src.loop = true;
  src.loopStart = rnd(0, 4);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 0.8;
  bp.frequency.value = 280;
  const g = ctx.createGain();
  g.gain.value = 0.008;
  src.connect(bp).connect(g).connect(channel('ambient'));
  src.start();
  const next = () => {
    const now = ctx.currentTime;
    const rise = rnd(1.8, 5), hold = rnd(0.5, 3), fall = rnd(3, 7), peak = rnd(0.12, 0.42);
    Object.assign(gust, { start: performance.now() / 1000, rise, hold, fall, peak });
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(peak, now + rise);
    g.gain.setValueAtTime(peak * rnd(0.8, 1), now + rise + hold);
    g.gain.linearRampToValueAtTime(0.006, now + rise + hold + fall);
    bp.frequency.cancelScheduledValues(now);
    bp.frequency.setValueAtTime(bp.frequency.value, now);
    bp.frequency.linearRampToValueAtTime(rnd(450, 800), now + rise);
    bp.frequency.linearRampToValueAtTime(rnd(220, 320), now + rise + hold + fall);
    later(rise + hold + fall + rnd(3, 14), next);
  };
  later(rnd(0.5, 3), next);
}

// 0..1, for the grass to bend with the sound
export function windLevel() {
  if (!started) return 0.2;
  const t = performance.now() / 1000 - gust.start;
  const { rise, hold, fall, peak } = gust;
  const p = peak / 0.42;
  if (t < 0) return 0.1;
  if (t < rise) return 0.1 + p * (t / rise);
  if (t < rise + hold) return 0.1 + p;
  if (t < rise + hold + fall) return 0.1 + p * (1 - (t - rise - hold) / fall);
  return 0.1;
}

// ---------- crickets: each sings in spells of chirps, then stops for a while
function cricket() {
  const pan = ctx.createStereoPanner();
  pan.pan.value = rnd(-0.9, 0.9);
  const out = ctx.createGain();
  out.gain.value = rnd(0.012, 0.03);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 6500;
  out.connect(lp).connect(pan).connect(channel('ambient'));
  const freq = rnd(4100, 5200);
  const pulses = 2 + Math.floor(Math.random() * 3);

  const chirp = (at) => {
    const o = ctx.createOscillator();
    o.frequency.value = freq * rnd(0.995, 1.005);
    const g = ctx.createGain();
    g.gain.value = 0;
    for (let p = 0; p < pulses; p++) {
      const s = at + p * 0.034;
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.006);
      g.gain.linearRampToValueAtTime(0, s + 0.022);
    }
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + pulses * 0.034 + 0.05);
  };
  const spell = () => {
    const gap = rnd(0.32, 0.85), length = rnd(4, 18);
    let at = ctx.currentTime + 0.05;
    const end = at + length;
    while (at < end) {
      chirp(at);
      at += gap * rnd(0.9, 1.1);
    }
    later(length + rnd(3, 22), spell);
  };
  later(rnd(1, 12), spell);
}

// ---------- a wood fire, built from its real parts and placed in space:
//   the low breathing roar of the flames, a fluttering where they tear in the
//   wind, a thin hiss of sap, a constant fizz of tiny crackles that comes in
//   bursts, sharp pops with a woody knock as resin cells burst, and now and
//   then the soft crunch of a log settling into the coals. Close by it is loud
//   and bright; from afar only the roar and the louder pops carry, muffled.
let fire = null;
function clickBuffers() {
  // a handful of short crackle impulses with different colours, made once
  const out = [];
  for (let k = 0; k < 10; k++) {
    const len = Math.floor(ctx.sampleRate * (0.002 + Math.random() * 0.006));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let lp = 0;
    const bright = 0.25 + Math.random() * 0.7;
    for (let i = 0; i < len; i++) {
      const env = Math.exp(-i / (len * 0.25));
      lp += (Math.random() * 2 - 1 - lp) * bright;
      d[i] = lp * env;
    }
    out.push(buf);
  }
  return out;
}
function startFire() {
  const out = ctx.createGain();
  out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
  const air = ctx.createBiquadFilter(); // distance muffles the high crackle
  air.type = 'lowpass';
  air.frequency.value = 1500;
  air.connect(out).connect(pan).connect(channel('ambient'));
  // the roar: deep turbulent noise whose loudness breathes
  const roarSrc = ctx.createBufferSource();
  roarSrc.buffer = noise.brown;
  roarSrc.loop = true;
  const roarLp = ctx.createBiquadFilter();
  roarLp.type = 'lowpass';
  roarLp.frequency.value = 380;
  const roar = ctx.createGain();
  roar.gain.value = 0.05;
  roarSrc.connect(roarLp).connect(roar).connect(out); // the roar is not muffled by distance
  roarSrc.start();
  // flutter: flames tearing, a fast wobble in the low-mids
  const flSrc = ctx.createBufferSource();
  flSrc.buffer = noise.brown;
  flSrc.loop = true;
  flSrc.loopStart = 3;
  const flBp = ctx.createBiquadFilter();
  flBp.type = 'bandpass';
  flBp.frequency.value = 220;
  flBp.Q.value = 0.9;
  const flutter = ctx.createGain();
  flutter.gain.value = 0;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 7;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.02;
  lfo.connect(lfoG).connect(flutter.gain);
  lfo.start();
  flSrc.connect(flBp).connect(flutter).connect(air);
  flSrc.start();
  // hiss: sap boiling out of the ends of the logs
  const hsSrc = ctx.createBufferSource();
  hsSrc.buffer = noise.white;
  hsSrc.loop = true;
  const hsHp = ctx.createBiquadFilter();
  hsHp.type = 'highpass';
  hsHp.frequency.value = 5200;
  const hiss = ctx.createGain();
  hiss.gain.value = 0.004;
  hsSrc.connect(hsHp).connect(hiss).connect(air);
  hsSrc.start();
  const clicks = clickBuffers();
  const click = (at, amp, dest = air) => {
    const s = ctx.createBufferSource();
    s.buffer = clicks[Math.floor(Math.random() * clicks.length)];
    s.playbackRate.value = rnd(0.7, 1.5);
    const g = ctx.createGain();
    g.gain.value = amp;
    s.connect(g).connect(dest);
    s.start(at);
  };
  const pop = (at, amp) => {
    // a resin pop: a sharp crack, a woody knock, a tail of sparks
    click(at, amp * 1.6, out);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(rnd(160, 320), at);
    o.frequency.exponentialRampToValueAtTime(rnd(70, 110), at + 0.06);
    const g = ctx.createGain();
    g.gain.setValueAtTime(amp * 0.5, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + rnd(0.05, 0.11));
    o.connect(g).connect(air);
    o.start(at);
    o.stop(at + 0.15);
    for (let i = 0; i < 6; i++) click(at + 0.02 + Math.random() * 0.25, amp * rnd(0.05, 0.3));
  };
  const settle = (at) => {
    // a log sinking into the coals: a soft crunch and a crumble
    for (let i = 0; i < 14; i++) click(at + Math.random() * 0.6, rnd(0.02, 0.09));
    const s = ctx.createBufferSource();
    s.buffer = noise.brown;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(0.12, at + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    s.connect(f).connect(g).connect(out);
    s.start(at, rnd(0, 8), 0.8);
  };
  let burst = 0, nextPop = 2, nextSettle = 12, breath = 0;
  const STEP = 0.06;
  const tick = () => {
    const now = ctx.currentTime;
    if (fire.level > 0.005) {
      // the crackle: tiny clicks at a Poisson rate, in bursts now and then
      if (burst <= 0 && Math.random() < 0.012) burst = rnd(0.3, 1.2);
      const rate = (burst > 0 ? 70 : 16) * (0.6 + Math.random() * 0.8);
      const n = Math.floor(rate * STEP + Math.random());
      for (let i = 0; i < n; i++) {
        const heavy = Math.random() < 0.08;
        click(now + Math.random() * STEP, (heavy ? rnd(0.12, 0.3) : rnd(0.01, 0.07)) * (Math.random() ** 1.5 + 0.2));
      }
      burst -= STEP;
      nextPop -= STEP;
      if (nextPop <= 0) {
        pop(now + Math.random() * STEP, rnd(0.18, 0.5));
        nextPop = Math.random() < 0.3 ? rnd(0.2, 0.6) : rnd(1.5, 6);
      }
      nextSettle -= STEP;
      if (nextSettle <= 0) {
        settle(now);
        nextSettle = rnd(14, 40);
      }
      // the flames breathe: the roar swells and ebbs
      breath += STEP * rnd(0.3, 1.2);
      roar.gain.setTargetAtTime(0.045 + Math.sin(breath) * 0.012 + Math.sin(breath * 2.7) * 0.008, now, 0.2);
      flutter.gain.setTargetAtTime(0.015 + Math.max(0, Math.sin(breath * 1.7)) * 0.02, now, 0.15);
      hiss.gain.setTargetAtTime(0.002 + Math.max(0, Math.sin(breath * 0.6)) * 0.004, now, 0.4);
    }
    later(STEP, tick);
  };
  fire = { out, air, pan, level: 0 };
  tick();
}
// level: 0 far .. 1 standing at the fire; pan: -1 left .. 1 right of the listener
export function setFireProximity(level, panTo = 0) {
  fireLevel = Math.max(0, Math.min(1, level));
  if (!fire) return;
  fire.level = fireLevel;
  const now = ctx.currentTime;
  fire.out.gain.setTargetAtTime(fireLevel * 1.1, now, 0.25);
  fire.air.frequency.setTargetAtTime(900 + fireLevel * fireLevel * 11000, now, 0.25);
  if (fire.pan.pan) fire.pan.pan.setTargetAtTime(Math.max(-0.85, Math.min(0.85, panTo)) * (1 - fireLevel * 0.5), now, 0.15);
}

// ---------- a distant owl, rarely
function owl() {
  const call = () => {
    const at = ctx.currentTime + 0.1;
    const pan = ctx.createStereoPanner();
    pan.pan.value = rnd(-0.8, 0.8);
    const out = ctx.createGain();
    out.gain.value = rnd(0.025, 0.05);
    out.connect(pan);
    pan.connect(channel('ambient'));
    pan.connect(verb);
    const f = rnd(330, 400);
    const hoot = (s, len, bend) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f, s);
      o.frequency.linearRampToValueAtTime(f * bend, s + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(1, s + 0.05);
      g.gain.setValueAtTime(1, s + len - 0.1);
      g.gain.linearRampToValueAtTime(0, s + len);
      o.connect(g).connect(out);
      o.start(s);
      o.stop(s + len + 0.05);
    };
    hoot(at, 0.45, 0.92);
    hoot(at + 0.9, 0.18, 0.97);
    hoot(at + 1.15, 0.6, 0.9);
    later(rnd(35, 110), call);
  };
  later(rnd(15, 45), call);
}

// ---------- thunder: near = a sharp crack then a heavy roll; far = a low, long grumble
export function thunder(near = 0.5) {
  if (!ctx || !started) return;
  const now = ctx.currentTime;
  const len = 3 + (1 - near) * 3;
  const src = ctx.createBufferSource();
  src.buffer = noise.brown;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(200 + near * 900, now);
  lp.frequency.exponentialRampToValueAtTime(60 + near * 60, now + len);
  const g = ctx.createGain();
  const peak = 0.4 + near * 1.4;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(peak, now + 0.05 + (1 - near) * 0.6);
  g.gain.exponentialRampToValueAtTime(peak * 0.35, now + 0.7 + (1 - near));
  g.gain.linearRampToValueAtTime(peak * 0.6, now + 1.1 + (1 - near) * 1.2);
  g.gain.exponentialRampToValueAtTime(0.0001, now + len);
  src.connect(lp).connect(g);
  g.connect(channel('ambient'));
  g.connect(verb);
  src.start(now, rnd(0, 5), len + 0.1);
  if (near > 0.45) {
    // A close strike tears the air: a quick, irregular volley of deep, woody
    // cracks (filtered brown noise, no hiss) that runs straight into the boom.
    const cracks = 4 + Math.floor(Math.random() * 4);
    let at = now;
    for (let i = 0; i < cracks; i++) {
      const c = ctx.createBufferSource();
      c.buffer = noise.brown;
      const bp = ctx.createBiquadFilter();
      bp.type = 'lowpass';
      bp.frequency.value = 900 + near * 900 - i * 90;
      bp.Q.value = 0.4;
      const cg = ctx.createGain();
      const amp = (0.9 + near * 1.2) * (1 - i / (cracks + 1)) * rnd(0.6, 1);
      cg.gain.setValueAtTime(0.0001, at);
      cg.gain.exponentialRampToValueAtTime(amp, at + 0.006);
      cg.gain.exponentialRampToValueAtTime(0.0001, at + rnd(0.07, 0.16));
      c.connect(bp).connect(cg);
      cg.connect(channel('ambient'));
      cg.connect(verb);
      c.start(at, rnd(0, 5), 0.2);
      at += rnd(0.018, 0.07);
    }
  }
}

// ---------- footsteps on the heath: the soft thud of a boot in peaty ground and
// the brush and crunch of grass and heather, a heel strike and a roll onto the
// toe when walking, one sharper strike when running. Kept low under the ambience.
export function footstep({ speed = 1.7, side = 0, heavy = false, surface = 'heath' } = {}) {
  if (!ctx || !started) return;
  const now = ctx.currentTime + 0.005;
  const run = Math.max(0, Math.min(1, (speed - 2.1) / 3.3));
  const level = (0.05 + 0.045 * run) * (heavy ? 1.9 : 1) * rnd(0.82, 1.1);
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  const out = pan || ctx.createGain();
  if (pan) pan.pan.value = side * 0.12;
  out.connect(channel('effects'));
  const stone = surface === 'stone';
  const burst = (at, amp, len, lo, hi, thud) => {
    // a thump of the boot: low, dull
    const t = ctx.createBufferSource();
    t.buffer = noise.brown;
    const tl = ctx.createBiquadFilter();
    tl.type = 'lowpass';
    tl.frequency.value = rnd(140, 220) + (stone ? 120 : 0);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, at);
    tg.gain.exponentialRampToValueAtTime(amp * thud, at + 0.006);
    tg.gain.exponentialRampToValueAtTime(0.0001, at + len * 0.8);
    t.connect(tl).connect(tg).connect(out);
    t.start(at, rnd(0, 10), len + 0.05);
    // the crunch of grass, heather or grit under it
    const c = ctx.createBufferSource();
    c.buffer = noise.white;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rnd(lo, hi);
    bp.Q.value = rnd(0.7, 1.3);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, at);
    cg.gain.exponentialRampToValueAtTime(amp, at + rnd(0.006, 0.014));
    cg.gain.exponentialRampToValueAtTime(0.0001, at + len);
    c.connect(bp).connect(cg).connect(out);
    c.start(at, rnd(0, 1.5), len + 0.05);
  };
  const lo = stone ? 2200 : 1100, hi = stone ? 4200 : 2600;
  if (heavy) {
    burst(now, level, 0.2, lo * 0.8, hi * 0.8, 3.2);
  } else if (run > 0.4) {
    burst(now, level, rnd(0.07, 0.1), lo, hi, 2.4);
  } else {
    burst(now, level, rnd(0.09, 0.13), lo, hi, 2.0); // heel
    burst(now + rnd(0.06, 0.09), level * 0.55, rnd(0.08, 0.12), lo * 1.2, hi * 1.2, 0.8); // roll onto the toe
  }
  later(0.6, () => out.disconnect());
}

// ---------- channels: narration and character voices have their own volume, so
// they can be muted while the world's sounds play on (settings come in Phase 2B)
const channels = {};
function channel(name) {
  if (!channels[name]) {
    channels[name] = ctx.createGain();
    channels[name].gain.value = name in wanted ? wanted[name] : 1;
    channels[name].connect(master);
  }
  return channels[name];
}
const wanted = {};
export function setChannelVolume(name, v) {
  wanted[name] = v;
  if (ctx) channel(name).gain.setTargetAtTime(v, ctx.currentTime, 0.05);
}

// A recorded line (base64 MP3 wrapped in JSON, decoded here rather than fetched
// as a data: URL, which the host forbids). Returns a handle with stop().
const clipCache = new Map();
export async function playClip(url, { ch = 'narration', gain = 1 } = {}) {
  if (!ctx || !started) return { stop() {}, done: Promise.resolve() };
  if (!clipCache.has(url)) {
    clipCache.set(url, (async () => {
      const { mp3 } = await (await fetch(url)).json();
      const bin = atob(mp3);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return ctx.decodeAudioData(bytes.buffer);
    })());
  }
  const buf = await clipCache.get(url);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(channel(ch));
  src.start();
  let resolve;
  const done = new Promise((r) => (resolve = r));
  src.onended = () => resolve();
  return {
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      later(0.4, () => { try { src.stop(); } catch (e) { /* already stopped */ } });
      resolve();
    },
    done,
  };
}

// A bank of recorded lines (one JSON per scene part: { clips: { key: base64 MP3 } }).
// Lines are decoded when first needed. Returns null if sound has not started.
const banks = new Map();
const decoded = new Map();
export function loadBank(url) {
  if (!banks.has(url)) banks.set(url, fetch(url).then((r) => (r.ok ? r.json() : { clips: {} })).then((j) => j.clips || {}).catch(() => ({})));
  return banks.get(url);
}
export async function bankClip(url, key) {
  if (!ctx || !started) return null;
  const id = url + '#' + key;
  if (!decoded.has(id)) {
    decoded.set(id, (async () => {
      const clips = await loadBank(url);
      if (!clips[key]) return null;
      const bin = atob(clips[key]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return ctx.decodeAudioData(bytes.buffer);
    })().catch(() => null));
  }
  return decoded.get(id);
}
export function channelLevel(name) {
  return name in wanted ? wanted[name] : 1;
}
export function soundOn() {
  return !!(ctx && started && !muted);
}
// play a decoded line on a channel; the handle's done resolves when it ends or is stopped
export function playBuffer(buf, { ch = 'voices', gain = 1 } = {}) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(channel(ch));
  src.start();
  let resolve;
  const done = new Promise((r) => (resolve = r));
  src.onended = () => resolve();
  return {
    stop() {
      g.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
      later(0.3, () => { try { src.stop(); } catch (e) { /* already stopped */ } });
      resolve();
    },
    done,
  };
}

// ---------- small sound effects for the game's actions, all synthesised
function env(node, at, peak, attack, decay) {
  node.gain.setValueAtTime(0.0001, at);
  node.gain.exponentialRampToValueAtTime(peak, at + attack);
  node.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}
function noiseHit(at, { type = 'bandpass', freq = 1000, q = 1, peak = 0.1, attack = 0.005, decay = 0.1, brown = false, out = master, sweepTo = 0 } = {}) {
  const n = ctx.createBufferSource();
  n.buffer = brown ? noise.brown : noise.white;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, at);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, at + attack + decay);
  f.Q.value = q;
  const g = ctx.createGain();
  env(g, at, peak, attack, decay);
  n.connect(f).connect(g).connect(out);
  n.start(at, rnd(0, brown ? 10 : 1.5), attack + decay + 0.05);
}
function tone(at, { freq = 440, to = 0, type = 'sine', peak = 0.05, attack = 0.005, decay = 0.3, out = master } = {}) {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (to) o.frequency.exponentialRampToValueAtTime(to, at + attack + decay);
  const g = ctx.createGain();
  env(g, at, peak, attack, decay);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + attack + decay + 0.05);
}
export function sfx(name) {
  if (!ctx || !started) return;
  const t = ctx.currentTime + 0.01;
  const fx = channel('effects');
  switch (name) {
    case 'drum': // a war drum across the heath: "A drum, a drum! Macbeth doth come."
      for (let i = 0; i < 9; i++) {
        const at = t + i * 0.52 + (i % 3 === 2 ? 0.12 : 0);
        const lv = 0.16 * (0.55 + 0.45 * Math.sin((i / 8) * Math.PI));
        tone(at, { freq: 62, peak: lv, decay: 0.5, out: fx });
        noiseHit(at, { freq: 140, q: 0.9, peak: lv * 0.8, decay: 0.22, brown: true, out: fx });
        if (i % 3 !== 1) noiseHit(at + 0.26, { freq: 900, q: 1.4, peak: lv * 0.18, decay: 0.05, out: fx });
      }
      break;
    case 'vanish': // the sisters melt into the air: a rising, hollow rush
      noiseHit(t, { type: 'bandpass', freq: 300, sweepTo: 2600, q: 1.6, peak: 0.12, attack: 0.5, decay: 1.6, out: fx });
      noiseHit(t + 0.2, { type: 'bandpass', freq: 5200, sweepTo: 900, q: 4, peak: 0.04, attack: 0.3, decay: 1.4, out: fx });
      for (const f of [196, 233, 311]) tone(t + 0.1, { freq: f, peak: 0.02, decay: 2.2, out: fx });
      break;
    case 'appear': // the sisters gather out of the mist
      noiseHit(t, { type: 'bandpass', freq: 2400, sweepTo: 260, q: 1.6, peak: 0.1, attack: 0.6, decay: 1.2, out: fx });
      for (const f of [147, 175, 208]) tone(t + 0.4, { freq: f, peak: 0.018, decay: 2, out: fx });
      break;
    case 'hooves': // riders coming at a trot over soft ground
      for (let i = 0; i < 20; i++) {
        const at = t + i * 0.19 + (i % 2) * 0.05;
        const lv = 0.05 * Math.min(1, (i + 2) / 10);
        noiseHit(at, { freq: rnd(320, 480), q: 1.2, peak: lv, decay: 0.06, brown: true, out: fx });
      }
      break;
    case 'pickup': // a stone or flask lifted from the heather
      noiseHit(t, { freq: 1800, q: 0.8, peak: 0.05, decay: 0.12, out: fx });
      noiseHit(t + 0.05, { freq: 260, q: 0.7, peak: 0.08, decay: 0.08, brown: true, out: fx });
      break;
    case 'stone': // stones knocking together
      for (let i = 0; i < 2; i++) {
        noiseHit(t + i * 0.07, { freq: rnd(2400, 3400), q: 6, peak: 0.08, decay: 0.05, out: fx });
        tone(t + i * 0.07, { freq: rnd(1700, 2300), peak: 0.02, decay: 0.06, out: fx });
      }
      break;
    case 'draw': // steel leaving its scabbard: a rising scrape, then a ring
      noiseHit(t, { type: 'bandpass', freq: 1800, sweepTo: 6000, q: 3, peak: 0.07, attack: 0.03, decay: 0.32, out: fx });
      for (const f of [2210, 3470, 5150]) tone(t + 0.3, { freq: f, peak: 0.012, decay: 1.1, out: fx });
      break;
    case 'sheathe':
      noiseHit(t, { type: 'bandpass', freq: 5000, sweepTo: 1500, q: 3, peak: 0.05, attack: 0.02, decay: 0.28, out: fx });
      noiseHit(t + 0.3, { freq: 300, q: 1, peak: 0.08, decay: 0.06, brown: true, out: fx });
      break;
    case 'spear': // ash shaft knocked against the hand
      tone(t, { freq: 220, to: 180, type: 'triangle', peak: 0.05, decay: 0.12, out: fx });
      noiseHit(t, { freq: 900, q: 2, peak: 0.05, decay: 0.06, out: fx });
      break;
    case 'fists':
      noiseHit(t, { freq: 500, q: 1, peak: 0.05, decay: 0.07, brown: true, out: fx });
      break;
    case 'drink': // cork out, three gulps, a breath
      tone(t, { freq: 900, to: 500, type: 'sine', peak: 0.04, decay: 0.05, out: fx });
      for (let i = 0; i < 3; i++) tone(t + 0.35 + i * 0.32, { freq: 150, to: 90, peak: 0.08, attack: 0.02, decay: 0.15, out: fx });
      noiseHit(t + 1.4, { freq: 700, q: 0.6, peak: 0.03, attack: 0.08, decay: 0.4, out: fx });
      break;
    case 'paper': // parchment unrolled
      for (let i = 0; i < 5; i++) noiseHit(t + i * rnd(0.04, 0.09), { freq: rnd(2500, 5000), q: 0.6, peak: rnd(0.02, 0.04), decay: rnd(0.04, 0.09), out: fx });
      break;
    case 'burn': // the fire bites
      noiseHit(t, { freq: 3000, q: 0.7, peak: 0.06, attack: 0.02, decay: 0.3, out: fx });
      tone(t, { freq: 180, to: 120, type: 'sawtooth', peak: 0.015, decay: 0.25, out: fx });
      break;
    case 'hurt':
      noiseHit(t, { freq: 160, q: 0.8, peak: 0.12, decay: 0.15, brown: true, out: fx });
      break;
    case 'fall': // a heavy body, then a low toll
      noiseHit(t, { freq: 140, q: 0.7, peak: 0.2, decay: 0.35, brown: true, out: fx });
      tone(t + 0.4, { freq: 73, peak: 0.08, attack: 0.05, decay: 3, out: fx });
      tone(t + 0.4, { freq: 110, peak: 0.03, attack: 0.05, decay: 2.5, out: fx });
      break;
    case 'rise':
      tone(t, { freq: 220, to: 330, peak: 0.03, attack: 0.3, decay: 1.2, out: fx });
      break;
    case 'objective': // a soft, low bell when a task is done
      for (const [f, d] of [[392, 1.6], [588, 1.2], [784, 0.9]]) tone(t, { freq: f, peak: 0.02, attack: 0.01, decay: d, out: fx });
      break;
    case 'flap': // one beat of a raven's wings
      noiseHit(t, { freq: 400, q: 0.6, peak: 0.05, attack: 0.03, decay: 0.12, brown: true, out: fx });
      break;
    case 'caw':
      caw(t, fx);
      later(rnd(0.45, 0.6), () => caw(ctx.currentTime, fx));
      break;
  }
}
// A raven's harsh "kraa": a buzzy voice through two throat resonances, falling.
function caw(t, out) {
  const o = ctx.createOscillator();
  o.type = 'sawtooth';
  const f0 = rnd(380, 460);
  o.frequency.setValueAtTime(f0 * 1.15, t);
  o.frequency.exponentialRampToValueAtTime(f0, t + 0.05);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.82, t + 0.3);
  const shake = ctx.createOscillator();
  shake.frequency.value = 38;
  const sg = ctx.createGain();
  sg.gain.value = 22;
  shake.connect(sg).connect(o.frequency);
  const g = ctx.createGain();
  env(g, t, 0.07, 0.015, 0.3);
  for (const [f, q] of [[1150, 5], [2500, 6]]) {
    const b = ctx.createBiquadFilter();
    b.type = 'bandpass';
    b.frequency.value = f;
    b.Q.value = q;
    o.connect(b).connect(g);
  }
  g.connect(out);
  g.connect(verb);
  o.start(t);
  shake.start(t);
  o.stop(t + 0.4);
  shake.stop(t + 0.4);
}

export function start() {
  ensure();
  if (started) return;
  started = true;
  startWind();
  for (let i = 0; i < 4; i++) cricket();
  startFire();
  owl();
}

// pause: everything stops where it is (voices mid-word included) and carries on from there
export function pauseAll(on) {
  if (!ctx) return;
  if (on) ctx.suspend();
  else ctx.resume();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.1);
}
export const isMuted = () => muted;
