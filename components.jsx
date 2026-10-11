// Composants d'interface réutilisables (graphiques, créneau, terrain, formulaire du journal).
import { useEffect, useRef, useState } from "react";
import { ENCOMBREMENT, GRATTER, terrainOf } from "../engine/model.js";
import { msAtLocal, parisParts } from "../engine/tide.js";
import { beaufortOf, idxAt } from "../engine/weather.js";
import { C, num, scoreColor } from "./kit.jsx";

export function ConfidenceBadge({ level }) {
  const cfg = {
    verified: { color: C.good, label: "Sourcé", title: "Information tirée d'une source citée" },
    local_knowledge: { color: C.violet, label: "Terrain", title: "Savoir terrain, à valider par repérage" },
    inference: { color: C.muted, label: "Déduit", title: "Déduit des principes généraux" },
  };
  const c = cfg[level] || cfg.inference;
  return <Pill color={c.color} title={c.title}>{c.label}</Pill>;
}
export function TideChart({ tideData, windows }) {
  const W=580, H=100, pad={left:30,right:6,top:8,bottom:20};
  const cW=W-pad.left-pad.right, cH=H-pad.top-pad.bottom;
  // v5 : l'échelle était figée à 9 m — la courbe était écrêtée en Cotentin,
  // où les pleines mers dépassent 13 m. Elle suit maintenant le marnage réel.
  const yMax = Math.max(9, Math.ceil(Math.max(0, ...tideData.map(p=>p.height)) / 3) * 3);
  const yTicks = Array.from({length: yMax/3 + 1}, (_, i) => i * 3);
  const toX=h=>pad.left+(h/24)*cW, toY=v=>pad.top+cH-(Math.min(v,yMax)/yMax)*cH;
  if (!tideData.length) return <div style={{height:100,display:"flex",alignItems:"center",justifyContent:"center",color:"#7b8ba1",fontSize:12,fontFamily:"monospace"}}>Marée indisponible</div>;
  const pathD = tideData.reduce((a,p,i)=>a+(i===0?`M ${toX(p.hour).toFixed(1)},${toY(p.height).toFixed(1)}`:`L ${toX(p.hour).toFixed(1)},${toY(p.height).toFixed(1)}`), "");
  const primes = windows.filter(w=>w.priority==="prime" && isFinite(w.startDecimal) && isFinite(w.endDecimal) && Math.abs(w.offsetBefore)<50);
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
      <defs>
        <linearGradient id="tg6" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.03"/>
        </linearGradient>
      </defs>
      {primes.map((w,i)=>{
        const x1=toX(Math.max(0,w.startDecimal)), x2=toX(Math.min(24,w.endDecimal));
        return x2>x1?<rect key={i} x={x1.toFixed(1)} y={pad.top} width={(x2-x1).toFixed(1)} height={cH} fill="#f59e0b" opacity="0.15"/>:null;
      })}
      {[0,3,6,9,12,15,18,21,24].map(t=><line key={t} x1={toX(t)} x2={toX(t)} y1={pad.top} y2={pad.top+cH} stroke="#0f172a" strokeWidth="1"/>)}
      {yTicks.map(v=><line key={v} x1={pad.left} x2={pad.left+cW} y1={toY(v)} y2={toY(v)} stroke="#1e293b" strokeWidth="0.6" strokeDasharray="3,3"/>)}
      <path d={`${pathD} L ${toX(24)},${toY(0)} L ${toX(0)},${toY(0)} Z`} fill="url(#tg6)"/>
      <path d={pathD} fill="none" stroke="#38bdf8" strokeWidth="1.8"/>
      {[0,3,6,9,12,15,18,21,24].map(t=><text key={t} x={toX(t).toFixed(1)} y={H-5} textAnchor="middle" fontSize="12" fill="#8a9ab0" fontFamily="system-ui,sans-serif">{`${String(t).padStart(2,"0")}h`}</text>)}
      {yTicks.map(v=><text key={v} x={pad.left-3} y={toY(v)+4} textAnchor="end" fontSize="12" fill="#8a9ab0" fontFamily="system-ui,sans-serif">{v}m</text>)}
    </svg>
  );
}
// ═══════════════════════════════════════════════════════════════════
// v6.2 — FRISE DE LA JOURNÉE SUR UN SPOT
// Une seule image pour décider quand partir : lumière, marée du port du spot,
// créneaux notés et vent heure par heure aux coordonnées du spot.
// ═══════════════════════════════════════════════════════════════════
export function DayStrip({ spot, date, live, tide, sun, hours }) {
  const W = 600, padL = 34, padR = 8, cw = W - padL - padR;
  const yLight = 4, hLight = 16, yTide = 26, hTide = 86, yWind = 120, hWind = 34, H = 176;
  const X = (h) => padL + (Math.max(0, Math.min(24, h)) / 24) * cw;
  const curve = tide?.curve || [];
  const yMax = Math.max(1, ...curve.map((p) => p.height));
  const Y = (v) => yTide + hTide - (v / yMax) * (hTide - 6);
  const path = curve.map((p, i) => `${i ? "L" : "M"}${X(p.hour).toFixed(1)},${Y(p.height).toFixed(1)}`).join(" ");
  const ser = live?.series?.[spot.id];
  const wind = [];
  if (ser) for (let h = 1; h < 24; h += 2) {
    const i = idxAt(ser, msAtLocal(date, h));
    if (i >= 0 && ser.wind[i] != null) wind.push({ h, kmh: ser.wind[i], dir: ser.dir[i], f: beaufortOf(ser.wind[i]) });
  }
  const bands = [];
  if (sun?.sunrise != null && sun?.sunset != null) {
    bands.push({ a: 0, b: sun.dawn ?? sun.sunrise, c: "#0b1020" }, { a: sun.dawn ?? sun.sunrise, b: sun.sunrise + 0.75, c: "#7c3aed" },
               { a: sun.sunrise + 0.75, b: sun.sunset - 0.75, c: "#1e3a5f" }, { a: sun.sunset - 0.75, b: sun.dusk ?? sun.sunset, c: "#7c3aed" },
               { a: sun.dusk ?? sun.sunset, b: 24, c: "#0b1020" });
  }
  const wins = (spot.windows || []).filter((w) => Number.isFinite(w.startDecimal) && Math.abs(w.offsetBefore) < 50);
  const restricted = hours && (hours.from > 0 || hours.to < 24);
  const col = (w) => (!w.eligible ? "#64748b" : w.score >= 7 ? "#22c55e" : w.score >= 5 ? "#f59e0b" : "#94a3b8");
  const fCol = (f) => (f >= 6 ? "#f87171" : f >= 4 ? "#f59e0b" : "#7dd3fc");
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Journée sur ${spot.name} : lumière, marée, créneaux et vent`} style={{display:"block"}}>
      {bands.map((b, i) => b.b > b.a ? <rect key={i} x={X(b.a)} y={yLight} width={X(b.b) - X(b.a)} height={hLight} fill={b.c} opacity={b.c === "#7c3aed" ? 0.55 : 0.9} /> : null)}
      <text x={padL - 4} y={yLight + 12} textAnchor="end" fontSize="12" fill="#8a9ab0" fontFamily="system-ui,sans-serif">☀</text>
      {restricted && <>
        <rect x={X(0)} y={yTide} width={X(hours.from) - X(0)} height={hTide} fill="#000" opacity="0.35" />
        <rect x={X(hours.to)} y={yTide} width={X(24) - X(hours.to)} height={hTide} fill="#000" opacity="0.35" />
      </>}
      {wins.map((w, i) => {
        const x1 = X(w.startDecimal), x2 = X(w.endDecimal);
        if (x2 - x1 < 1) return null;
        return (
          <g key={i} opacity={w.outOfHours ? 0.35 : 1}>
            <rect x={x1} y={yTide} width={x2 - x1} height={hTide} fill={col(w)} opacity="0.16" />
            <rect x={x1} y={yTide} width={x2 - x1} height="3" fill={col(w)} />
            {w.eligible && x2 - x1 > 22 && <text x={(x1 + x2) / 2} y={yTide + 17} textAnchor="middle" fontSize="15" fontWeight="800" fill={col(w)} fontFamily="system-ui,sans-serif">{w.score.toFixed(1).replace(".", ",")}</text>}
          </g>
        );
      })}
      {path && <path d={`${path} L${X(24)},${yTide + hTide} L${X(0)},${yTide + hTide} Z`} fill="#0ea5e9" opacity="0.12" />}
      {path && <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" />}
      {(tide?.dayEvents || []).map((e, i) => (
        <text key={i} x={X(e.dec)} y={e.type === "PM" ? Math.min(yTide + hTide - 4, Y(e.h ?? yMax) + 16) : yTide + hTide - 4} textAnchor="middle" fontSize="12" fill="#cbd5e1" fontFamily="system-ui,sans-serif">{e.type}</text>
      ))}
      {wind.map((w, i) => {
        const len = 6 + Math.min(12, w.f * 2), cx = X(w.h), cy = yWind + 10;
        return (
          <g key={i}>
            <g transform={`rotate(${(w.dir ?? 0) + 180} ${cx} ${cy})`}>
              <line x1={cx} y1={cy - len / 2} x2={cx} y2={cy + len / 2} stroke={fCol(w.f)} strokeWidth="2.2" />
              <path d={`M${cx - 4},${cy + len / 2 - 5} L${cx},${cy + len / 2} L${cx + 4},${cy + len / 2 - 5}`} fill="none" stroke={fCol(w.f)} strokeWidth="2.2" />
            </g>
            <text x={cx} y={yWind + hWind - 2} textAnchor="middle" fontSize="12" fill={fCol(w.f)} fontFamily="system-ui,sans-serif">{Math.round(w.kmh)}</text>
          </g>
        );
      })}
      {!wind.length && <text x={padL + cw / 2} y={yWind + 20} textAnchor="middle" fontSize="13" fill="#8a9ab0" fontFamily="system-ui,sans-serif">vent : météo non chargée</text>}
      <text x={padL - 4} y={yWind + 14} textAnchor="end" fontSize="12" fill="#8a9ab0" fontFamily="system-ui,sans-serif">km/h</text>
      {[0, 6, 12, 18, 24].map((h) => <text key={h} x={X(h)} y={H - 2} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontSize="13" fill="#8a9ab0" fontFamily="system-ui,sans-serif">{String(h).padStart(2, "0")}h</text>)}
    </svg>
  );
}
export function ScoreArc({ score, color }) {
  const c = color || "#f59e0b";
  const r = 26, circ = 2*Math.PI*r;
  if (!score) return <div style={{width:60,height:60,borderRadius:"50%",border:"3px solid #1e293b",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:"#7b8ba1",fontFamily:"monospace",flexShrink:0}}>N/A</div>;
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" style={{flexShrink:0}}>
      <circle cx="30" cy="30" r={r} fill="none" stroke="#1e293b" strokeWidth="4"/>
      <circle cx="30" cy="30" r={r} fill="none" stroke={c} strokeWidth="4"
        strokeDasharray={`${(score/10)*circ} ${circ-(score/10)*circ}`}
        strokeDashoffset={circ/4} strokeLinecap="round"/>
      <text x="30" y="27" textAnchor="middle" fontSize="14" fontWeight="800" fill="#f8fafc" fontFamily="system-ui,sans-serif">{score.toFixed(1).replace(".", ",")}</text>
      <text x="30" y="41" textAnchor="middle" fontSize="12" fill="#8a9ab0" fontFamily="system-ui,sans-serif">/10</text>
    </svg>
  );
}
export function Pill({ color, children, title }) {
  return <span title={title} style={{display:"inline-block",fontSize:12,fontWeight:700,letterSpacing:"0.02em",color,background:color+"18",border:`1px solid ${color}40`,borderRadius:999,padding:"2px 8px",whiteSpace:"nowrap",lineHeight:1.4}}>{children}</span>;
}
/** Heure murale de Paris « HH:MM » d'un instant. */
export const parisHHMM = (ms) => { const p = parisParts(ms); return `${String(p.hh).padStart(2,"0")}:${String(p.mi).padStart(2,"0")}`; };
export const parisISO = (ms) => { const p = parisParts(ms); return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`; };

