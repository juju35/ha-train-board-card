// ---------------------------------------------------------------------------
// Train board card and mini card, their visual editors and their registration.
// ---------------------------------------------------------------------------

const VERSION = "__VERSION__";

const TB_ICONS = {
  // mdi:train, mdi:arrow-expand, mdi:arrow-collapse, mdi:close, mdi:alert-circle-outline
  train:
    "M12,2C8,2 4,2.5 4,6V15.5A3.5,3.5 0 0,0 7.5,19L6,20.5V21H8.23L10.23,19H14L16,21H18V20.5L16.5,19A3.5,3.5 0 0,0 20,15.5V6C20,2.5 16.42,2 12,2M7.5,17A1.5,1.5 0 0,1 6,15.5A1.5,1.5 0 0,1 7.5,14A1.5,1.5 0 0,1 9,15.5A1.5,1.5 0 0,1 7.5,17M11,10H6V6H11V10M13,10V6H18V10H13M16.5,17A1.5,1.5 0 0,1 15,15.5A1.5,1.5 0 0,1 16.5,14A1.5,1.5 0 0,1 18,15.5A1.5,1.5 0 0,1 16.5,17Z",
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  alert:
    "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
};

// Brand logos, by slug, embedded by the build from images/<slug>.svg or .png (scripts/brand-logos.mjs).
const TB_BRAND_LOGOS = {} /* __BRAND_LOGOS__ */;

const tbEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const tbIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

// The card's language: the configured one, else Home Assistant's (its base language when the region is unknown).
const tbLang = (hass, config) => {
  const l = config?.language || hass?.locale?.language || hass?.language || "en";
  return TB_STRINGS[l] ? l : TB_STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};
// Locale of the numbers and times: Home Assistant's full locale when its base is the card's language (keeps the
// region), else the card's language; Home Assistant's « pt » is European Portuguese.
const tbFmtLang = (hass, config) => {
  const l = tbLang(hass, config);
  const ha = hass?.locale?.language || hass?.language;
  const loc = ha && ha.split("-")[0] === l.split("-")[0] && l !== "sr-Latn" ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};
const tbT = (hass, config, key) => TB_STRINGS[tbLang(hass, config)][key] ?? TB_STRINGS.en[key] ?? key;
const tbFill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// « 1 train », « 3 trains », Polish « 5 pociągów »: the plural form of the card's language.
const tbPlural = (hass, config, key, n) => {
  const l = tbLang(hass, config);
  let form = "other";
  try {
    form = new Intl.PluralRules(l === "sr-Latn" ? "sr" : l).select(n);
  } catch (_e) {
    /* other */
  }
  const s = TB_STRINGS[l];
  return tbFill(s[`${key}_${form}`] ?? s[`${key}_other`] ?? TB_STRINGS.en[`${key}_${n === 1 ? "one" : "other"}`], { n });
};

// Clock time in the user's settings (12 / 24 h, server or browser time zone).
const _tbClocks = new Map();
const tbClock = (hass, config, ms) => {
  if (ms === null || ms === undefined) return "";
  const loc = tbFmtLang(hass, config);
  const tf = hass?.locale?.time_format;
  const tz = hass?.locale?.time_zone === "server" ? hass?.config?.time_zone : undefined;
  const key = `${loc}|${tf}|${tz}`;
  let f = _tbClocks.get(key);
  if (!f) {
    const opts = { hour: "2-digit", minute: "2-digit" };
    if (tf === "12" || tf === "24") opts.hour12 = tf === "12";
    if (tz) opts.timeZone = tz;
    try {
      f = new Intl.DateTimeFormat(loc, opts);
    } catch (_e) {
      f = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" });
    }
    _tbClocks.set(key, f);
  }
  return f.format(new Date(ms));
};

// ---------------------------------------------------------------------------
// The board: the trains of each tab, filtered, with their statistics.
// ---------------------------------------------------------------------------

const tbSplitList = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);

const TB_DEFAULTS = {
  illustration: true,
  illustration_theme: "auto",
  default_tab: "departures",
  show_departures: true,
  show_arrivals: true,
  max_trains: 6,
  show_platform: true,
  show_train_number: true,
  show_via: false,
  hide_cancelled: false,
  show_messages: true,
  zoom: true,
};
const tbOpt = (config, k) => config?.[k] ?? TB_DEFAULTS[k];

