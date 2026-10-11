// Journal de session : lecture/écriture sûres, conditions, recalibrage.
import { SITE } from "SITE_CONFIG";
import { fmtH, solarTimes, windowLight } from "./core.js";
import { makeTideFor } from "./model.js";
import { probeStorage } from "./persist.js";
import { spotWxBetween } from "./weather.js";

// ═══════════════════════════════════════════════════════════════════
// v4 — JOURNAL DE SESSION
// Sans retour terrain, mes pondérations restent mes pondérations indéfiniment.
// Le journal compare le score prédit au résultat observé et recalibre chaque
// spot. Trois sessions minimum et correction bornée à ±18 % : trop peu de
// données et trop de bruit pour autoriser davantage.
// ═══════════════════════════════════════════════════════════════════
export const JOURNAL_KEY = "bar:journal:" + SITE.id;
/** Fusionne les sessions inscrites en dur avec celles du stockage.
 *  Les entrées du stockage l'emportent (elles peuvent avoir été complétées),
 *  mais aucune session inscrite ne peut disparaître. */
export function withSeed(entries) {
  const byId = new Map((SITE.seedJournal || []).map((e) => [String(e.id), { ...e, seed: true }]));
  for (const e of entries || []) {
    const prev = byId.get(String(e.id));
    byId.set(String(e.id), prev ? { ...prev, ...e, seed: true } : e);
  }
  return [...byId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
/** @returns {{entries:Array, status:"ok"|"empty"|"unavailable"}} */
export async function loadJournal() {
  const p = await probeStorage();
  if (!p.ok) return { entries: withSeed([]), status: "unavailable", reason: p.reason };
  try {
    const r = await window.storage.get(JOURNAL_KEY);
    if (r?.value) {
      const parsed = JSON.parse(r.value);
      if (Array.isArray(parsed)) return { entries: withSeed(parsed), status: "ok" };
      return { entries: withSeed([]), status: "unavailable", reason: "Contenu du journal illisible." };
    }
  } catch (e) {
    // Une clé absente est normal au premier lancement ; toute autre erreur
    // ne doit surtout pas être confondue avec un journal vide.
    const msg = String(e?.message || e);
    if (!/not found|absent|no such|missing|introuvable/i.test(msg))
      return { entries: withSeed([]), status: "unavailable", reason: msg };
  }
  return { entries: withSeed([]), status: "empty" };
}
/** Écriture fusionnée : ne perd jamais une entrée écrite ailleurs entre-temps. */
export async function saveJournal(entries, loadStatus) {
  const p = await probeStorage();
  if (!p.ok) return { ok: false, reason: p.reason };
  if (loadStatus === "unavailable")
    return { ok: false, reason: "Lecture initiale échouée — écriture bloquée pour ne pas écraser l'historique." };
  try {
    let existing = [];
    try {
      const r = await window.storage.get(JOURNAL_KEY);
      if (r?.value) { const q = JSON.parse(r.value); if (Array.isArray(q)) existing = q; }
    } catch { /* première écriture */ }
    const byId = new Map(existing.map((e) => [String(e.id), e]));
    for (const e of entries) byId.set(String(e.id), e);
    const merged = withSeed([...byId.values()]);
    await window.storage.set(JOURNAL_KEY, JSON.stringify(merged));
    // Relecture de contrôle : une écriture silencieusement perdue est le
    // scénario exact qu'on cherche à éliminer.
    const back = await window.storage.get(JOURNAL_KEY);
    const okBack = back?.value && JSON.parse(back.value).length === merged.length;
    return okBack ? { ok: true, entries: merged } : { ok: false, reason: "Écriture non confirmée à la relecture.", entries: merged };
  } catch (e) {
    return { ok: false, reason: e?.message || "Échec d'écriture." };
  }
}
// ═══════════════════════════════════════════════════════════════════
// v6.2 — CONDITIONS DE LA SESSION
// Une note ressentie sans les conditions qui l'entouraient n'apprend rien.
// À l'enregistrement (ou dès que la date est ouverte), la session reçoit la
// marée, la météo de SON heure sur SON spot, la pression et la lumière.
// ═══════════════════════════════════════════════════════════════════
export function sessionHour(e, dateISO) {
  const m = String(e?.heure || "").match(/^(\d{1,2})[:h](\d{2})$/);
  if (m) return +m[1] + +m[2] / 60;
  if (e?.moment === "coucher" || e?.moment === "lever") {
    const s = solarTimes(dateISO || e.date);
    return e.moment === "coucher" ? s.sunset : s.sunrise;
  }
  return null;
}
export function sessionConditions(dateISO, live, spot, hour, tideFor) {
  if (hour == null || !spot) return null;
  const tf = tideFor || makeTideFor(dateISO);
  const st = tf(spot.tidePort);
  const evs = (st.events || []).filter((ev) => Number.isFinite(ev.dec)).sort((a, b) => a.dec - b.dec);
  const prev = [...evs].reverse().find((ev) => ev.dec <= hour), next = evs.find((ev) => ev.dec > hour);
  const since = prev ? hour - prev.dec : null;
  const wx = live?.series ? spotWxBetween(live, spot, hour - 0.5, hour + 0.5) : null;
  const light = windowLight({ startDecimal: hour - 0.25, endDecimal: hour + 0.25 }, solarTimes(dateISO));
  return {
    h: Math.round(hour * 100) / 100,
    phase: prev ? (prev.type === "BM" ? "montant" : "descendant") : null,
    ref: prev ? `${prev.type}+${fmtH(since).replace(/^0(\d)h/, "$1h")}` : (next ? `${next.type}−${fmtH(next.dec - hour).replace(/^0(\d)h/, "$1h")}` : null),
    coef: prev?.coef ?? next?.coef ?? null,
    vent: wx ? { dir: wx.wind_dir, kmh: wx.wind_kmh, raf: wx.gust_kmh, f: wx.wind_force } : null,
    houle: wx?.houleKnown ? wx.houle : null,
    pression: live?.pressure ?? null, tendance: live?.pressure_trend ?? null,
    eau: live?.sst ?? null, lumiere: light.band !== "inconnu" ? light.label : null,
    meteo: wx ? (live?.source_meteo || "Open-Meteo") : null,
  };
}
export function conditionsLine(c) {
  if (!c) return "";
  const fr = (x) => String(x).replace(".", ",");
  const tr = { falling_fast: "↘↘", falling: "↘", stable: "→", rising: "↗", rising_fast: "↗↗" }[c.tendance] || "";
  return [
    c.phase ? `${c.phase} ${c.ref}` : "", c.coef ? `coef ${c.coef}` : "",
    c.vent ? `🌬 ${c.vent.dir} ${c.vent.kmh} km/h${c.vent.raf != null ? ` (raf. ${c.vent.raf})` : ""}` : "",
    c.houle != null ? `🌊 ${fr(c.houle)} m` : "", c.pression ? `${c.pression} hPa ${tr}` : "",
    c.eau != null ? `eau ${fr(c.eau)} °C` : "", c.lumiere ? c.lumiere.toLowerCase() : "",
  ].filter(Boolean).join(" · ");
}
// v7 — RECALIBRAGE PAR RÉTRÉCISSEMENT.
// Trois sessions ne valent pas trente : le rapport observé/prédit est tiré vers
// 1 d'autant plus fort qu'il y a peu de sessions, comme si chaque spot partait
// de 5 sessions « neutres » (estimateur bayésien élémentaire). Le plafond de
// ±18 % reste une borne de sécurité.
export const CALIB = { minN: 3, prior: 5, max: 0.18 };
export function calibrate(entries) {
  const bySpot = {};
  for (const e of entries || []) {
    if (e?.predicted == null || e?.result == null) continue;
    (bySpot[e.spotId] ||= []).push(e);
  }
  const spotBias = {}, detail = {};
  for (const [id, list] of Object.entries(bySpot)) {
    const n = list.length;
    let obs = 0, pred = 0;
    for (const e of list) { obs += e.result; pred += e.predicted; }
    if (n < CALIB.minN || pred <= 0) { detail[id] = { n, raw: null, bias: null }; continue; }
    const raw = obs / pred;
    const shrunk = 1 + (raw - 1) * n / (n + CALIB.prior);
    spotBias[id] = Math.max(1 - CALIB.max, Math.min(1 + CALIB.max, shrunk));
    detail[id] = { n, raw, bias: spotBias[id] };
  }
  return { spotBias, detail, n: (entries || []).length, calibrated: Object.keys(spotBias).length };
}
/** Durée de session en heures (0,25 à 24), ou null. */
export function sessionDuration(e) {
  const v = parseFloat(String(e?.duree ?? "").replace(",", "."));
  return Number.isFinite(v) && v > 0 && v <= 24 ? v : null;
}
/**
 * v7 — Prises par spot. La note ressentie est subjective ; le nombre de bars
 * par heure de pêche (CPUE) ne l'est pas. Il n'est calculé que sur les
 * sessions dont la durée est connue.
 */
export function catchStats(entries) {
  const by = {};
  for (const e of entries || []) {
    if (!e?.spotId) continue;
    const s = (by[e.spotId] ||= { sessions: 0, fish: 0, timed: 0, hours: 0, fishTimed: 0, blank: 0 });
    s.sessions++;
    const f = Number.isFinite(+e.fish) && e.fish !== "" && e.fish != null ? +e.fish : null;
    if (f != null) { s.fish += f; if (f === 0) s.blank++; }
    const h = sessionDuration(e);
    if (h != null && f != null) { s.timed++; s.hours += h; s.fishTimed += f; }
  }
  for (const s of Object.values(by)) s.cpue = s.hours > 0 ? s.fishTimed / s.hours : null;
  return by;
}
