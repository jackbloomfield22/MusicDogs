// Persistent settings + best scores. Every access is guarded: the game must
// run fine when storage is unavailable (private windows, embedded frames).

const KEY = 'musicdogs.v1';

const DEFAULTS = {
  settings: {
    music: 0.8,
    sfx: 0.8,
    speed: 5, // 1..10 note approach speed
    offset: 0, // ms, positive = notes judged later (for laggy audio output)
    haptics: true,
    reducedFx: false,
  },
  best: {}, // best[songId][difficulty] = { score, acc, grade, stars, combo, fc }
  seenHowTo: false,
  lastSong: null,
  lastDiff: 'normal',
};

let state = structuredCloneSafe(DEFAULTS);

function structuredCloneSafe(o) {
  return JSON.parse(JSON.stringify(o));
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = {
        ...structuredCloneSafe(DEFAULTS),
        ...parsed,
        settings: { ...DEFAULTS.settings, ...(parsed.settings || {}) },
        best: parsed.best || {},
      };
    }
  } catch {
    state = structuredCloneSafe(DEFAULTS);
  }
  return state;
}

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: keep playing with in-memory state */
  }
}

export const save = () => state;

export function getBest(songId, diff) {
  return (state.best[songId] && state.best[songId][diff]) || null;
}

/** Record a result; returns true when it beats the stored best score. */
export function recordResult(songId, diff, result) {
  const song = (state.best[songId] = state.best[songId] || {});
  const prev = song[diff];
  const isBest = !prev || result.score > prev.score;
  song[diff] = {
    score: Math.max(result.score, prev ? prev.score : 0),
    acc: Math.max(result.acc, prev ? prev.acc : 0),
    grade: isBest ? result.grade : prev.grade,
    stars: Math.max(result.stars, prev ? prev.stars : 0),
    combo: Math.max(result.maxCombo, prev ? prev.combo : 0),
    fc: !!(result.fullCombo || (prev && prev.fc)),
  };
  persist();
  return isBest;
}

/** Best star count for a song across all difficulties (0..3). */
export function songStars(songId) {
  const s = state.best[songId];
  if (!s) return 0;
  return Math.max(0, ...Object.values(s).map((r) => r.stars || 0));
}

export function totalStars(songs) {
  return songs.reduce((sum, s) => sum + songStars(s.id), 0);
}

export function resetProgress() {
  state.best = {};
  persist();
}
