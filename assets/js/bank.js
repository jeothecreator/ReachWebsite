// Question bank: loads every topic file, assigns stable ids and provides filtering.
//
// Topic files export { id, name, group, blurb, questions } where each question is a tuple:
//   [difficulty, questionText, answer, acceptedAlternates?]
// Who Am I? files export clue lists instead of question text:
//   [difficulty, [clue1, clue2, clue3, clue4], answer, alternates, topicId]

import { store } from "./store.js";
import { shuffle } from "./dom.js";

import biology from "../../data/questions/biology.js";
import chemistry from "../../data/questions/chemistry.js";
import physics from "../../data/questions/physics.js";
import earthSpace from "../../data/questions/earth-space.js";
import mathematics from "../../data/questions/mathematics.js";
import worldHistory from "../../data/questions/world-history.js";
import canada from "../../data/questions/canada.js";
import geography from "../../data/questions/geography.js";
import literature from "../../data/questions/literature.js";
import fineArts from "../../data/questions/fine-arts.js";
import mythology from "../../data/questions/mythology.js";
import language from "../../data/questions/language.js";
import technology from "../../data/questions/technology.js";
import sports from "../../data/questions/sports.js";
import whoAmI from "../../data/questions/who-am-i.js";

const TOPIC_FILES = [
  biology,
  chemistry,
  physics,
  earthSpace,
  mathematics,
  worldHistory,
  canada,
  geography,
  literature,
  fineArts,
  mythology,
  language,
  technology,
  sports,
];

export const DIFFICULTIES = [
  { id: 1, name: "Junior", hint: "Easy" },
  { id: 2, name: "Intermediate", hint: "Medium" },
  { id: 3, name: "Senior", hint: "Hard" },
];

export const GROUPS = ["Science", "Mathematics", "Social Studies", "Arts & Language", "Culture & Technology"];

export const TOPICS = TOPIC_FILES.map(({ id, name, group, blurb }) => ({ id, name, group, blurb }));
export const topicById = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

/** Curly quotes for display: data files use plain ' for easier editing. */
const smart = (s) => s.replace(/(^|[\s(“—])'/g, "$1‘").replace(/'/g, "’");

/** Every question, normalised to one shape. */
export const QUESTIONS = [];

for (const file of TOPIC_FILES) {
  file.questions.forEach(([diff, text, answer, alts = []], i) => {
    QUESTIONS.push({
      id: `${file.id}-${i + 1}`,
      kind: "snapper",
      topic: file.id,
      diff,
      text: smart(text),
      answer: smart(answer),
      alts: alts.map(smart),
    });
  });
}

whoAmI.questions.forEach(([diff, clues, answer, alts = [], topic], i) => {
  QUESTIONS.push({
    id: `who-${i + 1}`,
    kind: "whoami",
    topic,
    diff,
    clues: clues.map(smart),
    text: smart(clues.join(" ")),
    answer: smart(answer),
    alts: alts.map(smart),
  });
});

export const counts = {
  total: QUESTIONS.length,
  snappers: QUESTIONS.filter((q) => q.kind === "snapper").length,
  whoami: QUESTIONS.filter((q) => q.kind === "whoami").length,
  topics: TOPICS.length,
};

const kindForMode = (mode, roomSet) =>
  mode === "whoami" || (mode === "room" && roomSet === "whoami") ? "whoami" : "snapper";

/**
 * Filter the bank by practice settings.
 * @param {{mode?: string, roomSet?: string, topics?: string[]|null, diffs?: number[], pool?: string}} opts
 */
export function filterQuestions({
  mode = "snappers",
  roomSet = "snappers",
  topics = null,
  diffs = [1, 2, 3],
  pool = "all",
} = {}) {
  const kind = kindForMode(mode, roomSet);
  const topicSet = topics ? new Set(topics) : null;
  const diffSet = new Set(diffs);
  return QUESTIONS.filter((q) => {
    if (q.kind !== kind) return false;
    if (topicSet && !topicSet.has(q.topic)) return false;
    if (!diffSet.has(q.diff)) return false;
    if (pool === "unseen" && store.isSeen(q.id)) return false;
    if (pool === "missed" && !store.isMissed(q.id)) return false;
    return true;
  });
}

/** Build a shuffled question set for a session. */
export function drawQuestions(config) {
  const pool = shuffle(filterQuestions(config));
  if (config.mode === "lightning") return pool; // the clock decides how many get used
  return pool.slice(0, config.count);
}

/** Count questions per topic for a mode/difficulty selection (ignores the topic filter itself). */
export function countByTopic({ mode, roomSet, diffs, pool }) {
  const result = Object.fromEntries(TOPICS.map((t) => [t.id, 0]));
  for (const q of filterQuestions({ mode, roomSet, diffs, pool })) result[q.topic] += 1;
  return result;
}

export function countByDifficulty({ mode, roomSet, topics, pool }) {
  const result = { 1: 0, 2: 0, 3: 0 };
  for (const q of filterQuestions({ mode, roomSet, topics, pool, diffs: [1, 2, 3] })) result[q.diff] += 1;
  return result;
}

const byId = new Map(QUESTIONS.map((q) => [q.id, q]));
export const questionById = (id) => byId.get(id);

/** Turn an imported packet into playable questions. They are flagged `custom` so progress isn't tracked. */
export function packetQuestions(packet) {
  return packet.questions.map(([text, answer, alts = []], i) => ({
    id: `pk-${packet.id}-${i + 1}`,
    kind: "snapper",
    custom: true,
    topic: "custom",
    topicName: packet.name,
    diff: 0,
    text: smart(text),
    answer: smart(answer),
    alts: alts.map(smart),
  }));
}
