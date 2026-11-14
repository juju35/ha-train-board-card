// Browser test (Chromium through Playwright) of the layout: at the widths a dashboard gives the cards, in long
// languages and both themes, the banner's text stops where the scene starts (nothing of the picture, and so no
// train, ever passes under it), the train stays right of the text in every frame of its animations, and nothing
// overflows the card. Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { withLogos } from "../scripts/brand-logos.mjs";
import { SOURCES } from "../scripts/sources.mjs";
import { ARRIVALS_ENTITY, boardHass, ENTITY } from "../scripts/screenshots/mock.mjs";

const root = new URL("../", import.meta.url).pathname;
const src = `{\n${SOURCES.map((n) => withLogos(readFileSync(new URL(`../src/${n}.js`, import.meta.url), "utf8"), root)).join("\n")}\n}`;
const THEMES = {
  light: { "--card-background-color": "#fff", "--primary-text-color": "#212121", "--secondary-text-color": "#727272" },
  dark: { "--card-background-color": "#1c1c1c", "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b" },
};
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement { constructor() { super();
  this.attachShadow({ mode: "open" }).innerHTML = "<style>:host{display:block;overflow:hidden;background:var(--card-background-color);color:var(--primary-text-color)}</style><slot></slot>"; } });`;

let browser;
let skip = false;
before(async () => {
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  } catch (err) {
    if (process.env.CI) throw err;
    skip = `Chromium not available: ${err.message.split("\n")[0]}`;
  }
});
after(() => browser?.close());

// Mounts every case on one page and measures it.
const measure = async (cases) => {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setContent("<!doctype html><body style='margin:0;font-family:Roboto,Arial,sans-serif'></body>");
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ content: src });
  const hass = boardHass();
  const out = await page.evaluate(
    ({ cases, hass, THEMES, ENTITY, ARRIVALS_ENTITY }) =>
      cases.map((c) => {
        const box = document.createElement("div");
        box.style.cssText = `width:${c.width}px;${Object.entries(THEMES[c.theme]).map(([k, v]) => `${k}:${v}`).join(";")}`;
        document.body.appendChild(box);
        const el = document.createElement(c.type);
        el.setConfig({ type: `custom:${c.type}`, entity: ENTITY, arrival_entity: ARRIVALS_ENTITY, language: c.lang, ...c.config });
        el.hass = { ...hass, themes: { darkMode: c.theme === "dark" } };
        box.appendChild(el);
        if (c.tab) el.shadowRoot.querySelector(`[data-tab="${c.tab}"]`).click();
        const sr = el.shadowRoot;
        const card = sr.querySelector("ha-card").getBoundingClientRect();
        const svg = sr.querySelector(".tb-scene");
        const text = sr.querySelector(".htext");
        const res = { name: JSON.stringify(c), overflow: [] };
        // Nothing sticks out of the card on the right.
        for (const n of sr.querySelectorAll(".htext *, .row *, .tabs *, .nt-meta *")) {
          const r = n.getBoundingClientRect();
          if (r.width && r.right > card.right + 0.5 && getComputedStyle(n).display !== "none") res.overflow.push(n.className?.baseVal ?? n.className);
        }
        if (svg && getComputedStyle(svg).display !== "none") {
          const s = svg.getBoundingClientRect();
          const scale = Math.min(s.width / 320, s.height / 78);
          res.sceneLeft = s.right - 170 * scale;
          res.textRight = Math.max(...[...text.querySelectorAll("*")].map((n) => n.getBoundingClientRect()).filter((r) => r.width).map((r) => r.right));
          // The train moves inside the group faded in from x 150 to 184 of the picture: left of the scene's start it
          // is fully transparent, whatever the frame of its animation.
          const group = sr.querySelector(".tb-move").closest("[mask]");
          const stop = group && sr.querySelector(group.getAttribute("mask").replace(/^url\((.*)\)$/, "$1"));
          const grad = stop && sr.querySelector(stop.querySelector("rect").getAttribute("fill").replace(/^url\((.*)\)$/, "$1"));
          res.fade = grad ? [Number(grad.getAttribute("x1")), grad.querySelector("stop").getAttribute("stop-opacity")] : null;
        }
        return res;
      }),
    { cases, hass, THEMES, ENTITY, ARRIVALS_ENTITY },
  );
  await page.close();
  assert.deepEqual(errors, []);
  return out;
};

const cases = [];
for (const lang of ["en", "de", "el", "ru"])
  for (const theme of ["light", "dark"]) {
    for (const width of [320, 380, 460, 620]) cases.push({ type: "train-board-card", width, lang, theme });
    cases.push({ type: "train-board-card", width: 460, lang, theme, tab: "arrivals" });
    for (const width of [300, 380, 460]) cases.push({ type: "train-board-mini-card", width, lang, theme });
  }

test("the banner's text stops where the scene starts, and the train stays right of it", async (t) => {
  if (skip) return t.skip(skip);
  for (const r of await measure(cases)) {
    if (r.sceneLeft === undefined) continue;
    assert.ok(r.textRight <= r.sceneLeft + 0.5, `${r.name}: text to ${r.textRight}, scene from ${r.sceneLeft}`);
    // The train shows only right of the fade's start, x 150 of the picture: the scene's start.
    assert.deepEqual(r.fade, [150, "0"], r.name);
  }
});

test("nothing overflows the card", async (t) => {
  if (skip) return t.skip(skip);
  for (const r of await measure(cases)) assert.deepEqual(r.overflow, [], r.name);
});

test("a narrow card keeps the sky alone: no scene beside text that would not fit", async (t) => {
  if (skip) return t.skip(skip);
  const [r] = await measure([{ type: "train-board-mini-card", width: 280, lang: "en", theme: "light" }]);
  assert.equal(r.sceneLeft, undefined);
});
