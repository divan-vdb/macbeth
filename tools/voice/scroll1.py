"""The Old Man's first scroll, read aloud in his voice (same casting as tools/voice/act1.py).
usage: python3 scroll1.py <game folder>   (needs the Kokoro model files in the working folder)
"""
import sys, json, base64, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from vox import finish, speak, MASTER

GAME = sys.argv[1]
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
SR = 24000
style = k.get_voice_style('bm_george') * 0.65 + k.get_voice_style('bm_daniel') * 0.35
CHAIN = MASTER + ',equalizer=f=160:t=q:w=1:g=1.5,equalizer=f=320:t=q:w=1:g=-1.5,equalizer=f=2600:t=h:w=1:g=2'
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
    out += [speak(k, style, 0.9, t, SR, pause=0.5, clause=0.16), np.zeros(int(SR * (0.8 if i in (0, 5) else 0.55)), dtype=np.float32)]
y = finish(np.concatenate(out), SR, CHAIN)
with tempfile.TemporaryDirectory() as d:
    sf.write(f'{d}/a.wav', y, SR, subtype='FLOAT')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', str(SR), '-ac', '1', f'{d}/a.mp3'], check=True)
    mp3 = base64.b64encode(open(f'{d}/a.mp3', 'rb').read()).decode()
json.dump({'format': 'mp3-base64', 'mp3': mp3}, open(f'{GAME}/assets/voice/scroll_oldman_1.json', 'w'))
print('scroll', round(len(y) / SR, 1), 's')
