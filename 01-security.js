// ════════════════════════════════════════════════════════════════
//  MÓDULO 01 — SEGURIDAD Y ANTI-TRAMPAS
//  Contenido: protecciones de teclado/ratón, gestión de foco,
//             penalización al tramposo, y generación de UUID.
// ════════════════════════════════════════════════════════════════

// --- Bloqueo de menús contextuales y atajos de DevTools ---
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
    if (e.keyCode === 123 ||
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) ||
        (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 67 || e.keyCode === 83 || e.keyCode === 80))) {
        e.preventDefault();
        return false;
    }
});

// Escape key — cerrar player card si está abierta
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && typeof closePlayerCard === 'function') closePlayerCard();
});

// --- Gestión de foco / visibilidad ---
// Silencia la música cuando el usuario sale de la pestaña y la restaura al volver.
// El anti-trampas actúa cuando hay partida activa.

let _cheaterCooldown = false;
let _audioPausedByFocus = false;

function _muteByFocus() {
    if (_audioPausedByFocus) return;
    _audioPausedByFocus = true;
    if (typeof audioCtx !== 'undefined' && audioCtx && typeof masterMusicGain !== 'undefined' && masterMusicGain) {
        const t = audioCtx.currentTime;
        masterMusicGain.gain.cancelScheduledValues(t);
        masterMusicGain.gain.setValueAtTime(masterMusicGain.gain.value, t);
        masterMusicGain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
        setTimeout(() => {
            if (_audioPausedByFocus && audioCtx && audioCtx.state === 'running') {
                audioCtx.suspend();
            }
        }, 100);
    }
}

function _unmuteByFocus() {
    if (!_audioPausedByFocus) return;
    _audioPausedByFocus = false;
    if (typeof audioCtx !== 'undefined' && audioCtx) {
        const doFade = () => {
            if (typeof masterMusicGain === 'undefined' || !masterMusicGain) return;
            const t = audioCtx.currentTime;
            const targetVol = (typeof playerStats !== 'undefined' ? playerStats.musicVol : 1.0) * 0.8;
            masterMusicGain.gain.cancelScheduledValues(t);
            masterMusicGain.gain.setValueAtTime(0.0001, t);
            masterMusicGain.gain.linearRampToValueAtTime(targetVol, t + 0.35);
        };
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(doFade).catch(() => {});
        } else {
            doFade();
        }
    }
}

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        _muteByFocus();
        if (typeof isAnsweringAllowed !== 'undefined' && isAnsweringAllowed &&
            typeof isGamePaused !== 'undefined' && !isGamePaused) {
            if (_cheaterCooldown) return; _cheaterCooldown = true;
            setTimeout(() => { _cheaterCooldown = false; }, 3000);
            punishCheater();
        }
    } else {
        // Resetear timer de partículas al volver para evitar burst de velocidad
        if (typeof then !== 'undefined') then = performance.now();
        if (typeof _smoothDelta !== 'undefined' && typeof fpsInterval !== 'undefined') _smoothDelta = fpsInterval;
        _unmuteByFocus();
    }
});

window.addEventListener('blur', () => {
    _muteByFocus();
    if (typeof isAnsweringAllowed !== 'undefined' && isAnsweringAllowed &&
        typeof isGamePaused !== 'undefined' && !isGamePaused) {
        if (_cheaterCooldown) return; _cheaterCooldown = true;
        setTimeout(() => { _cheaterCooldown = false; }, 3000);
        punishCheater();
    }
});

window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') {
        _unmuteByFocus();
    }
});

window.addEventListener('pagehide', () => {
    _muteByFocus();
});

function punishCheater() {
    if (typeof isAnsweringAllowed === 'undefined' || !isAnsweringAllowed) return;
    if (typeof isGamePaused !== 'undefined' && isGamePaused) return;

    isAnsweringAllowed = false;
    isGamePaused = false;
    if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
    if (typeof lives !== 'undefined') lives = 0;
    if (typeof _currentQuestion !== 'undefined') _currentQuestion = null;

    const penalty = 2000;
    if (typeof playerStats !== 'undefined') {
        playerStats.totalScore = Math.max(0, playerStats.totalScore - penalty);
        if (!playerStats.achievements.includes('tramposo')) {
            playerStats.achievements.push('tramposo');
        }
        if (typeof saveStatsLocally === 'function') saveStatsLocally();
        if (typeof submitLeaderboard === 'function') submitLeaderboard();
    }

    if (typeof initAudio === 'function') initAudio();
    if (typeof SFX !== 'undefined') SFX.incorrect();
    if (typeof showToast === 'function' && typeof SVG_SKULL !== 'undefined') {
        showToast('¡Trampa detectada!', 'Has recibido la marca permanente de Tramposo.', 'var(--accent-red)', SVG_SKULL);
    }

    const app = document.getElementById('app');
    if (app) app.classList.remove('streak-active');
    if (typeof streak !== 'undefined') streak = 0;
    if (typeof switchScreen === 'function') switchScreen('start-screen');
}

// --- Generación de UUID ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
