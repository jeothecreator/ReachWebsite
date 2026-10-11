// Buzzer Room: 2–4 teams share one device. Each team has its own buzzer key (or a pad on
// touch screens). The first team to buzz answers out loud; the moderator marks it, and a
// wrong answer opens the question to the remaining teams. Room games aren't saved to stats.

import { esc } from "../dom.js";
import { icons } from "../icons.js";
import { msPerWord } from "../store.js";
import { sound } from "../sound.js";
import { speechSupported } from "../speech.js";
import { answerHTML } from "../grader.js";
import { Reader, wordsHTML, wordCount } from "../reader.js";
import { Countdown } from "../countdown.js";
import { confetti } from "../confetti.js";
import { beginSession } from "../session.js";
import {
  CLUE_VALUES,
  SNAPPER_VALUE,
  GameBase,
  tagsHTML,
  acceptHTML,
  pauseLayerHTML,
  timerHTML,
  refs,
  updateTimer,
  bump,
  haptic,
} from "./game-common.js";

export const DEFAULT_TEAMS = [
  { name: "Team A", key: "a" },
  { name: "Team B", key: "l" },
  { name: "Team C", key: "z" },
  { name: "Team D", key: "m" },
];

/** Keys the moderator uses, so teams can't be assigned them. */
export const RESERVED_KEYS = new Set([" ", "enter", "escape", "y", "n", "p", "?"]);

export class RoomGame extends GameBase {
  constructor(root, pending) {
    super(root, pending);
    this.whoami = this.config.roomSet === "whoami";
    this.teams = this.config.teams.map((t, i) => ({ name: t.name, key: t.key.toLowerCase(), score: 0, index: i }));
    this.index = -1;
  }

  // Team games don't count toward anyone's personal stats.
  persist() {
    return null;
  }

  start() {
    const n = this.teams.length;
    this.root.innerHTML = `
      <section class="play is-room">
        <div class="container play-inner">
          <div class="play-bar">
            <div class="play-bar-left">
              <span class="eyebrow">Buzzer Room · ${this.whoami ? "Who Am I?" : "Snappers"}</span>
              <span class="play-count"><span data-ref="num">1</span><span class="muted"> / ${this.questions.length}</span></span>
            </div>
            <div class="play-bar-right">
              <button class="btn btn-ghost btn-sm" data-action="pause" aria-label="Pause">${icons.pause}<span class="hide-sm">Pause</span></button>
            </div>
          </div>
          <div class="session-track" aria-hidden="true"><div class="session-fill" data-ref="sessionFill"></div></div>
          <div class="team-board" data-count="${n}">
            ${this.teams
              .map(
                (t, i) => `
              <div class="team-tile" data-team="${i}" data-ref="tile${i}">
                <span class="team-swatch" aria-hidden="true"></span>
                <span class="team-name">${esc(t.name)}</span>
                <kbd class="hide-touch">${esc(t.key.toUpperCase())}</kbd>
                <span class="team-score" data-ref="score${i}">0</span>
              </div>`,
              )
              .join("")}
          </div>
          <article class="q-card" data-ref="card" aria-live="off"></article>
          <div class="console" data-ref="console" aria-live="polite"></div>
          <div class="team-pads" data-count="${n}" data-ref="pads">
            ${this.teams
              .map(
                (t, i) => `
              <button class="team-pad" data-action="team-buzz" data-team="${i}" aria-label="Buzz for ${esc(t.name)}">
                <span class="team-pad-name">${esc(t.name)}</span>
                <kbd class="hide-touch">${esc(t.key.toUpperCase())}</kbd>
              </button>`,
              )
              .join("")}
          </div>
          <p class="key-hints hide-touch">
            <span>Team keys buzz</span>
            <span><kbd>Y</kbd><kbd>N</kbd> moderator marks</span>
            <span><kbd>Enter</kbd> next</span>
            <span><kbd>Esc</kbd> pause</span>
          </p>
        </div>
        ${pauseLayerHTML("Esc")}
      </section>`;
    this.r = refs(this.root);
    this.bind();
    // Pads buzz the moment a finger lands. Waiting for click would favour whoever lifts first,
    // and two overlapping touches would produce no click at all.
    this.padPointerAt = -Infinity;
    this.r.pads.addEventListener("pointerdown", (event) => {
      const pad = event.target.closest(".team-pad");
      if (!pad || pad.disabled || event.button > 0) return;
      event.preventDefault();
      this.padPointerAt = performance.now();
      sound.unlock();
      this.teamBuzz(Number(pad.dataset.team));
    });
    this.nextQuestion();
  }

