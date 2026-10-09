// End-of-session summary and question-by-question review.

import { esc, fmt, pct, relativeDay } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { answerHTML } from "../grader.js";
import { questionById, topicById, DIFFICULTIES } from "../bank.js";
import { OPPONENTS } from "../opponent.js";
import { MODE_NAMES, OUTCOMES, beginSession, configFromRecord } from "../session.js";

const OUTCOME_ICON = { c: icons.check, w: icons.x, n: icons.minus, o: icons.flag, p: icons.minus };

export function mountResults(root, { params }) {
  const record = store.history.find((s) => s.id === params[0]) ?? (params[0] ? null : store.history[0]);

  if (!record) {
    root.innerHTML = `
      <section class="page">
        <div class="container narrow empty-state">
          <p class="eyebrow">Results</p>
          <h1 class="page-title">Nothing to show yet</h1>
          <p class="page-lede">Finish a round and your results will appear here.</p>
          <a class="btn btn-primary" href="#/practice">Start practising ${icons.arrowRight}</a>
        </div>
      </section>`;
    return;
  }

  const lightning = record.mode === "lightning";
  const opp = record.opponent ? OPPONENTS[record.opponent] : null;
  const missed = record.items.filter((it) => it.o !== "c");
  const passes = record.items.filter((it) => it.o === "p").length;

  let headline = `${fmt(record.score)} points`;
  let subline = `${record.correct} of ${record.total} correct`;
  if (opp) {
    const diff = record.score - record.oppScore;
    headline = diff > 0 ? "You won." : diff < 0 ? `${opp.name} won.` : "A dead heat.";
    subline = `${fmt(record.score)} – ${fmt(record.oppScore)} against ${opp.name}`;
  } else if (lightning) {
    subline = `${record.correct} correct in ${record.duration} seconds`;
  }

  const tiles = lightning
    ? [
        ["Points", fmt(record.score), ""],
        ["Correct", fmt(record.correct), `of ${record.total} seen`],
        ["Accuracy", pct(record.correct / record.attempted), "of answers given"],
        ["Passed", fmt(passes), passes === 1 ? "question" : "questions"],
      ]
    : [
        ["Points", fmt(record.score), opp ? `${opp.name}: ${fmt(record.oppScore)}` : ""],
        ["Correct", `${record.correct}/${record.total}`, pct(record.correct / record.total) + " of questions"],
        [
          "Buzz accuracy",
          pct(record.correct / record.attempted),
          `${record.attempted} buzz${record.attempted === 1 ? "" : "es"}`,
        ],
        [
          "Avg. buzz point",
          record.avgBuzz == null ? "—" : `${Math.round(record.avgBuzz * 100)}%`,
          "of the question heard",
        ],
      ];

  root.innerHTML = `
    <section class="page results">
      <div class="container">
        <header class="results-head">
          <div>
            <p class="eyebrow">${MODE_NAMES[record.mode]} · ${relativeDay(record.date)}</p>
            <h1 class="results-title">${esc(headline)}</h1>
            <p class="page-lede">${esc(subline)}</p>
          </div>
          <div class="results-actions">
            <button class="btn btn-primary" data-action="again">${icons.rotate}<span>Play again</span></button>
            ${missed.length && !lightning ? `<button class="btn btn-secondary" data-action="missed">Retry ${missed.length} missed</button>` : ""}
            <a class="btn btn-ghost" href="#/practice">Change setup</a>
          </div>
        </header>

        <div class="stat-row">
          ${tiles
            .map(
              ([label, value, note]) => `
            <div class="stat-tile">
              <span class="stat-label">${esc(label)}</span>
              <span class="stat-value">${esc(value)}</span>
              ${note ? `<span class="stat-note">${esc(note)}</span>` : ""}
            </div>`,
            )
            .join("")}
        </div>

        <div class="review">
          <div class="review-head">
            <h2 class="section-title">Question review</h2>
            <div class="review-legend">
              <span class="legend-item" data-outcome="c">${icons.check}Correct</span>
              <span class="legend-item" data-outcome="w">${icons.x}Incorrect</span>
              <span class="legend-item" data-outcome="n">${icons.minus}${lightning ? "Passed" : "No buzz"}</span>
              ${opp ? `<span class="legend-item" data-outcome="o">${icons.flag}${opp.name}</span>` : ""}
            </div>
          </div>
          <ol class="review-list">
            ${record.items.map((item, i) => reviewItem(item, i, record)).join("")}
          </ol>
        </div>
      </div>
    </section>`;

  root.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "again") beginSession(configFromRecord(record));
    if (action === "missed") {
      const config = { ...configFromRecord(record), pool: "missed" };
      if (!beginSession(config)) location.hash = "#/practice";
    }
  });
}

function reviewItem(item, i, record) {
  const q = questionById(item.q);
  if (!q) return "";
  const diff = DIFFICULTIES.find((d) => d.id === q.diff)?.name;
  const outcome = item.o === "p" ? "n" : item.o;
  const label = item.o === "o" && record.opponent ? `${OPPONENTS[record.opponent].name} scored` : OUTCOMES[item.o];
  const text =
    q.kind === "whoami"
      ? q.clues.map((c, k) => `<span class="clue-inline"><b>${[40, 30, 20, 10][k]}</b> ${esc(c)}</span>`).join(" ")
      : esc(q.text);

  return `
    <li class="review-item" data-outcome="${outcome}">
      <span class="review-num">${i + 1}</span>
      <span class="review-icon" title="${esc(label)}" aria-label="${esc(label)}">${OUTCOME_ICON[item.o]}</span>
      <div class="review-body">
        <p class="review-q">${text}</p>
        <p class="review-a">
          <span class="answer">${answerHTML(q.answer)}</span>
          ${item.r && item.o !== "c" ? `<span class="review-said">You said “${esc(item.r)}”</span>` : ""}
        </p>
        <p class="review-meta">
          <span class="tag tag-sm">${esc(topicById[q.topic]?.name ?? "")}</span>
          <span class="tag tag-sm tag-diff" data-diff="${q.diff}">${diff}</span>
          ${item.b != null ? `<span class="buzz-meter" title="Buzzed at ${Math.round(item.b * 100)}% of the question"><span class="buzz-meter-track"><span class="buzz-meter-fill" style="width:${Math.min(100, item.b * 100)}%"></span></span><span class="mono">${Math.min(100, Math.round(item.b * 100))}%</span></span>` : ""}
          ${item.p ? `<span class="review-points mono">+${item.p}</span>` : ""}
        </p>
      </div>
    </li>`;
}
