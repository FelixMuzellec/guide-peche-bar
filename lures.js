// Conseil leurres : quel type, quelle couche, quelle taille, quelle couleur,
// quel poids et quelle animation, pour CE spot à CE créneau.
//
// Chaque règle porte sa source. Le moteur ne fait que les croiser avec la
// situation du créneau (lumière, mer, clarté de l'eau, courant, fond, proie
// du mois, température) ; l'ordre de préférence entre familles qui en sort
// est une déduction, et l'interface le dit.
import { SITE } from "SITE_CONFIG";
import { preyForMonth, regimeOf, seasonPresence, terrainOf } from "./model.js";

export const LURE_SOURCES = {
  couleurMeteo: { short: "peche.com, 2026", label: "peche.com — Quelle couleur choisir selon l'eau et la météo ? (L. Duclos, 03/06/2026)",
    url: "https://www.peche.com/article/52017/peche-aux-leurres-quelle-couleur-choisir-selon-l-eau-et-la-meteo" },
  couleurDebut: { short: "peche.com, 2025", label: "peche.com — Début de saison : la bonne couleur de leurre souple (F. Tynilla, 27/03/2025)",
    url: "https://www.peche.com/article/48479/peche-au-bar-en-debut-de-saison-choisir-la-bonne-couleur-de-leurre-souple" },
  coloris: { short: "peche.com, 2024", label: "peche.com — Mes coloris favoris de leurres souples pour le bar en mer (B. Le Provost, 13/12/2024)",
    url: "https://www.peche.com/article/47815/mes-coloris-favoris-de-leurres-souples-pour-la-peche-du-bar-en-mer" },
  nuit: { short: "peche.com, 2026", label: "peche.com — 5 leurres souples pour pêcher le bar de nuit en été (Y. Nabusset, 16/06/2026)",
    url: "https://www.peche.com/article/49585/5-leurres-souples-pour-pecher-le-bar-de-nuit-en-ete" },
  stickbait: { short: "peche.com, 2026", label: "peche.com — Le stickbait, un leurre qui fait fondre les bars en surface (G. Fourrier, 21/08/2026)",
    url: "https://www.peche.com/article/47337/stickbait-le-leurre-qui-fait-fondre-les-bars-en-surface" },
  vagues: { short: "peche.com, 2021", label: "peche.com — La pêche du bar dans les vagues (11/06/2021)",
    url: "https://www.peche.com/article/37249/la-peche-du-bar-dans-les-vagues-des-conditions-difficiles-souvent-payantes" },
  merConseils: { short: "peche.com, 2026", label: "peche.com — Pêche aux leurres en mer : les conseils essentiels (L. Duclos, 29/07/2026)",
    url: "https://www.peche.com/article/52087/peche-aux-leurres-en-mer-les-conseils-essentiels-pour-bien-debuter" },
  automne: { short: "peche.com, 2026", label: "peche.com — Pêcher le bar du bord en automne (B. Le Provost, 16/09/2026)",
    url: "https://www.peche.com/article/46921/comment-cibler-les-bars-du-bord-en-automne" },
  saisons: { short: "peche.com, 2024", label: "peche.com — La pêche du bar en fonction des saisons (T. Cendrier, 08/10/2024)",
    url: "https://www.peche.com/article/32987/la-peche-du-bar-en-fonction-des-saisons" },
  ouverture: { short: "Figaro Nautisme, 2026", label: "Le Figaro Nautisme — Pêche au bar à l'ouverture : bien choisir ses leurres souples (23/02/2026)",
    url: "https://figaronautisme.meteoconsult.fr/actus-nautisme-loisirs/2026-02-23/85977-peche-au-bar-a-louverture-bien-choisir-ses-leurres-souples-pour-demarrer-la-saison" },
  ifremer: { short: "Ifremer", label: "Ifremer — synthèse des marquages de bars adultes (programme Bargip)",
    url: "https://bar.ifremer.fr/content/download/116111/file/4PagesMarquageAdultes_Final-3.pdf" },
  rade: { short: "brestfishing, Desperadiens", label: "peche.com (Nicolas, brestfishing) et Relec29-Desperadiens — eaux claires de la rade de Brest", url: null },
  felix: { short: "tes notes", label: "Tes notes : coloris Asturie et sessions de ton journal", url: null },
  fiche: { short: "fiche du spot", label: "Fiche terrain du spot", url: null },
  deduit: { short: "déduit", label: "Déduit (seuil ou raisonnement du guide, pas d'une source)", url: null },
};

