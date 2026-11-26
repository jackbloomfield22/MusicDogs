// MusicDogs — boot, input and the moment-to-moment game: caring for the pup,
// concerts, and growing new instrument parts.

import * as THREE from 'three';
import { World, SPOTS, FLOOR_R } from './world.js';
import { Dog } from './dog/dog.js';
import { G, part } from './dog/build.js';
import { Orchestra } from './audio/orchestra.js';
import { Game, UPGRADES, FAMILIES, upgradeById } from './game.js';
import { UI } from './ui.js';
import { PLACES, placeById, NPCS, SOUVENIRS, LEGENDS, cosmeticById } from './lore.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const game = new Game();
game.load();
const world = new World(canvas);
const dog = new Dog();
const npc = new Dog(); // whoever lives on the isle you are visiting
npc.root.visible = false;
world.scene.add(npc.root);
world.scene.add(dog.root);
const audio = new Orchestra();

const app = {
  screen: 'title',
  mode: 'free', // free | eat | play | wash | sleep | concert
  t: 0,
  idleT: 3,
  careFrom: 0,
  eatT: 0,
  crunchT: 0,
  fetch: 'idle', // idle | chase | return
  foam: [],
  foamTotal: 0,
  zzzT: 0,
  bonus: 0,
  petDist: 0,
  spin: true, // slow camera turn on the title screen
  uiT: 0,
  saveT: 0,
  pointerLook: null,
  lookT: 0,
  lastPulse: {}, // when each instrument last sounded (for concert bonus taps)
  npcId: null,
  gold: null, // the golden note drifting across the stage, if any
  goldT: 22, // seconds until the next one
  wasHarmony: false,
  harmonyToastT: 0,
  sparkleT: 0,
};
// Angle between the pup's nose and the camera that shows each part best.
const BEST_VIEW = { perc1: 0.95, perc2: 0.45, perc3: 1.5, str1: 2.4, str2: 2.15, str3: 1.6, wood1: 0.6, wood2: 2.2, wood3: 1.35, brass1: 0.8, brass2: -1.1, brass3: -1.0 };
const FAMILY_OF = (tag) => tag.replace(/\d/, '');
const colorOf = (tag) => (FAMILIES[FAMILY_OF(tag)] || { color: '#ffffff' }).color;
const tmp = new THREE.Vector3();

// ------------------------------------------------------------------ helpers

function note(amount, at) {
  if (amount <= 0) return;
  ui.bumpNotes();
  audio.ui('coin');
  const p = at || dog.anchor('head', tmp).add(new THREE.Vector3(0, 0.5, 0));
  world.burst('note', p, Math.min(8, 2 + Math.floor(amount / 4)), { color: '#FFD23F', size: 0.3, up: 1.8, speed: 0.8, life: 1.2 });
}

/** Pay out a care reward; now and then it comes up double. */
function careNote(amount) {
  const r = game.lucky(amount);
  note(r.amount);
  if (r.lucky) {
    world.burst('star', dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0)), 8, { color: '#FFE45C', size: 0.24, up: 1.8, speed: 1.2, life: 1.1, spin: 4 });
    ui.toast(`Lucky! Double notes: ${r.amount}`);
  }
}

// ---------------------------------------------------------------- tips engine

function collectTips() {
  if (app.screen !== 'hud') return;
  const got = game.collectJar();
  if (!got) {
    audio.ui('no');
    ui.toast('The tip jar is empty. It fills while your pup plays.');
    return;
  }
  audio.ui('coins');
  ui.bumpNotes();
  const p = world.jar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0));
  world.burst('note', p, Math.min(14, 4 + Math.floor(got / 8)), { color: '#FFD23F', size: 0.3, up: 2.4, speed: 1.1, gravity: 2, life: 1.3 });
  world.jarPop = 1;
  dog.happy = Math.max(dog.happy, 0.8);
  if (got >= 30) ui.toast(`${got} notes from the tip jar`);
  game.save();
  updateGoal();
}

function openGift() {
  if (app.screen !== 'hud' || !game.dailyReady()) return;
  const g = game.claimDaily();
  if (!g) return;
  world.gift.visible = false;
  audio.ui('unwrap');
  if (g.tier !== 'nice') setTimeout(() => audio.fanfare(g.tier === 'jackpot'), 350);
  const p = world.gift.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0));
  world.burst('star', p, 18, { colors: ['#FFD23F', '#FF7DB8', '#5CE1FF', '#FFFFFF'], size: 0.28, up: 2.6, speed: 1.8, gravity: 2.5, life: 1.5, spin: 4 });
  world.burst('note', p, 8, { color: '#FFD23F', size: 0.3, up: 2.2, speed: 0.9, life: 1.3 });
  dog.happy = 2;
  dog.jump(2.8);
  audio.bark(1.5, 0.3);
  ui.bumpNotes();
  ui.showGift(g);
  updateGoal();
}

function spawnGolden() {
  app.gold = { t: 0, dur: 12, dir: Math.random() < 0.5 ? 1 : -1, y: rand(1.7, 2.3) };
  world.golden.visible = true;
  audio.ui('shimmer');
}

function catchGolden() {
  const p = world.golden.position.clone();
  app.gold = null;
  world.golden.visible = false;
  app.goldT = rand(55, 115);
  const prize = game.goldenPrize();
  audio.ui('coins');
  world.burst('star', p, 14, { colors: ['#FFD23F', '#FFFFFF', '#FFE9A0'], size: 0.26, up: 1.6, speed: 2, life: 1.2, spin: 5 });
  if (prize.kind === 'frenzy') {
    audio.fanfare(false);
    ui.toast('Tip frenzy! Triple tips for 30 seconds');
  } else {
    ui.bumpNotes();
    world.burst('note', p, 6, { color: '#FFD23F', size: 0.3, up: 1.6, speed: 0.9, life: 1.2 });
    if (prize.kind === 'jackpot') {
      audio.fanfare(true);
      ui.toast(`Jackpot! A golden note worth ${prize.amount}`);
    } else if (prize.kind === 'big') {
      audio.fanfare(false);
      ui.toast(`A big one! ${prize.amount} notes`);
    } else ui.toast(`Golden note: ${prize.amount} notes`);
  }
  dog.happy = 1.5;
  dog.jump(2.4);
  game.save();
  updateGoal();
}

