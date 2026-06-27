self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// A functional fetch listener is mandatory for PWA installation criteria
self.addEventListener('fetch', (event) => {
  // Let Cloudflare Worker logic handle routing and data-serving natively
});