export const FAMILLES = {
  surface:    { label: "Surface : stickbait, pencil", court: "Stickbait", couche: "surface" },
  nageur:     { label: "Poisson nageur : minnow, jerkbait, coulant", court: "Poisson nageur", couche: "sous-surface" },
  weightless: { label: "Souple non plombé ou monté texan", court: "Souple weightless / texan", couche: "sous-surface" },
  shad:       { label: "Souple plombé : shad, slug", court: "Souple plombé", couche: "mi-eau à fond" },
  metal:      { label: "Métal : jig, cuiller, casting jig", court: "Métal", couche: "mi-eau" },
};

/** Famille d'un leurre de fiche, d'après son nom et sa technique. */
export function familyOf(l) {
  const n = `${l?.name || ""} ${l?.technique || ""}`.toLowerCase();
  if (/black minnow|sand eel|paddle tail|nitro shad/.test(n)) return "shad";
  if (/weightless|texan|sans plomb|non lesté|weedless/.test(n)) return "weightless";
  if (/sinking|coulant/.test(n) && /pencil|stickbait|asturie/.test(n)) return "nageur";
  if (/stickbait|pencil|popper|surface|walk/.test(n)) return "surface";
  if (/minnow|jerkbait|poisson nageur|long bill|plongeant|bavette|nageur/.test(n)) return "nageur";
  if (/\bjig\b|cuiller|métal|metal|casting/.test(n) && !/souple|shad|slug/.test(n)) return "metal";
  if (/shad|souple|slug|pintail|tête|leurre \d/.test(n)) return "shad";
  return "shad";
}

// ── Ta boîte, telle que tu l'as décrite (10/10/2026) ──────────────────
// « tons » : naturel, blanc, transition (meilleur aux changements de lumière),
// soleil (exige plein soleil et eau claire). Une copie AliExpress est signalée.
export const BOITE = [
  { model: "Xorus Asturie 130", color: "Ghost Iwashi", fam: "surface", tons: ["naturel", "soleil"], note: "Exige plein soleil et eau claire (tes notes)." },
  { model: "Xorus Asturie 130", color: "Blanc", fam: "surface", tons: ["blanc"], note: "2 bars à Moulin Mer le 27/12/2025, avant le coucher (avec l'Asturie 110 Cabot)." },
  { model: "Xorus Asturie 130", color: "Cabot", fam: "surface", tons: ["transition"], note: "Meilleur aux changements de lumière (tes notes)." },
  { model: "Xorus Asturie 130", color: "Anchois", fam: "surface", tons: ["naturel"] },
  { model: "Xorus Asturie 110", color: "Cabot", fam: "surface", tons: ["transition"], note: "Meilleur aux changements de lumière (tes notes)." },
  { model: "Xorus Asturie 110", color: "Mackerel", fam: "surface", tons: ["naturel"] },
  { model: "Xorus Patchinko 165", color: "Ayu 2", fam: "surface", tons: ["naturel"], note: "Grand profil (165 mm)." },
  { model: "Patchinko 140 (copie Leydun)", color: "—", fam: "surface", tons: [] },
  { model: "Xorus Z Claw Evo 10 cm", color: "Blanc nacré", fam: "surface", tons: ["blanc"], note: "1 bar à Moulin Mer le 08/08/2026, au coucher du soleil." },
  { model: "Z Claw 10 cm (copie Leydun)", color: "—", fam: "surface", tons: [] },
  { model: "Rafale JT", color: "—", fam: "nageur", tons: [], note: "Poisson nageur articulé." },
  { model: "Souples divers", color: "—", fam: "shad", tons: [] },
];
export const ASTURIE_ANIM = { t: "Asturie : récupération rapide et erratique, scion haut, à-coups irréguliers (pas un walking the dog pur).", s: "felix" };

