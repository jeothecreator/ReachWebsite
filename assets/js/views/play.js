// The game screen: Snappers and Who Am I? share the toss-up engine; Lightning Round and
// the Buzzer Room have their own controllers.

import { esc } from "../dom.js";
import { icons } from "../icons.js";
import { msPerWord } from "../store.js";
import { sound } from "../sound.js";
import { speechSupported } from "../speech.js";
import { isCorrect, answerHTML } from "../grader.js";
import { Reader, wordsHTML, wordCount } from "../reader.js";
import { Countdown } from "../countdown.js";
import { OPPONENTS, planOpponent, reboundChance } from "../opponent.js";
import { MODE_NAMES, takePendingSession, clearPendingSession } from "../session.js";
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
  makeItem,
  recordProgress,
} from "./game-common.js";
import { RoomGame } from "./room.js";

const LIGHTNING_VALUE = 10;

export function mountPlay(root) {
  const pending = takePendingSession();
  if (!pending) {
    location.replace("#/practice");
    return;
  }
  clearPendingSession();
  const Game = { lightning: LightningGame, room: RoomGame }[pending.config.mode] ?? TossupGame;
  const game = new Game(root, pending);
  game.start();
  return () => game.destroy();
}

/* ------------------------------------------------------------------ */
/* Snappers & Who Am I?                                                */
/* ------------------------------------------------------------------ */

class TossupGame extends GameBase {
  constructor(root, pending) {
    super(root, pending);
    this.whoami = this.config.mode === "whoami";
    this.opponent = OPPONENTS[this.config.opponent] || null;
    this.oppScore = this.opponent ? 0 : null;
    this.index = -1;
  }

  start() {
    const opp = this.opponent;
    this.root.innerHTML = `
      <section class="play">
        <div class="container play-inner">
          <div class="play-bar">
            <div class="play-bar-left">
              <span class="eyebrow">${MODE_NAMES[this.config.mode]}</span>
              <span class="play-count"><span data-ref="num">1</span><span class="muted"> / ${this.questions.length}</span></span>
            </div>
            <div class="scoreboard">
              <div class="score score-you"><span class="score-label">You</span><span class="score-value" data-ref="you">0</span></div>
              ${opp ? `<span class="score-vs">vs</span><div class="score score-opp"><span class="score-label">${opp.name}</span><span class="score-value" data-ref="opp">0</span></div>` : ""}
            </div>
            <div class="play-bar-right">
              <button class="btn btn-ghost btn-sm" data-action="pause" aria-label="Pause">${icons.pause}<span class="hide-sm">Pause</span></button>
            </div>
          </div>
          <div class="session-track" aria-hidden="true"><div class="session-fill" data-ref="sessionFill"></div></div>
          <article class="q-card" data-ref="card" aria-live="off"></article>
          <div class="console" data-ref="console" aria-live="polite"></div>
          <p class="key-hints hide-touch">
            <span><kbd>Space</kbd> buzz</span>
            <span><kbd>Enter</kbd> ${this.settings.judging === "typed" ? "submit / next" : "reveal / next"}</span>
            ${this.settings.judging === "self" ? `<span><kbd>Y</kbd><kbd>N</kbd> mark</span>` : ""}
            <span><kbd>P</kbd> pause</span>
          </p>
        </div>
        ${pauseLayerHTML()}
      </section>`;
    this.r = refs(this.root);
    this.bind();
    this.nextQuestion();
  }

  /* ---- Question lifecycle ---- */

