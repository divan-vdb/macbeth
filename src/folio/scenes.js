// Notes for the play's scenes, written for this game in plain modern English.
// The text itself comes from assets/text/play.json (the public-domain Moby text).
// GLOSS lists, per scene, phrases in the text that open a glossary note:
// [phrase as printed, glossary key]. The first match in the scene is marked.

export const NOTES = {
  '1.1': {
    note:
      'The play opens in a storm with the three Weird Sisters. They speak in a chanting rhythm of four strong beats a line, each starting on a stressed syllable, which Shakespeare keeps for magical beings: it sounds like a spell. They plan to meet Macbeth after the battle, and the scene ends the moment his name is spoken, as if he has already been chosen.',
  },
  '1.2': {
    note:
      'A camp near Forres, where King Duncan waits for news. Before we ever meet Macbeth we hear him praised: a wounded sergeant tells how he cut the rebel Macdonwald in two, and Ross brings word of victory over Norway and of the Thane of Cawdor’s treachery. Duncan orders Cawdor’s death and gives his title to Macbeth. Now the audience knows something Macbeth does not, and the next scene plays on that gap.',
  },
  '1.3': {
    note:
      'The heath. The witches boast of their mischief, then wind up a charm as a drum announces Macbeth. They greet him by his own title, by the title he will be given within the hour, and as king hereafter; to Banquo they promise kings for sons. When Ross and Angus arrive to name him Thane of Cawdor, the first prophecy comes true, and in his asides we watch the thought of murder arrive in Macbeth’s mind before anyone has spoken of it.',
  },
};

export const GLOSS = {
  '1.1': [
    ['A desert place', 'desert place'],
    ['hurlyburly', 'hurlyburly'],
    ['ere the set of sun', 'ere the set of sun'],
    ['heath', 'heath'],
    ['Macbeth.', 'macbeth-pause'],
    ['Graymalkin', 'Graymalkin'],
    ['Paddock', 'Paddock'],
    ['Anon', 'Anon'],
    ['Fair is foul, and foul is fair', 'Fair is foul, and foul is fair'],
    ['filthy air', 'filthy air'],
  ],
  '1.2': [
    ['broil', 'broil'],
    ['kerns and gallowglasses', 'kerns and gallowglasses'],
    ['unseam’d him from the nave to the chaps', 'unseamed'],
    ['Golgotha', 'Golgotha'],
    ['Bellona’s bridegroom', 'Bellona'],
    ['present death', 'present death'],
  ],
  '1.3': [
    ['Aroint thee', 'Aroint thee'],
    ['rump-fed ronyon', 'rump-fed ronyon'],
    ['in a sieve', 'sieve'],
    ['like a rat without a tail', 'rat without a tail'],
    ['pilot’s thumb', 'pilot’s thumb'],
    ['The weird sisters', 'weird sisters'],
    ['Posters of the sea and land', 'Posters'],
    ['Thrice to thine', 'Thrice to thine'],
    ['So foul and fair a day', 'So foul and fair a day'],
    ['You should be women', 'should be women'],
    ['thane of Glamis', 'thane of Glamis'],
    ['thane of Cawdor!', 'thane of Cawdor'],
    ['king hereafter', 'king hereafter'],
    ['why do you start', 'why do you start'],
    ['Lesser than Macbeth, and greater', 'Lesser than Macbeth'],
    ['Thou shalt get kings', 'get kings'],
    ['imperfect speakers', 'imperfect speakers'],
    ['The earth hath bubbles', 'bubbles'],
    ['insane root', 'insane root'],
    ['borrow’d robes', 'borrowed robes'],
    ['The greatest is behind', 'greatest is behind'],
    ['instruments of darkness', 'instruments of darkness'],
    ['swelling act', 'swelling act'],
    ['supernatural soliciting', 'supernatural soliciting'],
    ['unfix my hair', 'unfix my hair'],
    ['single state of man', 'single state of man'],
    ['partner’s rapt', 'rapt'],
    ['chance may crown me', 'chance may crown me'],
    ['Time and the hour', 'Time and the hour'],
  ],
};

