const CACHE = "numega-v9";
const APP_SHELL = [
  "/",
  "/install",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/icons/pwa/icon-192.png",
  "/icons/pwa/icon-512.png",
  "/icons/pwa/icon-maskable-192.png",
  "/icons/pwa/icon-maskable-512.png",
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
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (url.pathname === "/_next/image") {
          const originalPath = url.searchParams.get("url");
          if (originalPath?.startsWith("/")) {
            const originalImage = await caches.match(originalPath);
            if (originalImage) return originalImage;
          }
        }

        if (event.request.mode === "navigate") return caches.match("/");
        return Response.error();
      }),
  );
});
