// ---------------------------------------------------------------------------
// Integrations: each adapter reads the entity of one integration into the card's own train model.
//
// A train, whatever its integration:
//   { key, scheduled, expected, delay, cancelled, delayedUnknown, realtime, place, type, number, label, color,
//     platform, platformChanged, via: [names], stops: [{ name, time }], messages: [texts], operator }
// - scheduled / expected: times in ms (expected null when the integration has no real time for the train);
// - delay: minutes behind the timetable (null when unknown); delayedUnknown: « Delayed » without a time (Darwin);
// - place: the destination of a departure, the origin of an arrival;
// - type: the category (ICE, TGV, TER, IC, RE, S…), number: the train or line number, label: both as announced;
// - realtime: false for a train known from the timetable only (no status pill).
// An adapter returns { station, trains, messages }, `messages` being the station's notices.
// ---------------------------------------------------------------------------

const TB_NO_VALUE = new Set(["unavailable", "unknown", "", "none", "None"]);

const tbList = (v) => (Array.isArray(v) ? v : v === null || v === undefined || v === "" ? [] : [v]);
const tbStr = (v) => (v === null || v === undefined ? "" : String(v).trim());
// Plain text from a notice that may carry HTML (SNCF/GTFS disruptions come as `<p>…</p>`, `&nbsp;`, entities):
// drop the tags, turn block ends into spaces, decode the common entities, collapse whitespace. Stripping the
// markup also lets notices that differ only by their HTML collapse through the Set dedup downstream.
const tbDecode = (v) => {
  const s = v === null || v === undefined ? "" : String(v);
  if (s.indexOf("<") < 0 && s.indexOf("&") < 0) return s.replace(/\s+/g, " ").trim();
  return s
    .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6])\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:#39|apos);/gi, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/\s+/g, " ")
    .trim();
};
const tbNum = (v) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const tbBool = (v) => v === true || /^(true|on|yes|1)$/i.test(String(v ?? ""));

// Offset (ms) of a time zone at a given time: Home Assistant writes local times (« HH:MM », date-times without
// offset) in its own time zone, which may not be the browser's.
let _tbTz = null;
const _tbTzFormats = new Map();
const tbTzOffset = (tz, at) => {
  if (!tz) return -new Date(at).getTimezoneOffset() * 60000;
  let f = _tbTzFormats.get(tz);
  if (f === undefined) {
    try {
      f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric" });
    } catch (_e) {
      f = null;
    }
    _tbTzFormats.set(tz, f);
  }
  if (!f) return -new Date(at).getTimezoneOffset() * 60000;
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - Math.floor(at / 1000) * 1000;
};
// A wall-clock time of Home Assistant's time zone as ms.
const tbWall = (y, mo, d, h, mi, sec, ref) => {
  const guess = Date.UTC(y, mo, d, h, mi, sec);
  const ms = guess - tbTzOffset(_tbTz, guess);
  // Around a DST change, the offset at the result may differ from the one at the guess.
  return guess - tbTzOffset(_tbTz, ms) || ref;
};

// A time of any integration as ms: ISO strings, « YYYY-MM-DD HH:MM[:SS] » (local), « HH:MM » (today, or the day
// before / after when that is more than 12 hours away), unix seconds or milliseconds, Date objects. Local times
// are read in Home Assistant's time zone.
const tbTime = (v, now = Date.now()) => {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  if (typeof v === "number") return Number.isFinite(v) ? (v > 1e11 ? v : v * 1000) : null;
  const s = String(v).trim();
  if (/^\d{9,13}$/.test(s)) return tbTime(Number(s), now);
  const hm = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const today = new Date(now + tbTzOffset(_tbTz, now));
    let ms = tbWall(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), Number(hm[1]), Number(hm[2]), Number(hm[3] || 0), now);
    if (ms < now - 12 * 3600e3) ms += 864e5;
    else if (ms > now + 12 * 3600e3) ms -= 864e5;
    return ms;
  }
  const local = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (local) return tbWall(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6] || 0), now);
  const ms = Date.parse(s);
  return Number.isFinite(ms) ? ms : null;
};

// « ICE 578 » → ICE / 578, « S3 » → S / 3, « TER » → TER, « 8812 » → number only.
const tbSplitTrain = (label) => {
  const s = tbStr(label).replace(/\s+/g, " ");
  if (!s) return { type: "", number: "" };
  const m = s.match(/^([A-Za-zÀ-ÿ]+(?:[ -][A-Za-zÀ-ÿ]+)?)[ -]?(\d[\w-]*)?$/);
  if (m) return { type: m[1].toUpperCase(), number: m[2] || "" };
  if (/^\d[\w-]*$/.test(s)) return { type: "", number: s };
  const first = s.split(" ");
  return /^[A-Za-zÀ-ÿ]+$/.test(first[0]) ? { type: first[0].toUpperCase(), number: first.slice(1).join(" ") } : { type: "", number: s };
};