const r = (t, s) => ({ t, s });
const SEA_LABEL = { calme: "mer calme", "peu agitée": "mer peu agitée", "agitée": "mer agitée", clapot: "clapot de vent", "abritée": "mer formée au large, amortie ici" };
// Spots de rivière, d'estuaire ou de havre : c'est là qu'une forte pluie trouble l'eau.
const RIVER_RE = /ESTUAIRE|HAVRE|\bRIA\b|EMBOUCHURE|RIVI[ÈE]RE|CONFLUENCE|AULNE|SIENNE/i;
// Ordre de départage fixe, après le score et la fiche du spot.
const FAM_ORDER = ["shad", "weightless", "surface", "nageur", "metal"];

/** Situation d'un créneau, vue du pêcheur aux leurres. */
export function lureSituation(spot, w, live, dateISO) {
  const month = +String(dateISO).slice(5, 7);
  const regime = regimeOf(spot);
  const zone = SITE.zones?.[spot.zone] || {};
  const rade = zone.sea === "rade";
  const zw = w?.zw || spot.zw || null;
  const band = w?.light?.band || "inconnu";
  const cloud = zw?.cloud ?? null;
  const light = band === "nuit" ? "nuit" : band === "aube" || band === "crepuscule" ? "basse"
    : cloud != null && cloud >= 75 ? "couvert" : cloud != null && cloud <= 25 ? "soleil" : "jour";
  const coeff = w?.coeff ?? null;

  // État de la mer : houle sur la côte ouverte, vent sur le plan d'eau abrité.
  // En rade, le vent fort lève un clapot court : ce n'est pas la mer qui
  // déferle sur une côte rocheuse ouverte, seule situation décrite par la
  // source « vagues ». Les deux ne reçoivent donc pas le même conseil.
  let sea = null, seaWhy = "";
  if (rade) {
    const f = zw?.wind_force;
    if (f != null) { sea = f <= 2 ? "calme" : f <= 4 ? "peu agitée" : "clapot"; seaWhy = `vent F${f} sur un plan d'eau abrité`; }
  } else if (zw?.houleKnown) {
    const h = zw.houle;
    sea = h < 0.5 ? "calme" : h < 1.2 ? "peu agitée" : "agitée"; seaWhy = `houle ${String(h).replace(".", ",")} m`;
    // Havre ou estuaire de la côte ouverte : la houle du large y arrive amortie.
    if (sea === "agitée" && regime === "abri") { sea = "abritée"; seaWhy = `houle ${String(h).replace(".", ",")} m au large`; }
  }

  // Clarté de l'eau : jamais mesurée ; estimée et signalée comme telle.
  let clarity = rade ? "claire" : "normale";
  const clarityWhy = [];
  if (rade) clarityWhy.push(r("Eau habituellement claire en rade de Brest.", "rade"));
  else clarityWhy.push(r("Clarté non mesurée sur cette côte : supposée normale.", "deduit"));
  const rain = zw?.rain36;
  if (rain != null && rain >= 15 && (spot.riviere || RIVER_RE.test(`${spot.type || ""} ${spot.subtitle || ""}`))) {
    clarity = "teintée"; clarityWhy.push(r(`${String(rain).replace(".", ",")} mm de pluie en 36 h : eau probablement teintée près des rivières.`, "deduit"));
  }
  if (!rade && zw?.houleKnown && zw.houle >= 1.5) { clarity = "chargée"; clarityWhy.push(r("Houle d'au moins 1,5 m : eau remuée, probablement chargée.", "deduit")); }
  if (coeff != null && coeff >= 95 && clarity === (rade ? "claire" : "normale") && regime !== "roche") {
    clarity = "teintée"; clarityWhy.push(r(`Coefficient ${coeff} : les gros coefficients peuvent troubler l'eau (seuil 95 et effet supposés, aucune source relue ne le chiffre).`, "deduit"));
  }

  // Courant fort : spot de courant par nature (type de la fiche), ou seuil de
  // coefficient porté par la fiche avec sa source (spot.courantFort).
  const staticCurrent = /COURANT|GOULET|RAZ/i.test(`${spot.type} ${spot.subtitle}`);
  const cf = spot.courantFort;
  const coefCurrent = !!cf && coeff != null && coeff > cf.above;
  const strongCurrent = staticCurrent || coefCurrent;
  const currentWhy = staticCurrent ? r(`Spot de courant (${String(spot.type).toLowerCase()}).`, "fiche")
    : coefCurrent ? r(`Coefficient ${coeff} > ${cf.above} : ${cf.t}`, "fiche") : null;

  const terr = terrainOf(spot);
  const prey = preyForMonth(month);
  const sst = live?.sst != null && Number.isFinite(+live.sst) ? +live.sst : null;
  const cold = (sst != null && sst < 12) || month === 3 || month === 4;
  // Familles citées par la fiche du spot : elles départagent les égalités.
  const ficheFam = {};
  for (const l of spot.lures || []) { const k = familyOf(l); ficheFam[k] = (ficheFam[k] || 0) + 1; }
  return { month, regime, rade, light, band, cloud, sea, seaLabel: SEA_LABEL[sea] || null, seaWhy, clarity, clarityWhy, strongCurrent, currentWhy, ficheFam, coeff, terr, prey, sst, cold,
           season: seasonPresence(month, regime), windF: zw?.wind_force ?? null, houle: zw?.houleKnown ? zw.houle : null };
}

