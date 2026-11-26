// ---------------------------------------------------------------------------
// The board: the trains of each tab, filtered, with their statistics.
// ---------------------------------------------------------------------------
import { tbFill, tbT } from "./train-board-card.js";

export const tbSplitList = (v) =>
  (Array.isArray(v) ? v : String(v ?? "").split(","))
    .map((s) => String(s).trim())
    .filter(Boolean);

export const TB_DEFAULTS = {
  illustration: true,
  illustration_theme: "auto",
  default_tab: "departures",
  show_departures: true,
  show_arrivals: true,
  max_trains: 6,
  show_platform: true,
  show_train_number: true,
  show_via: false,
  show_arrival_time: true,
  hide_cancelled: false,
  show_messages: true,
  zoom: true,
};
export const tbOpt = (config, k) => config?.[k] ?? TB_DEFAULTS[k];

// A train has left (a departure gone for a minute) or is long arrived (five minutes): off the board.
export const tbGone = (t, kind, now) => {
  const at = t.expected ?? t.scheduled;
  if (at === null) return false;
  return kind === "arrival" ? at < now - 5 * 60000 : at < now - 60000;
};

export const tbNormPlatform = (p) => String(p).toLowerCase().replace(/\s+/g, "");

// The trains of a tab after the card's filters: platforms, train types (category, label or family) and cancelled.
export const tbFilter = (trains, config, kind, now) => {
  const platforms = tbSplitList(config.platforms).map(tbNormPlatform);
  const types = tbSplitList(config.train_types).map((s) => s.toUpperCase());
  return trains.filter(
    (t) =>
      !tbGone(t, kind, now) &&
      !(tbOpt(config, "hide_cancelled") && t.cancelled) &&
      (!platforms.length || platforms.includes(tbNormPlatform(t.platform))) &&
      (!types.length ||
        types.includes(t.type) ||
        types.includes(t.line.toUpperCase()) ||
        types.includes(t.label.toUpperCase()) ||
        types.includes(t.family.toUpperCase())),
  );
};

// The day of a time (« 2026-11-26 »), in the time zone the times are shown in (see tbClock), to split the list by day.
export const tbDayOf = (hass, ms) => {
  if (ms === null || ms === undefined) return "";
  const timeZone = hass?.locale?.time_zone === "server" ? hass?.config?.time_zone : undefined;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
  } catch (_e) {
    return new Date(ms).toISOString().slice(0, 10);
  }
};

// Share of the trains on time, among those with real-time information (cancelled ones count as late).
export const tbOnTime = (trains) => {
  const known = trains.filter((t) => t.realtime);
  if (!known.length) return null;
  const ok = known.filter((t) => !t.cancelled && !t.delayedUnknown && (t.delay ?? 0) <= 0).length;
  return Math.round((ok / known.length) * 100);
};

// The whole board of a configuration: { error } when the entity is missing or not supported, else
// { station, adapter, tabs: { departures, arrivals }, messages }, each tab { trains (all), total, onTime } or null.
export const tbBoard = (hass, config, now = Date.now()) => {
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
  return { station: dep.station, adapter: dep.adapter, brand: dep.brand, tabs, messages: [...dep.messages, ...(arr?.messages || [])] };
};

// Status of a train: { cls, text } — cancelled, delayed (« +12 min »), boarding / arrived, on time; null for a
// train known from the timetable only.
export const tbStatus = (hass, config, t, kind, now) => {
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
export const TB_FAMILY_COLORS = {
  high_speed: "var(--tb-pro)",
  intercity: "var(--tb-ok)",
  regional: "var(--tb-accent)",
  suburban: "var(--tb-accent)",
  bus: "var(--tb-muted)",
  other: "var(--tb-muted)",
};
export const tbColor = (config, t) => {
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
export const tbSafeColor = (c) => (/^(#[0-9a-f]{3,8}|var\(--[\w-]+\)|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|[a-z]+)$/i.test(String(c)) ? c : "var(--tb-muted)");

// Night picture: forced by illustration_theme, else Home Assistant's dark mode alone (a light theme keeps the day
// picture after sunset).
export const tbIsNight = (hass, config) => {
  const theme = tbOpt(config, "illustration_theme");
  if (theme === "night") return true;
  if (theme === "day") return false;
  return !!hass?.themes?.darkMode;
};

// The status of the trains listed on a tab, for the header's pill and icon: a cancelled train is a disruption,
// else a delay, else on time; grey when no train is listed or none has real-time information.
export const tbBoardStatus = (hass, config, tab, now) => {
  const max = Math.max(1, Math.min(30, Math.round(Number(tbOpt(config, "max_trains")) || 6)));
  const trains = (tab?.trains || []).slice(0, max);
  if (!trains.length) return { cls: "na", key: "no_trains_short" };
  const cls = trains.map((t) => tbStatus(hass, config, t, tab.kind, now)?.cls);
  if (cls.includes("danger")) return { cls: "danger", key: "disruption" };
  if (cls.includes("warn")) return { cls: "warn", key: "delays" };
  if (cls.some(Boolean)) return { cls: "ok", key: "on_time" };
  return { cls: "na", key: "scheduled" };
};
