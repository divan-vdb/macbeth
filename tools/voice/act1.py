"""Act I voices: scenes 1.1 and 1.3 in full, the heart of 1.2, and the Old Man's
narration (in our own words). Kokoro-82M (Apache 2.0) voice blends, shaped with
ffmpeg, encoded as small MP3s and packed as base64 JSON banks that any static
host will serve. Also writes assets/text/act1.json: every segment's speaker, text,
Folio item and length, which the story director plays.

usage: python3 act1.py <play.json> <game dir> [part ...]
Needs: pip install kokoro-onnx soundfile numpy; ffmpeg; kokoro-v1.0.onnx and voices-v1.0.bin
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

ROOM = 'aecho=0.8:0.5:28|61:0.11|0.06'
CAST = {
    # the Old Man: deep, slow, a little unsteady, close by the fire
    'narrator': (blend(('bm_george', 0.7), ('bm_daniel', 0.3)), 0.82,
                 'asetrate=24000*0.92,aresample=24000,atempo=1.02,vibrato=f=4.5:d=0.06,equalizer=f=140:t=q:w=1:g=3,equalizer=f=3200:t=q:w=1.5:g=-2,lowpass=f=7500,aecho=0.8:0.6:45|90:0.18|0.1,volume=1.4'),
    # the Weird Sisters: three different crones, all with something unnatural in the air round them
    'witch1': (blend(('bf_alice', 1.0)), 0.9,
               'asetrate=24000*0.86,aresample=24000,atempo=1.1,vibrato=f=6:d=0.15,highpass=f=180,aecho=0.8:0.7:120|260:0.35|0.2,volume=1.3'),
    'witch2': (blend(('af_nicole', 0.6), ('bf_lily', 0.4)), 0.88,
               'asetrate=24000*0.8,aresample=24000,atempo=1.18,tremolo=f=7:d=0.25,highpass=f=150,lowpass=f=6000,aecho=0.8:0.6:90|200:0.3|0.18,volume=1.6'),
    'witch3': (blend(('bf_isabella', 0.7), ('af_sky', 0.3)), 0.85,
               'asetrate=24000*0.93,aresample=24000,atempo=1.04,vibrato=f=3.5:d=0.3,highpass=f=220,aecho=0.8:0.7:150|330:0.32|0.22,volume=1.3'),
    # Macbeth: a soldier's weight, darkened; his asides are an inner voice, close and echoing
    'macbeth': (blend(('bm_lewis', 0.6), ('bm_fable', 0.4)), 0.9,
                'asetrate=24000*0.95,aresample=24000,atempo=1.04,equalizer=f=120:t=q:w=1:g=3,lowpass=f=8000,' + ROOM + ',volume=1.2'),
    'macbeth_aside': (blend(('bm_lewis', 0.6), ('bm_fable', 0.4)), 0.84,
                      'asetrate=24000*0.94,aresample=24000,atempo=1.04,equalizer=f=120:t=q:w=1:g=4,lowpass=f=5200,aecho=0.8:0.85:60|140|260:0.4|0.26|0.14,volume=1.1'),
    # Banquo: warm, steady, a touch younger and plainer than Macbeth
    'banquo': (blend(('bm_daniel', 0.55), ('am_michael', 0.45)), 0.92,
               'asetrate=24000*0.98,aresample=24000,atempo=1.02,equalizer=f=200:t=q:w=1:g=2,lowpass=f=8500,' + ROOM + ',volume=1.2'),
    # Ross: a quick, bright messenger; Angus: older, gravelled
    'ross': (blend(('bm_fable', 0.6), ('am_liam', 0.4)), 1.0,
             'equalizer=f=2500:t=q:w=1:g=2,lowpass=f=9000,' + ROOM + ',volume=1.2'),
    'angus': (blend(('bm_george', 0.55), ('am_onyx', 0.45)), 0.88,
              'asetrate=24000*0.9,aresample=24000,atempo=1.08,equalizer=f=150:t=q:w=1:g=3,lowpass=f=7000,' + ROOM + ',volume=1.3'),
    # Duncan: an old, gentle king in his tent; the Sergeant: wounded, short of breath
    'duncan': (blend(('am_santa', 0.5), ('bm_daniel', 0.5)), 0.88,
               'asetrate=24000*0.94,aresample=24000,atempo=1.04,lowpass=f=7500,aecho=0.8:0.6:40|80:0.15|0.08,volume=1.2'),
    'sergeant': (blend(('am_fenrir', 0.6), ('bm_daniel', 0.4)), 0.9,
                 'tremolo=f=5:d=0.2,lowpass=f=6500,' + ROOM + ',volume=1.3'),
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
    style, speed, chain = CAST[voice]
    pieces = []
    for c in chunks(spoken(text)):
        s, sr = k.create(c, voice=style, speed=speed, lang='en-gb')
        pieces += [s, np.zeros(int(SR * 0.22), dtype=s.dtype)]
    raw = np.concatenate(pieces[:-1]) if pieces else np.zeros(SR // 2, dtype=np.float32)
    with tempfile.TemporaryDirectory() as d:
        sf.write(f'{d}/in.wav', raw, SR)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/in.wav', '-af', chain, '-ar', str(SR), '-ac', '1', f'{d}/out.wav'], check=True)
        y, _ = sf.read(f'{d}/out.wav', dtype='float32')
    return y

def mp3(y):
    peak = float(np.max(np.abs(y))) or 1.0
    if peak > 0.97:
        y = y * (0.97 / peak)
    with tempfile.TemporaryDirectory() as d:
        sf.write(f'{d}/a.wav', y, SR)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-codec:a', 'libmp3lame', '-b:a', '32k', '-ar', str(SR), '-ac', '1', f'{d}/a.mp3'], check=True)
        return base64.b64encode(open(f'{d}/a.mp3', 'rb').read()).decode()

def render(voice, text):
    if voice == 'all':  # the three sisters together, a breath apart
        ys = [synth(v, text) for v in ('witch1', 'witch2', 'witch3')]
        n = max(len(y) for y in ys) + int(SR * 0.09)
        mix = np.zeros(n, dtype=np.float32)
        for i, y in enumerate(ys):
            o = int(SR * 0.035 * i)
            mix[o:o + len(y)] += y * 0.62
        return mix
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
        y = render(voice, ' '.join(s['lines']))
        s['dur'] = round(len(y) / SR, 2)
        bank[s['key']] = mp3(y)
        print(part, s['key'], s['who'], s['dur'], flush=True)
    path = os.path.join(GAME, f'assets/voice/{part}.json')
    json.dump({'format': 'mp3-base64-bank', 'clips': bank}, open(path, 'w'), separators=(',', ':'))
    manifest[part] = PARTS[part]
    json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False, indent=0)
    print('wrote', path, os.path.getsize(path), flush=True)