/** Couleurs : catégorie dominante, palette, raisons sourcées. */
export function colorAdvice(sit) {
  const why = [];
  let cat, palette;
  if (sit.light === "nuit") {
    cat = "blanc"; palette = ["blanc", "bone", "sardine"];
    why.push(r("De nuit, « le coloris blanc se distingue largement ».", "nuit"));
  } else if (sit.clarity === "chargée" || sit.clarity === "teintée") {
    cat = "visible"; palette = ["blanc", "chartreuse", "jaune", "orange", "rose"];
    why.push(r("Eau teintée ou chargée : des coloris qui ressortent nettement (blanc, chartreuse, jaune, orange, rose).", "couleurMeteo"));
    if (sit.sea === "agitée") why.push(r("Rose quand l'eau est chargée et agitée.", "coloris"));
    why.push(r("« Temps sombre, leurre sombre » : un coloris sombre reste visible en eau trouble.", "couleurDebut"));
  } else if (sit.light === "basse") {
    cat = "contraste"; palette = ["blanc", "coloris contrastés", "tons chauds"];
    why.push(r("Aube et crépuscule : coloris contrastés ou chauds, qui restent visibles en lumière douce.", "couleurMeteo"));
    why.push(r("Blanc, efficace en eau claire par faible luminosité, le soir ou le matin.", "coloris"));
    why.push(r("Cabot : meilleur aux changements de lumière.", "felix"));
  } else if (sit.light === "couvert") {
    cat = "visible"; palette = ["blanc", "coloris vifs", "sombre"];
    why.push(r("Ciel couvert : les teintes plus vives deviennent plus lisibles pour le poisson.", "couleurMeteo"));
    why.push(r("« Temps sombre, leurre sombre ».", "couleurDebut"));
  } else if (sit.light === "soleil" && sit.clarity === "claire") {
    cat = "naturel"; palette = ["naturel", "translucide", "légèrement pailleté", "bleu sardine", "gris", "vert ayu"];
    why.push(r("Eau claire et plein soleil : naturel, translucide ou légèrement pailleté.", "couleurMeteo"));
    why.push(r("Bleu sardine, blanc, gris ou vert ayu, surtout en eau claire.", "couleurDebut"));
    why.push(r("Ghost Iwashi : réservé au plein soleil en eau claire.", "felix"));
  } else {
    cat = "naturel"; palette = ["naturel", "imitation de la proie du moment"];
    why.push(r("Eau claire : un leurre imitatif, proche des proies locales, inspire davantage confiance.", "couleurMeteo"));
  }
  // La proie du moment affine la couleur.
  const p = sit.prey?.[0]?.name || "";
  if (/lançon|équille/i.test(p)) why.push(r("Sur les zones à lançon : vert ou kaki (Crazy Sand Eel, Crazy Paddle Tail) ; un leurre blanc peut aussi imiter un lançon.", "coloris"));
  else if (/sprat/i.test(p)) why.push(r(sit.light === "soleil" ? "Sprats et soleil : Blue Herring (Nitro Shad)." : "Petits poissons : souple argenté ou bleuté.", sit.light === "soleil" ? "coloris" : "couleurDebut"));
  else if (/sardine|maquereau/i.test(p)) why.push(r("Sardine, maquereau ou sprat : vert.", "coloris"));
  else if (/crabe|crevette|crustac/i.test(p) && (sit.month <= 5)) why.push(r("Début de saison, bars sur les crustacés : marron.", "coloris"));
  if (sit.clarity === "claire") why.push(r("Eau claire : éviter les leurres trop gros ou trop voyants.", "merConseils"));
  const label = { blanc: "Blanc", visible: "Visible : blanc ou vif", contraste: "Contrastée : blanc, Cabot ou tons chauds", naturel: "Naturelle, proche de la proie" }[cat];
  return { cat, label, palette, why };
}

