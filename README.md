# MusicDogs

A rhythm game starring a band of very good dogs. Runs in any modern browser on
phones, tablets and computers. No installs, no accounts, no downloads beyond
the page itself (about 230 KB).

Biscuit the corgi drums, Waffles the pug holds down the bass, Luna the husky
is on keys and Domino the dalmatian shreds guitar. They play; you keep them in
time.

## How to play

- Paw notes slide down four lanes. Hit a lane when its note lands in the ring.
- Notes with a tail are holds: keep pressing until the tail runs out.
- Clean hits fill the **Howl Meter**. When it is full the band howls, puts on
  sunglasses, and every point counts double.
- Miss a note and the lead instrument drops out of the mix until you are back
  on the beat.

| | |
|---|---|
| Touch | Tap anywhere in a lane (multi-touch, works in portrait and landscape) |
| Keyboard | `D` `F` `J` `K` or the arrow keys. `Esc` pauses. |
| Menus | Arrow keys pick a song and difficulty, `Enter` plays |

Five stages unlock as you earn stars: Backyard Bounce, Moonlight Howl, Neon
Bark, Fetch Frenzy and Cosmic Zoomies, each in Easy, Normal and Hard.

If you use wireless headphones, open **Settings → Measure delay by tapping**
once. Bluetooth audio lags, and the game will compensate.

## Run it

```bash
npm start
```

Then open http://localhost:8080. Any static file server works too, since the
game is plain HTML, CSS and JavaScript modules with no build step.

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

Everything you see and hear is generated in code. There are no image or audio
files.

- **Music** (`src/audio`): each song is a short data description (chords,
  drum grid, bass pattern, melody). A Web Audio synthesiser plays it with a
  sample-accurate scheduler: drums, four bass and five lead sounds, pads,
  side-chain pumping, tempo-synced delay and reverb. Barks and howls are
  synthesised too.
- **Charts** (`src/audio/compile.js`): note charts come from the same melody
  the synth plays, so taps always match what you hear. Pitch maps to lanes,
  long notes become holds, and each difficulty thins or thickens the pattern.
- **Timing** (`src/game/play.js`, `src/main.js`): judging runs on the audio
  clock, corrected for output latency and input event delay. Windows are
  ±50 ms perfect, ±100 ms great, ±150 ms good.
- **Art** (`src/render`): the dogs, five stages, highway, particles and HUD
  are drawn on one canvas and scale to any screen. Menus are regular HTML
  for crisp text and accessibility.
- **Saving** (`src/storage.js`): best scores and settings stay in the
  browser's local storage.

## Tests

```bash
npm test
```

Checks every song and difficulty: charts are valid and playable, a perfect
run earns S+, an idle run earns nothing, and the judging windows behave.

## Credits

Font: [Fredoka](https://github.com/hafontia/Fredoka-One), SIL Open Font
License (see `assets/fonts/OFL.txt`).
