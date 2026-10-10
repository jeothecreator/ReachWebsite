// Landing page.

import { esc, fmt, prefersReducedMotion } from "../dom.js";
import { icons } from "../icons.js";
import { TOPICS, GROUPS, QUESTIONS, counts } from "../bank.js";
import { wordsHTML } from "../reader.js";
import { store } from "../store.js";
import { DAILY_SIZE, dayKey, dailyNumber, currentStreak } from "../daily.js";
import { marksHTML } from "./daily.js";

const DEMO = [
  {
    topic: "Canada",
    level: "Intermediate",
    text: "Completed in 1885 at Craigellachie, British Columbia, this railway’s last spike was driven by Donald Smith. Name this transcontinental line.",
    answer: "Canadian Pacific Railway",
    typed: "canadian pacific",
    at: 0.62,
  },
  {
    topic: "Chemistry",
    level: "Junior",
    text: "With atomic number 79, this precious metal has the chemical symbol Au. Name this element.",
    answer: "Gold",
    typed: "gold",
    at: 0.56,
  },
  {
    topic: "Literature",
    level: "Senior",
    text: "The Pequod’s captain hunts a white whale in this 1851 novel narrated by Ishmael. Name this novel by Herman Melville.",
    answer: "Moby-Dick",
    typed: "moby dick",
    at: 0.44,
  },
];

