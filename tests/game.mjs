// Dependency-free checks of the pet game's rules and music:  npm test
import assert from 'node:assert/strict';
import { Game, UPGRADES, COSTS, RANKS, NEEDS, FAMILY_ORDER, STREAK_LEN, dayIndex } from '../src/game.js';
import { buildScore, BARS, STEPS_PER_BAR } from '../src/audio/score.js';

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};
/** A repeatable stand-in for Math.random so results never flake. */
const seeded = (seed = 12345) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const fresh = (family = 'perc', rng = seeded()) => {
  const g = new Game(null, rng);
  g.adopt('Testy', 'biscuit', family);
  return g;
};
const DAY = 86400000;

// --- catalogue ---
ok(UPGRADES.length === 12, 'twelve instrument parts');
for (const f of FAMILY_ORDER) ok(UPGRADES.filter((u) => u.family === f).map((u) => u.tier).join() === '1,2,3', `${f} has tiers 1-3`);
ok(COSTS.length === 11 && COSTS.every((c, i) => i === 0 || c > COSTS[i - 1]), 'eleven rising prices (the starter is free)');
ok(RANKS.length === 13, 'a rank for every orchestra size');

// --- adoption ---
for (const f of FAMILY_ORDER) {
  const g = fresh(f);
  ok(g.total === 1 && g.s.levels[f] === 1, `${f} starter pup begins half instrument`);
  ok(g.rank === 'Solo Pup', 'starter rank');
}

// --- buying ---
{
  const g = fresh('perc');
  ok(g.status('perc1') === 'owned' && g.status('perc2') === 'poor' && g.status('perc3') === 'locked', 'tier order is enforced');
  ok(!g.buy('perc2'), 'cannot buy without notes');
  g.s.notes = COSTS[0];
  ok(g.status('str1') === 'ready' && g.buy('str1') && g.s.notes === 0 && g.total === 2, 'buying spends notes and grows the part');
  ok(!g.buy('str3'), 'cannot skip a tier');
  g.s.notes = 100000;
  let spent = COSTS[0];
  for (const u of UPGRADES) {
    if (g.owns(u.id)) continue;
    const before = g.s.notes;
    ok(g.buy(u.id), `can grow ${u.name}`);
    spent += before - g.s.notes;
  }
  ok(g.total === 12 && g.rank === 'Full Orchestra' && g.nextCost() === null, 'all twelve grown');
  ok(spent === COSTS.reduce((a, b) => a + b, 0), 'total price matches the price list');
}

// --- needs ---
{
  const g = fresh();
  const before = { ...g.s.needs };
  g.tick(60);
  ok(NEEDS.every((n) => g.s.needs[n] < before[n]), 'needs fall over time');
  g.s.needs.rest = 30;
  g.tick(5, { asleep: true });
  ok(g.s.needs.rest > 30, 'sleep restores rest');
  g.s.needs.food = 20;
  const got = g.care('food', 40);
  ok(got === 12 && g.s.needs.food === 60, 'feeding a hungry pup pays notes');
  g.s.needs.food = 100;
  ok(g.care('food', 40) === 0, 'over-feeding pays nothing');
  for (let i = 0; i < 50; i++) g.tick(600);
  ok(NEEDS.every((n) => g.s.needs[n] === 0) && g.mood === 0, 'needs bottom out at zero, never negative');
  ok(g.canConcert() === 'rest', 'a worn-out pup will not perform');
}

// --- petting cannot be farmed forever ---
{
  const g = fresh();
  let notes = 0;
  for (let i = 0; i < 100; i++) notes += g.pet();
  ok(notes === 10, 'petting pays from a small pool');
  g.tick(70);
  ok(g.pet() === 1, 'the pool refills with time');
}

// --- being away is gentle ---
{
  const g = fresh();
  g.s.needs = { food: 90, fun: 90, clean: 90, rest: 90 };
  g.applyAway(3600 * 24 * 7);
  ok(NEEDS.every((n) => g.s.needs[n] >= 28), 'a week away never leaves the pup at rock bottom');
  const g2 = fresh();
  g2.s.needs = { food: 10, fun: 90, clean: 90, rest: 90 };
  g2.applyAway(3600);
  ok(g2.s.needs.food <= 10, 'being away never raises a need');
}

// --- save / load round trip ---
{
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const g = new Game(storage);
  g.adopt('Luna', 'snow', 'brass');
  g.s.notes = 77;
  g.save(1000);
  const h = new Game(storage);
  h.load(1000 + 3600 * 1000);
  ok(h.s.name === 'Luna' && h.s.coat === 'snow' && h.s.levels.brass === 1 && h.s.notes === 77, 'progress survives a reload');
  ok(Math.round(h.away) === 3600, 'time away is measured');
  const broken = new Game({ getItem: () => '{nope', setItem: () => {} });
  broken.load();
  ok(!broken.s.adopted, 'corrupt saves fall back to a fresh start');
}

