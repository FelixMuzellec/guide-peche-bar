// Tests unitaires : moteur météo Open-Meteo, houle, fenêtres, pannes, heure d'été, terrain.
// Usage : node tests/unit.mjs logonna   (ou pirou)
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { mockFetch, calls } from "./om_mock.mjs";

const [label] = process.argv.slice(2);
const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, "..");
fs.mkdirSync(path.join(here, ".build"), { recursive: true });
const out = path.join(here, ".build", `unit_${label}.mjs`);
await build({
  entryPoints: [path.join(root, "src/engine/index.js")], bundle: true, format: "esm", platform: "node", outfile: out,
  jsx: "automatic", external: ["react", "react/jsx-runtime", "react-dom"], logLevel: "warning",
  plugins: [{ name: "site", setup(b) {
    b.onResolve({ filter: /^SITE_CONFIG$/ }, () => ({ path: path.join(root, `src/sites/${label}.config.js`) }));
  } }],
});
const E = await import(out);
const V5 = null;

let pass = 0, fail = 0;
const t = (n, c, info = "") => { c ? pass++ : (fail++, console.log(`   ÉCHEC [${label}] · ${n}${info ? " — " + info : ""}`)); };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

// ── 1. Fonctions pures ──
t("Beaufort : seuils km/h", [[0,0],[0.9,0],[1,1],[5.9,1],[6,2],[11.9,2],[12,3],[19.9,3],[20,4],[28.9,4],[29,5],[38.9,5],[39,6],[49.9,6],[50,7],[61.9,7],[62,8],[117.9,11],[118,12],[200,12]]
  .every(([k, f]) => E.beaufortOf(k) === f));
t("Beaufort : valeur absente → null", E.beaufortOf(null) === null && E.beaufortOf(NaN) === null);
t("rose 16 secteurs (FR)", E.dir16Of(0) === "N" && E.dir16Of(22.5) === "NNE" && E.dir16Of(225) === "SO" && E.dir16Of(247.5) === "OSO"
  && E.dir16Of(270) === "O" && E.dir16Of(292.5) === "ONO" && E.dir16Of(359) === "N" && E.dir16Of(-90) === "O" && E.dir16Of(720) === "N");
t("nébulosité → ciel", E.skyOf(0) === "clear" && E.skyOf(25) === "clear" && E.skyOf(26) === "partly" && E.skyOf(74) === "partly" && E.skyOf(75) === "overcast" && E.skyOf(null) === null);
const pc = E.parseCoords("48°20'N 4°18'W");
t("lecture des coordonnées DMS", pc && near(pc.lat, 48.3333, 1e-3) && near(pc.lon, -4.3, 1e-3), JSON.stringify(pc));
t("coordonnées : Est positif, illisible → null", E.parseCoords("43°17'N 5°22'E").lon > 0 && E.parseCoords("n/a") === null);
t("tous les spots ont des coordonnées", E.SPOTS.every((s) => E.spotLatLon(s)), E.SPOTS.filter((s) => !E.spotLatLon(s)).map((s) => s.id).join(","));
t("tous les spots sont à moins de 80 km de la base", E.SPOTS.every((s) => { const c = E.spotLatLon(s); return Math.hypot((c.lat - E.SITE.lat) * 111, (c.lon - E.SITE.lon) * 74) < 80; }));
const hs = E.fetchWaveHeight(36, 5);
t("mer du vent (JONSWAP) : 36 km/h sur 5 km ≈ 0,36 m", near(hs, 0.0016 * 10 * Math.sqrt(5000 / 9.81), 1e-9) && hs > 0.3 && hs < 0.4, hs.toFixed(3));
t("mer du vent : bornée à 1,5 m, nulle sans vent", E.fetchWaveHeight(300, 50) === 1.5 && E.fetchWaveHeight(0, 5) === 0);

// ── 2. Téléchargement nominal ──
const DATE = "2026-10-10";
globalThis.fetch = mockFetch("nominal");
calls.length = 0;
const L = await E.fetchLive(DATE);
t("trois requêtes : AROME, ECMWF, marine", calls.length === 3 && calls.some((c) => c.endsWith("#meteofrance_seamless")) && calls.some((c) => c.endsWith("#ecmwf_ifs")) && calls.some((c) => c.startsWith("marine")), calls.join(" | "));
t("structure historique conservée", ["wind_dir", "wind_force", "sky", "houle", "zones", "pressure", "pressure_trend", "sst", "sst_confidence", "resume"].every((k) => k in L));
t("série horaire pour la base et CHAQUE spot", L.series._base && E.SPOTS.every((s) => L.series[s.id]?.t?.length === 72));
t("72 heures (veille → lendemain), pas d'une heure", L.series._base.t.every((x, i, a) => i === 0 || x - a[i - 1] === 3600));
t("direction dans la rose FR", /^(N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSO|SO|OSO|O|ONO|NO|NNO)$/.test(L.wind_dir));
t("force entière 0–12", Number.isInteger(L.wind_force) && L.wind_force >= 0 && L.wind_force <= 12);
t("pression à midi local, tendance sur 24 h (−2,4 hPa → baisse)", L.pressure_delta_24h === -2.4 && L.pressure_trend === "falling", `${L.pressure_delta_24h} ${L.pressure_trend}`);
t("température d'eau du modèle océanique", L.sst === 15.8 && L.sst_confidence === "modele");
t("source affichée : AROME + ECMWF", /AROME/.test(L.source_meteo) && /ECMWF/.test(L.source_meteo), L.source_meteo);
t("résumé lisible", /km\/h/.test(L.resume) && /hPa/.test(L.resume) && /°C/.test(L.resume), L.resume);
const i12 = E.idxAt(L.series._base, E.msAtLocal(DATE, 12)), i12b = E.idxAt(L.series._base, E.msAtLocal("2026-10-11", 12));
t("AROME prioritaire dans son échéance, ECMWF en relais au-delà", L.series._base.src[i12] === "AROME" && L.series._base.src[i12b] === "ECMWF", `${L.series._base.src[i12]} / ${L.series._base.src[i12b]}`);
t("midi local = 10 h UTC en heure d'été", L.series._base.t[i12] === Date.parse(DATE + "T10:00:00Z") / 1000);
const sizeKB = JSON.stringify(L).length / 1024;
t(`taille en cache raisonnable (${sizeKB.toFixed(0)} Ko)`, sizeKB < 90);
calls.length = 0;
const L2 = await E.fetchLive(DATE);
t("déterminisme : deux téléchargements identiques", JSON.stringify(L) === JSON.stringify(L2));

// ── 3. Houle : rade fermée vs mer ouverte ──
const radeSpots = E.SPOTS.filter((s) => E.SITE.zones[s.zone]?.sea === "rade");
const openSpots = E.SPOTS.filter((s) => E.SITE.zones[s.zone]?.sea !== "rade");
for (const s of radeSpots) {
  const w = E.spotWeather(L, s);
  t(`${s.id} : rade → mer du vent, jamais la houle du large (${w.houle} m)`, w.houleKnown && w.houle < 1 && /mer du vent/.test(w.houleSrc));
}
for (const s of openSpots) {
  const w = E.spotWeather(L, s);
  t(`${s.id} : mer ouverte → modèle de vagues (${w.houle} m)`, w.houleKnown && w.houle >= 0.8 && w.houle <= 1.5 && /modèle de vagues/.test(w.houleSrc), w.houleSrc);
}
t("les spots ont des météos différentes (pas une seule valeur recopiée)", new Set(E.SPOTS.map((s) => E.spotWeather(L, s).wind_kmh)).size > 2);

