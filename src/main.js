// MusicDogs — boot, game loop and glue between audio, rules, canvas and menus.

import { AudioEngine, SongPlayer } from './audio/engine.js';
import { SONGS } from './audio/songs.js';
import { compileSong, buildChart } from './audio/compile.js';
import { Game } from './game/play.js';
import { Renderer } from './render/renderer.js';
import { BAND } from './render/dogs.js';
import { UI } from './ui/ui.js';
import { Calibrator } from './ui/calibrate.js';
import { loadSave, save, persist, recordResult, resetProgress, totalStars } from './storage.js';
import { clamp } from './util.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const data = loadSave();
const engine = new AudioEngine();
const renderer = new Renderer(canvas);
const compiledCache = new Map();
const getCompiled = (song) => {
  if (!compiledCache.has(song.id)) compiledCache.set(song.id, compileSong(song));
  return compiledCache.get(song.id);
};
const durations = Object.fromEntries(SONGS.map((s) => [s.id, getCompiled(s).duration]));

const flags = (location.search + location.hash).toLowerCase();
const app = {
  screen: 'title', // title | select | play | results
  songIndex: Math.max(0, SONGS.findIndex((s) => s.id === data.lastSong)),
  diff: data.lastDiff || 'normal',
  game: null,
  player: null,
  preview: null,
  paused: false,
  resuming: false,
  auto: flags.includes('autoplay'),
  usedKeyboard: false,
  wakeLock: null,
};

const KEY_LANES = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const KEY_LABELS = ['D', 'F', 'J', 'K'];

// ---------------------------------------------------------------- helpers

const probe = document.createElement('div');
probe.id = 'safe-probe';
document.body.appendChild(probe);
function readSafe() {
  const cs = getComputedStyle(probe);
  return {
    t: parseFloat(cs.paddingTop) || 0,
    r: parseFloat(cs.paddingRight) || 0,
    b: parseFloat(cs.paddingBottom) || 0,
    l: parseFloat(cs.paddingLeft) || 0,
  };
}

function applySettings() {
  const s = data.settings;
  engine.setVolumes(s.music, s.sfx);
  renderer.reduced = !!s.reducedFx;
}

const approachTime = () => 2.7 - clamp(data.settings.speed, 1, 10) * 0.2;
const judgeOffset = () => engine.latency + data.settings.offset / 1000;

function buzz(ms) {
  if (data.settings.haptics && navigator.vibrate) {
    try {
      navigator.vibrate(ms);
    } catch { /* not allowed here */ }
  }
}

async function wake(on) {
  try {
    if (on && navigator.wakeLock && !app.wakeLock) {
      app.wakeLock = await navigator.wakeLock.request('screen');
      app.wakeLock.addEventListener('release', () => (app.wakeLock = null));
    } else if (!on && app.wakeLock) {
      await app.wakeLock.release();
      app.wakeLock = null;
    }
  } catch { /* wake lock is a nicety */ }
}

// ---------------------------------------------------------------- preview

let previewTimer = 0;
function stopPreview(fade = 0.25) {
  clearTimeout(previewTimer);
  if (app.preview) {
    app.preview.stop(fade);
    app.preview = null;
  }
}

function startPreview(delay = 260, volume = 0.62) {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => {
    if (!engine.ok || app.screen === 'play' || calibrator.active) return;
    stopPreview(0.3);
    const song = SONGS[app.songIndex];
    const comp = getCompiled(song);
    const sec = comp.sections.find((s) => s.name === song.preview) || comp.sections[0];
    app.preview = new SongPlayer(engine, comp, { loop: { t0: sec.t0, t1: sec.t1 }, volume, fadeIn: 0.6 });
    app.preview.start(engine.ctx.currentTime + 0.1, 0);
  }, delay);
}

// ---------------------------------------------------------------- gameplay

