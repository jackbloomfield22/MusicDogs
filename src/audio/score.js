// "Pup's Theme" — the piece every MusicDog plays. Each instrument body part
// has its own line, so the tune grows as the dog does.
//
// 16 bars of 4/4 in C major, on an eighth-note grid (8 steps per bar).

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const midi = (name) => {
  const m = /^([A-G])(#|b)?(\d)$/.exec(name);
  return 12 * (Number(m[3]) + 1) + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
};

export const BPM = 104;
export const STEPS_PER_BAR = 8;
export const BARS = 16;

// one chord per half bar: [root pitch class, quality]
const CH = { C: [0, 'M'], Am: [9, 'm'], F: [5, 'M'], G: [7, 'M'], Em: [4, 'm'] };
const CHORDS = [
  'C C', 'Am Am', 'F F', 'G G', 'C C', 'Am Am', 'F G', 'C C',
  'F F', 'G G', 'Em Em', 'Am Am', 'F F', 'G G', 'C C', 'C C',
].map((bar) => bar.split(' ').map((c) => CH[c]));

const MELODY = `
G4 C5 E5 G5 _ E5 C5 _ | A4 C5 E5 A5 _ E5 C5 _ | F4 A4 C5 F5 _ E5 D5 _ | D5 _ B4 _ G4 _ _ - |
G4 C5 E5 G5 _ E5 C5 _ | A4 C5 E5 A5 _ G5 E5 _ | F5 _ E5 D5 _ B4 D5 _ | C5 _ _ _ _ _ - - |
A5 _ F5 _ C5 _ F5 _ | B5 _ G5 _ D5 _ G5 _ | G5 _ E5 _ B4 _ E5 _ | A5 _ G5 E5 _ C5 _ _ |
F5 _ A5 _ C6 _ A5 _ | G5 _ B5 _ D6 _ B5 _ | C6 _ G5 E5 _ G5 C6 _ | C6 _ _ _ _ _ - -`;

function parseLine(str) {
  const tokens = str.replace(/\|/g, ' ').trim().split(/\s+/);
  if (tokens.length !== BARS * STEPS_PER_BAR) throw new Error(`Melody has ${tokens.length} steps`);
  const notes = [];
  let cur = null;
  tokens.forEach((tok, step) => {
    if (tok === '_') {
      if (cur) cur.len++;
      return;
    }
    cur = null;
    if (tok === '-') return;
    cur = { step, len: 1, m: midi(tok), v: 0.9 };
    notes.push(cur);
  });
  return notes;
}

const chordAt = (step) => CHORDS[Math.floor(step / 8) % BARS][step % 8 < 4 ? 0 : 1];
const tones = ([root, q]) => [root, root + (q === 'm' ? 3 : 4), root + 7];
/** Chord tone at or below `m`, at least `gap` semitones under it. */
function below(m, chord, gap) {
  const pcs = tones(chord).map((t) => t % 12);
  for (let x = m - gap; x > m - 14; x--) if (pcs.includes(((x % 12) + 12) % 12)) return x;
  return m - 12;
}

export function buildScore() {
  const melody = parseLine(MELODY);
  const parts = {
    lead: melody,
    harmony: melody.filter((n) => n.len >= 2 || n.step % 2 === 0).map((n) => ({ ...n, m: below(n.m, chordAt(n.step), 3), v: 0.7 })),
    perc1: [], perc2: [], perc3: [], str2: [], str3: [], wood2: [], wood3: [], brass1: [], brass2: [], brass3: [],
  };
  for (let bar = 0; bar < BARS; bar++) {
    const s0 = bar * 8;
    const last = bar === 7 || bar === 15;
    const sectionB = bar >= 8;
    // belly drum: boom on 1 & 3, tap on 2 & 4
    for (const [st, kind, v] of [[0, 'boom', 1], [2, 'tap', 0.8], [4, 'boom', 0.9], [5, 'boom', 0.55], [6, 'tap', 0.85]]) parts.perc1.push({ step: s0 + st, len: 1, kind, v });
    if (bar % 4 === 3) parts.perc1.push({ step: s0 + 7, len: 1, kind: 'tap', v: 0.7 });
    // cymbal ears: off-beat ticks, a crash to open each phrase
    for (const st of [1, 3, 5, 7]) parts.perc2.push({ step: s0 + st, len: 1, kind: 'tick', v: st === 3 || st === 7 ? 0.8 : 0.55 });
    if (bar % 8 === 0) parts.perc2.push({ step: s0, len: 1, kind: 'crash', v: 1 });
    for (let half = 0; half < 2; half++) {
      const st = s0 + half * 4;
      const ch = chordAt(st);
      const [r, third, fifth] = tones(ch);
      // sousaphone: oom
      parts.brass3.push({ step: st, len: 2, m: 36 + r - (r > 7 ? 12 : 0), v: 1 });
      // bassoon: -pah, a staccato answer
      parts.wood2.push({ step: st + 1, len: 1, m: 48 + fifth - (fifth > 14 ? 12 : 0), v: 0.7 }, { step: st + 3, len: 1, m: 48 + r, v: 0.8 });
      // cello spine: warm long notes
      parts.str2.push({ step: st, len: 4, m: 48 + (half ? fifth - 12 : r) + (r < 5 && !half ? 0 : 0), v: 0.8 });
      // horn collar: two-note pad
      parts.brass2.push({ step: st, len: 4, m: 60 + third - (third > 9 ? 12 : 0), v: 0.6 }, { step: st, len: 4, m: 55 + ((fifth - 7 + 12) % 12), v: 0.55 });
      // harp: a rising and falling arpeggio
      const arp = half ? [r + 24, fifth + 12, third + 12, fifth] : [r, fifth, r + 12, third + 12];
      arp.forEach((x, i) => parts.str3.push({ step: st + i, len: 2, m: 48 + x, v: 0.55 + (i === 0 ? 0.25 : 0) }));
      // xylophone ribs: sparkles in the second section and at phrase ends
      if (sectionB || bar % 4 >= 2) {
        [fifth + 12, third + 12].forEach((x, i) => parts.perc3.push({ step: st + 1 + i * 2, len: 1, m: 72 + x - 12, v: 0.7 }));
      }
      // pan flute mane: a high, breathy descant
      if (sectionB || bar >= 4) parts.wood3.push({ step: st, len: half ? 3 : 4, m: 72 + (half ? third : fifth) + (bar % 2 ? 0 : 0), v: 0.6 });
    }
    // trumpet snout: fanfares that answer the tune
    const ch = chordAt(s0);
    const [r, third, fifth] = tones(ch);
    if (last) {
      [[0, 2, r + 12], [3, 1, fifth], [4, 3, r + 12]].forEach(([st, len, x]) => parts.brass1.push({ step: s0 + st, len, m: 60 + x, v: 1 }));
    } else if (bar % 4 === 3) {
      [[4, 1, fifth - 12], [5, 1, fifth - 12], [6, 2, r + 0]].forEach(([st, len, x]) => parts.brass1.push({ step: s0 + st, len, m: 67 + x - 7, v: 0.9 }));
    } else if (sectionB) {
      parts.brass1.push({ step: s0, len: 2, m: 60 + third, v: 0.8 }, { step: s0 + 4, len: 2, m: 60 + fifth, v: 0.8 });
    } else {
      parts.brass1.push({ step: s0 + 6, len: 1, m: 60 + fifth - (fifth > 9 ? 12 : 0), v: 0.7 }, { step: s0 + 7, len: 1, m: 60 + r + (r < 5 ? 12 : 0), v: 0.75 });
    }
  }
  for (const k of Object.keys(parts)) parts[k].sort((a, b) => a.step - b.step);
  return { bpm: BPM, steps: BARS * STEPS_PER_BAR, parts, chordAt, tones };
}
