// ELL Coast Monsters — Lineup Manager Service Worker
const CACHE = 'monsters-lineup-v1';
const ASSETS = [
  '/monsters-lineup/',
  '/monsters-lineup/index.html',
  '/monsters-lineup/manifest.json',
  '/monsters-lineup/icon.svg',
  '/monsters-lineup/service-worker.js'
];

// Install: cache all app shell assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: serve from cache first (app shell), network first for Supabase API calls
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go to network for Supabase API calls (auth + data)
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // App shell: cache first, fall back to network
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(response => {
      // Cache new successful responses for app assets
      if (response.ok && url.origin === self.location.origin) {
        const clone = response.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return response;
    }))
  );
});
