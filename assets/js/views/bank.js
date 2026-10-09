// Browsable, searchable question bank with a printable packet view.

import { $, esc, fmt, shuffle } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { answerHTML, answerText } from "../grader.js";
import { QUESTIONS, TOPICS, GROUPS, DIFFICULTIES, topicById, counts } from "../bank.js";

const PAGE = 40;

// Kept at module level so filters survive navigating away and back.
const view = {
  search: "",
  topic: "all",
  diff: "all",
  kind: "all",
  status: "all",
  reveal: false,
  order: null,
  limit: PAGE,
};

const fold = (s) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

const searchIndex = new Map(
  QUESTIONS.map((q) => [q.id, fold(`${q.text} ${answerText(q.answer)} ${q.alts.join(" ")}`)]),
);

function statusOf(q) {
  const p = store.progress[q.id];
  if (!p) return "unseen";
  return p[2] ? "correct" : "missed";
}

function filtered() {
  const terms = fold(view.search).split(/\s+/).filter(Boolean);
  const list = (view.order ?? QUESTIONS).filter((q) => {
    if (view.topic !== "all" && q.topic !== view.topic) return false;
    if (view.diff !== "all" && q.diff !== Number(view.diff)) return false;
    if (view.kind !== "all" && q.kind !== view.kind) return false;
    if (view.status !== "all" && statusOf(q) !== view.status) return false;
    if (terms.length) {
      const hay = searchIndex.get(q.id);
      if (!terms.every((t) => hay.includes(t))) return false;
    }
    return true;
  });
  return list;
}

