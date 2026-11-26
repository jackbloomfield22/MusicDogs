// DOM interface: title, adoption, HUD, the care dock, the Orchestra sheet.

import { FAMILIES, FAMILY_ORDER, UPGRADES, NEEDS, STREAK_LEN, upgradeById } from './game.js';
import { COATS } from './dog/build.js';
import { PLACES, placeById, NPCS, QUESTS, LEGENDS, SOUVENIRS, GEM_PACKS, BOOSTS, COSMETICS, TASKS, TASK_GEMS, WORLD_NAME } from './lore.js';

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
const GEM = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.500 3h11l4 6-9.500 12L2.500 9z"/></svg>';
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.500l2.900 6.100 6.600.8-4.900 4.600 1.300 6.600L12 17.300 6.100 20.600l1.300-6.600L2.500 9.400l6.600-.8z"/></svg>';
ICON.talk = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.500A2.500 2.500 0 0 1 6.500 3h11A2.500 2.500 0 0 1 20 5.500v8a2.500 2.500 0 0 1-2.500 2.500H11l-5 4.500V16A2.500 2.500 0 0 1 4 13.500z"/></svg>';
ICON.home = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l9 8h-2.500v9.500h-4.700V14h-3.600v6.500H5.500V11H3z"/></svg>';
const ISLE_ICON = { home: ICON.home, perc: ICON.fun, str: NOTE, wood: ICON.clean, brass: ICON.concert, shell: STAR };
const money = (n) => `$${n.toFixed(2)}`;
const NEED_COLOR = { food: '#FF9F45', fun: '#FF7DB8', clean: '#5CE1FF', rest: '#B9A2FF' };
const NEED_LABEL = { food: 'Food', fun: 'Fun', clean: 'Clean', rest: 'Rest' };
const ACTIONS = [
  { id: 'feed', label: 'Feed', icon: 'food', color: '#FF9F45', need: 'food' },
  { id: 'play', label: 'Play', icon: 'fun', color: '#FF7DB8', need: 'fun' },
  { id: 'wash', label: 'Wash', icon: 'clean', color: '#5CE1FF', need: 'clean' },
  { id: 'sleep', label: 'Sleep', icon: 'rest', color: '#B9A2FF', need: 'rest' },
  { id: 'talk', label: 'Talk', icon: 'talk', color: '#FF9F45', where: 'away' },
  { id: 'concert', label: 'Concert', icon: 'concert', color: '#FFD23F' },
  { id: 'grow', label: 'Grow', icon: 'grow', color: '#7CE38B' },
  { id: 'home', label: 'Home', icon: 'home', color: '#5CE1FF', where: 'away' },
];
const HOME_ONLY = ['feed', 'play', 'wash', 'sleep'];

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
    $('dock').innerHTML = ACTIONS.map((a) => `<button type="button" class="act ${a.where === 'away' ? 'away' : HOME_ONLY.includes(a.id) ? 'home' : ''}" data-act="${a.id}" style="--ac:${a.color}"><span class="ico">${ICON[a.icon]}</span><span class="lbl">${a.label}</span></button>`).join('');
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
    $('chip-tips').addEventListener('click', () => h.tips());
    $('chip-gift').addEventListener('click', () => h.gift());
    $('nav-map').addEventListener('click', () => (h.sound('tap'), this.openMap()));
    $('nav-journal').addEventListener('click', () => (h.sound('tap'), this.openJournal()));
    $('nav-shop').addEventListener('click', () => (h.sound('tap'), this.openShop()));
    $('gems-pill').addEventListener('click', () => (h.sound('tap'), this.openShop('gems')));
    document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => (h.sound('tap'), this.openJournal(b.dataset.tab))));
    document.querySelectorAll('[data-shop]').forEach((b) => b.addEventListener('click', () => (h.sound('tap'), this.openShop(b.dataset.shop))));
    $('talk-next').addEventListener('click', () => this._talkNext());
    $('co-confirm').addEventListener('click', () => {
      $('modal-checkout').hidden = true;
      h.confirmPack(this._coSku);
    });
    $('btn-clear-log').addEventListener('click', () => {
      this.game.clearLedger();
      this.syncLog();
    });
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
    if (id === 'modal-settings') this.syncLog();
  }

  anyModal() {
    return [...document.querySelectorAll('.modal')].some((m) => !m.hidden);
  }

  closeModals() {
    document.querySelectorAll('.modal').forEach((m) => (m.hidden = true));
  }

  /** Toasts queue up, so several rewards in a row are all seen. */
  toast(text) {
    this._toasts = this._toasts || [];
    if (this._toasts.includes(text)) return;
    this._toasts.push(text);
    if (!this._toastBusy) this._nextToast();
  }

  _nextToast() {
    const t = $('toast');
    const text = this._toasts.shift();
    if (!text) {
      this._toastBusy = false;
      t.hidden = true;
      return;
    }
    this._toastBusy = true;
    t.hidden = true;
    void t.offsetWidth;
    t.textContent = text;
    t.style.animationDuration = this._toasts.length ? '2.1s' : '3.2s';
    t.hidden = false;
    setTimeout(() => this._nextToast(), this._toasts.length ? 2100 : 3200);
  }

  /** Cover the screen briefly (travelling between isles), run `mid` while hidden. */
  fade(text, mid) {
    const f = $('fade');
    $('fade-text').textContent = text;
    f.classList.remove('out');
    f.hidden = false;
    setTimeout(() => {
      mid();
      setTimeout(() => {
        f.classList.add('out');
        setTimeout(() => (f.hidden = true), 450);
      }, 650);
    }, 380);
  }

  // ------------------------------------------------------------- dialogue

  showTalk(res, onDone) {
    this._talk = { res, i: 0, onDone };
    $('talk-name').textContent = res.name;
    $('talk-title').textContent = res.title;
    $('talk').hidden = false;
    this._talkShow();
  }

  get talking() {
    return !$('talk').hidden;
  }

  _talkShow() {
    const { res, i } = this._talk;
    $('talk-text').textContent = res.lines[i];
    $('talk-next').textContent = i >= res.lines.length - 1 ? 'Bye for now' : 'Next';
    this.h.spoke(res);
  }

  _talkNext() {
    const t = this._talk;
    if (!t) return;
    if (++t.i >= t.res.lines.length) {
      $('talk').hidden = true;
      this._talk = null;
      t.onDone();
    } else this._talkShow();
  }

  // ------------------------------------------------------------------ map

  openMap() {
    this.mapSel = this.mapSel || this.game.s.place;
    const fresh = PLACES.find((p) => this.game.placeOpen(p.id) && !this.game.s.visited.includes(p.id));
    if (fresh) this.mapSel = fresh.id;
    $('modal-map').hidden = false;
    this.renderMap();
  }

  renderMap() {
    const g = this.game;
    $('map-sub').textContent = `${g.fame} fame star${g.fame === 1 ? '' : 's'} · ${g.s.visited.length} of ${PLACES.length} isles visited`;
    const pts = PLACES.map((p) => `${p.map[0]},${p.map[1]}`).join(' ');
    let html = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="rgba(255,255,255,0.7)" stroke-width="0.8" stroke-dasharray="1.5 2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
    for (const [x, y, w] of [[8, 88, 26], [62, 92, 34], [40, 44, 22], [84, 40, 20], [6, 14, 18]]) html += `<span class="cloud" style="left:${x}%;top:${y}%;width:${w}%"></span>`;
    for (const p of PLACES) {
      const open = g.placeOpen(p.id);
      const stars = p.id === 'home' ? '' : `<small>${'★'.repeat(g.fameStars(p.id))}${'☆'.repeat(3 - g.fameStars(p.id))}</small>`;
      const cls = `${open ? '' : 'locked'} ${p.id === g.s.place ? 'here' : ''} ${p.id === this.mapSel ? 'sel' : ''}`;
      html += `<button type="button" class="isle ${cls}" data-place="${p.id}" style="left:${p.map[0]}%;top:${p.map[1]}%;--top:${p.sky[2]};--gr:${p.ground || '#E2B27A'}"><i>${open ? ISLE_ICON[p.family || (p.id === 'home' ? 'home' : 'shell')] : ICON.lock}</i><b>${open || g.s.visited.includes(p.id) ? p.name : '???'}</b>${open ? stars : ''}</button>`;
    }
    const map = $('map');
    map.innerHTML = html;
    map.querySelectorAll('.isle').forEach((b) => b.addEventListener('click', () => {
      this.mapSel = b.dataset.place;
      this.h.sound('tap');
      this.renderMap();
    }));
    const p = placeById(this.mapSel);
    const open = g.placeOpen(p.id);
    const here = p.id === g.s.place;
    const d = $('map-detail');
    if (!open) {
      const need = p.need - g.fame;
      d.innerHTML = `<h3>A far-off isle<small>locked</small></h3><p>The cloud-ferry only sails here for well-known musicians. Earn ${need} more fame star${need === 1 ? '' : 's'} by playing concerts on the isles you can reach.</p><button class="btn btn-ghost" type="button" disabled>Needs ${p.need} fame stars</button>`;
      return;
    }
    const npc = p.npc ? NPCS[p.npc] : null;
    const meta = [`<span class="tagchip">${p.kind}</span>`];
    if (p.mult > 1) meta.push(`<span class="tagchip gold">Crowds pay ×${p.mult}</span>`);
    if (npc) meta.push(`<span class="tagchip">${g.s.met.includes(p.npc) ? npc.name : 'Someone'} lives here</span>`);
    d.innerHTML = `<h3>${p.name}</h3><div class="meta">${meta.join('')}</div><p>${p.blurb}</p><button class="btn ${here ? 'btn-ghost' : 'btn-primary'}" type="button" ${here ? 'disabled' : ''} data-go="${p.id}">${here ? 'You are here' : p.id === 'home' ? 'Sail home' : `Sail to ${p.name}`}</button>`;
    const go = d.querySelector('[data-go]');
    if (go && !here) go.addEventListener('click', () => this.h.travel(p.id));
  }

  // -------------------------------------------------------------- journal

  openJournal(tab) {
    this.jTab = tab || this.jTab || 'todo';
    $('modal-journal').hidden = false;
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === this.jTab));
    const g = this.game;
    const body = $('journal-body');
    if (this.jTab === 'todo') {
      const row = (label, have, need, done, tail) => `<div class="todo ${done ? 'done' : ''}"><b>${label}</b><span>${tail}</span><i><u style="width:${Math.round((Math.min(have, need) / need) * 100)}%"></u></i></div>`;
      let html = `<div class="jhead">Today · ${TASK_GEMS} gems each</div>`;
      for (const t of g.ensureTasks()) {
        const def = TASKS[t.k];
        html += row(def.label, t.have, def.n, t.done, t.done ? 'Done' : `${t.have} / ${def.n}`);
      }
      html += '<div class="jhead">Friends</div>';
      let any = false;
      for (const id of g.s.met) {
        const qs = g.questState(id);
        if (!qs) continue;
        any = true;
        html += row(`${NPCS[id].name}: ${qs.quest.label}`, qs.have, qs.need, qs.done, qs.done ? `Tell ${NPCS[id].name}` : `${qs.have} / ${qs.need}`);
      }
      if (!any) html += `<p class="note">${g.s.met.length ? 'Your friends have nothing more to ask. You did it all.' : 'Nobody has asked you for anything yet. Open the Map and go and meet someone.'}</p>`;
      body.innerHTML = html;
      return;
    }
    const sb = g.songbook;
    const entries = [];
    for (const p of PLACES) entries.push({ id: `p-${p.id}`, title: p.name, sub: p.kind, text: p.blurb, have: g.s.visited.includes(p.id), group: 'Places' });
    for (const [id, n] of Object.entries(NPCS)) entries.push({ id: `n-${id}`, title: n.name, sub: n.title, text: n.about, have: g.s.met.includes(id), group: 'Friends' });
    for (const l of LEGENDS) entries.push({ id: `l-${l.id}`, title: l.title, sub: 'Legend', text: l.text, have: g.s.legends.includes(l.id), group: 'Legends' });
    if (!this.bookSel || !entries.find((e) => e.id === this.bookSel && e.have)) this.bookSel = entries.filter((e) => e.have).pop().id;
    let html = `<p class="note">${WORLD_NAME}: ${sb.have} of ${sb.total} pages found.${g.s.souvenirs.length ? ` Keepsakes on your porch: ${g.s.souvenirs.map((k) => SOUVENIRS[k].name).join(', ')}.` : ''}</p>`;
    for (const group of ['Places', 'Friends', 'Legends']) {
      html += `<div class="jhead">${group}</div><div class="book-grid">`;
      for (const e of entries.filter((x) => x.group === group)) html += `<button type="button" class="entry ${e.have ? '' : 'locked'} ${e.id === this.bookSel ? 'sel' : ''}" data-entry="${e.id}" ${e.have ? '' : 'disabled'}>${e.have ? e.title : '???'}</button>`;
      html += '</div>';
    }
    const cur = entries.find((e) => e.id === this.bookSel);
    html += `<div class="orch-detail"><h3>${cur.title}<small>${cur.sub}</small></h3><p>${cur.text}</p></div>`;
    body.innerHTML = html;
    body.querySelectorAll('[data-entry]').forEach((b) => b.addEventListener('click', () => {
      this.bookSel = b.dataset.entry;
      this.h.sound('tap');
      this.openJournal('book');
    }));
  }

  // -------------------------------------------------------- pretend store

  openShop(tab) {
    this.sTab = tab || this.sTab || 'gems';
    $('modal-shop').hidden = false;
    document.querySelectorAll('[data-shop]').forEach((b) => b.classList.toggle('on', b.dataset.shop === this.sTab));
    const g = this.game;
    const s = g.s;
    $('shop-gems').textContent = String(s.gems);
    const gemBtn = (cost, attr, can) => `<button class="btn btn-primary" type="button" ${attr} ${can ? '' : 'disabled'}>${GEM}${cost}</button>`;
    let html = '';
    if (this.sTab === 'gems') {
      html += '<p class="note">Gems also turn up in play: daily to-dos, fame stars, friends\' quests and the seventh daily gift.</p>';
      for (const p of GEM_PACKS) {
        const taken = p.once && s.bought.includes(p.sku);
        html += `<div class="item ${taken ? 'owned' : ''}"><h3>${p.name}${p.tag ? `<span class="tagchip gold">${p.tag}</span>` : ''}</h3><p>${p.blurb}</p><button class="btn btn-primary" type="button" data-pack="${p.sku}" ${taken ? 'disabled' : ''}>${taken ? 'Taken' : money(p.price)}</button></div>`;
      }
    } else if (this.sTab === 'boosts') {
      for (const b of BOOSTS) {
        const taken = b.once && s.bought.includes(b.id);
        const held = b.id === 'ticket' && s.tickets ? ` You hold ${s.tickets}.` : b.id === 'magnet' && s.magnet > 0 ? ` ${Math.ceil(s.magnet / 60)} min left.` : '';
        html += `<div class="item ${taken ? 'owned' : ''}"><h3>${b.name}</h3><p>${b.blurb}${held}</p>${taken ? '<button class="btn btn-ghost" type="button" disabled>Yours</button>' : gemBtn(b.cost, `data-boost="${b.id}"`, s.gems >= b.cost)}</div>`;
      }
    } else {
      for (const c of COSMETICS) {
        const own = s.wardrobe.includes(c.id);
        const on = s.wearing[c.slot] === c.id;
        let btn;
        if (own) btn = `<button class="btn ${on ? 'btn-ghost' : 'btn-primary'}" type="button" data-wear="${c.id}">${on ? 'Take off' : 'Wear'}</button>`;
        else if (c.cost == null) btn = '<button class="btn btn-ghost" type="button" disabled>Not yet</button>';
        else btn = gemBtn(c.cost, `data-cos="${c.id}"`, s.gems >= c.cost);
        html += `<div class="item ${own ? 'owned' : ''}"><h3>${c.name}</h3><p>${own ? (on ? 'Wearing it now.' : 'In the wardrobe.') : c.from || 'An outfit for your pup.'}</p>${btn}</div>`;
      }
    }
    const body = $('shop-body');
    body.innerHTML = html;
    body.querySelectorAll('[data-pack]').forEach((b) => b.addEventListener('click', () => this.openCheckout(b.dataset.pack)));
    body.querySelectorAll('[data-boost]').forEach((b) => b.addEventListener('click', () => this.h.boost(b.dataset.boost)));
    body.querySelectorAll('[data-cos]').forEach((b) => b.addEventListener('click', () => this.h.cosmetic(b.dataset.cos)));
    body.querySelectorAll('[data-wear]').forEach((b) => b.addEventListener('click', () => this.h.wear(b.dataset.wear)));
  }

  openCheckout(sku) {
    const p = GEM_PACKS.find((x) => x.sku === sku);
    this._coSku = sku;
    this.h.sound('tap');
    $('co-name').textContent = p.name;
    $('co-price').textContent = money(p.price);
    $('modal-checkout').hidden = false;
  }

  /** The store test log in Settings: what was "bought", and when. */
  syncLog() {
    const l = this.game.ledger;
    const mins = (sec) => (sec < 90 ? `${sec}s` : `${Math.round(sec / 60)} min`);
    $('log-summary').textContent = l.count
      ? `${l.count} pretend purchase${l.count === 1 ? '' : 's'}, ${money(l.total)} in pretend money. First one after ${mins(l.firstAt)} of play.`
      : 'No pretend purchases yet. Nothing in the store costs real money.';
    $('log-list').innerHTML = l.items.slice(-30).reverse().map((x) => `<li><span>${x.name}</span><span>${money(x.price)} · at ${mins(x.at)}</span></li>`).join('');
    $('btn-clear-log').hidden = !l.count;
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

  /** Roll the note counter up or down to its real value instead of jumping. */
  tickNotes(dt) {
    const target = this.game.s.notes;
    if (this.shownNotes === undefined || Math.abs(target - this.shownNotes) < 0.5) this.shownNotes = target;
    else this.shownNotes += (target - this.shownNotes) * Math.min(1, dt * 9);
    const text = String(Math.round(this.shownNotes));
    if (text !== this._notesText) {
      this._notesText = text;
      $('notes').textContent = text;
    }
  }

  showGift(g) {
    $('gift-day').textContent = g.kept ? `Day ${g.day} · streak kept` : `Day ${g.day} of ${STREAK_LEN}`;
    $('gift-title').textContent = { jackpot: 'Jackpot gift!', big: 'A big one!', nice: "Today's gift" }[g.tier];
    $('gift-amount').textContent = g.gems ? `${g.amount} + ${g.gems} gems` : String(g.amount);
    $('gift-pips').innerHTML = Array.from({ length: STREAK_LEN }, (_, i) => `<i class="${i < g.day ? 'on' : ''}${i === g.day - 1 ? ' now' : ''}">${i + 1}</i>`).join('');
    $('gift-next').textContent = g.day === STREAK_LEN ? 'A full week! The streak starts a fresh round tomorrow.' : `Come back tomorrow and the gift is worth ×${g.next}.`;
    this.openModal('modal-gift');
  }

  setGoal(html, done = false, progress = 0) {
    const g = $('goal');
    g.style.setProperty('--p', `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`);
    if (g.dataset.html !== html) {
      g.innerHTML = `<span>${html}</span>`;
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
    $('pup-rank').textContent = s.stars ? `${g.rank} ★${s.stars}` : g.rank;
    // tip jar chip
    const fill = g.jarFill;
    const rate = g.tipRate();
    const chip = $('chip-tips');
    $('tips-fill').style.height = `${Math.round(fill * 100)}%`;
    $('tips-amount').textContent = String(Math.floor(s.jar));
    $('tips-rate').textContent = fill >= 1 ? 'Full!' : s.frenzy > 0 ? `×3 for ${Math.ceil(s.frenzy)}s` : g.harmony ? `×2 · ${rate.toFixed(1)}/min` : `${rate.toFixed(1)}/min`;
    chip.classList.toggle('ready', fill >= 0.25);
    chip.classList.toggle('full', fill >= 1);
    chip.classList.toggle('boost', g.harmony || s.frenzy > 0 || s.magnet > 0);
    $('chip-gift').hidden = !g.dailyReady();
    for (const n of NEEDS) {
      const el = this.needEls[n];
      el.querySelector('u').style.width = `${Math.round(s.needs[n])}%`;
      el.classList.toggle('low', s.needs[n] < 30);
    }
    $('gems').textContent = String(s.gems);
    const away = s.place !== 'home';
    $('dock').classList.toggle('away', away);
    $('nav-map').classList.toggle('badge', PLACES.some((p) => g.placeOpen(p.id) && !s.visited.includes(p.id)));
    $('nav-journal').classList.toggle('badge', s.met.some((id) => (g.questState(id) || {}).done));
    const mode = this.mode;
    const busy = mode === 'eat' || mode === 'concert';
    for (const a of ACTIONS) {
      const b = this.acts[a.id];
      const mine = (a.id === 'play' && mode === 'play') || (a.id === 'wash' && mode === 'wash') || (a.id === 'sleep' && mode === 'sleep') || (a.id === 'feed' && mode === 'eat') || (a.id === 'concert' && mode === 'concert');
      b.classList.toggle('on', mine);
      b.disabled = busy || this.talking || (mode !== 'free' && !mine && a.id !== 'grow') || (a.id === 'grow' && mode !== 'free');
      b.classList.toggle('want', mode === 'free' && !!a.need && s.needs[a.need] < 30);
      b.querySelector('.lbl').textContent = mine && a.id === 'sleep' ? 'Wake' : mine && (a.id === 'play' || a.id === 'wash') ? 'Done' : a.label;
    }
    const canGrow = UPGRADES.some((u) => g.status(u.id) === 'ready') || (g.total >= 12 && s.notes >= g.starCost());
    this.acts.grow.classList.toggle('ready', mode === 'free' && canGrow);
    const npcHere = placeById(s.place).npc;
    this.acts.talk.classList.toggle('ready', mode === 'free' && !!npcHere && (!s.met.includes(npcHere) || !!(g.questState(npcHere) || {}).done));
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
    const sig = `${g.s.notes}|${JSON.stringify(g.s.levels)}|${this.sel}|${g.s.stars}`;
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
    if (g.total >= 12) {
      const sc = g.starCost();
      const can = g.s.notes >= sc;
      html = `<div class="virtuoso" style="grid-column:1/-1"><h3>Virtuoso stars ${g.s.stars ? `★${g.s.stars}` : ''}</h3><p>Polish the whole orchestra. Each star makes every note you earn worth 10% more, for good.</p><button class="btn btn-primary" type="button" data-star ${can ? '' : 'disabled'}>${can ? `Add a star for ${sc} notes` : `Need ${sc - g.s.notes} more notes`}</button></div>${html}`;
    }
    const grid = $('orch-grid');
    grid.innerHTML = html;
    const star = grid.querySelector('[data-star]');
    if (star) star.addEventListener('click', () => this.h.star());
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
