// The sound of a MusicDog: a small synthesised orchestra (one voice per
// instrument body part), a looping sequencer, and the game's sound effects.
// No audio files — everything is generated with Web Audio.

import { buildScore } from './score.js';

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// How loud each voice sits in the mix.
const LEVEL = {
  hum: 0.34, str1: 0.36, wood1: 0.24, perc1: 0.95, perc2: 0.46, perc3: 0.5, str2: 0.3, str3: 0.38,
  wood2: 0.3, wood3: 0.34, brass1: 0.28, brass2: 0.2, brass3: 0.28,
};

export class Orchestra {
  constructor(opts = {}) {
    this.ctx = opts.ctx || null;
    this.score = buildScore();
    this.stepDur = 60 / this.score.bpm / 2;
    this.levels = { perc: 0, str: 0, wood: 0, brass: 0 };
    this.mode = 'off'; // off | idle | concert
    this.step = 0;
    this.t0 = 0;
    this.playing = false;
    this.events = []; // { tag, t } for the visuals
    this.musicVol = 0.8;
    this.sfxVol = 0.8;
    this.onConcertEnd = null;
    this.concertStepsLeft = 0;
    if (this.ctx) this._build();
  }

  // ------------------------------------------------------------- lifecycle

  init() {
    if (this.ctx) return this.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve(false);
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* optional */ }
    this.ctx = new AC({ latencyHint: 'interactive' });
    this._build();
    return this.resume();
  }

  resume() {
    if (!this.ctx) return Promise.resolve(false);
    if (this.ctx.state !== 'running' && this.ctx.resume) return this.ctx.resume().then(() => true, () => false);
    return Promise.resolve(true);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) this.ctx.suspend();
  }

  get ok() {
    return !!this.ctx;
  }

  _build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.64;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -8;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 12;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.2;
    this.trim = ctx.createGain();
    this.trim.gain.value = 0.8;
    this.master.connect(this.limiter).connect(this.trim).connect(ctx.destination);

    this.music = ctx.createGain(); // user volume
    this.music.gain.value = this.musicVol;
    this.music.connect(this.master);
    this.band = ctx.createGain(); // idle / concert level
    this.band.gain.value = 0;
    this.tone = ctx.createBiquadFilter();
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 3200;
    this.band.connect(this.tone).connect(this.music);
    this.sfx = ctx.createGain();
    this.sfx.gain.value = this.sfxVol;
    this.sfx.connect(this.master);

    // noise + a concert-hall-ish reverb
    const sr = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, sr * 2, sr);
    const nd = this.noise.getChannelData(0);
    let seed = 987654321;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < nd.length; i++) nd[i] = rnd();
    const len = Math.floor(sr * 2.3);
    const ir = ctx.createBuffer(2, len, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = rnd() * Math.pow(1 - i / len, 2.8) * (i < sr * 0.012 ? i / (sr * 0.012) : 1);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.revOut = ctx.createGain();
    this.revOut.gain.value = 0.5;
    this.reverb.connect(this.revOut).connect(this.music);
    this.send = ctx.createGain();
    this.send.gain.value = 0.34;
    this.band.connect(this.send).connect(this.reverb);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music, t, 0.05);
    this.sfx.gain.setTargetAtTime(sfx, t, 0.05);
  }

  // -------------------------------------------------------------- sequencer

  setLevels(levels) {
    this.levels = { ...levels };
  }

  /** Which score lines are sounding, and on which instrument. */
  activeParts() {
    const L = this.levels;
    const list = [];
    const lead = L.str >= 1 ? 'str1' : L.wood >= 1 ? 'wood1' : 'hum';
    list.push(['lead', lead]);
    if (L.str >= 1 && L.wood >= 1) list.push(['harmony', 'wood1']);
    if (L.perc >= 1) list.push(['perc1', 'perc1']);
    if (L.perc >= 2) list.push(['perc2', 'perc2']);
    if (L.perc >= 3) list.push(['perc3', 'perc3']);
    if (L.str >= 2) list.push(['str2', 'str2']);
    if (L.str >= 3) list.push(['str3', 'str3']);
    if (L.wood >= 2) list.push(['wood2', 'wood2']);
    if (L.wood >= 3) list.push(['wood3', 'wood3']);
    if (L.brass >= 1) list.push(['brass1', 'brass1']);
    if (L.brass >= 2) list.push(['brass2', 'brass2']);
    if (L.brass >= 3) list.push(['brass3', 'brass3']);
    return list;
  }

  setMode(mode) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const g = mode === 'concert' ? 1 : mode === 'idle' ? 0.42 : 0;
    this.band.gain.setTargetAtTime(g, t, mode === 'off' ? 0.25 : 0.12);
    this.tone.frequency.setTargetAtTime(mode === 'concert' ? 9000 : 2600, t, 0.2);
    this.send.gain.setTargetAtTime(mode === 'concert' ? 0.4 : 0.3, t, 0.2);
    if (mode !== 'off' && !this.playing) this._start(0);
  }

  _start(step) {
    this.playing = true;
    this.step = step;
    this.t0 = this.ctx.currentTime + 0.12 - step * this.stepDur;
    this.loopBase = 0;
    this._index();
    clearInterval(this.timer);
    this.timer = setInterval(() => this._tick(), 30);
  }

  _index() {
    // notes bucketed by step for quick lookup
    if (this.byStep) return;
    this.byStep = {};
    for (const [line, notes] of Object.entries(this.score.parts)) {
      const arr = (this.byStep[line] = Array.from({ length: this.score.steps }, () => []));
      for (const n of notes) arr[n.step].push(n);
    }
  }

  /** Play one eight-bar half of the theme at full volume, then call back. */
  concert(half, onEnd) {
    if (!this.ctx) return;
    this.onConcertEnd = onEnd;
    this.concertStepsLeft = 64;
    this.setMode('concert');
    this._start(half ? 64 : 0);
  }

  _tick() {
    const ctx = this.ctx;
    if (!this.playing || ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.2;
    let guard = 0;
    while (guard++ < 32) {
      const when = this.t0 + (this.loopBase + this.step) * this.stepDur;
      if (when > horizon) break;
      if (when > ctx.currentTime - 0.05 && this.mode !== 'off') this._playStep(this.step, Math.max(when, ctx.currentTime));
      this.step++;
      if (this.concertStepsLeft > 0 && --this.concertStepsLeft === 0) {
        const cb = this.onConcertEnd;
        this.onConcertEnd = null;
        const delay = Math.max(0, when + this.stepDur - ctx.currentTime);
        setTimeout(() => cb && cb(), delay * 1000);
      }
      if (this.step >= this.score.steps) {
        this.step = 0;
        this.loopBase += this.score.steps;
      }
    }
  }

  _playStep(step, t) {
    for (const [line, voice] of this.activeParts()) {
      for (const n of this.byStep[line][step]) {
        this.voice(voice, t, n, this.band);
        this.events.push({ tag: voice, t });
      }
    }
  }

  /** Schedule the whole theme at once at full volume (offline rendering in tests). */
  scheduleAll(startAt = 0.1) {
    this._index();
    this.band.gain.value = 1;
    this.tone.frequency.value = 9000;
    for (let step = 0; step < this.score.steps; step++) this._playStep(step, startAt + step * this.stepDur);
  }

  /** Beat phase (0 at each beat) and beats per second, for dancing. */
  beat() {
    if (!this.ctx || !this.playing) return { phase: 1, bps: 1.7, on: false };
    const beats = (this.ctx.currentTime - this.t0) / (this.stepDur * 2);
    return { phase: ((beats % 1) + 1) % 1, bps: 1 / (this.stepDur * 2), on: this.mode !== 'off' };
  }

  /** Notes that have started sounding since the last call. */
  drain() {
    if (!this.ctx) return [];
    const now = this.ctx.currentTime;
    const out = [];
    this.events = this.events.filter((e) => {
      if (e.t <= now) {
        out.push(e.tag);
        return false;
      }
      return true;
    });
    return out;
  }

  /** A tap on an instrument part: play a little flourish on it. */
  playPart(tag) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const step = this.playing ? this.step : 0;
    const chord = this.score.tones(this.score.chordAt(step % this.score.steps));
    const d = this.stepDur;
    const dest = this.sfx;
    if (tag === 'perc1') {
      this.voice(tag, t, { kind: 'boom', v: 1, len: 1 }, dest);
      this.voice(tag, t + d, { kind: 'tap', v: 0.9, len: 1 }, dest);
    } else if (tag === 'perc2') {
      this.voice(tag, t, { kind: 'crash', v: 0.9, len: 1 }, dest);
    } else {
      const base = { perc3: 84, str1: 72, str2: 48, str3: 60, wood1: 67, wood2: 48, wood3: 84, brass1: 67, brass2: 55, brass3: 36, hum: 72 }[tag] ?? 72;
      const seq = tag === 'str3' ? [0, 1, 2, 0, 1, 2].map((i, k) => chord[i] + (k > 2 ? 12 : 0)) : tag === 'brass3' || tag === 'str2' || tag === 'brass2' ? [chord[0]] : [chord[0], chord[1], chord[2]];
      seq.forEach((x, i) => this.voice(tag, t + i * d * (tag === 'str3' ? 0.5 : 1), { m: base + (x % 12), len: seq.length === 1 ? 3 : i === seq.length - 1 ? 2 : 1, v: 0.9 }, dest, 1.5));
    }
  }

  // ------------------------------------------------------------------ voices

  _osc(type, f, t, end) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(end);
    return o;
  }

  _env(t, a, peak, dec, sus, dur, rel) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setTargetAtTime(peak * sus, t + a, dec);
    g.gain.setTargetAtTime(0, t + Math.max(dur, a + 0.01), rel);
    return g;
  }

  _lp(freq, q = 0.7) {
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  _noise(t, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(t, Math.random() * 1.4, dur + 0.05);
    return s;
  }

  _vibrato(oscs, f, t, end, depth = 0.006, delay = 0.12) {
    const lfo = this._osc('sine', 5.4, t, end);
    const g = this.ctx.createGain();
    g.gain.value = 0;
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(f * depth, t + delay + 0.25);
    lfo.connect(g);
    oscs.forEach((o) => g.connect(o.frequency));
  }

  /**
   * Play one note on one instrument.
   * @param n { m: midi, len: steps, v: velocity, kind?: drum articulation }
   */
  voice(tag, t, n, dest, boost = 1) {
    const ctx = this.ctx;
    const v = (n.v ?? 0.8) * (LEVEL[tag] ?? 0.3) * boost;
    const dur = Math.max(0.08, (n.len || 1) * this.stepDur);
    const f = n.m ? mtof(n.m) : 0;
    const end = t + dur + 1.2;
    switch (tag) {
      case 'perc1': {
        const boom = n.kind !== 'tap';
        const o = this._osc('sine', boom ? 150 : 260, t, t + 0.5);
        o.frequency.exponentialRampToValueAtTime(boom ? 58 : 150, t + (boom ? 0.11 : 0.06));
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * (boom ? 1 : 0.6), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + (boom ? 0.4 : 0.16));
        o.connect(g).connect(dest);
        const ns = this._noise(t, 0.12);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = boom ? 900 : 2400;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(v * (boom ? 0.12 : 0.34), t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + (boom ? 0.05 : 0.11));
        ns.connect(bp).connect(ng).connect(dest);
        break;
      }
      case 'perc2': {
        const crash = n.kind === 'crash';
        const d = crash ? 1.5 : 0.05;
        const ns = this._noise(t, d);
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = crash ? 4200 : 7000;
        const g = ctx.createGain();
        g.gain.setValueAtTime(v * (crash ? 1.1 : 0.9), t);
        g.gain.exponentialRampToValueAtTime(0.001, t + d);
        ns.connect(hp).connect(g).connect(dest);
        // a little metallic ring
        for (const fr of crash ? [3100, 4270, 5890] : [6200]) {
          const o = this._osc('square', fr, t, t + d);
          const og = ctx.createGain();
          og.gain.setValueAtTime(v * 0.05, t);
          og.gain.exponentialRampToValueAtTime(0.0005, t + d * 0.8);
          o.connect(og).connect(hp);
        }
        break;
      }
      case 'perc3': {
        // xylophone: bright, woody, very short
        const g = this._env(t, 0.002, v, 0.09, 0.0, 0.05, 0.08);
        this._osc('sine', f, t, t + 0.7).connect(g);
        const p = ctx.createGain();
        p.gain.setValueAtTime(0.5, t);
        p.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
        this._osc('sine', f * 3.93, t, t + 0.2).connect(p).connect(g);
        g.connect(dest);
        break;
      }
      case 'str1':
      case 'str2': {
        const cello = tag === 'str2';
        const lp = this._lp(cello ? 1300 : 3000, 1);
        const g = this._env(t, cello ? 0.09 : 0.05, v, 0.2, 0.85, dur * 0.96, cello ? 0.12 : 0.07);
        const oscs = [-7, 7].map((c) => {
          const o = this._osc('sawtooth', f, t, end);
          o.detune.value = c;
          o.connect(lp);
          return o;
        });
        this._vibrato(oscs, f, t, end, cello ? 0.004 : 0.007);
        lp.connect(g).connect(dest);
        break;
      }
      case 'str3': {
        // harp pluck
        const g = this._env(t, 0.003, v, 0.35, 0.0, 0.06, 0.4);
        this._osc('triangle', f, t, t + 2).connect(g);
        const p = ctx.createGain();
        p.gain.setValueAtTime(0.35, t);
        p.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        this._osc('sine', f * 2, t, t + 0.4).connect(p).connect(g);
        g.connect(dest);
        break;
      }
      case 'wood1': {
        // clarinet: hollow, odd harmonics
        const lp = this._lp(1900, 1.2);
        const g = this._env(t, 0.035, v, 0.15, 0.85, dur * 0.94, 0.06);
        const a = this._osc('square', f, t, end);
        const b = this._osc('sine', f, t, end);
        a.connect(lp);
        const bg = ctx.createGain();
        bg.gain.value = 0.6;
        b.connect(bg).connect(lp);
        this._vibrato([a, b], f, t, end, 0.003, 0.2);
        lp.connect(g).connect(dest);
        break;
      }
      case 'wood2': {
        // bassoon: reedy and round
        const lp = this._lp(820, 3);
        const g = this._env(t, 0.02, v, 0.08, 0.6, dur * 0.7, 0.05);
        this._osc('sawtooth', f, t, end).connect(lp);
        const sq = ctx.createGain();
        sq.gain.value = 0.5;
        this._osc('square', f, t, end).connect(sq).connect(lp);
        lp.connect(g).connect(dest);
        break;
      }
      case 'wood3':
      case 'hum': {
        // pan flute / the pup's own whistle: sine plus breath
        const flute = tag === 'wood3';
        const g = this._env(t, flute ? 0.05 : 0.03, v, 0.2, 0.85, dur * 0.92, 0.07);
        const a = this._osc('sine', f, t, end);
        const b = this._osc('triangle', f * 2, t, end);
        const bg = ctx.createGain();
        bg.gain.value = flute ? 0.12 : 0.2;
        a.connect(g);
        b.connect(bg).connect(g);
        this._vibrato([a, b], f, t, end, 0.006, 0.1);
        const ns = this._noise(t, dur);
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = clamp(f * 2, 800, 6000);
        bp.Q.value = 3;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(flute ? 0.5 : 0.18, t);
        ng.gain.exponentialRampToValueAtTime(flute ? 0.12 : 0.03, t + 0.12);
        ns.connect(bp).connect(ng).connect(g);
        g.connect(dest);
        break;
      }
      case 'brass1':
      case 'brass2':
      case 'brass3': {
        const trumpet = tag === 'brass1', tuba = tag === 'brass3';
        const lp = this._lp(600, trumpet ? 2.5 : 1.4);
        const top = trumpet ? 3600 : tuba ? 520 : 1100;
        const a = trumpet ? 0.03 : tuba ? 0.04 : 0.09;
        lp.frequency.setValueAtTime(trumpet ? 700 : tuba ? 160 : 400, t);
        lp.frequency.linearRampToValueAtTime(top, t + a * 1.6);
        lp.frequency.setTargetAtTime(top * 0.6, t + a * 1.6, 0.2);
        const g = this._env(t, a, v, 0.15, trumpet ? 0.8 : 0.9, dur * (tuba ? 0.8 : 0.93), tuba ? 0.07 : 0.06);
        const o = this._osc('sawtooth', f, t, end);
        o.connect(lp);
        if (tuba) {
          const sg = ctx.createGain();
          sg.gain.value = 0.7;
          this._osc('sine', f, t, end).connect(sg).connect(g);
        } else {
          const o2 = this._osc('sawtooth', f, t, end);
          o2.detune.value = 6;
          o2.connect(lp);
          if (trumpet) this._vibrato([o, o2], f, t, end, 0.005, 0.18);
        }
        lp.connect(g).connect(dest);
        break;
      }
      default:
    }
  }

  // --------------------------------------------------------- sound effects

  _blip(f0, f1, dur, vol, type = 'sine', when = 0) {
    if (!this.ctx) return;
    const t = when || this.ctx.currentTime;
    const o = this._osc(type, f0, t, t + dur + 0.05);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.sfx);
  }

  ui(kind = 'tap') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (kind === 'tap') this._blip(620, 880, 0.06, 0.12);
    else if (kind === 'back') this._blip(520, 330, 0.08, 0.12);
    else if (kind === 'no') this._blip(220, 160, 0.14, 0.12, 'square');
    else if (kind === 'coin') {
      this._blip(1318, 1318, 0.12, 0.1, 'triangle');
      this._blip(1760, 1760, 0.2, 0.1, 'triangle', t + 0.07);
    } else if (kind === 'pop') this._blip(500 + Math.random() * 500, 1500, 0.07, 0.14);
    else if (kind === 'heart') this._blip(880, 1320, 0.1, 0.07, 'sine');
    else if (kind === 'squeak') {
      this._blip(900, 1700, 0.09, 0.12, 'square');
      this._blip(1700, 1000, 0.12, 0.1, 'square', t + 0.09);
    } else if (kind === 'bounce') this._blip(240, 120, 0.09, 0.14);
    else if (kind === 'coins') {
      // a shower of coins: quick rising pings
      for (let i = 0; i < 7; i++) this._blip(1175 * Math.pow(1.06, i * 2), 1175 * Math.pow(1.06, i * 2), 0.14, 0.07, 'triangle', t + i * 0.045);
    } else if (kind === 'shimmer') {
      [1568, 1976, 2349, 3136].forEach((f, i) => this._blip(f, f, 0.5, 0.045, 'sine', t + i * 0.07));
    } else if (kind === 'unwrap') {
      this._blip(300, 900, 0.18, 0.12, 'triangle');
      [784, 988, 1175, 1568].forEach((f, i) => this._blip(f, f, 0.3, 0.08, 'triangle', t + 0.16 + i * 0.06));
    } else if (kind === 'whoosh') {
      const ns = this._noise(t, 0.3);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(500, t);
      bp.frequency.exponentialRampToValueAtTime(2600, t + 0.25);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      ns.connect(bp).connect(g).connect(this.sfx);
    }
  }

  crunch() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const t0 = t + i * 0.07 + Math.random() * 0.02;
      const ns = this._noise(t0, 0.05);
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1400 + Math.random() * 1600;
      bp.Q.value = 1.5;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.3, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.045);
      ns.connect(bp).connect(g).connect(this.sfx);
    }
  }

  splash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const ns = this._noise(t, 0.5);
    const lp = this._lp(2400);
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.45);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    ns.connect(lp).connect(g).connect(this.sfx);
    for (let i = 0; i < 4; i++) this._blip(400 + Math.random() * 600, 1400, 0.08, 0.07, 'sine', t + 0.05 + i * 0.07);
  }

  applause(dur = 2.6) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const ns = this._noise(t, 1.9);
    ns.loop = true;
    ns.stop(t + dur + 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2200;
    bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    // many overlapping claps = a jittery amplitude
    for (let x = 0; x < dur; x += 0.045) {
      const level = (0.1 + Math.random() * 0.2) * Math.min(1, x * 4) * Math.min(1, (dur - x) * 1.4);
      g.gain.linearRampToValueAtTime(level, t + x);
    }
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.1);
    ns.connect(bp).connect(g);
    g.connect(this.sfx);
    g.connect(this.reverb);
  }

  fanfare(big = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.03;
    const notes = big ? [60, 64, 67, 72, 76, 79, 84] : [67, 72, 76, 79];
    notes.forEach((m, i) => {
      this.voice('brass1', t + i * 0.085, { m, len: i === notes.length - 1 ? 4 : 1, v: 0.9 }, this.sfx, 1.2);
      this.voice('perc3', t + i * 0.085, { m: m + 12, len: 1, v: 0.8 }, this.sfx, 1.1);
    });
    if (big) this.voice('perc2', t + notes.length * 0.085, { kind: 'crash', v: 0.8 }, this.sfx);
  }

  /** Synthesised "woof". pitch ~0.8 (big) .. 1.7 (puppy yip). */
  bark(pitch = 1.3, vol = 0.45, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = when || ctx.currentTime;
    const dur = 0.15 / Math.sqrt(pitch);
    const o = this._osc('sawtooth', 240 * pitch, t, t + dur + 0.25);
    o.frequency.linearRampToValueAtTime(470 * pitch, t + 0.025);
    o.frequency.exponentialRampToValueAtTime(170 * pitch, t + dur);
    const f1 = ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(700 * pitch, t);
    f1.frequency.linearRampToValueAtTime(1150 * pitch, t + 0.04);
    f1.frequency.linearRampToValueAtTime(600 * pitch, t + dur);
    f1.Q.value = 2.2;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.value = 2300 * pitch;
    f2.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.setTargetAtTime(vol * 0.6, t + 0.03, 0.03);
    g.gain.setTargetAtTime(0, t + dur * 0.75, 0.025);
    const ns = this._noise(t, dur);
    const ng = ctx.createGain();
    ng.gain.value = 0.22;
    ns.connect(ng).connect(f1);
    o.connect(f1);
    o.connect(f2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    f2.connect(g2).connect(g);
    f1.connect(g).connect(this.sfx);
  }
}
