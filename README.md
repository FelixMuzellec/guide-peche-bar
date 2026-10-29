# Guides de pêche du bar — Finistère et Manche

Une application web pour la pêche du bar aux leurres du bord, avec un accueil et sept guides (66 spots).

**Finistère (29)**, du nord au sud :
- **Carantec** (baie de Morlaix et Haut-Léon) : 7 spots, de la baie du Kernic à Locquirec → `carantec.html`
- **Plouguerneau** (Pays des Abers) : 10 spots, des abers au Conquet → `plouguerneau.html`
- **Logonna-Daoulas** (rade de Brest) : 11 spots, du fond de rade au goulet → `logonna.html`
- **Crozon** (presqu'île de Crozon et baie de Douarnenez) : 7 spots, de la pointe de Dinan à la pointe de Trénaouret → `crozon.html`
- **Audierne** (Cap Sizun et baie d'Audierne) : 11 spots, de la pointe du Raz à la pointe de Penmarc'h → `audierne.html`
- **Concarneau** (Cornouaille) : 10 spots, de l'Odet à la Laïta → `concarneau.html`

**Manche (50)** :
- **Pirou Plage** (côte ouest du Cotentin) : 10 spots, de Granville à Goury → `pirou.html`

Les sept guides n'ont aucun spot en commun (Logonna garde la rade, le goulet et Crozon) et utilisent exactement le même moteur ; seul le fichier de configuration du lieu change.

Version 8.12 (le numéro et l'identifiant de construction sont affichés en bas de l'accueil : c'est la façon de vérifier qu'un dépôt est bien en ligne).

Elle s'ouvre dans le navigateur du téléphone et s'installe sur l'écran d'accueil comme **une seule application** : l'accueil et les sept guides partagent le même manifeste (`manifest.json`). Installée depuis n'importe laquelle des huit pages, c'est la même application ; elle s'ouvre sur l'accueil, et le titre de chaque guide (« ‹ Guide du bar · … ») y ramène. Sur Android, un appui long sur l'icône propose des raccourcis vers les trois premiers guides : Chrome pour Android n'en affiche pas plus de trois ([web.dev](https://web.dev/articles/app-shortcuts)). L'accueil affiche un bouton « Installer l'application » quand Chrome le permet, et l'aide pas à pas (Android, iPhone) sinon.

**Accueil** (v8.9) : les guides sont regroupés par département, du nord au sud, avec le nombre de spots ; un champ « Chercher un spot » trouve un spot par son nom, sa commune, sa région ou son guide, sans tenir compte des accents, des majuscules, des apostrophes ni des tirets (« penhir » trouve la pointe de Pen-Hir, « laita » l'estuaire de la Laïta, « plouescat » la baie du Kernic). Un résultat ouvre le guide directement sur la fiche du spot (lien `guide.html#spot=<id>`) ; la touche « Aller » du clavier ouvre le premier ; flèches et Échap au clavier. Le bouton « 📍 Les spots les plus proches de moi » (v8.12) prend la position du téléphone et liste les 8 spots les plus proches, tous guides confondus (tes spots compris), avec leur distance à vol d'oiseau ; loin de tout guide (plus de 60 km), il le dit et donne le plus proche. La position ne quitte pas le téléphone, et la recherche marche hors ligne. La liste des spots est écrite à la construction depuis les fiches : un spot ajouté à un guide apparaît dans la recherche sans rien modifier d'autre.

Une fois ouverte, elle fonctionne hors ligne : l'accueil et les sept guides sont mis en cache dès la première visite (recherche comprise), la marée est calculée sur l'appareil, et la dernière météo téléchargée reste affichée.

Chaque guide garde sa propre météo et son propre journal ; la clé API de l'onglet Photos sert à tous.

Adresse : <https://felixmuzellec.github.io/guide-peche-bar/>

## Organisation du dépôt

```
index.html            accueil (point d'entrée de l'application) ┐
logonna.html, pirou.html, plouguerneau.html, audierne.html,     │ le site publié par GitHub Pages :
carantec.html, concarneau.html, crozon.html                     │
manifest.json         une seule application installable         │ fichiers construits, à la racine,
icon-192.png, icon-512.png, icon-maskable.png                   │ à ne pas modifier à la main
logonna.png, pirou.png, plouguerneau.png, audierne.png,         │
carantec.png, concarneau.png, crozon.png                        │
sw.js                 fonctionnement hors ligne                 │
.nojekyll             fichiers servis tels quels                ┘
src/                  les sources
  engine/               le moteur, commun à tous les guides
    core.js               soleil, lumière, effet du vent selon le type de spot
    tide.js               marée (prédiction harmonique, heure de Paris)
    weather.js            météo Open-Meteo, incertitude entre modèles, cache
    model.js              fenêtres, note, saison, terrain, proies, pression, orientation
    journal.js            journal de session, recalibrage, prises par heure
    rules.js              réglementation 2026 (nord et sud du 48e parallèle), remise à l'eau, sécurité par spot
    lures.js              conseil leurres : courant du créneau, vent de face, profondeur, choix du leurre de ta boîte, de sa taille, de sa tête et de sa couleur
    tackle.js             fiches techniques des leurres de ta boîte (poids, nage, têtes), relevées chez les fabricants, et ta boîte
    myspots.js            tes spots : fiche construite à partir de tes choix, registre commun au moteur, fusion téléphone / GitHub
    photo.js              analyse photo : EXIF, marée et lumière de la prise de vue, trois passes, contrôle des preuves,
                          export et import d'une analyse faite par l'abonnement Claude
    persist.js            stockage
  sites/                ce qui est propre à chaque lieu
    logonna.config.js     spots, fiches terrain, sécurité, zones, ports de marée, proies
    pirou.config.js, plouguerneau.config.js, audierne.config.js, carantec.config.js, concarneau.config.js, crozon.config.js
  ui/                   l'interface
    App.jsx               données du jour et navigation par onglets
    kit.jsx               cartes, tuiles, puces, sources : le style commun
    TabBar.jsx, MapView.jsx, Orientation.jsx, components.jsx
    MySpotForm.jsx        formulaire « Ajouter un spot » (GPS, carte, coordonnées collées)
    theme.js              affichage « plein soleil » (Réglages), commun aux guides et à l'accueil
    tabs/                 un fichier par onglet : Synthese, Spots (+ SpotDetail), Photos, Leurres,
                          Maree, Meteo, Saison, JournalTab, Regles
    photoPrep.js          réduction et ré-encodage des photos (partagé avec la page d'analyse)
  main.jsx              démarrage, et écran de secours si l'affichage plante (export du journal brut)
  storage.js, sync.jsx
  index.html            modèle de l'accueil : la construction y écrit les guides par département et l'index des spots
  studio/               la page « Analyse photo du bar » publiée sur claude.ai (abonnement, sans clé API)
  sw.template.js        modèle du sw.js (nommé ainsi pour ne jamais écraser le sw.js construit)
tests/
  unit.mjs              moteur + schéma des fiches + contrôle de la marée (Pirou, ports du Finistère)
  e2e.mjs               parcours complet dans Chromium (téléphone simulé)
  studio.mjs            page d'analyse par l'abonnement, avec un Claude simulé
  contract.mjs          contrat avec le vrai service Open-Meteo
  om_mock.mjs           simulateur d'Open-Meteo
  ref/                  tables de référence (marée de Pirou, octobre 2026 ; Aber Wrac'h, Brignogan, Lanildut,
                        Le Conquet, Audierne, Saint-Guénolé, Roscoff, château du Taureau, Primel, Locquirec, Concarneau,
                        Bénodet, Port-Manec'h, Le Pouldu, Morgat, Douarnenez, novembre 2026)
scripts/sites.mjs     la liste des guides (avec leur description d'accueil) et des 20 fichiers du site (construction et tests)
scripts/build.mjs     construit les 20 fichiers du site, à la racine, depuis src/
scripts/build-studio.mjs  construit la page d'analyse (studio-build/analyse-photo.html, non publiée par GitHub Pages)
scripts/site-icons.mjs    dessine les icônes des guides
scripts/icons.mjs     dessine les icônes de l'application (assets/app-icon.svg → assets/icon-*.png)
assets/               icônes sources (app-icon.svg et ses rendus PNG, icônes des guides)
.github/workflows/    tests à chaque dépôt, contrat Open-Meteo chaque matin
```

Pour corriger la description d'un spot, le seul fichier à modifier est `src/sites/<site>.config.js` ; les tests vérifient ensuite la cohérence de la fiche (coordonnées, secteurs de vent, bande de coefficient, port de marée, terrain, sécurité).

## Sécurité

- **Politique de sécurité du contenu (CSP)** dans chaque page : le seul script autorisé est celui de la page, identifié par son empreinte SHA-256 (calculée à la construction) ; un script injecté ne s'exécute pas. Les connexions sont limitées à Open-Meteo, à l'API GitHub (journal) et à l'API d'Anthropic (photos) ; les images aux tuiles OpenStreetMap. Un test de bout en bout vérifie qu'une injection est bloquée, qu'un envoi vers un domaine inconnu l'est aussi, et qu'aucun parcours normal ne déclenche de violation.
- La clé API Anthropic et le jeton GitHub restent sur l'appareil (stockage du navigateur) et ne partent que vers leur service. Le jeton GitHub conseillé est limité au seul dépôt du journal ; ne mets qu'un petit crédit sur la clé API.
- **Origine partagée** : le stockage du navigateur appartient à l'origine `felixmuzellec.github.io`, commune à **tous** les sites GitHub Pages du compte. Une autre page publiée sur ce compte pourrait lire la clé et le jeton. Ne publie sur ce compte que des pages de confiance (ou garde le jeton à portée minimale, comme indiqué plus bas).
- Une entrée de journal reçue de GitHub ou importée est nettoyée champ par champ avant usage (types, identifiants, heure) ; si l'affichage plante malgré tout, un écran de secours permet d'exporter le journal brut, de couper la sauvegarde GitHub et de recharger.
- Les fiches des spots et le catalogue des leurres ne sont jamais modifiés en place : les corrections faites sur le terrain produisent de nouvelles données (les tests gèlent les originaux pour le garantir).
- Construction : esbuild 0.28 (correctif GHSA-67mh-4wv8-2f99) ; cible minimale Safari 15 (iOS 15), esbuild ne produisant plus de code sûr pour Safari 13 et 14.

## Publication sur GitHub Pages

Settings → Pages → *Deploy from a branch* → Branch `main`, dossier `/ (root)` → Save.

Mettre le site à jour depuis le téléphone : *Add file → Upload files* à la racine du dépôt, avec les 20 fichiers du site
(`index.html`, `logonna.html`, `pirou.html`, `plouguerneau.html`, `audierne.html`, `carantec.html`, `concarneau.html`, `crozon.html`, `manifest.json`, `icon-192.png`, `icon-512.png`, `icon-maskable.png`, `logonna.png`, `pirou.png`, `plouguerneau.png`, `audierne.png`, `carantec.png`, `concarneau.png`, `crozon.png`, `sw.js`).
L'identifiant de construction est l'empreinte de tous les fichiers servis : le moindre changement change le cache hors ligne, et la copie hors ligne est toujours relue sur le serveur (jamais dans le cache HTTP du navigateur).
Ne jamais déposer un fichier de `src/` à la racine. Après un dépôt, vérifier qu'aucun doublon « (1) », « (2) » n'a été créé, puis que le bas de l'accueil affiche la nouvelle version.
Depuis la v8.4, `logonna-manifest.json` et `pirou-manifest.json` ne servent plus : ils peuvent être supprimés du dépôt (les laisser ne gêne rien).

## Ce que fait chaque application

L'écran est organisé en onglets (l'onglet ouvert est inscrit dans l'adresse, `#leurres` par exemple, et le bouton retour du téléphone revient au précédent) :

- **Synthèse** : en tête, la **tendance de la semaine** (le meilleur jour des 7 prochains, une barre par jour ; un appui ouvre le jour, le détail jour par jour se déplie), chargée d'elle-même à l'ouverture ; puis le meilleur spot et son créneau, le leurre conseillé pour ce créneau, le meilleur créneau de plein jour quand le verdict tombe à l'aube, au crépuscule ou de nuit, les conditions du jour en six tuiles (vent, mer, marée, soleil, eau et saison, pression) — chaque tuile ouvre l'onglet qui la détaille —, les autres choix et la règle du jour.
- **Spots** : mes heures de pêche, la carte, tes spots, le classement, la fiche du spot (créneaux, terrain, leurres, accès). Un lien `#spot=<id>` (recherche de l'accueil) ouvre directement une fiche.
- **Tes spots** (v8.11) : « ＋ Ajouter un spot » dans l'onglet Spots. Position par le GPS du téléphone, un appui sur la carte, ou des coordonnées collées (décimales, degrés-minutes, lien Google Maps). Puis quelques choix, chacun avec « je ne sais pas » : type (pointe, plage, estuaire, digue, anse abritée), côté de l'eau face au large (vent et houle de face), niveau de danger, fond, profondeur, moment de marée où ça prend selon toi. Le guide en fait une fiche complète : marée du port et zone météo du spot du guide le plus proche (le port se change), temps de route estimé (vol d'oiseau × 1,4 à 50 km/h, ou le tien), météo propre à ses coordonnées, créneaux de ta phase de marée ou, à défaut, de la règle générale (dite comme telle). Il est classé avec les autres, apparaît sur la carte, dans le journal, les leurres, l'analyse photo et la recherche de l'accueil, avec le badge « Ton spot ». Un spot engagé n'est jamais proposé si la houle est inconnue ou dépasse 1,5 m. Il se modifie ou se supprime depuis sa fiche (les sessions du journal restent). Gardé sur l'appareil (30 par guide au plus) et, si la sauvegarde est activée, dans le dépôt du journal (`spots-<guide>.json`) : la version la plus récente gagne, une suppression reste notée pour ne pas revenir de l'autre appareil. Un point à plus de 60 km du spot le plus proche du guide est refusé : il appartient à un autre guide.
- **Photos** : analyse d'un spot à partir d'une à six photos (voir plus bas).
- **Leurres** : pour un spot et un créneau, **le leurre précis de ta boîte** — modèle et taille, poids (ou tête), couleur, nage, animation — puis un plan B dans une autre couche et, derrière un stickbait, la parade aux bars qui suivent sans prendre (Mr Joe coulant). Puis la famille de leurre, la couleur, la taille et le poids avec leurs sources ; toute ta boîte classée pour ce créneau ; les fiches techniques ; les leurres de la fiche du spot ; les proies du mois ; les repères (poids des têtes, couleurs, familles, saisons).

  Ce que le choix prend en compte :
  - **le courant pendant le créneau** : sur les spots de courant, le coefficient (seuil de chaque fiche) et, en rade, dans les anses et les havres, l'heure de la marée — règle des douzièmes : plein courant aux 3e et 4e heures, faible près des étales. Sur la côte ouverte du Cotentin, l'heure du courant ne suit pas la marée locale : il est supposé présent pendant tout le créneau ;
  - **le vent par rapport au pêcheur** (de face, de dos, de travers) : vent de face, clapot ou vagues → le leurre le plus lourd de la boîte, et une tête un cran plus lourde ;
  - **la profondeur**, jamais mesurée : chaque fiche porte une classe estimée d'après sa description (estran qui découvre, peu d'eau, tombant) et la marée du créneau place le poids dans la fourchette ;
  - **la mer, la lumière, la clarté de l'eau, la saison et la proie** : taille et couleur ;
  - **le fond** : pas de leurre de surface si la fiche l'exclut, pas de leurre de fond sur un fond trop encroché, un leurre coulant signalé en peu d'eau sur le goémon ;
  - **ce que chaque fiche dit du courant et de la surface** (Espagnols : « en plein courant, le leurre ne tient pas sa couche » ; Port Maria : la surface marche « dès qu'un courant se manifeste »).

  - **ce que tu corriges sur place** : la profondeur où tu pêches (classe ou mètres à mi-marée, onglet Spots → Terrain ; la marée du créneau l'ajuste), l'eau du jour (claire, teintée, chargée, onglet Leurres), les poids pesés de tes leurres, la nage du balsa et tes leurres à bavette (onglet Leurres → Corriger ta boîte, commun à tous les guides) ;
  - **ton journal** : le leurre principal de chaque session (choisi dans ta boîte, avec poids et couleur), et tes prises. Dans des conditions proches (même spot ou même secteur, même lumière), un leurre qui a pris monte, un leurre bredouille descend ; l'effet est borné et la raison affichée cite les dates. Les sessions saisies en texte libre sont reconnues aussi ;
  - **le raz Blanchard** (Goury) : plein courant vers la pleine et la basse mer de Cherbourg, renverse vers la mi-marée ([Wikipédia](https://fr.wikipedia.org/wiki/Raz_Blanchard)) ;
  - **le Raz de Sein** (pointe du Raz) : l'inverse — le courant s'inverse peu avant les pleines et basses mers (20 min avant la basse mer, 45 min avant la pleine mer de Brest, [bateaux.com, 2025](https://www.bateaux.com/article/32097/le-raz-de-sein-les-bons-conseils-pour-ce-passage-delicat)), il est donc maximal vers la mi-marée, jusqu'à 6 nœuds en vive-eau. Renverse retenue : 20 min avant la pleine et la basse mer d'Audierne (d'autres récits la placent jusqu'à une heure avant ; l'écart n'est pas tranché et la fiche le dit).

  Poids des têtes : 1 g par mètre sans vent ni courant ; du bord, 1 à 4 m : 5 g (3 à 10) ; tombant de 5 à 15 m : 10 à 20 g ; courant moyen du bord : 15 à 25 g ; courant fort : 20 g de départ (en bateau, 10 m de fond) ; vagues : 18 à 25 g ; nuit : 5 à 10 g ; vent : un cran au-dessus. Chaque chiffre vient de [peche.com (T. Cendrier, 2024)](https://www.peche.com/article/34833/quel-grammage-de-tete-plombee-faut-il-utiliser-pour-la-peche-du-bar) ou des [Bredouilleurs](https://lesbredouilleurs.com/blogs/infos/comment-choisir-le-grammage-de-sa-tete-plombee-pour-la-peche-en-mer).

  Ta boîte (26/10/2026) : Asturie 110, 130, 150 ; Patchinko 140 ; Z Claw Evo ; Mr Joe 105 et 120 ; leurre balsa 130 (20 g, nage à préciser : jamais conseillé seul) ; leurres à bavette (Artist…) ; Crazy Paddle Tail, Master Shad, Black Minnow, Spindle Worm, Curly Spindle Worm, X-Layer, Dark Sleeper, Craw — souples dans « un peu toutes les tailles et tous les poids », couleurs « un peu de tout » ; jigs DUO Drag Metal Cast de 20 à 40 g. Ta canne lance de 14 à 42 g : rien de plus lourd n'est proposé, et ce qui est plus léger est signalé. Quand les revendeurs ne donnent pas le même poids (Asturie : 15 ou 16,5 g pour le 110, 27 ou 25,9 g pour le 130, 32 ou 31,6 g pour le 150), l'onglet Leurres affiche les deux. Elle se modifie dans `src/engine/tackle.js`.
- **Marée**, **Météo**, **Saison** : le détail de chaque paramètre.
- **Journal** : session en cours, saisie, historique, prises par heure.
- **Règles** : réglementation, remise à l'eau, sécurité spot par spot, principes du secteur, sources.

- **Verdict du jour** en tête : le meilleur spot, son créneau (« En cours · encore 1 h 10 » ou « Dans 2 h 30 »), la météo de ce créneau et le vent par rapport au poste (de face, de dos, de travers), le niveau d'engagement du spot (facile, modéré, engagé) et ses consignes de sécurité, puis les n° 2 et 3. Quand l'écart est sous la précision du modèle (0,2 point), l'égalité est annoncée et le spot le plus proche passe devant. Une seule note par créneau : celle du verdict, de la liste des créneaux et de la frise du jour est la même (moyenne sur les scénarios de météo).
- **L'heure compte** (v8.9) : aujourd'hui, un créneau déjà fini est barré « Passé » et jamais proposé ; un créneau qui finit avant que tu puisses y être (trajet compris) est signalé « Fin avant ton arrivée » ; quand tous les bons créneaux du jour sont passés, le verdict le dit et propose demain. La courbe de marée et la frise du jour portent un trait « maintenant ». Restée ouverte la nuit, l'application passe d'elle-même au jour suivant et recharge la météo (au plus toutes les 15 min).
- **Créneaux** : ce sont les phases de marée favorables de chaque fiche ; entre elles, la lumière départage (aube et crépuscule d'abord). D'où l'encart « Si tu pêches en plein jour ».
- **Carte des spots** (Leaflet, fond OpenStreetMap) : un disque par spot, coloré selon sa note ; un appui ouvre la fiche.
- **Marée calculée sur l'appareil** (prédiction harmonique, constantes TICON-4), pour le port de chaque spot, en heure de Paris quel que soit le fuseau du téléphone.
  Précision contrôlée contre les tables SHOM : Brest ±3,9 min, ports du Cotentin ±4 à ±6 min.
  Finistère (contrôle de novembre 2026, écart moyen sur l'heure et la hauteur des pleines et basses mers) : Le Conquet 3,3 min / 3 cm, Audierne 4,5 min / 4 cm (stations TICON-4) ; Aber Wrac'h 3,0 min / 4 cm, Lanildut 4,5 min / 4 cm (ports secondaires du Conquet), Brignogan 2,8 min / 4 cm (de Roscoff ; sert aussi à la baie du Kernic), Saint-Guénolé 2,5 min / 4 cm (d'Audierne) ; baie de Morlaix : Roscoff 3,1 min / 5 cm (station TICON-4), château du Taureau 3,1 min / 4 cm, anse de Primel 3,0 min / 4 cm, Locquirec 2,9 min / 4 cm (ports secondaires de Roscoff) ; Cornouaille : Concarneau 4,4 min / 4 cm (station TICON-4), Bénodet 3,7 min / 4 cm, Port-Manec'h 3,6 min / 4 cm, Le Pouldu 3,6 min / 3 cm (ports secondaires de Concarneau) ; baie de Douarnenez : Morgat 4,0 min / 3 cm, Douarnenez 3,8 min / 3 cm (ports secondaires de Brest, aucun marégraphe TICON-4 dans la baie). Corsen et Penhors sont interpolés entre deux ports, sans table de contrôle.
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
- **Sécurité par spot**, chaque consigne avec sa source ; certaines s'activent selon le jour (Térénez au-delà du coefficient 85, Carteret au-delà de 90, Agon sur marée montante, Mousterlin au-delà de 75). Goury n'est plus proposé au-delà du coefficient 90, par prudence : la seule source chiffrée (un récit de sortie en bateau) dit qu'au-delà « le courant est très fort ». Quand la houle est inconnue (modèle de vagues indisponible ou trop loin du spot), les spots engagés de la côte ouverte ne sont pas proposés : 0 m n'est pas une mesure. Au-delà de la houle maximale d'une fiche, un spot engagé n'est jamais proposé (aucune tolérance), un autre spot l'est encore jusqu'à 0,5 m de plus, avec une note abaissée.
- **Plein soleil** (Réglages, bandeau du bas) : affichage clair à fort contraste pour lire au soleil ; photos et carte gardent leurs couleurs. Choix commun à tous les guides et à l'accueil.
- **Réglementation 2026** (arrêté du 1er avril 2026), appliquée spot par spot selon le 48e parallèle :
  - au nord (zones CIEM 7 et 4 : Pirou, Logonna, Plouguerneau, Carantec, Crozon et le Cap Sizun, de l'embouchure du Goyen à Brézellec) : 3 bars par pêcheur et par jour en janvier et du 1er avril au 31 décembre, capture et relâcher seulement du 1er février au 31 mars (bandeau dans le verdict) ;
  - au sud (zone CIEM 8 : Penhors, la Torche, Saint-Guénolé, la pointe de Penmarc'h et tout le guide de Concarneau) : 2 bars par pêcheur et par jour toute l'année, sans période de pêcher-relâcher (article 3 ; [synthèse DDTM du Finistère, avril 2026](https://www.locquirec.bzh/wp-content/uploads/2026/04/2026-SYNTHESE-peche-loisir-en-mer.pdf)) ;
  - partout : taille minimale 42 cm, marquage, déclaration RecFishing (toujours obligatoire selon la [page du ministère de la Mer](https://www.mer.gouv.fr/peche-de-loisir-en-mer) mise à jour le 30/09/2026 ; le Conseil d'État a refusé de la suspendre le 18/06/2026 ; des articles de presse annoncent un retrait que ni le ministère ni la FNPP ne confirment au 29/10/2026) ; et les gestes pour bien relâcher un bar. Le guide d'Audierne, à cheval sur le 48e, affiche les deux régimes et celui de chaque spot. Toute date hors de 2026 est signalée « à revérifier ».
- **Mes heures de pêche** (5 h → 23 h par défaut, nuit comprise sur demande) : les créneaux hors de ces heures sont grisés et jamais proposés.
- **Les 7 prochains jours** : le même calcul jour par jour, chargé en 3 requêtes dès l'ouverture, résumé en tête de la synthèse.
- **Session en cours** : « Je pêche ici maintenant » démarre un chrono ; le bandeau de session garde le chrono, un bouton « +1 bar » pour compter les prises sans quitter l'écran, et « Terminer » qui ouvre le journal prérempli (spot, heure, durée, nombre de bars). Le résultat de la session n'est jamais noté d'office : il reste « non noté » tant que tu ne le choisis pas.
- **Journal de session** : conditions enregistrées (marée, vent du spot, houle, pression, eau, lumière), prises par heure de pêche par spot, et recalibrage des spots à partir de 3 sessions, ramené vers zéro quand les sessions sont peu nombreuses et borné à ±18 %.

## Analyse photo d'un spot

L'onglet **Photos** lit un spot comme le ferait un pêcheur, à partir d'une à six photos, en trois passes :

1. **Inventaire** : Claude (Anthropic) relève ce qui est visible, photo par photo et zone par zone (surface, courant visible, couleur de l'eau, roche, sable, algues, estran, ouvrages, accès, dangers, vie, lumière), sans interprétation ni mesure inventée.
2. **Vérification** : un second appel, indépendant, contrôle chaque observation sur la photo ; ce qui n'y est pas est écarté, l'ambigu est marqué « incertain ».
3. **Lecture du pêcheur** : courant, structures, postes, approche, sécurité, risque d'accroche, familles de leurres, confrontation avec la fiche du guide, points à vérifier sur place. Chaque élément cite les faits sur lesquels il repose (o… photos vérifiées, t… marée et lumière, f… fiche du guide, u… tes notes) ; l'application écarte ceux qui n'en citent aucun, et un poste ou une consigne qui ne repose que sur un fait incertain.

La date de prise de vue est lue dans la photo (EXIF) ; la marée (phase, hauteur, coefficient) et la lumière à cet instant sont **calculées par l'application**, pas devinées. La position GPS de la photo, si elle est présente, propose le spot le plus proche.

- **En cours de route** : l'analyse continue quand on change d'onglet (un bandeau la suit et annonce la fin) ; l'inventaire s'affiche dès la première passe, les vérifications dès la deuxième. Chaque passe terminée est gardée sur l'appareil : si la page est fermée, rechargée, ou si le téléphone se met en veille, l'analyse reprend à la passe manquante, sans refaire ni refacturer les autres. L'écran reste allumé pendant l'analyse là où le navigateur le permet.
- **Lecture** : toucher un repère (o2, t1…) affiche le fait sous l'élément, avec la photo et la zone ; toucher une photo l'ouvre en plein écran avec ses repères (observations et postes, positions approximatives).
- **Fiche du spot** : quand des observations confirmées contredisent la fiche (encombrement, pêche à gratter, couches d'eau), l'analyse propose une correction ; rien ne change sans « Appliquer à la fiche ». La correction est gardée sur l'appareil, réversible, et la fiche indique qu'elle a été corrigée sur le terrain.
- **Sans clé API, avec ton abonnement Claude** (Pro ou Max) : la page [« Analyse photo du bar »](https://claude.ai/artifact/6zzrJfqMW8cutSY9qoTGDH) sur claude.ai fait les mêmes trois passes avec le même texte de consigne, par ton compte claude.ai, sans crédit API. On y choisit le guide et le spot, on ajoute les photos, Claude analyse (la première fois, claude.ai demande l'autorisation), puis « Enregistrer le fichier pour le guide » (ou « Copier pour le guide »). Dans le guide, onglet Photos → « Analyser avec ton abonnement Claude » → importer le fichier (ou coller le texte). À l'import, le guide n'accepte que les champs attendus et les valeurs de ses listes fermées (catégories, familles de leurres, valeurs de la fiche), recalcule lui-même la marée et la lumière de chaque photo, et repasse les mêmes contrôles qu'avec une clé : un poste ou une consigne sans fait vérifié est écarté, et une proposition pour la fiche doit reposer sur une observation de photo confirmée. L'heure saisie pour une photo sans date est lue à l'heure de Paris, quel que soit le fuseau du téléphone. La page est privée (visible de ton seul compte, sauf si tu la partages).
- **Avec une clé API Anthropic**, l'analyse se fait dans le guide même. Il faut : compte sur la Claude Console, distinct d'un abonnement Claude (qui ne couvre pas l'API) ; clé créée sur [platform.claude.com/settings/keys](https://platform.claude.com/settings/keys) (affichée une seule fois) ; crédit prépayé acheté sur [platform.claude.com/settings/billing](https://platform.claude.com/settings/billing) (« Buy credits » ; non remboursable, valable un an). La clé est saisie dans l'onglet, reste sur l'appareil et ne part que vers `api.anthropic.com`. Une clé sert à tous les guides. Le bouton « Enregistrer et tester » vérifie la clé, pas le crédit.
- **Coût** : affiché avant (estimation) et après (réel) ; de l'ordre de 0,15 à 0,60 $ par analyse avec Claude Opus 5.5, environ la moitié avec Claude Sonnet 5.5.
- **Confidentialité** : les photos sont réduites à 2000 px et ré-encodées avant l'envoi : elles partent sans aucune métadonnée (ni date, ni position). Les six dernières analyses sont gardées sur l'appareil (IndexedDB), avec leurs images réduites.
- **Limites** : une photo ne montre ni la profondeur, ni le fond sous l'eau, ni le courant hors de la surface visible ; l'analyse le dit et liste ce qu'il faut vérifier sur place. Elle reste une déduction à confirmer.

## Sauvegarde du journal

Le journal est enregistré dans le navigateur. Pour qu'il ne se perde jamais et qu'il soit partagé entre appareils, il peut aussi être écrit dans un dépôt GitHub **privé** :

1. Crée un dépôt privé `guide-peche-bar-journal`.
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Donne-lui l'accès au seul dépôt du journal, avec la permission *Contents : Read and write*.
3. Dans l'application, ouvre **Réglages** (bandeau du bas) et colle le jeton. Il reste sur l'appareil.

Tes spots ajoutés sur le téléphone sont sauvegardés à côté, un fichier par guide (`spots-logonna-daoulas.json`…). Chaque guide écrit son propre fichier de journal (`journal-logonna-daoulas.json`, `journal-pirou-plage.json`, `journal-plouguerneau.json`, `journal-audierne.json`, `journal-carantec.json`, `journal-concarneau.json`, `journal-crozon.json`). La fusion se fait sans perte : une session n'est jamais supprimée.

## Développement

```bash
npm install
npm run build          # construit le site (racine du dépôt) depuis src/
node scripts/build-studio.mjs   # construit la page d'analyse par l'abonnement (studio-build/)
node tests/studio.mjs  # teste cette page avec un Claude simulé
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
- Conseil leurres : peche.com ([couleurs selon l'eau et la météo](https://www.peche.com/article/52017/peche-aux-leurres-quelle-couleur-choisir-selon-l-eau-et-la-meteo), [coloris favoris](https://www.peche.com/article/47815/mes-coloris-favoris-de-leurres-souples-pour-la-peche-du-bar-en-mer), [début de saison](https://www.peche.com/article/48479/peche-au-bar-en-debut-de-saison-choisir-la-bonne-couleur-de-leurre-souple), [nuit](https://www.peche.com/article/49585/5-leurres-souples-pour-pecher-le-bar-de-nuit-en-ete), [stickbait](https://www.peche.com/article/47337/stickbait-le-leurre-qui-fait-fondre-les-bars-en-surface), [vagues](https://www.peche.com/article/37249/la-peche-du-bar-dans-les-vagues-des-conditions-difficiles-souvent-payantes), [conseils en mer](https://www.peche.com/article/52087/peche-aux-leurres-en-mer-les-conseils-essentiels-pour-bien-debuter), [automne](https://www.peche.com/article/46921/comment-cibler-les-bars-du-bord-en-automne), [saisons](https://www.peche.com/article/32987/la-peche-du-bar-en-fonction-des-saisons)) ; [Le Figaro Nautisme, ouverture](https://figaronautisme.meteoconsult.fr/actus-nautisme-loisirs/2026-02-23/85977-peche-au-bar-a-louverture-bien-choisir-ses-leurres-souples-pour-demarrer-la-saison) ; tes propres notes de coloris. Grammage : [peche.com, T. Cendrier (2024)](https://www.peche.com/article/34833/quel-grammage-de-tete-plombee-faut-il-utiliser-pour-la-peche-du-bar), [Les Bredouilleurs](https://lesbredouilleurs.com/blogs/infos/comment-choisir-le-grammage-de-sa-tete-plombee-pour-la-peche-en-mer). Courant : [règle des douzièmes (peche.com)](https://peche.com/article/43574/comprendre-et-calculer-les-niveaux-des-marees-avec-la-regle-des-douziemes), [atlas des courants du SHOM (bateaux.com)](https://www.bateaux.com/article/34870/decouvrir-la-carte-des-courants-de-maree). Fiches techniques : [Fiiish](https://fiiish.com/produits/leurres-souples/black-minnow/), Nootica, Leurre de la pêche, Spécialiste Leurres, Rokmax (liens dans l'onglet Leurres).
- Landévennec et Térénez : [peche-poissons.com, « Escapade en rade de Brest, autour de Landévennec »](https://peche-poissons.com/mer/mer-coins-de-peche-en-france-escapade-en-rade-de-brest-autour-de-landevennec-693207-php/) (julien, 30/03/2022 ; photos Thierry Sauvin).
- Finistère (Plouguerneau, Audierne) : mieuxpecher.com (Norbert, « Top 10 » Bretagne 2018-2020 et coins de pêche du Finistère nord) ; peche-poissons.com (J.-B. Vidal, « Bar en Bretagne », 19/10/2026 ; « Au leurre, à la pointe du Raz » avec le guide Yves Pennanen, 17/12/2021) ; Pêche-Rando Bar (guide du Cap Sizun, bilans 2016-2020) ; cannes-peche.blog4ever.com (2016) ; lechasseursousmarin.com (Brézellec, 2025) ; [Le Figaro Nautisme, spots de Bretagne (28/03/2026)](https://figaronautisme.meteoconsult.fr/actus-nautisme-loisirs/2026-03-28/86935-les-spots-de-peche-en-mer-les-plus-reputes-de-bretagne) ; [bateaux.com, Raz de Sein (2025)](https://www.bateaux.com/article/32097/le-raz-de-sein-les-bons-conseils-pour-ce-passage-delicat) ; inventaire du patrimoine (patrimoine.bzh, ports-abris de Feunteun Aod et Brézellec) ; office de tourisme du Pays bigouden (lame de fond de 1870 à Saint-Guénolé) ; Wikipédia (positions des pointes) ; visorando, surf-report (accès, fonds de sable, baïnes). Tables de marée de contrôle : SHOM, via les tables mensuelles publiées par Météo Consult.
- Baie de Morlaix (Carantec) : [office de tourisme de la baie de Morlaix, « La pêche du bord de mer »](https://www.baiedemorlaix.bzh/fr/s-inspirer/spots-peche-bord-de-mer/) (conseils d'un pêcheur de Plougasnou) et [« La pêche au bar avec un guide pêche »](https://www.baiedemorlaix.bzh/fr/s-inspirer/la-peche-au-bar-avec-un-guide-peche/) ; [Pesketa, guide de pêche à Morlaix](https://pesketa.com/index.php/peche-du-bar-au-leurre/) ; [sport-decouverte, pêche du bar à Carantec](https://www.sport-decouverte.com/peche-sportive-carantec.html) ; [mieuxpecher, Finistère nord](https://mieuxpecher.com/finistere-nord-coins-de-peche/) ; [J.-B. Vidal, peche-poissons.com (19/10/2026)](https://peche-poissons.com/mer/peche-bar-bretagne/) ; inventaire du patrimoine (patrimoine.bzh), visorando, tourismebretagne, oblyk, sea-seek, mondo.surf (terrain, accès, coordonnées). Tables de marée de contrôle : SHOM, via Météo Consult.
- Cornouaille (Concarneau) : [mieuxpecher, Finistère sud](https://mieuxpecher.com/finistere-sud-coins-de-peche/) (Cap Coz, Beg Meil, Mousterlin, l'Odet, Kerjean, Rospico, Aven et Bélon, Laïta) ; cannes-peche.blog4ever.com (Sables Blancs, Cap Coz, Trévignon, Kerjean) ; chtipecheur.com (Cap Coz, Beg Meil, Mousterlin) ; carnet-de-peche.com (Cap Coz, Mousterlin) ; atout-pecheur.fr (Trévignon) ; ultimate-fishing.net (N. Cadiou, « Pêche du bar sur l'estuaire de l'Odet, un challenge », 2023) ; apppcc.jimdofree.com (embouchure de la Laïta) ; office de tourisme de Concarneau à Pont-Aven (deconcarneauapontaven.com, « Les trois univers pêche ») ; Lorient Bretagne Sud Tourisme (courants du chenal du Bas Pouldu) ; [J.-B. Vidal, peche-poissons.com (19/10/2026)](https://peche-poissons.com/mer/peche-bar-bretagne/) ; tourismebretagne, coastalwiki, fishipedia, visorando, plages.tv, navship (terrain, accès, positions). Non retenus faute de deux sources ou d'une position : pointe de la Jument, Cabellou, Loctudy, Île-Tudy, Lesconil, Guilvinec, Raguénez, baie de Kerogan.
- Presqu'île de Crozon et baie de Douarnenez (Crozon, v8.10) : [mieuxpecher, Finistère nord](https://mieuxpecher.com/finistere-nord-coins-de-peche/) (Norbert, 2018 : château de Dinan, Lostmarc'h, pointe et port de Morgat, port de Douarnenez, pointe de Leydé, pointe de Trénaouret « en début de montante ») ; [carnet-de-peche.com, pointe de Dinan](https://www.carnet-de-peche.com/spots/pointe-de-dinan) ; [carnalor.com, forum « crozon rade de brest »](https://www.carnalor.com/t10050-crozon-rade-de-brest) (Guy535, 2012) ; [lechasseursousmarin.com](https://www.lechasseursousmarin.com/departements/finistere/) (pointes de Dinan, de Morgat et de Luguénez, 2025) ; [pecheaubar.com, « La Pêche au bar en Bretagne : Douarnenez »](https://pecheaubar.com/peche-au-bar-en-bretagne-douarnenez/) ; [chtipecheur.com, « Spots de pêche de Bretagne »](https://www.chtipecheur.com/post/Bretagne-spots-de-peche-balades-1298) ; [Breizh pêche 29, « Coup du soir en baie de Douarnenez »](https://guidedepechemeretriviere.over-blog.com/article-30888929.html) (G. Rognant, 2009) ; [J.-B. Vidal, peche-poissons.com (19/10/2026)](https://peche-poissons.com/mer/peche-bar-bretagne/) ; réserve naturelle de la presqu'île de Crozon (fiche Lostmarc'h : pêche autorisée) ; CNCM, « Les sentiers de Morgat » ; visorando ; plages.tv ; surf-forecast ; Google Maps (positions). Trois fiches n'ont qu'une source de pêche et le disent (Lostmarc'h, Leydé, Trénaouret). Non retenus : cap de la Chèvre (« pas très accessible et pas de fond », carnalor), pointe de Saint-Hernot (fermée aux piétons, visorando), port du Rosmeur (pêche à l'appât dans les sources), île de l'Aber, plages du Ris et de Trezmalaouen (une seule source). Tables de marée de contrôle : SHOM, via Météo Consult.
- Baie du Kernic (Carantec, Haut-Léon) : cannes-peche.blog4ever.com (baie du Kernic et grande plage de Ker Emma), atout-pecheur.fr (plage de Plounévez-Lochrist), office de tourisme de Roscoff (« Plouescat grandeur nature ») ; une seule source parle du bar : la fiche le signale.
- Règles générales de marée (« 3 premières heures de montante, 3 dernières de descendante », coefficients 50 à 80) : J.-B. Vidal les donne comme des règles générales (« les phases de marée […] vont dépendre de chaque coin ») ; chaque fiche les signale comme telles quand aucune source locale ne les précise.
- Pointe de Penmarc'h (Audierne) : [Le Figaro Nautisme, Top 10 (01/03/2026)](https://figaronautisme.meteoconsult.fr/actus-nautisme-loisirs/2026-03-01/78013-top-10-des-spots-de-peche-en-mer-en-france-metropolitaine), [mieuxpecher, Finistère sud](https://mieuxpecher.com/finistere-sud-coins-de-peche/), [carnet-de-peche.com](https://www.carnet-de-peche.com/spots/pointe-de-penmarch). Kermorvan et Blancs-Sablons (Plouguerneau) : mieuxpecher, [patrimoine-iroise.fr (phare de Kermorvan)](https://www.patrimoine-iroise.fr/culturel/maritime/Phare-Kermorvan), atout-pecheur, office de tourisme Iroise Bretagne, fishipedia.
- Sources propres à chaque spot : dans sa fiche (onglet Spots → fiche → Sources). Ce qu'aucune source ne dit (orientation, profondeur, une partie des postes) est marqué « déduit » dans la fiche.
