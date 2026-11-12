"""Act I voices: scenes 1.1 and 1.3 in full, the heart of 1.2, and the Old Man's
narration (in our own words). Kokoro-82M (Apache 2.0) voice blends, aged and shaped with
the WORLD vocoder (vox.py) and ffmpeg, encoded as small MP3s and packed as base64 JSON banks that any static
host will serve. Also writes assets/text/act1.json: every segment's speaker, text,
Folio item and length, which the story director plays.

usage: python3 act1.py <play.json> <game dir> [part ...]
Needs: pip install kokoro-onnx soundfile numpy pyworld; ffmpeg; kokoro-v1.0.onnx and voices-v1.0.bin
(from the kokoro-onnx releases on GitHub) in the working folder.
"""
import json, os, re, subprocess, sys, base64, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

PLAY, GAME = sys.argv[1], sys.argv[2]
ONLY = set(sys.argv[3:])
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
SR = 24000

def blend(*pairs):
    return sum(k.get_voice_style(v) * w for v, w in pairs)

from vox import age, finish, phrases

ROOM = 'aecho=0.8:0.45:28|61:0.1|0.05'
WITCH_ROOM = 'highpass=f=90,equalizer=f=250:t=q:w=1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2,aecho=0.8:0.55:70|150|240:0.22|0.14|0.08'
# voice: (Kokoro blend, speed, WORLD shaping, ffmpeg EQ and room). Speeds are conversational;
# WORLD changes pitch and timbre without slowing the words.
CAST = {
    # the Old Man: a warm, steady, well-spoken elderly British storyteller, calm and authoritative
    'narrator': (blend(('bm_george', 0.65), ('bm_daniel', 0.35)), 0.92,
                 dict(f0=0.95, formant=0.98, jitter=0.008, tremor=(5.0, 0.008), breath=0.28, fry=0.1),
                 'highpass=f=60,equalizer=f=150:t=q:w=1:g=1,equalizer=f=320:t=q:w=1:g=-1.5,equalizer=f=2500:t=h:w=1:g=3.5,aecho=0.8:0.35:32|64:0.09|0.05'),
    # the Weird Sisters, old hags all: the Ancient Crone (low, gravelly, slow and deliberate, a whispered
    # double under her words); the croaking one with a growl beneath; the thin, wavering, eerie one
    'witch1': (blend(('bf_emma', 0.6), ('bf_alice', 0.4)), 1.0,
               dict(f0=0.62, range=1.75, creak=0.5, formant=0.96, jitter=0.02, tremor=(6.0, 0.022), breath=0.5, breath_from=900, fry=0.7, whisper=0.1),
               'highpass=f=70,equalizer=f=180:t=q:w=1:g=2,equalizer=f=4500:t=h:w=1:g=-4,aecho=0.8:0.4:55|120:0.12|0.06'),
    'witch2': (blend(('af_nicole', 0.5), ('bf_lily', 0.5)), 0.92,
               dict(f0=0.72, formant=0.98, jitter=0.05, tremor=(5.0, 0.03), breath=0.45, fry=0.75, whisper=0.3, sub=0.12), WITCH_ROOM),
    'witch3': (blend(('bf_isabella', 0.7), ('af_sky', 0.3)), 0.92,
               dict(f0=0.86, formant=1.08, jitter=0.03, tremor=(4.2, 0.065), breath=0.38, fry=0.35, whisper=0.35), WITCH_ROOM),
    # Macbeth: a soldier's weight; his asides an inner voice, close, breathy and echoing
    'macbeth': (blend(('bm_lewis', 0.6), ('bm_fable', 0.4)), 1.0,
                dict(f0=0.94, formant=0.97, jitter=0.004, breath=0.04),
                'highpass=f=70,equalizer=f=130:t=q:w=1:g=3,' + ROOM),
    'macbeth_aside': (blend(('bm_lewis', 0.6), ('bm_fable', 0.4)), 0.95,
                      dict(f0=0.93, formant=0.97, jitter=0.004, breath=0.12, whisper=0.15),
                      'highpass=f=70,equalizer=f=130:t=q:w=1:g=4,lowpass=f=6000,aecho=0.8:0.8:60|140|260:0.35|0.22|0.12'),
    'banquo': (blend(('bm_daniel', 0.55), ('am_michael', 0.45)), 1.0,
               dict(f0=0.98), 'highpass=f=70,equalizer=f=200:t=q:w=1:g=2,' + ROOM),
    'ross': (blend(('bm_fable', 0.6), ('am_liam', 0.4)), 1.05, None, 'highpass=f=70,equalizer=f=2500:t=q:w=1:g=2,' + ROOM),
    'angus': (blend(('bm_george', 0.55), ('am_onyx', 0.45)), 0.97,
              dict(f0=0.9, formant=0.96, jitter=0.01, breath=0.08), 'highpass=f=60,equalizer=f=150:t=q:w=1:g=3,' + ROOM),
    'duncan': (blend(('am_santa', 0.5), ('bm_daniel', 0.5)), 0.95,
               dict(f0=0.94, jitter=0.012, tremor=(5.0, 0.01), breath=0.1), 'highpass=f=60,aecho=0.8:0.55:40|80:0.14|0.07'),
    'sergeant': (blend(('am_fenrir', 0.6), ('bm_daniel', 0.4)), 0.95,
                 dict(jitter=0.02, tremor=(6.0, 0.02), breath=0.2), 'highpass=f=70,' + ROOM),
}
WHO = {'First Witch': 'witch1', 'Second Witch': 'witch2', 'Third Witch': 'witch3', 'Macbeth': 'macbeth', 'Banquo': 'banquo',
       'Ross': 'ross', 'Angus': 'angus', 'Duncan': 'duncan', 'Sergeant': 'sergeant', 'All': 'all', 'The Old Man': 'narrator'}

