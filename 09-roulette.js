// ════════════════════════════════════════════════════════════════
//  MÓDULO 09 — RULETA DE RECOMPENSAS
//  Contenido: showRoulette, closeRoulette, spinRoulette,
//             applyPrize, updateRewardIndicator, partículas canvas.
//
//  DEPENDENCIAS: playerStats [03], SFX [04], showToast [07],
//                switchScreen [07], loadQuestion [08]
// ════════════════════════════════════════════════════════════════

let rouletteActive = false, currentPrize = null, deckAnimating = false;

// ── Partículas del overlay de ruleta ─────────────────────────────────────────
let rlCanvas = null, rlCtx = null, rlParticles = [], rlAnimFrame = null, rlThen = 0, rlColor = '255,184,0';

function initRlParticles(rgb) {
    rlColor = rgb || '255,184,0';
    rlCanvas = rlCanvas || document.getElementById('roulette-particles-canvas');
    if (!rlCanvas) return;
    rlCtx = rlCanvas.getContext('2d');
    rlParticles = [];
    const count = Math.min(60, Math.floor(rlCanvas.width * rlCanvas.height / 8000));
    for (let i = 0; i < count; i++) {
        rlParticles.push({
            x: Math.random() * rlCanvas.width,
            y: Math.random() * rlCanvas.height,
            s: Math.random() * 2.5 + 0.5,
            dx: (Math.random() - 0.5) * 0.7,
            dy: (Math.random() - 0.5) * 0.7
        });
    }
}

function animateRlParticles(now) {
    if (!rlAnimFrame) return; // cancelado externamente
    rlAnimFrame = requestAnimationFrame(animateRlParticles);
    const elapsed = now - rlThen;
    if (elapsed < 33) return;
    rlThen = now - (elapsed % 33);
    const timeScale = Math.min(elapsed / 33, 1.0);
    rlCtx.clearRect(0, 0, rlCanvas.width, rlCanvas.height);
    const W = rlCanvas.width, H = rlCanvas.height;
    rlCtx.beginPath();
    rlCtx.fillStyle = `rgba(${rlColor},0.55)`;
    for (let i = 0; i < rlParticles.length; i++) {
        const p = rlParticles[i];
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        p.x += p.dx * timeScale; p.y += p.dy * timeScale;
        rlCtx.moveTo(p.x + p.s, p.y);
        rlCtx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    }
    rlCtx.fill();
    // Líneas entre partículas cercanas
    const maxDistSq = (W / 10) * (H / 10);
    rlCtx.lineWidth = 0.6;
    const rlBuckets = 5;
    const rlLines = new Array(rlBuckets).fill(null).map(() => []);
    for (let a = 0; a < rlParticles.length; a++) {
        for (let b = a + 1; b < rlParticles.length; b++) {
            const dx = rlParticles[a].x - rlParticles[b].x;
            const dy = rlParticles[a].y - rlParticles[b].y;
            const dSq = dx*dx + dy*dy;
            if (dSq < maxDistSq) {
                const alpha = (1 - dSq / maxDistSq) * 0.25;
                const bi = Math.min(rlBuckets - 1, Math.floor(alpha * rlBuckets / 0.25));
                rlLines[bi].push(rlParticles[a].x, rlParticles[a].y, rlParticles[b].x, rlParticles[b].y);
            }
        }
    }
    for (let bi = 0; bi < rlBuckets; bi++) {
        const lines = rlLines[bi];
        if (!lines.length) continue;
        const alpha = (((bi + 0.5) / rlBuckets) * 0.25).toFixed(2);
        rlCtx.strokeStyle = `rgba(${rlColor},${alpha})`;
        rlCtx.beginPath();
        for (let i = 0; i < lines.length; i += 4) { rlCtx.moveTo(lines[i], lines[i+1]); rlCtx.lineTo(lines[i+2], lines[i+3]); }
        rlCtx.stroke();
    }
}

// Patch showRoulette (la función base viene del script original)
const _origShowRoulette = typeof showRoulette !== 'undefined' ? showRoulette : null;
if (_origShowRoulette) {
    showRoulette = function() {
        _origShowRoulette.apply(this, arguments);
        // Stop any existing loop before restarting
        if (rlAnimFrame) { cancelAnimationFrame(rlAnimFrame); rlAnimFrame = null; }
        if (!rlCanvas) rlCanvas = document.getElementById('roulette-particles-canvas');
        if (rlCanvas) { rlCanvas.width = window.innerWidth || 320; rlCanvas.height = window.innerHeight || 568; }
        initRlParticles(currentRankInfo ? currentRankInfo.rgb : '255,184,0');
        rlThen = performance.now();
        rlAnimFrame = requestAnimationFrame(animateRlParticles);
    };
}

// ── Indicador de recompensa activa (barra sobre las respuestas) ──────────────
function updateRewardIndicator() {
    const bar    = document.getElementById('active-reward-bar');
    const iconEl = document.getElementById('active-reward-icon');
    const textEl = document.getElementById('active-reward-text');
    if (!bar) return;
    let label = '', icon = '', color = '';
    if (activeBoostNextQ === 'boost')        { label = 'Puntos x2 activo';     icon = 'x2'; color = '#ffb800'; }
    else if (activeBoostNextQ === 'triple')  { label = 'Turbo x3 activo';      icon = 'x3'; color = '#ccff00'; }
    else if (activeBoostNextQ === 'jackpot') { label = 'Jackpot x4 activo';    icon = 'x4'; color = '#ff0090'; }
    else if (shieldActive)                   { label = 'Escudo activo';         icon = '🛡'; color = '#00d4ff'; }
    else if (hintActive)                     { label = 'Pista lista';           icon = '?';  color = '#f77f00'; }
    else if (extraTimeActive > 0)            { label = `+${extraTimeActive}s de tiempo`; icon = '+t'; color = extraTimeActive >= 8 ? '#00ffcc' : '#00ff66'; }
    else if (streakShieldActive)             { label = 'Racha protegida';       icon = 'R+'; color = '#aaaaff'; }
    if (label) {
        iconEl.textContent = icon; textEl.textContent = label; textEl.style.color = color;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}

function closeRoulette() {
    const overlay = document.getElementById('roulette-overlay');
    overlay.classList.remove('active');
    rouletteActive = false; currentPrize = null; deckAnimating = false; isGamePaused = false;
    // Stop particle animation loop
    if (rlAnimFrame) { cancelAnimationFrame(rlAnimFrame); rlAnimFrame = null; }
    const _hint = hintActive;
    if (_hint) hintActive = false;
    switchScreen('question-screen');
    updateRewardIndicator();
    setTimeout(() => {
        loadQuestion();
        if (_hint) setTimeout(applyHintVisual, 180);
    }, 300);
}
