// Météo Open-Meteo par spot, cache local, contrôles.
import { SITE, SPOTS } from "SITE_CONFIG";
import { DIR16, angDist } from "./core.js";
import { probeStorage } from "./persist.js";
import { msAtLocal, parisParts } from "./tide.js";




// ═══════════════════════════════════════════════════════════════════
// ZONE MÉTÉO D'UN SPOT
// Les spots ne partagent pas la même météo. On rattache chaque spot à
// l'un des trois ancrages du SITE selon son éloignement, et on lit la
// météo de CET ancrage. Repli sur les valeurs site si l'API n'a pas
// renvoyé le détail par zone.
// ═══════════════════════════════════════════════════════════════════
export function spotZone(spot) {
  // v4.1 — La clé explicite prime, et elle est désormais renseignée sur chaque
  // spot. L'audit a montré que le rattachement par temps de trajet regroupait
  // Granville (au sud) avec Carteret (au nord) : 61 km d'écart et deux régimes
  // météo différents sous une seule mesure. Le temps de route n'est pas une
  // coordonnée géographique.
  if (spot.zone && SITE.zones[spot.zone]) return spot.zone;
  const d = spot.distMin ?? 0;
  return d <= 25 ? "local" : d <= 50 ? "inter" : "far";
}
/** v6 — météo du spot lui-même (6 h-22 h) quand les séries horaires existent. */
export function spotWeather(live, spot) {
  if (live?.series) { const w = spotWxBetween(live, spot, WX.dayFrom, WX.dayTo); if (w) return w; }
  return zoneWeather(live, spot);
}
export function zoneWeather(live, spot) {
  const fb = {
    wind_dir: live?.wind_dir || "O",
    wind_force: parseInt(live?.wind_force) || 0,
    sky: live?.sky || "partly",
    houle: parseFloat(live?.houle) || 0,
    fromZone: false,
  };
  const z = live?.zones?.[spotZone(spot)];
  if (!z) return fb;
  return {
    wind_dir: z.wind_dir || fb.wind_dir,
    wind_force: z.wind_force != null ? parseInt(z.wind_force) : fb.wind_force,
    sky: z.sky || fb.sky,
    houle: z.houle != null ? parseFloat(z.houle) : fb.houle,
    fromZone: true,
  };
}
// ═══════════════════════════════════════════════════════════════════
// v4 — CONTRÔLE DE COHÉRENCE DES DONNÉES RENVOYÉES
// La recherche web peut se tromper de jour, inverser deux horaires ou inventer
// un coefficient : rien ne l'attrapait. Ces contrôles ne corrigent rien — ils
// signalent, pour que la donnée douteuse ne passe pas pour une certitude.
// ═══════════════════════════════════════════════════════════════════
export function validateLive(d, dateISO) {
  const w = [];
  if (!d) return w;

  if (d.date && dateISO && d.date !== dateISO)
    w.push(`Date renvoyée (${d.date}) différente de la date demandée (${dateISO}). La météo affichée est probablement celle d'un autre jour.`);

  // v5 : marée et coefficient sont calculés localement — plus rien à contrôler ici.
  for (const x of d.warnings || []) w.push(x);

  const sst = parseFloat(d.sst);
  if (!isNaN(sst) && (sst < 2 || sst > 28))
    w.push(`Température d'eau de ${sst} °C invraisemblable sur ce secteur.`);
  const p = parseInt(d.pressure);
  if (!isNaN(p) && (p < 950 || p > 1060))
    w.push(`Pression de ${p} hPa hors plage réaliste.`);

  return w;
}
// ═══════════════════════════════════════════════════════════════════
// v6 — MÉTÉO PAR API (Open-Meteo), SPOT PAR SPOT
//
// Jusqu'en v5 la météo venait d'une recherche web faite par un modèle de
// langage : trois relevés « par zone », précis à ±1 Beaufort au mieux, et
// différents d'une ouverture à l'autre. Elle vient désormais de vrais modèles
// numériques, interrogés directement par l'application, AUX COORDONNÉES DE
// CHAQUE SPOT :
//   • vent, rafales, nébulosité, pression : AROME (Météo-France, maille
//     ~1,3 km) en priorité, ECMWF IFS en relais au-delà de son échéance ;
//   • houle et température de surface : Open-Meteo Marine.
// Mêmes entrées → mêmes sorties : deux ouvertures dans l'heure donnent le
// même conseil, sauf si un nouveau run du modèle est sorti entre-temps.
//
// Données : Open-Meteo.com (CC BY 4.0), modèles Météo-France / ECMWF.
// ═══════════════════════════════════════════════════════════════════
/* WX_ENGINE_START */
export const WX = {
  forecast: "https://api.open-meteo.com/v1/forecast",
  archive: "https://historical-forecast-api.open-meteo.com/v1/forecast",
  marine: "https://marine-api.open-meteo.com/v1/marine",
  // Ordre de priorité : le premier modèle qui a une valeur pour l'heure gagne.
  // Chaque modèle liste ses identifiants possibles, essayés dans l'ordre
  // (Open-Meteo renomme parfois un modèle : on ne dépend pas d'un seul nom).
  models: [
    { label: "AROME", ids: ["meteofrance_seamless"] },
    { label: "ECMWF", ids: ["ecmwf_ifs", "ecmwf_ifs025"] },
  ],
  hourly: ["pressure_msl", "cloud_cover", "precipitation", "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m", "temperature_2m"],
  marineFull: ["wave_height", "wave_direction", "wave_period", "swell_wave_height", "swell_wave_period", "sea_surface_temperature"],
  marineMin: ["wave_height", "wave_direction", "wave_period"],
  timeoutMs: 20000,
  marineMaxKm: 15,     // au-delà, la maille de houle ne représente plus le spot
  sstMaxKm: 30,        // la température de surface varie lentement dans l'espace
  dayFrom: 6, dayTo: 22, // période de référence des valeurs « du jour »
};
/** "48°20'N 4°18'W" → { lat, lon } (null si illisible). */
export function parseCoords(s) {
  const m = String(s || "").match(/(\d+)°\s*(\d+(?:[.,]\d+)?)?'?\s*([NS])\s*[, ]\s*(\d+)°\s*(\d+(?:[.,]\d+)?)?'?\s*([EWO])/i);
  if (!m) return null;
  const v = (d, mn) => Number(d) + (mn ? Number(String(mn).replace(",", ".")) / 60 : 0);
  const lat = v(m[1], m[2]) * (/s/i.test(m[3]) ? -1 : 1);
  const lon = v(m[4], m[5]) * (/[wo]/i.test(m[6]) ? -1 : 1);
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4) };
}
export function spotLatLon(spot) {
  if (Number.isFinite(spot?.lat) && Number.isFinite(spot?.lon)) return { lat: spot.lat, lon: spot.lon };
  return parseCoords(spot?.coords);
}
export function kmBetween(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
/** Date du jour à l'heure locale (toISOString donne la date UTC : fausse entre minuit et 2 h l'été). */
export function localTodayISO() {
  const p = parisParts(Date.now());
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}
export function isoAddDays(dateISO, n) {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
/** Échelle de Beaufort à partir d'une vitesse moyenne en km/h. */
export function beaufortOf(kmh) {
  if (kmh == null || !Number.isFinite(kmh)) return null;
  const lim = [1, 6, 12, 20, 29, 39, 50, 62, 75, 89, 103, 118];
  let f = 0; while (f < lim.length && kmh >= lim[f]) f++;
  return f;
}
export const dir16Of = (deg) => (deg == null || !Number.isFinite(deg) ? null : DIR16[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16]);
/** Nébulosité (%) → catégorie du modèle : ≤ 2 octas clair, ≥ 6 octas couvert. */
export const skyOf = (cc) => (cc == null || !Number.isFinite(cc) ? null : cc <= 25 ? "clear" : cc >= 75 ? "overcast" : "partly");
/** Mer du vent en plan d'eau fermé (loi de fetch JONSWAP, eau profonde).
 *  Hs = 0,0016 · U · √(F/g) — U en m/s, F en m. Borné à 1,5 m. */
export function fetchWaveHeight(kmh, fetchKm) {
  if (!Number.isFinite(kmh) || !Number.isFinite(fetchKm) || kmh <= 0 || fetchKm <= 0) return 0;
  const U = kmh / 3.6, F = fetchKm * 1000;
  return Math.min(1.5, 0.0016 * U * Math.sqrt(F / 9.81));
}
/** Fetch effectif selon que le vent vient du large (secteur exposé) ou de terre. */
export function fetchForWind(spot, deg, baseKm) {
  if (!Number.isFinite(deg)) return baseKm / 3;
  const near = (list) => (list || []).length ? Math.min(...list.map((a) => angDist(deg, a))) : 180;
  if (near(spot.exposedAngles) <= 45) return baseKm;
  if (near(spot.shelteredAngles) <= 45) return 0.5;
  return baseKm / 3;
}
export const r1 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10);
export const median = (xs) => { const v = xs.filter(Number.isFinite).sort((a, b) => a - b); if (!v.length) return null;
  const k = v.length >> 1; return v.length % 2 ? v[k] : (v[k - 1] + v[k]) / 2; };
export function omUrl(host, params) {
  const q = Object.entries(params).filter(([, v]) => v != null && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(Array.isArray(v) ? v.join(",") : v)}`).join("&");
  return `${host}?${q}`;
}
export async function omFetch(url) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), WX.timeoutMs) : null;
  try {
    const res = await fetch(url, ctrl ? { signal: ctrl.signal } : undefined);
    if (res.status === 429) { const e = new Error("429"); e.isRateLimit = true; throw e; }
    let body = null;
    try { body = await res.json(); } catch { /* corps illisible */ }
    if (!res.ok || body?.error) {
      const e = new Error(`HTTP ${res.status}${body?.reason ? " : " + body.reason : ""}`);
      e.status = res.status; throw e;
    }
    return Array.isArray(body) ? body : [body];
  } catch (e) {
    if (e?.name === "AbortError") throw new Error(`délai dépassé (${WX.timeoutMs / 1000} s)`);
    throw e;
  } finally { if (timer) clearTimeout(timer); }
}
/** Points interrogés : le village de référence puis chaque spot. */
export function wxPoints() {
  const pts = [{ key: "_base", lat: SITE.lat, lon: SITE.lon }];
  for (const s of SPOTS) { const c = spotLatLon(s); if (c) pts.push({ key: s.id, ...c }); }
  return pts;
}
/** Série horaire compacte d'un point, toutes sources fusionnées. */
export function emptySeries(times) {
  const n = times.length, nul = () => new Array(n).fill(null);
  return { t: times, wind: nul(), dir: nul(), gust: nul(), cloud: nul(), rain: nul(), p: nul(), t2m: nul(), src: nul(),
           wave: nul(), wdir: nul(), wper: nul(), swell: nul(), sst: nul(),
           // v7 : vent du second modèle quand le premier a déjà répondu — l'écart
           // AROME/ECMWF mesure l'incertitude réelle de la prévision.
           wind2: nul(), dir2: nul() };
}
export const FC_MAP = { wind_speed_10m: "wind", wind_direction_10m: "dir", wind_gusts_10m: "gust", cloud_cover: "cloud",
                 precipitation: "rain", pressure_msl: "p", temperature_2m: "t2m" };
export const MA_MAP = { wave_height: "wave", wave_direction: "wdir", wave_period: "wper", swell_wave_height: "swell",
                 sea_surface_temperature: "sst" };
/** Recopie dans `ser` les valeurs absentes, heure par heure (alignement par horodatage). */
export function fillFrom(ser, loc, map, srcLabel) {
  const h = loc?.hourly; if (!h?.time) return 0;
  const idx = new Map(ser.t.map((t, i) => [t, i]));
  let filled = 0;
  h.time.forEach((t, j) => {
    const i = idx.get(t); if (i == null) return;
    let any = false;
    for (const [k, dst] of Object.entries(map)) {
      const v = h[k]?.[j];
      if (v == null || !Number.isFinite(v)) continue;
      if (ser[dst][i] == null) { ser[dst][i] = dst === "dir" || dst === "wdir" || dst === "cloud" ? Math.round(v) : r1(v); any = true; }
      else if ((dst === "wind" || dst === "dir") && ser[dst + "2"] && ser[dst + "2"][i] == null && srcLabel) ser[dst + "2"][i] = dst === "dir" ? Math.round(v) : r1(v);
    }
    if (any) { filled++; if (srcLabel && ser.src[i] == null) ser.src[i] = srcLabel; }
  });
  return filled;
}
/** Indice de l'horodatage le plus proche (heures pleines, pas d'une heure). */
export function idxAt(ser, ms) {
  const t = Math.round(ms / 1000);
  let best = -1, bd = Infinity;
  for (let i = 0; i < ser.t.length; i++) { const d = Math.abs(ser.t[i] - t); if (d < bd) { bd = d; best = i; } }
  return bd <= 1800 ? best : -1;
}
/** Agrégat d'une série entre deux heures locales (décimales, relatives à dateISO). */
export function aggregate(ser, dateISO, h0, h1) {
  if (!ser) return null;
  const a = Math.ceil(h0 - 1e-9), b = Math.floor(h1 + 1e-9);
  const hours = []; for (let h = a; h <= b; h++) hours.push(h);
  if (!hours.length) hours.push(Math.round((h0 + h1) / 2));
  const ids = hours.map((h) => idxAt(ser, msAtLocal(dateISO, h))).filter((i) => i >= 0);
  const pick = (k) => ids.map((i) => ser[k][i]).filter((v) => v != null && Number.isFinite(v));
  const wind = pick("wind");
  if (!wind.length) return null;
  // Direction : moyenne vectorielle pondérée par la vitesse.
  let x = 0, y = 0;
  ids.forEach((i) => { const v = ser.wind[i], d = ser.dir[i]; if (v == null || d == null) return;
    x += v * Math.sin(d * Math.PI / 180); y += v * Math.cos(d * Math.PI / 180); });
  const dirDeg = x || y ? ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360 : null;
  const mean = (xs) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);
  const srcs = [...new Set(ids.map((i) => ser.src[i]).filter(Boolean))];
  let x2 = 0, y2 = 0, n2 = 0, k2 = 0;
  if (ser.wind2) ids.forEach((i) => { const v = ser.wind2[i], d = ser.dir2?.[i]; if (v == null) return; k2 += v; n2++;
    if (d != null) { x2 += v * Math.sin(d * Math.PI / 180); y2 += v * Math.cos(d * Math.PI / 180); } });
  return {
    kmh2: n2 ? k2 / n2 : null, dirDeg2: x2 || y2 ? ((Math.atan2(x2, y2) * 180 / Math.PI) + 360) % 360 : null,
    kmh: mean(wind), dirDeg, gust: pick("gust").length ? Math.max(...pick("gust")) : null,
    cloud: mean(pick("cloud")), rain: pick("rain").reduce((s, v) => s + v, 0),
    p: mean(pick("p")), wave: mean(pick("wave")), sst: mean(pick("sst")), src: srcs.join("+") || null,
  };
}
/** Météo d'un spot sur un intervalle horaire, au format attendu par le score. */
export function spotWxBetween(live, spot, h0, h1) {
  const ser = live?.series?.[spot.id];
  const ag = aggregate(ser, live?.date, h0, h1);
  if (!ag) return null;
  const zone = SITE.zones?.[spot.zone] || {};
  let houle = null, houleSrc = "";
  if (zone.sea === "rade") {
    const base = spot.fetchKm ?? zone.fetchKm ?? 6;
    houle = fetchWaveHeight(ag.kmh, fetchForWind(spot, ag.dirDeg, base));
    houleSrc = "mer du vent, plan d'eau abrité";
  } else if (ag.wave != null && ser.marineKm != null && ser.marineKm <= WX.marineMaxKm) {
    houle = ag.wave; houleSrc = `modèle de vagues (maille à ${ser.marineKm.toFixed(0)} km)`;
  } else {
    // Maille de houle trop lointaine pour ce spot : on prend la médiane des
    // spots voisins de la même zone qui en ont une. À défaut, inconnue.
    const peers = SPOTS.filter((s) => s.zone === spot.zone && s.id !== spot.id)
      .map((s) => { const sr = live?.series?.[s.id]; if (!sr || sr.marineKm == null || sr.marineKm > WX.marineMaxKm) return null;
        return aggregate(sr, live?.date, h0, h1)?.wave ?? null; });
    const m = median(peers.filter((v) => v != null));
    if (m != null) { houle = m; houleSrc = "modèle de vagues (spots voisins)"; }
  }
  return {
    wind_dir: dir16Of(ag.dirDeg) || "O",
    wind_force: beaufortOf(ag.kmh) ?? 0,
    wind_kmh: Math.round(ag.kmh), gust_kmh: ag.gust != null ? Math.round(ag.gust) : null,
    dirDeg: ag.dirDeg != null ? Math.round(ag.dirDeg) : null,
    sky: skyOf(ag.cloud) || "partly", cloud: ag.cloud != null ? Math.round(ag.cloud) : null,
    rain: r1(ag.rain),
    houle: houle != null ? Math.round(houle * 10) / 10 : 0, houleKnown: houle != null, houleSrc,
    model: ag.src, fromSpot: true,
    // v7 — incertitude réelle : écart entre les deux modèles (au moins ±1 Beaufort, ±1 secteur).
    spreadF: ag.kmh2 != null ? Math.max(1, Math.min(3, Math.abs((beaufortOf(ag.kmh) ?? 0) - (beaufortOf(ag.kmh2) ?? 0)))) : 1,
    spreadD: ag.dirDeg2 != null && ag.dirDeg != null ? Math.max(1, Math.min(3, Math.round(angDist(ag.dirDeg, ag.dirDeg2) / 22.5))) : 1,
    alt: ag.kmh2 != null ? { kmh: Math.round(ag.kmh2), dir: dir16Of(ag.dirDeg2) } : null,
    rain36: rainBefore(ser, live?.date, h0),
  };
}

/** Pluie cumulée (mm) sur les 36 h précédant une heure locale (limitée aux données chargées). */
export function rainBefore(ser, dateISO, h0, span = 36) {
  if (!ser || !dateISO) return null;
  const end = msAtLocal(dateISO, h0), start = end - span * 36e5;
  let s = 0, n = 0;
  ser.t.forEach((x, i) => { const ms = x * 1000; if (ms > start && ms <= end && ser.rain[i] != null) { s += ser.rain[i]; n++; } });
  return n >= 6 ? r1(s) : null;
}
export function pressureTrendOf(delta) {
  if (!Number.isFinite(delta)) return null;
  return delta <= -4 ? "falling_fast" : delta <= -1.5 ? "falling" : delta < 1.5 ? "stable" : delta < 4 ? "rising" : "rising_fast";
}
/**
 * Télécharge la météo du jour pour chaque spot (+ le village de référence).
 * Retourne la structure historique de l'application (vent, ciel, houle,
 * zones, pression, tendance, SST, résumé) enrichie des séries horaires.
 */
/** Réseau : séries horaires fusionnées pour tous les points, sur [startISO, endISO]. */
export async function fetchRaw(startISO, endISO, refISO) {
  const pts = wxPoints();
  const lat = pts.map((p) => p.lat), lon = pts.map((p) => p.lon);
  const todayISO = localTodayISO();
  const ageDays = Math.round((Date.parse(todayISO) - Date.parse(refISO)) / 864e5);
  // La prévision marine ne va pas au-delà de J+7 : on ne lui demande pas plus.
  const marineEnd = [endISO, isoAddDays(todayISO, 7)].sort()[0];
  const host = ageDays > 80 ? WX.archive : WX.forecast;
  const common = { latitude: lat, longitude: lon, start_date: startISO, end_date: endISO, timeformat: "unixtime", wind_speed_unit: "kmh" };

  // 1. Prévision atmosphérique, un appel par modèle (en parallèle).
  const failures = [];
  const runs = await Promise.all(WX.models.map(async (m) => {
    for (const id of m.ids) {
      try { return { m, locs: await omFetch(omUrl(host, { ...common, hourly: WX.hourly, models: id, cell_selection: "sea" })) }; }
      catch (e) { if (e.isRateLimit) throw e; failures.push(`${m.label} (${id}) → ${e.message}`); }
    }
    return null;
  }));
  let ok = runs.filter(Boolean);
  if (ok.length && ok.length < WX.models.length) {
    // Un modèle manque : le choix automatique d'Open-Meteo comble les heures restantes.
    try { ok.push({ m: { label: "Open-Meteo" }, locs: await omFetch(omUrl(host, { ...common, hourly: WX.hourly, cell_selection: "sea" })) }); }
    catch (e) { if (e.isRateLimit) throw e; failures.push(`Open-Meteo (auto) → ${e.message}`); }
  }
  if (!ok.length) {
    // Dernier recours : le choix automatique d'Open-Meteo, sans paramètre optionnel.
    try { ok = [{ m: { label: "Open-Meteo" }, locs: await omFetch(omUrl(host, { ...common, hourly: WX.hourly })) }]; }
    catch (e) { if (e.isRateLimit) throw e; failures.push(`Open-Meteo (auto) → ${e.message}`); }
  }
  if (!ok.length) {
    const outOfRange = failures.some((f) => /out of allowed range|range|date/i.test(f));
    const err = new Error(outOfRange
      ? "Prévision météo indisponible pour cette date (horizon ~15 jours). Marée et lumière restent calculées."
      : `Météo indisponible — Open-Meteo n'a pas répondu :\n• ${failures.join("\n• ")}`);
    err.source = "open-meteo"; err.attempts = failures;
    throw err;
  }

  // 2. Mer : houle et température de surface (non bloquant).
  let marine = null; const marineFail = [];
  if (ageDays <= 80 && marineEnd >= startISO) {
    for (const vars of [WX.marineFull, WX.marineMin]) {
      try { marine = await omFetch(omUrl(WX.marine, { latitude: lat, longitude: lon, start_date: startISO, end_date: marineEnd, timeformat: "unixtime", hourly: vars })); break; }
      catch (e) { if (e.isRateLimit) throw e; marineFail.push(e.message); }
    }
  }

  // 3. Fusion par point, alignée sur les horodatages du premier modèle valide.
  const series = {};
  const modelsUsed = new Set();
  pts.forEach((pt, i) => {
    const times = ok[0].locs[i]?.hourly?.time || [];
    const ser = emptySeries(times);
    for (const run of ok) { if (fillFrom(ser, run.locs[i], FC_MAP, run.m.label)) modelsUsed.add(run.m.label); }
    const g = ok[0].locs[i];
    ser.cellKm = g?.latitude != null ? r1(kmBetween(pt, { lat: g.latitude, lon: g.longitude })) : null;
    const mloc = marine?.[i];
    if (mloc) {
      fillFrom(ser, mloc, MA_MAP, null);
      ser.marineKm = mloc.latitude != null ? r1(kmBetween(pt, { lat: mloc.latitude, lon: mloc.longitude })) : null;
    }
    series[pt.key] = ser;
  });

  return { series, modelsUsed: [...modelsUsed], failures, marineOk: !!marine, marineFail, ageDays };
}
/** Copie d'une série restreinte à [t0, t1] (ms) — pour mettre un jour en cache sans toute la semaine. */
export function sliceSeries(series, t0, t1) {
  const out = {};
  for (const [k, ser] of Object.entries(series || {})) {
    const idx = ser.t.map((x, i) => [x, i]).filter(([x]) => x * 1000 >= t0 - 1800e3 && x * 1000 <= t1 + 1800e3).map(([, i]) => i);
    const a = idx.length ? idx[0] : 0, b = idx.length ? idx[idx.length - 1] + 1 : 0;
    const s2 = { cellKm: ser.cellKm, marineKm: ser.marineKm };
    for (const [f, v] of Object.entries(ser)) if (Array.isArray(v)) s2[f] = v.slice(a, b);
    out[k] = s2;
  }
  return out;
}
/** Calcul : valeurs d'une journée (vent du jour, pression à midi, tendance, eau, zones, résumé). */
export function deriveDay(raw, dateISO, { sliced = false } = {}) {
  // 4. Valeurs « du jour » (06 h – 22 h) au village de référence.
  const series = sliced ? sliceSeries(raw.series, msAtLocal(dateISO, -24), msAtLocal(dateISO, 48)) : raw.series;
  const { failures, marineFail, ageDays } = raw;
  const marine = raw.marineOk;
  const base = series._base;
  const day = aggregate(base, dateISO, WX.dayFrom, WX.dayTo);
  if (!day) {
    const err = new Error("Météo reçue mais vide pour cette date (modèle hors échéance ?). Marée et lumière restent calculées.");
    err.source = "open-meteo"; throw err;
  }
  const i12 = idxAt(base, msAtLocal(dateISO, 12)), iPrev = idxAt(base, msAtLocal(dateISO, 12) - 24 * 36e5);
  const p12 = i12 >= 0 ? base.p[i12] : null, pPrev = iPrev >= 0 ? base.p[iPrev] : null;
  const delta = p12 != null && pPrev != null ? r1(p12 - pPrev) : null;

  // Température de surface : médiane des mailles marines proches des spots.
  const ssts = SPOTS.map((s) => { const sr = series[s.id]; if (!sr || sr.marineKm == null || sr.marineKm > WX.sstMaxKm) return null;
    return aggregate(sr, dateISO, 0, 23)?.sst ?? null; }).filter((v) => v != null);
  const sst = r1(median(ssts));

  // Zones conservées pour l'affichage : médiane des spots de chaque zone.
  const zones = {};
  for (const zk of Object.keys(SITE.zones || {})) {
    const ws = SPOTS.filter((s) => s.zone === zk).map((s) => spotWxBetween({ date: dateISO, series }, s, WX.dayFrom, WX.dayTo)).filter(Boolean);
    if (!ws.length) continue;
    const kmh = median(ws.map((w) => w.wind_kmh));
    let x = 0, y = 0;
    for (const w of ws) if (w.dirDeg != null) { x += w.wind_kmh * Math.sin(w.dirDeg * Math.PI / 180); y += w.wind_kmh * Math.cos(w.dirDeg * Math.PI / 180); }
    const zdir = x || y ? dir16Of(((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360) : ws[0].wind_dir;
    zones[zk] = { wind_dir: zdir, wind_force: beaufortOf(kmh), wind_kmh: Math.round(kmh),
                  sky: skyOf(median(ws.map((w) => w.cloud))) || "partly", houle: r1(median(ws.map((w) => w.houle))) };
  }

  const zLocal = zones.local || {};
  const live = {
    date: dateISO, provider: "open-meteo",
    wind_dir: dir16Of(day.dirDeg) || "O", wind_force: beaufortOf(day.kmh) ?? 0,
    wind_kmh: Math.round(day.kmh), gust_kmh: day.gust != null ? Math.round(day.gust) : null,
    sky: skyOf(day.cloud) || "partly", houle: zLocal.houle ?? 0, rain_mm: r1(day.rain),
    zones,
    pressure: p12 != null ? Math.round(p12) : (day.p != null ? Math.round(day.p) : null),
    pressure_trend: pressureTrendOf(delta), pressure_delta_24h: delta,
    sst, sst_confidence: sst != null ? "modele" : "inconnue",
    source_meteo: `Open-Meteo · ${raw.modelsUsed.join(" + ") || "modèle"}`,
    source_sst: sst != null ? "Open-Meteo Marine" : "",
    models: raw.modelsUsed,
    warnings: [
      ...(failures.length ? [`Modèle indisponible, relais utilisé : ${failures.join(" ; ")}`] : []),
      ...(!marine && ageDays <= 80 ? [`Houle et température d'eau indisponibles (${marineFail.join(" ; ") || "pas de réponse"}).`] : []),
      ...(ageDays > 80 ? ["Date ancienne : houle et température d'eau non archivées, facteurs neutralisés."] : []),
    ],
    series,
  };
  live.resume = wxResume(live, day);
  return live;
}
export async function fetchLive(dateISO) {
  const raw = await fetchRaw(isoAddDays(dateISO, -1), isoAddDays(dateISO, 1), dateISO);
  return deriveDay(raw, dateISO);
}
/** v6.2 — Sept jours en une seule série de requêtes (3 appels), découpés jour par jour. */
export async function fetchWeek(startISO, n = 7) {
  const raw = await fetchRaw(isoAddDays(startISO, -1), isoAddDays(startISO, n), startISO);
  const days = [];
  for (let i = 0; i < n; i++) {
    const date = isoAddDays(startISO, i);
    try { days.push({ date, live: deriveDay(raw, date, { sliced: true }) }); }
    catch (e) { days.push({ date, live: null, error: e?.message || String(e) }); }
  }
  return days;
}
export function wxResume(live, day) {
  const trend = { falling_fast: "en chute rapide", falling: "en baisse", stable: "stable", rising: "en hausse", rising_fast: "en hausse rapide" }[live.pressure_trend] || "";
  const sky = { clear: "ciel dégagé", partly: "ciel voilé à mi-couvert", overcast: "ciel couvert" }[live.sky];
  const fr = (x) => String(x).replace(".", ",").replace("-", "−");
  const parts = [
    `Vent ${live.wind_dir} ${live.wind_kmh} km/h (F${live.wind_force})${live.gust_kmh ? `, rafales ${live.gust_kmh}` : ""}`,
    sky,
    day.rain >= 1 ? `${fr(r1(day.rain))} mm de pluie` : "",
    live.pressure ? `${live.pressure} hPa ${trend}${live.pressure_delta_24h != null ? ` (${live.pressure_delta_24h > 0 ? "+" : ""}${fr(live.pressure_delta_24h)} sur 24 h)` : ""}` : "",
    live.sst != null ? `eau ${fr(live.sst)} °C` : "",
  ].filter(Boolean);
  return parts.join(" · ") + ` — moyenne ${WX.dayFrom} h-${WX.dayTo} h à ${SITE.name || "la base"}.`;
}
/* WX_ENGINE_END */

// ═══════════════════════════════════════════════════════════════════
// CACHE + EXPONENTIAL BACKOFF
// ═══════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────
// CACHE PERSISTANT (météo)
// v5 : le verrou astronomique de la v4.2 disparaît — la marée n'est plus
// une donnée web, elle est calculée et donc identique à chaque ouverture.
// Seule la météo (une vraie prévision) est mise en cache, 3 h.
// ─────────────────────────────────────────────────────────────────
export const STORE_KEY = "bar:data:" + SITE.id;
export const WX_TTL_MS = 90 * 60 * 1000;   // nouveau run AROME toutes les 3 h ; inutile d'interroger plus souvent

export let storeMem = null;
export const inflightRequests = new Map();
export async function loadStore() {
  if (storeMem) return storeMem;
  const p = await probeStorage();
  if (p.ok) {
    try {
      const r = await window.storage.get(STORE_KEY);
      if (r?.value) storeMem = JSON.parse(r.value);
    } catch { /* première utilisation */ }
  }
  storeMem = storeMem || {};
  return storeMem;
}
export async function saveStore() {
  const p = await probeStorage();
  if (!p.ok) return false;   // sans persistance, la météo est simplement
  try {                      // redemandée à l'ouverture suivante
    if (storeMem) {
      const keys = Object.keys(storeMem).sort();
      while (keys.length > 20) delete storeMem[keys.shift()];   // borne la taille (séries horaires)
      await window.storage.set(STORE_KEY, JSON.stringify(storeMem));
      return true;
    }
  } catch { /* le cache reste en mémoire pour la session */ }
  return false;
}
export function getCached(dateISO) {
  const e = storeMem?.[dateISO];
  if (!e?.wx || e.wx.provider !== "open-meteo") return null;   // ancien format : ignoré
  const today = localTodayISO();
  if (dateISO < today || Date.now() - (e.wxAt || 0) < WX_TTL_MS) return { ...e.wx, _wxAt: e.wxAt };
  return null;
}
/** v6.2 — Semaine : servie par le cache des jours si tout est frais, sinon 3 requêtes. */
export async function fetchWeekCached(startISO, { force = false, n = 7 } = {}) {
  await loadStore();
  const dates = Array.from({ length: n }, (_, i) => isoAddDays(startISO, i));
  if (!force && dates.every((dd) => getCached(dd))) return dates.map((dd) => ({ date: dd, live: getCached(dd) }));
  const days = await fetchWeek(startISO, n);
  const now = Date.now();
  for (const x of days) if (x.live) storeMem[x.date] = { wx: x.live, wxAt: now };
  await saveStore();
  return days;
}
export async function fetchLiveCached(dateISO, { onRetry, force } = {}) {
  await loadStore();
  if (!force) { const c = getCached(dateISO); if (c) return c; }
  if (inflightRequests.has(dateISO)) return inflightRequests.get(dateISO);

  const attempt = async () => {
    const backoffs = [0, 2000, 4000, 8000];
    let lastErr;
    for (let i = 0; i < backoffs.length; i++) {
      if (backoffs[i] > 0) { if (onRetry) onRetry(i, backoffs[i] / 1000); await new Promise(r => setTimeout(r, backoffs[i])); }
      try {
        const fresh = await fetchLive(dateISO);
        storeMem[dateISO] = { wx: fresh, wxAt: Date.now() };
        await saveStore();
        return { ...fresh, _wxAt: storeMem[dateISO].wxAt };
      } catch (e) { lastErr = e; if (!e.isRateLimit) throw e; }
    }
    throw lastErr || new Error("Échec après plusieurs tentatives");
  };

  const promise = attempt().finally(() => inflightRequests.delete(dateISO));
  inflightRequests.set(dateISO, promise);
  return promise;
}
