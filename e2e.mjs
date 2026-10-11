// Tests de bout en bout dans Chromium (Playwright), sur les pages construites
// (racine du dépôt), servies comme sur GitHub Pages (/guide-peche-bar/...). Open-Meteo,
// l'API GitHub et les tuiles OpenStreetMap sont simulés au niveau du réseau ;
// tout le reste est réel.
import { chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { omRespond } from "./om_mock.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SHOTS = process.env.SHOTS || path.join(ROOT, "tests/shots");
fs.mkdirSync(SHOTS, { recursive: true });
const PREFIX = "/guide-peche-bar";
const DOCS = ROOT;   // le site est construit à la racine du dépôt
// Tuile de carte factice (PNG 1×1) : aucun appel réel à OpenStreetMap pendant les tests.
const PNG1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const SITE_FILES = ["index.html", "logonna.html", "pirou.html", "logonna-manifest.json", "pirou-manifest.json", "logonna.png", "pirou.png", "sw.js"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
  p = p.slice(PREFIX.length) || "/";
  if (p.endsWith("/")) p += "index.html";
  // Seuls les 8 fichiers du site sont servis : preuve qu'ils suffisent une fois déposés sur GitHub.
  if (!SITE_FILES.includes(p.slice(1))) { res.writeHead(404); return res.end("404"); }
  const f = path.join(DOCS, p);
  if (!f.startsWith(DOCS) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(8765, r));
const BASE = `http://localhost:8765${PREFIX}`;

const browser = await chromium.launch();
const results = [];
const ok = (cond, label) => results.push([!!cond, label]);

// ── Faux dépôt GitHub (API contents) ──
function fakeGitHub(opts = {}) {
  const files = new Map(Object.entries(opts.files || {}).map(([k, v]) => [k, { content: v, sha: "s" + Math.random().toString(36).slice(2) }]));
  const log = [];
  let conflicts = opts.conflicts || 0;
  const handler = async (route) => {
    const req = route.request(); const u = new URL(req.url());
    const m = u.pathname.match(/^\/repos\/([^/]+)\/([^/]+)(?:\/contents\/(.+))?$/);
    log.push(req.method() + " " + u.pathname);
    const auth = req.headers()["authorization"] || "";
    const json = (status, body) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) });
    if (opts.status401 || auth !== "Bearer github_pat_TEST") return json(401, { message: "Bad credentials" });
    if (!m) return json(404, { message: "Not Found" });
    if (!m[3]) return json(200, { full_name: `${m[1]}/${m[2]}`, private: true });
    const file = decodeURIComponent(m[3]);
    if (req.method() === "GET") {
      const f = files.get(file);
      if (!f) return json(404, { message: files.size ? "Not Found" : "This repository is empty." });
      return json(200, { name: file, sha: f.sha, encoding: "base64", content: Buffer.from(f.content, "utf8").toString("base64").replace(/(.{60})/g, "$1\n") });
    }
    if (req.method() === "PUT") {
      const body = JSON.parse(req.postData());
      if (conflicts > 0) { conflicts--; return json(409, { message: "is at x but expected y" }); }
      const cur = files.get(file);
      if (cur && body.sha !== cur.sha) return json(409, { message: "sha mismatch" });
      const sha = "s" + Math.random().toString(36).slice(2);
      files.set(file, { content: Buffer.from(body.content, "base64").toString("utf8"), sha });
      return json(cur ? 200 : 201, { content: { sha } });
    }
    return json(405, {});
  };
  return { handler, files, log };
}