function updateTips(dt) {
  world.setJar(game.jarFill);
  // golden notes drift by now and then (never during naps, baths or concerts)
  if (app.gold) {
    const g = app.gold;
    g.t += dt;
    const k = g.t / g.dur;
    const cam = world.camera;
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
    const span = Math.min(3.2, 1.3 + world.aspect * 1.6);
    world.golden.position.set(dog.pos.x, g.y + Math.sin(g.t * 2.2) * 0.22, dog.pos.z).addScaledVector(right, (k * 2 - 1) * span * g.dir);
    if (Math.random() < dt * 9) world.emit('star', world.golden.position, { color: '#FFE9A0', size: 0.13, vel: [rand(-0.2, 0.2), rand(-0.5, -0.1), rand(-0.2, 0.2)], life: 0.7, spin: 3 });
    if (k >= 1 || app.mode === 'sleep' || app.mode === 'concert') {
      app.gold = null;
      world.golden.visible = false;
      app.goldT = rand(45, 100);
    }
  } else if (app.mode === 'free' || app.mode === 'play') {
    app.goldT -= dt;
    if (app.goldT <= 0 && !ui.anyModal()) spawnGolden();
  }
  // a glint above the jar once it is worth emptying, sparkles around a pup in harmony
  app.sparkleT -= dt;
  if (app.sparkleT <= 0) {
    app.sparkleT = 0.7;
    if (game.jarFill > 0.5) world.emit('star', world.jar.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(rand(-0.15, 0.15), 0.55, rand(-0.15, 0.15))), { color: '#FFE45C', size: 0.16, vel: [0, 0.7, 0], life: 0.9, spin: 3 });
    if (game.harmony && !dog.asleep) world.emit('star', dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(rand(-0.6, 0.6), rand(-0.2, 0.6), rand(-0.6, 0.6))), { color: '#FFFFFF', size: 0.14, vel: [0, 0.5, 0], life: 0.9, spin: 3 });
  }
  app.harmonyToastT -= dt;
  const h = game.harmony;
  if (h && !app.wasHarmony && app.harmonyToastT <= 0 && app.mode !== 'sleep') {
    app.harmonyToastT = 90;
    audio.ui('shimmer');
    ui.toast(`${game.s.name} is in harmony. Tips are doubled!`);
  }
  app.wasHarmony = h;
  // Virtuoso stars circle the pup's head
  const n = Math.min(world.halo.length, game.s.stars);
  const head = n ? dog.anchor('head', tmp) : null;
  world.halo.forEach((sp, i) => {
    sp.visible = i < n && app.screen === 'hud';
    if (!sp.visible) return;
    const a = app.t * 1.3 + (i / n) * Math.PI * 2;
    sp.position.set(head.x + Math.cos(a) * 0.62, head.y + 0.52 + Math.sin(a * 2) * 0.05, head.z + Math.sin(a) * 0.62);
  });
}

function buyStar() {
  if (!game.buyStar()) return audio.ui('no');
  audio.fanfare(true);
  dog.happy = 2;
  dog.jump(3);
  world.burst('star', dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.5, 0)), 20, { colors: ['#FFD23F', '#FFFFFF'], size: 0.28, up: 2.2, speed: 1.8, life: 1.4, spin: 5 });
  ui.toast(`Virtuoso star ${game.s.stars}! Every note is now worth ${Math.round((game.boost - 1) * 100)}% more`);
  ui.refresh();
  return undefined;
}

function hearts(n = 3, at) {
  const p = at ? at.clone() : dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.45, 0));
  world.burst('heart', p, n, { size: 0.28, up: 1.2, speed: 0.5, life: 1.1 });
}

function partAnchor(tag) {
  const g = (dog.partGroups[tag] || [])[0];
  if (g) return g.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, tag.startsWith('wood') && tag !== 'wood3' ? 0.1 : 0.35, 0));
  return dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0));
}

function setMode(mode, hint = '') {
  app.mode = mode;
  ui.setMode(mode, hint);
}

function applySettings() {
  const s = game.s.settings;
  audio.setVolumes(s.music, s.sfx);
  if (world.lowPower !== !!s.low) world.setQuality(!!s.low);
}

function goCenter(then) {
  dog.goTo(SPOTS.center[0], SPOTS.center[1], 1.7, () => {
    dog.faceYaw = world.cam.az;
    if (then) then();
  });
}

// --------------------------------------------------------------------- care

function startFeed() {
  const s = game.s;
  if (s.needs.food > 92) {
    audio.ui('no');
    ui.toast(`${s.name} is stuffed. Maybe later!`);
    return;
  }
  setMode('eat');
  world.kibble.visible = true;
  audio.crunch();
  app.careFrom = s.needs.food;
  app.eatT = -1;
  dog.goTo(SPOTS.bowl[0], SPOTS.bowl[1], 2, () => {
    dog.yaw = Math.atan2(world.bowl.position.x - dog.pos.x, world.bowl.position.z - dog.pos.z);
    dog.pose = 'eat';
    app.eatT = 3.2;
  });
}

function updateEat(dt) {
  if (app.eatT < 0) return;
  const s = game.s;
  app.eatT -= dt;
  s.needs.food = Math.min(100, s.needs.food + (42 / 3.2) * dt);
  app.crunchT -= dt;
  if (app.crunchT <= 0) {
    app.crunchT = 0.3;
    audio.crunch();
    world.kibble.scale.setScalar(Math.max(0.2, app.eatT / 3.2));
  }
  if (app.eatT <= 0) {
    app.eatT = -1;
    world.kibble.visible = false;
    world.kibble.scale.setScalar(1);
    dog.pose = 'stand';
    dog.happy = 1.4;
    dog.jump(2.2);
    hearts(3);
    audio.bark(1.4, 0.35);
    careNote(game.earn((s.needs.food - app.careFrom) * 0.3));
    game.bump('care');
    questDone(2);
    setMode('free');
    goCenter();
  }
}