// Train categories by family, for the colour of their pill.
const TB_FAMILIES = {
  high_speed: ["TGV", "INOUI", "OUIGO", "ICE", "ECE", "RJ", "RJX", "FR", "FA", "FB", "AV", "AVE", "AVLO", "ALVIA", "EST", "ES", "THA", "EUROSTAR", "LYRIA", "TGV INOUI", "FRECCIAROSSA", "ICD", "X2000", "SJ SNABBTÅG"],
  intercity: ["IC", "EC", "IR", "ICN", "IN", "EN", "NJ", "D", "ICL", "INTERCITÉS", "INTERCITES", "INTERCITY", "IC BUS", "LD", "EXT", "FLX", "WB"],
  regional: ["TER", "RE", "RB", "R", "REG", "RV", "IRE", "SPR", "ST", "L", "P", "MEX", "RS", "TRAIN", "REGIO", "PE", "SPRINTER", "TRAIN TER", "ZUG"],
  suburban: ["S", "RER", "U", "SN", "TRANSILIEN", "PENDELTÅG", "S-BAHN", "SBAHN", "M", "METRO", "T", "TRAM"],
  bus: ["B", "BUS", "SEV", "EV", "NFB", "AUTOCAR", "CAR", "EXB"],
};
// db_infoscreen's own train classes (trainClasses), mapped by the integration.
const TB_CLASS_FAMILY = { long_distance: "intercity", regional_db: "regional", regional: "regional", s_bahn: "suburban", u_bahn: "suburban", tram: "suburban", bus: "bus" };
const tbFamily = (type, hint) => {
  const t = tbStr(type).toUpperCase();
  for (const [family, types] of Object.entries(TB_FAMILIES)) if (types.includes(t)) return family;
  if (/^(TGV|ICE|FR|AV)/.test(t)) return "high_speed";
  if (/^(IC|EC|IR)/.test(t)) return "intercity";
  if (/^S\d*$/.test(t) || /^RER/.test(t)) return "suburban";
  if (hint in TB_FAMILIES || hint === "other") return hint;
  return TB_CLASS_FAMILY[hint] || (/grande vitesse|high.?speed|tgv/i.test(hint || "") ? "high_speed" : /intercit/i.test(hint || "") ? "intercity" : /ter|regional|régional/i.test(hint || "") ? "regional" : "other");
};

// A finished train: the missing delay or expected time is deduced from the other, labels completed.
const tbTrain = (t) => {
  const out = {
    key: "",
    scheduled: null,
    expected: null,
    delay: null,
    cancelled: false,
    delayedUnknown: false,
    realtime: true,
    place: "",
    type: "",
    number: "",
    label: "",
    color: "",
    family: "",
    platform: "",
    platformChanged: false,
    via: [],
    stops: [],
    messages: [],
    operator: "",
    ...t,
  };
  if (out.scheduled === null && out.expected !== null) out.scheduled = out.expected;
  if (out.delay === null && out.expected !== null && out.scheduled !== null) out.delay = Math.round((out.expected - out.scheduled) / 60000);
  if (out.expected === null && out.delay !== null && out.scheduled !== null) out.expected = out.scheduled + out.delay * 60000;
  if (out.delay !== null) out.delay = Math.round(out.delay);
  out.place = tbStr(out.place);
  out.platform = tbStr(out.platform);
  out.type = tbStr(out.type).toUpperCase();
  out.number = tbStr(out.number);
  if (!out.label) out.label = [out.type, out.number].filter(Boolean).join(" ");
  out.family = tbFamily(out.type, out.family);
  out.via = tbList(out.via).map(tbStr).filter(Boolean);
  out.messages = [...new Set(tbList(out.messages).map(tbMessage).filter(Boolean))];
  // A key safe in an attribute and a selector: the trip id of the integration, else time, train and place.
  out.key = String(out.key || `${out.scheduled}_${out.label}_${out.place}`).replace(/[^\w.:-]+/g, "_");
  return out;
};

// The text of a notice: a string, or { text } / { title, description } / { message } objects.
const tbMessage = (m) => {
  if (!m) return "";
  if (typeof m === "string") return tbDecode(m);
  if (typeof m !== "object") return tbDecode(m);
  const text = m.text ?? m.message ?? m.summary ?? m.disruption_message ?? m.title ?? m.header ?? "";
  const extra = m.description && m.description !== text ? ` — ${m.description}` : "";
  return tbDecode(`${tbStr(text)}${extra}`);
};