# ---------- spoken text: modern spellings where the old ones trip the voice, never shown
SAY = [(r"\bGlamis\b", 'Glahmz'), (r"\bForres\b", 'Forris'), (r"Graymalkin", 'Gray-malkin'), (r"hurlyburly", 'hurly-burly'),
       (r"Aroint", 'A-roint'), (r"ronyon", 'runyun'), (r"Norweyan", 'Norway-an'), (r"\bSinel", 'Sinnel'), (r"Colme", 'Colm'),
       (r"\bo' the\b", 'o the'), (r"\b[Ii]' the\b", 'in the'), (r"\bon't\b", 'on it'), (r"\bis't\b", "is it"), (r"Thou'rt", 'Thou art'),
       (r"\bne'er\b", 'nair'), (r"\be'er\b", 'air'), (r"'(tis|Tis|gins|gainst|Gainst)", r'\1'), (r"(\w)'d\b", r'\1ed'),
       (r"\bthane\b", 'thane'), (r"chanced", 'chanced'), (r"\bupon\b", 'upon')]
def spoken(text):
    t = text.replace('’', "'").replace('‘', '').replace('—', ', ')
    for a, b in SAY:
        t = re.sub(a, b, t)
    t = re.sub(r"(^|\s)'", r'\1', t)
    t = re.sub(r"'(\s|$|[,.!?:;])", r'\1', t)
    return re.sub(r'\s+', ' ', t).strip()

def chunks(text, limit=230):
    parts = re.split(r'(?<=[.!?;:])\s+', text)
    out, cur = [], ''
    for p in parts:
        if cur and len(cur) + len(p) > limit:
            out.append(cur)
            cur = p
        else:
            cur = (cur + ' ' + p).strip()
    if cur:
        out.append(cur)
    return out

def synth(voice, text):
    style, speed, shape, chain = CAST[voice]
    # the Ancient Crone weighs every phrase; everyone else speaks at a conversational pace
    slow = voice in ('witch1', 'narrator')
    raw = phrases(k, style, speed, spoken(text), SR, commas=slow, gap=0.28 if voice == 'narrator' else 0.14, comma_gap=0.14 if voice == 'narrator' else 0.2)
    y = age(raw, SR, **shape) if shape else raw
    return finish(y, SR, chain)

