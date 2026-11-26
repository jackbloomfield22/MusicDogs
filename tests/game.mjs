// Dependency-free checks of the pet game's rules and music:  npm test
import assert from 'node:assert/strict';
import { Game, UPGRADES, COSTS, RANKS, NEEDS, FAMILY_ORDER, STREAK_LEN, dayIndex } from '../src/game.js';
import { buildScore, BARS, STEPS_PER_BAR } from '../src/audio/score.js';
import { PLACES, NPCS, QUESTS, LEGENDS, SOUVENIRS, GEM_PACKS, BOOSTS, COSMETICS, TASKS, FAME_STEPS } from '../src/lore.js';

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
      // perform on the best isle that is open (needs can only be topped up at home)
      const best = [...PLACES].reverse().find((p) => g.placeOpen(p.id));
      if (g.s.place !== best.id) {
        g.travel(best.id);
        step(4);
      }
      step(21);
      g.finishConcert(6);
      if (g.s.needs.rest < 30 || g.s.needs.food < 45) {
        g.travel('home');
        step(4);
      }
    }
  }
  const minutes = t / 60;
  ok(g.total === 12, 'a caring player completes the orchestra');
  ok(minutes > 8 && minutes < 50, `full orchestra takes a session, not seconds or days (simulated ${minutes.toFixed(1)} min)`);
  console.log(`  simulated time to Full Orchestra: ${minutes.toFixed(1)} minutes, ${g.s.concerts} concerts, ${g.fame} fame stars`);
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

// --- the world: places, friends, quests ---
{
  ok(PLACES.length === 6 && PLACES[0].id === 'home', 'six places, starting at home');
  ok(PLACES.every((p, i) => i === 0 || p.need >= PLACES[i - 1].need), 'isles open in order');
  ok(PLACES.filter((p) => p.npc).every((p) => NPCS[p.npc] && NPCS[p.npc].place === p.id), 'every isle has its resident');
  ok(Object.keys(NPCS).every((id) => QUESTS[id].length === 3 && NPCS[id].intro.length >= 3 && NPCS[id].idle.length >= 2), 'every friend has an introduction, small talk and three quests');
  const legendIds = LEGENDS.map((l) => l.id);
  const rewards = Object.values(QUESTS).flat().map((q) => q.reward);
  ok(rewards.every((r) => (!r.legend || legendIds.includes(r.legend)) && (!r.souvenir || SOUVENIRS[r.souvenir]) && (!r.cosmetic || COSMETICS.some((c) => c.id === r.cosmetic))), 'quest rewards all exist');
  ok(legendIds.filter((id) => id !== 'howl').every((id) => rewards.some((r) => r.legend === id)), 'every legend can be earned');
  ok(Object.keys(SOUVENIRS).every((id) => rewards.some((r) => r.souvenir === id)), 'every keepsake can be earned');
  // the last isle must be reachable from the fame available before it
  const before = PLACES.filter((p) => p.id !== 'home' && p.id !== 'shell').length * FAME_STEPS.length;
  ok(PLACES.every((p) => p.need <= before), 'no isle asks for more fame than exists');

  const g = fresh('str', () => 0.99); // polite applause every time
  ok(g.placeOpen('home') && g.placeOpen('drum') && !g.placeOpen('string') && !g.placeOpen('shell'), 'only the first isle is open at the start');
  ok(!g.travel('string') && g.s.place === 'home', 'the ferry will not sail to a locked isle');
  const t = g.travel('drum');
  ok(t && t.first && g.s.place === 'drum' && g.s.visited.includes('drum'), 'sailing somewhere new is remembered');
  ok(!g.travel('drum'), 'you cannot sail to where you already are');

  // meeting Boomer: introduction + first quest
  const hello = g.talk('boomer');
  ok(hello.lines.length === 4 && !hello.reward && g.s.met.includes('boomer'), 'a first meeting is an introduction and a request');
  let qs = g.questState('boomer');
  ok(qs.have === 0 && qs.need === 2 && !qs.done, 'the quest starts from zero');
  ok(g.talk('boomer').lines.some((l) => l.includes('0 of 2')), 'small talk reminds you how far along you are');

  // concerts on tour pay more, build fame, and count for the quest
  g.s.needs = { food: 100, fun: 100, clean: 100, rest: 100 };
  const home = fresh('str', () => 0.99);
  home.s.needs = { food: 100, fun: 100, clean: 100, rest: 100 };
  const a = g.finishConcert(0);
  const b = home.finishConcert(0);
  ok(a.earned > b.earned && a.place === 'drum' && b.newStars === 0, 'crowds on the isles pay more than the porch, and the porch earns no fame');
  ok(g.fameStars('drum') === 0, 'one polite concert is not a star yet');
  g.s.needs.rest = 100;
  const second = g.finishConcert(0);
  ok(second.newStars === 1 && g.fameStars('drum') === 1 && g.fame === 1 && g.s.gems === 5, 'applause adds up to a fame star, and a star pays gems');
  qs = g.questState('boomer');
  ok(qs.done, 'two concerts finish the first quest');
  const handIn = g.talk('boomer');
  ok(handIn.reward && handIn.reward.notes > 0 && handIn.reward.legend === 'echoes' && g.s.legends.includes('echoes'), 'handing in a quest pays out and teaches a legend');
  ok(g.questState('boomer').index === 1 && !g.questState('boomer').done, 'the next quest follows (a strings pup has no percussion yet)');
  g.s.notes = 999;
  g.buy('perc1');
  ok(g.questState('boomer').done, 'growing the part completes it');
  const keep = g.talk('boomer');
  ok(keep.reward.souvenir === 'bongo' && g.s.souvenirs.includes('bongo'), 'a keepsake comes home with you');
  // fame opens the next isle
  for (let i = 0; i < 12; i++) {
    g.s.needs = { food: 100, fun: 100, clean: 100, rest: 100 };
    g.finishConcert(0);
  }
  ok(g.fameStars('drum') === 3 && g.placeOpen('string') && !g.placeOpen('reed'), 'three stars on one isle open the next');
  ok(g.talk('boomer').reward.gems === 20 && g.questState('boomer') === null, 'the third quest is the last');
  ok(!g.talk('boomer').reward, 'after that, friends just chat');
  const sb = g.songbook;
  ok(sb.total === 17 && sb.have === 2 + 1 + 2, 'the Songbook counts places, friends and legends');
  const percPup = fresh('perc');
  percPup.travel('drum');
  percPup.talk('boomer');
  percPup.s.q.boomer.i = 1;
  ok(percPup.questState('boomer').done, 'a pup that already has the part passes that quest at once');
}

