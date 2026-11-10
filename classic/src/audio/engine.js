// MusicDogs audio engine: a small Web Audio synthesiser + sample-accurate
// song scheduler. No audio files — every drum, bass, lead, bark and howl is
// generated in real time.

import { midiToFreq, clamp } from '../util.js';

const KITS = {
  pop: { kick: [150, 50, 0.26], snare: [0.16, 2200, 190], hat: 0.5, room: 0.12 },
  lofi: { kick: [120, 44, 0.3], snare: [0.14, 1400, 170], hat: 0.3, room: 0.2 },
  synth: { kick: [165, 46, 0.3], snare: [0.28, 2000, 180], hat: 0.42, room: 0.3 },
  punk: { kick: [170, 55, 0.2], snare: [0.15, 2600, 210], hat: 0.5, room: 0.1 },
  trance: { kick: [190, 48, 0.24], snare: [0.2, 2400, 200], hat: 0.4, room: 0.22 },
};

export class AudioEngine {
  constructor(opts = {}) {
    this.ctx = opts.ctx || null;
    this.musicVol = 0.8;
    this.sfxVol = 0.8;
    this._lastCtxT = 0;
    this._perfAtCtx = 0;
    this._mono = 0;
    if (this.ctx) this._build();
  }

  /** Create the context. Must be called from a user gesture. */
  init() {
    if (this.ctx) return this.resume();
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return Promise.resolve(false);
    try {
      // Lets iOS play through the hardware mute switch, like a game should.
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch { /* optional API */ }
    this.ctx = new AC({ latencyHint: 'interactive' });
    this._build();
    return this.resume();
  }

  resume() {
    if (!this.ctx) return Promise.resolve(false);
    this._mono = 0;
    if (this.ctx.state !== 'running' && this.ctx.resume) return this.ctx.resume().then(() => true, () => false);
    return Promise.resolve(true);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running' && this.ctx.suspend) return this.ctx.suspend();
    return Promise.resolve();
  }

  get ok() {
    return !!this.ctx;
  }

  _build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.72;
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.threshold.value = -7;
    this.limiter.knee.value = 6;
    this.limiter.ratio.value = 14;
    this.limiter.attack.value = 0.003;
    this.limiter.release.value = 0.18;
    // The compressor adds make-up gain; trim after it so peaks keep headroom.
    this.trim = ctx.createGain();
    this.trim.gain.value = 0.8;
    this.master.connect(this.limiter).connect(this.trim).connect(ctx.destination);

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = this.musicVol;
    this.musicGain.connect(this.master);
    this.sfxGain = ctx.createGain();
    this.sfxGain.gain.value = this.sfxVol;
    this.sfxGain.connect(this.master);

    // Shared noise + reverb impulse.
    const sr = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, sr * 2, sr);
    const nd = this.noise.getChannelData(0);
    let seed = 1234567;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < nd.length; i++) nd[i] = rnd();

    const irLen = Math.floor(sr * 1.7);
    const ir = ctx.createBuffer(2, irLen, sr);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < irLen; i++) d[i] = rnd() * Math.pow(1 - i / irLen, 2.6);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.musicGain);

    // 25% pulse wave for chiptune leads.
    const n = 32;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25);
    this.pulseWave = ctx.createPeriodicWave(real, imag);
  }

  setVolumes(music, sfx) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicGain.gain.setTargetAtTime(music, t, 0.03);
    this.sfxGain.gain.setTargetAtTime(sfx, t, 0.03);
  }

  /** Output latency the browser reports, in seconds. */
  get latency() {
    if (!this.ctx) return 0;
    const l = this.ctx.outputLatency || this.ctx.baseLatency || 0;
    return clamp(l, 0, 0.3);
  }

  /** A smooth, monotonic audio clock (ctx.currentTime only ticks in blocks). */
  now() {
    const ctx = this.ctx;
    if (!ctx) return performance.now() / 1000;
    const ct = ctx.currentTime;
    if (ctx.state !== 'running') return ct;
    const perf = performance.now() / 1000;
    if (ct !== this._lastCtxT) {
      this._lastCtxT = ct;
      this._perfAtCtx = perf;
    }
    const t = ct + Math.min(perf - this._perfAtCtx, 0.04);
    if (t < this._mono && this._mono - t < 0.05) return this._mono;
    this._mono = t;
    return t;
  }

  /** Audio-clock time of a DOM event (compensates for event dispatch delay). */
  timeOfEvent(e) {
    const t = this.now();
    if (!e || !e.timeStamp) return t;
    const lag = (performance.now() - e.timeStamp) / 1000;
    // Some older browsers stamp events on a different clock; ignore nonsense.
    if (!(lag >= 0 && lag < 0.25)) return t;
    return t - Math.min(lag, 0.1);
  }

  // -------------------------------------------------------------------------
  // Sound effects
  // -------------------------------------------------------------------------

  _noiseSrc(t, dur) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.start(t, Math.random() * 1.5, dur + 0.05);
    return src;
  }

  _blip(freq0, freq1, dur, vol, type = 'sine', dest = this.sfxGain, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = when || ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, freq1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  sfxHit(quality) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const f = quality === 'perfect' ? 4200 : quality === 'great' ? 2800 : 1700;
    const src = this._noiseSrc(t, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = 1.4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(bp).connect(g).connect(this.sfxGain);
    this._blip(quality === 'perfect' ? 1320 : 990, 660, 0.05, 0.09, 'triangle');
  }

  sfxTap() {
    this._blip(260, 180, 0.04, 0.07, 'triangle');
  }

  sfxMiss() {
    this._blip(150, 70, 0.16, 0.22, 'sawtooth');
  }

  sfxHoldDone() {
    this._blip(1568, 2093, 0.12, 0.09, 'sine');
    this._blip(2093, 3136, 0.16, 0.06, 'sine', this.sfxGain, this.ctx ? this.ctx.currentTime + 0.05 : 0);
  }

  sfxUi(kind = 'tap') {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    if (kind === 'tap') this._blip(620, 880, 0.06, 0.12, 'sine');
    else if (kind === 'back') this._blip(520, 330, 0.08, 0.12, 'sine');
    else if (kind === 'move') this._blip(740, 820, 0.035, 0.07, 'triangle');
    else if (kind === 'go') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this._blip(f, f, 0.16, 0.1, 'triangle', this.sfxGain, t + i * 0.055));
    } else if (kind === 'star') {
      this._blip(1318, 1318, 0.25, 0.12, 'sine');
      this._blip(1976, 1976, 0.3, 0.07, 'sine', this.sfxGain, t + 0.04);
    } else if (kind === 'locked') this._blip(200, 150, 0.12, 0.12, 'square');
  }

  sfxFanfare(big) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05;
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] : [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      this._blip(f, f, 0.5, 0.09, 'triangle', this.sfxGain, t + i * 0.09);
      this._blip(f * 2, f * 2, 0.4, 0.03, 'sine', this.sfxGain, t + i * 0.09);
    });
  }

  /** Synthesised "woof". pitch ~0.7 (big dog) .. 1.6 (small dog). */
  bark(pitch = 1, vol = 0.5, when = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = when || ctx.currentTime;
    const dur = 0.15 / Math.sqrt(pitch);
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(240 * pitch, t);
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
    const n = this._noiseSrc(t, dur);
    const ng = ctx.createGain();
    ng.gain.value = 0.22;
    n.connect(ng);
    ng.connect(f1);
    o.connect(f1);
    o.connect(f2);
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;
    f2.connect(g2).connect(g);
    f1.connect(g).connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.25);
  }

  /** "Awoooo" — the HOWL TIME call. */
  howl(vol = 0.4) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = 1.5;
    for (const [mult, v, delay] of [[1, vol, 0], [1.5, vol * 0.45, 0.12], [0.75, vol * 0.4, 0.22]]) {
      const t0 = t + delay;
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(310 * mult, t0);
      o.frequency.exponentialRampToValueAtTime(600 * mult, t0 + 0.35);
      o.frequency.setValueAtTime(600 * mult, t0 + 0.9);
      o.frequency.exponentialRampToValueAtTime(440 * mult, t0 + dur);
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 6;
      const lg = ctx.createGain();
      lg.gain.setValueAtTime(0, t0);
      lg.gain.linearRampToValueAtTime(9 * mult, t0 + 0.7);
      lfo.connect(lg).connect(o.frequency);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(650, t0);
      bp.frequency.linearRampToValueAtTime(1050, t0 + 0.4);
      bp.Q.value = 1.6;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(v, t0 + 0.18);
      g.gain.setTargetAtTime(0, t0 + dur - 0.35, 0.12);
      o.connect(bp).connect(g);
      g.connect(this.sfxGain);
      g.connect(this.reverb);
      o.start(t0);
      lfo.start(t0);
      o.stop(t0 + dur + 0.5);
      lfo.stop(t0 + dur + 0.5);
    }
  }

  /** Short woodblock click, used by the calibration metronome. */
  click(when, accent = false) {
    this._blip(accent ? 1500 : 1100, accent ? 1500 : 1100, 0.05, 0.3, 'triangle', this.sfxGain, when);
  }
}

