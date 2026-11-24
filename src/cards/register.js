// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
import { pickerDefine } from "./card-picker.js";
import { VERSION } from "./train-board-card.js";
import { TrainBoardCard, TrainBoardMiniCard } from "./cards-2.js";
import { TrainBoardCardEditor, TrainBoardMiniCardEditor } from "./visual-editors.js";

export const tbDefine = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
tbDefine("train-board-card", TrainBoardCard);
tbDefine("train-board-mini-card", TrainBoardMiniCard);
tbDefine("train-board-card-editor", TrainBoardCardEditor);
tbDefine("train-board-mini-card-editor", TrainBoardMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  {
    type: "train-board-card",
    name: "Train Board Card",
    description: "Animated departures and arrivals board of a railway station (DB Infoscreen, National Rail, Swiss Transport, NS, Trafikverket…).",
  },
  {
    type: "train-board-mini-card",
    name: "Train Board Mini Card",
    description: "The next train of a station on an animated banner, with a detail button for the full board.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-train-board-card" });
}

console.info(
  `%c TRAIN-BOARD-CARD %c v${VERSION} `,
  "color: white; background: #2f7de1; font-weight: 700;",
  "color: #2f7de1; background: white; font-weight: 700;",
);