const lbl = { display:"block", fontSize:13, color:C.muted, marginBottom:5, fontWeight:600 };
const inp = { background:C.card2, color:C.text, border:`1px solid ${C.line}`, borderRadius:8, padding:"9px 10px", fontSize:15, width:"100%" };
const btn = (color, filled) => ({ padding:"10px 16px", borderRadius:9, border:`1px solid ${color}`, background:filled ? color + "26" : "transparent", color:filled ? C.strong : C.muted, cursor:"pointer", fontSize:14, fontWeight:700 });

export function JournalForm({ spots, date, onAdd, onExport, onImport, hasEntries, disabled, preset }) {
  const fileRef = useRef(null);
  const [spotId, setSpotId] = useState(preset?.spotId ?? spots[0]?.id ?? "");
  const [result, setResult] = useState(5);
  const [fish, setFish] = useState(0);
  const [lure, setLure] = useState("");
  const [note, setNote] = useState("");
  const [duree, setDuree] = useState(preset?.duree != null ? String(preset.duree).replace(".",",") : "");
  const [heure, setHeure] = useState(()=> preset?.heure ?? (parisISO(Date.now()) === date ? parisHHMM(Date.now()) : ""));
  // « Je pêche ici maintenant » → « Terminer » : le formulaire arrive prérempli.
  useEffect(()=>{
    if (!preset?.nonce) return;
    if (preset.spotId) setSpotId(preset.spotId);
    if (preset.heure) setHeure(preset.heure);
    if (preset.duree != null) setDuree(String(preset.duree).replace(".",","));
  },[preset?.nonce]);   // eslint-disable-line react-hooks/exhaustive-deps
  const [saved, setSaved] = useState(false);
  const predicted = spots.find(s=>s.id===spotId)?.score ?? null;
  const submit = async () => {
    const h = parseFloat(String(duree).replace(",","."));
    await onAdd({ id:`log-${date}-${spotId}-${Date.now().toString(36)}`, spotId, date, result, fish,
                  lure:lure.trim(), predicted: predicted!=null?parseFloat(predicted.toFixed(2)):null, note:note.trim(),
                  ...(heure ? { heure } : {}), ...(Number.isFinite(h) && h > 0 && h <= 24 ? { duree: h } : {}) });
    setNote(""); setLure(""); setFish(0); setDuree(""); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };
  return (
    <div style={{display:"grid",gap:12}}>
      <label><span style={lbl}>Spot pêché</span>
        <select value={spotId} onChange={e=>setSpotId(e.target.value)} style={inp}>
          {spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <label><span style={lbl}>Résultat ressenti : {result}/10{predicted!=null && <span style={{color:C.accent,fontWeight:500}}> · prédit {predicted.toFixed(1).replace(".", ",")}</span>}</span>
        <input type="range" min="0" max="10" step="1" value={result} onChange={e=>setResult(+e.target.value)} style={{width:"100%",accentColor:C.violet}}/>
      </label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9}}>
        <label><span style={lbl}>Heure</span><input type="time" value={heure} onChange={e=>setHeure(e.target.value)} style={inp}/></label>
        <label><span style={lbl}>Durée (h)</span><input type="text" inputMode="decimal" aria-label="Durée de la session en heures" placeholder="2,5" value={duree} onChange={e=>setDuree(e.target.value.replace(/[^\d.,]/g,""))} style={inp}/></label>
        <label><span style={lbl}>Prises</span><input type="number" min="0" max="99" value={fish} onChange={e=>setFish(Math.max(0,parseInt(e.target.value)||0))} style={inp}/></label>
      </div>
      <label><span style={lbl}>Leurre(s)</span><input type="text" value={lure} onChange={e=>setLure(e.target.value)} placeholder="Asturie 130 blanc…" style={inp}/></label>
      <label><span style={lbl}>Ce que le modèle n'a pas vu</span>
        <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Chasses en surface, taille des proies, poste précis…" style={{...inp,resize:"vertical"}}/>
      </label>
      <div style={{fontSize:12.5,color:C.muted,lineHeight:1.5}}>Avec l'heure, la marée, le vent, la houle, la pression et la lumière du moment sont enregistrés avec la session.</div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={submit} disabled={disabled} title={disabled?"Sauvegarde indisponible : importe d'abord ton journal exporté":""}
          style={{...btn(C.violet, !disabled), cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.5:1}}>Enregistrer</button>
        {hasEntries && <button onClick={onExport} style={btn(C.line)}>Exporter</button>}
        <button onClick={()=>fileRef.current?.click()} style={btn(C.line)}>Importer</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{display:"none"}}
          onChange={async(ev)=>{
            const f=ev.target.files?.[0]; if(!f) return;
            try{
              const txt=await f.text(); const list=JSON.parse(txt);
              if(!Array.isArray(list)) throw new Error("format inattendu");
              const clean=list.filter(x=>x&&x.id&&x.spotId&&x.result!=null);
              if(!clean.length) throw new Error("aucune entrée valide");
              await onImport(clean);
            }catch(e){ alert("Import impossible : "+(e?.message||e)); }
            ev.target.value="";
          }}/>
        {saved && <span style={{fontSize:13,color:C.good,fontWeight:600}}>Enregistré</span>}
      </div>
    </div>
  );
}
/** Désaccord entre les deux modèles météo sur le vent du créneau. */
export function ModelSpread({ zw }) {
  if (!zw?.alt || !((zw.spreadF || 1) >= 2 || (zw.spreadD || 1) >= 2)) return null;
  return (
    <div title="Quand les deux modèles divergent, le classement est éprouvé sur une plage de vent plus large" style={{fontSize:13,color:"#fbbf24",marginTop:4}}>
      ⚠ Modèles en désaccord : l'autre annonce {zw.alt.dir || "?"} {zw.alt.kmh} km/h
    </div>
  );
}
const PHASE = { descendant:"↘ descendant", montant:"↗ montant", renversement:"↔ étale", variable:"~ variable" };
/** Un créneau de marée noté. */
export function WindowRow({ w, lure }) {
  const [open, setOpen] = useState(false);
  const prime = w.priority === "prime";
  return (
    <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${prime ? C.warn + "55" : C.line}`,borderRadius:12,opacity:w.outOfHours?0.55:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",gap:10}}>
        <span style={{fontSize:17,fontWeight:800,color:C.strong,...num}}>{w.startFmt} → {w.endFmt}</span>
        {w.eligible && w.score!=null
          ? <span title="Note de ce créneau : marée, lumière, vent et pression ensemble" style={{fontSize:18,fontWeight:800,color:scoreColor(w.score),...num}}>{w.score.toFixed(1).replace(".", ",")}</span>
          : <span style={{fontSize:13,color:C.faint}}>non praticable</span>}
      </div>
      <div style={{fontSize:14,color:C.text,marginTop:3}}>{w.label}</div>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
        {prime && <Pill color={C.warn}>Prime</Pill>}
        <Pill color={C.muted}>{PHASE[w.tidePhaseType] || w.tidePhaseType}</Pill>
        {w.light && w.light.band!=="inconnu" && <Pill color={w.light.color}>{w.light.label}</Pill>}
        {w.outOfHours && <Pill color={C.faint} title="Hors de tes heures de pêche : jamais proposé">Hors de tes heures</Pill>}
      </div>
      {w.zw?.fromSpot && (
        <div title={`Météo prévue sur ce créneau, aux coordonnées du spot${w.zw.model?` (${w.zw.model})`:""}`} style={{fontSize:13.5,color:"#7dd3fc",marginTop:7,...num}}>
          🌬 {w.zw.wind_dir} {w.zw.wind_kmh} km/h{w.zw.gust_kmh!=null?` · raf. ${w.zw.gust_kmh}`:""} · 🌊 {w.zw.houleKnown?`${String(w.zw.houle).replace(".",",")} m`:"?"}{w.zw.cloud!=null?` · ☁ ${w.zw.cloud} %`:""}{w.zw.rain>=0.5?` · 🌧 ${String(w.zw.rain).replace(".",",")} mm`:""}
        </div>
      )}
      {w.zw?.fromSpot && <ModelSpread zw={w.zw}/>}
      {w.zw?.rain36 >= 5 && <div style={{fontSize:13,color:C.muted,marginTop:4}}>🌧 {String(w.zw.rain36).replace(".",",")} mm de pluie dans les 36 h précédentes{w.zw.rain36 >= 15 ? " : eau probablement teintée près des rivières (déduit)" : ""}</div>}
      {lure && <div style={{fontSize:13.5,color:C.text,marginTop:6}}>🎣 <b>{lure}</b></div>}
      {w.light?.mismatch && (
        <div style={{marginTop:7,padding:"7px 9px",borderRadius:8,background:"rgba(127,29,29,0.2)",border:"1px solid #7f1d1d",fontSize:13,color:"#fecaca",lineHeight:1.5}}>
          Libellé trompeur à cette date : ce créneau annonce de la basse lumière mais tombe en {w.light.label.toLowerCase()}.
        </div>
      )}
      {w.note && <p style={{margin:"7px 0 0",fontSize:13.5,color:C.muted,lineHeight:1.5}}>{w.note}</p>}
      {w.parts?.length>0 && (
        <button onClick={()=>setOpen(v=>!v)} aria-expanded={open} style={{marginTop:2,minHeight:40,background:"none",border:"none",padding:0,color:C.accent,fontSize:13.5,cursor:"pointer"}}>{open?"Masquer":"Détail de la note"}</button>
      )}
      {open && (
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:6}}>
          {w.parts.filter(p=>Math.abs(p.v)>=0.05).map((p,i)=>(
            <span key={i} style={{fontSize:12.5,padding:"2px 7px",borderRadius:6,border:`1px solid ${C.line}`,color:p.v>0?"#4ade80":"#f87171",...num}}>{p.k} {p.v>0?"+":""}{p.v}</span>
          ))}
        </div>
      )}
    </div>
  );
}
export function Loader({ msg }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 0",gap:12}}>
      <div style={{width:32,height:32,border:`3px solid ${C.line}`,borderTop:`3px solid ${C.accent}`,borderRadius:"50%",animation:"spin .85s linear infinite"}}/>
      <span style={{color:C.muted,fontSize:13.5,textAlign:"center"}}>{msg}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
export function TerrainBlock({ spot, compact = false }) {
  const t = terrainOf(spot);
  const g = GRATTER[t.gratter] || GRATTER.texan;
  return (
    <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${g.color}55`,borderRadius:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:15,fontWeight:700,color:C.strong}}>Terrain · encombrement {t.encombrement}/3</span>
        <ConfidenceBadge level={t.confidence} />
      </div>
      <div style={{fontSize:14,color:g.color,fontWeight:700,marginBottom:6}}>{g.label}</div>
      {!compact && <p style={{margin:"0 0 6px",fontSize:14,color:C.text,lineHeight:1.55}}>{t.fond} <span style={{color:C.muted}}>({ENCOMBREMENT[t.encombrement]})</span></p>}
      <div style={{fontSize:14,color:C.text,lineHeight:1.55}}>
        <b>Couches à pêcher :</b> {t.couches.join(", ")}.
        {t.montage && <><br/><b>Montage :</b> {t.montage}</>}
      </div>
      {!compact && t.conseils.length>0 && (
        <ul style={{margin:"8px 0 0",paddingLeft:18,fontSize:14,color:C.text,lineHeight:1.55,listStyle:"disc"}}>
          {t.conseils.map((c,i)=><li key={i}>{c}</li>)}
        </ul>
      )}
      {!compact && (t.faits||[]).length>0 && (
        <div style={{marginTop:10,paddingTop:9,borderTop:`1px solid ${C.line}`}}>
          <div style={{fontSize:13,fontWeight:700,color:C.good,marginBottom:5}}>Ce que disent les sources</div>
          {t.faits.map((f,i)=>(
            <div key={i} style={{fontSize:13.5,color:C.text,lineHeight:1.5,marginBottom:6}}>{f.t} <span style={{fontSize:12,color:C.faint,fontStyle:"italic"}}>— {f.s}</span></div>
          ))}
        </div>
      )}
      {!compact && <div style={{fontSize:12.5,color:C.muted,marginTop:7}}>Classement du terrain : {t.confidence==="local_knowledge"?"observation de terrain":"déduit des descriptions"} · {t.source}</div>}
    </div>
  );
}
export function TopoBlock({ title, data }) {
  if (!data?.text) return null;
  return (
    <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${C.line}`,borderRadius:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:14,fontWeight:700,color:C.strong}}>{title}</span>
        <ConfidenceBadge level={data.confidence} />
      </div>
      <p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.6}}>{data.text}</p>
    </div>
  );
}
