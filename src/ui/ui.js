// DOM menus: title, song select, results, pause, settings, how-to.

import { SONGS, DIFFICULTIES, DIFF_LABEL } from '../audio/songs.js';
import { THEMES } from '../render/backgrounds.js';
import { getBest, songStars, totalStars, save } from '../storage.js';
import { formatScore, formatTime, clamp } from '../util.js';

const $ = (id) => document.getElementById(id);
const STAR = '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M7 10V8a5 5 0 0 1 10 0v2h1.2c.7 0 1.3.6 1.3 1.3v8.4c0 .7-.6 1.3-1.3 1.3H5.8c-.7 0-1.3-.6-1.3-1.3v-8.4c0-.7.6-1.3 1.3-1.3zm2.4 0h5.2V8a2.6 2.6 0 0 0-5.2 0z"/></svg>';

const starsHtml = (n, cls = 'stars') =>
  `<span class="${cls}" aria-label="${n} of 3 stars">${[0, 1, 2].map((i) => `<svg viewBox="0 0 24 24" class="${i < n ? 'on' : ''}" style="animation-delay:${0.5 + i * 0.22}s">${STAR}</svg>`).join('')}</span>`;

export class UI {
  constructor(handlers, durations) {
    this.h = handlers;
    this.durations = durations; // songId -> seconds
    this.index = 0;
    this.diff = 'normal';
    this.screen = 'title';
    this.cards = [];
    this._scrollRaf = 0;
    this._programmatic = 0;
    this._build();
    this._bind();
  }

  // ----------------------------------------------------------------- build

  _build() {
    const car = $('carousel');
    car.innerHTML = '';
    SONGS.forEach((song, i) => {
      const theme = THEMES[song.theme];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'card';
      card.dataset.index = String(i);
      card.innerHTML = `
        <div class="card-art"><div class="card-level"></div></div>
        <div class="card-body">
          <h3>${song.title}</h3>
          <div class="card-meta">${song.genre} · ${song.bpm} BPM · ${formatTime(this.durations[song.id])}</div>
          <div class="card-blurb">${song.blurb}</div>
          <div class="card-best"></div>
        </div>`;
      // Real scenery thumbnail, painted by the same code as the stage.
      const cv = document.createElement('canvas');
      cv.width = 640;
      cv.height = 300;
      const c = cv.getContext('2d');
      c.scale(2, 2);
      theme.paint(c, 320, 150, 104, 190);
      card.querySelector('.card-art').prepend(cv);
      car.appendChild(card);
      this.cards.push(card);
    });

    const row = $('diff-row');
    row.innerHTML = DIFFICULTIES.map(
      (d) => `<button type="button" class="diff" role="radio" data-diff="${d}" aria-checked="false">${DIFF_LABEL[d]}<small></small></button>`,
    ).join('');
    this.diffBtns = [...row.querySelectorAll('.diff')];
  }

