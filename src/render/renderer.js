// Canvas renderer: scenery, the stage and its dogs, the note highway,
// particles and the in-game HUD.

import { TAU, clamp, lerp, rgba, mix, ease, formatScore } from '../util.js';
import { THEMES } from './backgrounds.js';
import {
  BAND, LANE_COLORS, LANE_COLORS_DARK, DogActor, drawDogBody, drawDogHead, drawInstrumentIcon, fillPaw, roundRect,
} from './dogs.js';
import { HIT, HOLDING, MISSED, HELD, BROKEN } from '../game/play.js';

export const FONT = 'Fredoka, ui-rounded, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const JUDGE_STYLE = {
  perfect: { text: 'PERFECT', color: '#FFE45C' },
  great: { text: 'GREAT', color: '#5CE1FF' },
  good: { text: 'GOOD', color: '#9CF58A' },
  miss: { text: 'MISS', color: '#FF7A8A' },
};
const MAX_PARTICLES = 260;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.dogs = [0, 1, 2, 3].map((i) => new DogActor(i));
    this.dogPos = this.dogs.map(() => ({ x: 0, y: 0, r: 20, init: false }));
    this.particles = [];
    this.pose = 'title';
    this.hw = 0; // highway visibility 0..1
    this.themeId = 'backyard';
    this.bg = null;
    this.bgOld = null;
    this.bgFade = 1;
    this.laneFlash = [0, 0, 0, 0];
    this.laneHit = [0, 0, 0, 0];
    this.judge = { quality: null, age: 9 };
    this.banner = { text: '', age: 9, color: '#fff', dur: 1.6 };
    this.comboPop = 0;
    this.shownScore = 0;
    this.shake = 0;
    this.howlGlow = 0;
    this.reduced = false;
    this.safe = { t: 0, b: 0, l: 0, r: 0 };
    this.t = 0;
    this.noteHead = 0;
    this.lastGame = null;
    this.areas = {};
    this.W = 0;
    this.H = 0;
  }

  // ------------------------------------------------------------------ setup

  resize(safe) {
    if (safe) this.safe = safe;
    const W = Math.max(200, this.canvas.clientWidth);
    const H = Math.max(200, this.canvas.clientHeight);
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const maxPixels = 3.4e6;
    if (W * H * dpr * dpr > maxPixels) dpr = Math.sqrt(maxPixels / (W * H));
    this.dpr = dpr;
    this.W = W;
    this.H = H;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this._layout();
    this._sprites();
    this.bg = this._paintBg(this.themeId);
    this.bgOld = null;
    this.bgFade = 1;
    this.dogPos.forEach((p) => (p.init = false));
  }

  _layout() {
    const { W, H, safe } = this;
    const portrait = W < H * 0.9;
    const L = (this.L = { W, H, portrait });
    L.cx = W / 2;
    // Touch screens held sideways get a wider highway so thumbs can reach every lane.
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    L.hwW = portrait ? Math.min(W * 0.96, 600) : coarse ? Math.min(W * 0.72, H * 1.5, 760) : Math.min(W * 0.5, H * 0.8, 700);
    L.laneW = L.hwW / 4;
    L.hitY = H - safe.b - (portrait ? Math.max(H * 0.125, 92) : H * 0.15);
    L.stageY = portrait ? safe.t + Math.max(H * 0.33, 250) : H * 0.4;
    L.far = 0.66;
    L.K = 1 / L.far - 1;
    L.vanY = (L.stageY - L.far * L.hitY) / (1 - L.far);
    L.noteR = Math.min(L.laneW * 0.37, (L.hitY - L.stageY) * 0.17);
    L.U = Math.min(W, H * 1.15);
    L.horizon = L.stageY - (portrait ? H * 0.02 : H * 0.03);

    let spacingPlay = portrait ? Math.min(L.laneW * 0.94, (W - 12) / 4) : L.laneW * 0.86;
    const rPlay = Math.min(spacingPlay * 0.4, (L.stageY - safe.t - 6) / 3.75);
    spacingPlay = Math.min(spacingPlay, rPlay * 2.9);
    L.poses = {
      play: { spacing: spacingPlay, r: rPlay, y: L.stageY - rPlay * 2.12, cx: L.cx },
      title: this._fit({ x0: 0, x1: W, y0: H * 0.36, y1: H * 0.8 }, true),
      select: this._fit({ x0: 0, x1: W, y0: safe.t + 70, y1: H * 0.42 }, true),
      results: this._fit({ x0: 0, x1: W, y0: safe.t + 10, y1: H * 0.3 }, false),
    };
    for (const name of Object.keys(this.areas)) L.poses[name] = this._fit(this.areas[name], name !== 'results');
  }

  /** Fit the four dogs (and their name plates) into a screen rectangle. */
  _fit(area, names) {
    const w = Math.max(40, area.x1 - area.x0);
    const h = Math.max(40, area.y1 - area.y0);
    const units = names ? 4.8 : 3.9;
    const r = clamp(Math.min(h / units, w / 10.4), 14, 96);
    return { r, spacing: r * 2.5, y: area.y0 + (h - units * r) / 2 + 1.5 * r, cx: (area.x0 + area.x1) / 2 };
  }

  /** Tell the renderer where the menus leave room for the band. */
  setArea(pose, area) {
    this.areas[pose] = area;
    if (this.L) this.L.poses[pose] = this._fit(area, pose !== 'results');
  }

  _sprites() {
    const size = Math.round(Math.min(256, Math.max(96, this.L.noteR * 2.9 * this.dpr)));
    this.noteSprites = LANE_COLORS.map((col, i) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d');
      const m = size / 2;
      const R = size * 0.345;
      const g0 = c.createRadialGradient(m, m, R * 0.7, m, m, size * 0.5);
      g0.addColorStop(0, rgba(col, 0.55));
      g0.addColorStop(1, rgba(col, 0));
      c.fillStyle = g0;
      c.fillRect(0, 0, size, size);
      const g = c.createLinearGradient(0, m - R, 0, m + R);
      g.addColorStop(0, mix(col, '#FFFFFF', 0.45));
      g.addColorStop(0.5, col);
      g.addColorStop(1, LANE_COLORS_DARK[i]);
      c.fillStyle = g;
      c.beginPath();
      c.arc(m, m, R, 0, TAU);
      c.fill();
      c.lineWidth = size * 0.045;
      c.strokeStyle = '#FFFFFF';
      c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.28)';
      c.beginPath();
      c.ellipse(m, m - R * 0.48, R * 0.62, R * 0.3, 0, 0, TAU);
      c.fill();
      c.save();
      c.translate(m, m + R * 0.04);
      c.fillStyle = 'rgba(60,20,20,0.25)';
      c.translate(0, R * 0.05);
      fillPaw(c, R * 1.0);
      c.translate(0, -R * 0.05);
      c.fillStyle = '#FFFFFF';
      fillPaw(c, R * 1.0);
      c.restore();
      return cv;
    });
    this.glowSprites = [...LANE_COLORS, '#FFFFFF', '#FFE45C'].map((col) => {
      const cv = document.createElement('canvas');
      cv.width = cv.height = 96;
      const c = cv.getContext('2d');
      const g = c.createRadialGradient(48, 48, 0, 48, 48, 48);
      g.addColorStop(0, rgba(col, 0.9));
      g.addColorStop(0.35, rgba(col, 0.38));
      g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.fillRect(0, 0, 96, 96);
      return cv;
    });
  }

  _paintBg(themeId) {
    const cv = document.createElement('canvas');
    cv.width = this.canvas.width;
    cv.height = this.canvas.height;
    const c = cv.getContext('2d');
    c.scale(this.dpr, this.dpr);
    THEMES[themeId].paint(c, this.W, this.H, this.L.horizon, this.L.U);
    return cv;
  }

  setTheme(id, instant = false) {
    if (!THEMES[id] || (id === this.themeId && this.bg)) return;
    if (!this.L) {
      this.themeId = id; // painted on the first resize
      return;
    }
    this.bgOld = instant ? null : this.bg;
    this.bgOldTheme = this.themeId;
    this.themeId = id;
    this.bg = this._paintBg(id);
    this.bgFade = instant ? 1 : 0;
  }

  setPose(pose) {
    this.pose = pose;
  }

  // -------------------------------------------------------------- game hooks

  resetForSong() {
    this.noteHead = 0;
    this.shownScore = 0;
    this.judge.age = 9;
    this.banner.age = 9;
    this.particles.length = 0;
    this.comboPop = 0;
    this.dogs.forEach((d) => (d.howlTarget = 0));
  }

  padPos(lane) {
    return { x: this.L.cx + (lane - 1.5) * this.L.laneW, y: this.L.hitY };
  }

  laneFromX(x) {
    const L = this.L;
    return clamp(Math.floor((x - (L.cx - L.hwW / 2)) / L.laneW), 0, 3);
  }

  onPress(lane) {
    this.laneFlash[lane] = 1;
  }

  onJudge(lane, quality, combo) {
    this.judge = { quality, age: 0 };
    this.dogs[lane].react(quality);
    if (quality === 'miss') {
      if (!this.reduced) this.shake = Math.max(this.shake, 0.35);
      return;
    }
    this.laneHit[lane] = 1;
    this.comboPop = 1;
    const { x, y } = this.padPos(lane);
    const n = this.reduced ? 4 : quality === 'perfect' ? 12 : quality === 'great' ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
      const sp = this.L.laneW * (2 + Math.random() * 4);
      this._spawn({ type: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.35 + Math.random() * 0.25, size: this.L.laneW * (0.05 + Math.random() * 0.05), color: quality === 'perfect' && i % 3 === 0 ? 5 : lane, g: 2.2 });
    }
    this._spawn({ type: 'ring', x, y, life: 0.32, size: this.L.noteR, color: lane });
    if (quality === 'perfect') this._spawn({ type: 'ring', x, y, life: 0.42, size: this.L.noteR * 1.25, color: 5 });
    // a music note floats up from the dog who "played" it
    const d = this.dogPos[lane];
    this._spawn({ type: 'note', x: d.x + (Math.random() - 0.5) * d.r, y: d.y - d.r, vx: (Math.random() - 0.5) * d.r * 1.5, vy: -d.r * 2.6, life: 0.9, size: d.r * 0.4, color: lane, g: -0.3, rot: (Math.random() - 0.5) * 0.6 });
    if (combo && combo % 50 === 0) this.showBanner(`${combo} COMBO!`, '#FFE45C', 1.1);
  }

  onHoldTick(lane) {
    this.laneHit[lane] = Math.max(this.laneHit[lane], 0.7);
    if (this.reduced && Math.random() < 0.6) return;
    const { x, y } = this.padPos(lane);
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
    const sp = this.L.laneW * (2 + Math.random() * 3);
    this._spawn({ type: 'spark', x: x + (Math.random() - 0.5) * this.L.noteR, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.4, size: this.L.laneW * 0.05, color: lane, g: 1.5 });
  }

  onHoldDone(lane) {
    const { x, y } = this.padPos(lane);
    this._spawn({ type: 'ring', x, y, life: 0.45, size: this.L.noteR * 1.3, color: 4 });
    for (let i = 0; i < (this.reduced ? 3 : 8); i++) {
      const a = (i / 8) * TAU;
      this._spawn({ type: 'star', x, y, vx: Math.cos(a) * this.L.laneW * 3, vy: Math.sin(a) * this.L.laneW * 3, life: 0.5, size: this.L.laneW * 0.11, color: 5, g: 0, rot: a });
    }
    this.dogs[lane].react('bark');
  }

  setHowl(on) {
    this.dogs.forEach((d) => (d.howlTarget = on ? 1 : 0));
    if (on) {
      this.showBanner('HOWL TIME!  ×2', '#FFE45C', 1.7);
      if (!this.reduced) this.shake = 0.5;
    }
  }

  showBanner(text, color = '#FFFFFF', dur = 1.5) {
    this.banner = { text, color, age: 0, dur };
  }

  confetti(n = 110) {
    if (this.reduced) n = 30;
    for (let i = 0; i < n; i++) {
      this._spawn({
        type: 'confetti', x: Math.random() * this.W, y: -20 - Math.random() * this.H * 0.4,
        vx: (Math.random() - 0.5) * 80, vy: 120 + Math.random() * 220, life: 3 + Math.random() * 1.5,
        size: 6 + Math.random() * 7, color: Math.floor(Math.random() * 6), g: 0.1, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 10,
      });
    }
  }

  cheer() {
    this.dogs.forEach((d, i) => setTimeout(() => d.react('cheer'), i * 90));
  }

  _spawn(p) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    p.age = 0;
    this.particles.push(p);
  }

  // ------------------------------------------------------------------ frame

  /**
   * @param fs { dt, beat (0..1 pulse), beatCount, game, time, approach, hype,
   *             keys (labels or null), countdown ({text, age} | null), progress, songTitle }
   */
  draw(fs) {
    const c = this.c;
    const L = this.L;
    const dt = Math.min(fs.dt, 0.05);
    this.t += dt;
    const game = fs.game;
    if (game !== this.lastGame) {
      this.lastGame = game;
      this.noteHead = 0;
    }

    // ---- animate state ----
    const playing = this.pose === 'play';
    this.hw = lerp(this.hw, playing ? 1 : 0, 1 - Math.exp(-dt * 7));
    this.bgFade = Math.min(1, this.bgFade + dt * 2.2);
    const howlOn = !!(game && game.howlActive);
    this.howlGlow = lerp(this.howlGlow, howlOn ? 1 : 0, 1 - Math.exp(-dt * 5));
    this.shake = Math.max(0, this.shake - dt * 2.4);
    this.comboPop = Math.max(0, this.comboPop - dt * 6);
    this.judge.age += dt;
    this.banner.age += dt;
    for (let i = 0; i < 4; i++) {
      const held = game && game.pressed[i];
      this.laneFlash[i] = held ? Math.max(this.laneFlash[i], 0.55) : Math.max(0, this.laneFlash[i] - dt * 5);
      this.laneHit[i] = Math.max(0, this.laneHit[i] - dt * 3.2);
      this.dogs[i].update(dt);
    }
    const pose = L.poses[this.pose] || L.poses.title;
    const k = 1 - Math.exp(-dt * 6.5);
    this.dogPos.forEach((p, i) => {
      const tx = pose.cx + (i - 1.5) * pose.spacing;
      if (!p.init) {
        p.x = tx;
        p.y = pose.y;
        p.r = pose.r;
        p.init = true;
      } else {
        p.x = lerp(p.x, tx, k);
        p.y = lerp(p.y, pose.y, k);
        p.r = lerp(p.r, pose.r, k);
      }
    });
    if (game) this.shownScore = lerp(this.shownScore, game.score, 1 - Math.exp(-dt * 14));

    // ---- draw ----
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    this._drawBg(fs);

    c.save();
    if (this.shake > 0.01) {
      const s = this.shake * this.shake * 9;
      c.translate(Math.sin(this.t * 71) * s, Math.cos(this.t * 83) * s);
    }
    if (this.hw > 0.01) {
      this._drawHighway(fs);
      if (game) this._drawNotes(fs);
    }
    this._drawStage(fs);
    this._drawParticles(dt);
    c.restore();

    if (this.hw > 0.01 && game) {
      this._drawHowlOverlay(fs);
      this._drawJudge();
      this._drawHud(fs);
    }
    this._drawBanner(fs);
  }

  _drawBg(fs) {
    const c = this.c;
    const { W, H } = this;
    const L = this.L;
    if (this.bgOld && this.bgFade < 1) {
      c.drawImage(this.bgOld, 0, 0, W, H);
      c.globalAlpha = ease.inOutCubic(this.bgFade);
    }
    c.drawImage(this.bg, 0, 0, W, H);
    const theme = THEMES[this.themeId];
    theme.animate(c, { W, H, hY: L.horizon, U: L.U, t: this.t, beat: this.reduced ? 0 : fs.beat, energy: Math.max(this.howlGlow, fs.hype ? 0.6 : 0) });
    c.globalAlpha = 1;
    if (this.bgFade >= 1) this.bgOld = null;
  }

  _proj(p) {
    const L = this.L;
    const d = 1 - Math.min(p, 1.45);
    const s = 1 / (1 + d * L.K);
    return { s, y: L.vanY + (L.hitY - L.vanY) * s };
  }

  _edgeX(y, side) {
    const L = this.L;
    return L.cx + side * (L.hwW / 2) * ((y - L.vanY) / (L.hitY - L.vanY));
  }

  _drawHighway(fs) {
    const c = this.c;
    const L = this.L;
    const { H } = this;
    const a = this.hw;
    const top = L.stageY;
    const bottom = H + 4;
    const theme = THEMES[this.themeId];
    c.save();
    c.globalAlpha = a;
    c.translate(0, (1 - a) * H * 0.25);

    // surface
    const surf = c.createLinearGradient(0, top, 0, bottom);
    surf.addColorStop(0, 'rgba(16,12,40,0.86)');
    surf.addColorStop(1, 'rgba(8,6,22,0.96)');
    c.fillStyle = surf;
    c.beginPath();
    c.moveTo(this._edgeX(top, -1), top);
    c.lineTo(this._edgeX(top, 1), top);
    c.lineTo(this._edgeX(bottom, 1), bottom);
    c.lineTo(this._edgeX(bottom, -1), bottom);
    c.closePath();
    c.fill();

    // lane tints + press beams
    for (let i = 0; i < 4; i++) {
      const x0t = L.cx + (i - 2) * L.laneW * L.far, x1t = L.cx + (i - 1) * L.laneW * L.far;
      const sb = (bottom - L.vanY) / (L.hitY - L.vanY);
      const x0b = L.cx + (i - 2) * L.laneW * sb, x1b = L.cx + (i - 1) * L.laneW * sb;
      const g = c.createLinearGradient(0, top, 0, L.hitY);
      const glow = 0.1 + this.laneFlash[i] * 0.3 + this.laneHit[i] * 0.25;
      g.addColorStop(0, rgba(LANE_COLORS[i], 0.02));
      g.addColorStop(1, rgba(LANE_COLORS[i], glow));
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(x0t, top);
      c.lineTo(x1t, top);
      c.lineTo(x1b, bottom);
      c.lineTo(x0b, bottom);
      c.closePath();
      c.fill();
    }

    // beat lines scroll with the music
    if (fs.game && fs.beatDur) {
      const t = fs.time;
      const first = Math.ceil(t / fs.beatDur);
      const last = Math.floor((t + fs.approach) / fs.beatDur);
      for (let b = first; b <= last; b++) {
        const p = 1 - (b * fs.beatDur - t) / fs.approach;
        const { s, y } = this._proj(p);
        const bar = b % 4 === 0;
        c.strokeStyle = bar ? 'rgba(255,255,255,0.26)' : 'rgba(255,255,255,0.08)';
        c.lineWidth = bar ? 2 : 1;
        c.beginPath();
        c.moveTo(L.cx - (L.hwW / 2) * s, y);
        c.lineTo(L.cx + (L.hwW / 2) * s, y);
        c.stroke();
      }
    }

    // lane separators
    c.strokeStyle = 'rgba(255,255,255,0.09)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < 4; i++) {
      const sb = (bottom - L.vanY) / (L.hitY - L.vanY);
      c.moveTo(L.cx + (i - 2) * L.laneW * L.far, top);
      c.lineTo(L.cx + (i - 2) * L.laneW * sb, bottom);
    }
    c.stroke();

    // rails
    for (const side of [-1, 1]) {
      c.strokeStyle = rgba(theme.accent2, 0.25);
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(this._edgeX(top, side), top);
      c.lineTo(this._edgeX(bottom, side), bottom);
      c.stroke();
      c.strokeStyle = rgba(theme.accent2, 0.95);
      c.lineWidth = 2;
      c.stroke();
    }

    // combo, printed on the floor
    const game = fs.game;
    if (game && game.combo >= 5) {
      const { s, y } = this._proj(0.42);
      const size = L.laneW * 1.15 * s * (1 + this.comboPop * 0.12);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.font = `700 ${size}px ${FONT}`;
      c.fillStyle = game.howlActive ? 'rgba(255,228,92,0.3)' : 'rgba(255,255,255,0.17)';
      c.fillText(String(game.combo), L.cx, y);
      c.font = `600 ${size * 0.2}px ${FONT}`;
      c.fillText('C O M B O', L.cx, y + size * 0.62);
    }

    // hit line + pads
    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(L.cx - L.hwW / 2, L.hitY);
    c.lineTo(L.cx + L.hwW / 2, L.hitY);
    c.stroke();
    for (let i = 0; i < 4; i++) {
      const x = L.cx + (i - 1.5) * L.laneW;
      const flash = this.laneFlash[i];
      const hit = this.laneHit[i];
      const R = L.noteR * (1 + hit * 0.12 - flash * 0.04);
      if (flash > 0.02 || hit > 0.02) {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = a * clamp(flash * 0.45 + hit * 0.6, 0, 1);
        const gs = R * 3.4;
        c.drawImage(this.glowSprites[i], x - gs / 2, L.hitY - gs / 2, gs, gs);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = a;
      }
      c.fillStyle = 'rgba(6,5,18,0.6)';
      c.beginPath();
      c.arc(x, L.hitY, R, 0, TAU);
      c.fill();
      c.strokeStyle = mix(LANE_COLORS[i], '#FFFFFF', flash * 0.7);
      c.lineWidth = Math.max(2.5, L.laneW * 0.045);
      c.stroke();
      c.strokeStyle = rgba(LANE_COLORS[i], 0.35);
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(x, L.hitY, R * 0.72, 0, TAU);
      c.stroke();
      if (fs.keys) {
        c.fillStyle = rgba(LANE_COLORS[i], 0.85);
        c.font = `700 ${L.noteR * 0.72}px ${FONT}`;
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(fs.keys[i], x, L.hitY + L.noteR * 0.04);
      } else {
        c.fillStyle = rgba(LANE_COLORS[i], 0.4);
        c.save();
        c.translate(x, L.hitY);
        fillPaw(c, R * 0.72);
        c.restore();
      }
    }
    c.restore();
  }

  _drawNotes(fs) {
    const c = this.c;
    const L = this.L;
    const game = fs.game;
    const notes = game.notes;
    const t = fs.time;
    const ap = fs.approach;
    while (this.noteHead < notes.length && Math.max(notes[this.noteHead].t, notes[this.noteHead].end) < t - 0.6) this.noteHead++;
    let lastIdx = this.noteHead - 1;
    for (let i = this.noteHead; i < notes.length && notes[i].t <= t + ap; i++) lastIdx = i;

    c.save();
    c.globalAlpha = this.hw;
    for (let i = lastIdx; i >= this.noteHead; i--) {
      const n = notes[i];
      if (n.state === HIT || n.state === HELD) continue;
      const dim = n.state === MISSED || n.state === BROKEN;
      let p = 1 - (n.t - t) / ap;
      if (n.state === HOLDING) p = 1;
      if (n.state === BROKEN) p = 1 + (t - (n.brokeT ?? t)) / ap;
      const laneOff = (n.lane - 1.5) * L.laneW;

      if (n.hold) {
        const pt = clamp(1 - (n.end - t) / ap, 0, 1.4);
        const ph = Math.min(p, 1.4);
        if (ph > 0 && pt < 1.4 && ph > pt) {
          const a = this._proj(ph);
          const b = this._proj(pt);
          const w = L.laneW * 0.19;
          const col = LANE_COLORS[n.lane];
          const active = n.state === HOLDING;
          c.fillStyle = dim ? 'rgba(150,150,170,0.28)' : rgba(col, active ? 0.9 : 0.6);
          c.beginPath();
          c.moveTo(L.cx + (laneOff - w) * a.s, a.y);
          c.lineTo(L.cx + (laneOff + w) * a.s, a.y);
          c.lineTo(L.cx + (laneOff + w) * b.s, b.y);
          c.lineTo(L.cx + (laneOff - w) * b.s, b.y);
          c.closePath();
          c.fill();
          c.beginPath();
          c.arc(L.cx + laneOff * b.s, b.y, w * b.s, 0, TAU);
          c.fill();
          if (!dim) {
            c.strokeStyle = active ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)';
            c.lineWidth = Math.max(2, w * 0.3);
            c.lineCap = 'round';
            c.beginPath();
            c.moveTo(L.cx + laneOff * a.s, a.y);
            c.lineTo(L.cx + laneOff * b.s, b.y);
            c.stroke();
          }
        }
      }

      if (p < 0 || p > 1.42) continue;
      const { s, y } = this._proj(p);
      const size = L.noteR * 2.9 * s;
      const x = L.cx + laneOff * s;
      const fade = clamp(p * 7, 0, 1) * (dim ? 0.3 : 1) * (p > 1.2 ? clamp((1.42 - p) / 0.22, 0, 1) : 1);
      c.globalAlpha = this.hw * fade;
      c.drawImage(this.noteSprites[n.lane], x - size / 2, y - size / 2, size, size);
      c.globalAlpha = this.hw;
    }
    c.restore();
  }

  _drawStage(fs) {
    const c = this.c;
    const L = this.L;
    const beat = this.reduced ? fs.beat * 0.4 : fs.beat;
    const theme = THEMES[this.themeId];
    const P = this.dogPos;
    const r = P[0].r;
    const left = P[0].x - r * 1.45;
    const right = P[3].x + r * 1.45;
    const baseY = P[0].y + r * 2.2;

    // spotlights
    if (this.hw > 0.05 || this.howlGlow > 0.05) {
      c.save();
      c.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const p = P[i];
        const a = (0.07 + this.laneHit[i] * 0.2 + this.howlGlow * 0.14) * Math.max(this.hw, this.howlGlow);
        const sx = p.x + (i - 1.5) * r * 1.2;
        const g = c.createLinearGradient(0, 0, 0, p.y + r);
        g.addColorStop(0, rgba(LANE_COLORS[i], a));
        g.addColorStop(1, rgba(LANE_COLORS[i], 0));
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(sx - r * 0.25, -10);
        c.lineTo(sx + r * 0.25, -10);
        c.lineTo(p.x + r * 1.5, p.y + r * 1.2);
        c.lineTo(p.x - r * 1.5, p.y + r * 1.2);
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    // riser shadow + slab
    c.fillStyle = 'rgba(0,0,0,0.28)';
    c.beginPath();
    c.ellipse((left + right) / 2, baseY + r * 0.22, (right - left) * 0.56, r * 0.3, 0, 0, TAU);
    c.fill();

    // dog bodies (behind podiums)
    for (let i = 0; i < 4; i++) drawDogBody(c, this.dogs[i], P[i].x, P[i].y, P[i].r, beat);

    // podiums
    for (let i = 0; i < 4; i++) {
      const p = P[i];
      const w = p.r * 2.06, h = p.r * 0.92;
      const x = p.x - w / 2, y = p.y + p.r * 1.3;
      const g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, '#2B2850');
      g.addColorStop(1, '#131128');
      c.fillStyle = g;
      roundRect(c, x, y, w, h, p.r * 0.2);
      c.fill();
      c.strokeStyle = mix(LANE_COLORS[i], '#FFFFFF', this.laneHit[i] * 0.6);
      c.lineWidth = Math.max(2, p.r * 0.075);
      c.stroke();
      // LED strip pulses with the beat
      c.fillStyle = rgba(LANE_COLORS[i], 0.35 + beat * 0.5 + this.laneHit[i] * 0.3);
      roundRect(c, x + w * 0.12, y + h * 0.76, w * 0.76, h * 0.09, h * 0.045);
      c.fill();
      drawInstrumentIcon(c, i, p.x, y + h * 0.42, p.r * 0.56, LANE_COLORS[i]);
      if (this.laneHit[i] > 0.02) {
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = this.laneHit[i] * 0.55;
        const gs = p.r * 4.4;
        c.drawImage(this.glowSprites[i], p.x - gs / 2, y + h * 0.4 - gs / 2, gs, gs);
        c.restore();
      }
    }
    // slab
    const sg = c.createLinearGradient(0, baseY - r * 0.05, 0, baseY + r * 0.3);
    sg.addColorStop(0, '#1D1A3A');
    sg.addColorStop(1, '#0B0A1C');
    c.fillStyle = sg;
    roundRect(c, left, baseY - r * 0.06, right - left, r * 0.32, r * 0.12);
    c.fill();
    c.fillStyle = rgba(theme.accent2, 0.9);
    roundRect(c, left + r * 0.1, baseY - r * 0.06, right - left - r * 0.2, Math.max(2, r * 0.05), 1);
    c.fill();

    // heads + paws
    for (let i = 0; i < 4; i++) drawDogHead(c, this.dogs[i], P[i].x, P[i].y, P[i].r, beat, LANE_COLORS[i]);

    // name plates (menus only)
    const na = 1 - clamp(this.hw * 2, 0, 1);
    if (na > 0.02 && this.pose !== 'results') {
      c.save();
      c.globalAlpha = na;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      for (let i = 0; i < 4; i++) {
        const p = P[i];
        const y = baseY + p.r * 0.72;
        c.font = `700 ${p.r * 0.46}px ${FONT}`;
        const tw = c.measureText(BAND[i].name).width + p.r * 0.56;
        c.fillStyle = 'rgba(12,10,30,0.72)';
        roundRect(c, p.x - tw / 2, y - p.r * 0.34, tw, p.r * 0.68, p.r * 0.34);
        c.fill();
        c.fillStyle = LANE_COLORS[i];
        c.fillText(BAND[i].name, p.x, y + p.r * 0.03);
      }
      c.restore();
    }
  }

  _drawParticles(dt) {
    const c = this.c;
    const ps = this.particles;
    let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) continue;
      ps[w++] = p;
      const k = p.age / p.life;
      if (p.type !== 'ring') {
        p.vy += (p.g || 0) * this.L.laneW * 6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.vr) p.rot += p.vr * dt;
      }
      const col = [...LANE_COLORS, '#FFFFFF', '#FFE45C'][p.color];
      if (p.type === 'spark') {
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = 1 - k;
        const s = p.size * (1.6 - k) * 2.2;
        c.drawImage(this.glowSprites[p.color], p.x - s, p.y - s, s * 2, s * 2);
        c.globalCompositeOperation = 'source-over';
      } else if (p.type === 'ring') {
        c.globalAlpha = (1 - k) * 0.9;
        c.strokeStyle = col;
        c.lineWidth = Math.max(1.5, p.size * 0.14 * (1 - k));
        c.beginPath();
        c.arc(p.x, p.y, p.size * (1 + ease.outCubic(k) * 1.1), 0, TAU);
        c.stroke();
      } else if (p.type === 'note') {
        c.globalAlpha = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85;
        c.save();
        c.translate(p.x, p.y);
        c.rotate(p.rot || 0);
        const s = p.size;
        c.fillStyle = col;
        c.strokeStyle = 'rgba(20,14,40,0.55)';
        c.lineWidth = s * 0.16;
        c.beginPath();
        c.ellipse(-s * 0.2, s * 0.5, s * 0.42, s * 0.32, -0.35, 0, TAU);
        c.stroke();
        c.fill();
        c.beginPath();
        c.moveTo(s * 0.14, s * 0.42);
        c.lineTo(s * 0.14, -s * 0.9);
        c.quadraticCurveTo(s * 0.5, -s * 0.7, s * 0.72, -s * 0.2);
        c.lineWidth = s * 0.34;
        c.lineCap = 'round';
        c.stroke();
        c.strokeStyle = col;
        c.lineWidth = s * 0.2;
        c.stroke();
        c.restore();
      } else if (p.type === 'star') {
        c.globalAlpha = 1 - k;
        c.fillStyle = col;
        c.save();
        c.translate(p.x, p.y);
        c.rotate((p.rot || 0) + k * 3);
        const s = p.size * (1 - k * 0.4);
        c.beginPath();
        for (let j = 0; j < 10; j++) {
          const rr = j % 2 ? s * 0.45 : s;
          c.lineTo(Math.cos((j / 10) * TAU) * rr, Math.sin((j / 10) * TAU) * rr);
        }
        c.closePath();
        c.fill();
        c.restore();
      } else if (p.type === 'confetti') {
        c.globalAlpha = clamp((p.life - p.age) * 2, 0, 1);
        c.fillStyle = col;
        c.save();
        c.translate(p.x + Math.sin(p.age * 3 + p.rot) * 14, p.y);
        c.rotate(p.rot);
        c.scale(1, Math.cos(p.age * 7 + p.rot));
        c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        c.restore();
      }
    }
    ps.length = w;
    c.globalAlpha = 1;
  }

  _drawHowlOverlay(fs) {
    const g = this.howlGlow;
    if (g < 0.02) return;
    const c = this.c;
    const { W, H } = this;
    c.save();
    c.globalCompositeOperation = 'lighter';
    const pulse = this.reduced ? 0.5 : 0.35 + fs.beat * 0.65;
    const a = g * (0.16 + pulse * 0.16);
    for (const [x0, x1] of [[0, W * 0.3], [W, W * 0.7]]) {
      const grad = c.createLinearGradient(x0, 0, x1, 0);
      grad.addColorStop(0, `rgba(255,214,80,${a})`);
      grad.addColorStop(1, 'rgba(255,95,168,0)');
      c.fillStyle = grad;
      c.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
    }
    c.restore();
  }

  _text(str, x, y, size, color, { weight = 700, align = 'left', stroke = 'rgba(14,10,34,0.9)', sw = 0.16, base = 'alphabetic' } = {}) {
    const c = this.c;
    c.font = `${weight} ${size}px ${FONT}`;
    c.textAlign = align;
    c.textBaseline = base;
    if (stroke) {
      c.lineJoin = 'round';
      c.strokeStyle = stroke;
      c.lineWidth = size * sw;
      c.strokeText(str, x, y);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);
  }

  _drawJudge() {
    const j = this.judge;
    if (!j.quality || j.age > 0.6) return;
    const c = this.c;
    const L = this.L;
    const st = JUDGE_STYLE[j.quality];
    const pop = 1 + 0.3 * Math.exp(-j.age * 16);
    const size = clamp(L.laneW * 0.33, 20, 44) * pop;
    c.save();
    c.globalAlpha = this.hw * (j.age < 0.4 ? 1 : 1 - (j.age - 0.4) / 0.2);
    const lift = L.hitY - L.stageY < 320 ? 2.3 : 3.1;
    this._text(st.text, L.cx, L.hitY - L.noteR * lift - j.age * 22, size, st.color, { align: 'center', base: 'middle' });
    c.restore();
  }

  _drawHud(fs) {
    const c = this.c;
    const L = this.L;
    const { W, safe } = this;
    const game = fs.game;
    const a = this.hw;
    c.save();
    c.globalAlpha = a;

    // top scrim keeps the HUD readable on bright stages
    const scrimH = safe.t + 118;
    const sg = c.createLinearGradient(0, 0, 0, scrimH);
    sg.addColorStop(0, 'rgba(8,6,24,0.62)');
    sg.addColorStop(1, 'rgba(8,6,24,0)');
    c.fillStyle = sg;
    c.fillRect(0, 0, W, scrimH);

    // song progress
    const theme = THEMES[this.themeId];
    c.fillStyle = 'rgba(255,255,255,0.16)';
    c.fillRect(0, safe.t, W, 4);
    c.fillStyle = theme.accent2;
    c.fillRect(0, safe.t, W * clamp(fs.progress, 0, 1), 4);

    const hs = clamp(Math.min(W, this.H) / 760, 1, 1.5);
    const x = 16 + safe.l;
    const y = safe.t + 20;
    const big = (L.portrait ? 30 : 34) * hs;
    const small = 11 * hs;
    this._text('SCORE', x, y + 4, small, 'rgba(255,255,255,0.75)', { weight: 600, stroke: null });
    this._text(formatScore(this.shownScore), x, y + 8 + big * 0.9, big, '#FFFFFF');
    c.font = `700 ${big}px ${FONT}`;
    const sw = c.measureText(formatScore(this.shownScore)).width;

    // multiplier chip
    const mult = game.mult * (game.howlActive ? 2 : 1);
    const chipX = x + sw + 12;
    const chipY = y + 8 + big * 0.9 - big * 0.78;
    const chipW = big * 1.5, chipH = big * 0.86;
    const chipCol = game.howlActive ? '#FFE45C' : ['#8C8FA8', '#5CE1FF', '#9CF58A', '#FF8A3D'][game.mult - 1];
    c.fillStyle = chipCol;
    roundRect(c, chipX, chipY, chipW, chipH, chipH / 2);
    c.fill();
    this._text(`×${mult}`, chipX + chipW / 2, chipY + chipH / 2 + 1, big * 0.56, '#14102E', { align: 'center', base: 'middle', stroke: null });

    // howl meter
    const my = y + big + 26 * hs;
    const mw = L.portrait ? Math.min(W - x * 2, 520) : Math.min(300 * hs, W * 0.22);
    const mh = 12 * hs;
    c.fillStyle = 'rgba(10,8,30,0.6)';
    roundRect(c, x, my, mw, mh, mh / 2);
    c.fill();
    const fill = clamp(game.howl, 0, 1);
    if (fill > 0.01) {
      const g = c.createLinearGradient(x, 0, x + mw, 0);
      if (game.howlActive) {
        const sh = (this.t * 0.9) % 1;
        g.addColorStop(0, '#FFE45C');
        g.addColorStop(clamp(sh, 0.01, 0.99), '#FFFFFF');
        g.addColorStop(1, '#FF5FA8');
      } else {
        g.addColorStop(0, '#7B6BFF');
        g.addColorStop(1, '#FF5FA8');
      }
      c.fillStyle = g;
      roundRect(c, x, my, Math.max(mh, mw * fill), mh, mh / 2);
      c.fill();
    }
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.5;
    roundRect(c, x, my, mw, mh, mh / 2);
    c.stroke();
    const howlLabel = game.howlActive ? (mw < 260 ? 'HOWL TIME ×2' : 'HOWL TIME!  DOUBLE POINTS') : 'HOWL METER';
    this._text(howlLabel, x + 2, my + mh + small * 1.3, small, game.howlActive ? '#FFE45C' : 'rgba(255,255,255,0.75)', { weight: 600, stroke: 'rgba(14,10,34,0.7)', sw: 0.3 });
    const acc = (game.accuracy * 100).toFixed(1) + '%';
    this._text(acc, x + mw, my + mh + small * 1.3, small, 'rgba(255,255,255,0.85)', { weight: 600, align: 'right', stroke: 'rgba(14,10,34,0.7)', sw: 0.3 });
    c.restore();
  }

  _drawBanner(fs) {
    const c = this.c;
    const { W, H } = this;
    const L = this.L;
    // count-in numbers
    if (fs.countdown && fs.countdown.text) {
      const k = clamp(fs.countdown.age / 0.5, 0, 1);
      const size = Math.min(W * 0.3, H * 0.2) * (1.3 - 0.3 * ease.outCubic(k));
      c.save();
      c.globalAlpha = 1 - k * k * 0.85;
      this._text(fs.countdown.text, W / 2, (L.stageY + L.hitY) / 2, size, '#FFFFFF', { align: 'center', base: 'middle', sw: 0.12 });
      c.restore();
    }
    const b = this.banner;
    if (b.text && b.age < b.dur) {
      const k = b.age / b.dur;
      const inK = ease.outBack(clamp(b.age / 0.25, 0, 1));
      const size = Math.min(W * 0.115, H * 0.085, 76) * inK;
      c.save();
      c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      this._text(b.text, W / 2, L.stageY + (L.hitY - L.stageY) * 0.2, Math.max(1, size), b.color, { align: 'center', base: 'middle', sw: 0.2 });
      c.restore();
    }
  }
}
