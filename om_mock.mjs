// Simulateur d'Open-Meteo (forecast, historical-forecast, marine) fidèle au
// format documenté : multi-points → tableau JSON, timeformat=unixtime,
// cellule de grille renvoyée dans latitude/longitude, erreurs 400 {error, reason}.
export const calls = [];
const T0 = Date.parse("2026-10-09T00:00:00Z") / 1000;

export function omRespond(urlStr, scenario = "nominal") {
  const u = new URL(urlStr);
  calls.push(u.hostname + u.pathname + (u.searchParams.get("models") ? "#" + u.searchParams.get("models") : ""));
  const host = u.hostname;
  if (scenario === "offline") throw new TypeError("Failed to fetch");
  if (scenario === "ratelimit") return { status: 429, body: { error: true, reason: "Too many requests" } };
  const isMarine = host.startsWith("marine");
  const model = u.searchParams.get("models") || "best_match";
  const hourly = (u.searchParams.get("hourly") || "").split(",");
  if (!isMarine) {
    if (scenario === "allfail") return { status: 400, body: { error: true, reason: "Simulated failure" } };
    if (scenario === "range") return { status: 400, body: { error: true, reason: "Parameter 'start_date' is out of allowed range from 2026-07-12 to 2026-10-26" } };
    if (scenario === "arome400" && model === "meteofrance_seamless") return { status: 400, body: { error: true, reason: "Cannot initialize Model from invalid String value meteofrance_seamless" } };
    if (scenario === "ecmwfid400" && model === "ecmwf_ifs") return { status: 400, body: { error: true, reason: "Cannot initialize Model from invalid String value ecmwf_ifs" } };
  } else {
    if (scenario === "marinefail") return { status: 400, body: { error: true, reason: "Cannot initialize MarineVariable from invalid String value sea_surface_temperature" } };
    if (scenario === "marinesst400" && hourly.includes("sea_surface_temperature"))
      return { status: 400, body: { error: true, reason: "Cannot initialize MarineVariable from invalid String value sea_surface_temperature" } };
  }
  const lats = u.searchParams.get("latitude").split(",").map(Number);
  const lons = u.searchParams.get("longitude").split(",").map(Number);
  const t0 = Date.parse(u.searchParams.get("start_date") + "T00:00:00Z") / 1000;
  const t1 = Date.parse(u.searchParams.get("end_date") + "T23:00:00Z") / 1000;
  const times = []; for (let t = t0; t <= t1; t += 3600) times.push(t);
  const out = lats.map((lat, i) => {
    const lon = lons[i];
    const inRade = lat > 48.25 && lat < 48.40 && lon > -4.45 && lon < -4.15;
    const cell = isMarine ? (inRade ? { lat: 48.30, lon: -4.62 } : { lat: lat + 0.02, lon: lon - 0.02 }) : { lat: lat + 0.005, lon: lon + 0.005 };
    const h = {};
    h.time = times;
    for (const v of hourly) {
      h[v] = times.map((t, k) => {
        const hr = (t / 3600) % 24;                 // heure UTC
        const day = Math.sin(2 * Math.PI * (hr - 9) / 24);
        if (!isMarine && model === "meteofrance_seamless" && k >= 48 && scenario !== "aromefull") return null; // échéance AROME
        const bump = /^ecmwf_ifs/.test(model) ? (scenario === "spread" ? 25 : 3) : 0;
        switch (v) {
          case "wind_speed_10m": return +(16 + 10 * day + i * 1.3 + bump).toFixed(1);
          case "wind_gusts_10m": return +((16 + 10 * day + i * 1.3 + bump) * 1.6).toFixed(1);
          case "wind_direction_10m": return Math.round((200 + 5 * hr + i * 7) % 360);
          case "cloud_cover": return Math.round(55 + 40 * Math.sin(2 * Math.PI * hr / 24));
          case "precipitation": return hr >= 14 && hr <= 16 ? 0.6 : 0;
          case "pressure_msl": return +(1018 - 0.1 * ((t - T0) / 3600)).toFixed(1);   // fonction du temps absolu
          case "temperature_2m": return +(13 + 4 * day).toFixed(1);
          case "wave_height": return +(1.1 + 0.3 * day + (inRade ? 1.5 : 0)).toFixed(2);
          case "wave_direction": return 260;
          case "wave_period": return 9.5;
          case "swell_wave_height": return 0.9;
          case "swell_wave_period": return 11;
          case "sea_surface_temperature": return 15.8;
          default: return null;
        }
      });
    }
    return { latitude: cell.lat, longitude: cell.lon, generationtime_ms: 0.4, utc_offset_seconds: 0, timezone: "GMT",
             timezone_abbreviation: "GMT", elevation: 0, location_id: i, hourly_units: {}, hourly: h };
  });
  return { status: 200, body: out.length === 1 ? (delete out[0].location_id, out[0]) : out };
}

/** fetch() simulé pour Node/jsdom */
export function mockFetch(scenario, extra) {
  return async (url, opts) => {
    if (extra) { const r = await extra(url, opts); if (r) return r; }
    const r = omRespond(String(url), scenario);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => JSON.parse(JSON.stringify(r.body)) };
  };
}