// ── 4. Météo par fenêtre ──
const sun = E.solarTimes(DATE);
const sp = E.SPOTS[0];
const st = E.tideDay(DATE, sp.tidePort || E.SITE.tide.defaultPort);
const wins = E.computeWindows(sp, st.events).map((w) => ({ ...w, light: E.windowLight(w, sun), zw: E.spotWxBetween(L, sp, w.startDecimal, w.endDecimal) }));
t("chaque fenêtre reçoit la météo de SES heures", wins.length > 0 && wins.every((w) => w.zw && w.zw.fromSpot));
const morning = E.spotWxBetween(L, sp, 6, 8), evening = E.spotWxBetween(L, sp, 19, 21);
t("le vent de 6 h et celui de 19 h diffèrent", morning.wind_kmh !== evening.wind_kmh || morning.wind_dir !== evening.wind_dir, `${morning.wind_dir} ${morning.wind_kmh} / ${evening.wind_dir} ${evening.wind_kmh}`);
const night = E.spotWxBetween(L, sp, -2, 1);
t("fenêtre à cheval sur minuit : données de la veille utilisées", night && Number.isFinite(night.wind_kmh));
const r = E.scoreSpotRobust(sp, { coeff: 80, zw: E.spotWeather(L, sp), wins, pressure: L.pressure, pressureTrend: L.pressure_trend, sst: L.sst, sstConf: L.sst_confidence });
t("score calculé avec la météo par fenêtre", r.eligible === false || (r.score > 0 && r.score < 10));
const winParts = r.windows.map((w) => (w.parts || []).find((p) => /^Vent /.test(p.k))?.k).filter(Boolean);
t("le libellé de vent de chaque fenêtre est le sien", winParts.length === r.windows.filter((w) => w.eligible).length
  && r.windows.filter((w) => w.eligible).every((w) => w.parts.some((p) => p.k === `Vent ${w.zw.wind_dir} F${w.zw.wind_force}`)));

// ── 5. Pannes et dégradations ──
globalThis.fetch = mockFetch("arome400"); calls.length = 0;
const La = await E.fetchLive(DATE);
t("AROME refusé : ECMWF (+ auto en renfort, inutile ici), sans erreur", La.models.join() === "ECMWF" && La.warnings.some((w) => /relais/.test(w)), La.models.join());
globalThis.fetch = mockFetch("ecmwfid400"); calls.length = 0;
const Le = await E.fetchLive(DATE);
t("identifiant ECMWF renommé : second identifiant essayé", Le.models.join() === "AROME,ECMWF" && calls.some((c) => c.endsWith("#ecmwf_ifs025")), Le.models.join() + " | " + calls.join(" "));
globalThis.fetch = mockFetch("allfail");
let err = null; try { await E.fetchLive(DATE); } catch (e) { err = e; }
t("tout refusé : erreur explicite citant la réponse", err && /Open-Meteo n'a pas répondu/.test(err.message) && /Simulated failure/.test(err.message), err?.message);
globalThis.fetch = mockFetch("range");
err = null; try { await E.fetchLive("2026-11-30"); } catch (e) { err = e; }
t("date hors horizon : message clair", err && /horizon/.test(err.message), err?.message);
globalThis.fetch = mockFetch("ratelimit");
err = null; try { await E.fetchLive(DATE); } catch (e) { err = e; }
t("429 : signalé comme limite de débit (pour la relance)", err?.isRateLimit === true);
globalThis.fetch = mockFetch("marinesst400");
const Lm = await E.fetchLive(DATE);
t("variable marine refusée : relance minimale, houle conservée", Lm.sst == null && Lm.sst_confidence === "inconnue"
  && openSpots.every((s) => E.spotWeather(Lm, s).houleKnown));
globalThis.fetch = mockFetch("marinefail");
const Lf = await E.fetchLive(DATE);
t("service marine en panne : météo quand même, avertissement", Lf.warnings.some((w) => /Houle et température/.test(w))
  && openSpots.every((s) => !E.spotWeather(Lf, s).houleKnown) && radeSpots.every((s) => E.spotWeather(Lf, s).houleKnown));
t("avertissements remontés dans les contrôles", E.validateLive(Lf, DATE).some((w) => /Houle et température/.test(w)));

// ── 6. Changement d'heure (25/10/2026) ──
globalThis.fetch = mockFetch("aromefull");
const D = await E.fetchLive("2026-10-25");
const iD12 = E.idxAt(D.series._base, E.msAtLocal("2026-10-25", 12));
t("25/10 : midi local = 11 h UTC (heure d'hiver)", D.series._base.t[iD12] === Date.parse("2026-10-25T11:00:00Z") / 1000);
const iD2 = E.idxAt(D.series._base, E.msAtLocal("2026-10-25", 1)), iD4 = E.idxAt(D.series._base, E.msAtLocal("2026-10-25", 4));
t("25/10 : 1 h → 4 h locales = 4 h de temps réel (heure répétée)", (D.series._base.t[iD4] - D.series._base.t[iD2]) === 4 * 3600);

// ── 7. Vent fort ──
const s0 = E.SPOTS[0];
const shelt = s0.shelteredAngles?.[0] ?? 90;
const dirOf = (deg) => E.dir16Of(deg);
t("coup de vent pénalisé même de terre", E.windMod(dirOf(shelt), 8, s0.exposedAngles, s0.shelteredAngles, 0, 1.2) < E.windMod(dirOf(shelt), 3, s0.exposedAngles, s0.shelteredAngles, 0, 1.2));
// v7 — vent de face non monotone, selon le régime
const ex = s0.exposedAngles[0], dEx = dirOf(ex);
const wmR = (f, reg) => E.windMod(dEx, f, s0.exposedAngles, s0.shelteredAngles, 0, 9, reg);
t("roche : clapot de face F3 favorable, F6 pénalisé", wmR(3, "roche") > 0 && wmR(6, "roche") < -1);
t("plage : rouleaux F3 favorables, F5 défavorables", wmR(3, "plage") > 0 && wmR(5, "plage") < 0);
t("abri : le clapot n'apporte rien, F4 déjà pénalisé", wmR(3, "abri") <= 0.05 && wmR(4, "abri") < 0);
t("vent de face : décroissant au-delà de F3 (toutes les courbes)", ["roche", "plage", "abri"].every((r) => [3, 4, 5, 6, 7, 8].every((f, i, a) => i === 0 || wmR(f, r) <= wmR(a[i - 1], r))));
t("vent de terre : léger plus jusqu'à F4, rien au-delà", E.windMod(dirOf(shelt), 3, s0.exposedAngles, s0.shelteredAngles, 0, 9) > 0 && E.windMod(dirOf(shelt), 5, s0.exposedAngles, s0.shelteredAngles, 0, 9) === 0);
// v7 — saison (Ifremer Bargip : frai hivernal au large, présence côtière mai-novembre)
t("saison : février < juillet, rade plus clémente que la côte ouverte", E.seasonPresence(2, "roche").factor < E.seasonPresence(7, "roche").factor && E.seasonPresence(2, "abri").factor > E.seasonPresence(2, "roche").factor && E.seasonPresence(7, "roche").factor === 1);
t("saison : mai à novembre = présence côtière pleine (ou presque)", [5, 6, 7, 8, 9, 10, 11].every((m) => E.seasonPresence(m, "roche").factor >= 0.95));
t("régimes déduits : rade = abri", E.SPOTS.filter((s) => E.SITE.zones[s.zone]?.sea === "rade").every((s) => E.regimeOf(s) === "abri"));
// v7 — soleil à l'heure de Paris, quel que soit le fuseau du téléphone
t("soleil : décalage de Paris (été +2, hiver +1)", E.solarTimes("2026-07-01").offH === 2 && E.solarTimes("2026-12-01").offH === 1, `${E.solarTimes("2026-07-01").offH}/${E.solarTimes("2026-12-01").offH} (TZ=${process.env.TZ || "système"})`);

// ── 8. Non-régression stricte vs v5 (météo de zone, F0–F6) ──
if (V5) {
  let rng = 12345; const rnd = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);
  const DIRS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  let diff = 0, n = 0;
  for (let k = 0; k < 120; k++) {
    const dIso = new Date(Date.UTC(2026, 0, 1 + Math.floor(rnd() * 500))).toISOString().slice(0, 10);
    const sunK = E.solarTimes(dIso);
    const zw = { wind_dir: DIRS[Math.floor(rnd() * 16)], wind_force: Math.floor(rnd() * 6), sky: ["clear", "partly", "overcast"][Math.floor(rnd() * 3)], houle: +(rnd() * 2).toFixed(1) };
    const ctxBase = { coeff: 30 + Math.floor(rnd() * 90), zw, pressure: 995 + Math.floor(rnd() * 40), pressureTrend: ["falling_fast","falling","stable","rising","rising_fast"][Math.floor(rnd() * 5)], sst: 8 + rnd() * 12, sstConf: "mesure" };
    for (let j = 0; j < E.SPOTS.length; j++) {
      const s6 = E.SPOTS[j], s5 = V5.SPOTS[j];
      const mk = (M, s) => M.computeWindows(s, M.tideDay(dIso, s.tidePort || E.SITE.tide.defaultPort).events).map((w) => ({ ...w, light: M.windowLight(w, sunK) }));
      const a = E.scoreSpotRobust(s6, { ...ctxBase, wins: mk(E, s6) }), b = V5.scoreSpotRobust(s5, { ...ctxBase, wins: mk(V5, s5) });
      n++; if (a.score !== b.score || a.robust !== b.robust || a.spread !== b.spread || a.bestWindowId !== b.bestWindowId) diff++;
    }
  }
  t(`scores identiques à la v5 sur ${n} cas (météo de zone, F0–F5 ; à F6 l’ensemble explore désormais F7)`, diff === 0, `${diff} écarts`);
}

