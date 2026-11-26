// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
import { TB_BRAND_LOGOS, TB_ICONS, tbClock, tbDeviceEntities, tbEsc, tbFill, tbFmtLang, tbIcon, tbPlural, tbT } from "./train-board-card.js";
import { tbBoard, tbBoardStatus, tbColor, tbDayOf, tbIsNight, tbOpt, tbSafeColor, tbStatus } from "./board.js";
import { tbCssEsc, tbInDialog, tbMorph, tbTextWidth, tbWatchOutside } from "./in-place-updates.js";
import { TB_BANNER_STYLE, TB_BASE_STYLE, TB_DIALOG_STYLE, TB_FULL_STYLE, TB_MINI_STYLE } from "./styles.js";

export let _tbUid = 0;

export class TbBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._uid = ++_tbUid;
    this._html = "";
    this._tab = null;
    this._popup = null;
    this.shadowRoot.addEventListener("click", (ev) => this._click(ev));
    // Keyboard: Enter or Space on a focusable element that is not a button acts as a click.
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
    // Escape closes the popup, listened on the window while it is open (a re-render can take the focus away).
    this._onKey = (ev) => {
      if (ev.key === "Escape" && this._popup) {
        ev.stopPropagation();
        this._closePopup(true);
      }
    };
    // A click elsewhere on the page closes the popup.
    this._onPopupOutside = (ev) => {
      if (this._popup && !ev.composedPath().includes(this) && !tbInDialog(ev)) {
        this._popupClosedBy = ev;
        this._closePopup(false);
      }
    };
  }

  connectedCallback() {
    (this._popupWatch ??= tbWatchOutside(this, (ev) => this._onPopupOutside(ev))).on();
    // A new width (or the web font loaded): the status pill is fitted again, in the next frame.
    if (typeof ResizeObserver === "function") {
      this._resize ??= new ResizeObserver((entries) => {
        const w = Math.round(entries.at(-1).contentRect.width);
        if (w === this._fitWidth) return;
        this._fitWidth = w;
        cancelAnimationFrame(this._fitFrame);
        this._fitFrame = requestAnimationFrame(() => this._fitPill());
      });
      this._resize.observe(this);
    }
    document.fonts?.ready?.then(() => this._fitPill());
    // Relative times (« in 8 min », boarding, trains gone) follow the clock, not only the states.
    clearInterval(this._timer);
    this._timer = setInterval(() => this._tick(), 20000);
    this._update();
    this._fitPill();
  }

  disconnectedCallback() {
    this._popupWatch?.off();
    clearInterval(this._timer);
    this._timer = null;
    this._resize?.disconnect();
    this._fitWidth = null;
    if (this._fitFrame) cancelAnimationFrame(this._fitFrame);
    // Left (another view, a conditional card hidden): back to its default state, without its popup.
    this._popup = null;
    this._tab = null;
    window.removeEventListener("keydown", this._onKey);
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._html = "";
    this._tab = null;
    this._popup = null;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    const sig = this._signature();
    if (this._sig && sig.length === this._sig.length && sig.every((v, i) => v === this._sig[i])) return;
    this._update(sig);
  }

  get hass() {
    return this._hass;
  }

  _t(key) {
    return tbT(this._hass, this._config, key);
  }

  // What the render depends on: the entities shown (and the siblings of the integrations spread over several
  // sensors), the language and dark mode, and the clock to the half minute.
  _signature() {
    const h = this._hass;
    const c = this._config;
    const sig = [h.language, h.locale, h.themes?.darkMode, h.entities, Math.floor(Date.now() / 30000)];
    for (const id of [c.entity, c.arrival_entity]) {
      if (!id) continue;
      sig.push(h.states[id]);
      const device = h.entities?.[id]?.device_id;
      if (device && /^(trafikverket_train|swiss_public_transport)$/.test(h.entities[id].platform || ""))
        for (const eid of tbDeviceEntities(h.entities, device)) sig.push(h.states[eid]);
    }
    return sig;
  }

  _tick() {
    if (!this._hass || !this._config) return;
    this.hass = this._hass;
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    this._sig = sig ?? this._signature();
    const html = this._render();
    if (html === this._html) return;
    this._html = html;
    tbMorph(this.shadowRoot, html);
    this._fitPill();
  }

  // The header's status pill goes right after the title (the mini card: the time), on its row, only while the title
  // stays whole and the pill's whole label fits beside it; otherwise it takes a line of its own under the subtitle
  // (.below), the title whole on its row (cut only when it does not fit alone). There, in the banner, the statistics
  // keep one line; if the text still does not fit above the track strip, the pill keeps its dot alone (.dot-only, its
  // label in its tooltip and for screen readers). Measured after each render and on each new width, whatever the
  // language: no fixed width threshold.
  _fitPill() {
    // Home Assistant's <ha-card> (a Lit element) shows its content only from its first update, a microtask after it
    // is connected: measured before, everything is 0 px wide and the pill lands on the wrong line. Fitted then.
    const haCard = this.shadowRoot?.querySelector?.("ha-card");
    if (haCard && haCard.hasUpdated === false) {
      this._pillWait ??= (haCard.updateComplete?.then ? haCard.updateComplete : new Promise((r) => requestAnimationFrame(r))).then(() => {
        this._pillWait = null;
        this._fitPill();
      });
      return;
    }
    if (!this.isConnected) return;
    for (const t of this.shadowRoot?.querySelectorAll?.(".titles") || []) {
      // The full card's title row, else the mini card's time row (its pill in the « wide » span).
      const chip = t.querySelector(".trow > .chip, .nt-time > .wide > .chip");
      if (!chip?.getBoundingClientRect) continue;
      t.classList.remove("below", "dot-only");
      const row = chip.closest(".trow, .nt-time");
      const name = row.firstElementChild;
      const shown = name && name !== chip && getComputedStyle(name).display !== "none";
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      // The clock keeps its width; a title counts whole.
      const title = !shown ? 0 : (name.matches(".name") ? tbTextWidth(name) : name.getBoundingClientRect().width) + gap;
      if (title + chip.getBoundingClientRect().width > t.getBoundingClientRect().width - 0.5) {
        t.classList.add("below");
        const banner = t.closest(".banner");
        if (banner) {
          const b = banner.getBoundingClientRect();
          const track = parseFloat(getComputedStyle(banner).getPropertyValue("--tb-track-h")) || 10;
          // Each element as it shows: its box cut by its ancestors that hide their overflow (a clamped line).
          const out = [...t.querySelectorAll("*")].some((n) => {
            let { top, bottom } = n.getBoundingClientRect();
            for (let p = n.parentElement; p && p !== t; p = p.parentElement) {
              if (getComputedStyle(p).overflowY === "visible") continue;
              top = Math.max(top, p.getBoundingClientRect().top);
              bottom = Math.min(bottom, p.getBoundingClientRect().bottom);
            }
            return bottom - top > 0.5 && (top < b.top - 0.5 || bottom > b.bottom - track + 0.5);
          });
          if (out) t.classList.add("dot-only");
        }
      }
    }
  }

  // The tab shown: the one picked, else the configured default, else the first one that exists.
  _activeTab(board) {
    const want = this._tab || tbOpt(this._config, "default_tab");
    if (board.tabs[want]) return want;
    return board.tabs.departures ? "departures" : "arrivals";
  }

  _click(ev) {
    const path = ev.composedPath();
    const action = path.find((n) => n.dataset?.action || n.dataset?.tab || n.dataset?.train);
    if (!action) return;
    const d = action.dataset;
    if (this._popup) {
      // While the popup is open, only its close button and the backdrop act.
      if (d.action === "close-popup" && (action.tagName === "BUTTON" || path[0] === action)) this._closePopup(true);
      return;
    }
    if (d.tab) {
      this._tab = d.tab;
      this._update();
    } else if (d.train) this._openPopup({ train: d.train, tab: this._activeTab(tbBoard(this._hass, this._config)), opener: `[data-train="${tbCssEsc(d.train)}"]` }, ev);
    else if (d.action === "notices") this._openPopup({ notices: true, opener: ".notice" }, ev);
  }

  _openPopup(p, ev) {
    this._popup = p;
    window.addEventListener("keydown", this._onKey);
    this._update();
    // Opened from the keyboard (no click count): the focus goes to its close button.
    if (ev?.detail === 0) this.shadowRoot.querySelector?.(".modal .iconbtn")?.focus({ preventScroll: true });
  }

  _closePopup(refocus) {
    if (!this._popup) return;
    const opener = this._popup.opener;
    this._popup = null;
    window.removeEventListener("keydown", this._onKey);
    this._update();
    if (refocus && opener) this.shadowRoot.querySelector?.(opener)?.focus({ preventScroll: true });
  }

  _name(board) {
    return this._config.title || board.station || this._hass.states[this._config.entity]?.attributes?.friendly_name || "";
  }

  _error(key) {
    return `<style>${TB_BASE_STYLE}</style><ha-card><div class="warning">${tbEsc(this._t(key))}${
      key === "unknown_entity" ? `: ${tbEsc(this._config.entity)}` : ""
    }</div></ha-card>`;
  }

  // Statistics of a tab: « Departures · 18 trains · 89 % on time »; without the tab's name when the tabs, right
  // under the header, already show it (`named` false).
  _stats(tabKey, tab, named = true) {
    const parts = [...(named ? [this._t(tabKey)] : []), tbPlural(this._hass, this._config, "trains", tab?.total ?? 0)];
    if (tab?.onTime !== null && tab?.onTime !== undefined) {
      const pct = new Intl.NumberFormat(tbFmtLang(this._hass, this._config), { style: "percent", maximumFractionDigits: 0 }).format(tab.onTime / 100);
      parts.push(tbFill(this._t("on_time_pct"), { pct }));
    }
    return `<div class="parts">${parts.map((p) => `<span>${tbEsc(p)}</span>`).join("")}</div>`;
  }

  // The header: the illustration (with the title, its status pill and `extra` on its sky), or the classic header.
  // `extra.cls` is the status colour of the header icon; the classic header has the board's own (`classicCls`).
  _header(board, tabKey, extra) {
    const c = this._config;
    const name = tbEsc(this._name(board));
    const zoom = this._zoomButton();
    const zoomed = zoom ? " zoomed" : "";
    if (tbOpt(c, "illustration") === false) {
      return `<div class="header${zoomed}"><div class="logo ${extra.classicCls ?? extra.cls}">${tbIcon(TB_ICONS.train)}${this._badge(board)}</div><div class="titles"><div class="trow"><div class="name">${name}</div>${
        extra.classicPill ?? extra.pill
      }</div>${extra.classic}</div>${zoom}</div>`;
    }
    const cls = `banner ${tabKey === "arrivals" ? "arr" : "dep"}${tbIsNight(this._hass, c) ? " night" : ""}`;
    // The mini card's sky holds the next train: the station's name stays in the icon's tooltip.
    const title = extra.noName ? "" : `<div class="trow"><div class="name">${name}</div>${extra.pill}</div>`;
    return `<div class="${cls}">${tbSceneSvg(this._uid)}<div class="htext${zoomed}"><div class="logo ${extra.cls}" title="${name}">${tbIcon(TB_ICONS.train)}${this._badge(board)}</div><div class="titles">${title}${
      extra.banner
    }</div></div>${zoom}</div>`;
  }

  // A status pill of the header: its dot, then its label (also its tooltip, kept when only the dot shows).
  _hpill(cls, text) {
    return `<span class="chip hpill ${cls}" title="${tbEsc(text)}"><span class="dot"></span><span class="txt">${tbEsc(text)}</span></span>`;
  }

  _boardPill(tab, now) {
    const st = tbBoardStatus(this._hass, this._config, tab, now);
    return { cls: st.cls, pill: this._hpill(st.cls, this._t(st.key)) };
  }

  _zoomButton() {
    return "";
  }

  // The brand's logo in a badge on the header icon: the operator of the detected integration (`brand` in YAML picks
  // another one), only when its logo is in the bundle.
  _badge(board) {
    const slug = this._config.brand || board.brand || board.adapter?.brand;
    const logo = slug && TB_BRAND_LOGOS[slug];
    return logo ? `<span class="badge" title="${tbEsc(board.adapter?.name || "")}"><img src="${tbEsc(logo)}" alt=""></span>` : "";
  }

  // The illustration's styles, only when it is shown.
  _sceneStyle() {
    return tbOpt(this._config, "illustration") === false ? "" : TB_SCENE_STYLE;
  }

  _typePill(t) {
    // A line name (GTFS route « C17 ») is shown whole, else the category.
    const text = t.line || t.type;
    if (!text) return "";
    return `<span class="type" style="--c:${tbEsc(tbSafeColor(tbColor(this._config, t)))}">${tbEsc(text)}</span>`;
  }

  _statusPill(t, kind, now) {
    const s = tbStatus(this._hass, this._config, t, kind, now);
    return s ? `<span class="chip ${s.cls}" title="${tbEsc(s.text)}"><span class="txt">${tbEsc(s.text)}</span></span>` : "";
  }

  _place(t, kind) {
    return kind === "arrival" && t.place ? tbFill(this._t("from"), { place: t.place }) : t.place;
  }

  // « in 8 min », « now », nothing an hour or more away.
  _relative(t, now) {
    const at = t.expected ?? t.scheduled;
    if (at === null || t.cancelled) return "";
    const min = Math.round((at - now) / 60000);
    if (min >= 60) return "";
    return min <= 0 ? this._t("now") : tbFill(this._t("in_min"), { n: min });
  }

  _popupHtml(board, now) {
    const p = this._popup;
    if (!p) return "";
    const close = `<button type="button" class="iconbtn" data-action="close-popup" title="${tbEsc(this._t("close"))}" aria-label="${tbEsc(this._t("close"))}">${tbIcon(TB_ICONS.close)}</button>`;
    let body;
    if (p.notices) {
      body = `<div class="mhead">${tbIcon(TB_ICONS.alert)}<div class="mtitle" id="tb-dlg"><b>${tbEsc(this._t("notices"))}</b></div>${close}</div>
        <ul class="msgs">${board.messages.map((m) => `<li>${tbEsc(m)}</li>`).join("")}</ul>`;
    } else {
      const tab = board.tabs[p.tab];
      const t = tab?.trains.find((x) => x.key === p.train);
      if (!t) return "";
      const kind = tab.kind;
      const clock = (ms) => tbEsc(tbClock(this._hass, this._config, ms));
      const facts = [[this._t("scheduled"), clock(t.scheduled)]];
      if (t.expected !== null && t.realtime) facts.push([this._t("expected"), `${clock(t.expected)} ${this._statusPill(t, kind, now)}`]);
      else {
        const pill = this._statusPill(t, kind, now);
        if (pill) facts.push([this._t("expected"), pill]);
      }
      if (t.delay > 0 && !(t.expected !== null && t.realtime)) facts.push([this._t("delay"), tbEsc(tbFill(this._t("delay_min"), { n: t.delay }))]);
      if (t.platform)
        facts.push([
          this._t("platform"),
          `<span class="plat${t.platformChanged ? " changed" : ""}">${tbEsc(t.platform)}</span>${t.platformChanged ? `<span class="muted">${tbEsc(this._t("platform_changed"))}</span>` : ""}`,
        ]);
      if (t.operator) facts.push([this._t("operator"), tbEsc(t.operator)]);
      const stops = t.stops.length ? t.stops.filter((s) => s.name) : t.via.map((name) => ({ name }));
      body = `<div class="mhead">${this._typePill(t)}<div class="mtitle" id="tb-dlg"><b>${tbEsc(this._place(t, kind))}</b>${
        t.label ? `<span class="muted">${tbEsc(t.label)}</span>` : ""
      }</div>${close}</div>
        <dl class="facts">${facts.map(([k, v]) => `<dt>${tbEsc(k)}</dt><dd>${v}</dd>`).join("")}</dl>
        ${
          stops.length
            ? `<div><div class="sect-title">${tbEsc(this._t("stops"))}</div><div class="stops">${stops
                .map((s) => `<span class="stop">${tbEsc(s.name)}${s.time ? `<span class="muted">${clock(s.time)}</span>` : ""}</span>`)
                .join("")}</div></div>`
            : ""
        }
        ${t.messages.length ? `<div><div class="sect-title">${tbEsc(this._t("messages"))}</div><ul class="msgs">${t.messages.map((m) => `<li>${tbEsc(m)}</li>`).join("")}</ul></div>` : ""}`;
    }
    return `<style>${TB_DIALOG_STYLE}</style><div class="backdrop" data-action="close-popup"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="tb-dlg">${body}</div></div>`;
  }
}

