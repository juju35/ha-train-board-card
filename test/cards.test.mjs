// The cards rendered as HTML strings in a sandbox: tabs, columns, statuses, filters, popup, mini card, editors.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as fx from "./fixtures.mjs";
import { load } from "./load.mjs";

const { NOW } = fx;
const tb = load({ now: NOW });
const DEP = "sensor.koln_hbf_departures";
const ARR = "sensor.koln_hbf_arrivals";

const mount = (tag, config, hass = fx.dbInfoscreen()) => {
  const card = new (tb.registry.get(tag))();
  card.setConfig(config);
  card.hass = hass;
  card.connectedCallback();
  return card;
};
const html = (card) => card.shadowRoot.innerHTML;
const text = (s) => s.replace(/<style>[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
// A click on an element of the card, given its data attributes.
const click = (card, dataset, extra = {}) => {
  for (const fn of card.shadowRoot.listeners.click)
    fn({ composedPath: () => [{ dataset, tagName: extra.tagName || "DIV" }, card], detail: 1, stopPropagation() {}, stopImmediatePropagation() {} });
};
// A tap elsewhere on the page: press and release outside the card.
const tapOutside = () => {
  const ev = { composedPath: () => [{ localName: "div" }], detail: 1 };
  for (const type of ["pointerdown", "pointerup"]) for (const fn of tb.sandbox.docListeners[type] || []) fn(ev);
};
const stats = (card) => text(html(card).match(/<div class="stats"><div class="parts">([\s\S]*?)<\/div>/)[1]).replace(/ /g, " ");

test("the full board: banner, both tabs, rows with type, destination, number, platform and status", () => {
  const card = mount("train-board-card", { entity: DEP, arrival_entity: ARR });
  const h = html(card);
  assert.match(h, /<div class="banner dep">/);
  assert.match(h, /<svg class="tb-scene"/);
  assert.match(h, /data-tab="departures"[^>]*>Departures/);
  assert.match(h, /data-tab="arrivals"[^>]*>Arrivals/);
  // The tabs right under the header name the board: the statistics do not repeat it.
  assert.equal(stats(card), "3 trains 33% on time");
  const rows = h.match(/<div class="row"[\s\S]*?<\/div>/g);
  assert.equal(rows.length, 3);
  assert.match(text(rows[0]), /^08:12 ICE Hamburg-Altona 578 6 \+4 min$/);
  assert.match(rows[0], /class="plat changed"/);
  assert.match(rows[0], /class="chip warn"/);
  assert.match(text(rows[1]), /^08:19 RE Aachen Hbf 1 4 On time$/);
  assert.match(rows[2], /class="time struck"/);
  assert.match(rows[2], /class="chip danger"[^>]*><span class="txt">Cancelled/);
  // Station notices above the list.
  assert.match(h, /class="notice"[\s\S]*Lift to platform 4 out of service/);
});

test("the Arrivals tab: its own statistics, « from » the origin, the arrival animation", () => {
  const card = mount("train-board-card", { entity: DEP, arrival_entity: ARR });
  click(card, { tab: "arrivals" });
  const h = html(card);
  assert.match(h, /<div class="banner arr">/);
  assert.match(h, /class="tab active"[^>]*data-tab="arrivals"/);
  assert.equal(stats(card), "1 train 0% on time");
  assert.match(text(h), /08:06 ICE from Amsterdam Centraal 105 5 \+7 min/);
  // default_tab picks it from the start.
  assert.match(html(mount("train-board-card", { entity: DEP, arrival_entity: ARR, default_tab: "arrivals" })), /banner arr/);
});

test("integrations without arrivals or platforms: no tabs, no platform column, no type pill", () => {
  const nr = mount("train-board-card", { entity: "sensor.train_schedule_wyb_wat" }, fx.nationalRailUk());
  assert.doesNotMatch(html(nr), /class="tabs"/);
  assert.doesNotMatch(html(nr), /class="type"/);
  const tv = mount("train-board-card", { entity: "sensor.stockholm_c_uppsala_c_departure_time" }, fx.trafikverket());
  assert.match(html(tv), /class="list no-plat"/);
  assert.doesNotMatch(html(tv), /class="plat/);
  // A train known from the timetable only has no status pill.
  const rows = html(tv).match(/<div class="row"[\s\S]*?<\/div>/g);
  assert.equal(rows.length, 3);
  assert.doesNotMatch(rows[1], /class="chip/);
  assert.equal(stats(tv), "Departures 3 trains 0% on time");
  // GTFS2: no platform in a GTFS timetable; the trains without GTFS-RT data have no status pill.
  const gt = mount("train-board-card", { entity: "sensor.ter_rennes_to_nantes_next_departure" }, fx.gtfs2());
  assert.match(html(gt), /class="list no-plat"/);
  assert.doesNotMatch(html(gt), /class="tabs"/);
  const gr = html(gt).match(/<div class="row"[\s\S]*?<\/div>/g);
  assert.equal(gr.length, 3);
  assert.match(html(gt), /\+7 min/);
  assert.match(html(gt), /class="notice"[\s\S]*Works between Redon and Nantes/);
  assert.match(html(gt), /<span class="badge" title="GTFS2"><img src="data:image\/svg\+xml,/);
});

test("boarding: a departure two minutes away; arrived: an arrival whose time has passed", () => {
  const h = fx.swissTransport();
  const s = tb.tbBoard(h, { entity: "sensor.swiss_transport_bern_ab12" }, NOW + 60000).tabs.departures.trains[0];
  assert.equal(tb.tbStatus(h, {}, s, "departure", NOW + 60000).key, "boarding");
  const a = tb.tbBoard(fx.dbInfoscreen(), { entity: DEP, arrival_entity: ARR }, NOW + 14 * 60000).tabs.arrivals.trains[0];
  assert.equal(tb.tbStatus(fx.dbInfoscreen(), {}, a, "arrival", NOW + 14 * 60000).key, "arrived");
});

test("options: max_trains, platforms, train_types, hide_cancelled, show_platform, show_train_number, show_via", () => {
  const rowsOf = (config) => html(mount("train-board-card", { entity: DEP, ...config })).match(/<div class="row"/g)?.length ?? 0;
  assert.equal(rowsOf({ max_trains: 2 }), 2);
  assert.equal(rowsOf({ platforms: "6, 4" }), 2);
  assert.equal(rowsOf({ platforms: ["10"] }), 1);
  assert.equal(rowsOf({ train_types: "ICE" }), 1);
  assert.equal(rowsOf({ train_types: ["regional", "S"] }), 2, "families and categories");
  assert.equal(rowsOf({ hide_cancelled: true }), 2);
  assert.doesNotMatch(html(mount("train-board-card", { entity: DEP, show_platform: false })), /class="plat/);
  assert.doesNotMatch(html(mount("train-board-card", { entity: DEP, show_train_number: false })), /class="num/);
  assert.doesNotMatch(html(mount("train-board-card", { entity: DEP })), /class="via/);
  assert.match(html(mount("train-board-card", { entity: DEP, show_via: true })), /class="via muted">via Düsseldorf Hbf, Duisburg Hbf, Essen Hbf/);
  assert.doesNotMatch(html(mount("train-board-card", { entity: DEP, show_messages: false })), /class="notice"/);
  // Only the arrivals: no tabs, the arrivals shown.
  const arrOnly = mount("train-board-card", { entity: DEP, arrival_entity: ARR, show_departures: false });
  assert.doesNotMatch(html(arrOnly), /class="tabs"/);
  assert.match(stats(arrOnly), /^Arrivals/);
});

test("train type colours: families by default, train_type_colors by category or family, line colours", () => {
  const h = html(mount("train-board-card", { entity: DEP }));
  assert.match(h, /style="--c:var\(--tb-pro\)">ICE/);
  assert.match(h, /style="--c:var\(--tb-accent\)">RE/);
  const custom = html(mount("train-board-card", { entity: DEP, train_type_colors: { ice: "#e53935", regional: "#00897b" } }));
  assert.match(custom, /style="--c:#e53935">ICE/);
  assert.match(custom, /style="--c:#00897b">RE/);
  // A value that is not a colour is not written into the style.
  assert.match(html(mount("train-board-card", { entity: DEP, train_type_colors: { ICE: "red;}</style>" } })), /style="--c:var\(--tb-muted\)">ICE/);
  assert.match(html(mount("train-board-card", { entity: "sensor.gares_next_departure" }, fx.publicTransport())), /style="--c:#e3051b">A/);
});

test("the train popup: at the top of the card, details, closed by its button, a tap elsewhere, Escape, leaving the page", () => {
  const card = mount("train-board-card", { entity: DEP });
  click(card, { train: "2026111408578" });
  const h = html(card);
  assert.match(h, /<div class="backdrop" data-action="close-popup">/);
  const modal = text(h.match(/<div class="modal"[\s\S]*$/)[0]);
  assert.match(modal, /ICE Hamburg-Altona ICE 578/);
  assert.match(modal, /Scheduled 08:12 Expected 08:16 \+4 min Platform 6 Platform changed/);
  assert.match(modal, /Calling at Düsseldorf Hbf Duisburg Hbf Essen Hbf/);
  assert.match(modal, /Messages Delay of a preceding train/);
  // While open, a row click does nothing; the close button closes.
  click(card, { train: "x" });
  assert.match(html(card), /class="backdrop"/);
  click(card, { action: "close-popup" }, { tagName: "BUTTON" });
  assert.doesNotMatch(html(card), /class="backdrop"/);
  click(card, { train: "2026111408578" });
  tapOutside();
  assert.doesNotMatch(html(card), /class="backdrop"/);
  click(card, { train: "2026111408578" });
  tb.sandbox.fire("keydown", { key: "Escape", stopPropagation() {} });
  assert.doesNotMatch(html(card), /class="backdrop"/);
  click(card, { train: "2026111408578" });
  card.disconnectedCallback();
  card.connectedCallback();
  assert.doesNotMatch(html(card), /class="backdrop"/);
  // Station notices open their own popup.
  click(card, { action: "notices" });
  assert.match(text(html(card)), /Station notices Lift to platform 4 out of service/);
});

test("the mini card: the next train on the banner, the detail button unfolds the board, a tap elsewhere folds it", () => {
  const card = mount("train-board-mini-card", { entity: DEP, arrival_entity: ARR });
  let h = html(card);
  assert.doesNotMatch(h, /class="list/);
  // The pill, « in 16 min » and the platform are each written twice, placed as room allows (the styles hide one
  // of each pair).
  assert.match(text(h), /^08:12 \+4 min in 16 min 6 ICE Hamburg-Altona 6 in 16 min \+4 min$/);
  // The status pill right after the time, the header icon in its colour.
  assert.match(h, /<div class="nt-time"><b class="">08:12<\/b><span class="wide"><span class="chip hpill warn" title="\+4 min"><span class="dot"><\/span>/);
  assert.match(h, /<div class="nt-meta"><span class="wide"><span class="plat changed">6<\/span><\/span><span class="wide"><span class="rel">in 16 min<\/span><\/span><span class="narrow"><span class="chip hpill warn"/);
  // The round icon (with the station's name in its tooltip) beside the next train, same size as on the full card.
  assert.match(h, /<div class="htext zoomed"><div class="logo warn" title="Köln Hbf"><svg class="icon /);
  assert.match(h, /class="iconbtn zoom" data-action="zoom"[^>]*aria-expanded="false"/);
  assert.deepEqual({ ...card.getGridOptions() }, { columns: 6, min_columns: 6 });
  click(card, { action: "zoom" });
  h = html(card);
  assert.match(h, /class="list"/);
  assert.match(h, /class="tabs"/);
  assert.match(h, /aria-expanded="true"/);
  assert.equal(card.getGridOptions().columns, 12);
  // A popup opened in the unfolded view: a tap elsewhere closes it, and only it.
  click(card, { train: "2026111408578" });
  tapOutside();
  assert.doesNotMatch(html(card), /class="backdrop"/);
  assert.match(html(card), /class="list"/);
  tapOutside();
  assert.doesNotMatch(html(card), /class="list"/);
  // zoom: false removes the button.
  assert.doesNotMatch(html(mount("train-board-mini-card", { entity: DEP, zoom: false })), /data-action="zoom"/);
});

test("illustration: false gives the classic header (round tinted icon), on both cards", () => {
  const full = html(mount("train-board-card", { entity: DEP, illustration: false }));
  assert.doesNotMatch(full, /<svg class="tb-scene"|<div class="banner/);
  assert.match(full, /<div class="header"><div class="logo (ok|warn|danger|na)">/);
  assert.match(full, /<div class="trow"><div class="name">Köln Hbf<\/div><span class="chip hpill/);
  const mini = html(mount("train-board-mini-card", { entity: DEP, illustration: false }));
  assert.match(mini, /<div class="next">/);
  assert.match(mini, /class="logo (ok|warn|danger|na)"/);
});

test("night picture: the dark theme alone (a light theme keeps the day after sunset); illustration_theme forces it", () => {
  const h = fx.dbInfoscreen();
  assert.equal(tb.tbIsNight(h, {}), false);
  h.states["sun.sun"] = { entity_id: "sun.sun", state: "above_horizon", attributes: {} };
  assert.equal(tb.tbIsNight(h, {}), false);
  h.states["sun.sun"].state = "below_horizon";
  assert.equal(tb.tbIsNight(h, {}), false);
  h.themes.darkMode = true;
  assert.equal(tb.tbIsNight(h, {}), true);
  assert.equal(tb.tbIsNight(h, { illustration_theme: "day" }), false);
  h.themes.darkMode = false;
  h.states["sun.sun"].state = "above_horizon";
  assert.equal(tb.tbIsNight(h, { illustration_theme: "night" }), true);
  delete h.states["sun.sun"];
  h.themes.darkMode = true;
  assert.equal(tb.tbIsNight(h, {}), true);
  assert.equal(tb.tbIsNight(h, { illustration_theme: "day" }), false);
  assert.match(html(mount("train-board-card", { entity: DEP, illustration_theme: "night" })), /class="banner dep night"/);
});

test("errors: no entity, an unknown one, an entity of another integration", () => {
  assert.match(text(html(mount("train-board-card", {}))), /Choose a train departures sensor/);
  assert.match(text(html(mount("train-board-card", { entity: "sensor.nope" }))), /Entity not found: sensor.nope/);
  const h = fx.dbInfoscreen();
  h.states["sensor.temp"] = { entity_id: "sensor.temp", state: "21", attributes: { unit_of_measurement: "°C" } };
  assert.match(text(html(mount("train-board-card", { entity: "sensor.temp" }, h))), /not from a supported train integration/);
});

test("languages: French board, plural forms, 24 h times", () => {
  const h = fx.dbInfoscreen();
  h.language = "fr";
  h.locale = { ...h.locale, language: "fr" };
  const card = mount("train-board-card", { entity: DEP, arrival_entity: ARR }, h);
  assert.equal(stats(card), "3 trains 33 % à l’heure");
  assert.match(text(html(card)), /Supprimé/);
  assert.equal(tb.tbPlural(h, { language: "pl" }, "trains", 5), "5 pociągów");
  assert.equal(tb.tbPlural(h, { language: "pl" }, "trains", 3), "3 pociągi");
  assert.equal(tb.tbPlural(h, { language: "ru" }, "trains", 21), "21 поезд");
  assert.equal(tb.tbPlural(h, { language: "sl" }, "trains", 2), "2 vlaka");
  assert.equal(tb.tbPlural(h, { language: "lv" }, "trains", 10), "10 vilcienu");
  assert.equal(tb.tbPlural(h, { language: "sr-Latn" }, "trains", 3), "3 voza");
  h.locale.time_format = "12";
  assert.match(tb.tbClock(h, { language: "en" }, NOW), /^08:00\sAM$/);
});

test("the editors: ha-form with every option, minimal YAML, the mini card adds its detail button", () => {
  const ed = new (tb.registry.get("train-board-card-editor"))();
  ed.setConfig({ type: "custom:train-board-card", entity: DEP, platforms: ["1", "2"] });
  ed.hass = fx.dbInfoscreen();
  const form = ed.children[0];
  const names = JSON.stringify(form.schema);
  for (const k of ["entity", "arrival_entity", "integration", "title", "illustration", "illustration_theme", "default_tab", "max_trains", "show_departures", "show_arrivals", "show_platform", "show_train_number", "show_via", "hide_cancelled", "show_messages", "platforms", "train_types", "language"])
    assert.ok(names.includes(`"name":"${k}"`), k);
  assert.doesNotMatch(names, /"name":"zoom"/);
  assert.equal(form.data.platforms, "1, 2");
  assert.equal(form.data.max_trains, 6);
  let sent;
  ed.dispatchEvent = (ev) => {
    sent = ev.detail.config;
  };
  const value = { ...form.data, title: "", max_trains: 6, illustration: true, show_via: true, illustration_theme: "night" };
  form.listeners["value-changed"]({ detail: { value }, stopPropagation() {} });
  assert.deepEqual({ ...sent }, { type: "custom:train-board-card", entity: DEP, platforms: "1, 2", show_via: true, illustration_theme: "night" });
  const mini = new (tb.registry.get("train-board-mini-card-editor"))();
  mini.setConfig({ entity: DEP });
  mini.hass = fx.dbInfoscreen();
  assert.match(JSON.stringify(mini._form.schema), /"name":"zoom"/);
});

test("the editors' entity picker lists the sensors found by their attributes too (template, REST)", () => {
  const h = fx.dbInfoscreen();
  // The same sensor without a registry entry: recognised by its attributes only.
  h.entities = Object.fromEntries(Object.entries(h.entities || {}).filter(([id]) => id !== DEP));
  const ed = new (tb.registry.get("train-board-card-editor"))();
  ed.setConfig({ type: "custom:train-board-card" });
  ed.hass = h;
  const picker = ed._form.schema.find((x) => x.name === "entity").selector.entity;
  assert.ok(picker.include_entities.includes(DEP));
  assert.equal(picker.domain, "sensor");
  // Nothing found: back to the integration filter.
  const empty = new (tb.registry.get("train-board-card-editor"))();
  empty.setConfig({ type: "custom:train-board-card" });
  empty.hass = { states: {}, entities: {}, language: "en" };
  assert.ok(empty._form.schema.find((x) => x.name === "entity").selector.entity.filter.length > 0);
});

test("stub configuration: the first entity of a supported integration; registration in the card picker", () => {
  assert.deepEqual({ ...tb.cards.full.getStubConfig(fx.dbInfoscreen()) }, { entity: DEP });
  assert.deepEqual({ ...tb.cards.full.getStubConfig({ states: {} }) }, {});
  const types = tb.sandbox.window.customCards.map((c) => c.type);
  assert.deepEqual([...types], ["train-board-card", "train-board-mini-card"]);
});

test("brand badge: the operator of the integration on the header icon, only when its logo is bundled", () => {
  const badge = (h) => h.match(/<span class="badge" title="([^"]*)"><img src="data:image\/(svg\+xml|png)/);
  assert.equal(badge(html(mount("train-board-card", { entity: DEP })))[1], "DB Infoscreen");
  // The illustrated header: the round tinted icon, its badge at the bottom right, then the title and the statistics.
  assert.match(
    html(mount("train-board-card", { entity: DEP })),
    /<div class="htext"><div class="logo \w+" title="Köln Hbf"><svg[\s\S]*?<\/svg><span class="badge"[\s\S]*?<\/span><\/div><div class="titles"><div class="trow"><div class="name">Köln Hbf<\/div><span class="chip hpill[^>]*><span class="dot"><\/span><span class="txt">[^<]+<\/span><\/span><\/div><div class="stats">/,
  );
  assert.equal(badge(html(mount("train-board-card", { entity: DEP, illustration: false })))[1], "DB Infoscreen");
  assert.equal(badge(html(mount("train-board-mini-card", { entity: DEP })))[1], "DB Infoscreen");
  assert.ok(badge(html(mount("train-board-card", { entity: "sensor.train_schedule_wyb_wat" }, fx.nationalRailUk()))));
  assert.ok(badge(html(mount("train-board-card", { entity: "sensor.amsterdam_utrecht_departure" }, fx.nederlandseSpoorwegen()))));
  assert.ok(badge(html(mount("train-board-card", { entity: "sensor.train_traveler_ren_nan_journeys" }, fx.trainTraveler()))));
  assert.equal(badge(html(mount("train-board-card", { entity: "sensor.gares_next_departure" }, fx.publicTransport())))[2], "png");
  // `brand` (YAML) picks another bundled logo.
  assert.match(html(mount("train-board-card", { entity: DEP, brand: "obb" })), /%23E40327/);
  // Every integration has its logo; a brand without one gets no badge, no empty tile.
  for (const [h, id] of [
    [fx.swissTransport(), "sensor.swiss_transport_bern_ab12"],
    [fx.nmbs(), "sensor.trains_in_gent_sint_pieters"],
    [fx.viaggiatreno(), "sensor.train_9544"],
    [fx.trafikverket(), "sensor.stockholm_c_uppsala_c_departure_time"],
    [fx.swissPublicTransport(), "sensor.zurich_hb_luzern_departure"],
  ])
    assert.ok(badge(html(mount("train-board-card", { entity: id }, h))), id);
  assert.doesNotMatch(html(mount("train-board-card", { entity: DEP, brand: "unknown" })), /class="badge"/);
  // The wide logotypes: the badge shows their emblem alone (no text paths).
  const tv = html(mount("train-board-card", { entity: "sensor.stockholm_c_uppsala_c_departure_time" }, fx.trafikverket()));
  assert.doesNotMatch(decodeURIComponent(tv.match(/<img src="data:image\/svg\+xml,([^"]*)"/)[1]), /<path[^>]*fill="#000000"/);
  const brands = Object.fromEntries(tb.TB_ADAPTERS.map((a) => [a.id, a.brand]));
  assert.deepEqual(brands, {
    db_infoscreen: "deutschebahn",
    nationalrailuk: "nationalrail",
    nationalrailtimes: "nationalrail",
    swiss_transport: "sbb",
    public_transport: "public-transport",
    nederlandse_spoorwegen: "nederlandsespoorwegen",
    trafikverket_train: "trafikverket",
    swiss_public_transport: "sbb",
    viaggiatreno: "trenitalia",
    nmbs: "sncb",
    uk_transport: "nationalrail",
    train_traveler: "sncf",
    gtfs2: undefined,
  });
});

test("a dark theme while the sun is up shows the night picture", () => {
  const h = fx.dbInfoscreen();
  h.states["sun.sun"] = { entity_id: "sun.sun", state: "above_horizon", attributes: {} };
  h.themes = { darkMode: true };
  assert.equal(tb.tbIsNight(h, {}), true);
  assert.match(html(mount("train-board-card", { entity: DEP }, h)), /class="banner dep night"/);
  assert.match(html(mount("train-board-mini-card", { entity: DEP }, h)), /class="banner dep night"/);
});

test("the header's status pill: a cancelled train is a disruption, else delays, else on time; grey without real-time or trains", () => {
  const now = NOW;
  const tab = (trains) => ({ kind: "departure", trains });
  const train = (o) => ({ realtime: true, cancelled: false, delayedUnknown: false, delay: 0, scheduled: now + 20 * 60000, expected: null, ...o });
  const st = (trains, config = {}) => tb.tbBoardStatus(fx.dbInfoscreen(), config, tab(trains), now);
  assert.deepEqual({ ...st([train({})]) }, { cls: "ok", key: "on_time" });
  assert.deepEqual({ ...st([train({}), train({ delay: 5 })]) }, { cls: "warn", key: "delays" });
  assert.deepEqual({ ...st([train({ delay: 5 }), train({ cancelled: true })]) }, { cls: "danger", key: "disruption" });
  // Only the trains listed count (max_trains).
  assert.deepEqual({ ...st([train({}), train({ cancelled: true })], { max_trains: 1 }) }, { cls: "ok", key: "on_time" });
  assert.deepEqual({ ...st([train({ realtime: false })]) }, { cls: "na", key: "scheduled" });
  assert.deepEqual({ ...st([]) }, { cls: "na", key: "no_trains_short" });
  // On the card: the pill on the title row and the icon in the same colour, translated.
  const h = html(mount("train-board-card", { entity: DEP, language: "fr" }));
  const [, cls, label] = h.match(/<div class="trow"><div class="name">[^<]*<\/div><span class="chip hpill (\w+)" title="([^"]+)">/);
  assert.match(h, new RegExp(`<div class="logo ${cls}"`));
  assert.ok(["À l’heure", "Retards", "Perturbations", "Prévu", "Aucun train"].includes(label), label);
});

test("the popup's opener selector escapes a train key holding a quote or a backslash", () => {
  const card = mount("train-board-card", { entity: DEP });
  click(card, { train: 'a"b\\c' });
  assert.equal(card._popup.opener, '[data-train="a\\"b\\\\c"]');
  tb.sandbox.fire("keydown", { key: "Escape", stopPropagation() {} });
  assert.equal(card._popup, null);
});

test("GTFS2 with SNCF TER lines: « C17 » whole in the pill, train number, arrival time, and a separator before tomorrow's trains (#29)", () => {
  const card = mount("train-board-card", { entity: "sensor.gtfs_beauvais_paris", max_trains: 4 }, fx.gtfs2Line());
  const h = html(card);
  assert.match(h, /<span class="type"[^>]*>C17<\/span>/);
  assert.match(h, /<span class="dest">Paris Gare du Nord<\/span><span class="num muted">847428<\/span><span class="arr muted"/);
  assert.doesNotMatch(text(h), /None/);
  assert.match(h, /<div class="day-sep muted" role="separator">Tomorrow<\/div>/);
  assert.equal((h.match(/class="day-sep/g) || []).length, 1);
  const off = html(mount("train-board-card", { entity: "sensor.gtfs_beauvais_paris", show_arrival_time: false }, fx.gtfs2Line()));
  assert.doesNotMatch(off, /class="arr muted"/);
});
