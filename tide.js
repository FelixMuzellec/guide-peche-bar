// Marée calculée localement (prédiction harmonique, ports secondaires, coefficient).
import { SITE } from "SITE_CONFIG";

// ═══════════════════════════════════════════════════════════════════
// v5 — MARÉE CALCULÉE LOCALEMENT
//
// Jusqu'en v4, heures, hauteurs et coefficients venaient d'une recherche web
// relancée à chaque ouverture : c'était la source directe des coefficients
// faux et d'une partie de l'instabilité des scores. Une marée ne se cherche
// pas, elle se calcule : prédiction harmonique locale, sans réseau, identique
// à chaque ouverture, valable pour n'importe quelle date.
//
// Validation (tables SHOM publiées, jamais utilisées pour l'ajustement) :
//   · Brest     : 591 PM/BM sur 5 mois — heure ±3,9 min en moyenne, hauteur ±4 cm
//   · Granville : ±4,4 min · Portbail ±5,1 · Diélette ±4,5 · Goury ±6,3 (mois de contrôle)
//   · Coefficient : à ±1 de l'annuaire dans 90 % des cas (max 3) sur 295 valeurs.
//     Limite physique : les constantes harmoniques du SHOM ne sont pas
//     publiques, et 1 point de coefficient ≈ 3 cm d'amplitude.
//   · Ce code reproduit Neaps à moins de 1 mm et 4 s près sur 2025-2036.
// ═══════════════════════════════════════════════════════════════════
/* TIDE_ENGINE_START */
export const TIDE_CONSTITUENTS = {
  "2MK5": [73.009277,[5,1,0,0,0,0,-1],[["M2",2,2],["K1",1,1]]],
  "2MO5": [71.911244,[5,-1,0,0,0,0,1],[["M2",2,2],["O1",1,1]]],
  "2MS6": [87.9682085,[6,2,-2,0,0,0,0],[["M2",2,2]]],
  "2N2": [27.8953548,[2,-2,0,2,0,0,0],[["M2",1,1]]],
  "2Q1": [12.8542862,[1,-3,0,2,0,0,1],[["O1",1,1]]],
  "2SM2": [31.0158958,[2,4,-4,0,0,0,0],[["M2",-1,1]]],
  "3L2": [29.5331208,[2,1,0,0,0,0,0],[["L2",1,1]]],
  "3N2": [29.0662415,[2,0,2,0,0,0,0],[["M2",1,1],["K2",1,1]]],
  "EP2": [27.4238338,[2,-3,2,1,0,0,0],[["M2",1,1]]],
  "J1": [15.5854433,[1,2,0,-1,0,0,-1],[["J1",1,1]]],
  "K1": [15.0410686,[1,1,0,0,0,0,-1],[["K1",1,1]]],
  "K2": [30.0821373,[2,2,0,0,0,0,0],[["K2",1,1]]],
  "L2": [29.5284789,[2,1,0,-1,0,0,-2],[["L2",1,1]]],
  "LAMBDA2": [29.4556253,[2,1,-2,1,0,0,-2],[["M2",1,1]]],
  "M1": [14.4966939,[1,0,0,1,0,0,-1],[["M1",1,1]]],
  "M2": [28.9841042,[2,0,0,0,0,0,0],[["M2",1,1]]],
  "M3": [43.4761564,[3,0,0,0,0,0,-2],[["M3",1,1]]],
  "M4": [57.9682085,[4,0,0,0,0,0,0],[["M2",2,2]]],
  "M6": [86.9523127,[6,0,0,0,0,0,0],[["M2",3,3]]],
  "M8": [115.936417,[8,0,0,0,0,0,0],[["M2",4,4]]],
  "MA2": [28.943036,[2,0,-1,0,0,0,0],[]],
  "MB2": [29.025173,[2,0,1,0,0,0,0],[]],
  "MF": [1.098033,[0,2,0,0,0,0,0],[["Mf",1,1]]],
  "MKS2": [29.0662415,[2,0,2,0,0,0,0],[["M2",1,1],["K2",1,1]]],
  "MM": [0.5443747,[0,1,0,-1,0,0,0],[["Mm",1,1]]],
  "MN4": [57.4238338,[4,-1,0,1,0,0,0],[["M2",2,2]]],
  "MS4": [58.9841042,[4,2,-2,0,0,0,0],[["M2",1,1]]],
  "MSF": [1.0158958,[0,2,-2,0,0,0,0],[["M2",-1,1]]],
  "MSQM": [2.1139287,[0,4,-2,0,0,0,0],[["M2",-1,1]]],
  "MTM": [1.6424078,[0,3,0,-1,0,0,0],[["Mm",1,1]]],
  "MU2": [27.9682085,[2,-2,2,0,0,0,0],[["M2",1,1]]],
  "N2": [28.4397295,[2,-1,0,1,0,0,0],[["M2",1,1]]],
  "N4": [56.8794591,[4,-2,0,2,0,0,0],[["M2",2,2]]],
  "NU2": [28.5125832,[2,-1,2,-1,0,0,0],[["M2",1,1]]],
  "O1": [13.9430356,[1,-1,0,0,0,0,1],[["O1",1,1]]],
  "OO1": [16.1391017,[1,3,0,0,0,0,-1],[["K2",1,1],["O1",-1,1]]],
  "P1": [14.9589314,[1,1,-2,0,0,0,1],[]],
  "Q1": [13.3986609,[1,-2,0,1,0,0,1],[["O1",1,1]]],
  "R2": [30.0410667,[2,2,-1,0,0,-1,-2],[]],
  "R3": [45.0410686,[3,3,-2,0,0,0,-1],[["K1",1,1]]],
  "RHO1": [13.4715145,[1,-2,2,-1,0,0,1],[["O1",1,1]]],
  "S1": [15,[1,1,-1,0,0,0,0],[]],
  "S2": [30,[2,2,-2,0,0,0,0],[]],
  "S3": [45,[3,3,-3,0,0,0,-2],[]],
  "S4": [60,[4,4,-4,0,0,0,0],[]],
  "SA": [0.0410686,[0,0,1,0,0,0,0],[]],
  "SGM": [12.9271398,[1,-3,2,0,0,0,1],[["O1",1,1]]],
  "SSA": [0.0821373,[0,0,2,0,0,0,0],[]],
  "T2": [29.9589333,[2,2,-3,0,0,1,0],[]],
  "T3": [44.9589333,[3,3,-4,0,0,0,0],[]],
};
export const TIDE_HARMONICS = {
  brest: { id: "ticon/brest-3-fra-refmar", name: "Brest", source: "TICON-4", epoch: {"start":"2006-03-31","end":"2025-03-31"},
    c: [["M2",2.0511,108.99],["N2",0.4169,90.62],["S2",0.7489,148.28],["K2",0.2137,145.89],["2N2",0.057,72.81],["S1",0.008,11.5],["K1",0.0643,75.09],["P1",0.0225,63.65],["O1",0.0658,327.89],["Q1",0.0205,281.35],["M1",0.0023,298.78],["M4",0.0545,105.9],["MM",0.0044,203.97],["MF",0.0103,177.58],["SA",0.0493,244.95],["SSA",0.0205,98.08],["T2",0.0417,138.56],["J1",0.0024,123.39],["L2",0.0639,102.92],["R2",0.0053,157.87],["2Q1",0.0038,234.46],["MSF",0.0033,27.14],["MSQM",0.0012,250.32],["EP2",0.0197,89.43],["M3",0.0198,15.86],["MU2",0.0857,105.07],["MTM",0.0011,135.12],["NU2",0.0778,86.6],["LAMBDA2",0.0263,75.82],["MN4",0.0194,60.44],["MS4",0.0327,181.75],["MKS2",0.0076,174.81],["N4",0.0029,9.56],["M6",0.0315,354.85],["M8",0.0023,232],["S4",0.0022,288.67],["OO1",0.0014,212.78],["S3",0.003,149.64],["MA2",0.011,39.45],["MB2",0.0124,101.15],["T3",0.0053,165.39],["R3",0.0056,342.19],["RHO1",0.0034,284.24],["SGM",0.0037,68.22],["3L2",0.0082,276.72],["3N2",0.0022,308.51],["2SM2",0.0173,312.05],["2MS6",0.0168,53.35],["2MK5",0.002,313.91],["2MO5",0.001,51.36]] },
  sthelier: { id: "ticon/st_helier_jersey-jer-gbr-bodc", name: "St Helier Jersey", source: "TICON-4", epoch: {"start":"2006-03-31","end":"2025-03-31"},
    c: [["M2",3.3418,182.08],["N2",0.6565,165.23],["S2",1.3037,231.79],["K2",0.3703,229.39],["2N2",0.0878,149.93],["S1",0.0067,60],["K1",0.0929,97.19],["P1",0.0329,89.9],["O1",0.08,346.45],["Q1",0.0233,304.26],["M1",0.0034,33.97],["M4",0.1917,300.61],["MM",0.0192,217.35],["MF",0.019,212.63],["SA",0.0659,222.44],["SSA",0.0277,117.04],["T2",0.0712,219.07],["J1",0.0048,178.4],["L2",0.145,161.7],["R2",0.014,259.74],["2Q1",0.004,259.95],["MSF",0.029,220.43],["MSQM",0.002,291.11],["EP2",0.0521,182.77],["M3",0.0257,174.73],["MU2",0.2224,197.39],["MTM",0.0045,222.45],["NU2",0.1139,149.43],["LAMBDA2",0.0784,144.8],["MN4",0.0701,277.51],["MS4",0.1468,356.72],["MKS2",0.0267,273.42],["N4",0.0138,257.43],["M6",0.0099,0.64],["M8",0.0015,144.52],["S4",0.0215,81.2],["OO1",0.0043,239.87],["S3",0.0022,338.54],["MA2",0.0251,109.23],["MB2",0.016,210.87],["T3",0.0067,344.49],["R3",0.01,189.86],["RHO1",0.0035,309.87],["SGM",0.0048,107.5],["3L2",0.0135,340.56],["3N2",0.0049,58.28],["2SM2",0.066,41.24],["2MS6",0.0082,49.36],["2MK5",0.0007,245.05],["2MO5",0.0003,284.32]] },
  dielette: { id: "ticon/dielette-628-fra-refmar", name: "Dielette", source: "TICON-4", epoch: {"start":"2007-10-26","end":"2025-03-31"},
    c: [["M2",2.904,193.72],["N2",0.5723,175.27],["S2",1.1279,241.19],["K2",0.3207,238.66],["2N2",0.0756,157.76],["S1",0.007,55.57],["K1",0.0928,100.47],["P1",0.0339,93.88],["O1",0.0766,349.89],["Q1",0.023,306.73],["M1",0.0018,227.34],["M4",0.1647,313.85],["MM",0.0151,244.92],["MF",0.0157,213.57],["SA",0.0613,224.88],["SSA",0.024,121.05],["T2",0.058,225.87],["J1",0.0041,177.03],["L2",0.1085,179.53],["R2",0.0124,280.68],["2Q1",0.0041,241.44],["MSF",0.013,225.95],["MSQM",0.0032,89.05],["EP2",0.0347,183.38],["M3",0.0193,184.67],["MU2",0.1607,199.36],["MTM",0.0017,324.14],["NU2",0.0998,164.86],["LAMBDA2",0.0536,160.03],["MN4",0.0602,289.11],["MS4",0.1125,2.53],["MKS2",0.0148,307.4],["N4",0.0119,266.98],["M6",0.0114,223.84],["M8",0.0052,5.46],["S4",0.0123,68.68],["OO1",0.0054,253.1],["S3",0.0013,355.9],["MA2",0.0306,135.45],["MB2",0.0038,303.04],["T3",0.0051,347.08],["R3",0.0068,199.62],["RHO1",0.0034,310.98],["SGM",0.0038,108.74],["3L2",0.0085,340.92],["3N2",0.0006,93.51],["2SM2",0.0484,55.19],["2MS6",0.0116,274.31],["2MK5",0,251.48],["2MO5",0.0004,336.95]] },
};
// ═══════════════════════════════════════════════════════════════════
// MARÉE CALCULÉE — prédiction harmonique locale, sans réseau
//
// Port fidèle du noyau de Neaps (@neaps/tide-predictor, licence MIT,
// © openwatersio) : astronomie de Meeus, corrections nodales IHO (Annexe A),
// recherche des extrêmes par racines de la dérivée. Constantes harmoniques
// TICON-4 (marégraphes REFMAR/UHSLC, licence CC BY 4.0, via
// @neaps/tide-database).
// ═══════════════════════════════════════════════════════════════════
export const TIDE_D2R = Math.PI / 180;
export function tideJD(ms) {
  const t = new Date(ms);
  let Y = t.getUTCFullYear(), M = t.getUTCMonth() + 1;
  const D = t.getUTCDate() + t.getUTCHours() / 24 + t.getUTCMinutes() / 1440
          + t.getUTCSeconds() / 86400 + t.getUTCMilliseconds() / 864e5;
  if (M <= 2) { Y -= 1; M += 12; }
  const A = Math.floor(Y / 100), B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (Y + 4716)) + Math.floor(30.6001 * (M + 1)) + D + B - 1524.5;
}
export const TIDE_POLY = {
  s:  [218.3164591, 481267.88134236, -0.0013268, 1 / 538841.0 - 1 / 65194000.0],
  h:  [280.46645, 36000.76983, 0.0003032],
  p:  [83.353243, 4069.0137111, -0.0103238, -1 / 80053.0, 1 / 18999000.0],
  N:  [125.044555, -1934.1361849, 0.0020762, 1 / 467410.0, -1 / 60616000.0],
  pp: [280.46645 - 357.5291, 36000.76932 - 35999.0503, 0.0003032 + 0.0001559, 0.00000048],
};
export function tideAstro(ms) {
  const jd = tideJD(ms), T = (jd - 2451545.0) / 36525;
  const a = {};
  for (const k in TIDE_POLY) {
    const v = TIDE_POLY[k].reduce((s, c, i) => s + c * Math.pow(T, i), 0);
    a[k] = ((v % 360) + 360) % 360;
  }
  a.tau = (jd - Math.floor(jd)) * 360 + a.h - a.s;   // T + h − s
  return a;
}
// Corrections nodales des fondamentaux (IHO TWCWG, Annexe A)
export function tideFundamentals(a) {
  const N = TIDE_D2R * a.N, p = TIDE_D2R * a.p, c = Math.cos, s = Math.sin;
  const sc = (fs, fc) => ({ f: Math.hypot(fs, fc), u: Math.atan2(fs, fc) / TIDE_D2R });
  const M2 = { f: 1.0007 - 0.0373 * c(N) + 0.0002 * c(2 * N), u: -2.14 * s(N) };
  return {
    Mm: { f: 1 - 0.1311 * c(N) + 0.0538 * c(2 * p) + 0.0205 * c(2 * p - N), u: 0 },
    Mf: { f: 1.084 + 0.415 * c(N) + 0.039 * c(2 * N), u: -23.7 * s(N) + 2.7 * s(2 * N) - 0.4 * s(3 * N) },
    O1: { f: 1.0176 + 0.1871 * c(N) - 0.0147 * c(2 * N), u: 10.8 * s(N) - 1.34 * s(2 * N) + 0.19 * s(3 * N) },
    K1: { f: 1.006 + 0.115 * c(N) - 0.0088 * c(2 * N) + 0.0006 * c(3 * N), u: -8.86 * s(N) + 0.68 * s(2 * N) - 0.07 * s(3 * N) },
    J1: { f: 1.1029 + 0.1676 * c(N) - 0.017 * c(2 * N) + 0.0016 * c(3 * N), u: -12.94 * s(N) + 1.34 * s(2 * N) - 0.19 * s(3 * N) },
    M1: sc(s(p) + 0.2 * s(p - N), 2 * (c(p) + 0.2 * c(p - N))),
    M2,
    K2: { f: 1.0246 + 0.2863 * c(N) + 0.0083 * c(2 * N) - 0.0015 * c(3 * N), u: -17.74 * s(N) + 0.68 * s(2 * N) - 0.04 * s(3 * N) },
    M3: { f: Math.pow(Math.sqrt(M2.f), 3), u: -3.21 * s(N) },
    L2: sc(-0.2505 * s(2 * p) - 0.1102 * s(2 * p - N) - 0.0156 * s(2 * p - 2 * N) - 0.037 * s(N),
           1 - 0.2505 * c(2 * p) - 0.1102 * c(2 * p - N) - 0.0156 * c(2 * p - 2 * N) - 0.037 * c(N)),
  };
}
/** Paramètres effectifs {A, w, phi} de chaque constituant pour une date de référence. */
export function tideParams(station, refMs) {
  const a = tideAstro(refMs), F = tideFundamentals(a);
  const args = [a.tau, a.s, a.h, a.p, -a.N, a.pp, 90];
  const out = [];
  for (const [name, amp, phase] of station.c) {
    const k = TIDE_CONSTITUENTS[name];
    if (!k || !amp) continue;
    const [speed, d, recipe] = k;
    let v0 = 0;
    for (let i = 0; i < 7; i++) v0 += d[i] * args[i];
    let f = 1, u = 0;
    for (const [fund, uf, fe] of recipe) { f *= Math.pow(F[fund].f, fe); u += uf * F[fund].u; }
    out.push({ name, A: amp * f, w: speed * TIDE_D2R, phi: TIDE_D2R * (v0 + u - phase), sp: d[0] });
  }
  return out;
}
/** Prédicteur pour une station : niveau à un instant, extrêmes sur un intervalle. */
export function makeTidePredictor(station) {
  const cache = new Map();
  // Corrections nodales recalculées par tranche de 24 h (variation < 0,01 %/jour),
  // à midi UTC, comme le fait Neaps.
  const paramsFor = (ms) => {
    const day = Math.floor(ms / 864e5);
    if (!cache.has(day)) {
      const ref = day * 864e5 + 432e5;
      cache.set(day, { ref, p: tideParams(station, ref) });
      if (cache.size > 64) cache.delete(cache.keys().next().value);
    }
    return cache.get(day);
  };
  const h = (ms) => { const { ref, p } = paramsFor(ms); const t = (ms - ref) / 36e5;
    let s = 0; for (const q of p) s += q.A * Math.cos(q.w * t + q.phi); return s; };
  const dh = (ms) => { const { ref, p } = paramsFor(ms); const t = (ms - ref) / 36e5;
    let s = 0; for (const q of p) s -= q.A * q.w * Math.sin(q.w * t + q.phi); return s; };
  const d2h = (ms) => { const { ref, p } = paramsFor(ms); const t = (ms - ref) / 36e5;
    let s = 0; for (const q of p) s -= q.A * q.w * q.w * Math.cos(q.w * t + q.phi); return s; };

  function extremes(ms0, ms1) {
    const p0 = paramsFor(ms0).p;
    const maxW = Math.max(...p0.map(q => q.w));
    let domA = 0, domW = 0;
    for (const q of p0) if (q.w >= Math.PI / 15 && q.w <= 2 * Math.PI && q.A > domA) { domA = q.A; domW = q.w; }
    const amp = (n) => (station.c.find(c => c[0] === n) || [0, 0])[1];
    const isDouble = amp("M2") > 0 && (amp("M4") + amp("MS4")) / amp("M2") > 0.25;
    const minGapH = isDouble ? 0 : Math.PI / (1.85 * (domW || maxW));
    const step = (Math.PI / (2 * maxW)) * 36e5;
    const res = [];
    let tP = ms0, dP = dh(tP);
    for (let tN = tP + step; tN <= ms1 + step; tN += step) {
      const tB = Math.min(tN, ms1), dN = dh(tB);
      if (dP !== 0 && dN !== 0 && (dP > 0) !== (dN > 0)) {
        let a = tP, b = tB, fa = dP;
        while (b - a > 1000) {                     // bissection à la seconde
          const m = (a + b) / 2, fm = dh(m);
          if (fm === 0) { a = b = m; break; }
          if ((fa > 0) === (fm > 0)) { a = m; fa = fm; } else b = m;
        }
        const t = (a + b) / 2;
        if (t >= ms0 && t <= ms1) res.push({ t, h: h(t), high: d2h(t) < 0 });
      }
      if (tB >= ms1) break;
      tP = tB; dP = dN;
    }
    // Filtrage des extrêmes parasites (proéminence < 1 cm ou trop rapprochés)
    const n = res.length;
    if (n > 2) {
      const prv = Array.from({ length: n }, (_, i) => i - 1), nxt = Array.from({ length: n }, (_, i) => i + 1);
      const evalP = (i) => {
        const p = prv[i], x = nxt[i];
        if (p < 0 || x >= n) return { prom: Infinity, bad: false };
        const prom = Math.min(Math.abs(res[i].h - res[p].h), Math.abs(res[x].h - res[i].h));
        const gp = (res[i].t - res[p].t) / 36e5, gn = (res[x].t - res[i].t) / 36e5;
        const close = minGapH > 0 && ((gp < minGapH && res[i].high === res[p].high) || (gn < minGapH && res[i].high === res[x].high));
        return { prom, bad: prom < 0.01 || close };
      };
      for (;;) {
        let wi = -1, wp = Infinity;
        for (let i = nxt[0]; i < n && nxt[i] < n; i = nxt[i]) { const e = evalP(i); if (e.bad && e.prom < wp) { wp = e.prom; wi = i; } }
        if (wi < 0) break;
        const p = prv[wi], x = nxt[wi]; nxt[p] = x; prv[x] = p;
      }
      const out = []; for (let i = 0; i < n; i = nxt[i]) out.push(res[i]);
      return out;
    }
    return res;
  }

  /** Amplitude de la seule marée semi-diurne à un instant (base du coefficient). */
  function semidiurnalAmplitude(ms, names) {
    const { ref, p } = paramsFor(ms); const t = (ms - ref) / 36e5;
    let re = 0, im = 0;
    for (const q of p) {
      if (q.sp !== 2 || (names && !names.includes(q.name))) continue;
      const ph = q.w * t + q.phi; re += q.A * Math.cos(ph); im += q.A * Math.sin(ph);
    }
    return Math.hypot(re, im);
  }

  return { level: h, extremes, semidiurnalAmplitude, params: (ms) => paramsFor(ms).p };
}
// ── Heure légale de Paris (indépendante du fuseau de l'appareil) ──────
export const PARIS_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
export function parisParts(ms) {
  const p = {};
  for (const x of PARIS_FMT.formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: (+p.hour) % 24, mi: +p.minute, ss: +p.second };
}
/** Heure murale (décimale) d'un instant, relative à minuit du jour `dateISO` à Paris. */
export function localDecimal(ms, dateISO) {
  const p = parisParts(ms), [y, m, d] = dateISO.split("-").map(Number);
  const dayDiff = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(y, m - 1, d)) / 864e5);
  return dayDiff * 24 + p.hh + p.mi / 60 + p.ss / 3600;
}
/** Instant correspondant à une heure murale décimale du jour `dateISO` à Paris. */
export function msAtLocal(dateISO, dec) {
  const [y, m, d] = dateISO.split("-").map(Number);
  let ms = Date.UTC(y, m - 1, d) + dec * 36e5 - 2 * 36e5;
  for (let i = 0; i < 3; i++) ms -= (localDecimal(ms, dateISO) - dec) * 36e5;
  return ms;
}
// ── Coefficient de marée ─────────────────────────────────────────────
// Le coefficient est national : calculé pour Brest par le SHOM, valable de
// Dunkerque à la frontière espagnole. Il découle de la seule marée
// semi-diurne astronomique à Brest, rapportée à l'unité de hauteur.
export const TIDE_COEF = { station: "brest", U: 3.0871,
  waves: ["M2","S2","N2","K2","2N2","MU2","NU2","L2","T2","R2","LAMBDA2","EP2"] };