function onGameEvent(type, e) {
  switch (type) {
    case 'judge':
      renderer.onJudge(e.lane, e.quality, e.combo);
      if (e.quality === 'miss') {
        if (e.brokeCombo >= 10) engine.sfxMiss();
        app.player.setLeadLevel(0.1);
        buzz(35);
      } else {
        engine.sfxHit(e.quality);
        app.player.setLeadLevel(1);
        buzz(8);
      }
      break;
    case 'ghost':
      engine.sfxTap();
      break;
    case 'holdTick':
      renderer.onHoldTick(e.lane);
      break;
    case 'holdDone':
      renderer.onHoldDone(e.lane);
      engine.sfxHoldDone();
      break;
    case 'holdBreak':
      renderer.dogs[e.lane].react('miss');
      engine.sfxMiss();
      app.player.setLeadLevel(0.1);
      break;
    case 'howl':
      renderer.setHowl(e.on);
      if (e.on) {
        engine.howl(0.34);
        buzz(60);
      }
      break;
    case 'milestone': {
      const i = Math.floor(Math.random() * 4);
      renderer.dogs[i].react('bark');
      engine.bark(BAND[i].pitch, 0.4);
      break;
    }
    case 'finish':
      endSong(e);
      break;
    default:
  }
}

async function startSong(index, diff) {
  if (!engine.ok) {
    ui.toast('This browser cannot play Web Audio, so the band is stuck backstage.');
    return;
  }
  const song = SONGS[index];
  app.songIndex = index;
  app.diff = diff;
  data.lastSong = song.id;
  data.lastDiff = diff;
  persist();

  stopPreview(0.2);
  if (app.player) app.player.stop(0.1);
  await engine.resume();
  const comp = getCompiled(song);
  const chart = buildChart(comp, diff);
  app.game = new Game(comp, chart, { auto: app.auto, emit: onGameEvent });
  app.player = new SongPlayer(engine, comp, { volume: 1 });
  app.player.start(engine.ctx.currentTime + 0.45, -comp.leadIn);
  app.paused = false;
  app.resuming = false;
  app.screen = 'play';
  held.clear();
  renderer.setTheme(song.theme);
  renderer.resetForSong();
  renderer.setPose('play');
  ui.show('play');
  wake(true);
}

function endSong(result) {
  const song = SONGS[app.songIndex];
  const starsBefore = totalStars(SONGS);
  const isBest = !app.auto && recordResult(song.id, app.diff, result);
  const starsAfter = totalStars(SONGS);
  app.screen = 'results';
  app.player.stop(1.2);
  renderer.setPose('results');
  renderer.dogs.forEach((d) => (d.howlTarget = 0));
  ui.showResults(song, app.diff, result, isBest);
  measureSoon();
  wake(false);
  engine.sfxFanfare(result.stars >= 2);
  renderer.cheer();
  if (result.stars >= 2) {
    renderer.confetti();
    setTimeout(() => BAND.forEach((b, i) => engine.bark(b.pitch, 0.3, engine.ctx.currentTime + i * 0.13)), 500);
  }
  const unlocked = SONGS.filter((s) => s.unlock > starsBefore && s.unlock <= starsAfter);
  if (unlocked.length) setTimeout(() => ui.toast(`New stage unlocked: ${unlocked.map((s) => s.title).join(' + ')}`), 1400);
  startPreview(1600, 0.4);
}

function pauseGame() {
  if (app.screen !== 'play' || app.paused || !app.game || app.game.finished) return;
  app.paused = true;
  app.resuming = false;
  clearInterval(resumeTimer);
  $('resume-count').hidden = true;
  engine.suspend();
  releaseAll();
  ui.openModal('pause');
  wake(false);
}

let resumeTimer = 0;
function resumeGame() {
  if (!app.paused || app.resuming) return;
  app.resuming = true;
  $('modal-pause').hidden = true;
  const el = $('resume-count');
  let n = 3;
  el.textContent = String(n);
  el.hidden = false;
  resumeTimer = setInterval(async () => {
    n--;
    if (n > 0) {
      el.textContent = String(n);
      return;
    }
    clearInterval(resumeTimer);
    el.hidden = true;
    await engine.resume();
    app.paused = false;
    app.resuming = false;
    wake(true);
  }, 600);
}

async function quitToSelect() {
  clearInterval(resumeTimer);
  $('resume-count').hidden = true;
  $('modal-pause').hidden = true;
  if (app.player) app.player.stop(0.05);
  app.player = null;
  app.game = null;
  app.paused = false;
  app.resuming = false;
  await engine.resume();
  goSelect();
}

