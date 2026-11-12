// The cast, with portrait medallions rendered from each character's 3D model
// as it appears in the game (see src/folio/portraits.js).
import { PORTRAIT_IMAGES } from './portraits.js';

const img = (key, label) => `<img src="${PORTRAIT_IMAGES[key]}" alt="${label}" draggable="false">`;
const PORTRAITS = {
  witch1: img('witch1', 'First Witch'),
  witch2: img('witch2', 'Second Witch'),
  witch3: img('witch3', 'Third Witch'),
};

export const CHARACTERS = {
  'First Witch': {
    portrait: 'witch1',
    name: 'First Witch',
    role: 'One of the three Weird Sisters',
    about:
      'The three Weird Sisters are witches who can see the future and delight in mischief. The First Witch leads their meetings. Her familiar, a spirit that serves her in the shape of an animal, is a grey cat called Graymalkin.',
  },
  'Second Witch': {
    portrait: 'witch2',
    name: 'Second Witch',
    role: 'One of the three Weird Sisters',
    about:
      'The Second Witch answers the First and sets the time of their meeting: when the battle is over. Her familiar is a toad, called Paddock.',
  },
  'Third Witch': {
    portrait: 'witch3',
    name: 'Third Witch',
    role: 'One of the three Weird Sisters',
    about:
      'The Third Witch is the one who speaks Macbeth’s name, so the play’s very first scene ends on him. Her familiar is not named here; in Act IV she calls it Harpier.',
  },
  All: {
    group: ['First Witch', 'Second Witch', 'Third Witch'],
    name: 'All three Witches',
    role: 'Speaking together',
    about: 'The Weird Sisters chant their closing lines in unison, like a spell.',
  },
  Macbeth: {
    mono: ['M', '#7c1616'], name: 'Macbeth', role: 'Thane of Glamis, a general of King Duncan',
    about: 'You. A great soldier, fresh from crushing a rebellion, brave to the point of savagery and loved for it. The sisters’ greeting finds a thought already waiting in him, and his ambition will do the rest.',
  },
  Banquo: {
    mono: ['B', '#3b4a63'], name: 'Banquo', role: 'A general, Macbeth’s friend and fellow captain',
    about: 'As brave as Macbeth, and the steadier of the two. He hears the same prophecies but treats them with suspicion. The sisters promise that his children will be kings.',
  },
  Duncan: {
    mono: ['D', '#8a6d2c'], name: 'Duncan', role: 'King of Scotland',
    about: 'An old, gracious king who rewards loyalty generously and trusts too easily: the last Thane of Cawdor betrayed him, and he gives the title to Macbeth.',
  },
  Malcolm: { mono: ['M', '#6b5a2a'], name: 'Malcolm', role: 'Duncan’s elder son', about: 'The king’s heir. In this scene he greets the Sergeant who once saved him from capture.' },
  Donalbain: { mono: ['D', '#5c4b26'], name: 'Donalbain', role: 'Duncan’s younger son', about: 'Malcolm’s brother. He says little, but his fate is bound up with the crown.' },
  Lennox: { mono: ['L', '#4a5a3a'], name: 'Lennox', role: 'A Scottish nobleman', about: 'A lord at Duncan’s court who watches events closely, and later says aloud what others only suspect.' },
  Ross: {
    mono: ['R', '#1f5a5a'], name: 'Ross', role: 'A Scottish nobleman and messenger',
    about: 'A quick, well-informed thane who carries the news of the play: victory over Norway, and then the title of Cawdor to Macbeth.',
  },
  Angus: { mono: ['A', '#4b4f57'], name: 'Angus', role: 'A Scottish nobleman', about: 'An older lord who rides with Ross to bring the king’s thanks to Macbeth, and explains why the old Thane of Cawdor must die.' },
  Sergeant: {
    mono: ['S', '#6e2a1c'], name: 'The Sergeant', role: 'A wounded soldier', about: 'Carried bleeding from the field, he gives the king the first account of Macbeth in battle: brave, and terrifying.',
  },
  'Lady Macbeth': { mono: ['L', '#6a0e13'], name: 'Lady Macbeth', role: 'Macbeth’s wife', about: 'Waiting at Inverness. You will meet her soon.' },
  'The Old Man': {
    mono: ['✶', '#3b2a1a'], name: 'The Old Man', role: 'Your narrator',
    about: 'He saw it all, and has never stopped telling it. In the play he appears once, in Act II, to speak of a night of unnatural things. Here he sits by the fire and tells you the rest.',
  },
};

export function portraitHTML(speaker) {
  const ch = CHARACTERS[speaker];
  if (!ch) return '<span class="portrait blank" aria-hidden="true"></span>';
  if (ch.mono) return `<span class="portrait mono" style="--c:${ch.mono[1]}" data-char="${speaker}" role="button" tabindex="0" aria-label="About ${ch.name}">${ch.mono[0]}</span>`;
  if (ch.group) {
    return `<span class="portrait trio" data-char="${speaker}" role="button" tabindex="0" aria-label="${ch.name}">${ch.group
      .map((m) => `<span class="mini">${PORTRAITS[CHARACTERS[m].portrait]}</span>`)
      .join('')}</span>`;
  }
  return `<span class="portrait" data-char="${speaker}" role="button" tabindex="0" aria-label="About ${ch.name}">${PORTRAITS[ch.portrait]}</span>`;
}

export function portraitLarge(speaker) {
  const ch = CHARACTERS[speaker];
  if (!ch) return '';
  if (ch.mono) return `<div class="big mono" style="--c:${ch.mono[1]}">${ch.mono[0]}</div>`;
  if (ch.group) return `<div class="big trio">${ch.group.map((m) => `<span class="mini">${PORTRAITS[CHARACTERS[m].portrait]}</span>`).join('')}</div>`;
  return `<div class="big">${PORTRAITS[ch.portrait]}</div>`;
}

// a speaker's small portrait, for the subtitles (same medallions as the Folio)
export function portraitSmall(speaker) {
  const ch = CHARACTERS[speaker];
  if (!ch) return '';
  if (ch.mono) return `<span class="portrait mono" style="--c:${ch.mono[1]}">${ch.mono[0]}</span>`;
  if (ch.group) return `<span class="portrait trio">${ch.group.map((m) => `<span class="mini">${PORTRAITS[CHARACTERS[m].portrait]}</span>`).join('')}</span>`;
  return `<span class="portrait">${PORTRAITS[ch.portrait]}</span>`;
}