def mp3(y):
    with tempfile.TemporaryDirectory() as d:
        sf.write(f'{d}/a.wav', y, SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', str(SR), '-ac', '1', f'{d}/a.mp3'], check=True)
        return base64.b64encode(open(f'{d}/a.mp3', 'rb').read()).decode()

def render(voice, text):
    if voice == 'all':  # the three sisters together, a breath apart
        ys = [synth(v, text) for v in ('witch1', 'witch2', 'witch3')]
        n = max(len(y) for y in ys) + int(SR * 0.09)
        mix = np.zeros(n, dtype=np.float32)
        for i, y in enumerate(ys):
            o = int(SR * 0.035 * i)
            mix[o:o + len(y)] += y * 0.62
        return finish(mix, SR)
    return synth(voice, text)

# ---------- what is spoken
play = json.load(open(PLAY))
def scene(a, s):
    return play['acts'][a - 1]['scenes'][s - 1]
def verse(lines):
    return [l if isinstance(l, str) else l['t'] for l in lines if isinstance(l, str) or 't' in l]

def seg(key, who, lines, item=None, aside=False, scene_id=None):
    return {'key': key, 'who': who, 'lines': lines, 'item': item, 'scene': scene_id, 'aside': aside}

def speeches(a, s, lo, hi, splits={}):
    sc = scene(a, s)
    out = []
    for i in range(lo, hi + 1):
        it = sc['items'][i]
        sid = f'{a}.{s}'
        if 'dir' in it:
            out.append({'key': f'{sid}.{i}', 'dir': it['dir'], 'item': i, 'scene': sid})
            continue
        if i in splits:
            for tag, who, lines, aside in splits[i]:
                out.append(seg(f'{sid}.{i}{tag}', who, lines, i, aside, sid))
        else:
            out.append(seg(f'{sid}.{i}', it['who'], verse(it['lines']), i, False, sid))
    return out

L = lambda a, s, i: verse(scene(a, s)['items'][i]['lines'])
m45, m47 = L(1, 3, 45), L(1, 3, 47)
SPLITS_13 = {
    45: [('a', 'Macbeth', m45[0:2], True), ('b', 'Macbeth', m45[2:3], False), ('c', 'Macbeth', m45[3:], False)],
    47: [('a', 'Macbeth', m47[0:2] + ['Of the imperial theme.'], True), ('b', 'Macbeth', ['I thank you, gentlemen.'], False), ('c', 'Macbeth', m47[3:], True)],
    49: [('', 'Macbeth', L(1, 3, 49), True)],
    51: [('', 'Macbeth', L(1, 3, 51), True)],
}

def fx(key, who, text, say):
    return {'key': key, 'who': who, 'lines': [text], 'fx': True, 'say': say}

def old(key, text):
    return {'key': key, 'who': 'The Old Man', 'lines': [text], 'narration': True}

NARRATION = {
    'open': "Sit closer to the fire, stranger. I am an old man now, and the cold has found my bones. But I remember that night on the heath... when the thunder rolled, and three strange sisters waited for a soldier coming home from war.",
    '11end': "Fair is foul, and foul is fair. Remember those words, stranger. Before this tale is done, you will not know the one from the other... and neither will he.",
    '12a': "Now, while the sisters went about their business, old King Duncan waited in his camp near Forres for news of the battle. A gentle king. Too trusting, some would say. Then a soldier was carried in... bleeding, but with a tale to tell.",
    '12b': "Macdonwald the rebel was dead, opened from belly to jaw by Macbeth's own sword. But then the King of Norway struck with fresh men, and helping him in secret was one of Duncan's own lords: the Thane of Cawdor. Still Macbeth and Banquo held. Then Ross rode in from Fife.",
    '12c': "So the king stripped the traitor of his title, and gave it to Macbeth. But Macbeth knew none of this. He was out on the heath with Banquo, walking home from the slaughter... toward the sisters.",
    'walk': "Banquo. As brave as Macbeth, and the steadier of the two. Mark him well, stranger. The sisters will have a word for him too.",
    '13end': "Two of the sisters' promises came true within the hour. The third was a crown. And did you see how fast the thought of murder came to him? No one had spoken of it. Now, to Forres. The king is waiting to thank him.",
}

sgt = L(1, 2, 3)
ix = next(i for i, l in enumerate(sgt) if l.startswith('For brave Macbeth'))
PARTS = {
    'act1_s11': [old('n.open', NARRATION['open'])] + speeches(1, 1, 0, 11) + [old('n.11end', NARRATION['11end'])],
    'act1_s12': [old('n.12a', NARRATION['12a']),
                 seg('1.2.3b', 'Sergeant', ['…'] + sgt[ix:], 3, False, '1.2'),
                 seg('1.2.4', 'Duncan', L(1, 2, 4), 4, False, '1.2'),
                 old('n.12b', NARRATION['12b']),
                 seg('1.2.12', 'Ross', L(1, 2, 12), 12, False, '1.2'),
                 seg('1.2.13', 'Duncan', L(1, 2, 13), 13, False, '1.2'),
                 seg('1.2.14', 'Ross', L(1, 2, 14), 14, False, '1.2'),
                 seg('1.2.15', 'Duncan', L(1, 2, 15), 15, False, '1.2'),
                 seg('1.2.17', 'Duncan', L(1, 2, 17), 17, False, '1.2'),
                 seg('1.2.18', 'Ross', L(1, 2, 18), 18, False, '1.2'),
                 seg('1.2.19', 'Duncan', L(1, 2, 19), 19, False, '1.2'),
                 old('n.12c', NARRATION['12c'])],
    'act1_s13a': [old('n.walk', NARRATION['walk'])] + speeches(1, 3, 0, 13),
    'act1_s13b': speeches(1, 3, 14, 37),
    'act1_s13c': speeches(1, 3, 38, 56, SPLITS_13) + [old('n.13end', NARRATION['13end'])],
}
def after(lst, key, item):
    i = next(n for n, x in enumerate(lst) if x['key'] == key)
    lst.insert(i + 1, item)
after(PARTS['act1_s11'], '1.1.11', fx('fx.11cackle', 'First Witch', 'cackles', 'Ah, ha ha ha ha haaa!'))
after(PARTS['act1_s13a'], '1.3.4', fx('fx.13cackle1', 'First Witch', 'cackles', 'Heh heh heh heh heh!'))
after(PARTS['act1_s13a'], '1.3.10', fx('fx.13cackle2', 'Second Witch', 'cackles', 'Hee hee hee hee hee!'))
after(PARTS['act1_s13b'], '1.3.30', fx('fx.13vanish', 'All', 'cackling, fading into the air', 'Ah ha ha ha ha ha!'))
ORDER = ['act1_s11', 'act1_s13b', 'act1_s13a', 'act1_s13c', 'act1_s12']

manifest_path = os.path.join(GAME, 'assets/text/act1.json')
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
for part in ORDER:
    if ONLY and part not in ONLY:
        continue
    bank = {}
    for s in PARTS[part]:
        if 'dir' in s:
            continue
        voice = WHO[s['who']]
        if voice == 'macbeth' and s.get('aside'):
            voice = 'macbeth_aside'
        y = render(voice, s['say'] if s.get('fx') else ' '.join(s['lines']))
        s['dur'] = round(len(y) / SR, 2)
        bank[s['key']] = mp3(y)
        print(part, s['key'], s['who'], s['dur'], flush=True)
    path = os.path.join(GAME, f'assets/voice/{part}.json')
    json.dump({'format': 'mp3-base64-bank', 'clips': bank}, open(path, 'w'), separators=(',', ':'))
    manifest[part] = PARTS[part]
    json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False, indent=0)
    print('wrote', path, os.path.getsize(path), flush=True)
