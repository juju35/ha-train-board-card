// ---------------------------------------------------------------------------
// Train board card and mini card, their visual editors and their registration.
// ---------------------------------------------------------------------------

export const VERSION = "__VERSION__";

export const TB_ICONS = {
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
export const TB_BRAND_LOGOS = {} /* __BRAND_LOGOS__ */;

export const tbEsc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const tbIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;

// The card's language: the configured one, else Home Assistant's (its base language when the region is unknown).
export const tbLang = (hass, config) => {
  const l = config?.language || hass?.locale?.language || hass?.language || "en";
  return TB_STRINGS[l] ? l : TB_STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};
// Locale of the numbers and times: Home Assistant's full locale when its base is the card's language (keeps the
// region), else the card's language; Home Assistant's « pt » is European Portuguese.
export const tbFmtLang = (hass, config) => {
  const l = tbLang(hass, config);
  const ha = hass?.locale?.language || hass?.language;
  const loc = ha && ha.split("-")[0] === l.split("-")[0] && l !== "sr-Latn" ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};
// The entities of a device (trafikverket_train / swiss_public_transport spread a board over several sensors),
// memoised on the entity registry: the card's signature no longer walks every entity at each state change.
export const _tbDeviceMemo = new WeakMap();
export const tbDeviceEntities = (entities, device) => {
  let byDevice = _tbDeviceMemo.get(entities);
  if (!byDevice) {
    byDevice = new Map();
    for (const [eid, e] of Object.entries(entities)) {
      if (!e?.device_id) continue;
      if (!byDevice.has(e.device_id)) byDevice.set(e.device_id, []);
      byDevice.get(e.device_id).push(eid);
    }
    _tbDeviceMemo.set(entities, byDevice);
  }
  return byDevice.get(device) || [];
};

export const tbT = (hass, config, key) => TB_STRINGS[tbLang(hass, config)][key] ?? TB_STRINGS.en[key] ?? key;
export const tbFill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
// « 1 train », « 3 trains », Polish « 5 pociągów »: the plural form of the card's language.
export const tbPlural = (hass, config, key, n) => {
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
export const _tbClocks = new Map();
export const tbClock = (hass, config, ms) => {
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
