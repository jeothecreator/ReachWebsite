// Small DOM helpers shared by every view.

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape a value for safe interpolation into HTML. */
export function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Format an integer with thousands separators (1,234). */
export const fmt = (n) => Number(n).toLocaleString("en-CA");

/** Format a 0–1 ratio as a whole percentage, or an em dash when undefined. */
export const pct = (ratio) => (Number.isFinite(ratio) ? `${Math.round(ratio * 100)}%` : "—");

/** True when keyboard input is going into a text field. */
export function isTyping(event) {
  const el = event.target;
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(list) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Relative date label: "Today", "Yesterday", or "Mar 4". */
export function relativeDay(timestamp) {
  const d = new Date(timestamp);
  const today = new Date();
  const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}