  /* ---- Question lifecycle ---- */

  nextQuestion() {
    this.clearLater();
    this.reader?.pause();
    this.countdown?.stop();

    this.index += 1;
    if (this.index >= this.questions.length) return this.showStandings();

    const q = (this.q = this.questions[this.index]);
    this.cur = { locked: new Set(), team: null, value: this.whoami ? CLUE_VALUES[0] : SNAPPER_VALUE, winner: null };
    this.r.num.textContent = this.index + 1;
    this.r.sessionFill.style.transform = `scaleX(${this.index / this.questions.length})`;
    this.teams.forEach((_, i) => this.tileState(i, ""));
    this.renderCard();

    const breaks = new Set();
    if (this.whoami) {
      let offset = 0;
      for (const clue of q.clues.slice(0, -1)) {
        offset += wordCount(clue);
        breaks.add(offset - 1);
      }
    }
    this.reader = new Reader(this.r.text, {
      msPerWord: msPerWord(this.settings.speed),
      breaks,
      voice: this.settings.voice && speechSupported,
      onWord: (i, total) => this.onWord(i, total),
      onDone: () => this.onReadDone(),
    });
    this.setState("reading");
    this.renderOpen();
    this.reader.start();
  }

  renderCard() {
    const q = this.q;
    let body;
    if (this.whoami) {
      let offset = 0;
      body = `<ol class="clues" data-ref="text">${q.clues
        .map((clue, k) => {
          const html = wordsHTML(clue, offset);
          offset += wordCount(clue);
          return `<li class="clue" data-clue="${k}"><span class="clue-value">${CLUE_VALUES[k]}</span><p class="clue-text">${html}</p></li>`;
        })
        .join("")}</ol>`;
    } else {
      body = `<p class="q-text" data-ref="text">${wordsHTML(q.text)}</p>`;
    }
    this.r.card.dataset.outcome = "";
    this.r.card.dataset.team = "";
    this.r.card.innerHTML = `
      <header class="q-head">
        ${tagsHTML(q)}
        <span class="q-worth"><span data-ref="worth">${this.cur.value}</span> pts</span>
      </header>
      ${body}
      <div class="read-track" aria-hidden="true"><div class="read-fill" data-ref="readFill"></div></div>`;
    Object.assign(this.r, refs(this.r.card));
    if (this.whoami) this.highlightClue(0);
  }

  highlightClue(k) {
    this.r.card.querySelectorAll(".clue").forEach((li, i) => {
      li.classList.toggle("is-active", i === k);
      li.classList.toggle("is-past", i < k);
    });
  }

  clueIndex() {
    const shown = this.reader?.shown ?? 0;
    if (!shown) return 0;
    return Number(this.reader.words[shown - 1].closest(".clue").dataset.clue);
  }

  currentValue() {
    return this.whoami ? CLUE_VALUES[this.clueIndex()] : SNAPPER_VALUE;
  }

  onWord(i, total) {
    this.r.readFill.style.transform = `scaleX(${(i + 1) / total})`;
    if (this.whoami) {
      const k = this.clueIndex();
      this.highlightClue(k);
      if (Number(this.r.worth.textContent) !== CLUE_VALUES[k]) {
        this.r.worth.textContent = CLUE_VALUES[k];
        bump(this.r.worth.parentElement);
      }
    }
  }

  onReadDone() {
    this.setState("window");
    this.renderOpen({ window: true });
    const seconds = this.settings.buzzWindow;
    this.countdown = new Countdown({
      seconds,
      onTick: (remaining) => updateTimer(this.r, remaining, seconds),
      onDone: () => this.finalize(null),
    });
    this.countdown.start();
  }

  /* ---- Buzzing and marking ---- */