function togglePlay() {
  if (app.mode === 'play') return endPlay();
  if (game.s.needs.rest < 8) {
    audio.ui('no');
    ui.toast(`${game.s.name} is too sleepy to play. Nap first!`);
    return;
  }
  setMode('play', 'Tap the floor to throw the ball');
  app.fetch = 'idle';
  goCenter();
  world.ballFree = false;
  world.ball.position.set(Math.sin(world.cam.az) * 1.3, 0.15, Math.cos(world.cam.az) * 1.3 + 0.2);
  dog.happy = 0.8;
  audio.ui('squeak');
}

function endPlay() {
  dog.carry = null;
  world.ballFree = false;
  world.ball.position.copy(world.ballHome);
  app.fetch = 'idle';
  setMode('free');
  goCenter();
}

function throwBall(point) {
  if (app.fetch !== 'idle') return;
  dog.carry = null;
  world.ball.position.set(dog.pos.x + Math.sin(dog.yaw) * 0.5, 0.6, dog.pos.z + Math.cos(dog.yaw) * 0.5);
  world.throwBall(point.x, point.z);
  audio.ui('whoosh');
  app.fetch = 'chase';
  dog.happy = 0.5;
}

function updatePlay() {
  const b = world.ball.position;
  if (app.fetch === 'chase') {
    dog.goTo(b.x, b.z, 3.3);
    if (Math.hypot(b.x - dog.pos.x, b.z - dog.pos.z) < 0.55 && b.y < 0.5) {
      world.ballFree = false;
      dog.carry = world.ball;
      audio.ui('squeak');
      app.fetch = 'return';
      dog.goTo(SPOTS.center[0], SPOTS.center[1], 2.8, () => {
        dog.faceYaw = world.cam.az;
        dog.carry = null;
        world.ball.position.set(dog.pos.x + Math.sin(world.cam.az) * 0.75, 0.15, dog.pos.z + Math.cos(world.cam.az) * 0.75);
        app.fetch = 'idle';
        dog.happy = 1;
        dog.jump(2.4);
        audio.bark(1.5, 0.3);
        hearts(2);
        game.spend('rest', 3);
        careNote(game.care('fun', 17, 0.3));
        game.bump('care');
        questDone(2);
        if (game.s.needs.rest < 8) {
          ui.toast(`${game.s.name} is all played out.`);
          endPlay();
        }
      });
    }
  }
}

function toggleWash() {
  if (app.mode === 'wash') return endWash(false);
  if (game.s.needs.clean > 92) {
    audio.ui('no');
    ui.toast(`${game.s.name} is already squeaky clean.`);
    return;
  }
  setMode('wash', 'Scrub the bubbles off your pup');
  app.careFrom = game.s.needs.clean;
  app.foam = [];
  goCenter(() => {
    if (app.mode !== 'wash') return;
    dog.pose = 'sit';
    world.showTub(true);
    audio.splash();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25 });
    const spots = [
      [0, 1.02, 0.1], [0.3, 0.8, 0.1], [-0.3, 0.8, 0.05], [0, 1.0, -0.3], [0.25, 0.75, -0.3], [-0.26, 0.72, -0.32],
      [0, 0.72, 0.42], [0.18, 0.5, 0.3], [-0.2, 0.52, 0.28],
    ];
    const headSpots = [[0, 0.42, 0], [0.33, 0.2, 0.15], [-0.33, 0.2, 0.15], [0.2, 0.3, -0.25], [-0.2, 0.28, -0.25], [0, 0.12, -0.38]];
    const add = (parent, [x, y, z]) => {
      const m = part(parent, G.sphere(1, 12, 8), mat, { p: [x, y, z], s: rand(0.13, 0.19), cast: false, tag: 'foam' });
      part(m, G.sphere(1, 10, 8), mat, { p: [rand(-0.7, 0.7), rand(0.2, 0.7), rand(-0.7, 0.7)], s: 0.62, cast: false, tag: 'foam' }).userData.child = true;
      app.foam.push(m);
    };
    spots.forEach((p) => add(dog.body, p));
    headSpots.forEach((p) => add(dog.head, p));
    app.foamTotal = app.foam.length;
  });
}

