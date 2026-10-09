// Entry point: hash router, theme handling and global header controls.

import { store } from "./store.js";
import { icons } from "./icons.js";
import { $, $$ } from "./dom.js";
import { mountHome } from "./views/home.js";
import { mountSetup } from "./views/setup.js";
import { mountPlay } from "./views/play.js";
import { mountResults } from "./views/results.js";
import { mountBank } from "./views/bank.js";
import { mountStats } from "./views/stats.js";
import { openSettings } from "./views/settings.js";

const ROUTES = {
  "": { mount: mountHome, title: "Reach for the Top Practice" },
  practice: { mount: mountSetup, title: "Practise", nav: "practice" },
  play: { mount: mountPlay, title: "Playing", nav: "practice" },
  results: { mount: mountResults, title: "Results", nav: "practice" },
  bank: { mount: mountBank, title: "Question Bank", nav: "bank" },
  stats: { mount: mountStats, title: "Stats", nav: "stats" },
};

const app = $("#app");
let unmount = null;
let firstRender = true;

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, query = ""] = raw.split("?");
  const [name = "", ...params] = path.split("/").filter(Boolean);
  return { name, params, query: new URLSearchParams(query) };
}

function render() {
  const { name, params, query } = parseHash();
  const route = ROUTES[name] ?? ROUTES[""];

  unmount?.();
  unmount = null;
  app.innerHTML = "";
  document.body.dataset.route = name || "home";
  document.title = `${route.title} · Summit`;
  $$(".main-nav a").forEach((a) => a.classList.toggle("is-active", a.dataset.nav === route.nav));

  // Each view gets a fresh element so listeners it attaches are discarded with it.
  const viewRoot = document.createElement("div");
  viewRoot.className = "view";
  app.append(viewRoot);
  unmount = route.mount(viewRoot, { params, query }) || null;

  if (!firstRender) {
    window.scrollTo({ top: 0 });
    app.focus({ preventScroll: true });
  }
  firstRender = false;
}

/* ---- Theme ---- */

const systemDark = matchMedia("(prefers-color-scheme: dark)");

function applyTheme() {
  const pref = store.settings.theme;
  const dark = pref === "dark" || (pref === "system" && systemDark.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  $('meta[name="theme-color"]').content = dark ? "#0c0c0e" : "#fafaf8";
  const toggle = $('[data-action="toggle-theme"]');
  toggle.innerHTML = dark ? icons.sun : icons.moon;
  toggle.setAttribute("aria-label", dark ? "Switch to light theme" : "Switch to dark theme");
}

systemDark.addEventListener("change", applyTheme);
store.onSettingsChange(applyTheme);

$('[data-action="toggle-theme"]').addEventListener("click", () => {
  const dark = document.documentElement.dataset.theme === "dark";
  store.updateSettings({ theme: dark ? "light" : "dark" });
});

const settingsBtn = $('[data-action="open-settings"]');
settingsBtn.innerHTML = icons.settings;
settingsBtn.addEventListener("click", openSettings);

applyTheme();
window.addEventListener("hashchange", render);
render();
