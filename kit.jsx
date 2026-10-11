// Kit d'interface : une seule police, une seule échelle de tailles, une seule
// façon de présenter une carte, une tuile, une source. Tout l'écran en dérive.
import { useState } from "react";

export const C = {
  bg: "#020c18", card: "#0b1626", card2: "#071120", line: "#1e293b", line2: "#15233a",
  text: "#e2e8f0", strong: "#f8fafc", muted: "#94a3b8", faint: "#7b8ba1",
  accent: "#38bdf8", good: "#22c55e", warn: "#f59e0b", bad: "#ef4444", violet: "#a78bfa",
};
export const FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
export const num = { fontVariantNumeric: "tabular-nums" };
export const scoreColor = (v, eligible = true) => (!eligible ? C.faint : v >= 7 ? C.good : v >= 5 ? C.warn : C.muted);
export const fr = (x, d = 1) => (x == null || !Number.isFinite(+x) ? "–" : (+x).toFixed(d).replace(".", ","));

/** Carte : un titre court, un contenu. */
export function Card({ title, kicker, right, children, tone, onClick, style, id }) {
  const border = tone ? `${tone}66` : C.line;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag id={id} onClick={onClick} style={{display:"block",width:"100%",textAlign:"left",color:"inherit",cursor:onClick ? "pointer" : "default",
      background:tone ? `linear-gradient(160deg,${tone}18 0%,${C.card} 60%)` : C.card,border:`1px solid ${border}`,borderRadius:14,padding:"14px 15px",...style}}>
      {(title || kicker || right) && (
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,marginBottom:10}}>
          <div style={{minWidth:0}}>
            {kicker && <div style={{fontSize:12,fontWeight:600,color:tone || C.accent,letterSpacing:"0.04em",marginBottom:2}}>{kicker}</div>}
            {title && <div style={{fontSize:16,fontWeight:700,color:C.strong,lineHeight:1.3}}>{title}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Tuile chiffrée (grille de la synthèse). */
export function Tile({ label, value, sub, color, onClick, icon }) {
  return (
    <button onClick={onClick} style={{display:"flex",flexDirection:"column",gap:2,minWidth:0,textAlign:"left",padding:"11px 12px",borderRadius:12,
      border:`1px solid ${C.line}`,background:C.card,color:C.text,cursor:onClick ? "pointer" : "default"}}>
      <span style={{fontSize:12.5,color:C.muted,display:"flex",justifyContent:"space-between",gap:6}}><span>{icon} {label}</span>{onClick && <span aria-hidden style={{color:C.faint}}>›</span>}</span>
      <span style={{fontSize:19,fontWeight:700,color:color || C.strong,lineHeight:1.2,...num,overflowWrap:"anywhere"}}>{value}</span>
      {sub && <span style={{fontSize:12.5,color:C.muted,lineHeight:1.35}}>{sub}</span>}
    </button>
  );
}

export function Chip({ children, color = C.muted, active, onClick, title }) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag onClick={onClick} title={title} aria-pressed={onClick ? !!active : undefined}
      style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:onClick ? 13 : 12.5,fontWeight:600,lineHeight:1.2,padding:onClick ? "0 12px" : "3px 8px",minHeight:onClick ? 40 : undefined,borderRadius:999,whiteSpace:"nowrap",
        color:active ? C.strong : color,background:active ? `${color}30` : `${color}14`,border:`1px solid ${active ? color : color + "40"}`,cursor:onClick ? "pointer" : "default"}}>
      {children}
    </Tag>
  );
}

/** Bloc repliable. */
export function Disclosure({ title, sub, children, defaultOpen = false, id }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div id={id} style={{border:`1px solid ${C.line}`,borderRadius:12,background:C.card,overflow:"hidden"}}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,padding:"13px 15px",background:"none",border:"none",color:C.text,cursor:"pointer",textAlign:"left"}}>
        <span><span style={{display:"block",fontSize:15,fontWeight:700,color:C.strong}}>{title}</span>{sub && <span style={{display:"block",fontSize:12.5,color:C.muted,marginTop:2}}>{sub}</span>}</span>
        <span aria-hidden style={{fontSize:18,color:C.muted,transform:open ? "rotate(90deg)" : "none",transition:"transform .15s"}}>›</span>
      </button>
      {open && <div style={{padding:"0 15px 14px"}}>{children}</div>}
    </div>
  );
}