// ── 9. Terrain et bonnes pratiques ──
if (E.terrainOf) {
  const C = ["surface", "sous-surface", "mi-eau", "fond"];
  for (const s of E.SPOTS) {
    const tr = s.terrain;
    t(`${s.id} : fiche terrain complète`, tr && [1, 2, 3].includes(tr.encombrement) && ["oui", "texan", "non"].includes(tr.gratter)
      && Array.isArray(tr.couches) && tr.couches.length && tr.couches.every((c) => C.includes(c)) && tr.montage && tr.fond && tr.source && tr.confidence);
    t(`${s.id} : pas de « fond » dans les couches si on ne peut pas gratter`, !(tr.gratter === "non" && tr.couches.includes("fond")));
  }
  t("faits sourcés : chacun a un texte et une source", E.SPOTS.every((s) => (s.terrain.faits || []).every((f) => typeof f.t === "string" && f.t.length > 10 && typeof f.s === "string" && f.s.length > 3)));
  t("au moins un fait sourcé sur la majorité des spots", E.SPOTS.filter((s) => (s.terrain.faits || []).length).length >= Math.ceil(E.SPOTS.length / 2), String(E.SPOTS.filter((s) => (s.terrain.faits || []).length).length));
  const mm0 = E.SPOTS.find((s) => s.id === "moulinmer");
  if (mm0) t("Moulin Mer : orientation rive sud (exposé S-SO, abrité N-NE)", mm0.exposedAngles.includes(202.5) && mm0.shelteredAngles.includes(0)
    && E.windMod("NE", 4, mm0.exposedAngles, mm0.shelteredAngles, 0, 1.2, E.regimeOf(mm0)) > E.windMod("SO", 4, mm0.exposedAngles, mm0.shelteredAngles, 0, 1.2, E.regimeOf(mm0)));
  const prey = [...new Set(E.SITE.preyCalendar.map((p) => p.name))].map((n) => E.SITE.preyCalendar.find((p) => p.name === n));
  t("chaque proie porte sa couche d'eau", prey.every((p) => C.includes(p.couche)), prey.filter((p) => !C.includes(p.couche)).map((p) => p.name).join(", "));
  const fondPrey = prey.find((p) => p.couche === "fond"), midPrey = prey.find((p) => p.couche !== "fond");
  const non = E.SPOTS.find((s) => s.terrain.gratter === "non"), oui = E.SPOTS.find((s) => s.terrain.gratter === "oui"), tx = E.SPOTS.find((s) => s.terrain.gratter === "texan");
  if (non) { const a = E.adviceForSpot(non, fondPrey); t(`proie de fond sur ${non.id} : conseil remplacé (pas de grattage)`, a.adapted && a.replaces && /au-dessus/.test(a.note) && /fond trop encroché/.test(a.note)); }
  if (oui) t(`proie de fond sur ${oui.id} (sable) : conseil d'origine conservé`, !E.adviceForSpot(oui, fondPrey).adapted);
  if (tx) t(`proie de fond sur ${tx.id} : conseil conservé, montage texan imposé`, E.adviceForSpot(tx, fondPrey).adapted && !E.adviceForSpot(tx, fondPrey).replaces && /texan/.test(E.adviceForSpot(tx, fondPrey).note));
  t("proie dans une couche praticable du spot (hors fond) : jamais modifiée",
    E.SPOTS.every((s) => prey.filter((p) => p.couche !== "fond" && s.terrain.couches.includes(p.couche)).every((p) => !E.adviceForSpot(s, p).adapted)));
  t("proie dans une couche impraticable : nage déplacée vers une couche du spot",
    E.SPOTS.every((s) => prey.filter((p) => !s.terrain.couches.includes(p.couche)).every((p) => { const a = E.adviceForSpot(s, p); return a.replaces && s.terrain.couches.some((c) => a.note.includes("nager en " + c)); })));
  const mmS = E.SPOTS.find((s) => s.id === "moulinmer"), sprat = prey.find((p) => p.name === "Sprat");
  if (mmS && sprat) t("Moulin Mer : le sprat (mi-eau, shad plombé 12-25 g) passe en sous-surface", /nager en sous-surface/.test(E.adviceForSpot(mmS, sprat).note), E.adviceForSpot(mmS, sprat).note);
  const mm = E.SPOTS.find((s) => s.id === "moulinmer");
  if (mm) t("Moulin Mer : pas de pêche à gratter, observation de terrain de Félix", mm.terrain.gratter === "non" && mm.terrain.confidence === "local_knowledge" && /Félix/.test(mm.terrain.source)
    && !mm.terrain.couches.includes("fond"));
}

