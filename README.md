# MusicDogs

A 3D pet game where every dog is half instrument. Look after your pup, earn
notes, and grow new instrument parts until one small dog is an entire
orchestra.

Runs in any modern browser on phones, tablets and computers. No installs and
no accounts.

## The game

You adopt a pup that is born half instrument: a **Drum Belly**, a **Violin
Tail**, **Clarinet Legs** or a **Trumpet Snout**. From there:

- **Care for it.** Feed it, play fetch, scrub it in the bath, tuck it in for a
  nap, and stroke it. Each need you top up pays out notes, and more when the
  pup really needed it.
- **Hold concerts.** The pup performs its theme with every instrument it has
  grown. A happy, rested pup with a bigger orchestra draws a bigger crowd.
  Tap the instrument parts as they light up for bonus notes.
- **Grow the orchestra.** Spend notes on twelve instrument parts across four
  families. Each one changes the dog's body and adds its own line to the
  music:

| Family | I | II | III |
|---|---|---|---|
| Percussion | Drum Belly | Cymbal Ears | Xylophone Ribs |
| Strings | Violin Tail | Cello Spine | Harp Sail |
| Woodwinds | Clarinet Legs | Bassoon Legs | Pan-Flute Mane |
| Brass | Trumpet Snout | Horn Collar | Sousaphone Coil |

A pup goes from Solo Pup through Duo, Trio and Quartet all the way to Full
Orchestra. Needs drift down slowly while you are away, but a pup is never
hurt by neglect.

### Controls

| | |
|---|---|
| Stroke the pup | Pet it |
| Tap an instrument part | Play that instrument |
| Drag the background | Look around |
| Pinch or scroll | Zoom |
| Keys `1`–`6` | Feed, Play, Wash, Sleep, Concert, Grow |

## Run it

```bash
npm start
```

Then open http://localhost:8080. The game is plain HTML, CSS and JavaScript
modules with no build step, so any static file server works.

To put it online, enable GitHub Pages for this repository (Settings → Pages →
Deploy from a branch → root). On a phone, "Add to Home Screen" installs it as
a full-screen app that also works offline.

### One-file version

```bash
npm install
```

```bash
npm run build
```

This writes `dist/MusicDogs.html`, a single self-contained file you can
double-click, email or drop on any host.

## How it is built

Everything you see and hear is generated in code. There are no model, image
or audio files.

- **The pup** (`src/dog`): a small rig assembled from primitive shapes. Every
  body part has a plain version and an instrument version (`parts.js`), so
  the dog is rebuilt from its upgrade levels. Walking, sitting, sleeping,
  eating, dancing and reacting to touch are all procedural animation
  (`dog.js`).
- **The stage** (`src/world.js`): [three.js](https://threejs.org) scene with
  soft shadows, a day and night cycle, props, an orbit camera and sprite
  particles.
- **The orchestra** (`src/audio`): one synthesised Web Audio voice per
  instrument part and a sequencer that plays "Pup's Theme". Each part has its
  own line in the score, and only the parts the dog has grown are played.
- **The rules** (`src/game.js`): needs, rewards, prices and saving, kept free
  of rendering code so they can be tested directly.

Progress is saved in the browser's local storage.

## Tests

```bash
npm test
```

Covers the upgrade catalogue, buying rules, needs, saving, time away, the
score (every note in key and in range), and a simulated play session that
must reach Full Orchestra in a sensible time.

## Classic rhythm game

The first MusicDogs, a four-lane rhythm game with a band of dogs, lives on in
[`classic/`](classic/). It is linked from the Settings menu, or open
`/classic/` directly. `npm run build:classic` makes its one-file version.

## Credits

- [three.js](https://threejs.org), MIT License (see `vendor/three.LICENSE`)
- Font: [Fredoka](https://github.com/hafontia/Fredoka-One), SIL Open Font
  License (see `assets/fonts/OFL.txt`)