function scrub(point) {
  if (!app.foam.length) return;
  let best = null, bestD = 0.5;
  for (const f of app.foam) {
    const d = f.getWorldPosition(tmp).distanceTo(point);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (!best) return;
  const p = best.getWorldPosition(new THREE.Vector3());
  best.parent.remove(best);
  app.foam.splice(app.foam.indexOf(best), 1);
  audio.ui('pop');
  world.burst('bubble', p, 4, { size: 0.2, up: 0.9, speed: 0.6, life: 0.8, grow: 0.5 });
  game.s.needs.clean = Math.min(100, app.careFrom + (100 - app.careFrom) * (1 - app.foam.length / app.foamTotal));
  if (!app.foam.length) endWash(true);
}

function endWash(finished) {
  for (const f of app.foam) f.parent.remove(f);
  app.foam = [];
  world.showTub(false);
  dog.pose = 'stand';
  if (finished) {
    dog.shake = 1.3;
    dog.happy = 1.6;
    audio.splash();
    world.burst('drop', dog.anchor('body', new THREE.Vector3()), 14, { size: 0.16, up: 2.2, speed: 2.2, gravity: 7, life: 0.8 });
    setTimeout(() => world.burst('star', dog.anchor('head', new THREE.Vector3()), 8, { colors: ['#FFFFFF', '#9BE4FF', '#FFE45C'], size: 0.22, up: 1.2, speed: 1.2, life: 1 }), 900);
    game.bump('care');
    questDone(2);
  }
  careNote(game.earn((game.s.needs.clean - app.careFrom) * 0.25));
  setMode('free');
}

function toggleSleep() {
  if (app.mode === 'sleep') return wake();
  if (game.s.needs.rest > 92) {
    audio.ui('no');
    ui.toast(`${game.s.name} is wide awake.`);
    return;
  }
  setMode('sleep', 'Shh… sleeping. Tap Wake when ready');
  app.careFrom = game.s.needs.rest;
  dog.goTo(SPOTS.bed[0], SPOTS.bed[1], 1.6, () => {
    if (app.mode !== 'sleep') return;
    dog.pose = 'lie';
    dog.asleep = true;
    dog.lieLift = 0.16;
    dog.faceYaw = world.cam.az + 0.5;
    world.nightTarget = 1;
    audio.setMode('off');
  });
}

function wake() {
  dog.asleep = false;
  dog.pose = 'stand';
  world.nightTarget = 0;
  audio.setMode('idle');
  dog.happy = 0.8;
  careNote(game.earn((game.s.needs.rest - app.careFrom) * 0.15));
  if (game.s.needs.rest - app.careFrom > 10) questDone(2);
  setMode('free');
  goCenter();
}

// ------------------------------------------------------------------ concert

function startConcert() {
  const why = game.canConcert();
  if (why) {
    audio.ui('no');
    const away = game.s.place !== 'home' ? ' Sail home first.' : '';
    ui.toast(why === 'rest' ? `${game.s.name} is too tired to perform. Time for a nap.${away}` : `${game.s.name} can't play on an empty tummy.${away}`);
    return;
  }
  setMode('concert', 'Tap the parts as they light up for bonus notes');
  app.bonus = 0;
  goCenter(() => {
    if (app.mode !== 'concert') return;
    // on tour, the local plays along: you hear their whole section
    const who = app.npcId && NPCS[app.npcId];
    if (who) {
      const L = game.s.levels;
      audio.setLevels({ perc: Math.max(L.perc, who.levels.perc), str: Math.max(L.str, who.levels.str), wood: Math.max(L.wood, who.levels.wood), brass: Math.max(L.brass, who.levels.brass) });
      npc.faceYaw = world.cam.az;
    }
    audio.concert(game.s.concerts % 2, endConcert);
    world.cam.zoomTarget = who ? 1.0 : 0.9;
  });
}

function endConcert() {
  if (app.mode !== 'concert') return;
  audio.setMode('idle');
  audio.setLevels(game.s.levels);
  audio.applause();
  const openBefore = PLACES.filter((p) => game.placeOpen(p.id)).map((p) => p.id);
  const result = game.finishConcert(app.bonus);
  const { earned, tier } = result;
  if (npc.root.visible) {
    npc.happy = 2;
    npc.jump(2.6);
  }
  dog.happy = 2;
  dog.jump(3);
  const big = tier === 'ovation' || tier === 'encore';
  world.burst('star', dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0, 0.4, 0)), big ? 30 : 16, { colors: ['#FFD23F', '#FF7DB8', '#5CE1FF', '#7CE38B'], size: 0.26, up: 2.4, speed: big ? 2.6 : 1.8, gravity: 2.5, life: 1.5, spin: 3 });
  if (big) {
    audio.applause(tier === 'encore' ? 4.5 : 3.6);
    setTimeout(() => audio.fanfare(tier === 'encore'), 300);
    setTimeout(() => dog.jump(2.6), 700);
  }
  note(earned);
  ui.toast({
    applause: `Bravo! The crowd threw ${earned} notes`,
    cheers: `The crowd cheered! ${earned} notes`,
    ovation: `Standing ovation! Double tips: ${earned} notes`,
    encore: `Encore! Encore! Triple tips: ${earned} notes`,
  }[tier]);
  const here = placeById(result.place);
  if (result.newStars) {
    audio.ui('shimmer');
    ui.toast(`New fame star at ${here.name}! ${'★'.repeat(result.stars)} +${result.gems} gems`);
  }
  for (const p of PLACES) {
    if (!openBefore.includes(p.id) && game.placeOpen(p.id)) ui.toast(`The cloud-ferry now sails to ${p.name}. Open the Map!`);
  }
  world.cam.zoomTarget = 0.8;
  questDone(3);
  setMode('free');
}

// ----------------------------------------------------------------- upgrades

function buy(id) {
  if (!game.buy(id)) {
    audio.ui('no');
    return;
  }
  const u = upgradeById(id);
  ui.closeModals();
  dog.build(game.s.levels, game.s.coat);
  dog.popIn(id);
  audio.setLevels(game.s.levels);
  audio.fanfare(game.total >= 12);
  setTimeout(() => {
    audio.playPart(id);
    dog.pulse(id);
  }, 700);
  dog.happy = 2;
  dog.jump(2.6);
  // the pup turns to show off its new part
  dog.stop();
  dog.pose = 'stand';
  dog.faceYaw = world.cam.az - BEST_VIEW[id];
  app.idleT = 5;
  const p = partAnchor(id);
  world.burst('star', p, 18, { colors: [FAMILIES[u.family].color, '#FFFFFF', '#FFD23F'], size: 0.26, up: 1.8, speed: 1.6, life: 1.3, spin: 4 });
  ui.toast(game.total >= 12 ? `${game.s.name} is a Full Orchestra!` : `${game.s.name} grew ${u.name}. Now a ${game.rank}!`);
  questDone(4);
  ui.refresh();
  updateGoal();
}

// -------------------------------------------------------------------- goals

function questDone(step) {
  if (game.s.quest === step) {
    game.s.quest = step + 1;
    updateGoal();
  }
}

