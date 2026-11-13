"""The score: five cues for the stage, composed here as MIDI and played by FluidSynth
with the FluidR3 GM sound font (MIT licence). Scottish modes, a lament fiddle, pipes and
drums, choir and strings. Writes assets/music/<cue>.json (base64 MP3, stereo).
usage: python3 compose.py <game folder> [cue ...]
"""
import sys, os, json, base64, subprocess, random, tempfile
import mido

GAME = sys.argv[1]
ONLY = set(sys.argv[2:])
SF2 = '/usr/share/sounds/sf2/FluidR3_GM.sf2'
NOTES = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}
def n(name):
    # 'D4', 'F#5', 'Bb3'
    p = NOTES[name[0]]
    i = 1
    if name[i] in '#b':
        p += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + p

class Score:
    def __init__(self, bpm, seed=1):
        self.bpm = bpm
        self.ev = []  # (beat, kind, ch, a, b)
        self.r = random.Random(seed)
    def prog(self, ch, program, vol=100, rev=70, pan=64, chorus=20):
        self.ev += [(0, 'prog', ch, program, 0), (0, 'cc', ch, 7, vol), (0, 'cc', ch, 91, rev), (0, 'cc', ch, 10, pan), (0, 'cc', ch, 93, chorus)]
    def note(self, ch, beat, dur, pitch, vel=80, human=0.02):
        if isinstance(pitch, str):
            pitch = n(pitch)
        j = self.r.uniform(-human, human) if human else 0
        v = max(1, min(127, int(vel + self.r.uniform(-6, 6))))
        self.ev.append((max(0, beat + j), 'on', ch, pitch, v))
        self.ev.append((beat + j + dur, 'off', ch, pitch, 0))
    def chord(self, ch, beat, dur, pitches, vel=70, roll=0.0):
        for i, p in enumerate(pitches):
            self.note(ch, beat + i * roll, dur, p, vel)
    def cc(self, ch, beat, ctl, val):
        self.ev.append((beat, 'cc', ch, ctl, int(val)))
    def swell(self, ch, beat, dur, a, b, steps=16, ctl=11):
        for i in range(steps + 1):
            self.cc(ch, beat + dur * i / steps, ctl, a + (b - a) * i / steps)
    def save(self, path):
        mid = mido.MidiFile(ticks_per_beat=480)
        tr = mido.MidiTrack()
        mid.tracks.append(tr)
        tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(self.bpm)))
        order = {'prog': 0, 'cc': 1, 'off': 2, 'on': 3}
        last = 0
        for beat, kind, ch, a, b in sorted(self.ev, key=lambda e: (e[0], order[e[1]])):
            t = int(round(beat * 480))
            dt = max(0, t - last)
            last = max(last, t)
            if kind == 'prog':
                tr.append(mido.Message('program_change', channel=ch, program=a, time=dt))
            elif kind == 'cc':
                tr.append(mido.Message('control_change', channel=ch, control=a, value=max(0, min(127, b)), time=dt))
            elif kind == 'on':
                tr.append(mido.Message('note_on', channel=ch, note=a, velocity=b, time=dt))
            else:
                tr.append(mido.Message('note_off', channel=ch, note=a, velocity=0, time=dt))
        mid.save(path)

def grace(s, ch, beat, main, up, vel):
    # the quick upper grace note of Scottish fiddle and pipe playing
    s.note(ch, beat - 0.07, 0.07, up, vel - 15, human=0)