  _bind() {
    const h = this.h;
    const click = (id, fn, sound = 'tap') => $(id).addEventListener('click', (e) => {
      h.sound(sound);
      fn(e);
    });
    click('btn-start', () => h.start(), 'go');
    click('btn-play', () => this._tryPlay(), 'none');
    click('btn-howto', () => this.openModal('howto'));
    click('btn-settings', () => this.openModal('settings'));
    click('btn-pause', () => h.pause(), 'none');
    click('btn-resume', () => h.resume(), 'none');
    click('btn-restart', () => h.restart(), 'none');
    click('btn-quit', () => h.quit(), 'none');
    click('btn-pause-settings', () => this.openModal('settings'), 'none');
    click('btn-retry', () => h.retry(), 'go');
    click('btn-songs', () => h.songs(), 'back');
    click('nav-prev', () => this.select(this.index - 1), 'move');
    click('nav-next', () => this.select(this.index + 1), 'move');
    click('btn-calibrate', () => h.calibrate());
    click('btn-fullscreen', () => h.fullscreen());

    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      h.sound('back');
      this.closeModal(b.closest('.modal').id.replace('modal-', ''));
    }));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => {
      if (e.target === m && (m.id === 'modal-settings' || m.id === 'modal-howto')) this.closeModal(m.id.replace('modal-', ''));
    }));

    this.cards.forEach((card, i) => card.addEventListener('click', () => {
      if (i === this.index) this._tryPlay();
      else {
        h.sound('move');
        this.select(i);
      }
    }));
    this.diffBtns.forEach((b) => b.addEventListener('click', () => {
      h.sound('move');
      this.setDiff(b.dataset.diff);
    }));

    const car = $('carousel');
    car.addEventListener('scroll', () => {
      if (this._scrollRaf) return;
      this._scrollRaf = requestAnimationFrame(() => {
        this._scrollRaf = 0;
        if (performance.now() < this._programmatic) return;
        const mid = car.scrollLeft + car.clientWidth / 2;
        let best = 0, bestD = Infinity;
        this.cards.forEach((c, i) => {
          const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        if (best !== this.index) this.select(best, { scroll: false });
      });
    }, { passive: true });

    // settings
    const s = save().settings;
    const bindRange = (id, key, fmt, scale = 1) => {
      const el = $(`set-${id}`);
      const out = $(`val-${id}`);
      el.value = String(s[key] * scale);
      out.textContent = fmt(Number(el.value));
      el.addEventListener('input', () => {
        s[key] = Number(el.value) / scale;
        out.textContent = fmt(Number(el.value));
        h.settings(key);
      });
    };
    bindRange('music', 'music', (v) => String(v), 100);
    bindRange('sfx', 'sfx', (v) => String(v), 100);
    bindRange('speed', 'speed', (v) => String(v));
    bindRange('offset', 'offset', (v) => `${v > 0 ? '+' : ''}${v} ms`);
    const bindCheck = (id, key) => {
      const el = $(`set-${id}`);
      el.checked = !!s[key];
      el.addEventListener('change', () => {
        s[key] = el.checked;
        h.sound('tap');
        h.settings(key);
      });
    };
    bindCheck('haptics', 'haptics');
    bindCheck('reduced', 'reducedFx');

    let armed = 0;
    $('btn-reset').addEventListener('click', () => {
      const btn = $('btn-reset');
      if (performance.now() < armed) {
        armed = 0;
        btn.textContent = 'Reset progress';
        h.reset();
        this.refresh();
        this.toast('Progress cleared. Fresh start!');
      } else {
        armed = performance.now() + 3000;
        btn.textContent = 'Tap again to erase';
        setTimeout(() => {
          if (armed && performance.now() >= armed) btn.textContent = 'Reset progress';
        }, 3100);
      }
    });
  }

  // ------------------------------------------------------------- screens

  show(screen) {
    this.screen = screen;
    for (const name of ['title', 'select', 'results']) $(`screen-${name}`).hidden = name !== screen;
    $('btn-pause').hidden = screen !== 'play';
    if (screen === 'select') {
      this.refresh();
      requestAnimationFrame(() => this.select(this.index, { instant: true, silent: true }));
    }
  }

  isModalOpen(name) {
    return name ? !$(`modal-${name}`).hidden : [...document.querySelectorAll('.modal')].some((m) => !m.hidden);
  }

  openModal(name) {
    $(`modal-${name}`).hidden = false;
    if (name === 'settings') this.syncSettings();
    const focus = $(`modal-${name}`).querySelector('.btn-primary, [data-close]');
    if (focus) focus.focus({ preventScroll: true });
  }

  closeModal(name) {
    const m = $(`modal-${name}`);
    if (m.hidden) return;
    m.hidden = true;
    this.h.modalClosed(name);
  }

  syncSettings() {
    const s = save().settings;
    $('set-offset').value = String(s.offset);
    $('val-offset').textContent = `${s.offset > 0 ? '+' : ''}${s.offset} ms`;
  }

  toast(text) {
    const t = $('toast');
    t.hidden = true;
    void t.offsetWidth; // restart the animation
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => (t.hidden = true), 3300);
  }

  // -------------------------------------------------------------- select

  isLocked(i) {
    return totalStars(SONGS) < SONGS[i].unlock;
  }

  refresh() {
    const stars = totalStars(SONGS);
    $('star-count').textContent = `${stars}/${SONGS.length * 3}`;
    SONGS.forEach((song, i) => {
      const card = this.cards[i];
      const locked = this.isLocked(i);
      card.classList.toggle('locked', locked);
      const art = card.querySelector('.card-art');
      let lock = art.querySelector('.card-lock');
      if (locked && !lock) {
        lock = document.createElement('div');
        lock.className = 'card-lock';
        art.appendChild(lock);
      }
      if (lock) {
        if (locked) lock.innerHTML = `<span>${LOCK}Earn ${song.unlock} star${song.unlock === 1 ? '' : 's'} to unlock</span>`;
        else lock.remove();
      }
      card.querySelector('.card-level').textContent = `Level ${song.levels[this.diff]}`;
      const best = getBest(song.id, this.diff);
      const el = card.querySelector('.card-best');
      el.innerHTML = best
        ? `${starsHtml(best.stars)}<span>${formatScore(best.score)}</span><span class="grade-chip">${best.grade}</span>`
        : `<span class="none">${locked ? `You have ${stars} of the ${song.unlock} needed` : 'Not played yet'}</span>`;
    });
    this._syncPlay();
  }

  _syncPlay() {
    const song = SONGS[this.index];
    const locked = this.isLocked(this.index);
    const btn = $('btn-play');
    btn.disabled = locked;
    btn.textContent = locked ? 'Locked' : 'Play';
    this.diffBtns.forEach((b) => {
      b.setAttribute('aria-checked', String(b.dataset.diff === this.diff));
      b.querySelector('small').textContent = String(song.levels[b.dataset.diff]);
    });
    $('nav-prev').disabled = this.index === 0;
    $('nav-next').disabled = this.index === SONGS.length - 1;
  }

  select(i, { scroll = true, instant = false, silent = false } = {}) {
    i = clamp(i, 0, SONGS.length - 1);
    const changed = i !== this.index;
    this.index = i;
    this.cards.forEach((c, k) => c.classList.toggle('selected', k === i));
    const theme = THEMES[SONGS[i].theme];
    document.documentElement.style.setProperty('--accent', theme.accent);
    document.documentElement.style.setProperty('--accent2', theme.accent2);
    if (scroll) {
      const car = $('carousel');
      const card = this.cards[i];
      const left = card.offsetLeft + card.offsetWidth / 2 - car.clientWidth / 2;
      this._programmatic = performance.now() + (instant ? 80 : 450);
      car.scrollTo({ left, behavior: instant ? 'auto' : 'smooth' });
    }
    this._syncPlay();
    if (changed || silent) this.h.songChanged(i, silent);
  }

  setDiff(d) {
    if (!DIFFICULTIES.includes(d)) return;
    this.diff = d;
    this.refresh();
    this.h.diffChanged(d);
  }

  _tryPlay() {
    if (this.isLocked(this.index)) {
      this.h.sound('locked');
      const need = SONGS[this.index].unlock - totalStars(SONGS);
      this.toast(`Earn ${need} more star${need === 1 ? '' : 's'} to unlock this stage`);
      return;
    }
    this.h.sound('go');
    this.h.play(this.index, this.diff);
  }

  // ------------------------------------------------------------- results

  showResults(song, diff, r, isBest) {
    $('res-title').textContent = song.title;
    const pill = $('res-diff');
    pill.textContent = DIFF_LABEL[diff];
    pill.dataset.diff = diff;
    const grade = $('res-grade');
    grade.textContent = r.grade;
    grade.dataset.grade = r.grade;
    $('res-stars').innerHTML = starsHtml(r.stars, 'res-stars-inner').replace('class="res-stars-inner"', 'style="display:flex;gap:4px"');
    $('res-acc').textContent = `${(r.acc * 100).toFixed(1)}%`;
    $('res-combo').textContent = `${r.maxCombo}`;
    const flags = [];
    if (isBest) flags.push('<span class="flag best">New best!</span>');
    if (r.allPerfect) flags.push('<span class="flag">All perfect</span>');
    else if (r.fullCombo) flags.push('<span class="flag fc">Full combo</span>');
    $('res-flags').innerHTML = flags.join('');
    const rows = [['perfect', 'Perfect'], ['great', 'Great'], ['good', 'Good'], ['miss', 'Miss']];
    $('res-break').innerHTML = rows
      .map(([k, label]) => `<div class="brk ${k}"><span>${label}</span><i><u data-w="${r.total ? (r.counts[k] / r.total) * 100 : 0}"></u></i><b>${r.counts[k]}</b></div>`)
      .join('');
    this.show('results');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('#res-break u').forEach((u) => (u.style.width = `${u.dataset.w}%`));
    }));
    // score count-up
    const el = $('res-score');
    const t0 = performance.now();
    const tick = (now) => {
      const k = clamp((now - t0) / 1100, 0, 1);
      el.textContent = formatScore(r.score * (1 - Math.pow(1 - k, 3)));
      if (k < 1 && this.screen === 'results') requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /** Keyboard navigation for menus. Returns true when the key was used. */
  key(e) {
    const code = e.code;
    if (this.isModalOpen()) {
      if (code === 'Escape') {
        for (const name of ['calibrate', 'settings', 'howto']) {
          if (this.isModalOpen(name)) {
            if (name === 'calibrate') $('cal-cancel').click();
            else this.closeModal(name);
            return true;
          }
        }
      }
      return false;
    }
    const onButton = e.target && e.target.tagName === 'BUTTON' && (code === 'Enter' || code === 'Space');
    if (onButton) return false; // the browser will click it for us
    if (this.screen === 'title') {
      if (code === 'Enter' || code === 'Space') {
        $('btn-start').click();
        return true;
      }
    } else if (this.screen === 'select') {
      if (e.target && e.target.tagName === 'INPUT') return false;
      if (code === 'ArrowLeft') return this.h.sound('move'), this.select(this.index - 1), true;
      if (code === 'ArrowRight') return this.h.sound('move'), this.select(this.index + 1), true;
      if (code === 'ArrowUp' || code === 'ArrowDown') {
        const k = DIFFICULTIES.indexOf(this.diff) + (code === 'ArrowUp' ? 1 : -1);
        this.h.sound('move');
        this.setDiff(DIFFICULTIES[clamp(k, 0, 2)]);
        return true;
      }
      if (code === 'Enter' || code === 'Space') return this._tryPlay(), true;
    } else if (this.screen === 'results') {
      if (code === 'Enter' || code === 'Space') return $('btn-songs').click(), true;
      if (code === 'KeyR') return $('btn-retry').click(), true;
    }
    return false;
  }
}

export { songStars };