  teamBuzz(i) {
    if (!(this.state === "reading" || this.state === "window")) return;
    if (!this.teams[i] || this.cur.locked.has(i)) return;
    sound.buzz();
    haptic();
    this.reader.pause();
    this.countdown?.stop();

    const team = this.teams[i];
    this.cur.team = i;
    this.cur.value = this.currentValue();
    this.markBuzz(i);
    this.setState("answering");
    this.r.card.dataset.team = String(i);
    this.tileState(i, "buzzed");
    bump(this.r[`tile${i}`]);

    const seconds = this.settings.answerTime;
    this.r.console.innerHTML = `
      <div class="room-answer" data-team="${i}">
        <div class="room-answer-head">
          <span class="team-chip" data-team="${i}">${esc(team.name)}</span>
          <span class="room-answer-prompt">Answer now — ${this.cur.value} points</span>
        </div>
        <div class="moderator">
          <p class="moderator-label">Moderator <span class="muted">· hover or tap to see the answer</span></p>
          <button class="moderator-answer" data-action="peek" aria-label="Show answer to moderator">
            <span class="answer">${answerHTML(this.q.answer)}</span>
          </button>
        </div>
        <div class="judge-actions">
          <button class="btn btn-correct" data-action="judge-yes">${icons.check}<span>Correct</span><kbd class="hide-touch">Y</kbd></button>
          <button class="btn btn-wrong" data-action="judge-no">${icons.x}<span>Incorrect</span><kbd class="hide-touch">N</kbd></button>
        </div>
        ${timerHTML("Time to answer")}
      </div>`;
    Object.assign(this.r, refs(this.r.console));
    this.countdown = new Countdown({
      seconds,
      onTick: (remaining) => {
        updateTimer(this.r, remaining, seconds);
        const whole = Math.ceil(remaining);
        if (whole <= 3 && whole !== this.lastTick) {
          this.lastTick = whole;
          sound.tick();
        }
      },
      // Time's up: the moderator still decides, but the clock stops nagging.
      onDone: () => this.r.timerSecs && (this.r.timerSecs.textContent = "Time"),
    });
    this.lastTick = null;
    this.countdown.start();
  }

  markBuzz(i) {
    const shown = this.reader.shown;
    const mark = `<span class="buzz-mark" data-team="${i}" aria-hidden="true"></span>`;
    if (shown > 0) this.reader.words[shown - 1].insertAdjacentHTML("afterend", mark);
    else (this.r.text.querySelector(".clue-text") ?? this.r.text).insertAdjacentHTML("afterbegin", mark);
  }

  judge(correct) {
    if (this.state !== "answering") return;
    this.countdown?.stop();
    const i = this.cur.team;
    if (correct) {
      sound.correct();
      this.teams[i].score += this.cur.value;
      this.r[`score${i}`].textContent = this.teams[i].score;
      bump(this.r[`score${i}`]);
      this.finalize(i);
      return;
    }

    sound.wrong();
    this.cur.locked.add(i);
    this.tileState(i, "locked");
    this.r.card.dataset.team = "";
    if (this.cur.locked.size >= this.teams.length) return this.finalize(null);

    const others = this.teams.filter((t) => !this.cur.locked.has(t.index)).map((t) => esc(t.name));
    this.setState("rebound");
    this.r.console.innerHTML = `
      <div class="status-line is-wrong">${icons.x}<span>Incorrect. ${others.join(", ")} may buzz in.</span></div>`;
    this.later(() => {
      if (this.reader.done) {
        this.onReadDone();
      } else {
        this.setState("reading");
        this.renderOpen();
        this.reader.resume();
      }
    }, 1000);
  }

  finalize(winner) {
    this.clearLater();
    this.countdown?.stop();
    this.reader.revealRest();
    this.cur.winner = winner;
    this.r.readFill.style.transform = "scaleX(1)";
    this.r.sessionFill.style.transform = `scaleX(${(this.index + 1) / this.questions.length})`;
    this.r.card.dataset.outcome = winner === null ? "n" : "c";
    this.r.card.dataset.team = winner === null ? "" : String(winner);
    if (winner !== null) this.tileState(winner, "scored");
    this.setState("result");
    this.resultShownAt = performance.now();

    const last = this.index === this.questions.length - 1;
    const team = winner === null ? null : this.teams[winner];
    this.r.console.innerHTML = `
      <div class="result" data-outcome="${winner === null ? "n" : "c"}">
        <div class="result-head">
          <span class="verdict">${winner === null ? icons.minus : icons.check}<span>${team ? `${esc(team.name)} scores` : "No one got it"}</span></span>
          <span class="result-points">${team ? `+${this.cur.value}` : "+0"}</span>
        </div>
        <div class="answer-block">
          <p class="answer-line"><span class="label">Answer</span> <span class="answer">${answerHTML(this.q.answer)}</span></p>
          ${acceptHTML(this.q)}
        </div>
        <div class="result-actions">
          <span></span>
          <button class="btn btn-primary" data-action="next">${last ? "Final standings" : "Next question"} <kbd class="hide-touch">Enter</kbd></button>
        </div>
      </div>`;
  }

