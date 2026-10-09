// Reusable form controls rendered as HTML strings.

import { esc } from "./dom.js";

/** Radio-button group styled as a segmented control. */
export function segmented({ name, value, options, label }) {
  return `
    <div class="segmented" role="radiogroup" aria-label="${esc(label)}">
      ${options
        .map(
          (o) => `
        <label class="seg">
          <input type="radio" name="${esc(name)}" value="${esc(o.value)}" ${String(o.value) === String(value) ? "checked" : ""} />
          <span>${esc(o.label)}</span>
        </label>`,
        )
        .join("")}
    </div>`;
}

/** On/off switch backed by a checkbox. */
export function toggle({ name, checked, label }) {
  return `
    <label class="switch">
      <input type="checkbox" name="${esc(name)}" ${checked ? "checked" : ""} />
      <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
      <span class="sr-only">${esc(label)}</span>
    </label>`;
}

/** A labelled row inside a settings-style list. */
export function field({ title, hint = "", control }) {
  return `
    <div class="field">
      <div class="field-text">
        <span class="field-title">${esc(title)}</span>
        ${hint ? `<span class="field-hint">${hint}</span>` : ""}
      </div>
      <div class="field-control">${control}</div>
    </div>`;
}
