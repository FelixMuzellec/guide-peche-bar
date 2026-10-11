// Configuration du site Logonna-Daoulas : tout ce qui est propre au lieu (spots, zones, ports de marée,
// principes). Le moteur (src/engine.jsx) est commun aux deux applications.
export const SITE = {
  id: "logonna-daoulas",
  name: "Logonna-Daoulas",
  region: "Rade de Brest",
  dept: "29460",
  headerLabel: "RADE DE BREST",
  lat: 48.3352, lon: -4.2868,   // requis pour le calcul solaire réel
  tidePort: "Brest",
  tideSources: "maree.info, marine.meteoconsult.fr/meteo-marine/horaires-des-marees/brest-876/, shom.fr",
  weatherSources: "meteociel.fr, meteofrance.com",
  // Trois ancrages météo distincts : la rade et le goulet ne reçoivent pas
  // le même vent, et l'écart décide du classement.
  zones: {
    local: { label: "Fond de rade",  anchor: "Logonna-Daoulas (29460)", sea: "rade", fetchKm: 5 },
    inter: { label: "Rade centrale", anchor: "Landévennec / Plougastel-Daoulas", sea: "rade", fetchKm: 8 },
    far:   { label: "Goulet / large", anchor: "Camaret-sur-Mer et goulet de Brest", sea: "open" },
  },
  // Bornes thermiques de référence pour la lecture saisonnière locale.
  // Marnage moyen morte-eau ↔ vive-eau, pour le contrôle de cohérence.
  marnage: { neap: 2.9, spring: 6.4 },
  // Calendrier des proies : ce qui commande la taille et le profil du leurre.
  preyCalendar: [
    { name:"Crevette (bouquet, grise)", couche:"sous-surface", months:[1,2,3,4,5,6,7,8,9,10,11,12], weight:2,
      size:"3-7 cm", guidance:"Profil court et discret. Souple 8-10 cm animé lentement sur les bordures de goémon et les fonds mixtes." },
    { name:"Lançon / équille", couche:"sous-surface", months:[4,5,6,7,8,9], weight:5,
      size:"8-15 cm", guidance:"La proie reine de l'été. Profils fins et allongés : Crazy Sand Eel, stickbait élancé, souple fin. Les coloris Ghost Lançon prennent tout leur sens ici." },
    { name:"Alevins de mulet", couche:"surface", months:[6,7,8,9], weight:4,
      size:"3-8 cm", guidance:"Bancs serrés en surface près des bordures et des estuaires. Petit stickbait ou souple weightless passé au milieu du banc, jamais dedans." },
    { name:"Gobies et blennies", couche:"fond", months:[1,2,3,4,5,6,7,8,9,10,11,12], weight:2,
      size:"5-10 cm", guidance:"Proie de fond permanente. Dark Sleeper ou souple plombé gratté sur les fonds durs et les cassures." },
    { name:"Crabe mou (période de mue)", couche:"fond", months:[5,6,7,8,9], weight:3,
      size:"3-6 cm", guidance:"Le bar en raffole pendant la mue. Souple compact animé très lentement au ras du fond, sur les zones de goémon et de roche." },
    { name:"Sprat", couche:"mi-eau", months:[10,11,12,1,2,3], weight:4,
      size:"8-12 cm", guidance:"Bancs hivernaux. Shad de 10 cm plombé de 12 à 25 g selon profondeur et courant. Suivre les oiseaux." },
    { name:"Civelle et petite anguille", couche:"fond", months:[2,3,4,5], weight:3,
      size:"6-12 cm", guidance:"Spécifique aux estuaires de l'Aulne et de l'Élorn au printemps. Souple très fin, animation lente et rasante." },
  ],
  // ── Journal de terrain inscrit en dur ──────────────────────────
  // Ces sessions sont dans le fichier, pas seulement dans le stockage :
  // elles survivent à une perte de persistance, à un vidage de cache et à un
  // changement d'appareil. Elles sont fusionnées au chargement, jamais
  // écrasées. `predicted` est laissé vide : le score n'existait pas à ces
  // dates. L'application le complètera d'elle-même le jour où tu ouvriras la
  // date correspondante, et la session comptera alors pour le recalibrage.
  seedJournal: [
    // « moment » reprend ce que Félix a dit (« avant que le soleil se couche », « quand le soleil se couche ») :
    // l'heure retenue pour les conditions est celle du coucher calculé, signalée comme estimée.
    { id:"log-2025-12-27-moulinmer", date:"2025-12-27", spotId:"moulinmer", fish:2, result:7, moment:"coucher",
      lure:"Asturie 130 blanc · Asturie 110 Cabot",
      note:"2 bars avant le coucher du soleil. Aucune chasse en surface." },
    { id:"log-2026-08-07-moulinmer", date:"2026-08-07", spotId:"moulinmer", fish:0, result:1,
      lure:"Asturie et Z-Claw, nombreux modèles essayés",
      note:"Bredouille malgré une prospection large de la boîte." },
    { id:"log-2026-08-08-moulinmer", date:"2026-08-08", spotId:"moulinmer", fish:1, result:5, moment:"coucher",
      lure:"Z-Claw blanc nacré",
      note:"1 bar au moment du coucher du soleil. Aucune chasse en surface." },
  ],

  // ── Marée : calculée localement (v5) ─────────────────────────────
  // Brest est le port de référence de toute la rade. Écart réel au fond de
  // rade : quelques minutes, inférieur à la précision des fenêtres de pêche.
  tide: {
    defaultPort: "brest",
    ports: {
      brest: { label: "Brest", kind: "harmonic", station: "brest", z0: 4.13, lagH: 0,
        accuracy: "SHOM ±3,9 min · ±4 cm (5 mois de contrôle)" },
    },
  },
  sstTypical: [9, 18.5],
};

