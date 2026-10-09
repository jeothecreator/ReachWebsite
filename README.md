# Summit — Reach for the Top practice

Summit is a practice site for **Reach for the Top**. Questions are read to you word by word, you press **Space** to buzz, and your answer is marked automatically. It runs entirely in the browser: no accounts, no server, no build step.

## Features

- **1,400+ original questions** across 14 topics: Biology, Chemistry, Physics, Earth & Space, Mathematics, World History, Canada, Geography, Literature, Fine Arts, Mythology & Religion, Language & Words, Technology, and Sports & Games.
- **Three levels:** Junior, Intermediate and Senior.
- **Three formats:**
  - **Snappers:** open toss-ups worth 10 points, read word by word. Buzz in at any point.
  - **Who Am I?:** four clues worth 40, 30, 20 and 10 points, hardest clue first.
  - **Lightning Round:** answer as many questions as you can in 30 to 120 seconds.
- **Space is the buzzer.** Reading stops the moment you buzz, and your buzz point is marked in the question text.
- **Lenient answer checking.** Small typos, accents, articles and word order don't count against you, and last names count wherever a moderator would accept them. If the marking is wrong, you can overrule it.
- **Rival opponent.** Play against a Rookie, Contender or Champion team that buzzes in and takes rebounds.
- **Self-marking mode.** Players answer out loud and mark themselves, so a whole team can practise from one screen.
- **Stats.** Accuracy by topic and level, average buzz point, recent sessions, and a one-click round of every question you've missed.
- **Question bank.** Search and filter every question, reveal answers, and print a clean packet for a moderator-led practice.
- Light and dark themes, synthesized sound effects, and layouts that work on phones.

## Keyboard shortcuts

| Key          | Action                                                  |
| ------------ | ------------------------------------------------------- |
| `Space`      | Buzz in (and go to the next question)                   |
| `Enter`      | Submit an answer, reveal it, or go to the next question |
| `Y` / `N`    | Mark yourself right or wrong (self-marking)             |
| `P` or `Esc` | Pause or resume                                         |

## Running it locally

The site uses ES modules, which browsers won't load from `file://` URLs. Serve the folder with any static file server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

Then open <http://localhost:8080>.

## Deploying

The site is plain static files, so any static host works.

- **GitHub Pages:** in the repository go to _Settings → Pages_ and deploy from the branch root.
- **Netlify, Vercel or Cloudflare Pages:** leave the build command empty and set the publish directory to `/`.

## Project structure

```
index.html                 App shell (header, footer, settings dialog)
assets/css/main.css        Design tokens, components, light/dark themes, print styles
assets/js/app.js           Router and theme handling
assets/js/bank.js          Loads the question files and filters them
assets/js/grader.js        Answer checking
assets/js/reader.js        Word-by-word question reader
assets/js/opponent.js      Simulated rival team
assets/js/store.js         Settings, progress and history (localStorage)
assets/js/views/           Home, setup, play, results, bank, stats and settings screens
data/questions/*.js        The question bank, one file per topic
tools/validate.mjs         Checks every question and confirms its answer grades correctly
tools/grader.test.mjs      Unit tests for answer checking
```

## Adding questions

Each topic file holds a list of entries like this:

```js
// [difficulty, question, answer, accepted alternates]
[2, "Which French explorer founded Quebec City in 1608?", "Samuel de [Champlain]"],
[1, "What is the longest bone in the human body?", "Femur", ["thigh bone"]],
```

- **Difficulty:** `1` for Junior, `2` for Intermediate, `3` for Senior.
- **Answer markup:** the part in `[brackets]` is required and the rest is optional. With `"Samuel de [Champlain]"`, both "Champlain" and "Samuel de Champlain" are accepted. If an answer has no brackets, every word is required.
- **Numbers:** write numeric answers as plain numbers (`"1867"`, `"3/4"`, `"-273"`). They're compared by value, so "seven" and "7" both count.
- **Keep IDs stable:** progress is saved by position in the file, so add new questions to the **end** of a file.

Who Am I? entries live in `data/questions/who-am-i.js`. Each one has four clues, from hardest to easiest, followed by the answer, any alternates, and a topic id.

After editing, run the checks:

```bash
npm test          # grader unit tests + full question-bank validation
npm run validate  # question-bank validation only
```

## Disclaimer

All questions are original. Summit is an independent project and is not affiliated with or endorsed by Reach for the Top.
