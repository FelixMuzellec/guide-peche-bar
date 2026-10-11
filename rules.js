// Réglementation de la pêche de loisir du bar, bonnes pratiques de remise à
// l'eau et consignes de sécurité propres à chaque spot.
//
// Rien ici n'est déduit : chaque règle porte sa source et sa date de lecture.
// La réglementation change chaque année (règlement UE de janvier, arrêtés
// français ensuite) : l'application le dit dès que la date consultée sort de
// l'année vérifiée.

export const REGLEMENTATION = {
  annee: 2026,
  verifieLe: "11/10/2026",
  zone: "Zones CIEM 7 et 4 (Manche et mer du Nord), soit au nord du 48e parallèle sur la côte atlantique française",
  latMin: 48,
  quota: 3,          // bars par pêcheur et par jour
  maille: 42,        // cm, de la pointe du museau à l'extrémité de la nageoire caudale
  noKill: { from: [2, 1], to: [3, 31] },   // 1er février → 31 mars
  regles: [
    { t: "3 bars maximum par pêcheur et par jour, en janvier et du 1er avril au 31 décembre.",
      s: "Arrêté du 1er avril 2026 (JO du 9/04/2026), art. 2, 2° · règlement (UE) 2026/249 du Conseil" },
    { t: "Du 1er février au 31 mars : pêche à la canne ou à la ligne à main en capture suivie d'un relâcher uniquement ; aucun bar ne peut être conservé.",
      s: "Arrêté du 1er avril 2026 (JO du 9/04/2026), art. 2, 1°" },
    { t: "Taille minimale : 42 cm, de la pointe du museau à l'extrémité de la nageoire caudale.",
      s: "peche.com, 08/01/2026 · Boatcible (arrêté du 26/10/2012 modifié)" },
    { t: "Bar conservé : marquage obligatoire par ablation de la partie inférieure de la nageoire caudale.",
      s: "Boatcible (arrêté du 17/05/2011 modifié)" },
    { t: "Déclaration des captures de bar sur l'application RecFishing : obligation annoncée pour 2026, entrée en vigueur reportée selon Boatcible (juillet 2026). À vérifier avant de conserver un poisson.",
      s: "peche.com, 08/01/2026 · Boatcible, 09/07/2026 (arrêté du 07/11/2025)" },
  ],
  sources: [
    { label: "Arrêté du 1er avril 2026 réglementant la pêche de loisir du bar européen (NOR TECM2608397A, JO du 9/04/2026) — copie publiée par la mairie de Locquirec",
      url: "https://www.locquirec.bzh/wp-content/uploads/2026/04/Arrete-du-1er-avril-2026-Bar-loisir.pdf" },
    { label: "peche.com — Les quotas bars et lieus 2026 pour les pêcheurs de loisir (08/01/2026)",
      url: "https://www.peche.com/article/50915/les-quotas-bars-et-lieus-2026-pour-les-pecheurs-de-loisir" },
    { label: "Boatcible — Pêche de loisir 2026, règles essentielles (02/07/2026)",
      url: "https://boatcible.com/2026/07/02/peche-de-loisir-2026-regles-essentielles/" },
    { label: "Ministère de la Mer — Pêche de loisir en mer (textes officiels)",
      url: "https://www.mer.gouv.fr/peche-de-loisir-en-mer" },
  ],
};

// peche.com, « Comment relâcher un poisson ? » (J. Del Arco Aguirre, 24/06/2022).
export const REMISE_A_L_EAU = {
  source: { label: "peche.com — Comment relâcher un poisson ? Pratiquez le no-kill correctement (24/06/2022)",
            url: "https://www.peche.com/article/32998/comment-relacher-un-poisson-pratiquez-le-no-kill-correctement" },
  gestes: [
    "Hameçons simples sans ardillon, ou ardillons écrasés : le décrochage est plus facile, « sans augmenter significativement le taux de perte ».",
    "Sur les poissons-nageurs, remplacer les deux triples par un hameçon simple en queue.",
    "Écourter le combat : bas de ligne assez solide pour ne pas épuiser le poisson.",
    "Épuisette en caoutchouc sans nœud ; décrocher le poisson sans le sortir de l'eau.",
    "Mains mouillées, jamais de chiffon : le mucus protège ses écailles.",
    "Le tenir dans l'eau sans va-et-vient : « il repartira de lui-même » une fois récupéré.",
  ],
};

const md = (m, d) => m * 100 + d;
/** Statut réglementaire d'une date pour la zone du site. */
export function regulationFor(dateISO, lat) {
  const R = REGLEMENTATION;
  const [y, m, d] = String(dateISO).split("-").map(Number);
  const inZone = !(Number.isFinite(lat) && lat < R.latMin);
  const v = md(m, d);
  const noKill = inZone && v >= md(...R.noKill.from) && v <= md(...R.noKill.to);
  return {
    inZone, noKill, quota: R.quota, maille: R.maille,
    year: y, yearChecked: R.annee, stale: y !== R.annee,
    headline: !inZone ? "Site hors de la zone vérifiée : règles non renseignées"
      : noKill ? "No-kill obligatoire : tout bar est relâché (février-mars)"
      : `${R.quota} bars / pêcheur / jour · taille minimale ${R.maille} cm`,
  };
}

// ═══════════════════════════════════════════════════════════════════
// SÉCURITÉ PAR SPOT
// Chaque spot porte une liste `securite` : { t, s, when? }. `when` rend une
// consigne ACTIVE selon les conditions de la journée (coefficient, phase de la
// marée du créneau proposé). Seuls les seuils écrits dans une source sont
// utilisés (Térénez : coefficient 85, peche-poissons.com, 2022).
// ═══════════════════════════════════════════════════════════════════
export function securityFor(spot, { coeff, window } = {}) {
  return (spot?.securite || []).map((r) => {
    const w = r.when || null;
    let active = false;
    if (w) {
      const c = window?.coeff ?? coeff;
      const okCoef = w.coefAbove == null || (c != null && c > w.coefAbove);
      const okPhase = w.phase == null || window?.tidePhaseType === w.phase;
      active = okCoef && okPhase;
    }
    return { ...r, active, conditional: !!w };
  });
}
