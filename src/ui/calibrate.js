// Tap-along latency measurement. Plays a steady click; the median distance
// between the player's taps and the clicks becomes the audio delay setting.

import { clamp } from '../util.js';

const $ = (id) => document.getElementById(id);
const INTERVAL = 0.6;
const NEEDED = 12;

export class Calibrator {
  constructor(engine, { onOpen, onClose }) {
    this.engine = engine;
    this.onOpen = onOpen;
    this.onClose = onClose;
    this.active = false;
    this.taps = [];
    this.result = null;
    $('cal-pad').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.tap(e);
    });
    $('cal-cancel').addEventListener('click', () => this.close(false));
    $('cal-apply').addEventListener('click', () => this.close(true));
  }

  async open() {
    if (!this.engine.ok) return;
    await this.engine.resume();
    this.onOpen();
    this.active = true;
    this.taps = [];
    this.result = null;
    $('cal-status').textContent = `0 / ${NEEDED} taps`;
    $('cal-apply').disabled = true;
    $('modal-calibrate').hidden = false;
    this.t0 = this.engine.ctx.currentTime + 0.5;
    this.next = 0;
    this.timer = setInterval(() => this._schedule(), 50);
    this._schedule();
    const pad = $('cal-pad');
    const flash = () => {
      if (!this.active) return;
      const t = this.engine.now() - this.engine.latency - this.t0;
      const ph = ((t % INTERVAL) + INTERVAL) % INTERVAL;
      pad.classList.toggle('beat', t > 0 && ph < 0.1);
      requestAnimationFrame(flash);
    };
    requestAnimationFrame(flash);
  }

  _schedule() {
    const ctx = this.engine.ctx;
    while (this.t0 + this.next * INTERVAL < ctx.currentTime + 0.3) {
      this.engine.click(this.t0 + this.next * INTERVAL, this.next % 4 === 0);
      this.next++;
    }
  }

  tap(e) {
    if (!this.active) return;
    const t = this.engine.timeOfEvent(e) - this.t0;
    if (t < -0.2) return;
    let d = ((t % INTERVAL) + INTERVAL) % INTERVAL;
    if (d > INTERVAL / 2) d -= INTERVAL;
    this.taps.push(d);
    const pad = $('cal-pad');
    pad.classList.add('hit');
    setTimeout(() => pad.classList.remove('hit'), 90);
    const n = this.taps.length;
    if (n >= NEEDED) {
      const sorted = this.taps.slice(2).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      // The game already subtracts the latency the browser reports.
      const ms = Math.round(((median - this.engine.latency) * 1000) / 5) * 5;
      this.result = clamp(ms, -150, 300);
      $('cal-status').textContent = `Measured ${this.result > 0 ? '+' : ''}${this.result} ms. Keep tapping to refine.`;
      $('cal-apply').disabled = false;
    } else {
      $('cal-status').textContent = `${n} / ${NEEDED} taps`;
    }
  }

  close(apply) {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.timer);
    $('modal-calibrate').hidden = true;
    this.onClose(apply && this.result != null ? this.result : null);
  }
}