// ---------------------------------------------------------------------------
// A playing song: its own mixer + instruments + scheduler.
// ---------------------------------------------------------------------------

export class SongPlayer {
  /**
   * @param {AudioEngine} engine
   * @param {object} compiled  result of compileSong()
   * @param {object} opts      { loop: {t0,t1} | null, volume, muffled }
   */
  constructor(engine, compiled, opts = {}) {
    this.engine = engine;
    this.compiled = compiled;
    this.opts = opts;
    this.sound = compiled.song.sound;
    this.kit = KITS[this.sound.kit] || KITS.pop;
    this.beat = compiled.beat;
    this.started = false;
    this.stopped = false;
    this.idx = 0;
    this.cycle = 0;
    this.onEvent = null; // (event, ctxTime) => void, for visuals

    if (opts.loop) {
      const { t0, t1 } = opts.loop;
      this.list = compiled.events.filter((e) => e.t >= t0 - 1e-6 && e.t < t1 - 1e-6).map((e) => ({ ...e, t: e.t - t0 }));
      this.loopLen = t1 - t0;
    } else {
      this.list = compiled.events;
      this.loopLen = 0;
    }
    this._buildMixer();
  }

  _buildMixer() {
    const ctx = this.engine.ctx;
    const s = (this.mix = {});
    s.out = ctx.createGain();
    s.out.gain.value = 0.0001;
    if (this.opts.muffled) {
      s.tone = ctx.createBiquadFilter();
      s.tone.type = 'lowpass';
      s.tone.frequency.value = 2400;
      s.out.connect(s.tone).connect(this.engine.musicGain);
    } else {
      s.out.connect(this.engine.musicGain);
    }
    s.rev = ctx.createGain();
    s.rev.gain.value = 1;
    s.rev.connect(this.engine.reverb);

    s.drums = ctx.createGain();
    s.drums.gain.value = 0.9;
    s.drums.connect(s.out);
    s.drumRev = ctx.createGain();
    s.drumRev.gain.value = this.kit.room;
    s.drumRev.connect(s.rev);
    s.hatHP = ctx.createBiquadFilter();
    s.hatHP.type = 'highpass';
    s.hatHP.frequency.value = 7200;
    s.hatHP.connect(s.drums);
    s.snareBP = ctx.createBiquadFilter();
    s.snareBP.type = 'bandpass';
    s.snareBP.frequency.value = this.kit.snare[1];
    s.snareBP.Q.value = 0.7;
    s.snareBP.connect(s.drums);
    s.snareBP.connect(s.drumRev);

    // Everything harmonic is side-chained to the kick through `pump`.
    s.pump = ctx.createGain();
    s.pump.connect(s.out);
    s.bass = ctx.createGain();
    s.bass.gain.value = this.sound.bass === 'sub' ? 0.3 : this.sound.bass === 'square' ? 0.34 : 0.4;
    s.bassLP = ctx.createBiquadFilter();
    s.bassLP.type = 'lowpass';
    s.bassLP.frequency.value = this.sound.bass === 'sub' ? 420 : 900;
    s.bassLP.connect(s.bass).connect(s.pump);

    s.padLP = ctx.createBiquadFilter();
    s.padLP.type = 'lowpass';
    s.padLP.frequency.value = this.sound.pad === 'bright' ? 2600 : 1500;
    s.padLP.Q.value = 0.5;
    s.pad = ctx.createGain();
    s.pad.gain.value = 0.16;
    s.padLP.connect(s.pad).connect(s.pump);
    s.pad.connect(s.rev);

    s.keys = ctx.createGain();
    s.keys.gain.value = 0.38;
    s.keys.connect(s.pump);
    s.keysRev = ctx.createGain();
    s.keysRev.gain.value = 0.3;
    s.keys.connect(s.keysRev).connect(s.rev);

    // Lead goes through a tempo-synced delay; its gain ducks when you miss.
    s.lead = ctx.createGain(); // ducked on misses
    s.lead.gain.value = 1;
    s.leadOut = ctx.createGain();
    s.leadOut.gain.value = 0.9;
    s.lead.connect(s.leadOut).connect(s.out);
    s.delay = ctx.createDelay(1.5);
    s.delay.delayTime.value = Math.min(1.4, this.beat * 0.75);
    s.fb = ctx.createGain();
    s.fb.gain.value = 0.32;
    s.delayLP = ctx.createBiquadFilter();
    s.delayLP.type = 'lowpass';
    s.delayLP.frequency.value = 2600;
    s.send = ctx.createGain();
    s.send.gain.value = this.sound.delay ?? 0.2;
    s.leadOut.connect(s.send).connect(s.delay);
    s.keys.connect(s.send);
    s.delay.connect(s.delayLP).connect(s.fb).connect(s.delay);
    s.delayLP.connect(s.out);
    s.leadRev = ctx.createGain();
    s.leadRev.gain.value = 0.22;
    s.leadOut.connect(s.leadRev).connect(s.rev);
  }

