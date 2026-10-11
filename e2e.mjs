// Tests de bout en bout dans Chromium (Playwright), sur les pages construites,
// servies comme sur GitHub Pages (/guide-peche-bar/...). Open-Meteo et l'API
// GitHub sont simulés au niveau du réseau ; tout le reste est réel.
import { chromium, devices } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { omRespond } from "./om_mock.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SHOTS = process.env.SHOTS || path.join(ROOT, "tests/shots");
fs.mkdirSync(SHOTS, { recursive: true });
const PREFIX = "/guide-peche-bar";
const SITE_FILES = ["index.html", "logonna.html", "pirou.html", "logonna-manifest.json", "pirou-manifest.json", "logonna.png", "pirou.png", "sw.js"];
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png" };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!p.startsWith(PREFIX)) { res.writeHead(404); return res.end(); }
  p = p.slice(PREFIX.length) || "/";
  if (p.endsWith("/")) p += "index.html";
  // Seuls les 8 fichiers du site sont servis : preuve qu'ils suffisent une fois déposés sur GitHub.
  if (!SITE_FILES.includes(p.slice(1))) { res.writeHead(404); return res.end("404"); }
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end("404"); }
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
  const om = { calls: 0, scenario };
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

// ── 0. Page d'accueil ──
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", serviceWorkers: "block" });
  await ctx.route(/open-meteo\.com/, async (route) => { const r = omRespond(route.request().url(), "nominal");
    await route.fulfill({ status: r.status, contentType: "application/json", body: JSON.stringify(r.body) }); });
  const page = await ctx.newPage(); const bad = [];
  page.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push(r.url()); });
  await page.goto(`${BASE}/`);
  ok(/Logonna-Daoulas/.test(await T(page)) && /Pirou Plage/.test(await T(page)), "accueil : deux guides proposés");
  await page.screenshot({ path: `${SHOTS}/accueil.png` });
  await page.click('a[href="pirou.html"]'); await waitText(page, /CONDITIONS DU JOUR/);
  ok(/Pirou Plage → rayon/.test(await T(page)), "accueil → Pirou : l'application s'ouvre");
  const man = await page.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  ok(man.start_url === "./pirou.html" && man.icons?.length, "manifeste d'installation valide");
  ok(bad.length === 0, "aucun fichier manquant" + (bad.length ? " — " + bad.join(", ") : ""));
  await ctx.close();
}