  showStandings() {
    this.teardownTimers();
    this.setState("over");
    const ranked = [...this.teams].sort((a, b) => b.score - a.score);
    const top = ranked[0].score;
    const winners = ranked.filter((t) => t.score === top);
    const headline =
      top === 0 ? "No points this time." : winners.length > 1 ? "It's a tie!" : `${winners[0].name} wins!`;

    this.r.card.dataset.outcome = "";
    this.r.card.dataset.team = winners.length === 1 && top > 0 ? String(winners[0].index) : "";
    this.r.card.innerHTML = `
      <div class="standings">
        <p class="eyebrow">Final standings</p>
        <h2 class="standings-title">${esc(headline)}</h2>
        <ol class="standings-list">
          ${ranked
            .map(
              (t, place) => `
            <li class="standings-row" data-team="${t.index}">
              <span class="standings-place mono">${place + 1}</span>
              <span class="team-swatch" aria-hidden="true"></span>
              <span class="standings-name">${esc(t.name)}</span>
              <span class="standings-score">${t.score}</span>
            </li>`,
            )
            .join("")}
        </ol>
      </div>`;
    this.r.console.innerHTML = `
      <div class="standings-actions">
        <button class="btn btn-primary btn-lg" data-action="again">${icons.rotate}<span>Play again</span></button>
        <a class="btn btn-secondary btn-lg" href="#/practice?mode=room">Change setup</a>
      </div>`;
    this.r.pads.hidden = true;
    this.r.sessionFill.style.transform = "scaleX(1)";
    if (top > 0) {
      sound.end();
      confetti();
    }
  }

  tileState(i, state) {
    const tile = this.r[`tile${i}`];
    if (tile) tile.dataset.state = state;
    const pad = this.r.pads?.querySelector(`[data-team="${i}"]`);
    if (pad) {
      pad.dataset.state = state;
      pad.disabled = state === "locked";
    }
  }

  renderOpen({ window = false } = {}) {
    const open = this.teams.filter((t) => !this.cur.locked.has(t.index));
    this.r.console.innerHTML = `
      <div class="status-line room-open">
        <span class="room-open-dots" aria-hidden="true">${open.map((t) => `<i data-team="${t.index}"></i>`).join("")}</span>
        <span>${window ? "Last chance — buzz now" : "Teams, buzz in when you know it"}</span>
      </div>
      ${window ? timerHTML("Time to buzz") : ""}`;
    Object.assign(this.r, refs(this.r.console));
    if (!window) {
      delete this.r.timerFill;
      delete this.r.timerSecs;
    }
  }

  /* ---- Input ---- */

  action(name, btn) {
    switch (name) {
      case "team-buzz":
        // Pointer presses were handled on pointerdown; this covers keyboard and assistive-tech clicks.
        if (performance.now() - this.padPointerAt < 1000) return;
        return this.teamBuzz(Number(btn.dataset.team));
      case "peek":
        return btn.classList.toggle("is-revealed");
      case "judge-yes":
        return this.judge(true);
      case "judge-no":
        return this.judge(false);
      case "next":
        return this.state === "result" && this.nextQuestion();
      case "again":
        return beginSession({ ...this.config });
      case "pause":
        return this.pause();
      case "resume":
        return this.resume();
      case "quit":
        this.showPause(false);
        return this.showStandings();
    }
  }

  key(event) {
    const k = event.key.toLowerCase();
    if (k === "enter" || k === " ") {
      event.preventDefault();
      if (event.repeat) return;
      if (this.state === "result" && performance.now() - this.resultShownAt > 350) this.nextQuestion();
      return;
    }
    if (this.state === "answering" && (k === "y" || k === "n")) return this.judge(k === "y");
    if (k === "p") return this.state === "paused" ? this.resume() : this.pause();
    const team = this.teams.findIndex((t) => t.key === k);
    if (team !== -1 && !event.repeat) {
      event.preventDefault();
      const pad = this.r.pads.querySelector(`[data-team="${team}"]`);
      pad?.classList.add("is-pressed");
      setTimeout(() => pad?.classList.remove("is-pressed"), 160);
      this.teamBuzz(team);
    }
  }

  pause() {
    if (!["reading", "window", "answering"].includes(this.state)) return;
    this.pausedFrom = this.state;
    if (this.state === "reading") this.reader.pause();
    else this.countdown?.pause();
    this.setState("paused");
    this.showPause(true);
  }

  resume() {
    if (this.state !== "paused") return;
    this.showPause(false);
    this.setState(this.pausedFrom);
    if (this.pausedFrom === "reading") this.reader.resume();
    else this.countdown?.resume();
  }
}
