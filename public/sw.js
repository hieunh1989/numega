const CACHE = "numega-v4";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/numega-logo.png",
  "/icons/categories/cereals.png",
  "/icons/categories/protein-sources.png",
  "/icons/categories/oils-fats.png",
  "/icons/categories/minerals.png",
  "/icons/categories/amino-acids.png",
  "/icons/categories/others.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match("/"))),
  );
});
