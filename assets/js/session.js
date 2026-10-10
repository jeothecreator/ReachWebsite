// Hands a prepared question set from the setup screen to the game, and the finished
// session from the game to the results screen.

import { drawQuestions } from "./bank.js";
import { store } from "./store.js";
import { primeSpeech } from "./speech.js";

let pending = null;

export const MODE_NAMES = {
  snappers: "Snappers",
  whoami: "Who Am I?",
  lightning: "Lightning Round",
  room: "Buzzer Room",
};

/** Outcome codes stored in history: correct, wrong, no answer, opponent scored, passed. */
export const OUTCOMES = { c: "Correct", w: "Incorrect", n: "No answer", o: "Opponent scored", p: "Passed" };

/**
 * Start a game. Questions are drawn from the bank unless a fixed set is supplied
 * (the Daily Challenge and imported packets).
 */
export function beginSession(config, questions = drawQuestions(config)) {
  if (!questions.length) return false;
  primeSpeech(); // games always start from a click, which lets iOS speak later
  pending = { config: { ...config }, questions };
  location.hash = "#/play";
  return true;
}

/** Rebuild a practice config from a saved session record. */
export function configFromRecord(record) {
  return {
    mode: record.mode,
    topics: record.topics ?? null,
    diffs: record.diffs ?? [1, 2, 3],
    count: record.count ?? 20,
    duration: record.duration ?? 60,
    opponent: record.opponent ?? "off",
    pool: record.pool ?? "all",
  };
}

export function takePendingSession() {
  return pending;
}

export function clearPendingSession() {
  pending = null;
}

/** Persist a finished (or abandoned) session and return its record. */
export function saveSession({ config, items, score, oppScore = null, duration = null, complete = true }) {
  const attempted = items.filter((it) => it.o === "c" || it.o === "w").length;
  const buzzes = items.filter((it) => it.b != null);
  const record = {
    id: Date.now().toString(36),
    date: Date.now(),
    mode: config.mode,
    opponent: config.opponent && config.opponent !== "off" && config.mode !== "lightning" ? config.opponent : null,
    topics: config.topics,
    diffs: config.diffs,
    count: config.count,
    pool: config.pool,
    duration,
    score,
    oppScore,
    correct: items.filter((it) => it.o === "c").length,
    total: items.length,
    attempted,
    avgBuzz: buzzes.length ? buzzes.reduce((sum, it) => sum + it.b, 0) / buzzes.length : null,
    items,
  };
  if (config.daily) record.daily = config.daily;
  if (config.packet) {
    record.packet = config.packet;
    record.packetName = config.packetName;
  }
  store.saveSession(record);

  if (config.daily && complete) {
    store.recordDaily(config.daily, {
      score,
      correct: record.correct,
      total: record.total,
      avgBuzz: record.avgBuzz,
      marks: items.map((it) => it.o).join(""),
      session: record.id,
    });
  }
  return record;
}
