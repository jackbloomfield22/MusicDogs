// Rules of the pet game: needs, rewards, upgrades and saving.
// Pure data + logic (no DOM, no 3D) so it can be tested on its own.

import { PLACES, placeById, FAME_STEPS, NPCS, QUESTS, GEM_PACKS, BOOSTS, COSMETICS, cosmeticById, TASKS, TASK_GEMS, TASK_BONUS } from './lore.js';

export const FAMILIES = {
  perc: { name: 'Percussion', color: '#FF6B7A' },
  str: { name: 'Strings', color: '#FFB84D' },
  wood: { name: 'Woodwinds', color: '#6FD08A' },
  brass: { name: 'Brass', color: '#FFD23F' },
};
export const FAMILY_ORDER = ['perc', 'str', 'wood', 'brass'];

export const UPGRADES = [
  { id: 'perc1', family: 'perc', tier: 1, name: 'Drum Belly', where: 'body', blurb: 'A booming drum where a tummy used to be. Belly rubs now keep the beat.' },
  { id: 'perc2', family: 'perc', tier: 2, name: 'Cymbal Ears', where: 'ears', blurb: 'Two crash cymbals that clang when the ears flap.' },
  { id: 'perc3', family: 'perc', tier: 3, name: 'Xylophone Ribs', where: 'sides', blurb: 'Rainbow bars down both flanks that sparkle over the tune.' },
  { id: 'str1', family: 'str', tier: 1, name: 'Violin Tail', where: 'tail', blurb: 'A scroll, four pegs and four strings. Every wag sings the melody.' },
  { id: 'str2', family: 'str', tier: 2, name: 'Cello Spine', where: 'back', blurb: 'A fingerboard and bridge along the back for warm, low notes.' },
  { id: 'str3', family: 'str', tier: 3, name: 'Harp Sail', where: 'back', blurb: 'A golden concert harp rising from the rump, rippling with arpeggios.' },
  { id: 'wood1', family: 'wood', tier: 1, name: 'Clarinet Legs', where: 'front legs', blurb: 'Front legs of polished ebony with silver keys and bell-shaped paws.' },
  { id: 'wood2', family: 'wood', tier: 2, name: 'Bassoon Legs', where: 'hind legs', blurb: 'Maple hind legs that puff out a bouncy oom-pah.' },
  { id: 'wood3', family: 'wood', tier: 3, name: 'Pan-Flute Mane', where: 'head', blurb: 'A mohawk of bamboo pipes that whistles high above everything.' },
  { id: 'brass1', family: 'brass', tier: 1, name: 'Trumpet Snout', where: 'nose', blurb: 'A shiny bell around the nose and three valves on the muzzle. Sniffs are fanfares.' },
  { id: 'brass2', family: 'brass', tier: 2, name: 'Horn Collar', where: 'neck', blurb: 'A French horn coiled around the neck for a soft golden glow of harmony.' },
  { id: 'brass3', family: 'brass', tier: 3, name: 'Sousaphone Coil', where: 'body', blurb: 'A giant tuba wrapped around the whole pup. The bass you can feel.' },
];
export const upgradeById = (id) => UPGRADES.find((u) => u.id === id);

// Price of the next upgrade depends on how many you already own (the starter is free).
export const COSTS = [25, 50, 90, 140, 210, 300, 420, 580, 780, 1020, 1300];
export const RANKS = [
  'Stray Note', 'Solo Pup', 'Duo', 'Trio', 'Quartet', 'Quintet', 'Sextet', 'Septet', 'Octet',
  'Chamber Pup', 'Little Symphony', 'Grand Symphony', 'Full Orchestra',
];

export const NEEDS = ['food', 'fun', 'clean', 'rest'];
// points lost per second while the game is open (100 = full)
const DECAY = { food: 0.2, fun: 0.24, clean: 0.13, rest: 0.11 };
const OFFLINE_SLOWDOWN = 24;
const OFFLINE_FLOOR = 28;

