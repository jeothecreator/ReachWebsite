// Simulated rival team. Each question, the rival decides whether it knows the answer
// and how far into the reading it will buzz. Stronger rivals know more and buzz earlier.

export const OPPONENTS = {
  off: null,
  rookie: {
    id: "rookie",
    name: "Rookie",
    blurb: "Buzzes late, knows the basics.",
    know: 0.42,
    early: 0.86,
    late: 1.25,
  },
  contender: {
    id: "contender",
    name: "Contender",
    blurb: "A solid school team.",
    know: 0.62,
    early: 0.62,
    late: 1.05,
  },
  champion: {
    id: "champion",
    name: "Champion",
    blurb: "Provincial finalists. Very fast.",
    know: 0.8,
    early: 0.4,
    late: 0.92,
  },
};

const DIFFICULTY_SHIFT = { 1: 0.12, 2: 0, 3: -0.14 };

/**
 * Plan the rival's behaviour for one question.
 * `at` is a fraction of the reading: 0.5 = halfway, 1 = end of question, >1 = during the buzz window.
 * Returns null when the rival stays silent.
 */
export function planOpponent(level, question) {
  const profile = OPPONENTS[level];
  if (!profile) return null;

  const knows = Math.random() < clamp(profile.know + DIFFICULTY_SHIFT[question.diff], 0.05, 0.97);
  if (knows) {
    return { at: lerp(profile.early, profile.late, Math.random() ** 0.9), correct: true };
  }
  // Occasionally the rival guesses near the end and gets it wrong.
  if (Math.random() < 0.22) return { at: lerp(0.85, 1.3, Math.random()), correct: false };
  return null;
}

/** Chance the rival converts a rebound after the player answers incorrectly. */
export function reboundChance(level, question) {
  const profile = OPPONENTS[level];
  if (!profile) return 0;
  return clamp(profile.know + DIFFICULTY_SHIFT[question.diff] + 0.08, 0.05, 0.97);
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