// A train has left (a departure gone for a minute) or is long arrived (five minutes): off the board.
const tbGone = (t, kind, now) => {
  const at = t.expected ?? t.scheduled;
  if (at === null) return false;
  return kind === "arrival" ? at < now - 5 * 60000 : at < now - 60000;
};

const tbNormPlatform = (p) => String(p).toLowerCase().replace(/\s+/g, "");

// The trains of a tab after the card's filters: platforms, train types (category, label or family) and cancelled.
const tbFilter = (trains, config, kind, now) => {
  const platforms = tbSplitList(config.platforms).map(tbNormPlatform);
  const types = tbSplitList(config.train_types).map((s) => s.toUpperCase());
  return trains.filter(
    (t) =>
      !tbGone(t, kind, now) &&
      !(tbOpt(config, "hide_cancelled") && t.cancelled) &&
      (!platforms.length || platforms.includes(tbNormPlatform(t.platform))) &&
      (!types.length || types.includes(t.type) || types.includes(t.label.toUpperCase()) || types.includes(t.family.toUpperCase())),
  );
};

// Share of the trains on time, among those with real-time information (cancelled ones count as late).
const tbOnTime = (trains) => {
  const known = trains.filter((t) => t.realtime);
  if (!known.length) return null;
  const ok = known.filter((t) => !t.cancelled && !t.delayedUnknown && (t.delay ?? 0) <= 0).length;
  return Math.round((ok / known.length) * 100);
};

// The whole board of a configuration: { error } when the entity is missing or not supported, else
// { station, adapter, tabs: { departures, arrivals }, messages }, each tab { trains (all), total, onTime } or null.
const tbBoard = (hass, config, now = Date.now()) => {
  if (!config?.entity) return { error: "no_entity" };
  if (!hass?.states?.[config.entity]) return { error: "unknown_entity" };
  const dep = tbRead(hass, config.entity, { kind: "departure", integration: config.integration, now });
  if (!dep) return { error: "unsupported" };
  const arr = config.arrival_entity ? tbRead(hass, config.arrival_entity, { kind: "arrival", integration: config.integration, now }) : null;
  const tab = (r, kind, on) => {
    if (!r || !on) return null;
    const trains = tbFilter(r.trains, config, kind, now);
    return { kind, trains, total: trains.length, onTime: tbOnTime(trains) };
  };
  const tabs = {
    departures: tab(dep, "departure", tbOpt(config, "show_departures")),
    arrivals: tab(arr, "arrival", tbOpt(config, "show_arrivals")),
  };
  // A board without its departures tab (show_departures: false) and without arrivals still shows the departures.
  if (!tabs.departures && !tabs.arrivals) tabs.departures = tab(dep, "departure", true);
  return { station: dep.station, adapter: dep.adapter, tabs, messages: [...dep.messages, ...(arr?.messages || [])] };
};

// Status of a train: { cls, text } — cancelled, delayed (« +12 min »), boarding / arrived, on time; null for a
// train known from the timetable only.
const tbStatus = (hass, config, t, kind, now) => {
  const tr = (k) => tbT(hass, config, k);
  if (t.cancelled) return { cls: "danger", key: "cancelled", text: tr("cancelled") };
  if (!t.realtime) return null;
  const at = t.expected ?? t.scheduled;
  if (kind === "arrival" && at !== null && at <= now) return { cls: "accent", key: "arrived", text: tr("arrived") };
  if (t.delayedUnknown) return { cls: "warn", key: "delayed", text: tr("delayed") };
  if ((t.delay ?? 0) >= 1) return { cls: "warn", key: "delay", text: tbFill(tr("delay_min"), { n: t.delay }) };
  if (kind === "departure" && at !== null && at - now <= 2 * 60000) return { cls: "accent", key: "boarding", text: tr("boarding") };
  return { cls: "ok", key: "on_time", text: tr("on_time") };
};

