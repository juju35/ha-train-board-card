// Records the animations into screenshots/*.gif (needs ffmpeg): the train leaving (Departures, day), coming in
// (Arrivals, day), the night picture, and the mini card.
// Usage: npm install && npm run build && node scripts/screenshots/animations.mjs
// CSS animations are paused and stepped frame by frame, each by a fraction of its own cycle, so every GIF loops
// cleanly whatever the machine's speed.
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cardClip, launch, mountCard, openPage, root } from "./harness.mjs";
import { ARRIVALS_ENTITY, boardHass, ENTITY } from "./mock.mjs";

const FPS = 15;
// One cycle of the train (tb-depart / tb-arrive), in seconds.
const CYCLE = 9;

const frameName = (i) => `f${String(i).padStart(3, "0")}.png`;

// Every decoded frame (RGBA) and its timing, as ffmpeg's per-frame MD5 list: equal lists, same animation.
const decodedFrames = (file) =>
  execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-pix_fmt", "rgba", "-f", "framemd5", "-"], { encoding: "utf8" })
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .join("\n");

// A deterministic GIF: frames stepped in paused animations, palette from those frames only, ordered dithering,
// bit-exact muxing. The file in place is only replaced when its decoded frames differ.
const encode = (dir, out, width) => {
  const gif = join(dir, "out.gif");
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%03d.png"),
    "-vf", `scale=${width + 32}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`,
    "-fflags", "+bitexact", "-flags", "+bitexact", "-loop", "0", gif,
  ]);
  const target = `${root}${out}`;
  const same = existsSync(target) && decodedFrames(target) === decodedFrames(gif);
  if (!same) copyFileSync(gif, target);
  console.log(`${out}${same ? " (unchanged)" : ""}`);
};

// Steps every CSS animation of the page to `frac` of the train's cycle (the clock hand and the stars, on other
// periods, are stepped by the same time; their cycles divide it or barely show).
const step = (page, seconds) =>
  page.evaluate((t) => {
    const anims = [];
    const walk = (r) => {
      for (const el of r.querySelectorAll("*")) {
        anims.push(...el.getAnimations());
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    for (const a of anims) {
      a.pause();
      a.currentTime = t * 1000;
    }
  }, seconds);

const record = async (browser, { file, theme, tag, config, open, width = 460, banner }) => {
  const page = await openPage(browser, { theme, width, label: file });
  await mountCard(page, { tag, hass: boardHass(), config, dark: theme === "dark", open });
  await page.waitForTimeout(300);
  const clip = await cardClip(page, width, banner);
  const dir = mkdtempSync(join(tmpdir(), "tb-frames-"));
  const frames = FPS * CYCLE;
  for (let i = 0; i < frames; i++) {
    await step(page, (i / frames) * CYCLE);
    await page.screenshot({ path: join(dir, frameName(i)), clip, animations: "allow" });
  }
  encode(dir, `screenshots/${file}.gif`, width);
  rmSync(dir, { recursive: true });
  await page.close();
};

const board = { entity: ENTITY, arrival_entity: ARRIVALS_ENTITY };
const browser = await launch();
// The full card's banner and tabs only (the list does not move).
await record(browser, { file: "departure", theme: "light", tag: "train-board-card", config: { ...board, illustration_theme: "day" }, banner: 152 });
await record(browser, { file: "arrival", theme: "light", tag: "train-board-card", config: { ...board, illustration_theme: "day" }, open: '[data-tab="arrivals"]', banner: 152 });
await record(browser, { file: "night", theme: "dark", tag: "train-board-card", config: { ...board, illustration_theme: "night" }, banner: 152 });
await record(browser, { file: "mini", theme: "light", tag: "train-board-mini-card", config: { ...board, illustration_theme: "day" }, width: 380 });
await browser.close();
