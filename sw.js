// Service worker : réseau d'abord (les mises à jour arrivent tout de suite),
// cache en secours (l'application s'ouvre sans réseau, marée comprise).
// Les appels météo et GitHub ne sont jamais mis en cache ici : l'application
// gère elle-même sa mémoire de la dernière météo téléchargée.
const CACHE = "guide-bar-c3767c3bcc49";
const SHELL = ["./", "./index.html", "./logonna.html", "./pirou.html", "./logonna-manifest.json", "./pirou-manifest.json", "./logonna.png", "./pirou.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting()));
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
