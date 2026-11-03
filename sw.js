// Cambia VERSION cada vez que subas cambios, para que el teléfono descargue la nueva versión.
const VERSION = "v54";
const CACHE = "actividades-" + VERSION;
const FILES = [
  "./", "index.html", "manifest.webmanifest", "config.js", "vendor/supabase.js", "vendor/591.supabase.js",
  "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png",
  "fonts/sora-latin-600-normal.woff2", "fonts/sora-latin-700-normal.woff2",
  "fonts/manrope-latin-400-normal.woff2", "fonts/manrope-latin-500-normal.woff2", "fonts/manrope-latin-600-normal.woff2", "fonts/manrope-latin-700-normal.woff2",
  "fonts/jetbrains-mono-latin-400-normal.woff2", "fonts/jetbrains-mono-latin-600-normal.woff2"
];

self.addEventListener("install", e => {
  // cache: "reload" = baja cada archivo de nuevo desde internet (no una copia vieja del navegador)
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("actividades-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data === "skip") self.skipWaiting(); });

// Primero la copia guardada (funciona sin internet); si no está, la red.
self.addEventListener("fetch", e => {
  // Supabase y todo lo de otros dominios va directo a la red.
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // La revisión de versión siempre va a la red, nunca a la copia guardada.
  if (new URL(e.request.url).pathname.endsWith("/sw.js")) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => e.request.mode === "navigate" ? caches.match("index.html") : Response.error());
    })
  );
});
