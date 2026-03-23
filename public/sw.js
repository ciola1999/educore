const CACHE_NAME = "educore-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/manifest.json",
  "/window.svg",
  "/globe.svg",
  "/file.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (
    requestUrl.pathname.startsWith("/api/") ||
    requestUrl.pathname.startsWith("/_next/") ||
    requestUrl.pathname.startsWith("/dashboard/")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).catch(() => {
        // Return a fallback or just fail if offline and not in cache
      });
    }),
  );
});