export const GLOSSARY = {
  'desert place': { term: 'A desert place', text: 'A deserted, lonely spot, far from people. Not a sandy desert.' },
  hurlyburly: { term: 'hurlyburly', text: 'Uproar and confusion: here, the noise of the battle being fought while the witches meet.' },
  'ere the set of sun': { term: 'ere the set of sun', text: '“Before sunset.” The witches know the battle will be over by the end of the day.' },
  heath: { term: 'heath', text: 'Wild, open moorland covered in heather and gorse: bleak, empty ground, a fitting meeting place for witches. You are standing on it.' },
  'macbeth-pause': {
    term: 'Macbeth',
    text: 'This line is one beat short of the witches’ rhythm, which forces a pause just before the name. On stage, the Third Witch can hold the silence while her sisters lean in, then cry “Macbeth”.',
  },
  Graymalkin: {
    term: 'Graymalkin',
    text: 'An old pet name for a grey cat (“malkin” was a nickname, as we might say “moggy”). It is the First Witch’s familiar: people in Shakespeare’s day believed the devil gave witches evil spirits in animal shape to serve them. The cat is calling her away, and she answers it.',
  },
  Paddock: {
    term: 'Paddock',
    text: 'A toad: the Second Witch’s familiar, now calling her. Writers of the time spoke of witches keeping spirits “in the likeness of toads and cats”. On stage the audience may hear a mewing and a croaking.',
  },
  Anon: { term: 'Anon', text: '“At once!” or “Coming!”. The Third Witch answers her own spirit’s call.' },
  'Fair is foul, and foul is fair': {
    term: 'Fair is foul, and foul is fair',
    text: 'The witches’ creed: what others call good is evil to them, and what is evil they find good. It warns that in this play things are not what they seem, a line Macbeth himself will echo when he first appears.',
  },
  'filthy air': { term: 'filthy air', text: 'Thick, murky air: fog, smoke and storm. People then thought foul air could carry sickness and evil.' },

  // ---------- Act I, scene 2
  broil: { term: 'broil', text: 'A battle or brawl: here, the fighting against the rebels.' },
  'kerns and gallowglasses': {
    term: 'kerns and gallowglasses',
    text: 'Kerns were lightly armed Irish foot soldiers; gallowglasses were heavily armed fighters who carried great axes. The rebel Macdonwald has hired both from the Western Isles.',
  },
  unseamed: {
    term: 'unseam’d him from the nave to the chaps',
    text: 'Split him open from the navel to the jaws. The Sergeant’s picture of Macbeth in battle is savage, and full of admiration: this is the first thing we ever hear of him.',
  },
  Golgotha: {
    term: 'Golgotha',
    text: 'The hill where Jesus was crucified, “the place of the skull”. The Sergeant means the two captains fought as if to make the field as famous for slaughter.',
  },
  Bellona: {
    term: 'Bellona’s bridegroom',
    text: 'Bellona was the Roman goddess of war, so her bridegroom is a warrior fit to marry her: Macbeth. “Lapp’d in proof” means wrapped in tested armour.',
  },
  'present death': { term: 'present death', text: 'Immediate execution. Duncan gives the traitor’s title to Macbeth in the same breath.' },

  // ---------- Act I, scene 3
  'Aroint thee': { term: 'Aroint thee', text: '“Be gone!” A rude way of driving someone off, flung at the witch by the sailor’s wife.' },
  'rump-fed ronyon': { term: 'rump-fed ronyon', text: 'A fat-bottomed, over-fed wretch: the sailor’s wife’s insult. The witch never forgives it.' },
  sieve: { term: 'in a sieve', text: 'Witches were believed to sail in sieves. A sieve full of holes ought to sink, which is the point: their magic turns nature upside down.' },
  'rat without a tail': { term: 'like a rat without a tail', text: 'Witches were thought to take animal shapes, but never perfectly: a woman turned into a rat would have no tail.' },
  'pilot’s thumb': {
    term: 'a pilot’s thumb',
    text: 'A pilot guided ships into harbour. Parts of dead bodies, especially of drowned men, were believed to give power to witches’ charms.',
  },
  'weird sisters': {
    term: 'The weird sisters',
    text: '“Weird” comes from the Old English “wyrd”, meaning fate. They are the sisters of fate, not just strange women, and the word is still used for them in Macbeth’s mouth later.',
  },
  Posters: { term: 'Posters of the sea and land', text: 'Swift travellers over sea and land: to “post” was to ride fast.' },
  'Thrice to thine': {
    term: 'Thrice to thine',
    text: 'Three and nine were magic numbers. The sisters wind round three times for each of them, nine in all, and the charm is sealed. Then Macbeth walks into it.',
  },
  'So foul and fair a day': {
    term: 'So foul and fair a day',
    text: 'Macbeth’s first words echo the witches’ “Fair is foul” without his knowing it. The day is foul with storm and fair with victory, and he is bound to the sisters before they have even met.',
  },
  'should be women': { term: 'You should be women', text: 'The sisters have beards, so Banquo cannot say what they are. Their shapes are as uncertain as their words.' },
  'thane of Glamis': {
    term: 'thane of Glamis',
    text: 'A thane was a Scottish lord holding land from the king. Glamis is Macbeth’s own title, inherited when his father Sinel died, so the first greeting is simply true.',
  },
  'thane of Cawdor': {
    term: 'thane of Cawdor',
    text: 'A title Macbeth does not yet know is his. We heard Duncan give it to him in Scene 2, so we know the second greeting is true before he does.',
  },
  'king hereafter': { term: 'king hereafter', text: 'The third greeting, and the only one no news has made true. Everything Macbeth does from now on grows from these words.' },
  'why do you start': {
    term: 'why do you start',
    text: 'Banquo sees Macbeth flinch and look afraid at good news. Why would a loyal man fear being told he will be king, unless he had already thought of it?',
  },
  'Lesser than Macbeth': {
    term: 'Lesser than Macbeth, and greater',
    text: 'Riddles for Banquo: lower in rank than Macbeth but greater in goodness; less fortunate, yet happier in the end; never a king, but the father of kings.',
  },
  'get kings': {
    term: 'Thou shalt get kings',
    text: 'You will father kings. King James I, who watched the play around 1606, was believed to be descended from Banquo.',
  },
  'imperfect speakers': { term: 'imperfect speakers', text: 'Speakers who have not told the whole of it. Macbeth wants more, and they vanish.' },
  bubbles: { term: 'The earth hath bubbles', text: 'Banquo likens the vanished sisters to bubbles that rise from the earth as they do from water, then burst into nothing.' },
  'insane root': { term: 'the insane root', text: 'A plant that drives you mad if eaten, such as hemlock or henbane. Banquo wonders whether they are seeing things.' },
  'borrowed robes': {
    term: 'borrow’d robes',
    text: 'Clothes that belong to someone else. The first of many pictures in the play of garments that do not fit Macbeth.',
  },
  'greatest is behind': { term: 'The greatest is behind', text: 'The greatest of the three titles, the crown, is still to come.' },
  'instruments of darkness': {
    term: 'instruments of darkness',
    text: 'Agents of evil. Banquo warns that dark powers tell us small truths to win our trust, then betray us in what matters most. Macbeth is not listening.',
  },
  'swelling act': {
    term: 'happy prologues to the swelling act',
    text: 'Macbeth talks like a man at the theatre: two greetings come true are the opening of a grand play, and its “imperial theme” is the crown.',
  },
  'supernatural soliciting': {
    term: 'supernatural soliciting',
    text: 'Temptation by powers beyond nature. He argues with himself: how can it be evil, if it began with the truth? How can it be good, if it fills him with horror?',
  },
  'unfix my hair': {
    term: 'unfix my hair',
    text: 'Make his hair stand on end. The “suggestion” he gives way to is a picture of murdering the king, and he has thought of it unasked.',
  },
  'single state of man': {
    term: 'my single state of man',
    text: 'His whole self, pictured as a small kingdom, is shaken by a murder he has only imagined, until nothing seems real but the thing that is not.',
  },
  rapt: { term: 'rapt', text: 'Lost in thought; carried away.' },
  'chance may crown me': { term: 'chance may crown me', text: 'Perhaps he need do nothing, and fate will make him king anyway. He tries to talk himself out of it.' },
  'Time and the hour': { term: 'Time and the hour', text: 'Whatever happens, the hours go by, and even the worst day comes to an end.' },
};
