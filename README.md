# Guides de pêche du bar — Logonna-Daoulas & Pirou Plage

Deux applications web indépendantes pour la pêche du bar aux leurres du bord :

- **Logonna-Daoulas** (rade de Brest) : 11 spots, du fond de rade au goulet → `logonna.html`
- **Pirou Plage** (côte ouest du Cotentin) : 10 spots, de Granville à Goury → `pirou.html`

Le site tient en 8 fichiers à plat, sans dossier : `index.html`, `logonna.html`, `pirou.html`, `logonna-manifest.json`, `pirou-manifest.json`, `logonna.png`, `pirou.png` et `sw.js`.

Elles s'ouvrent dans le navigateur du téléphone et s'installent sur l'écran d'accueil.
Une fois ouvertes, elles fonctionnent hors ligne : la marée est calculée sur l'appareil, et la dernière météo téléchargée reste affichée.

## Ce que fait chaque application

- **Marée calculée sur l'appareil** (prédiction harmonique, constantes TICON-4) pour le port de chaque spot.
  Coefficient national calculé pour Brest. Écart mesuré face aux tables SHOM : ±4 min environ.
- **Météo par API, spot par spot** ([Open-Meteo](https://open-meteo.com/)) :
  - vent, rafales, nébulosité et pression : AROME (Météo-France, maille d'environ 1,3 km) en priorité, ECMWF au-delà de son échéance ;
  - houle et température de l'eau : Open-Meteo Marine ;
  - en rade de Brest (plan d'eau fermé), la mer est estimée à partir du vent local et du fetch, et non de la houle du large.
- **Note par fenêtre de marée** : chaque fenêtre est notée sur la marée, la lumière réelle (éphéméride), la météo de **ses** heures et la pression.
  Le spot est classé sur sa meilleure fenêtre, avec un ensemble de ±1 Beaufort et ±1 secteur pour la robustesse.
- **Fiche terrain par spot** : fond, encombrement (1 à 3), pêche à gratter possible ou non, couches d'eau pêchables, montage conseillé, bonnes pratiques.
  Les conseils généraux (proies du mois, pression) sont réécrits selon ce que le fond permet : à Moulin Mer, roches et goémon interdisent de gratter, donc tout passe en surface ou en sous-surface.
- **Verdict du jour** en tête de page : le meilleur spot, son créneau, la météo de ce créneau, puis les n° 2 et 3.
- **Mes heures de pêche** : un réglage par appareil. Les créneaux hors de ces heures sont grisés et jamais proposés.
- **Les 7 prochains jours** : le même calcul jour par jour, chargé en 3 requêtes.
- **Frise de la journée** de chaque spot : lumière, marée, créneaux notés et vent heure par heure.
- **Conditions des sessions** : avec l'heure de pêche, la marée, le vent du spot, la houle, la pression, l'eau et la lumière sont enregistrés dans le journal.
- **Journal de session** : il recalibre les spots (au moins 3 sessions par spot, correction bornée à ±18 %).

## Sauvegarde du journal

Le journal est enregistré dans le navigateur. Pour qu'il ne se perde jamais et qu'il soit partagé entre appareils, il peut aussi être écrit dans un dépôt GitHub **privé** :

1. Crée un dépôt privé `guide-peche-bar-journal`.
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Donne-lui l'accès au seul dépôt du journal, avec la permission *Contents : Read and write*.
3. Dans l'application, ouvre **Réglages** (bandeau du bas) et colle le jeton.

Chaque application écrit son propre fichier (`journal-logonna-daoulas.json`, `journal-pirou-plage.json`). La fusion se fait sans perte : une session n'est jamais supprimée.

## Développement

```bash
npm install
npm run build      # construit les 8 fichiers du site depuis src/
npm test           # tests unitaires + tests de bout en bout (Chromium)
```

- `src/engine/` : le moteur, commun aux deux applications.
  - `core.js` : soleil et lumière.
  - `tide.js` : marée.
  - `weather.js` : météo Open-Meteo et cache.
  - `model.js` : fenêtres, score, terrain, proies, pression.
  - `journal.js` : journal de session.
  - `persist.js` : stockage.
- `src/ui/` : l'interface (`App.jsx` pour l'écran principal, `components.jsx` pour les composants).
- `src/sites/logonna.config.js`, `src/sites/pirou.config.js` : tout ce qui est propre au lieu (spots, fiches terrain, zones, ports de marée, proies).
  Pour corriger la description d'un spot, c'est le seul fichier à modifier.
- `src/main.jsx`, `src/storage.js`, `src/sync.jsx` : démarrage, stockage local, sauvegarde GitHub.
- `tests/om_mock.mjs` : simulateur d'Open-Meteo utilisé par les tests.

## Données et licences

- Météo : [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0. Modèles Météo-France (AROME) et ECMWF.
- Marée : constantes harmoniques TICON-4 (CC BY 4.0, via @neaps/tide-database). Algorithme porté de Neaps (@neaps/tide-predictor, MIT).