# ---------------------------------------------------------------- the heath at night
def heath():
    s = Score(56, seed=11)
    BASS, STR, HARP, FID, CELLO = 0, 1, 2, 3, 4
    s.prog(BASS, 43, 92, 90, 60)      # contrabass
    s.prog(STR, 49, 78, 100, 64)      # slow strings
    s.prog(HARP, 46, 82, 95, 76)      # harp
    s.prog(FID, 110, 92, 110, 58)     # fiddle
    s.prog(CELLO, 42, 70, 90, 50)     # cello
    chords = [('D', ['D3', 'A3', 'D4', 'F4']), ('D', ['D3', 'A3', 'C4', 'F4']), ('C', ['C3', 'G3', 'C4', 'E4']), ('C', ['C3', 'G3', 'E4', 'G4']),
              ('Bb', ['Bb2', 'F3', 'D4', 'F4']), ('Bb', ['Bb2', 'F3', 'Bb3', 'D4']), ('C', ['C3', 'G3', 'C4', 'E4']), ('A', ['A2', 'E3', 'A3', 'C4'])]
    bars = 24
    for b in range(bars):
        root, ch = chords[b % 8]
        t = b * 4
        s.note(BASS, t, 4.1, root + ('1' if root in ('A', 'Bb') else '2'), 62)
        s.chord(STR, t, 4.2, ch, 46 + (8 if b % 8 in (3, 7) else 0))
        s.swell(STR, t, 4, 70, 100 if b % 2 == 0 else 80, 8)
        if b % 2 == 1 or b >= 8:
            # the harp picks out the chord, rising
            arp = ch[1:] + [ch[2][:-1] + str(int(ch[2][-1]) + 1)]
            for i, p in enumerate(arp):
                s.note(HARP, t + i * 0.5 + (2 if b % 2 else 0), 2.5, p, 54 - i * 3)
    # the lament, first on the cello, then the fiddle above it
    A = [('D5', 2), ('F5', 1), ('G5', 1), ('A5', 3), ('G5', .5), ('F5', .5), ('G5', 1.5), ('F5', .5), ('D5', 1), ('C5', 1), ('D5', 4)]
    B = [('A5', 1), ('C6', 1), ('D6', 2), ('C6', 1), ('A5', 1), ('G5', 1), ('F5', 1), ('G5', 2), ('A5', 1), ('F5', 1), ('D5', 4)]
    def play(ch, start, phrase, octave=0, vel=70, graces=True):
        t = start
        for p, d in phrase:
            pitch = n(p) + 12 * octave
            if graces and d >= 2 and s.r.random() < 0.6:
                grace(s, ch, t, pitch, pitch + 2, vel)
            s.note(ch, t, d * 0.97, pitch, vel + (6 if d >= 2 else 0))
            t += d
        return t
    play(CELLO, 4 * 4, A, -2, 64, False)
    play(CELLO, 8 * 4, B, -2, 60, False)
    play(FID, 12 * 4, A, 0, 72)
    play(FID, 16 * 4, B, 0, 74)
    play(FID, 20 * 4, A, 0, 66)
    s.swell(FID, 20 * 4, 16, 100, 60, 16)
    return s, bars * 4

# ---------------------------------------------------------------- the weird sisters
def witches():
    s = Score(60, seed=23)
    TREM, CHOIR, LOW, CEL, TIMP, PIZZ = 0, 1, 2, 3, 4, 5
    s.prog(TREM, 44, 80, 110, 40)     # tremolo strings
    s.prog(CHOIR, 52, 78, 120, 80)    # choir aahs
    s.prog(LOW, 43, 96, 90, 64)       # contrabass
    s.prog(CEL, 8, 64, 127, 100)      # celesta, far off
    s.prog(TIMP, 47, 92, 100, 64)     # timpani
    s.prog(PIZZ, 45, 74, 90, 30)      # pizzicato
    beats = 72
    for t in range(0, beats, 8):
        s.note(LOW, t, 8.2, 'D1', 70)
        s.chord(TREM, t, 8.1, ['D3', 'Eb3', 'A3'], 48)
        s.swell(TREM, t, 8, 50, 110, 12)
    # the sisters' choir: slow clusters that will not resolve
    clusters = [['D4', 'Eb4', 'Ab4'], ['C4', 'D4', 'Ab4'], ['Bb3', 'Eb4', 'A4'], ['D4', 'Eb4', 'G#4', 'A4']]
    for i, t in enumerate(range(8, beats - 8, 8)):
        s.chord(CHOIR, t, 7.5, clusters[i % 4], 56, roll=0.4)
        s.swell(CHOIR, t, 7.5, 40, 105, 10)
    # bells, like charms being counted
    for t in range(4, beats - 4, 3):
        if s.r.random() < 0.55:
            s.note(CEL, t + s.r.choice([0, 0.5, 1.25]), 1.5, s.r.choice(['D6', 'Eb6', 'A6', 'Ab6', 'D7']), 40)
    # a heartbeat in the pizzicato, uneven
    t = 2
    while t < beats - 4:
        s.note(PIZZ, t, 0.4, s.r.choice(['D2', 'Eb2', 'A1']), 70)
        t += s.r.choice([1.5, 2, 2.5, 3])
    # timpani: rolls that swell and stop
    for t0 in (15, 39, 63):
        for k in range(16):
            s.note(TIMP, t0 + k * 0.125, 0.15, 'D2', 30 + k * 4, human=0.01)
        s.note(TIMP, t0 + 2, 2, 'A1', 100)
    return s, beats

