// Synthèse : la réponse (où, quand, avec quoi), puis les conditions du jour en
// six tuiles. Chaque tuile ouvre l'onglet qui détaille ce paramètre.
import { SITE } from "SITE_CONFIG";
import { fmtH } from "../../engine/core.js";
import { FAMILLES, LURE_SOURCES } from "../../engine/lures.js";
import { TIE_DELTA, tieGroup } from "../../engine/model.js";
import { Loader, ModelSpread, Pill } from "../components.jsx";
import { Alert, C, Card, Chip, GoLink, Grid, Muted, Stack, Tile, fr, num, scoreColor } from "../kit.jsx";

export { TIE_DELTA };
const stab = { stable: [C.good, "Stable"], sensible: [C.warn, "Sensible"], volatile: [C.bad, "Volatile"] };
const TREND = { falling_fast: "chute rapide", falling: "en baisse", stable: "stable", rising: "en hausse", rising_fast: "hausse rapide" };

function VerdictCard({ g }) {
  const { s, w } = g.verdict;
  // Égalité : tous les spots à 0,2 point ou moins du premier, et le plus proche d'entre eux.
  const tied = tieGroup(g.allScored);
  const nearest = tied.length ? [...tied].sort((a, b) => (a.distMin ?? 999) - (b.distMin ?? 999))[0] : null;
  const st = stab[s.stability];
  const active = g.verdictAlerts.filter((a) => a.active);
  const col = scoreColor(s.score);
  return (
    <Card tone={col} kicker="Meilleur choix" right={<span style={{display:"flex",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}>
      {s.dangerLevel >= 2 && <Pill color={s.dangerLevel === 3 ? C.bad : C.warn} title="Difficulté du spot">{s.dangerLevel === 3 ? "Technique" : "Modéré"}</Pill>}
      {st && <Pill color={st[0]} title="Robustesse du classement face à l'incertitude du vent">{st[1]}</Pill>}</span>}>
      <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:24,fontWeight:800,color:C.strong,lineHeight:1.15}}>{s.name}</div>
          {w && <div style={{fontSize:19,fontWeight:800,color:C.strong,marginTop:5,...num}}>{w.startFmt} → {w.endFmt}</div>}
          {w && <div style={{fontSize:14,color:C.text,marginTop:2}}>{w.label}{w.light && w.light.band !== "inconnu" ? ` · ${w.light.label.toLowerCase()}` : ""}</div>}
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{fontSize:36,fontWeight:800,color:col,lineHeight:1,...num}}>{fr(s.score)}</div>
          <div style={{fontSize:13,color:C.muted}}>sur 10</div>
        </div>
      </div>
      {w?.zw?.fromSpot && (
        <div style={{fontSize:14,color:"#7dd3fc",marginTop:9,...num}}>
          🌬 {w.zw.wind_dir} {w.zw.wind_kmh} km/h{w.zw.gust_kmh != null ? ` · raf. ${w.zw.gust_kmh}` : ""} · 🌊 {w.zw.houleKnown ? `${fr(w.zw.houle)} m` : "?"}{w.coeff != null ? ` · coef ${w.coeff}` : ""}
        </div>
      )}
      {w?.zw && <ModelSpread zw={w.zw}/>}
      {s.wxReason && <Muted style={{color:C.text}}>{s.wxReason}</Muted>}
      {tied.length > 1 && (
        <Muted><b style={{color:C.strong}}>≈ Égalité</b> (écart sous la précision du modèle, {fr(TIE_DELTA)} point) : {tied.map((x) => `${x.name} ${fr(x.score)}`).join(" · ")}.
          {nearest && nearest.id !== s.id ? <> Le plus proche, <b style={{color:C.strong}}>{nearest.name}</b> ({nearest.distance}), vaut autant avec moins de route.</> : <> C'est aussi le plus proche.</>}</Muted>
      )}
      {active.map((a, i) => <div key={i} style={{marginTop:9}}><Alert tone={C.bad} role="alert">⚠ <b>Aujourd'hui :</b> {a.t}</Alert></div>)}
      <GoLink onClick={() => g.goToSpot(s.id)}>Fiche du spot</GoLink>
    </Card>
  );
}

function LureCard({ g }) {
  const a = g.verdictLure;
  if (!a) return null;
  const [famille, couleur] = [a.best.court, a.color.label];
  return (
    <Card kicker="Leurre conseillé pour ce créneau" title={a.tiedTop?.length > 1 ? `${famille} · à égalité : ${a.tiedTop.slice(1).map((f) => f.court.toLowerCase()).join(", ")}` : famille}>
      <div style={{display:"grid",gap:6,fontSize:14.5}}>
        <div><span style={{color:C.muted}}>Couleur · </span>{couleur}</div>
        <div><span style={{color:C.muted}}>Taille · </span>{a.size.text}</div>
        <div><span style={{color:C.muted}}>Montage · </span>{a.weight.text}</div>
        {a.box.length > 0 && <div><span style={{color:C.muted}}>Dans ta boîte · </span><b>{a.box.map((b) => `${b.model.replace("Xorus ", "")} ${b.color}${b.fam !== a.best.k ? ` (${FAMILLES[b.fam].court.toLowerCase()}, 2e choix)` : ""}`).join(", ")}</b></div>}
        {!a.box.length && a.boxNear && <div><span style={{color:C.muted}}>Dans ta boîte, à défaut · </span><b>{a.boxNear.model.replace("Xorus ", "")}{a.boxNear.color && a.boxNear.color !== "—" ? ` ${a.boxNear.color}` : ""}</b> <span style={{color:C.muted}}>({a.boxNear.diff})</span></div>}
      </div>
      <div style={{fontSize:12,color:C.faint,marginTop:8}}>D'après {[...new Set([...a.color.why, ...a.best.why].map((x) => x.s))].filter((k) => LURE_SOURCES[k]?.url).length} sources citées ; détail et raisons dans l'onglet Leurres.</div>
      <GoLink onClick={() => g.goTab("leurres")}>Tout le conseil leurres</GoLink>
    </Card>
  );
}

/** Le verdict tombe presque toujours en basse lumière : le meilleur créneau de plein jour, pour qui pêche de jour. */
function DaytimeCard({ g }) {
  const { s, w, lure } = g.daytime;
  return (
    <Card kicker="Si tu pêches en plein jour" title={`${s.name} · ${w.startFmt} → ${w.endFmt}`}
      right={<span style={{fontSize:20,fontWeight:800,color:scoreColor(w.score),...num}} title="Note de ce créneau">{fr(w.score)}</span>}>
      <div style={{display:"grid",gap:5,fontSize:14.5}}>
        <div>{w.label}</div>
        <div><span style={{color:C.muted}}>Leurre · </span>{lure.best.court} · {lure.color.label.split(" :")[0].toLowerCase()}</div>
        <div><span style={{color:C.muted}}>Montage · </span>{lure.weight.text}</div>
      </div>
      <Muted>En plein jour, le bar est moins actif qu'en basse lumière : la note de ce créneau est plus basse que celle du verdict.</Muted>
      <GoLink onClick={() => g.goLure(s.id, w.id)}>Le conseil leurres de ce créneau</GoLink>
    </Card>
  );
}

export function WeekCompact({ g }) {
  const { week, weekRows } = g;
  if (!weekRows) {
    return (
      <Card title="Les 7 prochains jours">
        {week.loading ? <Loader msg="Prévision des 7 prochains jours…"/>
          : <button onClick={() => g.loadWeek()} style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.accent}66`,background:`${C.accent}14`,color:C.strong,fontSize:14.5,fontWeight:700,cursor:"pointer"}}>Afficher la semaine</button>}
        {week.error && <Muted style={{color:"#fca5a5"}}>{week.error}</Muted>}
      </Card>
    );
  }
  return (
    <Card title="Les 7 prochains jours" right={<button onClick={() => g.loadWeek(true)} style={{background:"none",border:"none",color:C.accent,fontSize:13.5,cursor:"pointer"}}>Actualiser</button>}>
      <div style={{display:"flex",flexDirection:"column"}}>
        {weekRows.map((r) => {
          const lbl = new Date(r.date + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
          const sel = r.date === g.selectedDate;
          return (
            <button key={r.date} onClick={() => { g.pickDate(r.date); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch { /* sans effet */ } }}
              style={{display:"flex",alignItems:"center",gap:10,padding:"10px 4px",border:"none",borderTop:`1px solid ${C.line2}`,background:sel ? "#0f2540" : "none",color:C.text,cursor:"pointer",textAlign:"left"}}>
              <span style={{width:84,flexShrink:0,fontSize:14,color:sel ? C.accent : C.muted,textTransform:"capitalize"}}>{lbl}</span>
              {r.s ? (
                <>
                  <span style={{flex:1,minWidth:0,fontSize:14,lineHeight:1.35}}><b style={{color:C.strong}}>{r.s.name}</b>{r.w ? <span style={{color:C.muted}}> · {r.w.startFmt} → {r.w.endFmt}</span> : ""}{r.noKill ? <span style={{color:C.warn}}> · no-kill</span> : ""}</span>
                  <span style={{fontSize:17,fontWeight:800,color:scoreColor(r.s.score),...num}}>{fr(r.s.score)}</span>
                </>
              ) : <span style={{flex:1,fontSize:14,color:C.muted}}>{r.err || "Aucun créneau praticable"}</span>}
            </button>
          );
        })}
      </div>
      <Muted>Même calcul que la vue du jour. Au-delà de 2 à 3 jours, le vent prévu est une tendance.</Muted>
    </Card>
  );
}

export function Synthese({ g }) {
  const { live: d, loading, error, verdict, reg, tide, sun, sst, presenceInfo, pressure, pressureInfo, dataWarnings } = g;
  const evs = (tide.dayEvents || []).slice(0, 4).map((e) => `${e.type} ${fmtH(e.dec)}`).join(" · ");
  return (
    <Stack>
      {reg.noKill && <Alert tone={C.warn} role="alert">⚖ <b>No-kill obligatoire jusqu'au 31 mars</b> : tout bar est relâché.</Alert>}
      {g.jStatus === "unavailable" && <Alert>Sauvegarde indisponible ({g.jReason || "raison non communiquée"}) : le journal ne sera pas conservé. Exporte-le avant de fermer.</Alert>}
      {loading && <Card><Loader msg="Téléchargement de la météo, spot par spot… La marée est calculée sur l'appareil."/></Card>}
      {error && (
        <Card tone={C.bad} kicker="Météo indisponible">
          <p style={{margin:0,fontSize:14,color:"#fecaca",whiteSpace:"pre-line",lineHeight:1.5}}>{error}</p>
          <Muted>La marée et la lumière restent calculées : seule la météo manque.</Muted>
          <button onClick={() => g.doFetch(g.selectedDate, { force: true })} style={{marginTop:10,padding:"9px 14px",borderRadius:9,border:`1px solid ${C.bad}`,background:`${C.bad}22`,color:C.strong,fontSize:14,cursor:"pointer"}}>Réessayer</button>
        </Card>
      )}
      {!loading && d && verdict && <VerdictCard g={g}/>}
      {!loading && d && !verdict && <Alert tone={C.bad}>Aucun spot praticable selon le modèle (houle ou courant hors limites, ou aucun créneau dans tes heures). L'onglet Spots détaille la raison spot par spot.</Alert>}
      {!loading && d && verdict && <LureCard g={g}/>}
      {!loading && d && verdict && g.daytime && <DaytimeCard g={g}/>}

      <section aria-labelledby="cond-h">
        <h2 id="cond-h" style={{fontSize:17,fontWeight:800,color:C.strong,margin:"6px 2px 10px"}}>Conditions du jour</h2>
        <Grid min={150}>
          <Tile icon="🌬" label="Vent" value={d ? `${d.wind_dir} ${d.wind_kmh} km/h` : "–"} sub={d ? `${d.gust_kmh != null ? `rafales ${d.gust_kmh} · ` : ""}moyenne 6 h-22 h` : "météo non chargée"} onClick={() => g.goTab("meteo")}/>
          <Tile icon="🌊" label={SITE.zones?.local?.sea === "rade" ? "Mer (rade)" : "Houle"} value={d ? `${fr(d.houle)} m` : "–"} sub={SITE.zones?.local?.sea === "rade" ? "mer du vent, plan d'eau abrité" : "au large du spot local"} onClick={() => g.goTab("meteo")}/>
          <Tile icon="↕" label="Marée" value={tide.coefs?.length ? `coef ${tide.coefs.join(" · ")}` : "–"} sub={evs || tide.label} onClick={() => g.goTab("maree")}/>
          <Tile icon="☀" label="Soleil" value={`${fmtH(sun.sunrise)} → ${fmtH(sun.sunset)}`} sub="lever → coucher, heure de Paris" onClick={() => g.goTab("saison")}/>
          <Tile icon="🌡" label="Eau et saison" value={sst != null ? `${fr(sst)} °C` : "–"} sub={presenceInfo.label} onClick={() => g.goTab("saison")}/>
          <Tile icon="◔" label="Pression" value={pressure ? `${pressure} hPa` : "–"} sub={pressureInfo ? TREND[d?.pressure_trend] || pressureInfo.trendLabel : ""} onClick={() => g.goTab("meteo")}/>
        </Grid>
        {dataWarnings.length > 0 && <div style={{marginTop:8}}><Alert tone={C.bad}>{dataWarnings.length} alerte{dataWarnings.length > 1 ? "s" : ""} de cohérence des données : voir l'onglet Météo.</Alert></div>}
      </section>

      {verdict && verdict.next.length > 0 && (
        <Card title="Autres choix">
          {verdict.next.map((n, i) => (
            <button key={n.s.id} onClick={() => g.goToSpot(n.s.id)} style={{display:"flex",width:"100%",justifyContent:"space-between",alignItems:"center",gap:10,padding:"10px 0",border:"none",borderTop:i ? `1px solid ${C.line2}` : "none",background:"none",color:C.text,cursor:"pointer",textAlign:"left"}}>
              <span style={{minWidth:0}}><b style={{color:C.strong,fontSize:15}}>#{i + 2} {n.s.name}</b><br/><span style={{fontSize:13.5,color:C.muted}}>{n.w ? `${n.w.startFmt} → ${n.w.endFmt} · ` : ""}{n.s.distance}</span></span>
              <span style={{fontSize:20,fontWeight:800,color:scoreColor(n.s.score),...num}}>{fr(n.s.score)}</span>
            </button>
          ))}
          <GoLink onClick={() => g.goTab("spots")}>Classement complet et carte</GoLink>
        </Card>
      )}

      <WeekCompact g={g}/>

      <button onClick={() => g.goTab("regles")} style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,padding:"12px 14px",borderRadius:12,border:`1px solid ${C.line}`,background:C.card,color:C.text,cursor:"pointer",textAlign:"left"}}>
        <span>⚖ <b>{reg.headline}</b>{reg.stale ? <span style={{color:C.warn}}> · règles 2026, à revérifier</span> : ""}</span>
        <Chip color={C.accent}>Règles ›</Chip>
      </button>
    </Stack>
  );
}
