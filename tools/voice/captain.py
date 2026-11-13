"""The Captain of the training yard: his lessons (our own words), recorded in a gruff old
soldier's voice, dry and natural like the rest of the cast. Writes assets/voice/yard.json
and assets/text/yard.json (the segments the story director plays).
usage: python3 captain.py <game folder>   (needs the Kokoro model files in the working folder)
"""
import sys, json, os, base64, subprocess, tempfile
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
from vox import finish, speak, MASTER

GAME = sys.argv[1]
k = Kokoro('kokoro-v1.0.onnx', 'voices-v1.0.bin')
SR = 24000
style = k.get_voice_style('bm_lewis') * 0.55 + k.get_voice_style('am_fenrir') * 0.45
CHAIN = 'rubberband=pitch=0.9:formant=preserved,' + MASTER + ',equalizer=f=140:t=q:w=1:g=2.5,equalizer=f=2200:t=q:w=1:g=1.5'

LINES = [
    ('cap.greet', "So. The Thane of Glamis comes to my yard. A fine general you may be, my lord, but steel forgets its master quick. Humour an old soldier. Draw your sword, and show me what you can do to a man of straw."),
    ('cap.light', "Not bad. Not bad at all. Now put your weight behind it. A heavy blow, on the wooden man or the pell. Hold the stroke back, then let it go."),
    ('cap.heavy', "That's the arm I remember from the field. Now the quintain. Strike its shield, and when the sandbag comes round at you, raise your blade and take it."),
    ('cap.bag', "Ha! Block it, my lord, or step aside. The bag forgives. A Norway axe won't."),
    ('cap.block', "Good. You'll live another day. The spear, now. Take one from the rack, stand behind the rope, and put it in the straw."),
    ('cap.gold', "Right in the gold! I'd not like to be the boar that meets that."),
    ('cap.spear', "A boar won't stand still while you take your aim, but that'll do. Now, stones. Fill your pouch from the basket, and break me three of those pots."),
    ('cap.horse', "Ha! Not one pot left whole. One last lesson, my lord. A soldier who can't sit a horse is only half a soldier. Your mare is tied at the rail, just north of the fence. Go to her near side, the left, take up the reins, and up you get."),
    ('cap.mounted', "There. Sit deep, and keep your heels down. Walk her on, then let her canter. Now take her through my flags, every one of them, and in their order."),
    ('cap.gallop', "That's it! Give her her head, my lord! Let her fly!"),
    ('cap.done', "There's nothing more this old man can teach you. Take these for your trouble. Go on, my lord, the heath is waiting. And mind... a good soldier keeps his sword for his enemies."),
    ('cap.again', "Back again, my lord? The straw men are always ready for you."),
]

def mp3(y):
    with tempfile.TemporaryDirectory() as d:
        sf.write(f'{d}/a.wav', y, SR, subtype='FLOAT')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-codec:a', 'libmp3lame', '-b:a', '40k', '-ar', str(SR), '-ac', '1', f'{d}/a.mp3'], check=True)
        return base64.b64encode(open(f'{d}/a.mp3', 'rb').read()).decode()

bank, segs = {}, []
for key, text in LINES:
    y = finish(speak(k, style, 1.0, text, SR, pause=0.4, clause=0.14), SR, CHAIN)
    bank[key] = mp3(y)
    segs.append({'key': key, 'who': 'The Captain', 'lines': [text], 'dur': round(len(y) / SR, 2)})
    print(key, segs[-1]['dur'], flush=True)
json.dump({'format': 'mp3-base64-bank', 'clips': bank}, open(os.path.join(GAME, 'assets/voice/yard.json'), 'w'), separators=(',', ':'))
json.dump({'yard': segs}, open(os.path.join(GAME, 'assets/text/yard.json'), 'w'), ensure_ascii=False, indent=0)
print('wrote yard voices')