// ── 10. Heures de pêche ──
if (E.scoreDay) {
  globalThis.fetch = mockFetch("nominal");
  const Lh = await E.fetchLive(DATE);
  const all = E.scoreDay(DATE, Lh, {}), allH = E.scoreDay(DATE, Lh, { hours: E.ALL_HOURS });
  t("heures : « toutes heures » = aucun changement", JSON.stringify(all.map((s) => [s.id, s.score, s.bestWindowId])) === JSON.stringify(allH.map((s) => [s.id, s.score, s.bestWindowId])));
  const H = { from: 6, to: 22 };
  const lim = E.scoreDay(DATE, Lh, { hours: H });
  t("heures : le meilleur créneau de chaque spot est dans les heures choisies",
    lim.filter((s) => s.eligible).every((s) => { const w = s.windows.find((x) => x.id === s.bestWindowId); return w && !w.outOfHours && Math.min(w.endDecimal, 22) - Math.max(w.startDecimal, 6) >= 0.5; }));
  t("heures : les créneaux hors plage restent affichés, marqués", lim.some((s) => s.windows.some((w) => w.outOfHours)) && lim.every((s) => s.windows.length === all.find((a) => a.id === s.id).windows.length));
  const night = { from: 23, to: 24 };
  const n = E.scoreDay(DATE, Lh, { hours: night });
  t("heures : sans créneau possible, raison explicite", n.filter((s) => !s.eligible).some((s) => /tes heures de pêche/.test(s.reason)));
  t("outOfHours : fenêtre à cheval sur minuit", E.outOfHours({ startDecimal: 23.5, endDecimal: 25.5 }, { from: 5, to: 23 }) === true && E.outOfHours({ startDecimal: 21, endDecimal: 23.2 }, { from: 5, to: 23 }) === false);
}

// ── 11. Conditions de session ──
if (E.sessionConditions) {
  globalThis.fetch = mockFetch("nominal");
  const Lc = await E.fetchLive(DATE);
  const s0 = E.SPOTS[0];
  t("heure de session : « 19:15 » → 19,25", E.sessionHour({ heure: "19:15" }, DATE) === 19.25 && E.sessionHour({ heure: "7h05" }, DATE) === 7 + 5 / 60);
  t("heure de session : « au coucher » → coucher calculé", Math.abs(E.sessionHour({ moment: "coucher" }, DATE) - E.solarTimes(DATE).sunset) < 1e-9);
  t("heure de session absente → pas de conditions", E.sessionHour({}, DATE) === null && E.sessionConditions(DATE, Lc, s0, null) === null);
  const c = E.sessionConditions(DATE, Lc, s0, 19.25);
  const tide = E.tideDay(DATE, s0.tidePort || E.SITE.tide.defaultPort);
  const prev = [...tide.events].filter((e) => e.dec <= 19.25).pop();
  t("conditions : phase et référence de marée cohérentes", c && c.phase === (prev.type === "BM" ? "montant" : "descendant") && c.ref.startsWith(prev.type + "+") && c.coef === prev.coef, JSON.stringify(c && [c.phase, c.ref, c.coef]));
  const wx = E.spotWxBetween(Lc, s0, 18.75, 19.75);
  t("conditions : vent de CE spot à CETTE heure", c.vent && c.vent.dir === wx.wind_dir && c.vent.kmh === wx.wind_kmh);
  t("conditions : pression, eau, lumière renseignées", c.pression === Lc.pressure && c.eau === Lc.sst && typeof c.lumiere === "string");
  t("conditions : ligne lisible", /coef \d+/.test(E.conditionsLine(c)) && /km\/h/.test(E.conditionsLine(c)) && /hPa/.test(E.conditionsLine(c)), E.conditionsLine(c));
  const cNo = E.sessionConditions(DATE, null, s0, 19.25);
  t("conditions sans météo : marée seule, rien d'inventé", cNo && cNo.phase && cNo.vent === null && cNo.houle === null && cNo.pression === null);
  const seeds = E.SITE.seedJournal || [];
  if (seeds.length) t("archives : le moment « coucher » est repris de tes mots", seeds.filter((s) => s.moment === "coucher").length === 2 && seeds.find((s) => s.date === "2026-08-07").moment === undefined);
}

// ── 12. Semaine ──
if (E.fetchWeek) {
  globalThis.fetch = mockFetch("nominal"); calls.length = 0;
  const W = await E.fetchWeek(DATE, 7);
  t("semaine : 3 requêtes pour 7 jours", calls.length === 3, calls.join(" | "));
  t("semaine : 7 jours consécutifs, chacun avec sa météo", W.length === 7 && W.every((x, i) => x.date === E.isoAddDays(DATE, i) && x.live && x.live.date === x.date));
  t("semaine : séries découpées autour de chaque jour (≈ 72 h)", W.every((x) => Math.abs(x.live.series._base.t.length - 72) <= 2));
  globalThis.fetch = mockFetch("nominal");
  const D0 = await E.fetchLive(DATE);
  const k = (x) => JSON.stringify([x.pressure, x.pressure_delta_24h, x.pressure_trend, x.wind_dir, x.wind_kmh, x.sst, x.resume]);
  t("semaine : le jour J est identique au téléchargement du jour", k(W[0].live) === k(D0), k(W[0].live) + " ≠ " + k(D0));
  const sc = W.map((x) => E.scoreDay(x.date, x.live, {}));
  t("semaine : chaque jour se note avec le même calcul", sc.every((list) => list.length === E.SPOTS.length && list.some((s) => s.eligible)));
  globalThis.fetch = mockFetch("range");
  let err = null; try { await E.fetchWeek(DATE, 7); } catch (e) { err = e; }
  t("semaine : Open-Meteo refuse → erreur claire", err && /horizon/.test(err.message));
}

