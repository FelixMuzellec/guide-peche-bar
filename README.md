# Guides de pêche du bar — Logonna-Daoulas & Pirou Plage

Deux applications web indépendantes pour la pêche du bar aux leurres du bord :

- **Logonna-Daoulas** (rade de Brest) : 11 spots, du fond de rade au goulet → `logonna.html`
- **Pirou Plage** (côte ouest du Cotentin) : 10 spots, de Granville à Goury → `pirou.html`

Version 8.1.

Elles s'ouvrent dans le navigateur du téléphone et s'installent sur l'écran d'accueil.
Une fois ouvertes, elles fonctionnent hors ligne : la marée est calculée sur l'appareil, et la dernière météo téléchargée reste affichée.

Adresse : <https://felixmuzellec.github.io/guide-peche-bar/>

## Organisation du dépôt

```
index.html            accueil                                  ┐
logonna.html, pirou.html                                       │ le site publié par GitHub Pages :
logonna-manifest.json, pirou-manifest.json                     │ fichiers construits, à la racine,
logonna.png, pirou.png                                         │ à ne pas modifier à la main
sw.js                 fonctionnement hors ligne                │
.nojekyll             fichiers servis tels quels               ┘
src/                  les sources
  engine/               le moteur, commun aux deux applications
    core.js               soleil, lumière, effet du vent selon le type de spot
    tide.js               marée (prédiction harmonique, heure de Paris)
    weather.js            météo Open-Meteo, incertitude entre modèles, cache
    model.js              fenêtres, note, saison, terrain, proies, pression, orientation
    journal.js            journal de session, recalibrage, prises par heure
    rules.js              réglementation 2026, remise à l'eau, sécurité par spot
    lures.js              conseil leurres sourcé (type, couleur, taille, montage, animation) et ta boîte
    persist.js            stockage
  sites/                ce qui est propre à chaque lieu
    logonna.config.js     spots, fiches terrain, sécurité, zones, ports de marée, proies
    pirou.config.js
  ui/                   l'interface
    App.jsx               données du jour et navigation par onglets
    kit.jsx               cartes, tuiles, puces, sources : le style commun
    TabBar.jsx, MapView.jsx, Orientation.jsx, components.jsx
    tabs/                 un fichier par onglet : Synthese, Spots (+ SpotDetail), Leurres,
                          Maree, Meteo, Saison, JournalTab, Regles
  main.jsx, storage.js, sync.jsx, index.html
  sw.template.js        modèle du sw.js (nommé ainsi pour ne jamais écraser le sw.js construit)
tests/
  unit.mjs              moteur + schéma des fiches + contrôle de la marée de Pirou
  e2e.mjs               parcours complet dans Chromium (téléphone simulé)
  contract.mjs          contrat avec le vrai service Open-Meteo
  om_mock.mjs           simulateur d'Open-Meteo
  ref/                  tables de référence (marée de Pirou, octobre 2026)
scripts/build.mjs     construit les 8 fichiers du site, à la racine, depuis src/
assets/               icônes sources
.github/workflows/    tests à chaque dépôt, contrat Open-Meteo chaque matin
```

Pour corriger la description d'un spot, le seul fichier à modifier est `src/sites/<site>.config.js` ; les tests vérifient ensuite la cohérence de la fiche (coordonnées, secteurs de vent, bande de coefficient, port de marée, terrain, sécurité).

## Publication sur GitHub Pages

Settings → Pages → *Deploy from a branch* → Branch `main`, dossier `/ (root)` → Save.

Mettre le site à jour depuis le téléphone : *Add file → Upload files* à la racine du dépôt, avec les 8 fichiers du site
(`index.html`, `logonna.html`, `pirou.html`, `logonna-manifest.json`, `pirou-manifest.json`, `logonna.png`, `pirou.png`, `sw.js`).
Ne jamais déposer un fichier de `src/` à la racine. Après un dépôt, vérifier qu'aucun doublon « (1) », « (2) » n'a été créé.

## Ce que fait chaque application

L'écran est organisé en onglets (l'onglet ouvert est inscrit dans l'adresse, `#leurres` par exemple, et le bouton retour du téléphone revient au précédent) :

