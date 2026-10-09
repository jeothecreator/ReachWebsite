// Hands a prepared question set from the setup screen to the game, and the finished
// session from the game to the results screen.

import { drawQuestions } from "./bank.js";
import { store } from "./store.js";

let pending = null;

export const MODE_NAMES = { snappers: "Snappers", whoami: "Who Am I?", lightning: "Lightning Round" };

/** Outcome codes stored in history: correct, wrong, no answer, opponent scored, passed. */
export const OUTCOMES = { c: "Correct", w: "Incorrect", n: "No answer", o: "Opponent scored", p: "Passed" };

export function beginSession(config) {
  const questions = drawQuestions(config);
  if (!questions.length) return false;
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
export function saveSession({ config, items, score, oppScore = null, duration = null }) {
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
  store.saveSession(record);
  return record;
}