function updateGoal() {
  const s = game.s;
  const starter = UPGRADES.find((u) => u.tier === 1 && s.levels[u.family] >= 1);
  if (s.quest === 0) return ui.setGoal('Stroke your pup to say hello');
  if (s.quest === 1) return ui.setGoal(`Tap the <b>${starter ? starter.name : 'instrument'}</b> to hear it`);
  if (s.quest === 2) return ui.setGoal('Look after your pup: try <b>Feed</b>, <b>Play</b> or <b>Wash</b>');
  if (s.quest === 3) return ui.setGoal('Hold a <b>Concert</b> to earn notes');
  if (game.total >= 12) {
    const cost = game.starCost();
    if (s.notes >= cost) return ui.setGoal('You can add a <b>Virtuoso star</b>! Tap Grow', true, 1);
    return ui.setGoal(`Next: <b>Virtuoso star</b> · ${cost - s.notes} more notes`, false, s.notes / cost);
  }
  const ready = UPGRADES.find((u) => game.status(u.id) === 'ready');
  if (ready) return ui.setGoal(`You can grow <b>${ready.name}</b>! Tap Grow`, true, 1);
  if (s.visited.length < 2) return ui.setGoal('Open the <b>Map</b> and sail somewhere new');
  const fresh = PLACES.find((p) => game.placeOpen(p.id) && !s.visited.includes(p.id));
  if (fresh) return ui.setGoal(`A new isle is open: sail to <b>${fresh.name}</b>`, true);
  const next = UPGRADES.find((u) => game.status(u.id) === 'poor');
  return ui.setGoal(`Next: <b>${next.name}</b> · ${game.nextCost() - s.notes} more notes`, false, s.notes / game.nextCost());
}

// -------------------------------------------------------------------- input

const pointers = new Map();
let gesture = null; // { id, kind: 'dog' | 'orbit', x, y, moved, hit, t }
let pinch = 0;

function ndc(e) {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1];
}

canvas.addEventListener('pointerdown', (e) => {
  if (app.screen !== 'hud') {
    app.spin = false;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture = { id: e.pointerId, kind: 'orbit', x: e.clientX, y: e.clientY, moved: 0, t: performance.now() };
    return;
  }
  e.preventDefault();
  if (app.gold) {
    const sp = world.toScreen(world.golden.position);
    if (!sp.behind && Math.hypot(sp.x - e.clientX, sp.y - e.clientY) < 58) return catchGolden();
  }
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = Math.hypot(a.x - b.x, a.y - b.y);
    gesture = null;
    return;
  }
  const hit = world.pick(...ndc(e), dog.root, npc.root);
  gesture = { id: e.pointerId, kind: hit && hit.onDog ? 'dog' : 'orbit', x: e.clientX, y: e.clientY, moved: 0, hit, t: performance.now() };
  if (hit && hit.onDog && app.mode === 'wash') scrub(hit.point);
});

window.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId);
  if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.x = e.clientX;
  p.y = e.clientY;
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    world.cam.zoomTarget = null;
    if (pinch > 0) world.cam.zoom = clamp(world.cam.zoom * (pinch / d), 0.5, 1.5);
    pinch = d;
    return;
  }
  if (!gesture || gesture.id !== e.pointerId) return;
  gesture.moved += Math.hypot(dx, dy);
  if (gesture.kind === 'orbit') {
    world.cam.az -= dx * 0.007;
    world.cam.el = clamp(world.cam.el + dy * 0.005, 0.1, 1.0);
    return;
  }
  // stroking the dog
  if (app.screen !== 'hud' || dog.asleep || app.mode === 'concert' || app.mode === 'eat') return;
  const hit = world.pick(...ndc(e), dog.root, npc.root);
  if (!hit || !hit.onDog) return;
  app.pointerLook = hit.point.clone();
  app.lookT = 0.6;
  if (app.mode === 'wash') return scrub(hit.point);
  app.petDist += Math.hypot(dx, dy);
  if (app.petDist > 70) {
    app.petDist = 0;
    const got = game.pet();
    dog.happy = 1;
    audio.ui('heart');
    hearts(1, hit.point.clone().add(new THREE.Vector3(0, 0.15, 0)));
    if (got) note(got, hit.point.clone().add(new THREE.Vector3(0, 0.3, 0)));
    if (game.s.pets >= 3) questDone(0);
  }
});

function pointerEnd(e) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  pinch = 0;
  const g = gesture;
  if (!g || g.id !== e.pointerId) return;
  gesture = null;
  if (app.screen !== 'hud') return;
  const tap = g.moved < 10 && performance.now() - g.t < 400;
  if (!tap || !g.hit) return;
  const { tag, point } = g.hit;
  if (tag === 'floor') {
    if (app.mode === 'play') throwBall(point);
    return;
  }
  if (tag === 'jar') return collectTips();
  if (tag === 'gift') return openGift();
  if (tag === 'npc') return app.mode === 'free' ? talk() : undefined;
  if (dog.asleep || app.mode === 'eat') return;
  if (tag === 'foam') return scrub(point);
  if (tag === 'pet') {
    dog.happy = 0.7;
    dog.tilt = Math.random() < 0.5 ? 0.28 : -0.28;
    audio.bark(rand(1.35, 1.7), 0.3);
    hearts(1, point.clone().add(new THREE.Vector3(0, 0.2, 0)));
    return;
  }
  // an instrument part
  if (app.mode === 'concert') {
    if (app.t - (app.lastPulse[tag] || -9) < 0.45 && app.bonus < 20) {
      app.bonus++;
      world.emit('star', point.clone().add(new THREE.Vector3(0, 0.2, 0)), { color: '#FFE45C', size: 0.32, vel: [0, 1.6, 0], life: 0.8, spin: 5 });
      audio.ui('pop');
    }
    return;
  }
  audio.playPart(tag);
  dog.pulse(tag, 1.2);
  dog.happy = 0.6;
  world.burst('note', point.clone().add(new THREE.Vector3(0, 0.2, 0)), 3, { color: colorOf(tag), size: 0.26, up: 1.4, speed: 0.5, life: 1 });
  questDone(1);
}
window.addEventListener('pointerup', pointerEnd);
window.addEventListener('pointercancel', pointerEnd);
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  world.cam.zoomTarget = null;
  world.cam.zoom = clamp(world.cam.zoom * (1 + Math.sign(e.deltaY) * 0.08), 0.5, 1.5);
}, { passive: false });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('gesturestart', (e) => e.preventDefault());

