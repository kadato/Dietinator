/* Dietinator service worker. Runtime precache for the static web export.
 *
 * - Hashed build assets such as _expo/static/*, fonts, and wasm are cached forever on
 *   first use, so repeat loads skip the network entirely.
 * - Navigations are network-first with a cached fallback, so the app still
 *   boots when offline. The local-first engine keeps working in SQLite.
 * - The YAZIO proxy (`/api/*`) always hits the network. Never cached.
 *
 * Bump VERSION to invalidate old caches after an app update.
 */
const VERSION = 'dietinator-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request),
  );
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(`${VERSION}-static`);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaqueredirect') {
      const cache = await caches.open(`${VERSION}-shell`);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('/index.html');
  }
}
