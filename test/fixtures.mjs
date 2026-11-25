// Entities of every supported integration, shaped as their code produces them (attributes as Home Assistant
// serialises them to the frontend: datetimes as ISO strings), at a fixed clock NOW (08:00 UTC).
export const NOW = Date.parse("2026-11-14T08:00:00Z");
const at = (min) => new Date(NOW + min * 60000).toISOString();
const unix = (min) => Math.floor((NOW + min * 60000) / 1000);
const hhmm = (min) => at(min).slice(11, 16);

const st = (entity_id, state, attributes) => ({ entity_id, state, attributes, last_changed: at(-1), last_updated: at(-1) });
const hassOf = (states, entities = {}, devices = {}) => ({
  states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
  entities,
  devices,
  language: "en",
  locale: { language: "en", time_format: "24", time_zone: "server" },
  config: { time_zone: "UTC" },
  themes: { darkMode: false },
});

// FaserF/ha-db_infoscreen: the departures sensor, data normalised by the coordinator (DBF backend).
export const dbInfoscreen = () =>
  hassOf(
    [
      st("sensor.koln_hbf_departures", "08:14", {
        next_departures: [
          {
            scheduledDeparture: hhmm(12),
            train: "ICE 578",
            trainNumber: "578",
            trainClasses: ["long_distance"],
            destination: "Hamburg-Altona",
            platform: "6",
            scheduledPlatform: "7",
            changed_platform: true,
            delay: 4,
            departure_current: hhmm(16),
            departure_timestamp: unix(16),
            scheduled_timestamp: unix(12),
            is_cancelled: false,
            messages: [{ text: "Delay of a preceding train" }],
            via: ["Düsseldorf Hbf", "Duisburg Hbf", "Essen Hbf"],
            trip_id: "2026111408578",
          },
          {
            scheduledDeparture: hhmm(19),
            train: "RE 1",
            trainClasses: ["regional_db"],
            destination: "Aachen Hbf",
            platform: "4",
            scheduledPlatform: "4",
            changed_platform: false,
            delay: 0,
            departure_timestamp: unix(19),
            scheduled_timestamp: unix(19),
            is_cancelled: false,
            messages: [],
          },
          {
            scheduledDeparture: hhmm(25),
            train: "S 12",
            trainClasses: ["s_bahn"],
            destination: "Au (Sieg)",
            platform: "10",
            delay: 0,
            departure_timestamp: unix(25),
            scheduled_timestamp: unix(25),
            isCancelled: true,
            messages: [{ text: "Cancelled" }],
          },
          {
            scheduledDeparture: hhmm(-5),
            train: "IC 2013",
            destination: "Oberstdorf",
            platform: "2",
            delay: 0,
            departure_timestamp: unix(-5),
            scheduled_timestamp: unix(-5),
            is_cancelled: false,
          },
        ],
        station: "Köln Hbf",
        via_stations: [],
        direction: "",
        last_updated: at(-1),
        attribution: "Data provided by API dbf.finalrewind.org",
        is_paused: false,
        station_messages: [{ text: "Lift to platform 4 out of service", type: "elevator" }],
        friendly_name: "Köln Hbf Departures",
        icon: "mdi:train",
      }),
      // A second entry of the station in arrival mode, with its route kept (keep_route).
      st("sensor.koln_hbf_arrivals", "08:06", {
        next_departures: [
          {
            scheduledArrival: hhmm(6),
            scheduledDeparture: hhmm(9),
            train: "ICE 105",
            destination: "Basel SBB",
            route: [{ name: "Amsterdam Centraal" }, { name: "Utrecht Centraal" }, { name: "Köln Hbf" }, { name: "Basel SBB" }],
            platform: "5",
            delay_arrival: 7,
            arrival_timestamp: unix(13),
            delay: 7,
            departure_timestamp: unix(16),
            is_cancelled: false,
          },
        ],
        station: "Köln Hbf",
        station_messages: [],
        friendly_name: "Köln Hbf Arrivals",
      }),
    ],
    {
      "sensor.koln_hbf_departures": { entity_id: "sensor.koln_hbf_departures", platform: "db_infoscreen" },
      "sensor.koln_hbf_arrivals": { entity_id: "sensor.koln_hbf_arrivals", platform: "db_infoscreen" },
    },
  );

