// Word-by-word question reader. Words are rendered up front (invisible) so the text
// never reflows as it appears; the reader just switches them on at a natural pace.
// With the moderator voice on, words appear as the voice reaches them.

import { esc } from "./dom.js";
import { speak, speechRate } from "./speech.js";

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
   * @param {boolean} [opts.voice]  read the text aloud
   */
  constructor(root, { msPerWord, breaks = new Set(), onWord = () => {}, onDone = () => {}, voice = false }) {
    this.words = [...root.querySelectorAll(".w")];
    this.ms = msPerWord;
    this.breaks = breaks;
    this.onWord = onWord;
    this.onDone = onDone;
    this.voice = voice;
    this.rate = speechRate(60000 / msPerWord);
    this.shown = 0;
    this.timer = null;
    this.guard = null;
    this.speech = null;
    this.generation = 0;
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
    if (this.voice) this.speakFrom(this.shown);
    else this.schedule(180);
  }

  schedule(delay) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.step(), delay);
  }

  revealNext() {
    const el = this.words[this.shown];
    el.classList.add("on");
    const index = this.shown;
    this.shown += 1;
    this.onWord(index, this.words.length);
    return el;
  }

  step() {
    if (!this.running) return;
    if (this.done) {
      this.running = false;
      this.onDone();
      return;
    }
    const index = this.shown;
    const el = this.revealNext();
    if (!this.running) return; // onWord may have paused us (e.g. opponent buzz)

    const base = this.voice ? 60000 / (175 * this.rate) : this.ms;
    let delay = base * pauseFactor(el.textContent);
    if (this.breaks.has(index) && !this.voice) delay += 900;
    this.schedule(this.done ? Math.min(delay, 350) : delay);
  }

  /** Read aloud from word `from`, revealing words as the voice reaches them. */
  speakFrom(from) {
    const generation = ++this.generation;
    const words = this.words.slice(from).map((w) => w.textContent);
    const starts = [];
    let pos = 0;
    for (const w of words) {
      starts.push(pos);
      pos += w.length + 1;
    }

    // Voices that never report word boundaries fall back to timed reveal.
    let timing = "waiting";
    const fallbackAfter = (ms) => {
      clearTimeout(this.guard);
      this.guard = setTimeout(() => {
        if (generation !== this.generation || !this.running || timing !== "waiting") return;
        timing = "timer";
        this.schedule(0);
      }, ms);
    };
    fallbackAfter(1600);

    this.speech = speak(words.join(" "), {
      rate: this.rate,
      onStart: () => generation === this.generation && fallbackAfter(700),
      onBoundary: (charIndex) => {
        if (generation !== this.generation || !this.running || timing === "timer") return;
        timing = "boundary";
        clearTimeout(this.guard);
        let k = 0;
        while (k + 1 < starts.length && starts[k + 1] <= charIndex) k += 1;
        const target = Math.min(from + k + 1, this.words.length);
        while (this.running && this.shown < target) this.revealNext();
      },
      onEnd: () => {
        if (generation !== this.generation || !this.running) return;
        clearTimeout(this.guard);
        if (timing !== "timer") {
          // Reveal anything the voice skipped, then finish.
          timing = "timer";
          this.schedule(0);
        }
      },
    });

    if (!this.speech) {
      clearTimeout(this.guard);
      this.schedule(180);
    }
  }

  stopVoice() {
    clearTimeout(this.guard);
    if (this.speech) {
      this.generation += 1;
      this.speech.cancel();
      this.speech = null;
    }
  }

  pause() {
    this.running = false;
    clearTimeout(this.timer);
    this.stopVoice();
  }

  /** Continue reading. If every word is already shown, this just fires onDone. */
  resume() {
    if (this.running) return;
    this.running = true;
    if (this.voice && !this.done) this.speakFrom(this.shown);
    else this.schedule(this.done ? 250 : this.ms);
  }

  /** Reveal any unread words with a class so they can be styled differently. */
  revealRest(className = "rest") {
    this.pause();
    for (let i = this.shown; i < this.words.length; i++) this.words[i].classList.add("on", className);
  }
}