  /** Begin playback so that song-time `from` happens at ctx time `when`. */
  start(when, from = 0) {
    const ctx = this.engine.ctx;
    this.t0 = when - from;
    this.started = true;
    const vol = this.opts.volume ?? 1;
    this.mix.out.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.mix.out.gain.linearRampToValueAtTime(vol, ctx.currentTime + (this.opts.fadeIn ?? 0.05));
    if (!this.loopLen) {
      this.idx = this.list.findIndex((e) => e.t >= from - 1e-6);
      if (this.idx < 0) this.idx = this.list.length;
    }
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  /** Current song time in seconds (un-compensated for output latency). */
  time() {
    return this.engine.now() - this.t0;
  }

  tick() {
    if (!this.started || this.stopped) return;
    const ctx = this.engine.ctx;
    if (ctx.state !== 'running') return;
    const horizon = ctx.currentTime + 0.22;
    let guard = 0;
    while (guard++ < 400) {
      if (this.idx >= this.list.length) {
        if (!this.loopLen) break;
        this.idx = 0;
        this.cycle++;
      }
      const e = this.list[this.idx];
      const when = this.t0 + e.t + this.cycle * this.loopLen;
      if (when > horizon) break;
      this.idx++;
      // Skip anything we are already too late for (e.g. after a long stall).
      if (when < ctx.currentTime - 0.08) continue;
      this.play(e, Math.max(when, ctx.currentTime));
      if (this.onEvent) this.onEvent(e, when);
    }
  }

  /** Schedule the whole song at once (used for offline rendering in tests). */
  scheduleAll(startAt = 0.1) {
    this.t0 = startAt + this.compiled.leadIn;
    this.mix.out.gain.value = this.opts.volume ?? 1;
    for (const e of this.list) this.play(e, this.t0 + e.t);
  }

  setLeadLevel(level, fast = true) {
    const ctx = this.engine.ctx;
    this.mix.lead.gain.setTargetAtTime(level, ctx.currentTime, fast ? 0.02 : 0.12);
  }

  stop(fade = 0.25) {
    if (this.stopped) return;
    this.stopped = true;
    clearInterval(this.timer);
    const ctx = this.engine.ctx;
    const t = ctx.currentTime;
    const out = this.mix.out;
    out.gain.cancelScheduledValues(t);
    out.gain.setValueAtTime(out.gain.value, t);
    out.gain.linearRampToValueAtTime(0.0001, t + fade);
    this.mix.fb.gain.setTargetAtTime(0, t, 0.05);
    setTimeout(() => {
      try {
        out.disconnect();
        this.mix.rev.disconnect();
      } catch { /* already gone */ }
    }, (fade + 0.3) * 1000);
  }

  // ---- instruments --------------------------------------------------------

  play(e, t) {
    switch (e.k) {
      case 'kick': return this.kick(t, e.v);
      case 'snare': return this.snare(t, e.v);
      case 'hat': return this.hat(t, e.v, false);
      case 'ohat': return this.hat(t, e.v, true);
      case 'clap': return this.clap(t, e.v);
      case 'crash': return this.crash(t, e.v);
      case 'tom': return this.tom(t, e.v, e.m);
      case 'tick': return this.tickSound(t, e.v);
      case 'bass': return this.bass(t, e.m, e.d);
      case 'pad': return this.pad(t, e.ms, e.d);
      case 'stab': return this.stab(t, e.ms, e.d, e.v);
      case 'arp': return this.arp(t, e.m, e.d, e.v);
      case 'lead': return this.lead(t, e.m, e.d);
      default: return undefined;
    }
  }

  _osc(type, freq, t, stopAt) {
    const o = this.engine.ctx.createOscillator();
    if (type === 'pulse') o.setPeriodicWave(this.engine.pulseWave);
    else o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(stopAt);
    return o;
  }

  _env(t, attack, peak, decay, sustain, dur, release) {
    const g = this.engine.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * sustain, t + attack, decay);
    g.gain.setTargetAtTime(0, t + Math.max(dur, attack + 0.01), release);
    return g;
  }

