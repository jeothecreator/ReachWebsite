// End-of-session summary: headline, stats, a buzz-point chart and a question-by-question review.

import { esc, fmt, pct, relativeDay } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { answerHTML } from "../grader.js";
import { questionById, topicById, DIFFICULTIES } from "../bank.js";
import { OPPONENTS } from "../opponent.js";
import { MODE_NAMES, OUTCOMES, beginSession, configFromRecord } from "../session.js";
import { confetti } from "../confetti.js";
import { dailyNumber, keyToDate, currentStreak, shareText, shareResult } from "../daily.js";
import { playPacket } from "./packets.js";
import { marksHTML } from "./daily.js";

const OUTCOME_ICON = { c: icons.check, w: icons.x, n: icons.minus, o: icons.flag, p: icons.minus };

/** Look up a question, falling back to the copy stored with custom-packet sessions. */
function resolveQuestion(item, record) {
  const q = questionById(item.q);
  if (q) return q;
  if (!item.t) return null;
  return { kind: "snapper", text: item.t, answer: item.a, alts: [], topic: "custom", topicName: record.packetName, diff: 0 };
}

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
  const daily = record.daily ? store.daily[record.daily] : null;

  let headline = `${fmt(record.score)} points`;
  let subline = `${record.correct} of ${record.total} correct`;
  if (opp) {
    const diff = record.score - record.oppScore;
    headline = diff > 0 ? "You won." : diff < 0 ? `${opp.name} won.` : "A dead heat.";
    subline = `${fmt(record.score)} – ${fmt(record.oppScore)} against ${opp.name}`;
  } else if (lightning) {
    subline = `${record.correct} correct in ${record.duration} seconds`;
  } else if (record.daily) {
    headline = `${record.correct} out of ${record.total}`;
    subline = `${fmt(record.score)} points on Daily Challenge #${dailyNumber(record.daily)}`;
  }

  const eyebrow = record.daily
    ? `Daily Challenge · ${keyToDate(record.daily).toLocaleDateString("en-CA", { month: "long", day: "numeric" })}`
    : `${MODE_NAMES[record.mode]}${record.packetName ? ` · ${esc(record.packetName)}` : ""} · ${relativeDay(record.date)}`;

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

  const actions = record.daily
    ? `
      ${daily ? `<button class="btn btn-primary" data-action="share">${icons.share}<span>Share result</span></button>` : ""}
      <a class="btn ${daily ? "btn-secondary" : "btn-primary"}" href="#/daily">${icons.calendar}<span>Daily Challenge</span></a>
      <a class="btn btn-ghost" href="#/practice">Practise more</a>`
    : `
      <button class="btn btn-primary" data-action="again">${icons.rotate}<span>Play again</span></button>
      ${missed.length && !lightning && !record.packet ? `<button class="btn btn-secondary" data-action="missed">Retry ${missed.length} missed</button>` : ""}
      <a class="btn btn-ghost" href="${record.packet ? "#/bank" : "#/practice"}">${record.packet ? "Your packets" : "Change setup"}</a>`;

  root.innerHTML = `
    <section class="page results">
      <div class="container">
        <header class="results-head">
          <div>
            <p class="eyebrow">${eyebrow}</p>
            <h1 class="results-title">${esc(headline)}</h1>
            <p class="page-lede">${esc(subline)}</p>
            ${
              daily
                ? `<div class="results-daily">${marksHTML(daily.marks, "lg")}<span class="results-streak">${icons.flame}${currentStreak()}-day streak</span></div>
                   <p class="daily-toast" data-ref="toast" role="status"></p>`
                : ""
            }
          </div>
          <div class="results-actions">${actions}</div>
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

        ${lightning ? "" : buzzChart(record)}

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

  // Celebrate a strong finish, but only right after playing (not when revisiting old results).
  const fresh = Date.now() - record.date < 15_000;
  const won = opp && record.score > record.oppScore;
  const strong = !lightning && record.total >= 5 && record.correct / record.total >= 0.8;
  if (fresh && (won || strong)) setTimeout(confetti, 250);

  root.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "again") {
      const packet = record.packet && store.packets.find((p) => p.id === record.packet);
      if (record.packet) {
        if (packet) playPacket(packet, record.mode);
        else location.hash = "#/bank";
      } else {
        beginSession(configFromRecord(record));
      }
    } else if (action === "missed") {
      const config = { ...configFromRecord(record), mode: record.mode === "whoami" ? "whoami" : "snappers", pool: "missed" };
      if (!beginSession(config)) location.hash = "#/practice";
    } else if (action === "share" && daily) {
      const outcome = await shareResult(shareText(record.daily, daily));
      const toast = root.querySelector("[data-ref=toast]");
      if (toast) toast.textContent = outcome === "copied" ? "Copied to your clipboard." : outcome === "failed" ? "Couldn’t share." : "";
    }
  });
}

/** Column chart of how much of each question was heard before buzzing (shorter = earlier). */
function buzzChart(record) {
  const items = record.items;
  if (items.length < 3 || !items.some((it) => it.b != null)) return "";
  const every = items.length > 20 ? 5 : 1;
  const describe = (it, i) => {
    const n = `Question ${i + 1}`;
    if (it.b == null) return `${n}: ${it.o === "o" ? "the rival buzzed first" : "no buzz"}`;
    return `${n}: buzzed at ${Math.min(100, Math.round(it.b * 100))}% · ${OUTCOMES[it.o].toLowerCase()}`;
  };
  return `
    <section class="panel buzz-chart-panel" aria-labelledby="buzz-chart-title">
      <header class="panel-head panel-head-row">
        <div>
          <h2 class="panel-title" id="buzz-chart-title">Where you buzzed</h2>
          <p class="panel-sub">Share of each question heard before you buzzed — shorter bars mean earlier buzzes</p>
        </div>
        <div class="chart-legend">
          <span class="legend-entry"><span class="legend-swatch" data-outcome="c"></span>Correct</span>
          <span class="legend-entry"><span class="legend-swatch" data-outcome="w"></span>Incorrect</span>
          <span class="legend-entry"><span class="legend-swatch" data-outcome="n"></span>No buzz</span>
        </div>
      </header>
      <div class="buzz-chart" style="--n:${items.length}">
        <div class="buzz-chart-grid" aria-hidden="true">
          <span style="bottom:100%"><b>100%</b></span>
          <span style="bottom:50%"><b>50%</b></span>
          <span style="bottom:0"><b>0%</b></span>
        </div>
        <ol class="buzz-chart-cols">
          ${items
            .map(
              (it, i) => `
            <li class="buzz-col" data-outcome="${it.b == null ? "n" : it.o}" title="${esc(describe(it, i))}" aria-label="${esc(describe(it, i))}">
              <span class="buzz-col-bar" style="height:${it.b == null ? 0 : Math.max(3, Math.min(100, it.b * 100))}%"></span>
              <span class="buzz-col-label mono">${(i + 1) % every === 0 || i === 0 ? i + 1 : ""}</span>
            </li>`,
            )
            .join("")}
        </ol>
      </div>
    </section>`;
}

function reviewItem(item, i, record) {
  const q = resolveQuestion(item, record);
  if (!q) return "";
  const diff = DIFFICULTIES.find((d) => d.id === q.diff)?.name;
  const outcome = item.o === "p" ? "n" : item.o;
  const label = item.o === "o" && record.opponent ? `${OPPONENTS[record.opponent].name} scored` : OUTCOMES[item.o];
  const text =
    q.kind === "whoami"
      ? q.clues.map((c, k) => `<span class="clue-inline"><b>${[40, 30, 20, 10][k]}</b> ${esc(c)}</span>`).join(" ")
      : esc(q.text);
  const topic = topicById[q.topic]?.name ?? q.topicName ?? "";

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
          ${topic ? `<span class="tag tag-sm">${esc(topic)}</span>` : ""}
          ${diff ? `<span class="tag tag-sm tag-diff" data-diff="${q.diff}">${diff}</span>` : ""}
          ${item.b != null ? `<span class="buzz-meter" title="Buzzed at ${Math.round(item.b * 100)}% of the question"><span class="buzz-meter-track"><span class="buzz-meter-fill" style="width:${Math.min(100, item.b * 100)}%"></span></span><span class="mono">${Math.min(100, Math.round(item.b * 100))}%</span></span>` : ""}
          ${item.p ? `<span class="review-points mono">+${item.p}</span>` : ""}
        </p>
      </div>
    </li>`;
}
