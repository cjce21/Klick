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

// --- Gestión de foco / visibilidad ---
// Silencia la música cuando el usuario sale de la pestaña y la restaura al volver.
// El anti-trampas actúa cuando hay partida activa.

let _cheaterCooldown = false;
let _audioPausedByFocus = false;

function _muteByFocus() {
    if (_audioPausedByFocus) return;
    _audioPausedByFocus = true;
    if (audioCtx && masterMusicGain) {
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
    if (audioCtx) {
        const doFade = () => {
            if (!masterMusicGain) return;
            const t = audioCtx.currentTime;
            const targetVol = playerStats.musicVol * 0.8;
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
        if (isAnsweringAllowed && !isGamePaused) {
            if (_cheaterCooldown) return; _cheaterCooldown = true;
            setTimeout(() => { _cheaterCooldown = false; }, 3000);
            punishCheater();
        }
    } else {
        _unmuteByFocus();
    }
});

window.addEventListener('blur', () => {
    _muteByFocus();
    if (isAnsweringAllowed && !isGamePaused) {
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
    if (!isAnsweringAllowed || isGamePaused) return;
    isAnsweringAllowed = false;
    isGamePaused = false;
    clearInterval(timerInterval);
    lives = 0;
    _currentQuestion = null;

    const penalty = 2000;
    playerStats.totalScore = Math.max(0, playerStats.totalScore - penalty);

    if (!playerStats.achievements.includes('tramposo')) {
        playerStats.achievements.push('tramposo');
    }

    saveStatsLocally();
    submitLeaderboard();

    initAudio(); SFX.incorrect();
    showToast('¡Trampa detectada!', 'Has recibido la marca permanente de Tramposo.', 'var(--accent-red)', SVG_SKULL);

    document.getElementById('app').classList.remove('streak-active');
    streak = 0;
    switchScreen('start-screen');
}

// --- Generación de UUID ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