// --- the tips engine -------------------------------------------------------
// Notes trickle into the tip jar all the time, even while the game is closed.
const TIP_BASE = 0.8; // notes per minute for a plain pup
const TIP_PER_PART = 0.45; // extra per instrument part grown
const TIP_OFFLINE = 0.8; // away-from-game multiplier
const STAR_BOOST = 0.1; // each Virtuoso star: +10% to everything earned
const STAR_COST = 600;
export const STREAK_LEN = 7;
const DAY_MS = 86400000;
/** Whole local days since the epoch, so "a new day" follows the player's own clock. */
export const dayIndex = (now = Date.now()) => Math.floor((now - new Date(now).getTimezoneOffset() * 60000) / DAY_MS);

const KEY = 'musicdogs3d.v1';

export function newState() {
  return {
    v: 1,
    adopted: false,
    name: 'Biscuit',
    coat: 'biscuit',
    levels: { perc: 0, str: 0, wood: 0, brass: 0 },
    needs: { food: 62, fun: 55, clean: 70, rest: 80 },
    notes: 0,
    earned: 0,
    concerts: 0,
    pets: 0,
    petPool: 10,
    lastSeen: Date.now(),
    quest: 0,
    jar: 0, // uncollected tips
    frenzy: 0, // seconds of tripled tips left
    stars: 0, // Virtuoso stars (bought after Full Orchestra)
    daily: { day: 0, streak: 0 },
    lucky: 0,
    // --- the world ---
    place: 'home',
    fame: {}, // place -> applause points earned at its venue
    met: [], // friends you have talked to
    q: {}, // friend -> { i: quest index, base: stat snapshot when it was given }
    legends: ['howl'],
    visited: ['home'],
    souvenirs: [],
    stat: { concertsAt: {}, concerts: 0, golden: 0, jarNotes: 0, jarCollects: 0, harmony: 0, travels: 0, care: 0, pets: 0 },
    tasks: { day: 0, list: [] },
    // --- gems + the pretend store ---
    gems: 0,
    wardrobe: [],
    wearing: { head: null, neck: null, face: null },
    magnet: 0, // seconds of doubled tips
    tickets: 0, // Encore Tickets held
    jumbo: false,
    bought: [], // one-time store items already taken
    ledger: [], // pretend purchases, for testing the store
    playSeconds: 0,
    settings: { music: 0.8, sfx: 0.8, low: false },
  };
}

export class Game {
  constructor(storage, rng = Math.random) {
    this.storage = storage === undefined ? safeStorage() : storage;
    this.rng = rng;
    this.s = newState();
    this.away = 0; // seconds since last visit (set by load)
    this.awayTips = 0; // tips that piled up while away
    this.news = []; // things that just happened, for the UI to announce
    this._wasHarmony = false;
  }

  // ------------------------------------------------------------------ save