/** Familles de leurres classées pour la situation. */
export function familyRanking(sit) {
  const sc = { surface: 0, nageur: 0, weightless: 0, shad: 0, metal: 0 };
  const why = { surface: [], nageur: [], weightless: [], shad: [], metal: [] };
  const add = (k, v, t, s) => { sc[k] += v; why[k].push({ t, s, v }); };
  if (sit.sea === "calme" || sit.sea === "peu agitée") {
    add("surface", 2, "Mer belle à peu agitée : la surface travaille bien.", "stickbait");
  }
  if (sit.sea === "clapot") {
    add("surface", -2, "Stickbait : préférer une mer belle à peu agitée.", "stickbait");
    add("weightless", -1, "Vent fort : un souple non plombé se lance mal et se contrôle mal ; un texan légèrement plombé tient mieux.", "deduit");
  }
  if (sit.sea === "agitée") {
    add("shad", 2, "Dans les vagues : shad à palette de 120 à 140 mm sur tête de 18 à 25 g, récupération linéaire canne basse.", "vagues");
    add("metal", 1, "Jigs et cuillers métalliques : parfaits pour la pêche dans les vagues.", "merConseils");
    add("surface", -2, "Stickbait : préférer une mer belle à peu agitée.", "stickbait");
  }
  if (sit.light === "basse") add("surface", 1.5, "Aube et crépuscule : moment idéal pour la surface.", "merConseils");
  if (sit.light === "nuit") {
    add("shad", 2, "Nuit : petits souples de 85 à 100 mm sur têtes de 5 à 10 g, en zones peu profondes.", "nuit");
    add("surface", -1, "De nuit, la seule source citée ne propose que des souples ; la surface n'y figure pas, sans y être déconseillée.", "deduit");
  }
  if (sit.light === "soleil" && sit.rade) add("weightless", 1, "Eaux claires de la rade : leurres petits et discrets, approche silencieuse.", "rade");
  if (sit.strongCurrent) {
    add("nageur", 1, "Courant fort ou zone profonde : leurres coulants (jerkbaits, casting jigs).", "merConseils");
    add("metal", 1, "Courant fort : casting jig.", "merConseils");
    add("shad", 1, "Courant : tête plus lourde ; trop léger, le leurre dérive sans précision.", "ouverture");
  }
  const t = sit.terr;
  const rough = sit.strongCurrent || sit.sea === "agitée";
  if (t.gratter === "non") {
    add("shad", -1, "Fond trop encroché : un souple plombé se tient au-dessus du fond, jamais à son contact.", "fiche");
    add("metal", -1, "Fond trop encroché : le métal se pêche haut, sans toucher.", "fiche");
    if (!rough) add("weightless", 2, "Souple non plombé ou texan, nagé au-dessus du goémon.", "fiche");
  } else if (t.gratter === "texan") add("weightless", 1, "Fond mixte : monté texan sur les zones encombrées.", "fiche");
  if (rough) add("weightless", -2, "Courant ou vagues : trop léger, le leurre dérive sans précision.", "ouverture");
  if (!t.couches.includes("surface")) add("surface", -3, "Surface impraticable ici selon la fiche.", "fiche");
  if (sit.cold) {
    add("shad", 1, "Eau froide : souple qui nage naturellement à faible vitesse ; animations lentes.", "ouverture");
    add("weightless", 1, "Finesse de 10 à 14 cm en récupération très douce, quand le bar suit sans mordre.", "ouverture");
  }
  const p = sit.prey?.[0];
  if (p?.couche === "surface") add("surface", 1, `Proie du moment en surface : ${p.name.toLowerCase()}.`, "fiche");
  if (p?.couche === "sous-surface") { add("nageur", 0.5, `Proie du moment en sous-surface : ${p.name.toLowerCase()}.`, "fiche"); add("weightless", 0.5, `Proie du moment en sous-surface : ${p.name.toLowerCase()}.`, "fiche"); }
  if (p?.couche === "fond" && t.gratter !== "non") add("shad", 1, `Proie du moment près du fond : ${p.name.toLowerCase()}.`, "fiche");
  if (p?.couche === "mi-eau") add("shad", 1, `Proie du moment à mi-eau : ${p.name.toLowerCase()}.`, "fiche");
  // À score égal, la famille la plus citée par la fiche du spot passe devant.
  const fiche = sit.ficheFam || {};
  return Object.keys(sc).map((k) => ({ k, ...FAMILLES[k], score: sc[k], why: why[k], fiche: fiche[k] || 0 }))
    .sort((a, b) => b.score - a.score || b.fiche - a.fiche || FAM_ORDER.indexOf(a.k) - FAM_ORDER.indexOf(b.k));
}

