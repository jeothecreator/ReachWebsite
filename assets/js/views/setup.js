// Practice setup: choose a format, topics, difficulty and options, then start.

import { $, $$, esc, fmt } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { segmented } from "../ui.js";
import { speechSupported } from "../speech.js";
import { TOPICS, GROUPS, DIFFICULTIES, filterQuestions, countByTopic, countByDifficulty } from "../bank.js";
import { OPPONENTS } from "../opponent.js";
import { beginSession, MODE_NAMES } from "../session.js";
import { DEFAULT_TEAMS, RESERVED_KEYS } from "./room.js";

const MODES = [
  {
    id: "snappers",
    icon: icons.bolt,
    blurb: "Open toss-ups read word by word. Buzz in the moment you know it.",
    meta: "10 pts each",
  },
  {
    id: "whoami",
    icon: icons.person,
    blurb: "Four clues, hardest first. The earlier you buzz, the more it’s worth.",
    meta: "40 · 30 · 20 · 10",
  },
  {
    id: "lightning",
    icon: icons.clock,
    blurb: "Answer as many as you can before the clock runs out.",
    meta: "Against the clock",
  },
  {
    id: "room",
    icon: icons.users,
    blurb: "Two to four teams on one screen, each with its own buzzer key. A moderator marks answers.",
    meta: "Team practice",
  },
];

const COUNT_OPTIONS = { snappers: [10, 20, 30, 50], whoami: [5, 10, 15, 20] };
const DURATIONS = [30, 60, 90, 120];

/** Which question type a config draws from (the Buzzer Room can use either). */
const questionKind = (cfg) => (cfg.mode === "room" ? cfg.roomSet : cfg.mode);
const defaultCount = (kind) => (kind === "whoami" ? 10 : 20);

