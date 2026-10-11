// Spots : carte, classement du jour, fiche du spot choisi.
import { useEffect, useRef, useState } from "react";
import { SPOTS } from "SITE_CONFIG";
import { ALL_HOURS } from "../../engine/model.js";
import { Pill } from "../components.jsx";
import { C, Card, Muted, Stack, fr, num, scoreColor } from "../kit.jsx";
import { MapView } from "../MapView.jsx";
import { SpotDetail } from "./SpotDetail.jsx";

function Hours({ g }) {
  const { hours, setHours } = g;
  const sel = { background:C.card2, color:C.text, border:`1px solid ${C.line}`, borderRadius:8, padding:"0 8px", minHeight:40, fontSize:15 };
  const restricted = hours.from > 0 || hours.to < 24;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",fontSize:14.5,color:C.muted}}>
      <span style={{flexBasis:"100%",fontSize:15,fontWeight:700,color:C.strong}}>🕑 Mes heures de pêche</span>
      <select aria-label="Début" value={hours.from} onChange={(e) => { const f = +e.target.value; setHours({ from: f, to: Math.max(f + 1, hours.to) }); }} style={sel}>
        {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")} h</option>)}
      </select>
      <span>→</span>
      <select aria-label="Fin" value={hours.to} onChange={(e) => { const to = +e.target.value; setHours({ from: Math.min(hours.from, to - 1), to }); }} style={sel}>
        {Array.from({ length: 24 }, (_, h) => h + 1).map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")} h</option>)}
      </select>
      {restricted && <button onClick={() => setHours(ALL_HOURS)} style={{minHeight:40,fontSize:13.5,color:C.accent,background:"none",border:"none",padding:"0 4px",cursor:"pointer",textDecoration:"underline"}}>toutes heures, nuit comprise</button>}
    </div>
  );
}

export function Spots({ g }) {
  const [showAll, setShowAll] = useState(false);
  const detailRef = useRef(null);
  const list = showAll ? g.allScored : g.top3;
  const active = g.activeSpot;
  // Un spot choisi ailleurs (synthèse, carte, liste) : on descend jusqu'à sa fiche.
  useEffect(() => {
    if (!g.focus) return undefined;
    const t = setTimeout(() => { try { detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { /* sans effet */ } }, 80);
    return () => clearTimeout(t);
  }, [g.focus]);
  return (
    <Stack>
      <Card><Hours g={g}/><Muted>Les créneaux hors de ces heures sont grisés et jamais proposés.</Muted></Card>
      <Card title="Carte des spots">
        <MapView spots={g.allScored} activeId={active?.id} onPick={g.goToSpot}/>
      </Card>
      <Card title={showAll ? `Les ${SPOTS.length} spots, classés` : "Top 3 du jour"} right={
        <button onClick={() => setShowAll((v) => !v)} style={{fontSize:13.5,color:C.accent,background:"none",border:`1px solid ${C.line}`,borderRadius:8,padding:"6px 10px",cursor:"pointer",flexShrink:0}}>
          {showAll ? "Top 3" : `Voir les ${SPOTS.length}`}
        </button>}>
        {!g.live && <Muted style={{marginTop:0,marginBottom:8}}>Sans météo : classement sur la marée et la lumière seules.</Muted>}
        {list.map((s, i) => {
          const on = active?.id === s.id;
          return (
            <button key={s.id} onClick={() => g.goToSpot(s.id)} style={{display:"flex",width:"100%",alignItems:"center",gap:12,padding:"11px 6px",border:"none",borderTop:i ? `1px solid ${C.line2}` : "none",background:on ? "#0f2540" : "none",color:C.text,cursor:"pointer",textAlign:"left",opacity:s.eligible ? 1 : 0.65,borderRadius:8}}>
              <span style={{width:34,flexShrink:0,paddingLeft:6,borderLeft:`3px solid ${s.eligible ? s.color : C.line}`,fontSize:17,fontWeight:800,color:s.eligible ? C.strong : C.faint,...num}}>#{i + 1}</span>
              <span style={{flex:1,minWidth:0}}>
                <span style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                  <b style={{fontSize:15,color:C.strong}}>{s.name}</b>
                  {s.isLocal && <Pill color={C.good}>Local</Pill>}
                  {g.localForced?.id === s.id && <Pill color={C.warn} title="Le TOP 3 garantit un spot local">Local garanti</Pill>}
                </span>
                <span style={{display:"block",fontSize:13,color:C.muted,marginTop:2}}>{s.distance} · {s.type.toLowerCase()}</span>
                {s.wxReason && <span style={{display:"block",fontSize:13,color:s.eligible ? C.text : "#fca5a5",marginTop:2}}>{s.wxReason}</span>}
              </span>
              <span style={{fontSize:20,fontWeight:800,color:scoreColor(s.score, s.eligible),...num}}>{s.eligible ? fr(s.score) : "–"}</span>
            </button>
          );
        })}
      </Card>
      {active && <SpotDetail key={active.id} g={g} spot={active} detailRef={detailRef}/>}
    </Stack>
  );
}