// --- daily to-dos ---
{
  const g = fresh();
  const list = g.ensureTasks(Date.UTC(2026, 0, 10, 12));
  ok(list.length === 3 && new Set(list.map((t) => TASKS[t.k].type)).size === 3, 'three different to-dos a day');
  ok(g.ensureTasks(Date.UTC(2026, 0, 10, 20)) === list, 'they stay put through the day');
  const g2 = fresh();
  const days = new Set();
  for (let d = 0; d < 8; d++) days.add(g2.ensureTasks(Date.UTC(2026, 0, 10 + d, 12)).map((t) => t.k).join());
  ok(days.size >= 4, 'the trio changes from day to day');
  const g3 = fresh();
  const tasks = g3.ensureTasks();
  for (const t of tasks) g3.bump(TASKS[t.k].type, TASKS[t.k].n);
  ok(tasks.every((t) => t.done) && g3.s.gems === 3 * 3 + 5, 'finishing to-dos pays gems, with a bonus for all three');
  ok(g3.news.length === 4 && g3.news[3].type === 'tasks', 'and each one is announced');
  g3.bump(TASKS[tasks[0].k].type, 5);
  ok(g3.s.gems === 14, 'a finished to-do does not pay twice');
}

// --- gems and the pretend store ---
{
  const g = fresh();
  ok(GEM_PACKS.every((p) => p.price > 0 && p.gems > 0) && BOOSTS.every((b) => b.cost > 0), 'the catalogue is priced');
  ok(!g.buyBoost('hamper') && !g.buyCosmetic('bowtie'), 'no gems, no boosts or outfits');
  const pack = g.buyPack('gems500', 5000);
  ok(pack && g.s.gems === 500, 'a pretend purchase grants its gems');
  ok(g.ledger.count === 1 && Math.abs(g.ledger.total - 4.99) < 1e-9 && g.ledger.items[0].sku === 'gems500', 'and is written to the test log');
  ok(g.buyPack('welcome') && g.s.wardrobe.includes('partyhat') && g.s.notes === 300, 'the welcome bundle brings notes and a hat');
  ok(g.buyPack('welcome') === null && g.ledger.count === 2, 'but only once');
  ok(g.buyPack('nonsense') === null, 'unknown items are refused');
  g.s.needs = { food: 5, fun: 5, clean: 5, rest: 5 };
  ok(g.buyBoost('hamper') && NEEDS.every((n) => g.s.needs[n] === 100) && g.s.gems === 700 - 25, 'the Snack Hamper fills every need');
  const rate = g.tipRate();
  ok(g.buyBoost('magnet') && Math.abs(g.tipRate() - rate * 2) < 1e-9, 'the Tip Magnet doubles tips');
  g.tick(601);
  ok(g.s.magnet === 0, 'for ten minutes');
  const cap = g.tipCap();
  ok(g.buyBoost('jumbo') && g.tipCap() === cap * 2 && !g.buyBoost('jumbo'), 'the Jumbo Jar doubles the jar, once');
  const polite = new Game(null, () => 0.99);
  polite.adopt('T', 'biscuit', 'perc');
  polite.s.gems = 100;
  polite.s.needs = { food: 100, fun: 100, clean: 100, rest: 100 };
  polite.buyBoost('ticket');
  const r = polite.finishConcert(0);
  ok(r.ticket && r.tier === 'ovation' && polite.s.tickets === 0, 'an Encore Ticket lifts a polite crowd to its feet, then is used up');
  ok(g.buyCosmetic('bowtie') && g.s.wearing.neck === 'bowtie' && !g.buyCosmetic('bowtie'), 'outfits are bought once and worn');
  ok(g.wear('bowtie') && g.s.wearing.neck === null && g.wear('bowtie') && g.s.wearing.neck === 'bowtie', 'and can be taken off and put back on');
  ok(!g.buyCosmetic('crown') && !g.wear('crown'), 'the crown cannot be bought, only earned');
  ok(g.wear('partyhat') && g.buyCosmetic('tophat') && g.s.wearing.head === 'tophat', 'one hat at a time');
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  const a = new Game(storage);
  a.adopt('T', 'biscuit', 'perc');
  a.buyPack('gems80');
  a.reset();
  ok(!a.s.adopted && a.s.gems === 0 && a.ledger.count === 1, 'starting over wipes the pup but keeps the test log');
  a.clearLedger();
  ok(a.ledger.count === 0, 'the test log can be cleared');
  // the seventh daily gift carries gems
  const d = fresh();
  const t0 = Date.UTC(2026, 0, 10, 12);
  let last;
  for (let i = 0; i < 7; i++) last = d.claimDaily(t0 + i * DAY);
  ok(last.day === 7 && last.gems === 20 && d.s.gems === 20, 'a full week of gifts ends with gems');
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
