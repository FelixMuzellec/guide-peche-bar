// Utilitaires partagés : vent, soleil, lumière, heures.
import { SITE } from "SITE_CONFIG";

// ═══════════════════════════════════════════════════════════════════
// WIND / DIRECTION UTILS
// ═══════════════════════════════════════════════════════════════════
export const DIR16 = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
export const toAngle = d => { const i = DIR16.indexOf((d||"").toUpperCase()); return i >= 0 ? i * 22.5 : -1; };
export const angDist = (a, b) => { const d = Math.abs(((a - b) + 360) % 360); return d > 180 ? 360 - d : d; };
export function windMod(windDir, windForce, exposedAngles, shelteredAngles, houle, houleMax) {
  const ang = toAngle(windDir);
  let mod = 0;
  if (ang >= 0 && windForce > 0) {
    const expDist = Math.min(...exposedAngles.map(a => angDist(ang, a)));
    const sheltDist = shelteredAngles.length ? Math.min(...shelteredAngles.map(a => angDist(ang, a))) : 180;
    if (expDist < 45)  mod -= (1 - expDist / 45) * windForce * 0.65;
    if (sheltDist < 45) mod += (1 - sheltDist / 45) * 0.5;
    // v6 — la météo n'est plus plafonnée à F6 : un coup de vent reste un coup
    // de vent même sous le vent d'une pointe (lancer, sécurité, ligne).
    if (windForce >= 7) mod -= (windForce - 6) * 0.7;
  }
  if (houle > houleMax) mod -= (houle - houleMax) * 1.8;
  return Math.max(-4, Math.min(1.5, mod));
}
// ═══════════════════════════════════════════════════════════════════
// SOLEIL — heures réelles pour la date et le lieu
//
// Corrige un défaut de fond des versions précédentes : les fenêtres
// portaient un libellé « crépuscule » figé dans les données, accroché à une
// référence de marée et JAMAIS confronté à la position réelle du soleil.
// Or une BM de 17h25 en août n'a rien d'un crépuscule — le soleil se couche
// à 21h47 à Brest à cette période. Le libellé est désormais vérifié contre
// l'éphéméride calculée, et corrigé à l'écran quand il ne tient pas.
//
// Algorithme « Almanac for Computers » (Nautical Almanac Office), précision
// de l'ordre de la minute. Calculé localement : aucune dépendance réseau.
// ═══════════════════════════════════════════════════════════════════
export const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export function dayOfYear(y, m, d) {
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}
export function sunEventUTC(y, m, d, lat, lon, zenith, rising) {
  const N = dayOfYear(y, m, d), lngHour = lon / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  let L = M + 1.916 * Math.sin(M * D2R) + 0.020 * Math.sin(2 * M * D2R) + 282.634;
  L = ((L % 360) + 360) % 360;
  let RA = R2D * Math.atan(0.91764 * Math.tan(L * D2R));
  RA = ((RA % 360) + 360) % 360;
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * D2R);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(zenith * D2R) - sinDec * Math.sin(lat * D2R)) / (cosDec * Math.cos(lat * D2R));
  if (cosH > 1 || cosH < -1) return null;   // soleil circumpolaire / jamais levé
  let H = rising ? 360 - R2D * Math.acos(cosH) : R2D * Math.acos(cosH);
  H /= 15;
  const UT = ((H + RA - 0.06571 * t - 6.622 - lngHour) % 24 + 24) % 24;
  return UT;
}
/** Éphéméride locale (heures décimales) pour une date ISO et le site. */
export function solarTimes(dateISO) {
  const [y, m, d] = dateISO.split("-").map(Number);
  // Décalage local réel à cette date : gère automatiquement heure d'été/hiver.
  const offH = -new Date(y, m - 1, d, 12, 0, 0).getTimezoneOffset() / 60;
  const conv = (u) => (u == null ? null : ((u + offH) % 24 + 24) % 24);
  return {
    dawn:    conv(sunEventUTC(y, m, d, SITE.lat, SITE.lon, 96, true)),
    sunrise: conv(sunEventUTC(y, m, d, SITE.lat, SITE.lon, 90.833, true)),
    sunset:  conv(sunEventUTC(y, m, d, SITE.lat, SITE.lon, 90.833, false)),
    dusk:    conv(sunEventUTC(y, m, d, SITE.lat, SITE.lon, 96, false)),
    offH,
  };
}
/** Chevauchement de [a1,a2] et [b1,b2] en heures, sur un axe 0-24 déroulé. */
export function overlapH(a1, a2, b1, b2) {
  if ([a1, a2, b1, b2].some((v) => v == null)) return 0;
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}
/**
 * Confronte une fenêtre de marée à la lumière réelle du jour.
 * Les bandes de basse lumière retenues : de l'aube civile à 45 min après le
 * lever, et de 45 min avant le coucher à la nuit civile. C'est la tranche où
 * le bar perd sa méfiance et vient chasser près du bord.
 */
