const CACHE_NAME = 'ghostnav-v3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Let all page navigations go directly to the network so /app, /dossier, etc. load cleanly
  if (event.request.mode === 'navigate') {
    return;
  }
});
