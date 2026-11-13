# Build tools

## Models

Turn the Quaternius CC0 packs (unpacked in art/quaternius/unpacked, flat copies in art/parts) into the
web models in assets/models.

1. `npm install @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions sharp`
2. `node build-models.mjs <sources> <glb-out>`: recolours outfits per character, shrinks textures to
   WebP, keeps only the animation clips we use. `--clips-only` rebuilds just the animations.
   Sources need the layout outfits/, base/, hair/, anims/ (see the script).
3. `node tojson.mjs <glb-out> ../assets/models`: wraps each GLB as base64 in a .json file
   ({"format":"glb-base64","glb":...}). Some static hosts serve .json but not .glb or .bin,
   and strict security policies block fetching data: URLs, so the game decodes the base64 itself
   (src/characters/cast.js) and loads textures through <img> blob: URLs, which are allowed.
4. `node build-dyes.mjs <sources> ../assets/models`: the dye files that recolour one outfit for
   another character (Ross, Angus).
5. Before publishing, test under strict host rules: `python3 csp_server.py 4175` (serves the game
   folder with a matching Content-Security-Policy), then open http://localhost:4175/.

## Text and voices

- `text/toplay.py <macbeth.xml> ../assets/text/play.json`: converts the public-domain Moby text
  (Jon Bosak's XML, from the NLTK corpora) into the game's play.json, with modern quotes and dashes.
- `voice/act1.py <play.json> <game folder>`: records Act I's lines with the Kokoro speech model, aged and shaped with the WORLD vocoder (`voice/vox.py`),
  one voice blend and audio treatment per character, and writes `assets/voice/act1_*.json` and
  `assets/text/act1.json` (what the story director plays).
- `voice/captain.py <game folder>`: records the Captain's lessons for the training yard (`assets/voice/yard.json`).
- `voice/compose.py <game folder>`: composes the score as MIDI (Scottish modes, fiddle, pipes and drums,
  choir, strings) and renders each cue with FluidSynth and the FluidR3 GM sound font into `assets/music/`.
  Needs: apt install fluidsynth fluid-soundfont-gm; pip install mido.