// db_infoscreen messages: a list of { text } or of strings, or { delay: [...], qos: [...] }.
const tbMessages = (m) => (m && typeof m === "object" && !Array.isArray(m) ? Object.values(m).flat() : tbList(m));

const tbAttr = (s, k) => s?.attributes?.[k];

// Siblings of an entity on its device (integrations that spread a train over several sensors), by translation key
// (or, without one, by the end of their entity id: the longest of `keys` it ends with).
const tbSiblings = (hass, entityId, platform, keys = []) => {
  const reg = hass?.entities || {};
  const device = reg[entityId]?.device_id;
  const out = {};
  if (!device) return out;
  const byLength = [...keys].sort((a, b) => b.length - a.length);
  for (const [id, e] of Object.entries(reg)) {
    if (e.device_id !== device || (platform && e.platform && e.platform !== platform) || !hass.states[id]) continue;
    const key = e.translation_key || byLength.find((k) => id.endsWith(`_${k}`));
    if (key && !out[key]) out[key] = hass.states[id];
  }
  return out;
};
const tbDeviceName = (hass, entityId) => {
  const d = hass?.devices?.[hass?.entities?.[entityId]?.device_id];
  return tbStr(d?.name_by_user || d?.name);
};
// « Uppsala C - Stockholm C », « Uppsala to Stockholm »: the stations of a route named after them.
const tbRoute = (name) => {
  const m = tbStr(name).match(/^(.+?)\s+(?:-|–|→|>|to|naar|till|nach|vers|à)\s+(.+)$/i);
  return m ? { from: m[1].trim(), to: m[2].trim() } : { from: tbStr(name), to: "" };
};
const tbState = (s) => (s && !TB_NO_VALUE.has(String(s.state)) ? s.state : null);

const TB_TV_KEYS = ["departure_time", "departure_state", "cancelled", "delayed_time", "planned_time", "estimated_time", "actual_time", "other_info", "deviation", "departure_time_next", "departure_time_next_next"];