export const TIDE_PRED_CACHE = {};
export const tidePred = (key) => (TIDE_PRED_CACHE[key] ??= makeTidePredictor(TIDE_HARMONICS[key]));
export function brestPMs(ms0, ms1) {
  return tidePred(TIDE_COEF.station).extremes(ms0, ms1).filter(x => x.high).map(x => ({
    t: x.t,
    coef: Math.max(20, Math.min(120, Math.round(tidePred(TIDE_COEF.station).semidiurnalAmplitude(x.t, TIDE_COEF.waves) * 100 / TIDE_COEF.U))),
  }));
}
// ── Extrêmes d'un port, selon sa méthode ─────────────────────────────
//   harmonic  : prédiction directe + zéro hydrographique
//   secondary : extrêmes d'une station de référence + correction ajustée
//               sur les tables SHOM (heure fonction du marnage, hauteur linéaire)
//   interp    : interpolation entre deux ports voisins (heures fiables,
//               hauteurs approximatives — le marnage n'y est pas linéaire)
export function portExtremes(key, ms0, ms1) {
  const P = SITE.tide.ports[key];
  if (!P) throw new Error(`Port de marée inconnu : ${key}`);
  if (P.kind === "harmonic")
    return tidePred(P.station).extremes(ms0, ms1).map(x => ({ high: x.high, t: x.t, h: x.h + P.z0 }));
  if (P.kind === "secondary") {
    const ex = tidePred(P.ref).extremes(ms0 - 864e5, ms1 + 864e5);
    return ex.map((x, i) => {
      const nb = [ex[i - 1], ex[i + 1]].filter(Boolean);
      const range = Math.abs(x.h - nb.reduce((s, y) => s + y.h, 0) / nb.length);
      const M = x.high ? P.hw : P.lw;
      return { high: x.high, t: x.t + (M.t[0] + M.t[1] * range) * 6e4, h: M.h[0] + M.h[1] * x.h };
    }).filter(e => e.t >= ms0 && e.t <= ms1);
  }
  if (P.kind === "interp") {
    const A = portExtremes(P.a, ms0 - 6 * 36e5, ms1 + 6 * 36e5), B = portExtremes(P.b, ms0 - 6 * 36e5, ms1 + 6 * 36e5);
    const out = [];
    for (const a of A) {
      let b = null, bd = Infinity;
      for (const x of B) if (x.high === a.high) { const d = Math.abs(x.t - a.t); if (d < bd) { bd = d; b = x; } }
      if (b && bd < 3 * 36e5) out.push({ high: a.high, t: a.t + P.w * (b.t - a.t), h: a.h + P.w * (b.h - a.h) });
    }
    return out.filter(e => e.t >= ms0 && e.t <= ms1);
  }
  throw new Error(`Méthode de marée inconnue : ${P.kind}`);
}
export function portLag(key) {
  const P = SITE.tide.ports[key];
  if (P.kind === "interp") return portLag(P.a) + P.w * (portLag(P.b) - portLag(P.a));
  return P.lagH || 0;
}
/**
 * Marée d'une journée en un port : extrêmes (avec coefficients), courbe, coefficients du jour.
 * `coefOverride` : [{ t: instant PM de Brest, value }] — coefficients officiels acceptés.
 * Rapprochement par proximité (±30 min) : deux recherches d'extrêmes lancées sur
 * des fenêtres différentes trouvent le même instant à quelques millisecondes près,
 * jamais à l'identique — une clé exacte ne correspondrait jamais.
 */