// ── 13. v7 : rafales, pression, incertitude réelle, saison dans le score, orientation ──
{
  globalThis.fetch = mockFetch("nominal");
  const Ln = await E.fetchLive(DATE);
  globalThis.fetch = mockFetch("spread");
  const Ls = await E.fetchLive(DATE);
  const sp0 = E.SPOTS[0];
  const zwN = E.spotWxBetween(Ln, sp0, 18, 20), zwS = E.spotWxBetween(Ls, sp0, 18, 20);
  t("incertitude : modèles proches → ±1 ; modèles divergents → plus large", zwN.spreadF === 1 && zwS.spreadF >= 2 && zwS.alt && zwS.alt.kmh > zwS.wind_kmh, `${zwN.spreadF} / ${zwS.spreadF}`);
  const dN = E.scoreDay(DATE, Ln, {}), dS = E.scoreDay(DATE, Ls, {});
  const wider = dS.filter((s) => s.eligible && s.spread > (dN.find((x) => x.id === s.id)?.spread ?? 0)).length;
  t("incertitude : la plage de score s'élargit quand AROME et ECMWF divergent", wider >= Math.ceil(dS.filter((s) => s.eligible).length / 2), `${wider}/${dS.filter((s) => s.eligible).length}`);
  const win = { ...E.computeWindows(sp0, E.tideDay(DATE, sp0.tidePort || E.SITE.tide.defaultPort).events)[0], light: { band: "jour", label: "Jour" } };
  const base = { coeff: 80, pressure: 1000, pressureTrend: "falling_fast", sst: 15, sstConf: "modele", month: 7 };
  const r1 = E.scoreWindow(sp0, win, { ...base, zw: { wind_dir: "N", wind_force: 3, sky: "partly", houle: 0.3, gust_kmh: 30 } });
  const r2 = E.scoreWindow(sp0, win, { ...base, zw: { wind_dir: "N", wind_force: 3, sky: "partly", houle: 0.3, gust_kmh: 70 } });
  t("rafales ≥ 50 km/h pénalisées", r2.rawScore < r1.rawScore && r2.parts.some((p) => /^Rafales 70/.test(p.k)));
  t("pression : poids plafonné à ±0,3", Math.abs(r1.pressureMod) <= 0.3);
  const feb = E.scoreWindow(sp0, win, { ...base, month: 2, zw: { wind_dir: "N", wind_force: 3, sky: "partly", houle: 0.3 } });
  const jul = E.scoreWindow(sp0, win, { ...base, month: 7, zw: { wind_dir: "N", wind_force: 3, sky: "partly", houle: 0.3 } });
  t("saison appliquée au score (février < juillet)", feb.rawScore < jul.rawScore && feb.parts.some((p) => /^Saison/.test(p.k)));
  const o = E.applyOrientation(sp0, { [sp0.id]: { water: 90 } });
  t("orientation corrigée : eau à l'est → exposé E, abrité O", o.exposedAngles.includes(90) && o.shelteredAngles.includes(270) && o.orientSource === "terrain");
  const dO = E.scoreDay(DATE, Ln, { orient: { [sp0.id]: { water: 90 } } }).find((s) => s.id === sp0.id);
  t("orientation corrigée : prise en compte dans le classement", dO.exposedAngles.includes(90));
  t("pluie 36 h calculée pour chaque créneau", Number.isFinite(zwN.rain36));
  const wd = E.waterDirOf(sp0);
  const oc = E.applyOrientation(sp0, { [sp0.id]: { water: wd, confirmed: true } });
  t("orientation confirmée : secteurs de la fiche conservés, confiance relevée", oc.orientSource === "confirmé" && JSON.stringify(oc.exposedAngles) === JSON.stringify(sp0.exposedAngles));
  t("direction de l'eau : moyenne circulaire (N ± 22,5 → N)", E.waterDirOf({ exposedAngles: [337.5, 0, 22.5] }) === 0 && E.waterDirOf({ exposedAngles: [180, 202.5, 225] }) === 202.5);
}

// ── 14. v7 : journal (rétrécissement, prises par heure) ──
{
  const mk = (n, res, pred, extra = {}) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, spotId: "a", date: "2026-07-01", result: res, predicted: pred, ...extra }));
  const c2 = E.calibrate(mk(2, 9, 5));
  t("journal : moins de 3 sessions → aucun recalibrage", c2.calibrated === 0 && c2.detail.a.n === 2);
  const c3 = E.calibrate(mk(3, 6, 5)), c30 = E.calibrate(mk(30, 6, 5));
  t("journal : rétrécissement — 3 sessions corrigent moins que 30", near(c3.spotBias.a, 1 + 0.2 * 3 / 8, 1e-9) && c30.spotBias.a > c3.spotBias.a && c30.spotBias.a <= 1.18);
  t("journal : correction toujours bornée à ±18 %", near(E.calibrate(mk(100, 10, 2)).spotBias.a, 1.18) && near(E.calibrate(mk(100, 0, 8)).spotBias.a, 0.82));
  const st = E.catchStats([{ spotId: "a", fish: 2, duree: 2 }, { spotId: "a", fish: 0, duree: "1,5" }, { spotId: "a", fish: 3 }, { spotId: "b", fish: 1, duree: 30 }]);
  t("prises : bars par heure sur les seules sessions chronométrées", st.a.sessions === 3 && st.a.fish === 5 && st.a.timed === 2 && near(st.a.cpue, 2 / 3.5) && st.a.blank === 1);
  t("prises : durée aberrante (> 24 h) ignorée", st.b.timed === 0 && st.b.cpue === null);
  const sp = E.SPOTS[0], s1 = E.scoreDay(DATE, null, {}).find((s) => s.id === sp.id);
  const calib = E.calibrate(mk(10, 9, 5).map((e) => ({ ...e, spotId: sp.id })));
  const s2 = E.scoreDay(DATE, null, { calib }).find((s) => s.id === sp.id);
  t("journal : le recalibrage apparaît dans le détail de la fenêtre", s2.rawScore > s1.rawScore && s2.windows.some((w) => (w.parts || []).some((p) => /^Journal \(10 sessions\)/.test(p.k))));
}

