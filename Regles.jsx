// Règles : réglementation, remise à l'eau, sécurité spot par spot, principes
// de pêche du secteur, niveaux de confiance et sources des données.
import { GENERAL_PRINCIPLES, SPOTS } from "SITE_CONFIG";
import { REGLEMENTATION, REMISE_A_L_EAU, securityFor } from "../../engine/rules.js";
import { ConfidenceBadge } from "../components.jsx";
import { Alert, C, Card, Disclosure, Muted, Src, Stack } from "../kit.jsx";

const li = { fontSize:14.5, color:C.text, lineHeight:1.55, marginBottom:7 };

export function Regles({ g }) {
  const R = REGLEMENTATION;
  const reg = g.reg;
  return (
    <Stack>
      <Card tone={reg.noKill ? C.warn : C.accent} kicker={`Réglementation ${R.annee} · pêche de loisir`} title={reg.headline}>
        {reg.stale && <div style={{marginBottom:10}}><Alert>Règles vérifiées pour {R.annee} : la date choisie est en {reg.year}. Elles changent chaque année : à revérifier.</Alert></div>}
        <div style={{fontSize:13.5,color:C.muted,marginBottom:8}}>{R.zone} · vérifié le {R.verifieLe}</div>
        <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>
          {R.regles.map((r, i) => <li key={i} style={li}>{r.t} <Src src={r.s} prefix="— "/></li>)}
        </ul>
        <div style={{display:"flex",flexDirection:"column",gap:4,marginTop:6}}>{R.sources.map((s) => <Src key={s.url} src={s}/>)}</div>
        <Muted>Cette fiche résume ; elle ne remplace ni les textes officiels ni les arrêtés locaux (zones interdites, réserves).</Muted>
      </Card>

      <Card title="Bien relâcher un bar">
        <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>{REMISE_A_L_EAU.gestes.map((x, i) => <li key={i} style={li}>{x}</li>)}</ul>
        <Src src={REMISE_A_L_EAU.source} prefix="Source : "/>
      </Card>

      <Card title="Sécurité, spot par spot" kicker="Consignes sourcées ; en rouge, celles qui s'appliquent ce jour-là">
        {SPOTS.filter((s) => (s.securite || []).length).map((s0, i) => {
          const s = g.allScored.find((x) => x.id === s0.id) || s0;
          const best = (s.windows || []).find((w) => w.id === s.bestWindowId);
          const rules = securityFor(s, { coeff: g.coeff, window: best });
          return (
            <div key={s.id} style={{padding:"10px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
              <button onClick={() => g.goToSpot(s.id)} style={{minHeight:40,background:"none",border:"none",padding:0,color:C.strong,fontSize:15,fontWeight:700,cursor:"pointer",textAlign:"left"}}>{s.name} ›</button>
              {rules.map((r, j) => (
                <div key={j} style={{fontSize:14,lineHeight:1.5,marginTop:4,color:r.active ? "#fecaca" : C.text}}>
                  {r.active ? "⚠ " : r.conditional ? `Si ${r.when.coefAbove != null ? `coef > ${r.when.coefAbove}` : `marée ${r.when.phase}e`} : ` : "• "}{r.t} <span style={{fontSize:12,color:C.faint,fontStyle:"italic"}}>— {r.s}</span>
                </div>
              ))}
            </div>
          );
        })}
        <Muted>Spots techniques ou engagés : ne pas pêcher seul, gilet, téléphone étanche, itinéraire et heure de retour laissés à un proche (prudence générale).</Muted>
      </Card>

      <Disclosure title={GENERAL_PRINCIPLES.title} sub="Les règles de pêche du secteur, avec leurs sources">
        {GENERAL_PRINCIPLES.items.map((it, i) => (
          <div key={i} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
            <div style={{fontSize:14.5,fontWeight:700,color:C.strong}}>{it.rule}</div>
            <div style={{fontSize:14,color:C.text,lineHeight:1.55,marginTop:3}}>{it.explain}</div>
            <Src src={it.source}/>
          </div>
        ))}
      </Disclosure>

      <Disclosure title="Niveaux de confiance" sub="Ce que signifient les étiquettes des fiches">
        <div style={{display:"flex",flexDirection:"column",gap:8,fontSize:14}}>
          <div><ConfidenceBadge level="verified"/> Tiré d'une source citée (peche.com, peche-poissons.com, Ifremer, offices de tourisme…).</div>
          <div><ConfidenceBadge level="local_knowledge"/> Savoir terrain, à valider par repérage sur place.</div>
          <div><ConfidenceBadge level="inference"/> Déduit des principes généraux : peut varier selon le poste précis.</div>
        </div>
      </Disclosure>

      <Disclosure title="Données et licences">
        <ul style={{margin:0,paddingLeft:18,listStyle:"disc"}}>
          <li style={li}>Météo : Open-Meteo.com (CC BY 4.0), modèles AROME (Météo-France) et ECMWF.</li>
          <li style={li}>Marée : constantes harmoniques TICON-4 (CC BY 4.0), calcul porté de Neaps (MIT).</li>
          <li style={li}>Carte : Leaflet (BSD-2-Clause), fond © contributeurs OpenStreetMap (ODbL).</li>
          <li style={li}>Le guide ne remplace pas le repérage sur place.</li>
        </ul>
      </Disclosure>
    </Stack>
  );
}
