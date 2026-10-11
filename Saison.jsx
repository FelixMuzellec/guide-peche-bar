// Saison : présence du bar sur la côte (saison et température de l'eau),
// lumière du jour et proies du mois.
import { fmtH } from "../../engine/core.js";
import { SEASON, preyForMonth, regimeOf, seasonPresence } from "../../engine/model.js";
import { Pill } from "../components.jsx";
import { C, Card, GoLink, Muted, Row, Src, Stack, fr, num } from "../kit.jsx";

const IFREMER = { label: "Ifremer — synthèse des marquages de bars adultes (Bargip)", url: "https://bar.ifremer.fr/content/download/116111/file/4PagesMarquageAdultes_Final-3.pdf" };
const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const REGIME = { roche: "côte rocheuse", plage: "plage battue", abri: "rade, ria ou havre" };
const facCol = (f) => (f >= 0.95 ? C.good : f >= 0.75 ? C.warn : C.bad);

export function Saison({ g }) {
  const month = +g.selectedDate.slice(5, 7);
  const spot = g.activeSpot;
  const regime = spot ? regimeOf(spot) : "roche";
  const season = seasonPresence(month, regime);
  const water = g.presenceInfo;
  const applied = Math.min(season.factor, water.factor);
  const regimes = [...new Set(g.allScored.map((s) => regimeOf(s)))];
  const lows = g.allScored.flatMap((s) => (s.windows || []).filter((w) => w.eligible && !w.outOfHours && ["aube", "crepuscule", "nuit"].includes(w.light?.band)));
  const prey = preyForMonth(month);
  return (
    <Stack>
      <Card title={`Saison : ${season.label}`} kicker={`${MOIS[month - 1]} · ${spot ? spot.name + " · " : ""}${REGIME[regime]}`}>
        <Row label="Facteur de saison">× {fr(season.factor, 2)}</Row>
        <Row label="Facteur de l'eau">× {fr(water.factor, 2)} · {water.label}</Row>
        <Row label="Appliqué à la note" color={facCol(applied)}>× {fr(applied, 2)} ({season.factor < water.factor ? "la saison est le plus restrictif" : water.factor < 1 ? "l'eau est le plus restrictif" : "pleine présence"})</Row>
        <Muted>Les adultes se reproduisent en hiver sur des frayères généralement situées au large, s'alimentent sur la côte de mai à novembre et reviennent fidèlement sur leurs sites d'été ; « certains sont résidents », sans que la source dise où. La note est multipliée par un facteur de présence (on ne prend pas un poisson absent). Ses valeurs exactes sont des hypothèses ; l'hiver, la rade, les rias et les havres reçoivent un facteur un peu plus clément, hypothèse du guide (pas de la source).</Muted>
        <div style={{marginTop:6}}><Src src={IFREMER} prefix="Source : "/></div>
      </Card>

      <Card title="L'année du bar" kicker="Facteur de présence, mois par mois">
        {regimes.map((r) => (
          <div key={r} style={{marginTop:8}}>
            <div style={{fontSize:13.5,color:C.muted,marginBottom:4}}>{REGIME[r]}</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:3}}>
              {SEASON[r].map((f, i) => (
                <div key={i} title={`${MOIS[i]} : ${SEASON.label[i]} × ${f}`} style={{textAlign:"center"}}>
                  <div style={{height:28,borderRadius:5,background:facCol(f),opacity:0.25 + 0.75 * f,outline:i === month - 1 ? `2px solid ${C.strong}` : "none"}}/>
                  <div style={{fontSize:12,letterSpacing:"-0.02em",color:i === month - 1 ? C.strong : C.faint,marginTop:2}}>{MOIS[i].slice(0, 3)}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <Muted>Vert : présence côtière ; orange : retour ou départ ; rouge : frai au large.</Muted>
      </Card>

      <Card title={`Eau : ${g.sst != null ? `${fr(g.sst)} °C` : "température inconnue"}`} kicker={g.live?.sst_confidence === "modele" ? "Modèle océanique Open-Meteo Marine" : "Non mesurée"}>
        <p style={{margin:0,fontSize:14.5,color:C.text,lineHeight:1.55}}>{water.detail}</p>
      </Card>

      <Card title="Lumière" kicker="Éphéméride calculée, heure de Paris">
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[["Aube", g.sun.dawn, "#a8a29e"], ["Lever", g.sun.sunrise, C.warn], ["Coucher", g.sun.sunset, C.warn], ["Nuit", g.sun.dusk, "#818cf8"]].map(([k, v, col]) => (
            <div key={k} style={{textAlign:"center",padding:"9px 4px",borderRadius:12,background:C.card2,border:`1px solid ${C.line}`}}>
              <div style={{fontSize:12.5,color:C.muted}}>{k}</div>
              <div style={{fontSize:18,fontWeight:800,color:col,...num}}>{fmtH(v)}</div>
            </div>
          ))}
        </div>
        <Muted>{lows.length ? `${lows.length} créneau${lows.length > 1 ? "x" : ""} praticable${lows.length > 1 ? "s" : ""} tombe${lows.length > 1 ? "nt" : ""} en basse lumière aujourd'hui (aube, crépuscule ou nuit).` : "Aucun créneau praticable ne tombe en basse lumière aujourd'hui : jouer la marée seule."}</Muted>
        <Muted>Basse lumière retenue : de l'aube civile à 45 min après le lever, et de 45 min avant le coucher à la nuit civile. Le bar y perd sa méfiance et chasse près du bord.</Muted>
      </Card>

      <Card title="Proies du mois" kicker="Elles commandent le profil et la taille du leurre">
        {prey.map((p, i) => (
          <div key={p.name} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
            <div style={{display:"flex",gap:6,alignItems:"baseline",flexWrap:"wrap"}}>
              <b style={{fontSize:15,color:C.strong}}>{p.name}</b>
              <span style={{fontSize:13,color:C.muted}}>{p.size !== "—" ? p.size + " · " : ""}{p.couche}</span>
              {i === 0 && <Pill color={C.good}>Dominante</Pill>}
            </div>
            <div style={{fontSize:14,color:C.muted,marginTop:3,lineHeight:1.5}}>{p.guidance}</div>
          </div>
        ))}
        <GoLink onClick={() => g.goTab("leurres")}>Leurres adaptés à ces proies</GoLink>
      </Card>
    </Stack>
  );
}
