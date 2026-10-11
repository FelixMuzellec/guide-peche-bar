// Fiche d'un spot, en quatre sous-onglets : Créneaux, Terrain, Leurres, Accès.
import { useState } from "react";
import { SITE, SPOTS } from "SITE_CONFIG";
import { FAMILLES, lureAdvice } from "../../engine/lures.js";
import { securityFor } from "../../engine/rules.js";
import { DayStrip, Pill, ScoreArc, TerrainBlock, TopoBlock, WindowRow } from "../components.jsx";
import { Alert, C, Disclosure, GoLink, Muted, Stack, SubTabs, fr } from "../kit.jsx";
import { Orientation } from "../Orientation.jsx";
// Une adresse web citée dans une source devient un lien.
const linkify = (txt) => String(txt).split(/(https?:\/\/[^\s)]+)/).map((p, i) => (i % 2
  ? <a key={i} href={p} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline",wordBreak:"break-all"}}>lien</a> : p));

const DANGER = ["", ["Facile", C.good], ["Modéré", C.warn], ["Technique", C.bad]];

function Creneaux({ g, spot }) {
  const shown = spot.windows.filter((w) => Math.abs(w.offsetBefore) < 50);
  const restricted = g.hours.from > 0 || g.hours.to < 24;
  return (
    <Stack gap={10}>
      <div style={{padding:"10px 10px 6px",background:C.card2,border:`1px solid ${C.line}`,borderRadius:12}}>
        <div style={{fontSize:14,fontWeight:700,color:C.strong,marginBottom:4}}>La journée sur ce spot</div>
        <DayStrip spot={spot} date={g.selectedDate} live={g.live} tide={g.tideFor(spot.tidePort)} sun={g.sun} hours={g.hours}/>
        <div style={{fontSize:12.5,color:C.muted,marginTop:4,lineHeight:1.5}}>En haut : nuit, basse lumière (violet), jour. Courbe : marée du port du spot. Bandes : créneaux notés{restricted ? " (assombri : hors de tes heures)" : ""}. Flèches : vent heure par heure, vers où il souffle.</div>
      </div>
      {shown.length > 0
        ? shown.map((w, i) => <WindowRow key={`${w.id}-${i}`} w={w} lure={g.live && w.eligible ? lureAdvice(spot, w, g.live, g.selectedDate).summary : null}/>)
        : <Muted>Données de marée manquantes.</Muted>}
      <Disclosure title="Conseil et règle de marée du spot" sub={spot.tidalRules.typeHeure}>
        <p style={{margin:0,fontSize:14,color:C.text,lineHeight:1.6}}>{spot.tidalRules.montantOuDescendant}</p>
        <p style={{margin:"8px 0 0",fontSize:14,color:C.text,lineHeight:1.6}}>💡 {spot.tidalRules.lifeHack}</p>
        <p style={{margin:"8px 0 0",fontSize:14,color:C.muted,lineHeight:1.6}}>{spot.tidalRules.description}</p>
      </Disclosure>
    </Stack>
  );
}

function Terrain({ g, spot }) {
  return (
    <Stack gap={10}>
      <TerrainBlock spot={spot}/>
      <Orientation spot={spot} base={SPOTS.find((s) => s.id === spot.id) || spot} orient={g.orient} onChange={g.setOrient}/>
      <TopoBlock title="Fond" data={spot.topology.fond}/>
      <TopoBlock title="Structure et comportement" data={spot.topology.structure}/>
      <TopoBlock title="Courant" data={spot.topology.courant}/>
      <TopoBlock title="Exposition" data={spot.topology.exposition}/>
      <TopoBlock title="Population" data={spot.topology.bars}/>
      <Disclosure title="Sources utilisées pour ce spot">
        <ul style={{margin:0,paddingLeft:18,fontSize:13,color:C.muted,lineHeight:1.7,listStyle:"disc"}}>
          {spot.sources.map((s, i) => <li key={i}>{linkify(s)}</li>)}
        </ul>
      </Disclosure>
    </Stack>
  );
}

function LeurresSpot({ g, spot }) {
  const w = (spot.windows || []).find((x) => x.id === spot.bestWindowId) || spot.windows?.[0];
  const a = lureAdvice(spot, w, g.live, g.selectedDate);
  return (
    <Stack gap={10}>
      <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${C.accent}55`,borderRadius:12}}>
        <div style={{fontSize:13,color:C.accent,fontWeight:600}}>Pour le meilleur créneau{w ? ` (${w.startFmt} → ${w.endFmt})` : ""}</div>
        <div style={{fontSize:18,fontWeight:800,color:C.strong,marginTop:2}}>{a.best.label}</div>
        <div style={{fontSize:14.5,marginTop:6,lineHeight:1.55}}>
          <div><span style={{color:C.muted}}>Couleur · </span>{a.color.label}</div>
          <div><span style={{color:C.muted}}>Taille · </span>{a.size.text}</div>
          <div><span style={{color:C.muted}}>Montage · </span>{a.weight.text}</div>
        </div>
        <GoLink onClick={() => { g.setSpotId(spot.id); g.goTab("leurres"); }}>Conseil détaillé et sources</GoLink>
      </div>
      <div style={{fontSize:15,fontWeight:700,color:C.strong,margin:"4px 2px 0"}}>Leurres de la fiche, classés pour aujourd'hui</div>
      {a.spotLures.map((l, i) => (
        <div key={i} style={{padding:"11px 13px",background:C.card2,border:`1px solid ${i === 0 && l.fit > 0 ? C.good + "66" : C.line}`,borderRadius:12}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <b style={{fontSize:15,color:C.strong}}>{l.name}</b>
            {i === 0 && l.fit > 0 && <Pill color={C.good}>Le plus adapté aujourd'hui</Pill>}
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",margin:"6px 0"}}>
            <Pill color={C.accent}>{FAMILLES[l.fam].court}</Pill><Pill color={C.muted}>{l.color}</Pill><Pill color={C.muted}>{l.weight}</Pill>
          </div>
          <p style={{margin:0,fontSize:14,color:C.muted,lineHeight:1.5}}>{l.technique}</p>
        </div>
      ))}
    </Stack>
  );
}

function Acces({ g, spot }) {
  const best = (spot.windows || []).find((w) => w.id === spot.bestWindowId);
  const rules = securityFor(spot, { coeff: g.coeff, window: best });
  const dg = DANGER[spot.dangerLevel];
  return (
    <Stack gap={10}>
      <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${C.line}`,borderRadius:12}}>
        <div style={{fontSize:15,fontWeight:700,color:C.strong,marginBottom:5}}>Accès</div>
        <p style={{margin:0,fontSize:14.5,color:C.text,lineHeight:1.6}}>{spot.access}</p>
      </div>
      {rules.length > 0 && (
        <div style={{padding:"12px 13px",background:C.card2,border:`1px solid ${rules.some((r) => r.active) ? C.bad + "88" : C.line}`,borderRadius:12}}>
          <div style={{fontSize:15,fontWeight:700,color:C.strong,marginBottom:6}}>Sécurité sur ce spot</div>
          {rules.map((r, i) => (
            <div key={i} style={{fontSize:14,lineHeight:1.55,marginBottom:7,color:r.active ? "#fecaca" : C.text}}>
              {r.active ? <b>⚠ Aujourd'hui : </b> : r.conditional ? <span style={{color:C.muted}}>Si {r.when.coefAbove != null ? `coef > ${r.when.coefAbove}` : `marée ${r.when.phase}e`} : </span> : "• "}
              {r.t} <span style={{fontSize:12,color:C.faint,fontStyle:"italic"}}>— {r.s}</span>
            </div>
          ))}
        </div>
      )}
      {spot.dangerLevel === 3 && <Alert tone={C.bad}><b>Spot engagé — prudence générale.</b> Ne pas pêcher seul. Gilet, téléphone étanche, itinéraire et heure de retour laissés à un proche. Respecter strictement les créneaux de marée.</Alert>}
      {spot.dangerLevel === 2 && <Alert><b>Spot technique.</b> Une sortie de repérage par conditions calmes avant une pêche en vive-eau ou au crépuscule.</Alert>}
      {dg && <Muted>Difficulté : {dg[0]}.</Muted>}
    </Stack>
  );
}

export function SpotDetail({ g, spot, detailRef }) {
  const [sub, setSub] = useState("creneaux");
  const dg = DANGER[spot.dangerLevel];
  const today = g.selectedDate === g.todayISO;
  const here = g.session?.spotId === spot.id;
  return (
    <div ref={detailRef} style={{scrollMarginTop:"calc(60px + env(safe-area-inset-top))",background:C.card,border:`1px solid ${spot.color}55`,borderRadius:16,overflow:"hidden"}}>
      <div style={{padding:"15px 15px 12px",background:`linear-gradient(160deg,${spot.color}18 0%,transparent 60%)`}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
          <ScoreArc score={spot.eligible ? spot.score : null} color={spot.color}/>
          <div style={{flex:1,minWidth:0}}>
            <h2 style={{margin:0,fontSize:21,fontWeight:800,color:C.strong,lineHeight:1.15}}>{spot.name}</h2>
            <div style={{fontSize:13.5,color:C.muted,marginTop:3}}>{spot.subtitle} · {spot.distance} de {SITE.name}</div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap",marginTop:7}}>
              <Pill color={spot.color}>{spot.type}</Pill>
              {dg && <Pill color={dg[1]}>{dg[0]}</Pill>}
              {spot.isLocal && <Pill color={C.good}>Local</Pill>}
              {spot.orientSource && <Pill color={C.violet} title="Orientation confirmée ou corrigée sur place">Orientation {spot.orientSource === "confirmé" ? "confirmée" : "corrigée"}</Pill>}
            </div>
          </div>
        </div>
        {!spot.eligible && spot.wxReason && <div style={{marginTop:9}}><Alert tone={C.bad}>{spot.wxReason}</Alert></div>}
        {spot.eligible && spot.wxReason && <Muted style={{color:C.text}}>{spot.wxReason}</Muted>}
        {spot.zw?.fromSpot && (
          <div style={{fontSize:14,color:"#7dd3fc",marginTop:8}}>Ici (6 h-22 h) : 🌬 {spot.zw.wind_dir} {spot.zw.wind_kmh} km/h{spot.zw.gust_kmh != null ? ` · raf. ${spot.zw.gust_kmh}` : ""} · 🌊 {spot.zw.houleKnown ? `${fr(spot.zw.houle)} m` : "houle inconnue"}</div>
        )}
        <Muted><b style={{color:C.text}}>Exposition :</b> {spot.weatherNote}</Muted>
        {today && (
          <button onClick={() => g.startSession(spot.id)} disabled={here} style={{marginTop:11,width:"100%",padding:"11px",borderRadius:10,border:`1px solid ${C.violet}`,background:here ? `${C.violet}10` : `${C.violet}26`,color:here ? C.violet : "#ede9fe",fontSize:15,fontWeight:700,cursor:here ? "default" : "pointer"}}>
            {here ? "🎣 Session en cours ici" : "🎣 Je pêche ici maintenant"}
          </button>
        )}
      </div>
      <div style={{padding:"0 12px 12px"}}>
        <SubTabs tabs={[["creneaux", "Créneaux"], ["terrain", "Terrain"], ["leurres", "Leurres"], ["acces", "Accès"]]} value={sub} onChange={setSub}/>
        <div style={{marginTop:12}}>
          {sub === "creneaux" && <Creneaux g={g} spot={spot}/>}
          {sub === "terrain" && <Terrain g={g} spot={spot}/>}
          {sub === "leurres" && <LeurresSpot g={g} spot={spot}/>}
          {sub === "acces" && <Acces g={g} spot={spot}/>}
        </div>
      </div>
    </div>
  );
}
