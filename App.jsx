// Écran principal : données du jour (calculées une fois) et navigation par onglets.
// Chaque onglet reçoit le même objet `g` ; aucun ne refait de calcul lourd.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SITE, SPOTS } from "SITE_CONFIG";
import { solarTimes } from "../engine/core.js";
import { calibrate, loadJournal, saveJournal, sessionConditions, sessionHour } from "../engine/journal.js";
import { lureAdvice } from "../engine/lures.js";
import { bestDaytime, DEFAULT_HOURS, loadOrient, pressureStrategy, pressureZone, saveOrient, scoreDay, selectTop3, terrainOf, thermalPresence } from "../engine/model.js";
import { regulationFor, securityFor } from "../engine/rules.js";
import { reconcileCoefs, tideDay } from "../engine/tide.js";
import { fetchLiveCached, fetchWeekCached, getCached, isoAddDays, loadStore, localTodayISO, validateLive } from "../engine/weather.js";
import { parisHHMM, parisISO } from "./components.jsx";
import { C, FONT } from "./kit.jsx";
import { TabBar, tabFromHash } from "./TabBar.jsx";
import { JournalTab } from "./tabs/JournalTab.jsx";
import { Leurres } from "./tabs/Leurres.jsx";
import { Maree } from "./tabs/Maree.jsx";
import { Meteo } from "./tabs/Meteo.jsx";
import { Regles } from "./tabs/Regles.jsx";
import { Saison } from "./tabs/Saison.jsx";
import { Spots } from "./tabs/Spots.jsx";
import { Synthese } from "./tabs/Synthese.jsx";

// Texte lu par les lecteurs d'écran, invisible à l'écran.
const SR = { position:"absolute", width:1, height:1, padding:0, margin:-1, overflow:"hidden", clip:"rect(0 0 0 0)", whiteSpace:"nowrap", border:0 };
const lsGet = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage refusé : sans effet */ } };

