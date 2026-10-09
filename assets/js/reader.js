// Word-by-word question reader. Words are rendered up front (invisible) so the text
// never reflows as it appears; the reader just switches them on at a natural pace.

import { esc } from "./dom.js";

// Split on ordinary whitespace only, so non-breaking spaces ("25 °C") keep words together.
const WORD_BREAK = /[ \t\r\n]+/;

/** Render text as hidden word spans. `offset` keeps indices unique across clues. */
export function wordsHTML(text, offset = 0) {
  return text
    .split(WORD_BREAK)
    .filter(Boolean)
    .map((word, i) => `<span class="w" data-i="${offset + i}">${esc(word)}</span>`)
    .join(" ");
}

export const wordCount = (text) => text.split(WORD_BREAK).filter(Boolean).length;

function pauseFactor(word) {
  if (/[.?!]["”’)]?$/.test(word)) return 2.1;
  if (/[,;:—–]["”’)]?$/.test(word)) return 1.55;
  return word.length > 9 ? 1.2 : 1;
}

export class Reader {
  /**
   * @param {HTMLElement} root   element containing the `.w` spans
   * @param {object} opts
   * @param {number} opts.msPerWord
   * @param {Set<number>} [opts.breaks]  word indices followed by a longer pause (between clues)
   * @param {(index: number, total: number) => void} [opts.onWord]  called after each word appears
   * @param {() => void} [opts.onDone]
   */
  constructor(root, { msPerWord, breaks = new Set(), onWord = () => {}, onDone = () => {} }) {
    this.words = [...root.querySelectorAll(".w")];
    this.ms = msPerWord;
    this.breaks = breaks;
    this.onWord = onWord;
    this.onDone = onDone;
    this.shown = 0;
    this.timer = null;
    this.running = false;
  }

  get total() {
    return this.words.length;
  }

  get done() {
    return this.shown >= this.words.length;
  }

  start() {
    this.running = true;
    this.schedule(180);
  }

  schedule(delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.step(), delay);
  }

  step() {
    if (!this.running) return;
    if (this.done) {
      this.running = false;
      this.onDone();
      return;
    }
    const el = this.words[this.shown];
    el.classList.add("on");
    const index = this.shown;
    this.shown += 1;
    this.onWord(index, this.words.length);
    if (!this.running) return; // onWord may have paused us (e.g. opponent buzz)

    let delay = this.ms * pauseFactor(el.textContent);
    if (this.breaks.has(index)) delay += 900;
    this.schedule(this.done ? Math.min(delay, 350) : delay);
  }

  pause() {
    this.running = false;
    clearTimeout(this.timer);
  }

  /** Continue reading. If every word is already shown, this just fires onDone. */
  resume() {
    if (this.running) return;
    this.running = true;
    this.schedule(this.done ? 250 : this.ms);
  }

  /** Reveal any unread words with a class so they can be styled differently. */
  revealRest(className = "rest") {
    this.pause();
    for (let i = this.shown; i < this.words.length; i++) this.words[i].classList.add("on", className);
  }
}