  nextQuestion() {
    this.clearLater();
    this.reader?.pause();
    this.countdown?.stop();

    this.index += 1;
    if (this.index >= this.questions.length) return this.finish();

    const q = (this.q = this.questions[this.index]);
    this.cur = {
      plan: planOpponent(this.config.opponent, q),
      oppLocked: !this.opponent,
      playerLocked: false,
      buzzAt: null,
      value: this.whoami ? CLUE_VALUES[0] : SNAPPER_VALUE,
      response: "",
      outcome: null,
      points: 0,
      oppPoints: 0,
      rebound: false,
    };

    this.r.num.textContent = this.index + 1;
    this.r.sessionFill.style.transform = `scaleX(${this.index / this.questions.length})`;
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
    this.renderBuzzer();
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

  /** Clue index of the most recently shown word (Who Am I?). */
  clueIndex() {
    const shown = this.reader?.shown ?? 0;
    if (!shown) return 0;
    const el = this.reader.words[shown - 1];
    return Number(el.closest(".clue").dataset.clue);
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
    const plan = this.cur.plan;
    if (plan && !this.cur.oppLocked && plan.at <= 1 && i + 1 >= Math.max(2, Math.round(plan.at * total))) {
      this.opponentBuzz();
    }
  }

  onReadDone() {
    this.setState("window");
    this.renderBuzzer({ window: true });
    const seconds = this.settings.buzzWindow;
    const plan = this.cur.plan;
    const oppDelay =
      plan && !this.cur.oppLocked && plan.at > 1 ? Math.min((plan.at - 1) * seconds * 2.5, seconds - 0.5) : null;

    this.countdown = new Countdown({
      seconds,
      onTick: (remaining, elapsed) => {
        updateTimer(this.r, remaining, seconds);
        if (oppDelay !== null && !this.cur.oppLocked && elapsed >= oppDelay) this.opponentBuzz();
      },
      onDone: () => this.finalize("n"),
    });
    this.countdown.start();
  }

  /* ---- Player buzz ---- */

  buzz() {
    if (!(this.state === "reading" || this.state === "window") || this.cur.playerLocked) return;
    sound.buzz();
    haptic();
    this.reader.pause();
    this.countdown?.stop();

    this.cur.playerLocked = true;
    this.cur.buzzAt = this.reader.shown / this.reader.total;
    this.cur.value = this.currentValue();
    this.markBuzz("buzz-mark");
    this.setState("answering");

    const seconds = this.settings.answerTime;
    const typed = this.settings.judging === "typed";
    this.r.console.innerHTML = typed
      ? `
        <form class="answer-form" data-ref="form" autocomplete="off">
          <label class="sr-only" for="answer-input">Your answer</label>
          <input id="answer-input" class="answer-input" data-ref="input" type="text" autocomplete="off"
            autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Type your answer…" enterkeyhint="send" />
          <button class="btn btn-primary" type="submit">Submit <kbd class="hide-touch">Enter</kbd></button>
        </form>
        ${timerHTML("Time to answer")}`
      : `
        <div class="self-prompt">
          <p class="self-prompt-text">Say your answer out loud.</p>
          <button class="btn btn-primary" data-action="reveal">Reveal answer <kbd class="hide-touch">Enter</kbd></button>
        </div>
        ${timerHTML("Time to answer")}`;
    Object.assign(this.r, refs(this.r.console));

    if (typed) {
      this.r.form.addEventListener("submit", (e) => {
        e.preventDefault();
        this.submit(this.r.input.value);
      });
      this.r.input.focus();
    }

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
      onDone: () => (typed ? this.submit(this.r.input.value) : this.revealSelf()),
    });
    this.lastTick = null;
    this.countdown.start();
  }

  markBuzz(className) {
    const shown = this.reader.shown;
    const mark = `<span class="${className}" aria-hidden="true"></span>`;
    if (shown > 0) this.reader.words[shown - 1].insertAdjacentHTML("afterend", mark);
    else (this.r.text.querySelector(".clue-text") ?? this.r.text).insertAdjacentHTML("afterbegin", mark);
  }

  submit(text) {
    if (this.state !== "answering") return;
    this.countdown.stop();
    this.cur.response = text.trim();
    this.judge(isCorrect(text, this.q.answer, this.q.alts));
  }

  revealSelf() {
    if (this.state !== "answering") return;
    this.countdown.stop();
    this.setState("judging");
    this.reader.revealRest();
    this.r.console.innerHTML = `
      <div class="self-judge">
        <div class="answer-block">
          <p class="answer-line"><span class="label">Answer</span> <span class="answer">${answerHTML(this.q.answer)}</span></p>
          ${acceptHTML(this.q)}
        </div>
        <div class="judge-actions">
          <button class="btn btn-correct" data-action="judge-yes">${icons.check}<span>I got it</span><kbd class="hide-touch">Y</kbd></button>
          <button class="btn btn-wrong" data-action="judge-no">${icons.x}<span>I missed it</span><kbd class="hide-touch">N</kbd></button>
        </div>
      </div>`;
  }

  judge(correct) {
    if (correct) {
      sound.correct();
      this.cur.points = this.cur.value;
      this.score += this.cur.value;
      this.updateScores("you");
      this.finalize("c");
      return;
    }
    sound.wrong();
    if (!this.cur.oppLocked) this.rebound();
    else this.finalize("w");
  }

  /** After a wrong answer the rival hears the rest of the question and may answer. */
  rebound() {
    this.cur.oppLocked = true;
    this.cur.rebound = true;
    this.setState("rebound");
    this.reader.revealRest();
    this.r.console.innerHTML = `
      <div class="status-line is-wrong">${icons.x}<span>Incorrect — <b>${this.opponent.name}</b> gets a chance to answer…</span></div>`;
    this.later(() => {
      if (Math.random() < reboundChance(this.config.opponent, this.q)) {
        const k = this.whoami ? Math.min(this.clueIndex() + 1, CLUE_VALUES.length - 1) : 0;
        const value = this.whoami ? CLUE_VALUES[k] : SNAPPER_VALUE;
        sound.opponent();
        this.cur.oppPoints = value;
        this.oppScore += value;
        this.updateScores("opp");
      }
      this.finalize("w");
    }, 1500);
  }

  /* ---- Rival buzz ---- */

  opponentBuzz() {
    if (this.cur.oppLocked) return;
    this.cur.oppLocked = true;
    this.reader.pause();
    this.countdown?.stop();
    const value = this.currentValue();
    const { correct } = this.cur.plan;
    this.markBuzz("buzz-mark opp");
    sound.opponent();
    this.setState("opp");
    this.r.console.innerHTML = `
      <div class="status-line is-opp"><span class="pulse-dot"></span><span><b>${this.opponent.name}</b> buzzed in…</span></div>`;

    this.later(() => {
      if (correct) {
        this.cur.oppPoints = value;
        this.oppScore += value;
        this.updateScores("opp");
        this.finalize("o");
        return;
      }
      sound.wrong();
      this.r.console.innerHTML = `
        <div class="status-line is-wrong">${icons.x}<span><b>${this.opponent.name}</b> answered incorrectly. Your turn.</span></div>`;
      this.later(() => {
        if (this.reader.done) {
          this.onReadDone();
        } else {
          this.setState("reading");
          this.renderBuzzer();
          this.reader.resume();
        }
      }, 1100);
    }, 1300);
  }

  /* ---- Results ---- */

  finalize(outcome) {
    this.clearLater();
    this.countdown?.stop();
    this.reader.revealRest();
    this.cur.outcome = outcome;
    this.r.readFill.style.transform = "scaleX(1)";

    const item = makeItem(this.q, outcome, this.cur.points);
    if (this.cur.buzzAt !== null) item.b = Math.round(this.cur.buzzAt * 1000) / 1000;
    if (this.cur.response) item.r = this.cur.response.slice(0, 80);
    if (this.cur.oppPoints) item.op = this.cur.oppPoints;
    this.items.push(item);
    recordProgress(this.q, outcome === "c");

    this.r.sessionFill.style.transform = `scaleX(${(this.index + 1) / this.questions.length})`;
    this.setState("result");
    this.resultShownAt = performance.now();
    this.renderResult();
  }

  renderResult() {
    const q = this.q;
    const cur = this.cur;
    const outcome = cur.outcome;
    const opp = this.opponent?.name;
    const last = this.index === this.questions.length - 1;
    this.r.card.dataset.outcome = outcome;

    const verdict = {
      c: [icons.check, "Correct", `+${cur.points}`],
      w: [icons.x, "Incorrect", cur.oppPoints ? `${opp} +${cur.oppPoints}` : "+0"],
      n: [icons.minus, "No buzz", "+0"],
      o: [icons.flag, `${opp} got it`, `${opp} +${cur.oppPoints}`],
    }[outcome];

    let detail = "";
    if (cur.buzzAt !== null) {
      const where = Math.round(cur.buzzAt * 100);
      detail = `Buzzed ${where >= 100 ? "after the question ended" : `at ${where}% of the question`}`;
      if (this.whoami) detail += ` · clue ${CLUE_VALUES.indexOf(cur.value) + 1} for ${cur.value}`;
    }
    if (outcome === "w" && cur.rebound)
      detail += `${detail ? " · " : ""}${opp} ${cur.oppPoints ? "scored the rebound" : "missed the rebound"}`;

    const typed = this.settings.judging === "typed";
    const canOverride = typed && (outcome === "c" || (outcome === "w" && cur.buzzAt !== null));

    this.r.console.innerHTML = `
      <div class="result" data-outcome="${outcome}">
        <div class="result-head">
          <span class="verdict">${verdict[0]}<span>${verdict[1]}</span></span>
          <span class="result-points">${esc(verdict[2])}</span>
        </div>
        <div class="answer-block">
          <p class="answer-line"><span class="label">Answer</span> <span class="answer">${answerHTML(q.answer)}</span></p>
          ${acceptHTML(q)}
          ${cur.response ? `<p class="your-answer"><span class="label">You said</span> “${esc(cur.response)}”</p>` : ""}
          ${detail ? `<p class="result-detail">${esc(detail)}</p>` : ""}
        </div>
        <div class="result-actions">
          ${canOverride ? `<button class="btn btn-ghost btn-sm" data-action="override">${outcome === "c" ? "Actually, I was wrong" : "I was right — count it"}</button>` : "<span></span>"}
          <button class="btn btn-primary" data-action="next">${last ? "See results" : "Next question"} <kbd class="hide-touch">Space</kbd></button>
        </div>
      </div>`;
  }

  override() {
    const item = this.items[this.items.length - 1];
    const cur = this.cur;
    if (item.o === "w") {
      item.o = "c";
      cur.outcome = "c";
      cur.points = item.p = cur.value;
      this.score += cur.value;
      if (cur.oppPoints) {
        // The rival would never have had the rebound.
        this.oppScore -= cur.oppPoints;
        cur.oppPoints = 0;
        delete item.op;
        cur.rebound = false;
      }
      recordProgress(this.q, true, true);
    } else if (item.o === "c") {
      item.o = "w";
      cur.outcome = "w";
      this.score -= cur.points;
      cur.points = item.p = 0;
      recordProgress(this.q, false, true);
    }
    this.updateScores("you", "opp");
    this.renderResult();
  }

  /* ---- Rendering helpers ---- */

  renderBuzzer({ window = false } = {}) {
    this.r.console.innerHTML = `
      <div class="buzz-row">
        <button class="buzzer" data-action="buzz" aria-label="Buzz in">
          <span class="buzzer-light" aria-hidden="true"></span>
          <span class="buzzer-label">Buzz</span>
          <kbd class="hide-touch">Space</kbd>
        </button>
      </div>
      ${window ? timerHTML("Time to buzz") : `<p class="console-hint">Listen closely — buzz as soon as you know it.</p>`}`;
    Object.assign(this.r, refs(this.r.console));
    if (!window) {
      delete this.r.timerFill;
      delete this.r.timerSecs;
    }
  }

  updateScores(...who) {
    if (who.includes("you")) {
      this.r.you.textContent = this.score;
      bump(this.r.you);
    }
    if (who.includes("opp") && this.r.opp) {
      this.r.opp.textContent = this.oppScore;
      bump(this.r.opp);
    }
  }

  /* ---- Input ---- */

  action(name) {
    switch (name) {
      case "buzz":
        return this.buzz();
      case "reveal":
        return this.revealSelf();
      case "judge-yes":
        return this.state === "judging" && this.judge(true);
      case "judge-no":
        return this.state === "judging" && this.judge(false);
      case "next":
        return this.state === "result" && this.nextQuestion();
      case "override":
        return this.state === "result" && this.override();
      case "pause":
        return this.pause();
      case "resume":
        return this.resume();
      case "quit":
        return this.finish();
    }
  }

  key(event) {
    const k = event.key;
    if (k === " " || k === "Enter") {
      event.preventDefault();
      if (event.repeat) return;
      if (k === " " && (this.state === "reading" || this.state === "window")) return this.buzz();
      if (this.state === "answering") {
        return this.settings.judging === "self" ? this.revealSelf() : this.r.input?.focus();
      }
      if (this.state === "result" && performance.now() - this.resultShownAt > 350) return this.nextQuestion();
      return;
    }
    const lower = k.toLowerCase();
    if (lower === "y" && this.state === "judging") this.judge(true);
    else if (lower === "n" && this.state === "judging") this.judge(false);
    else if (lower === "p") this.state === "paused" ? this.resume() : this.pause();
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
    if (this.pausedFrom === "answering") this.r.input?.focus();
  }
}