function select(name, label, value, options) {
  return `
    <label class="select">
      <span class="sr-only">${label}</span>
      <select name="${name}" aria-label="${label}">
        ${options.map((o) => `<option value="${o.value}" ${String(o.value) === String(value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select>
    </label>`;
}

export function mountBank(root) {
  const topicOptions = [{ value: "all", label: "All topics" }];
  for (const group of GROUPS) {
    for (const t of TOPICS.filter((x) => x.group === group)) topicOptions.push({ value: t.id, label: t.name });
  }

  root.innerHTML = `
    <section class="page bank">
      <div class="container">
        <header class="page-head page-head-row">
          <div>
            <p class="eyebrow">Question bank</p>
            <h1 class="page-title">${fmt(counts.total)} questions, all original</h1>
            <p class="page-lede">Search and filter the full bank, study answers, or print a packet for team practice.</p>
          </div>
        </header>

        <div class="toolbar" role="search">
          <label class="search">
            ${icons.search}
            <span class="sr-only">Search questions</span>
            <input type="search" name="search" placeholder="Search questions and answers…" value="${esc(view.search)}" autocomplete="off" />
          </label>
          <div class="toolbar-filters">
            ${select("topic", "Topic", view.topic, topicOptions)}
            ${select("diff", "Level", view.diff, [{ value: "all", label: "All levels" }, ...DIFFICULTIES.map((d) => ({ value: d.id, label: d.name }))])}
            ${select("kind", "Format", view.kind, [
              { value: "all", label: "All formats" },
              { value: "snapper", label: "Snappers" },
              { value: "whoami", label: "Who Am I?" },
            ])}
            ${select("status", "Your progress", view.status, [
              { value: "all", label: "Any progress" },
              { value: "unseen", label: "Unseen" },
              { value: "correct", label: "Got right" },
              { value: "missed", label: "Missed" },
            ])}
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-ghost btn-sm" data-action="reveal" aria-pressed="${view.reveal}">${view.reveal ? icons.eyeOff : icons.eye}<span>${view.reveal ? "Hide answers" : "Show answers"}</span></button>
            <button class="btn btn-ghost btn-sm" data-action="shuffle">${icons.shuffle}<span>${view.order ? "Unshuffle" : "Shuffle"}</span></button>
            <button class="btn btn-ghost btn-sm" data-action="print">${icons.printer}<span>Print</span></button>
          </div>
        </div>

        <p class="result-count" data-ref="count" aria-live="polite"></p>
        <ol class="bank-list" data-ref="list"></ol>
        <div class="bank-more" data-ref="more"></div>

        <div class="print-head" aria-hidden="true">
          <p class="print-title">Summit · Practice packet</p>
          <p class="print-sub" data-ref="printSub"></p>
        </div>
      </div>
    </section>`;

  const listEl = $("[data-ref=list]", root);
  const countEl = $("[data-ref=count]", root);
  const moreEl = $("[data-ref=more]", root);

  function render() {
    const items = filtered();
    const shown = items.slice(0, view.limit);
    countEl.textContent = items.length
      ? `Showing ${fmt(shown.length)} of ${fmt(items.length)} question${items.length === 1 ? "" : "s"}`
      : "";
    listEl.classList.toggle("reveal-all", view.reveal);
    listEl.innerHTML = shown.length
      ? shown.map((q, i) => itemHTML(q, i)).join("")
      : `<li class="empty-row"><p>No questions match. Try a broader search or clear a filter.</p></li>`;
    moreEl.innerHTML =
      items.length > shown.length
        ? `<button class="btn btn-secondary" data-action="more">Show ${fmt(Math.min(PAGE, items.length - shown.length))} more</button>`
        : "";

    const parts = [
      view.topic === "all" ? "All topics" : topicById[view.topic].name,
      view.diff === "all" ? "All levels" : DIFFICULTIES.find((d) => d.id === Number(view.diff)).name,
      `${shown.length} questions`,
      new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }),
    ];
    $("[data-ref=printSub]", root).textContent = parts.join(" · ");
  }

  function itemHTML(q, i) {
    const diff = DIFFICULTIES.find((d) => d.id === q.diff).name;
    const status = statusOf(q);
    const body =
      q.kind === "whoami"
        ? `<ol class="bank-clues">${q.clues.map((c, k) => `<li><span class="clue-pts">${[40, 30, 20, 10][k]}</span>${esc(c)}</li>`).join("")}</ol>`
        : `<p class="bank-q">${esc(q.text)}</p>`;
    return `
      <li class="bank-item" data-id="${q.id}">
        <span class="bank-num mono">${i + 1}</span>
        <div class="bank-body">
          <div class="bank-meta">
            <span class="tag tag-sm">${esc(topicById[q.topic]?.name ?? "")}</span>
            <span class="tag tag-sm tag-diff" data-diff="${q.diff}">${diff}</span>
            ${q.kind === "whoami" ? `<span class="tag tag-sm tag-outline">Who Am I?</span>` : ""}
            ${status !== "unseen" ? `<span class="status-dot" data-status="${status}" title="${status === "correct" ? "You got this right last time" : "You missed this last time"}"></span>` : ""}
          </div>
          ${body}
          <div class="bank-answer">
            <button class="answer-toggle" data-action="toggle" aria-expanded="false">Show answer</button>
            <p class="bank-a"><span class="label">Answer</span> ${answerHTML(q.answer)}${q.alts.length ? `<span class="bank-alts"> · also ${q.alts.map(answerHTML).join(", ")}</span>` : ""}</p>
          </div>
        </div>
      </li>`;
  }

  let searchTimer;
  root.addEventListener("input", (event) => {
    if (event.target.name !== "search") return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      view.search = event.target.value;
      view.limit = PAGE;
      render();
    }, 120);
  });

  root.addEventListener("change", (event) => {
    const { name, value } = event.target;
    if (!["topic", "diff", "kind", "status"].includes(name)) return;
    view[name] = value;
    view.limit = PAGE;
    render();
  });

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    switch (btn.dataset.action) {
      case "toggle": {
        const item = btn.closest(".bank-item");
        const open = item.classList.toggle("is-open");
        btn.setAttribute("aria-expanded", open);
        btn.textContent = open ? "Hide answer" : "Show answer";
        break;
      }
      case "reveal":
        view.reveal = !view.reveal;
        btn.setAttribute("aria-pressed", view.reveal);
        btn.innerHTML = `${view.reveal ? icons.eyeOff : icons.eye}<span>${view.reveal ? "Hide answers" : "Show answers"}</span>`;
        render();
        break;
      case "shuffle":
        view.order = view.order ? null : shuffle(QUESTIONS);
        btn.innerHTML = `${icons.shuffle}<span>${view.order ? "Unshuffle" : "Shuffle"}</span>`;
        render();
        break;
      case "more":
        view.limit += PAGE;
        render();
        break;
      case "print":
        window.print();
        break;
    }
  });

  render();
}
