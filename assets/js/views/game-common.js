// Pieces shared by every game screen: markup helpers and the GameBase class
// (timers, keyboard wiring, pause and teardown).

import { esc, isTyping } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { sound } from "../sound.js";
import { answerHTML } from "../grader.js";
import { topicById, DIFFICULTIES } from "../bank.js";
import { saveSession } from "../session.js";

export const CLUE_VALUES = [40, 30, 20, 10];
export const SNAPPER_VALUE = 10;

const diffName = (d) => DIFFICULTIES.find((x) => x.id === d)?.name ?? "";

export function tagsHTML(q) {
  const topic = topicById[q.topic]?.name ?? q.topicName ?? q.topic;
  return `
    <div class="q-tags">
      <span class="tag">${esc(topic)}</span>
      ${q.diff ? `<span class="tag tag-diff" data-diff="${q.diff}">${diffName(q.diff)}</span>` : ""}
    </div>`;
}

export function acceptHTML(q) {
  if (!q.alts?.length) return "";
  return `<p class="accept"><span class="label">Also accept</span> ${q.alts.map(answerHTML).join(", ")}</p>`;
}

export function pauseLayerHTML(resumeKey = "P") {
  return `
    <div class="pause-layer" data-ref="pause" hidden>
      <div class="pause-panel" role="dialog" aria-modal="true" aria-labelledby="pause-title">
        <p class="eyebrow">Paused</p>
        <h2 id="pause-title" class="pause-title">Take a breath.</h2>
        <div class="pause-actions">
          <button class="btn btn-primary" data-action="resume">${icons.play}<span>Resume</span><kbd>${resumeKey}</kbd></button>
          <button class="btn btn-ghost" data-action="quit">End session</button>
        </div>
      </div>
    </div>`;
}

export function timerHTML(label) {
  return `
    <div class="timer" role="timer">
      <div class="timer-meta"><span>${label}</span><span class="timer-secs" data-ref="timerSecs"></span></div>
      <div class="timer-track"><div class="timer-fill" data-ref="timerFill"></div></div>
    </div>`;
}

/** Collect every [data-ref] element under root into an object. */
export function refs(root) {
  const out = {};
  root.querySelectorAll("[data-ref]").forEach((el) => (out[el.dataset.ref] = el));
  return out;
}

export function updateTimer(r, remaining, total) {
  if (!r.timerFill) return;
  r.timerFill.style.transform = `scaleX(${Math.max(0, remaining / total)})`;
  r.timerSecs.textContent = `${Math.ceil(remaining)}s`;
  r.timerFill.classList.toggle("is-low", remaining <= Math.min(3, total * 0.35));
}

export function bump(el) {
  if (!el) return;
  el.classList.remove("bump");
  void el.offsetWidth; // restart the animation
  el.classList.add("bump");
}

/** A short vibration on phones that support it. */
export const haptic = (ms = 25) => navigator.vibrate?.(ms);

/** History item for one question; custom-packet questions carry their own text. */
export function makeItem(q, outcome, points) {
  const item = { q: q.id, o: outcome, p: points };
  if (q.custom) {
    item.t = q.text;
    item.a = q.answer;
  }
  return item;
}

/** Progress is only tracked for questions from the built-in bank. */
export function recordProgress(q, correct, amend = false) {
  if (q.custom) return;
  if (amend) store.amendAttempt(q.id, correct);
  else store.recordAttempt(q.id, correct);
}

/** Base class: timers, keyboard wiring, pause and teardown. */
export class GameBase {
  constructor(root, { config, questions }) {
    this.root = root;
    this.config = config;
    this.questions = questions;
    this.settings = store.settings;
    this.items = [];
    this.score = 0;
    this.state = "idle";
    this.saved = false;
    this.timeouts = new Set();
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onVisibility = () => document.hidden && this.pause();
    this.onPageHide = () => this.persist();
    this.onClick = this.onClick.bind(this);
  }

  later(fn, ms) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
  }

  clearLater() {
    this.timeouts.forEach(clearTimeout);
    this.timeouts.clear();
  }

  bind() {
    document.addEventListener("keydown", this.onKeyDown);
    document.addEventListener("visibilitychange", this.onVisibility);
    window.addEventListener("pagehide", this.onPageHide);
    this.root.addEventListener("click", this.onClick);
  }

  setState(state) {
    this.state = state;
    this.r.card.dataset.state = state;
  }

  onClick(event) {
    const btn = event.target.closest("[data-action]");
    if (!btn || !this.root.contains(btn)) return;
    if (event.detail > 0) btn.blur(); // mouse clicks shouldn't leave focus where Space would re-trigger it
    sound.unlock();
    this.action(btn.dataset.action, btn);
  }

  onKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      this.state === "paused" ? this.resume() : this.pause();
      return;
    }
    if (isTyping(event)) return;
    sound.unlock();
    this.key(event);
  }

  showPause(show) {
    this.r.pause.hidden = !show;
    this.root.querySelector(".play").classList.toggle("is-paused", show);
    if (show) this.r.pause.querySelector("[data-action=resume]").focus();
  }

  /** Save whatever has been played so far (once). */
  persist() {
    if (this.saved || !this.items.length) return null;
    this.saved = true;
    return saveSession({
      config: this.config,
      items: this.items,
      score: this.score,
      oppScore: this.oppScore ?? null,
      duration: this.config.mode === "lightning" ? this.config.duration : null,
      complete: this.items.length >= this.questions.length,
    });
  }

  finish() {
    this.teardownTimers();
    const record = this.persist();
    location.hash = record ? `#/results/${record.id}` : "#/practice";
  }

  destroy() {
    this.teardownTimers();
    this.persist();
    document.removeEventListener("keydown", this.onKeyDown);
    document.removeEventListener("visibilitychange", this.onVisibility);
    window.removeEventListener("pagehide", this.onPageHide);
    this.root.removeEventListener("click", this.onClick);
  }

  teardownTimers() {
    this.clearLater();
    this.reader?.pause();
    this.countdown?.stop();
    this.clock?.stop();
  }
}
