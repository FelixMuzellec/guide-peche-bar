// Leurres : le conseil complet pour un spot et un créneau (type, couleur,
// taille, montage, animation), ta boîte, la fiche du spot, les proies du mois
// et les repères qui fondent chaque conseil, avec leurs sources.
import { useMemo, useState } from "react";
import { SITE } from "SITE_CONFIG";
import { BOITE, FAMILLES, LURE_SOURCES, lureAdvice } from "../../engine/lures.js";
import { adviceForSpot, preyForMonth } from "../../engine/model.js";
import { Pill } from "../components.jsx";
import { C, Card, Chip, Disclosure, Muted, Src, Stack, Why, fr, num } from "../kit.jsx";

const S = LURE_SOURCES;
const LIGHT = { nuit: "nuit", basse: "basse lumière", couvert: "ciel couvert", soleil: "plein soleil", jour: "jour" };

function Ref({ rows }) {
  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      {rows.map(([k, v, s], i) => (
        <div key={i} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
          <div style={{fontSize:14,fontWeight:700,color:C.strong}}>{k}</div>
          <div style={{fontSize:14,color:C.text,lineHeight:1.5,marginTop:2}}>{v}</div>
          {s && <Src src={S[s]} short/>}
        </div>
      ))}
    </div>
  );
}