window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  if (e.code === 'Escape') ui.closeModals();
  if (app.screen === 'title' && (e.code === 'Enter' || e.code === 'Space') && !(e.target && e.target.tagName === 'BUTTON')) $('btn-start').click();
  if (app.screen !== 'hud' || ui.anyModal()) return;
  if (ui.talking) {
    if (e.code === 'Enter' || e.code === 'Space') $('talk-next').click();
    return;
  }
  if (e.code === 'KeyM' && app.mode === 'free') ui.openMap();
  if (e.code === 'KeyJ') ui.openJournal();
  const map = { Digit1: 'feed', Digit2: 'play', Digit3: 'wash', Digit4: 'sleep', Digit5: 'concert', Digit6: 'grow' };
  if (map[e.code]) action(map[e.code]);
  if (e.code === 'ArrowLeft') world.cam.az -= 0.2;
  if (e.code === 'ArrowRight') world.cam.az += 0.2;
});

// ----------------------------------------------------------------------- UI

// -------------------------------------------------------------------- world

function rebuildDog() {
  dog.build(game.s.levels, game.s.coat, game.s.wearing);
}

/** Dress the stage for wherever the pup is, and bring out whoever lives there. */
function applyPlace() {
  const place = placeById(game.s.place);
  world.setPlace(place);
  world.setSouvenirs(game.s.souvenirs);
  const who = place.npc ? NPCS[place.npc] : null;
  if (who && app.npcId !== place.npc) npc.build(who.levels, who.coat, {});
  app.npcId = place.npc || null;
  npc.root.visible = !!who;
  if (who) {
    // stand beside the pup as seen from the camera, wherever it is looking from
    const az = world.cam.az;
    const wide = canvas.clientWidth > canvas.clientHeight * 0.9;
    const lat = wide ? -1.55 : -0.92, depth = wide ? -0.15 : -0.6;
    npc.pos.set(SPOTS.center[0] + Math.cos(az) * lat + Math.sin(az) * depth, 0, SPOTS.center[1] - Math.sin(az) * lat + Math.cos(az) * depth);
    npc.yaw = az + 0.3;
    app.npcYaw = npc.yaw;
    npc.pose = 'stand';
  }
  dog.stop();
  dog.carry = null;
  dog.pos.set(SPOTS.center[0], 0, SPOTS.center[1]);
  dog.yaw = world.cam.az;
  app.gold = null;
  world.golden.visible = false;
}

function travel(id) {
  if (app.screen !== 'hud') return;
  if (app.mode !== 'free' || ui.talking) {
    audio.ui('no');
    ui.toast('Finish what you are doing first.');
    return;
  }
  const place = placeById(id);
  if (!game.placeOpen(id) || id === game.s.place) return;
  ui.closeModals();
  audio.ui('whoosh');
  ui.fade(place.name, () => {
    const r = game.travel(id);
    applyPlace();
    ui.refresh();
    updateGoal();
    setTimeout(() => {
      audio.ui('shimmer');
      dog.happy = 1.5;
      dog.jump(2.4);
      if (r && r.first) {
        ui.toast(`New page in your Songbook: ${place.name}`);
        if (place.npc) ui.toast('Someone here would like to meet you. Tap Talk.');
      }
      if (npc.root.visible) {
        npc.jump(2.2);
        audio.bark(NPCS[place.npc].pitch, 0.3);
      }
    }, 900);
  });
}

function talk() {
  if (!app.npcId || ui.talking || app.mode !== 'free') return;
  dog.stop();
  dog.pose = 'sit';
  dog.face(npc.pos.x, npc.pos.z);
  npc.face(dog.pos.x, dog.pos.z);
  const res = game.talk(app.npcId);
  world.cam.zoomTarget = 0.96;
  ui.showTalk(res, () => {
    dog.pose = 'stand';
    dog.faceYaw = world.cam.az;
    npc.faceYaw = app.npcYaw;
    world.cam.zoomTarget = 0.8;
    const r = res.reward;
    if (r) {
      audio.fanfare(false);
      dog.happy = 2;
      dog.jump(2.6);
      if (r.notes) note(r.notes);
      if (r.gems) ui.toast(`${res.name} gave you ${r.notes} notes and ${r.gems} gems`);
      if (r.souvenir) {
        world.setSouvenirs(game.s.souvenirs);
        ui.toast(`A keepsake for your porch: ${SOUVENIRS[r.souvenir].name}`);
      }
      if (r.legend) ui.toast(`New legend in your Songbook: ${LEGENDS.find((l) => l.id === r.legend).title}`);
      if (r.cosmetic) {
        if (game.s.wearing[cosmeticById(r.cosmetic).slot] !== r.cosmetic) game.wear(r.cosmetic);
        rebuildDog();
        dog.popIn(`fit-${r.cosmetic}`);
        ui.toast(`${res.name} gave you the ${cosmeticById(r.cosmetic).name}`);
      }
    }
    ui.refresh();
    updateGoal();
  });
  ui.refresh();
}

// ------------------------------------------------------------ pretend store

function confirmPack(sku) {
  const pack = game.buyPack(sku);
  if (!pack) return audio.ui('no');
  audio.ui('coins');
  setTimeout(() => audio.fanfare(false), 250);
  if (pack.cosmetic) {
    if (game.s.wearing[cosmeticById(pack.cosmetic).slot] !== pack.cosmetic) game.wear(pack.cosmetic);
    rebuildDog();
    dog.popIn(`fit-${pack.cosmetic}`);
  }
  if (pack.notes) ui.bumpNotes();
  dog.happy = 2;
  dog.jump(2.6);
  ui.toast(`Pretend purchase: ${pack.name}. +${pack.gems} gems, nothing charged`);
  ui.refresh();
  ui.openShop();
  return undefined;
}

function buyBoost(id) {
  const r = game.buyBoost(id);
  if (!r) return audio.ui('no');
  audio.ui('shimmer');
  if (id === 'hamper') {
    hearts(5);
    dog.happy = 2;
    ui.toast(`${game.s.name} is fed, clean, rested and happy`);
  } else if (id === 'magnet') ui.toast('Tip Magnet on: double tips for 10 minutes');
  else if (id === 'ticket') ui.toast('Encore Ticket ready for your next concert');
  else if (id === 'sack') {
    note(r.detail);
    ui.toast(`A sack of ${r.detail} notes`);
  } else if (id === 'jumbo') ui.toast('Jumbo Jar: your tip jar now holds twice as much');
  ui.refresh();
  ui.openShop();
  return undefined;
}