# ---------------------------------------------------------------- the Old Man's hearth
def hearth():
    s = Score(66, seed=37)
    HARP, CELLO, STR, BASS = 0, 1, 2, 3
    s.prog(HARP, 46, 88, 90, 70)
    s.prog(CELLO, 42, 84, 95, 54)
    s.prog(STR, 48, 60, 100, 64)
    s.prog(BASS, 43, 70, 80, 64)
    # G major, a lilting 6/8 (in quarter-beat units: 3 beats a half bar)
    prog = [['G2', 'D3', 'B3', 'D4'], ['E2', 'B2', 'G3', 'B3'], ['C2', 'G2', 'E3', 'G3'], ['D2', 'A2', 'F#3', 'A3'],
            ['G2', 'D3', 'B3', 'D4'], ['C2', 'G2', 'E3', 'C4'], ['A1', 'E2', 'C3', 'E3'], ['D2', 'A2', 'D3', 'F#3']]
    bars = 20
    for b in range(bars):
        ch = prog[b % 8]
        t = b * 6
        s.note(BASS, t, 6, ch[0], 52)
        s.chord(STR, t, 6.1, ch[2:] + [ch[2][:-1] + str(int(ch[2][-1]) + 1)], 38)
        pat = [ch[1], ch[2], ch[3], ch[2], ch[3], ch[2][:-1] + str(int(ch[2][-1]) + 1)]
        for i, p in enumerate(pat):
            s.note(HARP, t + i, 1.6, n(p) + 12, 58 if i == 0 else 46)
    mel = [('B4', 2), ('A4', 1), ('G4', 2), ('D4', 1), ('E4', 3), ('G4', 3), ('A4', 2), ('B4', 1), ('C5', 2), ('A4', 1), ('D5', 6),
           ('B4', 2), ('A4', 1), ('G4', 2), ('E4', 1), ('C5', 3), ('B4', 2), ('A4', 1), ('G4', 2), ('A4', 1), ('F#4', 2), ('D4', 1), ('G4', 6)]
    for start in (12, 72):
        t = start
        for p, d in mel:
            s.note(CELLO, t, d * 0.97, n(p) - 12, 66 + (6 if d >= 3 else 0))
            t += d
    return s, bars * 6

