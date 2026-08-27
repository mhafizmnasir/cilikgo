const CACHE_NAME = 'cilikgo-v1';

// Pasang Service Worker
self.addEventListener('install', (e) => {
  self.skipWaiting();
});

// Aktifkan Service Worker
self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

// Respon Permintaan Rangkaian
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});