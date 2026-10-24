/* MPTK Tracker service worker
 *
 * Job: keep the app's own files (the "app shell") in the phone's cache so MPTK Tracker opens
 * and works with NO internet. Business data is NOT handled here - it lives in IndexedDB.
 *
 * The two lines marked BUILD are rewritten automatically by `npm run build`
 * (see scripts/precache.ts) with the real list of files and a version number.
 * Updating the app NEVER touches IndexedDB, so records are safe during updates.
 */

const CACHE_PREFIX = 'mptk-tracker-';
const CACHE_VERSION = '94d6c1f16ede'; // BUILD
const PRECACHE_URLS = /*PRECACHE_URLS*/["./","assets/index-CbsAwFlW.js","assets/index-CmWmU1Oa.css","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg","index.html","manifest.webmanifest"]/*END*/; // BUILD
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

function toUrl(path) {
  return new URL(path, self.registration.scope).href;
}

self.addEventListener('install', (event) => {
  // Download every app file into the new cache. If any file fails, installation fails and the
  // previous version keeps running, so the app is never left half-cached.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS.map((path) => new Request(toUrl(path), { cache: 'reload' }))),
    ),
  );
  // We deliberately do NOT call skipWaiting() here. A new version waits until the person taps
  // "Update" in the app, so a screen they are typing into is never replaced unexpectedly.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

async function handleNavigation(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = (await cache.match(toUrl('index.html'))) || (await cache.match(toUrl('./')));
  if (cached) return cached;
  try {
    return await fetch(request);
  } catch (error) {
    return new Response('MPTK Tracker is offline and has not been cached yet. Connect to the internet once and open the app again.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

async function handleAsset(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }
  event.respondWith(handleAsset(request));
});
