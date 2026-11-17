// Browser test (Chromium through Playwright) of the layout: at the widths a dashboard gives the cards, in long
// languages and both themes, the banner's text stops where the scene starts (nothing of the picture, and so no
// train, ever passes under it), the train stays right of the text in every frame of its animations, and nothing
// overflows the card. Skipped when Playwright or Chromium is not installed, except in CI, where it must run.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { withLogos } from "../scripts/brand-logos.mjs";
import { SOURCES } from "../scripts/sources.mjs";
import { CLOCK } from "../scripts/screenshots/harness.mjs";
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
  // The mock board's clock: its trains are still to come.
  await page.clock.setFixedTime(new Date(CLOCK));
  await page.setContent("<!doctype html><body style='margin:0;font-family:Roboto,Arial,sans-serif'></body>");
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ content: src });
  const hass = boardHass();
  const out = await page.evaluate(
    async ({ cases, hass, THEMES, ENTITY, ARRIVALS_ENTITY }) => {
      // Sequential, each card measured two frames after it was mounted (the card fits its status pill on the
      // resize observer's first notice, as in Home Assistant).
      const all = [];
      for (const c of cases)
        all.push(
          await (async () => {
        const box = document.createElement("div");
        box.style.cssText = `width:${c.width}px;${Object.entries(THEMES[c.theme]).map(([k, v]) => `${k}:${v}`).join(";")}`;
        document.body.appendChild(box);
        const el = document.createElement(c.type);
        el.setConfig({ type: `custom:${c.type}`, entity: ENTITY, arrival_entity: ARRIVALS_ENTITY, language: c.lang, ...c.config });
        el.hass = { ...hass, themes: { darkMode: c.theme === "dark" } };
        box.appendChild(el);
        if (c.tab) el.shadowRoot.querySelector(`[data-tab="${c.tab}"]`).click();
        if (c.zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const sr = el.shadowRoot;
        const card = sr.querySelector("ha-card").getBoundingClientRect();
        const svg = sr.querySelector(".tb-scene");
        const text = sr.querySelector(".htext");
        const res = { name: JSON.stringify(c), overflow: [] };
        // The header's status pill shown (one of the mini card's pair is hidden): its label whole, or the dot alone
        // on purpose; on the title row or under it; its share of the title block; the title still readable.
        const rect = (n) => n.getBoundingClientRect();
        const pill = [...sr.querySelectorAll(".htext .hpill, .header .hpill")].find((n) => n.getClientRects().length > 0);
        if (pill) {
          const txt = pill.querySelector(".txt");
          const block = pill.closest(".titles");
          const title = block.querySelector(".name, .nt-time b");
          const mid = (n) => (rect(n).top + rect(n).bottom) / 2;
          res.pill = {
            cut: txt.scrollWidth > txt.clientWidth + 0.5,
            dotOnly: getComputedStyle(txt).position === "absolute",
            inside: rect(pill).right <= rect(block).right + 0.5 && rect(pill).bottom <= card.bottom,
            onTitleRow: Math.abs(mid(pill) - mid(title)) < 4,
            // Whether the whole pill fits on the title row beside the title cut down to 4 characters (or the clock).
            fits: (() => {
              const ctx = document.createElement("canvas").getContext("2d");
              const cs = getComputedStyle(title);
              ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
              const four = title.matches(".name") ? Math.min(title.scrollWidth, ctx.measureText(`${[...title.textContent.trim()].slice(0, 4).join("")}…`).width) : rect(title).width;
              return four + 8 + rect(pill).width <= rect(block).right - rect(title).left - 1;
            })(),
            titleFull: title.scrollWidth,
            label: pill.getAttribute("title"),
            titleWidth: rect(title).width,
            ch: parseFloat(getComputedStyle(title).fontSize) * 2,
          };
        }
        // The round icon of the header: 40 px on both cards, its badge inside the banner.
        const logo = sr.querySelector(".htext .logo");
        if (logo) {
          const l = logo.getBoundingClientRect();
          const b = logo.querySelector(".badge")?.getBoundingClientRect();
          const banner = sr.querySelector(".banner").getBoundingClientRect();
          res.logo = [Math.round(l.width), Math.round(l.height)];
          res.badgeInside = !b || (b.left >= banner.left && b.bottom <= banner.bottom && b.top >= banner.top);
        }
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
          })(),
        );
      return all;
    },
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

test("the header's round icon is 40 px on the full and the mini card, its brand badge inside the banner", async (t) => {
  if (skip) return t.skip(skip);
  for (const r of await measure(cases)) {
    assert.deepEqual(r.logo, [40, 40], r.name);
    assert.ok(r.badgeInside, r.name);
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

test("every header has its status pill: whole label from 245 px, on the title row when it fits, the dot alone at 200 px", async (t) => {
  if (skip) return t.skip(skip);
  const all = [];
  for (const lang of ["en", "fr", "de", "el", "ru", "pl"])
    for (const theme of ["light", "dark"]) {
      for (const width of [200, 245, 300, 380, 460, 500]) {
        all.push({ type: "train-board-card", width, lang, theme });
        all.push({ type: "train-board-card", width, lang, theme, config: { illustration: false } });
        all.push({ type: "train-board-mini-card", width, lang, theme });
        all.push({ type: "train-board-mini-card", width, lang, theme, config: { illustration: false } });
        all.push({ type: "train-board-mini-card", width, lang, theme, zoom: true });
        // No train to show: the station and the board's pill.
        all.push({ type: "train-board-mini-card", width, lang, theme, config: { platforms: "99" } });
      }
    }
  for (const r of await measure(all)) {
    const c = JSON.parse(r.name);
    assert.ok(r.pill, `no status pill: ${r.name}`);
    assert.ok(r.pill.inside, `pill outside its block: ${r.name}`);
    assert.ok(r.pill.titleWidth + 0.5 >= Math.min(r.pill.ch, r.pill.titleFull), `title ${r.pill.titleWidth} px: ${r.name}`);
    if (c.width <= 200) assert.ok(r.pill.dotOnly, `the dot alone: ${r.name}`);
    else {
      assert.ok(!r.pill.dotOnly && !r.pill.cut, `pill « ${r.pill.label} » cut: ${r.name}`);
      // Under the statistics (or on the mini card's last row) only when it cannot sit beside the title cut down to 4
      // characters, or beside the clock; on the title row of the full card ("Central Station") from 460 px.
      if (!r.pill.onTitleRow && r.pill.fits) assert.fail(`pill not beside the title although it fits there: ${r.name}`);
      if (c.lang === "en" && c.width >= 460 && (c.type === "train-board-card" || c.zoom)) assert.ok(r.pill.onTitleRow, `pill not beside the title: ${r.name}`);
    }
  }
});

test("the mini card's detail button sits in the banner's top right corner: 24 px, 5 px from its edges", async (t) => {
  if (skip) return t.skip(skip);
  const page = await browser.newPage({ viewport: { width: 1000, height: 600 } });
  await page.setContent("<!doctype html><body style='margin:0'></body>");
  await page.addScriptTag({ content: HA_CARD });
  await page.addScriptTag({ content: src });
  const hass = boardHass();
  for (const zoom of [false, true]) {
    const r = await page.evaluate(
      ({ hass, ENTITY, zoom }) => {
        document.body.innerHTML = "<div style='width:380px'></div>";
        const el = document.createElement("train-board-mini-card");
        el.setConfig({ type: "custom:train-board-mini-card", entity: ENTITY });
        el.hass = hass;
        document.body.firstChild.appendChild(el);
        if (zoom) el.shadowRoot.querySelector(".zoom").dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
        const b = el.shadowRoot.querySelector(".zoom").getBoundingClientRect();
        const banner = el.shadowRoot.querySelector(".banner").getBoundingClientRect();
        return [Math.round(b.width), Math.round(b.height), Math.round(b.top - banner.top), Math.round(banner.right - b.right)];
      },
      { hass, ENTITY, zoom },
    );
    assert.deepEqual(r, [24, 24, 5, 5], `zoomed: ${zoom}`);
  }
  await page.close();
});