// ── 15. v7 : réglementation et sécurité ──
{
  const r1 = E.regulationFor("2026-02-15", E.SITE.lat), r2 = E.regulationFor("2026-04-01", E.SITE.lat), r3 = E.regulationFor("2026-03-31", E.SITE.lat);
  t("réglementation : no-kill du 1er février au 31 mars", r1.noKill && r3.noKill && !r2.noKill && !E.regulationFor("2026-01-31", E.SITE.lat).noKill);
  t("réglementation : 3 bars/jour, 42 cm, site au nord du 48e parallèle", r2.quota === 3 && r2.maille === 42 && r2.inZone && E.SITE.lat > 48);
  t("réglementation : autre année signalée « à vérifier »", E.regulationFor("2027-06-01", E.SITE.lat).stale && !r2.stale);
  t("réglementation : chaque règle porte sa source", E.REGLEMENTATION.regles.every((r) => r.t && r.s) && E.REGLEMENTATION.sources.every((s) => /^https:\/\//.test(s.url)));
  t("sécurité : chaque consigne porte sa source", E.SPOTS.every((s) => Array.isArray(s.securite) && s.securite.every((r) => r.t && r.s)));
  if (E.SITE.id === "logonna-daoulas") {
    const te = E.SPOTS.find((s) => s.id === "terenez");
    t("Térénez : alerte active au-delà du coef 85 seulement (Sauvin)", E.securityFor(te, { coeff: 90 }).some((r) => r.active) && !E.securityFor(te, { coeff: 80 }).some((r) => r.active));
  } else {
    const ag = E.SPOTS.find((s) => s.id === "agon");
    t("Agon : alerte « se laisser entourer » active sur un créneau montant", E.securityFor(ag, { window: { tidePhaseType: "montant" } }).some((r) => r.active) && !E.securityFor(ag, { window: { tidePhaseType: "descendant" } }).some((r) => r.active));
  }
}

// ── 16. v7 : marée de Pirou contre une table publiée (contrôle d'octobre 2026) ──
if (E.SITE.id === "pirou-plage") {
  const ref = fs.readFileSync(path.join(here, "ref/pirou_cabaigne_2026-10.txt"), "utf8").split("\n").filter((l) => /^\d\d \|/.test(l));
  const pm = [], pmVive = [], dh = [];
  let matched = 0, total = 0;
  for (const l of ref) {
    const date = `2026-10-${l.slice(0, 2)}`;
    const T = E.tideDay(date, "pirou");
    const c = Math.max(...(T.coefs || [0]));
    for (const [type, hm, h] of l.split("|")[1].split(";").map((s) => s.trim().split(/\s+/))) {
      total++;
      const dec = +hm.slice(0, 2) + +hm.slice(3) / 60;
      const m = T.dayEvents.filter((e) => e.type === type).sort((a, b) => Math.abs(a.dec - dec) - Math.abs(b.dec - dec))[0];
      if (!m || Math.abs(m.dec - dec) > 1.5) continue;
      matched++; dh.push(m.h - +h);
      if (type === "PM") { pm.push(Math.abs(m.dec - dec) * 60); if (c >= 60) pmVive.push(Math.abs(m.dec - dec) * 60); }
    }
  }
  const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  t("marée Pirou : ≥ 95 % des extrêmes de la table retrouvés", matched / total >= 0.95, `${matched}/${total}`);
  t("marée Pirou : pleines mers à ±15 min quand coef ≥ 60", pmVive.length >= 20 && Math.max(...pmVive) <= 15, `max ${Math.max(...pmVive).toFixed(0)} min`);
  t("marée Pirou : pleines mers à ±45 min en morte-eau", Math.max(...pm) <= 45, `max ${Math.max(...pm).toFixed(0)} min`);
  t("marée Pirou : hauteurs à ±0,25 m (écart quadratique)", rms(dh) <= 0.25, rms(dh).toFixed(2));
  t("marée Pirou : le libellé de précision cite ce contrôle", /cabaigne/.test(E.SITE.tide.ports.pirou.accuracy) && !/^SHOM/.test(E.SITE.tide.ports.pirou.accuracy));
}

// ── 16 bis. Conseil leurres ──
{
  t("leurres : classement des familles d'après le nom", E.familyOf({ name: "Black Minnow 120 / 140" }) === "shad" && E.familyOf({ name: "Stickbait 110-140 mm" }) === "surface"
    && E.familyOf({ name: "Long bill minnow / leurre plongeant" }) === "nageur" && E.familyOf({ name: "Souple weightless sur les tables" }) === "weightless"
    && E.familyOf({ name: "Sinking pencil / Asturie lourd" }) === "nageur" && E.familyOf({ name: "Shad souple 10-12 cm en texan" }) === "weightless");
  const sp = E.SPOTS[0];
  const zw = (o) => ({ wind_dir: "O", wind_force: 2, wind_kmh: 10, houle: 0.3, houleKnown: true, cloud: 50, rain36: 0, ...o });
  const W = (band, o = {}, coeff = 70) => ({ light: { band }, zw: zw(o), coeff });
  const nuit = E.lureAdvice(sp, W("nuit"), { sst: 16 }, "2026-07-15");
  t("leurres : de nuit, blanc et petit souple", nuit.color.cat === "blanc" && /85 à 100/.test(nuit.size.text));
  const agit = E.lureAdvice({ ...sp, terrain: { ...E.terrainOf(sp), gratter: "oui", couches: E.COUCHES } }, W("jour", { houle: 1.4, wind_force: 6 }), { sst: 16 }, "2026-07-15");
  if (E.SITE.zones[sp.zone].sea === "open") t("leurres : mer agitée → souple plombé 18-25 g, surface déconseillée", agit.best.k === "shad" && /18 à 25 g/.test(agit.weight.text) && agit.fams.find((f) => f.k === "surface").score < 0);
  else t("leurres : vent F6 en rade → surface déconseillée", agit.fams.find((f) => f.k === "surface").score < agit.fams[0].score);
  const crep = E.lureAdvice(sp, W("crepuscule"), { sst: 16 }, "2026-07-15");
  t("leurres : crépuscule par mer calme → surface en tête, coloris contrasté", crep.color.cat === "contraste" && (crep.best.k === "surface" || E.terrainOf(sp).couches.indexOf("surface") < 0));
  t("leurres : crépuscule → Cabot de ta boîte proposé en premier", !crep.box.length || /Cabot/.test(crep.box[0].color));
  const all = [nuit, agit, crep];
  const srcOk = all.every((a) => [...a.color.why, ...a.size.why, ...a.weight.why, ...a.anim, ...a.models, ...a.sit.clarityWhy, ...a.fams.flatMap((f) => f.why)].every((x) => E.LURE_SOURCES[x.s]));
  t("leurres : chaque raison renvoie à une source connue", srcOk);
  const rocky = E.SPOTS.find((s) => E.terrainOf(s).gratter === "non");
  if (rocky) { const a = E.lureAdvice(rocky, W("jour"), { sst: 16 }, "2026-07-15"); t(`leurres : ${rocky.name}, fond encroché → jamais de souple plombé en tête`, a.best.k !== "shad" && a.best.k !== "metal"); }
  const cold = E.lureAdvice(sp, W("jour"), { sst: 10 }, "2026-04-10");
  t("leurres : eau froide → petite taille, récupération lente", /9 à 12 cm/.test(cold.size.text) && cold.sit.cold);
  const sun = E.lureAdvice(sp, W("jour", { cloud: 10 }), { sst: 16 }, "2026-07-15");
  if (E.SITE.zones[sp.zone].sea === "rade") t("leurres : rade, plein soleil → naturel (eau claire)", sun.color.cat === "naturel" && sun.sit.clarity === "claire");
  const rain = E.lureAdvice({ ...sp, type: "ESTUAIRE" }, W("jour", { rain36: 30 }), { sst: 16 }, "2026-07-15");
  t("leurres : forte pluie près d'un estuaire → eau teintée, coloris visibles", rain.sit.clarity === "teintée" && rain.color.cat === "visible");
  // Boîte : à défaut d'un leurre qui colle, le plus proche — jamais un leurre réservé à une autre lumière.
  {
    let empty = 0, near = 0, bad = 0, ties = 0, tieOk = 0;
    for (const s of E.SPOTS) for (const band of ["nuit", "aube", "jour"]) for (const cloud of [10, 90]) for (const wf of [1, 5]) {
      const a = E.lureAdvice(s, W(band, { cloud, wind_force: wf }), { sst: 15 }, "2026-07-15");
      if (!a.box.length) { empty++; if (a.boxNear) { near++; const pos = a.fams.filter((f) => f.score > 0).map((f) => f.k);
        if (!pos.includes(a.boxNear.fam) || (/Ghost Iwashi/.test(a.boxNear.color) && a.sit.light !== "soleil")) bad++; } }
      if (a.tiedTop.length > 1) { ties++; if (a.tiedTop.every((f) => f.score === a.best.score) && a.tiedTop[0].k === a.best.k) tieOk++; }
    }
    t(`leurres : boîte vide → le plus proche proposé (${near}/${empty}), toujours d'une famille conseillée`, empty === 0 || (near > 0 && bad === 0), `${bad} incohérents`);
    t(`leurres : familles à égalité annoncées (${ties} cas)`, tieOk === ties);
  }
  t("leurres : chaque spot reçoit un conseil complet", E.SPOTS.every((s) => { const a = E.lureAdvice(s, W("jour"), { sst: 15 }, "2026-10-11"); return a.best && a.color.label && a.size.text && a.weight.text && a.anim.length && a.spotLures.length === (s.lures || []).length; }));
}

// ── 16 ter. v8.1 : corrections de l'audit (rade, courant, sources, départage) ──
{
  const zw = (o) => ({ wind_dir: "O", wind_force: 2, wind_kmh: 10, houle: 0.3, houleKnown: true, cloud: 50, rain36: 0, ...o });
  const W = (band, o = {}, coeff = 70) => ({ light: { band }, zw: zw(o), coeff });
  const isRade = (sp) => E.SITE.zones[sp.zone]?.sea === "rade";
  // Rade : le vent fort lève un clapot, jamais le conseil « vagues » (côte rocheuse ouverte).
  const rade = E.SPOTS.filter(isRade);
  if (rade.length) {
    const adv = rade.map((sp) => [sp, E.lureAdvice(sp, W("jour", { wind_force: 6, wind_kmh: 42 }), { sst: 16 }, "2026-07-15")]);
    t("rade, vent F6 : mer « clapot », jamais « agitée »", adv.every(([, a]) => a.sit.sea === "clapot" && a.sit.seaLabel === "clapot de vent"));
    t("rade, vent F6 : jamais de tête de 18 à 25 g ni de shad 120-140 mm ni de Black Minnow « vagues »", adv.every(([, a]) => !/18 à 25 g/.test(a.weight.text) && !/120 à 140/.test(a.size.text) && !a.models.some((m) => m.s === "vagues")));
    t("rade, vent F6 : le montage de la fiche reste l'en-tête", adv.every(([sp, a]) => a.weight.text === (E.terrainOf(sp).montage || "Le plus léger qui garde le contact")));
    t("rade, vent F6 : sur fond encroché, jamais de souple plombé en tête", adv.filter(([sp]) => E.terrainOf(sp).gratter === "non").every(([, a]) => a.best.k !== "shad" && a.best.k !== "metal"));
    t("rade, vent F6 : la surface est déconseillée (stickbait : mer belle à peu agitée)", adv.every(([, a]) => a.fams.find((f) => f.k === "surface").why.some((x) => x.s === "stickbait" && x.v < 0)));
  }
  // Côte ouverte, mer agitée : le conseil « vagues » s'applique, tenu au-dessus du fond si la fiche interdit de gratter.
  const open = E.SPOTS.filter((sp) => !isRade(sp));
  const rough = open.map((sp) => [sp, E.lureAdvice(sp, W("jour", { houle: 1.4, wind_force: 5 }), { sst: 16 }, "2026-07-15")]).filter(([, a]) => a.best.k === "shad");
  if (rough.length) t("côte ouverte, mer agitée : tête de 18 à 25 g, « tenue au-dessus du fond » si gratter = non", rough.every(([sp, a]) => /18 à 25 g/.test(a.weight.text) && (E.terrainOf(sp).gratter !== "non" || /au-dessus du fond/.test(a.weight.text))));
  const havres = open.filter((sp) => E.regimeOf(sp) === "abri").map((sp) => E.lureAdvice(sp, W("jour", { houle: 1.6, wind_force: 5 }), { sst: 16 }, "2026-07-15"));
  if (havres.length) t("havre de la côte ouverte, houle 1,6 m au large : mer « amortie », pas de conseil « vagues »", havres.every((a) => a.sit.sea === "abritée" && !/18 à 25 g/.test(a.weight.text) && !a.models.some((m) => m.s === "vagues")));
  // Courant fort : par nature (type de la fiche) ou au-delà d'un seuil sourcé.
  const cur = (id, coeff) => { const sp = E.SPOTS.find((x) => x.id === id); return sp ? E.lureSituation(sp, W("jour", {}, coeff), { sst: 15 }, "2026-07-15").strongCurrent : null; };
  if (E.SITE.id === "logonna-daoulas") {
    t("courant : Armorique en vive-eau (coef 80) oui, en morte-eau (60) non", cur("armorique", 80) === true && cur("armorique", 60) === false);
    t("courant : Térénez n'est pas un spot de courant au coef 70 (la source le dit pêchant par petits coefficients)", cur("terenez", 70) === false);
    t("courant : goulet (Espagnols, Minou) toujours", cur("espagnols", 40) && cur("minou", 40));
  } else {
    t("courant : Carteret au-delà de 90 seulement", cur("carteret", 95) === true && cur("carteret", 85) === false);
    t("courant : Goury (raz) toujours", cur("goury", 50) === true);
    t("courant : Granville n'est plus déclaré en courant fort sans source", cur("granville", 100) === false);
  }
  // Pluie : seulement près d'une rivière, d'un estuaire ou d'un havre nommés dans la fiche.
  const riverRe = /ESTUAIRE|HAVRE|\bRIA\b|EMBOUCHURE|RIVI[ÈE]RE|CONFLUENCE|AULNE|SIENNE/i;
  const rainy = E.SPOTS.map((sp) => [sp, E.lureAdvice(sp, W("jour", { rain36: 30 }), { sst: 16 }, "2026-07-15").sit]);
  t("pluie 30 mm : eau teintée près des rivières seulement", rainy.every(([sp, st]) => (st.clarity === "teintée") === (!!sp.riviere || riverRe.test(`${sp.type} ${sp.subtitle}`))));
  // Nuit : le recul de la surface est une déduction, pas la source « nuit ».
  const nuit = E.familyRanking({ ...E.lureSituation(E.SPOTS[0], W("nuit"), { sst: 16 }, "2026-07-15") });
  t("nuit : le recul de la surface est étiqueté « déduit »", nuit.find((f) => f.k === "surface").why.filter((x) => x.v < 0 && /nuit/i.test(x.t)).every((x) => x.s === "deduit"));
  // Égalité de familles : la fiche du spot départage.
  const base = E.lureSituation(E.SPOTS[0], W("jour"), { sst: 16 }, "2026-07-15");
  const flat = { ...base, sea: null, light: "jour", strongCurrent: false, cold: false, prey: [], terr: { ...base.terr, gratter: "oui", couches: E.COUCHES } };
  t("égalité de familles : la plus citée par la fiche passe devant", E.familyRanking({ ...flat, ficheFam: { metal: 3 } })[0].k === "metal" && E.familyRanking({ ...flat, ficheFam: { nageur: 2, metal: 1 } })[0].k === "nageur");
  t("égalité sans fiche : ordre fixe et documenté (souple plombé d'abord)", E.familyRanking({ ...flat, ficheFam: {} })[0].k === "shad");
  // Sources : auteur de l'article peche-poissons.com, réglementation.
  const txt = JSON.stringify(E.SITE) + JSON.stringify(E.SPOTS) + JSON.stringify(E.GENERAL_PRINCIPLES || {});
  t("sources : « Sauvin » n'apparaît que comme crédit photo", (txt.match(/Sauvin/g) || []).length === (txt.match(/photos Thierry Sauvin/g) || []).length);
  t("réglementation : l'arrêté du 1er avril 2026 est cité, plus de référence DIRM invérifiable", E.REGLEMENTATION.sources.some((x) => /1er avril 2026/.test(x.label) && /^https:/.test(x.url)) && !JSON.stringify(E.REGLEMENTATION).includes("DIRM"));
  t("leurres : la source « radeCoef » mal attribuée a disparu", !E.LURE_SOURCES.radeCoef);
  if (E.SITE.id === "logonna-daoulas") {
    const te = E.SPOTS.find((x) => x.id === "terenez"), lv = E.SPOTS.find((x) => x.id === "landevennec");
    t("Térénez : plateau de coefficient 40-55, comme la source citée", te.coefBand[1] === 40 && te.coefBand[2] === 55);
    t("Landévennec : Port Maria au jusant dès la 2e heure (source), plus de weightless attribué à Port Maria", lv.tidalRules.windows.some((w) => w.phase === "pm" && w.offsetBefore === 1 && w.tidePhaseType === "descendant")
      && !lv.lures.some((l) => /Port Maria/.test(l.technique) && /weightless|non lesté/i.test(`${l.name} ${l.technique}`)));
  } else {
    const go = E.SPOTS.find((x) => x.id === "goury");
    t("Goury : plus proposé au-delà du coefficient 90, présenté comme un choix de prudence", go.coefHardMax === 90 && /prudence/.test(go.coefHardMaxWhy || ""));
    // La source « 70-90 » est la préférence d'un pêcheur, dans un récit de sortie en bateau : elle ne doit jamais
    // être présentée comme une règle du bord, ni la dérive de 6 nœuds sans dire « en bateau ».
    const allTxt = JSON.stringify(E.SPOTS) + JSON.stringify(E.GENERAL_PRINCIPLES);
    t("Cotentin : « 6 nœuds » toujours accompagné de « en bateau », plus de « impêchable » attribué à la source",
      (allTxt.match(/[^."]*6 nœuds[^."]*/g) || []).every((x) => /bateau/.test(x)) && !/quasiment impêchable/.test(allTxt));
    const ref = E.GENERAL_PRINCIPLES.items.find((i) => /70-90/.test(i.rule));
    t("Cotentin : la plage 70-90 est présentée comme la préférence d'un pêcheur (récit en bateau)", !!ref && /préférence/.test(ref.rule) && /bateau/.test(ref.source));
    const gy = E.scoreDay("2026-10-10", null).find((x) => x.id === "goury");   // coefficient 95
    t("Goury au coefficient 95 : non proposé, raison = prudence avec la citation", !gy.eligible && /prudence/.test(gy.reason || gy.wxReason || "") && /très fort/.test(gy.reason || gy.wxReason || ""), String(gy.reason || gy.wxReason));
    t("Cotentin : plages de coefficient alignées sur la fenêtre de référence 70-90 (sauf Granville, 88)", E.SPOTS.filter((x) => !["goury", "carteret", "granville"].includes(x.id)).every((x) => x.coefBand[1] === 70 && x.coefBand[2] === 90));
  }
  // Égalité sous la précision du modèle : le groupe est annoncé, le classement reste celui de la note.
  const mk = (id, score, distMin) => ({ id, score, robust: score, eligible: true, distMin });
  const grp = E.tieGroup([mk("loin", 7.3, 60), mk("pres", 7.1, 10), mk("autre", 6.0, 5)]);
  t("égalité (≤ 0,2) : groupe annoncé ; au-delà, pas d'égalité", grp.map((x) => x.id).join() === "loin,pres" && !E.tieGroup([mk("loin", 7.4, 60), mk("pres", 7.1, 10)]).length);
  const day = E.scoreDay("2026-07-15", null);
  const bd = E.bestDaytime(day);
  t("meilleur créneau de plein jour : toujours un créneau « jour », le mieux noté", !bd || (bd.w.light.band === "jour" && day.every((s) => !s.eligible || (s.windows || []).every((w) => !w.eligible || w.outOfHours || w.light?.band !== "jour" || w.rawScore <= bd.w.rawScore))));
  t("heures par défaut : 5 h → 23 h", E.DEFAULT_HOURS.from === 5 && E.DEFAULT_HOURS.to === 23);
  t("saison : l'avantage des abris sur la côte ouverte est réduit de moitié (≤ 0,075)", E.SEASON.abri.every((v, i) => v - E.SEASON.roche[i] <= 0.0751 && v >= E.SEASON.roche[i]));
}

// ── 17. Schéma des fiches de spots (erreurs de saisie) ──
{
  const S = E.SPOTS, ids = new Set();
  const bad = (name, f) => { const b = S.filter((s) => !f(s)).map((s) => s.id); t(`fiches : ${name}`, !b.length, b.join(", ")); };
  t("fiches : identifiants uniques", S.every((s) => !ids.has(s.id) && ids.add(s.id)));
  bad("coordonnées affichées et lat/lon concordantes (< 3 km)", (s) => { const p = E.parseCoords(s.coords); return !p || !Number.isFinite(s.lat) || E.kmBetween(p, { lat: s.lat, lon: s.lon }) < 3; });
  bad("secteurs multiples de 22,5°", (s) => [...s.exposedAngles, ...s.shelteredAngles].every((a) => Number.isFinite(a) && a >= 0 && a < 360 && Math.abs(a / 22.5 - Math.round(a / 22.5)) < 1e-9));
  bad("secteurs exposés et abrités disjoints", (s) => !s.exposedAngles.some((a) => s.shelteredAngles.includes(a)));
  bad("bande de coefficient croissante", (s) => !s.coefBand || (s.coefBand.length === 4 && s.coefBand.every((v, i) => !i || v >= s.coefBand[i - 1])));
  bad("port de marée connu", (s) => !s.tidePort || !!E.SITE.tide.ports[s.tidePort]);
  bad("fenêtres de marée valides", (s) => (s.tidalRules?.windows || []).length > 0 && s.tidalRules.windows.every((w) => w.id && ["pm", "bm"].includes(w.phase) && w.offsetAfter > w.offsetBefore && ["prime", "bon"].includes(w.priority)));
  bad("terrain renseigné (gratter, encombrement 1-3, couches connues)", (s) => { const tr = E.terrainOf(s); return E.GRATTER[tr.gratter] && [1, 2, 3].includes(tr.encombrement) && tr.couches.every((c) => E.COUCHES.includes(c)); });
  bad("houle max et niveau de difficulté plausibles", (s) => s.houleMax > 0 && s.houleMax <= 4 && [1, 2, 3].includes(s.dangerLevel));
  bad("rivière : nom de la rivière (texte)", (s) => s.riviere === undefined || (typeof s.riviere === "string" && s.riviere.length >= 3));
  bad("coefHardMaxWhy : seulement avec un coefHardMax", (s) => s.coefHardMaxWhy === undefined || !!s.coefHardMax);
  bad("courant fort : seuil numérique et explication", (s) => !s.courantFort || (Number.isFinite(s.courantFort.above) && typeof s.courantFort.t === "string" && s.courantFort.t.length > 20));
  bad("sécurité : conditions « when » reconnues", (s) => (s.securite || []).every((r) => !r.when || Object.keys(r.when).every((k) => ["coefAbove", "phase"].includes(k))));
}

console.log(`[unit v8.1 · ${label}] ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
