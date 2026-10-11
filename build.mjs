// Construit le site statique (GitHub Pages), À PLAT : aucun dossier, pour
// pouvoir être déposé tel quel depuis un téléphone (« Add file → Upload files »).
//
//   index.html                       accueil
//   logonna.html, pirou.html         les deux applications (JavaScript intégré)
//   logonna-manifest.json, pirou-manifest.json, logonna.png, pirou.png
//   sw.js                            fonctionnement hors ligne
//
// Usage : node scripts/build.mjs
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SITES = [
  { key: "logonna", config: "src/sites/logonna.config.js", id: "logonna-daoulas", title: "Bar · Logonna-Daoulas", short: "Bar Logonna" },
  { key: "pirou", config: "src/sites/pirou.config.js", id: "pirou-plage", title: "Bar · Pirou Plage", short: "Bar Pirou" },
];
export const SITE_FILES = ["index.html", "logonna.html", "pirou.html", "logonna-manifest.json", "pirou-manifest.json", "logonna.png", "pirou.png", "sw.js"];

const stamp = crypto.createHash("sha256");
for (const s of SITES) {
  // Un seul moteur (src/engine/, src/ui/) ; seule la configuration du site change.
  const engine = path.join(root, "src/ui/App.jsx"), config = path.join(root, s.config);
  const r = await build({
    entryPoints: [path.join(root, "src/main.jsx")],
    bundle: true, minify: true, format: "iife", target: ["es2019", "safari13"], write: false,
    jsx: "automatic", loader: { ".js": "jsx" },
    define: { __SITE_ID__: JSON.stringify(s.id), "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "site", setup(b) {
      b.onResolve({ filter: /^APP$/ }, () => ({ path: engine }));
      b.onResolve({ filter: /^SITE_CONFIG$/ }, () => ({ path: config }));
    } }],
    legalComments: "none", logLevel: "warning",
  });
  // Script intégré dans la page : neutralise les séquences qui fermeraient la balise.
  const js = r.outputFiles[0].text.replace(/<\/(script)/gi, "<\\/$1").replace(/<!--/g, "<\\!--");
  stamp.update(js);
  fs.writeFileSync(path.join(root, `${s.key}.html`), `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${s.title}</title>
<meta name="description" content="Guide de pêche du bar aux leurres — marée calculée, météo Open-Meteo par spot.">
<meta name="theme-color" content="#020617">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${s.short}">
<link rel="manifest" href="${s.key}-manifest.json">
<link rel="icon" type="image/png" href="${s.key}.png">
<link rel="apple-touch-icon" href="${s.key}.png">
<style>/* Socle CSS identique à celui des artefacts claude.ai (préflight Tailwind), pour lequel l'interface a été dessinée */
*,::before,::after{box-sizing:border-box;border:0 solid #1e293b}html{line-height:1.5;-webkit-text-size-adjust:100%}
h1,h2,h3,h4,h5,h6{font-size:inherit;font-weight:inherit}a{color:inherit;text-decoration:inherit}
button,input,optgroup,select,textarea{font-family:inherit;font-size:100%;font-weight:inherit;line-height:inherit;color:inherit;margin:0;padding:0}
button,select{text-transform:none}button,[type=button]{-webkit-appearance:button;background-color:transparent;background-image:none}button{cursor:pointer}
blockquote,dl,dd,h1,h2,h3,h4,h5,h6,hr,figure,p,pre{margin:0}ol,ul{list-style:none;margin:0;padding:0}img,svg,video,canvas{display:block;vertical-align:middle}
html,body{margin:0;background:#020617;color:#e2e8f0}#boot{font:13px system-ui,sans-serif;color:#64748b;padding:40px 16px;text-align:center}@media (pointer:coarse){input,select,textarea{font-size:16px!important}}</style>
</head>
<body>
<div id="root"><div id="boot">Chargement du guide…</div></div>
<noscript><p style="padding:16px">Cette application nécessite JavaScript.</p></noscript>
<script>
${js}
</script>
</body>
</html>
`);
  fs.writeFileSync(path.join(root, `${s.key}-manifest.json`), JSON.stringify({
    id: `./${s.key}.html`, name: s.title, short_name: s.short, lang: "fr", start_url: `./${s.key}.html`, scope: "./",
    display: "standalone", background_color: "#020617", theme_color: "#020617",
    icons: [{ src: `${s.key}.png`, sizes: "512x512", type: "image/png", purpose: "any" }],
  }, null, 2) + "\n");
  fs.copyFileSync(path.join(root, `assets/${s.key}-512.png`), path.join(root, `${s.key}.png`));
  console.log(`${s.key}.html : ${(fs.statSync(path.join(root, `${s.key}.html`)).size / 1024).toFixed(0)} Ko`);
}
const buildId = stamp.digest("hex").slice(0, 12);
fs.writeFileSync(path.join(root, "sw.js"), fs.readFileSync(path.join(root, "src/sw.js"), "utf8").replace("__BUILD__", buildId));
fs.copyFileSync(path.join(root, "src/index.html"), path.join(root, "index.html"));
for (const old of ["logonna", "pirou"]) fs.rmSync(path.join(root, old), { recursive: true, force: true });
for (const old of ["icon.png", ".nojekyll"]) fs.rmSync(path.join(root, old), { force: true });
console.log("build", buildId);
