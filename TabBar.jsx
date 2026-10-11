// Barre d'onglets collante. L'onglet actif est inscrit dans l'adresse
// (#leurres…) : le bouton « retour » du téléphone revient à l'onglet précédent.
import { useEffect, useRef } from "react";
import { C } from "./kit.jsx";

export const TABS = [
  ["synthese", "Synthèse"], ["spots", "Spots"], ["leurres", "Leurres"], ["maree", "Marée"],
  ["meteo", "Météo"], ["saison", "Saison"], ["journal", "Journal"], ["regles", "Règles"],
];
export const tabFromHash = () => {
  const h = (typeof location !== "undefined" ? location.hash : "").replace(/^#/, "");
  return TABS.some(([k]) => k === h) ? h : "synthese";
};

export function TabBar({ tab, onChange }) {
  const refs = useRef({});
  useEffect(() => { try { refs.current[tab]?.scrollIntoView({ block: "nearest", inline: "center" }); } catch { /* sans effet */ } }, [tab]);
  // Clavier (motif « onglets » WAI-ARIA) : flèches, début, fin ; l'onglet suit le focus.
  const onKey = (e) => {
    const i = TABS.findIndex(([k]) => k === tab);
    const j = e.key === "ArrowRight" ? (i + 1) % TABS.length : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
      : e.key === "Home" ? 0 : e.key === "End" ? TABS.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    const k = TABS[j][0];
    onChange(k);
    refs.current[k]?.focus();
  };
  return (
    <nav aria-label="Onglets du guide" style={{background:"rgba(2,12,24,0.97)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",borderBottom:`1px solid ${C.line}`,paddingTop:"env(safe-area-inset-top)"}}>
      <div role="tablist" aria-label="Onglets du guide" onKeyDown={onKey} style={{maxWidth:760,margin:"0 auto",display:"flex",gap:2,padding:"4px 24px 4px 6px",overflowX:"auto",scrollbarWidth:"none",
        WebkitMaskImage:"linear-gradient(to right,#000 88%,transparent)",maskImage:"linear-gradient(to right,#000 88%,transparent)"}}>
        {TABS.map(([k, lbl]) => {
          const on = tab === k;
          return (
            <button key={k} ref={(el) => { refs.current[k] = el; }} role="tab" id={`onglet-${k}`} aria-selected={on} aria-controls="panneau" tabIndex={on ? 0 : -1} onClick={() => onChange(k)}
              style={{flex:"0 0 auto",minHeight:44,padding:"0 clamp(8px, 2.6vw, 13px)",borderRadius:9,border:"none",background:on ? "#1e3a5f" : "transparent",color:on ? C.strong : C.muted,fontSize:"clamp(13.5px, 3.9vw, 14.5px)",fontWeight:on ? 700 : 500,cursor:"pointer",whiteSpace:"nowrap"}}>
              {lbl}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
