// ══════════════════════════════════════════════════════════════════
//  KLICK — Service Worker  (auto-update sin Ctrl+R)
//
//  Estrategia: Network-first para HTML/JS/CSS (siempre verifica si
//  hay nueva versión), cache-first para assets estáticos grandes.
//
//  Al detectar una nueva versión instalada, el SW envía un mensaje
//  al cliente → el juego muestra un aviso y recarga solo.
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'klick-v1';

// Archivos que se cachean en la instalación inicial
const PRECACHE = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './anti-flash.js',
];

// ── Mensaje desde el cliente: saltar espera y activarse ya ───────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Instalación: precachear archivos base ─────────────────────────
self.addEventListener('install', event => {
    // Tomar control inmediatamente sin esperar a que cierren las pestañas
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE))
    );
});

// ── Activación: eliminar caches viejos y tomar control ───────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME)
                    .map(k => caches.delete(k))
            )
        ).then(() => {
            // Notificar a todos los clientes abiertos que hay nueva versión
            self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
                clients.forEach(client =>
                    client.postMessage({ type: 'SW_UPDATED' })
                );
            });
            return self.clients.claim();
        })
    );
});

// ── Fetch: Network-first para archivos del juego ─────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Solo interceptar recursos del mismo origen
    if (url.origin !== self.location.origin) return;

    // Solo GET
    if (event.request.method !== 'GET') return;

    // Ignorar el propio sw.js para no cachear el worker
    if (url.pathname.endsWith('sw.js')) return;

    // Archivos del juego → Network-first:
    // 1. Intenta red → si hay nueva versión, actualiza caché y sirve la nueva
    // 2. Si la red falla → sirve desde caché (offline fallback)
    const isGameFile = ['/index.html', '/styles.css', '/script.js', '/anti-flash.js', '/preguntas.json', '/']
        .some(p => url.pathname === p || url.pathname.endsWith(p));

    if (isGameFile) {
        event.respondWith(
            fetch(event.request.clone())
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const toCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Resto (fuentes, imágenes externas, etc.) → Cache-first
    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const toCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
                return response;
            });
        })
    );
});
