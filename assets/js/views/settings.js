// Settings dialog (opened from the header). Changes apply immediately.

import { $ } from "../dom.js";
import { icons } from "../icons.js";
import { store, msPerWord } from "../store.js";
import { sound } from "../sound.js";
import { segmented, toggle, field } from "../ui.js";

const wpm = (speed) => Math.round(60000 / msPerWord(speed));

function render(dialog) {
  const s = store.settings;
  dialog.innerHTML = `
    <form method="dialog" class="dialog-panel">
      <header class="dialog-head">
        <h2 id="settings-title" class="dialog-title">Settings</h2>
        <button class="icon-btn" value="close" aria-label="Close settings">${icons.close}</button>
      </header>

      <div class="dialog-body">
        <section class="field-group">
          <h3 class="field-group-title">Gameplay</h3>
          ${field({
            title: "Answering",
            hint: "Type answers for automatic marking, or answer aloud and mark yourself — ideal for team practice.",
            control: segmented({
              name: "judging",
              label: "Answering",
              value: s.judging,
              options: [
                { value: "typed", label: "Type" },
                { value: "self", label: "Self-mark" },
              ],
            }),
          })}
          ${field({
            title: "Reading speed",
            hint: `<span data-ref="wpm">≈ ${wpm(s.speed)} words per minute</span>`,
            control: `<input class="range" type="range" name="speed" min="1" max="10" step="1" value="${s.speed}" aria-label="Reading speed" />`,
          })}
          ${field({
            title: "Time to answer",
            hint: "Seconds after you buzz.",
            control: segmented({
              name: "answerTime",
              label: "Time to answer",
              value: s.answerTime,
              options: [5, 8, 12, 20].map((n) => ({ value: n, label: `${n}s` })),
            }),
          })}
          ${field({
            title: "Buzz window",
            hint: "Seconds left to buzz once the question ends.",
            control: segmented({
              name: "buzzWindow",
              label: "Buzz window",
              value: s.buzzWindow,
              options: [3, 5, 8].map((n) => ({ value: n, label: `${n}s` })),
            }),
          })}
        </section>

        <section class="field-group">
          <h3 class="field-group-title">Sound &amp; display</h3>
          ${field({ title: "Sound effects", hint: "Buzzer, correct and incorrect cues.", control: toggle({ name: "sound", checked: s.sound, label: "Sound effects" }) })}
          ${field({
            title: "Volume",
            control: `<input class="range" type="range" name="volume" min="0" max="1" step="0.05" value="${s.volume}" aria-label="Volume" />`,
          })}
          ${field({
            title: "Theme",
            control: segmented({
              name: "theme",
              label: "Theme",
              value: s.theme,
              options: [
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ],
            }),
          })}
        </section>
      </div>

      <footer class="dialog-foot">
        <p class="muted small">Settings are saved in this browser.</p>
        <button class="btn btn-primary" value="close">Done</button>
      </footer>
    </form>`;
}

export function openSettings() {
  const dialog = $("#settings-dialog");
  render(dialog);

  dialog.oninput = (event) => {
    const el = event.target;
    if (!el.name) return;
    let value = el.type === "checkbox" ? el.checked : el.value;
    if (["speed", "answerTime", "buzzWindow", "volume"].includes(el.name)) value = Number(value);
    store.updateSettings({ [el.name]: value });
    if (el.name === "speed") $("[data-ref=wpm]", dialog).textContent = `≈ ${wpm(value)} words per minute`;
  };
  dialog.onchange = (event) => {
    if (event.target.name === "volume" || event.target.name === "sound") sound.correct();
  };
  dialog.onclick = (event) => {
    if (event.target === dialog) dialog.close(); // click on the backdrop
  };
  dialog.showModal();
}
