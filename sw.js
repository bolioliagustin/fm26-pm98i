const CACHE = "fichas-7d31d5a01cad";
const FILES = ["./", "index.html", "fichas.bin", "manifest.webmanifest", "icon-180.png", "icon-512.png"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (/\/(panel\.html|panel\.bin|version\.json|correcciones\.bin)$|\/s\//.test(url.pathname)) return;
  const req = e.request.mode === "navigate" ? "index.html" : e.request;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
