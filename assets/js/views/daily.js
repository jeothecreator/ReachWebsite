// Daily Challenge page: today's status, streaks, the last two weeks, and sharing.

import { esc, fmt } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { beginSession } from "../session.js";
import {
  DAILY_SIZE,
  dayKey,
  keyToDate,
  addDays,
  dailyNumber,
  dailyQuestions,
  currentStreak,
  bestStreak,
  shareText,
  shareResult,
} from "../daily.js";

const OUTCOME_LABEL = { c: "Correct", w: "Incorrect", n: "No buzz", o: "No buzz", p: "Passed" };

export function marksHTML(marks, size = "md") {
  return `<span class="marks marks-${size}" role="img" aria-label="${[...marks].map((m) => OUTCOME_LABEL[m] ?? "No buzz").join(", ")}">${[
    ...marks,
  ]
    .map((m) => `<i data-outcome="${m === "o" || m === "p" ? "n" : m}"></i>`)
    .join("")}</span>`;
}

function countdownText() {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const s = Math.max(0, Math.floor((next - now) / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

export function mountDaily(root) {
  const today = dayKey();
  const result = store.daily[today];
  const streak = currentStreak(today);
  const best = bestStreak();
  const played = Object.keys(store.daily).length;
  const dateLabel = keyToDate(today).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });

  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));

  root.innerHTML = `
    <section class="page daily">
      <div class="container narrow-wide">
        <header class="page-head">
          <p class="eyebrow">${icons.calendar}Daily Challenge · #${dailyNumber(today)}</p>
          <h1 class="page-title">${esc(dateLabel)}</h1>
          <p class="page-lede">Ten questions, the same for everyone today, climbing from Junior to Senior. Your first attempt is the one that counts.</p>
        </header>

        <div class="daily-grid">
          <div class="daily-main" data-ref="main">
            ${
              result
                ? `
              <div class="daily-card is-done">
                <p class="eyebrow">Today’s result</p>
                <p class="daily-score"><span>${result.correct}</span><span class="muted">/${result.total}</span></p>
                ${marksHTML(result.marks, "lg")}
                <p class="daily-sub">${fmt(result.score)} points${result.avgBuzz == null ? "" : ` · average buzz at ${Math.round(result.avgBuzz * 100)}% of the question`}</p>
                <div class="daily-actions">
                  <button class="btn btn-primary" data-action="share">${icons.share}<span>Share result</span></button>
                  ${result.session && store.history.some((h) => h.id === result.session) ? `<a class="btn btn-secondary" href="#/results/${result.session}">Review answers</a>` : ""}
                </div>
                <p class="daily-toast" data-ref="toast" role="status"></p>
                <p class="daily-next">Next challenge in <span class="mono" data-ref="countdown">${countdownText()}</span></p>
              </div>`
                : `
              <div class="daily-card">
                <p class="eyebrow">Ready?</p>
                <p class="daily-title">${DAILY_SIZE} questions · about three minutes</p>
                <ul class="daily-rules">
                  <li>${icons.bolt}<span>Questions are read word by word. Press <kbd>Space</kbd> to buzz.</span></li>
                  <li>${icons.target}<span>Three Junior, four Intermediate and three Senior questions.</span></li>
                  <li>${icons.flame}<span>Play every day to build your streak.</span></li>
                </ul>
                <button class="btn btn-primary btn-lg" data-action="start">Start today’s challenge ${icons.arrowRight}</button>
              </div>`
            }
          </div>

          <aside class="daily-side">
            <div class="stat-row stat-row-3">
              <div class="stat-tile">
                <span class="stat-label">Current streak</span>
                <span class="stat-value">${streak}</span>
                <span class="stat-note">${streak === 1 ? "day" : "days"}</span>
              </div>
              <div class="stat-tile">
                <span class="stat-label">Best streak</span>
                <span class="stat-value">${best}</span>
                <span class="stat-note">${best === 1 ? "day" : "days"}</span>
              </div>
              <div class="stat-tile">
                <span class="stat-label">Played</span>
                <span class="stat-value">${played}</span>
                <span class="stat-note">${played === 1 ? "challenge" : "challenges"}</span>
              </div>
            </div>

            <div class="panel">
              <header class="panel-head">
                <h2 class="panel-title">Last two weeks</h2>
                <p class="panel-sub">Correct answers each day</p>
              </header>
              <ol class="day-strip">
                ${days
                  .map((key) => {
                    const r = store.daily[key];
                    const d = keyToDate(key);
                    const label = d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
                    return `
                  <li class="day-cell ${r ? "is-played" : ""} ${key === today ? "is-today" : ""}" title="${esc(label)}${r ? ` · ${r.correct}/${r.total}` : " · not played"}">
                    <span class="day-bar" style="--fill:${r ? r.correct / r.total : 0}" aria-hidden="true"></span>
                    <span class="day-num mono">${r ? r.correct : "–"}</span>
                    <span class="day-label">${d.toLocaleDateString("en-CA", { weekday: "narrow" })}</span>
                  </li>`;
                  })
                  .join("")}
              </ol>
            </div>
          </aside>
        </div>
      </div>
    </section>`;

  const countdown = root.querySelector("[data-ref=countdown]");
  const tick = countdown
    ? setInterval(() => {
        countdown.textContent = countdownText();
        if (dayKey() !== today) location.reload();
      }, 1000)
    : null;

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "start") {
      beginSession(
        { mode: "snappers", daily: today, count: DAILY_SIZE, topics: null, diffs: [1, 2, 3], opponent: "off", pool: "all" },
        dailyQuestions(today),
      );
    } else if (action === "share") {
      const outcome = await shareResult(shareText(today, result));
      const toast = root.querySelector("[data-ref=toast]");
      toast.textContent = outcome === "copied" ? "Copied to your clipboard." : outcome === "shared" ? "" : "Couldn’t share.";
    }
  });

  return () => clearInterval(tick);
}
