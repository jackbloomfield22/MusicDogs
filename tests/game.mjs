// Dependency-free checks of the pet game's rules and music:  npm test
import assert from 'node:assert/strict';
import { Game, UPGRADES, COSTS, RANKS, NEEDS, FAMILY_ORDER } from '../src/game.js';
import { buildScore, BARS, STEPS_PER_BAR } from '../src/audio/score.js';

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};
const fresh = (family = 'perc') => {
  const g = new Game(null);
  g.adopt('Testy', 'biscuit', family);
  return g;
};

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
  ok(minutes > 12 && minutes < 50, `full orchestra takes a session, not seconds or days (simulated ${minutes.toFixed(1)} min)`);
  console.log(`  simulated time to Full Orchestra: ${minutes.toFixed(1)} minutes, ${g.s.concerts} concerts`);
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