for (const site of (process.env.ONLY ? [] : ["logonna", "pirou"])) {
  const L = (s) => `[${site}] ${s}`;
  // ── 1. Parcours nominal ──
  {
    const { ctx, page, errors, om } = await openApp(site);
    await waitText(page, /CONDITIONS DU JOUR/);
    const txt = await T(page);
    ok(/MARÉE — /.test(txt), L("panneau marée affiché"));
    ok(/km\/h/.test(txt) && /hPa/.test(txt), L("météo réelle affichée (km/h, hPa)"));
    ok(/Open-Meteo · AROME/.test(txt), L("source météo affichée"));
    ok(om.calls === 3, L(`3 requêtes Open-Meteo (${om.calls})`));
    ok(/🌬 [A-Z]{1,3} \d+ km\/h/.test(txt), L("météo de la fenêtre affichée sur les cartes"));
    ok(/Journal sur cet appareil seulement/.test(txt), L("bandeau de sauvegarde : état local"));
    ok(site === "logonna" ? /Logonna-Daoulas → rayon 1h15/.test(txt) : (/Pirou Plage → rayon 1h20/.test(txt) && !/Logonna/.test(txt)), L("en-tête propre au site (aucun texte de l'autre application)"));
    const sw = await page.evaluate(() => [document.scrollingElement.scrollWidth, window.innerWidth]);
    ok(sw[0] <= sw[1] + 1, L(`pas de défilement horizontal sur mobile (${sw[0]} ≤ ${sw[1]})`));
    const yv = await page.evaluate(() => { const f = (re) => [...document.querySelectorAll("div,span")].find((e) => re.test(e.textContent) && e.children.length === 0); const a = f(/VERDICT DU JOUR/), b = f(/CONDITIONS DU JOUR/); return a && b ? [a.getBoundingClientRect().top, b.getBoundingClientRect().top] : null; });
    ok(yv && yv[0] < yv[1] && yv[0] < 900, L(`verdict du jour en tête de page (${yv && Math.round(yv[0])} px)`));
    // Un spot choisi hors du TOP 3 doit s'afficher (et non le n°1)
    const target = site === "logonna" ? "Moulin Mer" : "Goury";
    await page.getByRole("button", { name: /^Voir les \d+/ }).first().click();
    await page.getByRole("button", { name: new RegExp(target) }).first().click();
    await page.waitForTimeout(500);
    ok(await page.evaluate((n) => [...document.querySelectorAll("h2")].some((h) => h.textContent === n), target), L(`fiche du spot choisi hors TOP 3 (${target})`));
    await page.getByRole("button", { name: /Spot$/ }).first().click();
    ok(/TERRAIN · ENCOMBREMENT 3\/3/.test(await T(page)) && /Pas de pêche à gratter/.test(await T(page)), L(`${target} : fiche terrain affichée`));
    await page.getByRole("button", { name: /Leurres/ }).first().click();
    if (site === "logonna") ok(/ADAPTÉ À CE SPOT/.test(await T(page)) && /Ici, pas de pêche (au fond|à mi-eau)/.test(await T(page)), L("Moulin Mer : proie de fond réécrite (pas de grattage)"));
    await page.getByRole("button", { name: /Fenêtres/ }).first().click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `${SHOTS}/${site}-top.png` });
    await page.screenshot({ path: `${SHOTS}/${site}-full.png`, fullPage: true });
    // Jour suivant puis précédent
    const tideBefore = await page.evaluate(() => [...document.querySelectorAll("div")].find((d) => /^◈ MARÉE — /.test(d.textContent))?.parentElement.textContent);
    await page.click('button[title="Jour suivant"]');
    await waitCalls(om, 6); await page.waitForTimeout(300); await waitText(page, /CONDITIONS DU JOUR/);
    const tideAfter = await page.evaluate(() => [...document.querySelectorAll("div")].find((d) => /^◈ MARÉE — /.test(d.textContent))?.parentElement.textContent);
    ok(tideBefore !== tideAfter, L("jour suivant : marée recalculée"));
    ok(om.calls === 6, L(`jour suivant : nouvelle météo téléchargée (${om.calls})`));
    await page.click('button[title="Jour précédent"]');
    await page.waitForTimeout(800); await waitText(page, /CONDITIONS DU JOUR/);
    ok(om.calls === 6, L(`retour au jour : météo servie par le cache (${om.calls})`));
    await page.click('button[title="Retélécharger la météo (ignore le cache)"]');
    await waitCalls(om, 9); await page.waitForTimeout(300); await waitText(page, /CONDITIONS DU JOUR/);
    ok(om.calls === 9, L(`bouton retélécharger (${om.calls})`));
    // Journal : saisie et persistance après rechargement
    await page.getByRole("button", { name: /JOURNAL/ }).first().click();
    await page.fill('input[placeholder^="Asturie"]', "Test e2e leurre");
    await page.fill('input[type="time"]', "19:15");
    await page.getByRole("button", { name: /^ENREGISTRER$/ }).click();
    await page.waitForTimeout(500);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("bar:journal:")).map((k) => localStorage.getItem(k)).join(""));
    ok(/Test e2e leurre/.test(stored), L("session enregistrée dans le navigateur"));
    const ent = JSON.parse(stored || "[]").find((e) => e.lure === "Test e2e leurre");
    ok(ent && ent.heure === "19:15" && ent.cond && ent.cond.vent && ent.cond.vent.kmh > 0 && ent.cond.coef > 0 && ent.cond.phase, L("session : heure et conditions enregistrées (marée, vent, coef)"));
    ok(/19h15 · (montant|descendant)/.test(await T(page)), L("journal : conditions affichées sous la session"));
    await page.reload(); await waitText(page, /CONDITIONS DU JOUR/);
    ok(om.calls === 9, L(`rechargement : météo du cache, aucun appel (${om.calls})`));
    await page.getByRole("button", { name: /JOURNAL/ }).first().click();
    ok(/Test e2e leurre|e2e/.test(await T(page)) || /Test e2e leurre/.test(await page.evaluate(() => JSON.stringify(localStorage))), L("journal conservé après rechargement"));
    ok(errors.length === 0, L("aucune erreur JavaScript" + (errors.length ? " — " + errors.slice(0, 2).join(" | ") : "")));
    await ctx.close();
  }
  // ── 1 bis. Heures de pêche, semaine, frise ──
  {
    const { ctx, page, errors, om } = await openApp(site);
    await waitText(page, /CONDITIONS DU JOUR/);
    await page.getByRole("button", { name: /Fiche du spot/ }).click();
    ok(await page.locator('svg[aria-label^="Journée sur"]').count() === 1, L("frise de la journée affichée dans la fiche du spot"));
    await page.selectOption('select[aria-label="Début"]', "6");
    await page.selectOption('select[aria-label="Fin"]', "22");
    await page.waitForTimeout(300);
    const vt = await page.evaluate(() => { const el = [...document.querySelectorAll("div")].find((d) => /^◈ VERDICT DU JOUR/.test(d.textContent)); return el ? el.textContent : ""; });
    const m = vt.match(/(\d{2})h(\d{2}) → (\d{2})h(\d{2})/);
    const s = m ? +m[1] + +m[2] / 60 : null, e = m ? +m[3] + +m[4] / 60 : null;
    ok(m && Math.min(e < s ? e + 24 : e, 22) - Math.max(s, 6) >= 0.5, L(`heures 6 h → 22 h : le verdict propose un créneau dans ces heures (${m && m[0]})`));
    await page.reload(); await waitText(page, /CONDITIONS DU JOUR/);
    ok(await page.inputValue('select[aria-label="Début"]') === "6", L("heures de pêche mémorisées sur l'appareil"));
    const c0 = om.calls;
    await page.getByRole("button", { name: /LES 7 PROCHAINS JOURS/ }).click();
    await waitText(page, /actualiser/);
    const rows = await page.evaluate(() => [...document.querySelectorAll("button")].filter((b) => /^(lun|mar|mer|jeu|ven|sam|dim)\./i.test(b.textContent.trim())).length);
    ok(rows === 7, L(`semaine : 7 jours affichés (${rows})`));
    ok(om.calls - c0 === 3, L(`semaine : 3 requêtes seulement (${om.calls - c0})`));
    const c1 = om.calls;
    const second = page.locator("button").filter({ hasText: /^(lun|mar|mer|jeu|ven|sam|dim)\./i }).nth(2);
    await second.click(); await page.waitForTimeout(900); await waitText(page, /CONDITIONS DU JOUR/);
    ok(om.calls === c1, L("semaine → jour choisi : météo reprise du cache, aucune requête"));
    ok(errors.length === 0, L("heures/semaine/frise : aucune erreur JavaScript" + (errors.length ? " — " + errors[0] : "")));
    await ctx.close();
  }
  // ── 2. Pannes météo ──
  for (const sc of ["allfail", "offline", "range"]) {
    const { ctx, page, errors } = await openApp(site, { scenario: sc });
    await waitText(page, /ERREUR/, 25000);
    const txt = await T(page);
    ok(/MARÉE — /.test(txt) && /PLEINE MER/.test(txt), L(`${sc} : la marée reste affichée`));
    if (sc === "allfail") ok(/Open-Meteo n'a pas répondu/.test(txt) && /Simulated failure/.test(txt), L("allfail : message cite la réponse"));
    if (sc === "range") ok(/horizon/.test(txt), L("range : message d'horizon"));
    ok(errors.length === 0, L(`${sc} : aucune erreur JavaScript` + (errors.length ? " — " + errors[0] : "")));
    if (sc === "allfail") await page.screenshot({ path: `${SHOTS}/${site}-allfail.png` });
    await ctx.close();
  }
  // ── 3. Dégradation marine ──
  {
    const { ctx, page, errors } = await openApp(site, { scenario: "marinefail" });
    await waitText(page, /CONDITIONS DU JOUR/);
    const txt = await T(page);
    ok(/Houle et température d'eau indisponibles/.test(txt), L("marine en panne : alerte visible, météo affichée"));
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
  await waitText(page, /CONDITIONS DU JOUR/);
  await page.getByRole("button", { name: /JOURNAL/ }).first().click();
  await page.fill('input[placeholder^="Asturie"]', "Z Claw blanc nacré e2e");
  await page.getByRole("button", { name: /^ENREGISTRER$/ }).click();
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
  await waitText(o2.page, /CONDITIONS DU JOUR/);
  const local2 = await o2.page.evaluate(() => localStorage.getItem("bar:journal:logonna-daoulas") || "");
  ok(/Session venue du téléphone/.test(local2), "autre appareil : sessions du dépôt récupérées au démarrage");
  await o2.page.getByRole("button", { name: /JOURNAL/ }).first().click();
  ok(/Pointe du Bendy/.test(await T(o2.page)), "autre appareil : la session récupérée apparaît dans le journal");
  await o2.ctx.close();

  // c) conflit d'écriture : relecture, fusion, nouvelle écriture
  const gh3 = fakeGitHub({ conflicts: 1 });
  const o3 = await openApp("pirou", { sync: SYNC, gh: gh3 });
  await waitText(o3.page, /CONDITIONS DU JOUR/);
  await o3.page.getByRole("button", { name: /JOURNAL/ }).first().click();
  await o3.page.getByRole("button", { name: /^ENREGISTRER$/ }).click();
  await waitText(o3.page, /Journal sauvegardé sur GitHub/, 10000);
  ok(gh3.files.has("journal-pirou-plage.json"), "conflit 409 : résolu par relecture et fusion");
  await o3.ctx.close();

  // d) jeton refusé : message clair, l'application fonctionne
  const gh4 = fakeGitHub({ status401: true });
  const o4 = await openApp("logonna", { sync: SYNC, gh: gh4 });
  await waitText(o4.page, /CONDITIONS DU JOUR/);
  ok(/jeton refusé/.test(await T(o4.page)), "jeton refusé : message explicite, application utilisable");
  await o4.ctx.close();

  // e) réglages : saisie du jeton depuis l'interface
  const gh5 = fakeGitHub();
  const o5 = await openApp("logonna", { gh: gh5 });
  await waitText(o5.page, /CONDITIONS DU JOUR/);
  await o5.page.getByRole("button", { name: "Réglages" }).click();
  await o5.page.screenshot({ path: `${SHOTS}/sync-settings.png` });
  await o5.page.fill('input[type="password"]', "github_pat_TEST");
  await o5.page.getByRole("button", { name: "Enregistrer et tester" }).click();
  await waitText(o5.page, /Journal sauvegardé sur GitHub/, 10000);
  ok(await o5.page.evaluate(() => JSON.parse(localStorage.getItem("bar:sync") || "{}").token === "github_pat_TEST"), "réglages : jeton testé puis mémorisé sur l'appareil");
  await o5.page.getByRole("button", { name: /JOURNAL/ }).first().click();
  await o5.page.getByRole("button", { name: /^ENREGISTRER$/ }).click();
  await o5.page.waitForTimeout(2500);
  ok(gh5.files.has("journal-logonna-daoulas.json"), "réglages : la session suivante part sur GitHub");
  await o5.ctx.close();
}

// ── 5. Hors ligne sur le spot (service worker) ──
{
  const ctx = await browser.newContext({ ...devices["iPhone 13"], locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: "allow" });
  const { page, errors } = await openApp("logonna", { context: ctx, sw: "allow" });
  await waitText(page, /CONDITIONS DU JOUR/);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await waitText(page, /CONDITIONS DU JOUR/);   // page désormais contrôlée par le SW
  await ctx.setOffline(true);
  await page.reload();
  await waitText(page, /MARÉE — /, 15000);
  const txt = await T(page);
  ok(/PLEINE MER/.test(txt), "hors ligne : l'application s'ouvre, marée calculée");
  ok(/CONDITIONS DU JOUR/.test(txt), "hors ligne : dernière météo téléchargée réaffichée");
  ok(errors.filter((e) => !/net::|Failed to fetch/.test(e)).length === 0, "hors ligne : aucune erreur JavaScript");
  await ctx.close();
}

await browser.close(); server.close();
const fails = results.filter((r) => !r[0]);
for (const [c, l] of results) console.log(`${c ? "  ✓" : "  ✗"} ${l}`);
console.log(`\nE2E : ${results.length - fails.length}/${results.length}`);
process.exit(fails.length ? 1 : 0);