export function mountHome(root) {
  const topicCounts = Object.fromEntries(TOPICS.map((t) => [t.id, 0]));
  for (const q of QUESTIONS) topicCounts[q.topic] += 1;
  const rounded = Math.floor(counts.total / 50) * 50;

  root.innerHTML = `
    <section class="hero">
      <div class="hero-bg" aria-hidden="true"></div>
      <div class="container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow hero-eyebrow"><span class="eyebrow-dot"></span>Reach for the Top practice</p>
          <h1 class="hero-title">Beat them<br /><em>to the buzzer.</em></h1>
          <p class="hero-lede">
            ${fmt(rounded)}+ original questions, read to you word by word — or aloud by a moderator voice. Press
            <kbd>Space</kbd> the moment you know it, and learn exactly how early you can buzz.
          </p>
          <div class="hero-actions">
            <a class="btn btn-primary btn-lg" href="#/practice">Start practising ${icons.arrowRight}</a>
            <a class="btn btn-secondary btn-lg" href="#/bank">Browse the bank</a>
          </div>
          <dl class="hero-facts">
            <div><dt>Questions</dt><dd>${fmt(counts.total)}</dd></div>
            <div><dt>Topics</dt><dd>${counts.topics}</dd></div>
            <div><dt>Levels</dt><dd>3</dd></div>
            <div><dt>Formats</dt><dd>4</dd></div>
          </dl>
        </div>

        <div class="hero-demo" aria-label="Animated example of a question being read and answered" role="img">
          <div class="demo-card" data-ref="demo">
            <div class="demo-top">
              <div class="q-tags">
                <span class="tag" data-ref="demoTopic"></span>
                <span class="tag tag-diff" data-ref="demoLevel"></span>
              </div>
              <span class="demo-score"><span class="muted">You</span> <b class="mono" data-ref="demoScore">0</b></span>
            </div>
            <p class="q-text demo-text" data-ref="demoText"></p>
            <div class="read-track"><div class="read-fill" data-ref="demoFill"></div></div>
            <div class="demo-console">
              <div class="demo-input" data-ref="demoInput"><span class="demo-typed" data-ref="demoTyped"></span><span class="caret"></span></div>
              <div class="demo-key" data-ref="demoKey"><kbd>Space</kbd><span>to buzz</span></div>
              <div class="demo-result" data-ref="demoResult">${icons.check}<span data-ref="demoAnswer"></span><b class="mono">+10</b></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    ${dailyBand()}

    <section class="section">
      <div class="container">
        <header class="section-head">
          <p class="eyebrow">Formats</p>
          <h2 class="section-heading">Practise the way the game is played.</h2>
        </header>
        <div class="format-grid">
          ${formatCard("snappers", icons.bolt, "Snappers", "10 points", "Open toss-ups read aloud word by word. Interrupt with Space when you know it — or wait for the end and buzz before time runs out.", ["Word-by-word reading", "Buzz-point tracking", "Optional rival team"])}
          ${formatCard("whoami", icons.person, "Who Am I?", "40 · 30 · 20 · 10", "Four clues about a person, place or thing, from obscure to obvious. Every clue you wait costs you ten points.", ["Clue-by-clue values", "History, science, arts", "Big swings, big wins"])}
          ${formatCard("lightning", icons.clock, "Lightning Round", "60 seconds", "Rapid-fire questions against the clock. Type and press Enter; leave it blank to pass and keep moving.", ["30 to 120 second rounds", "Instant marking", "Beat your best score"])}
          ${formatCard("room", icons.users, "Buzzer Room", "2–4 teams", "Run a real match on one laptop or tablet. Every team gets its own buzzer key, and a moderator marks the answers.", ["Team keys or touch pads", "Rebounds after a miss", "Final standings"])}
        </div>
      </div>
    </section>

    <section class="section section-alt">
      <div class="container features">
        <header class="section-head">
          <p class="eyebrow">Built for real practice</p>
          <h2 class="section-heading">Everything a team needs between matches.</h2>
        </header>
        <div class="feature-grid">
          ${feature(icons.keyboard, "A real buzzer", "Space is your buzzer. Reading stops the instant you press it, and your buzz point is marked in the text.")}
          ${feature(icons.speaker, "A moderator voice", "Turn on read-aloud and hear every question the way it sounds in a match. The voice stops the moment you buzz.")}
          ${feature(icons.check, "Fair answer checking", "Typos, accents and word order are forgiven. Last names count where a moderator would accept them. You can always overrule.")}
          ${feature(icons.versus, "A rival on the other bench", "Face a Rookie, Contender or Champion team that buzzes in, steals rebounds, and keeps the pressure on.")}
          ${feature(icons.calendar, "A daily challenge", "Ten new questions every day, the same for everyone. Build a streak and share your score with your team.")}
          ${feature(icons.target, "Know your weak spots", "Accuracy by topic and level, average buzz point, and a one-click round of every question you’ve missed.")}
          ${feature(icons.upload, "Bring your own packets", "Paste in questions from your own practice sets and play them with the same buzzer, marking and voice.")}
          ${feature(icons.printer, "Printable packets", "Filter the bank and print a clean packet with answers for a moderator-led practice.")}
          ${feature(icons.download, "Works offline", "Install Summit on your phone or laptop and practise on the bus, at tournaments, or anywhere without Wi-Fi.")}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <header class="section-head section-head-row">
          <div>
            <p class="eyebrow">Topics</p>
            <h2 class="section-heading">${counts.topics} subjects, three levels each.</h2>
          </div>
          <a class="btn btn-ghost" href="#/practice">Choose your own mix ${icons.arrowRight}</a>
        </header>
        <div class="topic-directory">
          ${GROUPS.map(
            (group) => `
            <div class="topic-column">
              <p class="topic-group-name">${esc(group)}</p>
              <ul>
                ${TOPICS.filter((t) => t.group === group)
                  .map(
                    (t) => `
                  <li>
                    <a class="topic-link" href="#/practice?topic=${t.id}">
                      <span class="topic-link-name">${esc(t.name)}</span>
                      <span class="topic-link-count mono">${topicCounts[t.id]}</span>
                    </a>
                    <p class="topic-link-blurb">${esc(t.blurb)}</p>
                  </li>`,
                  )
                  .join("")}
              </ul>
            </div>`,
          ).join("")}
        </div>
      </div>
    </section>

    <section class="section cta">
      <div class="container cta-inner">
        <h2 class="cta-title">Ready when you are.</h2>
        <p class="muted">No account, no sign-up. Your progress stays in this browser.</p>
        <a class="btn btn-primary btn-lg" href="#/practice">Start a round ${icons.arrowRight}</a>
      </div>
    </section>`;

  return runDemo(root);
}