export function mountSetup(root, { query }) {
  // Start from the saved config, then apply any deep-link (#/practice?mode=whoami&topic=bio).
  const cfg = {
    ...store.config,
    topics: store.config.topics ? [...store.config.topics] : null,
    teams: (store.config.teams ?? DEFAULT_TEAMS.slice(0, 2)).map((t) => ({ ...t })),
  };
  const mode = query.get("mode");
  if (MODE_NAMES[mode]) cfg.mode = mode;
  const topic = query.get("topic");
  if (topic && TOPICS.some((t) => t.id === topic)) cfg.topics = [topic];
  normaliseCount();

  function normaliseCount() {
    const kind = questionKind(cfg);
    if (COUNT_OPTIONS[kind] && !COUNT_OPTIONS[kind].includes(cfg.count)) cfg.count = defaultCount(kind);
  }

  root.innerHTML = `
    <section class="page setup">
      <div class="container">
        <header class="page-head">
          <p class="eyebrow">Practice</p>
          <h1 class="page-title">Set up your round</h1>
          <p class="page-lede">Pick a format, choose what to study, and press <kbd>Space</kbd> to buzz.</p>
        </header>

        <div class="setup-grid">
          <form class="setup-form" data-ref="form" novalidate>
            <fieldset class="setup-section">
              <legend class="section-label"><span class="step">1</span>Format</legend>
              <div class="mode-picker">
                ${MODES.map(
                  (m) => `
                  <label class="mode-option">
                    <input type="radio" name="mode" value="${m.id}" ${cfg.mode === m.id ? "checked" : ""} />
                    <span class="mode-card">
                      <span class="mode-icon">${m.icon}</span>
                      <span class="mode-name">${MODE_NAMES[m.id]}</span>
                      <span class="mode-blurb">${m.blurb}</span>
                      <span class="mode-meta">${m.meta}</span>
                    </span>
                  </label>`,
                ).join("")}
              </div>
            </fieldset>

            <fieldset class="setup-section">
              <legend class="section-label"><span class="step">2</span>Topics</legend>
              <div class="section-tools">
                <button type="button" class="link-btn" data-action="all-topics">Select all</button>
                <span class="divider-dot" aria-hidden="true"></span>
                <button type="button" class="link-btn" data-action="no-topics">Clear</button>
              </div>
              <div class="topic-groups" data-ref="topics"></div>
            </fieldset>

            <fieldset class="setup-section">
              <legend class="section-label"><span class="step">3</span>Difficulty</legend>
              <div class="diff-picker" data-ref="diffs"></div>
            </fieldset>

            <fieldset class="setup-section">
              <legend class="section-label"><span class="step">4</span>Options</legend>
              <div class="option-list" data-ref="options"></div>
            </fieldset>
          </form>

          <aside class="setup-summary" aria-live="polite">
            <div class="summary-card" data-ref="summary"></div>
          </aside>
        </div>
      </div>
    </section>`;

  const form = $("[data-ref=form]", root);
  const topicsEl = $("[data-ref=topics]", root);
  const diffsEl = $("[data-ref=diffs]", root);
  const optionsEl = $("[data-ref=options]", root);
  const summaryEl = $("[data-ref=summary]", root);

  const selectedTopics = () => cfg.topics ?? TOPICS.map((t) => t.id);
  const isRoom = () => cfg.mode === "room";
  // Personal question pools (unseen / missed) don't apply to a shared room.
  const filterCfg = () => ({ ...cfg, pool: isRoom() ? "all" : cfg.pool });

  function renderTopics() {
    const counts = countByTopic(filterCfg());
    const selected = new Set(selectedTopics());
    topicsEl.innerHTML = GROUPS.map((group) => {
      const topics = TOPICS.filter((t) => t.group === group);
      if (!topics.length) return "";
      return `
        <div class="topic-group">
          <p class="topic-group-name">${esc(group)}</p>
          <div class="chip-row">
            ${topics
              .map(
                (t) => `
              <label class="chip ${counts[t.id] ? "" : "is-empty"}">
                <input type="checkbox" name="topic" value="${t.id}" ${selected.has(t.id) ? "checked" : ""} />
                <span class="chip-face">
                  <span class="chip-check" aria-hidden="true">${icons.check}</span>
                  <span>${esc(t.name)}</span>
                  <span class="chip-count">${counts[t.id]}</span>
                </span>
              </label>`,
              )
              .join("")}
          </div>
        </div>`;
    }).join("");
  }

  function renderDiffs() {
    const counts = countByDifficulty({ ...filterCfg(), topics: selectedTopics() });
    diffsEl.innerHTML = DIFFICULTIES.map(
      (d) => `
      <label class="diff-option">
        <input type="checkbox" name="diff" value="${d.id}" ${cfg.diffs.includes(d.id) ? "checked" : ""} />
        <span class="diff-card" data-diff="${d.id}">
          <span class="diff-bars" aria-hidden="true">${[1, 2, 3].map((n) => `<i class="${n <= d.id ? "on" : ""}"></i>`).join("")}</span>
          <span class="diff-name">${d.name}</span>
          <span class="diff-hint">${d.hint} · ${fmt(counts[d.id])}</span>
        </span>
      </label>`,
    ).join("");
  }

  function teamRows() {
    return `
      <div class="team-editor">
        ${cfg.teams
          .map(
            (t, i) => `
          <div class="team-edit-row" data-team="${i}">
            <span class="team-swatch" aria-hidden="true"></span>
            <label class="sr-only" for="team-name-${i}">Team ${i + 1} name</label>
            <input class="text-input" id="team-name-${i}" name="team-name" data-index="${i}" maxlength="20" value="${esc(t.name)}" autocomplete="off" />
            <label class="key-input-label" for="team-key-${i}">Key</label>
            <input class="text-input key-input" id="team-key-${i}" name="team-key" data-index="${i}" maxlength="1" value="${esc(t.key.toUpperCase())}" autocomplete="off" autocapitalize="characters" spellcheck="false" />
          </div>`,
          )
          .join("")}
      </div>`;
  }

  function renderOptions() {
    const rows = [];
    const kind = questionKind(cfg);
    if (cfg.mode === "lightning") {
      rows.push(
        optionRow(
          "Round length",
          segmented({
            name: "duration",
            label: "Round length",
            value: cfg.duration,
            options: DURATIONS.map((n) => ({ value: n, label: `${n}s` })),
          }),
        ),
      );
    }

    if (isRoom()) {
      rows.push(
        optionRow(
          "Teams",
          segmented({
            name: "team-count",
            label: "Number of teams",
            value: cfg.teams.length,
            options: [2, 3, 4].map((n) => ({ value: n, label: String(n) })),
          }) + teamRows(),
          "Each team presses its own key to buzz. On a phone or tablet, tap the team pads instead.",
        ),
        optionRow(
          "Question type",
          segmented({
            name: "roomSet",
            label: "Question type",
            value: cfg.roomSet,
            options: [
              { value: "snappers", label: "Snappers" },
              { value: "whoami", label: "Who Am I?" },
            ],
          }),
        ),
      );
    }

    if (cfg.mode !== "lightning") {
      rows.push(
        optionRow(
          "Questions",
          segmented({
            name: "count",
            label: "Number of questions",
            value: cfg.count,
            options: COUNT_OPTIONS[kind].map((n) => ({ value: n, label: String(n) })),
          }),
        ),
      );
    }

    if (!isRoom() && cfg.mode !== "lightning") {
      rows.push(
        optionRow(
          "Opponent",
          segmented({
            name: "opponent",
            label: "Opponent",
            value: cfg.opponent,
            options: [
              { value: "off", label: "Solo" },
              ...["rookie", "contender", "champion"].map((id) => ({ value: id, label: OPPONENTS[id].name })),
            ],
          }),
          cfg.opponent !== "off"
            ? OPPONENTS[cfg.opponent].blurb + " Wrong answers give the rival a rebound."
            : "Practise on your own.",
        ),
      );
    }

    if (cfg.mode !== "lightning") {
      rows.push(
        optionRow(
          "Read aloud",
          segmented({
            name: "voice",
            label: "Read questions aloud",
            value: store.settings.voice && speechSupported ? "on" : "off",
            options: [
              { value: "off", label: "Off" },
              { value: "on", label: "Moderator voice" },
            ],
          }),
          speechSupported
            ? "Questions are spoken as they appear. Choose a voice in Settings."
            : "Your browser doesn’t support speech, so questions are shown as text only.",
        ),
      );
    }

    if (!isRoom()) {
      rows.push(
        optionRow(
          "Questions from",
          segmented({
            name: "pool",
            label: "Question pool",
            value: cfg.pool,
            options: [
              { value: "all", label: "All" },
              { value: "unseen", label: "Unseen" },
              { value: "missed", label: "Missed" },
            ],
          }),
          {
            all: "Everything that matches your filters.",
            unseen: "Only questions you haven’t played yet.",
            missed: "Questions you got wrong or didn’t answer last time.",
          }[cfg.pool],
        ),
        optionRow(
          "Answering",
          segmented({
            name: "judging",
            label: "Answering",
            value: store.settings.judging,
            options: [
              { value: "typed", label: "Type" },
              { value: "self", label: "Self-mark" },
            ],
          }),
          store.settings.judging === "typed"
            ? "Answers are marked automatically. Small typos are forgiven."
            : "Answer out loud, reveal, and mark yourself.",
        ),
      );
    }
    optionsEl.innerHTML = rows.join("");
    if (!speechSupported) $$("input[name=voice]", optionsEl).forEach((i) => (i.disabled = true));
  }

  /** Problems with the team setup, or "" if it's fine. */
  function teamProblem() {
    const keys = cfg.teams.map((t) => t.key);
    if (cfg.teams.some((t) => !t.name.trim())) return "Give every team a name.";
    if (keys.some((k) => !/^[a-z0-9]$/.test(k))) return "Each team needs a letter or number key.";
    if (keys.some((k) => RESERVED_KEYS.has(k))) return "Y, N and P are moderator keys — pick different team keys.";
    if (new Set(keys).size !== keys.length) return "Each team needs a different key.";
    return "";
  }

  function renderSummary() {
    const available = filterQuestions({ ...filterCfg(), topics: selectedTopics() }).length;
    const lightning = cfg.mode === "lightning";
    const playing = lightning ? available : Math.min(cfg.count, available);
    const topicLabel =
      cfg.topics === null || cfg.topics.length === TOPICS.length
        ? "All topics"
        : cfg.topics.length === 1
          ? TOPICS.find((t) => t.id === cfg.topics[0]).name
          : `${cfg.topics.length} topics`;
    const diffLabel =
      cfg.diffs.length === 3
        ? "All levels"
        : DIFFICULTIES.filter((d) => cfg.diffs.includes(d.id))
            .map((d) => d.name)
            .join(" + ") || "None";
    const problem = !cfg.diffs.length
      ? "Choose at least one difficulty."
      : cfg.topics?.length === 0
        ? "Choose at least one topic."
        : isRoom() && teamProblem()
          ? teamProblem()
          : !available
            ? cfg.pool === "missed" && !isRoom()
              ? "No missed questions here yet — nice work."
              : cfg.pool === "unseen" && !isRoom()
                ? "You’ve seen every question that matches."
                : "No questions match these filters."
            : "";

    const lastRow = isRoom()
      ? `<div><dt>Teams</dt><dd>${cfg.teams.length}</dd></div>`
      : lightning
        ? ""
        : `<div><dt>Opponent</dt><dd>${cfg.opponent === "off" ? "Solo" : OPPONENTS[cfg.opponent].name}</dd></div>`;

    summaryEl.innerHTML = `
      <p class="eyebrow">Your round</p>
      <p class="summary-mode">${MODE_NAMES[cfg.mode]}</p>
      <dl class="summary-list">
        <div><dt>Topics</dt><dd>${esc(topicLabel)}</dd></div>
        <div><dt>Level</dt><dd>${esc(diffLabel)}</dd></div>
        <div><dt>${lightning ? "Length" : "Questions"}</dt><dd>${lightning ? `${cfg.duration} seconds` : fmt(playing)}</dd></div>
        ${lastRow}
      </dl>
      <p class="summary-available"><span class="mono">${fmt(available)}</span> matching question${available === 1 ? "" : "s"}</p>
      ${problem ? `<p class="summary-problem">${esc(problem)}</p>` : ""}
      <button class="btn btn-primary btn-lg btn-block" data-action="start" ${problem ? "disabled" : ""}>
        ${isRoom() ? "Start match" : lightning ? "Start round" : "Start practising"} ${icons.arrowRight}
      </button>
      <p class="summary-keys hide-touch">${
        isRoom()
          ? `Team keys buzz <span class="divider-dot"></span> <kbd>Y</kbd><kbd>N</kbd> mark`
          : `<kbd>Space</kbd> buzz <span class="divider-dot"></span> <kbd>Enter</kbd> submit <span class="divider-dot"></span> <kbd>P</kbd> pause`
      }</p>`;
  }

  function optionRow(label, control, hint = "") {
    return `
      <div class="option-row">
        <span class="option-label">${esc(label)}</span>
        <div class="option-control">${control}${hint ? `<p class="option-hint">${esc(hint)}</p>` : ""}</div>
      </div>`;
  }

  function save() {
    store.updateConfig({ ...cfg, teams: cfg.teams.map((t) => ({ ...t })) });
  }

  function refresh({ topics = true, diffs = true, options = true } = {}) {
    // Re-rendering replaces inputs, so remember which one had keyboard focus.
    const active = document.activeElement;
    const focus = active?.name ? `input[name="${active.name}"][value="${active.value}"]` : null;
    if (topics) renderTopics();
    if (diffs) renderDiffs();
    if (options) renderOptions();
    renderSummary();
    if (focus && !root.contains(active)) $(focus, root)?.focus();
  }

  // Team names and keys update as you type, without re-rendering the inputs.
  form.addEventListener("input", (event) => {
    const el = event.target;
    const i = Number(el.dataset.index);
    if (el.name === "team-name") {
      cfg.teams[i].name = el.value;
    } else if (el.name === "team-key") {
      const key = el.value.slice(-1).toLowerCase();
      el.value = key.toUpperCase();
      cfg.teams[i].key = key;
    } else {
      return;
    }
    renderSummary();
    save();
  });

  form.addEventListener("change", (event) => {
    const el = event.target;
    switch (el.name) {
      case "mode":
        cfg.mode = el.value;
        normaliseCount();
        refresh();
        break;
      case "topic": {
        const checked = $$("input[name=topic]:checked", form).map((i) => i.value);
        cfg.topics = checked.length === TOPICS.length ? null : checked;
        refresh({ topics: false, options: false });
        break;
      }
      case "diff":
        cfg.diffs = $$("input[name=diff]:checked", form).map((i) => Number(i.value));
        refresh({ diffs: false, options: false });
        break;
      case "count":
      case "duration":
        cfg[el.name] = Number(el.value);
        renderSummary();
        break;
      case "opponent":
      case "pool":
        cfg[el.name] = el.value;
        refresh();
        break;
      case "roomSet":
        cfg.roomSet = el.value;
        normaliseCount();
        refresh();
        break;
      case "team-count": {
        const n = Number(el.value);
        const used = new Set(cfg.teams.map((t) => t.key));
        while (cfg.teams.length < n) {
          const next = DEFAULT_TEAMS.find((t, i) => i >= cfg.teams.length && !used.has(t.key)) ??
            DEFAULT_TEAMS.find((t) => !used.has(t.key));
          cfg.teams.push({ ...next });
          used.add(next.key);
        }
        cfg.teams.length = n;
        refresh({ topics: false, diffs: false });
        break;
      }
      case "voice":
        store.updateSettings({ voice: el.value === "on" });
        break;
      case "judging":
        store.updateSettings({ judging: el.value });
        refresh({ topics: false, diffs: false });
        break;
      default:
        return;
    }
    save();
  });

  root.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-action]");
    if (!btn) return;
    if (btn.dataset.action === "all-topics") {
      cfg.topics = null;
      refresh({ options: false });
      save();
    } else if (btn.dataset.action === "no-topics") {
      cfg.topics = [];
      refresh({ options: false });
      save();
    } else if (btn.dataset.action === "start") {
      save();
      const topics = selectedTopics().length === TOPICS.length ? null : selectedTopics();
      beginSession({ ...filterCfg(), topics, teams: cfg.teams.map((t) => ({ ...t })) });
    }
  });

  refresh();
}
