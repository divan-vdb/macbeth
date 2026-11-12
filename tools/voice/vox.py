"""Voice shaping with the WORLD vocoder (pyworld, MIT): ages and characterises a
synthetic voice without changing its pace, and never clips.

  age(y, sr, f0=..., formant=..., jitter=..., tremor=(hz, depth), breath=..., fry=..., whisper=..., sub=...)
    f0       pitch scale (0.8 = lower)
    formant  vocal-tract scale (>1 thinner, pinched; <1 bigger, chestier)
    jitter   random pitch roughness (0.03 = 3 %), the unsteadiness of an old voice
    tremor   slow wavering of the pitch (hz, depth)
    breath   how much breath and rasp replaces clean tone (0..1)
    fry      croak at the end of phrases (0..1): pitch sinks and rattles
    whisper  a whispered double of the same words, mixed under (0..1)
    sub      a growl an octave below, mixed under (0..1)
  finish(y, sr, chain)   ffmpeg EQ and room in 32-bit float, then even loudness and a safe peak
"""
import numpy as np, pyworld as pw, soundfile as sf, subprocess, tempfile

FP = 5.0  # frame period (ms)

def _smooth_noise(n, frames, rng):
    x = rng.standard_normal(n)
    k = np.ones(frames) / frames
    return np.convolve(x, k, mode='same') * np.sqrt(frames)

def age(y, sr, f0=1.0, formant=1.0, jitter=0.0, tremor=(0, 0), breath=0.0, fry=0.0, whisper=0.0, sub=0.0, seed=1, range=1.0, creak=0.0, breath_from=0.0):
    x = np.ascontiguousarray(y, dtype=np.float64)
    F0, t = pw.harvest(x, sr, f0_floor=60.0, f0_ceil=600.0, frame_period=FP)
    sp = pw.cheaptrick(x, F0, t, sr)
    ap = pw.d4c(x, F0, t, sr)
    n = len(F0)
    rng = np.random.default_rng(seed)
    voiced = F0 > 0
    g = F0 * f0
    # wider swoops of pitch (a theatrical, sing-song crone), round the speaker's middle
    if range != 1.0 and voiced.any():
        mid = np.median(np.log(g[voiced]))
        g = np.where(voiced, np.exp(mid + (np.log(np.maximum(g, 1e-3)) - mid) * range), 0)
    # creaky voice: the low stretches sink further and rattle
    if creak:
        mid = np.median(g[voiced]) if voiced.any() else 0
        low = voiced & (g < mid)
        deep = np.clip((mid - g) / max(mid, 1), 0, 1)
        g = np.where(low, g * (1 - creak * 0.35 * deep) * (1 + creak * 0.06 * rng.standard_normal(n)), g)
    # unsteadiness: fast roughness plus a slow tremor and a slower drift
    if jitter:
        g *= 1 + jitter * _smooth_noise(n, 3, rng) + jitter * 0.6 * _smooth_noise(n, 40, rng)
    if tremor[1]:
        tt = np.arange(n) * FP / 1000
        g *= 1 + tremor[1] * np.sin(2 * np.pi * tremor[0] * tt + rng.uniform(0, 6))
    # breath and rasp
    if breath:
        # rasp lives in the upper voice: from breath_from Hz up, ramping in over 2 kHz
        f = np.linspace(0, sr / 2, ap.shape[1])
        w = np.clip((f - breath_from) / 2000, 0, 1) if breath_from else np.ones_like(f)
        ap = ap + breath * (1 - ap) * np.where(voiced, 1.0, 0.4)[:, None] * w[None, :]
    # croak: the end of each voiced run sinks and rattles
    if fry:
        i = 0
        while i < n:
            if not voiced[i]:
                i += 1
                continue
            j = i
            while j < n and voiced[j]:
                j += 1
            L = j - i
            if L * FP > 220:
                m = int(min(L * 0.35, (90 + 160 * fry) / FP))
                ramp = np.linspace(0, 1, m)
                g[j - m:j] *= 1 - (0.45 * fry) * ramp
                g[j - m:j] *= 1 + 0.08 * fry * rng.standard_normal(m)
                ap[j - m:j] = ap[j - m:j] + (0.5 * fry * ramp)[:, None] * (1 - ap[j - m:j])
            i = j
    g = np.where(voiced, np.clip(g, 62, 900), 0)  # very low pitches turn buzzy: keep above 62 Hz
    ap = np.clip(ap, 0.001, 0.999)
    # vocal tract: warp the spectral envelope along frequency
    if formant != 1.0:
        bins = sp.shape[1]
        src = np.arange(bins) / formant
        i0 = np.clip(np.floor(src).astype(int), 0, bins - 1)
        i1 = np.clip(i0 + 1, 0, bins - 1)
        w = np.clip(src - i0, 0, 1)
        sp = sp[:, i0] * (1 - w) + sp[:, i1] * w
        sp = np.maximum(sp, 1e-16)
    out = pw.synthesize(g, np.ascontiguousarray(sp), np.ascontiguousarray(ap), sr, FP)
    if whisper:
        wsp = pw.synthesize(g, np.ascontiguousarray(sp), np.full_like(ap, 0.999), sr, FP)
        d = int(sr * 0.014)
        wsp = np.concatenate([np.zeros(d), wsp])[: len(out)]
        out = out + whisper * 0.7 * wsp
    if sub:
        low = pw.synthesize(np.where(voiced, g * 0.5, 0), np.ascontiguousarray(sp), np.ascontiguousarray(ap), sr, FP)
        out = out + sub * low[: len(out)]
    return out.astype(np.float32)