export function windowLight(win, sun) {
  if (!sun || sun.sunrise == null || sun.sunset == null || win.startDecimal == null) {
    return { band: "inconnu", label: "Lumière non calculée", color: "#8a9ab0", overlap: 0, mismatch: false };
  }
  const s = win.startDecimal, e = win.endDecimal;
  const bands = [];
  // Les fenêtres peuvent déborder de 0-24 : on teste aussi les copies ±24 h.
  for (const shift of [-24, 0, 24]) {
    bands.push({ k: "aube", o: overlapH(s, e, sun.dawn + shift, sun.sunrise + 0.75 + shift) });
    bands.push({ k: "crepuscule", o: overlapH(s, e, sun.sunset - 0.75 + shift, sun.dusk + shift) });
    bands.push({ k: "nuit", o: overlapH(s, e, sun.dusk + shift, sun.dawn + 24 + shift) });
    bands.push({ k: "jour", o: overlapH(s, e, sun.sunrise + 0.75 + shift, sun.sunset - 0.75 + shift) });
  }
  const agg = {};
  for (const b of bands) agg[b.k] = (agg[b.k] || 0) + b.o;
  const best = Object.entries(agg).sort((a, b) => b[1] - a[1])[0];
  const lowLight = (agg.aube || 0) + (agg.crepuscule || 0) + (agg.nuit || 0);
  const claimsTwilight = /crépuscule|crepuscule|aube|coup du soir|petit jour|nuit/i.test(
    `${win.label} ${win.note || ""}`
  );
  const cfg = {
    aube:       { label: "Aube",           color: "#f59e0b" },
    crepuscule: { label: "Crépuscule",     color: "#f59e0b" },
    nuit:       { label: "Nuit",           color: "#818cf8" },
    jour:       { label: "Plein jour",     color: "#94a3b8" },
  }[best[0]] || { label: "–", color: "#8a9ab0" };
  return {
    band: best[0],
    label: cfg.label,
    color: cfg.color,
    overlap: lowLight,
    // Le libellé promet de la basse lumière alors que la fenêtre n'en a
    // pratiquement pas : c'est exactement le cas signalé sur le terrain.
    mismatch: claimsTwilight && lowLight < 0.25,
  };
}
// ═══════════════════════════════════════════════════════════════════
// TIME UTILS
// ═══════════════════════════════════════════════════════════════════
export function parseHHMM(str) {
  if (!str) return null;
  const clean = String(str).replace(/[hH]/g, ":");
  const [h, m] = clean.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h + m / 60;
}
export function fmtH(dec) {
  if (dec == null || isNaN(dec)) return "–";
  let h = ((dec % 24) + 24) % 24;
  let hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  if (mm === 60) { mm = 0; hh = (hh + 1) % 24; }
  return `${String(hh).padStart(2,"0")}h${String(mm).padStart(2,"0")}`;
}
