// Builds src/ into the single Marketplace file dist/train-board-card.js, stamping the package version.
// Usage: node scripts/build.mjs  (dist/ is not committed: CI and the release workflow build it)
// The sources are concatenated in this order inside one block, so that nothing leaks into the page.
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { splitDist } from "./i18n-split.mjs";
import { withLogos } from "./brand-logos.mjs";
import { SOURCES } from "./sources.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
const src = (name) => withLogos(readFileSync(`${root}src/${name}.js`, "utf8").replaceAll("__VERSION__", pkg.version), root);

const out = [`/*! ha-train-board-card v${pkg.version} — https://github.com/juju35/ha-train-board-card */`, "{", ...SOURCES.map(src), "}", ""].join("\n");

mkdirSync(`${root}dist`, { recursive: true });
writeFileSync(`${root}dist/train-board-card.js`, out);
console.log(`Built dist/train-board-card.js (${(out.length / 1024).toFixed(1)} KB)`);

// Translations: English stays in the bundle, each other language goes to dist/train-board-card.i18n.<lang>.js,
// fetched when a card needs it (scripts/i18n-split.mjs).
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) splitDist(`${root}dist`, "train-board-card.js", { version: pkg.version });
