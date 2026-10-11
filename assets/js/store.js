// Persistent state (settings, last practice setup, per-question progress, session history).
// Everything lives in one localStorage entry so it is easy to export or reset. Imported packets
// get their own entry, so a large packet can never crowd out progress.

const KEY = "summit:v1";
const PACKETS_KEY = "summit:packets";
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
    voice: false, // read questions aloud
    voiceName: "", // "" = best available English voice
  },
  config: {
    mode: "snappers", // "snappers" | "whoami" | "lightning"
    topics: null, // null = every topic
    diffs: [1, 2, 3],
    count: 20,
    duration: 60,
    opponent: "off",
    pool: "all", // "all" | "unseen" | "missed"
    roomSet: "snappers", // question type used in the Buzzer Room
    teams: null, // Buzzer Room teams: [{ name, key }]
  },
  // qid -> [timesSeen, timesCorrect, lastResultWasCorrect (0/1)]
  progress: {},
  history: [],
  // "YYYY-MM-DD" -> { score, correct, total, marks, avgBuzz, session }
  daily: {},
  // Imported question sets: [{ id, name, created, questions: [[text, answer, alts]] }]
  packets: [],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadPackets(legacy) {
  try {
    const saved = JSON.parse(localStorage.getItem(PACKETS_KEY) ?? "null");
    if (Array.isArray(saved)) return saved;
  } catch {
    // fall through to packets saved by older versions inside the main entry
  }
  return Array.isArray(legacy) ? legacy : [];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    return {
      settings: { ...DEFAULTS.settings, ...saved.settings },
      config: { ...DEFAULTS.config, ...saved.config },
      progress: saved.progress && typeof saved.progress === "object" ? saved.progress : {},
      history: Array.isArray(saved.history) ? saved.history : [],
      daily: saved.daily && typeof saved.daily === "object" ? saved.daily : {},
      packets: loadPackets(saved.packets),
    };
  } catch {
    return { ...clone(DEFAULTS), packets: loadPackets() };
  }
}

const state = load();
const listeners = new Set();

// Move packets saved by older versions (inside the main entry) to their own entry.
try {
  if (state.packets.length && localStorage.getItem(PACKETS_KEY) === null && persistPackets()) persist();
} catch {
  // storage disabled
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...state, packets: undefined }));
  } catch {
    // Storage can be full or disabled (private browsing); the app still works for this visit.
  }
}

/** Returns false if the browser refused to store the packets (usually because storage is full). */
function persistPackets() {
  try {
    localStorage.setItem(PACKETS_KEY, JSON.stringify(state.packets));
    return true;
  } catch {
    return false;
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
  get daily() {
    return state.daily;
  },
  get packets() {
    return state.packets;
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

  /** Keep the first completed attempt at each day's challenge. */
  recordDaily(key, result) {
    if (state.daily[key]) return;
    state.daily[key] = result;
    persist();
  },

  /** Save a packet; returns false (and keeps nothing) if it doesn't fit in storage. */
  savePacket(packet) {
    const previous = state.packets;
    state.packets = [packet, ...previous.filter((p) => p.id !== packet.id)];
    if (persistPackets()) return true;
    state.packets = previous;
    return false;
  },

  deletePacket(id) {
    state.packets = state.packets.filter((p) => p.id !== id);
    persistPackets();
  },

  isSeen: (qid) => Boolean(state.progress[qid]),
  isMissed: (qid) => Boolean(state.progress[qid]) && state.progress[qid][2] === 0,

  resetProgress() {
    state.progress = {};
    state.history = [];
    state.daily = {};
    persist();
  },
};

/** Milliseconds per word for a reading-speed setting of 1–10. */
export function msPerWord(speed) {
  const s = Math.min(10, Math.max(1, Number(speed) || 5));
  return Math.round(480 - (s - 1) * 42); // 480 ms (≈125 wpm) … 102 ms (≈590 wpm)
}