function buyCosmetic(id) {
  if (!game.buyCosmetic(id)) return audio.ui('no');
  audio.fanfare(false);
  rebuildDog();
  dog.popIn(`fit-${id}`);
  dog.happy = 2;
  dog.jump(2.4);
  ui.toast(`${game.s.name} is wearing the ${cosmeticById(id).name}`);
  ui.refresh();
  ui.openShop();
  return undefined;
}

function wearItem(id) {
  if (!game.wear(id)) return;
  audio.ui('tap');
  rebuildDog();
  if (game.s.wearing[cosmeticById(id).slot] === id) dog.popIn(`fit-${id}`);
  ui.openShop();
}

function action(id) {
  if (app.screen !== 'hud' || ui.talking) return;
  const away = game.s.place !== 'home';
  if (id === 'talk') return away ? (audio.ui('tap'), talk()) : undefined;
  if (id === 'home') return away ? travel('home') : undefined;
  if (away && ['feed', 'play', 'wash', 'sleep'].includes(id)) return undefined;
  if (id === 'grow') {
    if (app.mode !== 'free') return;
    audio.ui('tap');
    return ui.openOrchestra();
  }
  if (id === 'sleep' && (app.mode === 'sleep' || app.mode === 'free')) return audio.ui('tap'), toggleSleep();
  if (id === 'play' && (app.mode === 'play' || app.mode === 'free')) return audio.ui('tap'), togglePlay();
  if (id === 'wash' && (app.mode === 'wash' || app.mode === 'free')) return audio.ui('tap'), toggleWash();
  if (app.mode !== 'free') return undefined;
  audio.ui('tap');
  if (id === 'feed') return startFeed();
  if (id === 'concert') return startConcert();
  return undefined;
}

function enterGame() {
  app.screen = 'hud';
  app.spin = false;
  rebuildDog();
  game.ensureTasks();
  applyPlace();
  audio.setLevels(game.s.levels);
  audio.setMode('idle');
  world.cam.zoomTarget = null;
  world.cam.zoom = 0.8;
  ui.show('hud');
  frameScene();
  setMode('free');
  updateGoal();
  if (game.awayTips >= 5) ui.toast(`While you were away, ${game.s.name} busked ${game.awayTips} notes. Tap the tip jar!`);
  else if (game.away > 900) ui.toast(`${game.s.name} missed you!`);
  game.awayTips = 0;
  dog.happy = 1.5;
  dog.jump(2.4);
  audio.bark(1.4, 0.35);
}

const ui = new UI(
  {
    sound: (k) => audio.ui(k),
    start: async () => {
      await audio.init();
      applySettings();
      audio.ui('tap');
      if (game.s.adopted) return enterGame();
      app.screen = 'adopt';
      ui.show('adopt');
      frameScene();
      preview(ui.adopt, true);
      return undefined;
    },
    preview: (choice, play) => preview(choice, play),
    adopt: (name, coat, family) => {
      game.adopt(name, coat, family);
      audio.fanfare(false);
      enterGame();
      hearts(5);
    },
    action,
    goal: () => {
      if (game.s.quest < 4 || app.mode !== 'free') return;
      const canGrow = UPGRADES.some((u) => game.status(u.id) === 'ready');
      const fresh = PLACES.some((p) => game.placeOpen(p.id) && !game.s.visited.includes(p.id));
      if (!canGrow && fresh) ui.openMap();
      else action('grow');
    },
    buy,
    tips: collectTips,
    gift: openGift,
    star: buyStar,
    travel,
    spoke: (res) => {
      audio.bark(NPCS[app.npcId] ? NPCS[app.npcId].pitch : 1.2, 0.3);
      npc.happy = 0.8;
      npc.tilt = Math.random() < 0.5 ? 0.2 : -0.2;
    },
    confirmPack,
    boost: buyBoost,
    cosmetic: buyCosmetic,
    wear: wearItem,
    hear: (id) => {
      audio.playPart(id);
      dog.pulse(id, 1.2);
    },
    settings: (key) => {
      applySettings();
      game.save();
      if (key === 'sfx') audio.ui('tap');
    },
    reset: () => {
      if (app.mode === 'sleep') wake();
      if (app.mode === 'wash') endWash(false);
      if (app.mode === 'play') endPlay();
      audio.setMode('off');
      app.gold = null;
      world.golden.visible = false;
      world.gift.visible = false;
      world.halo.forEach((sp) => (sp.visible = false));
      game.reset();
      applyPlace();
      dog.wearing = {};
      app.screen = 'adopt';
      setMode('free');
      ui.show('adopt');
      frameScene();
      preview(ui.adopt, false);
    },
  },
  game,
);

function preview(choice, play) {
  const levels = { perc: 0, str: 0, wood: 0, brass: 0 };
  levels[choice.family] = 1;
  dog.build(levels, choice.coat, {});
  dog.popIn(`${choice.family}1`);
  dog.pos.set(SPOTS.center[0], 0, SPOTS.center[1]);
  dog.yaw = world.cam.az;
  dog.pose = 'stand';
  dog.happy = 1;
  dog.jump(2);
  audio.setLevels(levels);
  audio.setMode('idle');
  if (play) audio.playPart(`${choice.family}1`);
}

// --------------------------------------------------------------------- loop