// --- a simulated play session reaches Full Orchestra in a sensible time ---
{
  const g = fresh();
  let t = 0;
  const step = (dt, asleep = false) => {
    g.tick(dt, { asleep });
    t += dt;
  };
  while (g.total < 12 && t < 3600 * 3) {
    const n = g.s.needs;
    const buyable = UPGRADES.find((u) => g.status(u.id) === 'ready');
    if (g.jarFill > 0.1) g.collectJar();
    if (buyable) g.buy(buyable.id);
    else if (n.rest < 30) {
      const from = n.rest;
      while (n.rest < 95) step(1, true);
      g.earn((n.rest - from) * 0.15);
    } else if (n.food < 45) {
      step(6);
      g.care('food', 42);
    } else if (n.clean < 40) {
      const from = n.clean;
      step(12);
      n.clean = 100;
      g.earn((100 - from) * 0.25);
    } else if (n.fun < 45) {
      for (let i = 0; i < 3; i++) {
        step(6);
        g.spend('rest', 3);
        g.care('fun', 17);
      }
    } else {
      step(21);
      g.finishConcert(6);
    }
  }
  const minutes = t / 60;
  ok(g.total === 12, 'a caring player completes the orchestra');
  ok(minutes > 8 && minutes < 50, `full orchestra takes a session, not seconds or days (simulated ${minutes.toFixed(1)} min)`);
  console.log(`  simulated time to Full Orchestra: ${minutes.toFixed(1)} minutes, ${g.s.concerts} concerts`);
}

// --- tip jar: steady income, in play and away ---
{
  const g = fresh();
  g.s.needs = { food: 50, fun: 50, clean: 50, rest: 50 };
  ok(g.collectJar() === 0, 'an empty jar gives nothing');
  const slow = g.tipRate();
  g.s.needs = { food: 90, fun: 90, clean: 90, rest: 90 };
  ok(g.harmony && g.tipRate() > slow * 1.5, 'a pup in harmony earns tips much faster');
  g.tick(120);
  ok(g.s.jar > 2 && g.s.jar < g.tipCap(), 'tips trickle in while playing');
  const got = g.collectJar();
  ok(got >= 2 && g.s.notes === got && g.s.jar < 1, 'collecting the jar pays out whole notes');
  const big = fresh();
  big.s.levels = { perc: 3, str: 3, wood: 3, brass: 3 };
  ok(big.tipRate(1) > g.tipRate(1) * 3 && big.tipCap() > g.tipCap() * 3, 'a bigger orchestra earns more and holds more');
  g.applyAway(3600 * 24 * 30);
  ok(Math.abs(g.s.jar - g.tipCap()) < 1e-6, 'the jar stops at its brim however long you are away');
  ok(g.awayTips > 0 && g.awayTips <= g.tipCap(), 'time away is reported as tips to collect');
  const cap = g.tipCap();
  for (let i = 0; i < 100; i++) g.tick(60);
  ok(g.s.jar <= cap + 1e-6, 'a full jar never overflows');
}

// --- daily gift + forgiving streak ---
{
  const t0 = Date.UTC(2026, 0, 10, 12);
  const g = fresh();
  ok(g.dailyReady(t0), 'a gift waits on the first day');
  const a = g.claimDaily(t0);
  ok(a && a.streak === 1 && a.amount > 0 && g.s.notes === a.amount, 'day one gift pays out');
  ok(!g.dailyReady(t0 + 3600000) && g.claimDaily(t0 + 3600000) === null, 'only one gift a day');
  const b = g.claimDaily(t0 + DAY);
  ok(b.streak === 2 && !b.kept, 'coming back the next day grows the streak');
  const c = g.claimDaily(t0 + DAY * 3);
  ok(c.streak === 2 && c.kept, 'missing a single day keeps the streak instead of losing it');
  const d = g.claimDaily(t0 + DAY * 8);
  ok(d.streak === 1, 'a long break starts a fresh streak (and still pays a gift)');
  ok(g.streakMult(7) > g.streakMult(1) && g.streakMult(8) === g.streakMult(1), `the gift grows over ${STREAK_LEN} days, then the round restarts`);
  ok(dayIndex(t0 + DAY) === dayIndex(t0) + 1, 'days are counted on the calendar');
  // gift tiers follow the roll
  const tier = (roll) => {
    const x = new Game(null, () => roll);
    x.adopt('T', 'biscuit', 'perc');
    return x.claimDaily(t0);
  };
  ok(tier(0.01).tier === 'jackpot' && tier(0.2).tier === 'big' && tier(0.9).tier === 'nice', 'gift tiers');
  ok(tier(0.01).amount === tier(0.9).amount * 4, 'a jackpot gift is four times a normal one');
}

