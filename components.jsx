// Composants d'interface réutilisables.
import { useRef, useState } from "react";
import { ENCOMBREMENT, GRATTER, terrainOf } from "../engine/model.js";
import { msAtLocal } from "../engine/tide.js";
import { beaufortOf, idxAt } from "../engine/weather.js";

// ═══════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════

export function ConfidenceBadge({ level }) {
  const cfg = {
    verified: { color: "#22c55e", label: "✓ SOURCÉ", title: "Information vérifiée sur une source web identifiable" },
    local_knowledge: { color: "#a78bfa", label: "◎ TERRAIN", title: "Savoir terrain local, à valider par repérage" },
    inference: { color: "#94a3b8", label: "~ DÉDUIT", title: "Déduit à partir des principes généraux applicables" },
  };
  const c = cfg[level] || cfg.inference;
  return (
    <span title={c.title} style={{fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",color:c.color,background:c.color+"15",border:`1px solid ${c.color}35`,borderRadius:3,padding:"1px 6px",fontWeight:700,whiteSpace:"nowrap"}}>
      {c.label}
    </span>
  );
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
      {[0,3,6,9,12,15,18,21,24].map(t=><text key={t} x={toX(t).toFixed(1)} y={H-5} textAnchor="middle" fontSize="12" fill="#8a9ab0" fontFamily="monospace">{`${String(t).padStart(2,"0")}h`}</text>)}
      {yTicks.map(v=><text key={v} x={pad.left-3} y={toY(v)+4} textAnchor="end" fontSize="11" fill="#8a9ab0" fontFamily="monospace">{v}m</text>)}
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
      <text x={padL - 4} y={yLight + 12} textAnchor="end" fontSize="12" fill="#8a9ab0" fontFamily="monospace">☀</text>
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
            {w.eligible && x2 - x1 > 22 && <text x={(x1 + x2) / 2} y={yTide + 17} textAnchor="middle" fontSize="15" fontWeight="800" fill={col(w)} fontFamily="monospace">{w.score.toFixed(1)}</text>}
          </g>
        );
      })}
      {path && <path d={`${path} L${X(24)},${yTide + hTide} L${X(0)},${yTide + hTide} Z`} fill="#0ea5e9" opacity="0.12" />}
      {path && <path d={path} fill="none" stroke="#38bdf8" strokeWidth="2" />}
      {(tide?.dayEvents || []).map((e, i) => (
        <text key={i} x={X(e.dec)} y={e.type === "PM" ? Math.min(yTide + hTide - 4, Y(e.h ?? yMax) + 16) : yTide + hTide - 4} textAnchor="middle" fontSize="12" fill="#cbd5e1" fontFamily="monospace">{e.type}</text>
      ))}
      {wind.map((w, i) => {
        const len = 6 + Math.min(12, w.f * 2), cx = X(w.h), cy = yWind + 10;
        return (
          <g key={i}>
            <g transform={`rotate(${(w.dir ?? 0) + 180} ${cx} ${cy})`}>
              <line x1={cx} y1={cy - len / 2} x2={cx} y2={cy + len / 2} stroke={fCol(w.f)} strokeWidth="2.2" />
              <path d={`M${cx - 4},${cy + len / 2 - 5} L${cx},${cy + len / 2} L${cx + 4},${cy + len / 2 - 5}`} fill="none" stroke={fCol(w.f)} strokeWidth="2.2" />
            </g>
            <text x={cx} y={yWind + hWind - 2} textAnchor="middle" fontSize="12" fill={fCol(w.f)} fontFamily="monospace">{Math.round(w.kmh)}</text>
          </g>
        );
      })}
      {!wind.length && <text x={padL + cw / 2} y={yWind + 20} textAnchor="middle" fontSize="13" fill="#8a9ab0" fontFamily="monospace">vent : météo non chargée</text>}
      <text x={padL - 4} y={yWind + 14} textAnchor="end" fontSize="12" fill="#8a9ab0" fontFamily="monospace">km/h</text>
      {[0, 6, 12, 18, 24].map((h) => <text key={h} x={X(h)} y={H - 2} textAnchor={h === 0 ? "start" : h === 24 ? "end" : "middle"} fontSize="13" fill="#8a9ab0" fontFamily="monospace">{String(h).padStart(2, "0")}h</text>)}
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
      <text x="30" y="27" textAnchor="middle" fontSize="14" fontWeight="800" fill="#f8fafc" fontFamily="monospace">{score.toFixed(1)}</text>
      <text x="30" y="40" textAnchor="middle" fontSize="9" fill="#8a9ab0" fontFamily="monospace">/10</text>
    </svg>
  );
}
export function Pill({ color, children, title }) {
  return <span title={title} style={{fontSize:11,fontFamily:"monospace",fontWeight:700,letterSpacing:"0.08em",color,background:color+"15",border:`1px solid ${color}30`,borderRadius:3,padding:"2px 7px",whiteSpace:"nowrap"}}>{children}</span>;
}
export function JournalForm({ spots, date, onAdd, onExport, onImport, hasEntries, disabled }) {
  const fileRef = useRef(null);
  const [spotId, setSpotId] = useState(spots[0]?.id ?? "");
  const [result, setResult] = useState(5);
  const [fish, setFish] = useState(0);
  const [lure, setLure] = useState("");
  const [note, setNote] = useState("");
  const [heure, setHeure] = useState(()=>{
    const n = new Date(), iso = new Date(n.getTime() - n.getTimezoneOffset()*6e4).toISOString().slice(0,10);
    return iso === date ? `${String(n.getHours()).padStart(2,"0")}:${String(n.getMinutes()).padStart(2,"0")}` : "";
  });
  const [saved, setSaved] = useState(false);
  const predicted = spots.find(s=>s.id===spotId)?.score ?? null;
  const submit = async () => {
    await onAdd({ id:`log-${date}-${spotId}-${Date.now().toString(36)}`, spotId, date, result, fish,
                  lure:lure.trim(), predicted: predicted!=null?parseFloat(predicted.toFixed(2)):null, note:note.trim(),
                  ...(heure ? { heure } : {}) });
    setNote(""); setLure(""); setFish(0); setSaved(true); setTimeout(()=>setSaved(false),2500);
  };
  const inp = {background:"#060f1e",color:"#e2e8f0",border:"1px solid #1e293b",borderRadius:6,padding:"7px 9px",fontSize:13,fontFamily:"monospace",width:"100%"};
  return (
    <div style={{display:"grid",gap:9}}>
      <div>
        <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>SPOT PÊCHÉ</div>
        <select value={spotId} onChange={e=>setSpotId(e.target.value)} style={inp}>
          {spots.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>
          RÉSULTAT RESSENTI — {result}/10{predicted!=null&&<span style={{color:"#38bdf8"}}> · PRÉDIT {predicted.toFixed(1)}</span>}
        </div>
        <input type="range" min="0" max="10" step="1" value={result} onChange={e=>setResult(+e.target.value)} style={{width:"100%",accentColor:"#a78bfa"}}/>
      </div>
      <div>
        <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>HEURE DE LA SESSION (OU DE LA PRISE)</div>
        <input type="time" value={heure} onChange={e=>setHeure(e.target.value)} style={inp}/>
        <div style={{fontSize:11,color:"#8a9ab0",marginTop:3}}>Avec l'heure, la marée, le vent, la houle, la pression et la lumière du moment sont enregistrés avec la session.</div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"90px 1fr",gap:9}}>
        <div>
          <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>PRISES</div>
          <input type="number" min="0" max="99" value={fish} onChange={e=>setFish(Math.max(0,parseInt(e.target.value)||0))} style={inp}/>
        </div>
        <div>
          <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>LEURRE(S)</div>
          <input type="text" value={lure} onChange={e=>setLure(e.target.value)} placeholder="Asturie 130 blanc…" style={inp}/>
        </div>
      </div>
      <div>
        <div style={{fontSize:11,color:"#8a9ab0",letterSpacing:"0.1em",fontFamily:"monospace",marginBottom:4}}>CE QUE LE MODÈLE N'A PAS VU</div>
        <textarea rows={2} value={note} onChange={e=>setNote(e.target.value)} placeholder="Chasses en surface, taille des proies, poste précis…" style={{...inp,resize:"vertical"}}/>
      </div>
      <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <button onClick={submit} disabled={disabled}
          title={disabled?"Sauvegarde indisponible : importe d'abord ton journal exporté":""}
          style={{padding:"7px 14px",borderRadius:6,border:"1px solid "+(disabled?"#334155":"#a78bfa"),background:disabled?"none":"rgba(167,139,250,0.15)",color:disabled?"#8a9ab0":"#c4b5fd",cursor:disabled?"not-allowed":"pointer",fontSize:12,fontFamily:"monospace",letterSpacing:"0.12em"}}>ENREGISTRER</button>
        {hasEntries && <button onClick={onExport} style={{padding:"7px 12px",borderRadius:6,border:"1px solid #1e293b",background:"none",color:"#8a9ab0",cursor:"pointer",fontSize:12,fontFamily:"monospace"}}>EXPORTER</button>}
        <button onClick={()=>fileRef.current?.click()} style={{padding:"7px 12px",borderRadius:6,border:"1px solid #1e293b",background:"none",color:"#8a9ab0",cursor:"pointer",fontSize:12,fontFamily:"monospace"}}>IMPORTER</button>
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
        {saved && <span style={{fontSize:12,fontFamily:"monospace",color:"#22c55e"}}>enregistré</span>}
      </div>
    </div>
  );
}
export function WindowRow({ w }) {
  const cfg = {
    prime:{dot:"#f59e0b",label:"PRIME",bg:"rgba(245,158,11,0.08)",border:"rgba(245,158,11,0.25)"},
    bon:  {dot:"#38bdf8",label:"BON",bg:"rgba(14,165,233,0.05)",border:"#1e293b"},
  };
  const c = cfg[w.priority] || cfg.bon;
  const phI = {descendant:"↘",montant:"↗",renversement:"↔",variable:"~"};
  const phC = {descendant:"#64748b",montant:"#22c55e",renversement:"#f59e0b",variable:"#a78bfa"};
  return (
    <div style={{padding:"10px 12px",background:c.bg,border:`1px solid ${c.border}`,borderRadius:8,opacity:w.outOfHours?0.5:1}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:4,marginBottom:4}}>
        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:c.dot,display:"inline-block",flexShrink:0}}/>
          <span style={{fontSize:13,color:"#cbd5e1",fontWeight:700}}>{w.label}</span>
          <Pill color={c.dot}>{c.label}</Pill>
          {w.outOfHours && <Pill color="#8a9ab0" title="Hors de tes heures de pêche : jamais proposé">HORS DE TES HEURES</Pill>}
          <span style={{fontSize:12,color:phC[w.tidePhaseType],fontFamily:"monospace"}}>{phI[w.tidePhaseType]} {w.tidePhaseType}</span>
          {w.light && w.light.band!=="inconnu" && (
            <Pill color={w.light.color} title={`Lumière réelle calculée pour la date et le lieu — ${w.light.overlap>0?`${Math.round(w.light.overlap*60)} min de basse lumière dans la fenêtre`:"aucune basse lumière dans la fenêtre"}`}>
              {w.light.label.toUpperCase()}
            </Pill>
          )}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {w.eligible && w.score!=null && (
            <span title="Note de CETTE fenêtre : marée, lumière, vent et pression évalués ensemble" style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:w.score>=7?"#22c55e":w.score>=5?"#f59e0b":"#94a3b8"}}>{w.score.toFixed(1)}</span>
          )}
          <span style={{fontSize:15,color:"#f8fafc",fontFamily:"monospace",fontWeight:800,letterSpacing:"0.02em"}}>{w.startFmt} → {w.endFmt}</span>
        </div>
      </div>
      <div style={{fontSize:12,color:"#8a9ab0",fontFamily:"monospace",marginBottom:3}}>Réf {w.refLabel} : {w.refFmt}</div>
      {w.zw?.fromSpot && (
        <div title={`Météo prévue sur les heures de la fenêtre, aux coordonnées du spot${w.zw.model?` — modèle ${w.zw.model}`:""}`}
             style={{fontSize:12,color:"#7dd3fc",fontFamily:"monospace",marginBottom:5}}>
          🌬 {w.zw.wind_dir} {w.zw.wind_kmh} km/h{w.zw.gust_kmh!=null?` (raf. ${w.zw.gust_kmh})`:""}
          {" · "}🌊 {w.zw.houleKnown?`${String(w.zw.houle).replace(".",",")} m`:"houle inconnue"}
          {w.zw.cloud!=null?` · ☁ ${w.zw.cloud} %`:""}{w.zw.rain>=0.5?` · 🌧 ${String(w.zw.rain).replace(".",",")} mm`:""}
        </div>
      )}
      {w.light?.mismatch && (
        <div style={{margin:"0 0 6px",padding:"6px 8px",borderRadius:6,background:"rgba(127,29,29,0.18)",border:"1px solid #7f1d1d",fontSize:12,color:"#fca5a5",lineHeight:1.5}}>
          <strong>Libellé trompeur à cette date.</strong> Cette fenêtre annonce de la basse
          lumière mais tombe en {w.light.label.toLowerCase()} : le soleil ne s'y prête pas.
          La note ci-dessous décrit le cas favorable, pas celui d'aujourd'hui.
        </div>
      )}
      {w.parts?.length>0 && (
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {w.parts.filter(p=>Math.abs(p.v)>=0.05).map((p,i)=>(
            <span key={i} style={{fontSize:12,fontFamily:"monospace",padding:"2px 5px",borderRadius:4,border:"1px solid #1e293b",color:p.v>0?"#4ade80":"#f87171"}}>
              {p.k} {p.v>0?"+":""}{p.v}
            </span>
          ))}
        </div>
      )}
      <p style={{margin:0,fontSize:13,color:"#8a9ab0",lineHeight:1.5}}>{w.note}</p>
    </div>
  );
}
export function Loader({ msg }) {
  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"32px 0",gap:14}}>
      <div style={{width:34,height:34,border:"3px solid #1e293b",borderTop:"3px solid #0ea5e9",borderRadius:"50%",animation:"spin .85s linear infinite"}}/>
      <span style={{color:"#8a9ab0",fontSize:12,fontFamily:"monospace",letterSpacing:"0.1em"}}>{msg}</span>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