function idleBehaviour(dt) {
  if (app.mode !== 'free' || dog.target || gesture) return;
  app.idleT -= dt;
  if (app.idleT > 0) return;
  app.idleT = rand(4, 9);
  const mood = game.mood;
  const r = Math.random();
  if (mood < 0.3) {
    dog.pose = 'sit';
  } else if (r < 0.4) {
    const a = rand(0, Math.PI * 2), d = rand(0.3, 1.5);
    dog.goTo(SPOTS.center[0] + Math.cos(a) * d, SPOTS.center[1] + Math.sin(a) * d, 1.2, () => (dog.faceYaw = world.cam.az + rand(-0.4, 0.4)));
  } else if (r < 0.6) {
    dog.pose = 'sit';
    dog.faceYaw = world.cam.az;
  } else if (r < 0.8) {
    dog.pose = 'stand';
    dog.faceYaw = world.cam.az + rand(-0.3, 0.3);
  } else {
    dog.pose = 'stand';
    dog.jump(2);
    if (mood > 0.6) audio.bark(rand(1.3, 1.6), 0.22);
  }
}

/** Keep the pup clear of whatever panel is on screen. */
function frameScene() {
  const portrait = canvas.clientWidth < canvas.clientHeight * 0.9;
  if (app.screen === 'adopt') world.setShift(portrait ? 0 : 0.2, portrait ? 0.24 : 0);
  else if (app.screen === 'hud') world.setShift(0, portrait ? 0.03 : 0.04);
  else world.setShift(0, portrait ? -0.04 : -0.08);
  world.cam.zoom = app.screen === 'adopt' ? (portrait ? 0.95 : 0.8) : app.screen === 'title' ? 0.86 : world.cam.zoom;
}

function resize() {
  world.resize();
  frameScene();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  app.t += dt;

  if (app.screen === 'hud') {
    game.tick(dt, { asleep: dog.asleep });
    if (app.mode === 'eat') updateEat(dt);
    else if (app.mode === 'play') updatePlay();
    else if (app.mode === 'sleep' && dog.asleep) {
      app.zzzT -= dt;
      if (app.zzzT <= 0) {
        app.zzzT = 1.3;
        world.emit('zzz', dog.anchor('head', new THREE.Vector3()).add(new THREE.Vector3(0.2, 0.3, 0)), { size: 0.34, vel: [0.25, 0.5, 0], life: 2.2, grow: 0.8, color: '#DCE4FF' });
      }
      if (game.s.needs.rest >= 100) wake();
    }
    idleBehaviour(dt);
    updateTips(dt);
    ui.tickNotes(dt);
    app.uiT -= dt;
    while (game.news.length) {
      const n = game.news.shift();
      audio.ui('shimmer');
      ui.toast(n.type === 'task' ? `To-do done: ${n.label}. +${n.gems} gems` : `All of today's to-dos done! +${n.gems} bonus gems`);
    }
    if (app.uiT <= 0) {
      app.uiT = 0.25;
      world.gift.visible = game.dailyReady() && game.s.place === 'home' && app.mode !== 'sleep' && app.mode !== 'wash';
      ui.refresh();
      if (game.s.quest >= 4) updateGoal();
    }
    app.saveT -= dt;
    if (app.saveT <= 0) {
      app.saveT = 5;
      game.save();
    }
  } else if (app.spin) {
    world.cam.az += dt * 0.22;
  }

  // music-driven motion
  const b = audio.beat();
  let beat, bps;
  if (b.on) {
    beat = Math.pow(1 - b.phase, 3);
    bps = b.bps;
  } else {
    bps = 1.73;
    beat = Math.pow(1 - ((app.t * bps) % 1), 3);
  }
  const concert = app.mode === 'concert' && audio.mode === 'concert';
  for (const tag of audio.drain()) {
    dog.pulse(tag, concert ? 1 : 0.55);
    if (concert && npc.root.visible && npc.has(tag)) npc.pulse(tag, 1);
    app.lastPulse[tag] = app.t;
    if (concert && Math.random() < 0.3) world.emit('note', partAnchor(tag), { color: colorOf(tag), size: 0.24, vel: [rand(-0.5, 0.5), rand(1, 1.8), rand(-0.3, 0.3)], life: 1.3, spin: rand(-1, 1) });
  }

  app.lookT -= dt;
  let look = world.camera.position;
  if (app.mode === 'play' && app.fetch === 'chase') look = world.ball.position;
  else if (app.lookT > 0 && app.pointerLook) look = app.pointerLook;
  const title = app.screen === 'title';
  dog.update(dt, { beat: dog.asleep ? 0 : beat, bps, mood: app.screen === 'hud' ? game.mood : 0.9, lookAt: look, dancing: concert || (title && !game.s.adopted) });

  if (npc.root.visible) npc.update(dt, { beat, bps, mood: 0.9, lookAt: ui.talking ? dog.anchor('head', tmp) : look, dancing: concert });

  const cam = world.cam;
  if (cam.zoomTarget) cam.zoom += (cam.zoomTarget - cam.zoom) * (1 - Math.exp(-dt * 2));
  world.update(dt, dog.pos);
  world.render();
  requestAnimationFrame(frame);
}

// --------------------------------------------------------------------- boot

world.onBounce = () => audio.ui('bounce');
applySettings();
if (game.s.adopted) {
  dog.build(game.s.levels, game.s.coat);
  $('tagline').textContent = `${game.s.name} is waiting for you`;
} else {
  dog.build({ perc: 3, str: 3, wood: 3, brass: 3 }, 'biscuit'); // a glimpse of what a pup can become
}
dog.pos.set(SPOTS.center[0], 0, SPOTS.center[1]);
world.cam.zoom = 0.8;
resize();
ui.show('title');
requestAnimationFrame(frame);
if (document.fonts && document.fonts.load) document.fonts.load('700 24px Fredoka').catch(() => {});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.save();
    audio.suspend();
  } else {
    audio.resume();
    last = performance.now();
  }
});
window.addEventListener('pagehide', () => game.save());

if (window.__MUSICDOGS_SINGLE_FILE) {
  const link = $('link-classic');
  if (link) link.hidden = true;
} else if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// Handy for tests and the curious.
window.__musicdogs = { app, game, dog, npc, world, audio, ui, travel, talk, confirmPack, buyBoost, buyCosmetic, action, buy, collectTips, openGift, spawnGolden, catchGolden, buyStar, FLOOR_R };