  load(now = Date.now()) {
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const base = newState();
        this.s = { ...base, ...p, levels: { ...base.levels, ...p.levels }, needs: { ...base.needs, ...p.needs }, settings: { ...base.settings, ...p.settings }, daily: { ...base.daily, ...p.daily }, stat: { ...base.stat, ...p.stat }, wearing: { ...base.wearing, ...p.wearing }, tasks: { ...base.tasks, ...p.tasks } };
      }
    } catch {
      this.s = newState();
    }
    if (this.s.adopted) {
      this.away = Math.max(0, (now - (this.s.lastSeen || now)) / 1000);
      this.applyAway(this.away);
    }
    return this.s;
  }

  save(now = Date.now()) {
    this.s.lastSeen = now;
    try {
      if (this.storage) this.storage.setItem(KEY, JSON.stringify(this.s));
    } catch { /* storage unavailable: keep playing in memory */ }
  }

  reset() {
    const { settings, ledger } = this.s;
    this.s = newState();
    this.s.settings = settings;
    this.s.ledger = ledger; // the store test log outlives a restart
    this.save();
  }

  /**
   * While you are away the pup keeps busking (the jar fills, up to its brim)
   * and needs drift down slowly, but never to rock bottom.
   */
  applyAway(seconds) {
    const before = this.s.jar;
    this.s.jar = Math.min(this.tipCap(), this.s.jar + (this.tipRate(TIP_OFFLINE) * seconds) / 60);
    this.awayTips = Math.max(0, Math.floor(this.s.jar) - Math.floor(before));
    for (const k of NEEDS) {
      const drop = (DECAY[k] * seconds) / OFFLINE_SLOWDOWN;
      this.s.needs[k] = Math.max(Math.min(this.s.needs[k], OFFLINE_FLOOR), this.s.needs[k] - drop);
    }
    this.s.petPool = 10;
    this.s.frenzy = 0;
  }

  // ------------------------------------------------------------- adoption

  adopt(name, coat, family) {
    const s = this.s;
    s.adopted = true;
    s.name = (name || '').trim().slice(0, 14) || 'Biscuit';
    s.coat = coat;
    s.levels = { perc: 0, str: 0, wood: 0, brass: 0 };
    s.levels[family] = 1;
    s.lastSeen = Date.now();
    this.save();
  }

  // ---------------------------------------------------------------- status

  get total() {
    const l = this.s.levels;
    return l.perc + l.str + l.wood + l.brass;
  }

  get rank() {
    return RANKS[Math.min(RANKS.length - 1, this.total)];
  }

  // ----------------------------------------------------------- tips engine

  /** Everything earned is multiplied by this (Virtuoso stars). */
  get boost() {
    return 1 + STAR_BOOST * this.s.stars;
  }

  /** All four needs comfortably full: the pup is "in harmony" and tips double. */
  get harmony() {
    const n = this.s.needs;
    return Math.min(n.food, n.fun, n.clean, n.rest) >= 70;
  }

  /** Notes per minute dropping into the jar. `factor` overrides the mood bonus. */
  tipRate(factor) {
    const f = factor ?? ((this.harmony ? 2 : 0.5 + this.mood) * (this.s.frenzy > 0 ? 3 : 1) * (this.s.magnet > 0 ? 2 : 1));
    return (TIP_BASE + TIP_PER_PART * this.total) * this.boost * f;
  }

  /** The jar holds a couple of hours of tips; a bigger orchestra needs a bigger jar. */
  tipCap() {
    return Math.round(this.tipRate(1) * (60 + 20 * this.total) * (this.s.jumbo ? 2 : 1));
  }

  get jarFill() {
    return Math.min(1, this.s.jar / this.tipCap());
  }

  collectJar() {
    const amount = Math.floor(this.s.jar);
    if (amount < 1) return 0;
    this.s.jar -= amount;
    this.bump('jarNotes', amount);
    this.bump('jarCollects');
    return this.earn(amount);
  }

  /** Is today's gift still wrapped? */
  dailyReady(now = Date.now()) {
    return this.s.adopted && dayIndex(now) > this.s.daily.day;
  }

  /** What tomorrow's gift is worth, as a multiplier (shown to build anticipation). */
  streakMult(streak) {
    return 1 + 0.25 * ((Math.max(1, streak) - 1) % STREAK_LEN);
  }

  /**
   * Open today's gift. Streaks are forgiving: missing a single day keeps the
   * streak where it was instead of throwing it away.
   */
  claimDaily(now = Date.now()) {
    if (!this.dailyReady(now)) return null;
    const d = this.s.daily;
    const today = dayIndex(now);
    const gap = today - d.day;
    const kept = d.streak > 0 && gap === 2;
    d.streak = d.streak > 0 && gap <= 2 ? d.streak + (kept ? 0 : 1) : 1;
    if (kept) d.streak = Math.max(1, d.streak);
    d.day = today;
    const roll = this.rng();
    const tier = roll < 0.08 ? 'jackpot' : roll < 0.3 ? 'big' : 'nice';
    const mult = { jackpot: 4, big: 2, nice: 1 }[tier];
    const amount = this.earn((15 + 10 * this.total) * this.streakMult(d.streak) * mult * this.boost);
    const day = ((d.streak - 1) % STREAK_LEN) + 1;
    const gems = day === STREAK_LEN ? 20 : 0;
    this.s.gems += gems;
    this.save(now);
    return { amount, gems, tier, streak: d.streak, kept, day, next: this.streakMult(d.streak + 1) };
  }

  /** Prize for catching a golden note. */
  goldenPrize() {
    const roll = this.rng();
    const base = (6 + 3 * this.total) * this.boost;
    this.bump('golden');
    if (roll < 0.03) {
      this.s.gems += 5;
      return { kind: 'jackpot', amount: this.earn(base * 8), gems: 5 };
    }
    if (roll < 0.15) return { kind: 'big', amount: this.earn(base * 3) };
    if (roll < 0.4) {
      this.s.frenzy = 30;
      return { kind: 'frenzy', amount: 0 };
    }
    return { kind: 'notes', amount: this.earn(base) };
  }

  /** Now and then a bit of care pays double. */
  lucky(amount) {
    if (amount > 0 && this.rng() < 0.12) {
      this.s.lucky++;
      return { amount: amount + this.earn(amount), lucky: true };
    }
    return { amount, lucky: false };
  }

  starCost() {
    return Math.round(STAR_COST * Math.pow(1.35, this.s.stars));
  }

  /** After Full Orchestra, notes buy Virtuoso stars: +10% to everything, forever. */
  buyStar() {
    if (this.total < 12 || this.s.notes < this.starCost()) return false;
    this.s.notes -= this.starCost();
    this.s.stars++;
    this.save();
    return true;
  }

  /** 0..1 overall happiness. The lowest need drags it down hardest. */
  get mood() {
    const n = this.s.needs;
    const avg = (n.food + n.fun + n.clean + n.rest) / 400;
    const low = Math.min(n.food, n.fun, n.clean, n.rest) / 100;
    return Math.max(0, Math.min(1, avg * 0.6 + low * 0.4));
  }

  lowestNeed() {
    return NEEDS.reduce((a, b) => (this.s.needs[a] <= this.s.needs[b] ? a : b));
  }

  owns(id) {
    const u = upgradeById(id);
    return this.s.levels[u.family] >= u.tier;
  }

  nextCost() {
    const owned = this.total - 1; // the starter was free
    return owned >= COSTS.length ? null : COSTS[Math.max(0, owned)];
  }

  /** 'owned' | 'ready' | 'poor' | 'locked' */
  status(id) {
    const u = upgradeById(id);
    const lvl = this.s.levels[u.family];
    if (lvl >= u.tier) return 'owned';
    if (lvl < u.tier - 1) return 'locked';
    return this.s.notes >= this.nextCost() ? 'ready' : 'poor';
  }

  /** The cheapest thing to aim for next (for the goal hint). */
  nextUpgrade() {
    return UPGRADES.find((u) => this.s.levels[u.family] === u.tier - 1 && u.tier === Math.min(...UPGRADES.filter((x) => this.s.levels[x.family] === x.tier - 1).map((x) => x.tier))) || null;
  }

  // --------------------------------------------------------------- actions

  tick(dt, { asleep = false } = {}) {
    const n = this.s.needs;
    for (const k of NEEDS) {
      if (k === 'rest' && asleep) continue;
      n[k] = Math.max(0, n[k] - DECAY[k] * dt * (asleep && k !== 'rest' ? 0.4 : 1));
    }
    if (asleep) n.rest = Math.min(100, n.rest + 5.5 * dt);
    this.s.petPool = Math.min(10, this.s.petPool + dt / 7);
    this.s.jar = Math.min(this.tipCap(), this.s.jar + (this.tipRate() * dt) / 60);
    this.s.frenzy = Math.max(0, this.s.frenzy - dt);
    this.s.magnet = Math.max(0, this.s.magnet - dt);
    this.s.playSeconds += dt;
    const h = this.harmony;
    if (h && !this._wasHarmony) this.bump('harmony');
    this._wasHarmony = h;
  }

  earn(amount) {
    const a = Math.max(0, Math.round(amount));
    this.s.notes += a;
    this.s.earned += a;
    return a;
  }

  /** Raise a need; returns the notes earned (caring when it matters pays more). */
  care(need, amount, rate = 0.3) {
    const n = this.s.needs;
    const before = n[need];
    n[need] = Math.min(100, before + amount);
    return this.earn((n[need] - before) * rate);
  }

  spend(need, amount) {
    this.s.needs[need] = Math.max(0, this.s.needs[need] - amount);
  }

  /** One loving stroke. Notes come from a small pool that refills over time. */
  pet() {
    const s = this.s;
    s.pets++;
    this.bump('pets');
    s.needs.fun = Math.min(100, s.needs.fun + 1.5);
    if (s.petPool >= 1) {
      s.petPool -= 1;
      return this.earn(1);
    }
    return 0;
  }

  canConcert() {
    const n = this.s.needs;
    if (n.rest < 18) return 'rest';
    if (n.food < 10) return 'food';
    return null;
  }

  concertReward(bonus = 0) {
    return Math.round((8 + 9 * this.total) * (0.4 + 0.6 * this.mood) * this.boost) + bonus;
  }

  /**
   * How the crowd reacts. A happy pup and well-timed taps tilt the odds, but
   * the size of the ovation is always a surprise.
   */
  crowdReaction(bonus = 0) {
    const skill = Math.min(1, this.mood * 0.5 + (bonus / 20) * 0.5);
    const roll = this.rng();
    const encore = 0.03 + 0.07 * skill;
    const standing = encore + 0.12 + 0.18 * skill;
    if (roll < encore) return { tier: 'encore', mult: 3 };
    if (roll < standing) return { tier: 'ovation', mult: 2 };
    if (roll < standing + 0.3) return { tier: 'cheers', mult: 1.5 };
    return { tier: 'applause', mult: 1 };
  }

  finishConcert(bonus = 0) {
    const s = this.s;
    let reaction = this.crowdReaction(bonus);
    let ticket = false;
    if (s.tickets > 0) {
      s.tickets--;
      ticket = true;
      if (reaction.mult < 2) reaction = { tier: 'ovation', mult: 2 };
    }
    const place = placeById(s.place);
    const reward = this.concertReward(bonus) * reaction.mult * place.mult;
    s.concerts++;
    this.bump('concerts');
    s.stat.concertsAt[place.id] = (s.stat.concertsAt[place.id] || 0) + 1;
    // applause at a venue adds up to fame stars there
    const before = this.fameStars(place.id);
    s.fame[place.id] = (s.fame[place.id] || 0) + { applause: 1, cheers: 2, ovation: 3, encore: 4 }[reaction.tier];
    const stars = this.fameStars(place.id);
    const newStars = place.id === 'home' ? 0 : stars - before;
    s.gems += newStars * 5;
    this.spend('rest', 20);
    this.spend('food', 7);
    s.needs.fun = Math.min(100, s.needs.fun + 12);
    return { earned: this.earn(reward), ...reaction, ticket, place: place.id, stars, newStars, gems: newStars * 5 };
  }

  // ------------------------------------------------------------- the world

  fameStars(place) {
    const pts = this.s.fame[place] || 0;
    return FAME_STEPS.filter((n) => pts >= n).length;
  }

  /** Stars earned across every isle (the porch at home does not count). */
  get fame() {
    return PLACES.reduce((sum, p) => sum + (p.id === 'home' ? 0 : this.fameStars(p.id)), 0);
  }

  placeOpen(id) {
    return this.fame >= placeById(id).need;
  }

  travel(id) {
    if (!this.placeOpen(id) || id === this.s.place) return false;
    const first = !this.s.visited.includes(id);
    this.s.place = id;
    if (first) this.s.visited.push(id);
    if (id !== 'home') this.bump('travels');
    this.save();
    return { first };
  }

  /** How far along a friend's current quest is. Null when they have none left. */
  questState(npc) {
    const st = this.s.q[npc];
    const list = QUESTS[npc];
    if (!st || st.i >= list.length) return null;
    const quest = list[st.i];
    const g = quest.goal;
    const stat = this.s.stat;
    const since = (key) => (stat[key] || 0) - (st.base[key] || 0);
    let have, need = g.n || 1;
    if (g.type === 'concertsAt') have = (stat.concertsAt[g.place] || 0) - ((st.base.concertsAt || {})[g.place] || 0);
    else if (g.type === 'fame') have = this.fameStars(g.place);
    else if (g.type === 'grow') {
      have = this.s.levels[g.family];
      need = g.tier;
    } else if (g.type === 'full') {
      have = this.total;
      need = 12;
    } else if (g.type === 'jar') have = since('jarNotes');
    else have = since(g.type); // harmony, golden, pets
    return { quest, index: st.i, have: Math.min(have, need), need, done: have >= need };
  }

  _giveQuest(npc, i) {
    this.s.q[npc] = { i, base: JSON.parse(JSON.stringify(this.s.stat)) };
  }

  /**
   * Talk to a friend. First meeting: an introduction and their first quest.
   * Later: hand in a finished quest (and get the next), or just chat.
   */
  talk(npc) {
    const who = NPCS[npc];
    const s = this.s;
    const lines = [];
    let reward = null;
    if (!s.met.includes(npc)) {
      s.met.push(npc);
      lines.push(...who.intro);
      this._giveQuest(npc, 0);
      lines.push(QUESTS[npc][0].ask);
    } else {
      const qs = this.questState(npc);
      if (qs && qs.done) {
        reward = this._reward(qs.quest.reward);
        lines.push(qs.quest.done);
        const next = qs.index + 1;
        this._giveQuest(npc, next);
        if (QUESTS[npc][next]) lines.push(QUESTS[npc][next].ask);
        else lines.push('You have done everything I could ask. Come and play whenever you like.');
      } else {
        lines.push(who.idle[Math.floor(this.rng() * who.idle.length)]);
        if (qs) lines.push(`${qs.quest.ask} (${qs.have} of ${qs.need})`);
      }
    }
    this.save();
    return { name: who.name, title: who.title, lines, reward };
  }

  _reward(r) {
    const s = this.s;
    const out = { notes: 0, gems: r.gems || 0, souvenir: null, legend: null, cosmetic: null };
    if (r.notes) out.notes = this.earn(r.notes * this.boost);
    s.gems += out.gems;
    if (r.souvenir && !s.souvenirs.includes(r.souvenir)) s.souvenirs.push((out.souvenir = r.souvenir));
    if (r.legend && !s.legends.includes(r.legend)) s.legends.push((out.legend = r.legend));
    if (r.cosmetic && !s.wardrobe.includes(r.cosmetic)) s.wardrobe.push((out.cosmetic = r.cosmetic));
    return out;
  }

  /** Songbook progress: places seen, friends met, legends heard. */
  get songbook() {
    const have = this.s.visited.length + this.s.met.length + this.s.legends.length;
    return { have, total: PLACES.length + Object.keys(NPCS).length + 6 };
  }

  // ------------------------------------------------------- daily to-do list

  /** Three small tasks, re-drawn each calendar day. */
  ensureTasks(now = Date.now()) {
    const day = dayIndex(now);
    const t = this.s.tasks;
    if (t.day === day && t.list.length) return t.list;
    // a different, repeatable trio each day
    const order = TASKS.map((_, i) => i).sort((a, b) => ((a * 7 + day * 13) % 11) - ((b * 7 + day * 13) % 11) || a - b);
    const picked = [];
    for (const i of order) {
      if (picked.length < 3 && !picked.some((k) => TASKS[k].type === TASKS[i].type)) picked.push(i);
    }
    t.day = day;
    t.list = picked.map((k) => ({ k, have: 0, done: false }));
    t.bonus = false;
    return t.list;
  }

  /** Count something that happened, for quests and daily tasks. */
  bump(type, n = 1) {
    const s = this.s;
    s.stat[type] = (s.stat[type] || 0) + n;
    if (!s.adopted) return;
    for (const t of this.ensureTasks()) {
      const def = TASKS[t.k];
      if (t.done || def.type !== type) continue;
      t.have = Math.min(def.n, t.have + (type === 'jarNotes' ? 0 : n));
      if (t.have >= def.n) {
        t.done = true;
        s.gems += TASK_GEMS;
        this.news.push({ type: 'task', label: def.label, gems: TASK_GEMS });
      }
    }
    if (!s.tasks.bonus && s.tasks.list.length && s.tasks.list.every((t) => t.done)) {
      s.tasks.bonus = true;
      s.gems += TASK_BONUS;
      this.news.push({ type: 'tasks', gems: TASK_BONUS });
    }
  }

  // ------------------------------------------------- gems + pretend store

  spendGems(cost) {
    if (this.s.gems < cost) return false;
    this.s.gems -= cost;
    return true;
  }

  /**
   * A PRETEND purchase: nothing is charged anywhere. Grants the pack and
   * writes a line in the test ledger so the store can be evaluated.
   */
  buyPack(sku, now = Date.now()) {
    const pack = GEM_PACKS.find((p) => p.sku === sku);
    const s = this.s;
    if (!pack || (pack.once && s.bought.includes(sku))) return null;
    s.gems += pack.gems;
    if (pack.notes) this.earn(pack.notes);
    if (pack.cosmetic && !s.wardrobe.includes(pack.cosmetic)) s.wardrobe.push(pack.cosmetic);
    if (pack.once) s.bought.push(sku);
    s.ledger.push({ t: now, sku, name: pack.name, price: pack.price, at: Math.round(s.playSeconds) });
    this.save(now);
    return pack;
  }

  /** Totals for the store test log. */
  get ledger() {
    const l = this.s.ledger;
    return { count: l.length, total: l.reduce((a, b) => a + b.price, 0), firstAt: l.length ? l[0].at : null, items: l };
  }

  clearLedger() {
    this.s.ledger = [];
    this.save();
  }

  buyBoost(id) {
    const b = BOOSTS.find((x) => x.id === id);
    const s = this.s;
    if (!b || (b.once && s.bought.includes(id)) || !this.spendGems(b.cost)) return null;
    let detail = 0;
    if (id === 'hamper') for (const k of NEEDS) s.needs[k] = 100;
    else if (id === 'magnet') s.magnet += 600;
    else if (id === 'ticket') s.tickets++;
    else if (id === 'sack') detail = this.earn((100 + 40 * this.total) * this.boost);
    else if (id === 'jumbo') s.jumbo = true;
    if (b.once) s.bought.push(id);
    this.save();
    return { ...b, detail };
  }

  buyCosmetic(id) {
    const c = cosmeticById(id);
    const s = this.s;
    if (!c || c.cost == null || s.wardrobe.includes(id) || !this.spendGems(c.cost)) return false;
    s.wardrobe.push(id);
    s.wearing[c.slot] = id;
    this.save();
    return true;
  }

  /** Put an owned item on, or take it off if it is already on. */
  wear(id) {
    const c = cosmeticById(id);
    if (!c || !this.s.wardrobe.includes(id)) return false;
    this.s.wearing[c.slot] = this.s.wearing[c.slot] === id ? null : id;
    this.save();
    return true;
  }

  buy(id) {
    if (this.status(id) !== 'ready') return false;
    const u = upgradeById(id);
    this.s.notes -= this.nextCost();
    this.s.levels[u.family] = u.tier;
    this.save();
    return true;
  }
}

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.getItem(KEY);
    return s;
  } catch {
    return null;
  }
}