/** Sous-onglets (segments) à l'intérieur d'une carte. */
export function SubTabs({ tabs, value, onChange }) {
  return (
    <div style={{display:"flex",gap:4,padding:4,borderRadius:10,background:C.card2,border:`1px solid ${C.line}`,overflowX:"auto"}}>
      {tabs.map(([k, lbl]) => (
        <button key={k} onClick={() => onChange(k)} aria-pressed={value === k}
          style={{flex:"1 0 auto",padding:"8px 10px",borderRadius:7,border:"none",background:value === k ? "#1e3a5f" : "transparent",color:value === k ? C.strong : C.muted,fontSize:13.5,fontWeight:value === k ? 700 : 500,cursor:"pointer",whiteSpace:"nowrap"}}>
          {lbl}
        </button>
      ))}
    </div>
  );
}

/** Une ligne « libellé : valeur ». */
export function Row({ label, children, color }) {
  return (
    <div style={{display:"flex",justifyContent:"space-between",gap:12,padding:"7px 0",borderTop:`1px solid ${C.line2}`,fontSize:14}}>
      <span style={{color:C.muted,flexShrink:0}}>{label}</span>
      <span style={{color:color || C.text,textAlign:"right",...num}}>{children}</span>
    </div>
  );
}

/** Mention de source (lien si disponible). */
export function Src({ src, prefix = "", short = false }) {
  if (!src) return null;
  const s = typeof src === "string" ? { label: src } : src;
  const txt = short && s.short ? s.short : s.label;
  return (
    <span title={short ? s.label : undefined} style={{fontSize:12.5,color:C.faint,whiteSpace:short ? "nowrap" : "normal"}}>
      {prefix}{s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer" style={{textDecoration:"underline",textDecorationColor:"#475569"}}>{txt}</a> : txt}
    </span>
  );
}

/** Liste de raisons, chacune avec sa source (clé dans `sources`). */
export function Why({ items, sources, compact = false }) {
  if (!items?.length) return null;
  return (
    <ul style={{margin:compact ? "4px 0 0" : "6px 0 0",padding:0,listStyle:"none",display:"flex",flexDirection:"column",gap:compact ? 3 : 6}}>
      {items.map((x, i) => (
        <li key={i} style={{fontSize:13.5,color:C.text,lineHeight:1.5,paddingLeft:14,position:"relative"}}>
          <span aria-hidden style={{position:"absolute",left:0,color:C.faint}}>•</span>
          {x.t} {sources?.[x.s] && <Src src={sources[x.s]} prefix="· " short/>}
        </li>
      ))}
    </ul>
  );
}

export const Muted = ({ children, style }) => <p style={{margin:"8px 0 0",fontSize:13,color:C.muted,lineHeight:1.55,...style}}>{children}</p>;
export const Stack = ({ children, gap = 12, style }) => <div style={{display:"flex",flexDirection:"column",gap,...style}}>{children}</div>;
export const Grid = ({ children, min = 150, gap = 8 }) => <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${min}px,1fr))`,gap}}>{children}</div>;

/** Lien « aller à » sous forme de bouton discret. */
export function GoLink({ children, onClick }) {
  return <button onClick={onClick} style={{marginTop:4,minHeight:40,background:"none",border:"none",padding:0,color:C.accent,fontSize:14,fontWeight:600,cursor:"pointer",textAlign:"left"}}>{children} ›</button>;
}

export function Alert({ tone = C.warn, children, role = "status" }) {
  return <div role={role} style={{padding:"10px 12px",borderRadius:10,border:`1px solid ${tone}80`,background:`${tone}1a`,fontSize:13.5,color:C.strong,lineHeight:1.5}}>{children}</div>;
}