- **Synthèse** : le meilleur spot et son créneau, le leurre conseillé pour ce créneau, le meilleur créneau de plein jour quand le verdict tombe à l'aube, au crépuscule ou de nuit, les conditions du jour en six tuiles (vent, mer, marée, soleil, eau et saison, pression) — chaque tuile ouvre l'onglet qui la détaille —, les autres choix, la semaine et la règle du jour.
- **Spots** : mes heures de pêche, la carte, le classement, la fiche du spot (créneaux, terrain, leurres, accès).
- **Leurres** : pour un spot et un créneau, la famille de leurre, la couleur, la taille, le montage et l'animation, chaque conseil avec sa source ; ce qui colle dans ta boîte (ou, à défaut, le plus proche et ce qui diffère) ; les leurres de la fiche classés ; les proies du mois ; les repères (couleurs, familles, saisons).
- **Marée**, **Météo**, **Saison** : le détail de chaque paramètre.
- **Journal** : session en cours, saisie, historique, prises par heure.
- **Règles** : réglementation, remise à l'eau, sécurité spot par spot, principes du secteur, sources.

- **Verdict du jour** en tête : le meilleur spot, son créneau, la météo de ce créneau, les consignes de sécurité qui s'appliquent ce jour-là, puis les n° 2 et 3. Quand l'écart est sous la précision du modèle (0,2 point), l'égalité est annoncée et le spot le plus proche passe devant.
- **Créneaux** : ce sont les phases de marée favorables de chaque fiche ; entre elles, la lumière départage (aube et crépuscule d'abord). D'où l'encart « Si tu pêches en plein jour ».
- **Carte des spots** (Leaflet, fond OpenStreetMap) : un disque par spot, coloré selon sa note ; un appui ouvre la fiche.
- **Marée calculée sur l'appareil** (prédiction harmonique, constantes TICON-4), pour le port de chaque spot, en heure de Paris quel que soit le fuseau du téléphone.
  Précision contrôlée contre les tables SHOM : Brest ±3,9 min, ports du Cotentin ±4 à ±6 min.
  Ports interpolés du Cotentin (Pirou, Régnéville, Agon, Gouville, Carteret, Surtainville, Sciotot) : contrôle d'octobre 2026 à Pirou contre une table tierce publiée — pleines mers ±12 min si coef ≥ 60, jusqu'à ±40 min en morte-eau, hauteurs ±0,2 m.
- **Météo par API, spot par spot** ([Open-Meteo](https://open-meteo.com/)) :
  - vent, rafales, nébulosité et pression : AROME (Météo-France, maille d'environ 1,3 km) en priorité, ECMWF au-delà de son échéance ;
  - l'écart entre AROME et ECMWF sur le vent d'un créneau élargit la plage d'incertitude du classement (jusqu'à ±3 Beaufort et ±3 secteurs) ;
  - houle et température de l'eau : Open-Meteo Marine ; en rade de Brest, la mer est estimée à partir du vent local et du fetch ;
  - pluie des 36 h précédentes affichée par créneau.
- **Note par fenêtre de marée** : marée (bande de coefficient propre au spot), lumière réelle, vent selon le type de spot (côte rocheuse, plage battue, rade/ria/havre), rafales, pression (indice faible, ±0,3 au plus) et présence saisonnière.
- **Saison** : d'après les marquages Ifremer (Bargip), les adultes frayent en hiver au large et reviennent sur la côte au printemps ; le score est multiplié par un facteur de présence (le plus restrictif entre saison et température de l'eau), un peu plus clément en rade et en havre. Ifremer note que « certains sont résidents » sans dire où : placer ces résidents en rade et en havre est une hypothèse du guide. Les valeurs exactes sont des hypothèses de modèle ; depuis la v8.1, l'écart rade/côte ouverte est réduit de moitié.
- **Orientation de chaque poste** : déduite de la fiche, à confirmer ou corriger sur place d'un geste ; le classement en tient compte aussitôt.
- **Fiche terrain par spot** : fond, encombrement (1 à 3), pêche à gratter possible ou non, couches d'eau pêchables, montage conseillé, faits sourcés.
- **Sécurité par spot**, chaque consigne avec sa source ; certaines s'activent selon le jour (Térénez au-delà du coefficient 85, Carteret au-delà de 90, Agon sur marée montante). Goury n'est plus proposé au-delà du coefficient 90, par prudence : la seule source chiffrée (un récit de sortie en bateau) dit qu'au-delà « le courant est très fort ».
- **Réglementation 2026** (zones CIEM 7 et 4, arrêté du 1er avril 2026) : 3 bars par pêcheur et par jour en janvier et du 1er avril au 31 décembre, capture et relâcher seulement du 1er février au 31 mars (bandeau dans le verdict), taille minimale 42 cm, marquage, déclaration RecFishing ; et les gestes pour bien relâcher un bar. Toute date hors de 2026 est signalée « à revérifier ».
- **Mes heures de pêche** (5 h → 23 h par défaut, nuit comprise sur demande) : les créneaux hors de ces heures sont grisés et jamais proposés.
- **Les 7 prochains jours** : le même calcul jour par jour, chargé en 3 requêtes.
- **Session en cours** : « Je pêche ici maintenant » démarre un chrono ; « Terminer et noter » ouvre le journal prérempli (spot, heure, durée).
- **Journal de session** : conditions enregistrées (marée, vent du spot, houle, pression, eau, lumière), prises par heure de pêche par spot, et recalibrage des spots à partir de 3 sessions, ramené vers zéro quand les sessions sont peu nombreuses et borné à ±18 %.

## Sauvegarde du journal

Le journal est enregistré dans le navigateur. Pour qu'il ne se perde jamais et qu'il soit partagé entre appareils, il peut aussi être écrit dans un dépôt GitHub **privé** :

1. Crée un dépôt privé `guide-peche-bar-journal`.
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Donne-lui l'accès au seul dépôt du journal, avec la permission *Contents : Read and write*.
3. Dans l'application, ouvre **Réglages** (bandeau du bas) et colle le jeton. Il reste sur l'appareil.

Chaque application écrit son propre fichier (`journal-logonna-daoulas.json`, `journal-pirou-plage.json`). La fusion se fait sans perte : une session n'est jamais supprimée.

## Développement

```bash
npm install
npm run build          # construit le site (racine du dépôt) depuis src/
npm test               # tests unitaires + parcours Chromium + contrat (simulé)
npm run test:contract  # contrat avec le vrai Open-Meteo (réseau)
```

## Données, sources et licences

- Météo : [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Modèles Météo-France (AROME) et ECMWF.
- Marée : constantes harmoniques TICON-4 (CC BY 4.0, via @neaps/tide-database). Algorithme porté de Neaps (@neaps/tide-predictor, MIT).
- Carte : [Leaflet](https://leafletjs.com/) (BSD-2-Clause), fond © [contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
- Biologie du bar : Ifremer, [synthèse des marquages d'adultes (Bargip)](https://bar.ifremer.fr/content/download/116111/file/4PagesMarquageAdultes_Final-3.pdf).
- Réglementation : [arrêté du 1er avril 2026 réglementant la pêche de loisir du bar européen](https://www.locquirec.bzh/wp-content/uploads/2026/04/Arrete-du-1er-avril-2026-Bar-loisir.pdf) (JO du 9/04/2026) ; [peche.com, quotas 2026](https://www.peche.com/article/50915/les-quotas-bars-et-lieus-2026-pour-les-pecheurs-de-loisir) ; [Boatcible, règles 2026](https://boatcible.com/2026/07/02/peche-de-loisir-2026-regles-essentielles/) ; [ministère de la Mer](https://www.mer.gouv.fr/peche-de-loisir-en-mer).
- Remise à l'eau : [peche.com, « Comment relâcher un poisson ? »](https://www.peche.com/article/32998/comment-relacher-un-poisson-pratiquez-le-no-kill-correctement).
- Conseil leurres : peche.com ([couleurs selon l'eau et la météo](https://www.peche.com/article/52017/peche-aux-leurres-quelle-couleur-choisir-selon-l-eau-et-la-meteo), [coloris favoris](https://www.peche.com/article/47815/mes-coloris-favoris-de-leurres-souples-pour-la-peche-du-bar-en-mer), [début de saison](https://www.peche.com/article/48479/peche-au-bar-en-debut-de-saison-choisir-la-bonne-couleur-de-leurre-souple), [nuit](https://www.peche.com/article/49585/5-leurres-souples-pour-pecher-le-bar-de-nuit-en-ete), [stickbait](https://www.peche.com/article/47337/stickbait-le-leurre-qui-fait-fondre-les-bars-en-surface), [vagues](https://www.peche.com/article/37249/la-peche-du-bar-dans-les-vagues-des-conditions-difficiles-souvent-payantes), [conseils en mer](https://www.peche.com/article/52087/peche-aux-leurres-en-mer-les-conseils-essentiels-pour-bien-debuter), [automne](https://www.peche.com/article/46921/comment-cibler-les-bars-du-bord-en-automne), [saisons](https://www.peche.com/article/32987/la-peche-du-bar-en-fonction-des-saisons)) ; [Le Figaro Nautisme, ouverture](https://figaronautisme.meteoconsult.fr/actus-nautisme-loisirs/2026-02-23/85977-peche-au-bar-a-louverture-bien-choisir-ses-leurres-souples-pour-demarrer-la-saison) ; tes propres notes de coloris.
- Landévennec et Térénez : [peche-poissons.com, « Escapade en rade de Brest, autour de Landévennec »](https://peche-poissons.com/mer/mer-coins-de-peche-en-france-escapade-en-rade-de-brest-autour-de-landevennec-693207-php/) (julien, 30/03/2022 ; photos Thierry Sauvin).
- Sources propres à chaque spot : dans sa fiche (onglet Spots → fiche → Sources).
