// Import your own question packets (pasted text or spreadsheet rows) and play them.

import { $, esc, fmt, shuffle } from "../dom.js";
import { icons } from "../icons.js";
import { store } from "../store.js";
import { packetQuestions } from "../bank.js";
import { beginSession } from "../session.js";

const MAX_QUESTIONS = 500;
const MAX_PACKETS = 30;

/**
 * Parse pasted lines of "Question | Answer | alternate; alternate".
 * Tab-separated rows (copied from a spreadsheet) work too.
 */
export function parsePacket(text) {
  const questions = [];
  let skipped = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = (line.includes("\t") ? line.split("\t") : line.split("|")).map((p) => p.trim());
    const [question = "", answer = "", alts = ""] = parts;
    if (question.length < 3 || !answer || question.length > 600 || answer.length > 160) {
      skipped += 1;
      continue;
    }
    questions.push([
      question,
      answer,
      alts
        .split(";")
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 8),
    ]);
  }
  return { questions: questions.slice(0, MAX_QUESTIONS), skipped, truncated: questions.length > MAX_QUESTIONS };
}

export function playPacket(packet, mode = "snappers") {
  const questions = shuffle(packetQuestions(packet));
  return beginSession(
    {
      mode,
      packet: packet.id,
      packetName: packet.name,
      count: questions.length,
      duration: 60,
      topics: null,
      diffs: [1, 2, 3],
      opponent: "off",
      pool: "all",
    },
    questions,
  );
}

const EXAMPLE = `Which French explorer founded Quebec City in 1608? | Samuel de [Champlain]
What is the chemical symbol for sodium? | Na
Who wrote 'Anne of Green Gables'? | L. M. [Montgomery] | Lucy Maud Montgomery`;

export function openPacketDialog(onSaved) {
  const dialog = $("#packet-dialog");
  const count = store.packets.length;
  dialog.innerHTML = `
    <form method="dialog" class="dialog-panel" data-ref="form">
      <header class="dialog-head">
        <h2 id="packet-title" class="dialog-title">Import a packet</h2>
        <button class="icon-btn" type="button" data-close aria-label="Close">${icons.close}</button>
      </header>
      <div class="dialog-body packet-body">
        <p class="muted small">Paste one question per line: <code>Question | Answer | alternates</code>. Rows copied from a spreadsheet (question, answer, alternates in columns) work too. Put the part of an answer that's required in [brackets] — for example <code>Sir John A. [Macdonald]</code> accepts “Macdonald”. Separate alternates with semicolons.</p>
        <label class="field-stack">
          <span class="field-title">Packet name</span>
          <input class="text-input" name="name" maxlength="60" value="Packet ${count + 1}" autocomplete="off" required />
        </label>
        <label class="field-stack">
          <span class="field-title">Questions</span>
          <textarea class="text-area" name="text" rows="10" spellcheck="false" placeholder="${esc(EXAMPLE)}"></textarea>
        </label>
        <p class="packet-preview" data-ref="preview" aria-live="polite">Paste your questions above.</p>
        <p class="muted small">Packets are saved in this browser only. They don’t count toward your stats.</p>
      </div>
      <footer class="dialog-foot">
        <button class="btn btn-ghost" type="button" data-close>Cancel</button>
        <button class="btn btn-primary" value="save" data-ref="save" disabled>Save packet</button>
      </footer>
    </form>`;

  const form = $("[data-ref=form]", dialog);
  const preview = $("[data-ref=preview]", dialog);
  const saveBtn = $("[data-ref=save]", dialog);
  let parsed = { questions: [], skipped: 0 };

  const update = () => {
    parsed = parsePacket(form.text.value);
    const n = parsed.questions.length;
    const full = store.packets.length >= MAX_PACKETS;
    preview.innerHTML = !form.text.value.trim()
      ? "Paste your questions above."
      : `<b>${fmt(n)}</b> question${n === 1 ? "" : "s"} ready${parsed.skipped ? ` · ${parsed.skipped} line${parsed.skipped === 1 ? "" : "s"} skipped (each line needs a question and an answer)` : ""}${parsed.truncated ? ` · only the first ${MAX_QUESTIONS} are kept` : ""}${full ? ` · you have ${MAX_PACKETS} packets saved; delete one first` : ""}`;
    saveBtn.disabled = !n || !form.name.value.trim() || full;
  };
  form.addEventListener("input", update);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!parsed.questions.length) return;
    const packet = {
      id: Date.now().toString(36),
      name: form.name.value.trim().slice(0, 60),
      created: Date.now(),
      questions: parsed.questions,
    };
    if (!store.savePacket(packet)) {
      preview.textContent =
        "This browser’s storage is full. Delete a saved packet or shorten this one, then try again.";
      return;
    }
    dialog.close("save");
    onSaved?.(packet);
  });
  dialog.onclick = (event) => {
    if (event.target === dialog || event.target.closest("[data-close]")) dialog.close("cancel");
  };
  dialog.returnValue = "";
  dialog.showModal();
  form.text.focus();
}

/** List of saved packets with play and delete controls. */
export function packetsHTML() {
  const packets = store.packets;
  if (!packets.length) return "";
  return `
    <section class="packets" aria-labelledby="packets-title">
      <div class="packets-head">
        <h2 class="section-title" id="packets-title">Your packets</h2>
        <p class="muted small">Saved in this browser</p>
      </div>
      <ul class="packet-list">
        ${packets
          .map(
            (p) => `
          <li class="packet-card" data-packet="${esc(p.id)}">
            <div class="packet-info">
              <span class="packet-name">${esc(p.name)}</span>
              <span class="packet-meta">${fmt(p.questions.length)} question${p.questions.length === 1 ? "" : "s"} · added ${new Date(p.created).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}</span>
            </div>
            <div class="packet-actions">
              <button class="btn btn-primary btn-sm" data-action="packet-play">${icons.bolt}<span>Snappers</span></button>
              <button class="btn btn-secondary btn-sm" data-action="packet-lightning">${icons.clock}<span>Lightning</span></button>
              <button class="btn btn-ghost btn-sm" data-action="packet-delete" aria-label="Delete ${esc(p.name)}">${icons.trash}</button>
            </div>
          </li>`,
          )
          .join("")}
      </ul>
    </section>`;
}

/** Handle clicks on packet controls. Returns true when the click was for a packet. */
export function handlePacketAction(btn, rerender) {
  const card = btn.closest("[data-packet]");
  const packet = card && store.packets.find((p) => p.id === card.dataset.packet);
  if (!packet) return false;
  switch (btn.dataset.action) {
    case "packet-play":
      playPacket(packet, "snappers");
      return true;
    case "packet-lightning":
      playPacket(packet, "lightning");
      return true;
    case "packet-delete":
      if (btn.dataset.confirm) {
        store.deletePacket(packet.id);
        rerender();
      } else {
        btn.dataset.confirm = "1";
        btn.classList.add("is-danger");
        btn.innerHTML = `${icons.trash}<span>Delete?</span>`;
      }
      return true;
  }
  return false;
}
