// Keyboard shortcuts reference (press "?" anywhere).

import { $ } from "../dom.js";
import { icons } from "../icons.js";

const GROUPS = [
  {
    title: "Playing",
    rows: [
      [["Space"], "Buzz in, or go to the next question"],
      [["Enter"], "Submit, reveal the answer, or go on"],
      [["Y"], "Mark yourself correct (self-marking)"],
      [["N"], "Mark yourself incorrect (self-marking)"],
      [["P"], "Pause or resume"],
      [["Esc"], "Pause or resume, even while typing"],
    ],
  },
  {
    title: "Buzzer Room",
    rows: [
      [["A", "L", "Z", "M"], "Default team buzzers (change them in setup)"],
      [["Y", "N"], "Moderator marks the answer"],
      [["Enter"], "Next question"],
    ],
  },
  {
    title: "Anywhere",
    rows: [[["?"], "Show this list"]],
  },
];

export function openShortcuts() {
  const dialog = $("#shortcuts-dialog");
  dialog.innerHTML = `
    <form method="dialog" class="dialog-panel">
      <header class="dialog-head">
        <h2 id="shortcuts-title" class="dialog-title">Keyboard shortcuts</h2>
        <button class="icon-btn" value="close" aria-label="Close">${icons.close}</button>
      </header>
      <div class="dialog-body">
        ${GROUPS.map(
          (g) => `
          <section class="field-group">
            <h3 class="field-group-title">${g.title}</h3>
            <dl class="shortcut-list">
              ${g.rows.map(([keys, text]) => `<div><dt>${keys.map((k) => `<kbd>${k}</kbd>`).join("")}</dt><dd>${text}</dd></div>`).join("")}
            </dl>
          </section>`,
        ).join("")}
      </div>
    </form>`;
  dialog.onclick = (event) => event.target === dialog && dialog.close();
  dialog.showModal();
}
