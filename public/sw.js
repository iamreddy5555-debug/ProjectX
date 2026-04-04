// No-op service worker that replaces any stale SW from previous projects.
// It immediately activates, clears all caches, then unregisters itself.

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.map(function (name) { return caches.delete(name); }));
    }).then(function () {
      return self.registration.unregister();
    }).then(function () {
      return self.clients.matchAll();
    }).then(function (clients) {
      clients.forEach(function (client) { client.navigate(client.url); });
    })
  );
});
