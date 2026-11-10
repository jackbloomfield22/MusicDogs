// Fast, dependency-free checks of the game's data and rules:  npm test
import assert from 'node:assert/strict';
import { SONGS, DIFFICULTIES } from '../src/audio/songs.js';
import { compileSong, buildChart } from '../src/audio/compile.js';
import { Game, WINDOWS, gradeFor, starsFor } from '../src/game/play.js';

let checks = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  checks++;
};

for (const song of SONGS) {
  const comp = compileSong(song);
  ok(comp.duration > 60 && comp.duration < 130, `${song.title}: sensible length`);
  ok(comp.events.every((e, i) => i === 0 || e.t >= comp.events[i - 1].t), `${song.title}: events sorted`);
  ok(comp.events.every((e) => Number.isFinite(e.t)), `${song.title}: finite event times`);
  ok(comp.sections.some((s) => s.name === song.preview), `${song.title}: preview section exists`);

  let prevCount = 0;
  for (const diff of DIFFICULTIES) {
    const chart = buildChart(comp, diff);
    ok(chart.count >= 60, `${song.title}/${diff}: has notes`);
    ok(chart.count >= prevCount, `${song.title}/${diff}: harder means at least as many notes`);
    prevCount = chart.count;
    ok(chart.notes.every((n) => n.lane >= 0 && n.lane <= 3), `${song.title}/${diff}: lanes in range`);
    ok(chart.notes.every((n) => n.t >= 0 && n.t < comp.duration), `${song.title}/${diff}: notes inside the song`);
    ok(chart.notes[0].t > comp.barDur * 1.5, `${song.title}/${diff}: breathing room before the first note`);

    // No two notes may share a lane at (almost) the same time, or land inside a hold.
    const byLane = [[], [], [], []];
    chart.notes.forEach((n) => byLane[n.lane].push(n));
    for (const lane of byLane) {
      for (let i = 1; i < lane.length; i++) {
        const a = lane[i - 1];
        ok(lane[i].t - Math.max(a.t, a.end) > 0.05, `${song.title}/${diff}: overlapping notes in a lane at ${lane[i].t.toFixed(2)}s`);
      }
    }
    // Easy never asks for two fingers at once.
    if (diff === 'easy') {
      for (let i = 1; i < chart.notes.length; i++) {
        const a = chart.notes[i - 1];
        ok(chart.notes[i].t - Math.max(a.t, a.end) > 0.2, `${song.title}/easy: needs two fingers at ${chart.notes[i].t.toFixed(2)}s`);
      }
    }

    // A perfect autoplay run earns the top grade and a full combo.
    const events = [];
    const game = new Game(comp, chart, { auto: true, emit: (type, e) => events.push([type, e]) });
    for (let t = -comp.leadIn; t < comp.duration + 1; t += 1 / 120) game.update(t);
    const r = game.results();
    ok(game.finished, `${song.title}/${diff}: song finishes`);
    ok(r.allPerfect && r.fullCombo && r.grade === 'S+' && r.stars === 3, `${song.title}/${diff}: perfect run scores S+`);
    ok(r.maxCombo === chart.count, `${song.title}/${diff}: combo counts every note`);
    ok(events.some(([type, e]) => type === 'howl' && e.on), `${song.title}/${diff}: Howl Time triggers`);
    ok(events.filter(([type]) => type === 'holdDone').length === chart.holds, `${song.title}/${diff}: every hold completes`);

    // Doing nothing misses everything.
    const idle = new Game(comp, chart);
    for (let t = -comp.leadIn; t < comp.duration + 1; t += 1 / 30) idle.update(t);
    const ir = idle.results();
    ok(ir.counts.miss === chart.count && ir.score === 0 && ir.stars === 0 && ir.grade === 'D', `${song.title}/${diff}: idle run scores nothing`);
  }
}

// Judgement windows.
{
  const comp = compileSong(SONGS[0]);
  const chart = buildChart(comp, 'easy');
  const first = chart.notes.find((n) => !n.hold);
  const judge = (offset) => {
    const g = new Game(comp, chart);
    g.update(first.t + offset - 0.001);
    return g.press(first.lane, first.t + offset);
  };
  ok(judge(0) === 'perfect', 'dead-on is perfect');
  ok(judge(WINDOWS.perfect + 0.01) === 'great', 'slightly late is great');
  ok(judge(-(WINDOWS.great + 0.01)) === 'good', 'early is good');
  ok(judge(-(WINDOWS.good + 0.05)) === null, 'far too early is ignored, not punished');

  // Letting go of a hold early breaks the combo.
  const hold = chart.notes.find((n) => n.hold);
  const g = new Game(comp, chart);
  g.combo = 5;
  g.head = chart.notes.indexOf(hold);
  g.update(hold.t);
  g.press(hold.lane, hold.t);
  g.release(hold.lane, hold.t + 0.1);
  ok(g.combo === 0, 'early release breaks combo');
}

ok(gradeFor(1, true) === 'S+' && gradeFor(0.96, false) === 'S' && gradeFor(0.5, false) === 'D', 'grades');
ok(starsFor(0.95) === 3 && starsFor(0.8) === 2 && starsFor(0.5) === 1 && starsFor(0.1) === 0, 'stars');
ok(SONGS[0].unlock === 0, 'first song is always playable');
ok(SONGS.every((s, i) => i === 0 || s.unlock <= i * 3), 'every song can be unlocked with stars from earlier songs');

console.log(`MusicDogs smoke test: ${checks} checks passed`);
