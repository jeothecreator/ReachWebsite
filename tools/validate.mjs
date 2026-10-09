#!/usr/bin/env node
// Validates the question bank:
//   node tools/validate.mjs
// Checks structure, difficulty values, duplicate questions, answer markup, and that every
// answer line (and its required portion alone) is accepted by the in-app grader.

import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isCorrect, tokenize } from "../assets/js/grader.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = join(root, "data", "questions");

const problems = [];
const warn = (where, msg) => problems.push(`${where}: ${msg}`);

const topicIds = new Set();
const seenText = new Map();
let snappers = 0;
let whoami = 0;
const perDiff = { 1: 0, 2: 0, 3: 0 };

function checkAnswer(where, answer, alts) {
  if (typeof answer !== "string" || !answer.trim()) return warn(where, "missing answer");
  if ((answer.match(/\[/g) || []).length !== (answer.match(/\]/g) || []).length)
    warn(where, `unbalanced brackets in "${answer}"`);
  if (!Array.isArray(alts)) return warn(where, "alternates must be an array");

  const plain = answer.replace(/[[\]]/g, "");
  if (!isCorrect(plain, answer, alts)) warn(where, `full answer "${plain}" is not accepted`);

  const required = [...answer.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]).join(" ");
  if (required) {
    if (!tokenize(required).length) warn(where, `required part of "${answer}" is empty after normalising`);
    else if (!isCorrect(required, answer, alts)) warn(where, `required part "${required}" is not accepted`);
  }
  for (const alt of alts) {
    if (typeof alt !== "string" || !alt.trim()) warn(where, "empty alternate");
    else if (!isCorrect(alt.replace(/[[\]]/g, ""), answer, alts)) warn(where, `alternate "${alt}" is not accepted`);
  }
}

function checkText(where, text) {
  if (typeof text !== "string" || text.trim().length < 8) return warn(where, "question text too short");
  const key = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (seenText.has(key)) warn(where, `duplicate of ${seenText.get(key)}`);
  else seenText.set(key, where);
}

const files = readdirSync(dataDir)
  .filter((f) => f.endsWith(".js"))
  .sort();
const whoFile = files.find((f) => f === "who-am-i.js");

for (const file of files.filter((f) => f !== whoFile)) {
  const mod = (await import(join(dataDir, file))).default;
  for (const key of ["id", "name", "group", "blurb"]) if (!mod[key]) warn(file, `missing "${key}"`);
  if (topicIds.has(mod.id)) warn(file, `duplicate topic id "${mod.id}"`);
  topicIds.add(mod.id);

  mod.questions.forEach((q, i) => {
    const where = `${mod.id}-${i + 1}`;
    const [diff, text, answer, alts = []] = q;
    if (![1, 2, 3].includes(diff)) warn(where, `difficulty must be 1, 2 or 3 (got ${diff})`);
    checkText(where, text);
    checkAnswer(where, answer, alts);
    perDiff[diff] = (perDiff[diff] || 0) + 1;
    snappers += 1;
  });
}

if (whoFile) {
  const mod = (await import(join(dataDir, whoFile))).default;
  mod.questions.forEach((q, i) => {
    const where = `who-${i + 1}`;
    const [diff, clues, answer, alts = [], topic] = q;
    if (![1, 2, 3].includes(diff)) warn(where, `difficulty must be 1, 2 or 3 (got ${diff})`);
    if (!Array.isArray(clues) || clues.length !== 4) warn(where, "needs exactly four clues");
    else clues.forEach((c, k) => checkText(`${where} clue ${k + 1}`, c));
    if (!topicIds.has(topic)) warn(where, `unknown topic "${topic}"`);
    checkAnswer(where, answer, alts);
    perDiff[diff] = (perDiff[diff] || 0) + 1;
    whoami += 1;
  });
}

console.log(`Snappers:  ${snappers}`);
console.log(`Who Am I?: ${whoami}`);
console.log(
  `Total:     ${snappers + whoami}  (Junior ${perDiff[1]} · Intermediate ${perDiff[2]} · Senior ${perDiff[3]})`,
);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log("\nAll questions valid.");