// jfparis/homeassistant_nationalrail: client.process_data() + the coordinator's next-train summary.
export const nationalRailUk = () =>
  hassOf([
    st("sensor.train_schedule_wyb_wat", at(9), {
      trains: [
        {
          scheduled: at(7),
          expected: at(9),
          terminus: "London Waterloo",
          destinations: [{ name: "London Waterloo", time_at_destination: at(41), scheduled_time_at_destination: at(39) }],
          platform: "2",
          length: 8,
          perturbation: false,
        },
        {
          scheduled: at(22),
          expected: "Cancelled",
          terminus: "London Waterloo",
          destinations: [{ name: "London Waterloo", time_at_destination: "Cancelled", scheduled_time_at_destination: at(54) }],
          platform: null,
          length: 0,
          perturbation: true,
        },
        {
          scheduled: at(37),
          expected: "Delayed",
          terminus: "London Waterloo",
          destinations: [{ name: "London Waterloo", time_at_destination: "Delayed", scheduled_time_at_destination: at(69) }],
          platform: "1",
          length: 10,
          perturbation: true,
        },
      ],
      station: "Weybridge",
      name: "train_schedule_wyb_wat",
      description: "Departing trains schedule at Weybridge station",
      friendly_name: "Train schedule at Weybridge station for WAT",
      next_train_scheduled: at(7),
      next_train_expected: at(9),
      destinations: [{ name: "London Waterloo" }],
      terminus: "London Waterloo",
      platform: "2",
      perturbations: true,
      attribution: "Data from National Rail Darwin Feeds",
      device_class: "timestamp",
    }),
  ]);

// crismc/homeassistant_nationalrailtimes_integration: GetNextDeparturesWithDetails, parsed with xmltodict.
export const nationalRailTimes = () =>
  hassOf([
    st("sensor.trains_abbey_wood_to_london_charing_cross", hhmm(5), {
      last_refresh: at(-1),
      message: ["Disruption between Dartford and Gravesend until the end of the day."],
      station_name: "Abbey Wood",
      destination_name: "London Charing Cross",
      service: {
        std: hhmm(5),
        etd: hhmm(8),
        platform: "3",
        operator: "Southeastern",
        operatorCode: "SE",
        serviceType: "train",
        length: "8",
        serviceID: "1234567ABWD____",
        origin: { location: { locationName: "Dartford", crs: "DFD" } },
        destination: { location: { locationName: "London Charing Cross", crs: "CHX" } },
        delayReason: "This train has been delayed by a broken down train",
      },
      calling_points: [
        { locationName: "Plumstead", crs: "PLU", st: hhmm(8), et: hhmm(11) },
        { locationName: "Woolwich Arsenal", crs: "WWA", st: hhmm(11), et: "On time" },
        { locationName: "London Charing Cross", crs: "CHX", st: hhmm(35), et: hhmm(38) },
      ],
      offset: "0",
      station_code: "ABW",
      target_station_name: "London Charing Cross",
      target_station_code: "CHX",
      friendly_name: "Trains Abbey Wood to London Charing Cross",
      icon: "mdi:train",
    }),
  ]);

// prusuino/ha_swiss_transport: the station board sensor and a connection sensor.
export const swissTransport = () =>
  hassOf(
    [
      st("sensor.swiss_transport_bern_ab12", at(3), {
        station_id: "8507000",
        station_name: "Bern",
        address: "Bahnhofplatz, 3011 Bern",
        departure_count: 3,
        limit: 10,
        line_label: "full",
        realtime: true,
        alerts: ["Construction work between Bern and Thun: replacement buses."],
        departures: [
          { line: "IC 8", category: "IC", number: "8", to: "Brig", operator: "SBB", departure: at(3), departure_ts: unix(3), delay: 0, platform: "6", platform_changed: false },
          { line: "S1", category: "S", number: "1", to: "Thun", operator: "BLS-bls", departure: at(6), departure_ts: unix(6), delay: 3, platform: "12", platform_changed: true },
          { line: "IR 15", category: "IR", number: "15", to: "Luzern", operator: "SBB", departure: at(14), departure_ts: unix(14), delay: null, platform: "7", platform_changed: false, cancelled: true },
        ],
        attribution: "Data: transport.opendata.ch (search.ch). Address: © OpenStreetMap contributors",
        device_class: "timestamp",
        friendly_name: "Bern Departures",
      }),
      st("sensor.swiss_transport_bern_zurich_hb_cd34", at(2), {
        from_name: "Bern",
        to_name: "Zürich HB",
        from_id: "8507000",
        to_id: "8503000",
        connection_count: 1,
        limit: 3,
        line_label: "full",
        connections: [
          {
            departure: at(2),
            departure_ts: unix(2),
            dep_platform: "8",
            delay: 1,
            departure_prognosis: at(3),
            arrival: at(58),
            arrival_ts: unix(58),
            arr_platform: "31",
            duration_min: 56,
            transfers: 0,
            products: ["IC 1"],
            legs: [{ line: "IC 1", category: "IC", number: "1", operator: "SBB", to: "St. Gallen", from_name: "Bern", from_platform: "8", to_name: "Zürich HB", to_platform: "31" }],
            changes: [],
          },
        ],
        friendly_name: "Bern → Zürich HB",
      }),
    ],
    { "sensor.swiss_transport_bern_ab12": { platform: "swiss_transport" }, "sensor.swiss_transport_bern_zurich_hb_cd34": { platform: "swiss_transport" } },
  );

