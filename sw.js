// Service worker : réseau d'abord (les mises à jour arrivent tout de suite),
// cache en secours (l'application s'ouvre sans réseau, marée comprise).
// Les appels météo et GitHub ne sont jamais mis en cache ici : l'application
// gère elle-même sa mémoire de la dernière météo téléchargée.
const CACHE = "guide-bar-4547488234ba";
// Une seule application : l'accueil, les guides, le manifeste commun et les icônes.
// Liste écrite par scripts/build.mjs à partir des fichiers du site.
const SHELL = ["./","./index.html","./logonna.html","./pirou.html","./plouguerneau.html","./audierne.html","./carantec.html","./concarneau.html","./manifest.json","./icon-192.png","./icon-512.png","./icon-maskable.png","./logonna.png","./pirou.png","./plouguerneau.png","./audierne.png","./carantec.png","./concarneau.png"];

self.addEventListener("install", (e) => {
  // Fichier par fichier : un seul fichier absent (dépôt incomplet) ne vide plus tout le cache.
  // cache: "reload" : la copie hors ligne vient du serveur, jamais d'une version périmée du cache HTTP.
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(SHELL.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(e.request, { signal: ctrl.signal, cache: "no-cache" });
      clearTimeout(t);
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    } catch {
      const hit = await cache.match(e.request, { ignoreSearch: true });
      if (hit) return hit;
      throw new Error("hors ligne et absent du cache");
    }
  })());
});
