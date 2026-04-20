const CACHE_VERSION = "mmi-pwa-v2";
const CORE_CACHE = `${CACHE_VERSION}-core`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const ASSET_MANIFEST = "/mmi-data/pwa-assets.json";

self.addEventListener("install", (event) => {
  event.waitUntil(
    cacheCoreAssets()
      .catch((error) => console.warn("MMI service worker install cache failed", error))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("mmi-pwa-") && !key.startsWith(CACHE_VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/"));
    return;
  }

  if (
    url.pathname === "/api/mmi/projects" ||
    url.pathname.startsWith("/mmi-data/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(url.pathname === "/api/mmi/projects" ? networkFirst(request, "/mmi-data/projects.json") : cacheFirst(request));
  }
});

async function cacheCoreAssets() {
  const cache = await caches.open(CORE_CACHE);
  const manifestResponse = await fetch(ASSET_MANIFEST, { cache: "no-store" });
  const manifest = await manifestResponse.json();
  const assets = Array.isArray(manifest.assets) ? manifest.assets : ["/"];

  await Promise.allSettled(
    assets.map(async (asset) => {
      const response = await fetch(asset, { cache: "reload" });
      if (response.ok) {
        await cache.put(asset, response);
      }
    }),
  );
}

async function networkFirst(request, fallbackPath) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await cache.match(request)) ||
      (await caches.match(fallbackPath)) ||
      new Response("MMI app is offline and this page is not cached yet.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const cache = await caches.open(RUNTIME_CACHE);
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}
