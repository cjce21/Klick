// ════════════════════════════════════════════════════════════════
//  MÓDULO 12 — SERVICE WORKER / AUTO-ACTUALIZACIÓN
//  Contenido: registro del SW, banner de "nueva versión",
//             auto-recarga inteligente (no interrumpe partida).
// ════════════════════════════════════════════════════════════════

(function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    let _bannerShown = false;
    function _showUpdateBanner() {
        if (_bannerShown) return;
        _bannerShown = true;
        if (document.getElementById('sw-update-banner')) return;
        const b = document.createElement('div');
        b.id = 'sw-update-banner';
        Object.assign(b.style, {
            position: 'fixed', bottom: '18px', left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(10,10,15,0.92)', color: '#fff', fontSize: '0.78rem',
            padding: '10px 22px', borderRadius: '50px', zIndex: '99999',
            border: '1px solid rgba(255,255,255,0.18)', backdropFilter: 'blur(12px)',
            fontFamily: 'Inter,sans-serif', letterSpacing: '0.4px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)', cursor: 'pointer',
            userSelect: 'none', whiteSpace: 'nowrap',
        });
        b.innerHTML = 'Nueva versión disponible &nbsp;<strong>— toca para actualizar</strong>';
        b.addEventListener('click', () => window.location.reload());
        document.body.appendChild(b);
        _scheduleAutoReload();
    }

    function _scheduleAutoReload() {
        const check = () => {
            const qs     = document.getElementById('question-screen');
            const livesVal = (typeof lives !== 'undefined') ? lives : 0;
            const inGame = qs && qs.classList.contains('active') && livesVal > 0 &&
                           (typeof isAnsweringAllowed !== 'undefined') && isAnsweringAllowed;
            if (!inGame) { window.location.reload(); }
            else         { setTimeout(check, 5000); }
        };
        setTimeout(check, 800);
    }

    let _skipSent = false;
    function _activatePendingSW(sw) {
        if (_skipSent) return;
        _skipSent = true;
        sw.postMessage({ type: 'SKIP_WAITING' });
    }

    navigator.serviceWorker.register('./sw.js').then(reg => {
        if (reg.waiting) { _activatePendingSW(reg.waiting); }
        reg.addEventListener('updatefound', () => {
            const incoming = reg.installing;
            if (!incoming) return;
            incoming.addEventListener('statechange', () => {
                if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
                    _activatePendingSW(incoming);
                }
            });
        });
        setInterval(() => reg.update(), 3 * 60 * 1000);
    }).catch(() => {});

    let _ccTimer = null;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(_ccTimer);
        _ccTimer = setTimeout(() => _showUpdateBanner(), 80);
    });

    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_UPDATED') { _showUpdateBanner(); }
    });
})();