export function tideDay(dateISO, key, coefOverride) {
  const m0 = msAtLocal(dateISO, 0), m1 = msAtLocal(dateISO, 24);
  const raw = portExtremes(key, m0 - 10 * 36e5, m1 + 10 * 36e5);
  const lag = portLag(key) * 36e5;
  // Les PM de Brest doivent couvrir tous les extrêmes calculés (±10 h autour
  // de la journée) décalés du retard du port : marge large des deux côtés.
  const bpm = brestPMs(m0 - 20 * 36e5, m1 + 16 * 36e5);
  const coefFor = (t) => {
    let best = null, bd = Infinity;
    for (const b of bpm) { const d = Math.abs(t - lag - b.t); if (d < bd) { bd = d; best = b; } }
    if (!best || bd > 5 * 36e5) return { coef: null, brestT: null };
    const ov = (coefOverride || []).find(o => Math.abs(o.t - best.t) < 30 * 6e4)?.value;
    return { coef: ov ?? best.coef, computed: best.coef, official: ov ?? null, brestT: best.t };
  };
  const events = raw.map(x => ({
    type: x.high ? "PM" : "BM", ms: x.t, dec: localDecimal(x.t, dateISO), h: +x.h.toFixed(2),
    ...(x.high ? coefFor(x.t) : {}),
  }));
  // Une BM porte le coefficient de la PM la plus proche (même cycle de marée)
  for (const e of events) if (e.type === "BM") {
    let near = null, bd = Infinity;
    for (const p of events) if (p.type === "PM") { const d = Math.abs(p.ms - e.ms); if (d < bd) { bd = d; near = p; } }
    e.coef = near?.coef ?? null;
  }
  const dayEvents = events.filter(e => e.dec >= 0 && e.dec < 24);
  // Courbe : prédiction directe si le port est harmonique, sinon demi-cosinus entre extrêmes
  const P = SITE.tide.ports[key];
  const curve = [];
  for (let hr = 0; hr <= 24.001; hr += 0.25) {
    const ms = msAtLocal(dateISO, hr);
    let v = null;
    if (P.kind === "harmonic") v = tidePred(P.station).level(ms) + P.z0;
    else {
      for (let i = 0; i < events.length - 1; i++) if (events[i].ms <= ms && events[i + 1].ms >= ms) {
        const f = (ms - events[i].ms) / (events[i + 1].ms - events[i].ms);
        v = events[i].h + (events[i + 1].h - events[i].h) * (1 - Math.cos(f * Math.PI)) / 2; break;
      }
    }
    if (v != null) curve.push({ hour: hr, height: Math.max(0, v) });
  }
  const pms = dayEvents.filter(e => e.type === "PM");
  const bms = dayEvents.filter(e => e.type === "BM");
  return {
    port: key, label: P.label, method: P.kind, accuracy: P.accuracy,
    events, dayEvents, curve,
    coefs: pms.map(e => e.coef).filter(c => c != null),
    maxCoef: pms.length ? Math.max(...pms.map(e => e.coef ?? 0)) : null,
    marnage: pms.length && bms.length ? +(Math.max(...pms.map(e => e.h)) - Math.min(...bms.map(e => e.h))).toFixed(1) : null,
  };
}
/** PM de Brest du jour (heure de Paris), pour rapprocher les coefficients officiels. */
export function brestDayPMs(dateISO) {
  const m0 = msAtLocal(dateISO, 0), m1 = msAtLocal(dateISO, 24);
  return brestPMs(m0, m1);
}
/**
 * Accepte les coefficients officiels renvoyés par la recherche web seulement
 * s'ils concordent avec le calcul (±2). Au-delà, c'est presque toujours le
 * mauvais jour ou le mauvais port : la valeur est écartée et signalée.
 */
export function reconcileCoefs(dateISO, official) {
  const pms = brestDayPMs(dateISO);
  const res = { override: [], accepted: [], rejected: [], computed: pms.map(p => p.coef) };
  if (!Array.isArray(official) || !official.length) return res;
  const vals = official.map(v => parseInt(v, 10)).filter(v => v >= 20 && v <= 120);
  if (vals.length !== pms.length) { res.rejected.push({ reason: `${vals.length} coefficient(s) renvoyé(s) pour ${pms.length} pleine(s) mer à Brest ce jour-là`, vals }); return res; }
  pms.forEach((p, i) => {
    if (Math.abs(vals[i] - p.coef) <= 2) { res.override.push({ t: p.t, value: vals[i] }); res.accepted.push({ official: vals[i], computed: p.coef }); }
    else res.rejected.push({ reason: `coefficient ${vals[i]} renvoyé contre ${p.coef} calculé`, vals: [vals[i]] });
  });
  return res;
}
