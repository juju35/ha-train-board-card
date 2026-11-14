// Renders the cards with the mock station and saves the README screenshots (light and dark twins).
// Usage: npm install && npm run build && node scripts/screenshots/cards.mjs
import { pair, shoot } from "./harness.mjs";
import { ARRIVALS_ENTITY, boardHass, ENTITY, UK_ENTITY, ukHass } from "./mock.mjs";

const board = { entity: ENTITY, arrival_entity: ARRIVALS_ENTITY };
// Light theme: day picture; dark theme: night picture (illustration_theme: auto follows the sun, here the theme).
const SHOTS = {
  card: { tag: "train-board-card", config: board },
  "card-arrivals": { tag: "train-board-card", config: board, open: '[data-tab="arrivals"]' },
  "card-details": { tag: "train-board-card", config: board, open: '[data-train]:nth-child(2)' },
  "card-classic": { tag: "train-board-card", config: { ...board, illustration: false } },
  "card-uk": { tag: "train-board-card", config: { entity: UK_ENTITY }, hass: ukHass() },
  "mini-card": { tag: "train-board-mini-card", config: board, width: 380 },
  "mini-card-zoom": { tag: "train-board-mini-card", config: board, open: ".zoom" },
};

await shoot({
  shots: Object.entries(SHOTS).flatMap(([file, s]) => pair(file, { width: s.width })),
  setup: (s) => {
    const shot = SHOTS[s.file.replace(/-dark$/, "")];
    return { tag: shot.tag, hass: shot.hass ?? boardHass(), config: shot.config, open: shot.open };
  },
});
