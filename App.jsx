// Écran principal du guide.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GENERAL_PRINCIPLES, SITE, SPOTS } from "SITE_CONFIG";
import { fmtH, solarTimes } from "../engine/core.js";
import { calibrate, conditionsLine, loadJournal, saveJournal, sessionConditions, sessionHour } from "../engine/journal.js";
import { ALL_HOURS, GRATTER, adviceForSpot, pressureStrategy, pressureZone, preyForMonth, scoreDay, selectTop3, terrainOf, thermalPresence } from "../engine/model.js";
import { reconcileCoefs, tideDay } from "../engine/tide.js";
import { fetchLiveCached, fetchWeekCached, getCached, loadStore, localTodayISO, validateLive } from "../engine/weather.js";
import { ConfidenceBadge, DayStrip, JournalForm, Loader, Pill, ScoreArc, TerrainBlock, TideChart, TopoBlock, WindowRow } from "./components.jsx";

// ═══════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════
export default function FishingGuide() {
  const todayISO = localTodayISO();
  const [selectedDate, setSelectedDate] = useState(todayISO);
  const [live, setLive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [spotId, setSpotId] = useState(null);
  const [tab, setTab] = useState("fenetres");
  const [showAll, setShowAll] = useState(false);
  const hoursKey = "bar:heures:" + SITE.id;
  const [hours, setHoursState] = useState(()=>{
    try { const v = JSON.parse(localStorage.getItem(hoursKey) || "null");
      if (v && Number.isFinite(v.from) && Number.isFinite(v.to) && v.from < v.to) return v; } catch { /* réglage absent */ }
    return ALL_HOURS;
  });
  const setHours = (h) => { setHoursState(h); try { localStorage.setItem(hoursKey, JSON.stringify(h)); } catch { /* sans effet */ } };
  const [showSources, setShowSources] = useState(false);
  const [showPrinciples, setShowPrinciples] = useState(false);
  const [journal, setJournal] = useState([]);
  const [showJournal, setShowJournal] = useState(false);
  const [jStatus, setJStatus] = useState("loading");   // loading|ok|empty|unavailable
  const [jReason, setJReason] = useState("");
  const [jError, setJError] = useState("");
  useEffect(()=>{ loadJournal().then(r=>{ setJournal(r.entries); setJStatus(r.status); setJReason(r.reason||""); }); },[]);
  const calib = useMemo(()=>calibrate(journal),[journal]);
  const dateStr = new Date(selectedDate + "T12:00").toLocaleDateString("fr-FR", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  const daysOffset = Math.round((new Date(selectedDate+"T12:00") - new Date(todayISO+"T12:00")) / 86400000);
  const relLabel = daysOffset===0?"Aujourd'hui":daysOffset===1?"Demain":daysOffset===-1?"Hier":daysOffset===2?"Après-demain":daysOffset>2?`Dans ${daysOffset}j`:`Il y a ${-daysOffset}j`;
  const isFarFuture = daysOffset > 10;
  const isPast = daysOffset < 0;

  const shiftDate = (days) => {
    const dt = new Date(selectedDate+"T12:00");
    dt.setDate(dt.getDate() + days);
    setSelectedDate(dt.toISOString().split("T")[0]);
  };

  const doFetch = useCallback(async (dateISO, { force = false } = {}) => {
    if (!force) {
      const cached = getCached(dateISO);
      if (cached) {
        setLive(cached);
        setError(null);
        setSpotId(null);
        return;
      }
    }

    setLoading(true); setError(null);
    try {
      const data = await fetchLiveCached(dateISO, {
        force,
        onRetry: (attempt, seconds) => {
          setError(`Open-Meteo sature — nouvelle tentative dans ${seconds}s (${attempt}/3)…`);
        }
      });
      setLive(data); setFetchedAt(new Date()); setSpotId(null);
      setError(null);
    } catch(e) {
      const msg = e.isRateLimit || e.message === "429"
        ? "Open-Meteo sature après 3 tentatives — patiente une minute puis réessaie"
        : e.message;
      setError(msg);
    } finally { setLoading(false); }
  }, []);

  const debounceRef = useRef(null);
  const [storeReady, setStoreReady] = useState(false);
  useEffect(() => { loadStore().then(()=>setStoreReady(true)); }, []);
  useEffect(() => {
    if (!storeReady) return;   // ne pas partir en requête avant d'avoir lu le cache
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const delay = getCached(selectedDate) ? 0 : 400;
    debounceRef.current = setTimeout(() => doFetch(selectedDate), delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [selectedDate, doFetch, storeReady]);

  const d = live;
  // v5 — Marée calculée localement : disponible même sans réseau, identique à
  // chaque ouverture. Les coefficients officiels renvoyés par la recherche web
  // ne sont retenus que s'ils concordent avec le calcul (±2).
  const coefCheck = useMemo(()=>reconcileCoefs(selectedDate, d?.coef_shom),[selectedDate, d?.coef_shom]);
  const tideCache = useMemo(()=>new Map(),[selectedDate, coefCheck]);
  const tideFor = useCallback((port)=>{
    const key = port || SITE.tide.defaultPort;
    if (!tideCache.has(key)) {
      let t = null;
      try { t = tideDay(selectedDate, key, coefCheck.override); } catch(e) { t = { error: String(e?.message||e), events: [], dayEvents: [], curve: [], coefs: [] }; }
      tideCache.set(key, t);
    }
    return tideCache.get(key);
  },[tideCache, selectedDate, coefCheck]);
  const tide = useMemo(()=>tideFor(SITE.tide.defaultPort),[tideFor]);
  const coeff = tide.maxCoef || 0;
  const coefSource = coefCheck.accepted.length && coefCheck.accepted.length === coefCheck.computed.length ? "shom" : "calcul";
  const windF=parseInt(d?.wind_force)||0;
  const windDir=d?.wind_dir||"O", sky=d?.sky||"partly", houle=parseFloat(d?.houle)||0;
  const pressure = parseInt(d?.pressure)||0;
  const pressureTrend = d?.pressure_trend || null;
  const pressureDelta = parseFloat(d?.pressure_delta_24h)||0;

  const sst = d?.sst != null && !isNaN(parseFloat(d.sst)) ? parseFloat(d.sst) : null;
  const sstConfidence = d?.sst_confidence || "inconnue";
  const presenceInfo = useMemo(()=>thermalPresence(sst),[sst]);

  const pressureInfo = useMemo(()=>pressureStrategy(pressure,pressureTrend,pressureDelta),[pressure,pressureTrend,pressureDelta]);
  const pressureZoneInfo = useMemo(()=>pressureZone(pressure),[pressure]);

  const sun = useMemo(()=>solarTimes(selectedDate),[selectedDate]);
  const dataWarnings = useMemo(()=>validateLive(d,selectedDate),[d,selectedDate]);

  const tideData = tide.curve;

  // v4 : chaque spot est noté sur la météo de SA zone ET sur SA meilleure
  // fenêtre — marée, lumière et vent évalués ensemble, fenêtre par fenêtre.
  const allScored = useMemo(()=>scoreDay(selectedDate, d, { calib, hours, tideFor }),
    [selectedDate, d, calib, hours, tideFor]);

  const top3 = useMemo(()=>selectTop3(allScored),[allScored]);

  // Une session archivée sans score prédit est complétée dès que tu ouvres sa
  // date : elle rejoint alors le recalibrage au lieu de rester un simple souvenir.
  const backfilled = useRef(new Set());
  useEffect(()=>{
    // v5 : jamais de score prédit inscrit sans météo réelle (le classement
    // serait calculé sur des valeurs par défaut).
    if (!d || jStatus==="loading" || jStatus==="unavailable" || !allScored.length) return;
    const needCond = (e)=>!e.cond && sessionHour(e, selectedDate)!=null;
    const todo = journal.filter(e=>e.date===selectedDate && (e.predicted==null || needCond(e)) && !backfilled.current.has(e.id));
    if (!todo.length) return;
    const next = journal.map(e=>{
      const hit = todo.find(x=>x.id===e.id);
      if (!hit) return e;
      const sc = allScored.find(s=>s.id===e.spotId);
      backfilled.current.add(e.id);
      let out = e;
      if (e.predicted==null && sc?.score!=null) out = {...out, predicted: parseFloat(sc.score.toFixed(2)), backfilled:true};
      if (needCond(e)) { const c = sessionConditions(selectedDate, d, SPOTS.find(s=>s.id===e.spotId), sessionHour(e, selectedDate), tideFor); if (c) out = {...out, cond: c, condEstimee: !e.heure}; }
      return out;
    });
    if (next.every((e,i)=>e===journal[i])) return;
    setJournal(next);
    saveJournal(next, jStatus);
  },[d, journal, allScored, selectedDate, jStatus, tideFor]);
  const localForced = useMemo(()=>{
    const pure3ids = allScored.filter(s=>s.eligible).slice(0,3).map(s=>s.id);
    const slot3 = top3[2];
    return slot3?.isLocal && !pure3ids.includes(slot3.id) ? slot3 : null;
  },[top3,allScored]);

  const displayed = showAll ? allScored : top3;
  // v6.1 : un spot choisi hors du TOP 3 (liste complète) reste affiché — avant,
  // la fiche retombait sur le n°1 dès que la liste se refermait.
  const activeSpot = spotId ? (allScored.find(s=>s.id===spotId) ?? displayed[0]) : displayed[0];

  const marnage = tide.marnage != null ? tide.marnage.toFixed(1) : "–";
  const coefText = tide.coefs.length ? tide.coefs.join(" · ") : "–";
  const coefColor = coeff>=95?"#ef4444":coeff>=80?"#f59e0b":coeff>=60?"#38bdf8":"#64748b";
  const coefLabel = coeff>=95?"GRANDE VIVE-EAU":coeff>=80?"VIVE-EAU":coeff>=60?"MORTE-EAU FORTE":"MORTE-EAU";
  const beaufort = (["Calme","Très légère brise","Légère brise","Petite brise","Jolie brise","Bonne brise","Vent frais","Grand frais","Coup de vent","Fort coup de vent","Tempête","Violente tempête","Ouragan"][windF]||"–")+(d?.wind_kmh!=null?` · ${d.wind_kmh} km/h`:"")+(d?.gust_kmh!=null?` · raf. ${d.gust_kmh}`:"");
  const skyLabel = {clear:"☀ Clair",partly:"⛅ Mi-nuageux",overcast:"🌥 Couvert"}[sky]||sky;
  const dangerColor = ["","#22c55e","#f59e0b","#ef4444"];

  const detailRef = useRef(null);
  const [week, setWeek] = useState({ open:false, loading:false, days:null, error:null });
  const openWeek = async (force=false) => {
    setWeek(w=>({...w, open:true, loading:true, error:null}));
    try { const days = await fetchWeekCached(todayISO, { force }); setWeek({ open:true, loading:false, days, error:null }); }
    catch(e) { setWeek({ open:true, loading:false, days:null, error: e?.isRateLimit ? "Open-Meteo sature — réessaie dans une minute." : (e?.message||String(e)) }); }
  };
  const weekRows = useMemo(()=> week.days ? week.days.map(({date, live, error: err})=>{
    if (!live) return { date, err: err || "Météo indisponible" };
    const best = selectTop3(scoreDay(date, live, { calib, hours })).find(s=>s.eligible);
    return { date, s: best || null, w: best ? (best.windows||[]).find(x=>x.id===best.bestWindowId) : null };
  }) : null, [week.days, calib, hours]);
  const goToSpot = (id) => {
    setSpotId(id); setTab("fenetres"); if(showAll) setShowAll(false);
    setTimeout(()=>{ try { detailRef.current?.scrollIntoView({behavior:"smooth",block:"start"}); } catch { /* sans effet */ } }, 60);
  };
  // v6.1 — Verdict : le meilleur spot, SON créneau, la météo de ce créneau.
  const verdict = useMemo(()=>{
    const ok = top3.filter(s=>s.eligible);
    if (!ok.length) return null;
    const pack = (s)=>({ s, w: (s.windows||[]).find(w=>w.id===s.bestWindowId) || null });
    return { ...pack(ok[0]), terr: terrainOf(ok[0]), next: ok.slice(1,3).map(pack) };
  },[top3]);

  return (
    <div style={{minHeight:"100vh",background:"#020c18",color:"#e2e8f0",fontFamily:"Georgia,serif"}}>
      <div style={{position:"fixed",inset:0,backgroundImage:"radial-gradient(ellipse 80% 40% at 50% -5%,rgba(14,165,233,0.07) 0%,transparent 60%)",pointerEvents:"none",zIndex:0}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:720,margin:"0 auto",paddingBottom:56}}>

        {/* HEADER */}
        <div style={{padding:"22px 18px 0"}}>
          <div style={{fontSize:11,letterSpacing:"0.1em",color:"#0ea5e9",fontFamily:"monospace",fontWeight:700,marginBottom:10}}>
            ◈ GUIDE PÊCHE AU BAR — {SITE.headerLabel} · {SPOTS.length} SPOTS · SOURCES VÉRIFIÉES
          </div>

          <div style={{marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap",marginBottom:3}}>
              <h1 style={{margin:0,fontSize:21,fontWeight:700,color:"#f8fafc",lineHeight:1.15,letterSpacing:"-0.02em",textTransform:"capitalize"}}>{dateStr}</h1>
              <span style={{fontSize:12,fontFamily:"monospace",letterSpacing:"0.1em",color:daysOffset===0?"#22c55e":daysOffset>0?"#38bdf8":"#8a9ab0",background:(daysOffset===0?"#22c55e":daysOffset>0?"#38bdf8":"#64748b")+"15",border:`1px solid ${(daysOffset===0?"#22c55e":daysOffset>0?"#38bdf8":"#64748b")}40`,borderRadius:4,padding:"3px 9px",fontWeight:700}}>
                {relLabel.toUpperCase()}
              </span>
            </div>
            <div style={{fontSize:13,color:"#8a9ab0"}}>{SITE.name} → rayon {(()=>{const m=Math.max(...SPOTS.map(s=>s.distMin||0));return m>=60?`${Math.floor(m/60)}h${String(m%60).padStart(2,"0")}`:`${m} min`;})()} · 1 spot local garanti dans le TOP 3</div>
          </div>

          {/* DATE PICKER */}
          <div style={{background:"rgba(10,20,38,0.7)",border:"1px solid #1e293b",borderRadius:10,padding:"10px 12px",display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
            <div style={{display:"flex",alignItems:"center",gap:0,border:"1px solid #1e293b",borderRadius:7,overflow:"hidden",flex:"1 1 auto",minWidth:0}}>
              <button onClick={()=>shiftDate(-1)} disabled={loading} title="Jour précédent" style={{padding:"8px 12px",background:"rgba(5,12,25,0.8)",border:"none",borderRight:"1px solid #1e293b",color:loading?"#7b8ba1":"#94a3b8",cursor:loading?"not-allowed":"pointer",fontSize:14,fontFamily:"monospace",fontWeight:700,flexShrink:0}}>←</button>
              <input type="date" value={selectedDate} onChange={(e)=>e.target.value&&setSelectedDate(e.target.value)} disabled={loading} style={{flex:1,minWidth:0,padding:"8px 10px",background:"#060f1e",border:"none",color:"#f8fafc",fontSize:13.5,fontFamily:"monospace",outline:"none",textAlign:"center",cursor:loading?"not-allowed":"pointer"}}/>
              <button onClick={()=>shiftDate(1)} disabled={loading} title="Jour suivant" style={{padding:"8px 12px",background:"rgba(5,12,25,0.8)",border:"none",borderLeft:"1px solid #1e293b",color:loading?"#7b8ba1":"#94a3b8",cursor:loading?"not-allowed":"pointer",fontSize:14,fontFamily:"monospace",fontWeight:700,flexShrink:0}}>→</button>
            </div>
            <div style={{display:"flex",gap:4}}>
              {[{lbl:"Aujourd'hui",val:todayISO},{lbl:"Demain",val:(()=>{const dt=new Date(todayISO+"T12:00");dt.setDate(dt.getDate()+1);return dt.toISOString().split("T")[0];})()}].map(({lbl,val})=>{
                const active=selectedDate===val;
                return <button key={lbl} onClick={()=>setSelectedDate(val)} disabled={loading} style={{padding:"7px 11px",borderRadius:6,border:active?"1px solid #0ea5e960":"1px solid #1e293b",background:active?"rgba(14,165,233,0.12)":"transparent",color:active?"#38bdf8":"#8a9ab0",cursor:loading?"not-allowed":"pointer",fontSize:12,fontFamily:"monospace",whiteSpace:"nowrap"}}>{lbl}</button>;
              })}
            </div>
            <button onClick={()=>doFetch(selectedDate,{force:true})} disabled={loading} title="Retélécharger la météo (ignore le cache)" style={{padding:"8px 12px",borderRadius:7,border:"1px solid #1e293b",background:loading?"rgba(15,23,42,0.5)":"rgba(14,165,233,0.12)",color:loading?"#7b8ba1":"#38bdf8",cursor:loading?"not-allowed":"pointer",fontSize:12,fontFamily:"monospace",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <span style={{display:"inline-block",fontSize:13,animation:loading?"spin .85s linear infinite":"none"}}>↻</span>
              {loading?"…":"RECHARGER"}
            </button>
          </div>

          <div style={{marginTop:8,display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",fontSize:13,color:"#94a3b8"}}>
            <span>🕑 Mes heures de pêche :</span>
            <select aria-label="Début" value={hours.from} onChange={(e)=>{const f=+e.target.value; setHours({from:f,to:Math.max(f+1,hours.to)});}} style={{background:"#060f1e",color:"#e2e8f0",border:"1px solid #1e293b",borderRadius:5,padding:"3px 6px"}}>
              {Array.from({length:24},(_,h)=><option key={h} value={h}>{String(h).padStart(2,"0")} h</option>)}
            </select>
            <span>→</span>
            <select aria-label="Fin" value={hours.to} onChange={(e)=>{const to=+e.target.value; setHours({from:Math.min(hours.from,to-1),to});}} style={{background:"#060f1e",color:"#e2e8f0",border:"1px solid #1e293b",borderRadius:5,padding:"3px 6px"}}>
              {Array.from({length:24},(_,h)=>h+1).map(h=><option key={h} value={h}>{String(h).padStart(2,"0")} h</option>)}
            </select>
            {(hours.from>0||hours.to<24)
              ? <button onClick={()=>setHours(ALL_HOURS)} style={{fontSize:12,color:"#7dd3fc",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline"}}>toutes heures</button>
              : <span style={{fontSize:12,color:"#8a9ab0"}}>(toutes heures, nuit comprise)</span>}
          </div>

          {(isFarFuture || isPast) && (
            <div style={{marginTop:6,padding:"5px 10px",background:isFarFuture?"rgba(245,158,11,0.06)":"rgba(100,116,139,0.06)",border:`1px solid ${isFarFuture?"rgba(245,158,11,0.22)":"rgba(100,116,139,0.22)"}`,borderRadius:6,fontSize:12,color:isFarFuture?"#fbbf24":"#94a3b8"}}>
              {isFarFuture ? "⚠ Date lointaine — marée précise, météo en tendance" : "ⓘ Date passée — archives météo si disponibles"}
            </div>
          )}
        </div>

        {jStatus==="unavailable" && (
          <div style={{margin:"10px 18px 0",padding:"8px 11px",borderRadius:7,border:"1px solid rgba(245,158,11,0.3)",background:"rgba(245,158,11,0.06)",fontSize:12.5,color:"#fbbf24",lineHeight:1.5}}>
            ⚠ Sauvegarde indisponible ({jReason || "raison non communiquée"}) : le journal et la météo ne seront pas conservés après fermeture.
            Le navigateur refuse l'enregistrement (navigation privée ?) : exporte le journal avant de fermer.
          </div>
        )}

        {/* ── VERDICT DU JOUR (v6.1) : la réponse d'abord, le détail ensuite ── */}
        <div style={{margin:"14px 18px 0"}}>
          {loading && <Loader msg="Téléchargement de la météo (Open-Meteo, spot par spot)… la marée est calculée localement"/>}
          {error && (
            <div style={{padding:"12px 14px",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:10,display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
              <div>
                <div style={{fontSize:12,color:"#ef4444",fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:4}}>⚠ ERREUR</div>
                <p style={{margin:0,fontSize:13,color:"#fca5a5",whiteSpace:"pre-line",lineHeight:1.5}}>{error}</p>
                <p style={{margin:"6px 0 0",fontSize:12,color:"#c08484"}}>La marée reste calculée et affichée : seule la météo manque.</p>
              </div>
              <button onClick={()=>doFetch(selectedDate,{force:true})} style={{padding:"7px 12px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:5,color:"#fca5a5",cursor:"pointer",fontSize:12,fontFamily:"monospace"}}>Réessayer</button>
            </div>
          )}
          {!loading && d && verdict && (
            <div style={{background:`linear-gradient(135deg,${verdict.s.color}1f 0%,rgba(10,20,38,0.92) 55%)`,border:`1.5px solid ${verdict.s.color}66`,borderRadius:14,padding:"14px 15px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8,marginBottom:8,flexWrap:"wrap"}}>
                <span style={{fontSize:13,color:"#7dd3fc",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ VERDICT DU JOUR</span>
                {verdict.s.stability && <Pill color={verdict.s.stability==="stable"?"#22c55e":verdict.s.stability==="sensible"?"#f59e0b":"#ef4444"} title="Robustesse du classement face à l'incertitude du vent">{verdict.s.stability.toUpperCase()}</Pill>}
              </div>
              <button onClick={()=>goToSpot(verdict.s.id)} style={{display:"flex",width:"100%",alignItems:"center",gap:12,background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left",color:"inherit"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:22,fontWeight:800,color:"#f8fafc",lineHeight:1.15}}>{verdict.s.name}</div>
                  {verdict.w && <div style={{fontSize:16,color:verdict.s.color,fontWeight:700,marginTop:4,fontFamily:"monospace"}}>{verdict.w.startFmt} → {verdict.w.endFmt}</div>}
                  {verdict.w && <div style={{fontSize:13,color:"#cbd5e1",marginTop:2}}>{verdict.w.label}{verdict.w.light&&verdict.w.light.band!=="inconnu"?` · ${verdict.w.light.label.toLowerCase()}`:""}</div>}
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:34,fontWeight:800,color:verdict.s.color,fontFamily:"monospace",lineHeight:1}}>{verdict.s.score.toFixed(1)}</div>
                  <div style={{fontSize:13,color:"#94a3b8",fontFamily:"monospace"}}>/10</div>
                </div>
              </button>
              {verdict.w?.zw?.fromSpot && (
                <div style={{fontSize:13,color:"#7dd3fc",fontFamily:"monospace",marginTop:9}}>
                  🌬 {verdict.w.zw.wind_dir} {verdict.w.zw.wind_kmh} km/h{verdict.w.zw.gust_kmh!=null?` (raf. ${verdict.w.zw.gust_kmh})`:""}
                  {" · "}🌊 {verdict.w.zw.houleKnown?`${String(verdict.w.zw.houle).replace(".",",")} m`:"?"}
                  {verdict.w.coeff!=null?` · coef ${verdict.w.coeff}`:""}
                </div>
              )}
              {verdict.s.wxReason && <div style={{fontSize:13,color:"#cbd5e1",marginTop:6,lineHeight:1.5}}>{verdict.s.wxReason}</div>}
              {verdict.terr && <div style={{fontSize:13,marginTop:6,lineHeight:1.5}}><span style={{color:(GRATTER[verdict.terr.gratter]||GRATTER.texan).color,fontWeight:700}}>🪨 {(GRATTER[verdict.terr.gratter]||GRATTER.texan).label}.</span>{verdict.terr.montage?<span style={{color:"#cbd5e1"}}> {verdict.terr.montage}</span>:null}</div>}
              {verdict.next.length>0 && (
                <div style={{marginTop:10,paddingTop:9,borderTop:"1px solid #1e293b",display:"flex",flexDirection:"column",gap:5}}>
                  {verdict.next.map((n,i)=>(
                    <button key={n.s.id} onClick={()=>goToSpot(n.s.id)} style={{display:"flex",justifyContent:"space-between",gap:8,background:"none",border:"none",padding:0,cursor:"pointer",color:"#cbd5e1",fontSize:13,textAlign:"left"}}>
                      <span>#{i+2} <b style={{color:n.s.color}}>{n.s.name}</b>{n.w?` · ${n.w.startFmt} → ${n.w.endFmt}`:""}</span>
                      <span style={{fontFamily:"monospace",fontWeight:700,color:"#e2e8f0"}}>{n.s.score.toFixed(1)}</span>
                    </button>
                  ))}
                </div>
              )}
              <button onClick={()=>goToSpot(verdict.s.id)} style={{marginTop:11,width:"100%",padding:"10px",borderRadius:8,border:`1px solid ${verdict.s.color}66`,background:`${verdict.s.color}14`,color:"#f8fafc",fontSize:13,fontWeight:700,cursor:"pointer"}}>Fiche du spot : créneaux, terrain, leurres →</button>
            </div>
          )}
          {!loading && d && !verdict && (
            <div style={{padding:"12px 14px",borderRadius:10,border:"1px solid #7f1d1d",background:"rgba(127,29,29,0.15)",fontSize:13,color:"#fca5a5",lineHeight:1.55}}>
              Aucun spot n'est praticable aujourd'hui selon le modèle (houle ou courant hors limites). Le classement complet ci-dessous détaille la raison spot par spot.
            </div>
          )}
        </div>

        {/* ── LES 7 PROCHAINS JOURS (v6.2) ── */}
        <div style={{margin:"10px 18px 0"}}>
          <button onClick={()=>week.open ? setWeek(w=>({...w,open:false})) : openWeek()} style={{width:"100%",padding:"10px 12px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(10,20,38,0.7)",color:"#7dd3fc",fontSize:13,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.06em",cursor:"pointer",display:"flex",justifyContent:"space-between"}}>
            <span>📅 LES 7 PROCHAINS JOURS</span><span>{week.open?"−":"+"}</span>
          </button>
          {week.open && (
            <div style={{marginTop:6,padding:"10px 12px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(10,20,38,0.6)"}}>
              {week.loading && <Loader msg="Prévision des 7 prochains jours (Open-Meteo)…"/>}
              {week.error && <div style={{fontSize:13,color:"#fca5a5",lineHeight:1.5,whiteSpace:"pre-line"}}>{week.error}</div>}
              {weekRows && weekRows.map(r=>{
                const lbl = new Date(r.date+"T12:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"});
                const sel = r.date===selectedDate;
                return (
                  <button key={r.date} onClick={()=>{ setSelectedDate(r.date); try { window.scrollTo({top:0,behavior:"smooth"}); } catch { /* sans effet */ } }}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:10,padding:"8px 6px",border:"none",borderTop:"1px solid #1e293b",background:sel?"rgba(14,165,233,0.08)":"none",color:"#cbd5e1",cursor:"pointer",textAlign:"left"}}>
                    <span style={{width:78,flexShrink:0,fontSize:13,fontFamily:"monospace",color:sel?"#7dd3fc":"#94a3b8",textTransform:"capitalize"}}>{lbl}</span>
                    {r.s ? (
                      <>
                        <span style={{flex:1,minWidth:0,fontSize:13,lineHeight:1.4}}>
                          <b style={{color:r.s.color}}>{r.s.name}</b>{r.w?` · ${r.w.startFmt} → ${r.w.endFmt}`:""}
                          {r.w?.zw?.fromSpot && <span style={{display:"block",fontSize:12,color:"#8a9ab0",fontFamily:"monospace"}}>🌬 {r.w.zw.wind_dir} {r.w.zw.wind_kmh} km/h · coef {r.w.coeff ?? "–"}</span>}
                        </span>
                        <span style={{fontSize:18,fontWeight:800,fontFamily:"monospace",color:r.s.score>=7?"#22c55e":r.s.score>=5?"#f59e0b":"#94a3b8"}}>{r.s.score.toFixed(1)}</span>
                      </>
                    ) : <span style={{flex:1,fontSize:13,color:"#8a9ab0"}}>{r.err || "Aucun créneau praticable"}</span>}
                  </button>
                );
              })}
              {weekRows && (
                <div style={{fontSize:12,color:"#8a9ab0",marginTop:8,lineHeight:1.5,borderTop:"1px solid #1e293b",paddingTop:8}}>
                  Même calcul que la vue du jour, spot par spot et créneau par créneau{(hours.from>0||hours.to<24)?`, dans tes heures (${hours.from} h → ${hours.to} h)`:""}.
                  Au-delà de 2 à 3 jours, la prévision de vent devient une tendance : relis le jour J la veille.
                  <button onClick={()=>openWeek(true)} style={{marginLeft:6,fontSize:12,color:"#7dd3fc",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline"}}>actualiser</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* TOP 3 / ALL */}
        <div style={{margin:"18px 18px 0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
            <div style={{fontSize:11,color:"#0ea5e9",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>
              ◈ {showAll?`${SPOTS.length} SPOTS — CLASSEMENT`:"TOP 3 DU JOUR"}{!d?" · SANS MÉTÉO (MARÉE ET LUMIÈRE SEULES)":""}
            </div>
            <button onClick={()=>{setShowAll(v=>!v);setSpotId(null);}} style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0",background:"transparent",border:"1px solid #1e293b",borderRadius:5,padding:"4px 12px",cursor:"pointer"}}>
              {showAll?"← TOP 3":`Voir les ${SPOTS.length} →`}
            </button>
          </div>

          {d && !loading && (
            <div style={{padding:"9px 12px",background:"rgba(10,20,38,0.6)",border:"1px solid #1e293b",borderRadius:8,marginBottom:10,fontSize:12,color:"#8a9ab0",lineHeight:1.6}}>
              <div><span style={{color:"#94a3b8",fontWeight:700}}>Conditions : </span>Vent <b style={{color:"#f8fafc"}}>{windDir} F{windF}</b> · Houle <b style={{color:"#f8fafc"}}>{houle}m</b> · Coeff <b style={{color:coefColor}}>{coeff}</b></div>
              <div style={{marginTop:3}}>
                <span style={{color:"#8a9ab0"}}>TOP 3 : </span>
                {top3.map((s,i)=>(
                  <span key={s.id}>
                    <button onClick={()=>goToSpot(s.id)} style={{color:s.color,fontWeight:700,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit",fontSize:"inherit",padding:0}}>{s.name}</button>
                    {s.isLocal&&<span style={{fontSize:11,color:"#22c55e",marginLeft:2}}>[local]</span>}
                    {i<top3.length-1&&<span style={{color:"#7b8ba1"}}> · </span>}
                  </span>
                ))}
              </div>
              {localForced && <div style={{marginTop:3,fontSize:12,color:"#f59e0b"}}>⚑ <b style={{color:localForced.color}}>{localForced.name}</b> intégré #3 (spot local garanti)</div>}
            </div>
          )}

          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {displayed.map((s,i)=>{
              const isActive = activeSpot?.id===s.id;
              return (
                <button key={s.id} onClick={()=>goToSpot(s.id)} style={{width:"100%",padding:"12px 14px",borderRadius:10,border:isActive?`1.5px solid ${s.color}55`:"1px solid #1e293b",background:isActive?`${s.color}0d`:"rgba(10,20,38,0.6)",cursor:"pointer",textAlign:"left",opacity:s.eligible?1:0.5,display:"flex",alignItems:"center",gap:12}}>
                  <div style={{width:32,textAlign:"center",flexShrink:0}}>
                    <div style={{fontSize:18,fontWeight:800,color:s.eligible?s.color:"#7b8ba1",fontFamily:"monospace",lineHeight:1}}>#{i+1}</div>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:13,color:isActive?"#f8fafc":"#cbd5e1",fontWeight:700,lineHeight:1.2}}>{s.name}</span>
                      {s.isLocal&&<Pill color="#22c55e">LOCAL</Pill>}
                      {localForced?.id===s.id&&<Pill color="#f59e0b">FORCÉ</Pill>}
                    </div>
                    <div style={{fontSize:12,color:"#8a9ab0",marginTop:3}}>{s.distance} · {s.type}</div>
                    {s.wxReason&&<div style={{fontSize:12,color:s.eligible?(s.score>=7.5?"#22c55e":"#f59e0b"):"#ef4444",marginTop:3}}>{s.wxReason}</div>}
                    {!s.eligible&&<div style={{fontSize:12,color:"#ef4444",marginTop:3}}>{s.wxReason}</div>}
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <div style={{fontSize:20,fontWeight:800,color:s.eligible?s.color:"#7b8ba1",fontFamily:"monospace",lineHeight:1}}>{s.eligible?s.score.toFixed(1):"–"}</div>
                    <div style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace"}}>/10</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SPOT DETAIL */}
        {activeSpot && (
          <div ref={detailRef} style={{scrollMarginTop:12,margin:"14px 18px 0",background:"rgba(10,20,38,0.9)",border:`1.5px solid ${activeSpot.color}30`,borderRadius:14,overflow:"hidden"}}>
            <div style={{background:`linear-gradient(135deg,${activeSpot.color}10 0%,transparent 60%)`,padding:"16px 16px 12px",borderBottom:"1px solid #1e293b"}}>
              <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
                <ScoreArc score={activeSpot.eligible?activeSpot.score:null} color={activeSpot.color}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:6}}>
                    <Pill color={activeSpot.color}>{activeSpot.type}</Pill>
                    <Pill color={dangerColor[activeSpot.dangerLevel]}>{["","FACILE","MODÉRÉ","TECHNIQUE"][activeSpot.dangerLevel]}</Pill>
                    <Pill color="#64748b">Coeff min {activeSpot.coefMin}</Pill>
                    {activeSpot.isLocal&&<Pill color="#22c55e">LOCAL ≤25min</Pill>}
                  </div>
                  <h2 style={{margin:0,fontSize:19,fontWeight:700,color:"#f8fafc",lineHeight:1.1,letterSpacing:"-0.02em"}}>{activeSpot.name}</h2>
                  <div style={{fontSize:13,color:"#8a9ab0",marginTop:2}}>{activeSpot.subtitle} · {activeSpot.coords}</div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <div style={{fontSize:14,color:"#f59e0b",fontFamily:"monospace",fontWeight:700}}>{activeSpot.distance}</div>
                  <div style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace"}}>de {SITE.name}</div>
                </div>
              </div>

              <div style={{marginTop:10,padding:"8px 11px",background:"rgba(5,12,25,0.6)",border:"1px solid #1e293b",borderRadius:7}}>
                {activeSpot.zw?.fromSpot && (
                  <div style={{fontSize:13.5,color:"#7dd3fc",fontFamily:"monospace",marginBottom:5}}>
                    Aujourd'hui ici (6 h-22 h) : 🌬 {activeSpot.zw.wind_dir} {activeSpot.zw.wind_kmh} km/h{activeSpot.zw.gust_kmh!=null?` (raf. ${activeSpot.zw.gust_kmh})`:""}
                    {" · "}🌊 {activeSpot.zw.houleKnown?`${String(activeSpot.zw.houle).replace(".",",")} m`:"houle inconnue"}{activeSpot.zw.houleSrc?` · ${activeSpot.zw.houleSrc}`:""}
                  </div>
                )}
                <div style={{fontSize:13.5,color:"#cbd5e1",lineHeight:1.55}}><b>Exposition :</b> {activeSpot.weatherNote}</div>
              </div>

              <div style={{marginTop:8,padding:"10px 12px",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:7}}>
                <div style={{fontSize:11,color:"#f59e0b",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>FENÊTRES OPTIMALES</div>
                <div style={{fontSize:13,color:"#fbbf24",fontWeight:700,fontFamily:"monospace"}}>{activeSpot.tidalRules.typeHeure}</div>
                <p style={{margin:"5px 0 0",fontSize:13,color:"#94a3b8",lineHeight:1.55}}>{activeSpot.tidalRules.montantOuDescendant}</p>
              </div>
            </div>

            <div style={{display:"flex",borderBottom:"1px solid #0f172a"}}>
              {[["fenetres","⏱ Fenêtres"],["topologie","🗺 Spot"],["leurres","🎣 Leurres"],["acces","📍 Accès"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"10px 4px",border:"none",background:tab===id?"rgba(14,165,233,0.08)":"transparent",color:tab===id?"#38bdf8":"#8a9ab0",borderBottom:tab===id?`2px solid ${activeSpot.color}`:"2px solid transparent",cursor:"pointer",fontSize:12}}>
                  {lbl}
                </button>
              ))}
            </div>

            <div style={{padding:"13px 14px"}}>
              {tab==="fenetres" && (
                <div>
                  <div style={{marginBottom:9,padding:"9px 10px 6px",background:"rgba(5,12,25,0.6)",border:"1px solid #1e293b",borderRadius:8}}>
                    <div style={{fontSize:11,color:"#7dd3fc",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,marginBottom:4}}>◈ LA JOURNÉE SUR CE SPOT</div>
                    <DayStrip spot={activeSpot} date={selectedDate} live={d} tide={tideFor(activeSpot.tidePort)} sun={sun} hours={hours}/>
                    <div style={{fontSize:11,color:"#8a9ab0",marginTop:4,lineHeight:1.5}}>Bande du haut : nuit, basse lumière (violet), jour. Courbe : marée du port du spot. Bandes colorées : créneaux notés{(hours.from>0||hours.to<24)?" (assombri : hors de tes heures)":""}. Flèches : vent heure par heure sur le spot, vers où il souffle.</div>
                  </div>
                  {activeSpot.windows.filter(w=>Math.abs(w.offsetBefore)<50).length>0
                    ? <div style={{display:"flex",flexDirection:"column",gap:7}}>{activeSpot.windows.filter(w=>Math.abs(w.offsetBefore)<50).map((w,i)=><WindowRow key={`${w.id}-${i}`} w={w}/>)}</div>
                    : <div style={{textAlign:"center",color:"#7b8ba1",fontSize:13,padding:"20px 0",fontFamily:"monospace"}}>Données de marée manquantes</div>
                  }
                  <div style={{marginTop:10,padding:"10px 12px",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.22)",borderRadius:7}}>
                    <div style={{fontSize:11,color:"#a5b4fc",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>💡 CONSEIL</div>
                    <p style={{margin:0,fontSize:13,color:"#94a3b8",lineHeight:1.6}}>{activeSpot.tidalRules.lifeHack}</p>
                  </div>
                  <div style={{marginTop:8,padding:"10px 12px",background:"rgba(5,12,25,0.5)",border:"1px solid #1e293b",borderRadius:7}}>
                    <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:5}}>📖 RÈGLE COMPLÈTE</div>
                    <p style={{margin:0,fontSize:13,color:"#94a3b8",lineHeight:1.65}}>{activeSpot.tidalRules.description}</p>
                  </div>
                </div>
              )}

              {tab==="topologie" && (
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  <TerrainBlock spot={activeSpot}/>
                  <TopoBlock title="🪨 FOND" data={activeSpot.topology.fond}/>
                  <TopoBlock title="📐 STRUCTURE & COMPORTEMENT" data={activeSpot.topology.structure}/>
                  <TopoBlock title="🌊 COURANT" data={activeSpot.topology.courant}/>
                  <TopoBlock title="💨 EXPOSITION" data={activeSpot.topology.exposition}/>
                  <TopoBlock title="🐟 POPULATION" data={activeSpot.topology.bars}/>

                  <button onClick={()=>setShowSources(v=>!v)} style={{marginTop:4,padding:"7px 11px",background:"transparent",border:"1px solid #1e293b",borderRadius:6,color:"#8a9ab0",cursor:"pointer",fontSize:12,fontFamily:"monospace",letterSpacing:"0.1em",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>📚 SOURCES UTILISÉES POUR CE SPOT</span>
                    <span>{showSources?"−":"+"}</span>
                  </button>
                  {showSources && (
                    <div style={{padding:"9px 11px",background:"rgba(5,12,25,0.5)",border:"1px solid #1e293b",borderRadius:6}}>
                      <ul style={{margin:0,padding:"0 0 0 18px",fontSize:12,color:"#94a3b8",lineHeight:1.8}}>
                        {activeSpot.sources.map((s,i)=><li key={i} style={{fontFamily:"monospace"}}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {tab==="leurres" && (()=>{ const terr = terrainOf(activeSpot); const noBottom = terr.gratter==="non"; const deepHere = pressureInfo?.depth==="deep"; return (
                <div style={{display:"flex",flexDirection:"column",gap:7}}>
                  <TerrainBlock spot={activeSpot} compact/>
                  {pressureInfo && (
                    <div style={{padding:"10px 12px",background:"rgba(167,139,250,0.07)",border:"1px solid rgba(167,139,250,0.22)",borderRadius:8}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:5,marginBottom:5}}>
                        <span style={{fontSize:11,color:"#a78bfa",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>🌡 AJUSTEMENT DU JOUR — PRESSION {pressure} hPa</span>
                        <span style={{fontSize:12,color:pressureInfo.activity>=7?"#22c55e":pressureInfo.activity<=3?"#ef4444":"#f59e0b",fontFamily:"monospace",fontWeight:700}}>Activité {pressureInfo.activity}/10</span>
                      </div>
                      <p style={{margin:"0 0 6px",fontSize:13,color:"#cbd5e1",lineHeight:1.5}}>
                        <b style={{color:"#a78bfa"}}>Priorité {pressureInfo.depth==="surface"?"SURFACE / MI-EAU":deepHere&&noBottom?"AU RAS DES STRUCTURES, SANS LES TOUCHER":pressureInfo.depth==="deep"?"FOND / STRUCTURES":"MI-EAU"}</b> — {pressureInfo.zoneHint}
                      </p>
                      <div style={{fontSize:12,color:"#94a3b8",lineHeight:1.55}}>
                        <b style={{color:"#cbd5e1"}}>Adapter en conséquence :</b> parmi les 3 leurres suggérés pour ce spot ci-dessous, privilégier ceux qui correspondent à {pressureInfo.depth==="surface"?"la surface (stickbaits, pencil, jerkbaits flottants)":deepHere&&noBottom?"une nage lente juste au-dessus du goémon ou de la roche (weightless, texan, jerkbait suspending) : le fond de ce spot interdit de gratter":pressureInfo.depth==="deep"?"la profondeur (shads lourds, slugs plombés, jig)":"la mi-eau (jerkbaits suspending, shads moyens, sinking pencil)"}.
                      </div>
                    </div>
                  )}
                  {(()=>{ 
                    const mois = new Date(selectedDate+"T12:00").getMonth()+1;
                    const prey = preyForMonth(mois);
                    if(!prey.length) return null;
                    return (
                      <div style={{marginBottom:14,padding:"12px 13px",borderRadius:9,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
                        <div style={{fontSize:11,color:"#4ade80",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,marginBottom:9}}>◈ PROIES DU MOIS — CE QUI COMMANDE LE PROFIL</div>
                        {prey.slice(0,4).map((p,i)=>{ const a = adviceForSpot(activeSpot, p); return (
                          <div key={p.name} style={{paddingTop:i?9:0,marginTop:i?9:0,borderTop:i?"1px solid #1e293b":"none"}}>
                            <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap"}}>
                              <span style={{fontSize:13.5,color:"#e2e8f0",fontWeight:700}}>{p.name}</span>
                              <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>{p.size}{p.couche?` · ${p.couche}`:""}</span>
                              {i===0 && <Pill color="#4ade80">DOMINANTE</Pill>}
                              {a.adapted && <Pill color={a.replaces?"#f87171":"#f59e0b"}>ADAPTÉ À CE SPOT</Pill>}
                            </div>
                            {a.adapted && <div style={{fontSize:13,color:a.replaces?"#fca5a5":"#fcd34d",marginTop:4,lineHeight:1.55,fontWeight:600}}>{a.note}</div>}
                            <div style={{fontSize:13,color:"#94a3b8",marginTop:4,lineHeight:1.55,opacity:a.replaces?0.75:1}}>{a.replaces?"Conseil général, ailleurs : ":""}{a.text}</div>
                          </div>
                        ); })}
                        <div style={{fontSize:12,color:"#8a9ab0",marginTop:9,lineHeight:1.5,borderTop:"1px solid #1e293b",paddingTop:8}}>
                          La météo dit quand aller pêcher ; la proie du moment dit avec quoi. Accorder d'abord le profil et la taille du leurre à cette liste, le coloris ensuite.
                        </div>
                      </div>
                    );
                  })()}
                  {activeSpot.lures.map((l,i)=>{
                    const n = (l.name+" "+l.technique).toLowerCase();
                    const isSurface = /pencil|stickbait|surface|walk|top|flottant|jerkbait/.test(n) && !/sinking|coulant|plomb/.test(n);
                    const isDeep = /shad.*(lourd|plomb)|slug.*(plomb|lourd)|jig|tête plomb|20.*g|21.*g|25.*g|30.*g|35.*g|40.*g|45.*g|50.*g|60.*g|coulant.*fond|sinking/.test(n);
                    const aligned = pressureInfo && (
                      (pressureInfo.depth==="surface" && isSurface) ||
                      (pressureInfo.depth==="deep" && (noBottom ? !isSurface && !isDeep : isDeep)) ||
                      (pressureInfo.depth==="mid" && !isSurface && !isDeep)
                    );
                    const rockWarn = noBottom && isDeep;
                    return (
                      <div key={i} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",background:aligned?"rgba(34,197,94,0.06)":"rgba(5,12,25,0.6)",border:aligned?"1px solid rgba(34,197,94,0.3)":"1px solid #1e293b",borderRadius:8,position:"relative"}}>
                        <div style={{width:26,height:26,borderRadius:6,background:activeSpot.color+"18",border:`1px solid ${activeSpot.color}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13.5,flexShrink:0,color:activeSpot.color,fontWeight:700}}>{i+1}</div>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",justifyContent:"space-between",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:4}}>
                            <span style={{fontSize:13.5,color:"#f8fafc",fontWeight:700}}>{l.name}</span>
                            {aligned && <span style={{fontSize:11,color:"#22c55e",fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em",background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.35)",borderRadius:3,padding:"1px 6px"}}>★ ADAPTÉ JOUR</span>}
                          </div>
                          {rockWarn && <div style={{fontSize:13,color:"#fca5a5",fontWeight:600,marginBottom:5}}>⚠ Fond rocheux : compter la descente et tenir ce leurre au-dessus du fond, jamais de raclage.</div>}
                          <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:5}}>
                            <Pill color={activeSpot.color}>{l.color}</Pill>
                            <Pill color="#64748b">{l.weight}</Pill>
                          </div>
                          <p style={{margin:0,fontSize:13,color:"#8a9ab0",lineHeight:1.5}}>{l.technique}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ); })()}

              {tab==="acces" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <div style={{padding:"11px 13px",background:"rgba(5,12,25,0.6)",border:"1px solid #1e293b",borderRadius:7}}>
                    <div style={{fontSize:11,color:"#0ea5e9",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:5}}>📍 ACCÈS</div>
                    <p style={{margin:0,fontSize:13.5,color:"#94a3b8",lineHeight:1.7}}>{activeSpot.access}</p>
                  </div>
                  {activeSpot.dangerLevel===3&&(
                    <div style={{padding:"11px 13px",background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.3)",borderRadius:7}}>
                      <div style={{fontSize:11,color:"#ef4444",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:5}}>⚠ SÉCURITÉ MAXIMALE</div>
                      <p style={{margin:0,fontSize:13,color:"#fca5a5",lineHeight:1.65}}>Ne jamais pêcher seul. Gilet de sauvetage avec AIS. Téléphone étanche. Plan partagé. Fenêtres de renversement respectées strictement.</p>
                    </div>
                  )}
                  {activeSpot.dangerLevel===2&&(
                    <div style={{padding:"11px 13px",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:7}}>
                      <div style={{fontSize:11,color:"#f59e0b",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:5}}>⚠ SPOT TECHNIQUE</div>
                      <p style={{margin:0,fontSize:13,color:"#fde68a",lineHeight:1.65}}>Faire une sortie de repérage par conditions calmes avant une pêche en vive-eau ou au crépuscule.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* GENERAL PRINCIPLES */}
        <div style={{margin:"14px 18px 0"}}>
          <button onClick={()=>setShowPrinciples(v=>!v)} style={{width:"100%",padding:"10px 14px",background:"rgba(34,197,94,0.06)",border:"1px solid rgba(34,197,94,0.22)",borderRadius:8,color:"#86efac",cursor:"pointer",fontSize:13,fontFamily:"monospace",letterSpacing:"0.08em",display:"flex",justifyContent:"space-between",alignItems:"center",textAlign:"left"}}>
            <span>📖 {GENERAL_PRINCIPLES.title.toUpperCase()}</span>
            <span style={{fontSize:14}}>{showPrinciples?"−":"+"}</span>
          </button>
          {showPrinciples && (
            <div style={{marginTop:6,padding:"12px",background:"rgba(10,20,38,0.7)",border:"1px solid #1e293b",borderRadius:8,display:"flex",flexDirection:"column",gap:9}}>
              {GENERAL_PRINCIPLES.items.map((item,i)=>(
                <div key={i} style={{padding:"9px 11px",background:"rgba(5,12,25,0.6)",borderLeft:"2px solid #22c55e",borderRadius:"0 5px 5px 0"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                    <span style={{fontSize:13,color:"#f8fafc",fontWeight:700,lineHeight:1.4}}>{item.rule}</span>
                    <span style={{fontSize:11,color:"#8a9ab0",fontFamily:"monospace",fontStyle:"italic",whiteSpace:"nowrap"}}>{item.source}</span>
                  </div>
                  <p style={{margin:0,fontSize:13,color:"#94a3b8",lineHeight:1.5}}>{item.explain}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONDITIONS LIVE */}
        <div style={{margin:"14px 18px 0"}}>
          {!loading && d && (
            <div style={{background:"rgba(10,20,38,0.8)",border:"1px solid #1e293b",borderRadius:12,padding:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,flexWrap:"wrap",gap:6}}>
                <span style={{fontSize:11,color:"#0ea5e9",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ CONDITIONS DU JOUR · 6 H-22 H</span>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                  {d.source_coef&&<span style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace"}}>📊 {d.source_coef}</span>}
                  {d.source_meteo&&<span style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace"}}>🌤 {d.source_meteo}</span>}
                  {fetchedAt&&<span style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace"}}>⏱ {fetchedAt.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})}</span>}
                </div>
              </div>
              {d.resume&&<div style={{padding:"8px 11px",background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,marginBottom:12}}><p style={{margin:0,fontSize:13.5,color:"#fbbf24",lineHeight:1.5,fontStyle:"italic"}}>"{d.resume}"</p></div>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:12}}>
                {[
                  {icon:"💨",lbl:"VENT",val:`${windDir} F${windF}`,sub:beaufort},
                  {icon:"🌥",lbl:"CIEL",val:skyLabel},
                  {icon:"🌊",lbl:"HOULE",val:`${String(houle).replace(".",",")} m`,sub:SITE.zones?.local?.sea==="rade"?"mer du vent":""},
                  {icon:"📊",lbl:"COEFF",val:coefText,sub:coefLabel,vc:coefColor},
                  {icon:"🌡",lbl:"PRESSION",val:pressure?`${pressure}`:"–",sub:pressureZoneInfo?.label||"",vc:pressureZoneInfo?.color||"#94a3b8"},
                ].map((it,i)=>(
                  <div key={i} style={{background:"rgba(5,12,25,0.8)",border:"1px solid #1e293b",borderRadius:8,padding:"8px 4px",textAlign:"center"}}>
                    <div style={{fontSize:15,marginBottom:2}}>{it.icon}</div>
                    <div style={{fontSize:11,color:"#7b8ba1",fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:2}}>{it.lbl}</div>
                    <div style={{fontSize:13,color:it.vc||"#94a3b8",fontWeight:700,fontFamily:"monospace"}}>{it.val}</div>
                    {it.sub&&<div style={{fontSize:11,color:"#8a9ab0",marginTop:1}}>{it.sub}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── PRESSURE STRATEGY PANEL ── */}
        {/* ── MARÉE CALCULÉE (v5) — affichée même sans réseau ── */}
        <div style={{margin:"0 14px 12px",padding:"12px 14px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:9}}>
            <span style={{fontSize:11,color:"#38bdf8",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ MARÉE — {String(tide.label||"").toUpperCase()}</span>
            <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>calculée · heure de Paris</span>
          </div>
          {tide.error ? (
            <div style={{fontSize:13,color:"#fca5a5"}}>Calcul de marée impossible : {tide.error}</div>
          ) : (
            <>
              <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,tide.dayEvents.length)},1fr)`,gap:7}}>
                {tide.dayEvents.map((e,i)=>{
                  const c = e.type==="PM" ? "#f59e0b" : "#38bdf8";
                  return (
                    <div key={i} style={{background:"rgba(5,12,25,0.8)",border:`1px solid ${c}25`,borderRadius:8,padding:"9px 4px",textAlign:"center"}}>
                      <div style={{fontSize:11,color:c,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:4}}>{e.type==="PM"?"PLEINE MER":"BASSE MER"}</div>
                      <div style={{fontSize:17,color:"#f8fafc",fontFamily:"monospace",fontWeight:800,lineHeight:1}}>{fmtH(e.dec)}</div>
                      <div style={{fontSize:12,color:c,fontFamily:"monospace",marginTop:4}}>{tide.method==="interp"?"≈ ":""}{e.h.toFixed(tide.method==="interp"?1:2)} m</div>
                      {e.type==="PM" && e.coef!=null && <div style={{fontSize:12,color:"#94a3b8",fontFamily:"monospace",marginTop:3}}>coef {e.coef}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{fontSize:12.5,color:"#94a3b8",marginTop:9,lineHeight:1.6}}>
                Coefficient{tide.coefs.length>1?"s":""} <strong style={{color:coefColor}}>{coefText}</strong>{" "}
                {coefSource==="shom"
                  ? <span style={{color:"#22c55e"}}>— valeurs SHOM, concordantes avec le calcul</span>
                  : <span>— calculé (à ±1 de l'annuaire SHOM dans 90 % des cas)</span>}
                {" · "}marnage {tide.method==="interp"?"≈ ":""}{marnage} m
              </div>
              {coefCheck.rejected.length>0 && (
                <div style={{fontSize:12,color:"#fbbf24",marginTop:6,lineHeight:1.5}}>
                  Coefficient renvoyé par la recherche écarté ({coefCheck.rejected.map(r=>r.reason).join(" ; ")}) : la valeur calculée est conservée.
                </div>
              )}
              <div style={{fontSize:12,color:"#8a9ab0",marginTop:8,lineHeight:1.55,borderTop:"1px solid #1e293b",paddingTop:8}}>
                Prédiction harmonique locale (constantes TICON-4, marégraphes REFMAR/UHSLC), sans réseau,
                identique à chaque ouverture. Précision mesurée contre les tables SHOM : {tide.accuracy}.
                Chaque spot utilise la marée de son propre port.
              </div>
            </>
          )}
        </div>
        {displayed.length>0 && displayed[0].spread!=null && (
          <div style={{margin:"0 14px 12px",padding:"11px 13px",borderRadius:9,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
            <div style={{fontSize:11,color:"#38bdf8",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,marginBottom:8}}>◈ STABILITÉ DU CONSEIL</div>
            {displayed.slice(0,3).map(sp=>{
              const c = sp.stability==="stable"?"#22c55e":sp.stability==="sensible"?"#f59e0b":"#ef4444";
              return (
                <div key={sp.id} style={{display:"flex",alignItems:"center",gap:9,padding:"4px 0",flexWrap:"wrap"}}>
                  <span style={{fontSize:13,color:"#cbd5e1",flex:1,minWidth:110}}>{sp.name}</span>
                  <span style={{fontSize:13,fontFamily:"monospace",color:"#e2e8f0"}}>{sp.score?.toFixed(1)}</span>
                  <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>plage {sp.worst?.toFixed(1)}–{sp.best?.toFixed(1)}</span>
                  <span style={{fontSize:11,fontFamily:"monospace",padding:"2px 6px",borderRadius:4,border:`1px solid ${c}`,color:c,letterSpacing:"0.1em"}}>{sp.stability?.toUpperCase()}</span>
                </div>
              );
            })}
            <div style={{fontSize:12,color:"#8a9ab0",marginTop:8,lineHeight:1.55,borderTop:"1px solid #1e293b",paddingTop:8}}>
              Une prévision de vent reste incertaine d'environ ±1 Beaufort et ±1 secteur, davantage au-delà de 48 h.
              Le score affiché est donc la moyenne sur cette plage d'incertitude, pas la valeur d'un point
              unique. « Plage » indique ce que deviendrait le score aux deux extrêmes : un spot marqué
              <span style={{color:"#ef4444"}}> VOLATILE</span> n'est premier que si le relevé est exact — méfie-toi de son classement.
            </div>
          </div>
        )}
        {dataWarnings.length>0 && (
          <div style={{margin:"0 14px 12px",padding:"11px 13px",borderRadius:9,border:"1px solid #7f1d1d",background:"rgba(127,29,29,0.15)"}}>
            <div style={{fontSize:11,color:"#fca5a5",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,marginBottom:7}}>◈ COHÉRENCE DES DONNÉES — {dataWarnings.length} ALERTE{dataWarnings.length>1?"S":""}</div>
            {dataWarnings.map((w,i)=>(
              <div key={i} style={{fontSize:13,color:"#fca5a5",lineHeight:1.55,marginBottom:4}}>• {w}</div>
            ))}
            <div style={{fontSize:12,color:"#c08484",marginTop:6,lineHeight:1.5}}>
              Ces contrôles ne corrigent rien : ils signalent. Recoupe avec l'annuaire SHOM avant de te déplacer.
            </div>
          </div>
        )}

        {/* ── LUMIÈRE DU JOUR (v3) ── */}
        <div style={{margin:"0 14px 12px",padding:"12px 14px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:9}}>
            <span style={{fontSize:11,color:"#f59e0b",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ LUMIÈRE — ÉPHÉMÉRIDE CALCULÉE</span>
            <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>{SITE.lat.toFixed(3)}°N {Math.abs(SITE.lon).toFixed(3)}°O · UTC+{sun.offH}</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(78px,1fr))",gap:10}}>
            {[["Aube",sun.dawn,"#78716c"],["Lever",sun.sunrise,"#f59e0b"],["Coucher",sun.sunset,"#f59e0b"],["Nuit",sun.dusk,"#818cf8"]].map(([k,v,c])=>(
              <div key={k}>
                <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",textTransform:"uppercase"}}>{k}</div>
                <div style={{fontSize:17,fontFamily:"monospace",fontWeight:700,color:c,marginTop:2}}>{fmtH(v)}</div>
              </div>
            ))}
          </div>
          {(()=> {
            const lows = displayed.flatMap(s=>s.windows||[]).filter(w=>w.light&&(w.light.band==="aube"||w.light.band==="crepuscule"||w.light.band==="nuit"));
            const bad = displayed.flatMap(s=>s.windows||[]).filter(w=>w.light?.mismatch).length;
            return (
              <div style={{fontSize:13,color:"#94a3b8",marginTop:10,lineHeight:1.6,borderTop:"1px solid #1e293b",paddingTop:9}}>
                {lows.length>0
                  ? <>Sur les spots affichés, <strong style={{color:"#f59e0b"}}>{lows.length} fenêtre{lows.length>1?"s":""}</strong> tombe{lows.length>1?"nt":""} réellement en basse lumière aujourd'hui.</>
                  : <>Aucune fenêtre des spots affichés ne tombe en basse lumière aujourd'hui. Le cumul marée + crépuscule ne se présente pas — jouer la marée seule.</>}
                {bad>0 && <> <span style={{color:"#fca5a5"}}>{bad} libellé{bad>1?"s":""} de fenêtre annonce{bad>1?"nt":""} un crépuscule qui n'a pas lieu à cette date : signalé en rouge sur la fenêtre concernée.</span></>}
              </div>
            );
          })()}
          <div style={{fontSize:12,color:"#8a9ab0",marginTop:8,lineHeight:1.55}}>
            Calcul local (Almanac for Computers), aucune donnée réseau. Bandes de basse lumière
            retenues : aube civile → lever +45 min, et coucher −45 min → nuit civile. C'est la
            tranche où le bar perd sa méfiance et chasse près du bord.
          </div>
        </div>

        {/* ── THERMIE & PRÉSENCE SAISONNIÈRE (v3) ── */}
        <div style={{margin:"0 14px 12px",padding:"12px 14px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap",marginBottom:8}}>
            <span style={{fontSize:11,color:"#38bdf8",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ THERMIE — PRÉSENCE CÔTIÈRE</span>
            <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>
              {sstConfidence==="mesure"?"relevé daté":sstConfidence==="modele"?"modèle océanique (Open-Meteo Marine)":sstConfidence==="saison"?"moyenne saisonnière":"non renseigné"}
            </span>
          </div>
          <div style={{display:"flex",alignItems:"baseline",gap:12,flexWrap:"wrap"}}>
            <span style={{fontSize:26,fontFamily:"monospace",fontWeight:700,color: presenceInfo.factor>=0.9?"#22c55e":presenceInfo.factor>=0.7?"#f59e0b":"#ef4444"}}>
              {sst!=null?`${sst.toFixed(1)}°C`:"–"}
            </span>
            <span style={{fontSize:13.5,color:"#cbd5e1"}}>{presenceInfo.label}</span>
            <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0"}}>
              × {presenceInfo.factor.toFixed(2)} sur le score
            </span>
          </div>
          <div style={{fontSize:13,color:"#94a3b8",marginTop:7,lineHeight:1.6}}>{presenceInfo.detail}</div>
          <div style={{fontSize:12,color:"#8a9ab0",marginTop:8,lineHeight:1.55,borderTop:"1px solid #1e293b",paddingTop:8}}>
            Le bar est partiellement migrateur : fidélité aux zones d'engraissement estivales
            côtières et aux zones de frai hivernales au large. Sous le seuil thermique il ne mord
            pas moins — il n'est plus là. C'est pourquoi ce facteur multiplie le score au lieu de
            s'y ajouter.
          </div>
        </div>

        {pressureInfo && (
          <div style={{margin:"12px 18px 0",background:"rgba(10,20,38,0.8)",border:`1px solid ${pressureInfo.activity>=7?"#22c55e40":pressureInfo.activity<=3?"#ef444440":"#1e293b"}`,borderRadius:12,padding:"14px"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8,marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:11,color:"#a78bfa",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ PRESSION ATMOSPHÉRIQUE — STRATÉGIE</span>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <span style={{fontSize:18,fontWeight:800,color:pressureZoneInfo?.color||"#94a3b8",fontFamily:"monospace"}}>{pressure||"–"}</span>
                <span style={{fontSize:12,color:"#8a9ab0",fontFamily:"monospace"}}>hPa</span>
                <span style={{fontSize:12,color:"#94a3b8",fontFamily:"monospace",marginLeft:6}}>{pressureInfo.trendLabel}</span>
                {pressureInfo.delta!==0&&<span style={{fontSize:12,color:"#8a9ab0",fontFamily:"monospace"}}>({pressureInfo.delta>0?"+":""}{pressureInfo.delta}hPa/24h)</span>}
              </div>
            </div>

            {/* Activity bar */}
            <div style={{marginBottom:10}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                <span style={{fontSize:12,color:"#8a9ab0",fontFamily:"monospace",letterSpacing:"0.1em"}}>ACTIVITÉ DES BARS</span>
                <span style={{fontSize:14,fontWeight:800,color:pressureInfo.activity>=7?"#22c55e":pressureInfo.activity<=3?"#ef4444":"#f59e0b",fontFamily:"monospace"}}>{pressureInfo.activity}/10</span>
              </div>
              <div style={{height:6,background:"#0f172a",borderRadius:3,overflow:"hidden"}}>
                <div style={{height:"100%",width:`${pressureInfo.activity*10}%`,background:pressureInfo.activity>=7?"#22c55e":pressureInfo.activity<=3?"#ef4444":"#f59e0b",transition:"width 0.3s"}}/>
              </div>
              {pressureInfo.activityReason&&<p style={{margin:"6px 0 0",fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{pressureInfo.activityReason}</p>}
            </div>

            {/* Strategy grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
              <div style={{padding:"9px 11px",background:"rgba(5,12,25,0.6)",border:"1px solid #1e293b",borderRadius:7}}>
                <div style={{fontSize:11,color:"#a78bfa",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>📍 PROFONDEUR</div>
                <div style={{fontSize:13,color:"#f8fafc",fontWeight:700,marginBottom:3,textTransform:"uppercase"}}>{pressureInfo.depth==="surface"?"Surface / mi-eau":pressureInfo.depth==="deep"?"Fond / structures":"Mi-eau"}</div>
                <p style={{margin:0,fontSize:12,color:"#94a3b8",lineHeight:1.5}}>{pressureInfo.depthHint}</p>
              </div>
              <div style={{padding:"9px 11px",background:"rgba(5,12,25,0.6)",border:"1px solid #1e293b",borderRadius:7}}>
                <div style={{fontSize:11,color:"#a78bfa",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>🎣 LEURRES</div>
                <div style={{fontSize:12,color:"#cbd5e1",lineHeight:1.6}}>{pressureInfo.lureTypes.map((l,i)=><div key={i}>• {l}</div>)}</div>
              </div>
            </div>
            <div style={{padding:"8px 11px",background:"rgba(5,12,25,0.5)",border:"1px solid #1e293b",borderRadius:7}}>
              <div style={{fontSize:11,color:"#a78bfa",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:3}}>🗺 ZONES</div>
              <p style={{margin:0,fontSize:12,color:"#94a3b8",lineHeight:1.55}}>{pressureInfo.zoneHint}</p>
            </div>
          </div>
        )}

        {/* TIDE CHART */}
        <div style={{margin:"14px 18px 0",background:"rgba(10,20,38,0.6)",border:"1px solid #1e293b",borderRadius:10,padding:"10px 12px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:11,color:"#0ea5e9",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>◈ COURBE DES MARÉES ({String(tide.label||"").toUpperCase()}) · MARNAGE {tide.method==="interp"?"≈":""}{marnage}m</span>
            <span style={{fontSize:11,color:"#f59e0b",fontFamily:"monospace"}}>▓ PRIME spot affiché</span>
          </div>
          <TideChart tideData={tideData} windows={activeSpot?.windows||[]}/>
        </div>

        {/* LEGEND (footer) */}
        <div style={{margin:"20px 18px 0",padding:"12px",background:"rgba(10,20,38,0.4)",border:"1px solid #0f172a",borderRadius:8}}>
          <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:7}}>LÉGENDE NIVEAU DE CONFIANCE</div>
          <div style={{display:"flex",flexDirection:"column",gap:5,fontSize:12,color:"#94a3b8",lineHeight:1.5}}>
            <div><ConfidenceBadge level="verified"/> <span style={{marginLeft:6}}>Information vérifiée sur une source web (peche.com, peche-poissons.com, desperadiens, brestfishing, etc.)</span></div>
            <div><ConfidenceBadge level="local_knowledge"/> <span style={{marginLeft:6}}>Savoir terrain — à valider par repérage sur place</span></div>
            <div><ConfidenceBadge level="inference"/> <span style={{marginLeft:6}}>Déduit des principes généraux — peut varier selon le spot précis</span></div>
          </div>
        </div>

        <div style={{margin:"16px 18px 0",paddingTop:12,borderTop:"1px solid #0a1628",fontSize:11,color:"#7b8ba1",fontFamily:"monospace",textAlign:"center"}}>
          Marée calculée sur l'appareil (TICON-4) · Météo Open-Meteo (AROME Météo-France, ECMWF) · Sources vérifiables par spot · Ne remplace pas le repérage terrain
        {/* ── JOURNAL DE SESSION (v4) ── */}
        <div style={{margin:"14px",padding:"12px 14px",borderRadius:10,border:"1px solid #1e293b",background:"rgba(8,20,34,0.6)"}}>
          <button onClick={()=>setShowJournal(v=>!v)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",background:"none",border:"none",padding:0,cursor:"pointer",color:"#a78bfa",fontSize:12,fontFamily:"monospace",letterSpacing:"0.1em",fontWeight:700}}>
            <span>◈ JOURNAL — {journal.length} SESSION{journal.length>1?"S":""}{calib.calibrated>0?` · ${calib.calibrated} SPOT${calib.calibrated>1?"S":""} RECALIBRÉ${calib.calibrated>1?"S":""}`:""}</span>
            <span>{showJournal?"▲":"▼"}</span>
          </button>
          {showJournal && (
            <div style={{marginTop:12}}>
              {jStatus==="unavailable" && (
                <div style={{padding:"10px 12px",borderRadius:8,border:"1px solid #7f1d1d",background:"rgba(127,29,29,0.15)",marginBottom:12}}>
                  <div style={{fontSize:13,color:"#fca5a5",lineHeight:1.6,fontWeight:700,marginBottom:4}}>Sauvegarde indisponible — le journal ne survivra pas à la fermeture.</div>
                  <div style={{fontSize:12.5,color:"#fca5a5",lineHeight:1.55}}>{jReason}</div>
                  <div style={{fontSize:12,color:"#c08484",lineHeight:1.55,marginTop:6}}>
                    L'écriture est bloquée volontairement : écrire par-dessus un historique qu'on n'a pas
                    su lire le détruirait. Utilise <strong>Exporter</strong> avant de fermer, et
                    <strong> Importer</strong> à la prochaine ouverture. Le verrou de marée est affecté
                    de la même façon — c'est aussi ce qui fait varier les scores d'une ouverture à l'autre.
                  </div>
                </div>
              )}
              {jStatus!=="unavailable" && jStatus!=="loading" && (
                <div style={{fontSize:12,fontFamily:"monospace",color:"#22c55e",marginBottom:10}}>
                  ● sauvegarde active{jStatus==="empty"?" — journal vide":""}
                </div>
              )}
              {jError && (
                <div style={{padding:"9px 11px",borderRadius:8,border:"1px solid #7f1d1d",background:"rgba(127,29,29,0.15)",marginBottom:12,fontSize:13,color:"#fca5a5",lineHeight:1.55}}>
                  {jError}
                </div>
              )}
              <JournalForm spots={allScored} date={selectedDate}
                disabled={jStatus==="unavailable"}
                onAdd={async(e0)=>{
                  const sp=SPOTS.find(s=>s.id===e0.spotId); const hh=sessionHour(e0, selectedDate);
                  const e = d && hh!=null ? {...e0, cond: sessionConditions(selectedDate, d, sp, hh, tideFor)} : e0;
                  const n=[...journal,e]; setJournal(n); setJError("");
                  const res=await saveJournal(n,jStatus);
                  if(!res.ok) setJError(res.reason||"Échec d'enregistrement.");
                  else { setJournal(res.entries); setJStatus("ok"); }
                }}
                onImport={async(list)=>{
                  const byId=new Map([...journal,...list].map(e=>[String(e.id),e]));
                  const merged=[...byId.values()];
                  setJournal(merged); setJError("");
                  const res=await saveJournal(merged,jStatus==="unavailable"?"ok":jStatus);
                  if(!res.ok) setJError((res.reason||"")+" — les entrées importées restent en mémoire pour cette session.");
                  else setJournal(res.entries);
                }}
                onExport={()=>{
                  const blob=new Blob([JSON.stringify(journal,null,2)],{type:"application/json"});
                  const u=URL.createObjectURL(blob); const a=document.createElement("a");
                  a.href=u; a.download=`journal-bar-${SITE.id}.json`; a.click(); URL.revokeObjectURL(u);
                }} hasEntries={journal.length>0}/>
              {journal.length>0 && (
                <div style={{marginTop:14}}>
                  {[...journal].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,10).map(e=>{
                    const sp=SPOTS.find(x=>x.id===e.spotId);
                    const dl=e.predicted!=null?e.result-e.predicted:null;
                    return (
                      <div key={e.id} style={{display:"flex",gap:10,padding:"7px 0",borderTop:"1px solid #1e293b"}}>
                        <span style={{fontSize:12,fontFamily:"monospace",color:"#8a9ab0",width:72,flexShrink:0}}>{e.date}</span>
                        <span style={{flex:1,minWidth:0}}>
                          <span style={{fontSize:13,color:"#cbd5e1"}}>{sp?.name??e.spotId}</span>
                          {e.fish!=null && <span style={{fontSize:12,fontFamily:"monospace",color:e.fish>0?"#22c55e":"#8a9ab0",marginLeft:6}}>{e.fish} bar{e.fish>1?"s":""}</span>}
                          {e.seed && <span style={{fontSize:11,fontFamily:"monospace",color:"#a78bfa",border:"1px solid #4c1d95",borderRadius:3,padding:"1px 4px",marginLeft:6}}>ARCHIVÉ</span>}
                          {(e.heure || e.cond) && <div style={{fontSize:12,color:"#7dd3fc",marginTop:2,fontFamily:"monospace"}}>{e.heure ? e.heure.replace(":","h") : e.cond ? `≈ ${fmtH(e.cond.h)} (${e.moment==="coucher"?"coucher du soleil":"heure estimée"})` : ""}{e.cond ? " · " + conditionsLine(e.cond) : ""}</div>}
                          {!e.cond && (e.heure || e.moment) && <div style={{fontSize:11,color:"#8a9ab0",marginTop:1}}>Conditions calculées à l'ouverture de ce jour (météo nécessaire).</div>}
                          {e.lure && <div style={{fontSize:12,color:"#8a9ab0",marginTop:2}}>{e.lure}</div>}
                          {e.note && <div style={{fontSize:12,color:"#8a9ab0",marginTop:1}}>{e.note}</div>}
                        </span>
                        <span style={{fontSize:13,fontFamily:"monospace",color:e.result>=7?"#22c55e":e.result>=4?"#f59e0b":"#94a3b8",flexShrink:0,textAlign:"right"}}>
                          {e.result}
                          {dl!=null
                            ? <div style={{color:Math.abs(dl)>2.5?"#f87171":"#8a9ab0",fontSize:12}}>{dl>0?"+":""}{dl.toFixed(1)} vs prédit</div>
                            : <div style={{color:"#7b8ba1",fontSize:11}}>prédit à compléter</div>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <div style={{fontSize:12,color:"#8a9ab0",marginTop:10,lineHeight:1.55,borderTop:"1px solid #1e293b",paddingTop:8}}>
                Trois sessions minimum par spot avant tout recalibrage, correction bornée à ±18 %.
                C'est la seule donnée ici qu'aucun modèle ne peut recalculer : exporte-la de temps en temps.
              </div>
            </div>
          )}
        </div>

        </div>
      </div>
    </div>
  );
}