function goSelect() {
  app.screen = 'select';
  renderer.setPose('select');
  renderer.dogs.forEach((d) => (d.howlTarget = 0));
  ui.index = app.songIndex;
  ui.diff = app.diff;
  ui.show('select');
  measureSoon();
  wake(false);
  if (!app.preview) startPreview(200);
  if (!data.seenHowTo) {
    data.seenHowTo = true;
    persist();
    setTimeout(() => ui.openModal('howto'), 350);
  }
}

// ---------------------------------------------------------------- input

const held = new Map(); // pointerId or key code -> lane

function laneInUse(lane, except) {
  for (const [id, l] of held) if (l === lane && id !== except) return true;
  return false;
}

function press(id, lane, e) {
  if (app.screen !== 'play' || app.paused || !app.game || app.auto) return;
  held.set(id, lane);
  const t = engine.timeOfEvent(e) - app.player.t0 - judgeOffset();
  renderer.onPress(lane);
  app.game.press(lane, t);
}

function release(id, e) {
  if (!held.has(id)) return;
  const lane = held.get(id);
  held.delete(id);
  if (!app.game || laneInUse(lane, id)) return;
  const t = engine.timeOfEvent(e) - app.player.t0 - judgeOffset();
  app.game.release(lane, t);
}

function releaseAll() {
  if (app.game && app.player) {
    const t = app.player.time() - judgeOffset();
    for (const lane of new Set(held.values())) app.game.release(lane, t);
  }
  held.clear();
}

canvas.addEventListener('pointerdown', (e) => {
  if (app.screen !== 'play') return;
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  press(`p${e.pointerId}`, renderer.laneFromX(e.clientX - rect.left), e);
});
const pointerEnd = (e) => release(`p${e.pointerId}`, e);
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
// iOS: stop double-tap zoom / rubber-banding while playing.
document.addEventListener('touchmove', (e) => {
  if (app.screen === 'play') e.preventDefault();
}, { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (calibrator.active) {
    if (e.code === 'Space' && !e.repeat) {
      e.preventDefault();
      calibrator.tap(e);
    } else if (e.code === 'Escape') calibrator.close(false);
    return;
  }
  if (app.screen === 'play') {
    if (e.code === 'Escape' || e.code === 'KeyP') {
      e.preventDefault();
      if (ui.isModalOpen('settings')) ui.closeModal('settings');
      else if (app.paused) resumeGame();
      else pauseGame();
      return;
    }
    if (app.paused) return;
    const lane = KEY_LANES[e.code];
    if (lane !== undefined) {
      e.preventDefault();
      if (!e.repeat) {
        app.usedKeyboard = true;
        press(e.code, lane, e);
      }
    }
    return;
  }
  if (ui.key(e)) e.preventDefault();
});
window.addEventListener('keyup', (e) => release(e.code, e));

document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseGame();
});
window.addEventListener('blur', () => pauseGame());

// ---------------------------------------------------------------- UI wiring

const calibrator = new Calibrator(engine, {
  onOpen: () => stopPreview(0.15),
  onClose: (offset) => {
    if (offset != null) {
      data.settings.offset = offset;
      persist();
      ui.syncSettings();
      ui.toast(`Audio delay set to ${offset > 0 ? '+' : ''}${offset} ms`);
    }
    if (app.screen !== 'play') startPreview(300);
  },
});

const ui = new UI(
  {
    sound: (kind) => kind !== 'none' && engine.sfxUi(kind),
    start: async () => {
      await engine.init();
      applySettings();
      engine.bark(1.25, 0.4);
      engine.bark(0.85, 0.4, engine.ctx ? engine.ctx.currentTime + 0.16 : 0);
      renderer.dogs[0].react('bark');
      setTimeout(() => renderer.dogs[1].react('bark'), 160);
      goSelect();
    },
    songChanged: (i, silent) => {
      app.songIndex = i;
      renderer.setTheme(SONGS[i].theme);
      if (!silent || !app.preview) startPreview(silent ? 120 : 260);
    },
    diffChanged: (d) => {
      app.diff = d;
      data.lastDiff = d;
      persist();
    },
    play: (i, d) => startSong(i, d),
    pause: pauseGame,
    resume: resumeGame,
    restart: async () => {
      clearInterval(resumeTimer);
      $('modal-pause').hidden = true;
      await engine.resume();
      startSong(app.songIndex, app.diff);
    },
    quit: quitToSelect,
    retry: () => startSong(app.songIndex, app.diff),
    songs: goSelect,
    settings: (key) => {
      applySettings();
      persist();
      if (key === 'sfx') engine.sfxUi('tap');
    },
    modalClosed: () => {},
    calibrate: () => {
      $('modal-settings').hidden = true;
      calibrator.open();
    },
    fullscreen: () => {
      const el = document.documentElement;
      try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (el.requestFullscreen) el.requestFullscreen().catch(() => ui.toast('Fullscreen is not available here'));
        else ui.toast('Fullscreen is not available here');
      } catch {
        ui.toast('Fullscreen is not available here');
      }
    },
    reset: () => resetProgress(),
  },
  durations,
);

