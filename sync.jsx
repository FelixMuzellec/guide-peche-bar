// Sauvegarde du journal dans un dépôt GitHub PRIVÉ.
//
// Le navigateur garde le journal sur l'appareil ; GitHub en garde la copie
// de référence, versionnée (un commit par enregistrement), partagée entre le
// téléphone et l'ordinateur et lisible par Claude pour recalibrer les spots.
// Fusion sans perte : union par identifiant de session, aucune suppression.
import { useEffect, useState } from "react";
import { onJournalWrite } from "./storage.js";

const CFG_KEY = "bar:sync";
const DEFAULT_CFG = { owner: "FelixMuzellec", repo: "guide-peche-bar-journal", token: "" };

export function getCfg() {
  try { const c = JSON.parse(localStorage.getItem(CFG_KEY) || "null"); return c && c.token ? { ...DEFAULT_CFG, ...c } : null; }
  catch { return null; }
}
function setCfg(c) { try { c ? localStorage.setItem(CFG_KEY, JSON.stringify(c)) : localStorage.removeItem(CFG_KEY); } catch { /* sans effet */ } }

const b64enc = (str) => { let bin = ""; for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b); return btoa(bin); };
const b64dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(String(b64).replace(/\s/g, "")), (c) => c.charCodeAt(0)));

async function gh(cfg, method, file, body) {
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${file}`;
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, {
      method, cache: "no-store", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
                 ...(body ? { "Content-Type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null; try { json = await res.json(); } catch { /* vide */ }
    return { status: res.status, json };
  } catch (e) {
    return { status: 0, json: { message: e?.name === "AbortError" ? "délai dépassé" : (e?.message || "réseau indisponible") } };
  } finally { clearTimeout(timer); }
}

function explain(status, json) {
  if (status === 401) return "jeton refusé (expiré ou mal copié)";
  if (status === 403) return "jeton sans droit d'écriture sur ce dépôt (Contents : Read and write)";
  if (status === 404) return "dépôt introuvable pour ce jeton (nom du dépôt, ou dépôt non inclus dans le jeton)";
  if (status === 0) return json?.message || "réseau indisponible";
  return `GitHub ${status}${json?.message ? " : " + json.message : ""}`;
}

const fileFor = (siteId) => `journal-${siteId}.json`;
const localKey = (siteId) => `bar:journal:${siteId}`;
function readLocal(siteId) { try { const v = JSON.parse(localStorage.getItem(localKey(siteId)) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }

/** Union par identifiant ; à identifiant égal, les champs locaux complètent le distant. */
export function mergeEntries(remote, local) {
  const by = new Map();
  for (const e of remote || []) if (e && e.id != null) by.set(String(e.id), e);
  for (const e of local || []) if (e && e.id != null) by.set(String(e.id), { ...(by.get(String(e.id)) || {}), ...e });
  return [...by.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function readRemote(cfg, siteId) {
  const r = await gh(cfg, "GET", fileFor(siteId));
  if (r.status === 404) {
    // 404 ambigu : fichier absent (normal au premier usage), dépôt vide, OU dépôt inaccessible.
    const repo = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}`,
      { cache: "no-store", headers: { Authorization: `Bearer ${cfg.token}`, Accept: "application/vnd.github+json" } }).catch(() => null);
    if (repo && repo.ok) return { ok: true, entries: [], sha: null };
    return { ok: false, reason: explain(repo ? repo.status : 0, null) };
  }
  if (r.status !== 200) return { ok: false, reason: explain(r.status, r.json) };
  try {
    const entries = JSON.parse(b64dec(r.json.content));
    if (!Array.isArray(entries)) return { ok: false, reason: "fichier du journal illisible sur GitHub" };
    return { ok: true, entries, sha: r.json.sha };
  } catch { return { ok: false, reason: "fichier du journal illisible sur GitHub" }; }
}

/** Synchronisation complète : lit GitHub, fusionne, écrit des deux côtés si besoin. */
export async function syncJournal(siteId, cfg = getCfg()) {
  if (!cfg) return { state: "off" };
  for (let attempt = 0; attempt < 2; attempt++) {
    const rem = await readRemote(cfg, siteId);
    if (!rem.ok) return { state: "error", msg: rem.reason };
    const local = readLocal(siteId);
    const merged = mergeEntries(rem.entries, local);
    if (!same(merged, local)) { try { localStorage.setItem(localKey(siteId), JSON.stringify(merged)); } catch { /* quota */ } }
    if (same(merged, mergeEntries(rem.entries, []))) return { state: "ok", at: Date.now(), n: merged.length, pulled: !same(merged, local) };
    const put = await gh(cfg, "PUT", fileFor(siteId), {
      message: `Journal ${siteId} : ${merged.length} session${merged.length > 1 ? "s" : ""}`,
      content: b64enc(JSON.stringify(merged, null, 2) + "\n"), ...(rem.sha ? { sha: rem.sha } : {}),
    });
    if (put.status === 200 || put.status === 201) return { state: "ok", at: Date.now(), n: merged.length, pushed: true, pulled: !same(merged, local) };
    if (put.status === 409 || put.status === 422) continue;   // écrit ailleurs entre-temps : on relit et on refusionne
    return { state: "error", msg: explain(put.status, put.json) };
  }
  return { state: "error", msg: "conflit d'écriture répété, réessaie" };
}

