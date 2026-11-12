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
  - Any line, or a whole scene, can be skipped.
- **Read it.** The Folio holds the whole play, all five acts.
  - Lines are pale until they are spoken in the game; then the Folio writes them in.
  - Tap a portrait to learn about a character, or an underlined word for a glossary note in plain English. Each scene has a short guide.
- **Play it.** Ravens bring scrolls with tasks and tips.
  - Gather stones, take up a spear, find a healer's tonic and ready your sword.
  - Follow the compass and the parchment map to glowing points of interest.
  - Your progress saves in the browser.
- **Choose how you play:** *Play and learn the play* keeps the Folio beside you; *Just play* keeps the text in the background.

More is on the way: fist fights, sword training, the boar hunt, Forres and Inverness, and the rest of the play, act by act.

## Controls

- **Computer:**
  - WASD to walk, Shift to run, Space to jump; drag to look, scroll to zoom
  - E to take or read, 1–4 for weapons, Q to drink a tonic, M for the map
  - In a scene, Space or Enter skips to the next line
- **Phone:** left thumb to walk (push further to run), drag to look, pinch to zoom, and tap the on-screen buttons.

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
- Characters are built from Quaternius's CC0 modular characters, re-coloured and costumed in code. Cloaks and gowns are simulated cloth.
- Voices are recorded with the open [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) speech model (Apache 2.0). Each character has its own blend of voices and its own audio treatment.
- Models and voices are stored as base64 inside `.json` files, so they load from any static host.

```
index.html               the page and import map
src/main.js              start-up, world, physics, the game loop
src/story/               the story director (lines, cameras, subtitles), the stage (the cast), Act I
src/folio/               the Folio: the play, glossary, scene notes, the cast
src/game/                health, arsenal, tasks, raven and scrolls, map, settings, saving
src/world/               terrain, stones, fire, sky, lightning, the blasted hollow, mist
src/characters/          character building, cloth, props
src/player/              the player controller, camera and controls
assets/text/play.json    the full text of the play
assets/voice/            the recorded lines
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
