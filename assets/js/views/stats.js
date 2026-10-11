// Long-term progress: totals, accuracy by topic and level, and recent sessions.

import { $, esc, fmt, pct, relativeDay } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { TOPICS, DIFFICULTIES, questionById, counts } from "../bank.js";
import { OPPONENTS } from "../opponent.js";
import { MODE_NAMES, beginSession } from "../session.js";

function aggregate() {
  const history = store.history;
  const byTopic = Object.fromEntries(TOPICS.map((t) => [t.id, { seen: 0, correct: 0 }]));
  const byDiff = { 1: { seen: 0, correct: 0 }, 2: { seen: 0, correct: 0 }, 3: { seen: 0, correct: 0 } };
  let seen = 0;
  let correct = 0;
  let attempted = 0;
  let buzzSum = 0;
  let buzzN = 0;
  let bestLightning = null;
  let wins = 0;
  let matches = 0;

  for (const s of history) {
    if (s.mode === "lightning" && !s.packet) bestLightning = Math.max(bestLightning ?? 0, s.score);
    if (s.opponent) {
      matches += 1;
      if (s.score > s.oppScore) wins += 1;
    }
    for (const it of s.items) {
      if (it.o === "p") continue;
      const q = questionById(it.q);
      if (!q) continue;
      seen += 1;
      const ok = it.o === "c";
      if (ok) correct += 1;
      if (it.o === "c" || it.o === "w") attempted += 1;
      if (it.b != null) {
        buzzSum += Math.min(1, it.b);
        buzzN += 1;
      }
      byTopic[q.topic].seen += 1;
      byDiff[q.diff].seen += 1;
      if (ok) {
        byTopic[q.topic].correct += 1;
        byDiff[q.diff].correct += 1;
      }
    }
  }

  const unique = Object.keys(store.progress).length;
  const missed = Object.values(store.progress).filter((p) => p[2] === 0).length;
  return {
    history,
    byTopic,
    byDiff,
    seen,
    correct,
    attempted,
    avgBuzz: buzzN ? buzzSum / buzzN : null,
    bestLightning,
    wins,
    matches,
    unique,
    missed,
  };
}

function meterRow(label, data, extra = "") {
  const ratio = data.seen ? data.correct / data.seen : null;
  const width = ratio ? Math.max(ratio * 100, 1.5) : 0;
  return `
    <li class="meter-row" title="${esc(label)}: ${data.correct} of ${data.seen} correct">
      <span class="meter-label">${esc(label)}${extra}</span>
      <span class="meter-track" aria-hidden="true"><span class="meter-fill" style="width:${width}%"></span></span>
      <span class="meter-value mono">${ratio == null ? "—" : pct(ratio)}</span>
      <span class="meter-count mono">${data.correct}/${data.seen}</span>
    </li>`;
}