async function openApp(site, { scenario = "nominal", sync = null, gh = null, init = null, sw = "block", context = null } = {}) {
  const ctx = context || await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: sw });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
  const om = { calls: 0, scenario, tiles: 0 };
  await ctx.route(/tile\.openstreetmap\.org/, (route) => { om.tiles++; return route.fulfill({ status: 200, contentType: "image/png", body: PNG1 }); });
  await ctx.route(/open-meteo\.com/, async (route) => {
    om.calls++;
    if (om.scenario === "offline") return route.abort("internetdisconnected");
    const r = omRespond(route.request().url(), om.scenario);
    await route.fulfill({ status: r.status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(r.body) });
  });
  if (gh) await ctx.route(/api\.github\.com/, gh.handler);
  if (sync) await ctx.addInitScript((c) => { if (!localStorage.getItem("bar:sync")) localStorage.setItem("bar:sync", JSON.stringify(c)); }, sync);
  if (init) await ctx.addInitScript(init);
  await page.goto(`${BASE}/${site}.html`);
  return { ctx, page, errors, om };
}
const T = (page) => page.evaluate(() => document.body.innerText);
const waitCalls = async (om, n, ms = 8000) => { const t0 = Date.now(); while (om.calls < n && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 50)); };
const waitText = (page, re, ms = 15000) => page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), re.source, { timeout: ms });
const READY = /Conditions du jour/;
const WX = /🌬 [A-Z]{1,3} \d+ km\/h/;   // la météo du créneau est arrivée
const tab = async (page, name) => { await page.getByRole("tab", { name, exact: true }).click(); await page.waitForTimeout(250); };
const btn = (page, name) => page.getByRole("button", { name }).first();

// ── 0. Page d'accueil ──
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", serviceWorkers: "block" });
  await ctx.route(/open-meteo\.com/, async (route) => { const r = omRespond(route.request().url(), "nominal");
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) }); });
  await ctx.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: PNG1 }));
  const page = await ctx.newPage(); const bad = [];
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push(r.url()); });
  await page.goto(`${BASE}/`);
  ok(/Logonna-Daoulas/.test(await T(page)) && /Pirou Plage/.test(await T(page)), "accueil : deux guides proposés");
  await page.screenshot({ path: `${SHOTS}/accueil.png` });
  await page.click('a[href="pirou.html"]'); await waitText(page, READY);
  ok(/Guide du bar · Pirou Plage/.test(await T(page)), "accueil → Pirou : l'application s'ouvre");
  const man = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  ok(man.start_url === "./pirou.html" && man.icons?.length, "manifeste d'installation valide");
  ok(bad.length === 0, "aucun fichier manquant" + (bad.length ? " — " + bad.join(", ") : ""));
  await ctx.close();
}

