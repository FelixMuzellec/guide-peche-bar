// Modèle de choix des spots : fenêtres, score, ensemble, terrain, proies, pression.
import { SITE, SPOTS } from "SITE_CONFIG";
import { DIR16, fmtH, overlapH, solarTimes, windMod, windowLight } from "./core.js";
import { tideDay } from "./tide.js";
import { spotWeather, spotWxBetween, spotZone } from "./weather.js";


// v5 — Les fenêtres sont construites sur TOUTES les marées du jour.
// Jusqu'en v4 l'app ne connaissait qu'une pleine mer par jour (bm1/pm/bm2) :
// les fenêtres rattachées à la seconde pleine mer étaient ignorées. Chaque
// fenêtre porte désormais le coefficient de SON cycle de marée.
export function computeWindows(spot, events) {
  const out = [];
  for (const rule of spot.tidalRules.windows) {
    const want = rule.phase === "bm" ? "BM" : "PM";
    for (const ev of events || []) {
      if (ev.type !== want) continue;
      const s = ev.dec + rule.offsetBefore, e = ev.dec + rule.offsetAfter;
      if (e <= 0 || s >= 24) continue;               // fenêtre hors de la journée
      out.push({
        ...rule,
        id: `${rule.id}@${ev.type}${fmtH(ev.dec)}`,
        refLabel: ev.type, refFmt: fmtH(ev.dec), coeff: ev.coef ?? null,
        startDecimal: s, endDecimal: e, startFmt: fmtH(s), endFmt: fmtH(e),
      });
    }
  }
  return out.sort((x, y) => x.startDecimal - y.startDecimal);
}
// v2 FIXES (validated by test suite):
//   #1 — Coef-bonus dynamics softened: clamp 1.5→1.2, mult 2.5→2.0 (max 2.4 at peak)
//        This keeps theoretical max score ≤ 9.8, so scores never clamp at 10.
//   #2 — Returns rawScore for ranking; the app sorts on rawScore (tie-preserving)
//   #3 — Ineligible spots return rawScore=null (safe for UI)
// ═══════════════════════════════════════════════════════════════════
// v4 — LUMIÈRE DANS LE SCORE
//
// La v3 affichait la lumière réelle sans jamais l'utiliser : un spot dont la
// seule fenêtre tombait en plein jour était noté comme s'il tombait à l'aube.
// Incohérence corrigée ici.
//
// Le bar est un prédateur à vue opportuniste, nettement plus actif en lumière
// basse : c'est là que se concentre l'essentiel des touches du bord. Le terme
// est borné (+1,2 / −0,9) pour rester du même ordre que le vent. Entre spots,
// la marée (bande de coefficient, −1,8 à +2) reste le premier facteur. Entre
// les créneaux d'un même spot — qui sont tous des phases de marée favorables
// de la fiche — c'est la lumière qui départage : mesuré sur 121 journées,
// le créneau retenu est à l'aube, au crépuscule ou de nuit dans 99 % des cas.
// C'est voulu ; l'interface affiche donc aussi le meilleur créneau de plein jour.
// ═══════════════════════════════════════════════════════════════════
export function lightTerm(light, spot, sky, houle) {
  if (!light || light.band === "inconnu") return { t: 0, why: "" };
  let t, why;
  if (light.band === "aube" || light.band === "crepuscule") { t = 1.2; why = "Basse lumière"; }
  else if (light.band === "nuit") { t = 0.5; why = "Nuit"; }
  else { t = -0.9; why = "Plein jour"; }

  if (t < 0) {
    // Le plein jour pénalise moins quand la surface est brisée ou le ciel
    // couvert : le poisson y perd sa méfiance et remonte sur les bordures.
    let comp = 0;
    if (sky === "overcast") comp += 0.35;
    comp += Math.min(houle || 0, 1.2) * 0.3;
    if (comp > 0.05) why = "Plein jour compensé (ciel/mer)";
    t = Math.min(t + comp, 0);
  }
  // Un spot engagé perd son bonus nocturne : on n'y envoie personne de nuit.
  if (light.band === "nuit" && spot.dangerLevel >= 3) { t = -0.4; why = "Nuit sur spot engagé"; }
  return { t: parseFloat(t.toFixed(2)), why };
}
// ═══════════════════════════════════════════════════════════════════
// v4 — CONFIANCE DE LA TEMPÉRATURE D'EAU
// Quand la recherche ne trouve pas la donnée du jour, elle renvoie une moyenne
// saisonnière. En v3 ce chiffre approximatif appliquait quand même un × 0,30 au
// score. Le drapeau de confiance atténue désormais le multiplicateur au lieu de
// le laisser frapper à pleine force : une donnée faible influence faiblement.
// ═══════════════════════════════════════════════════════════════════
export const SST_CONF_WEIGHT = { mesure: 1.0, modele: 0.9, saison: 0.6, inconnue: 0.35 };
export function effectivePresence(sst, conf) {
  const p = thermalPresence(sst);
  const w = SST_CONF_WEIGHT[conf] ?? 0.35;
  const effective = 1 - (1 - p.factor) * w;
  return { ...p, confWeight: w, effective: parseFloat(effective.toFixed(3)) };
}
// ═══════════════════════════════════════════════════════════════════
// v4 — SCORE PAR FENÊTRE
// La v3 notait une fois par jour et par spot. Or on ne pêche pas une journée,
// on pêche une fenêtre : la marée, la lumière et le vent de 6 h n'ont rien à
// voir avec ceux de 19 h. Chaque fenêtre est donc notée séparément, et le spot
// est classé sur SA MEILLEURE FENÊTRE — pas sur une moyenne qui n'existe nulle
// part dans la réalité.
// ═══════════════════════════════════════════════════════════════════
export function scoreWindow(spot, win, ctx) {
  const { zw, pressure, pressureTrend, sst, sstConf, calib } = ctx;
  // v5 : coefficient du cycle de marée de la fenêtre (repli : max du jour)
  const coeff = win.coeff ?? ctx.coeff;
  const houle = zw.houle, sky = zw.sky;

  if (houle > spot.houleMax + 0.5) return { eligible: false, score: 0, rawScore: null, reason: `Houle trop forte (max ${spot.houleMax} m)` };

  // v5 — BANDE D'UTILITÉ DU COEFFICIENT, SANS PORTE BASSE.
  //
  // Trois défauts corrigés ici, tous les trois de ma fabrication.
  //
  // 1. ERREUR DE PRINCIPE. Un coefficient faible ne rend pas un spot
  //    impêchable : il réduit le courant, il n'enlève pas les poissons. Or
  //    `coefMin` était une porte DURE. Conséquence absurde : à coefficient 30
  //    — qui arrive plusieurs fois par an — l'application déclarait ZÉRO spot
  //    éligible sur les onze de la rade, et zéro sur dix en Cotentin à 45.
  //    Elle affirmait qu'il n'y avait nulle part où pêcher. Le coefficient
  //    devient un terme de score, plus un critère d'exclusion.
  //
  // 2. VALEURS FABRIQUÉES. Les `coefMax` avaient été générés par formule
  //    (idéal + 28, ou + 40 sur le goulet, plafonné à 112). Aucune observation
  //    derrière, et pourtant affichés avec la même autorité que les champs
  //    sourcés. Remplacés par des bandes explicites, chacune portant l'origine
  //    de sa valeur.
  //
  // 3. CONTRADICTION AVEC MA PROPRE DOCUMENTATION en Cotentin : les principes
  //    généraux citent la plage 70 à 90 qu'un pêcheur du Cotentin préfère
  //    (récit de sortie en bateau ; au-delà, « le courant est très fort »). Or
  //    les `coefMax` de 108-110 rendaient le coefficient 100 parfaitement neutre.
  //
  // La bande se lit [seuil bas, début du plateau, fin du plateau, limite haute].
  const band = spot.coefBand || [30, spot.coefMin ?? 45, spot.coefIdeal ?? 75, spot.coefMax ?? 105];
  const [cLo, cO1, cO2, cHi] = band;

  // Seule porte dure conservée : le courant devenu dangereux ou impraticable,
  // et uniquement là où une source le documente (coefHardMax).
  if (spot.coefHardMax && coeff > spot.coefHardMax)
    return { eligible: false, score: 0, rawScore: null,
             reason: spot.coefHardMaxWhy ? `Coef ${coeff} : ${spot.coefHardMaxWhy}` : `Coef ${coeff} > ${spot.coefHardMax} — courant hors de portée du bord ici` };

  const lerpC = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
  let coefTerm, coefLabel;
  if (coeff < cLo)        { coefTerm = -1.8; coefLabel = `Coef ${coeff} très faible`; }
  else if (coeff < cO1)   { coefTerm = lerpC(-1.8, 2.0, (coeff - cLo) / Math.max(cO1 - cLo, 1)); coefLabel = `Coef ${coeff} sous la plage utile`; }
  else if (coeff <= cO2)  { coefTerm = 2.0; coefLabel = `Coef ${coeff} dans la plage utile`; }
  else if (coeff <= cHi)  { coefTerm = lerpC(2.0, -1.2, (coeff - cO2) / Math.max(cHi - cO2, 1)); coefLabel = `Coef ${coeff} au-dessus de la plage`; }
  else                    { coefTerm = -1.2 - ((coeff - cHi) / 15) * 1.6; coefLabel = `Coef ${coeff} — courant excessif`; }

  const parts = [];
  let s = 5.0 + coefTerm;
  parts.push({ k: coefLabel, v: parseFloat(coefTerm.toFixed(2)) });

  const skyMod = sky === "overcast" ? 0.4 : sky === "clear" ? -0.3 : 0;
  s += skyMod; if (skyMod) parts.push({ k: "Ciel", v: skyMod });

  const regime = regimeOf(spot);
  const wm = windMod(zw.wind_dir, zw.wind_force, spot.exposedAngles, spot.shelteredAngles, houle, spot.houleMax, regime);
  s += wm; parts.push({ k: `Vent ${zw.wind_dir} F${zw.wind_force}`, v: parseFloat(wm.toFixed(2)) });

  // v7 — Rafales : au-delà de 50 km/h, lancer, tenue de ligne et sécurité se dégradent,
  // quelle que soit la direction.
  const gust = zw.gust_kmh;
  const gustMod = gust != null && gust >= 50 ? -Math.min(2, (gust - 45) / 10) : 0;
  if (gustMod) { s += gustMod; parts.push({ k: `Rafales ${gust} km/h`, v: parseFloat(gustMod.toFixed(2)) }); }

  // Priorité intrinsèque de la fenêtre, telle que documentée sur le spot.
  const prio = win.priority === "prime" ? 0.5 : 0;
  s += prio; if (prio) parts.push({ k: "Fenêtre prime", v: prio });

  const lt = lightTerm(win.light, spot, sky, houle);
  s += lt.t; if (lt.t) parts.push({ k: lt.why, v: lt.t });

  let pressureMod = 0;
  if (pressure && pressureTrend) {
    const strat = pressureStrategy(pressure, pressureTrend);
    // v7 — poids divisé par deux : ce modèle vient de blogs de pêche, pas d'études
    // sur le bar. Il ne doit pas départager deux spots à lui seul.
    if (strat) { pressureMod = parseFloat((((strat.activity - 5) / 5) * 0.3).toFixed(2)); s += pressureMod; }
  }
  if (pressureMod) parts.push({ k: "Pression (indice faible)", v: pressureMod });

  const pres = effectivePresence(sst, sstConf);
  // v7 — Présence = la plus restrictive entre la température d'eau et la saison
  // (pas le produit : en hiver, eau froide et départ au frai sont le même fait).
  const season = seasonPresence(ctx.month, regime);
  const presence = Math.min(pres.effective, season.factor);
  s *= presence;
  if (season.factor < pres.effective && season.factor < 1) parts.push({ k: `Saison : ${season.label}`, v: parseFloat(((season.factor - 1) * 5).toFixed(2)) });

  // Recalibrage empirique issu du journal (borné ±18 % — trop peu de données
  // pour autoriser davantage, et le bruit d'une session est considérable).
  const bias = calib?.spotBias?.[spot.id];
  if (bias != null) {
    const b = Math.max(0.82, Math.min(1.18, bias)), before = s;
    s *= b;
    if (Math.abs(b - 1) >= 0.01) parts.push({ k: `Journal (${calib.detail?.[spot.id]?.n ?? "?"} sessions)`, v: parseFloat((s - before).toFixed(2)) });
  }

  // v4.1 — COMPRESSION DOUCE AU LIEU D'ÉCRÊTAGE.
  // L'audit a montré que mes propres ajouts (lumière +1,2, fenêtre prime +0,5)
  // repoussaient le score au-delà de 10 dans 3,5 % des scénarios, et que le p90
  // atteignait 9,86 : exactement le défaut de saturation que je reprochais à la
  // v1. Un écrêtage dur crée des ex æquo au plafond et détruit l'information.
  // Au-delà de 8, la courbe est comprimée vers une asymptote à 10 qu'elle
  // n'atteint jamais. Strictement croissante : l'ordre est rigoureusement
  // préservé, et le classement continue de s'appuyer sur rawScore non compressé.
  const rawScore = parseFloat(s.toFixed(4));
  const shown = s <= 8 ? s : 8 + 2 * (1 - Math.exp(-(s - 8) / 2.5));
  return {
    eligible: true,
    rawScore,
    score: parseFloat(Math.max(0.1, Math.min(9.99, shown)).toFixed(1)),
    parts, presence: { ...pres, effective: presence, season }, lightTerm: lt, windMod: wm, pressureMod, gustMod,
    reason: [wm <= -1.5 ? `⚠ Vent ${zw.wind_dir} F${zw.wind_force}` : wm >= 0.4 ? `✅ Vent ${zw.wind_dir} F${zw.wind_force}` : "",
             gustMod <= -0.5 ? `⚠ Rafales ${gust} km/h` : "",
             lt.t >= 0.5 ? `🌅 ${lt.why}` : lt.t <= -0.5 ? `☀ ${lt.why}` : "",
             season.factor < 0.85 && season.factor <= pres.effective ? `🗓 ${season.label}` : pres.effective < 0.85 ? `🌡 ${pres.label}` : ""].filter(Boolean).join(" · "),
  };
}
// ═══════════════════════════════════════════════════════════════════
// v6.2 — MES HEURES DE PÊCHE
// Le bar mord la nuit, mais un créneau de 3 h à 5 h n'aide personne qui ne
// pêche pas à cette heure-là. Les créneaux hors des heures choisies restent
// visibles (grisés) mais ne sont jamais proposés.
// ═══════════════════════════════════════════════════════════════════
export const ALL_HOURS = { from: 0, to: 24 };
// v8.1 — Par défaut, de 5 h à 23 h : avec 0-24 h, le verdict proposait un créneau
// de nuit 30 à 46 % des jours. La nuit reste visible et sélectionnable.
export const DEFAULT_HOURS = { from: 5, to: 23 };
export function outOfHours(w, hours) {
  if (!hours || (hours.from <= 0 && hours.to >= 24)) return false;
  return overlapH(w.startDecimal, w.endDecimal, hours.from, hours.to) < 0.5;
}
/** Note d'un spot = note de sa MEILLEURE fenêtre du jour. */
export function scoreSpot(spot, ctx) {
  // v6 : chaque fenêtre est notée sur la météo de SES heures (w.zw), à défaut
  // sur celle du jour. La perturbation d'ensemble s'applique à cette météo-là.
  const wins = (ctx.wins || []).map((w) => {
    let zw = w.zw || ctx.zw;
    if (ctx.perturb) zw = perturbWx(zw, ctx.perturb.df * (zw.spreadF || 1), ctx.perturb.dd * (zw.spreadD || 1));
    return { ...w, ...scoreWindow(spot, w, { ...ctx, zw }) };
  });
  // v6.2 : un créneau hors des heures de pêche choisies n'est jamais retenu.
  const ok = wins.filter((w) => w.eligible && !w.outOfHours);
  if (!ok.length) {
    const first = wins[0] || {};
    const onlyOutside = wins.some((w) => w.eligible && w.outOfHours);
    return { score: 0, rawScore: null, eligible: false, windows: wins, bestWindowId: null,
             reason: onlyOutside ? "Aucun bon créneau dans tes heures de pêche" : (first.reason || "Non éligible") };
  }
  const best = ok.reduce((a, b) => (b.rawScore > a.rawScore ? b : a));
  return {
    score: best.score, rawScore: best.rawScore, eligible: true, reason: best.reason,
    windows: wins, bestWindowId: best.id, presence: best.presence,
    bestParts: best.parts, bestLabel: best.label, bestFmt: `${best.startFmt} → ${best.endFmt}`,
  };
}
// ═══════════════════════════════════════════════════════════════════
// v4.3 — CLASSEMENT ROBUSTE SOUS INCERTITUDE DU RELEVÉ MÉTÉO
//
// Constat mesuré : à marée et date identiques, un simple décalage d'un secteur
// de vent faisait changer le spot n°1, et le score d'un même spot variait de
// 2,1 points sous un bruit météo pourtant plausible. Le classement était donc
// piloté par l'entrée la moins fiable du système — un relevé de vent issu d'une
// recherche web, précis à ±1 Beaufort et ±1 secteur dans le meilleur des cas.
//
// Verrouiller la marée ne suffisait pas : elle n'était qu'une des trois causes.
//
// Correction : on ne note plus sur un point unique, mais sur un petit ensemble
// de météos plausibles autour du relevé (±1 Beaufort, ±1 secteur de direction).
// Le classement s'appuie sur la moyenne pondérée de cet ensemble. Un spot qui
// n'est premier que pour une valeur exacte de vent ne le reste pas ; un spot
// bon sur toute la plage d'incertitude remonte. L'écart entre le meilleur et le
// pire cas devient lui-même une information affichée : la stabilité du conseil.
// ═══════════════════════════════════════════════════════════════════
export const WX_ENSEMBLE = [
  { df: 0, dd: 0, w: 4 },
  { df: -1, dd: 0, w: 2 }, { df: 1, dd: 0, w: 2 },
  { df: 0, dd: -1, w: 2 }, { df: 0, dd: 1, w: 2 },
  { df: -1, dd: -1, w: 1 }, { df: 1, dd: 1, w: 1 },
  { df: 1, dd: -1, w: 1 }, { df: -1, dd: 1, w: 1 },
];
export function perturbWx(zw, df, dd) {
  const i = DIR16.indexOf(zw.wind_dir);
  return {
    ...zw,
    wind_dir: i >= 0 ? DIR16[(i + dd + 16) % 16] : zw.wind_dir,
    wind_force: Math.max(0, Math.min(12, (zw.wind_force || 0) + df)),
  };
}
export const compress = (v) => (v <= 8 ? v : 8 + 2 * (1 - Math.exp(-(v - 8) / 2.5)));
export function scoreSpotRobust(spot, ctx) {
  const base = scoreSpot(spot, ctx);
  let sum = 0, wsum = 0, lo = Infinity, hi = -Infinity;
  for (const p of WX_ENSEMBLE) {
    const r = scoreSpot(spot, { ...ctx, perturb: p });
    const v = r.eligible ? r.rawScore : 0;
    sum += v * p.w; wsum += p.w;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  const robust = parseFloat((sum / wsum).toFixed(4));
  const spread = parseFloat((hi - lo).toFixed(2));
  return {
    ...base,
    robust,
    spread,
    worst: parseFloat(lo.toFixed(2)),
    best: parseFloat(hi.toFixed(2)),
    stability: spread < 0.8 ? "stable" : spread < 1.8 ? "sensible" : "volatile",
    // Le score affiché est celui de l'ensemble : c'est lui qui ne saute plus
    // d'une ouverture à l'autre quand le relevé de vent bouge d'un cran.
    score: base.eligible ? parseFloat(Math.max(0.1, Math.min(9.99, compress(robust))).toFixed(1)) : base.score,
    pointScore: base.score,
  };
}
/** Marée par port pour une date (mémorisée). */
export function makeTideFor(dateISO, override) {
  const cache = new Map();
  return (port) => {
    const key = port || SITE.tide.defaultPort;
    if (!cache.has(key)) {
      let tt = null;
      try { tt = tideDay(dateISO, key, override); } catch (e) { tt = { error: String(e?.message || e), events: [], dayEvents: [], curve: [], coefs: [] }; }
      cache.set(key, tt);
    }
    return cache.get(key);
  };
}
/**
 * v6.2 — Classement complet d'une journée, en fonction pure : la vue du jour
 * et la vue semaine passent par exactement le même calcul.
 */
/** v7 — Orientation confirmée ou corrigée sur place : prime sur la déduction de la fiche. */
/** Direction de l'eau (vers le large) déduite des secteurs exposés de la fiche : moyenne circulaire. */
export function waterDirOf(spot) {
  const a = spot?.exposedAngles || [];
  if (!a.length) return null;
  let x = 0, y = 0;
  for (const d of a) { x += Math.sin(d * Math.PI / 180); y += Math.cos(d * Math.PI / 180); }
  const deg = ((Math.atan2(x, y) * 180 / Math.PI) + 360) % 360;
  return Math.round(deg / 22.5) * 22.5 % 360;
}
export function applyOrientation(spot, orient) {
  const o = orient?.[spot.id];
  if (!o || !Number.isFinite(o.water)) return spot;
  const w = ((o.water % 360) + 360) % 360, back = (w + 180) % 360;
  // Orientation de la fiche confirmée sur place : secteurs inchangés, seule la confiance monte.
  if (w === waterDirOf(spot)) return { ...spot, orientSource: "confirmé" };
  const ring = (c) => [c, (c + 22.5) % 360, (c + 337.5) % 360];
  return { ...spot, exposedAngles: ring(w), shelteredAngles: ring(back), orientSource: "terrain" };
}
/** Orientations confirmées ou corrigées sur cet appareil. */
export const ORIENT_KEY = "bar:orient:" + SITE.id;
export function loadOrient() {
  try { const v = JSON.parse(localStorage.getItem(ORIENT_KEY) || "{}"); return v && typeof v === "object" ? v : {}; } catch { return {}; }
}
export function saveOrient(o) {
  try { localStorage.setItem(ORIENT_KEY, JSON.stringify(o)); return true; } catch { return false; }
}

export function scoreDay(dateISO, live, { calib, hours, tideFor, orient } = {}) {
  const tf = tideFor || makeTideFor(dateISO);
  const coeff = tf(SITE.tide.defaultPort).maxCoef || 0;
  const pressure = parseInt(live?.pressure) || 0;
  const pressureTrend = live?.pressure_trend || null;
  const sst = live?.sst != null && !isNaN(parseFloat(live.sst)) ? parseFloat(live.sst) : null;
  const sstConf = live?.sst_confidence || "inconnue";
  const sun = solarTimes(dateISO);
  const month = +dateISO.slice(5, 7);
  const sorted = SPOTS.map((s0) => {
    const s = applyOrientation(s0, orient);
    const zw = spotWeather(live, s);
    const st = tf(s.tidePort);
    const wins = computeWindows(s, st.events).map((w) => {
      const x = { ...w, light: windowLight(w, sun),
                  zw: live?.series ? (spotWxBetween(live, s, w.startDecimal, w.endDecimal) || undefined) : undefined };
      x.outOfHours = outOfHours(x, hours);
      return x;
    });
    const r = scoreSpotRobust(s, { coeff, zw, wins, pressure, pressureTrend, sst, sstConf, calib, month });
    return { ...s, ...r, wxReason: r.reason, zw, zoneId: spotZone(s), tideLabel: st.label, tideAccuracy: st.accuracy };
  }).sort(rankCompare);
  return sorted;
}
/** Écart de note sous lequel deux spots sont à égalité (précision du modèle). */
export const TIE_DELTA = 0.2;
// v8.1 — Sous la précision du modèle, la note ne départage plus : la vue du jour
// annonce le groupe à égalité et signale le plus proche. Le classement, lui,
// reste celui de la note (mesuré : reclasser par la distance rendait le n° 1
// plus fragile face à l'erreur de prévision, le plus proche étant souvent le
// dernier du groupe).
export function tieGroup(sorted) {
  const el = (sorted || []).filter((s) => s.eligible);
  if (el.length < 2) return [];
  const top = el[0].score;
  const tied = el.filter((s) => top - s.score <= TIE_DELTA + 1e-9);
  return tied.length < 2 ? [] : tied;
}
/** Meilleur créneau de plein jour (hors aube, crépuscule et nuit) parmi les spots praticables. */
export function bestDaytime(scored) {
  let best = null;
  for (const s of scored || []) {
    if (!s.eligible) continue;
    for (const w of s.windows || []) {
      if (!w.eligible || w.outOfHours || w.light?.band !== "jour") continue;
      if (!best || w.rawScore > best.w.rawScore) best = { s, w };
    }
  }
  return best;
}
// v3 — DÉPARTAGE DÉTERMINISTE.
// Le modèle additif peut produire deux scores rigoureusement égaux quand deux
// spots partagent coefMin, coefIdeal et exposition. Sans règle de départage,
// leur ordre dépendrait de l'ordre de déclaration dans le fichier : arbitraire
// et instable. À score égal, le spot le plus proche passe devant — c'est le
// seul critère qui a du sens pour quelqu'un qui doit prendre la voiture.
export function rankCompare(a, b) {
  if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
  if (a.eligible && b.eligible) {
    // Classement sur le score d'ensemble quand il existe : c'est lui qui résiste
    // au bruit du relevé météo.
    const d = (b.robust ?? b.rawScore) - (a.robust ?? a.rawScore);
    if (Math.abs(d) > 1e-6) return d;
    const dm = (a.distMin ?? 999) - (b.distMin ?? 999);
    if (dm !== 0) return dm;
    return String(a.id).localeCompare(String(b.id));
  }
  const d = b.score - a.score;
  return d !== 0 ? d : String(a.id).localeCompare(String(b.id));
}
export function selectTop3(allScored) {
  const eligible = allScored.filter(s => s.eligible);
  const ineligible = allScored.filter(s => !s.eligible);
  if (eligible.length === 0) return allScored.slice(0, 3);
  const byScore = [...eligible].slice(0, 3);
  const bestLocal = eligible.filter(s => s.isLocal)[0] ?? null;
  if (!bestLocal || byScore.some(s => s.id === bestLocal.id)) {
    const result = [...byScore];
    for (const s of ineligible) { if (result.length >= 3) break; result.push(s); }
    return result;
  }
  return [byScore[0], byScore[1] ?? ineligible[0], bestLocal].filter(Boolean);
}
// ═══════════════════════════════════════════════════════════════════
// THERMIE & PRÉSENCE SAISONNIÈRE
// Le bar (Dicentrarchus labrax) est une espèce partiellement migratrice :
// les individus migrants montrent une fidélité à leurs zones d'engraissement
// estivales côtières et à leurs zones de frai hivernales au large
// (marquage électronique, de Pontual et al.). Les adultes frayent au large
// en fin d'hiver/début de printemps, les larves dérivant ensuite vers la côte.
//
// Conséquence pour le modèle : sous le seuil thermique, le bar ne mord pas
// moins — IL N'EST PLUS LÀ. Une condition de présence ne s'additionne pas
// avec des facteurs de mordant, elle les MULTIPLIE. C'est structurellement
// différent d'un bonus, et c'est le facteur qui manquait au modèle v2.
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// v7 — RÉGIME DU SPOT ET SAISON DU BAR
// Régime : roche (pointes, côtes rocheuses), plage (estran sableux battu),
// abri (rade fermée, ria, havre). Explicite sur le spot si besoin (spot.regime).
// ═══════════════════════════════════════════════════════════════════
export function regimeOf(spot) {
  if (spot?.regime) return spot.regime;
  if (SITE.zones?.[spot?.zone]?.sea === "rade") return "abri";
  const ty = String(spot?.type || "").toUpperCase();
  if (/HAVRE|RIA|ESTUAIRE|EMBOUCHURE/.test(ty)) return "abri";
  if (/PLAGE|ESTRAN SABLEUX|POINTE SABLEUSE/.test(ty)) return "plage";
  return "roche";
}

// Saison : les marquages Ifremer (programme Bargip, 1 220 bars adultes marqués
// en Manche et Atlantique) montrent que les adultes « se reproduisent en hiver »
// sur des frayères « généralement situées au large », occupent les zones
// d'alimentation côtières de mai à novembre, reviennent fidèlement sur leurs
// sites d'été — et que « certains sont résidents » (sans proportion ni lieu).
// Au nord du 48e parallèle, la réglementation impose le no-kill du 1er février
// au 31 mars. Les coefficients ci-dessous traduisent ce cycle ; leurs valeurs
// exactes sont des hypothèses de modèle.
export const SEASON = {
  label: ["départ au frai", "frai au large", "frai au large", "retour", "retour", "présence côtière", "présence côtière",
          "présence côtière", "présence côtière", "présence côtière", "présence côtière", "départ au frai"],
  roche: [0.6, 0.5, 0.55, 0.75, 0.95, 1, 1, 1, 1, 1, 0.95, 0.75],
  plage: [0.6, 0.5, 0.55, 0.75, 0.95, 1, 1, 1, 1, 1, 0.95, 0.75],
  // Abri : Ifremer dit seulement que « certains sont résidents », sans dire où.
  // Supposer qu'ils se tiennent plutôt en rade, ria ou havre est une hypothèse
  // du guide, d'où un écart avec la côte ouverte réduit de moitié en v8.1 (il
  // décidait seul du verdict d'hiver).
  abri:  [0.675, 0.575, 0.625, 0.8, 0.975, 1, 1, 1, 1, 1, 0.975, 0.825],
};
export function seasonPresence(month, regime = "roche") {
  if (!month || month < 1 || month > 12) return { factor: 1, label: "saison inconnue", month: null };
  const tab = SEASON[regime] || SEASON.roche;
  return { factor: tab[month - 1], label: SEASON.label[month - 1], month, regime };
}

export function thermalPresence(sst) {
  if (sst == null || isNaN(sst)) return { factor: 1, level: "unknown", label: "Température d'eau inconnue", detail: "Facteur neutralisé faute de donnée — non deviné." };
  if (sst < 7.5)  return { factor: 0.30, level: "absent",  label: "Population côtière au plus bas", detail: "Sous 7,5 °C, l'essentiel des adultes a rejoint les zones de frai du large. Session très aléatoire." };
  if (sst < 9.5)  return { factor: 0.50, level: "faible",  label: "Présence résiduelle", detail: "Quelques sédentaires seulement. Privilégier les zones abritées et les estuaires, plus tempérés." };
  if (sst < 11.5) return { factor: 0.75, level: "retour",  label: "Retour en cours", detail: "Les premiers poissons regagnent la côte. Activité irrégulière mais en progression." };
  if (sst < 13.5) return { factor: 0.92, level: "montee",  label: "Montée en activité", detail: "Reprise alimentaire nette après le frai. Poissons souvent affamés." };
  if (sst <= 19)  return { factor: 1.00, level: "optimal", label: "Présence côtière pleine", detail: "Fenêtre thermique optimale. Le poisson est là, reste à trouver le bon moment de marée." };
  if (sst <= 21.5) return { factor: 0.90, level: "chaud",  label: "Eau chaude", detail: "Le poisson reste présent mais décale son activité vers la nuit et les crépuscules." };
  return { factor: 0.72, level: "tres_chaud", label: "Eau très chaude", detail: "Activité diurne fortement réduite. Pêcher tôt, tard, ou de nuit." };
}
// ═══════════════════════════════════════════════════════════════════
// v4 — CALENDRIER DES PROIES
// Ce qui commande la taille et le profil du leurre, ce n'est pas la météo du
// jour mais la proie disponible à cette période. Source Cotentin explicite :
// shad de 10 cm quand les sprats dominent, taille supérieure sur sardines.
// ═══════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════
// v6.1 — TERRAIN ET BONNES PRATIQUES PAR SPOT
// Un conseil n'a de valeur que s'il est praticable sur le fond du spot :
// « souple gratté sur les fonds durs » est une bonne idée sur une plaque de
// sable et une boîte de leurres perdue à Moulin Mer. Chaque spot porte donc
// sa fiche terrain, et les conseils génériques (proies du mois, pression)
// sont réécrits en fonction de ce qu'elle permet.
// ═══════════════════════════════════════════════════════════════════
export const COUCHES = ["surface", "sous-surface", "mi-eau", "fond"];
export const ENCOMBREMENT = { 1: "dégagé", 2: "mixte : accroches par endroits", 3: "très encroché" };
export const GRATTER = {
  oui: { label: "Pêche à gratter possible", color: "#22c55e" },
  texan: { label: "Gratter seulement monté texan ou weedless, sur les zones dégagées", color: "#f59e0b" },
  non: { label: "Pas de pêche à gratter : fond trop encroché", color: "#f87171" },
};
export function terrainOf(spot) {
  const t = spot?.terrain;
  if (t) return { couches: COUCHES, conseils: [], ...t };
  return { fond: spot?.topology?.fond?.text || "", encombrement: 2, gratter: "texan", couches: COUCHES,
           montage: "", conseils: [], confidence: "inference", source: "Aucune fiche terrain : prudence par défaut" };
}
/** Conseil d'une proie, réécrit selon ce que le fond du spot permet. */
export function adviceForSpot(spot, prey) {
  const t = terrainOf(spot);
  const c = prey.couche;
  if (!c) return { text: prey.guidance, adapted: false };
  if (!t.couches.includes(c)) {
    // Couche impraticable ici : on garde la proie (profil, taille), on change la hauteur de nage.
    const order = COUCHES.indexOf(c);
    const target = [...t.couches].sort((x, y) => Math.abs(COUCHES.indexOf(x) - order) - Math.abs(COUCHES.indexOf(y) - order) || COUCHES.indexOf(y) - COUCHES.indexOf(x))[0];
    const why = t.gratter === "non" ? "fond trop encroché" : "trop peu d'eau";
    return { text: prey.guidance, adapted: true, replaces: true,
             note: `Ici, pas de pêche ${c === "fond" ? "au fond" : "à " + c} (${why}). Garder le profil de cette proie (${prey.size}) mais la faire nager en ${target} : souple weightless ou texan léger, récupération lente avec de longs arrêts, juste au-dessus du goémon ou de la roche.` };
  }
  if (c === "fond" && t.gratter === "texan")
    return { text: prey.guidance, adapted: true,
             note: "Ici : seulement monté texan ou weedless, et sur les zones dégagées (sable, chenal)." };
  if (c === "fond" && t.gratter === "non")
    return { text: prey.guidance, adapted: true, replaces: true,
             note: "Fond trop encroché pour gratter ici. Imiter cette proie juste au-dessus du goémon ou de la roche : souple weightless ou texan léger, récupération lente avec de longs arrêts." };
  return { text: prey.guidance, adapted: false };
}
export function preyForMonth(month) {
  const list = (SITE.preyCalendar || []).filter((p) => p.months.includes(month));
  return list.sort((a, b) => (b.weight || 1) - (a.weight || 1));
}
// ═══════════════════════════════════════════════════════════════════
// PRESSURE MODEL — Sources : lesbredouilleurs.com, peche.com,
// pecheurdumorin.fr, ici.fr, dailypresse.com, ultimate-fishing.net
// ═══════════════════════════════════════════════════════════════════
export const PRESSURE_MODEL = {
  low:    { min: 0, max: 1010, label: "Basse",   color: "#60a5fa" },
  normal: { min: 1010, max: 1015, label: "Moyenne", color: "#94a3b8" },
  high:   { min: 1015, max: 1025, label: "Haute",  color: "#22c55e" },
  veryHigh: { min: 1025, max: 9999, label: "Très haute", color: "#f59e0b" },
};
export function pressureZone(hPa) {
  if (!hPa) return null;
  if (hPa < 1010) return PRESSURE_MODEL.low;
  if (hPa < 1015) return PRESSURE_MODEL.normal;
  if (hPa < 1025) return PRESSURE_MODEL.high;
  return PRESSURE_MODEL.veryHigh;
}
export function pressureStrategy(hPa, trend, delta24h) {
  if (!hPa || !trend) return null;

  const t = trend;
  const fallingFast = t === "falling_fast";
  const fallingSlow = t === "falling";
  const stable = t === "stable";
  const risingSlow = t === "rising";
  const risingFast = t === "rising_fast";

  let activity = 5, activityReason = "";
  if (fallingFast) {
    activity = 9; activityReason = "Chute rapide avant mauvais temps → PIC d'activité (les bars font des réserves)";
  } else if (fallingSlow) {
    activity = 7; activityReason = "Baisse lente de la pression → bonne activité";
  } else if (stable && hPa >= 1013 && hPa <= 1020) {
    activity = 8; activityReason = "Pression stable en zone optimale → excellente bouchée";
  } else if (stable) {
    activity = 6; activityReason = "Pression stable → activité normale";
  } else if (risingSlow) {
    activity = 6; activityReason = "Hausse lente → bonne activité, reprise progressive";
  } else if (risingFast) {
    activity = 3; activityReason = "Hausse rapide → activité chute pendant 24-48h";
  }

  if (hPa >= 1025 && !fallingSlow && !fallingFast) {
    activity = Math.min(activity, 4);
    activityReason = "Très haute pression prolongée → bars léthargiques";
  }
  if (hPa < 1005) {
    activity = Math.min(activity, 3);
    activityReason = "Très basse pression → bars apathiques, au fond";
  }

  let depth, depthHint;
  if (hPa >= 1015 && (stable || risingSlow)) {
    depth = "surface";
    depthHint = "Bars en surface ou mi-eau (couche oxygénée stable)";
  } else if (fallingFast || hPa < 1010) {
    depth = "deep";
    depthHint = "Bars au fond ou près des structures (réfugiés)";
  } else {
    depth = "mid";
    depthHint = "Bars en mi-eau, prospection large";
  }

  let lureTypes, lureReason;
  if (depth === "surface") {
    lureTypes = ["Stickbait / poisson nageur surface", "Pencil bait (walk-the-dog)", "Jerkbait flottant"];
    lureReason = "Bars en chasse de surface — travail en walk-the-dog, pencil, stickbait.";
  } else if (depth === "deep") {
    lureTypes = ["Shad lourd (20-30g+)", "Slug plombé", "Leurre souple tête plombée"];
    lureReason = "Bars profonds — leurres coulants, prospection lente du fond, jig vertical si possible.";
  } else {
    lureTypes = ["Jerkbait suspending", "Shad moyen (14-18g)", "Sinking pencil"];
    lureReason = "Bars en mi-eau — combiner animations lente et rapide pour trouver la couche active.";
  }

  let zoneHint;
  if (fallingFast) zoneHint = "Privilégier zones de concentration (pointes, goulets, chenaux) — fenêtre courte avant tempête.";
  else if (depth === "surface") zoneHint = "Prospection large : surface et mi-eau. Bordures rocheuses, parcs ostréicoles, plateaux.";
  else if (depth === "deep") zoneHint = "Fosses, tombants, contre-courants profonds, pied de falaise.";
  else zoneHint = "Alterner : tester surface puis mi-eau, descendre graduellement.";

  return {
    activity,
    activityReason,
    depth,
    depthHint,
    lureTypes,
    lureReason,
    zoneHint,
    trendLabel: {
      falling_fast: "↓↓ Chute rapide",
      falling: "↓ Baisse lente",
      stable: "→ Stable",
      rising: "↑ Hausse lente",
      rising_fast: "↑↑ Hausse rapide",
    }[t] || "–",
    delta: delta24h,
  };
}