/** Taille et profil. */
export function sizeAdvice(sit) {
  const why = [];
  const p = sit.prey?.[0];
  let text = p ? `Profil de ${p.name.toLowerCase()}${p.size && p.size !== "—" ? `, ${p.size}` : ""}` : "Profil de la proie locale";
  if (p) why.push(r(`Proie dominante du mois : ${p.name}${p.size && p.size !== "—" ? ` (${p.size})` : ""}.`, "fiche"));
  if (sit.light === "nuit") { text = "Petit souple de 85 à 100 mm"; why.push(r("Nuit : souples de 85 à 100 mm.", "nuit")); }
  else if (sit.sea === "agitée") { text = "Shad de 120 à 140 mm"; why.push(r("Dans les vagues : Black Minnow 120 ou 140.", "vagues")); }
  else if (sit.cold) { text = "Petite taille : shad de 9 à 12 cm, finesse de 10 à 14 cm"; why.push(r("Début de saison : un leurre souple de petite taille peut être plus efficace.", "couleurDebut"), r("Shad à palette de 9 à 12 cm ; finesse de 10 à 14 cm.", "ouverture")); }
  else if (sit.month >= 9 && sit.month <= 11) why.push(r("Automne : souples de 120 à 150 mm (Black Minnow, Crazy Sand Eel), surface 130 à 150 mm (Asturie, Biotop, Super Spook).", "automne"));
  return { text, why };
}

