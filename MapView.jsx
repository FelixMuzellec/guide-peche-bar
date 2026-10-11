// Carte des spots (Leaflet + fond OpenStreetMap). Chaque spot est un disque
// coloré selon sa note du jour ; un appui ouvre sa fiche. La carte n'est
// créée qu'une fois visible : rien n'est téléchargé tant qu'on n'y va pas.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { SITE } from "SITE_CONFIG";
import { spotLatLon } from "../engine/weather.js";
import { scoreColor } from "./kit.jsx";

export function MapView({ spots, activeId, onPick }) {
  const box = useRef(null), map = useRef(null), marks = useRef(new Map()), pick = useRef(onPick);
  pick.current = onPick;
  const [visible, setVisible] = useState(false);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (visible || !box.current) return undefined;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: "200px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || map.current || !box.current) return undefined;
    // Création différée d'une image : l'onglet s'affiche d'abord, la carte ensuite
    // (sur un téléphone lent, la création de la carte coûtait ~300 ms au changement d'onglet).
    let m = null, cancelled = false;
    const raf = requestAnimationFrame(() => setTimeout(() => {
    if (cancelled || !box.current) return;
    m = L.map(box.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false, zoomAnimation: true, fadeAnimation: false, markerZoomAnimation: false })
      .setView([SITE.lat, SITE.lon], 10);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17, attribution: '© <a href="https://www.openstreetmap.org/copyright">contributeurs OpenStreetMap</a>',
    });
    let errs = 0;
    tiles.on("tileerror", () => { if (++errs >= 4) setTilesFailed(true); });
    tiles.on("tileload", () => { errs = 0; setTilesFailed(false); });
    tiles.addTo(m);
    L.circleMarker([SITE.lat, SITE.lon], { radius: 5, color: "#e2e8f0", weight: 2, fillColor: "#0ea5e9", fillOpacity: 1 })
      .bindTooltip(SITE.name, { direction: "top", offset: [0, -6] }).addTo(m);
    map.current = m;
    setReady(true);
    }, 0));
    // Arrêter toute animation avant de détruire la carte (changement d'onglet pendant un zoom).
    return () => {
      cancelled = true; cancelAnimationFrame(raf);
      if (m) { try { m.stop(); m.off(); m.remove(); } catch { /* carte déjà détruite */ } }
      map.current = null; marks.current.clear();
    };
  }, [visible]);

  // Marqueurs : créés une fois, puis seulement restylés quand les notes changent.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const pts = [];
    spots.forEach((s, rank) => {
      const c = spotLatLon(s);
      if (!c) return;
      pts.push([c.lat, c.lon]);
      const col = scoreColor(s.score, s.eligible), on = s.id === activeId;
      const label = `${s.name} · ${s.eligible ? s.score.toFixed(1).replace(".", ",") : "–"}`;
      let mk = marks.current.get(s.id);
      if (!mk) {
        mk = L.circleMarker([c.lat, c.lon], { radius: 10, weight: 2, className: `spot-${s.id}` }).addTo(m);
        mk.on("click", () => pick.current(s.id));
        marks.current.set(s.id, mk);
      }
      mk.setStyle({ color: on ? "#f8fafc" : "#020617", fillColor: col, fillOpacity: s.eligible ? 0.95 : 0.5, weight: on ? 3 : 2 });
      // Étiquette permanente pour le TOP 3 et le spot affiché ; les autres au survol (11 spots se chevaucheraient).
      mk.unbindTooltip();
      mk.bindTooltip(label, { permanent: on || (rank < 3 && s.eligible), direction: "auto", offset: [0, 0], className: "spot-tip" });
      if (on) mk.bringToFront();
    });
    if (pts.length && !m._fitted) { m.fitBounds(L.latLngBounds([...pts, [SITE.lat, SITE.lon]]), { padding: [24, 24], animate: false }); m._fitted = true; }
  }, [spots, activeId, visible, ready]);

  return (
    <div>
      <div ref={box} role="region" aria-label="Carte des spots" style={{height:340,borderRadius:10,border:"1px solid #1e293b",overflow:"hidden",background:"#0b1626"}}/>
      <div style={{fontSize:13,color:"#94a3b8",marginTop:8,lineHeight:1.5}}>
        Disque vert ≥ 7, orange ≥ 5, gris en dessous ou impraticable. Touche un spot pour ouvrir sa fiche.
        {tilesFailed && <span style={{color:"#fbbf24"}}> Fond de carte indisponible (hors ligne ?) : les spots restent placés.</span>}
      </div>
    </div>
  );
}
