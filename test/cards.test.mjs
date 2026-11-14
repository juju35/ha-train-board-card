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
  assert.equal(stats(card), "Departures 3 trains 33 % on time".replace(/ %/, "%").replace("33%", "33%"));
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
  assert.equal(stats(card), "Arrivals 1 train 0% on time");
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
  assert.match(text(h), /Köln Hbf 08:12 in 16 min ICE Hamburg-Altona 6 \+4 min/);
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
  assert.match(full, /<div class="header"><div class="logo">/);
  const mini = html(mount("train-board-mini-card", { entity: DEP, illustration: false }));
  assert.match(mini, /<div class="next">/);
  assert.match(mini, /class="logo"/);
});

test("night picture: the sun below the horizon, else the dark theme; illustration_theme forces it", () => {
  const h = fx.dbInfoscreen();
  assert.equal(tb.tbIsNight(h, {}), false);
  h.themes.darkMode = true;
  assert.equal(tb.tbIsNight(h, {}), true);
  h.states["sun.sun"] = { entity_id: "sun.sun", state: "above_horizon", attributes: {} };
  assert.equal(tb.tbIsNight(h, {}), false);
  h.states["sun.sun"].state = "below_horizon";
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
  assert.equal(stats(card), "Départs 3 trains 33 % à l’heure");
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

test("stub configuration: the first entity of a supported integration; registration in the card picker", () => {
  assert.deepEqual({ ...tb.cards.full.getStubConfig(fx.dbInfoscreen()) }, { entity: DEP });
  assert.deepEqual({ ...tb.cards.full.getStubConfig({ states: {} }) }, {});
  const types = tb.sandbox.window.customCards.map((c) => c.type);
  assert.deepEqual([...types], ["train-board-card", "train-board-mini-card"]);
});

test("brand badge: the operator of the integration on the header icon, only when its logo is bundled", () => {
  const badge = (h) => h.match(/<span class="badge" title="([^"]*)"><img src="data:image\/(svg\+xml|png)/);
  assert.equal(badge(html(mount("train-board-card", { entity: DEP })))[1], "DB Infoscreen");
  assert.match(html(mount("train-board-card", { entity: DEP })), /<span class="ticon">/);
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
  });
});