export class TrainBoardCard extends TbBase {
  static getConfigElement() {
    return document.createElement("train-board-card-editor");
  }

  static getStubConfig(hass) {
    const entity = tbCandidates(hass)[0];
    return entity ? { entity } : {};
  }

  getCardSize() {
    return 3 + Math.ceil(Math.min(30, Number(tbOpt(this._config || {}, "max_trains")) || 6) / 2);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    const now = Date.now();
    const board = tbBoard(this._hass, this._config, now);
    if (board.error) return this._error(board.error);
    return `<style>${TB_BASE_STYLE}${this._sceneStyle()}${TB_BANNER_STYLE}${TB_FULL_STYLE}</style><ha-card>${this._fullBody(board, now)}</ha-card>`;
  }

  _fullBody(board, now) {
    const c = this._config;
    const tabKey = this._activeTab(board);
    const tab = board.tabs[tabKey];
    const both = board.tabs.departures && board.tabs.arrivals;
    const stats = this._stats(tabKey, tab, !both);
    const header = this._header(board, tabKey, { banner: `<div class="stats">${stats}</div>`, classic: `<div class="stats">${stats}</div>`, ...this._boardPill(tab, now) });
    const tabs = both
      ? `<div class="tabs" role="tablist">${["departures", "arrivals"]
          .map((k) => `<button type="button" class="tab${k === tabKey ? " active" : ""}" role="tab" aria-selected="${k === tabKey}" data-tab="${k}">${tbEsc(this._t(k))}</button>`)
          .join("")}</div>`
      : "";
    const notice =
      tbOpt(c, "show_messages") && board.messages.length
        ? `<div class="notice" role="button" tabindex="0" data-action="notices" title="${tbEsc(board.messages.join("\n"))}">${tbIcon(TB_ICONS.alert)}<span class="txt">${tbEsc(
            board.messages[0],
          )}</span>${board.messages.length > 1 ? `<span class="more">+${board.messages.length - 1}</span>` : ""}</div>`
        : "";
    return `${header}${tabs}${notice}${this._list(tab, now)}${this._popupHtml(board, now)}`;
  }

