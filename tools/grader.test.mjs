// Answer-checking tests:  node --test tools/
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrect, answerHTML } from "../assets/js/grader.js";

const accepts = (input, answer, alts) =>
  assert.equal(isCorrect(input, answer, alts), true, `"${input}" should match "${answer}"`);
const rejects = (input, answer, alts) =>
  assert.equal(isCorrect(input, answer, alts), false, `"${input}" should NOT match "${answer}"`);

test("exact and case-insensitive matches", () => {
  accepts("Ottawa", "Ottawa");
  accepts("  ottawa ", "Ottawa");
  accepts("OTTAWA", "Ottawa");
});

test("required portions in brackets", () => {
  accepts("Macdonald", "Sir John A. [Macdonald]");
  accepts("john macdonald", "Sir John A. [Macdonald]");
  accepts("Sir John A. Macdonald", "Sir John A. [Macdonald]");
  rejects("John", "Sir John A. [Macdonald]");
  accepts("pierre trudeau", "[Pierre] Elliott [Trudeau]");
  rejects("trudeau", "[Pierre] Elliott [Trudeau]");
  accepts("mackenzie king", "William Lyon [Mackenzie King]");
  rejects("king", "William Lyon [Mackenzie King]");
  accepts("emily bronte", "[Emily] Brontë");
  rejects("bronte", "[Emily] Brontë");
  accepts("logan", "Mount [Logan]");
  accepts("vimy", "Battle of [Vimy] Ridge");
});

test("articles, accents, punctuation and word order", () => {
  accepts("the sun", "The [Sun]");
  accepts("sun", "The [Sun]");
  accepts("vacuum", "A [vacuum]");
  accepts("Montreal", "Montréal");
  accepts("crick and watson", "[Watson] and [Crick]");
  accepts("jorn utzon", "Jørn [Utzon]");
  accepts("le chatelier", "Le [Chatelier's] principle");
  accepts("xray", "X-rays", ["x ray"]);
});

test("typos are forgiven on longer words only", () => {
  accepts("saskatchewen", "Saskatchewan");
  accepts("mitochondria", "Mitochondrion");
  accepts("charlottetwon", "Charlottetown");
  rejects("austria", "Australia");
  rejects("iran", "Iraq");
  rejects("mars", "Mass");
  rejects("prussia", "Russia");
  rejects("nitrogen", "Hydrogen");
});

test("numbers", () => {
  accepts("7", "Seven");
  accepts("seven", "7");
  accepts("twenty-five", "25");
  accepts("1,000", "1000");
  accepts("0.25", "1/4");
  accepts("75", "75%");
  accepts("36 cm", "36");
  accepts("-273", "-273");
  accepts("negative 2", "-2");
  rejects("1868", "1867");
  rejects("30", "300,000");
  rejects("three", "The Three Musketeers");
});

test("algebraic answers", () => {
  accepts("3x^2", "3x^2");
  accepts("3x²", "3x^2");
  accepts("x squared", "x^2", ["x squared"]);
  accepts("π", "Pi");
});

test("multi-part answers need every part", () => {
  const four = "Ontario, Quebec, Nova Scotia and New Brunswick";
  accepts("nova scotia, new brunswick, ontario, quebec", four);
  rejects("ontario and quebec", four);
});

test("different numerals and directions are not typos", () => {
  rejects("Elizabeth II", "[Elizabeth] I");
  accepts("Elizabeth I", "[Elizabeth] I");
  accepts("Elizabeth", "[Elizabeth] I");
  rejects("Louis XV", "Louis XIV");
  accepts("louis xiv", "Louis XIV");
  rejects("Henry VII", "Henry [VIII]");
  accepts("Henry VIII", "Henry [VIII]");
  rejects("Northeast Passage", "[Northwest] Passage");
  accepts("Northwest Passage", "[Northwest] Passage");
  accepts("Nortwest Passage", "[Northwest] Passage");
  accepts("northwestpassage", "[Northwest] Passage");
  rejects("World War 1", "World War [2]", ["Second World War"]);
  accepts("world war 2", "World War [2]", ["Second World War"]);
  accepts("Pope John Paul II", "Pope John Paul [II]");
});

test("empty and nonsense input", () => {
  rejects("", "Ottawa");
  rejects("the", "The [Sun]");
  rejects("ottawa canada", "Ottawa");
});

test("answer markup renders the required part in bold", () => {
  assert.equal(answerHTML("Mount [Logan]"), "Mount <strong>Logan</strong>");
  assert.equal(answerHTML("Ottawa"), "<strong>Ottawa</strong>");
  assert.equal(answerHTML("<b>"), "<strong>&lt;b&gt;</strong>");
});