for (const site of (process.env.ONLY ? [] : ["logonna", "pirou"])) {
  const L = (s) => `[${site}] ${s}`;
  const nSpots = site === "logonna" ? 11 : 10;
  // ── 1. Parcours nominal ──
  {
    const { ctx, page, errors, om } = await openApp(site);
    await waitText(page, WX);
    const txt = await T(page);
    ok(/Marée/.test(txt) && /coef \d+/.test(txt) && /PM \d\dh\d\d/.test(txt), L("synthèse : marée affichée"));
    ok(/km\/h/.test(txt) && /hPa/.test(txt), L("synthèse : météo réelle affichée (km/h, hPa)"));
    ok(om.calls === 3, L(`3 requêtes Open-Meteo (${om.calls})`));
    ok(/🌬 [A-Z]{1,3} \d+ km\/h/.test(txt), L("verdict : météo du créneau affichée"));
    ok(/Leurre conseillé pour ce créneau/.test(txt) && /Couleur ·/.test(txt) && /Taille ·/.test(txt), L("synthèse : leurre conseillé (type, couleur, taille)"));
    ok(/Journal sur cet appareil seulement/.test(txt), L("bandeau de sauvegarde : état local"));
    ok(site === "logonna" ? /Guide du bar · Logonna-Daoulas/.test(txt) : (/Guide du bar · Pirou Plage/.test(txt) && !/Logonna/.test(txt)), L("en-tête propre au site (aucun texte de l'autre application)"));
    const sw = await page.evaluate(() => [document.scrollingElement.scrollWidth, window.innerWidth]);
    ok(sw[0] <= sw[1] + 1, L(`pas de défilement horizontal sur mobile (${sw[0]} ≤ ${sw[1]})`));
    const yv = await page.evaluate(() => { const f = (re) => [...document.querySelectorAll("div,span,h2")].find((e) => re.test(e.textContent) && e.children.length === 0); const a = f(/^Meilleur choix$/), b = f(/^Conditions du jour$/); return a && b ? [a.getBoundingClientRect().top, b.getBoundingClientRect().top] : null; });
    ok(yv && yv[0] < yv[1] && yv[0] < 700, L(`verdict du jour en tête de page (${yv && Math.round(yv[0])} px)`));
    await page.screenshot({ path: `${SHOTS}/${site}-synthese.png` });
    // Chaque tuile ouvre l'onglet qui la détaille
    await page.getByRole("button", { name: /Marée/ }).first().click(); await page.waitForTimeout(300);
    ok(/Calculée sur l'appareil/.test(await T(page)) && /Pleine mer/.test(await T(page)) && (await page.evaluate(() => location.hash)) === "#maree", L("tuile Marée → onglet Marée (adresse #maree)"));
    await page.goBack(); await page.waitForTimeout(300);
    ok(READY.test(await T(page)), L("bouton retour → synthèse"));
    await tab(page, "Météo");
    ok(/Open-Meteo · AROME/.test(await T(page)) && /Spot par spot/.test(await T(page)), L("onglet Météo : source et météo spot par spot"));
    // Un spot choisi hors du TOP 3 doit s'afficher (et non le n°1)
    const target = site === "logonna" ? "Moulin Mer" : "Goury";
    await tab(page, "Spots");
    await btn(page, /^Voir les \d+/).click();
    await page.getByRole("button", { name: new RegExp(target) }).first().click();
    await page.waitForTimeout(500);
    ok(await page.evaluate((n) => [...document.querySelectorAll("h2")].some((h) => h.textContent === n), target), L(`fiche du spot choisi hors TOP 3 (${target})`));
    await btn(page, /^Terrain$/).click();
    ok(/Terrain · encombrement 3\/3/.test(await T(page)) && /Pas de pêche à gratter/.test(await T(page)), L(`${target} : fiche terrain affichée`));
    await tab(page, "Leurres");
    await btn(page, /Ce que mange le bar ce mois-ci/).click();
    if (site === "logonna") ok(/Ici, pas de pêche (au fond|à mi-eau)/.test(await T(page)) && /Moulin Mer/.test(await page.inputValue('select[aria-label="Spot"]').then(() => T(page))), L("Moulin Mer : proie de fond réécrite (pas de grattage)"));
    const lt = await T(page);
    ok(/Conseil/.test(lt) && /Couleur/.test(lt) && /Taille/.test(lt) && /Montage/.test(lt) && /Animation/.test(lt) && /Dans ta boîte/.test(lt), L("onglet Leurres : conseil complet"));
    ok(await page.locator('a[href*="peche.com"]').count() >= 5, L("onglet Leurres : sources en lien"));
    await tab(page, "Synthèse");
    await page.screenshot({ path: `${SHOTS}/${site}-full.png`, fullPage: true });
    // Jour suivant puis précédent
    const tideTile = () => page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /^↕ Marée/.test(b.textContent.trim()))?.textContent || "");
    const tideBefore = await tideTile();
    await page.click('button[title="Jour suivant"]');
    await waitCalls(om, 6); await page.waitForTimeout(300); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    ok(tideBefore && tideBefore !== await tideTile(), L("jour suivant : marée recalculée"));
    ok(om.calls === 6, L(`jour suivant : nouvelle météo téléchargée (${om.calls})`));
    await page.click('button[title="Jour précédent"]');
    await page.waitForTimeout(800); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    ok(om.calls === 6, L(`retour au jour : météo servie par le cache (${om.calls})`));
    await page.click('button[title="Retélécharger la météo (ignore le cache)"]');
    await waitCalls(om, 9); await page.waitForTimeout(300); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    ok(om.calls === 9, L(`bouton retélécharger (${om.calls})`));
    // Journal : saisie et persistance après rechargement
    await tab(page, "Journal");
    await page.fill('input[placeholder^="Asturie"]', "Test e2e leurre");
    await page.fill('input[type="time"]', "19:15");
    await btn(page, /^Enregistrer$/).click();
    await page.waitForTimeout(500);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bar:journal:")).map((k) => localStorage.getItem(k)).join(""));
    ok(/Test e2e leurre/.test(stored), L("session enregistrée dans le navigateur"));
    const ent = JSON.parse(stored || "[]").find((e) => e.lure === "Test e2e leurre");
    ok(ent && ent.heure === "19:15" && ent.cond && ent.cond.vent && ent.cond.vent.kmh > 0 && ent.cond.coef > 0 && ent.cond.phase, L("session : heure et conditions enregistrées (marée, vent, coef)"));
    ok(/19h15 · (montant|descendant)/.test(await T(page)), L("journal : conditions affichées sous la session"));
    await page.reload(); await waitText(page, /Nouvelle session/);
    ok((await page.evaluate(() => location.hash)) === "#journal", L("rechargement : l'onglet ouvert est conservé"));
    await page.waitForTimeout(600);
    ok(om.calls === 9, L(`rechargement : météo du cache, aucun appel (${om.calls})`));
    ok(/Test e2e leurre/.test(await T(page)), L("journal conservé après rechargement"));
    ok(errors.length === 0, L("aucune erreur JavaScript" + (errors.length ? " — " + errors.slice(0, 2).join(" | ") : "")));
    await ctx.close();
  }
  // ── 1 bis. Heures de pêche, semaine, frise ──
  {
    const { ctx, page, errors, om } = await openApp(site);
    await waitText(page, WX);
    await btn(page, /Fiche du spot/).click(); await page.waitForTimeout(400);
    ok(await page.locator('svg[aria-label^="Journée sur"]').count() === 1, L("frise de la journée affichée dans la fiche du spot"));
    await page.selectOption('select[aria-label="Début"]', "6");
    await page.selectOption('select[aria-label="Fin"]', "22");
    await page.waitForTimeout(300);
    await tab(page, "Synthèse");
    const vt = await T(page);
    const m = vt.slice(vt.indexOf("Meilleur choix")).match(/(\d{2})h(\d{2}) → (\d{2})h(\d{2})/);
    const s = m ? +m[1] + +m[2] / 60 : null, e = m ? +m[3] + +m[4] / 60 : null;
    ok(m && Math.min(e < s ? e + 24 : e, 22) - Math.max(s, 6) >= 0.5, L(`heures 6 h → 22 h : le verdict propose un créneau dans ces heures (${m && m[0]})`));
    await page.reload(); await waitText(page, READY);
    await tab(page, "Spots");
    ok(await page.inputValue('select[aria-label="Début"]') === "6", L("heures de pêche mémorisées sur l'appareil"));
    await tab(page, "Synthèse");
    const c0 = om.calls;
    await btn(page, "Afficher la semaine").click();
    await page.waitForFunction(() => [...document.querySelectorAll("button")].filter((b) => /^(lun|mar|mer|jeu|ven|sam|dim)\./i.test(b.textContent.trim())).length >= 7, null, { timeout: 20000 }).catch(() => {});
    const rows = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(lun|mar|mer|jeu|ven|sam|dim)\./i.test(b.textContent.trim())).length);
    ok(rows === 7, L(`semaine : 7 jours affichés (${rows})`));
    ok(om.calls - c0 === 3, L(`semaine : 3 requêtes seulement (${om.calls - c0})`));
    const c1 = om.calls;
    await page.locator("button").filter({ hasText: /^(lun|mar|mer|jeu|ven|sam|dim)\./i }).nth(2).click();
    await page.waitForTimeout(900); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    ok(om.calls === c1, L("semaine → jour choisi : météo reprise du cache, aucune requête"));
    ok(errors.length === 0, L("heures/semaine/frise : aucune erreur JavaScript" + (errors.length ? " — " + errors[0] : "")));
    await ctx.close();
  }
  // ── 1 ter. Onglets, carte, sécurité, orientation, session en cours, réglementation ──
  {
    const { ctx, page, errors, om } = await openApp(site);
    await waitText(page, WX);
    const tabs = await page.evaluate(() => [...document.querySelectorAll("nav [role=tab]")].map((b) => b.textContent.trim()));
    ok(tabs.join(",") === "Synthèse,Spots,Leurres,Marée,Météo,Saison,Journal,Règles", L(`onglets (${tabs.join(",")})`));
    const navTop = await page.evaluate(() => { window.scrollTo(0, 1500); return new Promise((r) => setTimeout(() => r(document.querySelector("nav").getBoundingClientRect().top), 150)); });
    ok(navTop <= 1, L(`barre d'onglets collante après défilement (${navTop})`));
    ok(/3 bars \/ pêcheur \/ jour · taille minimale 42 cm/.test(await T(page)), L("réglementation 2026 rappelée sur la synthèse"));
    // Accessibilité : titre, onglets reliés au panneau, clavier
    const aria = await page.evaluate(() => ({ h1: document.querySelectorAll("h1").length, panel: document.querySelector('[role="tabpanel"]')?.getAttribute("aria-labelledby"),
      sel: document.querySelector('[role="tab"][aria-selected="true"]')?.id, tabbable: [...document.querySelectorAll('[role="tab"]')].filter((b) => b.tabIndex === 0).length }));
    ok(aria.h1 === 1 && aria.panel === aria.sel && aria.tabbable === 1, L(`onglets : h1 unique, panneau relié, un seul onglet dans l'ordre de tabulation (${JSON.stringify(aria)})`));
    await page.focus('[role="tab"][aria-selected="true"]');
    await page.keyboard.press("ArrowRight"); await page.waitForTimeout(150);
    const kb1 = await page.evaluate(() => [location.hash, document.activeElement?.textContent]);
    await page.keyboard.press("End"); await page.waitForTimeout(150);
    const kb2 = await page.evaluate(() => location.hash);
    await page.keyboard.press("Home"); await page.waitForTimeout(150);
    ok(kb1[0] === "#spots" && kb1[1] === "Spots" && kb2 === "#regles" && (await page.evaluate(() => location.hash)) === "#synthese", L(`onglets au clavier : flèche, fin, début (${kb1.join(" ")} · ${kb2})`));
    // Meilleur créneau de plein jour, quand le verdict tombe en basse lumière ou de nuit
    const dayCard = /Si tu pêches en plein jour/.test(await T(page)), verdictLow = /aube|crépuscule|nuit/i.test(await page.evaluate(() => document.querySelector("main")?.innerText.split("Leurre conseillé")[0] || ""));
    ok(dayCard === verdictLow || (verdictLow && !dayCard && !/jour/.test(await T(page))), L(`synthèse : créneau de plein jour affiché si le verdict est en basse lumière (${verdictLow ? "basse lumière" : "jour"}, carte ${dayCard ? "affichée" : "absente"})`));
    if (dayCard) {
      await btn(page, /Le conseil leurres de ce créneau/).click();
      await page.waitForTimeout(300);
      ok((await page.evaluate(() => location.hash)) === "#leurres" && /plein soleil|· jour|ciel couvert/.test(await T(page)), L("créneau de plein jour : l'onglet Leurres s'ouvre sur ce créneau"));
      await tab(page, "Synthèse");
    }
    // Carte
    await tab(page, "Spots");
    await page.waitForFunction((n) => document.querySelectorAll(".leaflet-container path.leaflet-interactive").length >= n, nSpots + 1, { timeout: 8000 }).catch(() => {});
    const disks = await page.evaluate(() => document.querySelectorAll(".leaflet-container path.leaflet-interactive").length);
    ok(disks === nSpots + 1, L(`carte : ${nSpots} spots + le village (${disks})`));
    ok(om.tiles > 0 && /OpenStreetMap/.test(await T(page)), L(`carte : fond OpenStreetMap chargé et attribué (${om.tiles} tuiles)`));
    ok(await page.evaluate(() => document.querySelectorAll(".leaflet-tooltip").length) >= 3, L("carte : étiquettes du TOP 3 visibles"));
    const [pickId, pickName] = site === "logonna" ? ["rostiviec", "Rostiviec"] : ["portbail", "Portbail"];
    await page.locator(`path.spot-${pickId}`).click({ force: true });
    await page.waitForTimeout(500);
    ok(new RegExp(pickName).test(await page.evaluate(() => document.querySelector("h2")?.textContent || "")), L("carte → fiche du spot touché"));
    // Sécurité
    await btn(page, /^Voir les \d+/).click();
    await page.getByRole("button", { name: new RegExp(site === "logonna" ? "Térénez" : "Goury") }).first().click();
    await page.waitForTimeout(300);
    await btn(page, /^Accès$/).click();
    const ta = await T(page);
    ok(/Sécurité sur ce spot/.test(ta) && (site === "logonna" ? /coef > 85|Aujourd'hui :/.test(ta) : /6 nœuds/.test(ta)), L("sécurité : consignes sourcées dans l'onglet Accès"));
    // Orientation
    await btn(page, /^Terrain$/).click();
    ok(/Orientation du poste/.test(await T(page)), L("orientation : boussole affichée"));
    await btn(page, /C'est juste/).click();
    await page.waitForTimeout(300);
    const or = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bar:orient:")).map((k) => localStorage.getItem(k)).join(""));
    ok(/"water"/.test(or) && /Orientation confirmée/.test(await T(page)), L("orientation : confirmée, mémorisée sur l'appareil"));
    await page.selectOption('select[aria-label="Direction de l\'eau"]', "E");
    await page.waitForTimeout(300);
    ok(/Orientation corrigée/.test(await T(page)) && /Corrigée sur place/.test(await T(page)), L("orientation : corrigée, le classement suit"));
    // Session en cours
    await btn(page, /Je pêche ici maintenant/).click();
    await waitText(page, /Terminer et noter/);
    ok(await page.evaluate(() => { const n = document.querySelector('[role="status"]'); const r = n?.getBoundingClientRect(); const nav = document.querySelector("nav").getBoundingClientRect(); return !!n && /Session en cours/.test(n.textContent) && r.top >= nav.bottom - 0.5 && r.height <= 52; }), L("session en cours : bandeau compact, sous les onglets, sans chevauchement"));
    ok(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith("bar:encours:"))), L("session en cours : démarrée et mémorisée"));
    await btn(page, "Terminer et noter").click();
    await page.waitForTimeout(500);
    const pre = await page.evaluate(() => [document.querySelector('input[type="time"]')?.value, document.querySelector('input[aria-label="Durée de la session en heures"]')?.value, location.hash]);
    ok(/^\d\d:\d\d$/.test(pre[0] || "") && pre[1] === "0,25" && pre[2] === "#journal", L(`session terminée : journal prérempli (heure ${pre[0]}, durée ${pre[1]} h)`));
    await btn(page, /^Enregistrer$/).click();
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bar:journal:")).map((k) => localStorage.getItem(k)).join(""));
    ok(/"duree":0.25/.test(st), L("session terminée : durée enregistrée"));
    ok(/Prises par spot/.test(await T(page)) && /bar\/h|durée non saisie/.test(await T(page)), L("journal : prises par spot affichées"));
    // Onglets de détail
    await tab(page, "Saison");
    ok(/Saison :/.test(await T(page)) && /L'année du bar/.test(await T(page)) && /Proies du mois/.test(await T(page)), L("onglet Saison : saison, année du bar, proies"));
    await tab(page, "Règles");
    ok(/Bien relâcher un bar/.test(await T(page)) && /Sécurité, spot par spot/.test(await T(page)), L("onglet Règles : réglementation, remise à l'eau, sécurité"));
    // Février : no-kill annoncé, année non vérifiée signalée
    await tab(page, "Synthèse");
    await page.fill('input[type="date"]', "2027-02-10");
    await page.waitForTimeout(900); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    const tf = await T(page);
    ok(/No-kill obligatoire/.test(tf) && /à revérifier/.test(tf), L("février : no-kill annoncé, règles d'une autre année signalées"));
    await page.screenshot({ path: `${SHOTS}/${site}-v7.png` });
    ok(errors.length === 0, L("onglets : aucune erreur JavaScript" + (errors.length ? " — " + errors.slice(0, 2).join(" | ") : "")));
    await ctx.close();
  }
  // ── 2. Pannes météo ──
  for (const sc of ["allfail", "offline", "range"]) {
    const { ctx, page, errors } = await openApp(site, { scenario: sc });
    await waitText(page, /Météo indisponible/, 25000);
    const txt = await T(page);
    ok(/coef \d+/.test(txt) && /PM \d\dh\d\d/.test(txt), L(`${sc} : la marée reste affichée`));
    if (sc === "allfail") ok(/Open-Meteo n'a pas répondu/.test(txt) && /Simulated failure/.test(txt), L("allfail : message cite la réponse"));
    if (sc === "range") ok(/horizon/.test(txt), L("range : message d'horizon"));
    ok(errors.length === 0, L(`${sc} : aucune erreur JavaScript` + (errors.length ? " — " + errors[0] : "")));
    if (sc === "allfail") await page.screenshot({ path: `${SHOTS}/${site}-allfail.png` });
    await ctx.close();
  }
  // ── 3. Dégradation marine ──
  {
    const { ctx, page, errors } = await openApp(site, { scenario: "marinefail" });
    await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
    await tab(page, "Météo");
    ok(/Houle et température d'eau indisponibles/.test(await T(page)), L("marine en panne : alerte visible, météo affichée"));
    ok(errors.length === 0, L("marine en panne : aucune erreur JavaScript"));
    await ctx.close();
  }
}

// ── 4. Sauvegarde GitHub du journal ──
{
  const SYNC = { owner: "FelixMuzellec", repo: "guide-peche-bar-journal", token: "github_pat_TEST" };
  // a) dépôt vide → premier enregistrement crée le fichier (seeds compris)
  const gh = fakeGitHub();
  const { ctx, page, errors } = await openApp("logonna", { sync: SYNC, gh });
  await waitText(page, READY);
  await tab(page, "Journal");
  await page.fill('input[placeholder^="Asturie"]', "Z Claw blanc nacré e2e");
  await btn(page, /^Enregistrer$/).click();
  await waitText(page, /Journal sauvegardé sur GitHub/, 10000);
  const f = gh.files.get("journal-logonna-daoulas.json");
  const arr = f ? JSON.parse(f.content) : [];
  ok(arr.some((e) => /Z Claw blanc nacré e2e/.test(e.lure)), "GitHub : la session est écrite dans le dépôt");
  ok(arr.length >= 4, `GitHub : les 3 sessions archivées sont aussi sauvegardées (${arr.length})`);
  ok(/Z Claw blanc nacré e2e/.test(f?.content || "") && /é/.test(f.content), "GitHub : UTF-8 préservé (accents)");
  ok(errors.length === 0, "GitHub : aucune erreur JavaScript" + (errors.length ? " — " + errors[0] : ""));
  await page.screenshot({ path: `${SHOTS}/sync-ok.png` });
  await ctx.close();

  // b) autre appareil : le journal du dépôt est récupéré au démarrage
  const remote = JSON.stringify([...arr, { id: "log-remote-1", spotId: "bendy", date: "2026-09-30", result: 7, fish: 2, lure: "Session venue du téléphone", predicted: null, note: "" }]);
  const gh2 = fakeGitHub({ files: { "journal-logonna-daoulas.json": remote } });
  const o2 = await openApp("logonna", { sync: SYNC, gh: gh2 });
  await waitText(o2.page, READY);
  const local2 = await o2.page.evaluate(() => localStorage.getItem("bar:journal:logonna-daoulas") || "");
  ok(/Session venue du téléphone/.test(local2), "autre appareil : sessions du dépôt récupérées au démarrage");
  await tab(o2.page, "Journal");
  ok(/Pointe du Bendy/.test(await T(o2.page)), "autre appareil : la session récupérée apparaît dans le journal");
  await o2.ctx.close();

  // c) conflit d'écriture : relecture, fusion, nouvelle écriture
  const gh3 = fakeGitHub({ conflicts: 1 });
  const o3 = await openApp("pirou", { sync: SYNC, gh: gh3 });
  await waitText(o3.page, READY);
  await tab(o3.page, "Journal");
  await btn(o3.page, /^Enregistrer$/).click();
  await waitText(o3.page, /Journal sauvegardé sur GitHub/, 10000);
  ok(gh3.files.has("journal-pirou-plage.json"), "conflit 409 : résolu par relecture et fusion");
  await o3.ctx.close();

  // d) jeton refusé : message clair, l'application fonctionne
  const gh4 = fakeGitHub({ status401: true });
  const o4 = await openApp("logonna", { sync: SYNC, gh: gh4 });
  await waitText(o4.page, READY);
  ok(/jeton refusé/.test(await T(o4.page)), "jeton refusé : message explicite, application utilisable");
  await o4.ctx.close();

  // e) réglages : saisie du jeton depuis l'interface
  const gh5 = fakeGitHub();
  const o5 = await openApp("logonna", { gh: gh5 });
  await waitText(o5.page, READY);
  await o5.page.getByRole("button", { name: "Réglages" }).click();
  await o5.page.screenshot({ path: `${SHOTS}/sync-settings.png` });
  await o5.page.fill('input[type="password"]', "github_pat_TEST");
  await o5.page.getByRole("button", { name: "Enregistrer et tester" }).click();
  await waitText(o5.page, /Journal sauvegardé sur GitHub/, 10000);
  ok(await o5.page.evaluate(() => JSON.parse(localStorage.getItem("bar:sync") || "{}").token === "github_pat_TEST"), "réglages : jeton testé puis mémorisé sur l'appareil");
  await tab(o5.page, "Journal");
  await btn(o5.page, /^Enregistrer$/).click();
  await o5.page.waitForTimeout(2500);
  ok(gh5.files.has("journal-logonna-daoulas.json"), "réglages : la session suivante part sur GitHub");
  await o5.ctx.close();
}

// ── 5. Hors ligne sur le spot (service worker) ──
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: "allow" });
  const { page, errors } = await openApp("logonna", { context: ctx, sw: "allow" });
  await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await waitText(page, /🌬 [A-Z]{1,3} \d+ km\/h/);   // page désormais contrôlée par le SW
  await ctx.setOffline(true);
  await page.reload();
  await waitText(page, READY, 15000);
  await page.waitForTimeout(800);
  const txt = await T(page);
  ok(/coef \d+/.test(txt) && /PM \d\dh\d\d/.test(txt), "hors ligne : l'application s'ouvre, marée calculée");
  ok(/🌬 [A-Z]{1,3} \d+ km\/h/.test(txt), "hors ligne : dernière météo téléchargée réaffichée");
  ok(errors.filter((e) => !/net::|Failed to fetch/.test(e)).length === 0, "hors ligne : aucune erreur JavaScript");
  await ctx.close();
}

await browser.close(); server.close();
const fails = results.filter((r) => !r[0]);
for (const [c, l] of results) console.log(`${c ? "  ✓" : "  ✗"} ${l}`);
console.log(`\nE2E : ${results.length - fails.length}/${results.length}`);
process.exit(fails.length ? 1 : 0);
