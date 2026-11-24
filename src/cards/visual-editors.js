// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------
import { tbLang, tbT } from "./train-board-card.js";
import { TB_DEFAULTS } from "./board.js";

export const TB_TOGGLES = ["illustration", "show_departures", "show_arrivals", "show_platform", "show_train_number", "show_via", "hide_cancelled", "show_messages"];

// The entity picker lists what the card can read: the sensors of a supported integration and those recognised by
// their attributes only (template, REST). Scanning every state is memoised on the entity registry and the number of
// states, so that the editor does not walk them at each state change.
export const _tbPickerMemo = new WeakMap();
export const tbPickerEntities = (hass) => {
  const reg = hass?.entities || {};
  const n = Object.keys(hass?.states || {}).length;
  const hit = _tbPickerMemo.get(reg);
  if (hit && hit.n === n) return hit.ids;
  const ids = tbCandidates(hass);
  _tbPickerMemo.set(reg, { n, ids });
  return ids;
};

export class TbEditorBase extends HTMLElement {
  static get extraToggles() {
    return [];
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _toggles() {
    return [...TB_TOGGLES, ...this.constructor.extraToggles];
  }

  _schema() {
    const tr = (k) => tbT(this._hass, this._config, k);
    const found = tbPickerEntities(this._hass);
    // The configured entities stay selectable even when they are unavailable; with nothing found, the integration filter.
    const ids = [...new Set([...found, this._config.entity, this._config.arrival_entity].filter(Boolean))];
    const entity = ids.length
      ? { entity: { domain: "sensor", include_entities: ids } }
      : { entity: { filter: TB_ADAPTERS.map((a) => ({ integration: a.id, domain: "sensor" })) } };
    const select = (options) => ({ select: { mode: "dropdown", options } });
    return [
      { name: "entity", selector: entity },
      { name: "arrival_entity", selector: entity },
      { name: "integration", selector: select([{ value: "", label: tr("integration_auto") }, ...TB_ADAPTERS.map((a) => ({ value: a.id, label: a.name }))]) },
      { name: "title", selector: { text: {} } },
      {
        type: "grid",
        name: "",
        schema: [
          { name: "illustration_theme", selector: select(["auto", "day", "night"].map((v) => ({ value: v, label: tr(`theme_${v}`) }))) },
          { name: "default_tab", selector: select(["departures", "arrivals"].map((v) => ({ value: v, label: tr(v) }))) },
          { name: "max_trains", selector: { number: { min: 1, max: 30, step: 1, mode: "box" } } },
        ],
      },
      { type: "grid", name: "", schema: this._toggles().map((name) => ({ name, selector: { boolean: {} } })) },
      { name: "platforms", selector: { text: {} } },
      { name: "train_types", selector: { text: {} } },
      { name: "language", selector: select([{ value: "", label: tr("lang_auto") }, ...TB_LANGUAGES.map(([value, label]) => ({ value, label }))]) },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => tbT(this._hass, this._config, s.name);
      this._form.computeHelper = (s) => TB_STRINGS[tbLang(this._hass, this._config)][`${s.name}_helper`] ?? TB_STRINGS.en[`${s.name}_helper`];
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        for (const [k, v] of Object.entries(config)) {
          // Keep the YAML minimal: no empty values, nothing left at its default.
          if (v === "" || v === undefined || v === null || (k in TB_DEFAULTS && v === TB_DEFAULTS[k])) delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    const data = { ...this._config };
    for (const k of [...this._toggles(), "illustration_theme", "default_tab", "max_trains"]) if (data[k] === undefined) data[k] = TB_DEFAULTS[k];
    // Lists written in YAML show as text in the form.
    for (const k of ["platforms", "train_types"]) if (Array.isArray(data[k])) data[k] = data[k].join(", ");
    this._form.hass = this._hass;
    this._form.data = data;
    this._form.schema = this._schema();
  }
}

export class TrainBoardCardEditor extends TbEditorBase {}

export class TrainBoardMiniCardEditor extends TbEditorBase {
  // The detail button, then every option of the full board, shown by the unfolded view.
  static get extraToggles() {
    return ["zoom"];
  }
}
