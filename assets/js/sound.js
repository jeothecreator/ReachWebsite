// Synthesised sound effects (Web Audio API) — no audio files to download.

import { store } from "./store.js";

let ctx = null;

function audio() {
  if (!ctx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone({ freq, to, type = "sine", start = 0, dur = 0.15, gain = 0.25 }) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + start;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  const peak = gain * store.settings.volume;
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const play = (fn) => () => {
  if (store.settings.sound && store.settings.volume > 0) fn();
};

export const sound = {
  buzz: play(() => {
    tone({ freq: 392, type: "square", dur: 0.26, gain: 0.11 });
    tone({ freq: 523.25, type: "square", dur: 0.26, gain: 0.08 });
  }),
  correct: play(() => {
    tone({ freq: 659.25, dur: 0.14, gain: 0.22 });
    tone({ freq: 987.77, start: 0.1, dur: 0.24, gain: 0.2 });
  }),
  wrong: play(() => {
    tone({ freq: 233, to: 155, type: "triangle", dur: 0.34, gain: 0.28 });
  }),
  opponent: play(() => {
    tone({ freq: 311, type: "sawtooth", dur: 0.22, gain: 0.07 });
    tone({ freq: 415, type: "sawtooth", dur: 0.22, gain: 0.05 });
  }),
  tick: play(() => tone({ freq: 1320, dur: 0.035, gain: 0.08 })),
  end: play(() => {
    [523.25, 659.25, 783.99].forEach((freq, i) => tone({ freq, start: i * 0.09, dur: 0.4, gain: 0.14 }));
  }),
  /** Call from a user gesture so later sounds are allowed to play. */
  unlock: () => audio(),
};
