// Moderator voice: reads questions aloud with the browser's built-in speech synthesis.

import { store } from "./store.js";

const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
export const speechSupported = Boolean(synth && typeof window.SpeechSynthesisUtterance === "function");

let voices = [];
const loadVoices = () => (voices = synth ? synth.getVoices() : []);
if (speechSupported) {
  loadVoices();
  synth.addEventListener?.("voiceschanged", loadVoices);
}

const LANG_PREFERENCE = ["en-CA", "en-GB", "en-US", "en-AU", "en-IE", "en-NZ"];

/** English voices, Canadian first, then other common accents. */
export function englishVoices() {
  const rank = (v) => {
    const i = LANG_PREFERENCE.indexOf(v.lang.replace("_", "-"));
    return (i === -1 ? LANG_PREFERENCE.length : i) * 2 + (v.localService ? 0 : 1);
  };
  return voices.filter((v) => /^en([-_]|$)/i.test(v.lang)).sort((a, b) => rank(a) - rank(b));
}

function pickVoice(name) {
  const list = englishVoices();
  return list.find((v) => v.name === name) ?? list[0] ?? null;
}

/** Speech rate that roughly matches the reading-speed setting (words per minute). */
export const speechRate = (wpm) => Math.min(2, Math.max(0.6, wpm / 175));

/**
 * Speak `text`. Callbacks only fire until the returned handle is cancelled.
 * onBoundary receives the character index of each word as it is spoken (not every voice reports this).
 */
export function speak(text, { rate = 1, onStart, onBoundary, onEnd } = {}) {
  if (!speechSupported || !text) return null;
  let active = true;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(store.settings.voiceName);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-CA";
  }
  utterance.rate = rate;
  utterance.volume = Math.min(1, 0.35 + store.settings.volume);
  utterance.onstart = () => active && onStart?.();
  utterance.onboundary = (e) => {
    if (active && (e.name === undefined || e.name === "word")) onBoundary?.(e.charIndex);
  };
  const finish = (failed) => {
    if (!active) return;
    active = false;
    onEnd?.(failed);
  };
  utterance.onend = () => finish(false);
  utterance.onerror = () => finish(true);

  synth.cancel();
  // Some engines drop an utterance queued in the same tick as cancel().
  setTimeout(() => active && synth.speak(utterance), 40);

  return {
    cancel() {
      active = false;
      synth.cancel();
    },
  };
}

/** iOS only allows speech that starts from a tap: call this inside a click handler before playing. */
export function primeSpeech() {
  if (!speechSupported || !store.settings.voice) return;
  const silent = new SpeechSynthesisUtterance(" ");
  silent.volume = 0;
  synth.speak(silent);
}

export function stopSpeaking() {
  if (speechSupported) synth.cancel();
}
