"""Convert the public-domain Moby text of Macbeth (Jon Bosak's XML, via the NLTK
corpus) into the game's play.json: typographic quotes and dashes, title-case
speaker names, inline stage directions such as "Aside" kept apart from the verse.

Shape: {title, source, acts:[{n, scenes:[{n, loc, items:[{dir} | {who, lines:[str | {dir} | {d, t}]}]}]}]}
"""
import xml.etree.ElementTree as ET, json, re, sys

src, out = sys.argv[1], sys.argv[2]
root = ET.parse(src).getroot()

ELIDED = {'tis', 'twas', 'twere', 'twill', 'gainst', 'gins', 'em', 'scape', 'twixt', 'mongst', 'larum', 'tween', 'bout'}

def typo(s):
    s = re.sub(r'\s+', ' ', s).strip()
    s = s.replace('--', '—')
    # opening single quotes: a quote at the start of a word that is not an elision
    def openq(m):
        word = re.match(r"[A-Za-z]+", s[m.end():])
        if word and word.group(0).lower() in ELIDED:
            return m.group(1) + '’'
        return m.group(1) + '‘'
    s = re.sub(r"(^|[\s(—])'(?=[A-Za-z])", openq, s)
    s = s.replace("'", '’')
    return s

def caps(s):
    # ALL-CAPS names to Title Case, keeping small words
    def fix(m):
        w = m.group(0)
        return w if len(w) < 2 else w.capitalize()
    return re.sub(r"\b[A-Z][A-Z']+\b", fix, s)

def text_of(e):
    return ''.join(e.itertext())

def roman(s):
    m = re.match(r'(ACT|SCENE) ([IVXL]+)\.?\s*(.*)', s.strip())
    return m.group(2), m.group(3).strip()

play = {
    'title': 'The Tragedy of Macbeth',
    'source': 'Moby Shakespeare text (public domain), XML markup by Jon Bosak (1999); via the NLTK corpus',
    'acts': [],
}
for act in root.findall('ACT'):
    an, _ = roman(text_of(act.find('TITLE')))
    a = {'n': an, 'scenes': []}
    for sc in act.findall('SCENE'):
        sn, loc = roman(text_of(sc.find('TITLE')))
        s = {'n': sn, 'loc': typo(loc), 'items': []}
        for el in sc:
            if el.tag == 'STAGEDIR':
                s['items'].append({'dir': caps(typo(text_of(el)))})
            elif el.tag == 'SPEECH':
                who = ' and '.join(caps(typo(text_of(x))) for x in el.findall('SPEAKER'))
                lines = []
                for x in el:
                    if x.tag == 'LINE':
                        inner = x.findall('STAGEDIR')
                        if inner:
                            d = '; '.join(caps(typo(text_of(i))) for i in inner)
                            for i in inner:
                                tail = i.tail or ''
                                x.remove(i)
                                x.text = (x.text or '') + tail
                            lines.append({'d': d, 't': typo(text_of(x))})
                        else:
                            lines.append(typo(text_of(x)))
                    elif x.tag == 'STAGEDIR':
                        lines.append({'dir': caps(typo(text_of(x)))})
                s['items'].append({'who': who, 'lines': lines})
        a['scenes'].append(s)
    play['acts'].append(a)

json.dump(play, open(out, 'w'), ensure_ascii=False, separators=(',', ':'))
import os
print(os.path.getsize(out), 'bytes')
whos = sorted({it['who'] for a in play['acts'] for s in a['scenes'] for it in s['items'] if 'who' in it})
print(whos)