/** Poids et montage. */
export function weightAdvice(sit, fam) {
  const why = [];
  let text = sit.terr.montage || "";
  if (sit.terr.montage) why.push(r(sit.terr.montage, "fiche"));
  if (fam === "shad" && sit.sea === "agitée") {
    text = sit.terr.gratter === "non" ? "Tête de 18 à 25 g, tenue au-dessus du fond" : "Tête de 18 à 25 g";
    why.push(r("Dans les vagues : tête de 18 à 25 g.", "vagues"));
  }
  else if (sit.light === "nuit" && fam === "shad") { text = "Tête de 5 à 10 g"; why.push(r("Nuit : têtes de 5 à 10 g en zones peu profondes.", "nuit")); }
  if (sit.sea === "clapot") why.push(r("Clapot de vent en rade : ce n'est pas la mer déferlante de la côte ouverte ; le montage de la fiche reste la règle, à peine plus lourd pour lancer contre le vent.", "deduit"));
  if (sit.sea === "abritée") why.push(r("Mer formée au large, mais le havre l'amortit : le conseil « vagues » (côte rocheuse ouverte) ne s'applique pas ici ; le montage de la fiche reste la règle.", "deduit"));
  if (sit.strongCurrent) why.push(r("Dans le courant ou en profondeur, une tête plus lourde ; en eau peu profonde ou abritée, une tête légère. Trop lourd, le leurre perd en naturel.", "ouverture"));
  else why.push(r("Eau peu profonde ou abritée : tête légère. Trop lourd, le leurre perd en naturel.", "ouverture"));
  return { text: text || "Le plus léger qui garde le contact", why };
}

/** Animation conseillée pour une famille. */
export function animationAdvice(sit, fam) {
  const out = [];
  if (fam === "surface") {
    out.push(r("Walking the dog : coups de scion réguliers, environ deux par seconde. Long-slide, plus lent, pour les gros poissons.", "stickbait"));
    out.push(ASTURIE_ANIM);
  } else if (fam === "nageur") out.push(r("Jerkbait : coups de scion secs ; varier vitesse et pauses.", "merConseils"));
  else if (fam === "weightless") out.push(r("Récupération très douce ou légers relevés de scion, longues pauses.", "ouverture"));
  else if (fam === "metal") out.push(r("Laisser couler, puis récupérer vite.", "merConseils"));
  else if (sit.light === "nuit") out.push(r("Nuit : récupération saccadée.", "nuit"));
  else if (sit.sea === "agitée") out.push(r("Linéaire, canne basse à 90° du leurre ; scion noyé pour supprimer la bannière.", "vagues"));
  else out.push(r(sit.cold ? "Laisser descendre, puis récupérer lentement en gardant le contact." : "Linéaire ou en dent de scie ; varier la vitesse.", sit.cold ? "ouverture" : "merConseils"));
  return out;
}

/** Modèles cités par les sources pour cette situation. */
export function citedModels(sit) {
  const m = [];
  if (sit.sea === "agitée") m.push(r("Fiiish Black Minnow 120 ou 140, tête de 18 à 25 g (exemple : Electric Blue sur tête de 25 g)", "vagues"));
  if (sit.light === "nuit") m.push(r("Illex Nitro Shad 90 (bone) · Madness Madshad Evo 2 85 (iwashi) · Westin Sandy Andy 100 (blanc) · Megabass Spindle Worm 4\" (Ayu) · Fiiish Black Minnow 90 (blanc, tête 5 g)", "nuit"));
  if (sit.month >= 9 && sit.month <= 11) m.push(r("Fiiish Black Minnow 120 et 150, Crazy Sand Eel 120 à 150 ; surface : Xorus Asturie 130 et 150, Fiiish Biotop, Heddon Super Spook", "automne"));
  if (/lançon|équille/i.test(sit.prey?.[0]?.name || "")) m.push(r("Fiiish Crazy Sand Eel ou Crazy Paddle Tail, vert ou kaki", "coloris"));
  return m;
}