  _list(tab, now) {
    const c = this._config;
    const max = Math.max(1, Math.min(30, Math.round(Number(tbOpt(c, "max_trains")) || 6)));
    const trains = (tab?.trains || []).slice(0, max);
    if (!trains.length) return `<div class="empty muted">${tbEsc(this._t("no_trains"))}</div>`;
    const plat = tbOpt(c, "show_platform") && trains.some((t) => t.platform);
    const showNum = tbOpt(c, "show_train_number");
    const showVia = tbOpt(c, "show_via");
    const showArr = tbOpt(c, "show_arrival_time") && tab.kind === "departure";
    const today = tbDayOf(this._hass, now);
    let day = today;
    const rows = trains.map((t) => {
      const key = tbEsc(t.key);
      // A train on another day than the one before it (evening lists running into the next morning): a separator.
      const d = tbDayOf(this._hass, t.scheduled);
      let sep = "";
      if (d && d !== day) {
        const tomorrow = tbDayOf(this._hass, now + 864e5);
        const text = d === tomorrow ? this._t("tomorrow") : new Date(t.scheduled).toLocaleDateString(tbFmtLang(this._hass, c), { weekday: "long", day: "numeric", month: "long", timeZone: this._hass?.locale?.time_zone === "server" ? this._hass?.config?.time_zone : undefined });
        sep = `<div class="day-sep muted" role="separator" data-key="day-${tbEsc(d)}">${tbEsc(text)}</div>`;
        day = d;
      }
      const num = showNum && t.number && t.number !== t.type && t.number !== t.line ? `<span class="num muted">${tbEsc(t.number)}</span>` : "";
      const arrive = showArr && t.arrival !== null ? `<span class="arr muted" title="${tbEsc(this._t("arrival_time"))}">→ ${tbEsc(tbClock(this._hass, c, t.arrival))}</span>` : "";
      const via = showVia && t.via.length ? `<span class="via muted">${tbEsc(tbFill(this._t("via"), { list: t.via.join(", ") }))}</span>` : "";
      const label = [tbClock(this._hass, c, t.scheduled), t.label, this._place(t, tab.kind)].filter(Boolean).join(" ");
      return `${sep}<div class="row" role="button" tabindex="0" data-train="${key}" data-key="${key}" aria-label="${tbEsc(label)}">
        <span class="time${t.cancelled ? " struck" : ""}">${tbEsc(tbClock(this._hass, c, t.scheduled))}</span>
        <span class="main"><span class="line">${this._typePill(t)}<span class="dest">${tbEsc(this._place(t, tab.kind))}</span>${num}${arrive}</span>${via}</span>
        ${plat ? `<span class="plat${t.platformChanged ? " changed" : ""}">${tbEsc(t.platform)}</span>` : ""}
        <span class="status">${this._statusPill(t, tab.kind, now)}</span>
      </div>`;
    });
    return `<div class="list${plat ? "" : " no-plat"}">${rows.join("")}</div>`;
  }
}