// --- surprises: golden notes, lucky care, crowd reactions ---
{
  const prize = (roll) => {
    const x = new Game(null, () => roll);
    x.adopt('T', 'biscuit', 'perc');
    const p = x.goldenPrize();
    return { ...p, frenzy: x.s.frenzy, notes: x.s.notes };
  };
  ok(prize(0.01).kind === 'jackpot' && prize(0.1).kind === 'big' && prize(0.3).kind === 'frenzy' && prize(0.9).kind === 'notes', 'golden note prizes');
  ok(prize(0.9).notes > 0 && prize(0.01).amount === prize(0.9).amount * 8, 'golden notes always pay something; a jackpot pays eight-fold');
  ok(prize(0.3).frenzy === 30, 'a tip frenzy lasts thirty seconds');
  const f = fresh();
  const base = f.tipRate();
  f.s.frenzy = 30;
  ok(Math.abs(f.tipRate() - base * 3) < 1e-9, 'a frenzy triples tips');
  f.tick(31);
  ok(f.s.frenzy === 0, 'and then it ends');

  const lucky = new Game(null, () => 0.05);
  lucky.adopt('T', 'biscuit', 'perc');
  ok(lucky.lucky(10).amount === 20 && lucky.s.notes === 10, 'a lucky care reward doubles');
  const plain = new Game(null, () => 0.5);
  plain.adopt('T', 'biscuit', 'perc');
  ok(plain.lucky(10).amount === 10 && !plain.lucky(0).lucky, 'most rewards are not lucky; zero never is');

  const react = (roll, bonus = 0) => {
    const x = new Game(null, () => roll);
    x.adopt('T', 'biscuit', 'perc');
    return x.crowdReaction(bonus).tier;
  };
  ok(react(0.001) === 'encore' && react(0.99) === 'applause', 'the crowd can go wild or stay polite');
  const g = fresh();
  let tiers = { applause: 0, cheers: 0, ovation: 0, encore: 0 };
  for (let i = 0; i < 4000; i++) tiers[g.crowdReaction(10).tier]++;
  ok(tiers.applause > tiers.cheers && tiers.cheers > tiers.ovation && tiers.ovation > tiers.encore && tiers.encore > 0, 'bigger ovations are rarer');
  const sloppy = fresh('perc', seeded(7));
  const skilled = fresh('perc', seeded(7));
  sloppy.s.needs = { food: 20, fun: 20, clean: 20, rest: 20 };
  skilled.s.needs = { food: 95, fun: 95, clean: 95, rest: 95 };
  let a = 0, b = 0;
  for (let i = 0; i < 4000; i++) {
    a += sloppy.crowdReaction(0).mult;
    b += skilled.crowdReaction(20).mult;
  }
  ok(b > a * 1.1, 'a happy pup and good timing earn better reactions on average');
  const r = fresh().finishConcert(5);
  ok(r.earned > 0 && ['applause', 'cheers', 'ovation', 'encore'].includes(r.tier), 'a concert reports what it earned and how the crowd reacted');
}

// --- Virtuoso stars: something to save for after Full Orchestra ---
{
  const g = fresh();
  g.s.notes = 1e6;
  ok(!g.buyStar(), 'no stars before the orchestra is complete');
  for (const u of UPGRADES) if (!g.owns(u.id)) g.buy(u.id);
  const c1 = g.starCost();
  const rate = g.tipRate(1), concert = g.concertReward();
  ok(g.buyStar() && g.s.stars === 1 && g.starCost() > c1, 'stars can be bought, each dearer than the last');
  ok(g.tipRate(1) > rate && g.concertReward() > concert && Math.abs(g.boost - 1.1) < 1e-9, 'each star lifts everything earned by 10%');
  g.s.notes = 0;
  ok(!g.buyStar(), 'stars need notes');
}

// --- the score ---
{
  const score = buildScore();
  ok(score.steps === BARS * STEPS_PER_BAR, 'score length');
  const lines = Object.keys(score.parts);
  for (const tag of ['lead', 'harmony', 'perc1', 'perc2', 'perc3', 'str2', 'str3', 'wood2', 'wood3', 'brass1', 'brass2', 'brass3']) ok(lines.includes(tag) && score.parts[tag].length > 10, `${tag} has a line to play`);
  const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
  for (const [tag, notes] of Object.entries(score.parts)) {
    ok(notes.every((n) => n.step >= 0 && n.step < score.steps && n.len >= 1), `${tag}: notes sit inside the loop`);
    ok(notes.every((n) => n.m == null || C_MAJOR.includes(n.m % 12)), `${tag}: every pitch is in key`);
    ok(notes.every((n) => n.m == null || (n.m >= 30 && n.m <= 96)), `${tag}: pitches in a playable range`);
  }
}

console.log(`MusicDogs pet game: ${checks} checks passed`);