/* ------------------------------------------------------------------ */
/* Lightning Round                                                     */
/* ------------------------------------------------------------------ */

class LightningGame extends GameBase {
  constructor(root, pending) {
    super(root, pending);
    this.duration = this.config.duration;
    this.index = -1;
    this.typed = this.settings.judging === "typed";
  }

  start() {
    this.root.innerHTML = `
      <section class="play is-lightning">
        <div class="container play-inner">
          <div class="play-bar">
            <div class="play-bar-left">
              <span class="eyebrow">Lightning Round</span>
              <span class="play-count">Question <span data-ref="num">1</span></span>
            </div>
            <div class="lightning-clock" data-ref="clock" role="timer" aria-label="Time remaining">${clockText(this.duration)}</div>
            <div class="play-bar-right">
              <div class="scoreboard">
                <div class="score score-you"><span class="score-label">Score</span><span class="score-value" data-ref="you">0</span></div>
              </div>
              <button class="btn btn-ghost btn-sm" data-action="pause" aria-label="Pause">${icons.pause}</button>
            </div>
          </div>
          <div class="session-track" aria-hidden="true"><div class="session-fill" data-ref="sessionFill" style="transform:scaleX(1)"></div></div>
          <article class="q-card" data-ref="card"></article>
          <div class="console" data-ref="console" aria-live="polite"></div>
          <ol class="lightning-feed" data-ref="feed" aria-label="Recent answers"></ol>
        </div>
        ${pauseLayerHTML()}
        <div class="ready-layer" data-ref="ready">
          <p class="eyebrow">Lightning Round · ${this.duration} seconds</p>
          <div class="ready-count" data-ref="readyCount">3</div>
          <p class="muted">${this.typed ? "Type each answer and press Enter. Press Enter on a blank answer to pass." : "Answer out loud, reveal, then mark yourself."}</p>
        </div>
      </section>`;
    this.r = refs(this.root);
    this.bind();
    this.setState("ready");
    this.r.card.innerHTML = `<p class="q-text is-placeholder">Get ready…</p>`;

    let n = 3;
    sound.tick();
    const step = () => {
      n -= 1;
      if (n > 0) {
        this.r.readyCount.textContent = n;
        bump(this.r.readyCount);
        sound.tick();
        this.later(step, 800);
      } else {
        this.r.ready.remove();
        this.begin();
      }
    };
    this.later(step, 800);
  }