// juju35/ha-public-transport: the stop sensor (StopSensor.extra_state_attributes).
export const publicTransport = () =>
  hassOf(
    [
      st("sensor.gares_next_departure", at(2), {
        config_entry_id: "abc",
        provider: "star",
        network: "STAR",
        logo: "/public_transport/logos/star.svg",
        stop_id: "1234",
        stop_name: "Gares",
        stop_city: "Rennes",
        mode: "metro",
        lines: [{ id: "a", name: "a", color: "#e3051b", text_color: "#ffffff" }],
        departures: [
          { line_id: "a", line: "a", color: "#e3051b", text_color: "#ffffff", destination: "J.F. Kennedy", direction: 0, departure: at(2), scheduled: at(1), delay: 1, realtime: true },
          { line_id: "a", line: "a", color: "e3051b", text_color: "ffffff", destination: "La Poterie", direction: 1, departure: at(5), scheduled: null, delay: null, realtime: false },
        ],
        alerts: [{ id: "x", title: "Escalator out of order", description: "Use the lift.", level: 1, line_ids: ["a"], lines: ["a"] }],
        stale: false,
        last_error: null,
        device_class: "timestamp",
        friendly_name: "Gares Next departure",
      }),
    ],
    { "sensor.gares_next_departure": { platform: "public_transport" } },
  );

// Nederlandse Spoorwegen (core): the departure sensor of a route.
export const nederlandseSpoorwegen = () =>
  hassOf([
    st("sensor.amsterdam_utrecht_departure", at(10), {
      going: true,
      departure_time_planned: hhmm(8),
      departure_time_actual: hhmm(10),
      departure_delay: true,
      departure_platform_planned: "5",
      departure_platform_actual: "5b",
      arrival_time_planned: hhmm(35),
      arrival_time_actual: hhmm(37),
      arrival_delay: true,
      arrival_platform_planned: "18",
      arrival_platform_actual: "18",
      next: hhmm(23),
      status: "normal",
      transfers: 0,
      route: ["Amsterdam Centraal", "Amsterdam Amstel", "Utrecht Centraal"],
      remarks: null,
      attribution: "Data provided by NS",
      device_class: "timestamp",
      friendly_name: "Amsterdam - Utrecht Departure",
    }),
  ]);

// Trafikverket Train (core): one device, a sensor per value; entity registry with translation keys.
export const trafikverket = () => {
  const dev = "dev_tv";
  const sensors = {
    departure_time: at(12),
    departure_state: "delayed",
    cancelled: "False",
    delayed_time: "240",
    planned_time: at(8),
    other_info: "Bus replaces the train after Uppsala",
    deviation: "Late",
    departure_time_next: at(38),
    departure_time_next_next: at(68),
  };
  const states = Object.entries(sensors).map(([k, v]) => st(`sensor.stockholm_c_uppsala_c_${k}`, v, { attribution: "Data provided by Trafikverket", friendly_name: k }));
  const entities = Object.fromEntries(
    Object.keys(sensors).map((k) => [`sensor.stockholm_c_uppsala_c_${k}`, { platform: "trafikverket_train", device_id: dev, translation_key: k }]),
  );
  return hassOf(states, entities, { [dev]: { id: dev, name: "Stockholm C to Uppsala C" } });
};

// Swiss public transport (core): departure, departure1, departure2, line, platform, delay sensors.
export const swissPublicTransport = () => {
  const dev = "dev_spt";
  const sensors = { departure0: at(4), departure1: at(34), departure2: at(64), line: "IR 16", platform: "4", delay: "2", transfers: "0" };
  const ids = { departure0: "departure", departure1: "departure_1", departure2: "departure_2" };
  const states = Object.entries(sensors).map(([k, v]) =>
    st(`sensor.zurich_hb_luzern_${ids[k] || k}`, v, { attribution: "Data provided by transport.opendata.ch", friendly_name: k }),
  );
  const entities = Object.fromEntries(
    Object.keys(sensors).map((k) => [`sensor.zurich_hb_luzern_${ids[k] || k}`, { platform: "swiss_public_transport", device_id: dev, translation_key: k }]),
  );
  return hassOf(states, entities, { [dev]: { id: dev, name: "Zürich HB - Luzern" } });
};

