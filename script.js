// ════════════════════════════════════════════════════════════════
//  KLICK — script.js  (núcleo de inicialización)
//
//  Este archivo contiene ÚNICAMENTE lo que no está en ningún módulo:
//    • Canvas de partículas del fondo principal
//    • Desbloqueo de AudioContext en iOS
//    • Inicialización global de la aplicación
//
//  Todos los demás sistemas están en los módulos 01-12.
// ════════════════════════════════════════════════════════════════

// ── Canvas de partículas principal (fondo reactivo al audio y racha) ──────────
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d', { alpha: true });
let particlesArray = [];
let fpsInterval = 1000 / playerStats.maxFps;
let then = performance.now();
let _cpFrame = 0;
let _smoothDelta = fpsInterval;
const _EMA_K = 0.12;

function initParticles() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesArray = [];
    const isMobile = window.innerWidth < 768;
    const area = canvas.width * canvas.height;
    let num = Math.round(Math.min(area / 15000, isMobile ? 30 : 60));
    for (let i = 0; i < num; i++) {
        particlesArray.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            dx: (Math.random() - 0.5) * 0.7,
            dy: (Math.random() - 0.5) * 0.7,
            s: Math.random() * 1.4 + 0.4
        });
    }
}

let _pIsLight = false, _pRgb = '0,255,102';

function updateAndDrawParticles(timeScale, pulse) {
    const m = streak >= 5 ? 2.5 : 1;
    const speedBoost = 1 + (pulse * 1.2);
    const sizeBoost = 1 + pulse * 0.8;
    const baseOpacity = streak >= 5 ? 0.65 : 0.42;
    const dynamicOpacity = Math.min(1, (_pIsLight ? baseOpacity * 2.2 : baseOpacity) * playerStats.particleOpacity + pulse * 0.12);
    const W = canvas.width, H = canvas.height;

    ctx.beginPath();
    ctx.fillStyle = `rgba(${_pRgb}, ${dynamicOpacity})`;

    for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        p.x += p.dx * m * timeScale * speedBoost;
        p.y += p.dy * m * timeScale * speedBoost;
        const r = (p.s + pulse * 1.0) * sizeBoost;
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
}

function connectParticles(pulse) {
    if (particlesArray.length < 2) return;
    if (!playerStats || playerStats.particleOpacity <= 0) return;
    const isStreak = streak >= 5;
    const baseOpacity = isStreak ? (_pIsLight ? 0.7 : 0.35) : (_pIsLight ? 0.4 : 0.18);
    const distMult = 1 + pulse * 0.3;
    const screenFactor = Math.min(1, (canvas.width * canvas.height) / (1920 * 1080));
    const maxDistSq = (canvas.width / 9) * (canvas.height / 9) * distMult * screenFactor;
    const pOp = playerStats.particleOpacity;
    const n = particlesArray.length;

    ctx.lineWidth = (0.6 + pulse * 0.8) * (isStreak ? 1.3 : 1);

    const BUCKETS = 8;
    const buckets = new Array(BUCKETS).fill(null).map(() => []);

    for (let a = 0; a < n; a++) {
        for (let b = a + 1; b < n; b++) {
            const dx = particlesArray[a].x - particlesArray[b].x;
            const dy = particlesArray[a].y - particlesArray[b].y;
            const distSq = dx * dx + dy * dy;
            if (distSq < maxDistSq) {
                const alpha = (1 - distSq / maxDistSq) * (baseOpacity + pulse * 0.1) * pOp;
                const bucketIdx = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS));
                buckets[bucketIdx].push(particlesArray[a].x, particlesArray[a].y, particlesArray[b].x, particlesArray[b].y);
            }
        }
    }

    for (let bi = 0; bi < BUCKETS; bi++) {
        const lines = buckets[bi];
        if (lines.length === 0) continue;
        const alpha = ((bi + 0.5) / BUCKETS).toFixed(2);
        ctx.strokeStyle = `rgba(${_pRgb},${alpha})`;
        ctx.beginPath();
        for (let i = 0; i < lines.length; i += 4) {
            ctx.moveTo(lines[i], lines[i + 1]);
            ctx.lineTo(lines[i + 2], lines[i + 3]);
        }
        ctx.stroke();
    }
}

function animateParticles(now) {
    requestAnimationFrame(animateParticles);
    const raw = now - then;
    if (raw < fpsInterval) return;

    then = now - (raw % fpsInterval);

    const clamped = Math.max(fpsInterval * 0.5, Math.min(raw, fpsInterval * 1.5));
    _smoothDelta = _smoothDelta + _EMA_K * (clamped - _smoothDelta);
    const timeScale = _smoothDelta / fpsInterval;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!playerStats || playerStats.particleOpacity <= 0) return;

    _pIsLight = document.body.classList.contains('light-mode');
    _pRgb = _pIsLight ? darkenRgb(currentRankInfo.rgb, 0.55) : currentRankInfo.rgb;
    const pulse = (audioAnalyser && audioCtx && audioCtx.state === 'running') ? getAudioPulse() : 0;
    updateAndDrawParticles(timeScale, pulse);
    if (streak >= 5 || pulse > 0.05 || (_cpFrame & 1) === 0) connectParticles(pulse);
    _cpFrame++;
}

// Resize con debounce
let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        initParticles();
        fpsInterval = 1000 / playerStats.maxFps;
        _smoothDelta = fpsInterval;
        const _po = document.getElementById('pcard-overlay');
        if (_po && _po.classList.contains('active')) {
            const _pc2 = document.getElementById('pcard-particle-canvas');
            if (_pc2) { _pc2.width = window.innerWidth; _pc2.height = window.innerHeight; }
        }
    }, 150);
});

// Resetear timer de partículas al volver a la pestaña (evita burst de velocidad)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        then = performance.now();
        _smoothDelta = fpsInterval;
        _unmuteByFocus();
    }
});

initParticles();
requestAnimationFrame(animateParticles);

// ── iOS / Safari: desbloquear AudioContext en el primer toque ─────────────────
function _iosAudioUnlock() {
    try {
        if (!audioCtx) initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
    _audioPausedByFocus = false;
}
document.addEventListener('touchstart', _iosAudioUnlock, { once: true, passive: true });
document.addEventListener('mousedown',  _iosAudioUnlock, { once: true, passive: true });

// ── Inicialización global ─────────────────────────────────────────────────────
// Se ejecuta 500ms después de que todos los módulos hayan cargado
setTimeout(() => {
    processDailyLogin();
    currentRankInfo = getRankInfo(playerStats);
    updateLogoDots();
    revokeInvalidAchievements();
    checkAchievements();
    submitLeaderboard();
    fetchLeaderboard();
    loadQuestions();
}, 500);