/** Leurres de ta boîte qui collent à la famille et à la couleur conseillées. */
export function boxMatches(fams, color, sit) {
  const top = fams.filter((f) => f.score > 0).slice(0, 2).map((f) => f.k);
  const tone = (b) => {
    if (b.tons.includes("soleil")) return color.cat === "naturel" && sit.light === "soleil" ? 2 : -1;
    if (color.cat === "blanc") return b.tons.includes("blanc") ? 2 : 0;
    if (color.cat === "visible") return b.tons.includes("blanc") ? 2 : 0;
    if (color.cat === "contraste") return b.tons.includes("transition") ? 2 : b.tons.includes("blanc") ? 1.5 : 0;
    return b.tons.includes("naturel") ? 2 : 0;
  };
  return BOITE.filter((b) => top.includes(b.fam) && b.tons.length)
    .map((b) => ({ ...b, fit: (top[0] === b.fam ? 1 : 0) + tone(b) }))
    .filter((b) => b.fit >= 2).sort((a, b) => b.fit - a.fit).slice(0, 3);
}

/** Quand rien ne colle exactement : le leurre de ta boîte le plus proche, et ce qui diffère. */
export function boxNearest(fams, color, sit) {
  const pos = fams.filter((f) => f.score > 0).map((f) => f.k);
  if (!pos.length) return null;
  const tone = (b) => {
    if (b.tons.includes("soleil")) return color.cat === "naturel" && sit.light === "soleil" ? 2 : -1;
    if (color.cat === "blanc" || color.cat === "visible") return b.tons.includes("blanc") ? 2 : 0;
    if (color.cat === "contraste") return b.tons.includes("transition") ? 2 : b.tons.includes("blanc") ? 1.5 : 0;
    return b.tons.includes("naturel") ? 2 : 0;
  };
  // Un leurre réservé à une lumière précise (Ghost Iwashi : plein soleil) n'est jamais proposé à défaut.
  // Les entrées sans couleur déclarée (« Souples divers », copies) restent proposables : couleur à choisir.
  const cands = BOITE.filter((b) => pos.includes(b.fam) && (!b.tons.length || tone(b) >= 0))
    .map((b) => ({ ...b, famRank: pos.indexOf(b.fam), tone: b.tons.length ? tone(b) : 0.5 }))
    .sort((a, b) => a.famRank - b.famRank || b.tone - a.tone);
  const b = cands[0];
  if (!b) return null;
  const diff = [];
  if (b.famRank > 0) diff.push(`${FAMILLES[b.fam].court.toLowerCase()} au lieu de ${FAMILLES[pos[0]].court.toLowerCase()}`);
  if (!b.tons.length) diff.push(`couleur non renseignée dans ta boîte : choisir ${color.label.toLowerCase().replace(/^[^:]*: /, "")}`);
  else if (b.tone < 2) diff.push("couleur différente de celle conseillée");
  return { ...b, diff: diff.join(" ; ") || "proche du conseil" };
}

/** Leurres de la fiche du spot, classés pour la situation. */
export function spotLuresRanked(spot, fams) {
  const rank = Object.fromEntries(fams.map((f, i) => [f.k, { i, score: f.score }]));
  return (spot.lures || []).map((l) => ({ ...l, fam: familyOf(l) }))
    .map((l) => ({ ...l, fit: rank[l.fam]?.score ?? 0 }))
    .sort((a, b) => b.fit - a.fit);
}

/** Conseil complet pour un spot à un créneau. */
export function lureAdvice(spot, w, live, dateISO) {
  const sit = lureSituation(spot, w, live, dateISO);
  const fams = familyRanking(sit);
  const best = fams[0];
  const color = colorAdvice(sit);
  const box = boxMatches(fams, color, sit);
  // Familles à égalité en tête : annoncées comme telles (le départage par la fiche reste visible).
  const tiedTop = fams.filter((f) => f.score === best.score);
  return {
    sit, fams, best, color,
    size: sizeAdvice(sit),
    weight: weightAdvice(sit, best.k),
    anim: animationAdvice(sit, best.k),
    models: citedModels(sit),
    box, boxNear: box.length ? null : boxNearest(fams, color, sit), tiedTop,
    spotLures: spotLuresRanked(spot, fams),
    summary: `${best.court} · ${color.label.split(" :")[0].toLowerCase()}`,
  };
}