// ── Bandeau d'état et réglages ───────────────────────────────────────
const C = { bg: "#020617", line: "#1e293b", txt: "#94a3b8", dim: "#475569", ok: "#22c55e", warn: "#f59e0b", err: "#f87171", acc: "#38bdf8" };
const fmt = (ms) => new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

export function SyncBar({ siteId, initial }) {
  const [st, setSt] = useState(initial || { state: getCfg() ? "syncing" : "off" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => getCfg() || DEFAULT_CFG);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let timer = null;
    const off = onJournalWrite(() => {
      if (!getCfg()) return;
      clearTimeout(timer);
      setSt((s) => ({ ...s, state: "syncing" }));
      timer = setTimeout(async () => setSt(await syncJournal(siteId)), 1200);
    });
    return () => { off(); clearTimeout(timer); };
  }, [siteId]);

  const save = async () => {
    setBusy(true);
    const cfg = { owner: form.owner.trim(), repo: form.repo.trim(), token: form.token.trim() };
    const r = await syncJournal(siteId, cfg);
    if (r.state === "ok") { setCfg(cfg); setOpen(false); if (r.pulled) window.location.reload(); }
    setSt(r); setBusy(false);
  };
  const disable = () => { setCfg(null); setSt({ state: "off" }); setForm(DEFAULT_CFG); setOpen(false); };

  const label = st.state === "ok" ? <span style={{ color: C.ok }}>● Journal sauvegardé sur GitHub · {fmt(st.at)}{st.n ? ` · ${st.n} session${st.n > 1 ? "s" : ""}` : ""}</span>
    : st.state === "syncing" ? <span style={{ color: C.acc }}>◌ Sauvegarde GitHub…</span>
    : st.state === "error" ? <span style={{ color: C.err }}>⚠ Sauvegarde GitHub en échec : {st.msg}</span>
    : <span style={{ color: C.warn }}>○ Journal sur cet appareil seulement</span>;

  const inp = { width: "100%", boxSizing: "border-box", padding: "8px 9px", borderRadius: 6, border: `1px solid ${C.line}`, background: "#0b1220", color: "#e2e8f0", fontSize: 13, fontFamily: "monospace", marginTop: 3 };
  return (
    <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 1000, background: C.bg, borderTop: `1px solid ${C.line}`, fontFamily: "system-ui,sans-serif", paddingBottom: "env(safe-area-inset-bottom)" }}>
      {open && (
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "12px 16px 4px", color: C.txt, fontSize: 12, lineHeight: 1.55, maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ color: "#e2e8f0", fontWeight: 700, marginBottom: 6 }}>Sauvegarde du journal sur GitHub</div>
          <p style={{ margin: "0 0 8px" }}>
            Le journal est gardé sur cet appareil. Pour ne plus jamais le perdre et le retrouver sur tous tes appareils,
            il est aussi écrit dans un dépôt GitHub <strong>privé</strong> (un fichier par application, un historique par enregistrement).
          </p>
          <ol style={{ margin: "0 0 8px", paddingLeft: 18 }}>
            <li>Crée un dépôt <strong>privé</strong> nommé <code>guide-peche-bar-journal</code>.</li>
            <li>GitHub → Settings → Developer settings → Fine-grained tokens → Generate : accès au seul dépôt
              du journal, permission <em>Contents : Read and write</em>.</li>
            <li>Colle le jeton ci-dessous. Il reste sur cet appareil et n'est envoyé qu'à GitHub.</li>
          </ol>
          <label>Compte<input style={inp} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} autoCapitalize="off" autoCorrect="off" /></label>
          <label style={{ display: "block", marginTop: 6 }}>Dépôt<input style={inp} value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} autoCapitalize="off" autoCorrect="off" /></label>
          <label style={{ display: "block", marginTop: 6 }}>Jeton<input style={inp} type="password" value={form.token} placeholder="github_pat_…" onChange={(e) => setForm({ ...form, token: e.target.value })} autoCapitalize="off" autoCorrect="off" /></label>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <button disabled={busy || !form.token.trim()} onClick={save} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${C.acc}`, background: "rgba(14,165,233,0.15)", color: C.acc, fontSize: 12, cursor: "pointer" }}>{busy ? "Test…" : "Enregistrer et tester"}</button>
            {getCfg() && <button onClick={disable} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${C.line}`, background: "none", color: C.txt, fontSize: 12, cursor: "pointer" }}>Désactiver</button>}
            <button onClick={() => setOpen(false)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${C.line}`, background: "none", color: C.dim, fontSize: 12, cursor: "pointer" }}>Fermer</button>
          </div>
          <p style={{ margin: "10px 0 4px", color: C.dim, fontSize: 11 }}>
            iPhone : Partager → « Sur l'écran d'accueil ». L'application s'ouvre alors en plein écran et Safari ne purge plus ses données.
          </p>
          <p style={{ margin: "0 0 8px", color: C.dim, fontSize: 10 }}>
            Météo : <a href="https://open-meteo.com/" style={{ color: C.dim }}>Open-Meteo.com</a> (CC BY 4.0), modèles Météo-France AROME et ECMWF ·
            Marée : constantes TICON-4 (CC BY 4.0), calcul d'après Neaps (MIT).
          </p>
        </div>
      )}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "7px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, fontSize: 11 }}>
        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <button onClick={() => setOpen(!open)} style={{ flexShrink: 0, padding: "4px 10px", borderRadius: 5, border: `1px solid ${C.line}`, background: "none", color: C.txt, fontSize: 11, cursor: "pointer" }}>{open ? "Masquer" : "Réglages"}</button>
      </div>
    </div>
  );
}