// ViaggiaTreno (core): a train followed by its number; state = delay in minutes.
export const viaggiatreno = () =>
  hassOf([
    st("sensor.train_9544", "6", {
      categoria: "FR",
      compOrarioArrivoZeroEffettivo: hhmm(186),
      compOrarioPartenzaZeroEffettivo: hhmm(16),
      destinazione: "MILANO CENTRALE",
      numeroTreno: 9544,
      orarioArrivo: NOW + 180 * 60000,
      orarioPartenza: NOW + 10 * 60000,
      origine: "ROMA TERMINI",
      subTitle: "",
      attribution: "Powered by ViaggiaTreno Data",
      friendly_name: "Train 9544",
    }),
  ]);

// NMBS / SNCB (core): the liveboard sensor of a station.
export const nmbs = () =>
  hassOf([
    st("sensor.trains_in_gent_sint_pieters", "Track 4 - Brussel-Zuid", {
      departure: "In 7 minutes",
      departure_minutes: 7,
      extra_train: false,
      vehicle_id: "BE.NMBS.IC1532",
      monitored_station: "Gent-Sint-Pieters",
      delay: "3 minutes",
      delay_minutes: 3,
      attribution: "https://api.irail.be/",
      friendly_name: "Trains in Gent-Sint-Pieters",
    }),
  ]);

// UK Transport (core): the live train time sensor.
export const ukTransport = () =>
  hassOf([
    st("sensor.next_train_to_wat", "7", {
      station_code: "WIM",
      calling_at: "WAT",
      last_updated: at(-1),
      next_trains: [
        { origin_name: "Guildford", destination_name: "London Waterloo", status: "ON TIME", scheduled: hhmm(7), estimated: hhmm(7), platform: "5", operator_name: "South Western Railway" },
        { origin_name: "Woking", destination_name: "London Waterloo", status: "LATE", scheduled: hhmm(15), estimated: hhmm(19), platform: "6", operator_name: "South Western Railway" },
        { origin_name: "Basingstoke", destination_name: "London Waterloo", status: "CANCELLED", scheduled: hhmm(22), estimated: hhmm(22), platform: null, operator_name: "South Western Railway" },
      ],
      unit_of_measurement: "min",
      friendly_name: "Next train to WAT",
    }),
  ]);

// Matthyeux/train-traveler: the journeys sensor (SNCF, Navitia); delays in seconds.
export const trainTraveler = () =>
  hassOf([
    st("sensor.train_traveler_ren_nan_journeys", at(5), {
      journeys: [
        {
          line: "TER",
          direction: "Nantes",
          departure_time: at(5),
          arrival_time: at(80),
          duration: 4500,
          physical_mode: "TER / Intercités",
          departure: "Rennes",
          arrival: "Nantes",
          disruptions: [{ disruption_type: "SIGNIFICANT_DELAYS", disruption_message: "Train delayed by a signalling fault" }],
          delay: 600,
        },
        {
          line: "TGV INOUI",
          direction: "Nantes",
          departure_time: at(45),
          arrival_time: at(120),
          duration: 4500,
          physical_mode: "Train grande vitesse",
          departure: "Rennes",
          arrival: "Nantes",
          disruptions: [],
          delay: 0,
        },
      ],
      device_class: "timestamp",
      friendly_name: "Rennes - Nantes Journeys",
    }),
  ]);

// vingerha/gtfs2: a route sensor (SNCF open data), with the GTFS-RT expected times of the route at the stop.
export const gtfs2 = () =>
  hassOf(
    [
      st("sensor.ter_rennes_to_nantes_next_departure", at(5), {
        attribution: "SNCF",
        arrival: at(80),
        origin_station_stop_name: "Rennes",
        destination_station_stop_name: "Nantes",
        route_type_name: "Rail",
        trip_id: "OCESN858412F",
        trip_short_name: "858412",
        next_departures: [at(5), at(35), at(65)],
        next_departures_lines: [`${at(5)} (TER/Rennes - Nantes)`, `${at(35)} (TER/Rennes - Nantes)`, `${at(65)} (TER/Rennes - Nantes)`],
        next_departures_headsign: [`${at(5)} (Nantes)`, `${at(35)} (Savenay)`, `${at(65)} (Nantes)`],
        next_departures_trips: ["OCESN858412F", "OCESN858414F", "OCESN858416F"],
        next_departures_destination_arrival_times: [at(80), at(110), at(140)],
        origin_stop_alert: "Works between Redon and Nantes",
        destination_stop_alert: "no info",
        gtfs_rt_updated_at: at(-1),
        next_departures_realtime: [at(12), at(35)],
        next_delays_realtime: [0, 420],
        device_class: "timestamp",
        friendly_name: "SNCF Rennes to Nantes next departure",
      }),
    ],
    { "sensor.ter_rennes_to_nantes_next_departure": { platform: "gtfs2", device_id: null } },
  );