// Colour of a train type's pill: the configured one (by category, then family), the line colour of the
// integration, else the family's.
const TB_FAMILY_COLORS = {
  high_speed: "var(--tb-pro)",
  intercity: "var(--tb-ok)",
  regional: "var(--tb-accent)",
  suburban: "var(--tb-accent)",
  bus: "var(--tb-muted)",
  other: "var(--tb-muted)",
};
const tbColor = (config, t) => {
  const custom = config.train_type_colors || {};
  const pick = (k) => (k && typeof custom[k] === "string" ? custom[k] : null);
  const lower = Object.fromEntries(Object.entries(custom).map(([k, v]) => [k.toUpperCase(), v]));
  return (
    pick(t.type) ||
    (typeof lower[t.type] === "string" ? lower[t.type] : null) ||
    pick(t.family) ||
    (/^#?[0-9a-f]{6}$/i.test(t.color) ? (t.color.startsWith("#") ? t.color : `#${t.color}`) : null) ||
    TB_FAMILY_COLORS[t.family] ||
    TB_FAMILY_COLORS.other
  );
};
const tbSafeColor = (c) => (/^(#[0-9a-f]{3,8}|var\(--[\w-]+\)|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i.test(String(c)) ? c : "var(--tb-muted)");

// Night picture: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the day
// picture after sunset).
const tbIsNight = (hass, config) => {
  const theme = tbOpt(config, "illustration_theme");
  if (theme === "night") return true;
  if (theme === "day") return false;
  return !!hass?.themes?.darkMode;
};

// The status of the trains listed on a tab, for the header's pill and icon: a cancelled train is a disruption,
// else a delay, else on time; grey when no train is listed or none has real-time information.
const tbBoardStatus = (hass, config, tab, now) => {
  const max = Math.max(1, Math.min(30, Math.round(Number(tbOpt(config, "max_trains")) || 6)));
  const trains = (tab?.trains || []).slice(0, max);
  if (!trains.length) return { cls: "na", key: "no_trains_short" };
  const cls = trains.map((t) => tbStatus(hass, config, t, tab.kind, now)?.cls);
  if (cls.includes("danger")) return { cls: "danger", key: "disruption" };
  if (cls.includes("warn")) return { cls: "warn", key: "delays" };
  if (cls.some(Boolean)) return { cls: "ok", key: "on_time" };
  return { cls: "na", key: "scheduled" };
};

// ---------------------------------------------------------------------------
// In-place updates of the shadow DOM (kept nodes keep focus, hover and their running animations).
// ---------------------------------------------------------------------------

const tbPatchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
const tbKeyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
const tbSameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
const tbPatchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = tbKeyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = tbKeyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!tbSameNode(o, n) || used.has(o) || (k === null && tbKeyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    if (o !== ref) cur.insertBefore(o, ref);
    if (n.nodeType === 1) {
      tbPatchAttrs(o, n);
      tbPatchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
// The width of an element's whole text in fractional pixels, even while an ellipsis cuts it.
const tbTextWidth = (el) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  return range.getBoundingClientRect().width || el.scrollWidth;
};

const tbMorph = (root, html) => {
  if (typeof document === "undefined" || !document.createElement("template").content) {
    root.innerHTML = html;
    return;
  }
  const tpl = document.createElement("template");
  // SVG elements need their namespace: parsed as HTML inside a template, <svg> children get it.
  tpl.innerHTML = html;
  tbPatchChildren(root, tpl.content);
};

// A value inside a CSS attribute selector (a train key may hold a quote or a backslash).
const tbCssEsc = (v) => (globalThis.CSS?.escape ? CSS.escape(String(v)) : String(v).replace(/["\\]/g, "\\$&"));

// A click inside a dialog opened from the card (more-info…) is not a click outside the card.
const tbInDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// « A click elsewhere », caught on the pointer (iOS sends no click for a tap on something not clickable): the
// press and the release both outside the card. Keyboard clicks (no click count) go through the click event.
const tbWatchOutside = (card, handler) => {
  let downOutside = false;
  const outside = (ev) => !ev.composedPath().includes(card);
  const onDown = (ev) => {
    downOutside = outside(ev);
  };
  const onUp = (ev) => {
    if (downOutside && outside(ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && outside(ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
  };
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const TB_BASE_STYLE = `
  :host { --tb-accent: #2f7de1; --tb-pro: #8a5cf6; --tb-ok: var(--success-color, #43a047); --tb-warn: var(--warning-color, #ffa600);
          --tb-danger: var(--error-color, #db4437); --tb-muted: var(--secondary-text-color, #727272); }
  ha-card { overflow: hidden; position: relative; container: tbcard / inline-size; }
  /* A size container has no width of its own: in a parent sized by its content the card keeps 400 px. */
  :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 400px); height: 0; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  [role="button"], [role="tab"] { cursor: pointer; }
  [role="button"]:focus-visible, button:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--tb-ok); } .warn { --c: var(--tb-warn); } .accent { --c: var(--tb-accent); } .danger { --c: var(--tb-danger); }
  .na { --c: var(--tb-muted); }
  /* The state colour tints the pill; its text mixes it with the text colour to stay readable. */
  .chip { display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; line-height: 18px;
          white-space: nowrap; max-width: 100%; box-sizing: border-box; overflow: hidden;
          background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color, #212121)); }
  .chip .txt { overflow: hidden; text-overflow: ellipsis; }
  /* The header's status pill: a dot, then the status. */
  .hpill { gap: 4px; line-height: 16px; min-width: 0; }
  .hpill .txt { min-width: 0; }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; }
  .type { flex: none; display: inline-flex; align-items: center; padding: 0 6px; border-radius: 6px; font-size: 11px; font-weight: 700;
          line-height: 18px; letter-spacing: .02em; white-space: nowrap; max-width: 6em; overflow: hidden; text-overflow: ellipsis;
          background: color-mix(in srgb, var(--c) 18%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color, #212121)); }
  .plat { display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 4px; box-sizing: border-box; border-radius: 6px;
          border: 1px solid var(--divider-color, rgba(127,127,127,.35)); font-size: 12px; font-weight: 500; white-space: nowrap; }
  .plat.changed { border-color: var(--tb-warn); color: color-mix(in srgb, var(--tb-warn) 45%, var(--primary-text-color, #212121)); }
  .plat:empty { border-color: transparent; }
  .warning { padding: 16px; color: color-mix(in srgb, var(--tb-warn) 45%, var(--primary-text-color, #212121)); }
  .iconbtn { all: unset; flex: none; cursor: pointer; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
             color: inherit; box-sizing: border-box; }
  .iconbtn .icon { width: 16px; height: 16px; }
  .iconbtn:hover { background: color-mix(in srgb, currentColor 14%, transparent); }
  .iconbtn:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
`;

// The banner's text, posed on the sky at its left: the scene starts at x 150 of its 320 × 78 picture, drawn to
// the right edge at the banner's height (or less on a narrow card), so the text stops where the scene starts.
const TB_BANNER_STYLE = `
  /* The round tinted icon (40 px, the brand badge at its bottom right), then the title and the statistics (the mini
     card: the next train), centred on the sky. */
  .htext { position: absolute; left: 12px; top: 4px; bottom: calc(var(--tb-track-h, 10px) + 2px); right: calc(min(53.125cqw, var(--tb-scene-w)) + 4px);
           display: flex; align-items: center; gap: 10px; min-width: 0; }
  .htext .titles { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  /* The header icon takes the status colour of the pill (--c of its ok / warn / danger / na class). */
  .banner .logo { color: color-mix(in srgb, var(--c, var(--tb-accent)) 88%, #10283f); background: rgba(255,255,255,.62);
                  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c, var(--tb-accent)) 22%, transparent); }
  .banner.night .logo { color: color-mix(in srgb, var(--c, #9cc3ff) 70%, #ffffff); background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.14); }
  .banner .badge { box-shadow: 0 0 0 1px rgba(13,42,69,.16), 0 1px 3px rgba(13,42,69,.18); }
  /* Brand badge on the header icon: the logo on a white tile, readable on any theme. */
  .badge { position: absolute; right: -4px; bottom: -4px; width: 18px; height: 18px; border-radius: 5px; padding: 2px; box-sizing: border-box;
           display: grid; place-items: center; background: #fff;
           box-shadow: 0 0 0 1px var(--divider-color, rgba(0,0,0,.12)), 0 0 0 3px var(--card-background-color, #fff); }
  .badge img { width: 100%; height: 100%; object-fit: contain; }
  .htext .name { font-size: 16px; font-weight: 600; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  /* The title row: the title, then the status pill right after it with its whole label (placed by _fitPill). */
  .trow { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .trow .name { flex: 0 1000 auto; min-width: 0; }
  .trow .hpill { flex: none; max-width: none; }
  /* The header's text block is a container (narrow rules below). The whole title and the whole pill do not fit side
     by side (measured by the card, see _fitPill): the pill goes to its own line, under the statistics kept to one
     line; if that does not fit the banner either, the dot alone beside the title. */
  .htext, .header { container: tbhead / inline-size; }
  .titles.below > .trow { display: contents; }
  .titles.below > .trow .hpill { order: 3; align-self: flex-start; max-width: 100%; }
  .titles.below > .stats { order: 2; max-height: 16px; }
  .titles.dot-only > .trow { display: flex; }
  .titles.dot-only > .trow .hpill { order: 0; align-self: center; }
  .titles.dot-only .hpill { padding: 0; background: none !important; overflow: visible; }
  .titles.dot-only .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Very narrow: the dot alone, back on the title row (the label stays in its tooltip and for screen readers). */
  @container tbcard (max-width: 200px) {
    .titles.below > .trow { display: flex; }
    .titles.below > .trow .hpill { order: 0; align-self: center; }
    .hpill { padding: 0; background: none !important; overflow: visible; }
    .hpill .txt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  }
  /* On one line when they fit, else wrapped: the « · » that starts a line sits in the negative margin, clipped. */
  .stats { font-size: 12px; line-height: 16px; color: #3d5670; overflow: hidden; max-height: 32px; flex: none; }
  .stats .parts { display: flex; flex-wrap: wrap; margin-left: -12px; }
  .night .stats { color: rgba(255,255,255,.82); }
  .stats span { white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  .stats span::before { content: "·"; display: inline-block; width: 12px; text-align: center; }
  /* The mini card's detail button: a 24 px frosted round button in the banner's top right corner. */
  .zoom { width: 24px; height: 24px; }
  .banner .zoom { position: absolute; z-index: 2; top: 5px; right: 5px; color: #33506b; background: rgba(255,255,255,.55);
                  box-shadow: inset 0 0 0 1px rgba(255,255,255,.7); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .banner .zoom:hover { background: rgba(255,255,255,.75); }
  .banner.night .zoom { color: #fff; background: rgba(255,255,255,.12); box-shadow: inset 0 0 0 1px rgba(255,255,255,.2); }
  .banner.night .zoom:hover { background: rgba(255,255,255,.22); }
  /* Pills on the sky: a frosted glass under the tint. */
  .banner .chip { background: color-mix(in srgb, var(--c) 18%, rgba(255,255,255,.78)); color: color-mix(in srgb, var(--c) 45%, #0d2a45); }
  .banner.night .chip { background: color-mix(in srgb, var(--c) 30%, rgba(8,18,38,.55)); color: color-mix(in srgb, var(--c) 35%, #ffffff); }
  /* Narrow card: no room for the scene beside the text, the sky alone stays. */
  @container tbcard (max-width: 300px) { .tb-scene { display: none; } .htext { right: 12px; } .htext.zoomed { right: 34px; } }
  /* Classic header (illustration: false): a round tinted icon, the title and the statistics. */
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; }
  .logo { height: 40px; width: 40px; flex: none; border-radius: 50%; display: grid; place-items: center; color: var(--c, var(--tb-accent));
          background: color-mix(in srgb, var(--c, var(--tb-accent)) 16%, transparent); }
  .logo { position: relative; }
  .logo .icon { width: 24px; height: 24px; }
  .header .titles { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .header .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .header .stats { color: var(--secondary-text-color); }
  .header { position: relative; }
  .header.zoomed { padding-right: 40px; }
  .header .zoom { position: absolute; top: 12px; right: 12px; color: var(--secondary-text-color); box-shadow: inset 0 0 0 1px var(--divider-color, rgba(127,127,127,.3)); }
`;

const TB_FULL_STYLE = `
  .banner { --tb-banner-h: 90px; --tb-scene-w: 244px; }
  .tabs { display: flex; gap: 18px; padding: 0 12px; border-bottom: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
  .tab { all: unset; cursor: pointer; padding: 9px 0 7px; font-size: 13px; font-weight: 500; color: var(--secondary-text-color);
         border-bottom: 2px solid transparent; margin-bottom: -1px; }
  .tab.active { color: var(--primary-text-color); border-bottom-color: var(--tb-accent); }
  .tab:hover { color: var(--primary-text-color); }
  .tab:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; border-radius: 2px; }
  .notice { display: flex; align-items: center; gap: 6px; margin: 8px 12px 0; padding: 4px 8px; border-radius: 8px; font-size: 12px;
            background: color-mix(in srgb, var(--tb-warn) 12%, transparent); color: color-mix(in srgb, var(--tb-warn) 40%, var(--primary-text-color, #212121)); }
  .notice .icon { width: 15px; height: 15px; }
  .notice .txt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notice .more { flex: none; font-weight: 600; }
  /* Each row owns its columns (no subgrid): Safari/WebKit mis-distributes a subgrid row's 1fr track when a
     sibling row is hovered, shifting the line badge right. Fixed time/platform tracks keep the columns aligned. */
  .list { display: grid; padding: 4px 4px 8px; }
  .row { display: grid; grid-template-columns: 3.4em minmax(0, 1fr) 2.4em auto; column-gap: 10px;
         align-items: center; padding: 6px 8px; border-radius: 10px; font-size: 13px; min-height: 22px; position: relative; }
  .list.no-plat .row { grid-template-columns: 3.4em minmax(0, 1fr) auto; }
  .row:hover { background: color-mix(in srgb, var(--primary-text-color, #212121) 5%, transparent); }
  .row + .row::before { content: ""; position: absolute; left: 8px; right: 8px; top: 0; border-top: 1px solid var(--divider-color, rgba(127,127,127,.12)); }
  .row:hover::before, .row:hover + .row::before { display: none; }
  .time { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .time.struck { text-decoration: line-through; color: var(--secondary-text-color); }
  .main { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
  .line { display: flex; align-items: center; gap: 6px; min-width: 0; }
  .dest { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
  .num { flex: 0 1 auto; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; min-width: 3ch; }
  .via { font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { justify-self: end; min-width: 0; max-width: 100%; display: flex; justify-content: flex-end; }
  .empty { padding: 16px 12px; text-align: center; font-size: 13px; }
  /* Narrow card: the train number and the status text give way first. */
  @container (max-width: 340px) { .num { display: none; } .tabs { gap: 14px; } }
`;

// Train details and station notices, in a popup at the top of the card.
const TB_DIALOG_STYLE = `
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.42); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 10px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #fff); color: var(--primary-text-color); width: min(94%, 380px); max-height: calc(100% - 20px);
           overflow: auto; box-sizing: border-box; border-radius: 14px; padding: 12px 14px 14px; box-shadow: 0 8px 30px rgba(0,0,0,.35);
           display: flex; flex-direction: column; gap: 10px; }
  .mhead { display: flex; align-items: center; gap: 8px; }
  .mtitle { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .mtitle b { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mtitle span { font-size: 12px; }
  .mhead .iconbtn { color: var(--secondary-text-color); margin: -4px -6px -4px 0; }
  .facts { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 12px; font-size: 13px; margin: 0; }
  .facts dt { color: var(--secondary-text-color); }
  .facts dd { margin: 0; font-weight: 500; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .sect-title { font-size: 11px; font-weight: 500; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 4px; }
  .stops { display: flex; flex-wrap: wrap; gap: 4px; }
  .stop { font-size: 12px; padding: 1px 8px; border-radius: 10px; background: var(--secondary-background-color, rgba(127,127,127,.12)); }
  .stop .muted { margin-left: 4px; }
  .msgs { margin: 0; padding-left: 18px; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
`;

const TB_MINI_STYLE = `
  .banner { --tb-banner-h: 90px; --tb-scene-w: 218px; }
  .htext { gap: 8px; }
  .htext .titles { gap: 1px; }
  .nt-time { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
  .nt-time b { font-size: 20px; font-weight: 700; line-height: 26px; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .nt-time b.struck { text-decoration: line-through; opacity: .7; }
  .nt-time .rel { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .nt-line, .nt-meta { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 13px; line-height: 20px; }
  .nt-line .dest { font-weight: 500; }
  .banner .plat { border-color: rgba(16,40,63,.35); height: 18px; font-size: 11px; }
  .banner.night .plat { border-color: rgba(255,255,255,.45); }
  .nt-time { align-items: center; gap: 8px; }
  .nt-time .hpill { flex: none; }
  .nt-meta .hpill { flex: 0 1 auto; }
  .nt-time .name { font-size: 16px; font-weight: 600; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 0 1000 auto; min-width: 0; }
  .nt-time .rel, .nt-meta .rel { font-size: 12px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
  .nt-time .wide, .nt-time .narrow, .nt-meta .wide, .nt-meta .narrow, .nt-line .narrow { display: flex; align-items: center; min-width: 0; }
  .nt-meta .wide { gap: 6px; }
  .nt-time .narrow, .nt-meta .narrow, .nt-line .narrow { display: none; }
  .nt-line .narrow { flex: none; }
  .nt-time .wide { flex: none; }
  /* The status pill does not fit beside the time (or the station's name) with its whole label (measured by the card,
     see _fitPill): it goes to the last row, « in 8 min » to the time row. */
  .titles.below .nt-time .wide, .titles.below .nt-meta .wide { display: none; }
  .titles.below .nt-time .narrow, .titles.below .nt-meta .narrow, .titles.below .nt-line .narrow { display: flex; }
  @container tbcard (max-width: 200px) {
    .titles.below .nt-time .wide, .titles.below .nt-meta .wide { display: flex; }
    .titles.below .nt-time .narrow, .titles.below .nt-meta .narrow, .titles.below .nt-line .narrow { display: none; }
  }
  /* A narrow mini card: a smaller clock leaves its status pill whole. */
  @container tbcard (max-width: 260px) { .nt-time b { font-size: 18px; } .nt-time { gap: 6px; } }  .banner .type { background: rgba(255,255,255,.7); color: color-mix(in srgb, var(--c) 70%, #10283f); }
  .banner.night .type { background: rgba(10,20,40,.5); color: color-mix(in srgb, var(--c) 40%, #fff); }
  .next { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 2px; }
  .next .nt-time b { font-size: 20px; }
`;

let _tbUid = 0;

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

class TbBase extends HTMLElement {
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
        for (const [eid, e] of Object.entries(h.entities)) if (e.device_id === device) sig.push(h.states[eid]);
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
    const slug = this._config.brand || board.adapter?.brand;
    const logo = slug && TB_BRAND_LOGOS[slug];
    return logo ? `<span class="badge" title="${tbEsc(board.adapter?.name || "")}"><img src="${tbEsc(logo)}" alt=""></span>` : "";
  }

  // The illustration's styles, only when it is shown.
  _sceneStyle() {
    return tbOpt(this._config, "illustration") === false ? "" : TB_SCENE_STYLE;
  }

  _typePill(t) {
    if (!t.type) return "";
    return `<span class="type" style="--c:${tbEsc(tbSafeColor(tbColor(this._config, t)))}">${tbEsc(t.type)}</span>`;
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

class TrainBoardCard extends TbBase {
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
    const rows = trains.map((t) => {
      const key = tbEsc(t.key);
      const num = showNum && t.number && t.number !== t.type ? `<span class="num muted">${tbEsc(t.number)}</span>` : "";
      const via = showVia && t.via.length ? `<span class="via muted">${tbEsc(tbFill(this._t("via"), { list: t.via.join(", ") }))}</span>` : "";
      const label = [tbClock(this._hass, c, t.scheduled), t.label, this._place(t, tab.kind)].filter(Boolean).join(" ");
      return `<div class="row" role="button" tabindex="0" data-train="${key}" data-key="${key}" aria-label="${tbEsc(label)}">
        <span class="time${t.cancelled ? " struck" : ""}">${tbEsc(tbClock(this._hass, c, t.scheduled))}</span>
        <span class="main"><span class="line">${this._typePill(t)}<span class="dest">${tbEsc(this._place(t, tab.kind))}</span>${num}</span>${via}</span>
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
class TrainBoardMiniCard extends TrainBoardCard {
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

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

const TB_TOGGLES = ["illustration", "show_departures", "show_arrivals", "show_platform", "show_train_number", "show_via", "hide_cancelled", "show_messages"];

class TbEditorBase extends HTMLElement {
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
    const entity = { entity: { filter: TB_ADAPTERS.map((a) => ({ integration: a.id, domain: "sensor" })) } };
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

class TrainBoardCardEditor extends TbEditorBase {}

class TrainBoardMiniCardEditor extends TbEditorBase {
  // The detail button, then every option of the full board, shown by the unfolded view.
  static get extraToggles() {
    return ["zoom"];
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const tbDefine = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
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
