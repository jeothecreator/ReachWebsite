// Answer checking.
//
// Answer lines use quiz-bowl style markup: the part in [brackets] is required and
// everything else is optional. "John A. [Macdonald]" accepts "Macdonald",
// "John Macdonald" and "John A. Macdonald". With no brackets, every word is required.
// Matching forgives small typos, accents, articles, punctuation and word order.

import { esc } from "./dom.js";

const STOPWORDS = new Set(["the", "a", "an", "of", "and", "de", "la", "le", "du"]);

const NUMBER_WORDS = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};
const SCALES = { hundred: 100, thousand: 1_000, million: 1_000_000, billion: 1_000_000_000 };
const NUMERIC_TOKEN = /^[-+]?\d+(\.\d+)?(\/\d+(\.\d+)?)?%?$/;

/** Lower-case, strip accents and punctuation, and split into words. */
export function tokenize(text) {
  const cleaned = String(text ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[øæœßłđıπ]/g, (ch) => ({ ø: "o", æ: "ae", œ: "oe", ß: "ss", ł: "l", đ: "d", ı: "i", π: " pi " })[ch])
    .replace(/(\d),(?=\d{3}\b)/g, "$1") // 1,000 → 1000
    .replace(/&/g, " and ")
    .replace(/['’‘`]/g, "")
    .replace(/[^a-z0-9.\/\-+% ]+/g, " ");

  const words = [];
  for (const raw of cleaned.split(/\s+/)) {
    if (!raw) continue;
    if (NUMERIC_TOKEN.test(raw)) {
      words.push(raw);
      continue;
    }
    for (const part of raw.split(/[.\/\-+%]+/)) if (part) words.push(part);
  }
  return words;
}

/** Parse a numeric answer ("12", "3/4", "25%", "twenty-five", "minus 4"). Returns null if not numeric. */
export function parseNumber(words, { strict = false } = {}) {
  if (!words.length) return null;
  let sign = 1;
  let i = 0;
  if (words[0] === "minus" || words[0] === "negative") {
    sign = -1;
    i = 1;
  }
  const first = words[i];
  if (first && NUMERIC_TOKEN.test(first)) {
    // Allow at most one trailing unit word ("36 cm", "90 degrees").
    if (strict && words.length - i > 2) return null;
    const clean = first.replace("%", "");
    const [num, den] = clean.split("/").map(Number);
    const value = den === undefined ? num : num / den;
    return Number.isFinite(value) ? sign * value : null;
  }

  // Spelled-out numbers.
  let total = 0;
  let current = 0;
  let consumed = 0;
  for (; i < words.length; i++) {
    const w = words[i];
    if (w in NUMBER_WORDS) current += NUMBER_WORDS[w];
    else if (w === "hundred") current = (current || 1) * 100;
    else if (w in SCALES) {
      total += (current || 1) * SCALES[w];
      current = 0;
    } else if (w === "and" && consumed) continue;
    else break;
    consumed++;
  }
  if (!consumed) return null;
  if (strict && i < words.length) return null; // "Three Musketeers" is a title, not a number
  return sign * (total + current);
}

/** Parse "[Required] optional" markup into the pieces the matcher needs. */
function parseSpec(spec) {
  const plain = spec.replace(/[[\]]/g, "");
  const full = tokenize(plain);
  const bracketed = [...spec.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).join(" ");
  const required = (bracketed ? tokenize(bracketed) : full).filter((w) => !STOPWORDS.has(w));
  return { full, required, number: parseNumber(full, { strict: true }) };
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Words where one letter changes the meaning: regnal numerals (Henry VII / VIII), compass
// directions (Northwest / Northeast) and anything with a digit (World War 1 / 2).
const ROMAN = /^(?=[ivxlc]+$)c{0,3}(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$/;
const COMPASS = /^(north|south|east|west|northeast|northwest|southeast|southwest)$/;
const distinct = (w) => ROMAN.test(w) || COMPASS.test(w) || /\d/.test(w);
const distinctKey = (words) => words.filter(distinct).sort().join(" ");

/** Typo-tolerant equality. Short words must match exactly; longer ones allow 1–2 edits. */
function close(a, b) {
  if (a === b) return true;
  if (a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  if (a[0] !== b[0]) return false;
  const len = Math.min(a.length, b.length);
  const tolerance = len <= 4 ? 0 : len <= 8 ? 1 : 2;
  return tolerance > 0 && Math.abs(a.length - b.length) <= tolerance && levenshtein(a, b) <= tolerance;
}

/** Word comparison: two different numerals or directions never count as a typo of each other. */
function closeWord(a, b) {
  if (a !== b && distinct(a) && distinct(b)) return false;
  return close(a, b);
}

/** Whole-phrase comparison, unless the phrases hold different numerals or directions. */
function closePhrase(input, target) {
  if (!target.length) return false;
  const a = input.join(" ");
  const b = target.join(" ");
  if (a.replace(/ /g, "") === b.replace(/ /g, "")) return true;
  const ka = distinctKey(input);
  const kb = distinctKey(target);
  if (ka && kb && ka !== kb) return false;
  return close(a, b);
}

function matchesSpec(inputWords, spec) {
  const { full, required, number } = parseSpec(spec);

  if (number !== null) {
    const given = parseNumber(inputWords);
    return given !== null && Math.abs(given - number) <= 1e-9 * Math.max(1, Math.abs(number));
  }

  const meaningful = inputWords.filter((w) => !STOPWORDS.has(w));
  if (!meaningful.length) return false;

  // Whole-phrase comparison catches run-together words and multi-word typos.
  const fullMeaningful = full.filter((w) => !STOPWORDS.has(w));
  if (closePhrase(meaningful, fullMeaningful) || closePhrase(meaningful, required)) return true;

  // Word-level: every word typed must belong to the answer, and every required word must be present.
  const available = full.slice();
  for (const word of meaningful) {
    const idx = available.findIndex((w) => closeWord(word, w));
    if (idx === -1) return false;
    available.splice(idx, 1);
  }
  return required.every((req) => meaningful.some((w) => closeWord(w, req)));
}

/** Check a typed response against a question's answer and accepted alternates. */
export function isCorrect(input, answer, alts = []) {
  const words = tokenize(input);
  if (!words.length) return false;
  return [answer, ...alts].some((spec) => matchesSpec(words, spec));
}

/** Render an answer line as HTML, emphasising the required portion. */
export function answerHTML(spec) {
  if (!spec.includes("[")) return `<strong>${esc(spec)}</strong>`;
  return esc(spec).replace(/\[([^\]]+)\]/g, "<strong>$1</strong>");
}

/** Plain-text answer without markup (for printing and aria labels). */
export const answerText = (spec) => spec.replace(/[[\]]/g, "");