function dailyBand() {
  const today = dayKey();
  const result = store.daily[today];
  const streak = currentStreak(today);
  return `
    <section class="daily-band">
      <div class="container daily-band-inner">
        <div class="daily-band-copy">
          <p class="eyebrow">${icons.calendar}Daily Challenge · #${dailyNumber(today)}</p>
          <h2 class="daily-band-title">${result ? `Today: ${result.correct} of ${result.total}` : `${DAILY_SIZE} new questions, every day.`}</h2>
          <p class="muted">${
            result
              ? "Come back tomorrow for a fresh set."
              : "The same set for everyone, climbing from Junior to Senior. One attempt counts."
          }</p>
        </div>
        <div class="daily-band-side">
          ${result ? marksHTML(result.marks) : ""}
          <span class="streak-pill ${streak ? "is-on" : ""}">${icons.flame}<b>${streak}</b> day streak</span>
          <a class="btn ${result ? "btn-secondary" : "btn-primary"}" href="#/daily">${result ? "See today’s result" : "Play today’s challenge"} ${icons.arrowRight}</a>
        </div>
      </div>
    </section>`;
}

function formatCard(mode, icon, title, value, text, bullets) {
  return `
    <a class="format-card" href="#/practice?mode=${mode}">
      <div class="format-top">
        <span class="format-icon">${icon}</span>
        <span class="format-value mono">${value}</span>
      </div>
      <h3 class="format-title">${title}</h3>
      <p class="format-text">${text}</p>
      <ul class="format-points">${bullets.map((b) => `<li>${icons.check}<span>${b}</span></li>`).join("")}</ul>
      <span class="format-cta">Play ${title} ${icons.arrowRight}</span>
    </a>`;
}

function feature(icon, title, text) {
  return `
    <div class="feature">
      <span class="feature-icon">${icon}</span>
      <h3 class="feature-title">${title}</h3>
      <p class="feature-text">${text}</p>
    </div>`;
}

/** Loop a short scripted example of reading, buzzing and answering. Returns a cleanup fn. */
function runDemo(root) {
  const $ = (ref) => root.querySelector(`[data-ref=${ref}]`);
  const card = $("demo");
  const timers = new Set();
  const wait = (ms) =>
    new Promise((resolve) => {
      const id = setTimeout(() => {
        timers.delete(id);
        resolve();
      }, ms);
      timers.add(id);
    });
  let alive = true;
  let score = 0;

  function setup(item) {
    $("demoTopic").textContent = item.topic;
    $("demoLevel").textContent = item.level;
    $("demoLevel").dataset.diff = { Junior: 1, Intermediate: 2, Senior: 3 }[item.level];
    $("demoText").innerHTML = wordsHTML(item.text);
    $("demoAnswer").textContent = item.answer;
    $("demoTyped").textContent = "";
    $("demoFill").style.transform = "scaleX(0)";
    card.dataset.state = "reading";
  }

  if (prefersReducedMotion()) {
    const item = DEMO[0];
    setup(item);
    root.querySelectorAll(".demo-text .w").forEach((w) => w.classList.add("on"));
    $("demoTyped").textContent = item.typed;
    $("demoScore").textContent = "10";
    $("demoFill").style.transform = "scaleX(1)";
    card.dataset.state = "correct";
    return () => {};
  }

  (async () => {
    for (let n = 0; alive; n = (n + 1) % DEMO.length) {
      const item = DEMO[n];
      setup(item);
      await wait(700);
      const words = [...root.querySelectorAll(".demo-text .w")];
      const stop = Math.round(words.length * item.at);
      for (let i = 0; i < stop && alive; i++) {
        words[i].classList.add("on");
        $("demoFill").style.transform = `scaleX(${(i + 1) / words.length})`;
        await wait(/[.,]$/.test(words[i].textContent) ? 330 : 190);
      }
      if (!alive) return;
      card.dataset.state = "buzz";
      words[stop - 1]?.insertAdjacentHTML("afterend", '<span class="buzz-mark"></span>');
      await wait(650);
      card.dataset.state = "typing";
      for (const ch of item.typed) {
        if (!alive) return;
        $("demoTyped").textContent += ch;
        await wait(70 + Math.random() * 60);
      }
      await wait(450);
      words.slice(stop).forEach((w) => w.classList.add("on", "rest"));
      score += 10;
      $("demoScore").textContent = score;
      card.dataset.state = "correct";
      await wait(2600);
    }
  })();

  return () => {
    alive = false;
    timers.forEach(clearTimeout);
  };
}