# ---------------------------------------------------------------- the training yard: pipes and drums
def yard():
    s = Score(96, seed=41)
    PIPE, DRONE, DRUM = 0, 1, 9
    s.prog(PIPE, 109, 88, 60, 64)     # bagpipe chanter
    s.prog(DRONE, 109, 58, 60, 64)    # the drones (bagpipe holding the low A and its fifth)
    beats = 128  # 2/4 march: 64 bars
    s.note(DRONE, 0, beats + 1, 'A2', 64, human=0)
    s.note(DRONE, 0, beats + 1, 'A3', 52, human=0)
    s.note(DRONE, 0, beats + 1, 'E3', 40, human=0)
    # a pipe tune in A mixolydian, the bagpipe's own scale
    a = ['A4', 'A4', 'C#5', 'E5', 'F#5', 'E5', 'C#5', 'A4', 'B4', 'B4', 'D5', 'F#5', 'E5', 'C#5', 'B4', 'G4',
         'A4', 'A4', 'C#5', 'E5', 'F#5', 'A5', 'G5', 'E5', 'F#5', 'E5', 'C#5', 'B4', 'A4', 'A4', 'A4', 'A4']
    b = ['E5', 'F#5', 'G5', 'A5', 'G5', 'E5', 'C#5', 'E5', 'D5', 'B4', 'G4', 'B4', 'D5', 'E5', 'F#5', 'D5',
         'E5', 'F#5', 'G5', 'A5', 'G5', 'E5', 'C#5', 'A4', 'B4', 'D5', 'C#5', 'B4', 'A4', 'A4', 'A4', 'A4']
    def tune(start, notes):
        # dotted rhythm: long-short pairs (the march's swagger)
        t = start
        for i, p in enumerate(notes):
            d = 0.75 if i % 2 == 0 else 0.25
            if notes[i:i + 4] == ['A4'] * 4 and i % 4 == 0:
                s.note(PIPE, t, 1.95, p, 96)
                t += 2
                break
            if i % 4 == 0:
                grace(s, PIPE, t, n(p), n('G5'), 90)  # the piper's G-grace
            s.note(PIPE, t, d * 0.92, p, 92)
            t += d
        return t
    t = 4
    while t < beats - 8:
        t = tune(t, a)
        t = tune(t, a)
        t = tune(t, b)
        t = tune(t, a)
    # pipe-band drums: a side drum's rolls and flams, a bass drum on the beat
    for bar in range(beats // 2):
        t0 = bar * 2
        s.note(DRUM, t0, 0.2, 36, 92 if bar % 2 == 0 else 74)
        s.note(DRUM, t0 + 1, 0.2, 36, 64)
        if bar % 4 == 3:
            for k in range(12):
                s.note(DRUM, t0 + k / 6, 0.05, 38, 50 + k * 5, human=0.005)
        else:
            for k, (o, v) in enumerate([(0, 96), (0.75, 70), (1, 88), (1.5, 72), (1.75, 64)]):
                s.note(DRUM, t0 + o - 0.03, 0.03, 38, 40, human=0)
                s.note(DRUM, t0 + o, 0.1, 38, v, human=0.008)
    return s, beats

# ---------------------------------------------------------------- the prophecy
def prophecy():
    s = Score(72, seed=53)
    OST, CHOIR, HORN, TIMP, BASS, HIGH = 0, 1, 2, 3, 4, 5
    s.prog(OST, 48, 84, 85, 50)
    s.prog(CHOIR, 52, 84, 115, 80)
    s.prog(HORN, 60, 90, 100, 70)
    s.prog(TIMP, 47, 96, 95, 64)
    s.prog(BASS, 43, 96, 85, 64)
    s.prog(HIGH, 49, 70, 110, 90)
    beats = 96
    # a restless ostinato in the low strings: D and E-flat, never at peace
    for t in range(0, beats, 2):
        lvl = 50 + int(40 * t / beats)
        for k, p in enumerate(['D3', 'D3', 'Eb3', 'D3']):
            s.note(OST, t + k * 0.5, 0.45, p, lvl + (10 if k == 0 else 0), human=0.008)
        if t % 8 == 0:
            s.note(BASS, t, 8.1, 'D2', 70)
    # horns: the crown's motif, rising each time
    motif = [('D4', 2), ('A4', 1), ('Bb4', 3), ('A4', 2)]
    for i, start in enumerate((16, 40, 64)):
        t = start
        for p, d in motif:
            s.note(HORN, t, d * 0.95, n(p) + (i * 2 if i < 2 else 5), 70 + i * 12)
            t += d
    # the choir rises underneath
    for t, ch in ((8, ['D4', 'A4']), (24, ['D4', 'Bb4']), (40, ['Eb4', 'Bb4', 'D5']), (56, ['D4', 'A4', 'D5']), (72, ['G4', 'Bb4', 'D5', 'G5'])):
        s.chord(CHOIR, t, 15.5, ch, 60)
        s.swell(CHOIR, t, 15, 50, 120, 12)
    for t in range(48, beats, 4):
        s.note(HIGH, t, 4.1, s.r.choice(['A5', 'D6', 'Bb5']), 40)
    # timpani on the downbeats, gathering
    for t in range(16, beats, 4):
        s.note(TIMP, t, 0.6, 'D2', 60 + int(50 * t / beats))
        if t >= 64:
            s.note(TIMP, t + 2, 0.6, 'A1', 70)
    s.note(TIMP, beats - 4, 3, 'D2', 120)
    return s, beats

CUES = {'heath': heath, 'witches': witches, 'hearth': hearth, 'yard': yard, 'prophecy': prophecy}
os.makedirs(os.path.join(GAME, 'assets/music'), exist_ok=True)
for name, fn in CUES.items():
    if ONLY and name not in ONLY:
        continue
    s, beats = fn()
    secs = beats * 60 / s.bpm
    with tempfile.TemporaryDirectory() as d:
        s.save(f'{d}/a.mid')
        subprocess.run(['fluidsynth', '-ni', '-q', '-F', f'{d}/a.wav', '-r', '44100', '-g', '0.55',
                        '-o', 'synth.reverb.active=1', '-o', 'synth.reverb.room-size=0.82', '-o', 'synth.reverb.width=0.9', '-o', 'synth.reverb.level=0.7',
                        '-o', 'synth.chorus.active=1', SF2, f'{d}/a.mid'], check=True, capture_output=True)
        # level it, keep 4 s of tail for the loop's crossfade, and encode
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{d}/a.wav', '-t', str(secs + 4),
                        '-af', 'loudnorm=I=-20:TP=-2:LRA=11,afade=t=in:d=0.5', '-ar', '44100', '-ac', '2', '-codec:a', 'libmp3lame', '-b:a', '64k', f'{d}/a.mp3'], check=True)
        data = open(f'{d}/a.mp3', 'rb').read()
        os.makedirs('audition', exist_ok=True)
        open(f'audition/music_{name}.mp3', 'wb').write(data)
    json.dump({'format': 'mp3-base64', 'loop': round(secs, 2), 'mp3': base64.b64encode(data).decode()}, open(os.path.join(GAME, f'assets/music/{name}.json'), 'w'))
    print(name, round(secs, 1), 's', len(data) // 1024, 'KB', flush=True)
