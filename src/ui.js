// DOM interface: title, adoption, HUD, the care dock, the Orchestra sheet.

import { FAMILIES, FAMILY_ORDER, UPGRADES, NEEDS, upgradeById } from './game.js';
import { COATS } from './dog/build.js';

const $ = (id) => document.getElementById(id);
const NOTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5a3 3 0 1 1-2-2.83V5.2l11-2.4v11.7a3 3 0 1 1-2-2.83V7.1L9 8.6z"/></svg>';
const ICON = {
  food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.500h18l-1.500 6A2.200 2.200 0 0 1 17.400 19.200H6.600a2.200 2.200 0 0 1-2.100-1.700z"/><circle cx="8.500" cy="7.500" r="2"/><circle cx="13" cy="6" r="2"/><circle cx="16.500" cy="8.300" r="1.700"/></svg>',
  fun: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M4.500 8.500c5 3 10 3 15 0M4.500 15.500c5-3 10-3 15 0" fill="none" stroke="var(--ac, #14102e)" stroke-width="1.800" opacity="0.9"/></svg>',
  clean: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.500c4.200 5.200 6.600 8.400 6.600 11.700a6.600 6.600 0 0 1-13.200 0C5.400 10.900 7.800 7.700 12 2.500z"/></svg>',
  rest: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.500 14.300A8.800 8.800 0 1 1 9.700 3.500a7.200 7.200 0 0 0 10.800 10.800z"/></svg>',
  concert: NOTE,
  grow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.800l2.500 7.700 7.700 2.500-7.700 2.500-2.500 7.700-2.500-7.700-7.700-2.500 7.700-2.500z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill-rule="evenodd" d="M7 10V8a5 5 0 0 1 10 0v2h1.200c.7 0 1.300.6 1.300 1.300v8.400c0 .7-.6 1.300-1.300 1.300H5.800c-.7 0-1.300-.6-1.300-1.300v-8.400c0-.7.6-1.300 1.300-1.300zm2.400 0h5.200V8a2.600 2.600 0 0 0-5.200 0z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.500l4.500 4.500L19 7.500" fill="none" stroke="currentColor" stroke-width="3.200" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const NEED_COLOR = { food: '#FF9F45', fun: '#FF7DB8', clean: '#5CE1FF', rest: '#B9A2FF' };
const NEED_LABEL = { food: 'Food', fun: 'Fun', clean: 'Clean', rest: 'Rest' };
const ACTIONS = [
  { id: 'feed', label: 'Feed', icon: 'food', color: '#FF9F45', need: 'food' },
  { id: 'play', label: 'Play', icon: 'fun', color: '#FF7DB8', need: 'fun' },
  { id: 'wash', label: 'Wash', icon: 'clean', color: '#5CE1FF', need: 'clean' },
  { id: 'sleep', label: 'Sleep', icon: 'rest', color: '#B9A2FF', need: 'rest' },
  { id: 'concert', label: 'Concert', icon: 'concert', color: '#FFD23F' },
  { id: 'grow', label: 'Grow', icon: 'grow', color: '#7CE38B' },
];

export class UI {
  constructor(handlers, game) {
    this.h = handlers;
    this.game = game;
    this.mode = 'free';
    this.sel = null;
    this.adopt = { family: 'perc', coat: 'biscuit' };
    this._build();
    this._bind();
  }

  _build() {
    $('needs').innerHTML = NEEDS.map((n) => `<div class="need" data-need="${n}" style="--nc:${NEED_COLOR[n]}" title="${NEED_LABEL[n]}" aria-label="${NEED_LABEL[n]}">${ICON[n]}<i><u></u></i></div>`).join('');
    $('dock').innerHTML = ACTIONS.map((a) => `<button type="button" class="act" data-act="${a.id}" style="--ac:${a.color}"><span class="ico">${ICON[a.icon]}</span><span class="lbl">${a.label}</span></button>`).join('');
    this.acts = Object.fromEntries([...document.querySelectorAll('.act')].map((b) => [b.dataset.act, b]));
    this.needEls = Object.fromEntries([...document.querySelectorAll('.need')].map((e) => [e.dataset.need, e]));

    $('starter-grid').innerHTML = FAMILY_ORDER.map((f) => {
      const u = UPGRADES.find((x) => x.family === f && x.tier === 1);
      return `<button type="button" class="starter" role="radio" data-family="${f}" aria-checked="false" style="--fam:${FAMILIES[f].color}"><b>${u.name}</b><span>${FAMILIES[f].name}</span></button>`;
    }).join('');
    $('coats').innerHTML = Object.entries(COATS).map(([id, c]) => `<button type="button" class="coat" role="radio" data-coat="${id}" aria-checked="false" aria-label="${c.name} coat" style="--c:${c.fur}"></button>`).join('');
    this._syncAdopt();
  }

  _bind() {
    const h = this.h;
    $('btn-start').addEventListener('click', () => h.start());
    $('btn-settings').addEventListener('click', () => {
      h.sound('tap');
      this.openModal('modal-settings');
    });
    $('goal').addEventListener('click', () => h.goal());
    for (const [id, btn] of Object.entries(this.acts)) btn.addEventListener('click', () => h.action(id));

    document.querySelectorAll('.starter').forEach((b) => b.addEventListener('click', () => {
      this.adopt.family = b.dataset.family;
      h.sound('tap');
      this._syncAdopt();
      h.preview(this.adopt, true);
    }));
    document.querySelectorAll('.coat').forEach((b) => b.addEventListener('click', () => {
      this.adopt.coat = b.dataset.coat;
      const input = $('pup-name-input');
      if (Object.values(COATS).some((c) => c.name === input.value.trim()) || !input.value.trim()) input.value = COATS[this.adopt.coat].name;
      h.sound('tap');
      this._syncAdopt();
      h.preview(this.adopt, false);
    }));
    $('btn-adopt').addEventListener('click', () => h.adopt($('pup-name-input').value, this.adopt.coat, this.adopt.family));
    $('pup-name-input').addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') e.target.blur();
    });

    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
      h.sound('back');
      b.closest('.modal').hidden = true;
    }));
    document.querySelectorAll('.modal').forEach((m) => m.addEventListener('pointerdown', (e) => {
      if (e.target === m) m.hidden = true;
    }));

    const s = this.game.s.settings;
    for (const [id, key] of [['music', 'music'], ['sfx', 'sfx']]) {
      const el = $(`set-${id}`);
      el.value = String(Math.round(s[key] * 100));
      $(`val-${id}`).textContent = el.value;
      el.addEventListener('input', () => {
        s[key] = Number(el.value) / 100;
        $(`val-${id}`).textContent = el.value;
        h.settings(key);
      });
    }
    $('set-low').checked = !!s.low;
    $('set-low').addEventListener('change', (e) => {
      s.low = e.target.checked;
      h.settings('low');
    });
    let armed = 0;
    $('btn-reset').addEventListener('click', () => {
      const btn = $('btn-reset');
      if (performance.now() < armed) {
        armed = 0;
        btn.textContent = 'Start over';
        $('modal-settings').hidden = true;
        h.reset();
      } else {
        armed = performance.now() + 3000;
        btn.textContent = 'Tap again to confirm';
        setTimeout(() => {
          if (armed && performance.now() >= armed) btn.textContent = 'Start over';
        }, 3100);
      }
    });
  }

  _syncAdopt() {
    document.querySelectorAll('.starter').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.family === this.adopt.family)));
    document.querySelectorAll('.coat').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.coat === this.adopt.coat)));
  }

  // --------------------------------------------------------------- screens

  show(screen) {
    this.screen = screen;
    $('screen-title').hidden = screen !== 'title';
    $('screen-adopt').hidden = screen !== 'adopt';
    $('hud').hidden = screen !== 'hud';
  }

  openModal(id) {
    $(id).hidden = false;
  }

  anyModal() {
    return [...document.querySelectorAll('.modal')].some((m) => !m.hidden);
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach((m) => (m.hidden = true));
  }

  toast(text) {
    const t = $('toast');
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = text;
    t.hidden = false;
    clearTimeout(this._toast);
    this._toast = setTimeout(() => (t.hidden = true), 3300);
  }

  // ------------------------------------------------------------------- HUD

  /** mode: free | eat | play | wash | sleep | concert */
  setMode(mode, hint = '') {
    this.mode = mode;
    const el = $('mode-hint');
    el.hidden = !hint;
    el.textContent = hint;
    this.refresh();
  }

  setGoal(html, done = false) {
    const g = $('goal');
    if (g.dataset.html !== html) {
      g.innerHTML = html;
      g.dataset.html = html;
    }
    g.classList.toggle('done', done);
  }

  bumpNotes() {
    const p = document.querySelector('.notes-pill');
    p.classList.remove('bump');
    void p.offsetWidth;
    p.classList.add('bump');
  }

  refresh() {
    const g = this.game;
    const s = g.s;
    $('pup-name').textContent = s.name;
    $('pup-rank').textContent = g.rank;
    $('notes').textContent = String(s.notes);
    for (const n of NEEDS) {
      const el = this.needEls[n];
      el.querySelector('u').style.width = `${Math.round(s.needs[n])}%`;
      el.classList.toggle('low', s.needs[n] < 30);
    }
    const mode = this.mode;
    const busy = mode === 'eat' || mode === 'concert';
    for (const a of ACTIONS) {
      const b = this.acts[a.id];
      const mine = (a.id === 'play' && mode === 'play') || (a.id === 'wash' && mode === 'wash') || (a.id === 'sleep' && mode === 'sleep') || (a.id === 'feed' && mode === 'eat') || (a.id === 'concert' && mode === 'concert');
      b.classList.toggle('on', mine);
      b.disabled = busy || (mode !== 'free' && !mine && a.id !== 'grow') || (a.id === 'grow' && mode !== 'free');
      b.classList.toggle('want', mode === 'free' && !!a.need && s.needs[a.need] < 30);
      b.querySelector('.lbl').textContent = mine && a.id === 'sleep' ? 'Wake' : mine && (a.id === 'play' || a.id === 'wash') ? 'Done' : a.label;
    }
    const canGrow = UPGRADES.some((u) => g.status(u.id) === 'ready');
    this.acts.grow.classList.toggle('ready', mode === 'free' && canGrow);
    if (!$('sheet-orchestra').hidden) this.renderOrchestra();
  }

  // ------------------------------------------------------------- orchestra

  openOrchestra() {
    const g = this.game;
    const firstReady = UPGRADES.find((u) => g.status(u.id) === 'ready') || UPGRADES.find((u) => g.status(u.id) === 'poor') || UPGRADES[0];
    this.sel = firstReady.id;
    $('sheet-orchestra').hidden = false;
    this.renderOrchestra(true);
  }

  renderOrchestra(force = false) {
    const g = this.game;
    const cost = g.nextCost();
    // Only rebuild when something changed, so buttons are never swapped mid-tap.
    const sig = `${g.s.notes}|${JSON.stringify(g.s.levels)}|${this.sel}`;
    if (!force && sig === this._orchSig) return;
    this._orchSig = sig;
    $('orch-sub').textContent = g.total >= 12 ? 'All 12 instruments grown. A full orchestra!' : `${g.total} of 12 instruments grown`;
    let html = '';
    for (const f of FAMILY_ORDER) {
      html += `<div class="orch-fam" style="--fam:${FAMILIES[f].color}">${FAMILIES[f].name}</div>`;
      for (const u of UPGRADES.filter((x) => x.family === f)) {
        const st = g.status(u.id);
        const tail = st === 'owned' ? `${ICON.check}Grown` : st === 'locked' ? `${ICON.lock}Locked` : `${NOTE}${cost}`;
        html += `<button type="button" class="up ${st}${u.id === this.sel ? ' sel' : ''}" data-up="${u.id}" style="--fam:${FAMILIES[f].color}"><b>${u.name}</b><span>${tail}</span></button>`;
      }
    }
    const grid = $('orch-grid');
    grid.innerHTML = html;
    grid.querySelectorAll('.up').forEach((b) => b.addEventListener('click', () => {
      this.sel = b.dataset.up;
      this.h.sound('tap');
      this.renderOrchestra();
    }));

    const u = upgradeById(this.sel);
    const st = g.status(u.id);
    const prev = UPGRADES.find((x) => x.family === u.family && x.tier === u.tier - 1);
    let action;
    if (st === 'owned') action = `<button class="btn btn-ghost" type="button" data-hear="${u.id}">Hear it</button>`;
    else if (st === 'locked') action = `<button class="btn btn-ghost" type="button" disabled>Grow ${prev.name} first</button>`;
    else if (st === 'poor') action = `<button class="btn btn-primary" type="button" disabled>Need ${cost - g.s.notes} more notes</button>`;
    else action = `<button class="btn btn-primary" type="button" data-buy="${u.id}">Grow it for ${cost} notes</button>`;
    const d = $('orch-detail');
    d.innerHTML = `<h3>${u.name}<small>${FAMILIES[u.family].name} · ${u.where}</small></h3><p>${u.blurb}</p>${action}`;
    const buy = d.querySelector('[data-buy]');
    if (buy) buy.addEventListener('click', () => this.h.buy(u.id));
    const hear = d.querySelector('[data-hear]');
    if (hear) hear.addEventListener('click', () => this.h.hear(u.id));
  }
}

export { ACTIONS, NEED_LABEL };
