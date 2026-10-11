// Stockage de l'application sur GitHub Pages.
//
// L'application attend l'API `window.storage` des artefacts claude.ai
// (get → {key, value}, erreur « not found » si absent ; set). Elle est fournie
// ici par le localStorage du navigateur — propre à cet appareil — et chaque
// écriture du journal déclenche, si elle est configurée, la sauvegarde dans
// le dépôt GitHub privé (voir sync.js).

const listeners = new Set();
export const onJournalWrite = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function ls() {
  try { const s = window.localStorage; const k = "__probe__"; s.setItem(k, "1"); s.removeItem(k); return s; }
  catch { return null; }
}

export function installStorage() {
  if (window.storage) return;   // environnement qui fournit déjà le sien
  const s = ls();
  const mem = new Map();        // repli : mémoire de la session si le navigateur refuse
  window.storage = {
    async get(key) {
      const v = s ? s.getItem(key) : (mem.has(key) ? mem.get(key) : null);
      if (v == null) throw new Error("not found");
      return { key, value: v };
    },
    async set(key, value) {
      if (s) {
        try { s.setItem(key, value); }
        catch (e) { throw new Error("Stockage du navigateur plein ou refusé : " + (e?.message || e)); }
      } else mem.set(key, value);
      if (key.startsWith("bar:journal:")) for (const fn of listeners) { try { fn(key, value); } catch { /* sans effet */ } }
      return { key, value };
    },
    async delete(key) { if (s) s.removeItem(key); else mem.delete(key); return { key, deleted: true }; },
    persistent: !!s,
  };
  // Demande au navigateur de ne pas purger les données de ce site (Chrome,
  // Firefox ; Safari l'accorde aux apps ajoutées à l'écran d'accueil).
  try { navigator.storage?.persist?.(); } catch { /* facultatif */ }
}
