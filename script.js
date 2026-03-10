// ═══════════════════════════════════════════════════════════════════════════
//  KLICK SHIELD v2 — Sistema de Detección y Sanción
//
//  Principio: ningún evento aislado genera sanción. El sistema recolecta
//  señales durante la partida, las pondera, aplica atenuantes al terminar,
//  y solo actúa cuando la evidencia acumulada es inequívoca.
//
//  Fases:
//   1. Recolección silenciosa de señales (durante partida)
//   2. Análisis post-partida con atenuantes (nunca interrumpe el juego)
//   3. Escalada de sanciones por infracciones acumuladas (máx. 24 h)
//
//  Protecciones especiales para iPad/Safari: blur y poll ponderados a la
//  mitad; resize ignorado en tablet; poll cada 10 s en lugar de 3 s.
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (typeof isAnsweringAllowed !== 'undefined' && isAnsweringAllowed)
        _ksAddSignal('contextmenu', 3);
});

document.addEventListener('keydown', (e) => {
    const k    = e.keyCode || e.which;
    const ctrl = e.ctrlKey || e.metaKey;
    const sh   = e.shiftKey;
    const game = typeof isAnsweringAllowed !== 'undefined' && isAnsweringAllowed;
    // Bloquear DevTools, fuente, guardar, imprimir, buscar, sel-all, zoom
    if (k === 123) { e.preventDefault(); return false; }
    if (ctrl && sh && (k===73||k===74||k===67||k===75)) { e.preventDefault(); return false; }
    if (ctrl && (k===85||k===83||k===80||k===65||k===70||k===71||k===72)) { e.preventDefault(); return false; }
    if (ctrl && (k===187||k===61||k===189||k===173||k===48)) { e.preventDefault(); return false; }
    // Registrar capturas de pantalla (no se pueden bloquear)
    if (game) {
        if (k === 44) _ksAddSignal('printscreen_key', 7);
        if (ctrl && sh && (k===51||k===52||k===53)) _ksAddSignal('screenshot_key', 7);
        if (e.metaKey && sh && k === 83) _ksAddSignal('screenshot_key', 7);
    }
}, { capture: true });

// ── Estado de silencio por pérdida de foco ───────────────────────────────
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
            if (_audioPausedByFocus && audioCtx && audioCtx.state === 'running') audioCtx.suspend();
        }, 100);
    }
}

function _unmuteByFocus() {
    if (!_audioPausedByFocus) return;
    _audioPausedByFocus = false;
    if (audioCtx) {
        const doFade = () => {
            const t = audioCtx.currentTime;
            if (masterMusicGain && !_architectMusicActive) {
                const targetVol = playerStats.musicVol * 0.8;
                masterMusicGain.gain.cancelScheduledValues(t);
                masterMusicGain.gain.setValueAtTime(0.0001, t);
                masterMusicGain.gain.linearRampToValueAtTime(targetVol, t + 0.35);
            }
            if (_architectMusicActive && _architectGain) {
                const targetVol = playerStats.musicVol * 0.75;
                _architectGain.gain.cancelScheduledValues(t);
                _architectGain.gain.setValueAtTime(0.0001, t);
                _architectGain.gain.linearRampToValueAtTime(targetVol, t + 0.35);
                if (!_architectMusicTimer) _architectTick();
            }
        };
        if (audioCtx.state === 'suspended') audioCtx.resume().then(doFade).catch(() => {});
        else doFade();
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  KLICK SHIELD — Detección de dispositivo iPad/Safari
// ══════════════════════════════════════════════════════════════════════════
function _isIpadSafari() {
    const ua  = navigator.userAgent || '';
    const mtp = navigator.maxTouchPoints || 0;
    const sw  = window.screen.width;
    if (/iPad/.test(ua)) return true;
    if (navigator.platform === 'MacIntel' && mtp > 1) return true; // iPadOS 13+
    if (mtp >= 2 && sw >= 768 && /Safari/.test(ua) && !/Chrome/.test(ua)) return true;
    return false;
}
const _KS_IS_IPAD = _isIpadSafari();

// ══════════════════════════════════════════════════════════════════════════
//  KLICK SHIELD v4 — Sistema completo de detección y señales
// ══════════════════════════════════════════════════════════════════════════

// ── Estado global de la partida ──────────────────────────────────────────
let _ksWeight      = 0;
let _ksSignals     = [];
let _ksLastBlurTs  = 0;
let _ksLastVisTs   = 0;
let _ksFocusLostTs = 0;
let _ksNoFocusSecs = 0;
let _ksResizeTimer = null;
let _gameWindowW   = window.innerWidth;
let _gameWindowH   = window.innerHeight;
let _ksRespTimings = [];
let _ksQStartTs    = 0;
let _ksScrollSpikes   = 0;
let _ksLastScrollY    = 0;
let _ksLastPtrTs      = Date.now();
let _ksAlertCooldownTs = 0;
// iOS signals
let _ksIosHiddenTs     = 0;
let _ksIosMultitaskTs  = 0;
let _ksIosBlurOnlyTs   = 0;
// visualViewport
let _ksVvLastScale = (window.visualViewport ? window.visualViewport.scale : 1);
let _ksVvLastW     = (window.visualViewport ? window.visualViewport.width : window.innerWidth);
// TTS / Mic
let _ksTtsWasIdle  = true;
window._ksActiveMicTracks = [];
// AssistiveTouch
let _ksAssistTapHistory = [];
// Window geometry (para Stage Manager / ventana flotante)
let _ksWinX = (window.screenX || 0);
let _ksWinY = (window.screenY || 0);
let _ksWinOW = window.outerWidth;
let _ksWinOH = window.outerHeight;
// ── Split-screen tracking ────────────────────────────────────────────────
// Estado de si la ventana está en modo split ahora mismo
let _ksSplitActive     = false;
let _ksSplitEnterTs    = 0;    // cuando entró al split
let _ksSplitInteractTs = 0;    // timestamp de última interacción DURANTE split

function _ksReset() {
    _ksWeight = 0; _ksSignals = [];
    _ksLastBlurTs = 0; _ksLastVisTs = 0;
    _ksFocusLostTs = 0; _ksNoFocusSecs = 0;
    _ksRespTimings = []; _ksQStartTs = 0;
    _ksScrollSpikes = 0; _ksLastScrollY = window.scrollY || 0;
    _ksLastPtrTs = Date.now(); _ksAssistTapHistory = [];
    _ksWinX = (window.screenX || 0); _ksWinY = (window.screenY || 0);
    _ksWinOW = window.outerWidth; _ksWinOH = window.outerHeight;
    _ksSplitActive = false; _ksSplitEnterTs = 0; _ksSplitInteractTs = 0;
    _ksTtsWasIdle = true;
    // NO resetear _ksGameActive aquí — se gestiona en _start/_stopAntiCheatPoll
}

// _ksGameActive: true mientras una partida esté en curso (incluyendo entre preguntas/feedback)
let _ksGameActive = false;

function _ksAddSignal(name, pts) {
    // Aceptar si hay partida activa (isAnsweringAllowed) O si el juego está en pausa/feedback
    // pero la partida no ha terminado (_ksGameActive)
    if (!_ksGameActive && !isAnsweringAllowed && !isGamePaused) return;
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return;
    _ksWeight += pts;
    _ksSignals.push(name);
    if (pts >= 6) _ksShowSilentAlert();
}

// ── Toast discreto in-game ────────────────────────────────────────────────
function _ksShowSilentAlert() {
    const now = Date.now();
    if (now - _ksAlertCooldownTs < 11000) return;
    _ksAlertCooldownTs = now;
    const prev = document.getElementById('ks-ingame-alert');
    if (prev) prev.remove();
    const el = document.createElement('div');
    el.id = 'ks-ingame-alert';
    el.className = 'ks-silent-alert';
    el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Actividad registrada</span>';
    document.body.appendChild(el);
    requestAnimationFrame(() => el.classList.add('ks-silent-alert-visible'));
    setTimeout(() => {
        el.classList.remove('ks-silent-alert-visible');
        setTimeout(() => { try { el.remove(); } catch(_){} }, 450);
    }, 3200);
}

// ══ Listeners: visibilidad y foco ════════════════════════════════════════

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        _muteByFocus();
        const now = Date.now();
        _ksLastVisTs = now;
        if (_ksFocusLostTs === 0) _ksFocusLostTs = now;
        const blurFirst = (now - _ksLastBlurTs) < 250;
        // blurFirst = blur justo antes → cambio de pestaña o Alt+Tab clásico
        // solo visibility → minimizar, notificación de OS, bloqueo de pantalla
        if (blurFirst) {
            _ksAddSignal('tab_switch', 6);      // cambio de pestaña / Alt+Tab
        } else {
            _ksAddSignal('window_minimize', 5); // minimizar / lock screen / notificación OS
        }
        _ksIosHiddenTs    = now;
        _ksIosMultitaskTs = now;
        // Split: si salió a otra app mientras la ventana estaba en split
        if (_ksSplitActive && isAnsweringAllowed) {
            _ksSplitInteractTs = now;
            _ksAddSignal('split_app_switch', 6);
        }
    } else {
        _unmuteByFocus();
        if (_ksFocusLostTs > 0) { _ksNoFocusSecs += (Date.now() - _ksFocusLostTs) / 1000; _ksFocusLostTs = 0; }
        if (isAnsweringAllowed) {
            const hiddenMs = Date.now() - _ksIosHiddenTs;
            if (_ksIosHiddenTs > 0 && hiddenMs > 0 && hiddenMs < 180)
                _ksAddSignal('ios_screenshot_flash', 7);
            if (_ksIosMultitaskTs > 0 && hiddenMs >= 300 && hiddenMs <= 1200)
                _ksAddSignal('ios_quick_app_switch', 5);
        }
        _ksIosHiddenTs = 0; _ksIosMultitaskTs = 0;
    }
});

window.addEventListener('blur', () => {
    _muteByFocus();
    const now = Date.now();
    _ksLastBlurTs = now;
    if (_ksFocusLostTs === 0) _ksFocusLostTs = now;
    // Solo añadir señal de blur si ya hay al menos 3 respuestas registradas (evita falsos positivos al cargar)
    if (_ksRespTimings.length >= 3) {
        _ksAddSignal('blur', _KS_IS_IPAD ? 0.6 : 2);
    }
    // Desktop: blur sin visibilitychange inmediato = minimizar ventana o Alt+Tab rápido
    // Aumentado a 400ms para evitar falsos positivos con notificaciones del sistema
    if (!_KS_IS_IPAD && window.screen.width > 480) {
        setTimeout(() => {
            if (_ksFocusLostTs > 0 && document.visibilityState === 'visible' && !document.hasFocus()) {
                // Sigue visible pero sin foco = otra ventana en primer plano (Alt+Tab / minimizar)
                // Solo sumar si hay partida activa con suficientes respuestas
                if (_ksRespTimings.length >= 3) {
                    _ksAddSignal('window_minimized_or_alttab', 4);
                }
            }
        }, 400);
    }
    // iOS: blur sin visibility→hidden = Control Center / Siri lateral
    if (_KS_IS_IPAD && isAnsweringAllowed) {
        _ksIosBlurOnlyTs = now;
        setTimeout(() => {
            if (_ksIosBlurOnlyTs > 0 && document.visibilityState === 'visible' && isAnsweringAllowed)
                _ksAddSignal('ios_control_center', 3);
            _ksIosBlurOnlyTs = 0;
        }, 280);
    }
    // Split: pérdida de foco con split activo = interacción en la otra mitad
    if (_ksSplitActive && isAnsweringAllowed) {
        _ksSplitInteractTs = now;
        _ksAddSignal('split_focus_lost', 5);
    }
});

window.addEventListener('focus', () => {
    if (document.visibilityState === 'visible') {
        _unmuteByFocus();
        if (_ksFocusLostTs > 0) { _ksNoFocusSecs += (Date.now() - _ksFocusLostTs) / 1000; _ksFocusLostTs = 0; }
    }
    _ksIosBlurOnlyTs = 0;
});

window.addEventListener('pagehide', (e) => {
    _muteByFocus();
    if (isAnsweringAllowed && !e.persisted) _ksAddSignal('page_unload_game', 8);
});

// ── Resize / split-screen ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
    if (_KS_IS_IPAD || window.screen.width <= 480) return;
    clearTimeout(_ksResizeTimer);
    _ksResizeTimer = setTimeout(() => {
        if (!isAnsweringAllowed && !isGamePaused) return;
        const shrunkW = window.innerWidth  < _gameWindowW * 0.60;
        const shrunkH = window.innerHeight < _gameWindowH * 0.58;
        const splitW  = (window.innerWidth  / window.screen.width)  < 0.52;
        const splitH  = (window.innerHeight / window.screen.height) < 0.42;
        const isSplit = shrunkW || shrunkH || splitW || splitH;
        if (isSplit) {
            if (!_ksSplitActive) {
                _ksSplitActive  = true;
                _ksSplitEnterTs = Date.now();
                _ksAddSignal('split_enter', 5);
            }
            _ksAddSignal('resize', 4);
        } else {
            if (_ksSplitActive) {
                // Al cerrar el split, si usó la otra ventana → señal acumulada de uso
                if (_ksSplitInteractTs > 0 && (Date.now() - _ksSplitEnterTs) < 120000)
                    _ksAddSignal('split_used', 7);
                _ksSplitActive = false; _ksSplitEnterTs = 0; _ksSplitInteractTs = 0;
            }
        }
    }, 650);
});

// ── Scroll de página ──────────────────────────────────────────────────────
document.addEventListener('scroll', () => {
    if (!isAnsweringAllowed) return;
    const dy = Math.abs((window.scrollY || 0) - _ksLastScrollY);
    _ksLastScrollY = window.scrollY || 0;
    if (dy > 200) { _ksScrollSpikes++; if (_ksScrollSpikes >= 2) _ksAddSignal('page_scroll', 4); }
    // Scroll con split activo = probablemente está leyendo contenido en otra ventana
    if (_ksSplitActive && dy > 60) {
        _ksSplitInteractTs = Date.now();
        _ksAddSignal('split_scroll', 4);
    }
}, { passive: true });

// ── Movimiento de puntero / pointer events ────────────────────────────────
document.addEventListener('pointermove', () => { _ksLastPtrTs = Date.now(); }, { passive: true });
document.addEventListener('pointerdown', () => {
    _ksLastPtrTs = Date.now();
    // Clic con split activo = pudo haber clicado en la otra ventana y vuelto
    if (_ksSplitActive && isAnsweringAllowed) {
        _ksSplitInteractTs = Date.now();
        _ksAddSignal('split_click', 4);
    }
}, { passive: true });

// ── Polling de foco ──────────────────────────────────────────────────────
let _antiCheatPollTimer = null;
function _startAntiCheatPoll() {
    _ksGameActive = true;
    _stopAntiCheatPoll();
    const interval   = _KS_IS_IPAD ? 5000 : 3000;
    const minNoFocus = _KS_IS_IPAD ? 4 : 3;
    _antiCheatPollTimer = setInterval(() => {
        if (!_ksGameActive && !isAnsweringAllowed && !isGamePaused) return;
        const hidden  = document.visibilityState === 'hidden' || document.hidden;
        const noFocus = !document.hasFocus();
        if (hidden || noFocus) {
            _muteByFocus();
            if (_ksFocusLostTs === 0) _ksFocusLostTs = Date.now();
            const secsLost = (Date.now() - _ksFocusLostTs) / 1000;
            if (secsLost >= minNoFocus) {
                _ksAddSignal('poll_nofocus', _KS_IS_IPAD ? 3 : 4);
                _ksFocusLostTs = Date.now();
            }
        } else {
            // Recuperó foco: acumular tiempo perdido
            if (_ksFocusLostTs > 0) { _ksNoFocusSecs += (Date.now() - _ksFocusLostTs) / 1000; _ksFocusLostTs = 0; }
        }
        // Puntero ausente >35s en desktop = bot o app externa
        if (!_KS_IS_IPAD && window.screen.width > 480) {
            if ((Date.now() - _ksLastPtrTs) > 35000) _ksAddSignal('pointer_absent', 5);
        }
        // Tiempo total fuera de foco en la sesión > 20s = sospechoso
        if (_ksNoFocusSecs > 20 && isAnsweringAllowed) {
            _ksAddSignal('extended_nofocus', Math.min(Math.floor(_ksNoFocusSecs / 10), 5));
            _ksNoFocusSecs = 0; // reset para no duplicar
        }
    }, interval);
}
function _stopAntiCheatPoll() {
    _ksGameActive = false;
    if (_antiCheatPollTimer) { clearInterval(_antiCheatPollTimer); _antiCheatPollTimer = null; }
}

// ══ Monitores de exploit ══════════════════════════════════════════════════

// ── Copy / paste ──────────────────────────────────────────────────────────
document.addEventListener('copy',  () => { if (isAnsweringAllowed) _ksAddSignal('clipboard_copy',  3); });
document.addEventListener('paste', () => { if (isAnsweringAllowed) _ksAddSignal('clipboard_paste', 7); });

// ── Print / screenshot ────────────────────────────────────────────────────
window.addEventListener('beforeprint', () => { if (isAnsweringAllowed) _ksAddSignal('print_dialog', 7); });

// ── PiP ──────────────────────────────────────────────────────────────────
document.addEventListener('enterpictureinpicture', () => { if (isAnsweringAllowed) _ksAddSignal('pip_enter', 8); });

// ── TTS (iOS Speak Screen, lectores, asistentes) ─────────────────────────
setInterval(() => {
    if (!isAnsweringAllowed || !window.speechSynthesis) return;
    const active = window.speechSynthesis.speaking || window.speechSynthesis.pending;
    if (active && _ksTtsWasIdle) { _ksAddSignal('tts_speaking', 8); _ksTtsWasIdle = false; }
    else if (!active) _ksTtsWasIdle = true;
}, 1500);

// ── Reconocimiento de voz (SpeechRecognition) ────────────────────────────
// Parche al SpeechRecognition para detectar activación durante el juego
(function _patchSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const _origStart = SR.prototype.start;
    SR.prototype.start = function(...args) {
        if (isAnsweringAllowed) _ksAddSignal('speech_recognition', 9);
        return _origStart.apply(this, args);
    };
})();

// ── getUserMedia: micrófono activo ────────────────────────────────────────
(function _patchGUM() {
    try {
        const orig = navigator.mediaDevices && navigator.mediaDevices.getUserMedia
            ? navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices) : null;
        if (!orig) return;
        navigator.mediaDevices.getUserMedia = async function(c) {
            const stream = await orig(c);
            if (c && c.audio) {
                const tracks = stream.getAudioTracks();
                window._ksActiveMicTracks = (window._ksActiveMicTracks || []).concat(tracks);
                tracks.forEach(t => t.addEventListener('ended', () => {
                    window._ksActiveMicTracks = (window._ksActiveMicTracks || []).filter(x => x !== t);
                }));
                if (isAnsweringAllowed) _ksAddSignal('mic_opened', 9);
            }
            return stream;
        };
    } catch(_) {}
})();

// ── DevTools ─────────────────────────────────────────────────────────────
(function _watchDevTools() {
    if (_KS_IS_IPAD || window.screen.width <= 480) return;
    setInterval(() => {
        if (!isAnsweringAllowed || isGamePaused) return;
        if ((window.outerWidth - window.innerWidth) > 200 || (window.outerHeight - window.innerHeight) > 200)
            _ksAddSignal('devtools_open', 5);
    }, 3200);
})();

// ── visualViewport: zoom / Slide Over / Share Sheet ──────────────────────
if (window.visualViewport) {
    let _vvTimer = null;
    window.visualViewport.addEventListener('resize', () => {
        clearTimeout(_vvTimer);
        _vvTimer = setTimeout(() => {
            if (!isAnsweringAllowed && !isGamePaused) return;
            const sc = window.visualViewport.scale;
            const w  = window.visualViewport.width;
            if (sc > _ksVvLastScale * 1.3 && sc > 1.4)         _ksAddSignal('vv_zoom_in',  5);
            if (w  < _ksVvLastW * 0.72)                        _ksAddSignal('vv_shrink',   7);
            if (_KS_IS_IPAD && sc > 1.9 && sc > _ksVvLastScale * 1.6) _ksAddSignal('ios_a11y_zoom', 7);
            _ksVvLastScale = sc; _ksVvLastW = w;
        }, 450);
    });
    window.visualViewport.addEventListener('scroll', () => {
        if (!isAnsweringAllowed) return;
        if (Math.abs(window.visualViewport.offsetTop) > 55) _ksAddSignal('vv_scroll', 4);
        // Scroll en viewport con split activo
        if (_ksSplitActive) {
            _ksSplitInteractTs = Date.now();
            _ksAddSignal('split_vv_scroll', 4);
        }
    });
}

// ── Overlays externos (extensions, asistentes) ───────────────────────────
(function _watchOverlays() {
    const _ownIds  = new Set(['ks-ingame-alert','ks-modal-overlay','roulette-overlay',
        'onboarding-overlay','powerup-overlay','endgame-overlay']);
    const _ownPfx  = ['ks-','toast-','klick-'];
    const obs = new MutationObserver((mutations) => {
        if (!isAnsweringAllowed || isGamePaused) return;
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                const id  = node.id   || '';
                const cls = typeof node.className === 'string' ? node.className : '';
                if (_ownIds.has(id) || _ownPfx.some(p => id.startsWith(p) || cls.includes(p))) continue;
                try {
                    const st = window.getComputedStyle(node);
                    if ((st.position === 'fixed' || st.position === 'absolute') && parseInt(st.zIndex) > 8000)
                        _ksAddSignal('external_overlay', 8);
                } catch(_) {}
            }
        }
    });
    obs.observe(document.body, { childList: true, subtree: false });
})();

// ── Stage Manager / ventana flotante (desktop) ────────────────────────────
(function _watchWindowGeometry() {
    if (window.screen.width <= 480) return;
    setInterval(() => {
        if (!isAnsweringAllowed || isGamePaused) return;
        const nx = window.screenX || 0, ny = window.screenY || 0;
        const nw = window.outerWidth, nh = window.outerHeight;
        if (!_KS_IS_IPAD) {
            if (Math.abs(nx - _ksWinX) > 100 || Math.abs(ny - _ksWinY) > 100) _ksAddSignal('window_moved',  4);
            if (nw < _ksWinOW * 0.62 || nh < _ksWinOH * 0.58)                 _ksAddSignal('window_shrunk', 6);
        }
        _ksWinX = nx; _ksWinY = ny; _ksWinOW = nw; _ksWinOH = nh;
    }, 2200);
})();

// ── iOS AssistiveTouch (tap repetido en borde de pantalla) ────────────────
document.addEventListener('touchend', (e) => {
    if (!isAnsweringAllowed || !_KS_IS_IPAD) return;
    if (e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const x = Math.round(t.clientX), y = Math.round(t.clientY), now = Date.now();
    _ksAssistTapHistory.push({ x, y, t: now });
    if (_ksAssistTapHistory.length > 10) _ksAssistTapHistory.shift();
    const recent = _ksAssistTapHistory.filter(h => now - h.t < 4000);
    if (recent.length >= 3) {
        const near = recent.filter(h => Math.hypot(h.x - x, h.y - y) < 35);
        const edge = x < 65 || x > window.innerWidth - 65 || y < 65 || y > window.innerHeight - 65;
        if (near.length >= 3 && edge) { _ksAddSignal('ios_assistivetouch', 6); _ksAssistTapHistory = []; }
    }
}, { passive: true });

// ── iOS multi-touch 3+ dedos ──────────────────────────────────────────────
document.addEventListener('touchstart', (e) => {
    if (!isAnsweringAllowed || !_KS_IS_IPAD) return;
    if (e.touches.length >= 3) _ksAddSignal('ios_multi3touch', 5);
}, { passive: true });

// ── Orientación ──────────────────────────────────────────────────────────
let _ksLastOrient = (screen.orientation && screen.orientation.type) || String(window.orientation || '');
const _ksHandleOrient = () => {
    if (!isAnsweringAllowed) return;
    const cur = (screen.orientation && screen.orientation.type) || String(window.orientation || '');
    if (cur !== _ksLastOrient) {
        _ksAddSignal(_KS_IS_IPAD ? 'ios_orientation' : 'orientation_change', _KS_IS_IPAD ? 2 : 3);
        _ksLastOrient = cur;
    }
};
window.addEventListener('orientationchange', _ksHandleOrient);
if (screen.orientation) screen.orientation.addEventListener('change', _ksHandleOrient);

// ── Análisis de timing ────────────────────────────────────────────────────
function _ksCheckTimingPattern() {
    if (_ksRespTimings.length < 6) return;
    const last6 = _ksRespTimings.slice(-6).map(r => r.ms);
    const avg   = last6.reduce((a,b) => a+b, 0) / 6;
    const vari  = last6.reduce((a,b) => a + Math.pow(b-avg, 2), 0) / 6;
    if (vari < 400 && avg < 900)                                       _ksAddSignal('autoclicker_timing', 9);
    if (last6.every(ms => Math.abs(ms - last6[0]) < 85) && avg < 1200) _ksAddSignal('macro_fixed_interval', 10);
    if (last6.every((ms,i) => i===0 || ms < last6[i-1]-30) && avg<700) _ksAddSignal('adaptive_bot', 8);
}

// ── Registro de tiempo de respuesta ──────────────────────────────────────
function _ksMarkQuestionStart() { _ksQStartTs = Date.now(); }

function _ksRecordAnswer(isCorrect) {
    if (_ksQStartTs === 0) return;
    const ms = Date.now() - _ksQStartTs;
    _ksRespTimings.push({ ms, correct: isCorrect });
    _ksQStartTs = 0;
    if (ms < 280) { _ksAddSignal('answer_impossible', 5); return; }
    if (ms < 400) {
        const fastCount = _ksRespTimings.filter(r => r.ms < 400).length;
        _ksAddSignal('answer_fast', fastCount >= 3 ? 4 : 1);
    }
    if (_ksRespTimings.length >= 5) {
        const last5 = _ksRespTimings.slice(-5);
        const allFast    = last5.every(r => r.ms < 600);
        const allCorrect = last5.every(r => r.correct);
        const anyFail    = last5.some(r => !r.correct);
        if (allFast && allCorrect) _ksAddSignal('bot_pattern', 8);
        if (allFast && anyFail)    _ksWeight = Math.max(0, _ksWeight - 4);
    }
    try { _ksCheckTimingPattern(); } catch(_) {}
    // Responder con split activo = buscó en la otra ventana
    if (_ksSplitActive) {
        _ksSplitInteractTs = Date.now();
        _ksAddSignal('split_answer', 8);
    }
}

// ══════════════════════════════════════════════════════════════════════════
//  KLICK SHIELD — Análisis post-partida
// ══════════════════════════════════════════════════════════════════════════
// ══ Sistema de advertencias (3 antes de sancionar) ═══════════════════════
// ksWarnings: array de {date, weight, signals} — no tienen penalización
// Solo después de 3 advertencias activas (últimos 30 días) se sanciona
function _ksAnalyzeSession(sessionAbandoned) {
    const isAdmin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    if (isAdmin) { _ksReset(); return; }

    let weight = _ksWeight;
    if (weight <= 0) { _ksReset(); return; }

    const gamesPlayed  = playerStats.gamesPlayed || 0;
    const bestScore    = playerStats.bestScore    || 0;
    const sessionScore = _ksSessionScore || 0;
    // Usar solo los timings de esta sesión — totalWrong/totalTimeouts son de carrera
    // y siempre serían > 0 para cualquier jugador con historial, dando un falso reductor
    const hasAnyFail   = _ksRespTimings.some(r => !r.correct);
    const hasTimeout   = _ksRespTimings.length > 0 && _ksRespTimings.some(r => r.ms >= 14500);

    if (gamesPlayed <= 3)         weight *= 0.50;  // cuenta muy nueva
    if (gamesPlayed >= 30)        weight *= 0.80;
    if (bestScore > 0 && sessionScore <= bestScore * 1.35) weight *= 0.85;
    if (hasAnyFail || hasTimeout) weight *= 0.70;
    if (_KS_IS_IPAD)              weight *= 0.82;
    if (sessionAbandoned)         weight *= 0.50;

    weight = Math.round(weight);

    if (weight <= 6) {
        // Sesión limpia — mostrar feedback positivo si hay partida completa
        if (!sessionAbandoned) _ksShowPostGameFeedback('clean', weight);
        _ksReset(); return;
    }

    const now     = new Date().toISOString();
    const signals = [..._ksSignals];
    const capturedWeight = weight;
    _ksReset();

    // ── Nivel bajo: acumular sesiones sospechosas ──
    if (weight <= 11) {
        const sus = playerStats.ksSuspicious || [];
        sus.push({ date: now, weight, signals });
        if (sus.length > 20) sus.splice(0, sus.length - 20);
        playerStats.ksSuspicious = sus;
        const sevenDays = Date.now() - 7 * 24 * 3600 * 1000;
        // Solo contar las sesiones sospechosas normales (no revisiones ya abiertas)
        const recentSus = sus.filter(x => new Date(x.date).getTime() > sevenDays && !x.type);
        if (recentSus.length >= 3) {
            // Acumuló 3 sesiones sospechosas → abrir revisión (NO advertencia formal)
            // Limpiar solo las sospechosas normales, conservar marcas de review
            playerStats.ksSuspicious = sus.filter(x => x.type);
            _ksOpenReview(now, capturedWeight, signals);
        } else {
            _ksShowPostGameFeedback('watch', capturedWeight);
        }
        saveStatsLocally(); submitLeaderboard(); return;
    }

    // ── Nivel medio: advertencia directa ──
    if (weight <= 19) {
        _ksApplyWarning(now, capturedWeight, signals);
        saveStatsLocally(); submitLeaderboard(); return;
    }

    // ── Nivel alto: sanción (pero primero verificar si tiene < 3 advertencias) ──
    _ksApplySanctionOrWarn(now, capturedWeight, signals);
}

// Abre monitoreo preventivo sin contar como advertencia formal
function _ksOpenReview(date, weight, signals) {
    // Solo abrir revisión si no hay estado más grave ya activo
    if (playerStats.ksReviewStatus === 'warned' || playerStats.ksReviewStatus === 'sanctioned') return;
    playerStats.ksReviewStatus = 'under_review';
    // Guardar señal en ksSuspicious (no en ksWarnings — revisión no es advertencia)
    const sus = playerStats.ksSuspicious || [];
    sus.push({ date, weight, signals, type: 'review' });
    if (sus.length > 20) sus.splice(0, sus.length - 20);
    playerStats.ksSuspicious = sus;
    saveStatsLocally(); submitLeaderboard();
    setTimeout(() => { try { _ksShowReviewScreen(); } catch(e) {} }, 2800);
}

// Aplica una advertencia formal sin penalización (hasta 3 antes de sancionar)
// Solo se llama cuando weight es medio-alto o ya hubo revisión previa
function _ksApplyWarning(date, weight, signals) {
    const thirtyDays = Date.now() - 30 * 24 * 3600 * 1000;
    const warnings   = (playerStats.ksWarnings || []).filter(w => new Date(w.date).getTime() > thirtyDays);
    warnings.push({ date, weight, signals });
    playerStats.ksWarnings = warnings;
    playerStats.ksReviewStatus = 'warned';
    saveStatsLocally(); submitLeaderboard();
    // Retrasar el overlay visual para que no tape la pantalla de fin de partida
    const _warnCount = warnings.length;
    setTimeout(() => { try { _ksShowWarningScreen(_warnCount); } catch(e) {} }, 2800);
}

// Sanción real — solo si ya tiene 3+ advertencias activas, si no, da advertencia formal
function _ksApplySanctionOrWarn(date, weight, signals) {
    const thirtyDays    = Date.now() - 30 * 24 * 3600 * 1000;
    const activeWarnings= (playerStats.ksWarnings || []).filter(w => new Date(w.date).getTime() > thirtyDays);

    if (activeWarnings.length < 3) {
        // Aún no llega a 3 advertencias formales — dar advertencia sin sancionar
        _ksApplyWarning(date, weight, signals);
        return;
    }
    // Tiene 3+ advertencias → sancionar ahora
    _ksApplySanction(date, weight, signals);
}

function _ksApplySanction(date, weight, signals) {
    const infractions = playerStats.ksInfractions || [];
    // Días de vencimiento por nivel (escala 3-21 días)
    const KS_EXPIRY_DAYS = {1:3, 2:5, 3:7, 4:10, 5:13, 6:16, 7:19, 8:21};
    const active = infractions.filter(inf => {
        const d = new Date(inf.date).getTime();
        const days = KS_EXPIRY_DAYS[inf.level] || 21;
        return d > Date.now() - days * 24 * 3600 * 1000;
    });
    const highestPrev = active.length > 0 ? Math.max(...active.map(x => x.level)) : 0;
    let level;
    if      (active.length === 0 && weight <= 28)                 level = 1;
    else if (active.length === 0 && weight >= 29)                 level = 2;
    else if (active.length === 1 && highestPrev <= 2)             level = Math.min(highestPrev + 1, 3);
    else if (active.length === 1 && highestPrev > 2)              level = Math.min(highestPrev + 1, 6);
    else                                                          level = Math.min(highestPrev + 1, 8);

    const BAN_HOURS  = {1:0, 2:1, 3:3, 4:6, 5:12, 6:24, 7:48, 8:72};
    const PL_PENALTY = {1:0.10, 2:0.18, 3:0.28, 4:0.40, 5:0.55, 6:0.55, 7:0.55, 8:0.55};
    const banHours   = BAN_HOURS[level] || 0;
    const banUntil   = banHours > 0
        ? new Date(Date.now() + banHours * 3600000).toISOString() : null;
    const plPct = PL_PENALTY[level] || 0;
    if (plPct > 0 && playerStats.powerLevel > 0) {
        playerStats.powerLevel = Math.round(playerStats.powerLevel * (1 - plPct));
        playerStats.totalScore = Math.round(playerStats.totalScore * (1 - plPct * 0.5));
    }
    // Resetear advertencias tras sancionar
    playerStats.ksWarnings = [];
    infractions.push({ date, level, weight, signals, banUntil, banHours });
    playerStats.ksInfractions   = infractions;
    playerStats.ksBanUntil      = banUntil;
    playerStats.ksInfractionLvl = Math.max(playerStats.ksInfractionLvl || 0, level);
    playerStats.ksReviewStatus  = 'sanctioned';
    saveStatsLocally(); submitLeaderboard();
    // Retrasar para no tapar la pantalla de fin de partida
    setTimeout(() => { try { _ksShowSanctionScreen(level, banHours, plPct); } catch(e) {} }, 2800);
}

// ── Feedback post-partida: píldora discreta tras endGame ─────────────────
function _ksShowPostGameFeedback(type, weight) {
    // Eliminar feedback anterior si lo hay
    const prev = document.getElementById('ks-feedback-overlay');
    if (prev) prev.remove();

    let html = '';
    if (type === 'clean') {
        html = `<div class="ks-feedback-pill ks-fb-shield">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
            Klick Shield · Sesión verificada
        </div>`;
    } else if (type === 'watch') {
        html = `<div class="ks-feedback-pill ks-fb-watch">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Klick Shield · Actividad en monitoreo
        </div>`;
    }
    if (!html) return;

    const el = document.createElement('div');
    el.id = 'ks-feedback-overlay';
    el.className = 'ks-feedback-overlay';
    el.innerHTML = html;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('visible'), 30);
    setTimeout(() => {
        el.classList.remove('visible');
        setTimeout(() => { try { el.remove(); } catch(_){} }, 400);
    }, 3800);
}

function _ksCheckBanOnStart() {
    const isAdmin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    if (isAdmin) return false;

    // Auto-limpiar el estado de revisión si ya no hay advertencias activas (últimos 30 días)
    const review = playerStats.ksReviewStatus;
    if (review === 'under_review' || review === 'warned') {
        const thirtyDays = Date.now() - 30 * 24 * 3600 * 1000;
        const activeWarnings = (playerStats.ksWarnings || []).filter(w => new Date(w.date).getTime() > thirtyDays);
        if (activeWarnings.length === 0) {
            playerStats.ksReviewStatus = null;
            playerStats.ksWarnings = [];
            saveStatsLocally();
        }
    }

    const banUntil = playerStats.ksBanUntil;
    if (!banUntil) return false;
    const remaining = new Date(banUntil).getTime() - Date.now();
    if (remaining <= 0) {
        // Ban expiró — limpiar el ban pero mantener 'sanctioned' (historial permanece)
        playerStats.ksBanUntil = null;
        // ksReviewStatus queda en 'sanctioned', no se limpia — la infracción sigue en historial
        saveStatsLocally(); submitLeaderboard(); return false;
    }
    return true;
}

function _ksGetBanRemainingMs() {
    const banUntil = playerStats.ksBanUntil;
    if (!banUntil) return 0;
    return Math.max(0, new Date(banUntil).getTime() - Date.now());
}

// ══════════════════════════════════════════════════════════════════════════
//  KLICK SHIELD — Pantallas de notificación full-screen integradas
// ══════════════════════════════════════════════════════════════════════════

// Ayudantes de partículas mini para los fondos de pantalla
function _ksSpawnScreenParticles(canvasEl, r, g, b) {
    try {
        const cv = canvasEl;
        cv.width  = cv.offsetWidth  || window.innerWidth;
        cv.height = cv.offsetHeight || window.innerHeight;
        const c2  = cv.getContext('2d');
        const N   = 35;
        const pts = Array.from({length: N}, () => ({
            x:  Math.random() * cv.width,
            y:  Math.random() * cv.height,
            dx: (Math.random() - 0.5) * 0.55,
            dy: (Math.random() - 0.5) * 0.55,
            s:  Math.random() * 1.5 + 0.4,
            o:  Math.random() * 0.22 + 0.04
        }));
        let raf = null;
        function draw() {
            if (!cv.parentElement) { cancelAnimationFrame(raf); return; }
            c2.clearRect(0, 0, cv.width, cv.height);
            for (const p of pts) {
                p.x += p.dx; p.y += p.dy;
                if (p.x < 0) p.x = cv.width;  if (p.x > cv.width)  p.x = 0;
                if (p.y < 0) p.y = cv.height; if (p.y > cv.height) p.y = 0;
                // Conexiones entre partículas cercanas
                for (const q of pts) {
                    const d = Math.hypot(p.x-q.x, p.y-q.y);
                    if (d < 90 && d > 0) {
                        c2.beginPath();
                        c2.moveTo(p.x, p.y); c2.lineTo(q.x, q.y);
                        c2.strokeStyle = `rgba(${r},${g},${b},${(1 - d/90) * 0.08})`;
                        c2.lineWidth = 0.5;
                        c2.stroke();
                    }
                }
                c2.beginPath();
                c2.arc(p.x, p.y, p.s, 0, Math.PI*2);
                c2.fillStyle = `rgba(${r},${g},${b},${p.o})`;
                c2.fill();
            }
            raf = requestAnimationFrame(draw);
        }
        draw();
    } catch(_) {}
}

function _ksRemoveScreenOverlay() {
    try { _ksStopOverlayMusic(); } catch(e) {}
    const el = document.getElementById('ks-screen-overlay');
    if (el) { el.classList.remove('ks-so-visible'); setTimeout(() => { try { el.remove(); } catch(_){} }, 400); }
}

// ── Toast de seguridad ────────────────────────────────────────────────────
const SVG_ALERT   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
const SVG_BAN_ICON= `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
function _ksShowToastSecurity(type) {
    const map = {
        review:   { title:'Cuenta bajo revisión',  msg:'Klick Shield ha abierto monitoreo preventivo.',   color:'#ffb800', icon: SVG_ALERT },
        warning:  { title:'Advertencia formal',     msg:'Se registró una advertencia en tu cuenta.',       color:'#ff8c00', icon: SVG_ALERT },
        sanction: { title:'Infracción confirmada',  msg:'Se aplicó una sanción por conducta irregular.',  color:'#ff4040', icon: SVG_BAN_ICON },
        ban:      { title:'Acceso suspendido',      msg:'No puedes iniciar partidas hasta que expire.',   color:'#ff2a5f', icon: SVG_BAN_ICON },
    };
    const t = map[type] || map.review;
    showToast(t.title, t.msg, t.color, t.icon, 7000);
}

// ── Barra de advertencias HTML ────────────────────────────────────────────
function _ksWarnBarHtml(warnCount, isSanction) {
    const MAX = 3;
    let pips = '';
    for (let i = 0; i < MAX; i++) {
        const cls = i < warnCount ? (isSanction ? 'filled-red' : 'filled-warn') : '';
        pips += `<div class="ks-so-warn-pip ${cls}"></div>`;
    }
    const label = isSanction
        ? `3 advertencias previas — sanción activada`
        : `Advertencia ${warnCount} de ${MAX}`;
    return `<div class="ks-so-warn-bar">${pips}<span class="ks-so-warn-label">${label}</span></div>`;
}

// ── Pantalla: Cuenta bajo revisión ────────────────────────────────────────
function _ksShowReviewScreen() {
    _ksRemoveScreenOverlay();
    const name = playerStats.playerName || 'Jugador';
    const dt   = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
    const el = document.createElement('div');
    el.id = 'ks-screen-overlay';
    el.className = 'ks-screen-overlay ks-so-review';
    el.innerHTML = `
        <canvas class="ks-so-canvas" id="ks-so-canvas"></canvas>
        <div class="ks-so-glow ks-so-glow-yellow"></div>
        <div class="ks-so-content">
            <div class="ks-so-icon ks-so-icon-review">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
            </div>
            <div class="ks-so-eyebrow">Klick Shield · Monitoreo preventivo</div>
            <h1 class="ks-so-title">Cuenta bajo<br><span class="ks-so-accent-yellow">revisión</span></h1>
            <div class="ks-so-divider ks-divider-yellow"></div>
            <div class="ks-so-body">
                El sistema detectó actividad inusual en una sesión reciente de <strong>${name}</strong>.<br><br>
                <strong>No hay ninguna sanción ni restricción activa.</strong> Puedes continuar jugando con normalidad. Si no se detecta más actividad sospechosa, el proceso se cierra automáticamente.
            </div>
            <div class="ks-so-chips">
                <div class="ks-so-chip ks-chip-ok">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sin restricciones
                </div>
                <div class="ks-so-chip ks-chip-ok">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Partidas permitidas
                </div>
                <div class="ks-so-chip ks-chip-warn">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg>Sesiones monitoreadas
                </div>
            </div>
            <div class="ks-so-meta">Klick Shield · ${dt} · Registro interno</div>
            <div class="ks-so-btn-row">
                <button class="ks-so-btn ks-so-btn-review" onclick="_ksRemoveScreenOverlay()">Entendido</button>
            </div>
        </div>`;
    _ksShowToastSecurity('review');
    _ksSendEventToServer('review_open', '', '', 'Cuenta bajo revisión');
    document.body.appendChild(el);
    setTimeout(() => {
        el.classList.add('ks-so-visible');
        const cv = document.getElementById('ks-so-canvas');
        if (cv) _ksSpawnScreenParticles(cv, 255, 184, 0);
        _ksPlayOverlayMusic('review');
    }, 30);
}

// ── Pantalla: Advertencia formal (1–3, sin penalización) ─────────────────
function _ksShowWarningScreen(warnCount) {
    _ksRemoveScreenOverlay();
    const name      = playerStats.playerName || 'Jugador';
    const dt        = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
    const remaining = 3 - warnCount;
    const el = document.createElement('div');
    el.id = 'ks-screen-overlay';
    el.className = 'ks-screen-overlay ks-so-warning';
    el.innerHTML = `
        <canvas class="ks-so-canvas" id="ks-so-canvas"></canvas>
        <div class="ks-so-glow ks-so-glow-orange"></div>
        <div class="ks-so-content">
            <div class="ks-so-icon ks-so-icon-warning">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
            </div>
            <div class="ks-so-eyebrow">Klick Shield · Advertencia ${warnCount} de 3</div>
            <h1 class="ks-so-title">Actividad<br><span class="ks-so-accent-orange">detectada</span></h1>
            <div class="ks-so-divider ks-divider-orange"></div>
            ${_ksWarnBarHtml(warnCount, false)}
            <div class="ks-so-body">
                El sistema registró actividad irregular en una sesión de <strong>${name}</strong>.<br><br>
                Esta es tu <strong>advertencia ${warnCount} de 3</strong>. ${remaining > 0
                    ? `Te quedan <strong>${remaining} advertencia${remaining>1?'s':''}</strong> antes de que se apliquen sanciones.`
                    : '<strong>La próxima infracción activará sanciones.</strong>'}
                <br><br>No hay restricciones activas ni reducción de Nivel de Poder.
            </div>
            <div class="ks-so-chips">
                <div class="ks-so-chip ks-chip-ok">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sin suspensión
                </div>
                <div class="ks-so-chip ks-chip-ok">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Sin reducción de PL
                </div>
                <div class="ks-so-chip ks-chip-orange">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>Advertencia ${warnCount}/3
                </div>
            </div>
            <div class="ks-so-meta">Klick Shield · ${dt} · Advertencia formal</div>
            <div class="ks-so-btn-row">
                <button class="ks-so-btn ks-so-btn-warning" onclick="_ksRemoveScreenOverlay()">Entendido</button>
            </div>
        </div>`;
    _ksShowToastSecurity('warning');
    _ksSendEventToServer('warning', warnCount, '', `Advertencia formal ${warnCount}/3`);
    document.body.appendChild(el);
    setTimeout(() => {
        el.classList.add('ks-so-visible');
        const cv = document.getElementById('ks-so-canvas');
        if (cv) _ksSpawnScreenParticles(cv, 255, 140, 0);
        _ksPlayOverlayMusic('warning');
    }, 30);
}

// ── Pantalla: Infracción / Suspensión ─────────────────────────────────────
function _ksShowSanctionScreen(level, banHours, plPct) {
    _ksRemoveScreenOverlay();
    const levelLabels = {1:'AVISO LEVE',2:'SUSPENSIÓN CORTA',3:'SUSPENSIÓN MODERADA',4:'SUSPENSIÓN SEVERA',5:'SUSPENSIÓN GRAVE',6:'SUSPENSIÓN EXTENDIDA',7:'SUSPENSIÓN CRÍTICA',8:'ACCESO REVOCADO'};
    const banText = banHours > 0
        ? `Tu acceso ha sido suspendido por <strong>${banHours} hora${banHours>1?'s':''}</strong>.`
        : 'No hay suspensión de tiempo activa.';
    const plText  = plPct > 0
        ? `Tu Nivel de Poder fue reducido un <strong>${Math.round(plPct*100)}%</strong>.`
        : '';
    const infraN  = (playerStats.ksInfractions || []).length;
    const name    = playerStats.playerName || 'Jugador';
    const dt      = new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'});
    const el = document.createElement('div');
    el.id = 'ks-screen-overlay';
    el.className = 'ks-screen-overlay ks-so-sanction';
    el.innerHTML = `
        <canvas class="ks-so-canvas" id="ks-so-canvas"></canvas>
        <div class="ks-so-glow ks-so-glow-red"></div>
        <div class="ks-so-content">
            <div class="ks-so-icon ks-so-icon-sanction">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
            </div>
            <div class="ks-so-eyebrow">Klick Shield — ${levelLabels[level]||'SANCIÓN'}</div>
            <h1 class="ks-so-title">Infracción<br><span class="ks-so-accent-red">confirmada</span></h1>
            <div class="ks-so-divider ks-divider-red"></div>
            ${_ksWarnBarHtml(3, true)}
            <div class="ks-so-body">
                El sistema completó el análisis de <strong>${name}</strong> y encontró evidencia de conducta contraria a las normas.<br><br>
                ${banText}${plText ? ' ' + plText : ''}
                <br><br>Esta infracción queda registrada. Las infracciones escalan automáticamente hasta nivel 8 (72 h máx.).
            </div>
            <div class="ks-so-chips">
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Nivel ${level}/8
                </div>
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Infracción #${infraN}
                </div>
                ${banHours > 0 ? `<div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>${banHours}h suspendido
                </div>` : ''}
            </div>
            <div class="ks-so-meta">Klick Shield · ${dt} · Nivel ${level}/8 · Infracción #${infraN}</div>
            <div class="ks-so-btn-row">
                <button class="ks-so-btn ks-so-btn-sanction" onclick="_ksRemoveScreenOverlay()">Acepto las consecuencias</button>
            </div>
        </div>`;
    _ksShowToastSecurity(banHours > 0 ? 'ban' : 'sanction');
    _ksSendEventToServer('sanction', level, banHours, `Infracción nivel ${level}${banHours>0?' · '+banHours+'h ban':''}`);
    document.body.appendChild(el);
    setTimeout(() => {
        el.classList.add('ks-so-visible');
        const cv = document.getElementById('ks-so-canvas');
        if (cv) _ksSpawnScreenParticles(cv, 255, 42, 42);
        _ksPlayOverlayMusic('sanction');
    }, 30);
}

// ── Pantalla: Acceso suspendido (ban activo al intentar jugar) ────────────
function _ksShowBanScreen() {
    const remaining = _ksGetBanRemainingMs();
    if (remaining <= 0) return;
    _ksRemoveScreenOverlay();
    const name      = playerStats.playerName || 'Jugador';
    const infList   = playerStats.ksInfractions || [];
    const lastInf   = infList[infList.length - 1] || {};
    const banUntilStr = playerStats.ksBanUntil
        ? new Date(playerStats.ksBanUntil).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})
        : '';
    const el = document.createElement('div');
    el.id = 'ks-screen-overlay';
    el.className = 'ks-screen-overlay ks-so-ban';
    el.innerHTML = `
        <canvas class="ks-so-canvas" id="ks-so-canvas"></canvas>
        <div class="ks-so-glow ks-so-glow-red"></div>
        <div class="ks-so-content">
            <div class="ks-so-icon ks-so-icon-ban">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div class="ks-so-eyebrow">Klick Shield · Acceso suspendido</div>
            <h1 class="ks-so-title">No puedes<br><span class="ks-so-accent-red">jugar ahora</span></h1>
            <div class="ks-so-divider ks-divider-red"></div>
            <div class="ks-so-body">
                La cuenta de <strong>${name}</strong> tiene una suspensión activa por infracción confirmada.<br><br>
                No es posible iniciar partidas hasta que la suspensión expire. El acceso se restaura <strong>automáticamente</strong> al llegar la hora indicada.
            </div>
            <div class="ks-so-countdown-block">
                <div class="ks-so-countdown-label">Tiempo restante</div>
                <div class="ks-so-countdown" id="ks-ban-countdown">--:--:--</div>
                ${banUntilStr ? `<div class="ks-so-countdown-until">Expira el ${banUntilStr}</div>` : ''}
            </div>
            <div class="ks-so-chips">
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Nivel ${lastInf.level||'?'}/8
                </div>
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>${lastInf.banHours||0}h suspensión
                </div>
                <div class="ks-so-chip ks-chip-neutral">Expira automáticamente</div>
            </div>
            <div class="ks-so-btn-row">
                <button class="ks-so-btn ks-so-btn-ban" onclick="_ksRemoveScreenOverlay()">Cerrar</button>
            </div>
        </div>`;
    _ksShowToastSecurity('ban');
    document.body.appendChild(el);
    // Actualizar el countdown inmediatamente y luego cada segundo
    function _ksTickBanCountdown() {
        const ms2 = _ksGetBanRemainingMs();
        const cd  = document.getElementById('ks-ban-countdown');
        if (!cd) return;
        if (ms2 <= 0) {
            cd.innerText = '00:00:00';
            playerStats.ksBanUntil = null;
            // Mantener 'sanctioned' — ban expiró pero la infracción permanece en historial
            saveStatsLocally();
            setTimeout(_ksRemoveScreenOverlay, 1200);
            return;
        }
        const hh = Math.floor(ms2/3600000);
        const mm = Math.floor((ms2%3600000)/60000);
        const ss = Math.floor((ms2%60000)/1000);
        cd.innerText = String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0')+':'+String(ss).padStart(2,'0');
    }
    _ksTickBanCountdown(); // valor correcto desde el primer frame
    if (window._banOverlayTick) { clearInterval(window._banOverlayTick); window._banOverlayTick = null; }
    window._banOverlayTick = setInterval(() => {
        if (!document.getElementById('ks-ban-countdown')) { clearInterval(window._banOverlayTick); window._banOverlayTick = null; return; }
        _ksTickBanCountdown();
    }, 1000);
    setTimeout(() => {
        el.classList.add('ks-so-visible');
        const cv = document.getElementById('ks-so-canvas');
        if (cv) _ksSpawnScreenParticles(cv, 255, 42, 42);
        _ksPlayOverlayMusic('ban');
    }, 30);
}

// ── Pantalla: Ban permanente (ban del servidor, cuenta eliminada) ─────────
function _ksShowPermanentBanScreen() {
    _ksRemoveScreenOverlay();
    const name = playerStats.playerName || 'Jugador';
    const el = document.createElement('div');
    el.id = 'ks-screen-overlay';
    el.className = 'ks-screen-overlay ks-so-ban';
    el.innerHTML = `
        <canvas class="ks-so-canvas" id="ks-so-canvas"></canvas>
        <div class="ks-so-glow ks-so-glow-red"></div>
        <div class="ks-so-content">
            <div class="ks-so-icon ks-so-icon-ban">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>
            <div class="ks-so-eyebrow">Klick Shield · Acceso revocado permanentemente</div>
            <h1 class="ks-so-title">Cuenta<br><span class="ks-so-accent-red">suspendida</span></h1>
            <div class="ks-so-divider ks-divider-red"></div>
            <div class="ks-so-body">
                La cuenta de <strong>${name}</strong> ha sido suspendida de forma permanente por el administrador del sistema.<br><br>
                Esta acción es definitiva. Todos los datos locales de esta cuenta serán eliminados. No es posible continuar desde esta sesión.
            </div>
            <div class="ks-so-chips">
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Suspensión permanente
                </div>
                <div class="ks-so-chip ks-chip-red">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>Decisión del administrador
                </div>
            </div>
            <div class="ks-so-btn-row">
                <button class="ks-so-btn ks-so-btn-ban" onclick="_ksConfirmPermanentBan()">Entendido</button>
            </div>
        </div>`;
    document.body.appendChild(el);
    setTimeout(() => {
        el.classList.add('ks-so-visible');
        const cv = document.getElementById('ks-so-canvas');
        if (cv) _ksSpawnScreenParticles(cv, 255, 42, 42);
        _ksPlayOverlayMusic('ban');
    }, 30);
}

function _ksConfirmPermanentBan() {
    _ksRemoveScreenOverlay();
    setTimeout(_wipeAccountData, 600);
}

// ── Música de overlay — reservado para implementación futura ──────────────
// Llamada por las pantallas de seguridad (review, sanction, ban).
// Por ahora es un stub seguro; agregar lógica de audio aquí cuando esté listo.
function _ksPlayOverlayMusic(type) {
    // stub — implementar cuando se agregue audio de overlay
}
function _ksStopOverlayMusic() {
    // stub — detener audio de overlay si estuviera activo
}

// ── Log de eventos KS al servidor (Historial KS) ─────────────────────────
// Registra revisiones, advertencias y sanciones en el servidor para el admin.
async function _ksSendEventToServer(type, level, banHours, description) {
    if (!playerStats.uuid || GAS_URL === 'URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI') return;
    if (!navigator.onLine) return;
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({
                action:      'ks-event',
                uuid:        playerStats.uuid,
                name:        playerStats.playerName || '',
                eventType:   type,
                level:       level,
                banHours:    banHours,
                description: description,
                date:        new Date().toISOString(),
            }),
        });
    } catch(e) { /* silencioso — el log es informativo, no crítico */ }
}

function _ksShowReviewModal()        { _ksShowReviewScreen(); }
function _ksShowSanctionModal(l,h,p) { _ksShowSanctionScreen(l,h,p); }

let _ksSessionScore = 0; // capturado en endGame antes de _ksAnalyzeSession


// --- GENERACIÓN DE UUID ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ── HUELLA DE DISPOSITIVO (Device Fingerprint) ─────────────────────────────
// Genera un ID estable del dispositivo que NO se invalida borrando el historial.
// Combina múltiples señales de hardware/software que no cambian con la navegación.
// Se persiste en IndexedDB (más resistente que localStorage) Y en localStorage
// como fallback. Al arrancar, lee primero de IDB; si no existe, lo crea.
const DEVICE_FP_KEY = 'klick_device_fp';

async function _computeDeviceFingerprint() {
    const nav = window.navigator;
    const screen = window.screen;
    const signals = [
        nav.hardwareConcurrency || 0,
        nav.deviceMemory || 0,
        screen.width, screen.height, screen.colorDepth, screen.pixelDepth,
        nav.platform || '',
        nav.vendor || '',
        nav.language || '',
        (nav.languages || []).join(','),
        Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        nav.maxTouchPoints || 0,
        typeof nav.cookieEnabled,
        typeof WebAssembly !== 'undefined' ? 1 : 0,
    ].join('|');

    // Canvas fingerprint
    let canvasFP = '';
    try {
        const cv = document.createElement('canvas');
        cv.width = 200; cv.height = 40;
        const ctx = cv.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60'; ctx.fillRect(0, 0, 200, 40);
        ctx.fillStyle = '#069'; ctx.fillText('KlickFP-v1', 2, 2);
        ctx.fillStyle = 'rgba(102,204,0,0.7)'; ctx.fillText('KlickFP-v1', 4, 4);
        canvasFP = cv.toDataURL().slice(-40);
    } catch(e) {}

    // WebGL renderer
    let glFP = '';
    try {
        const gl = document.createElement('canvas').getContext('webgl');
        if (gl) {
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            glFP = dbg ? (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
        }
    } catch(e) {}

    const raw = signals + '|' + canvasFP + '|' + glFP;

    // Hash simple pero suficiente (no criptográfico)
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = ((hash << 5) - hash) + raw.charCodeAt(i);
        hash |= 0;
    }
    return 'dfp_' + Math.abs(hash).toString(36) + '_' + (raw.length).toString(36);
}

const _IDB_NAME = 'klick_secure_store', _IDB_VER = 1, _IDB_STORE = 'device';
function _idbGet(key) {
    return new Promise(resolve => {
        try {
            const req = indexedDB.open(_IDB_NAME, _IDB_VER);
            req.onupgradeneeded = e => e.target.result.createObjectStore(_IDB_STORE);
            req.onsuccess = e => {
                try {
                    const tx = e.target.result.transaction(_IDB_STORE, 'readonly');
                    const r = tx.objectStore(_IDB_STORE).get(key);
                    r.onsuccess = () => resolve(r.result || null);
                    r.onerror = () => resolve(null);
                } catch(_) { resolve(null); }
            };
            req.onerror = () => resolve(null);
        } catch(_) { resolve(null); }
    });
}
function _idbSet(key, val) {
    try {
        const req = indexedDB.open(_IDB_NAME, _IDB_VER);
        req.onupgradeneeded = e => e.target.result.createObjectStore(_IDB_STORE);
        req.onsuccess = e => {
            try {
                const tx = e.target.result.transaction(_IDB_STORE, 'readwrite');
                tx.objectStore(_IDB_STORE).put(val, key);
            } catch(_) {}
        };
    } catch(_) {}
}

let _deviceFingerprint = null;
// Promise que resuelve cuando la huella está lista — garantiza que
// submitLeaderboard nunca envíe 'unknown' en el primer envío.
let _deviceFpReady = null;

async function _initDeviceFingerprint() {
    // 1. IDB — persiste aunque se borre historial y cookies
    let fp = await _idbGet(DEVICE_FP_KEY);
    // 2. Fallback localStorage
    if (!fp) { try { fp = localStorage.getItem(DEVICE_FP_KEY); } catch(_) {} }
    // 3. Generar si no existe
    if (!fp) { fp = await _computeDeviceFingerprint(); }
    // Persistir en ambos almacenes
    _idbSet(DEVICE_FP_KEY, fp);
    try { localStorage.setItem(DEVICE_FP_KEY, fp); } catch(_) {}
    _deviceFingerprint = fp;
    return fp;
}

// Iniciar inmediatamente y guardar la Promise para que submitLeaderboard la pueda await
_deviceFpReady = _initDeviceFingerprint().catch(() => { _deviceFingerprint = 'fp_error'; return 'fp_error'; });

// --- SVGs ---
const SVG_CORRECT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
const SVG_INCORRECT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
const SVG_TIMEOUT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
const SVG_LOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
const SVG_TROPHY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline><circle cx="12" cy="8" r="7"></circle></svg>`;
const SVG_USER = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
const SVG_STAR = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
const SVG_PIN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>`;
const SVG_TARGET = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`;
const SVG_FIRE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z"></path></svg>`;
const SVG_BOLT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
const SVG_CLOCK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`;
const SVG_SKULL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="12" r="1"></circle><circle cx="15" cy="12" r="1"></circle><path d="M8 20v2h8v-2"></path><path d="M12.5 17l-.5-1-.5 1h1z"></path><path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20"></path></svg>`;
const SVG_HEART = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
const SVG_SHIELD = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`;
const SVG_MOON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

// --- Stats y Logros (Persistencia Absoluta) ---
const defaultStats = {
    uuid: generateUUID(),
    playerName: "JUGADOR", gamesPlayed: 0, bestScore: 0, maxStreak: 0, achievements: [], pinnedAchievements: [],
    nameChanges: 0, achViews: 0, totalScore: 0, perfectGames: 0, totalCorrect: 0, totalWrong: 0, 
    totalTimeouts: 0, fastAnswersTotal: 0, frenziesTriggered: 0, lastLoginDate: "", currentLoginStreak: 0, 
    maxLoginStreak: 0, todayGames: 0, maxScoreCount: 0, perfectStreak: 0, previousGameScore: -1,
    musicVol: 1.0, sfxVol: 1.0, particleOpacity: 1.0, maxFps: 60,
    rankingViews: 0, configViews: 0, fpsChanges: 0, allSectionsVisited: false,
    sectionsVisitedThisSession: [], rankingPosition: 999,
    musicSetTo0: false, sfxSetTo0: false, particles0: false,
    powerLevel: 0, maxMult: 1, maxQuestionReached: 0, totalDaysPlayed: 0,
    profileViewedAfterGames: 0,
    selectedTrack: 'track_chill', trackSwitches: 0, tracksTriedSet: [], triedAllTracks: false,
    sameTrackGames: 0, lastGameTrack: '',
    kpViews: 0, kpClaimDays: [], kpSessionClaims: 0,
    equippedTitle: null,
    qualityMode: 'normal',
    seenChristopher: false, christopherCardViews: 0, christopherSeenCount: 0,
    // KLICK SHIELD v2
    ksInfractions: [],      // infracciones confirmadas con timestamp
    ksBanUntil: null,       // ISO string del fin del ban activo
    ksInfractionLvl: 0,     // nivel más alto alcanzado
    ksReviewStatus: null,   // null | 'under_review' | 'warned' | 'sanctioned'
    ksSuspicious: [],       // sesiones sospechosas internas (peso 7-11)
    ksWarnings: [],         // advertencias formales (máx 3 antes de sancionar)
};

const STORAGE_KEY = 'klick_player_data_permanent';
let savedData = '{}';
try { savedData = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('klickStats_v9') || '{}'; } catch(e) {}
let playerStats = { ...defaultStats, ...JSON.parse(savedData) };

if(!playerStats.uuid) playerStats.uuid = generateUUID();
// CHRISTOPHER: UUID canónico fijo — garantiza una sola entrada en el leaderboard,
// sin importar el dispositivo. El servidor sobreescribe siempre la misma fila.
if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') {
    playerStats.uuid = '00000000-spec-tral-0000-klickphantom0';
}
// Purgar el logro de tramposo de cualquier cuenta (eliminado en v4)
if (playerStats.achievements) {
    playerStats.achievements = playerStats.achievements.filter(id => id !== 'tramposo');
}
if (playerStats.pinnedAchievements) {
    playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => id !== 'tramposo');
}
if (playerStats.cheatCount !== undefined) delete playerStats.cheatCount;

// ── MIGRACIÓN v0: normaliza logros cx al nuevo sistema (christopherCardViews) ──
(function migrateAchievementsV0() {
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return;
    if (playerStats.migratedV0cx) return;
    playerStats.migratedV0cx = true;
    const cv = playerStats.christopherCardViews || 0;
    const toRevoke = [];
    // cx1 ahora requiere cardViews >= 1 (antes: seenChristopher=true que se daba sin interacción)
    if (playerStats.achievements.includes('cx1') && cv < 1)  toRevoke.push('cx1');
    // cx2 ahora requiere cardViews >= 3 (antes: cardViews >= 1)
    if (playerStats.achievements.includes('cx2') && cv < 3)  toRevoke.push('cx2');
    if (toRevoke.length > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevoke.includes(id));
        playerStats.pinnedAchievements = (playerStats.pinnedAchievements||[]).filter(id => !toRevoke.includes(id));
    }
    // Limpiar flags obsoletos
    playerStats.seenChristopher = undefined;
    playerStats.christopherSeenCount = undefined;
})();

// ── MIGRACIÓN v2: retira logros que el jugador no ha ganado realmente ──
// Se ejecuta UNA vez por perfil (marca con migratedV2=true al terminar).
// Compara stats reales contra los nuevos umbrales del modo infinito y
// elimina del array achievements cualquier id que ya no se cumpla.
(function migrateAchievementsV2() {
    // CHRISTOPHER: nunca revocar logros
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return;
    if (playerStats.migratedV2) {
        // ── Migración v2b: revoca fin1/fin2 si se ganaron sin el flag real ──
        if (!playerStats.migratedV2b) {
            const toRevoke2b = [];
            if (playerStats.achievements.includes('fin1') && !playerStats.playedNocturno) toRevoke2b.push('fin1');
            if (playerStats.achievements.includes('fin2') && !playerStats.playedMadrugador) toRevoke2b.push('fin2');
            if (toRevoke2b.length > 0) {
                playerStats.achievements = playerStats.achievements.filter(id => !toRevoke2b.includes(id));
                playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke2b.includes(id));
            }
            playerStats.migratedV2b = true;
            saveStatsLocally();
        }
        return;
    }

    const bs  = playerStats.bestScore    || 0;
    const tot = playerStats.totalScore   || 0;
    const msc = playerStats.maxScoreCount|| 0; // ahora umbral 100k
    const pf  = playerStats.maxQuestionReached || 0;
    const sk  = playerStats.maxStreak    || 0;

    // Umbrales NUEVOS indexados por id de logro
    const newBsTiers  = [5000,25000,75000,150000,300000,600000,1000000,2000000];
    const newPtsTiers = [10000,50000,200000,500000,1000000,2500000,5000000,10000000];
    const newPfTiers  = [10,20,30,50,75,100,150,200];
    const newSkTiers  = [5,10,15,20,25,30,40,50];
    // hs ahora requiere superar 100k por partida; maxScoreCount se recalcula
    // → cualquier hs ganado con el umbral de 20k se revoca salvo que
    //   playerStats.maxScore sea ≥ 100k (al menos 1 partida lo cumple).
    //   Para los de conteo múltiple no podemos saber cuántas veces,
    //   así que revocamos todo hs y dejamos que checkAchievements los reotorgue.
    const newHsCountTiers = [1,3,5,10,20,35,50,100];

    const toRevoke = [];

    // bs1-bs8
    for(let i=0;i<8;i++) if(bs < newBsTiers[i]) toRevoke.push(`bs${i+1}`);
    // pt1-pt8
    for(let i=0;i<8;i++) if(tot < newPtsTiers[i]) toRevoke.push(`pt${i+1}`);
    // hs1-hs8: revocamos todos; checkAchievements reotorgará los que correspondan
    // usando el nuevo maxScoreCount (que aún puede estar inflado por el umbral viejo
    // de 20k → no podemos confiar en él; lo reseteamos si bestScore < 100k)
    if(bs < 100000) {
        // Nunca superó 100k → maxScoreCount inflado con 20k, lo limpiamos
        playerStats.maxScoreCount = 0;
        for(let i=0;i<8;i++) toRevoke.push(`hs${i+1}`);
    }
    // Si bestScore >= 100k, sabemos que al menos hs1 es válido pero no cuántos.
    // Lo más justo: dejamos maxScoreCount en 1 mínimo y revocamos hs2+.
    else {
        playerStats.maxScoreCount = Math.max(1, playerStats.maxScoreCount);
        for(let i=1;i<8;i++) toRevoke.push(`hs${i+1}`); // revoca hs2..hs8
    }
    // pf1-pf8
    for(let i=0;i<8;i++) if(pf < newPfTiers[i]) toRevoke.push(`pf${i+1}`);
    // sk1-sk8
    for(let i=0;i<8;i++) if(sk < newSkTiers[i]) toRevoke.push(`sk${i+1}`);

    // x4: ahora requiere 75k dos veces seguidas — no podemos verificar
    //     el histórico de partidas, revocamos si bestScore < 75k
    if(bs < 75000) toRevoke.push('x4');
    // x6: consistente ahora es 25k x5 partidas — revocamos si bestScore < 25k
    if(bs < 25000) toRevoke.push('x6');
    // x7: 3k primera pregunta — si bestScore < 3k (imposible tenerlo en realidad)
    if(bs < 3000) toRevoke.push('x7');
    // x12: 50k primera partida del día — revocamos si bestScore < 50k
    if(bs < 50000) toRevoke.push('x12');
    // x15: exactamente 100k ±500 — revocamos si bestScore está fuera del rango Y hitExactly100k no está marcado
    if(bs < 99500 || bs > 100500) { if (!playerStats.hitExactly100k) toRevoke.push('x15'); }

    if(toRevoke.length > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevoke.includes(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke.includes(id));
    }

    // También revoca fin1/fin2 si se ganaron sin el flag real (bug del check de hora en checkAchievements)
    const toRevokeFin = [];
    if (playerStats.achievements.includes('fin1') && !playerStats.playedNocturno) toRevokeFin.push('fin1');
    if (playerStats.achievements.includes('fin2') && !playerStats.playedMadrugador) toRevokeFin.push('fin2');
    if (toRevokeFin.length > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevokeFin.includes(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevokeFin.includes(id));
    }

    playerStats.migratedV2 = true;
    playerStats.migratedV2b = true; // mark v2b done too since we handled it here
    saveStatsLocally();
})();

// ── MIGRACIÓN v3: revoca logros otorgados con umbrales incorrectos (200 logros y escala de colección) ──
// Afecta: fin5, kpa10, master3, u_mitico, y logros de escala de colección m9/m10/master1/master4/master5
// cuyos umbrales se reajustaron para ser coherentes con el total real de 300 logros.
// CHRISTOPHER nunca pierde logros.
(function migrateAchievementsV3() {
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return;
    if (playerStats.migratedV3) return;

    const normalAchs = (playerStats.achievements || []).filter(id => ACHIEVEMENTS_MAP.has(id)).length;
    const toRevoke = [];

    // fin5 "Monarca": requiere rango Eterno + 160 logros
    if (playerStats.achievements.includes('fin5') && normalAchs < 160) toRevoke.push('fin5');

    // kpa10 "Coleccionista Total": requiere kpClaimed>=100 + 300 logros (antes chequeaba 200)
    if (playerStats.achievements.includes('kpa10') && normalAchs < 300) toRevoke.push('kpa10');

    // master3 "Dios Klick": requiere los 300 logros del juego (antes chequeaba 165)
    if (playerStats.achievements.includes('master3') && normalAchs < 300) toRevoke.push('master3');

    // u_mitico "Mítico": revocar si el jugador no cumple todos los requisitos actuales del rango Mítico.
    if (playerStats.achievements.includes('u_mitico')) {
        const totalAnswers = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
        const accuracy = totalAnswers > 0 ? Math.round((playerStats.totalCorrect||0)/totalAnswers*100) : 0;
        const cumpleMitico = (
            (playerStats.totalScore||0)     >= 1200000 &&
            (playerStats.totalCorrect||0)   >= 5500    &&
            (playerStats.perfectGames||0)   >= 55      &&
            normalAchs                      >= 280     &&
            (playerStats.maxStreak||0)      >= 45      &&
            (playerStats.maxMult||1)        >= 8       &&
            accuracy                        >= 85      &&
            (playerStats.gamesPlayed||0)    >= 320
        );
        if (!cumpleMitico) {
            toRevoke.push('u_mitico');
            ['mit1','mit2','mit3'].forEach(id => { if (playerStats.achievements.includes(id)) toRevoke.push(id); });
            if (playerStats.equippedTitle && ['mit1','mit2','mit3'].includes(playerStats.equippedTitle)) {
                playerStats.equippedTitle = null;
            }
        }
    }

    // u_eterno: revocar si el jugador no cumple los requisitos actuales del rango Eterno.
    if (playerStats.achievements.includes('u_eterno')) {
        const totalAnswers2 = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
        const accuracy2 = totalAnswers2 > 0 ? Math.round((playerStats.totalCorrect||0)/totalAnswers2*100) : 0;
        const cumpleEterno = (
            (playerStats.totalScore||0)   >= 700000 &&
            (playerStats.totalCorrect||0) >= 3200   &&
            (playerStats.perfectGames||0) >= 30     &&
            normalAchs                    >= 160    &&
            (playerStats.maxStreak||0)    >= 35     &&
            (playerStats.maxMult||1)      >= 6      &&
            accuracy2                     >= 78     &&
            (playerStats.gamesPlayed||0)  >= 200
        );
        if (!cumpleEterno) {
            toRevoke.push('u_eterno');
            // También revocar títulos Eterno si no cumple el rango
            ['et1','et2','et3'].forEach(id => { if (playerStats.achievements.includes(id)) toRevoke.push(id); });
            if (playerStats.equippedTitle && ['et1','et2','et3'].includes(playerStats.equippedTitle)) {
                playerStats.equippedTitle = null;
            }
        }
    }

    // ── Escala de colección reajustada ──────────────────────────────────────
    // m9 subió de 50 → 25; m10 de 100 → 50; master1 de 50 → 75;
    // master4 de 130 → 150; master5 de 155 → 200.
    // Revocar solo si el jugador no alcanza el NUEVO umbral.
    if (playerStats.achievements.includes('m9')      && normalAchs < 25)  toRevoke.push('m9');
    if (playerStats.achievements.includes('m10')     && normalAchs < 50)  toRevoke.push('m10');
    if (playerStats.achievements.includes('master1') && normalAchs < 75)  toRevoke.push('master1');
    if (playerStats.achievements.includes('master4') && normalAchs < 150) toRevoke.push('master4');
    if (playerStats.achievements.includes('master5') && normalAchs < 200) toRevoke.push('master5');

    // ── pf9 subió de 200 a 300 ────────────────────────────────────────────
    if (playerStats.achievements.includes('pf9') && (playerStats.maxQuestionReached||0) < 300) toRevoke.push('pf9');

    // ── td2 (Asiduo): tiers subieron de [5,10,20,30,60] a [7,12,18,25,45] ─
    const _v3TotalDays = playerStats.totalDaysPlayed||0;
    const _v3Td2New=[7,12,18,25,45];
    for(let i=0;i<5;i++) if(playerStats.achievements.includes(`td2${i+1}`) && _v3TotalDays<_v3Td2New[i]) toRevoke.push(`td2${i+1}`);

    // ── ret (Fiel): tiers cambiaron de [3,7,15,30,60] a [3,8,20,40,75] ───
    const _v3RetNew=[3,8,20,40,75];
    for(let i=0;i<5;i++) if(playerStats.achievements.includes(`ret${i+1}`) && _v3TotalDays<_v3RetNew[i]) toRevoke.push(`ret${i+1}`);

    // ── extra5 subió de 10 a 15 logros en un día ──────────────────────────
    if (playerStats.achievements.includes('extra5') && (playerStats.dailyAchUnlocks||0) < 15) toRevoke.push('extra5');

    // ── Logros únicos que duplicaban escalas — umbrales corregidos ───────────
    // u2 Tropiezo: 100→75 incorrectas
    if (playerStats.achievements.includes('u2') && (playerStats.totalWrong||0) < 75) toRevoke.push('u2');
    // u4 AFK: 50→35 timeouts
    if (playerStats.achievements.includes('u4') && (playerStats.totalTimeouts||0) < 35) toRevoke.push('u4');
    // u23 Imparable: racha 25→35
    if (playerStats.achievements.includes('u23') && (playerStats.maxStreak||0) < 35) toRevoke.push('u23');
    // u16 Frenesí Máximo: mult x4 → frenesís 15 (cambio de stat)
    if (playerStats.achievements.includes('u16') && (playerStats.frenziesTriggered||0) < 15) toRevoke.push('u16');
    // x17 Veterano: 100→150 partidas
    if (playerStats.achievements.includes('x17') && (playerStats.gamesPlayed||0) < 150) toRevoke.push('x17');
    // u15 Superviviente: 100→120 preguntas
    if (playerStats.achievements.includes('u15') && (playerStats.maxQuestionReached||0) < 120) toRevoke.push('u15');

    if (toRevoke.length > 0) {
        playerStats.achievements     = playerStats.achievements.filter(id => !toRevoke.includes(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke.includes(id));
    }

    playerStats.migratedV3 = true;
    saveStatsLocally();
})();

// ── MIGRACIÓN tracks: remapea IDs de pistas viejas ──
// ── MIGRACIÓN kpRewards: acredita recompensas del Klick Pass que nunca se sumaron a totalScore ──
// Se ejecuta UNA vez. Los claims anteriores al fix no sumaban su recompensa a playerStats.totalScore.
(function migrateKpRewards() {
    if (playerStats.migratedKpRewards) return;
    try {
        const raw = localStorage.getItem('klickpass_v2');
        if (raw) {
            const kpSt = JSON.parse(raw);
            const claimed = Array.isArray(kpSt.claimed) ? kpSt.claimed : [];
            if (claimed.length > 0) {
                // _KP_REWARDS está definido más adelante en el archivo — usamos los valores hardcoded
                // para calcular el total correcto sin depender del orden de declaración
                const _KP_REWARDS_MIG = [
                  100,104,108,111,116,120,124,129,134,139,
                  144,149,154,160,166,172,178,185,192,199,
                  206,214,222,230,238,247,256,266,276,286,
                  296,307,319,330,342,355,368,382,396,410,
                  426,441,457,474,492,510,529,548,568,589,
                  611,634,657,681,706,732,759,787,816,847,
                  878,910,944,978,1015,1052,1091,1131,1173,1216,
                  1261,1307,1355,1405,1457,1511,1567,1624,1684,1746,
                  1811,1877,1947,2018,2093,2170,2250,2333,2419,2508,
                  2601,2697,2796,2899,3006,3117,3232,3351,3476,5000
                ];
                let totalToCredit = 0;
                claimed.forEach(lvNum => {
                    if (lvNum >= 1 && lvNum <= 100) {
                        totalToCredit += _KP_REWARDS_MIG[lvNum - 1] || 0;
                    }
                });
                if (totalToCredit > 0) {
                    playerStats.totalScore = (playerStats.totalScore || 0) + totalToCredit;
                }
            }
        }
    } catch(e) {}
    playerStats.migratedKpRewards = true;
    saveStatsLocally();
})();

(function migrateTrackIds() {
    const remap = { 'track_electro': 'track_pulse', 'track_frenzy': 'track_bass' };
    if (remap[playerStats.selectedTrack]) {
        playerStats.selectedTrack = remap[playerStats.selectedTrack];
    }
    if (playerStats.tracksTriedSet) {
        playerStats.tracksTriedSet = playerStats.tracksTriedSet.map(id => remap[id] || id);
    }
})();

function saveStatsLocally() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(playerStats)); } catch(e) { /* Safari private mode */ }
}
// Versión debounced para guardados frecuentes durante gameplay (evita bloquear el hilo principal)
// Usa 1500ms de delay — suficiente para batear ráfagas de checkAchievements mid-game
let _saveTimeout = null;
let _saveLastForced = 0;
function saveStatsDebounced(force = false) {
    clearTimeout(_saveTimeout);
    const now = Date.now();
    // Si ha pasado más de 10s desde el último guardado forzado, guardar de inmediato
    if (force || (now - _saveLastForced) > 10000) {
        _saveLastForced = now;
        saveStatsLocally();
        return;
    }
    _saveTimeout = setTimeout(() => { _saveLastForced = Date.now(); saveStatsLocally(); }, 1500);
}

// ── Revoca logros obtenidos por bugs/errores de lógica ──────────────────────
// Función pública: puede llamarse en cualquier momento para limpiar logros inválidos.
function revokeInvalidAchievements() {
    // CHRISTOPHER: nunca revocar logros de la cuenta de prueba
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return 0;
    const before = playerStats.achievements.length;
    const s = playerStats;
    const toRevoke = new Set();

    // ── 0. HUÉRFANOS — IDs que ya no existen en el banco de logros ───────────
    s.achievements.forEach(id => {
        if (!ACHIEVEMENTS_MAP.has(id)) toRevoke.add(id);
    });

    // Helpers
    const has   = id => s.achievements.includes(id);
    const mark  = id => toRevoke.add(id);
    const check = (id, cond) => { if (has(id) && !cond) mark(id); };
    const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
    const accuracy = totalAns > 0 ? Math.round((s.totalCorrect||0)/totalAns*100) : 0;
    const normalAchs = s.achievements.filter(id => ACHIEVEMENTS_MAP.has(id)).length;
    const kpClaimed  = (getKpState().claimed||[]).length;

    // ── 1. ESCALAS NUMÉRICAS — verifica cada tier contra el stat real ────────

    // Partidas jugadas (p1–p8): [1,5,10,25,50,100,200,500]
    const _ptT=[1,5,10,25,50,100,200,500];
    for(let i=0;i<8;i++) check(`p${i+1}`, (s.gamesPlayed||0) >= _ptT[i]);

    // Partidas por día, escala (td1–td5): [3,5,8,10,15]
    const _tdT=[3,5,8,10,15];
    for(let i=0;i<5;i++) check(`td${i+1}`, (s.todayGames||0) >= _tdT[i]);

    // Días consecutivos (d1–d5): [1,2,3,5,7]
    const _dcT=[1,2,3,5,7];
    for(let i=0;i<5;i++) check(`d${i+1}`, (s.maxLoginStreak||0) >= _dcT[i]);

    // Días distintos total (d6–d10): [15,21,30,60,90]
    const _ddT=[15,21,30,60,90];
    for(let i=0;i<5;i++) check(`d${i+6}`, (s.totalDaysPlayed||0) >= _ddT[i]);

    // Asiduo (td21–td25): [7,12,18,25,45]
    const _td2T=[7,12,18,25,45];
    for(let i=0;i<5;i++) check(`td2${i+1}`, (s.totalDaysPlayed||0) >= _td2T[i]);

    // Fiel - retorno (ret1–ret5): [3,8,20,40,75]
    const _retT=[3,8,20,40,75];
    for(let i=0;i<5;i++) check(`ret${i+1}`, (s.totalDaysPlayed||0) >= _retT[i]);

    // Récord en partida (bs1–bs8): [5000,25000,75000,150000,300000,600000,1000000,2000000]
    const _bsT=[5000,25000,75000,150000,300000,600000,1000000,2000000];
    for(let i=0;i<8;i++) check(`bs${i+1}`, (s.bestScore||0) >= _bsT[i]);

    // Puntos totales (pt1–pt8): [10000,50000,200000,500000,1000000,2500000,5000000,10000000]
    const _ptsTiers=[10000,50000,200000,500000,1000000,2500000,5000000,10000000];
    for(let i=0;i<8;i++) check(`pt${i+1}`, (s.totalScore||0) >= _ptsTiers[i]);

    // Partidas superando 100k (hs1–hs8): [1,3,5,10,20,35,50,100]
    const _hsT=[1,3,5,10,20,35,50,100];
    if ((s.bestScore||0) < 100000) {
        for(let i=0;i<8;i++) mark(`hs${i+1}`);
    } else {
        for(let i=0;i<8;i++) check(`hs${i+1}`, (s.maxScoreCount||0) >= _hsT[i]);
    }

    // Preguntas alcanzadas (pf1–pf8): [10,20,30,50,75,100,150,200]
    const _pfT=[10,20,30,50,75,100,150,200];
    for(let i=0;i<8;i++) check(`pf${i+1}`, (s.maxQuestionReached||0) >= _pfT[i]);
    check('pf9',  (s.maxQuestionReached||0) >= 300);
    check('pf10', (s.maxQuestionReached||0) >= 400);
    check('pf11', (s.maxQuestionReached||0) >= 800);

    // Racha máxima (sk1–sk8): [5,10,15,20,25,30,40,50]
    const _skT=[5,10,15,20,25,30,40,50];
    for(let i=0;i<8;i++) check(`sk${i+1}`, (s.maxStreak||0) >= _skT[i]);

    // Multiplicadores (mx1–mx4 loop + mx5–mx10 individuales)
    const _mxT=[2,3,4,5];
    for(let i=0;i<4;i++) check(`mx${i+1}`, (s.maxMult||1) >= _mxT[i]);
    check('mx5',  (s.maxMult||1) >= 5 && (s.gamesPlayed||0) >= 30);
    check('mx6',  (s.maxMult||1) >= 6);
    check('mx7',  (s.maxMult||1) >= 7);
    check('mx8',  (s.maxMult||1) >= 8);
    check('mx9',  (s.maxMult||1) >= 9);
    check('mx10', (s.maxMult||1) >= 10);

    // Respuestas rápidas (sp1–sp8): [5,15,30,60,100,200,350,500] + sp9-sp11
    const _spT=[5,15,30,60,100,200,350,500];
    for(let i=0;i<8;i++) check(`sp${i+1}`, (s.fastAnswersTotal||0) >= _spT[i]);
    check('sp9',  (s.fastAnswersTotal||0) >= 2000);
    check('sp10', (s.fastAnswersTotal||0) >= 5000);
    check('sp11', (s.fastAnswersTotal||0) >= 10000);

    // Sin timeout consecutivo (nt1–nt5): [5,10,20,35,50]
    const _ntT=[5,10,20,35,50];
    for(let i=0;i<5;i++) check(`nt${i+1}`, (s.maxNoTimeoutStreak||0) >= _ntT[i]);

    // Frenesís activados (r1–r8): [1,5,10,25,50,100,200,500]
    const _frT=[1,5,10,25,50,100,200,500];
    for(let i=0;i<8;i++) check(`r${i+1}`, (s.frenziesTriggered||0) >= _frT[i]);

    // Frenesí eterno (ft1–ft5): [3,5,8,12,20]
    const _ftT=[3,5,8,12,20];
    for(let i=0;i<5;i++) check(`ft${i+1}`, (s.maxFrenzyStreak||0) >= _ftT[i]);

    // Aciertos totales (ac1–ac8): [10,50,100,250,500,1000,2500,5000]
    const _acT=[10,50,100,250,500,1000,2500,5000];
    for(let i=0;i<8;i++) check(`ac${i+1}`, (s.totalCorrect||0) >= _acT[i]);

    // Respuestas incorrectas (wr1–wr5): [10,50,100,250,500]
    const _wrT=[10,50,100,250,500];
    for(let i=0;i<5;i++) check(`wr${i+1}`, (s.totalWrong||0) >= _wrT[i]);

    // Timeouts (to1–to5): [5,20,50,100,250]
    const _toT=[5,20,50,100,250];
    for(let i=0;i<5;i++) check(`to${i+1}`, (s.totalTimeouts||0) >= _toT[i]);

    // Visitas al perfil (pv1–pv5): [1,5,15,30,60]
    const _pvT=[1,5,15,30,60];
    for(let i=0;i<5;i++) check(`pv${i+1}`, (s.profileViews||0) >= _pvT[i]);

    // Visitas al ranking (rv1–rv5): [1,5,15,30,60]
    const _rvT=[1,5,15,30,60];
    for(let i=0;i<5;i++) check(`rv${i+1}`, (s.rankingViews||0) >= _rvT[i]);

    // Visitas a configuración (cv1–cv4): [1,5,15,30]
    const _cvT=[1,5,15,30];
    for(let i=0;i<4;i++) check(`cv${i+1}`, (s.configViews||0) >= _cvT[i]);

    // Visitas a pantalla de rangos (rk1–rk3): [1,5,15]
    const _rkT=[1,5,15];
    for(let i=0;i<3;i++) check(`rk${i+1}`, (s.ranksViews||0) >= _rkT[i]);

    // Visitas al banco de logros (m4–m6): [1,10,50]
    check('m4', (s.achViews||0) >= 1);
    check('m5', (s.achViews||0) >= 10);
    check('m6', (s.achViews||0) >= 50);

    // Fijaciones de logro (pin1–pin5): [1,5,10,20,50]
    const _pinT=[1,5,10,20,50];
    for(let i=0;i<5;i++) check(`pin${i+1}`, (s.totalPins||0) >= _pinT[i]);

    // Logros desbloqueados en un día (da1–da5): [1,3,5,8,12]
    const _daT=[1,3,5,8,12];
    for(let i=0;i<5;i++) check(`da${i+1}`, (s.dailyAchUnlocks||0) >= _daT[i]);

    // Colección de logros (m8, m9, m10): [10,25,50]
    check('m8',  normalAchs >= 10);
    check('m9',  normalAchs >= 25);
    check('m10', normalAchs >= 50);

    // Maestros de colección (master1–master5): [75,100,150,200,300]
    check('master1', normalAchs >= 75);
    check('master2', normalAchs >= 100);
    check('master4', normalAchs >= 150);
    check('master5', normalAchs >= 200);
    check('master3', normalAchs >= 300);

    // Klick Pass niveles (kpa1–kpa5): [1,25,50,75,100]
    check('kpa1', kpClaimed >= 1);
    check('kpa2', kpClaimed >= 25);
    check('kpa3', kpClaimed >= 50);
    check('kpa4', kpClaimed >= 75);
    check('kpa5', kpClaimed >= 100);
    check('kpa7', (s.kpClaimDays||[]).length >= 3);
    check('kpa8', (s.kpClaimDays||[]).length >= 7);
    check('kpa9', (s.kpClaimDays||[]).length >= 15);
    check('kpa10', kpClaimed >= 100 && normalAchs >= 300);

    // Power Level (nm8, nm9, nm10): [10000, 100000, 1000000]
    check('nm8',  (s.powerLevel||0) >= 10000);
    check('nm9',  (s.powerLevel||0) >= 100000);
    check('nm10', (s.powerLevel||0) >= 1000000);

    // Clasificación (nm2, nm3, nm4): posición real
    const rp = s.rankingPosition||999;
    check('nm2', rp <= 10);
    check('nm3', rp <= 3);
    check('nm4', rp === 1);

    // Egocéntrico visitas al banco de logros extra
    check('m2', (s.nameChanges||0) >= 5);
    check('m3', (s.nameChanges||0) >= 20);

    // ── 2. LOGROS POR FLAGS — requieren un flag booleano guardado ────────────
    check('fin1', !!s.playedNocturno);
    check('fin2', !!s.playedMadrugador);
    check('x18',  s.nameChanges === 0 && (s.maxLoginStreak||0) >= 30);
    check('u13',  (s.flashAnswersTotal||0) >= 1);
    check('u11',  !!s.fenixEarned);
    check('u19',  !!s.u19PersistEarned);
    check('x4',   !!s.doubleVictory);
    check('x6',   !!s.consistent5Games);
    check('x7',   !!s.fastStart3k);
    check('x12',  !!s.firstGameOfDay50k);
    check('x15',  !!s.hitExactly100k || ((s.bestScore||0)>=99500 && (s.bestScore||0)<=100500));
    check('x5',   !!s.revengeGame);
    check('x8',   !!s.xSinPrisa);
    check('x16',  (s.returnTriumph||0) >= 1);
    check('x19',  !!s.flashInOneGame);
    check('x14',  !!s.invictoEarned);
    check('x10',  !!s.x10Earned);
    check('extra1', (s.maxFrenziesInGame||0) >= 2);
    check('extra2', !!s.hadPerfectAccuracyGame);
    check('extra4', (s.gamesAtMusicZero||0) >= 5);
    check('u24',  (s.extremisCount||0) >= 1);
    check('ui5',  (s.profileViewedAfterGames||0) >= 5);
    check('nm5',  (s.consecutiveRankUpDays||0) >= 3);
    check('nm6',  !!s.surpassedHighPLPlayer);
    check('nm7',  !!s.rankRemontada);
    check('rl9',  !!s.rouletteShieldUsed);
    check('rl10', !!s.rouletteComboSpecial);

    // ── 3. ESCALAS DE RULETA ─────────────────────────────────────────────────
    check('rl6', (s.rouletteSpins||0) >= 10);
    check('rl7', (s.rouletteSpins||0) >= 50);
    check('rl8', (s.rouletteLifeWins||0) >= 3);

    // ── 4. LOGROS DE RANGO — derivados del stat real, no de flags ────────────
    const _rankTitle = getRankInfo(s).title;
    const _rankOrder = ['Novato','Junior','Pro','Maestro','Leyenda','Eterno','Mítico','Divinidad'];
    const _ri = _rankOrder.indexOf(_rankTitle);
    check('u_junior', _ri >= 1);   // Junior o superior
    check('u6',       _ri >= 2);   // Pro o superior
    check('u7',       _ri >= 3);   // Maestro o superior
    check('u8',       _ri >= 4);   // Leyenda o superior
    check('u_eterno', _ri >= 5);   // Eterno o superior
    check('et1', _ri >= 5);
    check('et2', _ri >= 5 && normalAchs >= 100);
    check('et3', _ri >= 5 && (s.totalDaysPlayed||0) >= 20);
    check('u_mitico', _ri >= 6 &&  // Mítico: además verificar todos sus requisitos
        (s.totalScore||0)>=1200000 && (s.totalCorrect||0)>=5500 &&
        (s.perfectGames||0)>=55 && normalAchs>=280 && (s.maxStreak||0)>=45 &&
        (s.maxMult||1)>=8 && accuracy>=85 && (s.gamesPlayed||0)>=320);
    check('mit1', _ri >= 6);
    check('mit2', _ri >= 6 && (s.gamesPlayed||0)>=320);
    check('mit3', _ri >= 6 && normalAchs>=280);

    // Podio (pod1–pod3): requieren rango Leyenda+ Y posición top
    const _isLeyendaPlus = _ri >= 4;
    check('pod1', rp === 1 && _isLeyendaPlus);
    check('pod2', rp === 2 && _isLeyendaPlus);
    check('pod3', rp === 3 && _isLeyendaPlus);

    // ── 5. LOGROS COMBINADOS ─────────────────────────────────────────────────
    check('fin4', (s.maxLoginStreak||0) >= 7 && _ri >= 1);
    check('fin5', _ri >= 5 && normalAchs >= 160);
    check('x17',  (s.gamesPlayed||0) >= 150);
    check('u15',  (s.maxQuestionReached||0) >= 120);
    check('u23',  (s.maxStreak||0) >= 35);
    check('u16',  (s.frenziesTriggered||0) >= 15);
    check('u2',   (s.totalWrong||0) >= 75);
    check('u4',   (s.totalTimeouts||0) >= 35);
    check('extra5', (s.dailyAchUnlocks||0) >= 15);
    check('extra3', (s.maxQuestionReached||0) >= 80);
    check('np3',  (s.maxQuestionReached||0) >= 60);
    check('u17',  (s.lastSecondAnswersTotal||0) >= 50);
    check('u22',  (s.todayGames||0) >= 50);
    check('u_bisturi', totalAns >= 500 && accuracy >= 90);
    check('x13',  (s.todayGames||0) >= 10);
    check('div1', (s.totalScore||0) >= 2000000);
    check('div2', (s.totalCorrect||0) >= 8000);
    check('div3', (s.perfectGames||0) >= 75);

    // El Arquitecto (cx1–cx4) — todos basados en christopherCardViews (clicks reales en tarjeta)
    check('cx1', (s.christopherCardViews||0) >= 1);
    check('cx2', (s.christopherCardViews||0) >= 3);
    check('cx3', (s.christopherCardViews||0) >= 10);
    check('cx4', (s.christopherCardViews||0) >= 25);

    // ── 6. NOTIFICACIÓN Y GUARDADO ───────────────────────────────────────────
    if (toRevoke.size > 0) {
        s.achievements       = s.achievements.filter(id => !toRevoke.has(id));
        s.pinnedAchievements = s.pinnedAchievements.filter(id => !toRevoke.has(id));
        // Si el título equipado fue revocado, limpiarlo
        if (s.equippedTitle && toRevoke.has(s.equippedTitle)) s.equippedTitle = null;
        saveStatsLocally();
        const revokedCount = before - s.achievements.length;
        if (revokedCount > 0) {
            showToast('Logros Corregidos', `Se retiraron ${revokedCount} logro(s) concedido(s) por error.`, 'var(--accent-orange)', SVG_SHIELD);
            renderAchievements();
        }
    }
    return toRevoke.size;
}

window.addEventListener('beforeunload', () => {
    saveStatsLocally();
});

// --- Audio y Reactividad Musical ---
// ── AUDIO ENGINE (Web Audio API – lookahead scheduler) ──────────────────
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let masterMusicGain, masterSFXGain, masterLimiter, audioAnalyser, audioDataArray;
let isMusicPlaying = false, musicSeqStep = 0, nextNoteTime = 0, musicTimerID = null;
let chordIndex = 0;
// Lookahead and schedule interval (seconds / ms) – tight for accuracy
const SCHED_AHEAD = 0.12;   // schedule this far ahead
const SCHED_INTERVAL = 25;  // scheduler polling interval ms

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        // Master music gain (lower so it doesn't overpower SFX)
        masterMusicGain = audioCtx.createGain();
        masterMusicGain.gain.value = playerStats.musicVol * 0.8;
        // Master SFX gain
        masterSFXGain = audioCtx.createGain();
        masterSFXGain.gain.value = playerStats.sfxVol;
        // Limiter/compressor to avoid clipping
        masterLimiter = audioCtx.createDynamicsCompressor();
        masterLimiter.threshold.value = -3;
        masterLimiter.knee.value = 3;
        masterLimiter.ratio.value = 12;
        masterLimiter.attack.value = 0.001;
        masterLimiter.release.value = 0.1;
        // Analyser for visuals
        audioAnalyser = audioCtx.createAnalyser();
        audioAnalyser.fftSize = 64;
        audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        // Routing: music -> analyser -> limiter -> out
        //          sfx             -> limiter -> out
        masterMusicGain.connect(audioAnalyser);
        audioAnalyser.connect(masterLimiter);
        masterSFXGain.connect(masterLimiter);
        masterLimiter.connect(audioCtx.destination);
        startMusicEngine();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function updateVolumes() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    if (masterMusicGain) masterMusicGain.gain.setTargetAtTime(playerStats.musicVol * 0.8, t, 0.05);
    if (masterSFXGain)   masterSFXGain.gain.setTargetAtTime(playerStats.sfxVol, t, 0.05);
}

let currentAudioPulse = 0;
let smoothedPulse = 0;
function getAudioPulse() {
    if (!audioAnalyser) return 0;
    audioAnalyser.getByteFrequencyData(audioDataArray);
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += audioDataArray[i];
    const rawPulse = sum / (4 * 255);
    // Smooth the pulse with lerp to avoid sudden jumps
    smoothedPulse += (rawPulse - smoothedPulse) * 0.15;
    currentAudioPulse = smoothedPulse;
    return currentAudioPulse;
}

// Schedule a single oscillator note at an exact AudioContext time
function schedNote(freq, type, startTime, duration, vol, dest) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(dest || masterSFXGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
}

// Play an SFX: array of [freq, type, offsetSec, duration, vol]
function playSFX(notes) {
    if (!audioCtx || playerStats.sfxVol === 0) return;
    const now = audioCtx.currentTime + 0.01;  // tiny buffer to avoid scheduling in past
    notes.forEach(([freq, type, offset, duration, vol]) => {
        schedNote(freq, type, now + offset, duration, vol * playerStats.sfxVol);
    });
}

// Noise burst for music (scheduled to exact time)
function playNoiseAt(time, duration, vol, cutoff = 5000) {
    if (!audioCtx) return;
    const sr = audioCtx.sampleRate;
    const buf = audioCtx.createBuffer(1, Math.ceil(sr * duration), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src    = audioCtx.createBufferSource();
    const gain   = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    src.buffer = buf;
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(masterMusicGain);
    src.start(time);
}

// ── TRACK SELECTION SYSTEM ───────────────────────────────────────────────
const MUSIC_TRACKS = [
    {
        id: 'track_chill',
        name: 'Neon Chill',
        desc: 'Ambiental · Suave',
        color: 'var(--accent-blue)'
    },
    {
        id: 'track_pulse',
        name: 'Dark Tide',
        desc: 'Oscuro · Profundo',
        color: 'var(--accent-green)'
    },
    {
        id: 'track_bass',
        name: 'Deep Current',
        desc: 'Bass · Groovy',
        color: 'var(--accent-purple)'
    }
];

function renderTrackSelector() {
    const container = document.getElementById('track-selector');
    if (!container) return;
    const currentTrack = playerStats.selectedTrack || 'track_chill';
    container.innerHTML = MUSIC_TRACKS.map(t => {
        const isSelected = t.id === currentTrack;
        return `
        <div onclick="selectTrack('${t.id}')" class="track-option${isSelected ? ' selected' : ''}" style="
            flex:1;min-width:120px;padding:12px 15px;border-radius:var(--radius-md);
            border:1.5px solid ${isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'};
            background:${isSelected ? 'rgba(255,255,255,0.07)' : 'transparent'};
            cursor:pointer;text-align:center;transition:all 0.25s;
            box-shadow:${isSelected ? '0 0 15px rgba(255,255,255,0.08)' : 'none'};
        ">
            <div style="font-size:0.8rem;font-weight:800;color:${isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'};text-transform:uppercase;letter-spacing:1px;">${t.name}</div>
            <div style="font-size:0.65rem;color:var(--text-secondary);margin-top:3px;">${t.desc}</div>
        </div>
    `}).join('');
}

function selectTrack(trackId) {
    if (!audioCtx) initAudio();
    SFX.click();
    const prev = playerStats.selectedTrack || 'track_chill';
    playerStats.selectedTrack = trackId;
    saveStatsLocally();
    renderTrackSelector();
    // Track changed achievement
    if (prev !== trackId) {
        playerStats.trackSwitches = (playerStats.trackSwitches || 0) + 1;
        const trackIds = MUSIC_TRACKS.map(t => t.id);
        if (!playerStats.tracksTriedSet) playerStats.tracksTriedSet = [];
        if (!playerStats.tracksTriedSet.includes(trackId)) {
            playerStats.tracksTriedSet.push(trackId);
        }
        if (playerStats.tracksTriedSet.length >= 3) {
            playerStats.triedAllTracks = true;
        }
        checkAchievements();
    }
    // Restart music engine with new track
    if (isMusicPlaying && audioCtx) {
        stopMusicEngine();
        startMusicEngine();
    }
}

function stopMusicEngine() {
    isMusicPlaying = false;
    clearTimeout(musicTimerID);
    musicSeqStep = 0;
    chordIndex = 0;
}

// Track-specific music definitions
const TRACK_CONFIGS = {
    // NEON CHILL: slow ambient, sine waves only, pads, no percussion aggression
    track_chill: {
        bpmBase: 88, bpmFrenzy: 104,
        CHORD_PROG: [[57,62,65,69],[60,65,67,72],[62,65,69,74],[55,60,62,67]],
        ARP_PAT: [0,2,1,3,0,1,2,0,3,1,0,2,1,3,2,0],
        arpType: 'sine', bassType: 'sine', kickFreq: 80,
        kickVol: 0.3, bassVol: 0.2, arpVol: 0.18,
        hasPad: true, hasHihat: false
    },
    // DARK TIDE: tétrico, profundo, oscuro. Órgano menor, bajo de dron, grave e inquietante.
    // Sin campanas, sin brillos. Todo en registro bajo, progresión menor, lento y sombrío.
    track_pulse: {
        bpmBase: 60, bpmFrenzy: 78,
        CHORD_PROG: [[40,47,52,55],[38,45,50,53],[36,43,48,52],[41,48,53,57]],
        ARP_PAT: [0,2,1,3,2,0,3,1,0,2,3,0,1,3,2,1],
        arpType: 'sawtooth', bassType: 'sawtooth', kickFreq: 42,
        kickVol: 0.85, bassVol: 0.62, arpVol: 0.13,
        hasPad: true, hasHihat: false, hasDrone: true
    },
    // DEEP CURRENT: slow to mid, sawtooth bass dominant, sparse melody, groovey feel
    track_bass: {
        bpmBase: 98, bpmFrenzy: 118,
        CHORD_PROG: [[48,55,60,67],[50,57,62,69],[52,55,59,64],[46,53,58,65]],
        ARP_PAT: [1,0,2,0,3,0,1,2,0,3,1,0,2,0,3,1],
        arpType: 'triangle', bassType: 'sawtooth', kickFreq: 55,
        kickVol: 0.7, bassVol: 0.55, arpVol: 0.15,
        hasPad: false, hasHihat: false, hasWobble: true
    }
};

function getActiveTrack() {
    return TRACK_CONFIGS[playerStats.selectedTrack || 'track_chill'] || TRACK_CONFIGS.track_chill;
}

// ── ARCHITECT TRACK — Música épica, oscura y madura ───────────────
// Estilo: ambient orquestal oscuro. Referencia de timbre: Hans Zimmer
// (Interstellar, Inception). Sin melodía de flauta aguda. Sin percusión.
// Todo en registro bajo y medio. Capas:
//   1. Dron de órgano grave: triangle filtrado, notas muy largas
//   2. Pad orquestal: 4 voces sawtooth muy filtradas y lentas
//   3. Melodía de cuerda grave: triangle, notas largas, legato
//   4. Contrapunto armónico: sine filtrado, responde a la melodía
// Progresión: Dm → Bb → Gm → A (menor frigio con dominante — oscuro)
// BPM 48 — paso de medio compás, todo muy pausado y solemne.
// GainNode propio — no interfiere con masterMusicGain.

const _ARCH_BPM  = 48;
const _ARCH_STEP = 60.0 / _ARCH_BPM / 2; // medio compás por step (muy lento)

// Acordes en registro bajo. Solo notas en octavas 2–4.
// Dm: D2-F2-A2-D3  Bb: Bb1-D2-F2-Bb2  Gm: G1-Bb1-D2-G2  A: A1-E2-A2-C#3
const _ARCH_CHORDS = [
    [38, 41, 45, 50],  // Dm : D2 F2 A2 D3
    [34, 38, 41, 46],  // Bb : Bb1 D2 F2 Bb2
    [31, 34, 38, 43],  // Gm : G1 Bb1 D2 G2
    [33, 40, 45, 49],  // A  : A1 E2 A2 C#3
];

// Melodía de cuerda grave — 8 pasos, notas largas, una por step
// Índice dentro del acorde, registro +12 (una octava arriba de las raíces)
const _ARCH_MEL = [0, 2, 1, 3, 2, 0, 3, 1];

let _architectMusicActive = false;
let _architectMusicTimer  = null;
let _architectMusicStep   = 0;
let _architectChordIdx    = 0;
let _architectNextNote    = 0;
let _architectGain        = null;

function _getArchitectGain() {
    if (!audioCtx) return null;
    if (!_architectGain || _architectGain.context !== audioCtx) {
        _architectGain = audioCtx.createGain();
        _architectGain.gain.value = 0.0001;
        _architectGain.connect(masterLimiter);
    }
    return _architectGain;
}

function startArchitectMusic() {
    if (!audioCtx) { try { initAudio(); } catch(e) { return; } }
    if (!audioCtx) return;
    const ag = _getArchitectGain();
    if (!ag) return;
    const t   = audioCtx.currentTime;
    const vol = Math.max(playerStats.musicVol, 0.01) * 0.68;
    ag.gain.cancelScheduledValues(t);
    ag.gain.setValueAtTime(0.0001, t);
    ag.gain.linearRampToValueAtTime(vol, t + 2.0); // fade-in largo, majestuoso
    _architectMusicActive = true;
    _architectMusicStep   = 0;
    _architectChordIdx    = 0;
    _architectNextNote    = t + 0.05;
    _architectTick();
}

function stopArchitectMusic() {
    _architectMusicActive = false;
    clearTimeout(_architectMusicTimer);
    _architectMusicTimer = null;
    if (_architectGain && audioCtx) {
        const t = audioCtx.currentTime;
        _architectGain.gain.cancelScheduledValues(t);
        _architectGain.gain.setValueAtTime(_architectGain.gain.value, t);
        _architectGain.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    }
}

function _architectTick() {
    if (!_architectMusicActive || !audioCtx) return;
    if (audioCtx.state === 'suspended') {
        _architectMusicTimer = setTimeout(_architectTick, 80); return;
    }
    while (_architectNextNote < audioCtx.currentTime + 0.25) {
        _architectPlayStep(_architectNextNote);
        _architectNextNote += _ARCH_STEP;
        _architectMusicStep++;
        if (_architectMusicStep >= 8) {
            _architectMusicStep = 0;
            _architectChordIdx  = (_architectChordIdx + 1) % _ARCH_CHORDS.length;
        }
    }
    _architectMusicTimer = setTimeout(_architectTick, 20);
}

function _architectPlayStep(t) {
    const ag    = _getArchitectGain();
    if (!ag) return;
    const step  = _architectMusicStep;
    const chord = _ARCH_CHORDS[_architectChordIdx];
    const dur   = _ARCH_STEP; // duración de un step

    // ── 1. DRON DE ÓRGANO GRAVE ──────────────────────────────────
    // Solo en step 0 de cada acorde — nota muy larga, ocupa todo el compás
    if (step === 0) {
        const totalDur = dur * 8; // dura los 8 pasos = un ciclo completo de acorde
        // Tres armónicos del fundamental: fundamental, quinta, octava
        const freqs = [
            midiToHz(chord[0] - 12),       // fundamental -1 octava
            midiToHz(chord[0] - 12) * 1.5, // quinta natural
            midiToHz(chord[0]),             // fundamental
        ];
        const vols = [0.18, 0.09, 0.07];
        freqs.forEach((freq, i) => {
            const o = audioCtx.createOscillator();
            const g = audioCtx.createGain();
            const lp = audioCtx.createBiquadFilter();
            o.type = 'triangle'; // triangle: más cálido que sine, más oscuro que sawtooth
            o.frequency.setValueAtTime(freq, t);
            // Detune muy leve para crear batimiento (efecto de órgano vivo)
            o.detune.setValueAtTime(i === 1 ? 3 : i === 2 ? -2 : 0, t);
            lp.type = 'lowpass';
            lp.frequency.value = 280 + i * 60; // filtro cada vez más abierto
            lp.Q.value = 0.8;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vols[i], t + 1.8);
            g.gain.setValueAtTime(vols[i], t + totalDur - 1.8);
            g.gain.linearRampToValueAtTime(0.0001, t + totalDur);
            o.connect(lp); lp.connect(g); g.connect(ag);
            o.start(t); o.stop(t + totalDur + 0.1);
        });
    }

    // ── 2. PAD ORQUESTAL ─────────────────────────────────────────
    // También solo en step 0. Cuatro voces sawtooth muy filtradas.
    // El filtro a 400Hz lo convierte en algo parecido a cuerdas.
    if (step === 0) {
        const padDur = dur * 8;
        chord.forEach((note, i) => {
            const o  = audioCtx.createOscillator();
            const g  = audioCtx.createGain();
            const lp = audioCtx.createBiquadFilter();
            o.type = 'sawtooth';
            o.frequency.setValueAtTime(midiToHz(note), t);
            o.detune.setValueAtTime([-5, 3, -2, 6][i], t); // chorus sutil
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(380, t);
            lp.frequency.linearRampToValueAtTime(520, t + 2.0); // abre lentamente
            lp.Q.value = 1.2;
            const vol = [0.048, 0.036, 0.030, 0.022][i];
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(vol, t + 2.5); // ataque muy lento = legato
            g.gain.setValueAtTime(vol, t + padDur - 2.0);
            g.gain.linearRampToValueAtTime(0.0001, t + padDur);
            o.connect(lp); lp.connect(g); g.connect(ag);
            o.start(t); o.stop(t + padDur + 0.1);
        });
    }

    // ── 3. MELODÍA DE CUERDA GRAVE ───────────────────────────────
    // Una nota por step, triangle filtrado. Registro medio-bajo.
    // Legato: cada nota dura casi 2 steps para que se solapen.
    {
        const melIdx  = _ARCH_MEL[step];
        const noteMidi = chord[melIdx % chord.length] + 12; // una octava sobre el pad
        const melDur  = dur * 1.85; // ligeramente más larga que el step → legato
        const o  = audioCtx.createOscillator();
        const g  = audioCtx.createGain();
        const lp = audioCtx.createBiquadFilter();
        o.type = 'triangle';
        o.frequency.setValueAtTime(midiToHz(noteMidi), t);
        // Portamento leve desde nota anterior (pequeño glide)
        o.frequency.setValueAtTime(midiToHz(noteMidi) * 0.985, t);
        o.frequency.linearRampToValueAtTime(midiToHz(noteMidi), t + 0.12);
        lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.5;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.10, t + 0.08);
        g.gain.setValueAtTime(0.10, t + melDur * 0.7);
        g.gain.linearRampToValueAtTime(0.0001, t + melDur);
        o.connect(lp); lp.connect(g); g.connect(ag);
        o.start(t); o.stop(t + melDur + 0.05);
    }

    // ── 4. CONTRAPUNTO ARMÓNICO ───────────────────────────────────
    // Responde a la melodía en pasos alternos. Sine, una octava más abajo.
    // Crea tensión/resolución sin ser percusivo.
    if (step % 2 === 1) {
        const cpIdx   = _ARCH_MEL[(step + 1) % 8]; // nota siguiente de la melodía
        const cpMidi  = chord[cpIdx % chord.length]; // misma nota, sin +12
        const cpDur   = dur * 1.5;
        const o  = audioCtx.createOscillator();
        const g  = audioCtx.createGain();
        const lp = audioCtx.createBiquadFilter();
        o.type = 'sine';
        o.frequency.setValueAtTime(midiToHz(cpMidi), t);
        lp.type = 'lowpass'; lp.frequency.value = 600;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.055, t + 0.10);
        g.gain.exponentialRampToValueAtTime(0.0001, t + cpDur);
        o.connect(lp); lp.connect(g); g.connect(ag);
        o.start(t); o.stop(t + cpDur + 0.05);
    }
}

function startMusicEngine() {
    isMusicPlaying = true;
    musicSeqStep = 0;
    chordIndex = 0;
    nextNoteTime = audioCtx.currentTime + 0.05;
    schedulerTick();
}

function schedulerTick() {
    if (!isMusicPlaying || !audioCtx) return;
    while (nextNoteTime < audioCtx.currentTime + SCHED_AHEAD) {
        playMusicStep(nextNoteTime);
        advanceMusicStep();
    }
    musicTimerID = setTimeout(schedulerTick, SCHED_INTERVAL);
}

function advanceMusicStep() {
    const tc = getActiveTrack();
    const bpm = (typeof streak !== 'undefined' && streak >= 5) ? tc.bpmFrenzy : tc.bpmBase;
    nextNoteTime += 60.0 / bpm / 4;
    musicSeqStep++;
    if (musicSeqStep >= 16) { musicSeqStep = 0; chordIndex = (chordIndex + 1) % 4; }
}

const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

function playMusicStep(t) {
    const isFrenzy = (typeof streak !== 'undefined' && streak >= 5);
    const tc = getActiveTrack();
    const chord = tc.CHORD_PROG[chordIndex];
    const step  = musicSeqStep;

    // Kick (every 4 steps)
    if (step % 4 === 0) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(tc.kickFreq, t);
        o.frequency.exponentialRampToValueAtTime(0.01, t + 0.35);
        const kv = tc.kickVol || 0.7;
        g.gain.setValueAtTime(isFrenzy ? kv * 1.2 : kv, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g); g.connect(masterMusicGain); o.start(t); o.stop(t + 0.4);
    }

    // Snare on beat 2 and 4
    if (tc.hasSnare && (step === 4 || step === 12)) {
        playNoiseAt(t, 0.25, 0.12, 3000);
        playNoiseAt(t, 0.18, 0.08, 8000);
    }

    // Bass (every 2 steps)
    if (step % 2 === 0) {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
        o.type = tc.bassType;
        o.frequency.setValueAtTime(midiToHz(chord[0] - 12), t);
        f.type = 'lowpass';
        const bv = tc.bassVol || 0.3;
        f.frequency.setValueAtTime(isFrenzy ? 900 : 400, t);
        f.frequency.exponentialRampToValueAtTime(80, t + 0.18);
        if (tc.hasWobble) {
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.setValueAtTime(isFrenzy ? 6 : 3, t);
            lfoGain.gain.setValueAtTime(120, t);
            lfo.connect(lfoGain); lfoGain.connect(f.frequency);
            lfo.start(t); lfo.stop(t + 0.4);
        }
        g.gain.setValueAtTime(isFrenzy ? bv * 1.3 : bv, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(f); f.connect(g); g.connect(masterMusicGain); o.start(t); o.stop(t + 0.25);
    }

    // Drone: Dark Tide — continuous low sub-bass tone, very slow tremolo (every 8 steps)
    if (tc.hasDrone && step % 8 === 0) {
        const droneDur = 2.4;
        [chord[0] - 24, chord[0] - 12].forEach((m, idx) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(midiToHz(m), t);
            // slight detune for beating effect
            if (idx === 1) o.detune.setValueAtTime(8, t);
            const dv = idx === 0 ? 0.18 : 0.10;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(dv, t + 0.5);
            g.gain.setValueAtTime(dv, t + droneDur - 0.5);
            g.gain.linearRampToValueAtTime(0.0001, t + droneDur);
            o.connect(g); g.connect(masterMusicGain); o.start(t); o.stop(t + droneDur + 0.05);
        });
    }

    // Pad: sustained chord (every 16 steps = new chord)
    if (tc.hasPad && step === 0) {
        chord.forEach((note) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            // Dark Tide: use sawtooth for organ-like pad
            o.type = tc.hasDrone ? 'sawtooth' : 'sine';
            o.frequency.setValueAtTime(midiToHz(note), t);
            const padV = tc.hasDrone ? 0.045 : 0.06;
            g.gain.setValueAtTime(0.0001, t);
            g.gain.linearRampToValueAtTime(padV, t + 0.5);
            g.gain.setValueAtTime(padV, t + 1.6);
            g.gain.linearRampToValueAtTime(0.0001, t + 2.4);
            const f = audioCtx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.setValueAtTime(tc.hasDrone ? 600 : 4000, t);
            o.connect(f); f.connect(g); g.connect(masterMusicGain); o.start(t); o.stop(t + 2.5);
        });
    }

    // Arp melody (every step) — Dark Tide: sparse, only on some steps
    const doArp = tc.hasDrone ? (step % 4 === 0 || step % 4 === 3) : true;
    if (doArp) {
        const noteMidi = chord[tc.ARP_PAT[step]] + (isFrenzy ? 0 : -12);
        const arpDur = isFrenzy ? 0.18 : 0.35;
        const av = tc.arpVol || 0.25;
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), f = audioCtx.createBiquadFilter();
        o.type = tc.arpType;
        o.frequency.setValueAtTime(midiToHz(noteMidi), t);
        f.type = 'lowpass';
        f.frequency.setValueAtTime(tc.hasDrone ? 500 : (isFrenzy ? 3000 : 1200), t);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(av, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + arpDur);
        o.connect(f); f.connect(g); g.connect(masterMusicGain); o.start(t); o.stop(t + arpDur + 0.01);
    }

    // Hi-hat / frenzy noise
    if (tc.hasHihat) {
        if (step % 2 !== 0) playNoiseAt(t, 0.04, 0.08, 9000);
        if (step === 0 || step === 8) playNoiseAt(t, 0.1, 0.15, 5000);
    } else if (isFrenzy) {
        if (step % 2 !== 0) playNoiseAt(t, 0.03, 0.12, 8000);
        if (step === 0 || step === 8) playNoiseAt(t, 0.08, 0.2, 2000);
    }
}



// ── SFX definitions (all notes pre-scheduled via WebAudio clock) ─────────
const SFX = {
    // UI click: short crisp high tick
    click:        () => playSFX([[1200, 'sine', 0, 0.06, 0.05]]),
    // Timer tick: metronome-like sharp square pulse
    tick:         () => playSFX([[880, 'square', 0, 0.03, 0.03]]),
    // Answer select: low-mid soft thud (selection confirmed)
    select:       () => playSFX([[220, 'sine', 0, 0.12, 0.06], [330, 'sine', 0.03, 0.08, 0.05]]),
    // Correct: ascending chime, bright and satisfying
    correct:      () => playSFX([[659, 'sine', 0, 0.14, 0.10], [988, 'sine', 0.07, 0.18, 0.10], [1319, 'sine', 0.14, 0.22, 0.09]]),
    // Incorrect: deep descending buzz — clearly negative
    incorrect:    () => playSFX([[160, 'sawtooth', 0, 0.18, 0.08], [110, 'sawtooth', 0.06, 0.22, 0.12]]),
    // Streak trigger: synth fanfare — rising 3 tones
    streakTrigger:() => playSFX([[523, 'triangle', 0, 0.12, 0.10], [784, 'triangle', 0.10, 0.15, 0.12], [1047, 'triangle', 0.22, 0.28, 0.13]]),
    // Achievement: sparkling arpeggiated run
    achievement:  () => playSFX([[1047, 'sine', 0, 0.10, 0.09], [1319, 'sine', 0.06, 0.12, 0.09], [1568, 'sine', 0.12, 0.15, 0.09], [2093, 'sine', 0.18, 0.30, 0.10]]),
    // Game start: punchy low impact + mid tone
    gameStart:    () => playSFX([[110, 'sine', 0, 0.25, 0.08], [440, 'triangle', 0.08, 0.20, 0.12], [660, 'sine', 0.20, 0.15, 0.11]]),
    // Game end: warm resolving chord
    gameEnd:      () => playSFX([[330, 'sine', 0, 0.18, 0.14], [415, 'sine', 0.10, 0.18, 0.14], [554, 'sine', 0.20, 0.22, 0.14]]),
    // PC click: mechanical keyboard — sharp noise thud + crisp tick
    pcClick:      () => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime + 0.005;
        // Body: mid-range noise burst (mechanical thud)
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, Math.ceil(sr * 0.04), sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = audioCtx.createBufferSource();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        src.buffer = buf;
        f.type = 'bandpass';
        f.frequency.value = 3200;
        f.Q.value = 0.8;
        g.gain.setValueAtTime(playerStats.sfxVol * 0.55, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
        src.connect(f); f.connect(g); g.connect(audioCtx.destination);
        src.start(t);
        // Tick: short high transient
        const o = audioCtx.createOscillator(), g2 = audioCtx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(4800, t); o.frequency.exponentialRampToValueAtTime(2000, t + 0.015);
        g2.gain.setValueAtTime(playerStats.sfxVol * 0.12, t);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
        o.connect(g2); g2.connect(audioCtx.destination); o.start(t); o.stop(t + 0.02);
    }
};

// --- UI Modal y Configuracion ---
const FPS_VALUES = [15, 30, 60, 120, 240];
function openSettings() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    initAudio(); SFX.click();
    playerStats.configViews = (playerStats.configViews||0) + 1;
    trackSectionVisit('settings');
    playerStats._settingsOpenTime = Date.now(); // track for ui2
    saveStatsLocally(); checkAchievements();
    document.getElementById('op-music').value = playerStats.musicVol; document.getElementById('op-sfx').value = playerStats.sfxVol; 
    document.getElementById('op-particles').value = playerStats.particleOpacity; 
    document.getElementById('op-fps').value = FPS_VALUES.indexOf(playerStats.maxFps) >= 0 ? FPS_VALUES.indexOf(playerStats.maxFps) : 2;
    document.getElementById('val-music').innerText = Math.round(playerStats.musicVol*100)+'%'; document.getElementById('val-sfx').innerText = Math.round(playerStats.sfxVol*100)+'%'; 
    document.getElementById('val-particles').innerText = Math.round(playerStats.particleOpacity*100)+'%'; document.getElementById('val-fps').innerText = playerStats.maxFps+' FPS';
    // Apply theme UI
    const currentTheme = playerStats.theme || 'dark';
    const valThemeEl = document.getElementById('val-theme');
    if (valThemeEl) valThemeEl.innerText = currentTheme === 'light' ? 'Claro' : 'Oscuro';
    // Sync theme buttons state
    const _darkBtn = document.getElementById('theme-dark-btn');
    const _lightBtn = document.getElementById('theme-light-btn');
    if (_darkBtn && _lightBtn) {
        if (currentTheme === 'light') {
            _lightBtn.style.borderColor = 'rgba(0,0,0,0.4)'; _lightBtn.style.background = 'rgba(0,0,0,0.05)'; _lightBtn.firstElementChild.style.color = 'var(--text-primary)';
            _darkBtn.style.borderColor = 'rgba(0,0,0,0.1)'; _darkBtn.style.background = 'transparent'; _darkBtn.firstElementChild.style.color = 'var(--text-secondary)';
        } else {
            _darkBtn.style.borderColor = 'rgba(255,255,255,0.5)'; _darkBtn.style.background = 'rgba(255,255,255,0.07)'; _darkBtn.firstElementChild.style.color = 'var(--text-primary)';
            _lightBtn.style.borderColor = 'rgba(255,255,255,0.1)'; _lightBtn.style.background = 'transparent'; _lightBtn.firstElementChild.style.color = 'var(--text-secondary)';
        }
    }
    // Sync quality mode UI
    _syncQualityButtons(playerStats.qualityMode || 'normal', (playerStats.theme || 'dark') === 'light');

    renderTrackSelector();
    switchScreen('settings-screen');
}

document.getElementById('op-music').addEventListener('input', (e) => {
    e.stopPropagation(); 
    playerStats.musicVol = parseFloat(e.target.value); 
    document.getElementById('val-music').innerText = Math.round(playerStats.musicVol*100)+'%'; 
    updateVolumes(); 
    if(playerStats.musicVol===0) playerStats.musicSetTo0=true;
    if(playerStats.musicVol>=1.0) playerStats.musicAt100=true;
    if(playerStats.musicVol>=1.0 && (playerStats.particleOpacity||1)>=1.0) playerStats.particles100=true;
    saveStatsLocally(); _deferredCheckAch(); 
});
document.getElementById('op-sfx').addEventListener('input', (e) => { 
    playerStats.sfxVol = parseFloat(e.target.value); 
    document.getElementById('val-sfx').innerText = Math.round(playerStats.sfxVol*100)+'%'; 
    updateVolumes(); 
    if(playerStats.sfxVol===0) playerStats.sfxSetTo0=true;
    saveStatsLocally(); _deferredCheckAch(); 
});
document.getElementById('op-particles').addEventListener('input', (e) => {
    if (window._kPreset) return;
    playerStats.particleOpacity = parseFloat(e.target.value); 
    document.getElementById('val-particles').innerText = Math.round(playerStats.particleOpacity*100)+'%'; 
    if(playerStats.particleOpacity===0) playerStats.particles0=true;
    if(playerStats.particleOpacity>=1.0) { playerStats.particles100=true; }
    if(playerStats.musicVol>=1.0 && playerStats.particleOpacity>=1.0) { playerStats.musicAt100=true; playerStats.particles100=true; } _deferredCheckAch();
    _onManualSliderChange();
    saveStatsLocally(); 
});
// unlock_cfg8 ya integrado en checkAchievements vía flags musicAt100 + particles100
document.getElementById('op-fps').addEventListener('input', (e) => {
    if (window._kPreset) return;
    playerStats.maxFps = FPS_VALUES[parseInt(e.target.value)]; 
    fpsInterval = 1000/playerStats.maxFps; _smoothDelta = fpsInterval; 
    document.getElementById('val-fps').innerText = playerStats.maxFps+' FPS'; 
    playerStats.fpsChanges = (playerStats.fpsChanges||0)+1;
    _onManualSliderChange();
    checkAchievements();
    saveStatsLocally(); 
});
// iOS Safari fallback: 'change'→'input' para sliders táctiles.
// window._kPreset previene que cambios programáticos de setQualityMode
// disparen _onManualSliderChange y reviertan el modo recién aplicado a 'custom'.
['op-music','op-sfx','op-particles','op-fps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
        if (window._kPreset) return;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
});

function showToast(title, message, color, icon, duration) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    // Anti-glitch: evitar toasts duplicados del mismo título en < 800ms
    const _now = Date.now();
    if (!showToast._lastTs) showToast._lastTs = {};
    if (showToast._lastTs[title] && _now - showToast._lastTs[title] < 800) return;
    showToast._lastTs[title] = _now;
    const ms = duration || 3500;
    const toast = document.createElement('div'); 
    toast.className = 'toast-item'; 
    toast.innerHTML = `<div class="toast-icon" style="color: ${color}">${icon}</div><div class="toast-text"><span class="toast-title" style="color:${color}">${title}</span><span class="toast-name">${message}</span></div>`;
    container.appendChild(toast); 
    setTimeout(() => toast.classList.add('show'), 50); 
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, ms);
}

// --- Módulo: Clasificación Global ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbxbLrjL45NYaQsRaSlZJXHKlQj-1Qh4f-CPxz4KsOMpfMI4jwwYC1UrNpnm_-f6ISeCww/exec"; 

function calculatePowerLevel(stats) {
    // base: totalScore contributes but is capped to prevent infinite grinding advantage
    const base = Math.min(stats.totalScore * 0.05, 50000); 
    const best = stats.bestScore * 1.5; 
    const streak = stats.maxStreak * 200;
    const perf = stats.perfectGames * 1000;
    const achs = stats.achievements.length * 300;
    const winRate = stats.gamesPlayed > 0 ? (stats.totalCorrect / (stats.gamesPlayed * 20)) * 5000 : 0;
    // efficiency bonus: average score per game (rewards quality over quantity)
    const avgScore = stats.gamesPlayed > 0 ? stats.totalScore / stats.gamesPlayed : 0;
    const efficiency = Math.min(avgScore * 0.3, 15000);
    return Math.floor(base + best + streak + perf + achs + winRate + efficiency);
}

let _submitDebounceTimer = null;
const _LB_PENDING_KEY = 'klick_pending_lb_submit';

// Retry de envíos fallidos cuando vuelve la conexión
window.addEventListener('online', function() {
    const pending = localStorage.getItem(_LB_PENDING_KEY);
    if (!pending) return;
    try {
        const payload = JSON.parse(pending);
        fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) })
            .then(() => localStorage.removeItem(_LB_PENDING_KEY))
            .catch(() => {}); // si falla de nuevo, el listener lo reintentará
    } catch(e) { localStorage.removeItem(_LB_PENDING_KEY); }
});

async function submitLeaderboard() {
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR" || GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    clearTimeout(_submitDebounceTimer);
    _submitDebounceTimer = setTimeout(async () => {
        // Esperar la huella del dispositivo si todavía está calculándose
        if (_deviceFpReady && !_deviceFingerprint) {
            try { await _deviceFpReady; } catch(_) {}
        }
        const _isAdmin = playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
        const pl = _isAdmin ? 21000000 : calculatePowerLevel(playerStats);
        if (!_isAdmin) playerStats.powerLevel = pl;
        const payload = {
            uuid:       _isAdmin ? '00000000-spec-tral-0000-klickphantom0' : playerStats.uuid,
            name:       playerStats.playerName,
            rankTitle:  getRankInfo(playerStats).title,
            powerLevel: _isAdmin ? 21000000 : pl,
            totalScore: playerStats.totalScore,
            maxStreak:  playerStats.maxStreak,
            gamesPlayed:   playerStats.gamesPlayed   || 0,
            bestScore:     playerStats.bestScore      || 0,
            perfectGames:  playerStats.perfectGames   || 0,
            totalCorrect:  playerStats.totalCorrect   || 0,
            totalWrong:    playerStats.totalWrong     || 0,
            totalTimeouts: playerStats.totalTimeouts  || 0,
            maxMult:       playerStats.maxMult        || 1,
            maxLoginStreak:playerStats.maxLoginStreak || 0,
            deviceFP:      _deviceFingerprint || ('dfp_fallback_' + (playerStats.uuid || '').slice(0,8)),
            lastSeen:      new Date().toISOString(),
            pinnedAchievements: playerStats.pinnedAchievements || [],
            achievementCount:   (playerStats.achievements || []).filter(id => ACHIEVEMENTS_MAP && ACHIEVEMENTS_MAP.has(id)).length,
            equippedTitle:     playerStats.equippedTitle || null,
            // KS — solo el estado visible público (no historial ni señales)
            ksStatus: (() => {
                const ban = playerStats.ksBanUntil;
                if (ban && new Date(ban).getTime() > Date.now()) return 'ban';
                const r = playerStats.ksReviewStatus;
                if (r === 'sanctioned')  return 'sanctioned';
                if (r === 'warned')      return 'warned';
                if (r === 'under_review') return 'review';
                return null;
            })(),
        };
        try {
            if (!navigator.onLine) throw new Error('offline');
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
            localStorage.removeItem(_LB_PENDING_KEY);
        } catch(e) {
            try { localStorage.setItem(_LB_PENDING_KEY, JSON.stringify(payload)); } catch(_) {}
        }
    }, 1200);
}

// ══════════════════════════════════════════════════════════════════
//  SISTEMA DE ESTADO ONLINE
//  · Heartbeat cada 45s → actualiza lastSeen en el servidor
//  · fetchLeaderboard lee lastSeen de cada jugador
//  · Umbral: < 90s = online, >= 90s = offline
//  · Admin (CHRISTOPHER) siempre aparece como online
//  · _formatLastSeen devuelve 'online' o null (no mostramos tiempo)
// ══════════════════════════════════════════════════════════════════

const _ONLINE_THRESHOLD_MS = 90 * 1000; // 90 segundos

function _formatLastSeen(isoStr) {
    if (!isoStr) return null;
    let d;
    try { d = new Date(isoStr); if (isNaN(d.getTime())) return null; } catch(e) { return null; }
    const diff = Date.now() - d.getTime();
    if (diff < 0 || diff < _ONLINE_THRESHOLD_MS) return 'online';
    return 'offline'; // solo interesa online/offline para el indicador
}

// Heartbeat: envía lastSeen cada 45s mientras la pestaña esté activa
let _heartbeatTimer = null;
let _rankingPollTimer = null;
function _startHeartbeat() {
    _stopHeartbeat();
    // Envío inmediato
    _sendHeartbeat();
    _heartbeatTimer = setInterval(_sendHeartbeat, 45000);
}
function _stopHeartbeat() {
    if (_heartbeatTimer) { clearInterval(_heartbeatTimer); _heartbeatTimer = null; }
}
async function _sendHeartbeat() {
    if (!playerStats.playerName || playerStats.playerName === 'JUGADOR') return;
    if (GAS_URL === 'URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI') return;
    if (!navigator.onLine) return;
    // Reusar submitLeaderboard que ya incluye lastSeen con timestamp actual
    // Para el heartbeat usamos un payload mínimo para no sobrecargar
    if (_deviceFpReady && !_deviceFingerprint) { try { await _deviceFpReady; } catch(_) {} }
    const _isAdmin = playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    const pl = _isAdmin ? 21000000 : (playerStats.powerLevel || calculatePowerLevel(playerStats));
    const payload = {
        uuid:      _isAdmin ? '00000000-spec-tral-0000-klickphantom0' : playerStats.uuid,
        name:      playerStats.playerName,
        rankTitle: getRankInfo(playerStats).title,
        powerLevel:pl,
        totalScore:playerStats.totalScore || 0,
        maxStreak: playerStats.maxStreak  || 0,
        gamesPlayed:   playerStats.gamesPlayed   || 0,
        bestScore:     playerStats.bestScore      || 0,
        perfectGames:  playerStats.perfectGames   || 0,
        totalCorrect:  playerStats.totalCorrect   || 0,
        totalWrong:    playerStats.totalWrong     || 0,
        totalTimeouts: playerStats.totalTimeouts  || 0,
        maxMult:       playerStats.maxMult        || 1,
        maxLoginStreak:playerStats.maxLoginStreak || 0,
        deviceFP:  _deviceFingerprint || ('dfp_fallback_' + (playerStats.uuid || '').slice(0,8)),
        lastSeen:  new Date().toISOString(),
    };
    try {
        await fetch(GAS_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    } catch(e) {}
}

// Polling del ranking — refresca los puntos online cada 30s mientras se ve el ranking
function _startRankingPoll() {
    _stopRankingPoll();
    _rankingPollTimer = setInterval(() => {
        const rankScreen = document.getElementById('ranking-screen');
        if (rankScreen && rankScreen.classList.contains('active')) {
            fetchLeaderboard();
        }
    }, 30000);
}
function _stopRankingPoll() {
    if (_rankingPollTimer) { clearInterval(_rankingPollTimer); _rankingPollTimer = null; }
}

// Detener heartbeat cuando la pestaña está oculta, reanudar al volver
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        _startHeartbeat();
        // Reanudar poll si el ranking está activo
        const rankScreen = document.getElementById('ranking-screen');
        if (rankScreen && rankScreen.classList.contains('active')) {
            fetchLeaderboard();
            _startRankingPoll();
        }
    } else {
        _stopHeartbeat();
        _stopRankingPoll();
    }
});


// ── Fetch de seguridad (solo admin, en background) ──────────────────────
// Independiente de fetchLeaderboard para no mezclar datos.
// Se llama al iniciar, y renderSecurityStatus() lo usa exclusivamente.
window._ksSecurityData = null;
window._ksSecurityFetching = false;

async function fetchSecurityData() {
    if (GAS_URL === 'URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI') return;
    // Solo el admin necesita datos del servidor en la zona de seguridad
    const isAdmin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    if (!isAdmin) return;
    if (window._ksSecurityFetching) return;
    window._ksSecurityFetching = true;
    try {
        const res  = await fetch(GAS_URL + '?admin=1');
        const data = await res.json();
        if (Array.isArray(data)) window._ksSecurityData = data;
    } catch(e) {}
    window._ksSecurityFetching = false;
}

async function fetchLeaderboard() {
    if(GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    try {
        const _isAdminFetch = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
        const fetchURL = _isAdminFetch ? GAS_URL + '?admin=1' : GAS_URL;
        const res = await fetch(fetchURL);
        const topPlayers = await res.json();
        const isLight = document.body.classList.contains('light-mode');
        
        function rankTitleColor(title) {
            switch(title) {
                case 'Divinidad': return isLight ? '#0d1117' : '#ffffff';
                case 'Mítico':  return isLight ? '#cc7700' : '#ff9500';
                case 'Eterno':  return isLight ? '#4400cc' : '#6600ff';
                case 'Leyenda': return isLight ? '#7a0a8c' : '#b5179e';
                case 'Maestro': return isLight ? '#c41940' : '#ff2a5f';
                case 'Pro':     return isLight ? '#b8a000' : '#ffe566';
                case 'Junior':  return isLight ? '#0070a8' : '#00d4ff';
                default:        return isLight ? '#0a7a3e' : 'var(--accent-green)';
            }
        }
        
        window._leaderboardData = topPlayers;

        let html = "";
        let onlineCount = 0;
        let realPos = 0;
        topPlayers.forEach((p, index) => {
            const isChristopher  = p.uuid === '00000000-spec-tral-0000-klickphantom0';
            if (!isChristopher) realPos++;
            const pos   = isChristopher ? 0 : realPos;
            const isMe  = p.uuid === playerStats.uuid;

            if(isMe) {
                const prevPos = playerStats.rankingPosition || 999;
                const prevPL  = playerStats.powerLevel || 0;
                playerStats.rankingPosition = pos;
                if (prevPos >= 15 && pos <= 5) playerStats.rankRemontada = true;
                const todayForNm5 = new Date().toISOString().split('T')[0];
                if (p.powerLevel > prevPL && prevPL > 0) {
                    const lastRankUpDay = playerStats._lastRankUpDay || '';
                    const yest5 = new Date(); yest5.setDate(yest5.getDate() - 1);
                    const yesterdayStr5 = yest5.toISOString().split('T')[0];
                    if (lastRankUpDay === yesterdayStr5 || lastRankUpDay === '') {
                        playerStats.consecutiveRankUpDays = (playerStats.consecutiveRankUpDays || 0) + 1;
                    } else if (lastRankUpDay !== todayForNm5) {
                        playerStats.consecutiveRankUpDays = 1;
                    }
                    playerStats._lastRankUpDay = todayForNm5;
                }
                saveStatsLocally(); checkAchievements();
            }
            if (!playerStats.surpassedHighPLPlayer && playerStats.uuid) {
                const myEntry = topPlayers.find(x => x.uuid === playerStats.uuid);
                const myIdx   = myEntry ? topPlayers.indexOf(myEntry) : -1;
                if (myEntry && !isMe && myIdx < index && p.powerLevel > (myEntry.powerLevel || 0) + 1000) {
                    playerStats.surpassedHighPLPlayer = true;
                }
            }

            const displayPos = isChristopher ? '∞' : pos;

            let rankTitle = (MITICO_TITLE_RANKS.has(p.rankTitle) && p.equippedTitle && MITICO_TITLES.has(p.equippedTitle)) ? MITICO_TITLES.get(p.equippedTitle) :
                (ETERNO_TITLE_RANKS.has(p.rankTitle) && p.equippedTitle && ETERNO_TITLES.has(p.equippedTitle)) ? ETERNO_TITLES.get(p.equippedTitle) : p.rankTitle;
            const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
            if (!isChristopher && pos <= 3 && (p.rankTitle === 'Leyenda' || p.rankTitle === 'Eterno' || p.rankTitle === 'Mítico' || p.rankTitle === 'Divinidad')) rankTitle = podiumTitles[pos];
            if (isChristopher) rankTitle = 'Arquitecto del Sistema';

            const meClass          = isMe ? 'is-me' : '';
            const divinidadClass   = p.rankTitle === 'Divinidad' ? 'divinidad-card'   : '';
            const leyendaClass     = p.rankTitle === 'Leyenda'   ? 'leyenda-card'     : '';
            const eternoClass      = p.rankTitle === 'Eterno'    ? 'eterno-card'      : '';
            const miticoClass      = p.rankTitle === 'Mítico'    ? 'mitico-card'      : '';
            const christopherClass = isChristopher               ? 'christopher-card' : '';
            const titleColor = rankTitleColor(p.rankTitle);
            const titleStyle = (isChristopher || p.rankTitle === 'Divinidad') ? '' : `color:${titleColor}`;

            // Online status — admin siempre online; umbral 90s para resto
            const _onlineStatus = isChristopher ? 'online' : _formatLastSeen(p.lastSeen || null);
            const isOnline = _onlineStatus === 'online';
            if (isOnline) onlineCount++; // admin cuenta también
            const dotClass = isOnline ? 'rc-online' : (_onlineStatus ? 'rc-offline' : 'rc-unknown');
            const dotTitle = isOnline ? 'En línea' : 'Desconectado';
            // Mostrar PL con ∞ para admin
            const plDisplay = isChristopher ? '∞' : p.powerLevel.toLocaleString();

            // KS shield — visible para todos, solo si el jugador tiene estado activo
            const ksStatus = p.ksStatus || (p.isBanned ? 'ban' : null);
            const ksShieldColor = {
                ban:       '#ff2a5f',
                sanctioned:'#ff4040',
                warned:    '#ff8c00',
                review:    '#ffb800',
            }[ksStatus] || null;
            const ksShieldHtml = ksShieldColor ? `<span class="rc-ks-shield" title="Bajo monitoreo de Klick Shield" style="color:${ksShieldColor}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>` : '';

            html += `<div class="rank-card ${meClass} ${divinidadClass} ${leyendaClass} ${eternoClass} ${miticoClass} ${christopherClass}" onclick="openPlayerProfileFromRank(${index})" title="Ver perfil completo">
                <div class="rc-pos">${displayPos}</div>
                <div class="rc-info">
                    <div class="rc-name-row">
                        <div class="rc-status-zone"><span class="rc-online-dot ${dotClass}" title="${dotTitle}"></span></div>
                        <div class="rc-name">${p.name}</div>
                        ${ksShieldHtml}
                    </div>
                    <div class="rc-title" style="${titleStyle}">${rankTitle}</div>
                </div>
                <div class="rc-score">${plDisplay} <span>PL</span></div>
            </div>`;
        });
        document.getElementById('ranking-list').innerHTML = html;

        // Online badge — incluye admin, siempre visible si hay al menos 1
        const onlineBadge = document.getElementById('rank-online-badge');
        const onlineText  = document.getElementById('rank-online-count');
        if (onlineBadge && onlineText) {
            if (onlineCount > 0) {
                onlineText.textContent = `${onlineCount} en línea`;
                onlineBadge.style.display = 'flex';
            } else {
                onlineBadge.style.display = 'none';
            }
        }

        playerStats.successfulLeaderboardLoads = (playerStats.successfulLeaderboardLoads||0) + 1;
        saveStatsLocally();
    } catch(e) {
        if(document.getElementById('ranking-list').innerHTML.includes('ranking-loading')) {
           document.getElementById('ranking-list').innerHTML = `<div class="ranking-loading">Error al conectar con la base de datos. Reintentando...</div>`;
        }
    }
}
setInterval(() => {
    if (document.visibilityState !== 'hidden' && !isAnsweringAllowed) {
        submitLeaderboard(); fetchLeaderboard();
    }
}, 60000);

// ══════════════════════════════════════════════════════════════════
//  PLAYER CARD — Pantalla completa con partículas propias
//  Datos reales disponibles por jugador (payload submitLeaderboard):
//    uuid, name, rankTitle, powerLevel, totalScore, maxStreak
//  Datos propios adicionales: bestScore, gamesPlayed, precisión
// ══════════════════════════════════════════════════════════════════

// ── Resolución de color por rango ─────────────────────────────────
function _pcardRankVars(title) {
    const light = document.body.classList.contains('light-mode');
    const map = {
        'Divinidad': { color: light ? '#0d1117' : '#ffffff', rgb: light ? '13,17,23' : '255,255,255' },
        'Mítico':  { color: light ? '#cc7700' : '#ff9500', rgb: '255,149,0'   },
        'Eterno':  { color: light ? '#4400cc' : '#6600ff', rgb: '102,0,255'   },
        'Leyenda': { color: light ? '#7a0a8c' : '#b5179e', rgb: '181,23,158'  },
        'Maestro': { color: light ? '#c41940' : '#ff2a5f', rgb: '255,42,95'   },
        'Pro':     { color: light ? '#b8a000' : '#ffe566', rgb: '255,229,102' },
        'Junior':  { color: light ? '#0070a8' : '#00d4ff', rgb: '0,212,255'   },
    };
    return map[title] || { color: light ? '#0a7a3e' : '#00ff66', rgb: '0,255,102' };
}

// ── Canvas de partículas exclusivo de la tarjeta ──────────────────
// ══════════════════════════════════════════════════════════════════
//  PARTÍCULAS DEL PERFIL ADMIN — sistema exclusivo del Arquitecto
//  Reemplaza completamente el fondo estándar mientras está activo.
//  Tres capas: puntos orbitales, fragmentos geométricos y halo central.
// ══════════════════════════════════════════════════════════════════
const _ap = {
    canvas: null, ctx: null,
    dots: [], frags: [], raf: null, then: 0, active: false, t: 0
};

function _apRgb() {
    return document.body.classList.contains('light-mode') ? '13,17,23' : '255,255,255';
}

function _apInit() {
    const W = window.innerWidth, H = window.innerHeight;

    let cv = document.getElementById('admin-profile-canvas');
    if (!cv) {
        cv = document.createElement('canvas');
        cv.id = 'admin-profile-canvas';
        // Posición fija cubriendo toda la pantalla — igual que el canvas global
        cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
        document.body.appendChild(cv);
    }
    cv.width  = W;
    cv.height = H;
    _ap.canvas = cv;
    _ap.ctx    = cv.getContext('2d', { alpha: true });

    // Ocultar el canvas de partículas global para que no se solapen
    const globalCv = document.getElementById('particle-canvas');
    if (globalCv) globalCv.style.opacity = '0';

    _ap.dots  = [];
    _ap.frags = [];
    const isPerf = playerStats && playerStats.qualityMode === 'perf';

    // ── Capa 1: puntos flotantes (muchos, pequeños, dispersos) ──
    const nDots = isPerf ? 40 : 90;
    for (let i = 0; i < nDots; i++) {
        _ap.dots.push({
            x:  Math.random() * W,
            y:  Math.random() * H,
            dx: (Math.random() - 0.5) * 0.5,
            dy: (Math.random() - 0.5) * 0.5,
            s:  Math.random() * 1.8 + 0.6,
            phase: Math.random() * Math.PI * 2,
            pulseF: Math.random() * 0.8 + 0.4,
        });
    }

    // ── Capa 2: fragmentos geométricos (medianos, rotantes, orbitales) ──
    const nFrags = isPerf ? 12 : 28;
    for (let i = 0; i < nFrags; i++) {
        const minR = Math.min(W, H) * 0.06;
        const maxR = Math.min(W, H) * 0.44;
        _ap.frags.push({
            cx:    W * (0.2 + Math.random() * 0.6),
            cy:    H * (0.2 + Math.random() * 0.6),
            r:     minR + Math.random() * (maxR - minR),
            angle: Math.random() * Math.PI * 2,
            speed: (Math.random() * 0.005 + 0.002) * (Math.random() < 0.5 ? 1 : -1),
            size:  Math.random() * 5 + 2.5,
            rot:   Math.random() * Math.PI * 2,
            rotSpd:(Math.random() * 0.05 + 0.015) * (Math.random() < 0.5 ? 1 : -1),
            sides: [3, 4, 6][Math.floor(Math.random() * 3)],
            phase: Math.random() * Math.PI * 2,
            pulseF:Math.random() * 0.5 + 0.2,
        });
    }
}

function _apDraw(now) {
    if (!_ap.active) return;
    _ap.raf = requestAnimationFrame(_apDraw);
    const isPerf = playerStats && playerStats.qualityMode === 'perf';
    const fps = isPerf ? 24 : 50;
    if (now - _ap.then < 1000 / fps) return;
    _ap.then = now;
    _ap.t   += 0.018;

    const c = _ap.ctx;
    if (!c || !_ap.canvas) return;
    const W = _ap.canvas.width, H = _ap.canvas.height;
    const rgb = _apRgb();
    const opScale = playerStats.particleOpacity !== undefined ? playerStats.particleOpacity : 1;

    c.clearRect(0, 0, W, H);

    // ── Halo central muy suave ──
    if (!isPerf) {
        const cx = W / 2, cy = H * 0.38;
        const grad = c.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.38);
        const isLight = document.body.classList.contains('light-mode');
        grad.addColorStop(0,   isLight ? 'rgba(13,17,23,0.07)'  : 'rgba(255,255,255,0.07)');
        grad.addColorStop(0.5, isLight ? 'rgba(13,17,23,0.025)' : 'rgba(255,255,255,0.025)');
        grad.addColorStop(1,   'rgba(0,0,0,0)');
        c.fillStyle = grad;
        c.fillRect(0, 0, W, H);
    }

    // ── Capa 1: puntos ──
    const dots = _ap.dots;
    c.beginPath();
    for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        d.x += d.dx; d.y += d.dy;
        if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
        if (d.y < 0) d.y = H; if (d.y > H) d.y = 0;
        const pulse = (Math.sin(_ap.t * d.pulseF + d.phase) + 1) / 2;
        // Opacidad más alta: 0.25 – 0.65
        const op = (0.25 + pulse * 0.40) * opScale;
        c.globalAlpha = op;
        c.fillStyle = `rgb(${rgb})`;
        c.moveTo(d.x + d.s, d.y);
        c.arc(d.x, d.y, d.s, 0, Math.PI * 2);
    }
    c.globalAlpha = 1;
    c.fill();

    // ── Conexiones entre puntos cercanos ──
    if (!isPerf) {
        const maxD = Math.min(W, H) * 0.14;
        const maxD2 = maxD * maxD;
        for (let a = 0; a < dots.length; a++) {
            for (let b = a + 1; b < dots.length; b++) {
                const dx2 = dots[a].x - dots[b].x, dy2 = dots[a].y - dots[b].y;
                const d2 = dx2*dx2 + dy2*dy2;
                if (d2 < maxD2) {
                    // Opacidad líneas: 0.08 – 0.28
                    const alpha = ((1 - d2 / maxD2) * 0.28 * opScale).toFixed(3);
                    c.strokeStyle = `rgba(${rgb},${alpha})`;
                    c.lineWidth = 0.7;
                    c.beginPath();
                    c.moveTo(dots[a].x, dots[a].y);
                    c.lineTo(dots[b].x, dots[b].y);
                    c.stroke();
                }
            }
        }
    }

    // ── Capa 2: fragmentos geométricos ──
    const frags = _ap.frags;
    for (let i = 0; i < frags.length; i++) {
        const p = frags[i];
        p.angle += p.speed;
        p.rot   += p.rotSpd;
        const x = p.cx + Math.cos(p.angle) * p.r;
        const y = p.cy + Math.sin(p.angle) * p.r;

        const pulse = (Math.sin(_ap.t * p.pulseF + p.phase) + 1) / 2;
        // Opacidad fragmentos: 0.30 – 0.72
        const strokeOp = (0.30 + pulse * 0.42) * opScale;
        const fillOp   = strokeOp * 0.28;

        c.save();
        c.translate(x, y);
        c.rotate(p.rot);
        c.beginPath();
        const sz = p.size;
        for (let s = 0; s < p.sides; s++) {
            const a = (s / p.sides) * Math.PI * 2 - Math.PI / 2;
            s === 0 ? c.moveTo(Math.cos(a) * sz, Math.sin(a) * sz)
                    : c.lineTo(Math.cos(a) * sz, Math.sin(a) * sz);
        }
        c.closePath();
        c.fillStyle   = `rgba(${rgb},${fillOp.toFixed(3)})`;
        c.strokeStyle = `rgba(${rgb},${strokeOp.toFixed(3)})`;
        c.lineWidth   = 1.1;
        c.fill();
        c.stroke();
        c.restore();
    }

    // ── Conexiones fragmento ↔ punto más cercano ──
    if (!isPerf) {
        const maxFD = Math.min(W, H) * 0.18;
        const maxFD2 = maxFD * maxFD;
        for (let i = 0; i < frags.length; i++) {
            const fx = frags[i].cx + Math.cos(frags[i].angle) * frags[i].r;
            const fy = frags[i].cy + Math.sin(frags[i].angle) * frags[i].r;
            let bestD2 = Infinity, bx = 0, by = 0;
            for (let j = 0; j < dots.length; j++) {
                const dx2 = fx - dots[j].x, dy2 = fy - dots[j].y;
                const d2 = dx2*dx2 + dy2*dy2;
                if (d2 < bestD2) { bestD2 = d2; bx = dots[j].x; by = dots[j].y; }
            }
            if (bestD2 < maxFD2) {
                const alpha = ((1 - bestD2 / maxFD2) * 0.22 * opScale).toFixed(3);
                c.strokeStyle = `rgba(${rgb},${alpha})`;
                c.lineWidth = 0.5;
                c.beginPath();
                c.moveTo(fx, fy);
                c.lineTo(bx, by);
                c.stroke();
            }
        }
    }
}

function _apStart() {
    _apInit();
    if (!_ap.canvas) return;
    _ap.active = true;
    _ap.then   = performance.now();
    _ap.t      = 0;
    if (_ap.raf) cancelAnimationFrame(_ap.raf);
    _ap.raf = requestAnimationFrame(_apDraw);
}

function _apStop() {
    _ap.active = false;
    if (_ap.raf) { cancelAnimationFrame(_ap.raf); _ap.raf = null; }
    if (_ap.ctx && _ap.canvas) {
        _ap.ctx.clearRect(0, 0, _ap.canvas.width, _ap.canvas.height);
        // Eliminar el canvas para que no quede residuo
        _ap.canvas.remove();
        _ap.canvas = null; _ap.ctx = null;
    }
    // Restaurar el canvas global
    const globalCv = document.getElementById('particle-canvas');
    if (globalCv) globalCv.style.opacity = '';
}

const _pc = {
    canvas: null, ctx: null,
    particles: [], rgb: '0,255,102',
    raf: null, then: 0, active: false
};

function _pcInitCanvas(rgb) {
    _pc.canvas = document.getElementById('pcard-particle-canvas');
    if (!_pc.canvas) return;
    _pc.ctx = _pc.canvas.getContext('2d', { alpha: true });
    _pc.canvas.width  = window.innerWidth;
    _pc.canvas.height = window.innerHeight;
    _pc.rgb = rgb;
    _pc.particles = [];
    const isPerf = playerStats && playerStats.qualityMode === 'perf';
    const isMax  = playerStats && playerStats.qualityMode === 'max';
    const baseN = isPerf ? 20 : (isMax ? 70 : 55);
    const n = Math.min(baseN, Math.round((_pc.canvas.width * _pc.canvas.height) / (isPerf ? 28000 : 14000)));
    for (let i = 0; i < n; i++) {
        _pc.particles.push({
            x:  Math.random() * _pc.canvas.width,
            y:  Math.random() * _pc.canvas.height,
            dx: (Math.random() - 0.5) * 0.6,
            dy: (Math.random() - 0.5) * 0.6,
            s:  Math.random() * 1.5 + 0.5
        });
    }
}

function _pcDraw(now) {
    if (!_pc.active) return;
    _pc.raf = requestAnimationFrame(_pcDraw);
    if (now - _pc.then < 1000 / 55) return;
    _pc.then = now;
    const c = _pc.ctx, W = _pc.canvas.width, H = _pc.canvas.height;
    c.clearRect(0, 0, W, H);

    const pts = _pc.particles;
    // Dots
    c.beginPath();
    c.fillStyle = `rgba(${_pc.rgb}, 0.45)`;
    for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.dx; p.y += p.dy;
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        c.moveTo(p.x + p.s, p.y);
        c.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    }
    c.fill();

    // Líneas de conexión — omitir en modo bajo rendimiento
    if (playerStats && playerStats.qualityMode === 'perf') return;
    const maxD2 = (W / 8) * (H / 8);
    c.lineWidth = 0.6;
    const _pcBuckets = 5;
    const _pcLines = new Array(_pcBuckets).fill(null).map(() => []);
    for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
            const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
            const d2 = dx*dx + dy*dy;
            if (d2 < maxD2) {
                const alpha = (1 - d2 / maxD2) * 0.22;
                const bi = Math.min(_pcBuckets - 1, Math.floor(alpha * _pcBuckets / 0.22));
                _pcLines[bi].push(pts[a].x, pts[a].y, pts[b].x, pts[b].y);
            }
        }
    }
    for (let bi = 0; bi < _pcBuckets; bi++) {
        const lines = _pcLines[bi];
        if (!lines.length) continue;
        const alpha = (((bi + 0.5) / _pcBuckets) * 0.22).toFixed(2);
        c.strokeStyle = `rgba(${_pc.rgb},${alpha})`;
        c.beginPath();
        for (let i = 0; i < lines.length; i += 4) {
            c.moveTo(lines[i], lines[i+1]);
            c.lineTo(lines[i+2], lines[i+3]);
        }
        c.stroke();
    }
}

function _pcStart(rgb) {
    _pcInitCanvas(rgb);
    _pc.active = true;
    _pc.then = performance.now();
    if (_pc.raf) cancelAnimationFrame(_pc.raf);
    _pc.raf = requestAnimationFrame(_pcDraw);
}

function _pcStop() {
    _pc.active = false;
    if (_pc.raf) { cancelAnimationFrame(_pc.raf); _pc.raf = null; }
    if (_pc.ctx && _pc.canvas) _pc.ctx.clearRect(0, 0, _pc.canvas.width, _pc.canvas.height);
}

// ══════════════════════════════════════════════════════════════════
//  PERFIL COMPLETO DESDE RANKING
//  Al clicar en un jugador abre profile-screen con sus datos.
//  • Propio perfil  → datos locales completos
//  • Otro jugador   → datos del servidor (todos visibles, sin restricción)
//  El botón "Regresar" en profile-screen vuelve al ranking cuando
//  se entró desde allí.
// ══════════════════════════════════════════════════════════════════
let _rankProfileData = null;
let _isViewingOtherProfile = false;
let _profileReturnScreen = 'start-screen'; // pantalla a la que volver al salir

function profileGoBack() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    try { SFX.click(); } catch(e) {}
    const target = _profileReturnScreen || 'start-screen';
    _restoreOwnProfileOnLeave();
    switchScreen(target);
}

function openPlayerProfileFromRank(index) {
    const data = window._leaderboardData;
    if (!data || !data[index]) return;
    const p = data[index];
    const isChristopher = p.uuid === '00000000-spec-tral-0000-klickphantom0';
    const isMe = p.uuid === playerStats.uuid;

    if (isChristopher) {
        playerStats.christopherCardViews = (playerStats.christopherCardViews||0) + 1;
        saveStatsLocally(); checkAchievements();
    }

    _profileReturnScreen = 'ranking-screen';

    if (isMe) {
        _isViewingOtherProfile = false;
        _rankProfileData = null;
        goToProfile();
        return;
    }

    _isViewingOtherProfile = true;
    _rankProfileData = p;

    try { initAudio(); SFX.click(); } catch(e) {}

    // Posición real
    let realPos = 0;
    for (let i = 0; i <= index; i++) {
        if (data[i].uuid !== '00000000-spec-tral-0000-klickphantom0') realPos++;
    }
    const pos = isChristopher ? 0 : realPos;

    // Rango y color
    const baseRank = p.rankTitle || 'Novato';
    const light = document.body.classList.contains('light-mode');
    const rankColorMap = {
        'Divinidad': { color: light ? '#0d1117' : '#ffffff', rgb: light ? '13,17,23' : '255,255,255' },
        'Mítico':  { color: light ? '#cc7700' : '#ff9500', rgb: '255,149,0'   },
        'Eterno':  { color: light ? '#4400cc' : '#6600ff', rgb: '102,0,255'   },
        'Leyenda': { color: light ? '#7a0a8c' : '#b5179e', rgb: '181,23,158'  },
        'Maestro': { color: light ? '#c41940' : '#ff2a5f', rgb: '255,42,95'   },
        'Pro':     { color: light ? '#b8a000' : '#ffe566', rgb: '255,229,102' },
        'Junior':  { color: light ? '#0070a8' : '#00d4ff', rgb: '0,212,255'   },
    };
    const ri = rankColorMap[baseRank] || { color: light ? '#0a7a3e' : '#00ff66', rgb: '0,255,102' };

    let displayTitle = isChristopher ? 'Arquitecto del Sistema' :
        (MITICO_TITLE_RANKS.has(baseRank) && p.equippedTitle && MITICO_TITLES.has(p.equippedTitle)) ? MITICO_TITLES.get(p.equippedTitle) :
        (ETERNO_TITLE_RANKS.has(baseRank) && p.equippedTitle && ETERNO_TITLES.has(p.equippedTitle)) ? ETERNO_TITLES.get(p.equippedTitle) : baseRank;
    const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
    if (!isChristopher && pos <= 3 && ['Leyenda','Eterno','Mítico','Divinidad'].includes(baseRank)) displayTitle = podiumTitles[pos];

    // CSS vars de rango
    document.documentElement.style.setProperty('--rank-color', ri.color);
    document.documentElement.style.setProperty('--rank-rgb', ri.rgb);

    // Nav title con nombre del jugador
    const navTitle = document.getElementById('profile-nav-title');
    if (navTitle) navTitle.textContent = p.name;

    // Nombre: readonly
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) {
        nameInput.value = p.name;
        nameInput.readOnly = true;
        nameInput.style.pointerEvents = 'none';
        nameInput.style.opacity = '0.75';
    }

    // Rango
    const rankDisp = document.getElementById('profile-rank-display');
    if (rankDisp) { rankDisp.innerText = `Rango: ${displayTitle}`; rankDisp.style.color = ri.color; }

    // Ocultar warning
    const profileWarn = document.getElementById('profile-warning');
    if (profileWarn) { profileWarn.style.opacity = '0'; profileWarn.innerText = 'Se requiere un nombre'; }

    // ── Stats y Panel PL ──────────────────────────────────────────────
    // Admin (CHRISTOPHER): todos los datos privados ocultos tras candados
    // Otros jugadores: todos los datos visibles sin restricción (transparencia total)
    const totAnswers = (p.totalCorrect||0)+(p.totalWrong||0)+(p.totalTimeouts||0);
    const accPct = totAnswers > 0 ? Math.round((p.totalCorrect||0)/totAnswers*100) : null;
    const plVal = isChristopher ? '∞' : (p.powerLevel||0).toLocaleString();
    const fmt = n => (n||0).toLocaleString();

    const _lockHtml = (label) => `
        <div style="display:flex;align-items:center;gap:6px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04);">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span style="font-size:0.62rem;color:var(--text-secondary);">${label}</span>
            <span style="font-size:0.58rem;color:rgba(255,255,255,0.2);margin-left:auto;font-style:italic;">Acceso restringido</span>
        </div>`;

    if (isChristopher) {
        // Tarjetas de stats: candados
        ['stat-score','stat-games','stat-streak','stat-days'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
                el.style.display = 'flex';
                el.style.alignItems = 'center';
                el.style.justifyContent = 'center';
                el.style.color = 'rgba(255,255,255,0.2)';
            }
        });
    } else {
        const se = document.getElementById('stat-score');  if(se)  { se.innerHTML=''; se.innerText=(p.bestScore||0).toLocaleString(); se.style=''; }
        const ge = document.getElementById('stat-games');  if(ge)  { ge.innerHTML=''; ge.innerText=(p.gamesPlayed||0).toLocaleString(); ge.style=''; }
        const str= document.getElementById('stat-streak'); if(str) { str.innerHTML=''; str.innerText=(p.maxStreak||0).toLocaleString(); str.style=''; }
        const dy = document.getElementById('stat-days');   if(dy)  { dy.innerHTML=''; dy.innerText=(p.maxLoginStreak||0).toLocaleString(); dy.style=''; }
    }

    // Panel PL
    const plTotalEl = document.getElementById('pl-total');
    const plHeroEl  = document.getElementById('pl-hero-total');
    if (plTotalEl) { plTotalEl.innerText = plVal; plTotalEl.style.color = ri.color; }
    if (plHeroEl)  { plHeroEl.innerText  = plVal; plHeroEl.style.color  = ri.color; }

    const posEl = document.getElementById('pl-ranking-pos');
    if (posEl) posEl.innerText = isChristopher ? '∞' : '#'+pos;

    const panel = document.getElementById('pl-panel');
    if (panel) panel.style.borderColor = 'rgba('+ri.rgb+',0.28)';

    // Desglose PL
    const rowsEl = document.getElementById('pl-rows');
    if (rowsEl) {
        if (isChristopher) {
            // Admin: todas las filas con candados y "Acceso restringido"
            const lockLabels = ['Puntaje acumulado','Récord de partida','Racha máxima','Partidas perfectas','Logros','Precisión','Eficiencia'];
            rowsEl.innerHTML = lockLabels.map(l => _lockHtml(l)).join('') +
                '<div class="pl-calc-divider"></div>' +
                '<div class="pl-calc-row" style="padding:6px 4px;">' +
                '<span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:1px;grid-column:1/3;">Total PL</span>' +
                '<span></span>' +
                '<span style="font-size:clamp(1.1rem,2vw,1.4rem);font-weight:900;font-family:monospace;color:'+ri.color+';text-align:right;">∞</span>' +
                '</div>';
        } else {
            const rows = [
                { label:'Puntaje acum.',      val: fmt(p.totalScore) },
                { label:'Récord de partida',  val: fmt(p.bestScore) },
                { label:'Racha máxima',       val: fmt(p.maxStreak)+' aciertos' },
                { label:'Partidas perfectas', val: fmt(p.perfectGames) },
                { label:'Aciertos totales',   val: fmt(p.totalCorrect) },
                { label:'Precisión',          val: accPct !== null ? accPct+'%' : '—' },
                { label:'Mult. máximo',       val: '×'+(p.maxMult||1) },
                { label:'Racha días',         val: fmt(p.maxLoginStreak)+' días' },
            ];
            rowsEl.innerHTML = rows.map(r =>
                '<div style="display:grid;grid-template-columns:1fr auto;gap:4px 10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.04);">' +
                '<span style="font-size:0.62rem;color:var(--text-secondary);">'+r.label+'</span>' +
                '<span style="font-size:0.62rem;font-weight:700;color:var(--text-primary);text-align:right;">'+r.val+'</span>' +
                '</div>'
            ).join('');
        }
    }

    // Barra PL
    const barEl = document.getElementById('pl-bar-total');
    if (barEl) { barEl.style.background = ri.color; barEl.style.width = isChristopher ? '100%' : '65%'; }
    const nextLbl = document.getElementById('pl-next-label');
    if (nextLbl) nextLbl.innerText = isChristopher ? '' : (p.gamesPlayed||0)+' partidas disputadas';
    const accPctEl = document.getElementById('pl-accuracy-pct');
    if (accPctEl) accPctEl.innerText = isChristopher ? '' : (accPct !== null ? accPct+'% precisión' : '');

    // Logros
    const achGrid = document.getElementById('profile-achievements-grid');
    if (achGrid) {
        if (isChristopher) {
            // Admin: logros fijados en color monocolor Divinidad (ignora el color del logro)
            const pinnedIds = Array.isArray(p.pinnedAchievements) ? p.pinnedAchievements : [];
            const achCount  = p.achievementCount || null;
            const isLight   = document.body.classList.contains('light-mode');
            const divColor  = isLight ? '#0d1117' : '#ffffff';
            const divBorder = isLight ? 'rgba(13,17,23,0.35)' : 'rgba(255,255,255,0.35)';
            const divShadow = isLight ? 'none' : '0 0 12px rgba(255,255,255,0.18)';
            achGrid.innerHTML = '';
            const fragAdmin = document.createDocumentFragment();
            let nAdmin = 0;
            pinnedIds.forEach(id => {
                if (nAdmin >= 3) return;
                const ach = ACHIEVEMENTS_MAP.get(id);
                if (!ach) return;
                const slot = document.createElement('div');
                slot.className = 'achievement-slot unlocked';
                slot.style.borderColor = divBorder;
                slot.style.boxShadow   = divShadow;
                slot.innerHTML = `<div class="ach-icon" style="color:${divColor}">${ach.icon}</div><div class="ach-title" style="color:${divColor}">${ach.title}</div>`;
                fragAdmin.appendChild(slot);
                nAdmin++;
            });
            while (nAdmin < 3) {
                const slot = document.createElement('div');
                slot.className = 'achievement-slot';
                if (achCount !== null && nAdmin === 0 && pinnedIds.length === 0) {
                    slot.style.opacity = '0.85'; slot.style.filter = 'grayscale(0)';
                    slot.innerHTML = `<div style="font-size:1.4rem;font-weight:900;color:${divColor};">${achCount}</div><div class="ach-title" style="color:${divColor};opacity:0.6;font-size:0.58rem;">Logros</div>`;
                    fragAdmin.appendChild(slot); nAdmin++; break;
                }
                const archIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
                slot.innerHTML = `<div class="ach-icon" style="color:${divColor};opacity:0.4">${archIcon}</div><div class="ach-title" style="color:${divColor};font-size:0.58rem;opacity:0.4;">Sin fijar</div>`;
                fragAdmin.appendChild(slot); nAdmin++;
            }
            achGrid.appendChild(fragAdmin);
        } else {
            // Otros jugadores: mostrar logros fijados + contador
            const pinnedIds = Array.isArray(p.pinnedAchievements) ? p.pinnedAchievements : [];
            const achCount  = p.achievementCount || null;
            const isLight   = document.body.classList.contains('light-mode');
            achGrid.innerHTML = '';
            const fragOther = document.createDocumentFragment();
            let nOther = 0;
            pinnedIds.forEach(id => {
                if (nOther >= 3) return;
                const ach = ACHIEVEMENTS_MAP.get(id);
                if (!ach) return;
                const achDisplayColor = isLight ? darkenHex(ach.color, 0.4) : ach.color;
                const slot = document.createElement('div');
                slot.className = 'achievement-slot unlocked';
                slot.style.borderColor = isLight ? 'rgba(0,0,0,0.2)' : ach.color;
                slot.style.boxShadow   = isLight ? 'none' : `0 0 12px ${ach.color}44`;
                slot.innerHTML = `<div class="ach-icon" style="color:${achDisplayColor}">${ach.icon}</div><div class="ach-title" style="color:${achDisplayColor}">${ach.title}</div>`;
                fragOther.appendChild(slot);
                nOther++;
            });
            while (nOther < 3) {
                const slot = document.createElement('div');
                slot.className = 'achievement-slot';
                if (achCount !== null && nOther === 0 && pinnedIds.length === 0) {
                    // No hay fijados pero sí hay un contador: mostrar en el primer slot
                    slot.style.opacity = '0.85';
                    slot.style.filter  = 'grayscale(0)';
                    slot.innerHTML = `<div style="font-size:1.4rem;font-weight:900;color:${ri.color};">${achCount}</div><div class="ach-title" style="color:var(--text-secondary);font-size:0.58rem;">Logros</div>`;
                    fragOther.appendChild(slot);
                    nOther++;
                    break;
                }
                slot.innerHTML = `<div class="ach-icon" style="color:var(--text-secondary);opacity:0.4">${SVG_LOCK}</div><div class="ach-title" style="color:var(--text-secondary);opacity:0.5;font-size:0.7rem;">Sin fijar</div>`;
                fragOther.appendChild(slot);
                nOther++;
            }
            achGrid.appendChild(fragOther);
        }
    }

    // Música del Arquitecto cuando se abre su perfil desde el Ranking
    if (isChristopher) {
        try {
            initAudio();
            if (isMusicPlaying && masterMusicGain && audioCtx) {
                const t = audioCtx.currentTime;
                masterMusicGain.gain.cancelScheduledValues(t);
                masterMusicGain.gain.setValueAtTime(masterMusicGain.gain.value, t);
                masterMusicGain.gain.linearRampToValueAtTime(0.0001, t + 0.7);
            }
            if (!_architectMusicActive) startArchitectMusic();
            // Partículas del Arquitecto en el fondo del profile-screen
            const ps = document.getElementById('profile-screen');
            if (ps) ps.classList.add('architect-profile-active');
            _apStart();
        } catch(e) {}
    }

    // Ocultar selector de título al ver perfil ajeno
    const _existingSel = document.getElementById('mitico-title-selector');
    if (_existingSel) _existingSel.remove();

    switchScreen('profile-screen');

    // ── Admin: mostrar barra ban/unban si es CHRISTOPHER viendo otro jugador ──
    const _isAdminViewing = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    const _adminBar  = document.getElementById('profile-admin-bar');
    const _banBtn    = document.getElementById('profile-admin-ban-btn');
    const _unbanBtn  = document.getElementById('profile-admin-unban-btn');
    if (_adminBar) {
        if (_isAdminViewing && !isChristopher) {
            _adminBar.style.display = 'flex';
            const _isBannedOnServer = !!p.isBanned;
            if (_banBtn)   { _banBtn.style.display   = _isBannedOnServer ? 'none' : 'block'; _banBtn.onclick   = () => _adminBanPlayer(p.uuid, p.name); }
            if (_unbanBtn) { _unbanBtn.style.display  = _isBannedOnServer ? 'block' : 'none'; _unbanBtn.onclick = () => _adminUnbanPlayer(p.uuid, p.name); }
        } else {
            _adminBar.style.display = 'none';
        }
    }
}

function _restoreOwnProfileOnLeave() {
    if (!_isViewingOtherProfile) return;
    _isViewingOtherProfile = false;
    _rankProfileData = null;

    // Detener música del Arquitecto si estaba activa
    if (_architectMusicActive) {
        try {
            stopArchitectMusic();
            if (isMusicPlaying && masterMusicGain && audioCtx) {
                const t = audioCtx.currentTime;
                const targetVol = (playerStats.musicVol || 0.7) * 0.8;
                masterMusicGain.gain.cancelScheduledValues(t);
                masterMusicGain.gain.setValueAtTime(0.0001, t);
                masterMusicGain.gain.linearRampToValueAtTime(targetVol, t + 0.5);
            }
        } catch(e) {}
    }
    // Quitar clase del perfil del Arquitecto y detener partículas especiales
    const ps = document.getElementById('profile-screen');
    if (ps) ps.classList.remove('architect-profile-active');
    _apStop();

    // Restaurar CSS vars propias
    currentRankInfo = getRankInfo(playerStats);
    document.documentElement.style.setProperty('--rank-color', currentRankInfo.color);
    document.documentElement.style.setProperty('--rank-rgb', currentRankInfo.rgb);
    // Restaurar input
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput) {
        nameInput.readOnly = false;
        nameInput.style.pointerEvents = '';
        nameInput.style.opacity = '';
    }
    const profileWarn = document.getElementById('profile-warning');
    if (profileWarn) {
        profileWarn.style.opacity = '0';
        profileWarn.style.color = '';
        profileWarn.innerText = 'Se requiere un nombre';
    }
    // Restaurar nav title
    const navTitle = document.getElementById('profile-nav-title');
    if (navTitle) navTitle.textContent = 'PERFIL';
}

// ── Abrir tarjeta ─────────────────────────────────────────────────
let _pcardOpening = false; // anti-glitch flag
function openPlayerCard(index) {
    if (_pcardOpening) return; // anti-glitch: evitar doble apertura
    const overlay = document.getElementById('pcard-overlay');
    if (overlay && overlay.classList.contains('active')) return; // ya está abierta
    const data = window._leaderboardData;
    if (!data || !data[index]) return;
    const p   = data[index];
    const isChristopherCard = p.uuid === '00000000-spec-tral-0000-klickphantom0';
    const isMe = p.uuid === playerStats.uuid;
    // Track CHRISTOPHER card views for cx2
    if (isChristopherCard) {
        playerStats.christopherCardViews = (playerStats.christopherCardViews||0) + 1;
        saveStatsLocally(); checkAchievements();
    }

    // Calcular posición real (excluyendo a CHRISTOPHER del conteo)
    let realPos = 0;
    for (let i = 0; i <= index; i++) {
        if (data[i].uuid !== '00000000-spec-tral-0000-klickphantom0') realPos++;
    }
    const pos = isChristopherCard ? 0 : realPos;

    const baseRank = p.rankTitle || 'Novato';
    const { color, rgb } = _pcardRankVars(baseRank);

    // Título: CHRISTOPHER siempre "Arquitecto del Sistema"; podio para el resto
    let displayTitle = isChristopherCard ? 'Arquitecto del Sistema' :
        (MITICO_TITLE_RANKS.has(baseRank) && p.equippedTitle && MITICO_TITLES.has(p.equippedTitle)) ? MITICO_TITLES.get(p.equippedTitle) :
        (ETERNO_TITLE_RANKS.has(baseRank) && p.equippedTitle && ETERNO_TITLES.has(p.equippedTitle)) ? ETERNO_TITLES.get(p.equippedTitle) : baseRank;
    const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
    if (!isChristopherCard && pos <= 3 && (baseRank === 'Leyenda' || baseRank === 'Eterno' || baseRank === 'Mítico' || baseRank === 'Divinidad')) displayTitle = podiumTitles[pos];

    // CSS vars en el overlay para el gradiente de fondo
    overlay.style.setProperty('--pcard-color', color);
    overlay.style.setProperty('--pcard-rgb', rgb);

    // Hero — nombre
    const nameEl = document.getElementById('pcard-big-name');
    nameEl.textContent = p.name;
    const len = p.name.length;
    const fs = len <= 6  ? 'clamp(2.8rem,10vw,5rem)'
              : len <= 9  ? 'clamp(2rem,8vw,4rem)'
              : len <= 12 ? 'clamp(1.5rem,6.5vw,3rem)'
              :              'clamp(1.1rem,5.5vw,2.4rem)';
    nameEl.style.fontSize = fs;
    // christopher-name-gradient aplica --divinity-color-static vía CSS (blanco en dark, negro en light)
    if (isChristopherCard) {
        nameEl.classList.add('christopher-name-gradient');
        nameEl.style.color = '';
        nameEl.style.textShadow = '';
    } else {
        nameEl.classList.remove('christopher-name-gradient');
        nameEl.style.color = color;
        nameEl.style.textShadow = `0 0 60px rgba(${rgb},0.45)`;
    }

    const chipTitleEl = document.getElementById('pcard-chip-title');
    document.getElementById('pcard-chip-dot').style.cssText = `background:${color}; box-shadow:0 0 6px rgba(${rgb},0.8)`;
    chipTitleEl.textContent = displayTitle;
    if (isChristopherCard) {
        chipTitleEl.classList.add('christopher-chip-gradient');
    } else {
        chipTitleEl.classList.remove('christopher-chip-gradient');
    }

    // Badge "eres tú"
    document.getElementById('pcard-me-pill').classList.toggle('show', isMe);

    // Nivel de Poder
    const plEl = document.getElementById('pcard-pl');
    plEl.textContent = (p.powerLevel || 0).toLocaleString();
    if (isChristopherCard) {
        plEl.classList.add('christopher-pl-gradient');
        plEl.style.color = '';
    } else {
        plEl.classList.remove('christopher-pl-gradient');
        plEl.style.color = color;
    }

    // Posición — ∞ para CHRISTOPHER, número para el resto
    const posEl = document.getElementById('pcard-pos');
    posEl.textContent = isChristopherCard ? '∞' : `#${pos}`;
    posEl.style.color = isMe ? color : '';

    // Stats universales (datos del servidor)
    document.getElementById('pcard-totalscore').textContent = (p.totalScore || 0).toLocaleString();
    document.getElementById('pcard-streak').textContent     = (p.maxStreak  || 0).toLocaleString();

    // Datos propios (solo locales)
    const ownBlock = document.getElementById('pcard-own-data');
    if (isMe) {
        ownBlock.style.display = '';
        document.getElementById('pcard-bestscore').textContent = (playerStats.bestScore  || 0).toLocaleString();
        document.getElementById('pcard-games').textContent     = (playerStats.gamesPlayed|| 0).toLocaleString();

        const tot = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
        const accWrap = document.getElementById('pcard-acc-wrap');
        if (tot > 0) {
            const pct = Math.round((playerStats.totalCorrect / tot) * 100);
            accWrap.style.display = '';
            document.getElementById('pcard-acc-pct').textContent = pct + '%';
            document.getElementById('pcard-acc-pct').style.color  = color;
            const fill = document.getElementById('pcard-acc-fill');
            fill.style.background = color;
            fill.style.width = '0%';
            setTimeout(() => { fill.style.width = pct + '%'; }, 80);
        } else {
            accWrap.style.display = 'none';
        }
    } else {
        ownBlock.style.display = 'none';
    }

    // Arrancar partículas con el color del jugador
    _pcStart(rgb);

    // Overlay y música especiales para el Arquitecto
    if (isChristopherCard) {
        overlay.classList.add('christopher-overlay');
        // Runas flotantes del Arquitecto
        _spawnArchitectRunes(overlay);
        // Bajar la música normal con fade suave — el Arquitecto usa GainNode propio
        if (isMusicPlaying && masterMusicGain && audioCtx) {
            const t = audioCtx.currentTime;
            masterMusicGain.gain.cancelScheduledValues(t);
            masterMusicGain.gain.setValueAtTime(masterMusicGain.gain.value, t);
            masterMusicGain.gain.linearRampToValueAtTime(0.0001, t + 0.7);
        }
        // Arrancar música del Arquitecto de inmediato (GainNode independiente)
        if (!_architectMusicActive) startArchitectMusic();
    } else {
        overlay.classList.remove('christopher-overlay');
        _clearArchitectRunes(overlay);
    }

    // Mostrar overlay
    _pcardOpening = true;
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { _pcardOpening = false; }, 300); // liberar lock tras animación
}

// ── Cerrar tarjeta ────────────────────────────────────────────────
function closePlayerCard() {
    const overlay = document.getElementById('pcard-overlay');
    if (!overlay || !overlay.classList.contains('active')) return; // anti-glitch: ya cerrada
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    _pcStop();

    // Si estaba la tarjeta del Arquitecto, detener su música y restaurar la normal
    if (_architectMusicActive) {
        stopArchitectMusic();
        overlay.classList.remove('christopher-overlay');
        _clearArchitectRunes(overlay);
        // Restaurar volumen de la música del juego
        if (isMusicPlaying && masterMusicGain && audioCtx) {
            const t = audioCtx.currentTime;
            const targetVol = playerStats.musicVol * 0.8;
            masterMusicGain.gain.cancelScheduledValues(t);
            masterMusicGain.gain.setValueAtTime(0.0001, t);
            masterMusicGain.gain.linearRampToValueAtTime(targetVol, t + 0.5);
        }
    }
}

function pcardOverlayClick(e) {
    if (e.target === document.getElementById('pcard-overlay')) closePlayerCard();
}

// ── Runas flotantes del Arquitecto ───────────────────────────────
const _ARCHITECT_RUNES = ['⬡','◈','⟁','⬢','◉','⌬','⎔','◇','⟐','⊛','⌖','⬣','⎊','⍟'];

function _spawnArchitectRunes(overlay) {
    _clearArchitectRunes(overlay);
    const count = 12;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'architect-rune';
        el.textContent = _ARCHITECT_RUNES[i % _ARCHITECT_RUNES.length];
        // Solo en los laterales — no invaden la tarjeta central
        const onLeft = i % 2 === 0;
        el.style.left = onLeft
            ? (Math.random() * 14 + 1) + '%'
            : (Math.random() * 14 + 85) + '%';
        el.style.top = (6 + Math.random() * 86) + '%';
        // Tamaños moderados: 0.9 – 2.2rem
        const size = (0.9 + Math.random() * 1.3).toFixed(1);
        el.style.fontSize = size + 'rem';
        // Variables de animación individuales
        el.style.setProperty('--rd', (6 + Math.random() * 5).toFixed(1) + 's');
        el.style.setProperty('--rg', (3 + Math.random() * 3).toFixed(1) + 's');
        el.style.setProperty('--ro', (0.28 + Math.random() * 0.32).toFixed(2));
        // Desfase aleatorio para que no parpadeen todas juntas
        el.style.animationDelay = (-Math.random() * 7).toFixed(1) + 's';
        overlay.appendChild(el);
    }
}

function _clearArchitectRunes(overlay) {
    overlay.querySelectorAll('.architect-rune').forEach(el => el.remove());
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closePlayerCard(); });

// --- SISTEMA DE PREGUNTAS MASIVAS (JSON EXTERNO) ---
let quizDataPool = [];
async function loadQuestions() {
    try {
        const response = await fetch('preguntas.json');
        if (!response.ok) throw new Error('No se pudo cargar el archivo');
        quizDataPool = await response.json();
    } catch (error) {
        quizDataPool = [
            { "question": "ERROR: No se pudo cargar 'preguntas.json'. ¿Estás abriendo el HTML directamente (file://) en vez de usar un servidor local?", "answers": ["Sí, ese es el error", "Debo usar Live Server", "Falta el archivo JSON", "Todas las anteriores"], "correctIndex": 3 }
        ];
        while(quizDataPool.length < 20) {
            quizDataPool.push({ "question": "Por favor, carga el juego en un servidor web o súbelo a GitHub Pages para que el JSON funcione.", "answers": ["Entendido", "Ok", "Comprendo", "Solucionar"], "correctIndex": 0 });
        }
    }
    // Conectar el pool cargado al motor de selección inteligente
    _qeSync();
}

// ═══════════════════════════════════════════════════════════════════════════
//  BANCO DE LOGROS — orden temático y por dificultad creciente
//
//  Bloques (de más accesible a más difícil / oculto):
//   1. BIENVENIDA       — primer día, nombre, primera partida            (fáciles)
//   2. PARTIDAS         — partidas jugadas y por día                     (progresión)
//   3. DÍAS & FIDELIDAD — rachas de login, días totales, retornos        (constancia)
//   4. PUNTUACIÓN       — récords por partida y totales de carrera       (habilidad)
//   5. SUPERVIVENCIA    — preguntas alcanzadas, sin perder vidas         (resistencia)
//   6. RACHA & MULT     — racha máx, multiplicadores                    (combo)
//   7. VELOCIDAD        — respuestas rápidas, Flash, sin timeout        (reflejos)
//   8. FRENESÍ          — activaciones de frenesí y frenesí eterno      (intensidad)
//   9. ACIERTOS         — aciertos acumulados en carrera                (volumen)
//  10. ERRORES          — fallos e intentos fallidos                    (humor/ironía)
//  11. RULETA           — premios de la ruleta de recompensas           (suerte)
//  12. MÚSICA Y AUDIO   — pistas, silencio, audio                       (tweaker)
//  13. CONFIGURACIÓN    — FPS, partículas, temas                        (tweaker)
//  14. INTERFAZ         — logros de navegación, perfil, ranking          (exploración)
//  15. NOMBRE           — cambios de nombre                              (social)
//  16. COLECCIÓN Y META — coleccionismo, pins, logros diarios            (meta)
//  17. CLASIFICACIÓN    — ranking global, PL, podio                      (competitivo)// --- Data Logros ---
const ACHIEVEMENTS_DATA = [];
const colors = { blue: 'var(--accent-blue)', green: 'var(--accent-green)', yellow: 'var(--accent-yellow)', orange: 'var(--accent-orange)', red: 'var(--accent-red)', purple: 'var(--accent-purple)', dark: 'var(--text-secondary)' };

// CHEATER_ACHIEVEMENT removed in v4

function addAchs(arr) { arr.forEach(a => ACHIEVEMENTS_DATA.push(a)); }

// ─── 1. BIENVENIDA (8) ────────────────────────────────────────────────────
addAchs([
    { id: 'x1',       title: 'Primer Día',        desc: 'Inicia sesión por primera vez.',                               color: colors.blue,   icon: SVG_CLOCK },
    { id: 'm1',       title: 'Bautizado',          desc: 'Configura tu nombre de jugador por primera vez.',             color: colors.blue,   icon: SVG_USER },
    { id: 'ui7',      title: 'Nuevo en el Barrio', desc: 'Juega tu primera partida con nombre registrado.',             color: colors.green,  icon: SVG_USER },
    { id: 'x3',       title: 'Aprendiz',           desc: 'Completa tu primera partida (sin importar el puntaje).',      color: colors.green,  icon: SVG_TARGET },
    { id: 'u1',       title: 'Error Inicial',      desc: 'Equivócate al responder por primera vez.',                   color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u3',       title: 'Dormilón',           desc: 'Deja que el reloj llegue a cero en una pregunta.',            color: colors.dark,   icon: SVG_CLOCK },
    { id: 'secret_logo', title: '¡Klick!',         desc: 'Hiciste clic en el nombre del juego en la pantalla principal.', color: colors.yellow, icon: SVG_BOLT, hidden: true },
    { id: 'x2',          title: 'Paciente',          desc: 'Espera 10 segundos en la pantalla principal sin hacer nada.',  color: colors.dark,   icon: SVG_CLOCK },
]);

// ─── 2. PARTIDAS JUGADAS (8 escalables + partidas por día 5+5) ───────────
const ptTiers=[1,5,10,25,50,100,200,500];
for(let i=0;i<8;i++) addAchs([{ id:`p${i+1}`, title:`Jugador ${i+1}`, desc:`Acumula ${ptTiers[i]} partidas jugadas.`, color:colors.blue, icon:SVG_TARGET }]);

const todayTiers=[3,5,8,10,15];
for(let i=0;i<5;i++) addAchs([{ id:`td${i+1}`, title:`Intenso ${i+1}`, desc:`Juega ${todayTiers[i]} partidas en un solo día.`, color:colors.orange, icon:SVG_FIRE }]);
addAchs([
    { id: 'x13', title: 'Noche de Fuego',    desc: 'Juega 10 partidas o más en un único día.',                         color: colors.red,    icon: SVG_FIRE },
    { id: 'u22', title: 'Maratón',           desc: 'Juega 50 partidas en un solo día.',                                color: colors.purple, icon: SVG_HEART },
]);

// ─── 3. DÍAS Y FIDELIDAD (10 días + 5 asiduo + 5 fiel) ───────────────────
const daysTiers  = [1,2,3,5,7,15,21,30,60,90];
const daysTitles = ['Hola Mundo','Doble','Triple','Cinco','Semana Activa','Quincena','Tres Semanas','Un Mes','Bimestre','Trimestre Fuego'];
for(let i=0;i<5;i++) addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Inicia sesión durante ${daysTiers[i]} días consecutivos.`, color:colors.green, icon:SVG_CLOCK }]);
for(let i=5;i<10;i++) addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Juega en ${daysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const totalDaysTiers=[7,12,18,25,45];
for(let i=0;i<5;i++) addAchs([{ id:`td2${i+1}`, title:`Asiduo ${i+1}`, desc:`Juega en ${totalDaysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const returnDayTiers=[3,8,20,40,75];
for(let i=0;i<5;i++) addAchs([{ id:`ret${i+1}`, title:`Fiel ${i+1}`, desc:`Regresa a jugar ${returnDayTiers[i]} días diferentes en total.`, color:colors.green, icon:SVG_HEART }]);
addAchs([
    { id: 'x16', title: 'Regreso Triunfal', desc: 'Después de no jugar por un día, supera tu último récord.',           color: colors.yellow, icon: SVG_TROPHY },
    { id: 'x18', title: 'El Clásico',       desc: 'Usa el mismo nombre de jugador por 30 días seguidos.',               color: colors.purple, icon: SVG_USER },
]);

// ─── 4. PUNTUACIÓN (8 récord + 8 totales + logros de puntaje) ────────────
const bestScoreTiers=[5000,25000,75000,150000,300000,600000,1000000,2000000];
const bestScoreTitles=['Primera Marca','Principiante','Prometedor','Serio','Élite','Extraordinario','El Millón','Leyenda Viva'];
for(let i=0;i<8;i++) addAchs([{ id:`bs${i+1}`, title:bestScoreTitles[i], desc:`Alcanza un puntaje récord de ${bestScoreTiers[i].toLocaleString()} puntos en una partida.`, color:colors.yellow, icon:SVG_TROPHY }]);
const ptsTiers=[10000,50000,200000,500000,1000000,2500000,5000000,10000000];
for(let i=0;i<8;i++) addAchs([{ id:`pt${i+1}`, title:`Ahorrador ${i+1}`, desc:`Acumula ${ptsTiers[i].toLocaleString()} puntos totales en tu carrera.`, color:colors.green, icon:SVG_STAR }]);
const hsCountTiers=[1,3,5,10,20,35,50,100];
for(let i=0;i<8;i++) addAchs([{ id:`hs${i+1}`, title:`Récord ${i+1}`, desc:`Supera 100,000 puntos en ${hsCountTiers[i]} partidas distintas.`, color:colors.purple, icon:SVG_FIRE }]);
addAchs([
    { id: 'x7',  title: 'Un Golpe Certero', desc: 'Consigue más de 3,000 puntos en las primeras 3 preguntas.',          color: colors.yellow, icon: SVG_BOLT },
    { id: 'x12', title: 'Principiante Letal',desc: 'Consigue 50,000 puntos en tu primera partida del día.',             color: colors.blue,   icon: SVG_STAR },
    { id: 'x4',  title: 'Doble Victoria',    desc: 'Supera 75,000 puntos dos partidas seguidas.',                       color: colors.yellow, icon: SVG_TROPHY },
    { id: 'x6',  title: 'Consistente',       desc: 'Termina 5 partidas seguidas con al menos 25,000 puntos.',           color: colors.blue,   icon: SVG_SHIELD },
    { id: 'x15', title: 'Punto de Quiebre',  desc: 'Alcanza exactamente 100,000 puntos (±500).',                        color: colors.purple, icon: SVG_TARGET },
    { id: 'extra2', title: 'Precisionista',  desc: 'Termina una partida con 100% de precisión (mín. 10 respuestas).',  color: colors.yellow, icon: SVG_TARGET },
]);

// ─── 5. SUPERVIVENCIA (8 preguntas alcanzadas + logros sin perder vidas) ─
const pfTiers=[10,20,30,50,75,100,150,200];
for(let i=0;i<8;i++) addAchs([{ id:`pf${i+1}`, title:`Resistencia ${i+1}`, desc:`Llega a la pregunta ${pfTiers[i]} en una sola partida.`, color:colors.yellow, icon:SVG_TARGET }]);
addAchs([
    { id: 'x10',  title: 'Economía',         desc: 'Completa 20 preguntas sin perder ninguna vida.',                    color: colors.green,  icon: SVG_HEART },
    { id: 'x14',  title: 'Invicto',          desc: 'Llega a la pregunta 30 sin perder una vida.',                       color: colors.green,  icon: SVG_SHIELD },
    { id: 'np1',  title: 'Examen de Oro',    desc: 'Logra 10 aciertos seguidos sin perder ninguna vida.',               color: colors.yellow, icon: SVG_SHIELD },
    { id: 'u9',   title: 'Inmortal',         desc: 'Completa 50 preguntas seguidas sin perder ninguna vida.',           color: colors.purple, icon: SVG_SHIELD },
    { id: 'np3',  title: 'Sin Límites',      desc: 'Completa una partida de más de 60 preguntas sin rendirte.',         color: colors.purple, icon: SVG_BOLT },
    { id: 'extra3', title: 'Maratonista',    desc: 'Supera las 80 preguntas en una sola partida.',                      color: colors.green,  icon: SVG_SHIELD },
    { id: 'u15',  title: 'Superviviente',    desc: 'Llega a 120 preguntas en una sola partida.',                        color: colors.green,  icon: SVG_SHIELD },
    { id: 'x11',  title: 'El Último Chance', desc: 'Responde correctamente estando en la última vida.',                 color: colors.orange, icon: SVG_SHIELD },
]);

// ─── 5b. EXPANSIÓN SUPERVIVENCIA (preguntas extremas) ────────────────────
addAchs([
    { id: 'pf9',  title: 'Sin Fin I',    desc: 'Llega a la pregunta 300 en una partida.',                               color: colors.green,  icon: SVG_BOLT },
    { id: 'pf10', title: 'Sin Fin II',   desc: 'Llega a la pregunta 400 en una partida.',                               color: colors.orange, icon: SVG_BOLT },
    { id: 'pf11', title: 'Sin Fin III',  desc: 'Llega a la pregunta 800 en una partida.',                               color: colors.red,    icon: SVG_BOLT },
]);

// ─── 6. RACHA Y MULTIPLICADOR (8 racha + 10 mult) ────────────────────────
const strkTiers=[5,10,15,20,25,30,40,50];
for(let i=0;i<8;i++) addAchs([{ id:`sk${i+1}`, title:`Encadenado ${i+1}`, desc:`Alcanza una racha de ${strkTiers[i]} aciertos seguidos en alguna partida.`, color:colors.orange, icon:SVG_BOLT }]);
addAchs([
    { id: 'u23', title: 'Imparable', desc: 'Encadena una racha de 35 aciertos o más en una partida.', color: colors.yellow, icon: SVG_TARGET },
]);
const multTiers=[2,3,4,5];
for(let i=0;i<4;i++) addAchs([{ id:`mx${i+1}`, title:`Multiplicador x${multTiers[i]}`, desc:`Alcanza el multiplicador x${multTiers[i]} en una partida.`, color:colors.red, icon:SVG_FIRE }]);
addAchs([
    { id: 'mx5',  title: 'Dominio del Caos',           desc: 'Alcanza el multiplicador x5 con al menos 30 partidas jugadas.',  color: colors.red,    icon: SVG_FIRE },
    { id: 'mx6',  title: 'Multiplicador x6',           desc: 'Alcanza el multiplicador x6 en una partida.',             color: colors.purple, icon: SVG_FIRE },
    { id: 'mx7',  title: 'Multiplicador x7',           desc: 'Alcanza el multiplicador x7 en una partida.',             color: colors.red,    icon: SVG_FIRE },
    { id: 'mx8',  title: 'Multiplicador x8',           desc: 'Alcanza el multiplicador x8 en una partida.',             color: colors.red,    icon: SVG_BOLT },
    { id: 'mx9',  title: 'Multiplicador x9',           desc: 'Alcanza el multiplicador x9 en una partida.',             color: colors.yellow, icon: SVG_BOLT },
    { id: 'mx10', title: 'Multiplicador x10 — MÁXIMO', desc: 'Alcanza el multiplicador máximo x10. Eres imparable.',    color: colors.yellow, icon: SVG_TROPHY },
    { id: 'u16',  title: 'Frenesí Máximo',             desc: 'Activa el Modo Frenesí 15 veces en total.',               color: colors.orange, icon: SVG_FIRE },
]);

// ─── 7. VELOCIDAD Y REFLEJOS (8 velocidad + racha sin timeout + únicos) ──
const spdTiers=[5,15,30,60,100,200,350,500];
for(let i=0;i<8;i++) addAchs([{ id:`sp${i+1}`, title:`Reflejos ${i+1}`, desc:`Responde correctamente en los primeros 2s en ${spdTiers[i]} ocasiones.`, color:colors.blue, icon:SVG_BOLT }]);
const noTimoutTiers=[5,10,20,35,50];
for(let i=0;i<5;i++) addAchs([{ id:`nt${i+1}`, title:`Puntual ${i+1}`, desc:`Responde ${noTimoutTiers[i]} preguntas seguidas sin que se acabe el tiempo.`, color:colors.yellow, icon:SVG_CLOCK }]);
addAchs([
    { id: 'u13',  title: 'Flash',         desc: 'Responde correctamente en menos de 1 segundo.',                       color: colors.yellow, icon: SVG_BOLT },
    { id: 'u5',   title: 'Por los Pelos', desc: 'Acierta una pregunta cuando el reloj marque exactamente 1 segundo.',  color: colors.red,    icon: SVG_CLOCK },
    { id: 'u14',  title: 'Calculador',    desc: 'Acierta dejando que el reloj baje a 2-3 segundos.',                   color: colors.blue,   icon: SVG_CLOCK },
    { id: 'u17',  title: 'Reloj de Arena',desc: 'Acumula 50 respuestas de último segundo (1-2 seg).',                  color: colors.blue,   icon: SVG_CLOCK },
    { id: 'u24',  title: 'Extremis',      desc: 'Consigue 3 aciertos de último segundo (1 seg) en una partida.',      color: colors.red,    icon: SVG_SHIELD },
    { id: 'x19',  title: 'Espectacular',  desc: 'Consigue 5 respuestas Flash (< 1 seg) en una partida.',              color: colors.yellow, icon: SVG_BOLT },
    { id: 'u21',  title: 'Metralleta',    desc: 'Responde 10 preguntas seguidas en menos de 3 segundos cada una.',     color: colors.red,    icon: SVG_BOLT },
    { id: 'x9',   title: 'Todo Gas',      desc: 'Responde las primeras 10 preguntas en menos de 3 segundos cada una.', color: colors.red,    icon: SVG_BOLT },
    { id: 'x8',   title: 'Sin Prisa',     desc: 'Termina una partida usando menos de 5 respuestas rápidas.',           color: colors.dark,   icon: SVG_CLOCK },
    { id: 'u20',  title: 'Centinela',     desc: 'Llega a la pregunta 50 sin usar ningún fallo por tiempo.',            color: colors.dark,   icon: SVG_CLOCK },
]);

// ─── 7b. EXPANSIÓN VELOCIDAD (reflejos extremos) ─────────────────────────
addAchs([
    { id: 'sp9',  title: 'Reflejo Sobrehumano',   desc: 'Acumula 2,000 respuestas rápidas en total.',                   color: colors.blue,   icon: SVG_BOLT },
    { id: 'sp10', title: 'Máquina Klick',         desc: 'Acumula 5,000 respuestas rápidas en total.',                   color: colors.purple, icon: SVG_BOLT },
    { id: 'sp11', title: 'Velocidad Absoluta',    desc: 'Acumula 10,000 respuestas rápidas en total.',                  color: colors.yellow, icon: SVG_FIRE },
]);

// ─── 8. FRENESÍ (8 conteo + 5 eterno + únicos) ───────────────────────────
const frTiers=[1,5,10,25,50,100,200,500];
for(let i=0;i<8;i++) addAchs([{ id:`r${i+1}`, title:`Frenético ${i+1}`, desc:`Activa el Modo Frenesí en ${frTiers[i]} ocasiones.`, color:colors.orange, icon:SVG_FIRE }]);
const frenzyTimeTiers=[3,5,8,12,20];
for(let i=0;i<5;i++) addAchs([{ id:`ft${i+1}`, title:`Frenesí Eterno ${i+1}`, desc:`Mantén el Modo Frenesí activo durante ${frenzyTimeTiers[i]} preguntas consecutivas.`, color:colors.red, icon:SVG_FIRE }]);
addAchs([
    { id: 'extra1', title: 'Doble Frenesí', desc: 'Activa el Modo Frenesí dos veces en la misma partida.',              color: colors.red,    icon: SVG_FIRE },
    { id: 'fin3',   title: 'Momento Épico', desc: 'Entra en Modo Frenesí y luego consigue 20 aciertos más.',            color: colors.red,    icon: SVG_FIRE },
]);

// ─── 9. ACIERTOS TOTALES (8 escalables + precisión global) ───────────────
const acTiers=[10,50,100,250,500,1000,2500,5000];
for(let i=0;i<8;i++) addAchs([{ id:`ac${i+1}`, title:`Cerebro ${i+1}`, desc:`Acumula ${acTiers[i]} respuestas correctas en total.`, color:colors.green, icon:SVG_CORRECT }]);
addAchs([
    { id: 'u_bisturi', title: 'Bisturí', desc: 'Mantén una precisión del 90% o más con al menos 500 respuestas totales en tu carrera.', color: colors.yellow, icon: SVG_TARGET },
]);

// ─── 10. ERRORES E IRONÍA (5 fallos + 5 timeouts + únicos humorísticos) ──
const wrnTiers=[10,50,100,250,500];
for(let i=0;i<5;i++) addAchs([{ id:`wr${i+1}`, title:`Torpeza ${i+1}`, desc:`Acumula ${wrnTiers[i]} respuestas incorrectas en tu carrera.`, color:colors.dark, icon:SVG_INCORRECT }]);
const toTiers=[5,20,50,100,250];
for(let i=0;i<5;i++) addAchs([{ id:`to${i+1}`, title:`Ausente ${i+1}`, desc:`Deja el reloj llegar a cero ${toTiers[i]} veces.`, color:colors.dark, icon:SVG_CLOCK }]);
addAchs([
    { id: 'u2',   title: 'Tropiezo',    desc: 'Acumula 75 respuestas incorrectas en tu carrera.',                      color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u4',   title: 'AFK',         desc: 'Deja que el reloj llegue a cero 35 veces en total.',                    color: colors.dark,   icon: SVG_CLOCK },
    { id: 'u10',  title: 'Desastre',    desc: 'Pierde las 3 vidas en las primeras 3 preguntas.',                       color: colors.dark,   icon: SVG_SKULL },
    { id: 'u18',  title: 'Suicida',     desc: 'Pierde las 3 vidas en menos de 30 segundos de partida.',                color: colors.dark,   icon: SVG_SKULL },
    { id: 'u12',  title: 'Tragedia',    desc: 'Pierde la última vida durante una racha de 20 o más.',                  color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'np4',  title: 'La Última Bala', desc: 'Consigue exactamente 1 acierto antes de perder todas las vidas.',   color: colors.dark,   icon: SVG_SKULL },
    { id: 'x5',   title: 'La Revancha', desc: 'Después de una partida con 0 aciertos, consigue más de 10 aciertos.',  color: colors.orange, icon: SVG_FIRE },
    { id: 'u11',  title: 'Fénix',       desc: 'Pierde 2 vidas al inicio pero llega a 30 aciertos consecutivos.',      color: colors.orange, icon: SVG_FIRE },
    { id: 'u19',  title: 'Resurrección',desc: 'Pierde 2 vidas seguidas y encadena 10 aciertos consecutivos.',         color: colors.yellow, icon: SVG_HEART },
]);

// ─── 11. RULETA DE RECOMPENSAS (10) ──────────────────────────────────────
const SVG_WHEEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`;
addAchs([
    { id: 'rl1',  title: 'Primera Ruleta',     desc: 'Gira la ruleta de recompensas por primera vez.',                 color: colors.yellow, icon: SVG_WHEEL },
    { id: 'rl6',  title: 'Rodillo de Suerte',  desc: 'Gira la ruleta 10 veces en total.',                             color: colors.blue,   icon: SVG_WHEEL },
    { id: 'rl7',  title: 'Rulero Empedernido', desc: 'Gira la ruleta 50 veces en total.',                             color: colors.purple, icon: SVG_WHEEL },
    { id: 'rl2',  title: 'Afortunado',         desc: 'Obtén una Vida Extra en la ruleta.',                            color: colors.red,    icon: SVG_HEART },
    { id: 'rl8',  title: 'Gran Premio',        desc: 'Consigue la Vida Extra 3 veces en distintas partidas.',         color: colors.red,    icon: SVG_HEART },
    { id: 'rl3',  title: 'Escudo Dorado',      desc: 'Obtén el Escudo en la ruleta.',                                 color: colors.yellow, icon: SVG_SHIELD },
    { id: 'rl9',  title: 'Invulnerable',       desc: 'Activa el Escudo y supera la pregunta sin perder vida.',        color: colors.yellow, icon: SVG_SHIELD },
    { id: 'rl4',  title: 'Potenciado',         desc: 'Obtén cualquier multiplicador de puntos en la ruleta.',         color: colors.orange, icon: SVG_STAR },
    { id: 'rl5',  title: 'Frenesí Regalado',   desc: 'Activa el Frenesí mediante la ruleta.',                         color: colors.purple, icon: SVG_FIRE },
    { id: 'rl10', title: 'Combo Especial',     desc: 'Consigue cualquier premio de ruleta durante una racha de 20+.', color: colors.orange, icon: SVG_BOLT },
]);

// ─── 12. KLICK PASS (10) ──────────────────────────────────────────────────
addAchs([
    { id: 'kpa1', title: 'Primer Paso',      desc: 'Reclama tu primer nivel del Klick Pass.',                         color: colors.green,  icon: SVG_TARGET },
    { id: 'kpa6', title: 'Explorador del Pase', desc: 'Abre el Klick Pass por primera vez.',                          color: colors.green,  icon: SVG_TARGET },
    { id: 'kpa2', title: 'En Camino',        desc: 'Completa 25 niveles del Klick Pass.',                             color: colors.blue,   icon: SVG_TARGET },
    { id: 'kpa7', title: 'Constante',        desc: 'Reclama al menos un nivel del Klick Pass en 3 días distintos.',   color: colors.blue,   icon: SVG_TARGET },
    { id: 'kpa3', title: 'A Mitad de Ruta',  desc: 'Completa 50 niveles del Klick Pass.',                             color: colors.yellow, icon: SVG_TARGET },
    { id: 'kpa8', title: 'Dedicado',         desc: 'Reclama al menos un nivel del Klick Pass en 7 días distintos.',   color: colors.yellow, icon: SVG_STAR },
    { id: 'kpa9', title: 'Imparable',        desc: 'Reclama al menos un nivel del Klick Pass en 15 días distintos.',  color: colors.orange, icon: SVG_STAR },
    { id: 'kpa4', title: 'Casi en la Cima',  desc: 'Completa 75 niveles del Klick Pass.',                             color: colors.orange, icon: SVG_STAR },
    { id: 'kpa5', title: 'Pase Completado',  desc: 'Reclama los 100 niveles del Klick Pass en su totalidad.',         color: colors.red,    icon: SVG_STAR },
    { id: 'kpa10',title: 'Coleccionista Total', desc: 'Reclama los 100 niveles del Klick Pass y desbloquea todos los 300 logros del juego.', color: colors.red,    icon: SVG_TROPHY },
]);

// ─── 13. MÚSICA Y AUDIO (3 pistas) ───────────────────────────────────────
addAchs([
    { id: 'trk1', title: 'Explorador Musical', desc: 'Cambia de pista musical al menos una vez desde Configuración.',  color: colors.green,  icon: SVG_STAR },
    { id: 'trk2', title: 'DJ Klick',           desc: 'Prueba las 3 pistas musicales disponibles.',                    color: colors.blue,   icon: SVG_STAR },
    { id: 'trk3', title: 'Fiel al Ritmo',      desc: 'Juega 10 partidas con la misma pista sin cambiarla.',           color: colors.purple, icon: SVG_FIRE },
    { id: 'extra4', title: 'Silencioso',        desc: 'Juega 5 partidas con la música completamente apagada.',         color: colors.dark,   icon: SVG_CLOCK },
]);

// ─── 14. INTERFAZ Y EXPLORACIÓN (visitas, guía, perfil, logros meta) ─────
addAchs([
    { id: 'm4',  title: 'Curioso',             desc: 'Abre el Banco de Logros por primera vez.',                      color: colors.orange, icon: SVG_TROPHY },
    { id: 'm5',  title: 'Investigador',        desc: 'Visita el Banco de Logros 10 veces.',                           color: colors.blue,   icon: SVG_TROPHY },
    { id: 'm6',  title: 'Obsesivo',            desc: 'Visita el Banco de Logros 50 veces.',                           color: colors.purple, icon: SVG_TROPHY },
]);
const profileVisTiers=[1,5,15,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`pv${i+1}`, title:`Egocéntrico ${i+1}`, desc:`Visita tu perfil ${profileVisTiers[i]} veces.`, color:colors.purple, icon:SVG_USER }]);
const rankVisTiers=[1,5,15,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`rv${i+1}`, title:`Espía de Clasificación ${i+1}`, desc:`Visita la Clasificación Global ${rankVisTiers[i]} veces.`, color:colors.blue, icon:SVG_TROPHY }]);
addAchs([
    { id: 'ui1',  title: 'Explorador',          desc: 'Visita todas las secciones del menú en una misma sesión.',      color: colors.blue,   icon: SVG_TARGET },
    { id: 'ui5',  title: 'El Perfil Importa',   desc: 'Visita tu perfil después de cada una de tus primeras 5 partidas.', color: colors.blue, icon: SVG_USER },
    { id: 'ui9',  title: 'Puntaje en Mente',    desc: 'Revisa tu perfil inmediatamente después de un puntaje récord.', color: colors.yellow, icon: SVG_STAR },
]);

// ─── 15. CONFIGURACIÓN (4 visitas + 10 ajustes) ───────────────────────────
const cfgVisTiers=[1,5,15,30];
for(let i=0;i<4;i++) addAchs([{ id:`cv${i+1}`, title:`Ajustador ${i+1}`, desc:`Abre el menú de Configuración ${cfgVisTiers[i]} veces.`, color:colors.purple, icon:SVG_USER }]);
addAchs([
    { id: 'cfg1',  title: 'Silencio Total',    desc: 'Pon la música en 0% desde Configuración.',                       color: colors.dark,   icon: SVG_CLOCK },
    { id: 'cfg2',  title: 'Oídos Abiertos',   desc: 'Sube la música al 100% desde Configuración.',                    color: colors.green,  icon: SVG_STAR },
    { id: 'cfg3',  title: 'Sordomudo',         desc: 'Pon tanto la música como el SFX en 0%.',                         color: colors.dark,   icon: SVG_SKULL },
    { id: 'cfg7',  title: 'Fantasma',          desc: 'Pon las partículas en 0%.',                                      color: colors.dark,   icon: SVG_SKULL },
    { id: 'cfg8',  title: 'Purpurina',         desc: 'Pon las partículas en 100% y la música en 100% al mismo tiempo.', color: colors.purple, icon: SVG_STAR },
    { id: 'cfg4',  title: 'Ajuste Fino',       desc: 'Cambia el valor de FPS al menos 5 veces.',                      color: colors.purple, icon: SVG_BOLT },
    { id: 'cfg6',  title: 'Ahorro de Batería', desc: 'Activa 15 FPS en Configuración.',                               color: colors.dark,   icon: SVG_CLOCK },
    { id: 'cfg5',  title: 'Velocista',         desc: 'Activa 240 FPS en Configuración.',                              color: colors.red,    icon: SVG_FIRE },
    { id: 'cfg9',  title: 'Luz del Día',       desc: 'Activa el Modo Claro desde Configuración.',                     color: colors.yellow, icon: SVG_BOLT },
    { id: 'cfg10', title: 'Vuelta a Casa',     desc: 'Cambia del Modo Claro al Oscuro después de haberlo activado.',   color: colors.dark,   icon: SVG_MOON },
]);

// ─── 16. NOMBRE DE JUGADOR (2) ────────────────────────────────────────────
addAchs([
    { id: 'm2',  title: 'Agente Secreto', desc: 'Cambia tu nombre de jugador 5 veces.',                               color: colors.purple, icon: SVG_USER },
    { id: 'm3',  title: 'Identidad Falsa',desc: 'Cambia tu nombre de jugador 20 veces.',                              color: colors.red,    icon: SVG_USER },
]);

// ─── 17. COLECCIÓN Y META (escalas + pins + productivo + especiales) ──────
addAchs([
    { id: 'm8',  title: 'Coleccionista',  desc: 'Desbloquea 10 logros en total.',                                     color: colors.green,  icon: SVG_STAR },
    { id: 'm9',  title: 'Completista',    desc: 'Alcanza el hito de 25 logros desbloqueados.',                        color: colors.orange, icon: SVG_STAR },
    { id: 'm10', title: 'Dedicado',       desc: 'Consigue 50 logros desbloqueados.',                                  color: colors.red,    icon: SVG_STAR },
    { id: 'm7',  title: 'Diseñador',      desc: 'Fija tu primer logro en el perfil.',                                 color: colors.yellow, icon: SVG_STAR },
    { id: 'np2', title: 'Presumido',      desc: 'Fija 3 logros de color Rojo, Naranja o Dorado en tu perfil.',        color: colors.red,    icon: SVG_STAR },
]);
const pinTiers=[1,5,10,20,50];
for(let i=0;i<5;i++) addAchs([{ id:`pin${i+1}`, title:`Curador ${i+1}`, desc:`Fija logros en el perfil ${pinTiers[i]} veces en total.`, color:colors.blue, icon:SVG_PIN }]);
const dailyAchTiers=[1,3,5,8,12];
for(let i=0;i<5;i++) addAchs([{ id:`da${i+1}`, title:`Productivo ${i+1}`, desc:`Desbloquea ${dailyAchTiers[i]} logros nuevos en un mismo día.`, color:colors.purple, icon:SVG_STAR }]);
addAchs([
    { id: 'extra5', title: 'Día Épico',  desc: 'Desbloquea 15 logros en un mismo día.',                               color: colors.purple, icon: SVG_STAR },
]);

// ─── 18. CLASIFICACIÓN GLOBAL Y PODER (ranking + PL) ─────────────────────
addAchs([
    { id: 'nm1',  title: 'Primera Sangre',    desc: 'Aparece por primera vez en la Clasificación Global.',             color: colors.red,    icon: SVG_TROPHY },
    { id: 'nm8',  title: 'PL 10,000',         desc: 'Alcanza 10,000 Puntos de Poder (Nivel inicial).',                color: colors.green,  icon: SVG_STAR },
    { id: 'nm2',  title: 'Top 10',            desc: 'Entra en el Top 10 de la Clasificación.',                        color: colors.orange, icon: SVG_TROPHY },
    { id: 'nm9',  title: 'PL 100,000',        desc: 'Alcanza 100,000 Puntos de Poder.',                               color: colors.blue,   icon: SVG_STAR },
    { id: 'nm5',  title: 'Vigilia',           desc: 'Sube en la Clasificación en 3 días consecutivos.',               color: colors.blue,   icon: SVG_CLOCK },
    { id: 'nm6',  title: 'Impostado',         desc: 'Supera a otro jugador que tenía más de 1,000 PL que tú.',        color: colors.purple, icon: SVG_BOLT },
    { id: 'nm7',  title: 'Remontada',         desc: 'Estabas en puesto 15+ y ascendiste al Top 5 en una partida.',    color: colors.orange, icon: SVG_FIRE },
    { id: 'nm3',  title: 'Podio',             desc: 'Entra en el Top 3 de la Clasificación.',                         color: colors.yellow, icon: SVG_TROPHY },
    { id: 'nm4',  title: 'El Primero',        desc: 'Llega al primer lugar de la Clasificación.',                     color: colors.yellow, icon: SVG_STAR },
    { id: 'nm10', title: 'PL 1,000,000',      desc: 'Alcanza 1,000,000 de Puntos de Poder. Meta del Top Mundial.',    color: colors.yellow, icon: SVG_STAR },
    { id: 'pod1', title: 'Rey Klick',         desc: 'Eres Leyenda o superior y ocupas el 1.er lugar de la clasificación.',   color: '#6e8fad',    icon: SVG_TROPHY },
    { id: 'pod2', title: 'Señor Klick',       desc: 'Eres Leyenda o superior y ocupas el 2.º lugar de la clasificación.',    color: '#ff5e00',    icon: SVG_TROPHY },
    { id: 'pod3', title: 'Caballero Klick',   desc: 'Eres Leyenda o superior y ocupas el 3.er lugar de la clasificación.',   color: '#ccff00',    icon: SVG_TROPHY },
]);

// ─── 19. RANGOS (Junior → Mítico + títulos exclusivos + especiales) ───────
addAchs([
    { id: 'u_junior',  title: 'Junior',   desc: 'Alcanza el rango Junior.',                                           color: colors.blue,   icon: SVG_TROPHY },
    { id: 'u6',        title: 'Pro',      desc: 'Alcanza el rango Pro.',                                              color: colors.red,    icon: SVG_TROPHY },
    { id: 'u7',        title: 'Maestro',  desc: 'Alcanza el rango Maestro.',                                          color: colors.purple, icon: SVG_TROPHY },
    { id: 'u8',        title: 'Leyenda',  desc: 'Alcanza el codiciado rango Leyenda.',                                color: colors.yellow, icon: SVG_TROPHY },
    { id: 'fin4',      title: 'El Pacto', desc: 'Juega durante 7 días seguidos y alcanza el rango Junior.',           color: colors.green,  icon: SVG_SHIELD },
    { id: 'x17',       title: 'Veterano', desc: 'Acumula más de 150 partidas jugadas.',                               color: colors.blue,   icon: SVG_TROPHY },
    { id: 'u_eterno',  title: 'Eterno',   desc: 'Alcanza el rango Eterno. Un paso entre leyendas y dioses.',          color: '#6600ff',     icon: SVG_STAR },
    { id: 'et1', title: 'El Eterno',        desc: 'Logro de rango Eterno. Titulo exclusivo: El Eterno.',                color: '#6600ff', icon: SVG_STAR },
    { id: 'et2', title: 'Sin Principio',    desc: 'Logro de rango Eterno. Titulo exclusivo. Alcanza Eterno con 100 logros desbloqueados.', color: '#6600ff', icon: SVG_STAR },
    { id: 'et3', title: 'Fuera del Tiempo', desc: 'Logro de rango Eterno. Titulo exclusivo. Alcanza Eterno habiendo jugado 20 dias distintos en total.', color: '#6600ff', icon: SVG_STAR },
    { id: 'u_mitico',  title: 'Mítico',   desc: 'Alcanza el rango Mítico. El más difícil de conseguir.',              color: '#ff9500',     icon: SVG_STAR },
    { id: 'mit1', title: 'El Último',      desc: 'Logro de rango Mítico. Título exclusivo: "El Último".',              color: '#ff9500',     icon: SVG_STAR },
    { id: 'mit2', title: 'Leyenda Viva',   desc: 'Logro de rango Mítico. Título exclusivo: "Leyenda Viva".',           color: '#ff9500',     icon: SVG_STAR },
    { id: 'mit3', title: 'El Absoluto',    desc: 'Logro de rango Mítico. Completa los 280 logros siendo Mítico.',      color: '#ff9500',     icon: SVG_STAR },
]);

// ─── 20. PANTALLA DE RANGOS (navegación) ─────────────────────────────────
addAchs([
    { id: 'rk1', title: 'Explorador de Rangos',   desc: 'Visita la pantalla de Rangos por primera vez.',                color: colors.blue,   icon: SVG_TROPHY },
    { id: 'rk2', title: 'Aspirante Consciente',   desc: 'Visita la pantalla de Rangos 5 veces.',                        color: colors.green,  icon: SVG_TROPHY },
    { id: 'rk3', title: 'Calculador',             desc: 'Visita la pantalla de Rangos 15 veces.',                       color: colors.purple, icon: SVG_TARGET },
]);

// ─── 21. ESTADÍSTICAS EXTREMAS — DIVINIDAD ───────────────────────────────
addAchs([
    { id: 'div1', title: 'Punto de No Retorno',   desc: 'Acumula 2,000,000 puntos en total.',                           color: colors.red,    icon: SVG_BOLT },
    { id: 'div2', title: 'El Inmortal',           desc: 'Alcanza 8,000 aciertos totales.',                              color: colors.purple, icon: SVG_FIRE },
    { id: 'div3', title: 'Trascendencia',         desc: 'Completa 75 partidas perfectas.',                              color: colors.yellow, icon: SVG_STAR },
]);

// ─── 22. MAESTROS DE COLECCIÓN (logros extremos de platino) ─────────────
addAchs([
    { id: 'master1', title: 'Ambicioso',    desc: 'Desbloquea 75 logros en total.',                                  color: colors.yellow, icon: SVG_STAR },
    { id: 'master2', title: 'Centenario',   desc: 'Desbloquea 100 logros en total.',                                 color: colors.orange, icon: SVG_STAR },
    { id: 'master4', title: 'Leyenda Total',desc: 'Desbloquea 150 logros en total.',                                 color: colors.purple, icon: SVG_STAR },
    { id: 'master5', title: 'A las Puertas',desc: 'Desbloquea 200 logros en total. El techo está a la vista.',      color: colors.yellow, icon: SVG_STAR },
    { id: 'master3', title: 'Dios Klick',   desc: 'Desbloquea los 300 logros del juego. Eres absoluto.',           color: colors.red,    icon: SVG_STAR },
]);

// ─── 23. ÚNICOS DE HORARIO Y SITUACIÓN (narrativos raros) ────────────────
addAchs([
    { id: 'fin1', title: 'Nocturno',      desc: 'Juega una partida después de las 11:00 PM.',                        color: colors.dark,   icon: SVG_CLOCK },
    { id: 'fin2', title: 'Madrugador',    desc: 'Juega una partida antes de las 6:00 AM.',                          color: colors.blue,   icon: SVG_CLOCK },
    { id: 'fin5', title: 'Monarca',       desc: 'Alcanza el rango Eterno o superior con 160 logros desbloqueados.',  color: colors.yellow, icon: SVG_TROPHY },
]);

// ─── 24. EL ARQUITECTO — logros relacionados con CHRISTOPHER ─────────────
addAchs([
    { id: 'cx1', title: 'Cara a Cara',        desc: 'Abre la tarjeta del Arquitecto del Sistema en la Clasificación.',             color: 'var(--divinity-color-static)', icon: SVG_USER },
    { id: 'cx2', title: 'Estudiado',           desc: 'Consulta la tarjeta del Arquitecto del Sistema 3 veces.',                      color: 'var(--divinity-color-static)', icon: SVG_USER },
    { id: 'cx3', title: 'Obsesionado',         desc: 'Consulta la tarjeta del Arquitecto del Sistema 10 veces.',                     color: 'var(--divinity-color-static)', icon: SVG_USER },
    { id: 'cx4', title: 'El Elegido',          desc: 'Consulta la tarjeta del Arquitecto del Sistema 25 veces.',                     color: 'var(--divinity-color-static)', icon: SVG_STAR },
]);


// ── Índice O(1) para lookup por ID ──────────────────────────────────────────
const ACHIEVEMENTS_MAP   = new Map(ACHIEVEMENTS_DATA.map(a => [a.id, a]));
const ACHIEVEMENTS_INDEX = new Map(ACHIEVEMENTS_DATA.map((a, i) => [a.id, i]));

// Títulos exclusivos equipables por jugadores Mítico
// Mapeados por id de logro → texto del título
// Títulos exclusivos equipables por jugadores Eterno
const ETERNO_TITLES = new Map([
    ['et1', 'El Eterno'],
    ['et2', 'Sin Principio'],
    ['et3', 'Fuera del Tiempo'],
]);
const ETERNO_TITLE_RANKS = new Set(['Eterno','Mítico','Divinidad']);
const MITICO_TITLES = new Map([
    ['mit1', 'El Último'],
    ['mit2', 'Leyenda Viva'],
    ['mit3', 'El Absoluto'],
]);
// Rangos que permiten equipar títulos Mítico
const MITICO_TITLE_RANKS = new Set(['Mítico','Divinidad']);

function processDailyLogin() {
    const now = new Date(); const todayStr = now.toISOString().split('T')[0];
    if (playerStats.lastLoginDate !== todayStr) {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1); const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (playerStats.lastLoginDate === yesterdayStr) { playerStats.currentLoginStreak++; playerStats.maxLoginStreak = Math.max(playerStats.maxLoginStreak, playerStats.currentLoginStreak); } 
        else { 
            playerStats.currentLoginStreak = 1; if(playerStats.maxLoginStreak === 0) playerStats.maxLoginStreak = 1;
            // Player missed at least one day — mark for x16 Regreso Triunfal
            if(playerStats.lastLoginDate) playerStats.missedADay = true;
        }
        playerStats.lastLoginDate = todayStr;
        playerStats.todayGames = 0;
        // Reset daily achievement counter so da1-da5 and extra5 track per-day correctly
        playerStats.dailyAchUnlocks = 0;
        saveStatsLocally(); checkAchievements();
    }
}
function shuffleArray(array) { let current = array.length, random; while (current !== 0) { random = Math.floor(Math.random() * current); current--; [array[current], array[random]] = [array[random], array[current]]; } return array; }

function getRankInfo(stats) {
    const totalAnswers = (stats.totalCorrect||0)+(stats.totalWrong||0)+(stats.totalTimeouts||0);
    const accuracy = totalAnswers>0 ? Math.round((stats.totalCorrect||0)/totalAnswers*100) : 0;
    const kpClaimed = (getKpState().claimed || []).length;
    // ── Divinidad — rango exclusivo del Arquitecto del Sistema ─────
    if ((stats.playerName||''). toUpperCase() === 'CHRISTOPHER' && stats.uuid === '00000000-spec-tral-0000-klickphantom0') {
        const light = typeof document !== 'undefined' && document.body && document.body.classList.contains('light-mode');
        return { title: "Divinidad", color: light ? "#0d1117" : "#ffffff", rgb: light ? "13,17,23" : "255,255,255", divinidad: true };
    }
    // ── Mítico ───────────────────────────────────────────────────────
    if (stats.totalScore >= 1200000 && stats.totalCorrect >= 5500 && stats.perfectGames >= 55 &&
        (stats.achievements||[]).length >= 280 && stats.maxStreak >= 45 && (stats.maxMult||1) >= 8 &&
        accuracy >= 85 && stats.gamesPlayed >= 320)
        return { title: "Mítico", color: "#ff9500", rgb: "255,149,0", mitico: true };
    // ── Eterno ───────────────────────────────────────────────────────
    if (stats.totalScore >= 700000 && stats.totalCorrect >= 3200 && stats.perfectGames >= 30 &&
        (stats.achievements||[]).length >= 160 && stats.maxStreak >= 35 && (stats.maxMult||1) >= 6 &&
        accuracy >= 78 && stats.gamesPlayed >= 200)
        return { title: "Eterno", color: "#6600ff", rgb: "102,0,255" };
    if (stats.totalScore >= 400000 && stats.totalCorrect >= 1800 && stats.perfectGames >= 15 && stats.gamesPlayed >= 120 && (stats.maxMult||1) >= 5 && stats.maxStreak >= 28 && accuracy >= 70 && (stats.achievements||[]).length >= 80) return { title: "Leyenda", color: "#b5179e", rgb: "181,23,158" };
    if (stats.totalScore >= 150000 && stats.totalCorrect >= 700 && stats.perfectGames >= 5 && stats.gamesPlayed >= 60 && (stats.maxMult||1) >= 4 && stats.maxStreak >= 20 && accuracy >= 65 && (stats.achievements||[]).length >= 30) return { title: "Maestro", color: "#ff2a5f", rgb: "255,42,95" };
    if (stats.totalScore >= 60000 && stats.totalCorrect >= 250 && stats.gamesPlayed >= 30 && (stats.maxMult||1) >= 3 && stats.maxStreak >= 10 && accuracy >= 60) return { title: "Pro", color: "#ffe566", rgb: "255,229,102" };
    if (stats.totalScore >= 20000 && stats.totalCorrect >= 75 && stats.gamesPlayed >= 10) return { title: "Junior", color: "#00d4ff", rgb: "0,212,255" };
    return { title: "Novato", color: "#00ff66", rgb: "0,255,102" };
}
let currentRankInfo = getRankInfo(playerStats);

let _achCheckPending = false;
let _deferAchTimer = 0;
function _deferredCheckAch() {
    clearTimeout(_deferAchTimer);
    _deferAchTimer = setTimeout(checkAchievements, 800);
}
function checkAchievements() {
    // Prevent re-entrant calls (e.g. unlock triggers another checkAchievements)
    if (_achCheckPending) return;
    _achCheckPending = true;
    try { _checkAchievementsImpl(); } finally { _achCheckPending = false; }
}
function _checkAchievementsImpl() {
    let newlyUnlocked = [];
    const achSet = new Set(playerStats.achievements);
    const unlock = (id) => { 
        if (!achSet.has(id)) { 
            achSet.add(id);
            playerStats.achievements.push(id); 
            const f = ACHIEVEMENTS_MAP.get(id); 
            if(f) newlyUnlocked.push(f); 
        } 
    };
    
    const normalAchs = playerStats.achievements.filter(id => ACHIEVEMENTS_MAP.has(id)).length;

    // META
    if (playerStats.nameChanges >= 1) unlock('m1'); if (playerStats.nameChanges >= 5) unlock('m2'); if (playerStats.nameChanges >= 20) unlock('m3');
    if (playerStats.achViews >= 1) unlock('m4'); if (playerStats.achViews >= 10) unlock('m5'); if (playerStats.achViews >= 50) unlock('m6');
    if ((playerStats.pinnedAchievements||[]).length > 0) unlock('m7'); 
    if (normalAchs >= 10) unlock('m8'); if (normalAchs >= 25) unlock('m9'); if (normalAchs >= 50) unlock('m10');
    // Colección maestra — escalera coherente con el total real de 300 logros
    if (normalAchs >= 75)  unlock('master1'); // Ambicioso
    if (normalAchs >= 100) unlock('master2'); // Centenario
    if (normalAchs >= 150) unlock('master4'); // Leyenda Total
    if (normalAchs >= 200) unlock('master5'); // A las Puertas
    if (normalAchs >= 300) unlock('master3'); // Dios Klick — todos
    // ── Pantalla de Rangos ──────────────────────────────────────────
    const rv2 = playerStats.ranksViews||0;
    if(rv2>=1) unlock('rk1'); if(rv2>=5) unlock('rk2'); if(rv2>=15) unlock('rk3');
    // ── Estadísticas extremas (Divinidad) ───────────────────────────
    if((playerStats.totalScore||0)>=2000000) unlock('div1');
    if((playerStats.totalCorrect||0)>=8000)  unlock('div2');
    if((playerStats.perfectGames||0)>=75)    unlock('div3');
    const kpClaimedChk = (getKpState().claimed||[]).length;

    // DÍAS (Consecutivos vs Totales)
    const days = playerStats.maxLoginStreak; 
    for(let i=0;i<5;i++) if(days>=daysTiers[i]) unlock(`d${i+1}`);
    const totalDays = playerStats.totalDaysPlayed || 0;
    for(let i=5;i<10;i++) if(totalDays>=daysTiers[i]) unlock(`d${i+1}`);

    // PARTIDAS
    const pts = playerStats.gamesPlayed; for(let i=0;i<8;i++) if(pts>=ptTiers[i]) unlock(`p${i+1}`);
    const tot = playerStats.totalScore; for(let i=0;i<8;i++) if(tot>=ptsTiers[i]) unlock(`pt${i+1}`);
    const hsc = playerStats.maxScoreCount; for(let i=0;i<8;i++) if(hsc>=hsCountTiers[i]) unlock(`hs${i+1}`);
    const fr = playerStats.frenziesTriggered; for(let i=0;i<8;i++) if(fr>=frTiers[i]) unlock(`r${i+1}`);
    const pf = playerStats.maxQuestionReached||0; for(let i=0;i<8;i++) if(pf>=pfTiers[i]) unlock(`pf${i+1}`);
    if(pf>=300) unlock('pf9'); if(pf>=400) unlock('pf10'); if(pf>=800) unlock('pf11');
    const sp = playerStats.fastAnswersTotal; for(let i=0;i<8;i++) if(sp>=spdTiers[i]) unlock(`sp${i+1}`);
    if(sp>=2000) unlock('sp9'); if(sp>=5000) unlock('sp10'); if(sp>=10000) unlock('sp11');
    const ac = playerStats.totalCorrect; for(let i=0;i<8;i++) if(ac>=acTiers[i]) unlock(`ac${i+1}`);
    const sk = playerStats.maxStreak; for(let i=0;i<8;i++) if(sk>=strkTiers[i]) unlock(`sk${i+1}`);
    const mx = playerStats.maxMult||1; for(let i=0;i<4;i++) if(mx>=multTiers[i]) unlock(`mx${i+1}`);
    const rv = playerStats.rankingViews||0; for(let i=0;i<5;i++) if(rv>=rankVisTiers[i]) unlock(`rv${i+1}`);
    const cv = playerStats.configViews||0; for(let i=0;i<4;i++) if(cv>=cfgVisTiers[i]) unlock(`cv${i+1}`);

    const nt = playerStats.maxNoTimeoutStreak||0; for(let i=0;i<5;i++) if(nt>=noTimoutTiers[i]) unlock(`nt${i+1}`);

    // ÚNICOS
    if (playerStats.totalWrong > 0) unlock('u1'); if (playerStats.totalWrong >= 75) unlock('u2'); 
    if (playerStats.totalTimeouts > 0) unlock('u3'); if (playerStats.totalTimeouts >= 35) unlock('u4'); 
    if (playerStats.todayGames >= 50) unlock('u22'); if ((playerStats.maxStreak||0) >= 35) unlock('u23');
    const rank = getRankInfo(playerStats).title; 
    // Logros de rango: solo usar el rango REAL de playerStats (stats guardadas).
    // NO proyectar con el score en curso para evitar otorgar logros de rango
    // que se revocarían si el jugador abandona o pierde antes de terminar la partida.
    const effectiveRank = rank;
    // Rank achievements: cada rango desbloquea todos los anteriores (escalera)
    if (effectiveRank==="Junior"||effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u_junior');
    if (effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u6'); 
    if (effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u7'); 
    if (effectiveRank==="Leyenda"||effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u8');
    if (effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u_eterno');
    // Títulos exclusivos de rango Eterno
    if (effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('et1');
    if ((effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") && normalAchs>=100) unlock('et2');
    if ((effectiveRank==="Eterno"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") && (playerStats.totalDaysPlayed||0)>=20) unlock('et3');
    if (effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u_mitico');
    // Títulos exclusivos de rango Mítico
    if (effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('mit1');
    if ((effectiveRank==="Mítico"||effectiveRank==="Divinidad") && (playerStats.gamesPlayed||0)>=320) unlock('mit2');
    if ((effectiveRank==="Mítico"||effectiveRank==="Divinidad") && normalAchs>=280) unlock('mit3');
    if (playerStats.clickedLogo) unlock('secret_logo');

    // RULETA
    const rlSpins = playerStats.rouletteSpins||0;
    if(rlSpins>=1) unlock('rl1');
    if(rlSpins>=10) unlock('rl6');
    if(rlSpins>=50) unlock('rl7');
    if((playerStats.rouletteLifeWins||0)>=1) unlock('rl2');
    if((playerStats.rouletteShieldWins||0)>=1) unlock('rl3');
    if((playerStats.rouletteBoostWins||0)>=1) unlock('rl4');
    if((playerStats.rouletteFrenzyWins||0)>=1) unlock('rl5');
    if((playerStats.rouletteLifeWins||0)>=3) unlock('rl8');
    if(playerStats.rouletteShieldUsed) unlock('rl9');
    if(playerStats.rouletteComboSpecial) unlock('rl10');

    // KLICK PASS
    const kpClaimed = (getKpState().claimed || []).length;
    if ((playerStats.kpViews||0) >= 1)                          unlock('kpa6');
    if (kpClaimed >= 1)                                          unlock('kpa1');
    if ((playerStats.kpClaimDays||[]).length >= 3)              unlock('kpa7');
    if (kpClaimed >= 25)                                         unlock('kpa2');
    if ((playerStats.kpClaimDays||[]).length >= 7)              unlock('kpa8');
    if ((playerStats.kpClaimDays||[]).length >= 15)             unlock('kpa9');
    if (kpClaimed >= 50)                                         unlock('kpa3');
    if (kpClaimed >= 75)                                         unlock('kpa4');
    if (kpClaimed >= 100)                                        unlock('kpa5');
    if (kpClaimed >= 100 && normalAchs >= 300)                  unlock('kpa10');

    // ESCALABLES GENERALES
    const wr = playerStats.totalWrong||0; for(let i=0;i<5;i++) if(wr>=wrnTiers[i]) unlock(`wr${i+1}`);
    const to = playerStats.totalTimeouts||0; for(let i=0;i<5;i++) if(to>=toTiers[i]) unlock(`to${i+1}`);
    const td = playerStats.todayGames||0; for(let i=0;i<5;i++) if(td>=todayTiers[i]) unlock(`td${i+1}`);

    // CLASIFICACIÓN
    const pl = playerStats.powerLevel||0; 
    if(pl>=10000) unlock('nm8'); if(pl>=100000) unlock('nm9'); if(pl>=1000000) unlock('nm10');
    const rp = playerStats.rankingPosition||999;
    if(rp < 999) unlock('nm1'); // apareció en el ranking (cualquier posición)
    if(rp<=10) unlock('nm2'); if(rp<=3) unlock('nm3'); if(rp===1) unlock('nm4');

    // PODIO LEYENDA (solo top 1-3 Y rango Leyenda o superior)
    // rank ya calculado arriba — no necesita segunda llamada
    if(rp===1 && (rank==='Leyenda'||rank==='Eterno'||rank==='Mítico'||rank==='Divinidad')) unlock('pod1');
    if(rp===2 && (rank==='Leyenda'||rank==='Eterno'||rank==='Mítico'||rank==='Divinidad')) unlock('pod2');
    if(rp===3 && (rank==='Leyenda'||rank==='Eterno'||rank==='Mítico'||rank==='Divinidad')) unlock('pod3');

    // MULTIPLICADORES x6-x10
    if(mx>=5 && (playerStats.gamesPlayed||0)>=30) unlock('mx5');
    if(mx>=6) unlock('mx6'); if(mx>=7) unlock('mx7'); if(mx>=8) unlock('mx8'); if(mx>=9) unlock('mx9'); if(mx>=10) unlock('mx10');

    // PISTAS MUSICALES
    if((playerStats.trackSwitches||0)>=1) unlock('trk1');
    if(playerStats.triedAllTracks) unlock('trk2');
    if((playerStats.sameTrackGames||0)>=10) unlock('trk3');

    // CONFIG Y UI
    if(playerStats.musicSetTo0) unlock('cfg1');
    if(playerStats.musicAt100) unlock('cfg2');
    if(playerStats.musicSetTo0 && playerStats.sfxSetTo0) unlock('cfg3');
    if((playerStats.fpsChanges||0)>=5) unlock('cfg4');
    if(playerStats.maxFps===240) unlock('cfg5');
    if(playerStats.maxFps===15) unlock('cfg6');
    if(playerStats.particles0) unlock('cfg7');
    if(playerStats.musicAt100 && playerStats.particles100) unlock('cfg8');
    if(playerStats.usedLightMode) unlock('cfg9');
    if(playerStats.switchedLightToDark) unlock('cfg10');
    if(playerStats.allSectionsVisited) unlock('ui1');
    if(playerStats.nameChanges>=1 && playerStats.gamesPlayed>=1) unlock('ui7');

    const pvv = playerStats.profileViews||0; for(let i=0;i<5;i++) if(pvv>=profileVisTiers[i]) unlock(`pv${i+1}`);
    const retv = playerStats.totalDaysPlayed||0; const retTiers2=[3,8,20,40,75]; for(let i=0;i<5;i++) if(retv>=retTiers2[i]) unlock(`ret${i+1}`);

    const bsv = playerStats.bestScore||0; for(let i=0;i<8;i++) if(bsv>=bestScoreTiers[i]) unlock(`bs${i+1}`);
    const fts = playerStats.maxFrenzyStreak||0; for(let i=0;i<5;i++) if(fts>=frenzyTimeTiers[i]) unlock(`ft${i+1}`);

    // ÚNICOS EXTRA
    if(playerStats.gamesPlayed>=1) unlock('x3');
    if(playerStats.gamesPlayed>=1 || playerStats.maxLoginStreak>=1) unlock('x1');
    if(playerStats.gamesPlayed>=150) unlock('x17');
    if(playerStats.nameChanges===0 && playerStats.maxLoginStreak>=30) unlock('x18');
    if((rank==='Eterno'||rank==='Mítico'||rank==='Divinidad') && normalAchs>=160) unlock('fin5');
    if(days>=7 && (rank==='Junior'||rank==='Pro'||rank==='Maestro'||rank==='Leyenda'||rank==='Eterno'||rank==='Mítico'||rank==='Divinidad')) unlock('fin4');
    if((playerStats.frenziesTriggered||0)>=15) unlock('u16');
    // u9 Inmortal: handled in-game via inGameUnlock (line ~4420)
    // u24 Extremis: 3 last-second answers in single game
    if((playerStats.extremisCount||0)>=1) unlock('u24');
    // ui5 El Perfil Importa: visit profile after each of first 5 games
    if((playerStats.profileViewedAfterGames||0)>=5) unlock('ui5');
    // nm5 Vigilia: rank up in 3 consecutive days (tracked via rankUpDays)
    if((playerStats.consecutiveRankUpDays||0)>=3) unlock('nm5');
    // nm6 Impostado, nm7 Remontada — tracked in game
    if(playerStats.surpassedHighPLPlayer) unlock('nm6');
    if(playerStats.rankRemontada) unlock('nm7');

    // --- LOGROS EXTRA ---
    // extra1 Doble Frenesí: tracked in-game via frenziesThisGame persisted stat
    if((playerStats.maxFrenziesInGame||0)>=2) unlock('extra1');
    // extra2 Precisionista: partida con 100% precision min 5 respuestas
    if(playerStats.hadPerfectAccuracyGame) unlock('extra2');
    // extra3 Maratonista: 80+ preguntas en una partida
    if((playerStats.maxQuestionReached||0)>=80) unlock('extra3');
    // extra4 Silencioso: 5 partidas con música en 0
    if((playerStats.gamesAtMusicZero||0)>=5) unlock('extra4');
    // extra5 Día Épico: 15 logros en un día
    if((playerStats.dailyAchUnlocks||0)>=15) unlock('extra5');

    if(playerStats.playedNocturno) unlock('fin1');
    if(playerStats.playedMadrugador) unlock('fin2');

    // LOGROS CON CONDICIÓN DE PUNTAJE (nunca imposibles — se verifican con bestScore)
    if(playerStats.doubleVictory) unlock('x4');
    if(playerStats.consistent5Games) unlock('x6');
    if(playerStats.fastStart3k) unlock('x7');
    if(playerStats.firstGameOfDay50k) unlock('x12');
    if((playerStats.bestScore||0)>=99500 && (playerStats.bestScore||0)<=100500) unlock('x15');
    if(playerStats.hitExactly100k) unlock('x15');

    // LA REVANCHA y SIN PRISA (rastreados por partida)
    if(playerStats.revengeGame) unlock('x5');
    if(playerStats.xSinPrisa) unlock('x8');

    // PARTIDAS POR DÍA
    if((playerStats.todayGames||0)>=10) unlock('x13');

    // SUPERVIVENCIA / VIDAS
    // x14: Invicto (pregunta 30 sin perder vida) — rastreado in-game via inGameUnlock; también revisar aquí por si se ganó y no se guardó
    if((playerStats.maxQuestionReached||0)>=30 && (playerStats.invictoEarned||false)) unlock('x14');
    // x10: Economía (20 preguntas sin perder vida) — in-game via inGameUnlock
    if((playerStats.x10Earned||false)) unlock('x10');
    if((playerStats.maxQuestionReached||0)>=120) unlock('u15');
    if((playerStats.maxQuestionReached||0)>=59) unlock('np3');  // 60 preguntas = índice 59

    // VELOCIDAD Y REFLEJOS (por partida — tracked via persisted stats)
    if((playerStats.flashAnswersTotal||0)>=1) unlock('u13');
    // x19: Espectacular — requiere 5 flashes en UNA partida (gestionado por inGameUnlock + flag)
    if(playerStats.flashInOneGame) unlock('x19');
    if((playerStats.lastSecondAnswersTotal||0)>=50) unlock('u17');

    // u_bisturi: 90%+ accuracy with at least 500 total answers
    const _bTotalAns = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
    const _bAcc = _bTotalAns >= 500 ? (playerStats.totalCorrect||0) / _bTotalAns : 0;
    if (_bAcc >= 0.90) unlock('u_bisturi');

    // CURADOR: pin tracking
    const pinTot = playerStats.totalPins||0;
    const pinTiers2=[1,5,10,20,50]; for(let i=0;i<5;i++) if(pinTot>=pinTiers2[i]) unlock(`pin${i+1}`);

    // PRODUCTIVO: daily achievement unlocks (tracked separately)
    const dau = playerStats.dailyAchUnlocks||0;
    const daTiers2=[1,3,5,8,12]; for(let i=0;i<5;i++) if(dau>=daTiers2[i]) unlock(`da${i+1}`);

    // ASIDUO (td2): same as totalDaysPlayed, was duplicate — now use separate threshold
    const td2Tiers=[7,12,18,25,45]; for(let i=0;i<5;i++) if((playerStats.totalDaysPlayed||0)>=td2Tiers[i]) unlock(`td2${i+1}`);

    // REGRESO TRIUNFAL
    if((playerStats.returnTriumph||0)>=1) unlock('x16');
    // FÉNIX y RESURRECCIÓN (rastreados en saveGameStats)
    if(playerStats.fenixEarned) unlock('u11');
    if(playerStats.u19PersistEarned) unlock('u19');

    // MODO PERFECCIÓN
    let redGoldCount = 0;
    playerStats.pinnedAchievements.forEach(id => {
        const ach = ACHIEVEMENTS_MAP.get(id);
        if (ach && (ach.color === colors.red || ach.color === colors.yellow || ach.color === colors.orange)) redGoldCount++;
    });
    if (redGoldCount >= 3) unlock('np2');

    // ─── Precisión global 95% ─────────────────────────────────────────
    const _p1Tot = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
    // ─── El Arquitecto (CHRISTOPHER) ────────────────────────────────────
    // El Arquitecto (cx1-cx4): todos basados en christopherCardViews (click real en tarjeta)
    const _cxv = playerStats.christopherCardViews||0;
    if (_cxv >= 1)  unlock('cx1');
    if (_cxv >= 3)  unlock('cx2');
    if (_cxv >= 10) unlock('cx3');
    if (_cxv >= 25) unlock('cx4');

    if (newlyUnlocked.length > 0) { 
        // Track daily achievement unlocks para da1-da5 y extra5 "Día Épico"
        // Solo contar si estamos en el mismo día de login (evitar acumulación entre sesiones)
        const _todayStr = new Date().toISOString().split('T')[0];
        if (playerStats.lastLoginDate === _todayStr) {
            playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + newlyUnlocked.length;
        }
        saveStatsDebounced(); // no bloquear el hilo durante la partida
        // Refresh parcial: solo las filas afectadas para evitar full flush durante partida
        if (_vsInitialized) {
            _vsAchSet = new Set(playerStats.achievements);
            _vsDisplayPin = getAutoProfileAchs();
            _vsRefreshRows(newlyUnlocked.map(a => a.id));
            const progEl = document.getElementById('achievements-progress-text');
            if (progEl) progEl.innerText = `Desbloqueados: ${[...(_vsAchSet)].filter(id => ACHIEVEMENTS_MAP.has(id)).length} / ${ACHIEVEMENTS_DATA.length}`;
        } else {
            renderAchievements();
        }
        newlyUnlocked.forEach((ach, index) => {
            setTimeout(() => {
                try { initAudio(); } catch(e) {}
                SFX.achievement();
                showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon);
            }, index * 600);
        });
    }
}

function togglePin(achId) {
    const _isAdminPin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    // Admin puede fijar cualquier logro del banco; el resto solo puede fijar logros desbloqueados
    if (!_isAdminPin && !playerStats.achievements.includes(achId)) return;
    SFX.click(); const index = playerStats.pinnedAchievements.indexOf(achId);
    if (index > -1) { playerStats.pinnedAchievements.splice(index, 1); showToast('Quitado del perfil', 'Ya no aparecerá destacado.', 'var(--text-secondary)', SVG_PIN); } 
    else { if (playerStats.pinnedAchievements.length >= 3) { showToast('Límite', 'Máximo 3 fijados', 'var(--accent-red)', SVG_INCORRECT); return; } playerStats.pinnedAchievements.push(achId); playerStats.totalPins = (playerStats.totalPins||0) + 1; const ach_data = ACHIEVEMENTS_MAP.get(achId); showToast('Fijado en Perfil', ach_data ? ach_data.title : achId, ach_data ? ach_data.color : '', ach_data ? ach_data.icon : ''); }
    saveStatsLocally(); checkAchievements(); renderAchievements(); submitLeaderboard();
}

// togglePin y revokeInvalidAchievements usan el virtual scroller automáticamente

// Rarity score: how exclusive/rare is each achievement (higher = rarer)
// ── Rarity score for auto-profile fill ──────────────────────────────────
const RARITY_SCORE = {master3:100,master5:98,master4:96,master2:91,master1:86,mit3:95,mit2:90,mit1:88,u_eterno:85,fin5:83,u8:81,u7:79,u15:76,nm4:74,nm3:71,nm10:69,u9:66,u23:63,u11:61,u16:59,nm9:56,u19:53,u24:51,np1:49,np3:47,u21:44,u_bisturi:42};
function getAchRarity(id) { return RARITY_SCORE[id] || 10; }

function getAutoProfileAchs() {
    const result = [];
    const isAdmin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    playerStats.pinnedAchievements
        
        .forEach(id => {
            // Admin: mostrar cualquier logro fijado aunque no esté en achievements[]
            // Resto: solo mostrar fijados que estén desbloqueados
            if (result.length < 3 && (isAdmin || playerStats.achievements.includes(id))) result.push(id);
        });
    if (result.length < 3) {
        const rest = playerStats.achievements
            .filter(id => !result.includes(id))
            .sort((a,b) => getAchRarity(b) - getAchRarity(a));
        rest.forEach(id => { if (result.length < 3) result.push(id); });
    }
    return result;
}

// ══════════════════════════════════════════════════════════════════
//  VIRTUAL SCROLLER — solo renderiza las tarjetas visibles en pantalla
//  Elimina el lag al hacer scroll por los 283 logros.
// ══════════════════════════════════════════════════════════════════
const CARD_HEIGHT   = 148;  // px — debe coincidir con el CSS
const CARD_GAP      = 12;   // px gap entre cards
const ROW_PAD_PX    = 15;   // padding lateral del contenedor
const OVERSCAN_ROWS = 4;    // filas extra arriba/abajo para suavidad (más en gama baja)

let _vsColCount   = 2;      // columnas actuales (se recalcula)
let _vsRowHeight  = CARD_HEIGHT + CARD_GAP;
let _vsRendered   = new Map(); // rowIndex -> DOM row element
let _vsAchSet     = null;   // Set live de logros desbloqueados
let _vsPinned     = [];
let _vsDisplayPin = [];
let _vsScrollEl   = null;
let _vsSpacerEl   = null;
let _vsContentEl  = null;
let _vsInitialized = false;
let _vsScrollRAF  = null;

function _vsGetCols() {
    const w = window.innerWidth;
    if (w >= 1500) return 6;
    if (w >= 1200) return 5;
    if (w >= 900)  return 4;
    if (w >= 600)  return 3;
    return 2;
}

function _vsCardHTML(ach, isUnlocked, isManualPin, isInProfile) {
    let cls = 'ach-card';
    if (isUnlocked)   cls += ' unlocked';
    if (isManualPin)  cls += ' pinned';
    else if (isInProfile) cls += ' in-profile';
    if (ach.id === 'u_mitico')    cls += ' ach-mitico';
    // Logros especiales: animación propia cuando están desbloqueados
    if (isUnlocked && ach.id === 'u8')          cls += ' ach-leyenda';

    const isLight = document.body.classList.contains('light-mode');
    // Admin (CHRISTOPHER): forzar color Divinidad en todos los logros
    const _isAdminAch = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    const divinityColor = isLight ? '#0d1117' : '#ffffff';
    const achColor = _isAdminAch && isUnlocked ? divinityColor : ach.color;

    const displayColor = isUnlocked ? (isLight && !_isAdminAch ? darkenHex(ach.color, 0.4) : achColor) : '';
    const bdrColor = isUnlocked ? (isLight && !_isAdminAch ? 'rgba(0,0,0,0.2)' : achColor) : '';
    let shadow = '';
    if (!isLight) {
        if (isManualPin)       shadow = `0 0 14px ${achColor}66`;
        else if (isInProfile)  shadow = `0 0 7px ${achColor}33`;
    }

    let badge = '';
    if (isManualPin)      badge = `<div class="ach-pin-badge ach-pin-manual">${SVG_PIN}</div>`;
    else if (isInProfile) badge = `<div class="ach-pin-badge ach-pin-auto">*</div>`;

    const isHidden = ach.hidden && !isUnlocked;
    const iconColor = isUnlocked ? (isLight && !_isAdminAch ? darkenHex(ach.color, 0.4) : achColor) : 'var(--text-secondary)';
    const iconSVG   = isUnlocked ? ach.icon  : SVG_LOCK;
    const title     = isHidden ? '???' : ach.title;
    const desc      = isUnlocked ? ach.desc  : (isHidden ? 'Logro secreto — descúbrelo tú mismo.' : 'Sigue jugando para descubrirlo.');

    return `<div class="${cls}" style="border-color:${bdrColor};box-shadow:${shadow}" onclick="togglePin('${ach.id}')">`+
        badge +
        `<div class="ach-icon" style="color:${iconColor}">${iconSVG}</div>`+
        `<div class="ach-title">${title}</div>`+
        `<div class="ach-desc">${desc}</div>`+
        `</div>`;
}

function _vsRenderRow(rowIdx) {
    if (_vsRendered.has(rowIdx)) return;
    const cols   = _vsColCount;
    const start  = rowIdx * cols;
    const end    = Math.min(start + cols, ACHIEVEMENTS_DATA.length);
    if (start >= ACHIEVEMENTS_DATA.length) return;

    const rowEl = document.createElement('div');
    rowEl.className = 'ach-vrow';
    rowEl.style.cssText = `position:absolute;left:${ROW_PAD_PX}px;right:${ROW_PAD_PX}px;top:${rowIdx * _vsRowHeight}px;grid-template-columns:repeat(${cols},1fr);`;

    let html = '';
    for (let i = start; i < end; i++) {
        const ach         = ACHIEVEMENTS_DATA[i];
        const isUnlocked  = _vsAchSet.has(ach.id);
        const isManualPin = _vsPinned.includes(ach.id);
        const isInProfile = _vsDisplayPin.includes(ach.id);
        html += _vsCardHTML(ach, isUnlocked, isManualPin, isInProfile);
    }
    rowEl.innerHTML = html;
    _vsContentEl.appendChild(rowEl);
    _vsRendered.set(rowIdx, rowEl);
}

function _vsRemoveRow(rowIdx) {
    const el = _vsRendered.get(rowIdx);
    if (el) { el.remove(); _vsRendered.delete(rowIdx); }
}

function _vsOnScroll() {
    if (_vsScrollRAF) cancelAnimationFrame(_vsScrollRAF);
    _vsScrollRAF = requestAnimationFrame(() => {
        _vsScrollRAF = null;
        _vsUpdate();
    });
}

function _vsUpdate() {
    if (!_vsScrollEl || !_vsSpacerEl) return;
    const scrollTop    = _vsScrollEl.scrollTop;
    const viewHeight   = _vsScrollEl.clientHeight;
    const totalRows    = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount);

    const firstRow = Math.max(0, Math.floor(scrollTop / _vsRowHeight) - OVERSCAN_ROWS);
    const lastRow  = Math.min(totalRows - 1, Math.ceil((scrollTop + viewHeight) / _vsRowHeight) + OVERSCAN_ROWS);

    // Remove rows that scrolled out
    for (const [idx] of _vsRendered) {
        if (idx < firstRow || idx > lastRow) _vsRemoveRow(idx);
    }
    // Add rows that scrolled in
    for (let r = firstRow; r <= lastRow; r++) _vsRenderRow(r);
}

// Actualiza solo las filas que contienen los logros con ids en `changedIds` (sin full flush)
function _vsRefreshRows(changedIds) {
    if (!_vsInitialized || !changedIds || changedIds.length === 0) return;
    const cols = _vsColCount;
    const rowsToRefresh = new Set();
    for (const id of changedIds) {
        const idx = ACHIEVEMENTS_INDEX.has(id) ? ACHIEVEMENTS_INDEX.get(id) : -1;
        if (idx >= 0) rowsToRefresh.add(Math.floor(idx / cols));
    }
    for (const rowIdx of rowsToRefresh) {
        _vsRemoveRow(rowIdx);
        _vsRenderRow(rowIdx);
    }
}

function _vsRefreshAll() {
    // Cancelar RAF de scroll pendiente para evitar re-render de filas ya eliminadas
    if (_vsScrollRAF) { cancelAnimationFrame(_vsScrollRAF); _vsScrollRAF = null; }
    // Flush all rendered rows and re-render visible ones
    for (const [, el] of _vsRendered) el.remove();
    _vsRendered.clear();
    _vsUpdate();
}

function _vsSetup() {
    _vsScrollEl  = document.getElementById('vscroll-container');
    _vsSpacerEl  = document.getElementById('vscroll-spacer');
    _vsContentEl = document.getElementById('vscroll-content');
    if (!_vsScrollEl) return;

    _vsScrollEl.addEventListener('scroll', _vsOnScroll, { passive: true });
    window.addEventListener('resize', () => {
        const newCols = _vsGetCols();
        if (newCols !== _vsColCount) {
            _vsColCount = newCols;
            const totalRows = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount);
            const totalH    = totalRows * _vsRowHeight;
            _vsSpacerEl.style.height = totalH + 'px';
            _vsRefreshAll();
        }
    });
    _vsInitialized = true;
}

// Actualiza el estado y dispara re-render de filas afectadas
function renderAchievements() {
    if (!_vsInitialized) _vsSetup();
    if (!_vsScrollEl)    return;

    _vsAchSet    = new Set(playerStats.achievements);
    _vsPinned    = playerStats.pinnedAchievements;
    _vsDisplayPin = getAutoProfileAchs();
    _vsColCount  = _vsGetCols();

    const totalRows = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount);
    const totalH    = totalRows * _vsRowHeight;
    _vsSpacerEl.style.height = totalH + 'px';

    // Flush rendered rows so they rebuild with fresh state
    _vsRefreshAll();

    // Profile grid (solo 3 slots)
    const profileGrid = document.getElementById('profile-achievements-grid');
    if (profileGrid) {
        profileGrid.innerHTML = '';
        const frag = document.createDocumentFragment();
        let n = 0;
        const _isAdminLocal = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
        const isLight = document.body.classList.contains('light-mode');
        const divColor  = isLight ? '#0d1117' : '#ffffff';
        const divBorder = isLight ? 'rgba(13,17,23,0.35)' : 'rgba(255,255,255,0.35)';
        const divShadow = isLight ? 'none' : '0 0 12px rgba(255,255,255,0.18)';
        _vsDisplayPin.forEach(id => {
            if (n >= 3) return;
            let ach = ACHIEVEMENTS_MAP.get(id);
            if (!ach) return;
            const slot = document.createElement('div');
            slot.className = 'achievement-slot unlocked';
            if (_isAdminLocal) {
                slot.style.borderColor = divBorder;
                slot.style.boxShadow   = divShadow;
                slot.innerHTML = `<div class="ach-icon" style="color:${divColor}">${ach.icon}</div><div class="ach-title" style="color:${divColor}">${ach.title}</div>`;
            } else {
                const achDisplayColor = isLight ? darkenHex(ach.color, 0.4) : ach.color;
                slot.style.borderColor = isLight ? 'rgba(0,0,0,0.2)' : ach.color;
                slot.style.boxShadow = isLight ? 'none' : `0 0 12px ${ach.color}44`;
                slot.innerHTML = `<div class="ach-icon" style="color:${achDisplayColor}">${ach.icon}</div><div class="ach-title" style="color:${achDisplayColor}">${ach.title}</div>`;
            }
            frag.appendChild(slot); n++;
        });
        while (n < 3) {
            const slot = document.createElement('div');
            slot.className = 'achievement-slot';
            slot.innerHTML = `<div class="ach-icon" style="color:var(--text-secondary);opacity:0.4">${SVG_LOCK}</div><div class="ach-title" style="color:var(--text-secondary);opacity:0.5;font-size:0.7rem;">Sin fijar</div>`;
            frag.appendChild(slot); n++;
        }
        profileGrid.appendChild(frag);
    }

    const el = document.getElementById('achievements-progress-text');
    if (el) el.innerText = `Desbloqueados: ${[...(_vsAchSet)].filter(id => ACHIEVEMENTS_MAP.has(id)).length} / ${ACHIEVEMENTS_DATA.length}`;
}

// initializeAchievementsDOM y achCardElements ya no son necesarios con el virtual scroller
let isAchievementsInitialized = true; // siempre true, setup es lazy
const achCardElements = {};           // mantenido vacío para compatibilidad con código existente
let _currentScreen = null;
// ── Anti-glitch: protección contra aperturas/cierres rápidos de pantallas ──
let _screenTransitioning = false;
let _screenTransitionTimer = null;
const _SCREEN_TRANSITION_LOCK_MS = 120; // ms mínimos entre transiciones

function _releaseScreenLock() {
    _screenTransitioning = false;
    _screenTransitionTimer = null;
}

// ── Helper: activar lock de transición para navegación iniciada por usuario ──
function _lockUserNav() {
    _screenTransitioning = true;
    if (_screenTransitionTimer) clearTimeout(_screenTransitionTimer);
    _screenTransitionTimer = setTimeout(_releaseScreenLock, 350);
}

function switchScreen(id) {
    // Anti-glitch: ignorar si ya estamos en esa pantalla
    if (_currentScreen && _currentScreen.id === id) return;

    // Parar el poll del ranking si salimos de él
    if (id !== 'ranking-screen') _stopRankingPoll();
    if (_currentScreen) {
        // Si salimos de feedback-screen, limpiar clases de estado para evitar que persistan
        if (_currentScreen.id === 'feedback-screen') {
            _currentScreen.className = 'screen';
        }
        _currentScreen.classList.remove('active');
    }
    const next = document.getElementById(id);
    // Slightly longer delay on iOS to allow Safari layout to settle
    const delay = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 60 : 16;

    _screenTransitionTimer = setTimeout(() => {
        if (next) { next.classList.add('active'); _currentScreen = next; }
        _screenTransitionTimer = null;
    }, delay);
}
// Initialize current screen
_currentScreen = document.querySelector('.screen.active');
// --- SISTEMA DE TEMA (CLARO / OSCURO) ---
function setTheme(theme) {
    const previousTheme = playerStats.theme || 'dark';
    if (theme === previousTheme) return; // ya está aplicado
    playerStats.theme = theme;
    if (theme === 'light') {
        playerStats.usedLightMode = true;
    }
    // "Vuelta a Casa" — only unlocks when switching FROM light TO dark
    if (theme === 'dark' && previousTheme === 'light') {
        playerStats.switchedLightToDark = true;
    }
    saveStatsLocally();
    checkAchievements();

    // Aplicar clase de forma síncrona para que el navegador pinte en el mismo frame
    if (theme === 'light') {
        document.documentElement.classList.add('light-mode');
        document.body.classList.add('light-mode');
    } else {
        document.documentElement.classList.remove('light-mode');
        document.body.classList.remove('light-mode');
    }

    // Actualizar CSS vars de rango según el nuevo tema
    currentRankInfo = getRankInfo(playerStats);
    document.documentElement.style.setProperty('--rank-color', currentRankInfo.color);
    document.documentElement.style.setProperty('--rank-rgb',   currentRankInfo.rgb);

    // Sincronizar favicon y meta-theme-color
    updateLogoDots();

    // Update buttons appearance
    const darkBtn = document.getElementById('theme-dark-btn');
    const lightBtn = document.getElementById('theme-light-btn');
    if (darkBtn && lightBtn) {
        if (theme === 'dark') {
            darkBtn.style.borderColor = 'rgba(255,255,255,0.5)';
            darkBtn.style.background = 'rgba(255,255,255,0.07)';
            darkBtn.firstElementChild.style.color = 'var(--text-primary)';
            lightBtn.style.borderColor = 'rgba(255,255,255,0.1)';
            lightBtn.style.background = 'transparent';
            lightBtn.firstElementChild.style.color = 'var(--text-secondary)';
        } else {
            lightBtn.style.borderColor = 'rgba(0,0,0,0.4)';
            lightBtn.style.background = 'rgba(0,0,0,0.05)';
            lightBtn.firstElementChild.style.color = 'var(--text-primary)';
            darkBtn.style.borderColor = 'rgba(0,0,0,0.1)';
            darkBtn.style.background = 'transparent';
            darkBtn.firstElementChild.style.color = 'var(--text-secondary)';
        }
    }
    const valTheme = document.getElementById('val-theme');
    if (valTheme) valTheme.innerText = theme === 'light' ? 'Claro' : 'Oscuro';

    // Forzar re-render de logros y rankings que usan colores dependientes del tema
    if (_vsInitialized) _vsRefreshAll();

    SFX.click();
}

// Apply saved theme on load — sync both html and body for coherence
if (playerStats.theme === 'light') {
    document.body.classList.add('light-mode');
    document.documentElement.classList.add('light-mode');
    document.documentElement.style.background = ''; // limpiar el bg inline del anti-flash
} else {
    document.documentElement.classList.remove('light-mode');
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE CALIDAD VISUAL — 4 modos: max / normal / perf / custom
// ─────────────────────────────────────────────────────────────────────────────

// Definición de cada modo: valores que se aplican a los sliders visibles
// y flags internos que ajustan el motor de partículas.
const QUALITY_PRESETS = {
    max:    { fps: 240, particles: 1.0, musicVol: 1.0, sfxVol: 1.0, bodyClass: 'quality-max',  label: 'Máximo',       desc: 'Cristalix · Glows máximos · 240 FPS · Todo al máximo' },
    normal: { fps: 60,  particles: 1.0, musicVol: 1.0, sfxVol: 1.0, bodyClass: '',              label: 'Normal',       desc: '60 FPS · Blur estándar · Configuración de equilibrio' },
    perf:   { fps: 30,  particles: 0.15, musicVol: 1.0, sfxVol: 1.0, bodyClass: 'quality-perf', label: 'Rendimiento',  desc: 'Sin blur · Sin glows · Sin conexiones · 30 FPS · Máximo ahorro' },
    custom: { fps: null, particles: null, musicVol: null, sfxVol: null, bodyClass: '',           label: 'Personalizado',desc: 'Valores ajustados manualmente' }
};

function _applyQualityBodyClasses(mode) {
    document.body.classList.remove('quality-max', 'quality-perf');
    const cls = QUALITY_PRESETS[mode] && QUALITY_PRESETS[mode].bodyClass;
    if (cls) document.body.classList.add(cls);
}

function _syncQualityButtons(mode, isLight) {
    const ids = { max: 'q-max', normal: 'q-normal', perf: 'q-perf', custom: 'q-custom' };

    Object.keys(ids).forEach(k => {
        const btn = document.getElementById(ids[k]);
        if (!btn) return;
        const active = (k === mode);
        btn.classList.toggle('active', active);
    });

    const preset = QUALITY_PRESETS[mode] || QUALITY_PRESETS.normal;
    const valEl  = document.getElementById('val-perf');
    const descEl = document.getElementById('perf-desc');
    if (valEl)  valEl.innerText  = preset.label;
    if (descEl) descEl.innerText = preset.desc;
}

function setQualityMode(mode, silent) {
    if (!QUALITY_PRESETS[mode]) mode = 'normal';

    // Custom mode only stores the label — does not change any values
    if (mode !== 'custom') {
        const preset = QUALITY_PRESETS[mode];

        // Guard: previene que los listeners de sliders detecten estos cambios
        // programáticos como interacción manual y reviertan el modo a 'custom'.
        window._kPreset = true;

        // Apply FPS
        playerStats.maxFps = preset.fps;
        fpsInterval = 1000 / playerStats.maxFps;
        _smoothDelta = fpsInterval;
        const fpsSlider = document.getElementById('op-fps');
        const fpsLabel  = document.getElementById('val-fps');
        if (fpsSlider) fpsSlider.value = FPS_VALUES.indexOf(preset.fps) >= 0 ? FPS_VALUES.indexOf(preset.fps) : 2;
        if (fpsLabel)  fpsLabel.innerText = preset.fps + ' FPS';

        // Apply particles opacity
        playerStats.particleOpacity = preset.particles;
        const pSlider = document.getElementById('op-particles');
        const pLabel  = document.getElementById('val-particles');
        if (pSlider) pSlider.value = preset.particles;
        if (pLabel)  pLabel.innerText = Math.round(preset.particles * 100) + '%';

        // Apply musicVol and sfxVol if preset defines them
        if (preset.musicVol !== null) {
            playerStats.musicVol = preset.musicVol;
            const mSlider = document.getElementById('op-music');
            const mLabel  = document.getElementById('val-music');
            if (mSlider) mSlider.value = preset.musicVol;
            if (mLabel)  mLabel.innerText = Math.round(preset.musicVol * 100) + '%';
            updateVolumes();
        }
        if (preset.sfxVol !== null) {
            playerStats.sfxVol = preset.sfxVol;
            const sSlider = document.getElementById('op-sfx');
            const sLabel  = document.getElementById('val-sfx');
            if (sSlider) sSlider.value = preset.sfxVol;
            if (sLabel)  sLabel.innerText = Math.round(preset.sfxVol * 100) + '%';
            updateVolumes();
        }

        // Levantar guard en el siguiente tick: los eventos 'change' de iOS se despachan
        // de forma asíncrona tras el cambio de .value, así que un setTimeout(0) garantiza
        // que ya se hayan procesado antes de permitir cambios manuales de nuevo.
        setTimeout(() => { window._kPreset = false; }, 0);

        // No se reinician las partículas al cambiar de modo:
        // el loop existente ya lee qualityMode cada frame y ajusta
        // velocidad, conexiones y opacidad al vuelo.
        // Solo reseteamos el timer para evitar un burst de frames acumulados.
        then = performance.now();
        _smoothDelta = fpsInterval;

        // Aplicar body classes — inmediato, sin retardo
        _applyQualityBodyClasses(mode);
    }

    playerStats.qualityMode = mode;
    saveStatsLocally();
    _syncQualityButtons(mode, (playerStats.theme || 'dark') === 'light');
    if (!silent) SFX.click();
}

// When the user manually moves any slider, switch to custom mode
function _onManualSliderChange() {
    if (playerStats.qualityMode && playerStats.qualityMode !== 'custom') {
        playerStats.qualityMode = 'custom';
        _syncQualityButtons('custom', (playerStats.theme || 'dark') === 'light');
        saveStatsLocally();
    }
}

// Apply saved quality mode on load
(function _applyQualityOnLoad() {
    const saved = playerStats.qualityMode || 'normal';
    // Re-apply body classes without touching sliders (values already loaded from playerStats)
    _applyQualityBodyClasses(saved === 'custom' ? 'normal' : saved);
    // Custom mode: keep saved slider values, just apply label
    playerStats.qualityMode = saved;
})();


// ══════════════════════════════════════════════════════════
//  RULETA DE RECOMPENSAS — cada 10 aciertos (no consecutivos)
// ══════════════════════════════════════════════════════════
// ── RULETA: 10 elementos únicos, sin repeticiones, lógica simple ──────────
// Pesos: cuanto mayor, más probable. Recompensas aplicadas en collectRoulettePrize().
const ROULETTE_PRIZES = [
    { id: 'life',    label: 'VIDA EXTRA',   short: '+VIDA',   color: '#ff2a5f', rarity: 'Legendario', weight: 8,  desc: 'Recuperas una vida perdida.' },
    { id: 'frenzy',  label: 'FRENESÍ',      short: 'FRENESÍ', color: '#b5179e', rarity: 'Épico',      weight: 10, desc: 'Activa el Modo Frenesí inmediatamente.' },
    { id: 'jackpot', label: 'JACKPOT x4',   short: 'x4 PTS',  color: '#ff0090', rarity: 'Épico',      weight: 10, desc: 'La próxima pregunta vale x4 puntos.' },
    { id: 'shield',  label: 'ESCUDO',       short: 'ESCUDO',  color: '#00d4ff', rarity: 'Raro',       weight: 13, desc: 'Si fallas la próxima pregunta no pierdes vida.' },
    { id: 'boost',   label: 'PUNTOS x2',    short: 'x2 PTS',  color: '#ffb800', rarity: 'Raro',       weight: 14, desc: 'La próxima pregunta vale el doble de puntos.' },
    { id: 'triple',  label: 'TURBO x3',     short: 'x3 PTS',  color: '#ccff00', rarity: 'Raro',       weight: 12, desc: 'La próxima pregunta vale x3 puntos.' },
    { id: 'time8',   label: 'TIEMPO +8',    short: '+8 SEG',  color: '#00ffcc', rarity: 'Normal',     weight: 14, desc: 'La próxima pregunta tendrá 8 segundos extra.' },
    { id: 'hint',    label: 'PISTA',        short: 'PISTA',   color: '#f77f00', rarity: 'Normal',     weight: 15, desc: 'Elimina una respuesta incorrecta de la siguiente pregunta.' },
    { id: 'time5',   label: 'TIEMPO +5',    short: '+5 SEG',  color: '#00ff66', rarity: 'Normal',     weight: 16, desc: 'La próxima pregunta tendrá 5 segundos extra.' },
    { id: 'streak',  label: 'RACHA SALVADA',short: 'RACHA',   color: '#aaaaff', rarity: 'Básico',     weight: 18, desc: 'Si fallas la siguiente, tu racha no se resetea.' },
];

let rouletteActive = false;
let currentPrize = null;
let activeBoostNextQ = null; // current active power-up for next question
let shieldActive = false;
let hintActive = false;
let extraTimeActive = 0;
let streakShieldActive = false;
let totalCorrectThisGame = 0; // counts all corrects in game for roulette trigger
let nextRouletteTrigger = 10; // fire roulette when this many corrects reached

// ─── Iconos SVG para cada tipo de premio ───────────────────────────────────
const PRIZE_ICONS = {
    life:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
    frenzy:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    jackpot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    shield:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    boost:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
    triple:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>`,
    time8:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`,
    hint:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    time5:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    streak:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
};

// ─── Deck state ────────────────────────────────────────────────────────────
// (rouletteActive, currentPrize, activeBoostNextQ, etc. declared above in the prizes block)

// El deck visible son 5 cartas: [0..4], la carta central [2] es la seleccionada
let deckOrder = [];       // indices de ROULETTE_PRIZES en el deck actual
let deckOffset = 0;       // offset entero (cuántos hemos desplazado)
let deckAnimating = false;

// Crea/actualiza los elementos DOM del deck
function buildDeckCards() {
    const stage = document.getElementById('rl-stage');
    // Elimina cartas viejas
    stage.querySelectorAll('.rl-card').forEach(c => c.remove());
    // Crear 5 slots de carta
    for (let slot = 0; slot < 5; slot++) {
        const card = document.createElement('div');
        card.className = 'rl-card';
        card.dataset.slot = slot;
        card.innerHTML = `
            <div class="rl-card-bg"></div>
            <div class="rl-card-rarity"></div>
            <div class="rl-card-icon"></div>
            <div class="rl-card-name"></div>
        `;
        stage.appendChild(card);
    }
    applyDeckLayout(false);
}

// Actualiza posición/contenido de las 5 cartas según deckOffset
function applyDeckLayout(animate) {
    const stage = document.getElementById('rl-stage');
    if (!stage) return;
    const cards = stage.querySelectorAll('.rl-card');
    const stageW = stage.offsetWidth || 360;
    const cardW = 130;
    const gap = 22; // gap between card centers
    const isLight = document.body.classList.contains('light-mode');

    // Los 5 slots tienen offsets relativos: -2,-1,0,+1,+2 respecto al centro
    cards.forEach((card, slot) => {
        const rel = slot - 2; // -2 to +2
        // Qué prize index corresponde a este slot?
        const prizeIdx = ((deckOffset + slot) % ROULETTE_PRIZES.length + ROULETTE_PRIZES.length) % ROULETTE_PRIZES.length;
        const prize = ROULETTE_PRIZES[prizeIdx];

        // In light mode, darken the prize color so it's readable on light backgrounds
        const displayColor = isLight ? darkenHex(prize.color, 0.45) : prize.color;

        // Visual position
        const tx = rel * (cardW + gap);
        const isCenter = rel === 0;
        const scale = isCenter ? 1 : (Math.abs(rel) === 1 ? 0.82 : 0.65);
        const opacity = isCenter ? 1 : (Math.abs(rel) === 1 ? 0.65 : 0.35);
        const tz = isCenter ? 0 : -Math.abs(rel) * 30;

        if (!animate) { card.style.transition = 'none'; }
        else { card.style.transition = 'transform 0.4s var(--ease-spring), opacity 0.35s ease, box-shadow 0.35s ease'; }

        card.style.transform = `translateX(${tx}px) scale(${scale}) translateZ(${tz}px)`;
        card.style.opacity = opacity;

        // Content
        card.querySelector('.rl-card-bg').style.background = prize.color;
        card.querySelector('.rl-card-bg').style.opacity = isLight ? (isCenter ? '0.12' : '0.06') : (isCenter ? '0.25' : '0.14');
        card.querySelector('.rl-card-rarity').textContent = prize.rarity.toUpperCase();
        card.querySelector('.rl-card-rarity').style.color = isCenter ? displayColor : 'rgba(255,255,255,0.5)';
        card.querySelector('.rl-card-icon').innerHTML = PRIZE_ICONS[prize.id] || '';
        card.querySelector('.rl-card-icon').style.background = prize.color + (isLight ? '18' : '22');
        card.querySelector('.rl-card-icon').style.borderColor = prize.color + (isLight ? '44' : '55');
        card.querySelector('.rl-card-icon svg') && (card.querySelector('.rl-card-icon svg').style.color = displayColor);
        card.querySelector('.rl-card-name').textContent = prize.label;
        card.querySelector('.rl-card-name').style.color = isCenter ? displayColor : 'rgba(255,255,255,0.75)';

        // Center card class
        card.classList.toggle('center', isCenter);
        card.style.zIndex = isCenter ? 10 : (5 - Math.abs(rel));
        card.style.boxShadow = isCenter
            ? `0 0 0 2.5px ${displayColor}${isLight ? '55' : '66'}, 0 20px 50px rgba(0,0,0,${isLight ? '0.12' : '0.5'})`
            : 'none';
        card.style.borderColor = isCenter ? displayColor + (isLight ? '66' : '88') : (isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)');
    });
}

// Darkens a hex color string by mixing toward black by `factor` (0=original, 1=black)
function darkenHex(hex, factor) {
    const h = hex.replace('#', '');
    if (h.length !== 6) return hex;
    const r = Math.round(parseInt(h.slice(0,2),16) * (1-factor));
    const g = Math.round(parseInt(h.slice(2,4),16) * (1-factor));
    const b = Math.round(parseInt(h.slice(4,6),16) * (1-factor));
    return `rgb(${r},${g},${b})`;
}

function showRoulette() {
    if (rouletteActive) return;
    if (_screenTransitioning) return; // anti-glitch: bloquear si hay transición en curso
    const overlay = document.getElementById('roulette-overlay');
    if (!overlay) return; // DOM not ready guard
    rouletteActive = true;
    isGamePaused = true;
    clearInterval(timerInterval);
    _stopAntiCheatPoll(); // pausa legítima — suspender polling hasta que cierre

    const btn = document.getElementById('roulette-spin-btn');
    const zone = document.getElementById('rl-result-zone');
    const nameEl = document.getElementById('rl-result-name');
    const descEl = document.getElementById('rl-result-desc');

    // Reset state
    deckAnimating = false; // cancelar animación anterior si fue interrumpida
    btn.disabled = false;
    btn.className = 'rl-btn';
    btn.innerText = 'MEZCLAR Y GIRAR';
    btn.onclick = spinRoulette;
    zone.classList.remove('revealed');
    nameEl.innerText = '';
    descEl.innerText = '';

    // Shuffle deck: pick a random starting offset
    deckOffset = Math.floor(Math.random() * ROULETTE_PRIZES.length);
    buildDeckCards();

    overlay.classList.add('active');

    // Entrance sound
    if (audioCtx) {
        const t = audioCtx.currentTime;
        [523, 659, 784, 1047].forEach((f, i) => schedNote(f, 'sine', t + i * 0.10, 0.12, 0.18));
    }
}

function spinRoulette() {
    if (deckAnimating) return;
    deckAnimating = true;
    const btn = document.getElementById('roulette-spin-btn');
    btn.disabled = true;
    btn.innerText = 'Mezclando...';

    // Determine winning prize via weighted random
    const total = ROULETTE_PRIZES.reduce((s, p) => s + p.weight, 0);
    let rand = Math.random() * total;
    let winIdx = 0;
    for (let i = 0; i < ROULETTE_PRIZES.length; i++) {
        rand -= ROULETTE_PRIZES[i].weight;
        if (rand <= 0) { winIdx = i; break; }
    }

    // How many extra steps to scroll to land on winIdx at center slot (slot 2)?
    // Current center = deckOffset (+ 2) % len. We want winIdx at center.
    // We need deckOffset_final such that (deckOffset_final + 2) % len = winIdx
    // => deckOffset_final = (winIdx - 2 + len) % len
    // We'll add several full loops for effect
    const LOOPS = 3 + Math.floor(Math.random() * 3);
    const targetOffset = ((winIdx - 2) + ROULETTE_PRIZES.length * 100) % ROULETTE_PRIZES.length;
    const totalSteps = LOOPS * ROULETTE_PRIZES.length + ((targetOffset - deckOffset + ROULETTE_PRIZES.length * 100) % ROULETTE_PRIZES.length);

    // Animate step by step with decelerating intervals
    let stepsDone = 0;
    let tickInterval = null;

    function schedNext() {
        try {
            const progress = stepsDone / totalSteps;
            const eased = Math.pow(progress, 2.2);
            const delay = 55 + eased * 380;
            tickInterval = setTimeout(() => {
                deckOffset = (deckOffset + 1) % ROULETTE_PRIZES.length;
                applyDeckLayout(true);
                stepsDone++;
                if (audioCtx) {
                    const freq = 800 - progress * 300;
                    schedNote(freq, 'square', audioCtx.currentTime, 0.035, 0.06);
                }
                if (stepsDone < totalSteps) {
                    schedNext();
                } else {
                    tickInterval = null;
                    deckAnimating = false;
                    currentPrize = ROULETTE_PRIZES[winIdx];
                    setTimeout(() => showCardPrize(currentPrize), 320);
                }
            }, delay);
        } catch(e) {
            if (tickInterval) { clearTimeout(tickInterval); tickInterval = null; }
            deckAnimating = false;
        }
    }
    schedNext();
}

function showCardPrize(prize) {
    const btn = document.getElementById('roulette-spin-btn');
    const zone = document.getElementById('rl-result-zone');
    const nameEl = document.getElementById('rl-result-name');
    const descEl = document.getElementById('rl-result-desc');
    const isLight = document.body.classList.contains('light-mode');

    nameEl.textContent = prize.label;
    nameEl.style.color = isLight ? darkenHex(prize.color, 0.45) : prize.color;
    descEl.textContent = prize.desc;
    zone.classList.add('revealed');

    btn.innerText = 'COBRAR PREMIO';
    btn.disabled = false;
    btn.className = 'rl-btn collecting';
    btn.onclick = collectRoulettePrize;

    // Celebration SFX
    if (audioCtx) {
        const t = audioCtx.currentTime;
        [784, 988, 1175, 1568].forEach((f, i) => schedNote(f, 'sine', t + i * 0.08, 0.18, 0.16));
    }

    // Spawn particles across full overlay
    spawnRoulettParticles(prize.color);
    // Update ambient roulette particle color to match prize
    try {
        const m = prize.color.replace('#','');
        const r = parseInt(m.slice(0,2),16), g = parseInt(m.slice(2,4),16), b = parseInt(m.slice(4,6),16);
        if (!isNaN(r) && rlCanvas) initRlParticles(`${r},${g},${b}`);
    } catch(e) {}

    // Track stats
    playerStats.rouletteSpins = (playerStats.rouletteSpins||0) + 1;
    if (prize.id === 'life')   playerStats.rouletteLifeWins   = (playerStats.rouletteLifeWins||0) + 1;
    if (prize.id === 'shield') playerStats.rouletteShieldWins = (playerStats.rouletteShieldWins||0) + 1;
    if (prize.id === 'boost' || prize.id === 'triple' || prize.id === 'jackpot') playerStats.rouletteBoostWins = (playerStats.rouletteBoostWins||0) + 1;
    if (prize.id === 'frenzy') playerStats.rouletteFrenzyWins = (playerStats.rouletteFrenzyWins||0) + 1;
    if (currentMaxStreak >= 20) playerStats.rouletteComboSpecial = true;
    saveStatsDebounced();
    checkAchievements();
}

function spawnRoulettParticles(color) {
    const overlay = document.getElementById('roulette-overlay');
    if (!overlay) return;
    // Use many particles distributed across full screen
    for (let i = 0; i < 36; i++) {
        const p = document.createElement('div');
        p.className = 'r-particle';
        // Alternate between prize color and white
        p.style.background = i % 3 === 0 ? '#ffffff' : color;
        p.style.width = (6 + Math.random() * 8) + 'px';
        p.style.height = p.style.width;
        p.style.zIndex = '5';
        // Random starting positions spread across screen
        p.style.left = (10 + Math.random() * 80) + '%';
        p.style.top  = (20 + Math.random() * 60) + '%';
        p.style.setProperty('--tx', (Math.random() - 0.5) * 300 + 'px');
        p.style.setProperty('--ty', (Math.random() - 0.8) * 280 + 'px');
        p.style.animationDelay = Math.random() * 0.4 + 's';
        p.style.animationDuration = (0.8 + Math.random() * 0.5) + 's';
        overlay.appendChild(p);
        setTimeout(() => p.remove(), 1500);
    }
}

// streakShieldActive declared above with other roulette state vars

function collectRoulettePrize() {
    const prize = currentPrize;
    if (!prize) return;
    const btn = document.getElementById('roulette-spin-btn');
    btn.onclick = spinRoulette;

    // Apply prize effect
    if (prize.id === 'life') {
        if (lives < 3) { lives++; updateLivesUI(); showToast('VIDA EXTRA', 'Has recuperado una vida.', '#ff2a5f', SVG_HEART); }
        else { showToast('¡VIDAS AL MÁXIMO!', 'Ya tienes todas las vidas.', '#ff2a5f', SVG_HEART); }
    } else if (prize.id === 'shield') {
        shieldActive = true;
        showToast('ESCUDO ACTIVO', 'Protegido ante un fallo en la siguiente pregunta.', '#00d4ff', SVG_SHIELD);
    } else if (prize.id === 'boost') {
        activeBoostNextQ = 'boost';
        showToast('PUNTOS x2', 'La próxima pregunta vale el doble.', '#ffb800', SVG_STAR);
    } else if (prize.id === 'triple') {
        activeBoostNextQ = 'triple';
        showToast('TURBO x3', 'La próxima pregunta vale x3 puntos.', '#ccff00', SVG_BOLT);
    } else if (prize.id === 'jackpot') {
        activeBoostNextQ = 'jackpot';
        showToast('JACKPOT x4', 'La próxima pregunta vale x4 puntos.', '#ff0090', SVG_STAR);
    } else if (prize.id === 'frenzy') {
        // Forzar al menos multiplicador x2 (streak >= 5).
        // Si ya está en frenesí, subir un nivel más (streak += 5) hasta el tope de x10 (streak 45).
        if (streak < 5) {
            streak = 5;
        } else {
            streak = Math.min(streak + 5, 45);
        }
        if (streak > currentMaxStreak) currentMaxStreak = streak;
        // Track frenzy activation for achievements
        playerStats.frenziesTriggered = (playerStats.frenziesTriggered || 0) + 1;
        frenziesThisGame++;
        if (frenziesThisGame > (playerStats.maxFrenziesInGame || 0)) playerStats.maxFrenziesInGame = frenziesThisGame;
        updateMultiplierUI();
        updateStreakVisuals();
        showToast('¡FRENESÍ ACTIVADO!', 'Modo Frenesí activado por la ruleta.', '#b5179e', SVG_FIRE);
    } else if (prize.id === 'time5') {
        extraTimeActive = 5;
        showToast('+5 SEGUNDOS', 'La próxima pregunta tendrá tiempo extra.', '#00ff66', SVG_CLOCK);
    } else if (prize.id === 'time8') {
        extraTimeActive = 8;
        showToast('+8 SEGUNDOS', 'La próxima pregunta tendrá mucho tiempo extra.', '#00ffcc', SVG_CLOCK);
    } else if (prize.id === 'hint') {
        hintActive = true;
        showToast('PISTA ACTIVADA', 'Se eliminará una respuesta incorrecta.', '#f77f00', SVG_BOLT);
    } else if (prize.id === 'streak') {
        streakShieldActive = true;
        showToast('RACHA PROTEGIDA', 'Si fallas la siguiente, tu racha no se resetea.', '#aaaaff', SVG_SHIELD);
    }

    closeRoulette();
}

function updateRewardIndicator() {
    const bar = document.getElementById('active-reward-bar');
    const iconEl = document.getElementById('active-reward-icon');
    const textEl = document.getElementById('active-reward-text');
    if (!bar) return;
    let label = '', icon = '', color = '';
    if (activeBoostNextQ === 'boost') { label = 'Puntos x2 activo'; icon = 'x2'; color = '#ffb800'; }
    else if (activeBoostNextQ === 'triple') { label = 'Turbo x3 activo'; icon = 'x3'; color = '#ccff00'; }
    else if (activeBoostNextQ === 'jackpot') { label = 'Jackpot x4 activo'; icon = 'x4'; color = '#ff0090'; }
    else if (shieldActive) { label = 'Escudo activo'; icon = SVG_SHIELD; color = '#00d4ff'; }
    else if (hintActive) { label = 'Pista lista'; icon = '?'; color = '#f77f00'; }
    else if (extraTimeActive > 0) { label = `+${extraTimeActive}s de tiempo`; icon = '+t'; color = extraTimeActive >= 8 ? '#00ffcc' : '#00ff66'; }
    else if (streakShieldActive) { label = 'Racha protegida'; icon = 'R+'; color = '#aaaaff'; }
    if (label) {
        iconEl.innerHTML = icon;
        textEl.textContent = label;
        textEl.style.color = color;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}

function closeRoulette() {
    if (!rouletteActive) return; // anti-glitch: evitar doble cierre
    const overlay = document.getElementById('roulette-overlay');
    overlay.classList.remove('active');
    rouletteActive = false;
    currentPrize = null;
    deckAnimating = false;
    isGamePaused = false;
    // Capturar el estado de hintActive ANTES de cualquier cosa
    // (loadQuestion no lo usa, applyHintVisual sí — no resetear hasta después)
    const _hint = hintActive;
    if (_hint) hintActive = false; // limpiar flag ya que se va a aplicar ahora
    switchScreen('question-screen');
    updateRewardIndicator();
    setTimeout(() => {
        // loadQuestion carga la pregunta con extraTimeActive ya seteado (se aplica dentro)
        loadQuestion();
        _startAntiCheatPoll(); // reanudar polling al volver a preguntas
        if (_hint) {
            // Aplicar pista DESPUÉS de que todas las animaciones de entrada terminen (~630ms)
            setTimeout(applyHintVisual, 680);
        }
    }, 300);
}

// ── Botón físico "Atrás" (Android/PWA) ──────────────────────────────────────
window.addEventListener('popstate', function(e) {
    // Si hay una partida activa, interceptar y mostrar modal de abandono
    const activeScreen = _currentScreen && _currentScreen.id;
    if (activeScreen === 'question-screen' || activeScreen === 'feedback-screen' || activeScreen === 'countdown-screen') {
        // Re-empujar estado para no salir de la app
        try { history.pushState({ klickGame: true }, ''); } catch(err) {}
        // Mostrar modal de abandono (el mismo botón "Abandonar" del juego)
        const abandonModal = document.getElementById('abandon-modal');
        if (abandonModal) abandonModal.classList.add('active');
    }
});

function goToMainMenu() { 
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    SFX.click();
    // Restaurar perfil propio si se estaba viendo el de otro jugador
    _restoreOwnProfileOnLeave();
    _profileReturnScreen = 'start-screen';
    playerStats._settingsOpenTime = 0;
    switchScreen('start-screen'); 
}

function _ksCard(nm, rankTitle, avCls, cardBorderCls, tagCls, tagLabel, sub, adminBtns) {
    // avCls ignorado — sin burbuja de avatar (eliminada v4)
    const btnsHtml = adminBtns ? `<div class="ks-ucard-admin-btns">${adminBtns}</div>` : '';
    return `<div class="ks-ucard ${cardBorderCls}">
        <div class="ks-ucard-info">
            <div class="ks-ucard-name">${nm}</div>
            <div class="ks-ucard-sub">${sub}</div>
        </div>
        <span class="ks-ucard-tag ${tagCls}">${tagLabel}</span>
        ${btnsHtml}
    </div>`;
}

// Admin: Banear jugador permanentemente desde el servidor
async function _adminBanPlayer(uuid, name) {
    if (!uuid) return;
    if (!confirm(`¿Banear a ${name} permanentemente del servidor?`)) return;
    try {
        await fetch(GAS_URL, { method: 'POST', headers: {'Content-Type':'text/plain'},
            body: JSON.stringify({ action:'ban', uuid, name, motivo:'Ban manual — Admin' }) });
        showToast('Cuenta baneada', name + ' ha sido suspendido.', '#ff2a5f', SVG_BAN_ICON);
        setTimeout(async () => { await fetchSecurityData(); renderSecurityStatus(); }, 1200);
    } catch(e) { showToast('Error', 'No se pudo conectar al servidor.', 'var(--accent-red)', SVG_ALERT); }
}

// Admin: Desbanear jugador del servidor
async function _adminUnbanPlayer(uuid, name) {
    if (!uuid) return;
    if (!confirm(`¿Desbanear a ${name}?`)) return;
    try {
        await fetch(GAS_URL, { method: 'POST', headers: {'Content-Type':'text/plain'},
            body: JSON.stringify({ action:'unban', uuid, name }) });
        showToast('Cuenta desbaneada', name + ' ha sido restaurado.', '#00ff66', SVG_CORRECT);
        setTimeout(async () => { await fetchSecurityData(); renderSecurityStatus(); }, 1200);
    } catch(e) { showToast('Error', 'No se pudo conectar al servidor.', 'var(--accent-red)', SVG_ALERT); }
}

// ── Zona de Seguridad — pantalla personal del jugador ───────────────────
// Muestra solo el estado de seguridad del propio usuario:
// estado actual, historial de infracciones, contador de ban activo.
// Los admin ven adicionalmente los controles de gestión.
function renderSecurityStatus() {
    const container = document.getElementById('ks-personal-layout');
    if (!container) return;

    const name     = playerStats.playerName || '';
    const isNamed  = name && name !== 'JUGADOR';
    const ADMIN_UUID = '00000000-spec-tral-0000-klickphantom0';
    const isAdmin  = name.toUpperCase() === 'CHRISTOPHER' && playerStats.uuid === ADMIN_UUID;

    const banUntil   = playerStats.ksBanUntil;
    const review     = playerStats.ksReviewStatus;
    const infList    = playerStats.ksInfractions || [];
    const hasBan     = banUntil && new Date(banUntil).getTime() > Date.now();
    const rankInfo   = typeof getRankInfo !== 'undefined' ? getRankInfo(playerStats) : {};

    // ── Estado actual del jugador ──────────────────────────────────────
    let stateColor, stateIcon, stateLabel, stateDesc, stateClass;
    if (hasBan) {
        stateColor = '#ff2a5f'; stateClass = 'ks-state-ban';
        stateIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;
        stateLabel = 'Acceso Suspendido';
        stateDesc  = 'No puedes iniciar partidas. El acceso se restaura automáticamente al expirar.';
    } else if (review === 'warned') {
        stateColor = '#ff8c00'; stateClass = 'ks-state-warned';
        stateIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
        stateLabel = 'Advertencia Activa';
        stateDesc  = 'Tienes advertencias registradas. La siguiente infracción puede derivar en sanción.';
    } else if (review === 'under_review') {
        stateColor = '#ffb800'; stateClass = 'ks-state-review';
        stateIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`;
        stateLabel = 'Bajo Revisión';
        stateDesc  = 'El sistema está monitoreando tu actividad de forma preventiva. Sin restricciones activas.';
    } else if (review === 'sanctioned') {
        stateColor = '#ff4040'; stateClass = 'ks-state-sanction';
        stateIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
        stateLabel = 'Sanción Confirmada';
        stateDesc  = 'Tienes una infracción confirmada en tu historial. Nuevas infracciones escalan.';
    } else {
        stateColor = '#00ff66'; stateClass = 'ks-state-clean';
        stateIcon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>`;
        stateLabel = 'Estado Limpio';
        stateDesc  = 'No hay incidencias activas en tu cuenta.';
    }

    // ── Historial de infracciones ──────────────────────────────────────
    const BAN_HOURS = {1:0, 2:1, 3:3, 4:6, 5:12, 6:24, 7:48, 8:72};
    let infraHtml = '';
    if (infList.length > 0) {
        const reversed = [...infList].reverse();
        infraHtml = reversed.map((inf, i) => {
            const dt  = inf.date ? new Date(inf.date).toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'}) : '—';
            const lvl = inf.level || '?';
            const bh  = inf.banHours || BAN_HOURS[lvl] || 0;
            const isLast = i === 0;
            return `<div class="ks-inf-row${isLast ? ' ks-inf-latest' : ''}">
                <div class="ks-inf-level" style="color:${lvl>=6?'#ff2a5f':lvl>=4?'#ff8c00':lvl>=2?'#ffb800':'var(--text-secondary)'}">Nv.${lvl}</div>
                <div class="ks-inf-detail">
                    <div class="ks-inf-title">Infracción #${infList.length - i}</div>
                    <div class="ks-inf-meta">${dt}${bh > 0 ? ` · ${bh}h suspensión` : ' · Sin suspensión'}</div>
                </div>
                ${isLast ? '<div class="ks-inf-badge">Última</div>' : ''}
            </div>`;
        }).join('');
    } else {
        infraHtml = `<div class="ks-empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>Sin infracciones registradas</span></div>`;
    }

    // ── Panel admin: controles de gestión ─────────────────────────────
    let adminHtml = '';
    if (isAdmin) {
        const secPlayers = window._ksSecurityData || [];
        const banned    = secPlayers.filter(p => p.isBanned && p.uuid !== ADMIN_UUID);
        const inReview  = secPlayers.filter(p => p.ksReviewStatus && !p.isBanned && p.uuid !== ADMIN_UUID);
        const makeCard = (p) => {
            const safe = (p.name||'').replace(/['"`]/g,'');
            const isBanned = !!p.isBanned;
            const ks = p.ksReviewStatus;
            const ms4 = p.ksBanUntil ? new Date(p.ksBanUntil).getTime() - Date.now() : 0;
            const sub = isBanned
                ? (ms4 > 0 ? `Expira en ${Math.floor(ms4/3600000)}h ${Math.floor((ms4%3600000)/60000)}m` : 'Baneado del servidor')
                : (ks === 'warned' ? 'Advertido' : ks === 'sanctioned' ? 'Sanción confirmada' : 'En revisión');
            const tagClass = isBanned ? 'ks-tag-ban' : ks === 'sanctioned' ? 'ks-tag-sanction' : ks === 'warned' ? 'ks-tag-warn' : 'ks-tag-review';
            const tagLabel = isBanned ? 'Suspendido' : ks === 'sanctioned' ? 'Sancionado' : ks === 'warned' ? 'Advertido' : 'Revisión';
            const btn = isBanned
                ? `<button class="ks-admin-btn ks-admin-btn-unban" onclick="_adminUnbanPlayer('${p.uuid}','${safe}')">Desbanear</button>`
                : `<button class="ks-admin-btn ks-admin-btn-ban" onclick="_adminBanPlayer('${p.uuid}','${safe}')">Banear</button>`;
            return `<div class="ks-ucard ${isBanned ? 'ks-ucard-ban' : 'ks-ucard-review'}">
                <div class="ks-ucard-info">
                    <div class="ks-ucard-name">${p.name||'—'}</div>
                    <div class="ks-ucard-sub">${sub}</div>
                </div>
                <span class="ks-ucard-tag ${tagClass}">${tagLabel}</span>
                <div class="ks-ucard-admin-btns">${btn}</div>
            </div>`;
        };
        const allCards = [...banned, ...inReview].map(makeCard).join('');
        adminHtml = `
        <div class="ks-personal-section">
            <div class="ks-personal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Panel Administrativo
                ${(banned.length + inReview.length) > 0 ? `<span class="ks-admin-badge">${banned.length + inReview.length}</span>` : ''}
            </div>
            <div class="ks-list">
                ${allCards || `<div class="ks-empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><span>Todo limpio — sin acciones requeridas</span></div>`}
            </div>
        </div>`;
    }

    // ── Render completo ────────────────────────────────────────────────
    const playerLabel = isNamed ? name : 'Tu cuenta';
    container.innerHTML = `
        <!-- Estado actual -->
        <div class="ks-state-card ${stateClass}">
            <div class="ks-state-icon" style="color:${stateColor};border-color:${stateColor}33;background:${stateColor}11">${stateIcon}</div>
            <div class="ks-state-info">
                <div class="ks-state-label" style="color:${stateColor}">${stateLabel}</div>
                <div class="ks-state-name">${playerLabel}</div>
                <div class="ks-state-desc">${stateDesc}</div>
            </div>
        </div>

        ${hasBan ? `
        <!-- Bloque de countdown explícito -->
        <div class="ks-personal-section ks-ban-block">
            <div class="ks-personal-section-title" style="color:#ff2a5f;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Tiempo de suspensión
            </div>
            <div class="ks-ban-countdown-wrap">
                <div class="ks-ban-cd-display" id="ks-ban-live-cd-big" data-until="${banUntil}">--:--:--</div>
                <div class="ks-ban-cd-until">Expira el ${new Date(banUntil).toLocaleString('es-ES',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</div>
            </div>
        </div>` : ''}

        <!-- Historial de infracciones -->
        <div class="ks-personal-section">
            <div class="ks-personal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Historial de infracciones
                ${infList.length > 0 ? `<span class="ks-inf-count">${infList.length}</span>` : ''}
            </div>
            <div class="ks-inf-list">${infraHtml}</div>
            <div class="ks-personal-foot">Las infracciones escalan automáticamente hasta nivel 8 (72 h máx.). Se registran de forma permanente.</div>
        </div>

        <!-- Info del sistema -->
        <div class="ks-personal-section ks-system-info">
            <div class="ks-personal-section-title">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Cómo funciona el sistema
            </div>
            <div class="ks-system-grid">
                <div class="ks-sys-item"><div class="ks-sys-dot" style="background:#00ff66"></div><span>Limpio — sin incidencias activas.</span></div>
                <div class="ks-sys-item"><div class="ks-sys-dot" style="background:#ffb800"></div><span>Revisión — monitoreo preventivo, sin restricciones.</span></div>
                <div class="ks-sys-item"><div class="ks-sys-dot" style="background:#ff8c00"></div><span>Advertencia — actividad registrada, sin sanción aún.</span></div>
                <div class="ks-sys-item"><div class="ks-sys-dot" style="background:#ff4040"></div><span>Sanción — infracción confirmada en historial.</span></div>
                <div class="ks-sys-item"><div class="ks-sys-dot" style="background:#ff2a5f"></div><span>Suspensión — acceso bloqueado temporalmente.</span></div>
            </div>
            <div class="ks-personal-foot" style="margin-top:8px;">Un evento aislado (llamada, notificación, rotación) nunca genera consecuencias por sí solo. El análisis pondera señales de comportamiento con atenuantes automáticos.</div>
        </div>

        ${adminHtml}
    `;

    // Iniciar ticker para el countdown de ban activo
    _ksStartBanTicker();
}

function _ksStartBanTicker() {
    if (window._ksSecurityTick) clearInterval(window._ksSecurityTick);
    window._ksSecurityTick = setInterval(() => {
        const screen = document.getElementById('security-screen');
        if (!screen || !screen.classList.contains('active')) {
            clearInterval(window._ksSecurityTick);
            window._ksSecurityTick = null;
            return;
        }
        const banUntil = playerStats.ksBanUntil;
        if (!banUntil) return;
        const ms = new Date(banUntil).getTime() - Date.now();
        const fmt = ms <= 0 ? '00:00:00' : (() => {
            const hh = Math.floor(ms/3600000);
            const mm = Math.floor((ms%3600000)/60000);
            const ss = Math.floor((ms%60000)/1000);
            return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
        })();
        ['ks-ban-live-cd','ks-ban-live-cd-big'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = fmt;
        });
        if (ms <= 0) {
            playerStats.ksBanUntil = null;
            // Mantener 'sanctioned' — ban expiró pero la infracción permanece en historial
            saveStatsLocally();
            clearInterval(window._ksSecurityTick);
            window._ksSecurityTick = null;
            setTimeout(renderSecurityStatus, 800);
        }
    }, 1000);
}

async function goToSecurity() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    try { initAudio(); SFX.click(); } catch(e) {}
    try {
        localStorage.setItem('klick_security_seen', KLICK_VERSION);
        const dot = document.getElementById('security-new-dot');
        if (dot) dot.style.display = 'none';
    } catch(_) {}
    switchScreen('security-screen');
    // Renderizar inmediatamente con datos en caché — sin spinner de carga
    renderSecurityStatus();
    // Admin: refrescar datos del servidor en segundo plano y re-renderizar silenciosamente
    const isAdmin = playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
    if (isAdmin) {
        fetchSecurityData().then(() => {
            // Solo re-renderizar si la pantalla sigue visible
            const sec = document.getElementById('security-screen');
            if (sec && sec.classList.contains('active')) renderSecurityStatus();
        }).catch(() => {});
    }
}

function goToChangelog() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    try { initAudio(); SFX.click(); } catch(e) {}
    // Marcar como visto (ocultar punto de novedad)
    try {
        const lastSeen = localStorage.getItem('klick_changelog_seen') || '';
        if (lastSeen !== KLICK_VERSION) {
            localStorage.setItem('klick_changelog_seen', KLICK_VERSION);
        }
    } catch(_) {}
    const dot = document.getElementById('changelog-new-dot');
    if (dot) dot.style.display = 'none';
    // Mostrar versión en cabecera
    const verEl = document.getElementById('cl-current-version');
    if (verEl) verEl.textContent = KLICK_VERSION;
    renderChangelog();
    switchScreen('changelog-screen');
}


function onLogoClick() {
    initAudio();
    SFX.pcClick();
    const logo = document.getElementById('logo-title');
    if (logo) { logo.style.transform = 'scale(1.06)'; setTimeout(() => logo.style.transform = '', 180); }
    if (!playerStats.clickedLogo) {
        playerStats.clickedLogo = true;
        saveStatsLocally();
        setTimeout(() => SFX.achievement(), 120);
        checkAchievements();
    }
}
// Helper: marca una sección visitada en sesión y verifica si se han visitado todas
function trackSectionVisit(section) {
    if (!Array.isArray(playerStats.sectionsVisitedThisSession)) playerStats.sectionsVisitedThisSession = [];
    if (!playerStats.sectionsVisitedThisSession.includes(section)) {
        playerStats.sectionsVisitedThisSession.push(section);
    }
    // Persistir secciones visitadas para logros de exploración
    if (!playerStats.sectionsVisited) playerStats.sectionsVisited = {};
    playerStats.sectionsVisited[section] = true;

    const ALL_SECTIONS = ['profile', 'achievements', 'ranking', 'settings'];
    if (!playerStats.allSectionsVisited && ALL_SECTIONS.every(s => playerStats.sectionsVisitedThisSession.includes(s))) {
        playerStats.allSectionsVisited = true;
    }
}

function goToAchievements() { if (_screenTransitioning) return; _lockUserNav(); initAudio(); SFX.click(); playerStats.achViews++; trackSectionVisit('achievements'); saveStatsLocally(); checkAchievements(); renderAchievements(); switchScreen('achievements-screen'); const sc = document.getElementById('vscroll-container'); if(sc) sc.scrollTop = 0; }

function goToRanking() { 
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    initAudio(); SFX.click();
    playerStats.rankingViews = (playerStats.rankingViews||0) + 1;
    trackSectionVisit('ranking');
    saveStatsLocally(); checkAchievements();
    switchScreen('ranking-screen');
    fetchLeaderboard();
    _startRankingPoll();
}


function goToProfile(needsName = false) {
    if (_screenTransitioning && !needsName) return; // anti-glitch (no bloquear si se necesita nombre)
    _lockUserNav();
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    SFX.click();
    // Si no se llegó desde el ranking, el back button vuelve al menú principal.
    // Si venimos del ranking (return screen ya fijado en 'ranking-screen'), preservarlo.
    if (!_isViewingOtherProfile && _profileReturnScreen !== 'ranking-screen') _profileReturnScreen = 'start-screen';
    // Restaurar nav title propio
    const navTitle = document.getElementById('profile-nav-title');
    if (navTitle) navTitle.textContent = 'PERFIL';
    playerStats.profileViews = (playerStats.profileViews||0) + 1;
    trackSectionVisit('profile');
    // ui9: Revisa tu perfil inmediatamente después de un nuevo récord
    if (playerStats._justSetRecord) {
        playerStats._justSetRecord = false;
        if (!playerStats.achievements.includes('ui9')) {
            playerStats.achievements.push('ui9');
            const ach = ACHIEVEMENTS_MAP.get('ui9');
            if (ach) { SFX.achievement(); showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon); }
        }
    }
    // ui5: El Perfil Importa — track visits after each of first 5 games
    if ((playerStats.gamesPlayed||0) <= 5 && (playerStats.gamesPlayed||0) > 0) {
        const key = `_profileAfterGame${playerStats.gamesPlayed}`;
        if (!playerStats[key]) { playerStats[key] = true; playerStats.profileViewedAfterGames = (playerStats.profileViewedAfterGames||0) + 1; }
    }
    document.getElementById('stat-games').innerText = playerStats.gamesPlayed; document.getElementById('stat-score').innerText = playerStats.bestScore.toLocaleString(); document.getElementById('stat-streak').innerText = playerStats.maxStreak; document.getElementById('stat-days').innerText = playerStats.maxLoginStreak;
    document.getElementById('profile-name-input').value = (playerStats.playerName === "JUGADOR") ? "" : playerStats.playerName;
    document.getElementById('profile-warning').style.opacity = needsName ? '1' : '0';
    // CHRISTOPHER: mostrar ∞ en todos los indicadores numéricos del perfil
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') {
        ['stat-games','stat-score','stat-streak','stat-days'].forEach(id => {
            const el = document.getElementById(id); if (el) el.innerText = '∞';
        });
    }
    currentRankInfo = getRankInfo(playerStats); updateLogoDots(); document.getElementById('profile-rank-display').innerText = `Rango: ${currentRankInfo.title}`; { const isLight = document.body.classList.contains('light-mode'); document.getElementById('profile-rank-display').style.color = isLight ? darkenHex(currentRankInfo.color, 0.4) : currentRankInfo.color; }
    // Título equipable — solo visible para rango Mítico y en perfil propio
    if (!_isViewingOtherProfile) _renderMiticoTitleSelector();
    // Render PL panel
    (function renderPLPanel(){
        const s = playerStats;
        const totalAnswers = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
        const accuracy = totalAnswers>0 ? Math.min(100,Math.round((s.totalCorrect||0)/totalAnswers*100)) : 0;
        const fmt = n => n.toLocaleString();
        // Usar misma fórmula que calculatePowerLevel (con cap + efficiency)
        const plBase   = Math.min(Math.floor((s.totalScore||0)*0.05), 50000);
        const plBest   = Math.floor((s.bestScore||0)*1.5);
        const plStreak = (s.maxStreak||0)*200;
        const plPerf   = (s.perfectGames||0)*1000;
        const plAchs   = (s.achievements||[]).length*300;
        const plAcc    = s.gamesPlayed>0 ? Math.floor(((s.totalCorrect||0)/(s.gamesPlayed*20))*5000) : 0;
        const avgScore = s.gamesPlayed>0 ? Math.floor((s.totalScore||0)/s.gamesPlayed) : 0;
        const plEfficiency = Math.min(Math.floor(avgScore * 0.3), 15000);
        const plTotal  = plBase+plBest+plStreak+plPerf+plAchs+plAcc+plEfficiency;
        // PL total & rank color
        const plTotalEl = document.getElementById('pl-total');
        const plHeroEl = document.getElementById('pl-hero-total');
        const _isAdminPL = s.playerName && s.playerName.toUpperCase() === 'CHRISTOPHER';
        const plDisplay = _isAdminPL ? '∞' : fmt(plTotal);
        if(plTotalEl){ plTotalEl.innerText=plDisplay; plTotalEl.style.color=currentRankInfo.color; }
        if(plHeroEl){ plHeroEl.innerText=plDisplay; plHeroEl.style.color=currentRankInfo.color; }
        // Panel border color
        const panel = document.getElementById('pl-panel');
        if(panel) panel.style.borderColor=`rgba(${currentRankInfo.rgb},0.28)`;
        // Ranking pos
        const posEl=document.getElementById('pl-ranking-pos');
        if(posEl) posEl.innerText = _isAdminPL ? '∞' : (s.rankingPosition&&s.rankingPosition<999?`#${s.rankingPosition}`:'#—');
        // Build rows
        const rowsEl=document.getElementById('pl-rows');
        if(!rowsEl) return;
        // CHRISTOPHER: mostrar ∞ en todas las filas del desglose
        if (_isAdminPL) {
            const infColor = currentRankInfo.color;
            const infRows = [
                'Puntaje acum.','Récord','Racha máxima','Partidas perfectas','Logros','Precisión','Eficiencia'
            ];
            rowsEl.innerHTML = infRows.map(label =>
                `<div class="pl-calc-row">
                    <span class="pl-calc-label" style="color:${infColor};">${label}</span>
                    <span class="pl-calc-val" style="color:${infColor};">∞</span>
                    <span class="pl-calc-factor" style="color:${infColor};">∞</span>
                    <span class="pl-calc-result" style="color:${infColor};">+∞</span>
                </div>`
            ).join('') +
            `<div class="pl-calc-divider"></div><div class="pl-calc-row" style="padding:6px 4px;">
                <span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:1px;grid-column:1/3;">Total PL</span>
                <span></span>
                <span style="font-size:clamp(1.1rem,2vw,1.4rem);font-weight:900;font-family:monospace;color:${infColor};text-align:right;">∞</span>
            </div>`;
            const barEl = document.getElementById('pl-bar-total');
            if (barEl) { barEl.style.width = '100%'; barEl.style.background = infColor; }
            const nextEl = document.getElementById('pl-next-label');
            if (nextEl) nextEl.innerHTML = '';
            const accPctEl = document.getElementById('pl-accuracy-pct');
            if (accPctEl) accPctEl.innerText = '∞% precisión';
            return;
        }
        const colors=['var(--accent-blue)','var(--accent-yellow)','var(--accent-orange)','var(--accent-green)','var(--accent-purple)','var(--accent-red)','var(--accent-blue)'];
        const rows=[
            { label:'Puntaje acum.',   raw:fmt(s.totalScore||0),    factor:'× 0.05 (máx 50k)',  result:plBase,        color:colors[0] },
            { label:'Récord',          raw:fmt(s.bestScore||0),      factor:'× 1.5',              result:plBest,        color:colors[1] },
            { label:'Racha máxima',    raw:`${s.maxStreak||0} aciertos`, factor:'× 200',          result:plStreak,      color:colors[2] },
            { label:'Partidas perfectas', raw:`${s.perfectGames||0} partidas`, factor:'× 1,000',  result:plPerf,        color:colors[3] },
            { label:'Logros',          raw:`${(s.achievements||[]).filter(id => ACHIEVEMENTS_MAP.has(id)).length} logros`, factor:'× 300', result:plAchs,      color:colors[4] },
            { label:'Precisión',       raw:`${accuracy}%`,           factor:'× 5,000',            result:plAcc,         color:colors[5] },
            { label:'Eficiencia',      raw:`${fmt(avgScore)} prom/p`, factor:'× 0.3 (máx 15k)',   result:plEfficiency,  color:colors[6] },
        ];
        rowsEl.innerHTML = rows.map((r,i)=>`
            <div class="pl-calc-row">
                <span class="pl-calc-label" style="color:${r.color};">${r.label}</span>
                <span class="pl-calc-val">${r.raw}</span>
                <span class="pl-calc-factor">${r.factor}</span>
                <span class="pl-calc-result" style="color:${r.color};">+${fmt(r.result)}</span>
            </div>
            ${i===rows.length-1?`<div class="pl-calc-divider"></div><div class="pl-calc-row" style="padding:6px 4px;">
                <span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:1px;grid-column:1/3;">Total PL</span>
                <span></span>
                <span style="font-size:clamp(0.8rem,1.5vw,0.95rem);font-weight:900;font-family:monospace;color:${currentRankInfo.color};text-align:right;">${fmt(plTotal)}</span>
            </div>`:''}
        `).join('');
        // Progress bar toward next milestone
        const milestones=[10000,100000,1000000,5000000,10000000];
        let nextMs=milestones.find(m=>m>plTotal)||10000000;
        let prevMs=milestones[milestones.indexOf(nextMs)-1]||0;
        const prog=Math.min(1,(plTotal-prevMs)/Math.max(1,nextMs-prevMs));
        const pctRound=Math.round(prog*100);
        setTimeout(()=>{
            const bar=document.getElementById('pl-bar-total');
            if(bar){ bar.style.width=pctRound+'%'; bar.style.background=currentRankInfo.color; }
        },120);
        // Build next rank conditions label
        const nextEl=document.getElementById('pl-next-label');
        if(nextEl) {
            const ri = currentRankInfo;
            let condHtml = '';
            if (ri.title === 'Novato') {
                // Next: Junior
                const c1 = (s.totalScore||0) >= 20000, c2 = (s.totalCorrect||0) >= 75, c3 = (s.gamesPlayed||0) >= 10;
                condHtml = `<span style="color:#00d4ff;font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: JUNIOR</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/20,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/75</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/10</span>`;
            } else if (ri.title === 'Junior') {
                // Next: Pro
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=60000, c2=(s.totalCorrect||0)>=250, c3=(s.gamesPlayed||0)>=30;
                const c4=(s.maxMult||1)>=3, c5=(s.maxStreak||0)>=10, c6=acc2>=60;
                condHtml = `<span style="color:#ffe566;font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: PRO</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/60,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/250</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/30</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x3</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/10</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/60%</span>`;
            } else if (ri.title === 'Pro') {
                // Next: Maestro
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=150000, c2=(s.totalCorrect||0)>=700, c3=(s.perfectGames||0)>=5;
                const c4=(s.gamesPlayed||0)>=60, c5=(s.maxMult||1)>=4, c6=(s.maxStreak||0)>=20;
                const c7=acc2>=65, c8=(s.achievements||[]).length>=30;
                condHtml = `<span style="color:#ff2a5f;font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: MAESTRO</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/150,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/700</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/5</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/60</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x4</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/20</span> &nbsp;`+
                    `<span style="${c7?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/65%</span> &nbsp;`+
                    `<span style="${c8?'color:var(--accent-green)':'color:var(--text-secondary)'}">Logros ${(s.achievements||[]).length}/30</span>`;
            } else if (ri.title === 'Maestro') {
                // Next: Leyenda
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=400000, c2=(s.totalCorrect||0)>=1800, c3=(s.perfectGames||0)>=15;
                const c4=(s.gamesPlayed||0)>=120, c5=(s.maxMult||1)>=5, c6=(s.maxStreak||0)>=28;
                const c7=acc2>=70, c8=(s.achievements||[]).length>=80;
                condHtml = `<span style="color:#b5179e;font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: LEYENDA</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/400,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/1,800</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/15</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/120</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x5</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/28</span> &nbsp;`+
                    `<span style="${c7?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/70%</span> &nbsp;`+
                    `<span style="${c8?'color:var(--accent-green)':'color:var(--text-secondary)'}">Logros ${(s.achievements||[]).length}/80</span>`;
            } else if (ri.title === 'Leyenda') {
                // Next: Eterno
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=700000, c2=(s.totalCorrect||0)>=3200, c3=(s.perfectGames||0)>=30;
                const c4=(s.achievements||[]).length>=160, c5=(s.maxStreak||0)>=35, c6=(s.maxMult||1)>=6;
                const c7=acc2>=78, c8=(s.gamesPlayed||0)>=200;
                condHtml = `<span style="color:#6600ff;font-weight:700;font-size:0.62rem;letter-spacing:1px;text-shadow:0 0 8px rgba(102,0,255,0.5);">-- SIGUIENTE: ETERNO --</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/700,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/3,200</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/30</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Logros ${(s.achievements||[]).length}/160</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/35</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x6</span> &nbsp;`+
                    `<span style="${c7?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/78%</span> &nbsp;`+
                    `<span style="${c8?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/200</span>`;
            } else if (ri.title === 'Eterno') {
                // Next: Mítico — requisitos extremos
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=1200000, c2=(s.totalCorrect||0)>=5500, c3=(s.perfectGames||0)>=55;
                const c4=(s.achievements||[]).length>=280, c5=(s.maxStreak||0)>=45, c6=(s.maxMult||1)>=8;
                const c7=acc2>=85, c8=(s.gamesPlayed||0)>=320;
                condHtml = `<span style="color:#ff9500;font-weight:700;font-size:0.62rem;letter-spacing:1px;text-shadow:0 0 8px rgba(255,149,0,0.5);">-- SIGUIENTE: MÍTICO --</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/1,200,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/5,500</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/55</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Logros ${(s.achievements||[]).length}/280</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/45</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x8</span> &nbsp;`+
                    `<span style="${c7?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/85%</span> &nbsp;`+
                    `<span style="${c8?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/320</span>`;
            } else {
                condHtml = `<span style="color:#ff9500;font-weight:700;font-size:0.62rem;text-shadow:0 0 10px rgba(255,149,0,0.6);">-- RANGO MÍTICO ALCANZADO --</span>`;
            }
            nextEl.innerHTML = condHtml;
        }
        const accEl=document.getElementById('pl-accuracy-pct');
        if(accEl) accEl.innerText=`Precisión: ${accuracy}%`;
    })();
    renderAchievements(); switchScreen('profile-screen');
    if (needsName) setTimeout(() => { document.getElementById('profile-name-input').focus(); document.getElementById('profile-name-input').classList.add('shake'); setTimeout(() => document.getElementById('profile-name-input').classList.remove('shake'), 400); }, 400);
}


function _renderMiticoTitleSelector() {
    // Remove any existing selector
    const existing = document.getElementById('mitico-title-selector');
    if (existing) existing.remove();

    // Admin nunca tiene selector de títulos — su título es fijo: Arquitecto del Sistema
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') return;

    const isMitico = MITICO_TITLE_RANKS.has(currentRankInfo.title);
    const isEterno = ETERNO_TITLE_RANKS.has(currentRankInfo.title);
    if (!isMitico && !isEterno) return;

    // Get unlocked titles — Mítico can equip both Eterno and Mítico titles
    const achSet = new Set(playerStats.achievements || []);
    const allTitleMaps = isMitico
        ? [...ETERNO_TITLES.entries(), ...MITICO_TITLES.entries()]
        : [...ETERNO_TITLES.entries()];
    const unlocked = allTitleMaps.filter(([id]) => achSet.has(id));
    if (unlocked.length === 0) return; // no titles unlocked yet

    const rankDisplay = document.getElementById('profile-rank-display');
    if (!rankDisplay) return;

    const current = playerStats.equippedTitle || null;
    const rankColor = currentRankInfo.color;
    const isLight = document.body.classList.contains('light-mode');

    // Colores adaptativos según tema — evita texto blanco sobre fondo blanco en modo claro
    const _borderBase    = isLight ? 'rgba(0,0,0,0.22)'  : 'rgba(255,255,255,0.25)';
    const _bgActive      = isLight ? 'rgba(0,0,0,0.10)'  : 'rgba(255,255,255,0.15)';
    const _colorActive   = isLight ? '#000000'            : '#ffffff';
    const _colorInactive = isLight ? 'rgba(0,0,0,0.45)'  : 'rgba(255,255,255,0.45)';
    const _labelColor    = isLight ? 'rgba(0,0,0,0.35)'  : 'rgba(255,255,255,0.4)';

    const defaultLabel = currentRankInfo.title;
    let chipsHtml = `<button onclick="_equipMiticoTitle(null)" style="
        padding:3px 9px; border-radius:20px; font-size:0.55rem; font-weight:700;
        letter-spacing:0.8px; cursor:pointer; border:1px solid ${_borderBase};
        background:${!current ? _bgActive : 'transparent'};
        color:${!current ? _colorActive : _colorInactive};
        transition:all 0.2s;">${defaultLabel}</button>`;

    for (const [id, label] of unlocked) {
        const isActive = current === id;
        const _borderA  = isLight ? `rgba(0,0,0,${isActive ? '0.6' : '0.18'})` : `rgba(255,255,255,${isActive ? '0.8' : '0.2'})`;
        chipsHtml += `<button onclick="_equipMiticoTitle('${id}')" style="
            padding:3px 9px; border-radius:20px; font-size:0.55rem; font-weight:700;
            letter-spacing:0.8px; cursor:pointer;
            border:1px solid ${_borderA};
            background:${isActive ? _bgActive : 'transparent'};
            color:${isActive ? _colorActive : _colorInactive};
            text-shadow:${isActive ? `0 0 8px rgba(${currentRankInfo.rgb},0.6)` : 'none'};
            transition:all 0.2s;">${label}</button>`;
    }

    const selector = document.createElement('div');
    selector.id = 'mitico-title-selector';
    selector.style.cssText = 'display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-top:6px;';
    selector.innerHTML = `
        <span style="font-size:0.5rem;font-weight:600;letter-spacing:1px;color:${_labelColor};text-transform:uppercase;">Título</span>
        ${chipsHtml}`;
    rankDisplay.insertAdjacentElement('afterend', selector);
}

function _equipMiticoTitle(id) {
    SFX.click();
    // Validar que el jugador aún tiene el logro antes de equiparlo
    if (id && !playerStats.achievements.includes(id)) return;
    playerStats.equippedTitle = id || null;
    saveStatsDebounced();
    submitLeaderboard();
    _renderMiticoTitleSelector();
    // Update rank display to show new title (with theme-aware color)
    const rankDisplay = document.getElementById('profile-rank-display');
    if (rankDisplay) {
        const label = id
            ? (MITICO_TITLES.get(id) || ETERNO_TITLES.get(id) || currentRankInfo.title)
            : currentRankInfo.title;
        rankDisplay.innerText = `Rango: ${label}`;
        const _isLightEq = document.body.classList.contains('light-mode');
        rankDisplay.style.color = _isLightEq ? darkenHex(currentRankInfo.color, 0.4) : currentRankInfo.color;
    }
}

function showOnboarding(onComplete) {
    playerStats.hasSeenOnboarding = true;
    saveStatsLocally();

    // ── Contenedor ────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#04040a;display:flex;align-items:center;justify-content:center;overflow:hidden;';
    document.body.appendChild(overlay);

    // ── Canvas de partículas (creado aparte para no ser destruido) ─
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    overlay.appendChild(canvas);

    // ── Panel central (nunca se recrea, solo su contenido) ─────────
    const panel = document.createElement('div');
    panel.style.cssText = 'position:relative;z-index:1;width:min(400px,88vw);display:flex;flex-direction:column;align-items:center;text-align:center;';
    overlay.appendChild(panel);

    // ── Slides ────────────────────────────────────────────────────
    const slides = [
        { tag:'INICIO',    title:'Bienvenido a Klick',
          body:'Responde preguntas correctamente para ganar puntos. Tienes <strong style="color:var(--accent-red)">3 vidas</strong>. Si las pierdes todas, la partida termina.',
          note: null },
        { tag:'TIEMPO',    title:'El Cronómetro',
          body:'Cada pregunta dura entre <strong style="color:var(--accent-blue)">15 y 30 segundos</strong>. Responder más rápido genera más puntos por tiempo restante.',
          note: null },
        { tag:'COMBO',     title:'Multiplicador de Puntos',
          body:'Cada <strong style="color:var(--accent-yellow)">5 aciertos consecutivos</strong> suben tu multiplicador de x1 hasta x10. Un error o timeout lo reinicia a x1.',
          note: null },
        { tag:'RULETA',    title:'La Ruleta',
          body:'Cada <strong style="color:var(--accent-purple)">10 aciertos</strong> en una partida activas la ruleta. Obtén vidas extra, escudos, multiplicadores y más.',
          note: null },
        { tag:'PASE',      title:'Klick Pass',
          body:'100 niveles con misiones progresivas. Completar cada nivel otorga <strong style="color:var(--accent-yellow)">Pinceles</strong>, la moneda del pase.',
          note: 'Premio total acumulado: 100,000 Pinceles' },
        { tag:'PROGRESO',  title:'Logros y Rangos',
          body:'Más de <strong style="color:var(--accent-orange)">300 logros</strong> desbloqueables jugando y explorando. Tu <strong style="color:var(--rank-color)">Rango</strong> y <strong style="color:var(--rank-color)">Power Level</strong> suben con tus estadísticas.',
          note: null },
    ];
    const N = slides.length;
    let current = 0;

    // ── Musica suave de fondo ──────────────────────────────────────
    let _obNodes = [];
    function _startMusic() {
        try {
            if (!audioCtx) return;
            const t = audioCtx.currentTime;
            const gMaster = audioCtx.createGain();
            gMaster.gain.setValueAtTime(0, t);
            gMaster.gain.linearRampToValueAtTime(0.04, t + 1.8);
            gMaster.connect(masterMusicGain || audioCtx.destination);
            _obNodes.push(gMaster);
            [[261.6, 329.6, 392.0],[293.7, 369.9, 440.0],[246.9, 311.1, 369.9],[261.6, 329.6, 392.0]].forEach((chord, ci) => {
                chord.forEach(freq => {
                    const osc = audioCtx.createOscillator();
                    const g   = audioCtx.createGain();
                    const d   = 3.4;
                    osc.type = 'sine'; osc.frequency.value = freq;
                    g.gain.setValueAtTime(0, t + ci*d);
                    g.gain.linearRampToValueAtTime(0.38, t + ci*d + 0.9);
                    g.gain.setValueAtTime(0.38, t + ci*d + d - 0.7);
                    g.gain.linearRampToValueAtTime(0, t + ci*d + d);
                    osc.connect(g); g.connect(gMaster);
                    osc.start(t + ci*d); osc.stop(t + ci*d + d + 0.1);
                    _obNodes.push(osc, g);
                });
            });
        } catch(e) {}
    }
    function _stopMusic() {
        try { _obNodes.forEach(n => { try { if(n.gain){n.gain.cancelScheduledValues(audioCtx.currentTime);n.gain.linearRampToValueAtTime(0,audioCtx.currentTime+0.3);} if(n.stop)n.stop(audioCtx.currentTime+0.4); } catch(e){} }); } catch(e){}
        _obNodes = [];
    }

    // ── Particulas ────────────────────────────────────────────────
    let _raf = 0;
    function _startParticles() {
        const ctx = canvas.getContext('2d');
        canvas.width  = overlay.offsetWidth  || window.innerWidth;
        canvas.height = overlay.offsetHeight || window.innerHeight;
        const W = canvas.width, H = canvas.height;
        const PAL = ['#00ff66','#00d4ff','#b5179e','#ff2a5f','#ffb800','#aaaaff'];
        const pts = Array.from({length:55},()=>({
            x:Math.random()*W, y:Math.random()*H,
            r:Math.random()*1.5+0.3,
            vx:(Math.random()-0.5)*0.28, vy:(Math.random()-0.5)*0.28,
            c:PAL[Math.floor(Math.random()*PAL.length)],
            a:Math.random()*0.38+0.12, p:Math.random()*Math.PI*2
        }));
        function tick() {
            ctx.clearRect(0,0,W,H);
            pts.forEach(p => {
                p.x+=p.vx; p.y+=p.vy; p.p+=0.014;
                if(p.x<0)p.x=W; if(p.x>W)p.x=0;
                if(p.y<0)p.y=H; if(p.y>H)p.y=0;
                ctx.globalAlpha = p.a*(0.55+0.45*Math.sin(p.p));
                ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
                ctx.fillStyle=p.c; ctx.fill();
            });
            ctx.globalAlpha=1;
            _raf = requestAnimationFrame(tick);
        }
        tick();
    }
    function _stopParticles() { cancelAnimationFrame(_raf); }

    // ── Render ────────────────────────────────────────────────────
    function render() {
        const s      = slides[current];
        const isLast = current === N - 1;

        const dots = slides.map((_,i) =>
            `<div style="width:${i===current?'20px':'6px'};height:6px;border-radius:3px;background:${i===current?'var(--rank-color)':'rgba(255,255,255,0.13)'};transition:all 0.3s ease;flex-shrink:0;"></div>`
        ).join('');

        panel.innerHTML = `
            <div style="display:flex;gap:5px;align-items:center;justify-content:center;margin-bottom:22px;">${dots}</div>

            <div style="padding:2px 11px;border-radius:20px;border:1px solid rgba(var(--rank-rgb),0.35);background:rgba(var(--rank-rgb),0.07);font-size:0.58rem;font-weight:900;letter-spacing:2.5px;color:var(--rank-color);text-transform:uppercase;margin-bottom:14px;">${s.tag}</div>

            <div style="font-size:clamp(1.3rem,3.5vw,1.85rem);font-weight:900;color:var(--text-primary);letter-spacing:-0.5px;line-height:1.15;margin-bottom:12px;">${s.title}</div>

            <!-- Zona de contenido con altura fija para evitar saltos -->
            <div style="width:min(320px,82vw);min-height:110px;display:flex;flex-direction:column;justify-content:flex-start;margin-bottom:18px;">
                <div style="font-size:clamp(0.82rem,2vw,0.9rem);color:var(--text-secondary);line-height:1.75;font-weight:500;">${s.body}</div>
                ${s.note ? `<div style="margin-top:10px;padding:8px 13px;border-radius:10px;background:rgba(var(--rank-rgb),0.07);border:1px solid rgba(var(--rank-rgb),0.22);font-size:0.68rem;font-weight:700;color:var(--rank-color);letter-spacing:0.2px;">${s.note}</div>` : ''}
            </div>

            <!-- Zona de botones con altura fija para que no haya salto -->
            <div style="width:min(320px,82vw);height:52px;display:grid;grid-template-columns:${current>0?'1fr 2fr':'1fr'};gap:10px;align-items:center;">
                ${current>0?`<button id="ob-prev" style="height:46px;border-radius:12px;cursor:pointer;background:transparent;border:1.5px solid rgba(255,255,255,0.1);color:var(--text-secondary);font-size:0.78rem;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Atrás</button>`:''}
                <button id="ob-next" style="height:46px;border-radius:12px;cursor:pointer;background:rgba(var(--rank-rgb),0.13);border:1.5px solid rgba(var(--rank-rgb),0.48);color:var(--rank-color);font-size:0.84rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;">${isLast?'¡Jugar!':'Siguiente'}</button>
            </div>

            <button id="ob-skip" style="margin-top:12px;background:none;border:none;color:rgba(255,255,255,0.2);font-size:0.64rem;cursor:pointer;font-weight:600;letter-spacing:0.4px;padding:4px 8px;">Saltar introducción</button>
        `;

        const next = panel.querySelector('#ob-next');
        const prev = panel.querySelector('#ob-prev');
        const skip = panel.querySelector('#ob-skip');
        if (next) next.onclick = () => {
            try { initAudio(); SFX.click(); } catch(e) {}
            if (isLast) { _stopParticles(); _stopMusic(); overlay.remove(); onComplete(); }
            else { current++; render(); }
        };
        if (prev) prev.onclick = () => { try { SFX.click(); } catch(e){} current--; render(); };
        if (skip) skip.onclick = () => { _stopParticles(); _stopMusic(); overlay.remove(); onComplete(); };
    }

    // ── Arrancar ──────────────────────────────────────────────────
    requestAnimationFrame(() => {
        _startParticles();
        try { initAudio(); _startMusic(); } catch(e) {}
        render();
    });
}
let _startGameCheckPending = false; // anti-glitch: evitar doble tap en Jugar
async function startGameCheck() {
    if (_startGameCheckPending) return; // anti-glitch
    _startGameCheckPending = true;
    setTimeout(() => { _startGameCheckPending = false; }, 1200); // liberar tras 1.2s
    // iOS/Safari: AudioContext MUST be resumed synchronously inside a user gesture handler
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR") { 
        SFX.incorrect(); goToProfile(true); 
        return;
    }

    // KLICK SHIELD: verificar ban activo antes de permitir jugar
    if (_ksCheckBanOnStart()) {
        _ksShowBanScreen();
        return;
    }

    // Onboarding: mostrar tutorial en la primera partida de un jugador nuevo
    if (!playerStats.hasSeenOnboarding && (playerStats.gamesPlayed || 0) === 0) {
        showOnboarding(() => startGameCheck());
        return;
    }

    // ── KLICK SHIELD: verificaciones pre-partida ──────────────────────────
    const _ksE = (msg) => { showToast('No se puede iniciar', msg, 'var(--accent-red)', SVG_LOCK); };
    const _sm  = window.screen.width <= 430;
    if (document.visibilityState === 'hidden' || document.hidden)
        { _ksE('La ventana no está activa.'); return; }
    if (!document.hasFocus())
        { _ksE('La ventana no tiene el foco.'); return; }
    if (document.pictureInPictureElement ||
        (typeof documentPictureInPicture !== 'undefined' && documentPictureInPicture.window))
        { _ksE('Desactiva Picture-in-Picture.'); return; }
    if (window.speechSynthesis && (window.speechSynthesis.speaking || window.speechSynthesis.pending))
        { _ksE('Desactiva el lector de voz del sistema.'); return; }
    if ((window._ksActiveMicTracks||[]).some(t => t.readyState === 'live'))
        { _ksE('Desactiva el micrófono antes de jugar.'); return; }
    if (!_sm) {
        const _wR = window.innerWidth  / window.screen.width;
        const _hR = window.innerHeight / window.screen.height;
        if (_wR < 0.52) { _ksE('Maximiza la ventana para jugar.'); return; }
        if (_hR < 0.42) { _ksE('Maximiza la ventana para jugar.'); return; }
        if (!_KS_IS_IPAD) {
            const _sx = window.screenX || window.screenLeft || 0;
            const _sy = window.screenY || window.screenTop  || 0;
            if (_sx > window.screen.width  * 0.42) { _ksE('Ventana en posición no permitida.'); return; }
            if (_sy > window.screen.height * 0.38) { _ksE('Ventana en posición no permitida.'); return; }
        }
    }
    if (window.visualViewport) {
        if (window.visualViewport.scale > 1.5)
            { _ksE('Desactiva el zoom de pantalla.'); return; }
        if (window.visualViewport.width < window.innerWidth * 0.68)
            { _ksE('Cierra el panel lateral antes de jugar.'); return; }
    }
    if (!_sm && !_KS_IS_IPAD &&
        ((window.outerWidth - window.innerWidth) > 200 || (window.outerHeight - window.innerHeight) > 200))
        { _ksE('Cierra las herramientas del desarrollador.'); return; }
    // 3-point overlay check
    (function() {
        const _app = document.getElementById('app');
        if (!_app) return;
        const _gr  = _app.getBoundingClientRect();
        const _pts = [
            [_gr.left + _gr.width * 0.50, _gr.top + _gr.height * 0.60],
            [_gr.left + _gr.width * 0.25, _gr.top + _gr.height * 0.65],
            [_gr.left + _gr.width * 0.75, _gr.top + _gr.height * 0.65],
        ];
        for (const [_px, _py] of _pts) {
            const _top = document.elementFromPoint(_px, _py);
            if (_top && !_app.contains(_top) && _top !== document.body && _top !== document.documentElement) {
                _ksE('Hay un elemento externo sobre el juego.'); return;
            }
        }
    })();
    // ── Fin verificaciones pre-partida ────────────────────────────────────

    if (quizDataPool.length === 0) {
        const btn = document.querySelector('.btn-solid');
        const originalText = btn.innerText;
        btn.innerText = "Cargando..."; btn.style.opacity = "0.7";
        await loadQuestions();
        btn.innerText = originalText; btn.style.opacity = "1";
    }
    startGame(); 
}

document.getElementById('profile-name-input').addEventListener('input', e => { 
    // Solo letras, números y un espacio entre palabras (máx 2 palabras)
    let val = e.target.value.replace(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ ]/g, '').toUpperCase();
    // Máximo 2 palabras: eliminar espacios extra y evitar más de un espacio
    val = val.replace(/  +/g, ' '); // colapsar múltiples espacios
    const words = val.split(' ').filter(w => w.length > 0);
    if (words.length > 2) { val = words.slice(0, 2).join(' '); }
    // Si termina con espacio y ya hay 2 palabras, no permitir más espacios
    if (words.length >= 2 && val.endsWith(' ')) val = val.trimEnd();
    // Nombre reservado — asignar UUID canónico al vuelo para que el admin pueda escribirlo
    // en cualquier dispositivo, incluso si aún tiene UUID aleatorio.
    // La protección real contra suplantación ocurre en el servidor (UUID verificado allí).
    if (val.trim() === 'CHRISTOPHER') {
        playerStats.uuid = '00000000-spec-tral-0000-klickphantom0';
    }
    e.target.value = val;
    document.getElementById('profile-warning').style.opacity = val ? '0' : '1'; 
});
document.getElementById('profile-name-input').addEventListener('change', e => { 
    const n = e.target.value.trim();
    // Nombre reservado: si alguien sin el UUID canónico intenta guardar CHRISTOPHER, revertir
    if (n === 'CHRISTOPHER' && playerStats.uuid !== '00000000-spec-tral-0000-klickphantom0') {
        e.target.value = playerStats.playerName !== 'JUGADOR' ? playerStats.playerName : '';
        return;
    }
    // nameChanges solo se incrementa en 'blur' para evitar doble conteo (change+blur ambos disparan en desktop)
    playerStats.playerName = n || "JUGADOR";
    saveStatsLocally(); checkAchievements(); 
    submitLeaderboard();
});
document.getElementById('profile-name-input').addEventListener('keypress', function(e) { if(e.key === 'Enter') this.blur(); });
// iOS Safari: 'change' event fires late or not at all — use 'blur' explicitly
document.getElementById('profile-name-input').addEventListener('blur', function(e) {
    const n = e.target.value.trim();
    // Nombre reservado: si alguien sin el UUID canónico intenta guardar CHRISTOPHER, revertir
    if (n === 'CHRISTOPHER' && playerStats.uuid !== '00000000-spec-tral-0000-klickphantom0') {
        playerStats.uuid = generateUUID(); // restoreamos UUID aleatorio si no era admin
        e.target.value = playerStats.playerName !== 'JUGADOR' ? playerStats.playerName : '';
        document.getElementById('profile-warning').style.opacity = e.target.value ? '0' : '1';
        return;
    }
    if(n && n !== "JUGADOR" && n !== playerStats.playerName) { playerStats.nameChanges++; }
    playerStats.playerName = n || "JUGADOR";
    // Si nombre es CHRISTOPHER, fijar UUID canónico permanentemente
    if (playerStats.playerName === 'CHRISTOPHER') {
        playerStats.uuid = '00000000-spec-tral-0000-klickphantom0';
    }
    saveStatsLocally(); checkAchievements();
    submitLeaderboard();
    document.getElementById('profile-warning').style.opacity = n ? '0' : '1';
});


function updateLogoDots() {
    // Siempre recalcular desde playerStats para evitar desfases entre llamadas
    currentRankInfo = getRankInfo(playerStats);
    document.documentElement.style.setProperty('--rank-rgb', currentRankInfo.rgb);
    document.documentElement.style.setProperty('--rank-color', currentRankInfo.color);
    const isLight = document.body.classList.contains('light-mode');
    // Nunca cachear — el logo-dot es estático pero sin caché no hay riesgo de color obsoleto
    const dots = document.querySelectorAll('.logo-dot');
    const shadow = isLight ? 'none' : `0 0 15px rgba(${currentRankInfo.rgb}, 0.5)`;
    for (let i = 0; i < dots.length; i++) {
        dots[i].style.color = currentRankInfo.color;
        dots[i].style.textShadow = shadow;
    }
    const favicon = document.getElementById('dynamic-favicon');
    if (favicon) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(${currentRankInfo.rgb})' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon></svg>`;
        favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
    const themeColor = document.getElementById('meta-theme-color');
    if (themeColor) themeColor.setAttribute('content', currentRankInfo.color);
}

// --- Game Logic ---
let currentSessionQuestions = [], currentQuestionIndex = 0, score = 0, streak = 0, currentMaxStreak = 0, timerInterval, timeLeft = 15;
let _gameSessionId = 0; // increments each game/abandon to invalidate stale callbacks
let _currentQuestion = null; // Pregunta activa (almacenada por motor, leída por selectAnswer/applyHintVisual) 
let _gameStartHour = -1; // hora al inicio de partida — se valida al terminar
const TIMER_LIMIT = 15;
let _gameStatsRecorded = false; // guard: saveGameStats solo cuenta una vez por partida
let _perfectThisGame  = false;  // se activa cuando la partida llega a 5 correctas sin error
let currentFastAnswers = 0, currentWrongAnswers = 0, currentTimeoutAnswers = 0, isAnsweringAllowed = false, currentGameLog = [];
let isGamePaused = false;
let lives = 3;
let multiplier = 1;
let _currentGameMaxMult = 1;
let lastSecondAnswers = 0; 
let ultraFastStreak = 0;   
let currentNoTimeoutStreak = 0;
let livesLostThisGame = 0;
let consecutiveLivesLost = 0;  // for u19 Resurreccion tracking
let frenziesThisGame = 0;      // for extra1 Doble Frenesí

function startGame() {
    _gameSessionId++; // invalidate stale feedback timeouts
    initAudio(); SFX.gameStart();
    // Botón físico "Atrás" de Android/PWA: empujar estado para capturar popstate
    try { history.pushState({ klickGame: true }, ''); } catch(e) {}
    
    // Track same-track-game streak for achievement
    const lastTrack = playerStats.lastGameTrack || '';
    const curTrack = playerStats.selectedTrack || 'track_chill';
    // Always register current track as tried
    if (!playerStats.tracksTriedSet) playerStats.tracksTriedSet = [];
    if (!playerStats.tracksTriedSet.includes(curTrack)) playerStats.tracksTriedSet.push(curTrack);
    if (playerStats.tracksTriedSet.length >= 3) playerStats.triedAllTracks = true;
    if (lastTrack === curTrack) {
        playerStats.sameTrackGames = (playerStats.sameTrackGames || 0) + 1;
    } else {
        playerStats.sameTrackGames = 1;
    }
    playerStats.lastGameTrack = curTrack;
    
    const hora = new Date().getHours();
    // Guardamos la hora de inicio para validarla al terminar la partida (evitar falsos positivos)
    _gameStartHour = hora;
    
    const todayStr2 = new Date().toISOString().split('T')[0];
    if(!playerStats.totalDaysPlayed) playerStats.totalDaysPlayed = 0;
    if(!playerStats.lastPlayedDay || playerStats.lastPlayedDay !== todayStr2) {
        // Day changed — reset daily counters before assigning new date
        // This covers page-left-open-overnight: processDailyLogin ran yesterday,
        // but this is the first game of a new day.
        if (playerStats.lastPlayedDay && playerStats.lastPlayedDay !== todayStr2) {
            playerStats.todayGames = 0;
            playerStats.dailyAchUnlocks = 0;
        }
        playerStats.lastPlayedDay = todayStr2;
        playerStats.totalDaysPlayed++;
    }
    
    document.getElementById('player-name-display').innerText = playerStats.playerName; 
    document.getElementById('final-name').innerText = playerStats.playerName;
    
      currentSessionQuestions = [];
      _currentQuestion = null;
    _qeResetGame();                        // reordena el pool respetando la tail inter-partida
    currentQuestionIndex = score = streak = currentMaxStreak = currentFastAnswers = currentWrongAnswers = currentTimeoutAnswers = 0;
    isAnsweringAllowed = false; // reset defensivo: asegura estado limpio antes del countdown
    _gameStatsRecorded = false; // reset guard: permite que saveGameStats corra una vez por partida
    _perfectThisGame  = false;  // reset: nueva partida limpia
    _timerPath = _timerText = _scoreEl = _streakEl = _multBadge = null; // reset DOM cache
    _gTimerPath = _gTimerText = _gQuestionEl = _gAnswerBtns = _gAnswersGrid = _gStreakDisp = null; _gAns = []; // reset game DOM cache
      _appEl = null;
    currentGameLog = []; isGamePaused = false;
    lives = 3; multiplier = 1; _currentGameMaxMult = 1;
    lastSecondAnswers = 0; ultraFastStreak = 0; currentNoTimeoutStreak = 0; livesLostThisGame = 0; consecutiveLivesLost = 0; frenziesThisGame = 0;
    // Reset roulette state for new game
    totalCorrectThisGame = 0; nextRouletteTrigger = 10;
    // Capturar tamaño de ventana al inicio (para detectar resize a pantalla dividida mid-game)
    _gameWindowW = window.innerWidth;
    _ksReset(); // KLICK SHIELD: reset acumulador al iniciar partida
    _gameWindowH = window.innerHeight;
    // Arrancar polling anti-trampa
    _startAntiCheatPoll();
    activeBoostNextQ = null; shieldActive = false; hintActive = false; extraTimeActive = 0; streakShieldActive = false;
    const arb = document.getElementById('active-reward-bar'); if(arb) arb.style.display = 'none';
    
    document.getElementById('lives-container').style.display = 'flex';
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('score-display').innerText = 0;
    updateLivesUI(); updateMultiplierUI(); updateStreakVisuals();
    
    showCountdown(() => {
        switchScreen('question-screen');
        setTimeout(loadQuestion, 200);
    });
}

function showCountdown(callback) {
    switchScreen('countdown-screen');
    const numEl = document.getElementById('countdown-number');
    const lblEl = document.getElementById('countdown-label');
    const steps = [
        { text: '3', label: 'Prepárate...' },
        { text: '2', label: '¡Concéntrate!' },
        { text: '1', label: '¡Ya casi!' },
        { text: '¡YA!', label: '' }
    ];
    let i = 0;
    function tick() {
        if (i >= steps.length) { callback(); return; }
        numEl.style.transform = 'scale(0.5)'; numEl.style.opacity = '0';
        lblEl.style.opacity = '0';
        setTimeout(() => {
            numEl.textContent = steps[i].text;
            lblEl.textContent = steps[i].label;
            numEl.style.transform = 'scale(1)'; numEl.style.opacity = '1';
            lblEl.style.opacity = '1';
            SFX.tick();
            i++;
            setTimeout(tick, i < steps.length ? 800 : 400);
        }, 150);
    }
    tick();
}

function updateLivesUI() {
    const c = document.getElementById('lives-container');
    c.innerHTML = '';
    for(let i = 0; i < 3; i++) {
        let el = document.createElement('div');
        el.innerHTML = SVG_BOLT;
        if(i >= lives) el.classList.add('life-lost');
        c.appendChild(el);
    }
}

function updateMultiplierUI() {
    const b = document.getElementById('multiplier-badge');
    multiplier = Math.min(10, Math.max(1, Math.floor(streak / 5) + 1));
    if(multiplier > (playerStats.maxMult||1)) { playerStats.maxMult = multiplier; }
    if(multiplier > _currentGameMaxMult) { _currentGameMaxMult = multiplier; }
    if(multiplier > 1) {
        b.style.display = 'block';
        b.innerText = `x${multiplier}`;
        const cls = multiplier <= 6 ? `mult-x${multiplier}` :
                    multiplier === 7 ? 'mult-x7' :
                    multiplier === 8 ? 'mult-x8' :
                    multiplier === 9 ? 'mult-x9' : 'mult-x10';
        b.className = 'multiplier-badge ' + cls;
    } else {
        b.style.display = 'none';
        b.className = 'multiplier-badge';
    }
}

let _appEl = null;
function updateStreakVisuals() { 
    if (!_appEl) _appEl = document.getElementById('app');
    const app = _appEl; 
    if (streak >= 5) { 
        if (!app.classList.contains('streak-active')) { app.classList.add('streak-active'); SFX.streakTrigger(); }
        // Efecto visual escalado según multiplicador alcanzado
        if (streak % 5 === 0) {
            triggerMultiplierEffect(multiplier);
        }
    } else app.classList.remove('streak-active'); 
}

function triggerMultiplierEffect(mult) {
    // Effects removed per user request — multiplier badge CSS handles visual feedback
}

// Smart question engine: tracks recently used questions to avoid repetition
// ══════════════════════════════════════════════════════════════════
//  MOTOR DE PREGUNTAS INTELIGENTE
//
//  Garantías:
//  • Nunca repite una pregunta hasta haber dado TODAS las del pool
//    (ciclo completo). Solo entonces vuelve a mezclar.
//  • Entre ciclos aplica una "zona de exclusión" igual al 40% del
//    pool: las últimas N preguntas del ciclo anterior no pueden ser
//    las primeras del siguiente.
//  • La primera pregunta de una nueva partida nunca coincide con
//    la última de la partida anterior (exclusión inter-partida).
//  • Clave de identidad = hash completo del texto (no los primeros
//    30 chars, que pueden colisionar).
//  • Sin estado global que se borre entre partidas —_qe persiste
//    durante toda la sesión de navegador.
// ══════════════════════════════════════════════════════════════════

const _qe = {
    // Pool completo (referencia a quizDataPool, se reasigna al cargar)
    pool: [],
    // Cola de preguntas del ciclo actual (pendientes de entregar)
    queue: [],
    // Conjunto de claves de las últimas N preguntas entregadas
    // (zona de exclusión inter-ciclo e inter-partida)
    tail: [],
    // Tamaño de la zona de exclusión (40% del pool, mín 20, máx 120)
    tailSize: 20,
    // Última clave entregada (evita primera === última)
    lastKey: '',
};

// Genera una clave única y compacta para una pregunta
function _qKey(q) {
    // Usar el texto completo hasheado (djb2) para evitar colisiones
    let h = 5381;
    const s = q.question;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) ^ s.charCodeAt(i);
        h = h >>> 0; // keep unsigned 32-bit
    }
    return h.toString(36);
}

// Inicializa / reinicia la cola cuando el pool cambia o se agota
function _qRefill(excludeSet) {
    const pool = _qe.pool;
    if (!pool.length) return;

    // Separar candidatos válidos (no en zona de exclusión) e inválidos
    const valid   = [];
    const invalid = [];
    for (let i = 0; i < pool.length; i++) {
        const k = _qKey(pool[i]);
        if (excludeSet && excludeSet.has(k)) invalid.push(pool[i]);
        else valid.push(pool[i]);
    }

    // Si los candidatos válidos son menos del 30% del pool, ignorar exclusión
    // (situación de pool muy pequeño — evitar bucle infinito)
    const useValid = valid.length >= Math.max(5, Math.floor(pool.length * 0.3));
    const source = useValid ? valid : [...pool];

    // Fisher-Yates shuffle
    for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [source[i], source[j]] = [source[j], source[i]];
    }

    // Si hay preguntas excluidas, añadirlas al final shuffleadas
    // (se verán al completar el ciclo válido, garantizando variedad)
    if (invalid.length) {
        for (let i = invalid.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [invalid[i], invalid[j]] = [invalid[j], invalid[i]];
        }
        _qe.queue = [...source, ...invalid];
    } else {
        _qe.queue = source;
    }
}

// Sincroniza el pool (llamada cuando quizDataPool se carga/cambia)
function _qeSync() {
    _qe.pool = quizDataPool;
    _qe.tailSize = Math.min(120, Math.max(20, Math.floor(quizDataPool.length * 0.4)));
    // Rellenar solo si la cola está vacía
    if (_qe.queue.length === 0) {
        _qRefill(new Set(_qe.tail));
    }
}

// Resetea el estado al inicio de partida (sin borrar la tail inter-partida)
function _qeResetGame() {
    // La tail se MANTIENE para que la primera pregunta de la nueva partida
    // no coincida con las últimas de la anterior.
    // Solo vaciamos la cola de ciclo actual para forzar reorden fresco.
    _qe.queue = [];
    const excludeSet = new Set(_qe.tail);
    _qRefill(excludeSet);
}

// Devuelve la siguiente pregunta garantizando no repetición
function getNextQuestion() {
    if (!_qe.pool.length) return null;

    // Si la cola se agotó, iniciar nuevo ciclo excluyendo la tail
    if (_qe.queue.length === 0) {
        _qRefill(new Set(_qe.tail));
    }

    // Sacar la primera pregunta de la cola
    const q = _qe.queue.shift();
    if (!q) return null;

    // Actualizar tail (ventana deslizante de exclusión)
    const key = _qKey(q);
    _qe.tail.push(key);
    if (_qe.tail.length > _qe.tailSize) _qe.tail.shift();
    _qe.lastKey = key;

    return q;
}

// Cached game DOM elements (reset each game in startGame)
let _gTimerPath = null, _gTimerText = null, _gQuestionEl = null, _gAnswerBtns = null, _gAnswersGrid = null, _gAns = [], _gStreakDisp = null;

function _warmGameDOMCache() {
    _gTimerPath   = document.getElementById('timer-path');
    _gTimerText   = document.getElementById('timer-display');
    _gQuestionEl  = document.getElementById('question-text');
    _gAnswerBtns  = document.querySelectorAll('.answer-btn');
    _gAnswersGrid = document.getElementById('answers-grid');
    _gAns         = [0,1,2,3].map(i => document.getElementById('ans-' + i));
    _gStreakDisp  = document.getElementById('streak-display');
}

function loadQuestion() {
    const currentQ = getNextQuestion();
    _currentQuestion = currentQ;
    if (!currentQ) { endGame(); return; } // Guard: pool vacío
    if (!_gTimerPath) _warmGameDOMCache();
    const timerPath  = _gTimerPath;
    const timerText  = _gTimerText;
    const questionEl = _gQuestionEl;
    const answerBtns = _gAnswerBtns;

    // ── Animación de entrada ──────────────────────────────────────────────
    // Reset forzado: quitar clases + deshabilitar animation + reflow + rehabilitar
    // Esto garantiza que la animación se reinicia aunque el nombre sea igual
    questionEl.classList.remove('q-enter', 'q-exit');
    answerBtns.forEach(btn => btn.classList.remove('q-enter', 'q-exit'));
    questionEl.style.animation = 'none';
    answerBtns.forEach(btn => { btn.style.animation = 'none'; });
    void questionEl.offsetWidth; // force reflow — limpia estado de animación anterior
    questionEl.style.animation = '';
    answerBtns.forEach(btn => { btn.style.animation = ''; });
    
    questionEl.innerText = currentQ.question;
    
    let mixedAnswers = currentQ.answers.map((text, idx) => ({ text: text, isCorrect: idx === currentQ.correctIndex }));
    mixedAnswers = shuffleArray(mixedAnswers);
    for(let i=0; i<4; i++) { 
        (_gAns[i]||document.getElementById(`ans-${i}`)).innerText = mixedAnswers[i].text;
        if (mixedAnswers[i].isCorrect) currentQ.currentCorrectIndex = i;
    }

    (_gAnswersGrid||document.getElementById('answers-grid')).classList.remove('answered'); 
    answerBtns.forEach(btn => { 
        btn.classList.remove('selected', 'hint-hidden'); 
        btn.style.opacity = ''; btn.style.pointerEvents = ''; btn.style.filter = '';
    });

    // Lanza animación escalonada
    questionEl.classList.add('q-enter');
    answerBtns.forEach((btn, i) => {
        btn.style.setProperty('--q-dur',   '0.4s');
        btn.style.setProperty('--q-delay', `${0.06 + i * 0.055}s`);
        btn.classList.add('q-enter');
    });
    
    // Apply extra time from roulette
    let questionTime = TIMER_LIMIT;
    // Preguntas largas (> 120 chars) → 30s; medianas (80-120) → 20s
    if (currentQ.question && currentQ.question.length > 120) {
        questionTime = 30;
    } else if (currentQ.question && currentQ.question.length > 80) {
        questionTime = 20;
    }
    // Guardar el tiempo límite de esta pregunta para normalizar el score
    currentQ._timeLimit = questionTime;
    if (extraTimeActive) { questionTime += extraTimeActive; extraTimeActive = 0; updateRewardIndicator(); }
    isAnsweringAllowed = true; isGamePaused = false; timeLeft = questionTime; timerText.innerText = timeLeft;
    _ksMarkQuestionStart(); // KLICK SHIELD: inicio de timing de respuesta
    
    timerText.classList.remove('timer-urgent'); // limpiar urgencia de pregunta anterior
    timerPath.style.transition = 'none'; timerPath.style.strokeDashoffset = '0'; timerPath.style.stroke = 'var(--text-primary)'; timerText.style.color = 'var(--text-primary)'; void timerPath.offsetWidth; timerPath.style.transition = 'stroke-dashoffset 1s linear, stroke 0.3s ease';
    
    const timerTotal = questionTime;
    const _timerStart = performance.now();
    let _timerLastTick = timeLeft;  // para detectar cuando hay que actualizar
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        // Timer 100% autónomo: no depende de isGamePaused.
        // La ruleta pausa llamando clearInterval; al cerrar, loadQuestion recrea el timer.
        // El modal de salir no toca el timer en absoluto.
        const elapsed = (performance.now() - _timerStart) / 1000;
        const remaining = Math.max(0, timerTotal - Math.floor(elapsed));
        if (remaining === _timerLastTick) return; // sin cambio — evitar renders y ticks innecesarios
        _timerLastTick = remaining;
        timeLeft = remaining;
        timerText.innerText = timeLeft;
        timerPath.style.strokeDashoffset = 283 - (timeLeft / timerTotal) * 283; 
        if (timeLeft <= 5 && timeLeft > 0) { SFX.tick(); timerPath.style.stroke = 'var(--accent-red)'; timerText.style.color = 'var(--accent-red)'; }
        if (timeLeft <= 3 && timeLeft > 0) {
            timerText.classList.add('timer-urgent');
            if (navigator.vibrate) navigator.vibrate(50);
        } else {
            timerText.classList.remove('timer-urgent');
        }
        if (timeLeft <= 0) handleTimeout(); 
    }, 250); // poll cada 250ms — reacciona al segundo exacto sin drift
}

function selectAnswer(selectedIndex) {
    if (!isAnsweringAllowed || isGamePaused) return; isAnsweringAllowed = false; clearInterval(timerInterval); SFX.select();
    (_gAnswersGrid||document.getElementById('answers-grid')).classList.add('answered'); (_gAnswerBtns ? _gAnswerBtns[selectedIndex] : document.querySelectorAll('.answer-btn')[selectedIndex]).classList.add('selected');
    
    const q = _currentQuestion;
    if (!q) return;
    const isCorrect = (selectedIndex === q.currentCorrectIndex);
    try { _ksRecordAnswer(isCorrect); } catch(e) {} // KLICK SHIELD: timing 
    const answerTime = timeLeft;
    currentGameLog.push({ correct: isCorrect, time: answerTime, category: q.category || q.type || null });
    
    if(isCorrect) { 
        playerStats.totalCorrect++; 
        const _qTimeLimit = (q && q._timeLimit) || TIMER_LIMIT;
        // Respuesta rápida: basada en tiempo límite normalizado a 15s para evitar
        // falsos positivos en preguntas largas (20s/30s). Un acierto cuenta como
        // "rápido" solo si la fracción de tiempo consumida es <= la misma fracción
        // que 13/15 sobre el tiempo base de 15s (últimos 2s del límite normalizado).
        const _fastThreshold = Math.round(_qTimeLimit - (2 / TIMER_LIMIT) * _qTimeLimit);
        if(answerTime >= _fastThreshold) { currentFastAnswers++; playerStats.fastAnswersTotal++; }
        if(answerTime <= 1) { lastSecondAnswers++; playerStats.flashAnswersTotal = (playerStats.flashAnswersTotal||0) + 1; }
        if(answerTime >= _qTimeLimit - 3) { ultraFastStreak++; } else { ultraFastStreak = 0; }
        currentNoTimeoutStreak++;
        if(answerTime <= 2) playerStats.lastSecondAnswersTotal = (playerStats.lastSecondAnswersTotal||0) + 1;
        if(currentNoTimeoutStreak > (playerStats.maxNoTimeoutStreak||0)) playerStats.maxNoTimeoutStreak = currentNoTimeoutStreak;
    } else { 
        playerStats.totalWrong++; currentWrongAnswers++;
        ultraFastStreak = 0; currentNoTimeoutStreak = 0;
    }
    
    saveStatsDebounced(); setTimeout(() => showFeedback(isCorrect), 600);
}

function applyHintVisual() {
    const q = _currentQuestion;
    if (!q) return;
    const correctIdx = q.currentCorrectIndex;
    const btns = _gAnswerBtns || document.querySelectorAll('.answer-btn');

    // Primero limpiar cualquier hint previo
    btns.forEach(btn => btn.classList.remove('hint-hidden'));

    // Construir lista de índices incorrectos y elegir uno al azar
    const wrongIndices = [];
    for (let i = 0; i < btns.length; i++) {
        if (i !== correctIdx) wrongIndices.push(i);
    }
    if (!wrongIndices.length) return;
    const pick = wrongIndices[Math.floor(Math.random() * wrongIndices.length)];

    // Usar clase CSS (con !important) en lugar de style inline
    // para que sobreviva al fill-mode:forwards de la animación q-enter
    btns[pick].classList.add('hint-hidden');
}

function handleTimeout() {
    if (!isAnsweringAllowed || isGamePaused) return; 
    isAnsweringAllowed = false; clearInterval(timerInterval); 
    playerStats.totalTimeouts++; currentTimeoutAnswers++; 
    currentGameLog.push({ correct: false, timeout: true, time: 0 });
    ultraFastStreak = 0; currentNoTimeoutStreak = 0;
    saveStatsDebounced(); 
    (_gAnswersGrid||document.getElementById('answers-grid')).classList.add('answered'); 
    setTimeout(() => showFeedback(false, true), 600);
}

function abandonGame() {
    if(lives <= 0) return;
    SFX.click();
    // El modal se muestra pero el timer y el juego siguen corriendo sin ninguna interrupción.
    // isGamePaused permanece false — el interval no se detiene ni se limpia.
    document.getElementById('abandon-modal').classList.add('active');
}

function cancelAbandon() {
    SFX.click();
    // Solo cerrar el modal. El juego nunca se detuvo.
    document.getElementById('abandon-modal').classList.remove('active');
}

function confirmAbandon() {
    _gameSessionId++; // invalidate pending feedback timeouts
    document.getElementById('abandon-modal').classList.remove('active');
    isAnsweringAllowed = false;
    isGamePaused = false;
    clearInterval(timerInterval);
    _currentQuestion = null;
    _stopAntiCheatPoll(); // detener polling anti-trampa
    _ksSessionScore = score; // capturar para análisis
    // KLICK SHIELD: análisis post-partida
    try { _ksAnalyzeSession(true); } catch(e) {}

    // Registrar la partida ANTES de penalizar el score y resetear el estado.
    // Esto garantiza que perfectNoError, rachas, etc. se contabilicen correctamente
    // incluso cuando el jugador abandona una partida perfecta.
    if (currentQuestionIndex > 0) {
        saveGameStats();
    }

    // Aplicar penalización de abandono al score acumulado (ya sumado en saveGameStats)
    const penalty = 300;
    playerStats.totalScore = Math.max(0, playerStats.totalScore - penalty);
    lives = 0;
    initAudio(); SFX.incorrect();
    saveStatsLocally(); submitLeaderboard();
    showToast('Partida Abandonada', `Penalización de -300 pts.`, 'var(--text-secondary)', SVG_INCORRECT);
    document.getElementById('app').classList.remove('streak-active');
    streak = 0;
    switchScreen('start-screen');
}

function replayGame() {
    SFX.click();
    // Verificar ban activo antes de permitir reinicio desde pantalla de fin
    if (_ksCheckBanOnStart()) {
        _ksShowBanScreen();
        return;
    }
    startGame();
}

let _animScoreTimer = null;
function animateScore(target) {
    if (_animScoreTimer) { cancelAnimationFrame(_animScoreTimer); _animScoreTimer = null; }
    const el = _scoreEl || document.getElementById('score-display');
    const curr = parseInt((el.innerText || '0').replace(/[^0-9]/g, '')) || 0;
    const diff = target - curr;
    if (diff <= 0) { el.innerText = target.toLocaleString(); return; }
    const duration = Math.min(700, Math.max(250, diff / 8));
    const startTime = performance.now();
    const startVal = curr;
    function _scoreFrame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - (1 - t) * (1 - t); // ease-out quad
        el.innerText = Math.round(startVal + diff * eased).toLocaleString();
        if (t < 1) { _animScoreTimer = requestAnimationFrame(_scoreFrame); }
        else { el.innerText = target.toLocaleString(); _animScoreTimer = null; }
    }
    _animScoreTimer = requestAnimationFrame(_scoreFrame);
}

function showFeedback(isCorrect, isTimeout = false) {
    const scr = document.getElementById('feedback-screen'), icon = document.getElementById('feedback-icon-container'), title = document.getElementById('feedback-title'), points = document.getElementById('feedback-points');
    const correctAnswerEl = document.getElementById('feedback-correct-answer');
    // Reset any inline style overrides from previous feedback (e.g. shield cyan)
    points.style.borderColor = '';
    points.style.color = '';
    if (correctAnswerEl) { correctAnswerEl.style.display = 'none'; correctAnswerEl.textContent = ''; }
    // Cache achievements Set for O(1) lookups inside inGameUnlock
    const _achSetFB = new Set(playerStats.achievements);
    
    if (isCorrect) {
        SFX.correct(); scr.className = 'screen correct'; icon.innerHTML = SVG_CORRECT; 
        title.innerText = 'CORRECTO';
        let earned = 800 + Math.round((timeLeft / ((_currentQuestion && _currentQuestion._timeLimit) || TIMER_LIMIT)) * 800);
        // Apply active boosts from roulette
        let boostMult = multiplier;
        if (activeBoostNextQ === 'boost') { boostMult = multiplier * 2; activeBoostNextQ = null; }
        else if (activeBoostNextQ === 'triple') { boostMult = multiplier * 3; activeBoostNextQ = null; }
        else if (activeBoostNextQ === 'jackpot') { boostMult = multiplier * 4; activeBoostNextQ = null; }
        earned = earned * boostMult;
        updateRewardIndicator();
        score += earned; streak++; if(streak > currentMaxStreak) currentMaxStreak = streak;
        totalCorrectThisGame++;
        consecutiveLivesLost = 0; // reset on correct answer
        // Partida perfecta: se marca en cuanto se completan 5 correctas sin ningún error ni timeout.
        // Hacerlo aquí (en tiempo real) garantiza que quede registrado aunque luego falle o abandone.
        if (!_perfectThisGame && currentWrongAnswers === 0 && currentTimeoutAnswers === 0) {
            const _correctSoFar = currentQuestionIndex - (currentWrongAnswers||0) - (currentTimeoutAnswers||0);
            // currentQuestionIndex aún no se ha incrementado en este tick (ocurre después del feedback)
            // pero totalCorrectThisGame ya sí — usamos eso como fuente de verdad
            if (totalCorrectThisGame >= 10) {
                _perfectThisGame = true;
                playerStats.perfectGames = (playerStats.perfectGames || 0) + 1;
                const _kpStPf = getKpState();
                _kpStPf.perfectNoError = (_kpStPf.perfectNoError || 0) + 1;
                saveKpState(_kpStPf);
                saveStatsDebounced();
                setTimeout(_kpUpdateMenuBadge, 200);
            }
        }
        // u19: Resurrección — pierde 2 vidas seguidas y encadena 10 aciertos consecutivos
        if(playerStats._twoConsecLives && streak >= 10) {
            playerStats.u19Earned = true; playerStats._twoConsecLives = false;
        }
        // In-game session achievements (unlocked immediately)
        const inGameUnlock = (id, title, col, ico) => {
            if (!_achSetFB.has(id)) {
                _achSetFB.add(id);
                playerStats.achievements.push(id);
                try { initAudio(); } catch(e) {}
                SFX.achievement();
                showToast('Logro Desbloqueado', title, col, ico);
                // Track daily unlocks so da1-da5 "Productivo" count in-game achievements too
                const _igTodayStr = new Date().toISOString().split('T')[0];
                if (playerStats.lastLoginDate === _igTodayStr) {
                    playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + 1;
                }
                saveStatsDebounced();
                // Refresh solo la fila afectada si el virtual scroller está activo
                if (_vsInitialized) {
                    _vsAchSet = new Set(playerStats.achievements);
                    _vsDisplayPin = getAutoProfileAchs();
                    _vsRefreshRows([id]);
                } else {
                    renderAchievements();
                }
            }
        };
        // np1: 10 aciertos seguidos con las 3 vidas intactas (nunca perdió vida)
        if (streak >= 10 && livesLostThisGame === 0) {
            inGameUnlock('np1', 'Examen de Oro', colors.yellow, SVG_SHIELD);
        }
        if (streak > 0 && streak % 5 === 0) { 
            playerStats.frenziesTriggered = (playerStats.frenziesTriggered||0) + 1;
            playerStats.currentFrenzyStreak = (playerStats.currentFrenzyStreak||0) + 1; 
            frenziesThisGame++; 
            if(frenziesThisGame > (playerStats.maxFrenziesInGame||0)) playerStats.maxFrenziesInGame = frenziesThisGame; 
        }
        if ((playerStats.currentFrenzyStreak||0) > (playerStats.maxFrenzyStreak||0)) playerStats.maxFrenzyStreak = playerStats.currentFrenzyStreak;
        // u5: Por los Pelos — acierta con exactamente 1 segundo
        if(timeLeft === 1) inGameUnlock('u5','Por los Pelos', colors.red, SVG_CLOCK);
        // u14: Calculador — acierta con 2-3 segundos
        if(timeLeft === 2 || timeLeft === 3) inGameUnlock('u14','Calculador', colors.blue, SVG_CLOCK);
        // u9: Inmortal — 50 preguntas sin perder vida
        // currentQuestionIndex es 0-based, apunta a la pregunta ACTUAL que se acaba de responder
        if(currentQuestionIndex >= 49 && livesLostThisGame === 0) inGameUnlock('u9','Inmortal', colors.purple, SVG_SHIELD);
        // x10: Economía — 20 preguntas sin perder vida
        if(currentQuestionIndex >= 19 && livesLostThisGame === 0) { inGameUnlock('x10','Economía', colors.green, SVG_HEART); playerStats.x10Earned = true; }
        // x14: Invicto — llega a pregunta 30 sin perder vida
        if(currentQuestionIndex >= 29 && livesLostThisGame === 0) { inGameUnlock('x14','Invicto', colors.green, SVG_SHIELD); playerStats.invictoEarned = true; }
        // x11: El Último Chance — acierta en última vida
        if(lives === 1) inGameUnlock('x11','El Último Chance', colors.orange, SVG_SHIELD);
        // u24: Extremis — 3 aciertos de 1 seg en una partida
        if(lastSecondAnswers >= 3) inGameUnlock('u24','Extremis', colors.red, SVG_SHIELD);
        // x19: Espectacular — 5 respuestas Flash <1 seg en partida
        if(lastSecondAnswers >= 5) { playerStats.flashInOneGame = true; inGameUnlock('x19','Espectacular', colors.yellow, SVG_BOLT); }
        // np3: Sin Límites — partida >60 preguntas
        if(currentQuestionIndex >= 59) inGameUnlock('np3','Sin Límites', colors.purple, SVG_BOLT);
        // u15: Superviviente — 100 preguntas
        if(currentQuestionIndex >= 99) inGameUnlock('u15','Superviviente', colors.green, SVG_SHIELD);
        // u20: Centinela — llega a pregunta 50 sin ningún timeout en la partida
        if(currentQuestionIndex >= 49 && currentTimeoutAnswers === 0) inGameUnlock('u20','Centinela', colors.dark, SVG_CLOCK);
        // u21: Metralleta — 10 seguidas <3 seg
        if(ultraFastStreak >= 10) inGameUnlock('u21','Metralleta', colors.red, SVG_BOLT);
        // x7: Un Golpe Certero — más de 3,000 puntos en las primeras 3 preguntas
        if(currentQuestionIndex === 2 && score > 3000) { playerStats.fastStart3k = true; inGameUnlock('x7','Un Golpe Certero', colors.yellow, SVG_BOLT); }
        // x9: Todo Gas — 10 primeras preguntas <3 seg
        if(currentQuestionIndex < 10 && ultraFastStreak >= 10) inGameUnlock('x9','Todo Gas', colors.red, SVG_BOLT);
        // fin3: Momento Épico — en Frenesí y luego 20 aciertos más
        if((playerStats.currentFrenzyStreak||0) >= 4) inGameUnlock('fin3','Momento Épico', colors.red, SVG_FIRE);

        points.innerText = `+${earned}`; points.style.display = 'block';
    } else {
        // Shield protection from roulette
        if (shieldActive) {
            shieldActive = false;
            activeBoostNextQ = null; // boost lost on failed attempt
            if (streakShieldActive) { streakShieldActive = false; } // consume streak shield too if stacked
            playerStats.rouletteShieldUsed = true;
            saveStatsDebounced();
            updateRewardIndicator();
            SFX.correct();
            scr.className = 'screen shield';
            icon.innerHTML = SVG_SHIELD;
            title.innerText = '¡ESCUDO!';
            points.innerText = 'Protegido';
            points.style.borderColor = 'rgba(0,212,255,0.45)';
            points.style.color = '#00d4ff';
            points.style.display = 'block';
            // Don't lose life, don't reset streak
        } else {
            // Boost powers are lost on a wrong answer / timeout (no carry-over)
            activeBoostNextQ = null;
            updateRewardIndicator();
            SFX.incorrect(); 
            if (isTimeout) { scr.className = 'screen timeout'; icon.innerHTML = SVG_TIMEOUT; title.innerText = "TIEMPO"; } 
            else { scr.className = 'screen incorrect'; icon.innerHTML = SVG_INCORRECT; title.innerText = "INCORRECTO"; }
            // Correct answer is NOT revealed on wrong/timeout
            // Streak shield from roulette: protect racha on one mistake
            if (streakShieldActive) {
                streakShieldActive = false;
                updateRewardIndicator();
                showToast('RACHA PROTEGIDA', 'Tu racha ha sido salvada.', '#aaaaff', SVG_SHIELD);
                // Don't reset streak, but do lose a life
            } else {
                // Caída gradual: baja un nivel de multiplicador (5 puntos de racha) en vez de colapsar a x1
                // Si quedan 0 vidas tras este fallo, sí resetea completamente (fin de partida inminente)
                const streakDrop = 5;
                streak = Math.max(0, streak - streakDrop);
                playerStats.currentFrenzyStreak = Math.max(0, (playerStats.currentFrenzyStreak||0) - streakDrop);
            }
            points.style.display = 'none';
            lives--;
            livesLostThisGame++;
            consecutiveLivesLost++;
            if(consecutiveLivesLost >= 2) playerStats._twoConsecLives = true;
            updateLivesUI();
            // In-game life-loss achievements
            const failUnlock = (id, title, col, ico) => {
                if (!_achSetFB.has(id)) {
                    _achSetFB.add(id);
                    playerStats.achievements.push(id); SFX.achievement();
                    showToast('Logro Desbloqueado', title, col, ico);
                    const _fuTodayStr = new Date().toISOString().split('T')[0];
                    if (playerStats.lastLoginDate === _fuTodayStr) {
                        playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + 1;
                    }
                    saveStatsDebounced(true); renderAchievements();
                }
            };
            // u10: Desastre — pierde 3 vidas en las primeras 3 preguntas (index 0,1,2)
            if(lives === 0 && currentQuestionIndex <= 2) failUnlock('u10','Desastre', colors.dark, SVG_SKULL);
            // u18: Suicida — pierde 3 vidas en muy pocas preguntas (índice 0 o 1)
            if(lives === 0 && currentQuestionIndex <= 1) failUnlock('u18','Suicida', colors.dark, SVG_SKULL);
            // u12: Tragedia — pierde última vida durante racha de 20+
            if(lives === 0 && currentMaxStreak >= 20) failUnlock('u12','Tragedia', colors.dark, SVG_INCORRECT);
            // np4: La Última Bala — exactamente 1 acierto antes de perder todas las vidas
            if(lives === 0 && totalCorrectThisGame === 1) failUnlock('np4','La Última Bala', colors.dark, SVG_SKULL);
        }
    }
    
    updateMultiplierUI();
    (_gStreakDisp||(_gStreakDisp=document.getElementById('streak-display'))).innerText = streak; 
    updateStreakVisuals(); 
    switchScreen('feedback-screen'); 
    setTimeout(() => animateScore(score), 300); 
    // Diferir checkAchievements durante partida para no bloquear el hilo principal
    // (se ejecutará durante la pausa de feedback de 2000ms)
    _deferredCheckAch();
    
    // Check roulette trigger: every 10 corrects (total this game)
    const shouldShowRoulette = isCorrect && totalCorrectThisGame >= nextRouletteTrigger;
    const _fbSess = _gameSessionId; // capture for stale-callback detection
    
    setTimeout(() => {
        if (_fbSess !== _gameSessionId) return; // game changed, discard
        currentQuestionIndex++;
        if(lives > 0) {
            if (shouldShowRoulette) {
                nextRouletteTrigger += 10;
                showRoulette();
            } else {
                const _applyHint = hintActive;
                if (_applyHint) hintActive = false;
                // Cambiar pantalla PRIMERO para que las CSS transitions del timer
                // corran en un elemento visible (evita que el navegador las suspenda)
                switchScreen('question-screen');
                setTimeout(() => {
                    loadQuestion();
                    // Aplicar pista DESPUÉS de que todas las animaciones de entrada terminen
                    // El botón más tardío anima: 0.4s + delay(0.06+3*0.055)s = ~0.63s total
                    if (_applyHint) setTimeout(applyHintVisual, 680);
                }, 80);
            }
        } else {
            endGame();
        }
    }, isCorrect ? (streak >= 10 ? 1200 : 1600) : 2000);
}

function saveGameStats() {
    if (_gameStatsRecorded) return; // guard: evita doble conteo si se llama dos veces por partida
    _gameStatsRecorded = true;
    playerStats.gamesPlayed++; playerStats.todayGames++; playerStats.totalScore += score; 
    const prevBest = playerStats.bestScore || 0;
    if(score > playerStats.bestScore) { playerStats.bestScore = score; playerStats._justSetRecord = true; } 
    if(currentMaxStreak > playerStats.maxStreak) playerStats.maxStreak = currentMaxStreak;
    if(score >= 100000) playerStats.maxScoreCount++;
    // x15: Punto de Quiebre — score exactamente 100k ±500 (tracked per-game, bestScore check alone fails once exceeded)
    if(score >= 99500 && score <= 100500) playerStats.hitExactly100k = true;
    if(!playerStats.maxQuestionReached || currentQuestionIndex > playerStats.maxQuestionReached) playerStats.maxQuestionReached = currentQuestionIndex;
    // perfectGames: ya se incrementa en tiempo real (showFeedback) cuando se alcanzan 10 correctas.
    // Aquí solo lo hacemos como fallback si _perfectThisGame no se activó (ej. partida muy corta terminada al morir).
    if (!_perfectThisGame && currentQuestionIndex >= 10 && currentWrongAnswers === 0 && currentTimeoutAnswers === 0) playerStats.perfectGames = (playerStats.perfectGames||0) + 1;
    // x16: Regreso Triunfal — tras no jugar un día, supera su último récord
    if((playerStats.missedADay||false) && score > prevBest && prevBest > 0) playerStats.returnTriumph = (playerStats.returnTriumph||0) + 1;
    playerStats.missedADay = false; // reset once they play
    // x11: El Último Chance — acierta estando en última vida (tracked in-game but confirmed here)
    // x5: La Revancha — tras 0 aciertos consigue 10+ (tracked via currentGameLog)
    const prevGameCorrect = (playerStats.lastGameCorrect||0);
    if(prevGameCorrect === 0 && currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers >= 10) playerStats.revengeGame = true;
    // x8: Sin Prisa — termina partida con <5 respuestas rápidas
    playerStats.xSinPrisa = (currentFastAnswers < 5 && currentQuestionIndex >= 5);
    // extra2 Precisionista: partida con 100% de precisión (min 10 respuestas)
    const gameCorrect = currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers;
    if (currentWrongAnswers === 0 && currentTimeoutAnswers === 0 && gameCorrect >= 10) {
        playerStats.hadPerfectAccuracyGame = true;
        playerStats.precisPartidas90 = (playerStats.precisPartidas90||0) + 1;
    }
    // x12: Principiante Letal — 50k en la primera partida del día
    if(playerStats.todayGames === 1 && score >= 50000) playerStats.firstGameOfDay50k = true;
    // extra4 Silencioso: juega con música al 0%
    if ((playerStats.musicVol||1) === 0) playerStats.gamesAtMusicZero = (playerStats.gamesAtMusicZero||0) + 1;
    // u11: Fénix — pierde 2 vidas al inicio pero llega a 30 aciertos consecutivos
    if(livesLostThisGame >= 2 && currentMaxStreak >= 30) playerStats.fenixEarned = true;
    // u19: Resurrección — pierde 2 vidas seguidas y encadena 10 consecutivos
    if(playerStats.u19Earned) { playerStats.u19PersistEarned = true; playerStats.u19Earned = false; }
    playerStats.lastGameCorrect = currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers;
    // x4: Doble Victoria — supera 75k dos partidas seguidas (check before overwriting previousGameScore)
    if(score >= 75000 && (playerStats.previousGameScore||0) >= 75000) playerStats.doubleVictory = true;
    // fin1/fin2: Nocturno y Madrugador — solo si la partida se completó en ese horario
    // Se validan aquí (fin de partida) en lugar de en startGame para evitar que salir a mitad cuente
    if (_gameStartHour >= 0) {
        if (_gameStartHour >= 23 || _gameStartHour < 1) playerStats.playedNocturno = true;
        if (_gameStartHour < 6) playerStats.playedMadrugador = true;
    }
    // x6: Consistente — 5 partidas seguidas con ≥25k
    if(score >= 25000) {
        playerStats.consecutiveGames25k = (playerStats.consecutiveGames25k||0) + 1;
    } else {
        playerStats.consecutiveGames25k = 0;
    }
    if((playerStats.consecutiveGames25k||0) >= 5) playerStats.consistent5Games = true;
    playerStats.previousGameScore = score; 
    currentRankInfo = getRankInfo(playerStats); updateLogoDots(); 
    saveStatsLocally(); // guardar inmediatamente al final de partida (datos críticos)
    checkAchievements();
    submitLeaderboard(); 
}

function endGame() {
    isAnsweringAllowed = false; // prevenir race con handleTimeout tras el último feedback
    clearInterval(timerInterval);
    _stopAntiCheatPoll(); // detener polling anti-trampa
    if (_animScoreTimer) { cancelAnimationFrame(_animScoreTimer); _animScoreTimer = null; } // cancelar animación de score en curso
    if (_saveTimeout) { clearTimeout(_saveTimeout); _saveTimeout = null; } // limpiar debounce pendiente
    _currentQuestion = null;
    _ksSessionScore = score; // capturar antes de análisis
    document.getElementById('final-score-display').innerText = score.toLocaleString(); saveGameStats();
    // KLICK SHIELD: análisis post-partida (silencioso, nunca interrumpe el juego)
    try { _ksAnalyzeSession(false); } catch(e) {}
    
    SFX.gameEnd();
    
    const msg = document.getElementById('final-message');
    const rankLabel = document.getElementById('end-rank-label');
    const recordBadge = document.getElementById('end-record-badge');

    // Badge nuevo récord — saveGameStats ya actualizó bestScore, comparar con score actual
    if (recordBadge) {
        recordBadge.style.display = (playerStats.bestScore === score && score > 0) ? 'flex' : 'none';
    }

    if(score > 300000) { msg.innerText = "¡Leyenda!"; if(rankLabel) rankLabel.innerText = "Clasificación Final"; }
    else if(score > 100000) { msg.innerText = "¡Superviviente Nato!"; if(rankLabel) rankLabel.innerText = "Resultado"; }
    else if(score > 25000) { msg.innerText = "¡Buen Desempeño!"; if(rankLabel) rankLabel.innerText = "Resultado"; }
    else { msg.innerText = "Sigue Practicando"; if(rankLabel) rankLabel.innerText = "Resultado"; }

    document.getElementById('final-name').innerText = playerStats.playerName || 'ESTUDIANTE';
    document.getElementById('final-correct-label').innerText = 'Aciertos';
    const _endCorrect = currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers;
    const _endTotal = currentQuestionIndex;
    document.getElementById('final-correct').innerText = _endCorrect;
    document.getElementById('final-streak').innerText = currentMaxStreak; 
    document.getElementById('final-speed').innerText = currentFastAnswers;
    const _endAccuracy = _endTotal > 0 ? Math.round((_endCorrect / _endTotal) * 100) : 0;
    const _accEl = document.getElementById('final-accuracy');
    const _multEl = document.getElementById('final-maxmult');
    const _wrongEl = document.getElementById('final-wrong');
    if (_accEl) _accEl.innerText = _endAccuracy + '%';
    if (_multEl) _multEl.innerText = 'x' + _currentGameMaxMult;
    if (_wrongEl) _wrongEl.innerText = currentWrongAnswers + currentTimeoutAnswers;
    
    document.getElementById('app').classList.remove('streak-active'); streak = 0; switchScreen('end-screen');
}

// --- FPS Controlled Particles (optimized: batched canvas draws) ---
const canvas = document.getElementById('particle-canvas'); 
const ctx = canvas.getContext('2d', { alpha: true }); 
let particlesArray = [];
let fpsInterval = 1000 / playerStats.maxFps;
let then = performance.now();
let _cpFrame = 0;
const _cpFrameMask = 0x7FFFFFFF; // keep within safe integer range
let _smoothDelta = fpsInterval; // EMA del delta real para suavizar jitter
const _EMA_K = 0.12;           // factor de suavizado (menor = más suave)
let _particleRaf = null;        // handle del loop principal — garantiza un único loop activo

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE PARTÍCULAS — cantidad fija, comportamiento dinámico por modo.
// Las partículas se crean UNA SOLA VEZ (o al resize). Al cambiar de modo de
// calidad NO se reinician: el loop lee qualityMode en cada frame y ajusta
// velocidad, conexiones y opacidad al vuelo. Cero loops paralelos posibles.
// ─────────────────────────────────────────────────────────────────────────────

// Velocidad base almacenada en cada partícula (normalizada a modo normal).
// El loop la escala según el modo activo sin recrear el array.
const _P_SPEED_NORMAL = 0.7;  // referencia: velocidad en modo normal

function initParticles() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesArray = [];
    const isMobile = window.innerWidth < 768;
    const area = canvas.width * canvas.height;
    // Cantidad FIJA: la misma para todos los modos (el modo solo cambia comportamiento)
    const num = Math.round(Math.min(area / 15000, isMobile ? 20 : 50));
    for (let i = 0; i < num; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = _P_SPEED_NORMAL * (0.5 + Math.random());
        particlesArray.push({
            x:  Math.random() * canvas.width,
            y:  Math.random() * canvas.height,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            s:  Math.random() * 1.4 + 0.4
        });
    }
}

// Cached per-frame values (set once in animateParticles before calling both draw fns)
let _pIsLight = false, _pRgb = '0,255,102';

function updateAndDrawParticles(timeScale, pulse) {
    const _qm = playerStats.qualityMode;
    // Velocidad escalada por modo — sin recrear partículas
    const modeSpeed = _qm === 'max' ? 1.6 : (_qm === 'perf' ? 0.45 : 1.0);
    const m = streak >= 5 ? 2.5 : 1;
    const speedBoost = 1 + (pulse * 1.2);
    const sizeBoost  = 1 + pulse * 0.8;
    // Perf: opacidad fija baja (sin cálculo de streak ni pulse para ahorrar CPU)
    let dynamicOpacity;
    if (_qm === 'perf') {
        dynamicOpacity = (_pIsLight ? 0.22 : 0.12) * playerStats.particleOpacity;
    } else {
        const baseOpacity = streak >= 5 ? 0.65 : 0.42;
        dynamicOpacity = Math.min(1, (_pIsLight ? baseOpacity * 2.2 : baseOpacity) * playerStats.particleOpacity + pulse * 0.12);
    }
    const W = canvas.width, H = canvas.height;

    ctx.beginPath();
    ctx.fillStyle = `rgba(${_pRgb}, ${dynamicOpacity})`;

    for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        p.x += p.dx * m * modeSpeed * timeScale * speedBoost;
        p.y += p.dy * m * modeSpeed * timeScale * speedBoost;
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        const r = _qm === 'perf' ? p.s : (p.s + pulse * 1.0) * sizeBoost;
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
}

// Darkens an "r,g,b" string by mixing it toward black by `factor` (0=original, 1=black)
function darkenRgb(rgb, factor) {
    const [r, g, b] = rgb.split(',').map(Number);
    return `${Math.round(r*(1-factor))},${Math.round(g*(1-factor))},${Math.round(b*(1-factor))}`;
}

function connectParticles(pulse) { 
    if (particlesArray.length < 2) return;
    if (!playerStats || playerStats.particleOpacity <= 0) return;
    const isStreak = streak >= 5;
    const baseOpacity = isStreak ? (_pIsLight ? 0.7 : 0.35) : (_pIsLight ? 0.4 : 0.18);
    const distMult = 1 + pulse * 0.3;
    const screenFactor = Math.min(1, (canvas.width * canvas.height) / (1920 * 1080));
    // Max mode: conexiones más largas para el efecto Cristalix
    const _isMax = playerStats.qualityMode === 'max';
    const distScale = _isMax ? 1.5 : 1.0;
    const maxDistSq = (canvas.width / 9) * (canvas.height / 9) * distMult * screenFactor * distScale * distScale;
    const pOp = playerStats.particleOpacity;
    const n = particlesArray.length;
    
    ctx.lineWidth = (0.6 + pulse * 0.8) * (isStreak ? 1.3 : 1);

    // Batch lines into alpha buckets to reduce strokeStyle changes (major perf win)
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
            ctx.moveTo(lines[i], lines[i+1]);
            ctx.lineTo(lines[i+2], lines[i+3]);
        }
        ctx.stroke();
    }
}

function animateParticles(now) {
    _particleRaf = requestAnimationFrame(animateParticles);
    const raw = now - then;
    // Solo actuar cuando ha pasado al menos un intervalo de frame
    if (raw < fpsInterval) return;

    // Avanzar then eliminando deuda acumulada (evita burst tras throttle)
    then = now - (raw % fpsInterval);

    // Delta suavizado con EMA para absorber jitter frame-a-frame.
    // Se clampea a [fpsInterval * 0.5, fpsInterval * 1.5] antes del EMA
    // para que un frame muy largo no contamine los siguientes.
    const clamped = Math.max(fpsInterval * 0.5, Math.min(raw, fpsInterval * 1.5));
    _smoothDelta = _smoothDelta + _EMA_K * (clamped - _smoothDelta);

    // timeScale normalizado al intervalo objetivo (debería oscilar cerca de 1.0)
    const timeScale = _smoothDelta / fpsInterval;

    if (!playerStats || playerStats.particleOpacity <= 0) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    _pIsLight = document.body.classList.contains('light-mode');
    _pRgb = _pIsLight ? darkenRgb(currentRankInfo.rgb, 0.55) : currentRankInfo.rgb;

    const _qm = playerStats.qualityMode;
    if (_qm === 'perf') {
        // Perf: sin pulse, sin conexiones, solo partículas en frames pares.
        // clearRect y draw van juntos — si no dibujamos, no borramos (evita flash negro)
        _cpFrame = (_cpFrame + 1) & _cpFrameMask;
        if ((_cpFrame & 1) === 0) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            updateAndDrawParticles(timeScale, 0);
        }
        return;
    }

    // Pulse solo para modos normal y max — perf ya retornó arriba
    const pulse = (audioAnalyser && audioCtx && audioCtx.state === 'running') ? getAudioPulse() : 0;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateAndDrawParticles(timeScale, pulse);

    if (_qm === 'max') {
        // Max: conexiones siempre activas para efecto Cristalix completo
        connectParticles(pulse);
    } else {
        // Normal: conexiones cuando hay racha activa o audio perceptible.
        // En reposo absoluto (idle) no se dibujan conexiones para ahorrar CPU
        // sin producir el parpadeo del frame-skip previo.
        if (streak >= 5 || pulse > 0.05) connectParticles(pulse);
    }
    _cpFrame = (_cpFrame + 1) & _cpFrameMask;
}

// Debounced resize to avoid thrashing on window resize
let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        if (_particleRaf) { cancelAnimationFrame(_particleRaf); _particleRaf = null; }
        initParticles();
        then = performance.now();
        _particleRaf = requestAnimationFrame(animateParticles);
        const _po = document.getElementById('pcard-overlay');
        if (_po && _po.style.display !== 'none') {
            const _pc2 = document.getElementById('pcard-particle-canvas');
            if (_pc2) { _pc2.width = window.innerWidth; _pc2.height = window.innerHeight; }
        }
    }, 150);
});
// Iniciar el loop de partículas — cancelar cualquier loop previo antes de lanzar uno nuevo
if (_particleRaf) { cancelAnimationFrame(_particleRaf); _particleRaf = null; }
initParticles();
then = performance.now();
_particleRaf = requestAnimationFrame(animateParticles);

// Reset particle timer when tab becomes visible to prevent accumulated frame debt causing speed burst
// También restaura el audio si estaba silenciado por pérdida de foco
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Resetear timer Y el EMA al volver — evita que el primer frame
        // tras pausa pese demasiado en el promedio suavizado
        then = performance.now();
        _smoothDelta = fpsInterval;
        _unmuteByFocus(); // seguro llamarlo múltiples veces (es idempotente)
    }
});

// ── Roulette overlay particle canvas (ambient particles while roulette is open) ──
const rlCanvas = document.getElementById('roulette-particle-canvas');
const rlCtx = rlCanvas ? rlCanvas.getContext('2d', { alpha: true }) : null;
let rlParticles = [];
let rlAnimFrame = null;
let rlThen = 0;
let rlColor = '255,184,0'; // default gold

function initRlParticles(color) {
    if (!rlCanvas || !rlCtx) return;
    if (playerStats && playerStats.qualityMode === 'perf') { rlParticles = []; return; } // perf mode: sin partículas
    rlCanvas.width = window.innerWidth;
    rlCanvas.height = window.innerHeight;
    rlColor = color || '255,184,0';
    rlParticles = [];
    const _isMax = playerStats && playerStats.qualityMode === 'max';
    const num = _isMax
        ? Math.min(60, Math.floor(rlCanvas.width * rlCanvas.height / 12000))
        : Math.min(40, Math.floor(rlCanvas.width * rlCanvas.height / 20000));
    for (let i = 0; i < num; i++) {
        rlParticles.push({
            x: Math.random() * rlCanvas.width,
            y: Math.random() * rlCanvas.height,
            dx: (Math.random() - 0.5) * 0.7,
            dy: (Math.random() - 0.5) * 0.7,
            s: Math.random() * 2 + 1
        });
    }
}

function animateRlParticles(now) {
    if (!rlCanvas || !rlCtx) return;
    const overlay = document.getElementById('roulette-overlay');
    if (!overlay || !overlay.classList.contains('active')) {
        rlCtx.clearRect(0, 0, rlCanvas.width, rlCanvas.height);
        rlAnimFrame = null;
        return;
    }
    rlAnimFrame = requestAnimationFrame(animateRlParticles);
    const elapsed = now - rlThen;
    if (elapsed < 33) return; // ~30fps cap
    rlThen = now - (elapsed % 33);
    const timeScale = Math.min(elapsed / 33, 1.0); // clamp: never jump more than 1 frame
    rlCtx.clearRect(0, 0, rlCanvas.width, rlCanvas.height);
    const W = rlCanvas.width, H = rlCanvas.height;
    // Draw particles
    rlCtx.beginPath();
    rlCtx.fillStyle = `rgba(${rlColor},0.55)`;
    for (let i = 0; i < rlParticles.length; i++) {
        const p = rlParticles[i];
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        rlCtx.moveTo(p.x + p.s, p.y);
        rlCtx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    }
    rlCtx.fill();
    // Connect nearby particles (batched by alpha)
    const maxDistSq = (W / 10) * (H / 10);
    rlCtx.lineWidth = 0.6;
    const rlBuckets = 5;
    const rlLines = new Array(rlBuckets).fill(null).map(() => []);
    for (let a = 0; a < rlParticles.length; a++) {
        for (let b = a + 1; b < rlParticles.length; b++) {
            const dx = rlParticles[a].x - rlParticles[b].x;
            const dy = rlParticles[a].y - rlParticles[b].y;
            const dSq = dx * dx + dy * dy;
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
        for (let i = 0; i < lines.length; i += 4) {
            rlCtx.moveTo(lines[i], lines[i+1]);
            rlCtx.lineTo(lines[i+2], lines[i+3]);
        }
        rlCtx.stroke();
    }
}

// Patch showRoulette to init + start rl particles
const _origShowRoulette = showRoulette;
showRoulette = function() {
    _origShowRoulette.apply(this, arguments);
    if (rlCanvas) {
        rlCanvas.width = window.innerWidth;
        rlCanvas.height = window.innerHeight;
    }
    initRlParticles(currentRankInfo ? currentRankInfo.rgb : '255,184,0');
    if (!rlAnimFrame) {
        rlThen = performance.now();
        rlAnimFrame = requestAnimationFrame(animateRlParticles);
    }
};

// iOS/iPad: unlock AudioContext on first user interaction
function _iosAudioUnlock() {
    try {
        if (!audioCtx) initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
    // Si el audio estaba silenciado por pérdida de foco, restaurarlo al tocar
    _audioPausedByFocus = false;
    document.removeEventListener('touchstart', _iosAudioUnlock);
    document.removeEventListener('mousedown', _iosAudioUnlock);
}
document.addEventListener('touchstart', _iosAudioUnlock, { once: true, passive: true });
document.addEventListener('mousedown', _iosAudioUnlock, { once: true, passive: true });

// ═══════════════════════════════════════════════════════════════════════
//  KLICK PASS — 100 niveles permanentes, progresivos, secuenciales
//  Desbloqueados en orden estricto al jugar. Sin quincenas ni reinicios.
//  Premio total: exactamente 100,000 Pinceles.
// ═══════════════════════════════════════════════════════════════════════

// ── Rewards (suma exacta 100,000 ℙ: niveles 1-99 = 95,000 + nivel 100 = 5,000) ──
const _KP_REWARDS = [
  100,104,108,111,116,120,124,129,134,139,  // 1-10
  144,149,154,160,166,172,178,185,192,199,  // 11-20
  206,214,222,230,238,247,256,266,276,286,  // 21-30
  296,307,319,330,342,355,368,382,396,410,  // 31-40
  426,441,457,474,492,510,529,548,568,589,  // 41-50
  611,634,657,681,706,732,759,787,816,847,  // 51-60
  878,910,944,978,1015,1052,1091,1131,1173,1216, // 61-70
  1261,1307,1355,1405,1457,1511,1567,1624,1684,1746, // 71-80
  1811,1877,1947,2018,2093,2170,2250,2333,2419,2508, // 81-90
  2601,2697,2796,2899,3006,3117,3232,3351,3476,5000  // 91-100
];

// ── Condiciones de misión (usan playerStats en tiempo real) ───────────
// Nota: perfectGames: partidas con >= 10 preguntas, 0 errores, 0 timeouts (ver saveGameStats).
// perfectNoError (kpState): igual pero umbral >= 10 preguntas, actualizado via patch al final del archivo.

const _KP_MISSIONS = [
// TRAMO 1 — INICIACIÓN (1-10) ——————————————————————————————————————————
{lv:1,  title:'Primera Partida',      mission:'Completa tu primera partida.',                                         chk:(ps)=>(ps.gamesPlayed||0)>=1},
{lv:2,  title:'Primeros Aciertos',    mission:'Consigue 5 respuestas correctas en total.',                            chk:(ps)=>(ps.totalCorrect||0)>=5},
{lv:3,  title:'En Marcha',            mission:'Completa 3 partidas.',                                                 chk:(ps)=>(ps.gamesPlayed||0)>=3},
{lv:4,  title:'Diez Correctas',       mission:'Acumula 10 respuestas correctas.',                                     chk:(ps)=>(ps.totalCorrect||0)>=10},
{lv:5,  title:'Racha Inicial',        mission:'Logra una racha de 3 aciertos consecutivos.',                          chk:(ps)=>(ps.maxStreak||0)>=3},
{lv:6,  title:'Constante',            mission:'Completa 5 partidas.',                                                 chk:(ps)=>(ps.gamesPlayed||0)>=5},
{lv:7,  title:'Veinte Correctas',     mission:'Acumula 20 respuestas correctas.',                                     chk:(ps)=>(ps.totalCorrect||0)>=20},
{lv:8,  title:'Primer Récord',        mission:'Consigue al menos 5,000 puntos en una partida.',                       chk:(ps)=>(ps.bestScore||0)>=5000},
{lv:9,  title:'Racha x5',             mission:'Logra una racha de 5 aciertos consecutivos.',                          chk:(ps)=>(ps.maxStreak||0)>=5},
{lv:10, title:'Despegue',             mission:'Completa 10 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=10},
// TRAMO 2 — APRENDIZ (11-25) ——————————————————————————————————————————
{lv:11, title:'Cincuenta Aciertos',   mission:'Acumula 50 respuestas correctas.',                                     chk:(ps)=>(ps.totalCorrect||0)>=50},
{lv:12, title:'Puntuación 10k',       mission:'Alcanza 10,000 puntos en una sola partida.',                           chk:(ps)=>(ps.bestScore||0)>=10000},
{lv:13, title:'Acumulado 20k',        mission:'Acumula 20,000 puntos entre todas tus partidas.',                      chk:(ps)=>(ps.totalScore||0)>=20000},
{lv:14, title:'Racha x8',             mission:'Logra una racha de 8 aciertos consecutivos.',                          chk:(ps)=>(ps.maxStreak||0)>=8},
{lv:15, title:'Quince Partidas',      mission:'Completa 15 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=15},
{lv:16, title:'Cien Correctas',       mission:'Acumula 100 respuestas correctas.',                                    chk:(ps)=>(ps.totalCorrect||0)>=100},
{lv:17, title:'Puntuación 15k',       mission:'Supera los 15,000 puntos en una partida.',                             chk:(ps)=>(ps.bestScore||0)>=15000},
{lv:18, title:'Acumulado 50k',        mission:'Acumula 50,000 puntos en total.',                                      chk:(ps)=>(ps.totalScore||0)>=50000},
{lv:19, title:'Racha x10',            mission:'Logra una racha de 10 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=10},
{lv:20, title:'Veinte Partidas',      mission:'Completa 20 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=20},
{lv:21, title:'Sin Fallos I',         mission:'Termina una partida sin ningún error (mín. 10 preguntas).',            chk:(ps,ks)=>(ks.perfectNoError||0)>=1},
{lv:22, title:'Puntuación 20k',       mission:'Supera los 20,000 puntos en una partida.',                             chk:(ps)=>(ps.bestScore||0)>=20000},
{lv:23, title:'Doscientas Correctas', mission:'Acumula 200 respuestas correctas.',                                    chk:(ps)=>(ps.totalCorrect||0)>=200},
{lv:24, title:'Acumulado 80k',        mission:'Acumula 80,000 puntos en total.',                                      chk:(ps)=>(ps.totalScore||0)>=80000},
{lv:25, title:'Treinta Partidas',     mission:'Completa 30 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=30},
// TRAMO 3 — INTERMEDIO (26-40) ——————————————————————————————————————————
{lv:26, title:'Racha x12',            mission:'Logra una racha de 12 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=12},
{lv:27, title:'Puntuación 25k',       mission:'Consigue 25,000 puntos en una sola partida.',                          chk:(ps)=>(ps.bestScore||0)>=25000},
{lv:28, title:'500 Correctas',        mission:'Acumula 500 respuestas correctas.',                                    chk:(ps)=>(ps.totalCorrect||0)>=500},
{lv:29, title:'Acumulado 150k',       mission:'Acumula 150,000 puntos en total.',                                     chk:(ps)=>(ps.totalScore||0)>=150000},
{lv:30, title:'Cuarenta Partidas',    mission:'Completa 40 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=40},
{lv:31, title:'Multiplicador x2',     mission:'Alcanza el multiplicador x2 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=2},
{lv:32, title:'Sin Fallos II',        mission:'Termina 3 partidas sin ningún error.',                                  chk:(ps,ks)=>(ks.perfectNoError||0)>=3},
{lv:33, title:'Puntuación 30k',       mission:'Supera los 30,000 puntos en una partida.',                             chk:(ps)=>(ps.bestScore||0)>=30000},
{lv:34, title:'Racha x15',            mission:'Logra una racha de 15 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=15},
{lv:35, title:'Cincuenta Partidas',   mission:'Completa 50 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=50},
{lv:36, title:'1,000 Correctas',      mission:'Acumula 1,000 respuestas correctas.',                                  chk:(ps)=>(ps.totalCorrect||0)>=1000},
{lv:37, title:'Acumulado 250k',       mission:'Acumula 250,000 puntos en total.',                                     chk:(ps)=>(ps.totalScore||0)>=250000},
{lv:38, title:'Puntuación 40k',       mission:'Supera los 40,000 puntos en una sola partida.',                        chk:(ps)=>(ps.bestScore||0)>=40000},
{lv:39, title:'Multiplicador x3',     mission:'Alcanza el multiplicador x3 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=3},
{lv:40, title:'Sin Fallos III',       mission:'Termina 5 partidas sin ningún error.',                                  chk:(ps,ks)=>(ks.perfectNoError||0)>=5},
// TRAMO 4 — AVANZADO (41-55) ——————————————————————————————————————————
{lv:41, title:'Puntuación 50k',       mission:'Consigue 50,000 puntos en una sola partida.',                          chk:(ps)=>(ps.bestScore||0)>=50000},
{lv:42, title:'Racha x18',            mission:'Logra una racha de 18 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=18},
{lv:43, title:'Setenta Partidas',     mission:'Completa 70 partidas.',                                                chk:(ps)=>(ps.gamesPlayed||0)>=70},
{lv:44, title:'Acumulado 400k',       mission:'Acumula 400,000 puntos en total.',                                     chk:(ps)=>(ps.totalScore||0)>=400000},
{lv:45, title:'2,000 Correctas',      mission:'Acumula 2,000 respuestas correctas.',                                  chk:(ps)=>(ps.totalCorrect||0)>=2000},
{lv:46, title:'Puntuación 60k',       mission:'Supera los 60,000 puntos en una partida.',                             chk:(ps)=>(ps.bestScore||0)>=60000},
{lv:47, title:'Multiplicador x4',     mission:'Alcanza el multiplicador x4 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=4},
{lv:48, title:'Sin Fallos IV',        mission:'Termina 10 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=10},
{lv:49, title:'Racha x20',            mission:'Logra una racha de 20 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=20},
{lv:50, title:'Cien Partidas',        mission:'Completa 100 partidas. La mitad del camino.',                          chk:(ps)=>(ps.gamesPlayed||0)>=100},
{lv:51, title:'Acumulado 600k',       mission:'Acumula 600,000 puntos en total.',                                     chk:(ps)=>(ps.totalScore||0)>=600000},
{lv:52, title:'3,000 Correctas',      mission:'Acumula 3,000 respuestas correctas.',                                  chk:(ps)=>(ps.totalCorrect||0)>=3000},
{lv:53, title:'Puntuación 75k',       mission:'Consigue 75,000 puntos en una sola partida.',                          chk:(ps)=>(ps.bestScore||0)>=75000},
{lv:54, title:'Sin Fallos V',         mission:'Termina 15 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=15},
{lv:55, title:'Racha x22',            mission:'Logra una racha de 22 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=22},
// TRAMO 5 — EXPERTO (56-70) ——————————————————————————————————————————
{lv:56, title:'120 Partidas',         mission:'Completa 120 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=120},
{lv:57, title:'Acumulado 800k',       mission:'Acumula 800,000 puntos en total.',                                     chk:(ps)=>(ps.totalScore||0)>=800000},
{lv:58, title:'Puntuación 90k',       mission:'Supera los 90,000 puntos en una partida.',                             chk:(ps)=>(ps.bestScore||0)>=90000},
{lv:59, title:'Multiplicador x5',     mission:'Alcanza el multiplicador x5 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=5},
{lv:60, title:'5,000 Correctas',      mission:'Acumula 5,000 respuestas correctas.',                                  chk:(ps)=>(ps.totalCorrect||0)>=5000},
{lv:61, title:'Sin Fallos VI',        mission:'Termina 20 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=20},
{lv:62, title:'Racha x25',            mission:'Logra una racha de 25 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=25},
{lv:63, title:'Puntuación 100k',      mission:'Consigue 100,000 puntos o más en una partida.',                        chk:(ps)=>(ps.bestScore||0)>=100000},
{lv:64, title:'150 Partidas',         mission:'Completa 150 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=150},
{lv:65, title:'Acumulado 1M',         mission:'Acumula 1,000,000 de puntos en total.',                                chk:(ps)=>(ps.totalScore||0)>=1000000},
{lv:66, title:'Sin Fallos VII',       mission:'Termina 25 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=25},
{lv:67, title:'7,000 Correctas',      mission:'Acumula 7,000 respuestas correctas.',                                  chk:(ps)=>(ps.totalCorrect||0)>=7000},
{lv:68, title:'Multiplicador x6',     mission:'Alcanza el multiplicador x6 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=6},
{lv:69, title:'Puntuación 120k',      mission:'Supera los 120,000 puntos en una sola partida.',                       chk:(ps)=>(ps.bestScore||0)>=120000},
{lv:70, title:'Racha x28',            mission:'Logra una racha de 28 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=28},
// TRAMO 6 — ÉLITE (71-85) ——————————————————————————————————————————
{lv:71, title:'200 Partidas',         mission:'Completa 200 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=200},
{lv:72, title:'Acumulado 1.2M',       mission:'Acumula 1,200,000 puntos en total.',                                   chk:(ps)=>(ps.totalScore||0)>=1200000},
{lv:73, title:'10,000 Correctas',     mission:'Acumula 10,000 respuestas correctas.',                                 chk:(ps)=>(ps.totalCorrect||0)>=10000},
{lv:74, title:'Sin Fallos VIII',      mission:'Termina 30 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=30},
{lv:75, title:'Puntuación 150k',      mission:'Consigue 150,000 puntos en una partida.',                              chk:(ps)=>(ps.bestScore||0)>=150000},
{lv:76, title:'Racha x30',            mission:'Logra una racha de 30 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=30},
{lv:77, title:'Multiplicador x7',     mission:'Alcanza el multiplicador x7 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=7},
{lv:78, title:'250 Partidas',         mission:'Completa 250 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=250},
{lv:79, title:'Acumulado 1.5M',       mission:'Acumula 1,500,000 puntos en total.',                                   chk:(ps)=>(ps.totalScore||0)>=1500000},
{lv:80, title:'Sin Fallos IX',        mission:'Termina 35 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=35},
{lv:81, title:'15,000 Correctas',     mission:'Acumula 15,000 respuestas correctas.',                                 chk:(ps)=>(ps.totalCorrect||0)>=15000},
{lv:82, title:'Puntuación 180k',      mission:'Supera los 180,000 puntos en una sola partida.',                       chk:(ps)=>(ps.bestScore||0)>=180000},
{lv:83, title:'Racha x33',            mission:'Logra una racha de 33 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=33},
{lv:84, title:'Multiplicador x8',     mission:'Alcanza el multiplicador x8 en cualquier partida.',                    chk:(ps)=>(ps.maxMult||1)>=8},
{lv:85, title:'300 Partidas',         mission:'Completa 300 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=300},
// TRAMO 7 — MAESTRÍA (86-99) ——————————————————————————————————————————
{lv:86, title:'Acumulado 2M',         mission:'Acumula 2,000,000 puntos en total.',                                   chk:(ps)=>(ps.totalScore||0)>=2000000},
{lv:87, title:'Puntuación 200k',      mission:'Consigue 200,000 puntos en una sola partida.',                         chk:(ps)=>(ps.bestScore||0)>=200000},
{lv:88, title:'20,000 Correctas',     mission:'Acumula 20,000 respuestas correctas.',                                 chk:(ps)=>(ps.totalCorrect||0)>=20000},
{lv:89, title:'Sin Fallos X',         mission:'Termina 40 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=40},
{lv:90, title:'Racha x35',            mission:'Logra una racha de 35 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=35},
{lv:91, title:'400 Partidas',         mission:'Completa 400 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=400},
{lv:92, title:'Acumulado 2.5M',       mission:'Acumula 2,500,000 puntos en total.',                                   chk:(ps)=>(ps.totalScore||0)>=2500000},
{lv:93, title:'Puntuación 250k',      mission:'Consigue 250,000 puntos en una sola partida.',                         chk:(ps)=>(ps.bestScore||0)>=250000},
{lv:94, title:'Racha x38',            mission:'Logra una racha de 38 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=38},
{lv:95, title:'25,000 Correctas',     mission:'Acumula 25,000 respuestas correctas.',                                 chk:(ps)=>(ps.totalCorrect||0)>=25000},
{lv:96, title:'500 Partidas',         mission:'Completa 500 partidas.',                                               chk:(ps)=>(ps.gamesPlayed||0)>=500},
{lv:97, title:'Acumulado 3M',         mission:'Acumula 3,000,000 puntos en total.',                                   chk:(ps)=>(ps.totalScore||0)>=3000000},
{lv:98, title:'Sin Fallos XI',        mission:'Termina 50 partidas sin ningún error.',                                 chk:(ps,ks)=>(ks.perfectNoError||0)>=50},
{lv:99, title:'Racha x40',            mission:'Logra una racha de 40 aciertos consecutivos.',                         chk:(ps)=>(ps.maxStreak||0)>=40},
// NIVEL FINAL ——————————————————————————————————————————————————————
{lv:100,title:'El Trayecto',          mission:'Reclama los 99 niveles anteriores.',                                   chk:(ps,ks)=>(ks.claimed||[]).filter(n=>n<=99).length>=99},
];

// Attach rewards
const KP_LEVELS = _KP_MISSIONS.map((m, i) => ({ ...m, reward: _KP_REWARDS[i] }));
const KP_TOTAL  = 100;

// ── Storage (permanente, no por ciclo) ───────────────────────────────
const KP_KEY = 'klickpass_v2';

function getKpState() {
    try {
        const raw = localStorage.getItem(KP_KEY);
        if (raw) {
            const s = JSON.parse(raw);
            if (!Array.isArray(s.claimed)) s.claimed = [];
            if (typeof s.perfectNoError !== 'number') s.perfectNoError = 0;
            // Sync perfectNoError desde perfectGames SOLO si kpState está en 0
            // (primera vez o datos migrados sin kpState). No sobreescribir si ya hay un
            // valor guardado — perfectGames usa umbral ≥10 preguntas y podría ser menor
            // que el valor real de perfectNoError que usa umbral ≥5 preguntas.
            if (s.perfectNoError === 0) {
                const psPerf = playerStats ? (playerStats.perfectGames||0) : 0;
                if (psPerf > 0) s.perfectNoError = psPerf;
            }
            return s;
        }
    } catch(e) {}
    const psPerf = playerStats ? (playerStats.perfectGames||0) : 0;
    return { claimed: [], perfectNoError: psPerf };
}

function saveKpState(state) {
    try { localStorage.setItem(KP_KEY, JSON.stringify(state)); } catch(e) {}
}

// ── Evaluar si un nivel está disponible para reclamar ────────────────
// Regla: el nivel anterior debe estar reclamado (excepto nivel 1)
function kpCanClaim(lvNum) {
    const state = getKpState();
    if (state.claimed.includes(lvNum)) return false;           // ya reclamado
    if (lvNum > 1 && !state.claimed.includes(lvNum - 1)) return false; // bloqueo secuencial
    const lvl = KP_LEVELS[lvNum - 1];
    return lvl ? lvl.chk(playerStats, state) : false;
}

// ── Reclamar nivel ───────────────────────────────────────────────────
// IMPORTANTE: Las recompensas del Klick Pass solo se pueden cobrar
// completando los niveles de forma SECUENCIAL. Cada nivel requiere
// haber reclamado el anterior. La recompensa total (100,000 ℙ) solo
// está disponible al completar el Pase en su totalidad (nivel 100).
let _kpClaimLock = false;
function kpClaim(lvNum) {
    if (_kpClaimLock) return;
    if (!kpCanClaim(lvNum)) return;
    _kpClaimLock = true;
    setTimeout(() => { _kpClaimLock = false; }, 600);
    const state = getKpState();
    state.claimed.push(lvNum);
    saveKpState(state);

    // ── Acreditar recompensa al totalScore del jugador ────────────────
    const lvl_reward = KP_LEVELS[lvNum - 1];
    if (lvl_reward && lvl_reward.reward) {
        playerStats.totalScore = (playerStats.totalScore || 0) + lvl_reward.reward;
        currentRankInfo = getRankInfo(playerStats);
        updateLogoDots();
    }

    // Track claim day for kpa7/kpa8 achievements
    const today = new Date().toISOString().split('T')[0];
    if (!Array.isArray(playerStats.kpClaimDays)) playerStats.kpClaimDays = [];
    if (!playerStats.kpClaimDays.includes(today)) playerStats.kpClaimDays.push(today);
    playerStats.kpSessionClaims = (playerStats.kpSessionClaims||0) + 1;
    saveStatsLocally();
    checkAchievements(); // actualizar logros KP (kpa1-kpa10) en tiempo real

    const lvl   = KP_LEVELS[lvNum - 1];
    const icon  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"/></svg>`;
    try { initAudio(); } catch(e){}
    SFX.achievement();
    showToast(
        `Nivel ${String(lvNum).padStart(3,'0')} — ${lvl.title}`,
        `+${lvl.reward.toLocaleString()} ℙ reclamados`,
        'var(--text-primary)', icon
    );

    // DOM updates
    _kpSetNodeState(lvNum, 'claimed');
    // Completion message for level 100
    if (lvNum === KP_TOTAL) {
        setTimeout(() => {
            showToast('KLICK PASS COMPLETADO', 'Has reclamado los 100,000 ℙ del pase. El progreso permanece en tu historial.', 'var(--rank-color)', icon);
        }, 600);
    }
    // Unlock next node if its condition is already met
    if (lvNum < KP_TOTAL) {
        const newState = getKpState();
        if (kpCanClaim(lvNum + 1)) _kpSetNodeState(lvNum + 1, 'unlocked');
    }
    _kpUpdateHeader();
    _kpUpdateMenuBadge();
}

// ── Mutate a single node + card in the DOM ───────────────────────────
function _kpSetNodeState(lvNum, status) {
    const node = document.querySelector('[data-kp-level="' + lvNum + '"]');
    const card = document.querySelector('[data-kp-card="'  + lvNum + '"]');
    if (!node || !card) return;

    node.classList.remove('unlocked', 'claimed');
    card.classList.remove('unlocked', 'claimed');

    if (status === 'claimed') {
        node.classList.add('claimed');
        node.innerHTML = '<div class="kp-node-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>';
        card.classList.add('claimed');
        const lbl = card.querySelector('.kp-card-level');
        if (lbl) lbl.textContent = lbl.textContent.replace(/BLOQUEADO|DISPONIBLE|EN CURSO/, 'COMPLETADO');
        const dot = card.querySelector('.kp-status-dot');
        if (dot) dot.remove();
        // Remove claim button immediately after claiming
        const claimBtn = card.querySelector('.kp-claim-btn');
        if (claimBtn) claimBtn.remove();
    } else if (status === 'unlocked') {
        node.classList.add('unlocked');
        node.innerHTML = '<span class="kp-node-num">' + String(lvNum).padStart(2,'0') + '</span>' +
                         '<span class="kp-node-sub">NV</span>';
        card.classList.add('unlocked');
        const lbl = card.querySelector('.kp-card-level');
        if (lbl) lbl.textContent = lbl.textContent.replace('BLOQUEADO', 'DISPONIBLE');
        // Add dot + claim button to card bottom
        const bottom = card.querySelector('.kp-card-bottom');
        if (bottom) {
            if (!bottom.querySelector('.kp-status-dot')) {
                const dot = document.createElement('span');
                dot.className = 'kp-status-dot';
                bottom.appendChild(dot);
            }
            if (!bottom.querySelector('.kp-claim-btn')) {
                const btn = document.createElement('button');
                btn.className = 'kp-claim-btn';
                btn.textContent = 'RECLAMAR';
                btn.setAttribute('onclick', 'kpClaim(' + lvNum + ')');
                bottom.appendChild(btn);
            }
        }
    }
}

// ── Actualizar header ────────────────────────────────────────────────
function _kpUpdateHeader() {
    const state   = getKpState();
    const claimed = state.claimed.length;
    const pct     = (claimed / KP_TOTAL) * 100;

    const countEl = document.getElementById('kp-progress-count');
    const barEl   = document.getElementById('kp-total-bar-fill');
    const rewardEl= document.getElementById('kp-reward-total');

    if (countEl)  countEl.textContent  = claimed + ' / ' + KP_TOTAL;
    if (barEl)    barEl.style.width    = pct + '%';
    if (rewardEl) {
        const total = state.claimed.reduce((s, id) => {
            const l = KP_LEVELS[id - 1]; return s + (l ? l.reward : 0);
        }, 0);
        rewardEl.textContent = total > 0
            ? total.toLocaleString() + ' ℙ reclamados de 100,000'
            : 'Sin recompensas reclamadas aún';
    }
}
// alias público
function renderKpHeader() { _kpUpdateHeader(); }

// ── Actualizar badge del menú ────────────────────────────────────────
function _kpUpdateMenuBadge() {
    // Read localStorage ONCE (not 100 times via kpCanClaim)
    const _badgeState = getKpState();
    const _badgeClaimed = new Set(_badgeState.claimed);
    let count = 0;
    for (let i = 0; i < KP_TOTAL; i++) {
        const lv = KP_LEVELS[i].lv;
        if (_badgeClaimed.has(lv)) continue;
        if (lv > 1 && !_badgeClaimed.has(lv - 1)) continue;
        if (KP_LEVELS[i].chk(playerStats, _badgeState)) count++;
    }
    const badge = document.getElementById('kpass-menu-badge');
    if (!badge) return;
    if (count > 0) { badge.style.display = 'inline-block'; badge.textContent = count; }
    else             badge.style.display = 'none';
}
function updateKpassMenuBadge() { _kpUpdateMenuBadge(); }

// ── Render completo del camino ────────────────────────────────────────
function renderKpPath() {
    const state = getKpState();
    const container = document.getElementById('kp-path-container');
    if (!container) return;

    // Cache claimed set for O(1) lookup (avoid O(n) array.includes per level)
    const claimedSet = new Set(state.claimed);
    // Inline kpCanClaim using cached state to avoid 200 localStorage reads
    const _canClaim = (lvNum) => {
        if (claimedSet.has(lvNum)) return false;
        if (lvNum > 1 && !claimedSet.has(lvNum - 1)) return false;
        const lvl = KP_LEVELS[lvNum - 1];
        return lvl ? lvl.chk(playerStats, state) : false;
    };

    const frag = document.createDocumentFragment();

    const TRAMOS = [
        {from:1,  to:10,  name:'Iniciación',  desc:'Nv. 1–10'},
        {from:11, to:25,  name:'Aprendiz',    desc:'Nv. 11–25'},
        {from:26, to:40,  name:'Intermedio',  desc:'Nv. 26–40'},
        {from:41, to:55,  name:'Avanzado',    desc:'Nv. 41–55'},
        {from:56, to:70,  name:'Experto',     desc:'Nv. 56–70'},
        {from:71, to:85,  name:'Élite',       desc:'Nv. 71–85'},
        {from:86, to:99,  name:'Maestría',    desc:'Nv. 86–99'},
        {from:100,to:100, name:'El Trayecto', desc:'Nv. 100'},
    ];
    const tramoStart = {}, tramoEnd = {};
    TRAMOS.forEach(t => { tramoStart[t.from] = t; tramoEnd[t.to] = true; });

    let rowIndex = 0; // zigzag counter — independent of DOM siblings
    KP_LEVELS.forEach((lvl) => {
        const lvNum      = lvl.lv;
        const isClaimed  = claimedSet.has(lvNum);
        const isUnlocked = !isClaimed && _canClaim(lvNum);
        const isFinal    = lvNum === 100;
        const cls        = isClaimed ? 'claimed' : (isUnlocked ? 'unlocked' : '');
        const isFirst    = !!tramoStart[lvNum];
        const isLast     = !!tramoEnd[lvNum];

        // Separador de tramo
        if (isFirst) {
            const t = tramoStart[lvNum];
            const sep = document.createElement('div');
            sep.className = 'kp-tramo-sep';
            sep.innerHTML = '<span class="kp-tramo-name">' + t.name + '</span>' +
                            '<span class="kp-tramo-desc">' + t.desc + '</span>';
            frag.appendChild(sep);
        }

        // Nodo — solo muestra número o checkmark, sin botón
        const nodeHTML = isClaimed
            ? '<div class="kp-node-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>'
            : '<span class="kp-node-num">' + String(lvNum).padStart(2,'0') + '</span><span class="kp-node-sub">NV</span>';

        const node = document.createElement('div');
        node.className = 'kp-node ' + cls + (isFinal ? ' final-node' : '');
        node.setAttribute('data-kp-level', lvNum);
        node.innerHTML = nodeHTML;

        // Tarjeta — botón RECLAMAR está aquí dentro, no en el nodo
        const statusLbl  = isClaimed ? 'COMPLETADO' : (isUnlocked ? 'DISPONIBLE' : 'BLOQUEADO');
        const levelLabel = isFinal ? 'NIVEL FINAL' : 'NV ' + String(lvNum).padStart(3,'0');
        const claimBtn   = isUnlocked
            ? '<button class="kp-claim-btn" onclick="kpClaim(' + lvNum + ')">RECLAMAR</button>'
            : '';
        const dotHTML    = (isUnlocked && !isClaimed) ? '<span class="kp-status-dot"></span>' : '';

        const card = document.createElement('div');
        card.className = 'kp-card ' + cls + (isFinal ? ' final-card' : '');
        card.setAttribute('data-kp-card', lvNum);
        card.innerHTML =
            '<div class="kp-card-level">' + levelLabel + ' · ' + statusLbl + '</div>' +
            '<div class="kp-card-title">' + lvl.title + '</div>' +
            '<div class="kp-card-mission">' + lvl.mission + '</div>' +
            '<div class="kp-card-bottom">' +
                '<span class="kp-reward-pill">' + lvl.reward.toLocaleString() + ' ℙ</span>' +
                dotHTML + claimBtn +
            '</div>';

        // Fila zigzag: counter independiente del DOM (separadores no rompen el conteo)
        const spacer = document.createElement('div');
        spacer.className = 'kp-row-spacer';

        const row = document.createElement('div');
        row.className = 'kp-level-row';
        row.dataset.side = (rowIndex % 2 === 0) ? 'left' : 'right';
        rowIndex++;
        row.appendChild(card);
        row.appendChild(node);
        row.appendChild(spacer);
        frag.appendChild(row);
    });

    container.innerHTML = '';
    container.appendChild(frag);

    // Animación escalonada solo en las primeras 20 filas (cancelar timers previos para evitar leaks)
    if (renderKpPath._animTimers) renderKpPath._animTimers.forEach(t => clearTimeout(t));
    renderKpPath._animTimers = [];
    const rows = container.querySelectorAll('.kp-level-row');
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const r = rows[i];
        r.style.opacity = '0';
        r.style.transform = 'translateY(5px)';
        renderKpPath._animTimers.push(setTimeout(((row) => () => {
            row.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        })(r), i * 12));
    }

    _kpUpdateHeader();

    // Auto-scroll al nivel activo (reuse already-read state, no extra localStorage)
    setTimeout(() => {
        const target = KP_LEVELS.find(l => !claimedSet.has(l.lv) && _canClaim(l.lv))
                    || KP_LEVELS.find(l => !claimedSet.has(l.lv));
        if (target) {
            const el = container.querySelector('[data-kp-card="' + target.lv + '"]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 280);
}
function goToKlickPass() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
    SFX.click();
    playerStats.kpViews = (playerStats.kpViews||0) + 1;
    trackSectionVisit('klickpass');
    saveStatsLocally(); checkAchievements();
    renderKpPath();
    _kpUpdateMenuBadge();
    switchScreen('klickpass-screen');
}

// ── Hook en saveGameStats para trackear perfectNoError y badge ───────
// perfectNoError: partida con 0 wrong, 0 timeout, ≥10 preguntas respondidas.
// Se registra ANTES de que saveGameStats resetee las variables
// (no las resetea, las resetea startGame — así que podemos leerlas en endGame).
// La forma segura: patchar endGame, que llama saveGameStats internamente.
// Preferimos interceptar saveGameStats directamente.
(function() {
    const _orig = saveGameStats;
    saveGameStats = function() {
        // Capture values BEFORE calling original (original doesn't reset them).
        // correctAnswered = preguntas respondidas correctamente en esta partida.
        // currentQuestionIndex cuenta preguntas COMPLETADAS (incrementa tras cada feedback).
        // wrongs y timeouts ya están registrados en sus contadores.
        const wrongAns    = currentWrongAnswers  || 0;
        const timeoutAns  = currentTimeoutAnswers || 0;
        const correctAns  = currentQuestionIndex - wrongAns - timeoutAns;
        const isPerfect   = wrongAns === 0 && timeoutAns === 0 && correctAns >= 10;
        _orig.apply(this, arguments);
        // perfectNoError ya se marcó en tiempo real (en showFeedback al llegar a 5 correctas).
        // Solo actualizamos el badge; no incrementamos de nuevo para evitar doble conteo.
        // (Si por alguna razón _perfectThisGame no se activó pero la partida cumple los criterios,
        // lo registramos aquí como fallback — pero no si ya fue marcado)
        if (isPerfect && !_perfectThisGame) {
            _perfectThisGame = true;
            const kpSt = getKpState();
            kpSt.perfectNoError = (kpSt.perfectNoError || 0) + 1;
            saveKpState(kpSt);
        }
        // Refrescar badge tras guardar
        setTimeout(_kpUpdateMenuBadge, 200);
    };
})();

// ── Init ─────────────────────────────────────────────────────────────
// Defer until playerStats is fully loaded (it's synchronous above, but safe to run now)
// Reset kpSessionClaims: es un contador de sesión, no debe persistir entre recargas
playerStats.kpSessionClaims = 0;
_kpUpdateMenuBadge();
// ════════════════════════════════════ END KLICK PASS ═════════════════



// ════════════════════════════ RANGOS ══════════════════════════════════

function goToRanks() {
    if (_screenTransitioning) return; // anti-glitch
    _lockUserNav();
    initAudio(); SFX.click();
    playerStats.ranksViews = (playerStats.ranksViews || 0) + 1;
    trackSectionVisit('ranks');
    saveStatsLocally();
    checkAchievements();
    renderRanks();
    switchScreen('ranks-screen');
}

function renderRanks() {
    const container = document.getElementById('ranks-container');
    if (!container) return;
    const s = playerStats;
    const kpClaimed = (getKpState().claimed || []).length;
    const current = getRankInfo(s).title;
    const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
    const accuracy = totalAns > 0 ? Math.round((s.totalCorrect||0)/totalAns*100) : 0;
    const fmt = n => n >= 1000000 ? (n/1000000).toFixed(1)+'M' : n >= 1000 ? (n/1000).toFixed(0)+'K' : String(n);

    // Iconos únicos por rango — representan la identidad de cada nivel
    const RANK_ICONS = {
        // Novato: semilla / brote — comienzo
        'Novato':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22V12"/><path d="M12 12C12 8 8 4 3 4c0 5 3.5 8 9 8z"/><path d="M12 12c0-4 4-8 9-8-1 5-4.5 8-9 8z"/></svg>`,
        // Junior: relámpago — energía en ascenso
        'Junior':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
        // Pro: diana — precisión y enfoque
        'Pro':     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
        // Maestro: escudo — dominio y autoridad
        'Maestro': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        // Leyenda: trofeo — reconocimiento permanente
        'Leyenda': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/><circle cx="12" cy="8" r="7"/></svg>`,
        // Eterno: infinito / espiral — más allá del tiempo
        'Eterno':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 12c0-3 2.5-5 5-5a5 5 0 0 1 0 10c-4 0-7-3-7-7a7 7 0 0 1 14 0"/></svg>`,
        // Mítico: corona — el pináculo
        'Mítico':  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 17h20v3H2z"/><polyline points="2 17 5 8 12 13 19 8 22 17"/><circle cx="12" cy="6" r="2"/></svg>`,
        // Divinidad: estrella de 6 puntas — trascendencia absoluta
        'Divinidad': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 22 20 2 20"/><circle cx="12" cy="14" r="2.5"/><line x1="12" y1="11.5" x2="12" y2="8"/></svg>`,
    };

    const RANKS = [
        {
            title: 'Novato',
            color: '0,255,102',
            hex: '#00ff66',
            label: 'El punto de partida.',
            reqs: [],
        },
        {
            title: 'Junior',
            color: '0,212,255',
            hex: '#00d4ff',
            label: 'Tus primeros pasos se consolidan.',
            reqs: [
                { label: 'Puntos acumulados', need: 20000, get: ()=>s.totalScore||0,   fmt: v=>`${fmt(v)} / 20K` },
                { label: 'Aciertos totales',  need: 75,    get: ()=>s.totalCorrect||0, fmt: v=>`${v} / 75` },
                { label: 'Partidas jugadas',  need: 10,    get: ()=>s.gamesPlayed||0,  fmt: v=>`${v} / 10` },
            ],
        },
        {
            title: 'Pro',
            color: '255,229,102',
            hex: '#ffe566',
            label: 'Consistencia y precisión probadas.',
            reqs: [
                { label: 'Puntos acumulados', need: 60000, get: ()=>s.totalScore||0,   fmt: v=>`${fmt(v)} / 60K` },
                { label: 'Aciertos totales',  need: 250,   get: ()=>s.totalCorrect||0, fmt: v=>`${v} / 250` },
                { label: 'Partidas jugadas',  need: 30,    get: ()=>s.gamesPlayed||0,  fmt: v=>`${v} / 30` },
                { label: 'Multiplicador x3',  need: 3,     get: ()=>s.maxMult||1,      fmt: v=>`x${v} / x3` },
                { label: 'Racha máxima',      need: 10,    get: ()=>s.maxStreak||0,    fmt: v=>`${v} / 10` },
                { label: 'Precisión global',  need: 60,    get: ()=>accuracy,           fmt: v=>`${v}% / 60%` },
            ],
        },
        {
            title: 'Maestro',
            color: '255,42,95',
            hex: '#ff2a5f',
            label: 'Dominio del sistema de multiplicadores.',
            reqs: [
                { label: 'Puntos acumulados',    need: 150000, get: ()=>s.totalScore||0,             fmt: v=>`${fmt(v)} / 150K` },
                { label: 'Aciertos totales',     need: 700,    get: ()=>s.totalCorrect||0,           fmt: v=>`${v} / 700` },
                { label: 'Partidas perfectas',   need: 5,      get: ()=>s.perfectGames||0,           fmt: v=>`${v} / 5` },
                { label: 'Partidas jugadas',     need: 60,     get: ()=>s.gamesPlayed||0,            fmt: v=>`${v} / 60` },
                { label: 'Multiplicador x4',     need: 4,      get: ()=>s.maxMult||1,                fmt: v=>`x${v} / x4` },
                { label: 'Racha máxima',         need: 20,     get: ()=>s.maxStreak||0,              fmt: v=>`${v} / 20` },
                { label: 'Precisión global',     need: 65,     get: ()=>accuracy,                    fmt: v=>`${v}% / 65%` },
                { label: 'Logros desbloqueados', need: 30,     get: ()=>(s.achievements||[]).length, fmt: v=>`${v} / 30` },
            ],
        },
        {
            title: 'Leyenda',
            color: '181,23,158',
            hex: '#b5179e',
            label: 'Solo los mejores llegan aquí.',
            reqs: [
                { label: 'Puntos acumulados',    need: 400000, get: ()=>s.totalScore||0,             fmt: v=>`${fmt(v)} / 400K` },
                { label: 'Aciertos totales',     need: 1800,   get: ()=>s.totalCorrect||0,           fmt: v=>`${v} / 1,800` },
                { label: 'Partidas perfectas',   need: 15,     get: ()=>s.perfectGames||0,           fmt: v=>`${v} / 15` },
                { label: 'Partidas jugadas',     need: 120,    get: ()=>s.gamesPlayed||0,            fmt: v=>`${v} / 120` },
                { label: 'Multiplicador x5',     need: 5,      get: ()=>s.maxMult||1,                fmt: v=>`x${v} / x5` },
                { label: 'Racha máxima',         need: 28,     get: ()=>s.maxStreak||0,              fmt: v=>`${v} / 28` },
                { label: 'Precisión global',     need: 70,     get: ()=>accuracy,                    fmt: v=>`${v}% / 70%` },
                { label: 'Logros desbloqueados', need: 80,     get: ()=>(s.achievements||[]).length, fmt: v=>`${v} / 80` },
            ],
        },
        {
            title: 'Eterno',
            color: '102,0,255',
            hex: '#6600ff',
            label: 'Más allá de la leyenda. El umbral de los dioses.',
            reqs: [
                { label: 'Puntos acumulados',    need: 700000, get: ()=>s.totalScore||0,             fmt: v=>`${fmt(v)} / 700K` },
                { label: 'Aciertos totales',     need: 3200,   get: ()=>s.totalCorrect||0,           fmt: v=>`${v} / 3,200` },
                { label: 'Partidas perfectas',   need: 30,     get: ()=>s.perfectGames||0,           fmt: v=>`${v} / 30` },
                { label: 'Partidas jugadas',     need: 200,    get: ()=>s.gamesPlayed||0,            fmt: v=>`${v} / 200` },
                { label: 'Logros desbloqueados', need: 160,    get: ()=>(s.achievements||[]).length, fmt: v=>`${v} / 160` },
                { label: 'Racha máxima',         need: 35,     get: ()=>s.maxStreak||0,              fmt: v=>`${v} / 35` },
                { label: 'Multiplicador máx.',   need: 6,      get: ()=>s.maxMult||1,                fmt: v=>`x${v} / x6` },
                { label: 'Precisión global',     need: 78,     get: ()=>accuracy,                    fmt: v=>`${v}% / 78%` },
            ],
        },
        {
            title: 'Mítico',
            color: '255,149,0',
            hex: '#ff9500',
            label: 'El rango supremo. Alcanzado por muy pocos.',
            reqs: [
                { label: 'Puntos acumulados',    need: 1200000, get: ()=>s.totalScore||0,             fmt: v=>`${fmt(v)} / 1.2M` },
                { label: 'Aciertos totales',     need: 5500,    get: ()=>s.totalCorrect||0,           fmt: v=>`${v} / 5,500` },
                { label: 'Partidas perfectas',   need: 55,      get: ()=>s.perfectGames||0,           fmt: v=>`${v} / 55` },
                { label: 'Partidas jugadas',     need: 320,     get: ()=>s.gamesPlayed||0,            fmt: v=>`${v} / 320` },
                { label: 'Logros desbloqueados', need: 280,     get: ()=>(s.achievements||[]).length, fmt: v=>`${v} / 280` },
                { label: 'Racha máxima',         need: 45,      get: ()=>s.maxStreak||0,              fmt: v=>`${v} / 45` },
                { label: 'Multiplicador máx.',   need: 8,       get: ()=>s.maxMult||1,                fmt: v=>`x${v} / x8` },
                { label: 'Precisión global',     need: 85,      get: ()=>accuracy,                    fmt: v=>`${v}% / 85%` },
            ],
        },
        {
            title: 'Divinidad',
            color: '255,255,255',
            hex: '#ffffff',
            label: 'Rango exclusivo del Arquitecto del Sistema. No puede obtenerse.',
            divinidadExclusive: true,
            reqs: [],
        },
    ];

    // Divinidad se muestra al final como rango exclusivo del Arquitecto.
    const ORDER = ['Novato','Junior','Pro','Maestro','Leyenda','Eterno','Mítico','Divinidad'];
    // Admin (CHRISTOPHER): mostrar Divinidad como su rango actual, no Mítico
    const _isAdminRanks = (s.playerName||'').toUpperCase() === 'CHRISTOPHER' && s.uuid === '00000000-spec-tral-0000-klickphantom0';
    const displayCurrent = _isAdminRanks ? 'Divinidad' : current;
    const rankIdx = ORDER.indexOf(displayCurrent);

    let html = '';
    RANKS.forEach((rank, i) => {
        // Divinidad: si es el admin, mostrar como su rango actual; si no, como exclusivo bloqueado
        const isDivinidadExclusive = rank.divinidadExclusive === true && !_isAdminRanks;
        const isUnlocked = !isDivinidadExclusive && i <= rankIdx;
        const isCurrent  = !isDivinidadExclusive && rank.title === displayCurrent;
        const isNext     = !isDivinidadExclusive && i === rankIdx + 1;
        const isLocked   = isDivinidadExclusive || (!isUnlocked && !isNext);

        const statusClass = isDivinidadExclusive ? 'rank-row--divinidad-exclusive' :
            isCurrent ? 'rank-row--current' : isUnlocked ? 'rank-row--done' : isNext ? 'rank-row--next' : 'rank-row--locked';

        // Build req pills
        let pillsHtml = '';
        if (rank.reqs.length > 0) {
            rank.reqs.forEach(r => {
                const val = r.get();
                const met = val >= r.need;
                const pct = Math.min(100, Math.round((val / r.need) * 100));
                const dim = isLocked ? 'opacity:0.4;' : '';
                pillsHtml += `
                <div class="rrank-req ${met ? 'rrank-req--met' : ''}" style="${dim}">
                    <div class="rrank-req-top">
                        <span class="rrank-req-label">${r.label}</span>
                        <span class="rrank-req-val" style="color:${met ? rank.hex : 'var(--text-secondary)'};">${r.fmt(val)}</span>
                    </div>
                    <div class="rrank-bar-track">
                        <div class="rrank-bar-fill" style="width:${pct}%;background:rgba(${rank.color},${met?'0.9':'0.5'});"></div>
                    </div>
                </div>`;
            });
        }

        // Icono del rango — único por nivel, coloreado según estado
        const iconColor  = isLocked ? 'rgba(255,255,255,0.22)' : `rgba(${rank.color},${isCurrent ? '1' : '0.75'})`;
        const iconSize   = isCurrent ? '22' : '18';
        const iconSvgRaw = RANK_ICONS[rank.title] || SVG_STAR;
        // Inyectar color, width y height en el SVG base en un solo replace
        // para evitar que '<svg ' se duplique al reemplazar dos veces.
        let badgeSvg = iconSvgRaw
            .replace('stroke="currentColor"', `stroke="${iconColor}"`)
            .replace('<svg ', `<svg width="${iconSize}" height="${iconSize}" `);

        html += `
        <div class="rank-row ${statusClass}" data-rank="${rank.title}">
            <div class="rank-row-header">
                <div class="rank-row-left">
                    <div class="rank-row-badge">${badgeSvg}</div>
                    <div>
                        <div class="rank-row-name" style="color:rgba(${rank.color},${isLocked?'0.35':'1'});">${rank.title.toUpperCase()}</div>
                        <div class="rank-row-desc">${rank.label}</div>
                    </div>
                </div>
                ${isCurrent ? '<div class="rank-row-chip">TU RANGO</div>' : isUnlocked ? '<div class="rank-row-chip rank-row-chip--done">SUPERADO</div>' : ''}
            </div>
            ${pillsHtml ? `<div class="rrank-reqs">${pillsHtml}</div>` : `<div class="rrank-reqs rrank-novato">${rank.divinidadExclusive ? 'Rango no obtenible por jugadores.' : 'Sin requisitos — ¡todos comienzan aquí!'}</div>`}
        </div>`;
    });

    container.innerHTML = html;

    // Animate bars after DOM paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            container.querySelectorAll('.rrank-bar-fill').forEach(el => {
                const w = el.style.width;
                el.style.width = '0%';
                el.style.transition = 'width 0.7s cubic-bezier(.4,0,.2,1)';
                setTimeout(() => { el.style.width = w; }, 60);
            });
        });
    });
}
// ════════════════════════════ END RANGOS ══════════════════════════════

// ── Verificación de ban/eliminación al iniciar ────────────────────
// Si el servidor devuelve 'banned' o 'deleted', borrar todos los datos
// locales del dispositivo para forzar una cuenta nueva.
async function _checkBanStatus() {
    if (!playerStats.uuid || playerStats.uuid === generateUUID().slice(0,8) || GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    if (!navigator.onLine) return;
    try {
        const payload = JSON.stringify({
            action: 'check-ban',
            uuid: playerStats.uuid,
            deviceFP: _deviceFingerprint || 'unknown',
        });
        const res = await fetch(GAS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' },
            body: payload,
        });
        const data = await res.json();
        if (data && data.banned === true) {
            _ksShowPermanentBanScreen();
        }
    } catch(e) { /* silencioso */ }
}

function _wipeAccountData() {
    // Borrar todos los datos locales del juego en localStorage
    const keysToWipe = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k && (k.startsWith('klick') || k === DEVICE_FP_KEY)) keysToWipe.push(k);
        }
        keysToWipe.forEach(k => { try { localStorage.removeItem(k); } catch(_) {} });
    } catch(_) {}
    // Borrar IDB
    try { indexedDB.deleteDatabase(_IDB_NAME); } catch(_) {}
    // Limpiar cachés del Service Worker
    if ('caches' in window) {
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
    }
    // Recargar para crear cuenta nueva
    setTimeout(() => { window.location.reload(true); }, 800);
}

setTimeout(() => {
    // ── CHRISTOPHER: inyectar stats, logros y KP antes de inicializar ────────
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') {
        playerStats.totalScore          = Math.max(playerStats.totalScore||0,          80000000);
        playerStats.totalCorrect        = Math.max(playerStats.totalCorrect||0,        950000);
        playerStats.totalWrong          = Math.max(playerStats.totalWrong||0,          50000);
        playerStats.totalTimeouts       = Math.max(playerStats.totalTimeouts||0,       5000);
        playerStats.perfectGames        = Math.max(playerStats.perfectGames||0,        5000);
        playerStats.maxStreak           = Math.max(playerStats.maxStreak||0,           500);
        playerStats.maxMult             = Math.max(playerStats.maxMult||1,             10);
        playerStats.maxLoginStreak      = Math.max(playerStats.maxLoginStreak||0,      365);
        playerStats.gamesPlayed         = Math.max(playerStats.gamesPlayed||0,         50000);
        playerStats.bestScore           = Math.max(playerStats.bestScore||0,           8000000);
        playerStats.todayGames          = Math.max(playerStats.todayGames||0,          5);
        playerStats.totalDaysPlayed     = Math.max(playerStats.totalDaysPlayed||0,     365);
        playerStats.ranksViews          = Math.max(playerStats.ranksViews||0,          15);
        playerStats.kpViews             = Math.max(playerStats.kpViews||0,             100);
        playerStats.precisPartidas90    = Math.max(playerStats.precisPartidas90||0,    10);
        playerStats.hadPerfectAccuracyGame = true;
        playerStats.rouletteSpins       = Math.max(playerStats.rouletteSpins||0,       200);
        playerStats.rankingViews        = Math.max(playerStats.rankingViews||0,        100);
        playerStats.nameChanges         = 0;
        playerStats.christopherCardViews = Math.max(playerStats.christopherCardViews||0, 25);
        playerStats.maxScoreCount       = Math.max(playerStats.maxScoreCount||0,       10);
        playerStats.maxQuestionReached  = Math.max(playerStats.maxQuestionReached||0,  800);
        playerStats.flashInOneGame      = true;
        playerStats.playedNocturno      = true;
        playerStats.playedMadrugador    = true;
        playerStats.returnTriumph       = Math.max(playerStats.returnTriumph||0,       1);
        playerStats.fenixEarned         = true;
        playerStats.u19PersistEarned    = true;
        playerStats.clickedLogo         = true;
        playerStats.frenziesTriggered   = Math.max(playerStats.frenziesTriggered||0,   1);
        playerStats.lastSecondAnswersTotal = Math.max(playerStats.lastSecondAnswersTotal||0, 50);
        playerStats.tracksTriedSet      = ['track_chill','track_pulse','track_bass'];
        playerStats.triedAllTracks      = true;
        playerStats.trackSwitches       = Math.max(playerStats.trackSwitches||0,       5);
        playerStats.profileViewedAfterGames = Math.max(playerStats.profileViewedAfterGames||0, 5);
        playerStats.successfulLeaderboardLoads = Math.max(playerStats.successfulLeaderboardLoads||0, 10);
        playerStats.allSectionsVisited  = true;
        playerStats.achViews            = Math.max(playerStats.achViews||0,            50);
        playerStats.configViews         = Math.max(playerStats.configViews||0,         5);
        playerStats.hitExactly100k      = true;
        playerStats.xSinPrisa           = true;
        playerStats.firstGameOfDay50k   = true;
        playerStats.revengeGame         = true;
        playerStats.u19Earned           = true;
        playerStats.surpassedHighPLPlayer = true;
        playerStats.gamesAtMusicZero    = Math.max(playerStats.gamesAtMusicZero||0,    1);
        playerStats.fastAnswersTotal    = Math.max(playerStats.fastAnswersTotal||0,    10000);
        playerStats.lastGameCorrect     = Math.max(playerStats.lastGameCorrect||0,     10);
        playerStats.missedADay          = false;
        playerStats.powerLevel          = 21000000;
        const _kpAdmin = getKpState();
        _kpAdmin.claimed = Array.from({length: 100}, (_, i) => i + 1);
        _kpAdmin.perfectNoError = Math.max(_kpAdmin.perfectNoError||0, 100);
        saveKpState(_kpAdmin);
        const _achSet = new Set([...(playerStats.achievements||[]), ...ACHIEVEMENTS_MAP.keys()]);
        playerStats.achievements = [..._achSet];
        saveStatsLocally();
    }
    // ─────────────────────────────────────────────────────────────────────────
    processDailyLogin(); currentRankInfo = getRankInfo(playerStats); updateLogoDots(); revokeInvalidAchievements(); checkAchievements(); submitLeaderboard(); fetchLeaderboard(); if (playerStats.playerName && playerStats.playerName.toUpperCase()==='CHRISTOPHER') fetchSecurityData(); loadQuestions();
    // Iniciar heartbeat de estado online
    _startHeartbeat();
    _checkBanStatus().catch(() => {});
    // Poll ban status cada 5 minutos — detecta bans del admin mientras la app está abierta
    setInterval(() => { _checkBanStatus().catch(() => {}); }, 5 * 60 * 1000);
    // Punto de novedad en botón changelog si hay versión nueva
    try {
        const seenVer = localStorage.getItem('klick_changelog_seen') || '';
        if (seenVer !== KLICK_VERSION) {
            const dot = document.getElementById('changelog-new-dot');
            if (dot) dot.style.display = 'block';
        }
    } catch(_) {}
    // Punto de novedad en botón de seguridad si hay versión nueva
    try {
        const seenSec = localStorage.getItem('klick_security_seen') || '';
        const secBtn2 = document.getElementById('security-nav-btn');
        if (secBtn2) {
            const secDot = secBtn2.querySelector('.new-dot');
            if (secDot) secDot.style.display = seenSec !== KLICK_VERSION ? 'block' : 'none';
        }
    } catch(_) {}
    // Notificaciones push opt-in (solo si ya jugaron 3+ partidas)
    setTimeout(_setupPushReminder, 2000);
}, 500);

// ── Auto-retrocompatibilidad perfectNoError ───────────────────────────
// Jugadores que completaron partidas perfectas antes del sistema en tiempo real
// no tienen perfectNoError acreditado. Lo corregimos en silencio al cargar.
(function _retroPerfect() {
    const kpSt = getKpState();
    const fromGames = playerStats.perfectGames || 0;         // umbral ≥10 preguntas
    const hadAny    = playerStats.hadPerfectAccuracyGame ? 1 : 0; // al menos 1 de ≥5
    const minCredit = Math.max(fromGames, hadAny);
    if (kpSt.perfectNoError < minCredit) {
        kpSt.perfectNoError = minCredit;
        saveKpState(kpSt);
        // Actualizar badge para que el Klick Pass refleje los nuevos niveles desbloqueados
        setTimeout(_kpUpdateMenuBadge, 800);
    }
})();

// x2 Paciente: espera 10 segundos en la pantalla principal sin hacer nada
(function() {
    let _pacienteTimer = null;
    function _startPacienteTimer() {
        clearTimeout(_pacienteTimer);
        const startScr = document.getElementById('start-screen');
        if (!startScr || !startScr.classList.contains('active')) return;
        _pacienteTimer = setTimeout(() => {
            if (document.getElementById('start-screen').classList.contains('active')) {
                if (!playerStats.achievements.includes('x2')) {
                    playerStats.achievements.push('x2');
                    saveStatsDebounced();
                    const ach = ACHIEVEMENTS_MAP.get('x2');
                    if (ach) { SFX.achievement(); showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon); }
                    renderAchievements();
                }
            }
        }, 10000);
    }
    // Observar cambios de pantalla: reiniciar timer al volver al menú
    const _origSwitch = switchScreen;
    switchScreen = function(id) {
        _origSwitch.apply(this, arguments);
        if (id === 'start-screen') {
            setTimeout(_startPacienteTimer, 100);
        } else {
            clearTimeout(_pacienteTimer);
        }
    };
    // Arrancar en la carga inicial si ya estamos en el menú
    setTimeout(_startPacienteTimer, 600);
})();

// ══════════════════════════════════════════════════════════════════
//  NOTIFICACIONES PUSH — Recordatorio opt-in de racha diaria
// ══════════════════════════════════════════════════════════════════
function _setupPushReminder() {
    if (!('Notification' in window)) return;
    // Solo proponer una vez, tras la tercera partida jugada, si no se ha respondido antes
    if (playerStats.pushAsked || (playerStats.gamesPlayed || 0) < 3) return;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') {
        playerStats.pushAsked = true; return;
    }
    // Mostrar un toast invitando al jugador a activar las notificaciones
    setTimeout(() => {
        const toastId = 'push-invite-toast';
        if (document.getElementById(toastId)) return;
        const t = document.createElement('div');
        t.id = toastId;
        t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:9990;background:var(--bg-elevated);border:1.5px solid rgba(255,255,255,0.12);border-radius:16px;padding:14px 18px;max-width:320px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:10px;';
        t.innerHTML = `<div style="font-size:0.8rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:1px;">Recordatorio de racha</div>
            <div style="font-size:0.75rem;color:var(--text-secondary);line-height:1.5;">Activa las notificaciones para recibir un aviso cuando tu racha diaria este en peligro.</div>
            <div style="display:flex;gap:8px;">
                <button onclick="document.getElementById('push-invite-toast').remove();playerStats.pushAsked=true;saveStatsLocally();" style="flex:1;padding:8px;background:transparent;border:1px solid rgba(255,255,255,0.2);color:var(--text-secondary);border-radius:10px;font-size:0.75rem;font-weight:700;cursor:pointer;">Ahora no</button>
                <button id="push-accept-btn" style="flex:1;padding:8px;background:rgba(var(--rank-rgb),0.15);border:1px solid rgba(var(--rank-rgb),0.4);color:var(--rank-color);border-radius:10px;font-size:0.75rem;font-weight:700;cursor:pointer;">Activar</button>
            </div>`;
        document.body.appendChild(t);
        document.getElementById('push-accept-btn').addEventListener('click', () => {
            t.remove();
            playerStats.pushAsked = true;
            saveStatsLocally();
            Notification.requestPermission().then(perm => {
                if (perm === 'granted') {
                    showToast('Notificaciones activadas', 'Te avisaremos cuando tu racha este en peligro.', 'var(--rank-color)', null);
                }
            });
        });
    }, 3000);
}

// ══════════════════════════════════════════════════════════════════
//  SERVICE WORKER — Auto-actualización con notificación visible
// ══════════════════════════════════════════════════════════════════
(function registerSW() {
    if (!('serviceWorker' in navigator)) return;

    // ── Banner de actualización ───────────────────────────────────
    // Aparece cuando hay una nueva versión activa. No desaparece solo.
    let _bannerShown = false;
    function _showUpdateBanner() {
        if (_bannerShown) return;
        _bannerShown = true;
        if (document.getElementById('sw-update-banner')) return;
        const b = document.createElement('div');
        b.id = 'sw-update-banner';
        Object.assign(b.style, {
            position: 'fixed',
            bottom: '18px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10,10,15,0.92)',
            color: '#fff',
            fontSize: '0.78rem',
            padding: '10px 22px',
            borderRadius: '50px',
            zIndex: '99999',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(12px)',
            fontFamily: 'Inter,sans-serif',
            letterSpacing: '0.4px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
            cursor: 'pointer',
            userSelect: 'none',
            whiteSpace: 'nowrap',
        });
        b.innerHTML = 'Nueva versión disponible &nbsp;<strong>— toca para actualizar</strong>';
        b.addEventListener('click', () => window.location.reload());
        document.body.appendChild(b);
        // Auto-recarga si el usuario está en el menú (no en partida)
        _scheduleAutoReload();
    }

    // Recarga automática si NO hay partida activa
    function _scheduleAutoReload() {
        const check = () => {
            const qs = document.getElementById('question-screen');
            const inGame = qs && qs.classList.contains('active')
                        && typeof lives !== 'undefined' && lives > 0;
            if (!inGame) {
                window.location.reload();
            } else {
                // En partida: reintentar cada 5 s
                setTimeout(check, 5000);
            }
        };
        // Esperar 800 ms para no interrumpir animaciones de carga
        setTimeout(check, 800);
    }

    // ── Activa el SW en espera y muestra el banner ────────────────
    let _skipSent = false;
    function _activatePendingSW(sw) {
        if (_skipSent) return;
        _skipSent = true;
        sw.postMessage({ type: 'SKIP_WAITING' });
        // El banner se muestra al recibir controllerchange (señal más fiable)
    }

    // ── Comprobación de nueva versión por ETag/Last-Modified ─────
    // Detecta cambios aunque el SW no haya podido auto-actualizarse
    let _lastEtag = null;
    async function _checkVersionViaHttp() {
        try {
            const res = await fetch('./sw.js', {
                method: 'HEAD',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const etag = res.headers.get('etag') || res.headers.get('last-modified') || res.headers.get('x-sw-version');
            if (etag) {
                if (_lastEtag && _lastEtag !== etag) {
                    // El SW en servidor cambió — forzar comprobación del registro
                    _lastEtag = etag;
                    navigator.serviceWorker.getRegistration().then(reg => {
                        if (reg) reg.update();
                    });
                } else {
                    _lastEtag = etag;
                }
            }
        } catch (_) {}
    }

    // ── Registro y detección de actualizaciones ───────────────────
    navigator.serviceWorker.register('./sw.js').then(reg => {

        // Caso A: Ya hay un SW nuevo esperando al cargar la página
        if (reg.waiting) {
            _activatePendingSW(reg.waiting);
        }

        // Caso B: El SW nuevo termina de instalarse mientras la página está abierta
        reg.addEventListener('updatefound', () => {
            const incoming = reg.installing;
            if (!incoming) return;
            incoming.addEventListener('statechange', () => {
                if (incoming.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        // Nuevo SW instalado, hay un SW viejo controlando → activar
                        _activatePendingSW(incoming);
                    }
                    // Si no hay controller aún, es la primera instalación — no recargar
                }
            });
        });

        // Polling agresivo: 45s en primer minuto, luego 90s
        // Detecta actualizaciones mucho antes que el intervalo largo anterior
        let _pollCount = 0;
        function _pollUpdate() {
            _pollCount++;
            if (reg) reg.update();
            _checkVersionViaHttp();
            const next = _pollCount < 4 ? 45000 : 90000;
            setTimeout(_pollUpdate, next);
        }
        setTimeout(_pollUpdate, 45000);

    }).catch(() => {}); // silencioso en file:// o sin HTTPS

    // Caso C: El SW cambió de controlador → señal más fiable de versión nueva activa
    let _ccTimer = null;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        clearTimeout(_ccTimer);
        _ccTimer = setTimeout(() => _showUpdateBanner(), 80);
    });

    // Caso D: El SW envía SW_UPDATED desde activate (doble seguro)
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data && event.data.type === 'SW_UPDATED') {
            _showUpdateBanner();
        }
    });

    // Caso E: Visibilidad recuperada (usuario vuelve a la pestaña) → chequear inmediato
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                    // Si ya hay un SW esperando, activarlo
                    if (reg.waiting) {
                        _activatePendingSW(reg.waiting);
                    } else {
                        // Forzar comprobación de actualización
                        reg.update();
                        _checkVersionViaHttp();
                    }
                }
            }).catch(() => {});
        }
    });

    // Setup notificaciones push opcionales (recordatorio de racha diaria)
    _setupPushReminder();

})();
