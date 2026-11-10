// Rules of the pet game: needs, rewards, upgrades and saving.
// Pure data + logic (no DOM, no 3D) so it can be tested on its own.

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
export const COSTS = [20, 35, 55, 80, 115, 160, 220, 300, 400, 520, 680];
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
  }

  // ------------------------------------------------------------------ save

  load(now = Date.now()) {
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const base = newState();
        this.s = { ...base, ...p, levels: { ...base.levels, ...p.levels }, needs: { ...base.needs, ...p.needs }, settings: { ...base.settings, ...p.settings }, daily: { ...base.daily, ...p.daily } };
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
    const settings = this.s.settings;
    this.s = newState();
    this.s.settings = settings;
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
    const f = factor ?? ((this.harmony ? 2 : 0.5 + this.mood) * (this.s.frenzy > 0 ? 3 : 1));
    return (TIP_BASE + TIP_PER_PART * this.total) * this.boost * f;
  }

  /** The jar holds a couple of hours of tips; a bigger orchestra needs a bigger jar. */
  tipCap() {
    return Math.round(this.tipRate(1) * (60 + 20 * this.total));
  }

  get jarFill() {
    return Math.min(1, this.s.jar / this.tipCap());
  }

  collectJar() {
    const amount = Math.floor(this.s.jar);
    if (amount < 1) return 0;
    this.s.jar -= amount;
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
    this.save(now);
    return { amount, tier, streak: d.streak, kept, day: ((d.streak - 1) % STREAK_LEN) + 1, next: this.streakMult(d.streak + 1) };
  }

  /** Prize for catching a golden note. */
  goldenPrize() {
    const roll = this.rng();
    const base = (6 + 3 * this.total) * this.boost;
    if (roll < 0.03) return { kind: 'jackpot', amount: this.earn(base * 8) };
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
    const reaction = this.crowdReaction(bonus);
    const reward = this.concertReward(bonus) * reaction.mult;
    this.s.concerts++;
    this.spend('rest', 20);
    this.spend('food', 7);
    this.s.needs.fun = Math.min(100, this.s.needs.fun + 12);
    return { earned: this.earn(reward), ...reaction };
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