  kick(t, v) {
    const ctx = this.engine.ctx;
    const [f0, f1, dec] = this.kit.kick;
    const o = this._osc('sine', f0, t, t + dec + 0.1);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.82, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(g).connect(this.mix.drums);
    // Beater click so the kick reads on phone speakers.
    const c = this._osc('triangle', 1100, t, t + 0.03);
    c.frequency.exponentialRampToValueAtTime(240, t + 0.02);
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(v * 0.35, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    c.connect(cg).connect(this.mix.drums);

    const pump = this.sound.pump || 0;
    if (pump > 0) {
      const p = this.mix.pump.gain;
      p.setValueAtTime(1 - pump * v, t);
      p.linearRampToValueAtTime(1, t + this.beat * 0.42);
    }
  }

  snare(t, v) {
    const ctx = this.engine.ctx;
    const [dec, , tone] = this.kit.snare;
    const n = this.engine._noiseSrc(t, dec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.75, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    n.connect(g).connect(this.mix.snareBP);
    const o = this._osc('triangle', tone * 1.5, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(tone, t + 0.06);
    const og = ctx.createGain();
    og.gain.setValueAtTime(v * 0.4, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og).connect(this.mix.drums);
  }

  hat(t, v, open) {
    const ctx = this.engine.ctx;
    const dec = open ? 0.22 : 0.045;
    const n = this.engine._noiseSrc(t, dec);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * this.kit.hat * (open ? 0.5 : 0.6), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dec);
    n.connect(g).connect(this.mix.hatHP);
  }

  clap(t, v) {
    const ctx = this.engine.ctx;
    const n = this.engine._noiseSrc(t, 0.2);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    for (let i = 0; i < 3; i++) {
      g.gain.setValueAtTime(v * 0.7, t + i * 0.011);
      g.gain.exponentialRampToValueAtTime(v * 0.12, t + i * 0.011 + 0.009);
    }
    g.gain.setValueAtTime(v * 0.6, t + 0.033);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.19);
    n.connect(bp).connect(g);
    g.connect(this.mix.drums);
    g.connect(this.mix.drumRev);
  }

  crash(t, v) {
    const ctx = this.engine.ctx;
    const n = this.engine._noiseSrc(t, 1.4);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 4200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.42, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
    n.connect(hp).connect(g);
    g.connect(this.mix.drums);
    g.connect(this.mix.drumRev);
  }

  tom(t, v, m) {
    const ctx = this.engine.ctx;
    const f = midiToFreq(m);
    const o = this._osc('sine', f * 1.6, t, t + 0.28);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(v * 0.7, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
    o.connect(g).connect(this.mix.drums);
  }

  tickSound(t, v) {
    const ctx = this.engine.ctx;
    const o = this._osc('triangle', v > 0.9 ? 1568 : 1175, t, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.32 * v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this.mix.drums);
  }

  bass(t, m, d) {
    const ctx = this.engine.ctx;
    const f = midiToFreq(m);
    const type = this.sound.bass;
    const end = t + d + 0.25;
    if (type === 'saw') {
      const o = this._osc('sawtooth', f, t, end);
      const o2 = this._osc('square', f / 2, t, end);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 5;
      lp.frequency.setValueAtTime(260, t);
      lp.frequency.linearRampToValueAtTime(1500, t + 0.015);
      lp.frequency.setTargetAtTime(380, t + 0.02, 0.07);
      const g = this._env(t, 0.006, 0.7, 0.08, 0.7, d, 0.03);
      const g2 = ctx.createGain();
      g2.gain.value = 0.35;
      o.connect(lp);
      o2.connect(g2).connect(lp);
      lp.connect(g).connect(this.mix.bass);
    } else if (type === 'square') {
      const o = this._osc('square', f, t, end);
      const o2 = this._osc('triangle', f, t, end);
      const g = this._env(t, 0.004, 0.5, 0.06, 0.6, d, 0.02);
      o.connect(g);
      o2.connect(g);
      g.connect(this.mix.bassLP);
    } else if (type === 'sub') {
      const o = this._osc('sine', f, t, end);
      const o2 = this._osc('triangle', f * 2, t, end);
      const g = this._env(t, 0.012, 0.95, 0.2, 0.7, d, 0.06);
      const g2 = ctx.createGain();
      g2.gain.value = 0.22;
      o.connect(g);
      o2.connect(g2).connect(g);
      g.connect(this.mix.bassLP);
    } else {
      // round: plucky electric bass
      const o = this._osc('triangle', f, t, end);
      const o2 = this._osc('sawtooth', f, t, end);
      const o3 = this._osc('sine', f / 2, t, end);
      const g = this._env(t, 0.004, 0.9, 0.09, 0.45, d, 0.03);
      const g2 = ctx.createGain();
      g2.gain.value = 0.25;
      const g3 = ctx.createGain();
      g3.gain.value = 0.5;
      o.connect(g);
      o2.connect(g2).connect(g);
      o3.connect(g3).connect(g);
      g.connect(this.mix.bassLP);
    }
  }

  pad(t, ms, d) {
    const end = t + d + 0.8;
    const g = this._env(t, 0.09, 0.5, 0.3, 0.85, d - 0.02, 0.14);
    for (const m of ms) {
      const f = midiToFreq(m);
      const a = this._osc('sawtooth', f, t, end);
      const b = this._osc('sawtooth', f, t, end);
      a.detune.value = -9;
      b.detune.value = 9;
      a.connect(g);
      b.connect(g);
    }
    g.connect(this.mix.padLP);
  }

  stab(t, ms, d, v) {
    const ctx = this.engine.ctx;
    const type = this.sound.stab;
    const end = t + d + 0.5;
    if (type === 'ep') {
      // Mellow electric piano: sine + soft bell partial.
      const g = this._env(t, 0.008, 0.26 * v, 0.5, 0.25, d, 0.18);
      for (const m of ms) {
        const f = midiToFreq(m);
        this._osc('sine', f, t, end + 0.6).connect(g);
        const pg = ctx.createGain();
        pg.gain.setValueAtTime(0.25, t);
        pg.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        this._osc('sine', f * 4, t, t + 0.4).connect(pg).connect(g);
      }
      g.connect(this.mix.keys);
    } else if (type === 'organ') {
      const g = this._env(t, 0.004, 0.2 * v, 0.05, 0.8, d * 0.7, 0.012);
      for (const m of ms) {
        const f = midiToFreq(m);
        this._osc('square', f, t, end).connect(g);
        this._osc('triangle', f * 2, t, end).connect(g);
      }
      g.connect(this.mix.keys);
    } else {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 2;
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.setTargetAtTime(700, t + 0.01, 0.07);
      const g = this._env(t, 0.004, 0.2 * v, 0.09, 0.2, d, 0.05);
      for (const m of ms) {
        const f = midiToFreq(m);
        this._osc('sawtooth', f, t, end).connect(lp);
        this._osc('square', f, t, end).connect(lp);
      }
      lp.connect(g).connect(this.mix.keys);
    }
  }

  arp(t, m, d, v) {
    const ctx = this.engine.ctx;
    const f = midiToFreq(m);
    const end = t + d + 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(3600, t);
    lp.frequency.setTargetAtTime(900, t + 0.01, 0.05);
    const g = this._env(t, 0.003, 0.2 * v, 0.06, 0.25, d, 0.04);
    this._osc(this.sound.stab === 'ep' ? 'triangle' : 'sawtooth', f, t, end).connect(lp);
    lp.connect(g).connect(this.mix.keys);
  }

  lead(t, m, d) {
    const ctx = this.engine.ctx;
    const f = midiToFreq(m);
    const type = this.sound.lead;
    const end = t + d + 0.6;
    const vibrato = (targets, depth) => {
      if (d < 0.3) return;
      const lfo = this._osc('sine', 5.6, t, end);
      const lg = ctx.createGain();
      lg.gain.value = 0;
      lg.gain.setValueAtTime(0, t + 0.16);
      lg.gain.linearRampToValueAtTime(f * depth, t + 0.4);
      lfo.connect(lg);
      targets.forEach((o) => lg.connect(o.frequency));
    };

    if (type === 'bell') {
      const g = this._env(t, 0.004, 0.36, Math.max(0.35, d * 0.7), 0.12, d + 0.1, 0.3);
      const a = this._osc('sine', f, t, end + 0.8);
      const b = this._osc('triangle', f * 2, t, end);
      const c = this._osc('sine', f * 3.01, t, t + 0.5);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.28, t);
      bg.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
      const cg = ctx.createGain();
      cg.gain.setValueAtTime(0.2, t);
      cg.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      a.connect(g);
      b.connect(bg).connect(g);
      c.connect(cg).connect(g);
      g.connect(this.mix.lead);
      return;
    }

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1.2;
    let g;
    const oscs = [];
    if (type === 'chip') {
      oscs.push(this._osc('pulse', f, t, end));
      const o2 = this._osc('pulse', f * 2, t, end);
      const g2 = ctx.createGain();
      g2.gain.value = 0.2;
      o2.connect(g2).connect(lp);
      oscs.push(o2);
      oscs[0].connect(lp);
      lp.frequency.value = 5200;
      g = this._env(t, 0.003, 0.6, 0.08, 0.75, d, 0.03);
    } else if (type === 'square') {
      const a = this._osc('square', f, t, end);
      const b = this._osc('triangle', f, t, end);
      b.detune.value = 7;
      a.connect(lp);
      b.connect(lp);
      oscs.push(a, b);
      lp.frequency.setValueAtTime(3400, t);
      lp.frequency.setTargetAtTime(1900, t + 0.01, 0.1);
      g = this._env(t, 0.006, 0.24, 0.1, 0.75, d, 0.04);
    } else if (type === 'super') {
      for (const cents of [-14, 0, 14]) {
        const o = this._osc('sawtooth', f, t, end);
        o.detune.value = cents;
        o.connect(lp);
        oscs.push(o);
      }
      lp.frequency.setValueAtTime(5200, t);
      lp.frequency.setTargetAtTime(2600, t + 0.01, 0.12);
      g = this._env(t, 0.005, 0.24, 0.1, 0.8, d, 0.06);
    } else {
      // saw
      for (const cents of [-8, 8]) {
        const o = this._osc('sawtooth', f, t, end);
        o.detune.value = cents;
        o.connect(lp);
        oscs.push(o);
      }
      lp.Q.value = 2.5;
      lp.frequency.setValueAtTime(4200, t);
      lp.frequency.setTargetAtTime(1700, t + 0.01, 0.14);
      g = this._env(t, 0.008, 0.25, 0.12, 0.8, d, 0.06);
    }
    vibrato(oscs, 0.006);
    lp.connect(g).connect(this.mix.lead);
  }
}
