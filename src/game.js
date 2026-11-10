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
    settings: { music: 0.8, sfx: 0.8, low: false },
  };
}

export class Game {
  constructor(storage) {
    this.storage = storage === undefined ? safeStorage() : storage;
    this.s = newState();
    this.away = 0; // seconds since last visit (set by load)
  }

  // ------------------------------------------------------------------ save

  load(now = Date.now()) {
    try {
      const raw = this.storage && this.storage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const base = newState();
        this.s = { ...base, ...p, levels: { ...base.levels, ...p.levels }, needs: { ...base.needs, ...p.needs }, settings: { ...base.settings, ...p.settings } };
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

  /** Needs drift down slowly while you are away, but never to rock bottom. */
  applyAway(seconds) {
    for (const k of NEEDS) {
      const drop = (DECAY[k] * seconds) / OFFLINE_SLOWDOWN;
      this.s.needs[k] = Math.max(Math.min(this.s.needs[k], OFFLINE_FLOOR), this.s.needs[k] - drop);
    }
    this.s.petPool = 10;
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
    return Math.round((8 + 9 * this.total) * (0.4 + 0.6 * this.mood)) + bonus;
  }

  finishConcert(bonus = 0) {
    const reward = this.concertReward(bonus);
    this.s.concerts++;
    this.spend('rest', 20);
    this.spend('food', 7);
    this.s.needs.fun = Math.min(100, this.s.needs.fun + 12);
    return this.earn(reward);
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
