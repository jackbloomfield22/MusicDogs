// Gameplay rules: judging, scoring, combo, holds and HOWL TIME.
// Pure logic — rendering and sound react to the events it emits.

import { clamp } from '../util.js';

export const WINDOWS = { perfect: 0.05, great: 0.1, good: 0.15 };
const BASE = { perfect: 100, great: 70, good: 40 };
const HOWL_GAIN = { perfect: 0.032, great: 0.022, good: 0.012 };

// note.state
export const PENDING = 0;
export const HIT = 1;
export const HOLDING = 2;
export const MISSED = 3;
export const HELD = 4;
export const BROKEN = 5;

export function gradeFor(acc, allPerfect) {
  if (allPerfect) return 'S+';
  if (acc >= 0.95) return 'S';
  if (acc >= 0.88) return 'A';
  if (acc >= 0.78) return 'B';
  if (acc >= 0.65) return 'C';
  return 'D';
}

export const starsFor = (acc) => (acc >= 0.9 ? 3 : acc >= 0.72 ? 2 : acc >= 0.4 ? 1 : 0);

export class Game {
  constructor(compiled, chart, { auto = false, emit = () => {} } = {}) {
    this.compiled = compiled;
    this.notes = chart.notes.map((n) => ({ ...n, state: PENDING, hitT: 0, nextTick: 0 }));
    this.total = this.notes.length;
    this.auto = auto;
    this.emit = emit;
    this.time = -compiled.leadIn;
    this.head = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { perfect: 0, great: 0, good: 0, miss: 0 };
    this.judged = 0;
    this.howl = 0;
    this.howlActive = false;
    this.howlEnd = 0;
    this.howlLen = clamp(compiled.beat * 16, 6, 9);
    this.pressed = [false, false, false, false];
    this.holding = [null, null, null, null];
    this.finished = false;
    this.lastNoteEnd = this.notes.reduce((m, n) => Math.max(m, n.end || n.t), 0);
  }

  get mult() {
    return 1 + Math.min(3, Math.floor(this.combo / 10));
  }

  get accuracy() {
    if (!this.judged) return 1;
    const c = this.counts;
    return (c.perfect + c.great * 0.7 + c.good * 0.4) / this.judged;
  }

  _add(points) {
    this.score += points * this.mult * (this.howlActive ? 2 : 1);
  }

  _judge(note, quality, dt) {
    this.counts[quality]++;
    this.judged++;
    if (quality === 'miss') {
      const hadCombo = this.combo;
      this.combo = 0;
      if (!this.howlActive) this.howl = Math.max(0, this.howl - 0.06);
      this.emit('judge', { note, quality, lane: note.lane, dt, brokeCombo: hadCombo });
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this._add(BASE[quality]);
    if (!this.howlActive) {
      this.howl = Math.min(1, this.howl + HOWL_GAIN[quality]);
      if (this.howl >= 1) {
        this.howlActive = true;
        this.howlEnd = this.time + this.howlLen;
        this.emit('howl', { on: true });
      }
    }
    this.emit('judge', { note, quality, lane: note.lane, dt, combo: this.combo });
    if (this.combo > 0 && this.combo % 50 === 0) this.emit('milestone', { combo: this.combo });
  }

  press(lane, t) {
    this.pressed[lane] = true;
    let best = null;
    for (let i = this.head; i < this.notes.length; i++) {
      const n = this.notes[i];
      if (n.t - t > WINDOWS.good) break;
      if (n.lane !== lane || n.state !== PENDING) continue;
      if (Math.abs(n.t - t) <= WINDOWS.good) {
        best = n;
        break;
      }
    }
    if (!best) {
      this.emit('ghost', { lane });
      return null;
    }
    const dt = t - best.t;
    const ad = Math.abs(dt);
    const quality = ad <= WINDOWS.perfect ? 'perfect' : ad <= WINDOWS.great ? 'great' : 'good';
    best.hitT = t;
    if (best.hold) {
      best.state = HOLDING;
      best.nextTick = Math.max(t, best.t) + 0.1;
      this.holding[lane] = best;
    } else {
      best.state = HIT;
    }
    this._judge(best, quality, dt);
    return quality;
  }

  release(lane, t) {
    this.pressed[lane] = false;
    const h = this.holding[lane];
    if (!h) return;
    this.holding[lane] = null;
    if (t >= h.end - 0.16) {
      this._finishHold(h);
    } else {
      h.state = BROKEN;
      h.brokeT = t;
      this.combo = 0;
      this.emit('holdBreak', { note: h, lane });
    }
  }

  _finishHold(h) {
    h.state = HELD;
    this._add(50);
    this.emit('holdDone', { note: h, lane: h.lane });
  }

  update(t) {
    this.time = t;

    if (this.auto) {
      for (let i = this.head; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.t > t) break;
        if (n.state === PENDING) {
          this.press(n.lane, n.t);
          if (!n.hold) this.pressed[n.lane] = false;
        }
      }
    }

    // Notes that scrolled past unhit.
    while (this.head < this.notes.length) {
      const n = this.notes[this.head];
      if (n.state !== PENDING) {
        this.head++;
        continue;
      }
      if (t - n.t > WINDOWS.good) {
        n.state = MISSED;
        this._judge(n, 'miss', 0);
        this.head++;
      } else break;
    }

    // Holds tick up score while held and complete on their own at the tail.
    for (let lane = 0; lane < 4; lane++) {
      const h = this.holding[lane];
      if (!h) continue;
      while (h.nextTick <= Math.min(t, h.end)) {
        this._add(10);
        h.nextTick += 0.1;
        this.emit('holdTick', { lane });
      }
      if (t >= h.end) {
        this.holding[lane] = null;
        if (this.auto) this.pressed[lane] = false;
        this._finishHold(h);
      }
    }

    if (this.howlActive) {
      this.howl = clamp((this.howlEnd - t) / this.howlLen, 0, 1);
      if (t >= this.howlEnd) {
        this.howlActive = false;
        this.howl = 0;
        this.emit('howl', { on: false });
      }
    }

    if (!this.finished && t > this.compiled.duration + 0.6) {
      this.finished = true;
      this.emit('finish', this.results());
    }
  }

  results() {
    const c = this.counts;
    const hit = c.perfect + c.great + c.good;
    const acc = this.total ? (c.perfect + c.great * 0.7 + c.good * 0.4) / this.total : 0;
    const allPerfect = this.total > 0 && c.perfect === this.total;
    return {
      score: Math.round(this.score),
      acc,
      grade: gradeFor(acc, allPerfect),
      stars: starsFor(acc),
      maxCombo: this.maxCombo,
      counts: { ...c },
      total: this.total,
      fullCombo: this.total > 0 && hit === this.total && c.miss === 0,
      allPerfect,
    };
  }
}