export function mountStats(root) {
  const a = aggregate();

  if (!a.history.length) {
    root.innerHTML = `
      <section class="page">
        <div class="container narrow empty-state">
          <p class="eyebrow">Stats</p>
          <h1 class="page-title">Your stats start with one round</h1>
          <p class="page-lede">Play a few questions and Summit will track your accuracy by topic, how early you buzz, and which questions to revisit.</p>
          <a class="btn btn-primary" href="#/practice">Start practising ${icons.arrowRight}</a>
        </div>
      </section>`;
    return;
  }

  const topicRows = TOPICS.map((t) => ({ t, d: a.byTopic[t.id] })).sort(
    (x, y) => (y.d.seen ? y.d.correct / y.d.seen : -1) - (x.d.seen ? x.d.correct / x.d.seen : -1),
  );

  const tiles = [
    ["Questions played", fmt(a.seen), `${fmt(a.unique)} of ${fmt(counts.total)} in the bank`],
    ["Correct", pct(a.correct / a.seen), `${fmt(a.correct)} questions`],
    ["Buzz accuracy", pct(a.correct / a.attempted), "when you buzzed in"],
    ["Avg. buzz point", a.avgBuzz == null ? "—" : `${Math.round(a.avgBuzz * 100)}%`, "lower means earlier"],
  ];

  root.innerHTML = `
    <section class="page stats">
      <div class="container">
        <header class="page-head page-head-row">
          <div>
            <p class="eyebrow">Stats</p>
            <h1 class="page-title">Your progress</h1>
            <p class="page-lede">${fmt(a.history.length)} session${a.history.length === 1 ? "" : "s"} played${a.matches ? ` · ${a.wins} of ${a.matches} matches won` : ""}${a.bestLightning != null ? ` · best lightning round ${a.bestLightning} pts` : ""}</p>
          </div>
          <div class="page-head-actions">
            ${a.missed ? `<button class="btn btn-primary" data-action="missed">${icons.target}<span>Practise ${fmt(a.missed)} missed</span></button>` : ""}
          </div>
        </header>

        <div class="stat-row">
          ${tiles
            .map(
              ([label, value, note]) => `
            <div class="stat-tile">
              <span class="stat-label">${esc(label)}</span>
              <span class="stat-value">${esc(value)}</span>
              <span class="stat-note">${esc(note)}</span>
            </div>`,
            )
            .join("")}
        </div>

        <div class="stats-grid">
          <section class="panel">
            <header class="panel-head">
              <h2 class="panel-title">Accuracy by topic</h2>
              <p class="panel-sub">Share of questions answered correctly</p>
            </header>
            <ul class="meter-list">
              ${topicRows.map(({ t, d }) => meterRow(t.name, d)).join("")}
            </ul>
          </section>

          <div class="stats-side">
            <section class="panel">
              <header class="panel-head">
                <h2 class="panel-title">Accuracy by level</h2>
              </header>
              <ul class="meter-list">
                ${DIFFICULTIES.map((d) => meterRow(d.name, a.byDiff[d.id])).join("")}
              </ul>
            </section>

            <section class="panel">
              <header class="panel-head">
                <h2 class="panel-title">Recent sessions</h2>
              </header>
              <ul class="session-list">
                ${a.history
                  .slice(0, 8)
                  .map(
                    (s) => `
                  <li>
                    <a class="session-link" href="#/results/${s.id}">
                      <span class="session-mode">${s.daily ? "Daily Challenge" : MODE_NAMES[s.mode]}${s.opponent ? ` <span class="muted">vs ${OPPONENTS[s.opponent].name}</span>` : ""}${s.packetName ? ` <span class="muted">· ${esc(s.packetName)}</span>` : ""}</span>
                      <span class="session-date muted">${relativeDay(s.date)}</span>
                      <span class="session-score mono">${s.correct}/${s.total}</span>
                      <span class="session-points mono">${fmt(s.score)} pts</span>
                    </a>
                  </li>`,
                  )
                  .join("")}
              </ul>
            </section>
          </div>
        </div>

        <footer class="stats-foot">
          <p class="muted small">Stats are stored only in this browser.</p>
          <button class="btn btn-ghost btn-sm" data-action="reset">${icons.trash}<span>Reset all progress</span></button>
        </footer>
      </div>
    </section>`;

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "missed") {
      // Missed questions are replayed solo, whatever format was set up last.
      const { mode, roomSet } = store.config;
      const solo = mode === "whoami" || (mode === "room" && roomSet === "whoami") ? "whoami" : "snappers";
      beginSession({
        ...store.config,
        mode: solo,
        topics: null,
        diffs: [1, 2, 3],
        pool: "missed",
      }) ||
        beginSession({ ...store.config, mode: "whoami", topics: null, diffs: [1, 2, 3], pool: "missed", count: 10 });
    }
    if (btn.dataset.action === "reset") {
      if (btn.dataset.confirm) {
        store.resetProgress();
        mountStats(root);
      } else {
        btn.dataset.confirm = "1";
        btn.classList.add("is-danger");
        $("span", btn).textContent = "Click again to erase everything";
      }
    }
  });
}
