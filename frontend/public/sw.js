const CACHE_NAME = "notesboard-static-v2";
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/vite.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.warn("[sw] precache failed", error);
      }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PRECACHE_URLS") {
    return;
  }

  const urls = Array.isArray(event.data?.payload?.urls)
    ? event.data.payload.urls.filter((url) => typeof url === "string")
    : [];

  if (!urls.length) {
    return;
  }

  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        urls.map(async (url) => {
          try {
            await cache.add(new Request(url, { credentials: "same-origin" }));
          } catch (error) {
            console.warn("[sw] dynamic precache failed", url, error);
          }
        }),
      );
    }),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (!isSameOrigin) return;

  // Never cache API requests — React Query manages its own cache.
  // Only cache static assets (HTML, CSS, JS, images, fonts).
  if (url.pathname.startsWith("/api/")) return;

  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    }),
  );
});
