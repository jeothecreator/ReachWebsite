// Daily Challenge: ten snappers chosen from the date, so everyone gets the same set each day.

import { QUESTIONS } from "./bank.js";
import { store } from "./store.js";

export const DAILY_SIZE = 10;
const PLAN = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]; // difficulty ramps from Junior to Senior
const EPOCH = Date.UTC(2026, 9, 1); // Daily #1 = October 1, 2026

const pad = (n) => String(n).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function keyToDate(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, delta) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + delta);
  return dayKey(d);
}

/** Challenge number shown to players (#1, #2, …). */
export function dailyNumber(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86_400_000) + 1;
}

function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The day's questions: deterministic for a given date and question bank. */
export function dailyQuestions(key) {
  const random = seededRandom(hash(`summit-daily:${key}`));
  const usedTopics = new Set();
  const chosen = [];
  for (const diff of PLAN) {
    const pool = QUESTIONS.filter((q) => q.kind === "snapper" && q.diff === diff && !chosen.includes(q));
    // Prefer topics not used yet today, for variety.
    const fresh = pool.filter((q) => !usedTopics.has(q.topic));
    const from = fresh.length ? fresh : pool;
    const q = from[Math.floor(random() * from.length)];
    chosen.push(q);
    usedTopics.add(q.topic);
  }
  return chosen;
}

/** Consecutive days played, counting back from today (or yesterday if today isn't done yet). */
export function currentStreak(today = dayKey()) {
  const daily = store.daily;
  let key = daily[today] ? today : addDays(today, -1);
  let streak = 0;
  while (daily[key]) {
    streak += 1;
    key = addDays(key, -1);
  }
  return streak;
}

export function bestStreak() {
  const keys = Object.keys(store.daily).sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const key of keys) {
    run = prev && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

const MARK = { c: "🟩", w: "🟥", n: "⬜", o: "⬜", p: "⬜" };

/** Text people can paste into a group chat. */
export function shareText(key, result) {
  const date = keyToDate(key).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  const buzz = result.avgBuzz == null ? "" : ` · avg buzz ${Math.round(result.avgBuzz * 100)}%`;
  const url = `${location.origin}${location.pathname}#/daily`;
  return [
    `Summit Daily #${dailyNumber(key)} · ${date}`,
    `${[...result.marks].map((m) => MARK[m] ?? "⬜").join("")}  ${result.correct}/${result.total}`,
    `${result.score} pts${buzz}`,
    url,
  ].join("\n");
}

/** Share via the system sheet on phones, or copy to the clipboard. Resolves to "shared" | "copied" | "failed". */
export async function shareResult(text) {
  if (navigator.share && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // Cancelled or unavailable; fall back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok ? "copied" : "failed";
  }
}
