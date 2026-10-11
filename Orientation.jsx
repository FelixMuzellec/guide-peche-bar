// Orientation d'un spot : vers où est l'eau quand on regarde le large depuis
// le poste. C'est elle qui décide quels vents sont « de face » (vent de mer)
// ou « dans le dos » (vent de terre). Déduite des descriptions dans la fiche ;
// tu peux la confirmer ou la corriger sur place, et le classement suit.
import { DIR16 } from "../engine/core.js";
import { waterDirOf } from "../engine/model.js";

const DIR_FR = { N: "nord", NNE: "nord-nord-est", NE: "nord-est", ENE: "est-nord-est", E: "est", ESE: "est-sud-est", SE: "sud-est", SSE: "sud-sud-est",
  S: "sud", SSO: "sud-sud-ouest", SO: "sud-ouest", OSO: "ouest-sud-ouest", O: "ouest", ONO: "ouest-nord-ouest", NO: "nord-ouest", NNO: "nord-nord-ouest" };
const nameOf = (deg) => DIR16[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];

function Compass({ water, exposed, sheltered }) {
  const C = 60, R = 46;
  const pt = (deg, r) => [C + r * Math.sin(deg * Math.PI / 180), C - r * Math.cos(deg * Math.PI / 180)];
  const wedge = (deg, fill) => {
    const [x1, y1] = pt(deg - 11.25, R), [x2, y2] = pt(deg + 11.25, R);
    return <path key={fill + deg} d={`M${C},${C} L${x1.toFixed(1)},${y1.toFixed(1)} A${R},${R} 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)} Z`} fill={fill} opacity="0.45"/>;
  };
  const [ax, ay] = pt(water, R - 6);
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label={`L'eau est vers le ${DIR_FR[nameOf(water)]}`} style={{flexShrink:0}}>
      <circle cx={C} cy={C} r={R} fill="#0b1626" stroke="#334155"/>
      {exposed.map((d) => wedge(d, "#38bdf8"))}
      {sheltered.map((d) => wedge(d, "#22c55e"))}
      {DIR16.map((_, i) => { const [x1, y1] = pt(i * 22.5, R), [x2, y2] = pt(i * 22.5, R - (i % 4 ? 4 : 8)); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b"/>; })}
      {[["N", 0], ["E", 90], ["S", 180], ["O", 270]].map(([l, d]) => { const [x, y] = pt(d, R + 9); return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize="12" fill="#94a3b8" fontFamily="system-ui,sans-serif">{l}</text>; })}
      <line x1={C} y1={C} x2={ax} y2={ay} stroke="#f8fafc" strokeWidth="3" strokeLinecap="round"/>
      <circle cx={ax} cy={ay} r="4" fill="#38bdf8"/>
      <circle cx={C} cy={C} r="3" fill="#f8fafc"/>
    </svg>
  );
}

export function Orientation({ spot, base, orient, onChange }) {
  const fiche = waterDirOf(base);
  if (fiche == null) return null;
  const o = orient?.[spot.id];
  const cur = Number.isFinite(o?.water) ? o.water : fiche;
  const status = !o ? "fiche" : o.water === fiche ? "confirmé" : "corrigé";
  const set = (water) => {
    const next = { ...(orient || {}) };
    if (water == null) delete next[spot.id];
    else next[spot.id] = { water, at: new Date().toISOString().slice(0, 10) };
    onChange(next);
  };
  const conf = base.topology?.exposition?.confidence;
  return (
    <div style={{padding:"12px 13px",background:"#071120",border:"1px solid #1e293b",borderRadius:12}}>
      <div style={{fontSize:15,color:"#f8fafc",fontWeight:700,marginBottom:8}}>🧭 Orientation du poste</div>
      <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
        <Compass water={cur} exposed={spot.exposedAngles} sheltered={spot.shelteredAngles}/>
        <div style={{flex:"1 1 160px",minWidth:0,fontSize:13,color:"#cbd5e1",lineHeight:1.55}}>
          <div>L'eau est vers le <b style={{color:"#f8fafc"}}>{DIR_FR[nameOf(cur)]}</b> ({nameOf(cur)}).</div>
          <div style={{fontSize:13,color:"#94a3b8",marginTop:3}}>
            <span style={{color:"#7dd3fc"}}>■</span> vents de mer (de face) · <span style={{color:"#4ade80"}}>■</span> vents de terre (dans le dos)
          </div>
          <div style={{fontSize:13,marginTop:5,color:status === "fiche" ? "#94a3b8" : "#a78bfa"}}>
            {status === "fiche" ? `Déduite de la fiche${conf === "verified" ? " (exposition sourcée)" : conf === "inference" ? " (exposition déduite)" : ""} : à confirmer sur place.`
              : status === "confirmé" ? `◎ Confirmée sur place le ${o.at || "?"}.` : `◎ Corrigée sur place le ${o.at || "?"} (fiche : ${nameOf(fiche)}).`}
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:9,alignItems:"center"}}>
        {status !== "confirmé" && (
          <button onClick={() => set(fiche)} style={{padding:"7px 11px",borderRadius:6,border:"1px solid #a78bfa",background:"rgba(167,139,250,0.12)",color:"#ddd6fe",fontSize:14,cursor:"pointer"}}>
            ✓ C'est juste : l'eau est vers {nameOf(fiche)}
          </button>
        )}
        <label style={{fontSize:14,color:"#94a3b8",display:"flex",alignItems:"center",gap:6}}>
          Corriger :
          <select aria-label="Direction de l'eau" value={nameOf(cur)} onChange={(e) => set(DIR16.indexOf(e.target.value) * 22.5)} style={{background:"#060f1e",color:"#e2e8f0",border:"1px solid #1e293b",borderRadius:5,padding:"4px 6px"}}>
            {DIR16.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>
        {status !== "fiche" && <button onClick={() => set(null)} style={{fontSize:13.5,color:"#7dd3fc",background:"none",border:"none",padding:0,cursor:"pointer",textDecoration:"underline"}}>revenir à la fiche</button>}
      </div>
      <div style={{fontSize:13,color:"#94a3b8",marginTop:8,lineHeight:1.5}}>Regarde le large depuis ton poste : indique où est l'eau. Le classement des spots en tient compte aussitôt, sur cet appareil.</div>
    </div>
  );
}
