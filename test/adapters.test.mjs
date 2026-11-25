// Each integration's entity, read into the card's train model.
import assert from "node:assert/strict";
import { test } from "node:test";
import * as fx from "./fixtures.mjs";
import { load } from "./load.mjs";

const { NOW } = fx;
const tb = load({ now: NOW });
const min = (m) => NOW + m * 60000;
const read = (hass, id, kind = "departure") => tb.tbRead(hass, id, { kind, now: NOW });
// The fields a test looks at, as plain data (the sandbox's arrays are of another realm).
const pick = (t, keys) => JSON.parse(JSON.stringify(Object.fromEntries(keys.map((k) => [k, t[k]]))));

test("every adapter has an id, a name, a link and both functions", () => {
  assert.equal(tb.TB_ADAPTERS.length, 13);
  for (const a of tb.TB_ADAPTERS) {
    assert.match(a.id, /^[a-z][a-z0-9_]*$/);
    assert.ok(a.name && /^https:\/\//.test(a.url), a.id);
    assert.equal(typeof a.detect, "function");
    assert.equal(typeof a.read, "function");
  }
});

test("times: ISO, unix seconds and ms, HH:MM around now, local date-times", () => {
  assert.equal(tb.tbTime("2026-11-14T08:05:00+00:00", NOW), min(5));
  assert.equal(tb.tbTime(NOW / 1000 + 60, NOW), min(1));
  assert.equal(tb.tbTime(NOW, NOW), NOW);
  assert.equal(tb.tbTime("08:30", NOW), min(30));
  // Just after midnight, a 23:50 departure is yesterday's, a 00:10 one today's.
  const night = Date.parse("2026-11-14T00:05:00Z");
  assert.equal(tb.tbTime("23:50", night), night - 15 * 60000);
  assert.equal(tb.tbTime("2026-11-14 08:10:00", NOW), min(10));
  assert.equal(tb.tbTime("Cancelled", NOW), null);
  assert.equal(tb.tbTime(null, NOW), null);
});

test("train names split into category and number, and families", () => {
  assert.deepEqual({ ...tb.tbSplitTrain("ICE 578") }, { type: "ICE", number: "578" });
  assert.deepEqual({ ...tb.tbSplitTrain("S3") }, { type: "S", number: "3" });
  assert.deepEqual({ ...tb.tbSplitTrain("TGV INOUI 8812") }, { type: "TGV INOUI", number: "8812" });
  assert.deepEqual({ ...tb.tbSplitTrain("8812") }, { type: "", number: "8812" });
  assert.equal(tb.tbFamily("TGV"), "high_speed");
  assert.equal(tb.tbFamily("ICE"), "high_speed");
  assert.equal(tb.tbFamily("IC"), "intercity");
  assert.equal(tb.tbFamily("TER"), "regional");
  assert.equal(tb.tbFamily("RE"), "regional");
  assert.equal(tb.tbFamily("S"), "suburban");
  assert.equal(tb.tbFamily("", "long_distance"), "intercity");
  assert.equal(tb.tbFamily("", "Train grande vitesse"), "high_speed");
});

test("db_infoscreen: departures with delay, platform change, cancellation, via and messages; gone trains dropped", () => {
  const h = fx.dbInfoscreen();
  const r = read(h, "sensor.koln_hbf_departures");
  assert.equal(r.adapter.id, "db_infoscreen");
  assert.equal(r.station, "Köln Hbf");
  assert.deepEqual([...r.messages], ["Lift to platform 4 out of service"]);
  const [gone, ice, re, s] = r.trains;
  assert.equal(gone.label, "IC 2013");
  assert.deepEqual(pick(ice, ["scheduled", "expected", "delay", "type", "number", "platform", "platformChanged", "place", "family"]), {
    scheduled: min(12),
    expected: min(16),
    delay: 4,
    type: "ICE",
    number: "578",
    platform: "6",
    platformChanged: true,
    place: "Hamburg-Altona",
    family: "high_speed",
  });
  assert.deepEqual([...ice.via], ["Düsseldorf Hbf", "Duisburg Hbf", "Essen Hbf"]);
  assert.deepEqual([...ice.messages], ["Delay of a preceding train"]);
  assert.equal(ice.key, "2026111408578");
  assert.equal(re.type, "RE");
  assert.equal(re.delay, 0);
  assert.equal(s.cancelled, true);
  assert.equal(s.type, "S");
  const board = tb.tbBoard(h, { entity: "sensor.koln_hbf_departures" }, NOW);
  assert.equal(board.tabs.departures.total, 3, "the IC that left 5 minutes ago is off the board");
});

test("db_infoscreen in arrival mode: arrival times and the origin from the route", () => {
  const r = read(fx.dbInfoscreen(), "sensor.koln_hbf_arrivals", "arrival");
  const [t] = r.trains;
  assert.deepEqual(pick(t, ["scheduled", "expected", "delay", "place"]), { scheduled: min(6), expected: min(13), delay: 7, place: "Amsterdam Centraal" });
});

test("National Rail UK (nationalrailuk): expected times, Cancelled and Delayed words", () => {
  const r = read(fx.nationalRailUk(), "sensor.train_schedule_wyb_wat");
  assert.equal(r.adapter.id, "nationalrailuk");
  assert.equal(r.station, "Weybridge");
  const [a, b, c] = r.trains;
  assert.deepEqual(pick(a, ["scheduled", "expected", "delay", "place", "platform"]), { scheduled: min(7), expected: min(9), delay: 2, place: "London Waterloo", platform: "2" });
  assert.equal(b.cancelled, true);
  assert.equal(b.platform, "");
  assert.equal(c.delayedUnknown, true);
  assert.equal(tb.tbStatus(fx.nationalRailUk(), {}, c, "departure", NOW).key, "delayed");
});

test("National Rail Departure Times (nationalrailtimes): the next service, its calling points and the station messages", () => {
  const r = read(fx.nationalRailTimes(), "sensor.trains_abbey_wood_to_london_charing_cross");
  assert.equal(r.adapter.id, "nationalrailtimes");
  assert.equal(r.station, "Abbey Wood");
  assert.equal(r.trains.length, 1);
  const [t] = r.trains;
  assert.deepEqual(pick(t, ["scheduled", "expected", "delay", "place", "platform", "operator"]), {
    scheduled: min(5),
    expected: min(8),
    delay: 3,
    place: "London Charing Cross",
    platform: "3",
    operator: "Southeastern",
  });
  assert.deepEqual([...t.via], ["Plumstead", "Woolwich Arsenal"]);
  assert.equal(t.stops[0].time, min(11));
  assert.deepEqual([...t.messages], ["This train has been delayed by a broken down train"]);
  assert.match(r.messages[0], /Dartford/);
});

test("Swiss Transport (swiss_transport): station board with categories, delays, platform changes and alerts", () => {
  const h = fx.swissTransport();
  const r = read(h, "sensor.swiss_transport_bern_ab12");
  assert.equal(r.adapter.id, "swiss_transport");
  assert.equal(r.station, "Bern");
  const [ic, s1, ir] = r.trains;
  assert.deepEqual(pick(ic, ["type", "number", "label", "place", "platform", "delay"]), { type: "IC", number: "8", label: "IC 8", place: "Brig", platform: "6", delay: 0 });
  assert.deepEqual(pick(s1, ["expected", "delay", "platformChanged"]), { expected: min(9), delay: 3, platformChanged: true });
  assert.equal(ir.cancelled, true);
  assert.match(r.messages[0], /replacement buses/);
  // A saved connection: the next train to the destination.
  const c = read(h, "sensor.swiss_transport_bern_zurich_hb_cd34");
  assert.equal(c.station, "Bern");
  assert.deepEqual(pick(c.trains[0], ["type", "number", "place", "platform", "expected", "delay"]), {
    type: "IC",
    number: "1",
    place: "Zürich HB",
    platform: "8",
    expected: min(3),
    delay: 1,
  });
});

test("Public Transport (public_transport): line colours, real time or timetable, alerts", () => {
  const r = read(fx.publicTransport(), "sensor.gares_next_departure");
  assert.equal(r.adapter.id, "public_transport");
  assert.equal(r.station, "Gares");
  const [a, b] = r.trains;
  assert.deepEqual(pick(a, ["type", "color", "scheduled", "expected", "delay", "family", "realtime"]), {
    type: "A",
    color: "#e3051b",
    scheduled: min(1),
    expected: min(2),
    delay: 1,
    family: "suburban",
    realtime: true,
  });
  assert.equal(b.realtime, false);
  assert.equal(b.expected, null);
  assert.equal(tb.tbColor({}, b), "#e3051b", "a colour without its # still reads");
  assert.deepEqual([...r.messages], ["Escalator out of order — Use the lift."]);
});

test("notices carrying HTML are reduced to plain text, and ones that differ only by markup collapse", () => {
  const hass = fx.publicTransport();
  const s = hass.states["sensor.gares_next_departure"];
  s.attributes.alerts = [
    { id: "1", title: "Voitures hors quai", description: "<p>Dernières voitures non reçues<span> </span>à quai.</p>" },
    { id: "2", title: "Voitures hors quai", description: "<div>Dernières voitures non reçues à quai.</div>\n" },
  ];
  const r = read(hass, "sensor.gares_next_departure");
  assert.equal(r.messages.length, 1, "the two HTML variants collapse to one plain-text notice");
  assert.equal(r.messages[0], "Voitures hors quai — Dernières voitures non reçues à quai.");
  assert.ok(!/[<>]|&(?:nbsp|amp|lt|gt|quot|apos|#\d+);/i.test(r.messages[0]), "no tags or entities remain");
});

test("Nederlandse Spoorwegen: the trip (delay, platform change, route) and the next one from the timetable", () => {
  const r = read(fx.nederlandseSpoorwegen(), "sensor.amsterdam_utrecht_departure");
  assert.equal(r.adapter.id, "nederlandse_spoorwegen");
  assert.equal(r.station, "Amsterdam Centraal");
  const [t, next] = r.trains;
  assert.deepEqual(pick(t, ["scheduled", "expected", "delay", "platform", "platformChanged", "place"]), {
    scheduled: min(8),
    expected: min(10),
    delay: 2,
    platform: "5b",
    platformChanged: true,
    place: "Utrecht Centraal",
  });
  assert.deepEqual([...t.via], ["Amsterdam Amstel"]);
  assert.deepEqual(pick(next, ["scheduled", "realtime"]), { scheduled: min(23), realtime: false });
});

test("Trafikverket Train: the sensors of the route's device, found by translation key", () => {
  const h = fx.trafikverket();
  const r = read(h, "sensor.stockholm_c_uppsala_c_departure_time");
  assert.equal(r.adapter.id, "trafikverket_train");
  assert.equal(r.station, "Stockholm C");
  const [t, n1, n2] = r.trains;
  assert.deepEqual(pick(t, ["scheduled", "expected", "delay", "place", "cancelled"]), { scheduled: min(8), expected: min(12), delay: 4, place: "Uppsala C", cancelled: false });
  assert.deepEqual([...t.messages], ["Late", "Bus replaces the train after Uppsala"]);
  assert.equal(n1.scheduled, min(38));
  assert.equal(n2.realtime, false);
  // Without translation keys (older Home Assistant), the end of the entity ids.
  for (const e of Object.values(h.entities)) delete e.translation_key;
  assert.equal(read(h, "sensor.stockholm_c_uppsala_c_departure_time").trains[0].delay, 4);
  // Only the main sensor of the device is offered.
  assert.deepEqual([...tb.tbCandidates(fx.trafikverket())], ["sensor.stockholm_c_uppsala_c_departure_time"]);
});

test("Swiss public transport (core): three departures, line, platform and delay of the first", () => {
  const r = read(fx.swissPublicTransport(), "sensor.zurich_hb_luzern_departure");
  assert.equal(r.adapter.id, "swiss_public_transport");
  assert.equal(r.station, "Zürich HB");
  assert.equal(r.trains.length, 3);
  assert.deepEqual(pick(r.trains[0], ["scheduled", "expected", "delay", "type", "number", "platform", "place"]), {
    scheduled: min(2),
    expected: min(4),
    delay: 2,
    type: "IR",
    number: "16",
    platform: "4",
    place: "Luzern",
  });
  assert.equal(r.trains[2].realtime, false);
});

test("ViaggiaTreno: the followed train, its category and its delay", () => {
  const r = read(fx.viaggiatreno(), "sensor.train_9544");
  assert.equal(r.adapter.id, "viaggiatreno");
  assert.equal(r.station, "ROMA TERMINI");
  assert.deepEqual(pick(r.trains[0], ["type", "number", "scheduled", "delay", "place", "family"]), {
    type: "FR",
    number: "9544",
    scheduled: min(10),
    delay: 6,
    place: "MILANO CENTRALE",
    family: "high_speed",
  });
});

test("NMBS / SNCB: the liveboard's next train, track and destination from the state", () => {
  const r = read(fx.nmbs(), "sensor.trains_in_gent_sint_pieters");
  assert.equal(r.adapter.id, "nmbs");
  assert.equal(r.station, "Gent-Sint-Pieters");
  assert.deepEqual(pick(r.trains[0], ["type", "number", "platform", "place", "delay", "scheduled"]), {
    type: "IC",
    number: "1532",
    platform: "4",
    place: "Brussel-Zuid",
    delay: 3,
    scheduled: min(6),
  });
});

test("UK Transport: next trains with estimated times and cancellations", () => {
  const r = read(fx.ukTransport(), "sensor.next_train_to_wat");
  assert.equal(r.adapter.id, "uk_transport");
  const [a, b, c] = r.trains;
  assert.equal(a.delay, 0);
  assert.equal(b.delay, 4);
  assert.equal(c.cancelled, true);
  assert.equal(a.operator, "South Western Railway");
});

test("Train Traveler: journeys, delays in seconds, disruptions, families from the physical mode", () => {
  const r = read(fx.trainTraveler(), "sensor.train_traveler_ren_nan_journeys");
  assert.equal(r.adapter.id, "train_traveler");
  assert.equal(r.station, "Rennes");
  const [ter, tgv] = r.trains;
  assert.deepEqual(pick(ter, ["type", "delay", "expected", "place", "family"]), { type: "TER", delay: 10, expected: min(15), place: "Nantes", family: "regional" });
  assert.deepEqual([...ter.messages], ["Train delayed by a signalling fault"]);
  assert.deepEqual(pick(tgv, ["type", "family"]), { type: "TGV INOUI", family: "high_speed" });
});

test("GTFS2: the route's next departures, headsigns, train number, GTFS-RT expected times and stop alerts", () => {
  const r = read(fx.gtfs2(), "sensor.ter_rennes_to_nantes_next_departure");
  assert.equal(r.adapter.id, "gtfs2");
  assert.equal(r.station, "Rennes");
  assert.equal(r.brand, "sncf");
  const [a, b, c] = r.trains;
  assert.deepEqual(pick(a, ["type", "number", "place", "family", "realtime", "delay", "platform"]), {
    type: "TER",
    number: "858412",
    place: "Nantes",
    family: "regional",
    realtime: true,
    delay: 7,
    platform: "",
  });
  assert.deepEqual(pick(b, ["number", "place", "realtime", "delay"]), { number: "", place: "Savenay", realtime: true, delay: 0 });
  assert.deepEqual(pick(c, ["realtime", "expected"]), { realtime: false, expected: null });
  assert.equal(a.stops[0].name, "Nantes");
  assert.equal(a.stops[0].time, min(80));
  assert.deepEqual([...r.messages], ["Works between Redon and Nantes"]);
  // Without a real-time feed (« - »), the timetable alone; another agency, no badge.
  const h = fx.gtfs2();
  Object.assign(h.states["sensor.ter_rennes_to_nantes_next_departure"].attributes, { next_departures_realtime: "-", attribution: "STAR" });
  const t = read(h, "sensor.ter_rennes_to_nantes_next_departure");
  assert.ok(t.trains.every((x) => !x.realtime));
  assert.equal(t.brand, "");
  // In arrival mode: arrival times, from the origin.
  const arr = tb.tbRead(fx.gtfs2(), "sensor.ter_rennes_to_nantes_next_departure", { kind: "arrival", now: NOW });
  assert.equal(arr.station, "Nantes");
  assert.deepEqual(pick(arr.trains[0], ["scheduled", "place"]), { scheduled: min(80), place: "Rennes" });
});

test("detection without the entity registry, from the attributes alone", () => {
  const cases = [
    [fx.dbInfoscreen(), "sensor.koln_hbf_departures", "db_infoscreen"],
    [fx.nationalRailUk(), "sensor.train_schedule_wyb_wat", "nationalrailuk"],
    [fx.nationalRailTimes(), "sensor.trains_abbey_wood_to_london_charing_cross", "nationalrailtimes"],
    [fx.swissTransport(), "sensor.swiss_transport_bern_ab12", "swiss_transport"],
    [fx.publicTransport(), "sensor.gares_next_departure", "public_transport"],
    [fx.nederlandseSpoorwegen(), "sensor.amsterdam_utrecht_departure", "nederlandse_spoorwegen"],
    [fx.viaggiatreno(), "sensor.train_9544", "viaggiatreno"],
    [fx.nmbs(), "sensor.trains_in_gent_sint_pieters", "nmbs"],
    [fx.ukTransport(), "sensor.next_train_to_wat", "uk_transport"],
    [fx.trainTraveler(), "sensor.train_traveler_ren_nan_journeys", "train_traveler"],
    [fx.gtfs2(), "sensor.ter_rennes_to_nantes_next_departure", "gtfs2"],
    [fx.trafikverket(), "sensor.stockholm_c_uppsala_c_departure_time", "trafikverket_train"],
    [fx.swissPublicTransport(), "sensor.zurich_hb_luzern_departure", "swiss_public_transport"],
  ];
  for (const [h, id, want] of cases) {
    const bare = { ...h, entities: {} };
    assert.equal(tb.tbAdapterFor(bare, id)?.id, want, id);
  }
  // A forced integration wins.
  assert.equal(tb.tbAdapterFor(fx.nmbs(), "sensor.trains_in_gent_sint_pieters", "uk_transport").id, "uk_transport");
});

test("a broken attribute does not break the card", () => {
  const h = fx.dbInfoscreen();
  h.states["sensor.koln_hbf_departures"].attributes.next_departures = [null, { train: "RE 5" }];
  const r = read(h, "sensor.koln_hbf_departures");
  assert.ok(r);
  assert.equal(r.trains.length, 0);
});

test("local times are read in Home Assistant's time zone, not the browser's", () => {
  const h = fx.nederlandseSpoorwegen();
  h.config.time_zone = "Europe/Amsterdam";
  // 08:00 UTC is 09:00 in Amsterdam (winter): « 09:08 » is 8 minutes from now.
  h.states["sensor.amsterdam_utrecht_departure"].attributes.departure_time_planned = "09:08";
  h.states["sensor.amsterdam_utrecht_departure"].attributes.departure_time_actual = "09:10";
  h.states["sensor.amsterdam_utrecht_departure"].attributes.next = "09:23";
  const [t] = read(h, "sensor.amsterdam_utrecht_departure").trains;
  assert.equal(t.scheduled, min(8));
  assert.equal(t.expected, min(10));
  const d = fx.dbInfoscreen();
  d.config.time_zone = "America/New_York";
  d.states["sensor.koln_hbf_arrivals"].attributes.next_departures[0].scheduledArrival = "2026-11-14 03:06";
  assert.equal(read(d, "sensor.koln_hbf_arrivals", "arrival").trains[0].scheduled, min(6));
});