// ═══════════════════════════════════════════════════════════════════
// GENERAL FISHING PRINCIPLES (sourced, apply to all spots)
// Sources : peche.com, despoissonssigrands.com, delalande-peche.fr
// ═══════════════════════════════════════════════════════════════════
export const GENERAL_PRINCIPLES = {
  title: "Principes généraux de la pêche au bar du bord",
  items: [
    {
      rule: "Les 3 premières heures de montante ou de descendante sont les plus productives",
      source: "peche.com / Delalande Pêche",
      explain: "L'activité des bars culmine sur ces tranches, quand le courant charrie la nourriture. Les étales (bas/haut) sont moins productives, sauf sur les spots à fort courant (Goulet).",
    },
    {
      rule: "Lever et coucher du soleil = fenêtres clés",
      source: "peche.com, fiiish.com",
      explain: "Éclairage faible = bars moins méfiants, actifs près du bord. Cumuler crépuscule + marée favorable = session optimale. Particulièrement vrai en rade de Brest où l'eau est souvent très claire.",
    },
    {
      rule: "Ciel couvert > ciel clair",
      source: "fiiish.com / peche.com",
      explain: "Les journées légèrement couvertes surpassent les plein soleil. Par soleil, préférer les coups du matin et du soir.",
    },
    {
      rule: "Eaux claires de la rade = matériel léger et discrétion",
      source: "peche.com (Nicolas/brestfishing) / Relec29-Desperadiens",
      explain: "La rade de Brest est une mer intérieure bien abritée, eau claire. Canne 5-15g, tresse PE0.6-0.8, fluoro 25-30/100, leurres petits/discrets. Approche silencieuse — souvent pêche à vue en bordure.",
    },
    {
      rule: "Coefficient modéré (50-75) généralement optimal en rade",
      source: "peche-poissons.com (Landévennec) / Desperadiens",
      explain: "La rade n'a pas les courants du Cotentin. Sauf au Goulet et aux pointes (Armorique, Espagnols), les gros coefs n'apportent pas d'avantage — ils peuvent même troubler l'eau. Sur Térénez/Landévennec, coef 40-55 explicitement recommandé par Thierry Sauvin.",
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════
// 10 SPOTS — chaque champ marqué par niveau de confiance
//   confidence: "verified" = info sourcée / "local_knowledge" = savoir terrain Félix / "inference" = déduction raisonnée
// ═══════════════════════════════════════════════════════════════════
export const SPOTS = [

  // ══════════════════════════════════════════════════════════
  // 1. MOULIN MER / POINTE DU CHÂTEAU — local Logonna
  // ══════════════════════════════════════════════════════════
  {
    id:"moulinmer", zone:"local", isLocal:true, dangerLevel:1,
    name:"Moulin Mer", subtitle:"Anse de Moulin-Mer, Logonna-Daoulas",
    distance:"5 min", distMin:5, coords:"48°19'N 4°17'W", lat:48.3159, lon:-4.2862,
    type:"BORDURES GOÉMON", color:"#22c55e",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Roches et goémon sur toutes les bordures ; sable-vase seulement au cœur de l'anse.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface"],
      montage:"Weightless ou texan (hameçon texan 3/0 à 4/0). Pas de tête plombée nue : elle finit dans les rochers.",
      conseils:["Lancer parallèle aux bordures et faire nager le leurre au-dessus du goémon, jamais dedans.", "Respecter les parcs à huîtres (concessions de Moulin-Mer à Kervella) : ne pas les traverser ni lancer dedans.", "À marée basse, repérer les couloirs de sable entre les rochers : c'est par là que le bar entre au flot.", "Quand la pression pousse le poisson vers le fond, rester au ras du goémon avec un leurre lent plutôt que gratter."],
      confidence:"local_knowledge",
      source:"Félix, pêche sur place (10/10/2026) ; Desperadiens/Relec29 pour le weightless sur goémon",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"Moulin-Mer est sur la rive SUD de la presqu'île de Logonna, à l'embouchure de la rivière de l'Hôpital (ria du Camfrout).", s:"Wikipédia — Logonna-Daoulas (géographie)" },
        { t:"Concessions ostréicoles « de Moulin-Mer à Kervella au sud ».", s:"Wikipédia — Logonna-Daoulas (géographie)" },
        { t:"Le terre-plein du centre nautique a été construit avec les déblais des carrières de kersanton voisines.", s:"Wikipédia — Logonna-Daoulas (géographie)" },
        { t:"Le moulin à marée est « à l'abri des vagues de la rade ».", s:"Office de tourisme Landerneau-Daoulas" },
        { t:"Cale étroite et en virage, utilisable à mi-marée.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
      ],
    },
    coefBand:[25,40,80,105],
    // Anse peu profonde à goémon : travaille dès les petits coefficients, le flot suffit à recouvrir la bordure.
    coefMin:40, coefIdeal:80, coefMax:105, houleMax:1.2,
    // v6.1 — Orientation corrigée : Moulin-Mer est sur la rive SUD de la presqu'île
    // (Wikipédia), et non sur la bordure nord. À confirmer par Félix sur place.
    exposedAngles:[180,202.5,225], shelteredAngles:[0,22.5,337.5],
    weatherNote:"Rive sud de la presqu'île de Logonna, à l'embouchure de la rivière de l'Hôpital-Camfrout (Wikipédia). La presqu'île abrite des vents de nord ; c'est le secteur sud-ouest qui lève un clapot dans l'anse. Orientation à confirmer sur place.",
    sources:[
      "fr.wikipedia.org — Logonna-Daoulas (géographie : Moulin-Mer, rive sud, embouchure de la rivière de l'Hôpital)",
      "tourisme-landerneau-daoulas.fr — sentier littoral de Logonna et escapade en rade",
      "voileaviron.org — livret des sites de la rade de Brest",
      "Desperadiens — 'Pêche aux leurres de surface par Relec29' (mentionne explicitement les bordures de Moulin Mer comme spot référence LS en goémon)",
      "peche.com — La rade de Brest, terrain de jeu (Nicolas / brestfishing.fr)",
      "capitaine-spots.fr — Pointe de Bindy (secteur voisin)"
    ],
    topology:{
      fond:{ text:"Bordures rocheuses avec tapis de goémons/fucus, sable-vase dans l'anse. Hauts-fonds qui s'étendent loin à BM.", confidence:"local_knowledge" },
      structure:{ text:"Source Desperadiens/Relec29 : 'les bordures de moulin mer en Logonna Daoulas' figurent parmi les zones encombrées typiques où le leurre souple en surface (weightless) sur goémon donne de beaux bars. Ancien moulin à marée, petit étier, pointe rocheuse plongeante.", confidence:"verified" },
      exposition:{ text:"Rive sud de la presqu'île, ouverte sur la ria du Camfrout (Wikipédia). Abritée des vents de N à NE par la presqu'île ; exposée au S-SO. La version d'origine la disait « orientée NO » : contredit par la géographie, à confirmer sur place.", confidence:"inference" },
      courant:{ text:"Courant faible à modéré, accélération légère autour de la pointe. La rade de Brest a des courants globaux de 0.5 à 3 nds (source navigation-croisiere), Logonna est dans la tranche basse.", confidence:"verified" },
      bars:{ text:"Bars de bordure, souvent en petit groupe, chassent crevettes/lançons dans le goémon. Spécimens 40-55cm réguliers, pièces 70+ documentées dans le secteur (Relec29 sur le Relecq voisin).", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"MONTANT PLEIN + CRÉPUSCULES",
      montantOuDescendant:"Montant dominant pour les bordures de goémon (le flot noie les tapis et active les bars). Le descendant peut marcher côté pointe avec courant léger. Étales peu productives sauf en pêche à vue.",
      description:"Bordure classique : on pêche le flot quand les goémons sont recouverts (bars postés dedans) et le début de descendant quand les proies quittent les herbiers. Pêche à vue possible par eau claire et temps calme.",
      windows:[
        { id:"mm1", label:"2e moitié de montant", phase:"pm", offsetBefore:-3.0, offsetAfter:-0.5, tidePhaseType:"montant", priority:"prime",
          note:"Les tapis de goémons sont recouverts, bars en chasse dans les bordures. Lancer parallèle à la côte, leurre souple weightless type Gambit 120mm." },
        { id:"mm2", label:"Début de descendant", phase:"pm", offsetBefore:0.5, offsetAfter:2.5, tidePhaseType:"descendant", priority:"prime",
          note:"Eau qui se retire des goémons, proies exposées. Même approche, possible switch stickbait/pencil surface si chasses visibles." },
        { id:"mm3", label:"Crépuscule BM montante", phase:"bm", offsetBefore:-0.5, offsetAfter:2.0, tidePhaseType:"montant", priority:"prime",
          note:"Cumul crépuscule + début de flot = fenêtre la plus productive de la rade selon Desperadiens. Jerkbait ou stickbait sur chasses." },
      ],
      lifeHack:"Approche silencieuse obligatoire — pêche souvent à vue. Leurre souple weightless dans les goémons (coût faible = on les envoie où on ne lance pas un stickbait à 30€). Canne courte 2m/2.10 selon Relec29, puissance 5-15g, tresse PE0.6-0.8, fluoro 28-30/100.",
    },
    lures:[
      { name:"Leurre souple weightless dans goémon", color:"Ayu / Motor Oil / Natural", weight:"7-10g monté sans plomb ou tête 3-5g", technique:"Source Desperadiens directe : Gambit method shad d'Illex ou équivalent 12cm, weightless, promené à fleur d'eau sur le goémon. L'arme absolue de Moulin Mer." },
      { name:"Stickbait / pencil 110-130mm", color:"Ghost / Sardine / Iwashi", weight:"14-22g", technique:"Walk-the-dog en surface au crépuscule sur montante. Asturie 110 ou Patchinko 125 en référence perso." },
      { name:"Jerkbait suspending 110mm", color:"Ayu / Mullet", weight:"12-16g", technique:"Sur les zones moins encombrées côté pointe. Twitch lent, pauses longues." },
    ],
    access:"Depuis Logonna-Daoulas bourg, direction Moulin Mer/Pointe du Château. Parking devant le centre nautique. Accès direct aux bordures rocheuses à pied. Bottes suffisent, semelles crantées utiles sur goémon humide.",
  },

  // ══════════════════════════════════════════════════════════
  // 2. POINTE DU BENDY — local Logonna
  // ══════════════════════════════════════════════════════════
  {
    id:"bendy", zone:"local", isLocal:true, dangerLevel:1,
    name:"Pointe du Bendy", subtitle:"Anse du Bendy, Logonna-Daoulas",
    distance:"10 min", distMin:10, coords:"48°19'N 4°19'W",
    type:"POINTE ROCHEUSE", color:"#4ade80",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Alternance de roche et de sable, platiers découvrants, herbiers de zostères en bordure.",
      encombrement:2,
      gratter:"texan",
      couches:["surface", "sous-surface", "mi-eau", "fond"],
      montage:"Tête weedless ou texan sur les platiers ; tête plombée classique seulement sur le sable.",
      conseils:["Repérer à marée basse les plaques de sable entre les platiers : ce sont les seules zones où gratter.", "Passer au-dessus des zostères : un souple qui s'y accroche ne pêche plus."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"La pointe du Bendy est l'extrémité ouest de la presqu'île de Logonna.", s:"Wikipédia — Logonna-Daoulas (géographie)" },
        { t:"Sillon en tombolo, doublé d'un second cordon qui forme un bassin abrité.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
        { t:"Roche de La Coët, non balisée, à contourner au large.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
      ],
    },
    coefBand:[30,50,85,108],
    // Pointe à veine de courant : il lui faut du débit, mais la rade ne produit jamais de dérive ingérable ici.
    coefMin:50, coefIdeal:85, coefMax:108, houleMax:1.3,
    exposedAngles:[270,292.5,315], shelteredAngles:[90,112.5,67.5],
    weatherNote:"Pointe orientée à l'ouest sur la rivière de Daoulas. Exposée aux vents d'O/NO, bien abritée E/NE.",
    sources:[
      "fr.wikipedia.org — Logonna-Daoulas",
      "voileaviron.org — livret des sites de la rade de Brest",
      "capitaine-spots.fr — 'Pointe de Bindy/Bendy à Logonna-Daoulas : spot de pêche réputé avec vue sur la rade de Brest'",
      "tourisme-landerneau-daoulas.fr — Pointe du Bendy parmi les spots estran de Logonna (Le Roz, Le Yelen, Le Bendy, Porsisquin)",
      "peche.com — Principes généraux pointes rocheuses"
    ],
    topology:{
      fond:{ text:"Alternance roche-sable, platiers découvrant sur coef > 70, herbiers de zostères en bordures. Spot d'estran riche (palourdes, bigorneaux, crevettes) donc garde-manger pour le bar.", confidence:"verified" },
      structure:{ text:"Pointe à l'entrée de l'anse du Bendy, sur la rive sud de la rivière de Daoulas. Configuration classique de pointe rade : légère accélération du courant au tombant, tourbillon aval selon sens de marée. Vue dégagée sur l'entrée de la rade vers l'Armorique.", confidence:"local_knowledge" },
      exposition:{ text:"Face NO/O. Vent de NE/E arrive sur l'arrière des terres = bien abrité. Vent O/NO lève une mer courte mais la rade reste fermée (pas de houle océanique).", confidence:"local_knowledge" },
      courant:{ text:"Modéré. Courant de l'anse du Bendy + courant général rade. Plus marqué en vive-eau, quasi nul en morte-eau.", confidence:"inference" },
      bars:{ text:"Spot explicitement qualifié de 'pêche réputée' par capitaine-spots.fr. Zone d'estran riche = nourriture abondante. Bars de passage sur le montant, postés sur le descendant derrière la pointe.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"FLOT ÉTABLI + 1h APRÈS PM",
      montantOuDescendant:"Les deux fonctionnent. Montante : bars qui remontent avec le flot, en chasse sur les platiers. Descendant : postage sur tombant aval de la pointe.",
      description:"Pointe de rade classique. À mi-marée + ou -, les platiers sont accessibles et on peut lancer loin. À BM les platiers sont à découvert, inaccessibles.",
      windows:[
        { id:"b1", label:"Fin de montant → 1h après PM", phase:"pm", offsetBefore:-2.0, offsetAfter:1.0, tidePhaseType:"montant", priority:"prime",
          note:"Fenêtre large : flot terminal + étale PM + tout début de descendant. Les bars sont en chasse sur les platiers qui viennent d'être recouverts." },
        { id:"b2", label:"1-2h après PM (descendant)", phase:"pm", offsetBefore:1.0, offsetAfter:2.5, tidePhaseType:"descendant", priority:"bon",
          note:"Postage sur le tombant aval de la pointe. Leurre coulant dans le courant descendant." },
        { id:"b3", label:"Début de montant (crépuscule)", phase:"bm", offsetBefore:1.0, offsetAfter:3.0, tidePhaseType:"montant", priority:"bon",
          note:"Si PM en fin de journée → coup du soir optimal. Stickbait sur chasses." },
      ],
      lifeHack:"Repérer à BM les chenaux entre les platiers — ce sont les veines que les bars empruntent sur le flot. Possibilité de pêche à vue en été par eau très claire et soleil bas.",
    },
    lures:[
      { name:"Shad souple 10-14cm tête plombée", color:"Natural / Smoke / Chartreuse", weight:"10-18g", technique:"Prospection large sur platiers recouverts. Récupé lente avec pauses." },
      { name:"Stickbait / pencil bait", color:"Ghost / Sardine", weight:"18-28g", technique:"Walk-the-dog au-dessus des platiers en fin de montant si mer calme." },
      { name:"Jerkbait suspending", color:"Ayu / Mullet", weight:"12-16g", technique:"Twitchs courts entre les blocs rocheux côté pointe." },
    ],
    access:"Depuis Logonna-Daoulas bourg, route vers Pointe du Bendy (fléché). Parking au bout de la route. Accès à pied par sentier côtier (GR34). Pêche depuis les rochers de la pointe ou sur les platiers selon marée.",
  },

  // ══════════════════════════════════════════════════════════
  // 3. ROSTIVIEC (Loperhet) — local
  // Corrigé : la fiche précédente fusionnait Rostiviec et
  // L'Hôpital-Camfrout en un seul poste. Ce sont deux communes
  // distinctes, deux rivières distinctes et deux accès distincts.
  // ══════════════════════════════════════════════════════════
  {
    id:"rostiviec", zone:"local", isLocal:true, dangerLevel:1,
    name:"Rostiviec", subtitle:"Port et anse de Penfoul, Loperhet",
    distance:"15 min", distMin:15, coords:"48°20'N 4°18'W",
    type:"RIA / BAIE DE DAOULAS", color:"#34d399",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Vase et sablo-vase dans l'anse, cailloutis en bordure, corps-morts et anciens parcs.",
      encombrement:2,
      gratter:"texan",
      couches:["surface", "sous-surface", "mi-eau", "fond"],
      montage:"Texan obligatoire près des parcs et des corps-morts ; tête légère possible sur la vase dégagée du chenal.",
      conseils:["Les lignes de corps-morts sont des postes, mais aussi des pièges à leurres : longer, ne pas traverser."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"Le sillon de Rostiviec « a du mal à émerger à marée haute » ; derrière, une anse assez abritée ; la cale du quai donne sur une grève praticable.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
        { t:"L'anse de Penfoul « se vide entièrement à marée basse ».", s:"Office de tourisme Landerneau-Daoulas" },
      ],
    },
    coefBand:[20,35,75,100],
    // Ria abritée, quasi indépendante du courant : c'est le spot le moins sensible au coefficient de toute la rade.
    coefMin:35, coefIdeal:75, coefMax:100, houleMax:1.2,
    exposedAngles:[202.5,180,225], shelteredAngles:[0,22.5,337.5],
    weatherNote:"Port niché dans une ria : brise maritime présente mais abri quasi permanent de la houle. Le clapot ne s'y forme que par vent de sud établi.",
    sources:[
      "voileaviron.org — livret des sites de la rade de Brest",
      "tourisme-landerneau-daoulas.fr — sentier littoral (anse de Penfoul)",
      "pays-landerneau-daoulas.fr — Le centre nautique est situé sur le littoral de la commune de Loperhet, au port de Rostiviec, niché dans une ria de la rade de Brest ; zone de navigation sur la baie de Daoulas (12 km²), abritée de la houle",
      "tourisme-landerneau-daoulas.fr — Loperhet listé avec ses propres sites (Pors Don, Kersanton), distincts de ceux de L'Hôpital-Camfrout",
      "despoissonssigrands.com — Pêche du bar en fond de rade (principes)",
    ],
    topology:{
      fond:{ text:"Vase et sablo-vase dominants dans l'anse, cailloutis sur les bordures. Parcs et anciennes zones ostréicoles en pourtour de la baie de Daoulas.", confidence:"inference" },
      structure:{ text:"Ancien village de pêcheurs et port de plaisance installé dans une ria, sur la baie de Daoulas. L'anse de Penfoul prolonge le site vers l'est. Chenal d'accès et zone de mouillages structurent les fonds.", confidence:"verified" },
      exposition:{ text:"Abri remarquable : la ria coupe la houle de rade quelle que soit sa direction. Le site reste ventilé par la brise thermique, mais la mer y est formée seulement par vent de S/SO établi remontant la baie.", confidence:"verified" },
      courant:{ text:"Courant modéré, canalisé par le chenal d'accès et les bordures de mouillages. Nettement plus faible que sur les pointes de la rade — c'est un poste de finesse, pas de force.", confidence:"inference" },
      bars:{ text:"Bars de bordure patrouillant les mouillages, les coques de bateaux et les bordures vaseuses au flot. Poste de repli par excellence quand tout le reste de la rade est impêchable.", confidence:"inference" },
    },
    tidalRules:{
      typeHeure:"MONTANT SUR LES BORDURES",
      montantOuDescendant:"Montant dominant : le flot recouvre les vasières et les bars entrent y chasser crevettes et gobies. Le descendant concentre le poisson dans le chenal.",
      description:"Spot d'abri et de finesse. On y va quand le vent interdit les pointes, et on y pêche léger, en pêche à vue si l'eau est claire.",
      windows:[
        { id:"ro1", label:"3 premières heures de montant", phase:"bm", offsetBefore:0.5, offsetAfter:3.0, tidePhaseType:"montant", priority:"prime",
          note:"Le flot recouvre les vasières. Longer les bordures et les lignes de mouillages, souple léger ou weightless." },
        { id:"ro2", label:"Fin de montant sur les mouillages", phase:"pm", offsetBefore:-2.0, offsetAfter:-0.5, tidePhaseType:"montant", priority:"bon",
          note:"Les bars circulent entre les coques. Approche silencieuse, leurre discret." },
        { id:"ro3", label:"Début de descendant (chenal)", phase:"pm", offsetBefore:0.5, offsetAfter:2.5, tidePhaseType:"descendant", priority:"bon",
          note:"L'eau se retire des vasières et concentre le poisson dans le chenal. Shad plombé léger dans la veine." },
      ],
      lifeHack:"C'est le spot de mauvais temps de la rade : quand l'ouest souffle à 5 Beaufort et que tout est blanc dehors, ici c'est plat. Pêcher fin, fluorocarbone 25/100, leurres discrets — l'eau y est souvent très claire.",
    },
    lures:[
      { name:"Souple weightless ou tête plombée légère", color:"Natural / Smoke / Motor Oil", weight:"5-10 g", technique:"Bordures vaseuses et lignes de mouillages. Le poids minimal qui permet encore de lancer." },
      { name:"Jerkbait suspending 100-110 mm", color:"Ayu / Mullet / Crystal", weight:"12-16 g", technique:"Twitch lent dans les zones dégagées du chenal." },
      { name:"Shad souple 10-12 cm en texan", color:"Natural / blanc", weight:"10-16 g", technique:"Texan indispensable près des parcs et des corps-morts." },
    ],
    access:"Depuis Logonna : Daoulas puis Loperhet, direction port de Rostiviec. Parking à la cale, sentier côtier vers l'anse de Penfoul. Aucune difficulté.",
  },

  // ══════════════════════════════════════════════════════════
  // 4. L'HÔPITAL-CAMFROUT / TIBIDY — local
  // Commune distincte de Loperhet, autre rivière, autre accès.
  // ══════════════════════════════════════════════════════════
  {
    id:"camfrout", zone:"local", isLocal:true, dangerLevel:2,
    name:"L'Hôpital-Camfrout", subtitle:"Rivière du Camfrout, Tibidy, Troaon",
    distance:"15 min", distMin:15, coords:"48°17'N 4°14'W",
    type:"ESTUAIRE / TOMBOLO", color:"#34d399",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Vase-sable dans l'estuaire, roche et cailloux vers Tibidy, parcs à huîtres et herbiers en bordure.",
      encombrement:2,
      gratter:"texan",
      couches:["surface", "sous-surface", "mi-eau", "fond"],
      montage:"Texan anti-accroche sur les parcs et les herbiers ; weightless à vue dans les bordures peu profondes.",
      conseils:["Côté Tibidy (roche), remonter d'une couche : sous-surface plutôt que fond."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"L'îlot de Tibidy est privé ; on ne peut aborder que côté est du tombolo.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
      ],
    },
    coefBand:[25,45,85,108],
    // Estuaire : la vidange gagne à avoir du marnage, sans excès qui chargerait l'eau.
    coefMin:45, coefIdeal:85, coefMax:108, houleMax:1.3,
    exposedAngles:[292.5,315,270], shelteredAngles:[112.5,135,90],
    weatherNote:"Estuaire encastré en fond de rade, abrité des vents d'O/SO par la géographie. Le vent de NO remonte la ria.",
    sources:[
      "voileaviron.org — livret des sites de la rade de Brest (Tibidy privé)",
      "en.wikipedia.org/wiki/Île_de_Tibidy — Tibidy est un îlot à l'embouchure de la rivière du Faou, en fond de rade de Brest, sur des terres appartenant à la commune de L'Hôpital-Camfrout, relié au continent par un cordon littoral",
      "tourisme-landerneau-daoulas.fr — Sites de L'Hôpital-Camfrout : Tibidy, Kerdreolet, Troaon, Kerhascoët (listés distinctement de ceux de Loperhet)",
      "tourisme-landerneau-daoulas.fr — Kerhascoët, ancien port coquillier de la commune, vue sur la presqu'île de Logonna",
      "despoissonssigrands.com — Pêche du bar en estuaire (principes)",
    ],
    topology:{
      fond:{ text:"Vase-sable dans l'estuaire du Camfrout, cailloux et roche vers Tibidy. Parcs à huîtres sur les bordures, herbiers de zostères documentés en fond de rade — indicateur de richesse biotique.", confidence:"inference" },
      structure:{ text:"Deux structures superposées : l'estuaire de la rivière du Camfrout, et l'îlot de Tibidy relié au continent par un cordon littoral, à l'embouchure de la rivière du Faou. Le cordon est une barrière physique qui dévie le flux et crée un poste d'embuscade franc.", confidence:"verified" },
      exposition:{ text:"Double abri : replié au fond de la ria, et Tibidy masque la sortie. Quasi inattaquable par vent d'O/SO. Le NO remonte l'estuaire et rend l'eau moins lisible.", confidence:"inference" },
      courant:{ text:"Chenalisation nette. Courant modéré dans l'estuaire, sensiblement plus marqué autour du cordon de Tibidy où le flux est resserré.", confidence:"inference" },
      bars:{ text:"Biotope euryhalin classique du bar en fond de rade : gradient de salinité, proies concentrées, bars résidents doublés de poissons de passage sur le montant.", confidence:"inference" },
    },
    tidalRules:{
      typeHeure:"3 PREMIÈRES HEURES DE MONTANT (règle estuaire)",
      montantOuDescendant:"Montant dominant — les bars entrent avec le flot pour chasser dans le chenal et autour des parcs. Fin de descendant exploitable en postage à la sortie.",
      description:"Règle classique d'estuaire : trois premières heures de montant depuis BM+0h30. Les gros bars remontent avec la marée puis redescendent avec le jusant.",
      windows:[
        { id:"hc1", label:"3 premières heures de montant", phase:"bm", offsetBefore:0.5, offsetAfter:3.0, tidePhaseType:"montant", priority:"prime",
          note:"Règle la plus universelle en estuaire. Se poster sur les bordures du chenal ou le long du cordon de Tibidy." },
        { id:"hc2", label:"Fin de descendant (sortie d'estuaire)", phase:"bm", offsetBefore:-2.0, offsetAfter:-0.5, tidePhaseType:"descendant", priority:"bon",
          note:"Les bars quittent l'estuaire par le resserrement de Tibidy : embuscade en sortie." },
        { id:"hc3", label:"Début de descendant (postage chenal)", phase:"pm", offsetBefore:0.5, offsetAfter:2.5, tidePhaseType:"descendant", priority:"bon",
          note:"Shad plombé dans les veines profondes du chenal." },
      ],
      lifeHack:"Repérer les postes à basse mer : fosses du chenal, bordures herbeuses, parcs à huîtres. Fluorocarbone fin (25/100) car l'eau est claire. Texan indispensable pour ne pas s'accrocher dans les parcs. Le cordon de Tibidy se traverse à pied à basse mer en vive-eau — vérifier l'heure de retour avant de s'engager.",
    },
    lures:[
      { name:"Shad souple 10-12 cm en texan", color:"Natural / Smoke / Motor Oil", weight:"10-16 g", technique:"Référence estuaire. Texan anti-accrochage essentiel sur les parcs et les herbiers." },
      { name:"Jerkbait suspending 100-110 mm", color:"Ayu / Mullet / Crystal", weight:"12-16 g", technique:"Twitch lent dans les zones dégagées du chenal." },
      { name:"Pintail / slug weightless", color:"White UV / Natural", weight:"5-10 g sans plomb", technique:"Pêche à vue dans les bordures peu profondes si eau claire et soleil." },
    ],
    access:"Depuis Logonna : D770 vers L'Hôpital-Camfrout. Parkings du bourg et de Kerhascoët. Accès à Troaon, Kerdreolet et au cordon de Tibidy (l'îlot de Tibidy est privé : ne pas y monter). Bottes ou waders selon le poste.",
  },


  // ══════════════════════════════════════════════════════════
  // 4. SILLON DE LAUBERLAC'H — local (limite 25min)
  // ══════════════════════════════════════════════════════════
  {
    id:"lauberlach", zone:"local", isLocal:true, dangerLevel:1,
    name:"Sillon de Lauberlac'h", subtitle:"Anse de l'Auberlach, Plougastel-Daoulas",
    distance:"25 min", distMin:25, coords:"48°21'N 4°21'W",
    type:"SILLON / ANSE", color:"#86efac",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Sable-vase à l'intérieur de l'anse, galets sur le sillon, roche et platiers en bordure.",
      encombrement:2,
      gratter:"texan",
      couches:["surface", "sous-surface", "mi-eau", "fond"],
      montage:"Tête plombée légère au cœur de l'anse sableuse ; texan dès qu'on approche des platiers.",
      conseils:["Le long du sillon côté rade, prospecter en linéaire lent sans toucher les galets du pied de sillon."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"La passe du sillon « peut connaître un courant assez fort » ; accès bateau à ± 1 h de la pleine mer.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
        { t:"Plage intérieure : « le sable le plus accueillant (il peut y avoir quelques cailloux) ».", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
        { t:"Anse « assez exposée au S et SW », à éviter au mouillage en hiver.", s:"Forum Hisse et Ho — mouillages en rade de Brest" },
      ],
    },
    coefBand:[30,50,88,110],
    // Sillon : le courant fait le poste, mais le fond de rade plafonne naturellement les vitesses.
    coefMin:50, coefIdeal:88, coefMax:110, houleMax:1.5,
    exposedAngles:[202.5,180,225], shelteredAngles:[315,337.5,292.5],
    weatherNote:"Source lordjimcroisieres : 'Anse de l'Auberlach ouverte au Sud-Ouest et bien protégée des vents de Nord-Ouest jusqu'au sud-est.'",
    sources:[
      "voileaviron.org — livret des sites de la rade de Brest",
      "hisse-et-oh.com — forum mouillages en rade de Brest",
      "lordjimcroisieres.com — Navigation rade de Brest : Anse de l'Auberlach, exposition SO et protection NO→SE",
      "campingsaintjean.com — Porz Gwenn et Sillon de Lauberlac'h parmi les sites de pêche à pied/au leurre privilégiés",
      "peche.com — Pêche en rade de Brest (Nicolas/brestfishing)"
    ],
    topology:{
      fond:{ text:"Sillon = flèche de galets qui ferme partiellement l'anse. Sable-vase à l'intérieur, roche et platiers en bordure. Zone riche en coques/palourdes/couteaux (source camping Saint-Jean) = biotope pour le bar.", confidence:"verified" },
      structure:{ text:"Classique 'sillon' breton : cordon littoral parallèle à la côte qui crée une anse intérieure protégée. Les bars patrouillent le long du sillon côté rade, et entrent dans l'anse sur le flot. Cale et mouillages dans l'anse.", confidence:"verified" },
      exposition:{ text:"Source directe lordjimcroisieres : ouverte au SO, protégée NO→SE. Spot parfait par vent du secteur N à E. À éviter par fort vent SO.", confidence:"verified" },
      courant:{ text:"Courant modéré sur le sillon extérieur, très faible dans l'anse. Bascule de courant selon la marée qui entre/sort de l'anse.", confidence:"inference" },
      bars:{ text:"Plougastel figure 'parmi les sites les plus privilégiés pour la pêche depuis le bord' (camping Saint-Jean). Bars qui longent le sillon côté rade, patrouillent en bordure d'anse sur le montant.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"LE LONG DU SILLON SUR MONTANT + ANSE SUR FLOT PLEIN",
      montantOuDescendant:"Montant dominant : longer le sillon côté extérieur (rade) pour chercher les bars de passage, puis passer dans l'anse quand le flot y entre.",
      description:"Deux approches selon l'heure de marée : (1) côté rade du sillon = prospection longue distance sur montant ; (2) à l'intérieur de l'anse = pêche fine en bordure quand le flot a rempli.",
      windows:[
        { id:"la1", label:"Montant plein (flot établi)", phase:"bm", offsetBefore:1.5, offsetAfter:4.5, tidePhaseType:"montant", priority:"prime",
          note:"Longer le sillon côté rade, lancer parallèle à la côte. Les bars remontent le long du cordon." },
        { id:"la2", label:"Étale PM + début descendant (dans l'anse)", phase:"pm", offsetBefore:-0.5, offsetAfter:1.5, tidePhaseType:"renversement", priority:"prime",
          note:"Anse pleine, eau calme, bars en chasse fine sur les bordures. Pêche à vue ou LS weightless." },
        { id:"la3", label:"Crépuscule", phase:"pm", offsetBefore:-1.0, offsetAfter:2.0, tidePhaseType:"variable", priority:"bon",
          note:"Coup du soir universellement favorable, à cumuler avec une des deux fenêtres ci-dessus." },
      ],
      lifeHack:"Le sillon est long (~500m selon Landévennec/Sauvin, transposable ici). Repérer à BM les veines et les goémons. Le changement de côté (extérieur sillon → intérieur anse) suit la marée. Refuge par vent de secteur N quand les autres spots locaux sont moins confortables.",
    },
    lures:[
      { name:"Shad 10-14cm tête plombée", color:"Natural / Smoke / Ayu", weight:"10-18g", technique:"Prospection longue le long du sillon côté rade." },
      { name:"Stickbait 110-130mm", color:"Ghost / Sardine", weight:"18-28g", technique:"Surface au-dessus du sillon et en entrée d'anse sur montante." },
      { name:"LS weightless (pintail, slug)", color:"White / Natural / UV", weight:"5-10g sans plomb", technique:"Pêche fine dans l'anse à eau calme, à vue si possible. Approche silencieuse." },
    ],
    access:"D770 puis direction Lauberlac'h / Plougastel-Daoulas sud. Parking à la cale de l'anse. Sentier côtier (GR34) longe le sillon — accès direct aux deux côtés. Pas de difficulté technique.",
  },

  // ══════════════════════════════════════════════════════════
  // 5. POINTE DE L'ARMORIQUE — intermédiaire
  // ══════════════════════════════════════════════════════════
  {
    id:"armorique", zone:"inter", isLocal:false, dangerLevel:1,
    name:"Pointe de l'Armorique", subtitle:"Plougastel-Daoulas nord",
    distance:"30 min", distMin:30, coords:"48°21'N 4°25'W",
    type:"POINTE RADE", color:"#14b8a6",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Roche et platiers, tombant plus marqué qu'en fond de rade.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface", "mi-eau"],
      montage:"Leurres coulants comptés (sinking pencil, shad) pour rester au-dessus du tombant.",
      conseils:["Compter la descente du leurre et la raccourcir dès le premier contact avec la roche.", "Lancer contre le courant et laisser dériver en aval de la pointe."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
    },
    coefBand:[35,55,90,112],
    // Pointe majeure exposée au flux principal : supporte les vives-eaux.
    coefMin:55, coefIdeal:90, coefMax:112, houleMax:1.5,
    exposedAngles:[270,292.5,247.5], shelteredAngles:[90,112.5,67.5],
    weatherNote:"Pointe qui avance dans la rade, côté nord de Plougastel. Source lordjimcroisieres : 'le courant est bien sensible à la pointe de l'Armorique' — un des points de courant notable de la rade.",
    sources:[
      "lordjimcroisieres.com — Pointe de l'Armorique citée comme point de courant sensible (0.5-3 nds) en rade",
      "peche.com — Pêche rade de Brest (sparidés en bordure des tombants de sortie de rade vers goulet)",
      "peche.com — Principes pointes rocheuses / tourbillons"
    ],
    topology:{
      fond:{ text:"Tombant plus marqué qu'en fond de rade. Roche et platiers. Source peche.com : les tombants de sortie de rade en direction du goulet concentrent les sparidés (et donc le bar qui les suit).", confidence:"verified" },
      structure:{ text:"Pointe majeure de la rade, sur la trajectoire des poissons qui entrent/sortent entre fond de rade et goulet. Tourbillon classique en aval de la pointe selon sens du courant (principe peche.com documenté sur toute pointe).", confidence:"verified" },
      exposition:{ text:"Orientée NO. Vent d'E/NE = bien abrité. Vent O/NO/SO = exposition frontale, la rade peut se lever avec du clapot.", confidence:"inference" },
      courant:{ text:"Source directe lordjimcroisieres : 0.5-3 nds selon marée et coef. Un des 4 points de courant sensible de la rade (avec Espagnols, pont Plougastel, sortie Aulne).", confidence:"verified" },
      bars:{ text:"Pointe sur zone de passage = poste classique pour bars de passage entre rade et goulet. Gros bars possibles en fin de saison quand les poissons redescendent vers le goulet.", confidence:"inference" },
    },
    tidalRules:{
      typeHeure:"DESCENDANT (tourbillon aval) + DÉBUT MONTANT",
      montantOuDescendant:"Pointe = les deux marchent, mais le descendant expose mieux les tombants. Principe peche.com pointes rocheuses : lancer en amont du courant, dérive en aval.",
      description:"Pointe de rade avec courant notable. Changer de côté selon sens du courant : côté NE sur descendant (courant qui s'échappe vers le goulet), côté SO sur montant.",
      windows:[
        { id:"ar1", label:"1-2h après PM (descendant)", phase:"pm", offsetBefore:1.0, offsetAfter:2.5, tidePhaseType:"descendant", priority:"prime",
          note:"Courant établi vers le goulet. Leurre coulant en amont, dérive en aval de la pointe." },
        { id:"ar2", label:"3 dernières heures avant BM", phase:"bm", offsetBefore:-3.0, offsetAfter:-0.5, tidePhaseType:"descendant", priority:"prime",
          note:"Reprise du courant descendant. Fenêtre classique pointes rocheuses." },
        { id:"ar3", label:"Début de montant (côté SO)", phase:"bm", offsetBefore:0.5, offsetAfter:2.5, tidePhaseType:"montant", priority:"bon",
          note:"Bascule de côté. Le flot remonte vers le fond de rade, bars de passage." },
      ],
      lifeHack:"Sur cette pointe le courant peut atteindre 3 nds : utiliser des leurres plus lourds qu'ailleurs en rade (25-40g). Repérer les tourbillons visuellement (surface) avant de placer le leurre.",
    },
    lures:[
      { name:"Sinking pencil / Asturie 110-130", color:"Ayu / Ghost / Bar naturel", weight:"25-40g", technique:"Principe pointes rocheuses : lancer contre courant, dérive lente en aval." },
      { name:"Shad 5″ tête plombée lourde", color:"White / Natural / Chartreuse", weight:"18-28g", technique:"Prospection du tombant sur courant établi." },
      { name:"Stickbait 125-140mm", color:"Sardine / Ghost", weight:"25-35g", technique:"Walk-the-dog en surface au crépuscule si pas trop de courant. Patchinko 125 ou 140 adapté." },
    ],
    access:"Depuis Logonna : D770 puis direction Plougastel-Daoulas nord, route de la Pointe de l'Armorique. Parking en bout de route. Sentier côtier. Accès rochers par descente courte.",
  },

  // ══════════════════════════════════════════════════════════
  // 6. LANDÉVENNEC — Port Maria + Sillon des Anglais
  // ══════════════════════════════════════════════════════════
  {
    id:"landevennec", zone:"inter", isLocal:false, dangerLevel:1,
    name:"Landévennec", subtitle:"Cale de Port Maria + Sillon des Anglais",
    distance:"35 min", distMin:35, coords:"48°18'N 4°16'W",
    type:"ANSE + SILLON", color:"#06b6d4",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Platiers et sable, cordes de moules le long du Sillon des Anglais, mouillages et goémon à Port Maria.",
      encombrement:2,
      gratter:"texan",
      couches:["surface", "sous-surface", "mi-eau", "fond"],
      montage:"Weightless entre les goémons et les mouillages ; tête légère seulement le long du sillon, parallèle aux cordes.",
      conseils:["Ne jamais lancer en travers des cordes de moules : longer."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"Près du cimetière de bateaux : « berges composées de roches à huîtres avec du goémon qui descend dans l'eau », plage de galets d'ardoise.", s:"peche.com — « À la recherche du bar du côté du cimetière de bateaux en fond de rade de Brest »" },
        { t:"Même article : une dizaine de bars maillés, autour de 60 cm, en traîne lente de poissons nageurs le long des tombants, coefficient 50, basse mer vers 9 h 30.", s:"peche.com" },
        { t:"Sillon des Anglais : tombants à la tête est de la flèche ; pas d'accès routier.", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
      ],
    },
    coefBand:[30,50,85,108], coefHardMax:115,
    // Confluence Aulne/rade, courant soutenu : au-delà de 115 le sillon n'est plus tenable du bord.
    coefMin:50, coefIdeal:85, coefMax:108, houleMax:1.2,
    exposedAngles:[315,337.5,292.5], shelteredAngles:[135,157.5,112.5],
    weatherNote:"Source peche-poissons.com : Landévennec niché 'au fin fond de la rade de Brest, pieds dans l'eau, abrité des vents dominants, climat clément (palmiers).'",
    sources:[
      "peche.com — À la recherche du bar du côté du cimetière de bateaux en fond de rade de Brest",
      "voileaviron.org — livret des sites de la rade de Brest",
      "peche-poissons.com / Thierry Sauvin — 'Escapade en rade de Brest, autour de Landévennec' (article de référence dédié)",
      "peche.com — Rade de Brest (principes)",
      "lordjimcroisieres.com — Navigation Landévennec"
    ],
    topology:{
      fond:{ text:"Source Sauvin : Cale de Port Maria avec mouillages bateaux de plaisance, bars qui maraudent entre les mouillages. Sillon des Anglais = 'flèche parallèle à la côte de près de 500m, élevages de moules qui bordent le littoral', platiers et sable.", confidence:"verified" },
      structure:{ text:"Cale de Port Maria en bordure de l'église Notre-Dame = spot urbain confortable. Sillon des Anglais plus sauvage, accès GR34 dans la forêt domaniale. Les deux sont complémentaires selon marée et conditions.", confidence:"verified" },
      exposition:{ text:"Source directe Sauvin : 'abrité des vents dominants'. Encaissement de la vallée de l'Aulne = protection maximale. Quasi inattaquable sauf par vent de N/NE strict.", confidence:"verified" },
      courant:{ text:"Source lordjimcroisieres : courant sensible à la sortie de l'Aulne (Landévennec). Marnage 6m en VE. Coude de l'Aulne crée des veines et contre-courants.", confidence:"verified" },
      bars:{ text:"Source directe Sauvin : Cale Port Maria 'très prisée par les pêcheurs aux leurres, bars qui maraudent entre les mouillages'. Sillon des Anglais 'bars s'approchent, attirés par les élevages de moules'.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"MONTANT + ÉTALES (petits coefficients privilégiés)",
      montantOuDescendant:"Montant principalement pour les deux spots. Les bars remontent l'Aulne avec le flot. Étales favorables pour Port Maria (eau calme, bars entre mouillages).",
      description:"Fond de rade = logique estuaire classique + particularité des petits coefs. La zone voisine de Térénez est explicitement citée pour 'faibles coefs 40-55' par Sauvin, logique transposable.",
      windows:[
        { id:"lv1", label:"Début de montant (Port Maria)", phase:"bm", offsetBefore:0.5, offsetAfter:3.0, tidePhaseType:"montant", priority:"prime",
          note:"Bars de marée entre les mouillages, pêche fine. LS weightless idéal." },
        { id:"lv2", label:"Flot établi (Sillon des Anglais)", phase:"bm", offsetBefore:1.5, offsetAfter:4.0, tidePhaseType:"montant", priority:"prime",
          note:"Longer le sillon côté rade, parallèle aux élevages de moules. Bars attirés par la nourriture des cordes de moules." },
        { id:"lv3", label:"Étale PM (Port Maria fine)", phase:"pm", offsetBefore:-0.5, offsetAfter:0.5, tidePhaseType:"renversement", priority:"bon",
          note:"Cale au calme, pêche à vue ou micro-leurres weightless. Reference Sauvin." },
      ],
      lifeHack:"Approche très fine, eau souvent limpide dans le coude de l'Aulne. Sauvin recommande pêche à la mouche avec petites imitations de crabes comme alternative. Canne light 5-15g, fluoro 25/100 max.",
    },
    lures:[
      { name:"LS weightless (slug, pintail)", color:"Natural / White / UV", weight:"3-10g sans plomb", technique:"Référence Sauvin pour Port Maria et Térénez : 'leurre souple non lesté entre les goémons'. Arme maîtresse du fond de rade." },
      { name:"Shad 3-4″ tête plombée légère", color:"Natural / Smoke / Ayu", weight:"7-14g", technique:"Le long du Sillon des Anglais, parallèle aux cordes de moules." },
      { name:"Petit jerkbait 90-110mm", color:"Crystal / Ayu", weight:"8-14g", technique:"Entre les mouillages de Port Maria. Animations subtiles." },
    ],
    access:"Depuis Logonna : Le Faou puis D60/D791 vers Landévennec. Port Maria = bord de route, parking église Notre-Dame. Sillon des Anglais = GR34 depuis Landévennec, marche dans la forêt domaniale (15-20min).",
  },

  // ══════════════════════════════════════════════════════════
  // 7. ÎLE DE TÉRÉNEZ — intermédiaire
  // ══════════════════════════════════════════════════════════
  {
    id:"terenez", zone:"inter", isLocal:false, dangerLevel:2,
    name:"Île de Térénez", subtitle:"Sortie de l'Aulne, Rosnoën",
    distance:"40 min", distMin:40, coords:"48°16'N 4°16'W",
    type:"ÎLE TIDALE", color:"#0891b2",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Roche et goémon dense côté rade ; sable et galets côté Aulne ; tombants abrupts à la pointe ouest.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface"],
      montage:"Weightless entre les goémons (référence Sauvin). Côté Aulne seulement, une tête légère sur le sable.",
      conseils:["Côté rade, pêcher comme à Moulin Mer : au-dessus du goémon, lentement, avec des arrêts."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
    },
    coefBand:[25,45,80,100], coefHardMax:110,
    // Étranglement de l'Aulne : la vitesse y monte très vite avec le coefficient.
    coefMin:45, coefIdeal:80, coefMax:100, houleMax:1.2,
    exposedAngles:[315,337.5,0], shelteredAngles:[135,157.5,180],
    weatherNote:"Source Sauvin : 'accessible à marée basse et en permanence si coef inférieur à 85'. Attention accès conditionné à la marée.",
    sources:[
      "peche-poissons.com / Thierry Sauvin — Article dédié : Île de Térénez 'spot intéressant, très productive en LS non lesté entre les goémons'",
      "lordjimcroisieres.com — Sortie Aulne / Landévennec courant",
    ],
    topology:{
      fond:{ text:"Île rocheuse avec goémons denses côté rade. Sable et galets côté Aulne. Tombants abrupts côté pointe ouest.", confidence:"verified" },
      structure:{ text:"Source directe Sauvin : 'île qu'on rejoint par la D791, rive droite d'Aulne. Accessible à marée basse, et en permanence si coef < 85'. Deux faces : côté rade pour le leurre, bout d'île pour le surfcasting.", confidence:"verified" },
      exposition:{ text:"Sortie de l'Aulne. Protégée O/SO par Landévennec. Exposée NO/N vers la rade.", confidence:"inference" },
      courant:{ text:"Zone de sortie Aulne = courant sensible selon lordjimcroisieres. Plus marqué en VE forte.", confidence:"verified" },
      bars:{ text:"Source directe Sauvin : 'Côté rade, la pêche du bar est très productive en animant un leurre souple non lesté entre les goémons. On peut aussi le traquer à vue avec de micro leurres souples ou bien à la mouche avec de petites imitations de crabes.' Au bout : 'très gros bars en surfcasting (demi-tête de calamar ou sardine entière), mais beaucoup de matériel perdu'.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"PETITS COEFS 40-55, 1h AVANT/APRÈS ÉTALES",
      montantOuDescendant:"Source directe Sauvin : 'Le secteur est surtout pêchant par faible coefficient (40 à 55), une heure avant et après les étales.' Inversion totale de la règle classique.",
      description:"Spot atypique : les petits coefficients sont explicitement privilégiés. Pêche fine à l'étale. Le bar est en chasse sans être dérangé par un courant fort.",
      windows:[
        { id:"te1", label:"Étale BM (±1h)", phase:"bm", offsetBefore:-1.0, offsetAfter:1.0, tidePhaseType:"renversement", priority:"prime",
          note:"Source Sauvin directe. Coef 40-55 idéal. Accès à pied à BM." },
        { id:"te2", label:"Étale PM (±1h)", phase:"pm", offsetBefore:-1.0, offsetAfter:1.0, tidePhaseType:"renversement", priority:"prime",
          note:"Idem étale BM, eau pleine, pêche en bordure goémon." },
      ],
      lifeHack:"Surveiller le coef de très près : si > 85, on reste bloqué sur l'île à marée haute. Prendre la montre. Les micro-leurres souples à la mouche sont l'alternative de Sauvin pour les très gros bars en méfiance.",
    },
    lures:[
      { name:"LS weightless 10-14cm", color:"Natural / Motor Oil / Ayu", weight:"7-12g sans plomb", technique:"L'arme maîtresse selon Sauvin. Promené entre les goémons, récupé lente avec pauses." },
      { name:"Micro LS à vue", color:"Natural / White", weight:"3-5g sans plomb", technique:"Source Sauvin : traque à vue avec des micro leurres souples. Approche silencieuse obligatoire." },
      { name:"Surfcasting bout d'île (hors scope leurre)", color:"–", weight:"120-150g", technique:"Non-leurre : source Sauvin, demi-tête de calamar ou sardine entière pour les très gros bars. À n'envisager qu'en connaissant les postes (beaucoup de casse)." },
    ],
    access:"D770 vers Le Faou puis D791 rive droite de l'Aulne direction Landévennec, fléchage Térénez. Parking en bord de grève. Traversée à pied à marée basse (vérifier le coef !). Retour obligatoire avant le flot.",
  },

  // ══════════════════════════════════════════════════════════
  // 8. POINTE DES ESPAGNOLS / ROSCANVEL
  // ══════════════════════════════════════════════════════════
  {
    id:"espagnols", zone:"far", isLocal:false, dangerLevel:2,
    name:"Pointe des Espagnols", subtitle:"Roscanvel, entrée du Goulet",
    distance:"55 min", distMin:55, coords:"48°20'N 4°32'W",
    type:"GOULET / COURANT FORT", color:"#f59e0b",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Granite, failles et plateaux rocheux, tombants vertigineux.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface", "mi-eau"],
      montage:"Sinking pencil et leurres lourds comptés ; le jig vertical dans les failles casse beaucoup : prévoir des rechanges.",
      conseils:["Pêcher les renverses de courant ; en plein courant, le leurre ne tient pas sa couche."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
      // Faits précis tirés de sources citées (recherche du 10/10/2026).
      faits:[
        { t:"Herbier de zostères « en ruban » sur la côte de Roscanvel, près de la pointe des Espagnols (station de suivi).", s:"Ifremer REBENT — lieux des herbiers de Zostera marina" },
        { t:"La roche de la Cormorandière « fait l'objet de tourbillons que l'on se gardera bien d'approcher ».", s:"Voile-Aviron, livret « 50 sites de la rade de Brest »" },
      ],
    },
    coefBand:[35,55,85,105], coefHardMax:112,
    // Verrou du goulet, l'un des courants les plus forts de la rade.
    coefMin:55, coefIdeal:85, coefMax:105, houleMax:1.5,
    exposedAngles:[270,292.5,315], shelteredAngles:[90,112.5,67.5],
    weatherNote:"Source lordjimcroisieres : 'le courant s'engouffre entre la pointe et la roche de la Cormorandière'. Entrée nord du Goulet de Brest.",
    sources:[
      "rebent.ifremer.fr — FL05 lieux des herbiers de Zostera marina (Roscanvel)",
      "voileaviron.org — livret des sites de la rade de Brest",
      "brestfishing.fr — Guide rade de Brest : Goulet 'canyon sous-marin où les courants de marée peuvent se révéler assez violents, plateaux rocheux (Plateau des Fillettes, Roche du Mengan)'",
      "lordjimcroisieres.com — Courant sensible à la Pointe des Espagnols, refuge sous la pointe pour attendre la renverse",
      "mieuxpecher.com — 'Pointe des Espagnols, à condition de trouver les accès…' listée comme spot rade de Brest",
      "generationvoyage.fr — Roscanvel : 'bars, aiguillettes, vieilles en avançant dans l'eau'"
    ],
    topology:{
      fond:{ text:"Source brestfishing : plateaux rocheux des Fillettes et Mengan, tombants vertigineux, roches. Granite dur, failles, cailloux immergés.", confidence:"verified" },
      structure:{ text:"Pointe à l'entrée nord du Goulet de Brest (canyon sous-marin 1500m × 3000m). Roche de la Cormorandière juste au large. Tourbillons violents en plein courant, contre-courants dans l'anse sous la pointe (refuge bateaux).", confidence:"verified" },
      exposition:{ text:"Source lordjimcroisieres : falaise verdoyante qui protège partiellement. Exposée plein ouest. Les vents O/NO renforcent le courant quand ils sont contre-marée.", confidence:"verified" },
      courant:{ text:"Source lordjimcroisieres : courant qui s'engouffre entre pointe et Cormorandière. Vive-eau = 3 nds + sur la veine principale. Impêchable en plein courant sauf bras de contre-courant.", confidence:"verified" },
      bars:{ text:"Zone documentée pour bars et lieus. Pression de pêche limitée par la difficulté d'accès aux postes (mieuxpecher : 'à condition de trouver les accès'). Poste à gros poissons en renverse.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"RENVERSE + CONTRE-COURANTS SOUS LA POINTE",
      montantOuDescendant:"Le courant principal est souvent impêchable — chercher la renverse (étales) ou se poster dans un contre-courant abrité.",
      description:"Logique Goulet : les poissons profitent du courant pour chasser, le pêcheur doit se positionner où le courant est exploitable (contre-courants, renverses, petites criques abritées).",
      windows:[
        { id:"es1", label:"Étale BM (±45min)", phase:"bm", offsetBefore:-0.7, offsetAfter:0.7, tidePhaseType:"renversement", priority:"prime",
          note:"Courant s'annule, postes accessibles. Fenêtre courte, prévoir d'arriver 1h avant." },
        { id:"es2", label:"Étale PM (±45min)", phase:"pm", offsetBefore:-0.7, offsetAfter:0.7, tidePhaseType:"renversement", priority:"prime",
          note:"Identique BM. Attention : le courant reprend vite." },
        { id:"es3", label:"Contre-courant sous la pointe", phase:"pm", offsetBefore:1.0, offsetAfter:3.0, tidePhaseType:"variable", priority:"bon",
          note:"Source lordjimcroisieres : sous la pointe, à l'abri du courant principal, pêche possible en pleine marée." },
      ],
      lifeHack:"Repérage absolument indispensable avant première session (accès + lecture courants). Coef modéré 50-70 privilégié pour commencer (logique identique à peche.com sur Hague). Sécurité stricte : ne jamais pêcher en plein courant, gilet, semelles crantées.",
    },
    lures:[
      { name:"Sinking pencil / Asturie lourd", color:"Ghost / Iwashi / Sardine", weight:"30-45g", technique:"Travail dans le courant résiduel en renverse. Dérive naturelle." },
      { name:"Slug / shad plombé lourd", color:"Pearl / White UV", weight:"35-50g", technique:"Jig vertical dans les failles et tombants des plateaux. Les Fillettes sont réputées pour les lieus." },
      { name:"Leurre 10-12cm sardine/bleu", color:"Sardine / Bleu", weight:"20-30g", technique:"Principe peche.com (documenté sur Hague, transposable Goulet) : coloris bleu/sardine pour lieus jaunes en début de saison + bars." },
    ],
    access:"Depuis Logonna : pont Albert-Louppe/Iroise puis D791 presqu'île de Crozon, direction Roscanvel/Pointe des Espagnols. Parking au bout de la pointe. Accès rochers par sentier — repérage conseillé. Niveau expérimenté.",
  },

  // ══════════════════════════════════════════════════════════
  // 9. POINTE DU PETIT MINOU
  // ══════════════════════════════════════════════════════════
  {
    id:"minou", zone:"far", isLocal:false, dangerLevel:2,
    name:"Pointe du Petit Minou", subtitle:"Plouzané, Goulet nord",
    distance:"1h00", distMin:60, coords:"48°20'N 4°37'W",
    type:"POINTE / PHARE", color:"#fb923c",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Roche, galets, tombants vers le canyon du Goulet, estran accidenté.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface", "mi-eau"],
      montage:"Leurres comptés pour longer le tombant sans le toucher.",
      conseils:["Même logique qu'aux Espagnols : renverses, contre-courants des criques, jamais de raclage."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
    },
    coefBand:[35,55,88,110],
    // Entrée nord du goulet : plateau battu, tolère les gros coefficients.
    coefMin:55, coefIdeal:88, coefMax:110, houleMax:1.8,
    exposedAngles:[225,247.5,270], shelteredAngles:[45,67.5,90],
    weatherNote:"Rive nord du Goulet, face au Goulet et à la mer d'Iroise. Exposée SW plein (Atlantique).",
    sources:[
      "brestfishing.fr — Goulet de Brest (principes généraux, plateaux rocheux)",
      "peche.com — Pointes rocheuses (principes)",
    ],
    topology:{
      fond:{ text:"Roche, galets, tombants vers le canyon du Goulet. Phare du Petit Minou en repère. Estran accidenté.", confidence:"inference" },
      structure:{ text:"Pointe rive nord du Goulet, symétrique de la Pointe des Espagnols. Logique identique : courant fort en plein Goulet, contre-courants et criques abritées le long du littoral. Plage sous le phare accessible.", confidence:"inference" },
      exposition:{ text:"Face SO/O. Prend la houle d'Atlantique directement si elle rentre par le Goulet. Vent d'E/NE = bien abrité.", confidence:"inference" },
      courant:{ text:"Courant du Goulet, 2-3 nds en VE selon zone. Accélération devant le phare. Plus calme dans les petites anses adjacentes.", confidence:"inference" },
      bars:{ text:"Zone Goulet = bars et lieus documentés (brestfishing). Postes à gros possibles mais pression de pêche plus forte qu'aux Espagnols car accès plus facile.", confidence:"inference" },
    },
    tidalRules:{
      typeHeure:"DESCENDANT + RENVERSEMENT",
      montantOuDescendant:"Descendant dominant (principe pointes), renversement également exploitable. Le flot arrive trop fort pour la pêche au leurre en plein Goulet.",
      description:"Pointe rocheuse classique avec particularité Goulet : le courant conditionne tout. Privilégier fin de descendant + étale BM + tout début de montant.",
      windows:[
        { id:"pm1", label:"3 dernières heures avant BM", phase:"bm", offsetBefore:-3.0, offsetAfter:-0.5, tidePhaseType:"descendant", priority:"prime",
          note:"Descendant qui faiblit, postes accessibles, bars qui chassent." },
        { id:"pm2", label:"Étale BM (±45min)", phase:"bm", offsetBefore:-0.7, offsetAfter:0.7, tidePhaseType:"renversement", priority:"prime",
          note:"Courant s'annule, moment optimal pour les plus gros postes sous le phare." },
        { id:"pm3", label:"1-2h après PM (descendant)", phase:"pm", offsetBefore:1.0, offsetAfter:2.5, tidePhaseType:"descendant", priority:"bon",
          note:"Courant encore fort mais exploitable côté anses protégées." },
      ],
      lifeHack:"Houle de SO dangereuse : respect strict du houleMax 1.8m, au-delà pêcher depuis les petites anses abritées plutôt que la pointe principale. Accessibilité du poste dépend de la marée ET de la houle du jour.",
    },
    lures:[
      { name:"Asturie 130 / sinking pencil", color:"Ghost / Iwashi / Sardine", weight:"30-45g", technique:"Pêche dans le courant du Goulet, dérive contre courant." },
      { name:"Slug / shad lourd", color:"Pearl / White / UV", weight:"35-50g", technique:"Travail du tombant à la verticale." },
      { name:"Patchinko 140-165", color:"Ghost / Sardine", weight:"35-55g", technique:"Walk-the-dog sur les plus beaux jours calmes, chasses visibles. Patchinko 165 RB pour les cast longs." },
    ],
    access:"D789 depuis Brest direction Plouzané / phare du Petit Minou. Parking devant le phare (gratuit). Descente par sentier GR34 vers les rochers. Possibilité de pêcher depuis la plage en contrebas.",
  },

  // ══════════════════════════════════════════════════════════
  // 10. POINTE DE PEN-HIR / CAMARET — le plus loin
  // ══════════════════════════════════════════════════════════
  {
    id:"penhir", zone:"far", isLocal:false, dangerLevel:3,
    name:"Pointe de Pen-Hir", subtitle:"Camaret-sur-Mer, mer d'Iroise",
    distance:"1h15", distMin:75, coords:"48°15'N 4°37'W",
    type:"CÔTE OCÉANIQUE", color:"#ef4444",
    // Fiche terrain : ce que le fond permet ou interdit, et comment monter le leurre.
    terrain:{
      fond:"Granite massif, succession de basses rocheuses.",
      encombrement:3,
      gratter:"non",
      couches:["surface", "sous-surface", "mi-eau"],
      montage:"Stickbait et sinking pencil ; leurre coulant compté sur les basses accessibles.",
      conseils:["Les basses se lisent à marée basse : les repérer avant de pêcher le flot."],
      confidence:"inference",
      source:"Déduit de la description du fond de ce spot",
    },
    coefBand:[25,45,90,115],
    // Régime océanique : l'activité dépend bien plus de la houle que du coefficient.
    coefMin:45, coefIdeal:90, coefMax:115, houleMax:1.5,
    exposedAngles:[270,247.5,225], shelteredAngles:[90,67.5,45],
    weatherNote:"Source brestfishing : 'Dans le prolongement de la pointe de Pen Hir ce récif se prolonge loin dans la mer. Une succession de basses nous offre une multitude de poste de pêche.' Côte océanique pleine, houle Atlantique.",
    sources:[
      "brestfishing.fr — Pen-Hir 'récif prolongé, succession de basses, gros bars et lieus'",
      "mieuxpecher.com — Pen-Hir listée dans les spots Finistère (Pointe du Grand Grouin, Château de Dinan, Lostmarc'h voisins)",
      "peche.com — Principes côtes rocheuses exposées"
    ],
    topology:{
      fond:{ text:"Source brestfishing : récif qui se prolonge loin en mer avec succession de 'basses' (hauts-fonds rocheux). Granite massif. Fond très variable selon distance à la côte.", confidence:"verified" },
      structure:{ text:"Pointe extrême, face à l'Atlantique. Tas de Pois au large (rochers iconiques). Zone de passage entre rade et baie de Douarnenez. Gros gibier : bars trophées, lieus, pagres, dauphins.", confidence:"verified" },
      exposition:{ text:"Exposition plein O/SO, houle d'Atlantique directe. Refuge possible côté nord/NE en vent de SO fort (anse de Pen-Hat).", confidence:"inference" },
      courant:{ text:"Courant de la mer d'Iroise, modéré à fort selon coef et zone. Pas comparable au Raz Blanchard mais mérite attention en VE.", confidence:"inference" },
      bars:{ text:"Source brestfishing : 'des poissons qui atteignent des tailles intéressantes', bars et gros lieus. Chasses en surface possibles avec fous de Bassan. Pression de pêche modérée par difficulté d'accès certains postes.", confidence:"verified" },
    },
    tidalRules:{
      typeHeure:"DESCENDANT + LEVER/COUCHER (principe côte océanique)",
      montantOuDescendant:"Descendant dominant sur les basses. Lever et coucher de soleil + coef 70-85 = configuration optimale (principe peche.com + fiiish.com cumulé).",
      description:"Côte océanique classique : courant + houle résiduelle + éclairage faible = déclencheurs majeurs. Les basses du récif sont les postes, chacune à tester selon le courant du jour.",
      windows:[
        { id:"ph1", label:"Descendant plein (1-3h après PM)", phase:"pm", offsetBefore:1.0, offsetAfter:3.0, tidePhaseType:"descendant", priority:"prime",
          note:"Courant établi sur les basses. Leurre coulant dans la dérive." },
        { id:"ph2", label:"3 dernières heures avant BM", phase:"bm", offsetBefore:-3.0, offsetAfter:-0.5, tidePhaseType:"descendant", priority:"prime",
          note:"Reprise courant, fenêtre classique pointes océaniques." },
        { id:"ph3", label:"Crépuscule (lever/coucher)", phase:"pm", offsetBefore:-1.0, offsetAfter:1.0, tidePhaseType:"variable", priority:"prime",
          note:"Principe fiiish.com/peche.com : éclairage faible + marée favorable = session optimale. Grosses chasses possibles." },
      ],
      lifeHack:"Spot dangereux par houle : respect strict du houleMax 1.5m, vérifier le bulletin mer d'Iroise. Jamais seul, gilet obligatoire. Pour les trophées : coef 70-85, coup du soir, stickbaits grande taille (Patchinko 165 au cast long).",
    },
    lures:[
      { name:"Patchinko / stickbait grande taille", color:"Ghost / Sardine / Iwashi", weight:"35-55g", technique:"Walk-the-dog sur les chasses visibles ou sur les basses au crépuscule. Patchinko 165 en White Ghost RB (validé par toi)." },
      { name:"Asturie 130 / sinking pencil lourd", color:"Yellow Bone / Ayu / Ghost", weight:"35-50g", technique:"Travail en dérive dans le courant sur les basses. Leurre maîtresse des pointes exposées." },
      { name:"Slug coulant / shad plombé", color:"Pearl / UV / White", weight:"40-60g", technique:"Prospection profonde des basses les plus au large accessibles au cast." },
    ],
    access:"Depuis Logonna : pont Iroise/Albert-Louppe, D791 direction Crozon/Camaret. Parking Pointe de Pen-Hir (monument aux Bretons). Sentier GR34 puis descente technique aux rochers. Niveau pêcheur expérimenté + conditions calmes impératives.",
  },
];