// ---------------------------------------------------------------- loop

/** Measure the free space each menu leaves so the band can stand in it. */
function measureAreas() {
  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const safe = readSafe();
  const rect = (sel) => {
    const el = document.querySelector(sel);
    const r = el && el.getBoundingClientRect();
    return r && r.width ? r : null;
  };
  const top = rect('.title-top');
  const bottom = rect('.title-bottom');
  if (top && bottom) renderer.setArea('title', { x0: 0, x1: W, y0: top.bottom + 6, y1: bottom.top - 10 });
  const bar = rect('.topbar');
  const car = rect('.carousel-wrap');
  if (bar && car) renderer.setArea('select', { x0: 0, x1: W, y0: bar.bottom + 4, y1: car.top - 2 });
  const panel = rect('.results');
  if (panel) {
    if (W > H * 1.11) renderer.setArea('results', { x0: safe.l, x1: panel.left - 12, y0: H * 0.16, y1: H * 0.84 });
    else renderer.setArea('results', { x0: 0, x1: W, y0: safe.t + 8, y1: panel.top - 12 });
  }
}
const measureSoon = () => requestAnimationFrame(() => requestAnimationFrame(measureAreas));

function resize() {
  renderer.resize(readSafe());
  measureAreas();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

let last = performance.now();
const wallStart = last;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const fs = { dt, beat: 0, game: null, time: 0, approach: approachTime(), keys: null, countdown: null, progress: 0, hype: false, beatDur: 0 };

  if (app.screen === 'play' && app.game && app.player) {
    const comp = app.game.compiled;
    const t = app.player.time() - judgeOffset();
    if (!app.paused) app.game.update(t);
    if (app.game) {
      fs.game = app.game;
      fs.time = t;
      fs.beatDur = comp.beat;
      fs.progress = t / comp.duration;
      const ph = (((t / comp.beat) % 1) + 1) % 1;
      fs.beat = Math.pow(1 - ph, 3);
      const sec = comp.sections.find((s) => t >= s.t0 && t < s.t1);
      fs.hype = !!(sec && sec.hype);
      fs.keys = app.usedKeyboard ? KEY_LABELS : null;
      if (t < 0) {
        const n = Math.ceil(-t / comp.beat);
        fs.countdown = { text: n >= 4 ? 'READY' : String(n), age: n * comp.beat + t };
      } else if (t < comp.beat) {
        fs.countdown = { text: 'GO!', age: t };
      }
    }
  } else {
    let ph;
    if (app.preview && !app.preview.stopped && engine.ctx && engine.ctx.state === 'running') {
      const beat = app.preview.compiled.beat;
      ph = ((((app.preview.time() - engine.latency) / beat) % 1) + 1) % 1;
    } else {
      ph = (((now - wallStart) / 1000 / 0.6) % 1);
    }
    fs.beat = Math.pow(1 - ph, 3);
  }

  renderer.draw(fs);
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- boot

applySettings();
renderer.setTheme(SONGS[app.songIndex].theme, true);
resize();
renderer.setPose('title');
ui.index = app.songIndex;
ui.diff = app.diff;
ui.show('title');
measureAreas();
requestAnimationFrame(frame);
if (document.fonts && document.fonts.load) document.fonts.load('700 24px Fredoka').then(measureAreas, () => {});

if ('serviceWorker' in navigator && !window.__MUSICDOGS_SINGLE_FILE && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Handy for tests and the curious.
window.__musicdogs = { app, engine, renderer, ui, startSong, save };