  begin() {
    sound.buzz();
    this.clock = new Countdown({
      seconds: this.duration,
      onTick: (remaining) => {
        this.r.clock.textContent = clockText(Math.ceil(remaining));
        this.r.sessionFill.style.transform = `scaleX(${remaining / this.duration})`;
        const whole = Math.ceil(remaining);
        this.r.clock.classList.toggle("is-low", whole <= 10);
        if (whole <= 5 && whole !== this.lastTick) {
          this.lastTick = whole;
          sound.tick();
        }
      },
      onDone: () => this.timeUp(),
    });
    this.clock.start();
    this.nextQuestion();
  }

  nextQuestion() {
    this.index += 1;
    if (this.index >= this.questions.length) return this.timeUp();
    const q = (this.q = this.questions[this.index]);
    this.r.num.textContent = this.index + 1;
    this.r.card.dataset.outcome = "";
    this.r.card.innerHTML = `
      <header class="q-head">${tagsHTML(q)}<span class="q-worth">${LIGHTNING_VALUE} pts</span></header>
      <p class="q-text is-instant">${esc(q.text)}</p>`;
    this.setState("asking");

    if (this.typed) {
      if (!this.r.form) {
        this.r.console.innerHTML = `
          <form class="answer-form" data-ref="form" autocomplete="off">
            <label class="sr-only" for="lightning-input">Your answer</label>
            <input id="lightning-input" class="answer-input" data-ref="input" type="text" autocomplete="off"
              autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Answer, or Enter to pass" enterkeyhint="send" />
            <button class="btn btn-primary" type="submit">Submit <kbd class="hide-touch">Enter</kbd></button>
          </form>`;
        Object.assign(this.r, refs(this.r.console));
        this.r.form.addEventListener("submit", (e) => {
          e.preventDefault();
          this.submit(this.r.input.value);
        });
      }
      this.r.input.value = "";
      this.r.input.focus();
    } else {
      this.r.console.innerHTML = `
        <div class="self-prompt">
          <p class="self-prompt-text">Answer out loud, then reveal.</p>
          <div class="judge-actions">
            <button class="btn btn-ghost" data-action="pass">Pass</button>
            <button class="btn btn-primary" data-action="reveal">Reveal <kbd class="hide-touch">Space</kbd></button>
          </div>
        </div>`;
    }
  }

