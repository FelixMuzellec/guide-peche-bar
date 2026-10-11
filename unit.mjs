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
t("jusqu'à F6, modèle v5 inchangé", E.windMod(dirOf(shelt), 6, s0.exposedAngles, s0.shelteredAngles, 0, 1.2) === E.windMod(dirOf(shelt), 3, s0.exposedAngles, s0.shelteredAngles, 0, 1.2));

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
    && E.windMod("NE", 4, mm0.exposedAngles, mm0.shelteredAngles, 0, 1.2) > E.windMod("SO", 4, mm0.exposedAngles, mm0.shelteredAngles, 0, 1.2));
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

console.log(`[unit v6 · ${label}] ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
