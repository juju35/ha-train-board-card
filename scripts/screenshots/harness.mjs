// Shared by the screenshot scripts: theme variables, the <ha-card> stand-in, a frozen clock and the render loop.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

export const root = fileURLToPath(new URL("../..", import.meta.url));
// Read on first use: the tests import writeIfChanged without a built bundle.
let bundle;
const cardJs = () => (bundle ??= readFileSync(`${root}dist/train-board-card.js`, "utf8"));

// Every shot is taken at this time (UTC, the mock's time zone): the times on the board never change a picture.
export const CLOCK = Date.parse("2026-11-14T08:00:00Z");

const THEMES = {
  light: {
    "--primary-background-color": "#e8eaed", "--secondary-background-color": "#ececec", "--card-background-color": "#ffffff",
    "--primary-text-color": "#212121", "--secondary-text-color": "#727272", "--divider-color": "rgba(0,0,0,.12)",
  },
  dark: {
    "--primary-background-color": "#111111", "--secondary-background-color": "#282828", "--card-background-color": "#1c1c1c",
    "--primary-text-color": "#e1e1e1", "--secondary-text-color": "#9b9b9b", "--divider-color": "rgba(225,225,225,.12)",
  },
};
const COMMON = {
  "--primary-color": "#03a9f4", "--success-color": "#43a047", "--warning-color": "#ffa600", "--error-color": "#db4437",
  "--text-primary-color": "#ffffff",
};

// Like Home Assistant's <ha-card>: the theme's background, border and radius.
const HA_CARD = `customElements.define("ha-card", class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" }).innerHTML =
      "<style>:host{display:block;background:var(--ha-card-background,var(--card-background-color));" +
      "border-radius:var(--ha-card-border-radius,12px);border-style:solid;border-width:var(--ha-card-border-width,1px);" +
      "border-color:var(--ha-card-border-color,var(--divider-color));box-shadow:var(--ha-card-box-shadow,none);" +
      "color:var(--primary-text-color);overflow:hidden}</style><slot></slot>";
  }
});`;

// Date.now() and new Date() read the frozen clock; dates given explicitly are untouched.
const FROZEN = `(() => { const R = Date; const T = ${CLOCK};
  class D extends R { constructor(...a) { super(...(a.length ? a : [T])); } static now() { return T; } }
  window.Date = D; })();`;

const pageHtml = (theme, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  :root { ${Object.entries({ ...THEMES[theme], ...COMMON }).map(([k, v]) => `${k}:${v};`).join("")} }
  body { margin: 0; padding: 16px; background: var(--primary-background-color); color: var(--primary-text-color);
         font-family: Roboto, "Segoe UI", Helvetica, Arial, sans-serif; width: ${width}px; }
</style></head><body><div id="root"></div></body></html>`;

// A light shot and its dark twin: pair("card", { … }).
export const pair = (file, extra = {}) => [
  { file, theme: "light", ...extra },
  { file: `${file}-dark`, theme: "dark", ...extra },
];

export const launch = () => chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// A page ready to host a card: theme variables, the <ha-card> stand-in, the frozen clock and the card bundle.
// A new page per shot: the bundle declares top-level names, which cannot be evaluated twice in one page.
export const openPage = async (browser, { theme, width, label = "" }) => {
  const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1000, height: 1400 }, timezoneId: "Europe/Paris", locale: "en-US" });
  page.on("pageerror", (err) => console.error(`pageerror${label ? ` (${label})` : ""}: ${err.message}`));
  await page.setContent(pageHtml(theme, width));
  await page.addScriptTag({ content: FROZEN + HA_CARD });
  await page.addScriptTag({ content: cardJs() });
  return page;
};

// Creates the card in the page; `open` (a selector) is clicked once rendered.
export const mountCard = (page, { tag, hass, config, dark = false, open = null }) =>
  page.evaluate(
    ({ tag, hass, config, dark, open }) => {
      const el = document.createElement(tag);
      el.setConfig({ type: `custom:${tag}`, ...config });
      el.hass = { ...hass, themes: { darkMode: dark }, callService: async () => {} };
      document.getElementById("root").appendChild(el);
      // A mouse click (detail 1), not a keyboard one: no focus ring left in the shot.
      for (const sel of [].concat(open || [])) el.shadowRoot.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true, detail: 1 }));
    },
    { tag, hass, config, dark, open },
  );

// The card on the theme background, with the body's 16 px padding around it; `height` crops it (the banner).
export const cardClip = async (page, width, height) => {
  const box = await page.locator("#root").boundingBox();
  return { x: 0, y: 0, width: width + 32, height: height ? height + 16 : Math.ceil(box.height) + 32 };
};

// Writes a PNG screenshot to `path` only when its pixels differ from the file already there (PNG bytes vary from
// one run or machine to the next). Both images are decoded by the page's browser and compared pixel by pixel.
export const writeIfChanged = async (page, path, png) => {
  if (existsSync(path)) {
    const same = await page.evaluate(
      async ([a, b]) => {
        const pixels = async (b64) => {
          const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
          const bmp = await createImageBitmap(blob, { colorSpaceConversion: "none", premultiplyAlpha: "none" });
          const ctx = new OffscreenCanvas(bmp.width, bmp.height).getContext("2d");
          ctx.drawImage(bmp, 0, 0);
          return { w: bmp.width, h: bmp.height, d: ctx.getImageData(0, 0, bmp.width, bmp.height).data };
        };
        const [x, y] = await Promise.all([pixels(a), pixels(b)]);
        if (x.w !== y.w || x.h !== y.h) return false;
        for (let i = 0; i < x.d.length; i++) if (x.d[i] !== y.d[i]) return false;
        return true;
      },
      [readFileSync(path).toString("base64"), png.toString("base64")],
    );
    if (same) return false;
  }
  writeFileSync(path, png);
  return true;
};

// Renders each shot ({ file, theme, … }) into screenshots/<file>.png; `setup(shot)` returns { tag, hass, config, open? }.
// Animations are frozen at their start (the train at the platform).
export const shoot = async ({ shots, setup }) => {
  const browser = await launch();
  for (const s of shots) {
    const width = s.width ?? 460;
    const { tag, hass, config, open } = setup(s);
    const page = await openPage(browser, { theme: s.theme, width, label: s.file });
    await mountCard(page, { tag, hass, config, dark: s.theme === "dark", open });
    await page.waitForTimeout(300);
    const out = `screenshots/${s.file}.png`;
    const png = await page.screenshot({ clip: await cardClip(page, width), animations: "disabled" });
    console.log(`${out}${(await writeIfChanged(page, `${root}${out}`, png)) ? "" : " (unchanged)"}`);
    await page.close();
  }
  await browser.close();
};