  submit(text) {
    if (this.state !== "asking") return;
    const response = text.trim();
    if (!response) return this.record("p");
    const ok = isCorrect(response, this.q.answer, this.q.alts);
    this.record(ok ? "c" : "w", response);
  }

  reveal() {
    if (this.state !== "asking") return;
    this.setState("judging");
    this.r.console.innerHTML = `
      <div class="self-judge">
        <div class="answer-block">
          <p class="answer-line"><span class="label">Answer</span> <span class="answer">${answerHTML(this.q.answer)}</span></p>
        </div>
        <div class="judge-actions">
          <button class="btn btn-correct" data-action="judge-yes">${icons.check}<span>Got it</span><kbd class="hide-touch">Y</kbd></button>
          <button class="btn btn-wrong" data-action="judge-no">${icons.x}<span>Missed</span><kbd class="hide-touch">N</kbd></button>
        </div>
      </div>`;
  }

  record(outcome, response = "") {
    const q = this.q;
    const item = makeItem(q, outcome, outcome === "c" ? LIGHTNING_VALUE : 0);
    if (response) item.r = response.slice(0, 80);
    this.items.push(item);
    if (outcome !== "p") recordProgress(q, outcome === "c");

    if (outcome === "c") {
      this.score += LIGHTNING_VALUE;
      this.r.you.textContent = this.score;
      bump(this.r.you);
      sound.correct();
    } else if (outcome === "w") {
      sound.wrong();
    }
    this.addFeed(item, q);
    this.nextQuestion();
  }