const TB_ADAPTERS = [
  {
    // FaserF/ha-db_infoscreen: next_departures, from the DBF / IRIS / HAFAS / EFA backends.
    id: "db_infoscreen",
    // Badge logo: images/deutschebahn.svg (or .png), embedded by the build when the file exists.
    brand: "deutschebahn",
    name: "DB Infoscreen",
    url: "https://github.com/FaserF/ha-db_infoscreen",
    detect: (s) => Array.isArray(tbAttr(s, "next_departures")) && "station" in (s.attributes || {}),
    read(s, _hass, { kind, now }) {
      const a = s.attributes;
      const arr = kind === "arrival";
      const trains = tbList(a.next_departures).map((d) => {
        const route = tbList(d.route_details || d.route).map((r) => tbStr(typeof r === "object" ? r.name : r));
        const label = tbStr(d.train || d.line);
        const split = tbSplitTrain(label);
        const scheduled = arr
          ? tbTime(d.scheduledArrival ?? d.sched_arr, now)
          : (tbTime(d.scheduled_timestamp, now) ?? tbTime(d.scheduledDeparture ?? d.sched_dep ?? d.scheduledTime ?? d.dep ?? d.datetime, now));
        const delay = tbNum(arr ? (d.delay_arrival ?? d.delayArrival) : (d.delay ?? d.delayDeparture));
        const platform = tbStr(d.platform);
        const sp = tbStr(d.scheduledPlatform);
        return tbTrain({
          key: tbStr(d.trip_id || d.deduplication_key) || undefined,
          scheduled,
          expected: arr ? tbTime(d.arrival_timestamp, now) : tbTime(d.departure_timestamp, now),
          delay,
          cancelled: tbBool(d.is_cancelled ?? d.isCancelled ?? d.cancelled),
          place: arr ? tbStr(d.origin || d.from || route[0] || d.destination) : tbStr(d.destination),
          type: split.type,
          number: tbStr(d.trainNumber) || split.number,
          label,
          family: tbList(d.trainClasses)[0],
          platform,
          platformChanged: tbBool(d.changed_platform) || (!!platform && !!sp && platform !== sp),
          via: tbList(d.via).length ? d.via : route.slice(arr ? 1 : 0, arr ? undefined : -1),
          stops: route.map((name) => ({ name })),
          messages: tbMessages(d.messages),
          operator: tbStr(d.operator),
        });
      });
      return { station: tbStr(a.station), trains, messages: tbList(a.station_messages) };
    },
  },
  {
    // jfparis/homeassistant_nationalrail (nationalrailuk): trains, from Darwin's departure board.
    id: "nationalrailuk",
    // Badge logo: images/nationalrail.svg (or .png), embedded by the build when the file exists.
    brand: "nationalrail",
    name: "National Rail UK",
    url: "https://github.com/jfparis/homeassistant_nationalrail",
    detect: (s) => tbList(tbAttr(s, "trains")).some((t) => t && "terminus" in t),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const trains = tbList(a.trains).map((t) => {
        const exp = tbStr(t.expected);
        const word = /^(cancelled|delayed)$/i.test(exp) ? exp.toLowerCase() : "";
        const dests = tbList(t.destinations);
        return tbTrain({
          scheduled: tbTime(t.scheduled, now),
          expected: word ? null : tbTime(t.expected, now),
          cancelled: word === "cancelled",
          delayedUnknown: word === "delayed",
          place: t.terminus,
          platform: t.platform,
          via: dests.map((d) => d.name).filter((n) => n && n !== t.terminus),
          stops: dests.map((d) => ({ name: d.name, time: tbTime(d.time_at_destination, now) ?? tbTime(d.scheduled_time_at_destination, now) })),
        });
      });
      return { station: tbStr(a.station || a.friendly_name), trains, messages: [] };
    },
  },
  {
    // crismc/homeassistant_nationalrailtimes_integration (nationalrailtimes): the next service to a destination.
    id: "nationalrailtimes",
    // Badge logo: images/nationalrail.svg (or .png), embedded by the build when the file exists.
    brand: "nationalrail",
    name: "National Rail Departure Times",
    url: "https://github.com/crismc/homeassistant_nationalrailtimes_integration",
    detect: (s) => !!tbAttr(s, "service") && "calling_points" in (s.attributes || {}),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const sv = a.service || {};
      const etd = tbStr(sv.etd);
      const word = /^(cancelled|delayed)$/i.test(etd) ? etd.toLowerCase() : /^on time$/i.test(etd) ? "ontime" : "";
      const scheduled = tbTime(sv.std, now);
      const calling = tbList(a.calling_points);
      const train = tbTrain({
        key: tbStr(sv.serviceID) || undefined,
        scheduled,
        expected: word === "ontime" ? scheduled : word ? null : tbTime(etd, now),
        cancelled: word === "cancelled" || tbBool(sv.isCancelled),
        delayedUnknown: word === "delayed",
        place: sv.destination?.location?.locationName || a.destination_name || a.target_station_name,
        platform: sv.platform,
        via: calling.map((c) => c.locationName).slice(0, -1),
        stops: calling.map((c) => ({ name: c.locationName, time: tbTime(/^\d/.test(tbStr(c.et)) ? c.et : c.st, now) })),
        messages: [sv.delayReason, sv.cancelReason],
        operator: sv.operator,
      });
      return { station: tbStr(a.station_name), trains: sv.std ? [train] : [], messages: tbList(a.message) };
    },
  },
  {
    // prusuino/ha_swiss_transport (swiss_transport): the station board (departures), or a saved connection.
    id: "swiss_transport",
    // Badge logo: images/sbb.svg (or .png), embedded by the build when the file exists.
    brand: "sbb",
    name: "Swiss Transport",
    url: "https://github.com/prusuino/ha_swiss_transport",
    detect: (s) => [...tbList(tbAttr(s, "departures")), ...tbList(tbAttr(s, "connections"))].some((d) => d && "departure_ts" in d),
    read(s, _hass, { now }) {
      const a = s.attributes;
      if (Array.isArray(a.connections)) {
        const trains = a.connections.map((c) => {
          const leg = tbList(c.legs)[0] || {};
          return tbTrain({
            scheduled: tbTime(c.departure_ts, now),
            expected: tbTime(c.departure_prognosis, now),
            delay: tbNum(c.delay),
            place: a.to_name || leg.to,
            type: leg.category,
            number: leg.number,
            label: leg.line,
            platform: c.dep_platform,
            via: tbList(c.changes).map((x) => x.station),
            stops: tbList(c.legs).map((l) => ({ name: l.to_name })),
          });
        });
        return { station: tbStr(a.from_name), trains, messages: [] };
      }
      const trains = tbList(a.departures).map((d) =>
        tbTrain({
          scheduled: tbTime(d.departure_ts, now),
          delay: tbNum(d.delay),
          cancelled: tbBool(d.cancelled),
          place: d.to,
          type: d.category,
          number: d.number,
          label: d.line,
          platform: d.platform,
          platformChanged: tbBool(d.platform_changed),
          operator: d.operator,
        }),
      );
      return { station: tbStr(a.station_name), trains, messages: tbList(a.alerts) };
    },
  },
  {
    // juju35/ha-public-transport (public_transport): the stop sensor (departures) or a line sensor (next_departures).
    id: "public_transport",
    // Badge logo: images/public-transport.svg (or .png), embedded by the build when the file exists.
    brand: "public-transport",
    name: "Public Transport",
    url: "https://github.com/juju35/ha-public-transport",
    detect: (s) => [...tbList(tbAttr(s, "departures")), ...tbList(tbAttr(s, "next_departures"))].some((d) => d && typeof d === "object" && "line_id" in d),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const trains = tbList(a.departures ?? a.next_departures).map((d) =>
        tbTrain({
          key: tbStr(d.trip_id) || undefined,
          scheduled: tbTime(d.scheduled, now) ?? tbTime(d.departure, now),
          expected: d.realtime === false ? null : tbTime(d.departure, now),
          delay: d.scheduled ? null : tbNum(d.delay),
          realtime: d.realtime !== false,
          place: d.destination,
          type: tbStr(d.train_number) || d.line,
          label: d.line,
          color: d.color,
          family: a.mode === "metro" || a.mode === "tram" ? "suburban" : a.mode === "bus" ? "bus" : "regional",
        }),
      );
      return { station: tbStr(a.stop_name), trains, messages: tbList(a.alerts) };
    },
  },
  {
    // Nederlandse Spoorwegen (core): the departure sensor of a route, its next trip from the timetable.
    id: "nederlandse_spoorwegen",
    // Badge logo: images/nederlandsespoorwegen.svg (or .png), embedded by the build when the file exists.
    brand: "nederlandsespoorwegen",
    name: "Nederlandse Spoorwegen",
    url: "https://www.home-assistant.io/integrations/nederlandse_spoorwegen/",
    detect: (s) => "going" in (s?.attributes || {}) && "departure_time_planned" in s.attributes,
    read(s, _hass, { now }) {
      const a = s.attributes;
      const route = tbList(a.route).map(tbStr);
      const planned = tbStr(a.departure_platform_planned);
      const actual = tbStr(a.departure_platform_actual);
      const base = { place: route.at(-1) || "", via: route.slice(1, -1), stops: route.slice(1).map((name) => ({ name })) };
      const trains = [];
      if (a.departure_time_planned)
        trains.push(
          tbTrain({
            ...base,
            scheduled: tbTime(a.departure_time_planned, now),
            expected: tbTime(a.departure_time_actual, now),
            cancelled: /cancel/i.test(tbStr(a.status)),
            platform: actual || planned,
            platformChanged: !!actual && !!planned && actual !== planned,
            messages: tbList(a.remarks),
          }),
        );
      if (a.next) trains.push(tbTrain({ ...base, scheduled: tbTime(a.next, now), realtime: false }));
      return { station: tbStr(route[0]), trains, messages: [] };
    },
  },
  {
    // Trafikverket Train (core): one device per route, a sensor per value (found by translation key).
    id: "trafikverket_train",
    // Badge logo: images/trafikverket.svg (or .png), embedded by the build when the file exists.
    brand: "trafikverket",
    name: "Trafikverket Train",
    url: "https://www.home-assistant.io/integrations/trafikverket_train/",
    detect: (s) => /trafikverket/i.test(tbStr(tbAttr(s, "attribution"))),
    read(s, hass, { now, entityId }) {
      const sib = tbSiblings(hass, entityId, "trafikverket_train", TB_TV_KEYS);
      if (!Object.keys(sib).length) sib.departure_time = s;
      const route = tbRoute(tbDeviceName(hass, entityId) || tbStr(s.attributes?.friendly_name));
      const v = (k) => tbState(sib[k]);
      const expected = tbTime(v("actual_time") ?? v("estimated_time") ?? v("departure_time"), now);
      const delaySec = tbNum(v("delayed_time"));
      const state = tbStr(v("departure_state"));
      const trains = [];
      if (expected !== null)
        trains.push(
          tbTrain({
            scheduled: tbTime(v("planned_time"), now) ?? (delaySec !== null ? expected - delaySec * 1000 : expected),
            expected,
            cancelled: state === "canceled" || tbBool(v("cancelled")),
            place: route.to,
            messages: [v("deviation"), v("other_info")],
          }),
        );
      for (const k of ["departure_time_next", "departure_time_next_next"]) {
        const t = tbTime(v(k), now);
        if (t !== null) trains.push(tbTrain({ scheduled: t, place: route.to, realtime: false }));
      }
      return { station: route.from, trains, messages: [] };
    },
  },
  {
    // Swiss public transport (core): departure, departure1 and departure2 sensors of a connection, plus line,
    // platform and delay for the first one.
    id: "swiss_public_transport",
    // Badge logo: images/sbb.svg (or .png), embedded by the build when the file exists.
    brand: "sbb",
    name: "Swiss public transport",
    url: "https://www.home-assistant.io/integrations/swiss_public_transport/",
    detect: (s) => /transport\.opendata\.ch/i.test(tbStr(tbAttr(s, "attribution"))) && !tbAttr(s, "departures") && !tbAttr(s, "connections"),
    read(s, hass, { now, entityId }) {
      const sib = tbSiblings(hass, entityId, "swiss_public_transport", ["departure0", "departure1", "departure2", "line", "platform", "delay"]);
      if (!Object.keys(sib).length) sib.departure0 = s;
      const name = tbDeviceName(hass, entityId);
      const v = (k) => tbState(sib[k]);
      const line = tbSplitTrain(v("line"));
      const trains = ["departure0", "departure1", "departure2"]
        .map((k, i) => {
          const t = tbTime(v(k), now);
          if (t === null) return null;
          const delay = i === 0 ? tbNum(v("delay")) : null;
          // The departure sensors hold the expected time; the delay gives the timetable back.
          return tbTrain({
            scheduled: delay !== null ? t - delay * 60000 : t,
            expected: i === 0 ? t : null,
            delay,
            realtime: i === 0,
            place: tbRoute(name).to || name,
            ...(i === 0 ? { type: line.type, number: line.number, label: tbStr(v("line")), platform: v("platform") } : {}),
          });
        })
        .filter(Boolean);
      return { station: tbRoute(name).from, trains, messages: [] };
    },
  },
  {
    // ViaggiaTreno (core): one train followed by its number (Trenitalia).
    id: "viaggiatreno",
    // Badge logo: images/trenitalia.svg (or .png), embedded by the build when the file exists.
    brand: "trenitalia",
    name: "ViaggiaTreno",
    url: "https://www.home-assistant.io/integrations/viaggiatreno/",
    detect: (s) => "numeroTreno" in (s?.attributes || {}),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const state = tbStr(s.state);
      const delay = tbNum(state);
      const train = tbTrain({
        scheduled: tbTime(a.orarioPartenza, now),
        delay,
        cancelled: /^cancel/i.test(state),
        place: a.destinazione,
        type: a.categoria,
        number: a.numeroTreno,
        realtime: delay !== null || /^cancel/i.test(state),
        stops: [{ name: tbStr(a.destinazione), time: tbTime(a.orarioArrivo, now) }],
      });
      return { station: tbStr(a.origine), trains: a.orarioPartenza ? [train] : [], messages: [a.subTitle].filter(Boolean) };
    },
  },
  {
    // NMBS / SNCB (core): the liveboard sensor of a station or the connection sensor between two stations.
    id: "nmbs",
    // Badge logo: images/sncb.svg (or .png), embedded by the build when the file exists.
    brand: "sncb",
    name: "NMBS / SNCB",
    url: "https://www.home-assistant.io/integrations/nmbs/",
    detect: (s) => "vehicle_id" in (s?.attributes || {}) && "departure_minutes" in s.attributes,
    read(s, _hass, { now }) {
      const a = s.attributes;
      const base = tbTime(s.last_updated || s.last_changed, now) ?? now;
      const minutes = tbNum(a.departure_minutes);
      const vehicle = tbSplitTrain(tbStr(a.vehicle_id).split(".").pop());
      const live = tbStr(s.state).match(/^Track\s+(\S+)\s+-\s+(.+)$/i);
      const scheduled = minutes === null ? null : Math.round((base + minutes * 60000) / 60000) * 60000;
      const train = tbTrain({
        scheduled,
        delay: tbNum(a.delay_minutes) ?? 0,
        cancelled: tbBool(a.canceled),
        place: live ? live[2] : a.destination,
        type: vehicle.type,
        number: vehicle.number,
        platform: live ? live[1] : a.platform_departing,
        via: a.via ? [a.via] : [],
      });
      return { station: tbStr(a.monitored_station || a.friendly_name), trains: scheduled === null && !train.cancelled ? [] : [train], messages: [] };
    },
  },
  {
    // UK Transport (core): the live train time sensor (transportapi.com).
    id: "uk_transport",
    // Badge logo: images/nationalrail.svg (or .png), embedded by the build when the file exists.
    brand: "nationalrail",
    name: "UK Transport",
    url: "https://www.home-assistant.io/integrations/uk_transport/",
    detect: (s) => Array.isArray(tbAttr(s, "next_trains")) || ("station_code" in (s?.attributes || {}) && "calling_at" in s.attributes),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const trains = tbList(a.next_trains).map((t) =>
        tbTrain({
          scheduled: tbTime(t.scheduled, now),
          expected: tbTime(t.estimated, now),
          cancelled: /cancel/i.test(tbStr(t.status)),
          place: t.destination_name,
          platform: t.platform,
          operator: t.operator_name,
        }),
      );
      return { station: tbStr(a.station_code), trains, messages: [] };
    },
  },
  {
    // Matthyeux/train-traveler (train_traveler): the journeys sensor or a next journey sensor (SNCF / Navitia).
    id: "train_traveler",
    // Badge logo: images/sncf.svg (or .png), embedded by the build when the file exists.
    brand: "sncf",
    name: "Train Traveler",
    url: "https://github.com/Matthyeux/train-traveler",
    detect: (s) => tbList(tbAttr(s, "journeys")).some((j) => j && "physical_mode" in j) || "physical_mode" in (s?.attributes || {}),
    read(s, _hass, { now }) {
      const a = s.attributes;
      const list = Array.isArray(a.journeys) ? a.journeys : [a];
      const trains = list.map((j) => {
        const line = tbSplitTrain(j.line);
        return tbTrain({
          scheduled: tbTime(j.departure_time, now),
          delay: tbNum(j.delay) !== null ? tbNum(j.delay) / 60 : null,
          cancelled: tbList(j.disruptions).some((d) => /NO_SERVICE/i.test(tbStr(d.disruption_type))),
          place: j.direction || j.arrival,
          type: line.type,
          number: line.number,
          label: tbStr(j.line),
          family: j.physical_mode,
          stops: [{ name: tbStr(j.arrival), time: tbTime(j.arrival_time, now) }],
          messages: tbList(j.disruptions),
        });
      });
      return { station: tbStr(list[0]?.departure), trains, messages: [] };
    },
  },
  {
    // vingerha/gtfs2 (gtfs2): a route sensor (start stop → end stop) from a GTFS timetable, with the next departures,
    // and the GTFS-RT expected times when a real-time feed is set. Works with any GTFS feed (SNCF open data…).
    id: "gtfs2",
    name: "GTFS2",
    url: "https://github.com/vingerha/gtfs2",
    // The badge follows the agency of the feed (the sensor's attribution): SNCF's for the SNCF feeds, else none.
    brandOf: (s) => {
      const agency = tbStr(tbAttr(s, "attribution"));
      // SNCF or OUIGO anywhere, or a name that starts with one of SNCF's brands (« TER Bretagne », « TGV INOUI »).
      return /\b(sncf|ouigo)\b/i.test(agency) || /^(ter|tgv|intercit[ée]s)\b/i.test(agency) ? "sncf" : "";
    },
    detect: (s) => Array.isArray(tbAttr(s, "next_departures")) && Array.isArray(tbAttr(s, "next_departures_headsign")),
    read(s, _hass, { kind, now }) {
      const a = s.attributes;
      const arr = kind === "arrival";
      // « 2026-11-14T08:12:00+00:00 (text) »: the time and the text of a timetable entry.
      const entry = (v) => {
        const m = tbStr(v).match(/^(\S+)\s+\((.*)\)$/);
        return m ? { time: tbTime(m[1], now), text: m[2].trim() } : { time: tbTime(v, now), text: "" };
      };
      const lines = tbList(a.next_departures_lines).map(entry);
      const heads = tbList(a.next_departures_headsign).map(entry);
      const trips = tbList(a.next_departures_trips);
      const arrivals = tbList(a.next_departures_destination_arrival_times);
      const from = tbStr(a.origin_station_stop_name);
      const to = tbStr(a.destination_station_stop_name);
      // Route type: « High Speed Rail Service », « Regional Rail Service », « Rail », « Bus »…
      const mode = tbStr(a.route_type_name);
      const family = /high speed/i.test(mode)
        ? "high_speed"
        : /long distance|inter regional|sleeper/i.test(mode)
          ? "intercity"
          : /suburban|urban|subway|metro|tram/i.test(mode)
            ? "suburban"
            : /bus|coach|trolley/i.test(mode)
              ? "bus"
              : /rail/i.test(mode)
                ? "regional"
                : "";
      // GTFS-RT: the expected times of the route at the stop, sorted, and their delays (seconds) in another order;
      // each scheduled train takes the first unused expected time from a minute before it to 90 minutes after whose
      // gap to it is one of the delays given (within a minute): the expected time of the next train is not taken for
      // one without real-time data.
      const rt = Array.isArray(a.next_departures_realtime) ? a.next_departures_realtime.map((v) => tbTime(v, now)).filter((v) => v !== null) : null;
      const delays = Array.isArray(a.next_delays_realtime) ? a.next_delays_realtime.map(tbNum).filter((v) => v !== null) : null;
      const used = new Set();
      const fits = (gap) => !delays?.length || delays.some((d) => Math.abs(gap / 1000 - d) <= 60);
      const realtime = (scheduled) => {
        if (!rt || scheduled === null) return null;
        const i = rt.findIndex((e, j) => !used.has(j) && e >= scheduled - 60000 && e <= scheduled + 90 * 60000 && fits(e - scheduled));
        if (i < 0) return null;
        used.add(i);
        return rt[i];
      };
      const first = tbStr(a.trip_id ?? a.trip_trip_id);
      const number = tbStr(a.trip_short_name ?? a.trip_trip_short_name);
      const trains = tbList(a.next_departures).map((dep, i) => {
        const scheduled = tbTime(dep, now);
        const arrival = tbTime(arrivals[i], now);
        const line = lines[i]?.text || "";
        // « TER/Rennes - Nantes »: the short name of the route (its category), then its long name.
        const short = line.split("/")[0].trim();
        const split = tbSplitTrain(short);
        const expected = arr ? null : realtime(scheduled);
        return tbTrain({
          key: tbStr(trips[i]) || undefined,
          scheduled: arr ? arrival : scheduled,
          expected,
          realtime: expected !== null,
          place: arr ? from : heads[i]?.text || to,
          type: split.type,
          number: (first && tbStr(trips[i]) === first && number) || split.number,
          label: short,
          family,
          stops: arr ? [] : [{ name: to, time: arrival }],
        });
      });
      const alerts = [a.origin_stop_alert, a.destination_stop_alert].filter((m) => m && !/^no info$/i.test(tbStr(m)));
      return { station: arr ? to : from, trains, messages: alerts, brand: this.brandOf(s) };
    },
  },
];

