// ══════════════════════════════════════════════════════════════════
//  KLICK — Service Worker  v3  (auto-update fiable)
//
//  Problema del v1:  skipWaiting() en install() activaba el SW de
//  inmediato en la primera carga, pero clients.claim() corría antes
//  de que hubiera clientes — SW_UPDATED llegaba a nadie.
//
//  Solución v2:
//  • NO llamar skipWaiting() automáticamente en install.
//  • El cliente detecta reg.waiting y envía SKIP_WAITING.
//  • SW lo procesa → activate → claim → postMessage SW_UPDATED.
//  • Garantizado: siempre hay clientes cuando activate corre.
// ══════════════════════════════════════════════════════════════════

const CACHE_NAME = 'klick-cache-v9';

const PRECACHE = [
    './',
    './index.html',
    './styles.css',
    './script.js',
    './anti-flash.js',
    './changelog.js',
    './preguntas.json',
];

// ── Mensaje desde el cliente ──────────────────────────────────────
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// ── Instalación ───────────────────────────────────────────────────
// NO llamamos skipWaiting() aquí - lo hara el cliente.
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(PRECACHE))
            .catch(() => {})
    );
});

// ── Activación ────────────────────────────────────────────────────
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            ))
            .then(() => self.clients.claim())
            .then(() => self.clients.matchAll({ includeUncontrolled: true, type: 'window' }))
            .then(clients => {
                clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }));
            })
    );
});

// ── Fetch: Network-first para archivos del juego ─────────────────
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    if (url.origin !== self.location.origin) return;
    if (event.request.method !== 'GET') return;
    if (url.pathname.endsWith('sw.js')) return;

    const isGameFile = ['/index.html', '/styles.css', '/script.js',
                        '/anti-flash.js', '/changelog.js', '/preguntas.json', '/']
        .some(p => url.pathname === p || url.pathname.endsWith(p));

    if (isGameFile) {
        event.respondWith(
            fetch(event.request.clone())
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                if (!response || response.status !== 200) return response;
                const clone = response.clone();
                caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                return response;
            }).catch(() => cached);
        })
    );
});

// ── Notificación push: avisar a la página si está activa durante el juego ──
// Cuando llega una notificación push, notificamos a todos los clientes para
// que Klick Shield pueda registrar la interrupción si hay partida activa.
self.addEventListener('push', event => {
    // Mostrar la notificación normalmente
    const data = event.data ? event.data.json().catch(() => ({})) : Promise.resolve({});
    event.waitUntil(
        data.then(payload => {
            const title   = (payload && payload.title)   || 'Klick';
            const options = (payload && payload.options) || {};
            return Promise.all([
                self.registration.showNotification(title, options),
                self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
                    clients.forEach(client => client.postMessage({ type: 'PUSH_RECEIVED' }));
                })
            ]);
        })
    );
});
