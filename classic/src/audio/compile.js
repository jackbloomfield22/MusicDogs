// Turns a song description into (a) a time-sorted list of synth events and
// (b) playable note charts for each difficulty.

import { mulberry32, hashString } from '../util.js';

const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7 };

// 16-step drum grids. x = hit, X = accent, o = ghost note.
const DRUMS = {
  none: {},
  hats: { h: 'x.x.x.x.x.x.x.x.' },
  kick4: { k: 'X...x...x...x...', h: '..x...x...x...x.' },
  clap4: { k: 'X...x...x...x...', c: '....x.......x...' },
  pop: { k: 'X.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  popBig: { k: 'X..x....x.x.....', s: '....x.......x...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..............x.' },
  lofi: { k: 'X.....x...x.....', s: '....x.......x...', h: 'x.o.x.o.x.o.x.o.' },
  lofi2: { k: 'X..x......x.....', s: '....x.......x..o', h: 'x.o.x.o.x.o.x.x.' },
  synth: { k: 'X...x...x...x...', s: '....x.......x...', h: 'o.x.o.x.o.x.o.x.' },
  synthBig: { k: 'X...x...x...x...', s: '....X.......X...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' },
  punk: { k: 'X.....x.x.....x.', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  punkBig: { k: 'X.x.....x.x.....', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', o: 'x.......x.......' },
  trance: { k: 'X...x...x...x...', c: '....x.......x...', h: 'oooooooooooooooo', o: '..x...x...x...x.' },
  tranceBig: { k: 'X...x...x...x...', s: '....x.......x...', c: '....x.......x...', h: 'xoxoxoxoxoxoxoxo', o: '..x...x...x...x.' },
  build: { k: 'X...x...x...x...', s: 'x.x.x.x.x.x.x.x.', ramp: true },
  build2: { k: 'X...x...x...x...', s: 'xxxxxxxxxxxxxxxx', ramp: true },
  crash: { k: 'X...............', cr: 'x...............' },
};

// 16-step bass grids. 0 root, 3 third, 5 fifth, 7 seventh, 8 octave, _ sustain.
const BASS = {
  none: '................',
  hold: '0_______________',
  root: '0_______0_____0.',
  pulse8: '0.0.0.0.0.0.0.0.',
  drive: '0.0.0.0.0.0.5.8.',
  octave8: '0.8.0.8.0.8.0.8.',
  offbeat: '..0...0...0...0.',
  bounce: '0..0..8.0.0...5.',
  lofi: '0_____0...5.0_..',
};

const STABS = {
  offbeat: { pat: '..x...x...x...x.', len: 1.6 },
  push: { pat: 'x..x..x...x..x..', len: 1.4 },
  keys: { pat: 'x.....x.........', len: 5 },
};

function parseChord(token, scale) {
  const m = /^([b#]?)([ivIV]+)(M7|7)?$/.exec(token);
  if (!m) throw new Error(`Bad chord "${token}"`);
  const degree = ROMAN[m[2].toLowerCase()];
  const minor = m[2] === m[2].toLowerCase();
  let root = SCALES[scale][degree - 1];
  if (m[1] === 'b') root -= 1;
  if (m[1] === '#') root += 1;
  const tones = [0, minor ? 3 : 4, 7];
  if (m[3] === '7') tones.push(10);
  if (m[3] === 'M7') tones.push(11);
  return { root, tones, third: tones[1] };
}

function parseChords(str, scale, bars) {
  const tokens = str.trim().split(/\s+/);
  if (tokens.length !== bars) throw new Error(`Chord count ${tokens.length} != ${bars} bars: "${str}"`);
  // Each bar becomes a list of { chord, start16, len16 }.
  return tokens.map((tok) => {
    const parts = tok.split(',');
    const len = 16 / parts.length;
    return parts.map((p, i) => ({ chord: parseChord(p, scale), start: i * len, len }));
  });
}

function parseLead(str, scale, bars, res) {
  const tokens = str.replace(/\|/g, ' ').trim().split(/\s+/);
  if (tokens.length !== bars * res) {
    throw new Error(`Lead has ${tokens.length} steps, expected ${bars * res}`);
  }
  const notes = [];
  let current = null;
  tokens.forEach((tok, i) => {
    if (tok === '_') {
      if (current) current.len += 1;
      return;
    }
    current = null;
    if (tok === '.') return;
    const m = /^([b#]?)([1-7])('*)(,*)$/.exec(tok);
    if (!m) throw new Error(`Bad melody token "${tok}"`);
    let semi = SCALES[scale][Number(m[2]) - 1] + 12 * m[3].length - 12 * m[4].length;
    if (m[1] === '#') semi += 1;
    if (m[1] === 'b') semi -= 1;
    current = { step: i, len: 1, semi };
    notes.push(current);
  });
  return notes;
}

const VEL = { x: 0.8, X: 1, o: 0.38 };
const pick = (v, bar) => (Array.isArray(v) ? v[bar % v.length] : v);

export function compileSong(song) {
  const beat = 60 / song.bpm;
  const barDur = beat * 4;
  const s16 = barDur / 16;
  const swing = song.swing || 0;
  const swingOff = (pos16) => {
    const p = ((pos16 % 4) + 4) % 4;
    if (p === 2) return swing * beat * 0.5;
    if (p === 3) return swing * beat * 0.25;
    return 0;
  };

  const events = [];
  const melody = [];
  const taps = [];
  const accents = []; // kick/snare hits under a lead, used to thicken hard charts
  const sections = [];
  let bar0 = 0;

  // One bar of count-in clicks before the downbeat.
  for (let b = 0; b < 4; b++) events.push({ t: -barDur + b * beat, k: 'tick', v: b === 0 ? 1 : 0.7 });

  song.order.forEach((name, secIndex) => {
    const sec = song.sections[name];
    if (!sec) throw new Error(`Unknown section "${name}" in ${song.id}`);
    const chords = parseChords(sec.chords, song.scale, sec.bars);
    const t0 = bar0 * barDur;
    sections.push({ name, index: secIndex, t0, t1: t0 + sec.bars * barDur, hype: !!sec.hype, bars: sec.bars });
    const timeAt = (bar, pos16) => t0 + bar * barDur + pos16 * s16 + swingOff(pos16);
    const chordAt = (bar, pos16) => {
      const segs = chords[bar];
      return (segs.find((s) => pos16 >= s.start && pos16 < s.start + s.len) || segs[0]).chord;
    };

    for (let bar = 0; bar < sec.bars; bar++) {
      // ---- drums ----
      const kit = DRUMS[pick(sec.drums, bar)] || DRUMS.none;
      const isFillBar = sec.fill && bar === sec.bars - 1;
      const lanes = { k: 'kick', s: 'snare', h: 'hat', o: 'ohat', c: 'clap', cr: 'crash' };
      for (const key of Object.keys(lanes)) {
        const pat = kit[key];
        if (!pat) continue;
        for (let i = 0; i < 16; i++) {
          const ch = pat[i];
          if (!VEL[ch]) continue;
          if (isFillBar && i >= 12 && (key === 'h' || key === 'o')) continue;
          let v = VEL[ch];
          if (kit.ramp && key === 's') v = 0.3 + 0.6 * (i / 15);
          events.push({ t: timeAt(bar, i), k: lanes[key], v });
          if (sec.lead && (key === 'k' || key === 's') && v > 0.5) {
            accents.push({ t: timeAt(bar, i), pos16: i, sec: secIndex, hype: !!sec.hype, drum: key });
          }
        }
      }
      if (isFillBar) {
        events.push({ t: timeAt(bar, 12), k: 'snare', v: 0.7 });
        events.push({ t: timeAt(bar, 13), k: 'tom', v: 0.7, m: 50 });
        events.push({ t: timeAt(bar, 14), k: 'snare', v: 0.85 });
        events.push({ t: timeAt(bar, 15), k: 'tom', v: 0.8, m: 45 });
      }
      if (bar === 0 && sec.hype) events.push({ t: timeAt(0, 0), k: 'crash', v: 0.7 });

      // ---- bass ----
      const bpat = BASS[pick(sec.bass, bar)] || BASS.none;
      for (let i = 0; i < 16; i++) {
        const ch = bpat[i];
        if (ch === '.' || ch === '_') continue;
        let len = 1;
        while (i + len < 16 && bpat[i + len] === '_') len++;
        const chord = chordAt(bar, i);
        const off = ch === '0' ? 0 : ch === '3' ? chord.third : ch === '5' ? 7 : ch === '7' ? 10 : 12;
        events.push({ t: timeAt(bar, i), k: 'bass', m: song.bassBase + chord.root + off, d: len * s16 * (len > 1 ? 0.96 : 0.85) });
      }

      // ---- chords / comping ----
      for (const comp of sec.comp || []) {
        if (comp === 'pad') {
          for (const seg of chords[bar]) {
            events.push({ t: timeAt(bar, seg.start), k: 'pad', ms: voicing(song, seg.chord), d: seg.len * s16 });
          }
        } else if (STABS[comp]) {
          const { pat, len } = STABS[comp];
          for (let i = 0; i < 16; i++) {
            if (pat[i] !== 'x') continue;
            events.push({ t: timeAt(bar, i), k: 'stab', ms: voicing(song, chordAt(bar, i)), d: len * s16, v: 0.8 });
          }
        } else if (comp === 'arp16' || comp === 'arp8') {
          const stepLen = comp === 'arp16' ? 1 : 2;
          const shape = [0, 1, 2, 3, 2, 1];
          for (let i = 0; i < 16; i += stepLen) {
            const chord = chordAt(bar, i);
            const tones = [...chord.tones.slice(0, 3), 12];
            const idx = shape[((bar * 16 + i) / stepLen) % shape.length];
            const base = song.chordBase + (chord.root >= 7 ? chord.root - 12 : chord.root) + 12;
            events.push({ t: timeAt(bar, i), k: 'arp', m: base + tones[idx], d: stepLen * s16 * 0.9, v: i % 4 === 0 ? 0.8 : 0.55 });
          }
        }
      }
    }

    // ---- lead melody ----
    if (sec.lead) {
      const res = sec.res || 8;
      const mul = 16 / res;
      for (const n of parseLead(sec.lead, song.scale, sec.bars, res)) {
        const bar = Math.floor(n.step / res);
        const pos16 = (n.step % res) * mul;
        const t = timeAt(bar, pos16);
        const d = n.len * mul * s16 * 0.94;
        const m = song.leadBase + n.semi;
        events.push({ t, k: 'lead', m, d });
        melody.push({ t, d, m, pos16, sec: secIndex, hype: !!sec.hype, steps: n.len * mul });
      }
    }

    // ---- authored taps for sections without a lead ----
    if (sec.taps) {
      const barsStr = sec.taps.split('|');
      if (barsStr.length !== sec.bars) throw new Error(`Tap bars mismatch in ${song.id}/${name}`);
      barsStr.forEach((str, bar) => {
        if (str.length !== 16) throw new Error(`Tap bar must have 16 steps in ${song.id}/${name}`);
        for (let i = 0; i < 16; i++) {
          const lane = '1234'.indexOf(str[i]);
          if (lane >= 0) taps.push({ t: timeAt(bar, i), lane, pos16: i, sec: secIndex });
        }
      });
    }

    bar0 += sec.bars;
  });

  events.sort((a, b) => a.t - b.t);
  const duration = bar0 * barDur;
  return { song, events, melody, taps, accents, sections, duration, beat, barDur, leadIn: barDur };
}

function voicing(song, chord) {
  const base = song.chordBase + (chord.root >= 7 ? chord.root - 12 : chord.root);
  return chord.tones.map((t) => base + t);
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

const DIFF = {
  easy: { minGap: 0.46, doubles: false, overlapHolds: false, drums: false },
  normal: { minGap: 0.22, doubles: false, overlapHolds: true, drums: false },
  hard: { minGap: 0.115, doubles: true, overlapHolds: true, drums: true },
};

const metricRank = (pos16) => (pos16 % 16 === 0 ? 0 : pos16 % 8 === 0 ? 1 : pos16 % 4 === 0 ? 2 : pos16 % 2 === 0 ? 3 : 4);

export function buildChart(compiled, diff) {
  const cfg = DIFF[diff] || DIFF.normal;
  const { beat, song } = compiled;
  const rand = mulberry32(hashString(song.id + diff));

  // Candidate notes: melody + authored taps (+ drum accents on hard).
  const cands = [
    ...compiled.melody.map((n) => ({ ...n, lane: null, rank: metricRank(n.pos16) })),
    ...compiled.taps.map((n) => ({ ...n, d: 0, m: null, steps: 1, rank: metricRank(n.pos16) })),
  ];
  if (cfg.drums) {
    for (const a of compiled.accents) cands.push({ ...a, d: 0, m: null, lane: null, steps: 1, rank: 6 });
  }

  // Thin to the difficulty's density, keeping the strongest beats first.
  const byPriority = [...cands].sort((a, b) => a.rank - b.rank || a.t - b.t);
  const kept = [];
  for (const n of byPriority) {
    if (kept.every((k) => Math.abs(k.t - n.t) >= cfg.minGap - 1e-6)) kept.push(n);
  }
  kept.sort((a, b) => a.t - b.t);

  // Pitches ranked within each section drive lane placement, so a melody
  // "reads" left (low) to right (high) and uses all four dogs.
  const pitchSets = new Map();
  for (const n of kept) {
    if (n.m == null) continue;
    if (!pitchSets.has(n.sec)) pitchSets.set(n.sec, new Set());
    pitchSets.get(n.sec).add(n.m);
  }
  const pitchLane = new Map();
  for (const [sec, set] of pitchSets) {
    const sorted = [...set].sort((a, b) => a - b);
    const map = new Map();
    sorted.forEach((m, i) => map.set(m, sorted.length === 1 ? 1 : Math.min(3, Math.floor((i / sorted.length) * 4))));
    pitchLane.set(sec, map);
  }

  const holdMin = Math.max(0.42, beat * 1.4);
  const busyUntil = [-1, -1, -1, -1];
  const notes = [];
  let prev = null;
  let prevMel = null;

  kept.forEach((n, i) => {
    let lane = n.lane;
    if (lane == null && n.m != null) {
      lane = pitchLane.get(n.sec).get(n.m);
      if (prevMel && prevMel.sec === n.sec) {
        if (n.m === prevMel.m) lane = prevMel.lane;
        else if (n.m > prevMel.m && lane <= prevMel.lane) lane = prevMel.lane + 1;
        else if (n.m < prevMel.m && lane >= prevMel.lane) lane = prevMel.lane - 1;
        if (lane > 3) lane = 2;
        if (lane < 0) lane = 1;
      }
    } else if (lane == null) {
      // Drum accent: kicks lean left, snares lean right, never repeat the last lane.
      const side = n.drum === 'k' ? [0, 1] : [3, 2];
      const options = side.filter((l) => !prev || l !== prev.lane);
      lane = options[Math.floor(rand() * options.length)] ?? side[0];
    }
    // Never drop a note into a lane that is still being held.
    if (busyUntil[lane] > n.t - 0.08) {
      const free = [0, 1, 2, 3].filter((l) => busyUntil[l] <= n.t - 0.08).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane));
      if (!free.length) return;
      lane = free[0];
    }

    let end = 0;
    if (n.d >= holdMin) {
      end = n.t + n.d - 0.03;
      const next = kept[i + 1];
      if (!cfg.overlapHolds && next) end = Math.min(end, next.t - 0.24);
      if (end - n.t < 0.4) end = 0;
    }
    const note = { t: n.t, lane, end, hold: end > 0, m: n.m, sec: n.sec };
    notes.push(note);
    if (note.hold) busyUntil[lane] = end + 0.12;
    prev = note;
    if (n.m != null) prevMel = note;

    // Hard mode: chords of two on the big downbeats of a chorus.
    if (cfg.doubles && n.hype && n.pos16 === 0 && n.m != null && !note.hold) {
      const options = [0, 1, 2, 3].filter((l) => l !== lane && busyUntil[l] <= n.t - 0.08 && Math.abs(l - lane) >= 2);
      if (options.length) {
        const l2 = options[Math.floor(rand() * options.length)];
        notes.push({ t: n.t, lane: l2, end: 0, hold: false, m: n.m, sec: n.sec });
      }
    }
  });

  notes.sort((a, b) => a.t - b.t || a.lane - b.lane);
  notes.forEach((n, i) => (n.id = i));
  return { notes, diff, count: notes.length, holds: notes.filter((n) => n.hold).length };
}