// The mini card: the same banner, lower, with the next train on its sky. Its detail button (top right,
// `zoom: false` removes it) switches it to the full board, same configuration, and back; a click anywhere outside
// the card brings it back too.
export class TrainBoardMiniCard extends TrainBoardCard {
  static getConfigElement() {
    return document.createElement("train-board-mini-card-editor");
  }

  constructor() {
    super();
    this._zoomed = false;
    this._onOutside = (ev) => {
      // The click that closed the popup only closes the popup.
      if (this._popupClosedBy === ev) return;
      if (this._zoomed && !ev.composedPath().includes(this) && !tbInDialog(ev)) this._setZoom(false);
    };
  }

  connectedCallback() {
    // After the popup's watcher: a click outside first closes the popup (and only that).
    super.connectedCallback();
    (this._outsideWatch ??= tbWatchOutside(this, (ev) => this._onOutside(ev))).on();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._outsideWatch?.off();
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 2;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  _click(ev) {
    const zoom = ev.composedPath().find((n) => n.dataset?.action === "zoom");
    if (zoom && !this._popup) {
      ev.stopPropagation();
      this._setZoom(!this._zoomed);
      // Keyboard use (no click count) keeps the focus on the button.
      if (ev.detail === 0) this.shadowRoot.querySelector?.(".zoom")?.focus({ preventScroll: true });
      return;
    }
    super._click(ev);
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    if (!zoomed) {
      this._popup = null;
      this._tab = null;
      window.removeEventListener("keydown", this._onKey);
    }
    this._update();
  }

  _zoomButton() {
    if (tbOpt(this._config, "zoom") === false) return "";
    const label = tbEsc(this._t(this._zoomed ? "zoom_out" : "zoom_in"));
    return `<button type="button" class="iconbtn zoom" data-action="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}">${tbIcon(
      this._zoomed ? TB_ICONS.collapse : TB_ICONS.expand,
    )}</button>`;
  }

  _render() {
    if (this._zoomed) return super._render();
    const now = Date.now();
    const board = tbBoard(this._hass, this._config, now);
    if (board.error) return this._error(board.error);
    const tabKey = this._activeTab(board);
    const tab = board.tabs[tabKey];
    const trains = tab?.trains || [];
    const t = trains.find((x) => !x.cancelled) || trains[0];
    const boardPill = this._boardPill(tab, now);
    let info;
    let status = boardPill;
    if (t) {
      // The next train: its time, then its status pill (a train known from the timetable only: « Scheduled »).
      const st = tbStatus(this._hass, this._config, t, tab.kind, now) || { cls: "na", text: this._t("scheduled") };
      status = { cls: st.cls, pill: this._hpill(st.cls, st.text) };
      const rel = this._relative(t, now);
      const plat = tbOpt(this._config, "show_platform") && t.platform ? `<span class="plat${t.platformChanged ? " changed" : ""}">${tbEsc(t.platform)}</span>` : "";
      // Beside the scenery the time row lacks room for the pill: it then goes to the last row, « in 8 min » to the
      // time row and the platform before the train type (each item is written in both places, one of them hidden
      // by the styles with display: none, so it is neither seen nor read twice).
      const relHtml = rel ? `<span class="rel">${tbEsc(rel)}</span>` : "";
      const both = (wide, narrow) => `${wide ? `<span class="wide">${wide}</span>` : ""}${narrow ? `<span class="narrow">${narrow}</span>` : ""}`;
      info = `<div class="nt-time"><b class="${t.cancelled ? "struck" : ""}">${tbEsc(tbClock(this._hass, this._config, t.scheduled))}</b>${both(status.pill, relHtml)}</div>
        <div class="nt-line">${both("", plat)}${this._typePill(t)}<span class="dest">${tbEsc(this._place(t, tab.kind))}</span></div>
        <div class="nt-meta">${both(plat, "")}${both(relHtml, status.pill)}</div>`;
    } else
      // No train: the station's name and the board's pill (« No trains »).
      info = `<div class="nt-time"><span class="name">${tbEsc(this._name(board))}</span><span class="wide">${boardPill.pill}</span></div>
        <div class="nt-meta"><span class="narrow">${boardPill.pill}</span></div>`;
    const header = this._header(board, tabKey, {
      banner: info,
      noName: true,
      classic: `<div class="stats">${this._stats(tabKey, tab)}</div>`,
      ...status,
      classicCls: boardPill.cls,
      classicPill: boardPill.pill,
    });
    const below = tbOpt(this._config, "illustration") === false ? `<div class="next">${info}</div>` : "";
    return `<style>${TB_BASE_STYLE}${this._sceneStyle()}${TB_BANNER_STYLE}${TB_MINI_STYLE}</style><ha-card>${header}${below}</ha-card>`;
  }
}
