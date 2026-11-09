// The MusicDogs songbook. Every track is original and described as data:
// the audio engine synthesises it live, and note charts are derived from the
// very same melody, so what you tap is always what you hear.
//
// Melody notation (one token per step, `res` steps per bar, default 8):
//   1-7   scale degree         '  octave up (stackable)     ,  octave down
//   #/b   sharpen / flatten    _  sustain previous note     .  rest
//   |     bar line (ignored, for readability)
//
// Tap notation for sections without a lead (16 steps per bar):
//   1-4   a note in that lane  .  nothing
//
// Chords: roman numerals relative to the song scale, one per bar
// ("IV,V" splits a bar). Upper case = major, lower case = minor,
// "7" adds a minor seventh, "M7" a major seventh.

export const DIFFICULTIES = ['easy', 'normal', 'hard'];
export const DIFF_LABEL = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };

export const SONGS = [
  {
    id: 'backyard-bounce',
    title: 'Backyard Bounce',
    genre: 'Sunny Pop',
    blurb: 'A warm-up jam in the grass.',
    bpm: 120,
    scale: 'major',
    keyName: 'C major',
    bassBase: 36,
    chordBase: 60,
    leadBase: 60,
    swing: 0,
    theme: 'backyard',
    unlock: 0,
    levels: { easy: 1, normal: 3, hard: 5 },
    sound: { kit: 'pop', bass: 'round', stab: 'pluck', lead: 'square', pad: 'warm', pump: 0.15, delay: 0.18 },
    sections: {
      intro: {
        bars: 4,
        chords: 'I V vi IV',
        drums: ['hats', 'hats', 'pop', 'pop'],
        bass: ['none', 'none', 'root', 'root'],
        comp: ['offbeat'],
        fill: true,
        taps: '................|................|1.......2.......|3.......4...3...',
      },
      A: {
        bars: 8,
        chords: 'I V vi IV I V vi IV',
        drums: 'pop',
        bass: 'bounce',
        comp: ['offbeat'],
        fill: true,
        lead: `3 3 5 . 3 3 5 . | 2 2 5 . 2 . 7, . | 1 1 3 . 1 1 3 . | 1 _ 6, _ 1 2 3 _ |
               3 3 5 . 3 3 5 . | 2 2 5 . 7 _ 5 . | 6 _ 5 3 _ 1 . 1 | 1 _ 6, _ 1 _ . .`,
      },
      B: {
        bars: 8,
        hype: true,
        chords: 'IV V I vi IV V I I',
        drums: 'popBig',
        bass: 'bounce',
        comp: ['offbeat', 'pad'],
        fill: true,
        lead: `6 _ 6 5 6 _ 1' _ | 7 _ 7 6 7 _ 2' _ | 3' _ 2' 1' _ 5 _ . | 1' _ 7 6 _ 5 3 5 |
               6 _ 6 5 6 _ 1' _ | 7 _ 7 6 7 _ 2' _ | 3' _ 3' 2' 1' _ 2' 3' | 1' _ _ _ . . . .`,
      },
      break: {
        bars: 4,
        chords: 'vi IV I V',
        drums: 'clap4',
        bass: 'root',
        comp: ['pad'],
        fill: true,
        taps: '1...2...3...4...|4...3...2...1...|1...2...3.4.3...|1.2.3.4.3.2.1...',
      },
      outro: { bars: 2, chords: 'I I', drums: ['crash', 'none'], bass: 'hold', comp: ['pad'], taps: '1..4............|................' },
    },
    order: ['intro', 'A', 'B', 'break', 'A', 'B', 'outro'],
    preview: 'B',
  },

  {
    id: 'moonlight-howl',
    title: 'Moonlight Howl',
    genre: 'Lo-fi Lullaby',
    blurb: 'Slow, swung, and full of long notes to hold.',
    bpm: 94,
    scale: 'minor',
    keyName: 'D minor',
    bassBase: 38,
    chordBase: 62,
    leadBase: 62,
    swing: 0.22,
    theme: 'moon',
    unlock: 1,
    levels: { easy: 2, normal: 4, hard: 5 },
    sound: { kit: 'lofi', bass: 'sub', stab: 'ep', lead: 'bell', pad: 'warm', pump: 0.1, delay: 0.3 },
    sections: {
      intro: {
        bars: 4,
        chords: 'i7 VIM7 iv7 V7',
        drums: ['none', 'none', 'lofi', 'lofi'],
        bass: ['none', 'none', 'lofi', 'lofi'],
        comp: ['keys', 'pad'],
        taps: '................|................|1.......3.......|2.......4.......',
      },
      A: {
        bars: 8,
        chords: 'i7 VIM7 iv7 V7 i7 VIM7 iv7 V7',
        drums: ['lofi', 'lofi2'],
        bass: 'lofi',
        comp: ['keys', 'pad'],
        lead: `5 _ _ 4 3 _ 1 _ | 3 _ _ _ 1 3 4 _ | 4 _ _ 3 4 _ 6 _ | 5 _ _ _ _ _ . . |
               5 _ _ 4 3 _ 1 _ | 3 _ 4 3 1 _ 6, _ | 4 _ 3 1 _ 7, 1 _ | 2 _ _ _ #7, _ . .`,
      },
      B: {
        bars: 8,
        hype: true,
        chords: 'VI VII i i VI VII V V',
        drums: ['lofi2', 'lofi'],
        bass: 'lofi',
        comp: ['keys', 'pad', 'arp8'],
        fill: true,
        lead: `1' _ 6 _ 1' _ 3' _ | 2' _ 7 _ 2' _ 4' _ | 5' _ _ 4' 3' _ 1' _ | 1' _ _ _ _ _ . . |
               1' _ 6 _ 1' _ 3' _ | 2' _ 7 _ 2' _ 4' _ | 5' _ 4' 3' 2' _ #7 _ | 2' _ _ _ _ _ . .`,
      },
      outro: { bars: 2, chords: 'i7 i7', drums: ['crash', 'none'], bass: 'hold', comp: ['pad', 'keys'], taps: '2.......3.......|................' },
    },
    order: ['intro', 'A', 'B', 'A', 'B', 'outro'],
    preview: 'B',
  },

  {
    id: 'neon-bark',
    title: 'Neon Bark',
    genre: 'Synthwave',
    blurb: 'Night drive through a city of chew toys.',
    bpm: 112,
    scale: 'minor',
    keyName: 'A minor',
    bassBase: 33,
    chordBase: 57,
    leadBase: 57,
    swing: 0,
    theme: 'city',
    unlock: 3,
    levels: { easy: 3, normal: 5, hard: 7 },
    sound: { kit: 'synth', bass: 'saw', stab: 'pluck', lead: 'saw', pad: 'bright', pump: 0.55, delay: 0.32 },
    sections: {
      intro: {
        bars: 4,
        chords: 'i VI III VII',
        drums: ['none', 'none', 'kick4', 'kick4'],
        bass: ['none', 'none', 'pulse8', 'pulse8'],
        comp: ['pad', 'arp16'],
        fill: true,
        taps: '................|................|1...1...2...2...|3...3...4...4.4.',
      },
      A: {
        bars: 8,
        chords: 'i VI III VII i VI III VII',
        drums: 'synth',
        bass: 'pulse8',
        comp: ['pad', 'arp16'],
        fill: true,
        lead: `5 _ 5 4 3 _ 1 _ | 3 _ 3 4 3 _ 1 _ | 5 _ 5 4 5 _ 7 _ | 4 _ _ _ 2 4 . . |
               5 _ 5 4 3 _ 1 _ | 3 _ 3 4 3 _ 6 _ | 7 _ 5 _ 3 _ 5 _ | 4 _ _ _ _ _ . .`,
      },
      B: {
        bars: 8,
        hype: true,
        chords: 'VI VII i i VI VII III VII',
        drums: 'synthBig',
        bass: 'drive',
        comp: ['pad', 'arp16', 'push'],
        fill: true,
        lead: `1' _ 1' 7 1' _ 3' _ | 2' _ 2' 1' 2' _ 4' _ | 5' _ 4' 3' _ 1' _ 3' | 1' _ _ _ . 5 7 1' |
               1' _ 1' 7 1' _ 3' _ | 2' _ 2' 1' 2' _ 4' _ | 5' _ 7' _ 5' _ 4' 3' | 4' _ _ _ 2' _ . .`,
      },
      break: {
        bars: 4,
        chords: 'i i VI VII',
        drums: ['kick4', 'kick4', 'kick4', 'build'],
        bass: 'pulse8',
        comp: ['arp16'],
        taps: '1.....2...3.....|4.....3...2.....|1...2...3...4...|1.2.3.4.1.2.3.4.',
      },
      outro: { bars: 2, chords: 'i i', drums: ['crash', 'none'], bass: 'hold', comp: ['pad', 'arp16'], taps: '1..4............|................' },
    },
    order: ['intro', 'A', 'B', 'break', 'A', 'B', 'outro'],
    preview: 'B',
  },

  {
    id: 'fetch-frenzy',
    title: 'Fetch Frenzy',
    genre: 'Chiptune Punk',
    blurb: 'Throw the ball. Throw it. THROW IT.',
    bpm: 144,
    scale: 'major',
    keyName: 'G major',
    bassBase: 43,
    chordBase: 55,
    leadBase: 67,
    swing: 0,
    theme: 'beach',
    unlock: 5,
    levels: { easy: 4, normal: 6, hard: 8 },
    sound: { kit: 'punk', bass: 'square', stab: 'organ', lead: 'chip', pad: 'warm', pump: 0.2, delay: 0.16 },
    sections: {
      intro: {
        bars: 4,
        chords: 'I V vi IV',
        drums: ['hats', 'hats', 'punk', 'punk'],
        bass: ['none', 'none', 'drive', 'drive'],
        comp: ['offbeat'],
        fill: true,
        taps: '................|................|1...2...1...2...|3...4...3.4.3.4.',
      },
      A: {
        bars: 8,
        chords: 'I V vi IV I V vi IV',
        drums: 'punk',
        bass: 'drive',
        comp: ['offbeat'],
        fill: true,
        lead: `5 _ 3 5 _ 3 5 6 | 5 _ 2 . 2 3 2 . | 3 _ 1 3 _ 1 3 5 | 6 _ 5 _ 3 _ 1 _ |
               5 _ 3 5 _ 3 5 6 | 7 _ 6 5 _ 2 . 2 | 3 _ 5 _ 1' _ 7 6 | 5 _ _ _ . 5 6 7`,
      },
      B: {
        bars: 8,
        hype: true,
        chords: 'IV V I vi IV V I I',
        drums: 'punkBig',
        bass: 'drive',
        comp: ['offbeat', 'pad'],
        fill: true,
        lead: `1' _ 1' 6 1' _ 3' _ | 2' _ 2' 7 2' _ 4' _ | 5' _ 3' 1' _ 3' 2' 1' | 3' _ _ 1' 7 _ 5 _ |
               1' _ 1' 6 1' _ 3' _ | 2' _ 2' 7 2' _ 4' _ | 5' _ 5' _ 3' 2' 1' 2' | 1' _ _ _ . . . .`,
      },
      break: {
        bars: 4,
        chords: 'vi IV I V',
        drums: ['clap4', 'clap4', 'clap4', 'build'],
        bass: 'root',
        comp: ['pad'],
        taps: '1...4...1...4...|2...3...2...3...|1.2.3...4.3.2...|1.2.3.4.4.3.2.1.',
      },
      outro: { bars: 2, chords: 'I I', drums: ['crash', 'none'], bass: 'hold', comp: ['pad'], taps: '1..4............|................' },
    },
    order: ['intro', 'A', 'B', 'break', 'A', 'B', 'B', 'outro'],
    preview: 'B',
  },

  {
    id: 'cosmic-zoomies',
    title: 'Cosmic Zoomies',
    genre: 'Hyper Trance',
    blurb: 'Full-speed laps around the Moon. Experts only.',
    bpm: 160,
    scale: 'minor',
    keyName: 'E minor',
    bassBase: 40,
    chordBase: 64,
    leadBase: 64,
    swing: 0,
    theme: 'space',
    unlock: 8,
    levels: { easy: 5, normal: 7, hard: 10 },
    sound: { kit: 'trance', bass: 'saw', stab: 'pluck', lead: 'super', pad: 'bright', pump: 0.7, delay: 0.3 },
    sections: {
      intro: {
        bars: 4,
        chords: 'i VI III VII',
        drums: ['none', 'hats', 'kick4', 'build'],
        bass: ['none', 'none', 'offbeat', 'offbeat'],
        comp: ['pad', 'arp16'],
        taps: '................|................|1...2...3...4...|1...2...3.4.3.4.',
      },
      A: {
        bars: 8,
        chords: 'i VI III VII i VI III VII',
        drums: 'trance',
        bass: 'offbeat',
        comp: ['pad', 'arp16'],
        fill: true,
        lead: `5 5 3 5 . 5 7 5 | 6 6 3 6 . 6 1' 6 | 7 7 5 7 . 7 2' 7 | 2' _ 1' 7 _ 6 4 _ |
               5 5 3 5 . 5 7 5 | 6 6 3 6 . 6 1' 6 | 7 7 5 7 . 2' 7 2' | 4' _ 2' _ 7 _ 2' _`,
      },
      B: {
        bars: 8,
        hype: true,
        chords: 'VI VII i i VI VII III V',
        drums: 'tranceBig',
        bass: 'octave8',
        comp: ['pad', 'arp16', 'push'],
        fill: true,
        lead: `3' _ 1' 3' _ 1' 3' 5' | 4' _ 2' 4' _ 2' 4' 7' | 1'' _ 7' 5' _ 3' 5' 7' | 5' _ _ _ . 3' 5' 7' |
               3' _ 1' 3' _ 1' 3' 5' | 4' _ 2' 4' _ 2' 4' 7' | 7' _ 5' 7' _ 2'' _ 7' | 2'' _ _ _ #7' _ 2'' _`,
      },
      break: {
        bars: 8,
        chords: 'i i VI VI III III VII VII',
        drums: ['none', 'none', 'hats', 'hats', 'kick4', 'kick4', 'build', 'build2'],
        bass: ['none', 'none', 'none', 'none', 'offbeat', 'offbeat', 'offbeat', 'offbeat'],
        comp: ['pad', 'arp16'],
        taps: '1.......2.......|3.......4.......|1...2...3...4...|4...3...2...1...|1...3...2...4...|1.2...3.4...2.3.|1.2.3.4.1.2.3.4.|4.3.2.1.4.3.2.1.',
      },
      outro: { bars: 2, chords: 'i i', drums: ['crash', 'none'], bass: 'hold', comp: ['pad', 'arp16'], taps: '1..4............|................' },
    },
    order: ['intro', 'A', 'B', 'break', 'A', 'B', 'B', 'outro'],
    preview: 'B',
  },
];

export const songById = (id) => SONGS.find((s) => s.id === id) || SONGS[0];
