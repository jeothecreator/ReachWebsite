// Persistent state (settings, last practice setup, per-question progress, session history).
// Everything lives in one localStorage entry so it is easy to export or reset.

const KEY = "summit:v1";
const MAX_HISTORY = 150;

const DEFAULTS = {
  settings: {
    theme: "system", // "system" | "light" | "dark"
    speed: 5, // reading speed, 1 (slow) – 10 (fast)
    answerTime: 8, // seconds to answer after buzzing
    buzzWindow: 5, // seconds to buzz after the question finishes
    judging: "typed", // "typed" | "self"
    sound: true,
    volume: 0.6,
  },
  config: {
    mode: "snappers", // "snappers" | "whoami" | "lightning"
    topics: null, // null = every topic
    diffs: [1, 2, 3],
    count: 20,
    duration: 60,
    opponent: "off",
    pool: "all", // "all" | "unseen" | "missed"
  },
  // qid -> [timesSeen, timesCorrect, lastResultWasCorrect (0/1)]
  progress: {},
  history: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      settings: { ...DEFAULTS.settings, ...saved.settings },
      config: { ...DEFAULTS.config, ...saved.config },
      progress: saved.progress && typeof saved.progress === "object" ? saved.progress : {},
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch {
    return clone(DEFAULTS);
  }
}

const state = load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage can be full or disabled (private browsing); the app still works for this visit.
  }
}

export const store = {
  get settings() {
    return state.settings;
  },
  get config() {
    return state.config;
  },
  get progress() {
    return state.progress;
  },
  get history() {
    return state.history;
  },

  updateSettings(patch) {
    Object.assign(state.settings, patch);
    persist();
    listeners.forEach((fn) => fn(state.settings));
  },

  updateConfig(patch) {
    Object.assign(state.config, patch);
    persist();
  },

  onSettingsChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  /** Record the outcome of one question. `correct` is a boolean. */
  recordAttempt(qid, correct) {
    const entry = state.progress[qid] || [0, 0, 0];
    entry[0] += 1;
    if (correct) entry[1] += 1;
    entry[2] = correct ? 1 : 0;
    state.progress[qid] = entry;
  },

  /** Change the most recent result for a question (used when the player overrides a judgement). */
  amendAttempt(qid, correct) {
    const entry = state.progress[qid];
    if (!entry) return this.recordAttempt(qid, correct);
    entry[1] = Math.max(0, entry[1] + (correct ? 1 : -1));
    entry[2] = correct ? 1 : 0;
  },

  /** Save a finished session and flush progress to storage. */
  saveSession(session) {
    state.history.unshift(session);
    if (state.history.length > MAX_HISTORY) state.history.length = MAX_HISTORY;
    persist();
  },

  isSeen: (qid) => Boolean(state.progress[qid]),
  isMissed: (qid) => Boolean(state.progress[qid]) && state.progress[qid][2] === 0,

  resetProgress() {
    state.progress = {};
    state.history = [];
    persist();
  },
};

/** Milliseconds per word for a reading-speed setting of 1–10. */
export function msPerWord(speed) {
  const s = Math.min(10, Math.max(1, Number(speed) || 5));
  return Math.round(480 - (s - 1) * 42); // 480 ms (≈125 wpm) … 102 ms (≈590 wpm)
}
