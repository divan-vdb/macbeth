# Macbeth

**A game by Divan van den Berg**

An open-world action RPG of Shakespeare's *Macbeth* that runs in the browser on computers and phones. You can play it as a game, and you can learn the play as you go: every scene is staged in the world, spoken aloud and written into the Folio beside you.

**Play it:** https://divan-vdb.github.io/macbeth/

## The story behind it

In 2007, in my final year of high school, we read *Macbeth* in English class. Years later I wanted to push the boundaries on something nostalgic: an experience where you can play a game and, while you play, come to know the actual Shakespearean play.

The game was brought to life through a collective approach, bringing together coding, design and AI.

## What you can do

- **Walk the blasted heath as Macbeth.** It's a night-time open world with physics, wind-blown heather, a stone circle, a camp fire and a storm.
- **Live the play.** Act I's first three scenes are staged in the world. The witches meet at their cauldron, the Old Man tells of the battle by his fire, and you walk with Banquo to the sisters. You hear the prophecies, watch the sisters vanish, and Ross and Angus arrive with the news of Cawdor.
- **Hear it.** Every character has a distinct voice. A mature old narrator, the Old Man, tells the story in between.
  - Narration, voices, the world's ambient sound and effects each have their own volume.
  - Pause at any moment, even mid-line, and read the Folio while the game waits.
  - Any line, or a whole scene, can be skipped.
- **Read it.** The Folio holds the whole play, all five acts.
  - Lines are pale until they are spoken in the game; then the Folio writes them in.
  - Tap a portrait to learn about a character, or an underlined word for a glossary note in plain English. Each scene has a short guide.
- **Train in the Captain's yard.** A gruff old soldier drills you, step by voiced step:
  - sword blows on straw scarecrows, a carved wooden man, a stick figure and a pell;
  - a heavy blow;
  - blocking the swinging sandbag of a quintain;
  - casting spears from the line into straw butts;
  - smashing clay pots with stones;
  - and last, horsemanship: mount your mare at the hitching rail and ride her through his course of flagged gates.

  Every target rocks, sheds straw or wood chips, and sounds true to what it is made of. Thrown spears stick where they land and can be pulled out again.
- **Ride.** Macbeth's dark bay mare is saddled and bridled in his colours. Mount her from the near side, walk her on, canter, and spur her to a gallop until she is blown. Her hoofbeats follow her legs, and she comes when you whistle.
- **Feel the theatre.** Each scene opens with velvet curtains and its title. An original score follows the story: a fiddle lament for the heath, an eerie choir for the witches, harp and cello for the Old Man's hearth, pipes and drums for the yard, and rising horns for the prophecy. The music dips whenever someone speaks.
- **Play it.** Ravens bring scrolls with tasks and tips.
  - Gather stones, take up a spear, find a healer's tonic and ready your sword.
  - Follow the compass and the parchment map to glowing points of interest.
  - Your progress saves in the browser.
- **Choose how you play:** *Play and learn the play* keeps the Folio beside you; *Just play* keeps the text in the background.

More is on the way: riding (mount a horse, ride through the posts), fist fights with passers-by, the boar hunt, Forres and Inverness, and the rest of the play, act by act.

## Controls

- **Computer:**
  - WASD to walk, Shift to run, Space to jump; drag to look, scroll to zoom
  - E to take or read, 1–4 for weapons, Q to drink a tonic, M for the map
  - Click to strike (F); hold the click and let go for a heavy blow (R); hold the right button to block (V)
  - With a spear or stones ready, aim with the view and click to throw
  - On horseback: E to mount or dismount, W to walk on (steer with A and D or the view), hold Shift to canter and keep holding to gallop; H whistles for your horse
  - P (or the pause button) pauses at any moment; in a scene, Esc pauses too
  - In a scene, Space or Enter skips to the next line
- **Phone:** left thumb to walk (push further to run), drag to look, pinch to zoom. Tap Strike to swing (hold it for a heavy blow, or to throw), and hold Block to guard. In the saddle, push the stick where you want to go, to its edge to canter, and hold it there to gallop; the Horse button whistles for her. The pause button is at the top.
- **Gamepad:** X strikes, Y is the heavy blow, LB or LT blocks.

## Run it on your own computer

There is no build step. From this folder:

```
python3 -m http.server 8080
```

Then open http://localhost:8080. You'll need an internet connection, because the 3D and physics libraries load from the jsDelivr CDN at pinned versions.

## How it's made

- Rendering: [three.js](https://threejs.org) `WebGPURenderer`, with an automatic WebGL 2 fallback.
- Physics: [Rapier](https://rapier.rs), in WebAssembly.
- Sound effects, wind, fire and thunder are synthesised live with the Web Audio API.
- The score is composed as MIDI in Python and played with FluidSynth through the FluidR3 GM sound font (MIT).
- Characters are built from Quaternius's CC0 modular characters, re-coloured and costumed in code. Cloaks and gowns are simulated cloth.
- The horse is from Quaternius's CC0 Ultimate Animated Animals; her saddle, saddle cloth, bridle and reins are built in code, and the rider's seat is laid over the animation.
- Voices are recorded with the open [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) speech model (Apache 2.0). Each character has its own blend of voices, then is aged and shaped with the [WORLD](https://github.com/JeremyCCHsu/Python-Wrapper-for-World-Vocoder) vocoder: the witches' rasp, croak and tremor, the Old Man's breath and waver.
- Models and voices are stored as base64 inside `.json` files, so they load from any static host.

```
index.html               the page and import map
src/main.js              start-up, world, physics, the game loop
src/story/               the story director (lines, cameras, subtitles), the stage (the cast), Act I
src/folio/               the Folio: the play, glossary, scene notes, the cast
src/game/                health, arsenal, tasks, raven and scrolls, map, settings, saving
src/world/               terrain, stones, fire, sky, lightning, the blasted hollow, mist, the training yard
src/characters/          character building, cloth, props
src/player/              the player controller, camera and controls
assets/text/play.json    the full text of the play
assets/voice/            the recorded lines
assets/music/            the score, one file a cue
assets/models/           the character models and animations
tools/                   scripts that build the models, voices and text
```

## Credits

See [CREDITS.md](CREDITS.md).

## Disclaimer

The game aims to stay true to the original play, but some placements, names, characters' appearances and events differ from it, because this is also an interactive online game.

*The Tragedy of Macbeth* was written by William Shakespeare (1564–1616), and all credit for the original play and its words belongs to him. The text used here is in the public domain.

## Licence

- **Code:** [MIT](LICENSE). Anyone may use, change and share it, as long as the copyright notice naming Divan van den Berg is kept.
- **Writing:** the game's own writing (the Old Man's narration, the scrolls, the glossary and scene notes, the character notes) and its recorded voices are under [CC BY 4.0](CONTENT-LICENSE.md). Anyone may reuse them if they credit Divan van den Berg.
- **Third-party parts** keep their own licences (see [CREDITS.md](CREDITS.md)). Shakespeare's text is in the public domain.

The game is free and is not sold.
