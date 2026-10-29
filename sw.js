// Service worker: permite instalar la app y abrirla aunque haya mala señal en el río.
// Primero intenta la red (siempre la última versión); si no hay, usa la copia guardada.
const CACHE = "itc-v4";
const SHELL = ["./", "index.html", "styles.css", "config.js", "app.js", "data.js", "routines.js",
  "logo.jpg", "icon-192.png", "manifest.webmanifest"];
self.addEventListener("install", (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return; // nunca cachear la base de datos
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
});
