// Contrat Open-Meteo : vérifie contre le VRAI service que les modèles, variables
// et formats dont les deux applications dépendent existent toujours. Open-Meteo
// renomme parfois un modèle ou une variable : l'application a des relais, mais
// on veut le savoir le jour même, pas le découvrir sur le spot.
//
// Lancé chaque matin par GitHub Actions (.github/workflows/contrat-open-meteo.yml).
//   node tests/contract.mjs                  réseau réel
//   CONTRACT_MOCK=1 node tests/contract.mjs  simulateur (pour vérifier le test lui-même)
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import { mockFetch } from "./om_mock.mjs";

const here = path.dirname(new URL(import.meta.url).pathname), root = path.resolve(here, "..");
const MOCK = process.env.CONTRACT_MOCK === "1";
if (MOCK) globalThis.fetch = mockFetch("nominal");
fs.mkdirSync(path.join(here, ".build"), { recursive: true });

let pass = 0, fail = 0;
const t = (n, c, info = "") => { if (c) { pass++; console.log(`  ✓ ${n}${info ? " — " + info : ""}`); } else { fail++; console.log(`  ✗ ${n}${info ? " — " + info : ""}`); } };
const pause = (ms) => new Promise((r) => setTimeout(r, MOCK ? 0 : ms));

for (const label of ["logonna", "pirou"]) {
  const out = path.join(here, ".build", `contract_${label}.mjs`);
  await build({
    entryPoints: [path.join(root, "src/engine/index.js")], bundle: true, format: "esm", platform: "node", outfile: out,
    jsx: "automatic", external: ["react", "react/jsx-runtime", "react-dom"], logLevel: "warning",
    plugins: [{ name: "site", setup(b) { b.onResolve({ filter: /^SITE_CONFIG$/ }, () => ({ path: path.join(root, `src/sites/${label}.config.js`) })); } }],
  });
  const E = await import(out);
  const today = E.localTodayISO();
  console.log(`\n[${label}] ${today}${MOCK ? " (simulateur)" : " (Open-Meteo réel)"}`);

  // 1. Le jour même : prévision AROME + ECMWF, houle et eau.
  let L = null, err = null;
  try { L = await E.fetchLive(today); } catch (e) { err = e; }
  t("prévision du jour téléchargée", !!L, err ? err.message : "");
  if (L) {
    t("les deux modèles répondent (AROME et ECMWF)", L.models.includes("AROME") && L.models.includes("ECMWF"), L.models.join(" + "));
    t("aucun modèle remplacé par un relais", !L.warnings.some((w) => /Modèle indisponible/.test(w)), L.warnings.join(" | "));
    t("houle et température d'eau disponibles", !L.warnings.some((w) => /Houle et température d'eau indisponibles/.test(w)), L.warnings.join(" | "));
    const weak = E.SPOTS.filter((s) => {
      const ser = L.series[s.id];
      if (!ser) return true;
      const n = Array.from({ length: 17 }, (_, i) => E.idxAt(ser, E.msAtLocal(today, 6 + i))).filter((i) => i >= 0 && ser.wind[i] != null).length;
      return n < 15;
    }).map((s) => s.id);
    t("vent heure par heure sur chaque spot (6 h-22 h)", !weak.length, weak.join(", "));
    t("pression plausible", L.pressure >= 950 && L.pressure <= 1060, String(L.pressure));
    t("température de l'eau plausible", L.sst != null && L.sst >= 4 && L.sst <= 25, String(L.sst));
    const far = E.SPOTS.filter((s) => E.SITE.zones?.[s.zone]?.sea === "open");
    const nearWave = far.filter((s) => (L.series[s.id]?.marineKm ?? 99) <= E.WX.marineMaxKm).length;
    t("maille de houle proche d'au moins la moitié des spots de côte ouverte", !far.length || nearWave >= far.length / 2, `${nearWave}/${far.length}`);
    const cells = E.SPOTS.map((s) => L.series[s.id]?.cellKm).filter((v) => v != null);
    t("maille météo à moins de 10 km de chaque spot", cells.length === E.SPOTS.length && Math.max(...cells) < 10, `max ${Math.max(...cells)} km`);
    const scored = E.scoreDay(today, L, {});
    t("classement calculable", scored.length === E.SPOTS.length && scored.every((s) => Number.isFinite(s.score)));
    const warn = E.validateLive(L, today);
    if (warn.length) console.log("    (contrôles de cohérence : " + warn.join(" | ") + ")");
  }
  await pause(1500);

  // 2. La semaine : même chaîne, 3 requêtes.
  let W = null; err = null;
  try { W = await E.fetchWeek(today, 7); } catch (e) { err = e; }
  t("semaine téléchargée (7 jours)", W && W.length === 7 && W.every((d) => d.live), err ? err.message : W ? W.filter((d) => !d.live).map((d) => d.date + " : " + d.error).join(" | ") : "");
  await pause(1500);

  // 3. Une date ancienne (> 80 jours) : service d'archives des prévisions.
  const old = E.isoAddDays(today, -100);
  let O = null; err = null;
  try { O = await E.fetchLive(old); } catch (e) { err = e; }
  t(`archives des prévisions (${old})`, !!O && O.models.length > 0, err ? err.message : O ? O.models.join(" + ") : "");
  await pause(1500);
}

console.log(`\nContrat Open-Meteo : ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
