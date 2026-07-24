/* =========================================================
   SERVICE WORKER
   Deja la app disponible sin internet y la hace instalable.
   Al publicar cambios: subir la versión aquí Y los ?v= de
   index.html (ver README).
   ========================================================= */
const CACHE = 'calculadora-chef-v10';

const ARCHIVOS = [
  '.',
  'index.html',
  'manifest.webmanifest',
  'css/estilos.css?v=10',
  'js/conversion.js?v=10',
  'js/datos.js?v=10',
  'js/calculo.js?v=10',
  'js/app.js?v=10',
  'icon-192.png',
  'icon-512.png',
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ARCHIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(claves => Promise.all(claves.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const peticion = evento.request;
  if (peticion.method !== 'GET') return;

  // Navegación: primero la red (para recibir versiones nuevas),
  // y si no hay internet, la copia guardada.
  if (peticion.mode === 'navigate') {
    evento.respondWith(
      fetch(peticion)
        .then(respuesta => {
          const copia = respuesta.clone();
          caches.open(CACHE).then(cache => cache.put('index.html', copia)).catch(() => {});
          return respuesta;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  // Recursos versionados: primero el caché, y la red como respaldo.
  evento.respondWith(
    caches.match(peticion).then(guardado => {
      if (guardado) return guardado;
      return fetch(peticion).then(respuesta => {
        if (respuesta.ok && new URL(peticion.url).origin === location.origin) {
          const copia = respuesta.clone();
          caches.open(CACHE).then(cache => cache.put(peticion, copia)).catch(() => {});
        }
        return respuesta;
      });
    })
  );
});
