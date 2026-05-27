const SERVICE_WORKER_CACHE_NAME = "edsync-core-2026-05-24";

const SERVICE_WORKER_CORE_URLS = [
  "/",
  "/auth/login",
  "/student/dashboard",
  "/student/work",
  "/teacher/dashboard",
  "/teacher/lessons",
  "/favicon.svg",
  "/manifest.webmanifest",
] as const;

type ServiceWorkerScriptOptions = {
  cacheName?: string;
  coreUrls?: readonly string[];
};

export function buildServiceWorkerScript(options: ServiceWorkerScriptOptions = {}) {
  const cacheName = options.cacheName ?? SERVICE_WORKER_CACHE_NAME;
  const coreUrls = options.coreUrls ?? SERVICE_WORKER_CORE_URLS;

  return `const CACHE_NAME = ${JSON.stringify(cacheName)};
const CORE_URLS = ${JSON.stringify(coreUrls)};

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_URLS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/") || request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || caches.match("/"))));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
  );
});
`;
}