export default function FishingGuide() {
  const todayISO = localTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [spotId, setSpotId] = useState(null);
  const [focus, setFocus] = useState(0);   // incrémenté pour faire défiler jusqu'à la fiche du spot

  // ── Onglet courant, inscrit dans l'adresse ──
  const [tab, setTabState] = useState(tabFromHash);
  useEffect(() => {
    const f = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const goTab = useCallback((k) => {
    if (tabFromHash() !== k) location.hash = k; else setTabState(k);
    try { window.scrollTo({ top: 0 }); } catch { /* sans effet */ }
  }, []);

  // ── Réglages de cet appareil ──
  const hoursKey = "bar:heures:" + SITE.id;
  const [hours, setHoursState] = useState(() => {
    const v = lsGet(hoursKey);
    return v && Number.isFinite(v.from) && Number.isFinite(v.to) && v.from < v.to ? v : DEFAULT_HOURS;
  });
  const setHours = (h) => { setHoursState(h); lsSet(hoursKey, h); };
  const [orient, setOrientState] = useState(() => loadOrient());
  const setOrient = (o) => { setOrientState(o); saveOrient(o); };

  // ── Journal ──
  const [journal, setJournal] = useState([]);
  const [jStatus, setJStatus] = useState("loading");   // loading|ok|empty|unavailable
  const [jReason, setJReason] = useState("");
  const [jError, setJError] = useState("");
  const [preset, setPreset] = useState(null);
  useEffect(() => { loadJournal().then((r) => { setJournal(r.entries); setJStatus(r.status); setJReason(r.reason || ""); }); }, []);
  const calib = useMemo(() => calibrate(journal), [journal]);

  // ── Session en cours (« Je pêche ici maintenant ») ──
  const sessKey = "bar:encours:" + SITE.id;
  const [session, setSessionState] = useState(() => {
    const v = lsGet(sessKey);
    return v && v.spotId && Number.isFinite(v.start) && Date.now() - v.start < 24 * 36e5 ? v : null;
  });
  const setSession = (v) => { setSessionState(v); lsSet(sessKey, v); };
  const [, tick] = useState(0);
  useEffect(() => { if (!session) return undefined; const t = setInterval(() => tick((x) => x + 1), 60000); return () => clearInterval(t); }, [session]);

  // ── Météo ──
  const doFetch = useCallback(async (dateISO, { force = false } = {}) => {
    if (!force) {
      const cached = getCached(dateISO);
      if (cached) { setLive(cached); setError(null); return; }
    }
    setLoading(true); setError(null);
    try {
      const data = await fetchLiveCached(dateISO, { force, onRetry: (attempt, seconds) => setError(`Open-Meteo sature — nouvelle tentative dans ${seconds}s (${attempt}/3)…`) });
      setLive(data); setFetchedAt(new Date()); setError(null);
    } catch (e) {
      setError(e.isRateLimit || e.message === "429" ? "Open-Meteo sature après 3 tentatives — patiente une minute puis réessaie" : e.message);
    } finally { setLoading(false); }
  }, []);
  const debounceRef = useRef(null);
  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => { loadStore().then(() => setStoreReady(true)); }, []);
  useEffect(() => {
    if (!storeReady) return undefined;   // ne pas partir en requête avant d'avoir lu le cache
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doFetch(selectedDate), getCached(selectedDate) ? 0 : 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectedDate, doFetch, storeReady]);
  // Jamais la météo d'un autre jour : pendant un téléchargement ou après un échec, rien plutôt que faux.
  const d = live && live.date === selectedDate ? live : null;

  // ── Marée calculée localement (sans réseau) ──
  const coefCheck = useMemo(() => reconcileCoefs(selectedDate, d?.coef_shom), [selectedDate, d?.coef_shom]);
  const tideCache = useMemo(() => new Map(), [selectedDate, coefCheck]);   // eslint-disable-line react-hooks/exhaustive-deps
  const tideFor = useCallback((port) => {
    const key = port || SITE.tide.defaultPort;
    if (!tideCache.has(key)) {
      let t = null;
      try { t = tideDay(selectedDate, key, coefCheck.override); } catch (e) { t = { error: String(e?.message || e), events: [], dayEvents: [], curve: [], coefs: [] }; }
      tideCache.set(key, t);
    }
    return tideCache.get(key);
  }, [tideCache, selectedDate, coefCheck]);
  const tide = useMemo(() => tideFor(SITE.tide.defaultPort), [tideFor]);
  const coeff = tide.maxCoef || 0;

  const sst = d?.sst != null && !isNaN(parseFloat(d.sst)) ? parseFloat(d.sst) : null;
  const pressure = parseInt(d?.pressure) || 0;
  const presenceInfo = useMemo(() => thermalPresence(sst), [sst]);
  const pressureInfo = useMemo(() => pressureStrategy(pressure, d?.pressure_trend || null, parseFloat(d?.pressure_delta_24h) || 0), [pressure, d?.pressure_trend, d?.pressure_delta_24h]);
  const pressureZoneInfo = useMemo(() => pressureZone(pressure), [pressure]);
  const sun = useMemo(() => solarTimes(selectedDate), [selectedDate]);
  const dataWarnings = useMemo(() => validateLive(d, selectedDate), [d, selectedDate]);
  const reg = useMemo(() => regulationFor(selectedDate, SITE.lat), [selectedDate]);

  // ── Classement : chaque spot noté sur la météo de ses coordonnées et sa meilleure fenêtre ──
  const allScored = useMemo(() => scoreDay(selectedDate, d, { calib, hours, tideFor, orient }), [selectedDate, d, calib, hours, tideFor, orient]);
  const top3 = useMemo(() => selectTop3(allScored), [allScored]);
  const localForced = useMemo(() => {
    const pure3ids = allScored.filter((s) => s.eligible).slice(0, 3).map((s) => s.id);
    const slot3 = top3[2];
    return slot3?.isLocal && !pure3ids.includes(slot3.id) ? slot3 : null;
  }, [top3, allScored]);
  const activeSpot = (spotId && allScored.find((s) => s.id === spotId)) || top3[0] || allScored[0];

  // Une session archivée sans score prédit est complétée dès que sa date est ouverte.
  const backfilled = useRef(new Set());
  useEffect(() => {
    if (!d || jStatus === "loading" || jStatus === "unavailable" || !allScored.length) return;
    const needCond = (e) => !e.cond && sessionHour(e, selectedDate) != null;
    const todo = journal.filter((e) => e.date === selectedDate && (e.predicted == null || needCond(e)) && !backfilled.current.has(e.id));
    if (!todo.length) return;
    const next = journal.map((e) => {
      if (!todo.some((x) => x.id === e.id)) return e;
      const sc = allScored.find((s) => s.id === e.spotId);
      backfilled.current.add(e.id);
      let out = e;
      if (e.predicted == null && sc?.score != null) out = { ...out, predicted: parseFloat(sc.score.toFixed(2)), backfilled: true };
      if (needCond(e)) { const c = sessionConditions(selectedDate, d, SPOTS.find((s) => s.id === e.spotId), sessionHour(e, selectedDate), tideFor); if (c) out = { ...out, cond: c, condEstimee: !e.heure }; }
      return out;
    });
    if (next.every((e, i) => e === journal[i])) return;
    setJournal(next);
    saveJournal(next, jStatus);
  }, [d, journal, allScored, selectedDate, jStatus, tideFor]);

  // ── Verdict : le meilleur spot, SON créneau, ses consignes, SON leurre ──
  const verdict = useMemo(() => {
    const ok = top3.filter((s) => s.eligible);
    if (!ok.length) return null;
    const pack = (s) => ({ s, w: (s.windows || []).find((w) => w.id === s.bestWindowId) || null });
    return { ...pack(ok[0]), terr: terrainOf(ok[0]), next: ok.slice(1, 3).map(pack) };
  }, [top3]);
  const verdictAlerts = useMemo(() => (verdict ? securityFor(verdict.s, { coeff, window: verdict.w }) : []), [verdict, coeff]);
  const verdictLure = useMemo(() => (verdict ? lureAdvice(verdict.s, verdict.w, d, selectedDate) : null), [verdict, d, selectedDate]);
  // Le verdict tombe presque toujours à l'aube, au crépuscule ou de nuit (la lumière
  // départage les créneaux de marée d'un spot) : on montre aussi le meilleur créneau de plein jour.
  const daytime = useMemo(() => {
    if (!verdict?.w || verdict.w.light?.band === "jour") return null;
    const b = bestDaytime(allScored);
    return b ? { ...b, lure: lureAdvice(b.s, b.w, d, selectedDate) } : null;
  }, [verdict, allScored, d, selectedDate]);

  // ── Semaine ──
  const [week, setWeek] = useState({ loading: false, days: null, error: null });
  const loadWeek = async (force = false) => {
    setWeek((w) => ({ ...w, loading: true, error: null }));
    try { const days = await fetchWeekCached(todayISO, { force }); setWeek({ loading: false, days, error: null }); }
    catch (e) { setWeek({ loading: false, days: null, error: e?.isRateLimit ? "Open-Meteo sature — réessaie dans une minute." : (e?.message || String(e)) }); }
  };
  const weekRows = useMemo(() => (week.days ? week.days.map(({ date, live: lv, error: err }) => {
    if (!lv) return { date, err: err || "Météo indisponible" };
    const best = selectTop3(scoreDay(date, lv, { calib, hours, orient })).find((s) => s.eligible);
    return { date, s: best || null, w: best ? (best.windows || []).find((x) => x.id === best.bestWindowId) : null, noKill: regulationFor(date, SITE.lat).noKill };
  }) : null), [week.days, calib, hours, orient]);

  // ── Navigation vers un spot ──
  const goToSpot = useCallback((id) => { setSpotId(id); goTab("spots"); setFocus((x) => x + 1); }, [goTab]);
  // Ouvre l'onglet Leurres sur un spot et un créneau précis.
  const [lureWin, setLureWin] = useState(null);
  const goLure = useCallback((id, winId) => { setSpotId(id); setLureWin({ spotId: id, winId }); goTab("leurres"); }, [goTab]);
  const pickDate = (date) => { setSelectedDate(date); };

  const startSession = (id) => setSession({ spotId: id, start: Date.now() });
  const endSession = () => {
    const s = session; if (!s) return;
    const duree = Math.max(0.25, Math.round((Date.now() - s.start) / 36e5 * 4) / 4);
    const date = parisISO(s.start);
    setSession(null);
    if (date !== selectedDate) setSelectedDate(date);
    setPreset({ spotId: s.spotId, heure: parisHHMM(s.start), duree, nonce: Date.now() });
    goTab("journal");
  };
  const sessSpot = session ? SPOTS.find((s) => s.id === session.spotId) : null;
  const elapsed = session ? Math.max(0, Math.round((Date.now() - session.start) / 60000)) : 0;

  const g = {
    todayISO, selectedDate, pickDate, live: d, loading, error, fetchedAt, doFetch, tab, goTab,
    tide, tideFor, coeff, coefCheck, sun, sst, pressure, presenceInfo, pressureInfo, pressureZoneInfo, dataWarnings, reg,
    allScored, top3, localForced, activeSpot, spotId, setSpotId, goToSpot, focus, verdict, verdictAlerts, verdictLure, daytime, lureWin, goLure,
    hours, setHours, orient, setOrient, week, weekRows, loadWeek,
    journal, setJournal, jStatus, setJStatus, jReason, jError, setJError, calib, preset,
    session, startSession, endSession,
  };

  // Très petit écran (< 350 px) : jour de la semaine abrégé, pour que la date tienne sur une ligne.
  const narrow = typeof window !== "undefined" && window.innerWidth < 350;
  const dateLabel = new Date(selectedDate + "T12:00").toLocaleDateString("fr-FR", { weekday: narrow ? "short" : "long", day: "numeric", month: "long" });
  const daysOffset = Math.round((new Date(selectedDate + "T12:00") - new Date(todayISO + "T12:00")) / 86400000);
  const rel = daysOffset === 0 ? "Aujourd'hui" : daysOffset === 1 ? "Demain" : daysOffset === -1 ? "Hier" : daysOffset > 0 ? `Dans ${daysOffset} j` : `Il y a ${-daysOffset} j`;
  const arrowBtn = { width:44, height:44, borderRadius:10, border:`1px solid ${C.line}`, background:C.card, color:C.text, fontSize:20, cursor:"pointer", flexShrink:0 };

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:FONT,fontSize:15,lineHeight:1.5}}>
      {/* EN-TÊTE : lieu et date, communs à tous les onglets */}
      <header style={{maxWidth:760,margin:"0 auto",padding:"14px 14px 10px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
          <h1 style={{fontSize:13,color:C.accent,fontWeight:700,letterSpacing:"0.03em"}}>Guide du bar · {SITE.name}</h1>
          <button onClick={() => doFetch(selectedDate, { force: true })} disabled={loading} title="Retélécharger la météo (ignore le cache)" aria-label="Retélécharger la météo"
            style={{minHeight:40,padding:"6px 12px",borderRadius:8,border:`1px solid ${C.line}`,background:"transparent",color:loading ? C.faint : C.accent,fontSize:13.5,cursor:loading ? "default" : "pointer"}}>
            <span style={{display:"inline-block",animation:loading ? "spin .85s linear infinite" : "none"}}>↻</span> Actualiser
          </button>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
          <button onClick={() => pickDate(isoAddDays(selectedDate, -1))} disabled={loading} title="Jour précédent" aria-label="Jour précédent" style={arrowBtn}>‹</button>
          <label style={{flex:1,minWidth:0,position:"relative",display:"block",cursor:"pointer"}}>
            <span style={{display:"block",fontSize:"clamp(16px, 5.2vw, 19px)",fontWeight:800,color:C.strong,lineHeight:1.2,textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dateLabel}</span>
            <span style={{display:"block",fontSize:13,color:daysOffset === 0 ? C.good : C.muted,fontWeight:600}}>{rel}{daysOffset > 10 ? " · météo en tendance" : daysOffset < 0 ? " · archives météo" : ""}</span>
            <input type="date" aria-label="Date" value={selectedDate} onChange={(e) => e.target.value && pickDate(e.target.value)} disabled={loading}
              style={{position:"absolute",inset:0,opacity:0,width:"100%",height:"100%",cursor:"pointer"}}/>
          </label>
          <button onClick={() => pickDate(isoAddDays(selectedDate, 1))} disabled={loading} title="Jour suivant" aria-label="Jour suivant" style={arrowBtn}>›</button>
        </div>
        {daysOffset !== 0 && (
          <button onClick={() => pickDate(todayISO)} style={{marginTop:4,minHeight:40,background:"none",border:"none",padding:"4px 0",color:C.accent,fontSize:14,fontWeight:600,cursor:"pointer"}}>↺ Revenir à aujourd'hui</button>
        )}
      </header>

      {/* Barre d'onglets et session en cours dans un même bloc collant : pas de chevauchement. */}
      <div style={{position:"sticky",top:0,zIndex:50}}>
        <TabBar tab={tab} onChange={goTab}/>
        {session && (
          <div role="status" style={{background:"rgba(46,16,101,0.97)",borderBottom:"1px solid #6d28d9"}}>
            <div style={{maxWidth:760,margin:"0 auto",padding:"3px 8px 3px 14px",display:"flex",alignItems:"center",gap:8,fontSize:14,color:"#ede9fe"}}>
              <span style={{flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><span style={SR}>Session en cours : </span>🎣 <b>{sessSpot?.name ?? session.spotId}</b> · {elapsed >= 60 ? `${Math.floor(elapsed / 60)} h ${String(elapsed % 60).padStart(2, "0")}` : `${elapsed} min`}<span style={{color:"#c4b5fd"}}> depuis {parisHHMM(session.start).replace(":", "h")}</span></span>
              <button onClick={endSession} style={{minHeight:40,padding:"0 12px",borderRadius:8,border:"1px solid #c4b5fd",background:"rgba(196,181,253,0.18)",color:"#fff",fontSize:13.5,fontWeight:700,cursor:"pointer",flexShrink:0}}>Terminer et noter</button>
              <button onClick={() => setSession(null)} aria-label="Annuler la session" title="Annuler la session" style={{minWidth:40,minHeight:40,fontSize:18,color:"#c4b5fd",background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}>✕</button>
            </div>
          </div>
        )}
      </div>

      <main style={{maxWidth:760,margin:"0 auto",padding:"14px 14px 80px"}}>
        <div role="tabpanel" id="panneau" aria-labelledby={`onglet-${tab}`}>
          {tab === "synthese" && <Synthese g={g}/>}
          {tab === "spots" && <Spots g={g}/>}
          {tab === "leurres" && <Leurres g={g}/>}
          {tab === "maree" && <Maree g={g}/>}
          {tab === "meteo" && <Meteo g={g}/>}
          {tab === "saison" && <Saison g={g}/>}
          {tab === "journal" && <JournalTab g={g}/>}
          {tab === "regles" && <Regles g={g}/>}
        </div>
      </main>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}nav [role=tablist]::-webkit-scrollbar{display:none}"}</style>
    </div>
  );
}