export function TerrainBlock({ spot, compact = false }) {
  const t = terrainOf(spot);
  const g = GRATTER[t.gratter] || GRATTER.texan;
  return (
    <div style={{padding:"11px 12px",background:"rgba(5,12,25,0.6)",border:`1px solid ${g.color}55`,borderRadius:8}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,flexWrap:"wrap",gap:6}}>
        <span style={{fontSize:13,color:"#7dd3fc",letterSpacing:"0.12em",fontFamily:"monospace",fontWeight:700}}>🪨 TERRAIN · ENCOMBREMENT {t.encombrement}/3</span>
        <ConfidenceBadge level={t.confidence} />
      </div>
      <div style={{fontSize:13,color:g.color,fontWeight:700,marginBottom:6}}>{g.label}</div>
      {!compact && <p style={{margin:"0 0 6px",fontSize:13,color:"#cbd5e1",lineHeight:1.6}}>{t.fond} <span style={{color:"#94a3b8"}}>({ENCOMBREMENT[t.encombrement]})</span></p>}
      <div style={{fontSize:13,color:"#cbd5e1",lineHeight:1.6,marginBottom:t.conseils.length?6:0}}>
        <b style={{color:"#e2e8f0"}}>Couches à pêcher :</b> {t.couches.join(", ")}.
        {t.montage && <><br/><b style={{color:"#e2e8f0"}}>Montage :</b> {t.montage}</>}
      </div>
      {!compact && t.conseils.length>0 && (
        <ul style={{margin:"4px 0 0",paddingLeft:18,fontSize:13,color:"#cbd5e1",lineHeight:1.6,listStyle:"disc"}}>
          {t.conseils.map((c,i)=><li key={i}>{c}</li>)}
        </ul>
      )}
      {!compact && (t.faits||[]).length>0 && (
        <div style={{marginTop:9,paddingTop:8,borderTop:"1px solid #1e293b"}}>
          <div style={{fontSize:11,color:"#22c55e",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700,marginBottom:5}}>📚 CE QUE DISENT LES SOURCES</div>
          {t.faits.map((f,i)=>(
            <div key={i} style={{fontSize:13,color:"#cbd5e1",lineHeight:1.55,marginBottom:6}}>
              {f.t} <span style={{fontSize:11,color:"#8a9ab0",fontStyle:"italic"}}>— {f.s}</span>
            </div>
          ))}
        </div>
      )}
      {!compact && <div style={{fontSize:12,color:"#94a3b8",marginTop:7}}>Classement du terrain : {t.confidence==="local_knowledge"?"observation de terrain":"déduit des descriptions"} · {t.source}</div>}
    </div>
  );
}
export function TopoBlock({ title, data }) {
  return (
    <div style={{padding:"10px 12px",background:"rgba(5,12,25,0.5)",border:"1px solid #1e293b",borderRadius:7}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5,flexWrap:"wrap",gap:4}}>
        <span style={{fontSize:11,color:"#0ea5e9",letterSpacing:"0.1em",fontFamily:"monospace",fontWeight:700}}>{title}</span>
        <ConfidenceBadge level={data.confidence} />
      </div>
      <p style={{margin:0,fontSize:13.5,color:"#94a3b8",lineHeight:1.65}}>{data.text}</p>
    </div>
  );
}
