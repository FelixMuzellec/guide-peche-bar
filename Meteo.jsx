// Météo : le jour en détail, spot par spot, la fiabilité du conseil et la pression.
import { SITE } from "SITE_CONFIG";
import { Alert, C, Card, Grid, Muted, Row, Stack, Tile, fr, num } from "../kit.jsx";
import { WeekCompact } from "./Synthese.jsx";

const BEAUFORT = ["calme", "très légère brise", "légère brise", "petite brise", "jolie brise", "bonne brise", "vent frais", "grand frais", "coup de vent", "fort coup de vent", "tempête", "violente tempête", "ouragan"];
const SKY = { clear: "clair", partly: "mi-nuageux", overcast: "couvert" };
const stabCol = (s) => (s === "stable" ? C.good : s === "sensible" ? C.warn : C.bad);

export function Meteo({ g }) {
  const d = g.live;
  const p = g.pressureInfo;
  return (
    <Stack>
      {g.error && <Alert tone={C.bad}>{g.error}</Alert>}
      {!d && !g.error && <Muted>Météo en cours de téléchargement…</Muted>}
      {d && (
        <Card title="Météo du jour" kicker={`${d.source_meteo || "Open-Meteo"}${g.fetchedAt ? ` · reçue à ${g.fetchedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}`}>
          <Grid min={140}>
            <Tile icon="🌬" label="Vent moyen" value={`${d.wind_dir} ${d.wind_kmh} km/h`} sub={`force ${d.wind_force} · ${BEAUFORT[d.wind_force] || ""}`}/>
            <Tile icon="💨" label="Rafales" value={d.gust_kmh != null ? `${d.gust_kmh} km/h` : "–"} sub="maximum 6 h-22 h"/>
            <Tile icon="☁" label="Ciel" value={SKY[d.sky] || d.sky} sub={d.rain_mm ? `pluie ${fr(d.rain_mm)} mm` : "pas de pluie notable"}/>
            <Tile icon="🌊" label={SITE.zones?.local?.sea === "rade" ? "Mer (rade)" : "Houle"} value={`${fr(d.houle)} m`} sub={SITE.zones?.local?.sea === "rade" ? "mer du vent estimée" : "modèle de vagues"}/>
            <Tile icon="◔" label="Pression à midi" value={d.pressure ? `${d.pressure} hPa` : "–"} sub={d.pressure_delta_24h != null ? `${d.pressure_delta_24h > 0 ? "+" : ""}${fr(d.pressure_delta_24h)} hPa en 24 h` : ""}/>
            <Tile icon="🌡" label="Eau" value={d.sst != null ? `${fr(d.sst)} °C` : "–"} sub={d.source_sst || "non disponible"}/>
          </Grid>
          {d.resume && <Muted style={{color:C.text,fontStyle:"italic"}}>« {d.resume} »</Muted>}
        </Card>
      )}

      {d && (
        <Card title="Spot par spot" kicker="Vent et mer aux coordonnées de chaque spot, 6 h-22 h">
          {g.allScored.map((s, i) => (
            <button key={s.id} onClick={() => g.goToSpot(s.id)} style={{display:"flex",width:"100%",justifyContent:"space-between",gap:10,padding:"9px 0",border:"none",borderTop:i ? `1px solid ${C.line2}` : "none",background:"none",color:C.text,cursor:"pointer",textAlign:"left"}}>
              <span style={{minWidth:0,fontSize:14.5}}>{s.name}</span>
              <span style={{fontSize:14,textAlign:"right",...num,color:"#7dd3fc"}}>
                {s.zw?.fromSpot ? `${s.zw.wind_dir} ${s.zw.wind_kmh} km/h${s.zw.gust_kmh != null ? ` · raf. ${s.zw.gust_kmh}` : ""} · ${s.zw.houleKnown ? fr(s.zw.houle) + " m" : "?"}` : "–"}
              </span>
            </button>
          ))}
        </Card>
      )}

      {g.top3.length > 0 && g.top3[0].spread != null && (
        <Card title="Fiabilité du conseil" kicker="Le classement face à l'incertitude du vent">
          {g.top3.map((s) => (
            <Row key={s.id} label={s.name} color={stabCol(s.stability)}>{fr(s.score)} · plage {fr(s.worst)}–{fr(s.best)} · {s.stability}</Row>
          ))}
          <Muted>Une prévision de vent reste incertaine d'au moins ±1 Beaufort et ±1 secteur. La note affichée est la moyenne sur cette plage, pas la valeur d'un point unique. Quand AROME et ECMWF ne s'accordent pas sur le vent d'un créneau, la plage est élargie à leur écart réel (jusqu'à ±3 Beaufort et ±3 secteurs). « Plage » : la note aux deux extrêmes. Un spot « volatile » n'est premier que si la prévision est exacte.</Muted>
        </Card>
      )}

      {g.dataWarnings.length > 0 && (
        <Card tone={C.bad} title={`Cohérence des données : ${g.dataWarnings.length} alerte${g.dataWarnings.length > 1 ? "s" : ""}`}>
          {g.dataWarnings.map((w, i) => <div key={i} style={{fontSize:14,color:"#fecaca",lineHeight:1.55,marginBottom:4}}>• {w}</div>)}
          <Muted>Ces contrôles ne corrigent rien : ils signalent. Recoupe avant de te déplacer.</Muted>
        </Card>
      )}

      {p && (
        <Card title="Pression et stratégie" kicker="Indice faible : il pèse au plus ±0,3 point dans la note">
          <Row label="Pression">{g.pressure || "–"} hPa · {p.trendLabel}</Row>
          <Row label="Activité estimée">{p.activity}/10</Row>
          <Row label="Couche à privilégier">{p.depth === "surface" ? "surface et mi-eau" : p.depth === "deep" ? "fond et structures" : "mi-eau"}</Row>
          {p.activityReason && <Muted>{p.activityReason}</Muted>}
          <Muted>{p.depthHint}</Muted>
          <Muted>{p.zoneHint}</Muted>
          <Muted style={{fontSize:12.5}}>Tiré de récits de pêcheurs, pas d'études sur le bar. Le fond de chaque spot passe avant : sur un fond encroché, « fond » veut dire au ras des roches ou du goémon, jamais au contact.</Muted>
        </Card>
      )}

      <WeekCompact g={g}/>
    </Stack>
  );
}
