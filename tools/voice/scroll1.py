"""The Old Man's first scroll, read aloud in his voice (same casting as tools/voice/act1.py).
usage: python3 scroll1.py <game folder>   (needs the Kokoro model files in the working folder)
"""
import sys, json, base64, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from vox import age, finish, phrases

GAME = sys.argv[1]
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
SR = 24000
style = k.get_voice_style('bm_george') * 0.65 + k.get_voice_style('bm_daniel') * 0.35
SHAPE = dict(f0=0.95, formant=0.98, jitter=0.008, tremor=(5.0, 0.008), breath=0.28, fry=0.1)
CHAIN = 'highpass=f=60,equalizer=f=150:t=q:w=1:g=1,equalizer=f=320:t=q:w=1:g=-1.5,equalizer=f=2500:t=h:w=1:g=3.5,aecho=0.8:0.35:32|64:0.09|0.05'
PARTS = [
    "My lord. The battle is won, and the king will hear of your courage. But the night is not done with you yet... and the heath is no place for a careless man. Heed an old man's counsel.",
    "Gather three stones from the heath. A stone thrown true has felled better men than you.",
    "Take up the spear that leans against the eastern standing stone.",
    "Find the healer's tonic by the northern stone, and keep it for the hour you bleed.",
    "Ready your sword, and feel its weight.",
    "Then seek the three sisters out on the heath, with Banquo at your side. They have been waiting for you... longer than you know.",
    "Mind the fire. It bites. And when the raven comes again... read what it brings.",
]
out = []
for i, t in enumerate(PARTS):
    out += [phrases(k, style, 0.92, t, SR, commas=True, gap=0.28, comma_gap=0.14), np.zeros(int(SR * (0.8 if i in (0, 5) else 0.5)), dtype=np.float32)]
y = finish(age(np.concatenate(out), SR, **SHAPE), SR, CHAIN)
with tempfile.TemporaryDirectory() as d:
    sf.write(f'{d}/a.wav', y, SR, subtype='FLOAT')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', str(SR), '-ac', '1', f'{d}/a.mp3'], check=True)
    mp3 = base64.b64encode(open(f'{d}/a.mp3', 'rb').read()).decode()
json.dump({'format': 'mp3-base64', 'mp3': mp3}, open(f'{GAME}/assets/voice/scroll_oldman_1.json', 'w'))
print('scroll', round(len(y) / SR, 1), 's')