export function Leurres({ g }) {
  const spot = g.activeSpot;
  const wins = (spot?.windows || []).filter((w) => Math.abs(w.offsetBefore) < 50 && Number.isFinite(w.startDecimal));
  // Créneau demandé depuis la synthèse (« meilleur créneau de plein jour »), sinon le meilleur du spot.
  const [winId, setWinId] = useState(() => (g.lureWin && g.lureWin.spotId === spot?.id ? g.lureWin.winId : null));
  const w = wins.find((x) => x.id === winId) || wins.find((x) => x.id === spot?.bestWindowId) || wins[0];
  const a = useMemo(() => (spot ? lureAdvice(spot, w, g.live, g.selectedDate) : null), [spot, w, g.live, g.selectedDate]);
  if (!spot || !a) return <Muted>Aucun spot à conseiller.</Muted>;
  const sit = a.sit;
  const second = a.fams[1];
  const month = sit.month;
  const prey = preyForMonth(month);
  const sel = { background:C.card2, color:C.text, border:`1px solid ${C.line}`, borderRadius:8, padding:"8px 10px", fontSize:15, width:"100%" };

  return (
    <Stack>
      <Card title="Pour quel spot, quel créneau ?">
        <select aria-label="Spot" value={spot.id} onChange={(e) => { g.setSpotId(e.target.value); setWinId(null); }} style={sel}>
          {g.allScored.map((s) => <option key={s.id} value={s.id}>{s.name}{s.eligible ? ` · ${fr(s.score)}` : ""}</option>)}
        </select>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:10}}>
          {wins.map((x) => (
            <Chip key={x.id} color={x.id === spot.bestWindowId ? C.good : C.accent} active={x.id === w?.id} onClick={() => setWinId(x.id)}>
              {x.startFmt}–{x.endFmt}{x.light && x.light.band !== "inconnu" ? ` · ${x.light.label.toLowerCase()}` : ""}
            </Chip>
          ))}
        </div>
        {!g.live && <Muted>Sans météo : le conseil s'appuie sur la lumière, le fond et la saison seulement.</Muted>}
      </Card>

      <Card kicker="La situation" title={`${spot.name}${w ? ` · ${w.startFmt} → ${w.endFmt}` : ""}`}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
          <Chip color={C.warn}>☀ {LIGHT[sit.light]}</Chip>
          {sit.sea && <Chip color={C.accent}>🌊 {sit.seaLabel} ({sit.seaWhy})</Chip>}
          <Chip color={C.accent}>💧 eau {sit.clarity} (estimée)</Chip>
          {sit.strongCurrent && <Chip color={C.bad} title={sit.currentWhy?.t}>↯ courant fort</Chip>}
          <Chip color={sit.terr.gratter === "non" ? C.bad : sit.terr.gratter === "texan" ? C.warn : C.good}>🪨 {sit.terr.gratter === "non" ? "pas de grattage" : sit.terr.gratter === "texan" ? "texan sur fond mixte" : "fond dégagé"}</Chip>
          {sit.prey[0] && <Chip color={C.good}>🐟 {sit.prey[0].name.toLowerCase()}{sit.prey[0].size !== "—" ? ` ${sit.prey[0].size}` : ""}</Chip>}
          {sit.sst != null && <Chip color={C.muted}>🌡 eau {fr(sit.sst)} °C{sit.cold ? " · froide" : ""}</Chip>}
        </div>
        <Why items={[...sit.clarityWhy, ...(sit.currentWhy ? [sit.currentWhy] : [])]} sources={S} compact/>
      </Card>

      <Card tone={C.good} kicker="Conseil" title={a.best.label}>
        <Why items={a.best.why} sources={S}/>
        {second && second.score > 0 && (
          <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${C.line}`}}>
            <div style={{fontSize:12.5,fontWeight:600,color:C.muted}}>{second.score === a.best.score ? "À égalité (la fiche du spot a départagé)" : "Second choix"}</div>
            <div style={{fontSize:15,fontWeight:700,color:C.strong}}>{second.label}</div>
            <Why items={second.why.filter((x) => x.v > 0)} sources={S} compact/>
          </div>
        )}
        <Muted>Le classement des familles croise ces règles ; il est déduit, les règles sont sourcées.</Muted>
      </Card>

      <Card kicker="Couleur" title={a.color.label}>
        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{a.color.palette.map((p) => <Chip key={p} color={C.accent}>{p}</Chip>)}</div>
        <Why items={a.color.why} sources={S}/>
      </Card>

      <Card kicker="Taille, montage, animation">
        <div style={{fontSize:12.5,fontWeight:600,color:C.muted}}>Taille</div>
        <p style={{margin:"1px 0 0",fontSize:15,color:C.strong,lineHeight:1.45}}>{a.size.text}</p>
        <Why items={a.size.why} sources={S} compact/>
        <div style={{fontSize:12.5,fontWeight:600,color:C.muted,marginTop:12}}>Montage</div>
        <p style={{margin:"1px 0 0",fontSize:15,color:C.strong,lineHeight:1.45}}>{a.weight.text}</p>
        <Why items={a.weight.why.filter((x) => x.t !== a.weight.text)} sources={S} compact/>
        <div style={{fontSize:12.5,fontWeight:600,color:C.muted,marginTop:12}}>Animation</div>
        <Why items={a.anim} sources={S} compact/>
      </Card>

      <Card title="Dans ta boîte" kicker="Ce qui colle à ce créneau">
        {a.box.length ? a.box.map((b, i) => (
          <div key={i} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
            <b style={{fontSize:15,color:C.strong}}>{b.model} · {b.color}</b>
            {b.fam !== a.best.k && <div style={{fontSize:13.5,color:C.warn,marginTop:2}}>{FAMILLES[b.fam].court} : le second choix pour ce créneau</div>}
            {b.note && <div style={{fontSize:13.5,color:C.muted,marginTop:2}}>{b.note}</div>}
          </div>
        )) : a.boxNear ? (
          <div>
            <Muted style={{marginTop:0}}>Rien dans ta boîte ne colle exactement. Le plus proche :</Muted>
            <div style={{padding:"6px 0 0"}}>
              <b style={{fontSize:15,color:C.strong}}>{a.boxNear.model}{a.boxNear.color && a.boxNear.color !== "—" ? ` · ${a.boxNear.color}` : ""}</b>
              <div style={{fontSize:13.5,color:C.muted,marginTop:2}}>{a.boxNear.diff}{a.boxNear.note ? ` · ${a.boxNear.note}` : ""}</div>
            </div>
          </div>
        ) : <Muted style={{marginTop:0}}>Rien dans ta boîte ne correspond aux familles conseillées pour ce créneau : voir les modèles cités ci-dessous.</Muted>}
        <div style={{marginTop:10}}>
          <Disclosure title="Toute ta boîte" sub={`${BOITE.length} leurres déclarés le 10/10/2026`}>
            {BOITE.map((b, i) => (
              <div key={i} style={{fontSize:14,padding:"6px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
                <b style={{color:C.strong}}>{b.model}</b> · {b.color} <span style={{color:C.muted}}>({FAMILLES[b.fam].court.toLowerCase()})</span>
                {b.note && <div style={{fontSize:13,color:C.muted}}>{b.note}</div>}
              </div>
            ))}
            <Muted>Pour la tenir à jour, elle se modifie dans src/engine/lures.js.</Muted>
          </Disclosure>
        </div>
      </Card>

      {a.models.length > 0 && (
        <Disclosure title="Modèles cités par les sources" sub={`${a.models.length} référence${a.models.length > 1 ? "s" : ""} pour cette situation`}>
          <Why items={a.models} sources={S}/>
        </Disclosure>
      )}

      <Disclosure title="Leurres de la fiche du spot" sub={`${a.spotLures.length} leurres, classés pour ce créneau`}>
        {a.spotLures.map((l, i) => (
          <div key={i} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:8,flexWrap:"wrap"}}>
              <b style={{fontSize:15,color:C.strong}}>{l.name}</b>
              {i === 0 && l.fit > 0 && <Pill color={C.good}>Le plus adapté</Pill>}
            </div>
            <div style={{fontSize:13.5,color:C.muted,marginTop:2}}>{FAMILLES[l.fam].court} · {l.color} · {l.weight}</div>
            <div style={{fontSize:14,color:C.text,marginTop:3,lineHeight:1.5}}>{l.technique}</div>
          </div>
        ))}
      </Disclosure>

      <Disclosure title="Ce que mange le bar ce mois-ci" sub={`Proies du mois, adaptées au fond de ce spot${prey[0] ? ` · surtout ${prey[0].name.toLowerCase()}` : ""}`}>
        {prey.map((p, i) => { const ad = adviceForSpot(spot, p); return (
          <div key={p.name} style={{padding:"9px 0",borderTop:i ? `1px solid ${C.line2}` : "none"}}>
            <div style={{display:"flex",gap:6,alignItems:"baseline",flexWrap:"wrap"}}>
              <b style={{fontSize:15,color:C.strong}}>{p.name}</b>
              <span style={{fontSize:13,color:C.muted}}>{p.size !== "—" ? p.size + " · " : ""}{p.couche}</span>
              {i === 0 && <Pill color={C.good}>Dominante</Pill>}
            </div>
            {ad.adapted && <div style={{fontSize:14,color:ad.replaces ? "#fca5a5" : "#fcd34d",marginTop:3,lineHeight:1.5}}>{ad.note}</div>}
            <div style={{fontSize:14,color:C.muted,marginTop:3,lineHeight:1.5}}>{ad.replaces ? "Ailleurs : " : ""}{ad.text}</div>
          </div>
        ); })}
      </Disclosure>

      <Disclosure title="Créneau par créneau" sub="Le conseil résumé pour chaque créneau du jour">
        {wins.map((x, i) => {
          const ax = lureAdvice(spot, x, g.live, g.selectedDate);
          return (
            <button key={x.id} onClick={() => { setWinId(x.id); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* sans effet */ } }}
              style={{display:"flex",width:"100%",justifyContent:"space-between",gap:10,padding:"10px 0",border:"none",borderTop:i ? `1px solid ${C.line2}` : "none",background:"none",color:C.text,cursor:"pointer",textAlign:"left"}}>
              <span style={{...num,fontWeight:700,color:C.strong,flexShrink:0}}>{x.startFmt}–{x.endFmt}</span>
              <span style={{fontSize:14,textAlign:"right"}}>{ax.summary}<br/><span style={{fontSize:12.5,color:C.muted}}>{x.light?.label?.toLowerCase()}{x.eligible ? ` · note ${fr(x.score)}` : " · non praticable"}</span></span>
            </button>
          );
        })}
      </Disclosure>

      <Disclosure title="Repères : les couleurs" sub="Selon l'eau, la lumière et la proie">
        <Ref rows={[
          ["Eau claire, plein soleil", "Naturel, translucide ou légèrement pailleté. Bleu sardine, blanc, gris, vert ayu.", "couleurMeteo"],
          ["Eau teintée ou ciel couvert", "Plus visible.", "couleurMeteo"],
          ["Eau très trouble ou faible lumière", "Plus contrasté, plus flashy : blanc, chartreuse, jaune, orange, rose.", "couleurMeteo"],
          ["Aube et crépuscule", "Contrastés ou chauds. Le blanc reste efficace en eau claire par faible luminosité.", "coloris"],
          ["Nuit", "Le blanc se distingue largement.", "nuit"],
          ["Eau chargée et agitée", "Rose.", "coloris"],
          ["Règle simple", "« Temps clair, leurre clair ; temps sombre, leurre sombre. »", "couleurDebut"],
          ["Proie : lançon", "Vert ou kaki (Crazy Sand Eel, Crazy Paddle Tail) ; un blanc peut aussi l'imiter.", "coloris"],
          ["Proie : sprat, sardine, maquereau", "Vert ; Blue Herring par temps ensoleillé sur les sprats ; argenté ou bleuté sur les petits poissons.", "coloris"],
          ["Proie : crustacés, début de saison", "Marron.", "coloris"],
          ["Tes notes Asturie", "Ghost Iwashi : plein soleil et eau claire seulement. Cabot : changements de lumière. Ghost Lançon : le plus polyvalent.", "felix"],
        ]}/>
      </Disclosure>

      <Disclosure title="Repères : quelle famille, quand" sub="Mer, courant, profondeur, lumière">
        <Ref rows={[
          ["Surface : stickbait, popper", "Mer calme, belle à peu agitée ; idéal à l'aube et au crépuscule. Plateaux rocheux de 2 à 8 m, et même très peu d'eau. Walking the dog : environ deux coups de scion par seconde ; long-slide pour les gros poissons.", "stickbait"],
          ["Coulants : jerkbait, casting jig", "Zones profondes et courants forts. Jerkbait : coups de scion secs.", "merConseils"],
          ["Métal : cuiller, jig", "Parfaits pour la pêche dans les vagues. Laisser couler, puis récupérer vite.", "merConseils"],
          ["Shad à palette dans les vagues", "Vent du large établi, autour de la mi-marée : Black Minnow 120 ou 140 sur tête de 18 à 25 g, linéaire canne basse. Pêcher plus loin du bord, garder un œil sur la vague plus grosse que les autres.", "vagues"],
          ["Petits souples de nuit", "85 à 100 mm sur têtes de 5 à 10 g, zones peu profondes, récupération saccadée.", "nuit"],
          ["Ouverture, eau froide", "Shad à palette de 9 à 12 cm ou finesse de 10 à 14 cm, animations lentes ; tête légère en eau peu profonde, plus lourde dans le courant.", "ouverture"],
          ["Eaux claires de la rade", "Matériel léger, leurres petits et discrets, approche silencieuse ; souple non lesté entre les goémons.", "rade"],
        ]}/>
      </Disclosure>

      <Disclosure title="Repères : saison par saison">
        <Ref rows={[
          ["Hiver", "Les bars se regroupent au large pour le frai et quittent presque la côte ; l'auteur conseille de les laisser tranquilles jusqu'à début avril.", "saisons"],
          ["Hiver, les résidents", `Tous les bars ne migrent pas : « certains sont résidents » (sans proportion ni lieu précisés).${SITE.id === "logonna-daoulas" ? " Tu as d'ailleurs pris 2 bars à Moulin Mer le 27/12/2025." : ""}`, "ifremer"],
          ["Printemps", "Retour dès fin mars, d'abord au petit large en eau assez profonde, puis parcs conchylicoles et bancs de sable à lançon. Proies : éperlans et lançons, puis crabes et crevettes. Petits leurres, animations lentes.", "saisons"],
          ["Été", "Bars à la côte ; chaleur, soleil et journées sans vent freinent l'activité de jour. Les coups du matin et du soir sont les meilleurs, surtout en bon coefficient ; la nuit est une bonne option.", "saisons"],
          ["Automne", "Réserves avant l'hiver : les premiers froids déclenchent souvent un pic d'activité. Estuaires, parcs, roches bordées de sable. Proies : crabes, petits maquereaux, merlans. Prospecter vite : une dizaine de lancers sans touche, on change de poste.", "automne"],
        ]}/>
      </Disclosure>

      <Card title="Sources des conseils leurres">
        <ul style={{margin:0,padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:6}}>
          {Object.values(S).filter((s) => s.url).map((s) => <li key={s.url}><Src src={s}/></li>)}
          <li style={{fontSize:12.5,color:C.faint}}>« Tes notes » : ce que tu as dit de tes leurres et de tes sessions. « Fiche du spot » : la fiche terrain et ses propres sources. « Déduit » : un seuil ou un raisonnement du guide.</li>
        </ul>
      </Card>
    </Stack>
  );
}

