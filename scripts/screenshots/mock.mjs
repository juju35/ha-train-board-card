// Neutral mock data for the screenshots: a generic « Central Station », generic destinations, no operator.
// Shaped as the db_infoscreen integration's departures sensor (the richest one), and as National Rail UK's.
import { CLOCK } from "./harness.mjs";

const unix = (min) => Math.floor((CLOCK + min * 60000) / 1000);
const hhmm = (min) => new Date(CLOCK + min * 60000).toISOString().slice(11, 16);
const iso = (min) => new Date(CLOCK + min * 60000).toISOString();

// [minutes from now, train, destination, platform, delay, cancelled, via]
const DEPARTURES = [
  [2, "RE 7", "Lakeside", "3", 0, false, ["Millbrook", "Fairview"]],
  [6, "ICE 578", "Northbridge", "6", 12, false, ["Old Town", "Westfield", "Kingsport"]],
  [9, "S 3", "Airport", "1", 0, false, ["Market Square", "Business Park"]],
  [14, "IC 2013", "Harbour Point", "4", 0, false, ["Riverside", "Elm Grove"]],
  [18, "TER 8812", "Hillcrest", "2", 0, true, ["Oakwood"]],
  [23, "S 5", "University", "1", 0, false, ["Museum Quarter"]],
  [27, "RE 2", "Pine Valley", "3", 0, false, []],
  [31, "ICE 690", "Southgate", "7", 0, false, ["Riverside"]],
  [36, "S 3", "Airport", "1", 0, false, []],
  [41, "RE 7", "Lakeside", "3", 0, false, []],
  [45, "IC 2015", "Harbour Point", "4", 0, false, []],
  [49, "S 5", "University", "1", 0, false, []],
  [53, "TER 8814", "Hillcrest", "2", 0, false, []],
  [57, "RE 2", "Pine Valley", "3", 0, false, []],
  [62, "ICE 580", "Northbridge", "6", 0, false, []],
  [66, "S 3", "Airport", "1", 0, false, []],
  [71, "RE 7", "Lakeside", "3", 0, false, []],
  [75, "IC 2017", "Harbour Point", "4", 0, false, []],
];
const ARRIVALS = [
  [1, "ICE 571", "Northbridge", "6", 0, false, ["Kingsport", "Westfield"]],
  [4, "RE 8", "Lakeside", "3", 5, false, ["Fairview"]],
  [8, "S 3", "Airport", "1", 0, false, []],
  [12, "IC 2012", "Harbour Point", "4", 0, false, ["Elm Grove"]],
  [17, "TER 8811", "Hillcrest", "2", 0, false, []],
  [21, "S 5", "University", "1", 3, false, []],
  [26, "RE 1", "Pine Valley", "3", 0, false, []],
  [30, "ICE 693", "Southgate", "7", 0, false, []],
];
const CLASSES = { ICE: "long_distance", IC: "long_distance", RE: "regional_db", TER: "regional", S: "s_bahn" };

const dep = ([m, train, place, platform, delay, cancelled, via], arrival) => ({
  ...(arrival ? { scheduledArrival: hhmm(m), arrival_timestamp: unix(m + delay), delay_arrival: delay, route: [{ name: place }, ...via.map((name) => ({ name })), { name: "Central Station" }] } : {}),
  scheduledDeparture: hhmm(m),
  scheduled_timestamp: unix(m),
  departure_timestamp: unix(m + delay),
  train,
  trainNumber: train.split(" ")[1],
  trainClasses: [CLASSES[train.split(" ")[0]]],
  destination: arrival ? "Central Station" : place,
  platform,
  scheduledPlatform: platform,
  changed_platform: false,
  delay,
  is_cancelled: cancelled,
  via: arrival ? [] : via,
  messages: delay >= 10 ? [{ text: "Delay due to a technical fault on a train ahead" }] : cancelled ? [{ text: "This train is cancelled today" }] : [],
});

const attrs = (list, arrival) => ({
  next_departures: list.map((d) => dep(d, arrival)),
  station: "Central Station",
  station_messages: [],
  friendly_name: arrival ? "Central Station Arrivals" : "Central Station Departures",
  icon: "mdi:train",
});

export const ENTITY = "sensor.central_station_departures";
export const ARRIVALS_ENTITY = "sensor.central_station_arrivals";
export const UK_ENTITY = "sensor.train_schedule_cen_nbr";

const base = (states, entities) => ({
  states,
  entities,
  devices: {},
  language: "en",
  locale: { language: "en", time_format: "24", time_zone: "server" },
  config: { time_zone: "UTC" },
});

export const boardHass = ({ sun } = {}) =>
  base(
    {
      [ENTITY]: { entity_id: ENTITY, state: hhmm(2), attributes: attrs(DEPARTURES, false) },
      [ARRIVALS_ENTITY]: { entity_id: ARRIVALS_ENTITY, state: hhmm(1), attributes: attrs(ARRIVALS, true) },
      ...(sun ? { "sun.sun": { entity_id: "sun.sun", state: sun, attributes: {} } } : {}),
    },
    { [ENTITY]: { entity_id: ENTITY, platform: "db_infoscreen" }, [ARRIVALS_ENTITY]: { entity_id: ARRIVALS_ENTITY, platform: "db_infoscreen" } },
  );

// National Rail UK: no train categories, « Delayed » and « Cancelled » words.
export const ukHass = () =>
  base(
    {
      [UK_ENTITY]: {
        entity_id: UK_ENTITY,
        state: iso(4),
        attributes: {
          station: "Central Station",
          trains: [
            [4, 4, "Northbridge", "2"],
            [11, 14, "Kingsport", "1"],
            [19, "Delayed", "Northbridge", "2"],
            [26, "Cancelled", "Harbour Point", null],
            [34, 34, "Northbridge", "3"],
          ].map(([m, e, terminus, platform]) => ({
            scheduled: iso(m),
            expected: typeof e === "number" ? iso(e) : e,
            terminus,
            destinations: [{ name: terminus, time_at_destination: iso(m + 30), scheduled_time_at_destination: iso(m + 30) }],
            platform,
            length: 8,
            perturbation: typeof e !== "number",
          })),
          friendly_name: "Train schedule at Central Station",
        },
      },
    },
    { [UK_ENTITY]: { entity_id: UK_ENTITY, platform: "nationalrailuk" } },
  );
