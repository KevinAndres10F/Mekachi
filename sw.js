// Mekachi: primero la red y, si no hay señal, la última copia guardada.
var CACHE = "mekachi-v3";
var SHELL = ["./", "index.html", "brand.css", "app.js", "datos.js", "medios.js", "vendor/supabase/supabase.js", "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css", "icons/icon.svg"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request).then(function (hit) { return hit || caches.match("index.html"); });
  }));
});