def finish(y, sr, chain=None, rms_db=-20.0, peak=0.89):
    if chain:
        with tempfile.TemporaryDirectory() as d:
            sf.write(f'{d}/in.wav', y.astype(np.float32), sr, subtype='FLOAT')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/in.wav', '-af', chain, '-ar', str(sr), '-ac', '1', '-c:a', 'pcm_f32le', f'{d}/out.wav'], check=True)
            y, _ = sf.read(f'{d}/out.wav', dtype='float32')
    # even loudness: measured over the louder half of 20 ms windows (the speech, not the pauses)
    win = int(sr * 0.02)
    if len(y) > win * 4:
        frames = y[: len(y) // win * win].reshape(-1, win)
        e = np.sqrt((frames ** 2).mean(axis=1))
        speech = np.sort(e)[len(e) // 2:]
        rms = float(np.sqrt((speech ** 2).mean())) or 1e-6
        y = y * (10 ** (rms_db / 20) / rms)
    p = float(np.max(np.abs(y))) or 1.0
    if p > peak:
        y = y * (peak / p)
    # fade the very ends so no clip starts or stops with a click
    f = min(len(y) // 4, int(sr * 0.008))
    if f > 0:
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
    return y

def trim(s, sr, thresh=0.01, keep=0.03):
    """Cut the silence the voice model leaves at both ends of a phrase."""
    a = np.abs(s)
    idx = np.where(a > thresh * max(a.max(), 1e-6) * 3)[0]
    if not len(idx):
        return s
    k = int(sr * keep)
    return s[max(0, idx[0] - k): idx[-1] + k]

def phrases(k, style, speed, text, sr, commas=False, gap=0.14, comma_gap=0.16):
    """Speak a passage phrase by phrase with even, controlled pauses between them."""
    import re
    parts = re.split(r'(?<=[.!?;:,])\s+' if commas else r'(?<=[.!?;:])\s+', text)
    out = []
    for c in parts:
        if not c.strip():
            continue
        y, _ = k.create(c, voice=style, speed=speed, lang='en-gb')
        out += [trim(y, sr), np.zeros(int(sr * (comma_gap if c.rstrip().endswith(',') else gap)), dtype=np.float32)]
    return np.concatenate(out[:-1]) if out else np.zeros(sr // 2, dtype=np.float32)