  addFeed(item, q) {
    const label = { c: "Correct", w: "Incorrect", p: "Passed" }[item.o];
    const icon = { c: icons.check, w: icons.x, p: icons.minus }[item.o];
    const li = document.createElement("li");
    li.className = "feed-item";
    li.dataset.outcome = item.o;
    li.innerHTML = `
      <span class="feed-icon" title="${label}">${icon}</span>
      <span class="feed-body">
        <span class="feed-answer">${answerHTML(q.answer)}</span>
        ${item.o === "w" ? `<span class="feed-said">you said “${esc(item.r)}”</span>` : ""}
      </span>
      ${item.o === "w" && this.typed ? `<button class="btn btn-ghost btn-xs" data-action="count-it">Count it</button>` : ""}`;
    li.querySelector("[data-action=count-it]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (item.o !== "w") return;
      item.o = "c";
      item.p = LIGHTNING_VALUE;
      recordProgress(q, true, true);
      this.score += LIGHTNING_VALUE;
      this.r.you.textContent = this.score;
      li.dataset.outcome = "c";
      li.querySelector(".feed-icon").innerHTML = icons.check;
      li.querySelector(".feed-said")?.remove();
      e.currentTarget.remove();
      this.r.input?.focus();
    });
    this.r.feed.prepend(li);
    while (this.r.feed.children.length > 4) this.r.feed.lastElementChild.remove();
  }

  timeUp() {
    if (this.state === "over") return;
    this.clock?.stop();
    this.setState("over");
    sound.end();
    this.r.console.innerHTML = `<div class="status-line">${icons.clock}<span>Time! Tallying your round…</span></div>`;
    this.r.input?.blur();
    this.later(() => this.finish(), 1200);
  }

  action(name) {
    switch (name) {
      case "reveal":
        return this.reveal();
      case "pass":
        return this.state === "asking" && this.record("p");
      case "judge-yes":
        return this.state === "judging" && this.record("c");
      case "judge-no":
        return this.state === "judging" && this.record("w");
      case "pause":
        return this.pause();
      case "resume":
        return this.resume();
      case "quit":
        return this.finish();
    }
  }

  key(event) {
    const k = event.key.toLowerCase();
    if (k === " " || k === "enter") {
      if (this.state === "asking" && !this.typed) {
        event.preventDefault();
        this.reveal();
      }
      return;
    }
    if (k === "y" && this.state === "judging") this.record("c");
    else if (k === "n" && this.state === "judging") this.record("w");
    else if (k === "p") this.state === "paused" ? this.resume() : this.pause();
  }

  pause() {
    if (!["asking", "judging"].includes(this.state)) return;
    this.pausedFrom = this.state;
    this.clock.pause();
    this.setState("paused");
    this.showPause(true);
  }

  resume() {
    if (this.state !== "paused") return;
    this.showPause(false);
    this.setState(this.pausedFrom);
    this.clock.resume();
    this.r.input?.focus();
  }
}

function clockText(seconds) {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