const TB_ADAPTER = Object.fromEntries(TB_ADAPTERS.map((a) => [a.id, a]));

// The adapter of an entity: the one forced in the configuration, the entity's integration (entity registry),
// else the first whose attributes match.
const tbAdapterFor = (hass, entityId, forced) => {
  if (forced && TB_ADAPTER[forced]) return TB_ADAPTER[forced];
  const s = hass?.states?.[entityId];
  const platform = hass?.entities?.[entityId]?.platform;
  if (platform && TB_ADAPTER[platform]) return TB_ADAPTER[platform];
  return s ? TB_ADAPTERS.find((a) => a.detect(s)) || null : null;
};

// Reads an entity: { adapter, station, trains, messages }, or null when it is missing or not supported.
const tbRead = (hass, entityId, { kind = "departure", integration, now = Date.now() } = {}) => {
  const s = hass?.states?.[entityId];
  const adapter = s && tbAdapterFor(hass, entityId, integration);
  if (!adapter) return null;
  let r;
  // Local times of the integrations are in Home Assistant's time zone.
  _tbTz = hass?.config?.time_zone || null;
  try {
    r = adapter.read(s, hass, { kind, now, entityId });
  } catch (err) {
    console.error(`train-board-card: ${adapter.id} could not read ${entityId}`, err);
    r = { station: "", trains: [], messages: [] };
  }
  const trains = r.trains.filter((t) => t.scheduled !== null || t.cancelled);
  trains.sort((a, b) => (a.scheduled ?? 0) - (b.scheduled ?? 0));
  return {
    adapter,
    brand: r.brand ?? adapter.brand,
    station: r.station || tbStr(s.attributes?.friendly_name),
    trains,
    messages: [...new Set(r.messages.map(tbMessage).filter(Boolean))],
  };
};

// The entities the card can show: those of a supported integration (for the editor and the stub configuration).
const tbCandidates = (hass) =>
  Object.keys(hass?.states || {})
    .filter((id) => id.startsWith("sensor."))
    .filter((id) => {
      const a = tbAdapterFor(hass, id);
      if (!a) return false;
      // Integrations spread over several sensors: their main sensor only.
      const tk = hass.entities?.[id]?.translation_key;
      if (a.id === "trafikverket_train") return !tk || tk === "departure_time";
      if (a.id === "swiss_public_transport") return !tk || tk === "departure0";
      // GTFS2 also has local stop sensors (departures around a place): its route sensors only.
      if (a.id === "gtfs2") return a.detect(hass.states[id]);
      return true;
    });
