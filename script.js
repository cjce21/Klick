// --- SISTEMAS DE PROTECCIÓN ANTI-TRAMPAS ---
document.addEventListener('contextmenu', e => e.preventDefault());

document.addEventListener('keydown', e => {
    if (e.keyCode === 123 || 
        (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74)) || 
        (e.ctrlKey && (e.keyCode === 85 || e.keyCode === 67 || e.keyCode === 83 || e.keyCode === 80))) { 
        e.preventDefault();
        return false;
    }
});

// ── Gestión de foco / visibilidad ───────────────────────────────────────
// Cuando el usuario sale del juego (otra pestaña, minimizar, superposición,
// etc.) la música se silencia de inmediato. Al volver, se reactiva.
// El anti-trampas sigue funcionando igual dentro de este bloque.

let _cheaterCooldown = false;

// Estado de silencio por pérdida de foco (independiente del vol del usuario)
let _audioPausedByFocus = false;

function _muteByFocus() {
    if (_audioPausedByFocus) return;
    _audioPausedByFocus = true;
    if (audioCtx && masterMusicGain) {
        // Fade rápido a 0 (20 ms) y luego suspender el contexto
        const t = audioCtx.currentTime;
        masterMusicGain.gain.cancelScheduledValues(t);
        masterMusicGain.gain.setValueAtTime(masterMusicGain.gain.value, t);
        masterMusicGain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
        setTimeout(() => {
            // Suspender solo si aún sigue en segundo plano
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
        // Reanudar contexto suspendido y restaurar volumen con fade suave
        const doFade = () => {
            const t = audioCtx.currentTime;
            // Solo restaurar masterMusicGain si la música del Arquitecto NO está activa
            if (masterMusicGain && !_architectMusicActive) {
                const targetVol = playerStats.musicVol * 0.8;
                masterMusicGain.gain.cancelScheduledValues(t);
                masterMusicGain.gain.setValueAtTime(0.0001, t);
                masterMusicGain.gain.linearRampToValueAtTime(targetVol, t + 0.35);
            }
            // Si el Arquitecto está activo, restaurar su gain propio
            if (_architectMusicActive && _architectGain) {
                const targetVol = playerStats.musicVol * 0.75;
                _architectGain.gain.cancelScheduledValues(t);
                _architectGain.gain.setValueAtTime(0.0001, t);
                _architectGain.gain.linearRampToValueAtTime(targetVol, t + 0.35);
                // Reiniciar el tick si se había detenido
                if (!_architectMusicTimer) _architectTick();
            }
        };
        if (audioCtx.state === 'suspended') {
            audioCtx.resume().then(doFade).catch(() => {});
        } else {
            doFade();
        }
    }
}

// visibilitychange: cubre cambio de pestaña, minimizar ventana, bloqueo de pantalla
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'hidden') {
        _muteByFocus();
        // Anti-trampas: solo actúa si hay partida activa
        if (isAnsweringAllowed && !isGamePaused) {
            if (_cheaterCooldown) return; _cheaterCooldown = true;
            setTimeout(() => { _cheaterCooldown = false; }, 3000);
            punishCheater();
        }
    } else {
        // Visible de nuevo → restaurar audio
        _unmuteByFocus();
    }
});

// blur: cubre superposición de otra ventana, diálogos del sistema, cambio de app
// (no dispara en móvil al bajar el teclado virtual — eso lo cubre visibilitychange)
window.addEventListener("blur", () => {
    _muteByFocus();
    if (isAnsweringAllowed && !isGamePaused) {
        if (_cheaterCooldown) return; _cheaterCooldown = true;
        setTimeout(() => { _cheaterCooldown = false; }, 3000);
        punishCheater();
    }
});

// focus: la ventana recupera el foco → restaurar audio
window.addEventListener("focus", () => {
    // Solo si la pestaña también es visible (evita restaurar con pestaña oculta)
    if (document.visibilityState === 'visible') {
        _unmuteByFocus();
    }
});

// pagehide: navegación fuera de la página (iOS Safari no emite blur fiablemente)
window.addEventListener("pagehide", () => {
    _muteByFocus();
});

function punishCheater() {
    if(!isAnsweringAllowed || isGamePaused) return;
    isAnsweringAllowed = false;
    isGamePaused = false;
    clearInterval(timerInterval);
    lives = 0; // terminar partida de forma limpia
    _currentQuestion = null;
    
    const penalty = 2000; 
    playerStats.totalScore = Math.max(0, playerStats.totalScore - penalty);
    
    // --- LOGRO OCULTO TRAMPOSO ---
    if (!playerStats.achievements.includes('tramposo')) {
        playerStats.achievements.push('tramposo');
    }

    saveStatsLocally();
    submitLeaderboard(); 
    
    initAudio(); SFX.incorrect();
    showToast('¡Trampa detectada!', `Has recibido la marca permanente de Tramposo.`, 'var(--accent-red)', SVG_SKULL);
    
    document.getElementById('app').classList.remove('streak-active');
    streak = 0;
    switchScreen('start-screen');
}

// --- GENERACIÓN DE UUID ---
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

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
    qualityMode: 'normal',
    seenChristopher: false, christopherCardViews: 0, christopherSeenCount: 0
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
    // x15: exactamente 100k ±500 — revocamos si bestScore < 99500
    if(bs < 99500) toRevoke.push('x15');

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
    const toRevoke = new Set();

    // fin1 (Nocturno): solo válido si se jugó en ese horario (flag real)
    if (!playerStats.playedNocturno && playerStats.achievements.includes('fin1')) toRevoke.add('fin1');
    // fin2 (Madrugador): solo válido si se jugó antes de las 6am (flag real)
    if (!playerStats.playedMadrugador && playerStats.achievements.includes('fin2')) toRevoke.add('fin2');
    // ret1–ret5 (Fiel): solo válidos si totalDaysPlayed >= umbral (bug: split devolvía array)
    const retTiers = [3,7,15,30,60];
    retTiers.forEach((t,i) => { 
        if ((playerStats.totalDaysPlayed||0) < t && playerStats.achievements.includes(`ret${i+1}`)) toRevoke.add(`ret${i+1}`); 
    });
    // bs1–bs8: requieren bestScore real
    const bsTiers2 = [5000,25000,75000,150000,300000,600000,1000000,2000000];
    bsTiers2.forEach((t,i) => { 
        if ((playerStats.bestScore||0) < t && playerStats.achievements.includes(`bs${i+1}`)) toRevoke.add(`bs${i+1}`);
    });
    // hs1–hs8: requieren haber superado 100k, no 20k
    if ((playerStats.bestScore||0) < 100000) {
        for(let i=0;i<8;i++) { if(playerStats.achievements.includes(`hs${i+1}`)) toRevoke.add(`hs${i+1}`); }
    }
    // x1 (Primer Día): siempre válido si hay datos (no revocar)
    // x18 (El Clásico): solo válido si nameChanges===0 y maxLoginStreak>=30
    if (!( playerStats.nameChanges===0 && (playerStats.maxLoginStreak||0)>=30 ) && playerStats.achievements.includes('x18')) toRevoke.add('x18');

    if (toRevoke.size > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevoke.has(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke.has(id));
        saveStatsLocally();
        const revokedCount = before - playerStats.achievements.length;
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

function showToast(title, message, color, icon) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div'); 
    toast.className = 'toast-item'; 
    toast.innerHTML = `<div class="toast-icon" style="color: ${color}">${icon}</div><div class="toast-text"><span class="toast-title" style="color:${color}">${title}</span><span class="toast-name">${message}</span></div>`;
    container.appendChild(toast); 
    setTimeout(() => toast.classList.add('show'), 50); 
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 500); }, 3500);
}

// --- Módulo: Clasificación Global ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbxbLrjL45NYaQsRaSlZJXHKlQj-1Qh4f-CPxz4KsOMpfMI4jwwYC1UrNpnm_-f6ISeCww/exec"; 

function calculatePowerLevel(stats) {
    const base = stats.totalScore * 0.05; 
    const best = stats.bestScore * 1.5; 
    const streak = stats.maxStreak * 200;
    const perf = stats.perfectGames * 1000;
    const achs = stats.achievements.length * 300;
    const winRate = stats.gamesPlayed > 0 ? (stats.totalCorrect / (stats.gamesPlayed * 20)) * 5000 : 0;
    return Math.floor(base + best + streak + perf + achs + winRate);
}

let _submitDebounceTimer = null;
async function submitLeaderboard() {
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR" || GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    // Debounce: avoid multiple rapid submits (e.g. saveGameStats + setInterval overlap)
    clearTimeout(_submitDebounceTimer);
    _submitDebounceTimer = setTimeout(async () => {
        const pl = calculatePowerLevel(playerStats);
        playerStats.powerLevel = pl;
        // CHRISTOPHER: UUID canónico fijo + nombre propio
        const _isAdmin = playerStats.playerName.toUpperCase() === 'CHRISTOPHER';
        const payload = {
            uuid:       _isAdmin ? '00000000-spec-tral-0000-klickphantom0' : playerStats.uuid,
            name:       playerStats.playerName,
            rankTitle:  getRankInfo(playerStats).title,
            powerLevel: _isAdmin ? 21000000 : pl,
            totalScore: playerStats.totalScore,
            maxStreak:  playerStats.maxStreak
        };
        try { await fetch(GAS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
        } catch(e) {}
    }, 1200);
}

async function fetchLeaderboard() {
    if(GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    try {
        const res = await fetch(GAS_URL);
        const topPlayers = await res.json();
        const isLight = document.body.classList.contains('light-mode');
        
        // Map rank title to color
        function rankTitleColor(title) {
            switch(title) {
                case 'Divinidad': return isLight ? '#6b0fa8' : 'var(--divinity-color-static)';
                case 'Mítico':  return isLight ? '#000000' : '#ffffff';
                case 'Leyenda': return isLight ? '#8a6200' : 'var(--accent-yellow)';
                case 'Maestro': return isLight ? '#7a0a8c' : 'var(--accent-purple)';
                case 'Pro':     return isLight ? '#c41940' : 'var(--accent-red)';
                case 'Junior':  return isLight ? '#0070a8' : 'var(--accent-blue)';
                default:        return isLight ? '#0a7a3e' : 'var(--accent-green)';
            }
        }
        
        // Guardar datos para las tarjetas de perfil
        window._leaderboardData = topPlayers;

        let html = "";
        // CHRISTOPHER no ocupa posición numerada — se excluye del conteo
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
                // nm7: Remontada
                if (prevPos >= 15 && pos <= 5) playerStats.rankRemontada = true;
                // nm5: Vigilia — PL sube 3 días consecutivos
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
            // nm6: Impostado — estamos por encima de alguien con >1000 PL más
            if (!playerStats.surpassedHighPLPlayer && playerStats.uuid) {
                const myEntry = topPlayers.find(x => x.uuid === playerStats.uuid);
                const myIdx   = myEntry ? topPlayers.indexOf(myEntry) : -1;
                if (myEntry && !isMe && myIdx < index && p.powerLevel > (myEntry.powerLevel || 0) + 1000) {
                    playerStats.surpassedHighPLPlayer = true;
                }
            }

            // Tracking: primer avistamiento de CHRISTOPHER
            if (isChristopher && !playerStats.seenChristopher) {
                playerStats.seenChristopher = true;
                saveStatsLocally(); checkAchievements();
            }
            if (isChristopher) {
                playerStats.christopherSeenCount = (playerStats.christopherSeenCount||0) + 1;
            }

            const displayPos = isChristopher ? '∞' : pos;

            // Podio titles — requiere Leyenda o superior
            let rankTitle = p.rankTitle;
            const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
            if (!isChristopher && pos <= 3 && (p.rankTitle === 'Leyenda' || p.rankTitle === 'Mítico' || p.rankTitle === 'Divinidad')) rankTitle = podiumTitles[pos];
            if (isChristopher) rankTitle = 'Arquitecto del Sistema';

            const meClass          = isMe ? 'is-me' : '';
            const divinidadClass   = p.rankTitle === 'Divinidad' ? 'divinidad-card'   : '';
            const leyendaClass     = p.rankTitle === 'Leyenda'   ? 'leyenda-card'     : '';
            const miticoClass      = p.rankTitle === 'Mítico'    ? 'mitico-card'      : '';
            const christopherClass = isChristopher               ? 'christopher-card' : '';
            const titleColor = rankTitleColor(p.rankTitle);
            // Christopher y Divinidad: el CSS maneja el color — no aplicar inline style
            const titleStyle = (isChristopher || p.rankTitle === 'Divinidad') ? '' : `color:${titleColor}`;

            html += `<div class="rank-card ${meClass} ${divinidadClass} ${leyendaClass} ${miticoClass} ${christopherClass}" onclick="openPlayerCard(${index})" title="Ver perfil">
                <div class="rc-pos">${displayPos}</div>
                <div class="rc-info">
                    <div class="rc-name">${p.name}</div>
                    <div class="rc-title" style="${titleStyle}">${rankTitle}</div>
                </div>
                <div class="rc-score">${p.powerLevel.toLocaleString()} <span>PL</span></div>
            </div>`;
        });
        document.getElementById('ranking-list').innerHTML = html;
        // Track successful loads for 'Bien Conectado' ui8
        playerStats.successfulLeaderboardLoads = (playerStats.successfulLeaderboardLoads||0) + 1;
        // ui6: Fan de Clasificación — visita el ranking cuando hay menos de 5 jugadores
        if (topPlayers.length < 5 && !playerStats.achievements.includes('ui6')) {
            playerStats.achievements.push('ui6');
            const _ui6 = ACHIEVEMENTS_MAP.get('ui6');
            if (_ui6) { try { SFX.achievement(); } catch(e){} showToast('Logro Desbloqueado', _ui6.title, _ui6.color, _ui6.icon); }
        }
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
        'Divinidad': { color: light ? '#6b0fa8' : 'var(--divinity-color)', rgb: '180,100,255' },
        'Mítico':  { color: light ? '#000000' : '#ffffff', rgb: '255,255,255' },
        'Leyenda': { color: light ? '#8a6200' : '#ffb800', rgb: '255,184,0'   },
        'Maestro': { color: light ? '#7a0a8c' : '#b5179e', rgb: '181,23,158'  },
        'Pro':     { color: light ? '#c41940' : '#ff2a5f', rgb: '255,42,95'   },
        'Junior':  { color: light ? '#0070a8' : '#00d4ff', rgb: '0,212,255'   },
    };
    return map[title] || { color: light ? '#0a7a3e' : '#00ff66', rgb: '0,255,102' };
}

// ── Canvas de partículas exclusivo de la tarjeta ──────────────────
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
    const n = Math.min(55, Math.round((_pc.canvas.width * _pc.canvas.height) / 14000));
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
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        p.x += p.dx; p.y += p.dy;
        c.moveTo(p.x + p.s, p.y);
        c.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    }
    c.fill();

    // Líneas de conexión
    const maxD2 = (W / 8) * (H / 8);
    c.lineWidth = 0.6;
    for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
            const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
            const d2 = dx*dx + dy*dy;
            if (d2 < maxD2) {
                const alpha = (1 - d2 / maxD2) * 0.22;
                c.strokeStyle = `rgba(${_pc.rgb},${alpha.toFixed(2)})`;
                c.beginPath();
                c.moveTo(pts[a].x, pts[a].y);
                c.lineTo(pts[b].x, pts[b].y);
                c.stroke();
            }
        }
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

// ── Abrir tarjeta ─────────────────────────────────────────────────
function openPlayerCard(index) {
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
    let displayTitle = isChristopherCard ? 'Arquitecto del Sistema' : baseRank;
    const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
    if (!isChristopherCard && pos <= 3 && (baseRank === 'Leyenda' || baseRank === 'Mítico' || baseRank === 'Divinidad')) displayTitle = podiumTitles[pos];

    // CSS vars en el overlay para el gradiente de fondo
    const overlay = document.getElementById('pcard-overlay');
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
    // christopher-name-gradient aplica color sólido #c864ff vía CSS (sin animación)
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
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ── Cerrar tarjeta ────────────────────────────────────────────────
function closePlayerCard() {
    const overlay = document.getElementById('pcard-overlay');
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
//  12. INTERFAZ         — logros de navegación, perfil, guía, ranking   (exploración)
//  13. CONFIGURACIÓN    — música, FPS, partículas, temas                (tweaker)
//  14. CLASIFICACIÓN    — ranking global, PL, podio                     (competitivo)
//  15. ESPECIALES       — únicos narrativos, raros y secretos           (difíciles)
//  16. MAESTROS         — coleccionismo extremo                         (platino)
// ═══════════════════════════════════════════════════════════════════════════

// --- Data Logros ---
const ACHIEVEMENTS_DATA = [];
const colors = { blue: 'var(--accent-blue)', green: 'var(--accent-green)', yellow: 'var(--accent-yellow)', orange: 'var(--accent-orange)', red: 'var(--accent-red)', purple: 'var(--accent-purple)', dark: 'var(--text-secondary)' };

const CHEATER_ACHIEVEMENT = { id: 'tramposo', title: 'TRAMPOSO', desc: 'Infringió las normas. Marca imborrable.', color: 'var(--accent-red)', icon: SVG_SKULL };

function addAchs(arr) { arr.forEach(a => ACHIEVEMENTS_DATA.push(a)); }

// ─── 1. BIENVENIDA (8) ────────────────────────────────────────────────────
addAchs([
    { id: 'x1',       title: 'Primer Día',        desc: 'Inicia sesión por primera vez.',                               color: colors.blue,   icon: SVG_CLOCK },
    { id: 'm1',       title: 'Bautizado',          desc: 'Configura tu nombre de jugador por primera vez.',             color: colors.blue,   icon: SVG_USER },
    { id: 'ui7',      title: 'Nuevo en el Barrio', desc: 'Juega tu primera partida con nombre registrado.',             color: colors.green,  icon: SVG_USER },
    { id: 'x3',       title: 'Aprendiz',           desc: 'Completa tu primera partida (sin importar el puntaje).',      color: colors.green,  icon: SVG_TARGET },
    { id: 'x2',       title: 'Paciente',           desc: 'Espera 10 segundos en el menú principal sin hacer nada.',     color: colors.dark,   icon: SVG_CLOCK },
    { id: 'u1',       title: 'Error Inicial',      desc: 'Equivócate al responder por primera vez.',                   color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u3',       title: 'Dormilón',           desc: 'Deja que el reloj llegue a cero en una pregunta.',            color: colors.dark,   icon: SVG_CLOCK },
    { id: 'secret_logo', title: '¡Klick!',         desc: 'Hiciste clic en el nombre del juego en la pantalla principal.', color: colors.yellow, icon: SVG_BOLT, hidden: true },
]);

// ─── 2. PARTIDAS JUGADAS (8 escalables + partidas por día 5+5) ───────────
const ptTiers=[1,5,10,25,50,100,200,500];
for(let i=0;i<8;i++) addAchs([{ id:`p${i+1}`, title:`Jugador ${i+1}`, desc:`Acumula ${ptTiers[i]} partidas jugadas.`, color:colors.blue, icon:SVG_TARGET }]);

const todayTiers=[3,5,8,10,15];
for(let i=0;i<5;i++) addAchs([{ id:`td${i+1}`, title:`Intenso ${i+1}`, desc:`Juega ${todayTiers[i]} partidas en un solo día.`, color:colors.orange, icon:SVG_FIRE }]);
addAchs([
    { id: 'x13', title: 'Noche de Fuego',    desc: 'Juega 10 partidas o más en un único día.',                         color: colors.red,    icon: SVG_FIRE },
    { id: 'x20', title: 'Pura Determinación',desc: 'Juega 20 partidas en un mismo día.', color: colors.red, icon: SVG_FIRE },
    { id: 'u22', title: 'Maratón',           desc: 'Juega 50 partidas en un solo día.',                                color: colors.purple, icon: SVG_HEART },
]);

// ─── 3. DÍAS Y FIDELIDAD (10 días + 5 asiduo + 5 fiel) ───────────────────
const daysTiers  = [1,2,3,5,7,15,21,30,60,90];
const daysTitles = ['Hola Mundo','Doble','Triple','Cinco','Semana Activa','Quincena','Tres Semanas','Un Mes','Bimestre','Trimestre Fuego'];
for(let i=0;i<5;i++) addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Inicia sesión durante ${daysTiers[i]} días consecutivos.`, color:colors.green, icon:SVG_CLOCK }]);
for(let i=5;i<10;i++) addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Juega en ${daysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const totalDaysTiers=[5,10,20,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`td2${i+1}`, title:`Asiduo ${i+1}`, desc:`Juega en ${totalDaysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const returnDayTiers=[3,7,15,30,60];
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
    { id: 'u15',  title: 'Superviviente',    desc: 'Llega a 100 preguntas en una sola partida.',                        color: colors.green,  icon: SVG_SHIELD },
    { id: 'x11',  title: 'El Último Chance', desc: 'Responde correctamente estando en la última vida.',                 color: colors.orange, icon: SVG_SHIELD },
]);

// ─── 6. RACHA Y MULTIPLICADOR (8 racha + 10 mult) ────────────────────────
const strkTiers=[5,10,15,20,25,30,40,50];
for(let i=0;i<8;i++) addAchs([{ id:`sk${i+1}`, title:`Encadenado ${i+1}`, desc:`Alcanza una racha de ${strkTiers[i]} aciertos seguidos en alguna partida.`, color:colors.orange, icon:SVG_BOLT }]);
addAchs([
    { id: 'u23', title: 'Imparable', desc: 'Encadena una racha de 25 aciertos o más en una partida.', color: colors.yellow, icon: SVG_TARGET },
]);
const multTiers=[2,3,4,5,6];
for(let i=0;i<5;i++) addAchs([{ id:`mx${i+1}`, title:`Multiplicador x${multTiers[i]}`, desc:`Alcanza el multiplicador x${multTiers[i]} en una partida.`, color:colors.red, icon:SVG_FIRE }]);
addAchs([
    { id: 'mx6',  title: 'Multiplicador x6',           desc: 'Alcanza el multiplicador x6 en una partida.',             color: colors.purple, icon: SVG_FIRE },
    { id: 'mx7',  title: 'Multiplicador x7',           desc: 'Alcanza el multiplicador x7 en una partida.',             color: colors.red,    icon: SVG_FIRE },
    { id: 'mx8',  title: 'Multiplicador x8',           desc: 'Alcanza el multiplicador x8 en una partida.',             color: colors.red,    icon: SVG_BOLT },
    { id: 'mx9',  title: 'Multiplicador x9',           desc: 'Alcanza el multiplicador x9 en una partida.',             color: colors.yellow, icon: SVG_BOLT },
    { id: 'mx10', title: 'Multiplicador x10 — MÁXIMO', desc: 'Alcanza el multiplicador máximo x10. Eres imparable.',    color: colors.yellow, icon: SVG_TROPHY },
    { id: 'u16',  title: 'Frenesí Máximo',             desc: 'Alcanza el multiplicador x4 o superior.',                 color: colors.orange, icon: SVG_FIRE },
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

// ─── 8. FRENESÍ (8 conteo + 5 eterno) ────────────────────────────────────
const frTiers=[1,5,10,25,50,100,200,500];
for(let i=0;i<8;i++) addAchs([{ id:`r${i+1}`, title:`Frenético ${i+1}`, desc:`Activa el Modo Frenesí en ${frTiers[i]} ocasiones.`, color:colors.orange, icon:SVG_FIRE }]);
const frenzyTimeTiers=[3,5,8,12,20];
for(let i=0;i<5;i++) addAchs([{ id:`ft${i+1}`, title:`Frenesí Eterno ${i+1}`, desc:`Mantén el Modo Frenesí activo durante ${frenzyTimeTiers[i]} preguntas consecutivas.`, color:colors.red, icon:SVG_FIRE }]);
addAchs([
    { id: 'extra1', title: 'Doble Frenesí', desc: 'Activa el Modo Frenesí dos veces en la misma partida.',              color: colors.red,    icon: SVG_FIRE },
    { id: 'fin3',   title: 'Momento Épico', desc: 'Entra en Modo Frenesí y luego consigue 20 aciertos más.',            color: colors.red,    icon: SVG_FIRE },
]);

// ─── 9. ACIERTOS TOTALES (8 escalables) ──────────────────────────────────
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
    { id: 'u2',   title: 'Tropiezo',    desc: 'Acumula 100 respuestas incorrectas en tu carrera.',                     color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u4',   title: 'AFK',         desc: 'Deja que el reloj llegue a cero 50 veces en total.',                    color: colors.dark,   icon: SVG_CLOCK },
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
    { id: 'kpa4', title: 'Casi en la Cima',  desc: 'Completa 75 niveles del Klick Pass.',                             color: colors.orange, icon: SVG_STAR },
    { id: 'kpa9', title: 'Sin Pausas',       desc: 'Completa 10 niveles del Klick Pass en una sola sesión.',          color: colors.orange, icon: SVG_BOLT },
    { id: 'kpa5', title: 'Pase Completado',  desc: 'Reclama los 100 niveles del Klick Pass en su totalidad.',         color: colors.red,    icon: SVG_STAR },
    { id: 'kpa10',title: 'Coleccionista Total', desc: 'Completa el Klick Pass y desbloquea más de 200 logros.',       color: colors.red,    icon: SVG_TROPHY },
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
    { id: 'ui10', title: 'El Circuito',         desc: 'Navega por las 4 secciones del juego en orden secuencial.',     color: colors.purple, icon: SVG_FIRE },
    { id: 'ui2',  title: 'Vuelvo en Un Segundo',desc: 'Entra y sal del menú de Configuración en menos de 3 segundos.', color: colors.yellow, icon: SVG_BOLT },
    { id: 'ui5',  title: 'El Perfil Importa',   desc: 'Visita tu perfil después de cada una de tus primeras 5 partidas.', color: colors.blue, icon: SVG_USER },
    { id: 'ui6',  title: 'Fan de Clasificación',desc: 'Visita la Clasificación mientras hay menos de 5 jugadores.',    color: colors.dark,   icon: SVG_TROPHY },
    { id: 'ui8',  title: 'Bien Conectado',      desc: 'La clasificación global carga sin errores 10 veces.',           color: colors.blue,   icon: SVG_TARGET },
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

// ─── 16. NOMBRE DE JUGADOR (3) ────────────────────────────────────────────
addAchs([
    { id: 'm2',  title: 'Agente Secreto', desc: 'Cambia tu nombre de jugador 5 veces.',                               color: colors.purple, icon: SVG_USER },
    { id: 'm3',  title: 'Identidad Falsa',desc: 'Cambia tu nombre de jugador 20 veces.',                              color: colors.red,    icon: SVG_USER },
]);

// ─── 17. LOGROS META Y COLECCIÓN (m8–m10 + pins + productivo + day) ──────
addAchs([
    { id: 'm8',  title: 'Coleccionista',  desc: 'Desbloquea 10 logros en total.',                                     color: colors.green,  icon: SVG_STAR },
    { id: 'm9',  title: 'Completista',    desc: 'Alcanza el hito de 50 logros desbloqueados.',                        color: colors.orange, icon: SVG_STAR },
    { id: 'm10', title: 'Centenario',     desc: 'Consigue 100 logros desbloqueados.',                                 color: colors.red,    icon: SVG_STAR },
    { id: 'm7',  title: 'Diseñador',      desc: 'Fija tu primer logro en el perfil.',                                 color: colors.yellow, icon: SVG_STAR },
    { id: 'np2', title: 'Presumido',      desc: 'Fija 3 logros de color Rojo, Naranja o Dorado en tu perfil.',        color: colors.red,    icon: SVG_STAR },
]);
const pinTiers=[1,5,10,20,50];
for(let i=0;i<5;i++) addAchs([{ id:`pin${i+1}`, title:`Curador ${i+1}`, desc:`Fija logros en el perfil ${pinTiers[i]} veces en total.`, color:colors.blue, icon:SVG_PIN }]);
const dailyAchTiers=[1,3,5,8,12];
for(let i=0;i<5;i++) addAchs([{ id:`da${i+1}`, title:`Productivo ${i+1}`, desc:`Desbloquea ${dailyAchTiers[i]} logros nuevos en un mismo día.`, color:colors.purple, icon:SVG_STAR }]);
addAchs([
    { id: 'extra5', title: 'Día Épico',  desc: 'Desbloquea 10 logros en un mismo día.',                               color: colors.purple, icon: SVG_STAR },
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
    { id: 'pod1', title: 'Rey Klick',         desc: 'Eres Leyenda y ocupas el 1.er lugar de la clasificación.',       color: '#6e8fad',    icon: SVG_TROPHY },
    { id: 'pod2', title: 'Señor Klick',       desc: 'Eres Leyenda y ocupas el 2.º lugar de la clasificación.',        color: '#ff5e00',    icon: SVG_TROPHY },
    { id: 'pod3', title: 'Caballero Klick',   desc: 'Eres Leyenda y ocupas el 3.er lugar de la clasificación.',       color: '#ccff00',    icon: SVG_TROPHY },
]);

// ─── 19. RANGOS (Junior → Mítico) ─────────────────────────────────────────
addAchs([
    { id: 'u_junior',  title: 'Junior',   desc: 'Alcanza el rango Junior.',                                           color: colors.blue,   icon: SVG_TROPHY },
    { id: 'u6',        title: 'Pro',      desc: 'Alcanza el rango Pro.',                                              color: colors.red,    icon: SVG_TROPHY },
    { id: 'u7',        title: 'Maestro',  desc: 'Alcanza el rango Maestro.',                                          color: colors.purple, icon: SVG_TROPHY },
    { id: 'u8',        title: 'Leyenda',  desc: 'Alcanza el codiciado rango Leyenda.',                                color: colors.yellow, icon: SVG_TROPHY },
    { id: 'u_mitico',  title: 'Mítico',   desc: 'Alcanza el rango Mítico. El más difícil de conseguir.',              color: '#ffffff',     icon: SVG_STAR },
    { id: 'fin4',      title: 'El Pacto', desc: 'Juega durante 7 días seguidos y alcanza el rango Junior.',           color: colors.green,  icon: SVG_SHIELD },
    { id: 'x17',       title: 'Veterano', desc: 'Acumula más de 100 partidas jugadas.',                               color: colors.blue,   icon: SVG_TROPHY },
]);

// ─── 22. PANTALLA DE RANGOS (nuevos logros de navegación) ─────────────
addAchs([
    { id: 'rk1', title: 'Explorador de Rangos',   desc: 'Visita la pantalla de Rangos por primera vez.',                color: colors.blue,   icon: SVG_TROPHY },
    { id: 'rk2', title: 'Aspirante Consciente',   desc: 'Visita la pantalla de Rangos 5 veces.',                        color: colors.green,  icon: SVG_TROPHY },
    { id: 'rk3', title: 'Calculador',             desc: 'Visita la pantalla de Rangos 15 veces.',                       color: colors.purple, icon: SVG_TARGET },
    { id: 'rk4', title: 'Obsesionado con el Rango', desc: 'Visita la pantalla de Rangos 30 veces.',                     color: colors.orange, icon: SVG_TARGET },
    { id: 'rk5', title: 'Cartógrafo Klick',       desc: 'Visita la pantalla de Rangos 50 veces.',                       color: colors.yellow, icon: SVG_STAR },
]);

// ─── 23. ESTADÍSTICAS EXTREMAS — DIVINIDAD ──────────────────────────────
addAchs([
    { id: 'div1', title: 'Punto de No Retorno',   desc: 'Acumula 2,000,000 puntos en total.',                           color: colors.red,    icon: SVG_BOLT },
    { id: 'div2', title: 'El Inmortal',           desc: 'Alcanza 8,000 aciertos totales.',                              color: colors.purple, icon: SVG_FIRE },
    { id: 'div3', title: 'Trascendencia',         desc: 'Completa 75 partidas perfectas.',                              color: colors.yellow, icon: SVG_STAR },
]);

// ─── 24. EXPANSIÓN PREGUNTAS ALCANZADAS ──────────────────────────────────
addAchs([
    { id: 'pf9',  title: 'Sin Fin I',    desc: 'Llega a la pregunta 200 en una partida.',                               color: colors.green,  icon: SVG_BOLT },
    { id: 'pf10', title: 'Sin Fin II',   desc: 'Llega a la pregunta 400 en una partida.',                               color: colors.orange, icon: SVG_BOLT },
    { id: 'pf11', title: 'Sin Fin III',  desc: 'Llega a la pregunta 800 en una partida.',                               color: colors.red,    icon: SVG_BOLT },
]);

// ─── 25. EXPANSIÓN RESPUESTAS RÁPIDAS ────────────────────────────────────
addAchs([
    { id: 'sp9',  title: 'Reflejo Sobrehumano',   desc: 'Acumula 2,000 respuestas rápidas en total.',                   color: colors.blue,   icon: SVG_BOLT },
    { id: 'sp10', title: 'Máquina Klick',         desc: 'Acumula 5,000 respuestas rápidas en total.',                   color: colors.purple, icon: SVG_BOLT },
    { id: 'sp11', title: 'Velocidad Absoluta',    desc: 'Acumula 10,000 respuestas rápidas en total.',                  color: colors.yellow, icon: SVG_FIRE },
]);

// ─── 26. PRECISIÓN GLOBAL ────────────────────────────────────────────────
addAchs([
    { id: 'prec1', title: 'Sin Fisuras', desc: 'Alcanza 95% de precisión global acumulada (mín. 500 respuestas).', color: colors.blue, icon: SVG_TARGET },
]);

// ─── 27. EL ARQUITECTO — logros relacionados con CHRISTOPHER ─────────────
addAchs([
    { id: 'cx1', title: 'Avistamiento',       desc: 'Ve al Arquitecto del Sistema en la Clasificación por primera vez.',   color: 'var(--divinity-color-static)', icon: SVG_TROPHY },
    { id: 'cx2', title: 'Cara a Cara',        desc: 'Abre la tarjeta de CHRISTOPHER en la Clasificación.',                 color: 'var(--divinity-color-static)', icon: SVG_USER },
    { id: 'cx4', title: 'Testigo del Origen', desc: 'Visita la Clasificación 10 veces mientras CHRISTOPHER está presente.', color: 'var(--divinity-color-static)', icon: SVG_STAR },
]);


// ─── 20. ÚNICOS DE HORARIO Y SITUACIÓN (logros narrativos raros) ──────────
addAchs([
    { id: 'fin1', title: 'Nocturno',      desc: 'Juega una partida después de las 11:00 PM.',                        color: colors.dark,   icon: SVG_CLOCK },
    { id: 'fin2', title: 'Madrugador',    desc: 'Juega una partida antes de las 6:00 AM.',                          color: colors.blue,   icon: SVG_CLOCK },
    { id: 'fin5', title: 'Monarca',       desc: 'Alcanza simultáneamente el rango Leyenda y 200 logros.',            color: colors.yellow, icon: SVG_TROPHY },
]);

// ─── 21. MAESTROS DE COLECCIÓN (logros extremos de platino) ─────────────
addAchs([
    { id: 'master1', title: 'Casi Dios',    desc: 'Desbloquea 50 logros en total.',                                  color: colors.yellow, icon: SVG_STAR },
    { id: 'master2', title: 'Semidivino',   desc: 'Desbloquea 100 logros en total.',                                  color: colors.orange, icon: SVG_STAR },
    { id: 'master4', title: 'Leyenda Total',desc: 'Desbloquea 130 logros en total.',                                  color: colors.purple, icon: SVG_STAR },
    { id: 'master5', title: 'A las Puertas', desc: 'Desbloquea 155 logros en total. El límite está a la vista.',      color: colors.yellow, icon: SVG_STAR },
    { id: 'master3', title: 'Dios Klick',   desc: 'Desbloquea los 165 logros del juego. Eres absoluto.',            color: colors.red,    icon: SVG_STAR },
]);

// ── Índice O(1) para lookup por ID ──────────────────────────────────────────
const ACHIEVEMENTS_MAP   = new Map(ACHIEVEMENTS_DATA.map(a => [a.id, a]));
const ACHIEVEMENTS_INDEX = new Map(ACHIEVEMENTS_DATA.map((a, i) => [a.id, i]));

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
    if ((stats.playerName||''). toUpperCase() === 'CHRISTOPHER' && stats.uuid === '00000000-spec-tral-0000-klickphantom0')
        return { title: "Divinidad", color: "var(--divinity-color)", rgb: "180,100,255", divinidad: true };
    // ── Mítico ───────────────────────────────────────────────────────
    if (stats.totalScore >= 1200000 && stats.totalCorrect >= 5000 && stats.perfectGames >= 50 &&
        (stats.achievements||[]).length >= 200 && stats.maxStreak >= 40 && (stats.maxMult||1) >= 8 &&
        accuracy >= 85 && stats.maxLoginStreak >= 30)
        return { title: "Mítico", color: "#ffffff", rgb: "255,255,255", mitico: true };
    if (stats.totalScore >= 400000 && stats.totalCorrect >= 1500 && stats.perfectGames >= 10) return { title: "Leyenda", color: "var(--accent-yellow)", rgb: "255,184,0" };
    if (stats.totalScore >= 150000 && stats.gamesPlayed >= 50 && (stats.maxMult||1) >= 4) return { title: "Maestro", color: "var(--accent-purple)", rgb: "181,23,158" };
    if (stats.totalScore >= 60000 && stats.totalCorrect >= 200 && stats.maxStreak >= 12) return { title: "Pro", color: "var(--accent-red)", rgb: "255,42,95" };
    if (stats.bestScore >= 15000 && stats.gamesPlayed >= 5) return { title: "Junior", color: "var(--accent-blue)", rgb: "0,212,255" };
    return { title: "Novato", color: "var(--accent-green)", rgb: "0,255,102" };
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
    
    if (achSet.has('tramposo')) {
        if (!playerStats.pinnedAchievements.includes('tramposo')) {
            playerStats.pinnedAchievements.unshift('tramposo');
            if (playerStats.pinnedAchievements.length > 3) playerStats.pinnedAchievements.pop();
        } else if (playerStats.pinnedAchievements.indexOf('tramposo') !== 0) {
            playerStats.pinnedAchievements.splice(playerStats.pinnedAchievements.indexOf('tramposo'), 1);
            playerStats.pinnedAchievements.unshift('tramposo');
        }
    }

    const normalAchs = playerStats.achievements.filter(id => id !== 'tramposo').length;

    // META
    if (playerStats.nameChanges >= 1) unlock('m1'); if (playerStats.nameChanges >= 5) unlock('m2'); if (playerStats.nameChanges >= 20) unlock('m3');
    if (playerStats.achViews >= 1) unlock('m4'); if (playerStats.achViews >= 10) unlock('m5'); if (playerStats.achViews >= 50) unlock('m6');
    if (playerStats.pinnedAchievements.filter(id => id !== 'tramposo').length > 0) unlock('m7'); 
    if (normalAchs >= 10) unlock('m8'); if (normalAchs >= 50) unlock('m9'); if (normalAchs >= 100) unlock('m10');
    // Colección maestra — escalera coherente con el total real de 165 logros
    if (normalAchs >= 50)  unlock('master1'); // Casi Dios
    if (normalAchs >= 100) unlock('master2'); // Semidivino
    if (normalAchs >= 130) unlock('master4'); // Leyenda Total
    if (normalAchs >= 155) unlock('master5'); // A las Puertas
    if (normalAchs >= 165) unlock('master3'); // Dios Klick — todos
    // ── Pantalla de Rangos ──────────────────────────────────────────
    const rv2 = playerStats.ranksViews||0;
    if(rv2>=1) unlock('rk1'); if(rv2>=5) unlock('rk2'); if(rv2>=15) unlock('rk3'); if(rv2>=30) unlock('rk4'); if(rv2>=50) unlock('rk5');
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
    if(pf>=200) unlock('pf9'); if(pf>=400) unlock('pf10'); if(pf>=800) unlock('pf11');
    const sp = playerStats.fastAnswersTotal; for(let i=0;i<8;i++) if(sp>=spdTiers[i]) unlock(`sp${i+1}`);
    if(sp>=2000) unlock('sp9'); if(sp>=5000) unlock('sp10'); if(sp>=10000) unlock('sp11');
    const ac = playerStats.totalCorrect; for(let i=0;i<8;i++) if(ac>=acTiers[i]) unlock(`ac${i+1}`);
    const sk = playerStats.maxStreak; for(let i=0;i<8;i++) if(sk>=strkTiers[i]) unlock(`sk${i+1}`);
    const mx = playerStats.maxMult||1; for(let i=0;i<5;i++) if(mx>=multTiers[i]) unlock(`mx${i+1}`);
    const rv = playerStats.rankingViews||0; for(let i=0;i<5;i++) if(rv>=rankVisTiers[i]) unlock(`rv${i+1}`);
    const cv = playerStats.configViews||0; for(let i=0;i<4;i++) if(cv>=cfgVisTiers[i]) unlock(`cv${i+1}`);

    const nt = playerStats.maxNoTimeoutStreak||0; for(let i=0;i<5;i++) if(nt>=noTimoutTiers[i]) unlock(`nt${i+1}`);

    // ÚNICOS
    if (playerStats.totalWrong > 0) unlock('u1'); if (playerStats.totalWrong >= 100) unlock('u2'); 
    if (playerStats.totalTimeouts > 0) unlock('u3'); if (playerStats.totalTimeouts >= 50) unlock('u4'); 
    if (playerStats.todayGames >= 50) unlock('u22'); if ((playerStats.maxStreak||0) >= 25) unlock('u23');
    const rank = getRankInfo(playerStats).title; 
    // Logros de rango: solo usar el rango REAL de playerStats (stats guardadas).
    // NO proyectar con el score en curso para evitar otorgar logros de rango
    // que se revocarían si el jugador abandona o pierde antes de terminar la partida.
    const effectiveRank = rank;
    // Rank achievements: cada rango desbloquea todos los anteriores (escalera)
    if (effectiveRank==="Junior"||effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u_junior');
    if (effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u6'); 
    if (effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u7'); 
    if (effectiveRank==="Leyenda"||effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u8');
    if (effectiveRank==="Mítico"||effectiveRank==="Divinidad") unlock('u_mitico');
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
    if (kpClaimed >= 50)                                         unlock('kpa3');
    if ((playerStats.kpSessionClaims||0) >= 10)                 unlock('kpa9');
    if (kpClaimed >= 75)                                         unlock('kpa4');
    if (kpClaimed >= 100)                                        unlock('kpa5');
    if (kpClaimed >= 100 && normalAchs >= 200)                  unlock('kpa10');

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
    if(rp===1 && (rank==='Leyenda'||rank==='Mítico'||rank==='Divinidad')) unlock('pod1');
    if(rp===2 && (rank==='Leyenda'||rank==='Mítico'||rank==='Divinidad')) unlock('pod2');
    if(rp===3 && (rank==='Leyenda'||rank==='Mítico'||rank==='Divinidad')) unlock('pod3');

    // MULTIPLICADORES x6-x10
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
    const retv = playerStats.totalDaysPlayed||0; for(let i=0;i<5;i++) if(retv>=returnDayTiers[i]) unlock(`ret${i+1}`);

    const bsv = playerStats.bestScore||0; for(let i=0;i<8;i++) if(bsv>=bestScoreTiers[i]) unlock(`bs${i+1}`);
    const fts = playerStats.maxFrenzyStreak||0; for(let i=0;i<5;i++) if(fts>=frenzyTimeTiers[i]) unlock(`ft${i+1}`);

    // ÚNICOS EXTRA
    if(playerStats.gamesPlayed>=1) unlock('x3');
    if(playerStats.gamesPlayed>=1 || playerStats.maxLoginStreak>=1) unlock('x1');
    if(playerStats.gamesPlayed>=100) unlock('x17');
    if(playerStats.nameChanges===0 && playerStats.maxLoginStreak>=30) unlock('x18');
    if((rank==='Leyenda'||rank==='Mítico'||rank==='Divinidad') && normalAchs>=200) unlock('fin5');
    if(days>=7 && (rank==='Junior'||rank==='Pro'||rank==='Maestro'||rank==='Leyenda'||rank==='Mítico'||rank==='Divinidad')) unlock('fin4');
    if((playerStats.maxMult||1)>=4) unlock('u16');
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
    // ui8 Bien Conectado: 10 successful leaderboard loads
    if((playerStats.successfulLeaderboardLoads||0)>=10) unlock('ui8');

    // --- LOGROS EXTRA ---
    // extra1 Doble Frenesí: tracked in-game via frenziesThisGame persisted stat
    if((playerStats.maxFrenziesInGame||0)>=2) unlock('extra1');
    // extra2 Precisionista: partida con 100% precision min 5 respuestas
    if(playerStats.hadPerfectAccuracyGame) unlock('extra2');
    // extra3 Maratonista: 80+ preguntas en una partida
    if((playerStats.maxQuestionReached||0)>=80) unlock('extra3');
    // extra4 Silencioso: 5 partidas con música en 0
    if((playerStats.gamesAtMusicZero||0)>=5) unlock('extra4');
    // extra5 Coleccionista: 10 logros en un día
    if((playerStats.dailyAchUnlocks||0)>=10) unlock('extra5');

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
    if((playerStats.todayGames||0)>=20) unlock('x20');

    // SUPERVIVENCIA / VIDAS
    // x14: Invicto (pregunta 30 sin perder vida) — rastreado in-game via inGameUnlock; también revisar aquí por si se ganó y no se guardó
    if((playerStats.maxQuestionReached||0)>=30 && (playerStats.invictoEarned||false)) unlock('x14');
    // x10: Economía (20 preguntas sin perder vida) — in-game via inGameUnlock
    if((playerStats.x10Earned||false)) unlock('x10');
    if((playerStats.maxQuestionReached||0)>=100) unlock('u15');
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
    const td2Tiers=[5,10,20,30,60]; for(let i=0;i<5;i++) if((playerStats.totalDaysPlayed||0)>=td2Tiers[i]) unlock(`td2${i+1}`);

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
    if (_p1Tot >= 500 && (playerStats.totalCorrect||0) / _p1Tot >= 0.95) unlock('prec1');
    // ─── El Arquitecto (CHRISTOPHER) ────────────────────────────────────
    if (playerStats.seenChristopher) unlock('cx1');
    if ((playerStats.christopherCardViews||0) >= 1) unlock('cx2');
    if ((playerStats.christopherSeenCount||0) >= 10) unlock('cx4');

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
            if (progEl) progEl.innerText = `Desbloqueados: ${_vsAchSet.size - (_vsAchSet.has('tramposo') ? 1 : 0)} / ${ACHIEVEMENTS_DATA.length}`;
        } else {
            renderAchievements();
        }
        newlyUnlocked.forEach((ach, index) => { 
            setTimeout(() => { SFX.achievement(); showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon); }, index * 1300); 
        }); 
    }
}

function togglePin(achId) {
    if (achId === 'tramposo') { 
        showToast('Condena Permanente', 'Los tramposos no pueden ocultar sus actos.', 'var(--accent-red)', SVG_SKULL); 
        return; 
    }
    if (!playerStats.achievements.includes(achId)) return; SFX.click(); const index = playerStats.pinnedAchievements.indexOf(achId);
    if (index > -1) { playerStats.pinnedAchievements.splice(index, 1); showToast('Quitado del perfil', 'Ya no aparecerá destacado.', 'var(--text-secondary)', SVG_PIN); } 
    else { if (playerStats.pinnedAchievements.length >= 3) { showToast('Límite', 'Máximo 3 fijados', 'var(--accent-red)', SVG_INCORRECT); return; } playerStats.pinnedAchievements.push(achId); playerStats.totalPins = (playerStats.totalPins||0) + 1; const ach_data = ACHIEVEMENTS_MAP.get(achId); showToast('Fijado en Perfil', ach_data ? ach_data.title : achId, ach_data ? ach_data.color : '', ach_data ? ach_data.icon : ''); }
    saveStatsLocally(); checkAchievements(); renderAchievements();
}

// togglePin y revokeInvalidAchievements usan el virtual scroller automáticamente

// Rarity score: how exclusive/rare is each achievement (higher = rarer)
// ── Rarity score for auto-profile fill ──────────────────────────────────
const RARITY_SCORE = {master3:100,master5:98,master4:96,master2:91,master1:86,fin5:83,u8:81,u7:79,u15:76,nm4:74,nm3:71,nm10:69,u9:66,u23:63,u11:61,u16:59,nm9:56,u19:53,u24:51,np1:49,np3:47,u21:44,u_bisturi:42};
function getAchRarity(id) { return RARITY_SCORE[id] || 10; }

function getAutoProfileAchs() {
    const result = [];
    if (playerStats.achievements.includes('tramposo')) result.push('tramposo');
    playerStats.pinnedAchievements
        .filter(id => id !== 'tramposo')
        .forEach(id => { if (result.length < 3 && playerStats.achievements.includes(id)) result.push(id); });
    if (result.length < 3) {
        const rest = playerStats.achievements
            .filter(id => id !== 'tramposo' && !result.includes(id))
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
    if (isUnlocked && ach.id === 'u_mitico')    cls += ' ach-mitico';

    const isLight = document.body.classList.contains('light-mode');
    const displayColor = isUnlocked ? (isLight ? darkenHex(ach.color, 0.4) : ach.color) : '';
    const bdrColor = isUnlocked ? (isLight ? 'rgba(0,0,0,0.2)' : ach.color) : '';
    let shadow = '';
    if (!isLight) {
        if (isManualPin)       shadow = `0 0 14px ${ach.color}66`;
        else if (isInProfile)  shadow = `0 0 7px ${ach.color}33`;
    }

    let badge = '';
    if (isManualPin)      badge = `<div class="ach-pin-badge ach-pin-manual">${SVG_PIN}</div>`;
    else if (isInProfile) badge = `<div class="ach-pin-badge ach-pin-auto">*</div>`;

    const isHidden = ach.hidden && !isUnlocked;
    const iconColor = isUnlocked ? (isLight ? darkenHex(ach.color, 0.4) : ach.color) : 'var(--text-secondary)';
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
        _vsDisplayPin.forEach(id => {
            if (n >= 3) return;
            let ach = ACHIEVEMENTS_MAP.get(id);
            if (id === 'tramposo') ach = CHEATER_ACHIEVEMENT;
            if (!ach) return;
            const slot = document.createElement('div');
            slot.className = 'achievement-slot unlocked';
            const isLight = document.body.classList.contains('light-mode');
            const achDisplayColor = isLight ? darkenHex(ach.color, 0.4) : ach.color;
            slot.style.borderColor = isLight ? 'rgba(0,0,0,0.2)' : ach.color;
            slot.style.boxShadow = isLight ? 'none' : `0 0 12px ${ach.color}44`;
            slot.innerHTML = `<div class="ach-icon" style="color:${achDisplayColor}">${ach.icon}</div><div class="ach-title" style="color:${achDisplayColor}">${ach.title}</div>`;
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
    if (el) el.innerText = `Desbloqueados: ${_vsAchSet.size - (_vsAchSet.has('tramposo') ? 1 : 0)} / ${ACHIEVEMENTS_DATA.length}`;
}

// initializeAchievementsDOM y achCardElements ya no son necesarios con el virtual scroller
let isAchievementsInitialized = true; // siempre true, setup es lazy
const achCardElements = {};           // mantenido vacío para compatibilidad con código existente
let _currentScreen = null;
function switchScreen(id) {
    if (_currentScreen) _currentScreen.classList.remove('active');
    const next = document.getElementById(id);
    // Slightly longer delay on iOS to allow Safari layout to settle
    const delay = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 60 : 16;
    setTimeout(() => { if(next) { next.classList.add('active'); _currentScreen = next; } }, delay);
}
// Initialize current screen
_currentScreen = document.querySelector('.screen.active');
// --- SISTEMA DE TEMA (CLARO / OSCURO) ---
function setTheme(theme) {
    const previousTheme = playerStats.theme || 'dark';
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
    if (theme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
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
    SFX.click();
}

// Apply saved theme on load
if (playerStats.theme === 'light') {
    document.body.classList.add('light-mode');
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE CALIDAD VISUAL — 4 modos: max / normal / perf / custom
// ─────────────────────────────────────────────────────────────────────────────

// Definición de cada modo: valores que se aplican a los sliders visibles
// y flags internos que ajustan el motor de partículas.
const QUALITY_PRESETS = {
    max:    { fps: 240, particles: 1.0, musicVol: 1.0, sfxVol: 1.0, bodyClass: 'quality-max',  label: 'Máximo',       desc: 'Cristalix · Glows máximos · 240 FPS · Todo al máximo' },
    normal: { fps: 60,  particles: 1.0, musicVol: 1.0, sfxVol: 1.0, bodyClass: '',              label: 'Normal',       desc: '60 FPS · Blur estándar · Configuración de equilibrio' },
    perf:   { fps: 30,  particles: 0.25, musicVol: 1.0, sfxVol: 1.0, bodyClass: 'quality-perf', label: 'Rendimiento',  desc: 'Sin blur · Sin glows · Sin conexiones · 30 FPS · Máximo ahorro' },
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
    { id: 'life',    label: 'VIDA EXTRA',   short: '+VIDA',   color: '#ff2a5f', rarity: 'Legendario', weight: 5,  desc: 'Recuperas una vida perdida.' },
    { id: 'frenzy',  label: 'FRENESÍ',      short: 'FRENESÍ', color: '#b5179e', rarity: 'Épico',      weight: 8,  desc: 'Activa el Modo Frenesí inmediatamente.' },
    { id: 'jackpot', label: 'JACKPOT x4',   short: 'x4 PTS',  color: '#ff0090', rarity: 'Épico',      weight: 8,  desc: 'La próxima pregunta vale x4 puntos.' },
    { id: 'shield',  label: 'ESCUDO',       short: 'ESCUDO',  color: '#00d4ff', rarity: 'Raro',       weight: 12, desc: 'Si fallas la próxima pregunta no pierdes vida.' },
    { id: 'boost',   label: 'PUNTOS x2',    short: 'x2 PTS',  color: '#ffb800', rarity: 'Raro',       weight: 14, desc: 'La próxima pregunta vale el doble de puntos.' },
    { id: 'triple',  label: 'TURBO x3',     short: 'x3 PTS',  color: '#ccff00', rarity: 'Raro',       weight: 11, desc: 'La próxima pregunta vale x3 puntos.' },
    { id: 'time8',   label: 'TIEMPO +8',    short: '+8 SEG',  color: '#00ffcc', rarity: 'Normal',     weight: 15, desc: 'La próxima pregunta tendrá 8 segundos extra.' },
    { id: 'hint',    label: 'PISTA',        short: 'PISTA',   color: '#f77f00', rarity: 'Normal',     weight: 18, desc: 'Elimina una respuesta incorrecta de la siguiente pregunta.' },
    { id: 'time5',   label: 'TIEMPO +5',    short: '+5 SEG',  color: '#00ff66', rarity: 'Normal',     weight: 20, desc: 'La próxima pregunta tendrá 5 segundos extra.' },
    { id: 'streak',  label: 'RACHA SALVADA',short: 'RACHA',   color: '#aaaaff', rarity: 'Básico',     weight: 22, desc: 'Si fallas la siguiente, tu racha no se resetea.' },
];

let rouletteActive = false;
let currentPrize = null;
let rouletteAngle = 0;     // legacy, no-op
let rouletteAnimFrame = null; // legacy, no-op
let activeBoostNextQ = null; // current active power-up for next question
let shieldActive = false;
let hintActive = false;
let extraTimeActive = 0;
let streakShieldActive = false;
let totalCorrectThisGame = 0; // counts all corrects in game for roulette trigger
let nextRouletteTrigger = 10; // fire roulette when this many corrects reached

function drawRouletteWheel() {} // legacy no-op, kept for safety

function getPrizeAtAngle() { return ROULETTE_PRIZES[0]; } // legacy no-op

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
    const overlay = document.getElementById('roulette-overlay');
    if (!overlay) return; // DOM not ready guard
    rouletteActive = true;
    isGamePaused = true;
    clearInterval(timerInterval);

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
                    deckAnimating = false;
                    currentPrize = ROULETTE_PRIZES[winIdx];
                    setTimeout(() => showCardPrize(currentPrize), 320);
                }
            }, delay);
        } catch(e) { deckAnimating = false; }
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
        iconEl.textContent = icon;
        textEl.textContent = label;
        textEl.style.color = color;
        bar.style.display = 'flex';
    } else {
        bar.style.display = 'none';
    }
}

function closeRoulette() {
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
        if (_hint) {
            // applyHintVisual necesita que la pregunta ya esté en el DOM
            // 150ms es suficiente para que los botones estén pintados
            setTimeout(applyHintVisual, 180);
        }
    }, 300);
}

function goToMainMenu() { 
    SFX.click(); 
    // ui2: Vuelvo en Un Segundo — sale de Configuración en <3 segundos
    if (playerStats._settingsOpenTime && (Date.now() - playerStats._settingsOpenTime) < 3000) {
        if (!playerStats.achievements.includes('ui2')) {
            playerStats.achievements.push('ui2');
            const ach = ACHIEVEMENTS_MAP.get('ui2');
            if (ach) { setTimeout(() => { SFX.achievement(); showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon); }, 200); }
            saveStatsDebounced();
        }
    }
    playerStats._settingsOpenTime = 0;
    switchScreen('start-screen'); 
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
    const ALL_SECTIONS = ['profile', 'achievements', 'ranking', 'settings'];
    if (!playerStats.allSectionsVisited && ALL_SECTIONS.every(s => playerStats.sectionsVisitedThisSession.includes(s))) {
        playerStats.allSectionsVisited = true;
    }
    // ui10: El Circuito — navegar las 4 secciones en orden secuencial: profile→achievements→ranking→settings
    const CIRCUIT_ORDER = ['profile', 'achievements', 'ranking', 'settings'];
    if (!playerStats.achievements.includes('ui10')) {
        if (!playerStats._circuitIdx) playerStats._circuitIdx = 0;
        const expected = CIRCUIT_ORDER[playerStats._circuitIdx];
        if (section === expected) {
            playerStats._circuitIdx++;
            if (playerStats._circuitIdx >= CIRCUIT_ORDER.length) {
                playerStats._circuitIdx = 0;
                playerStats.achievements.push('ui10');
                const ach = ACHIEVEMENTS_MAP.get('ui10');
                if (ach) { SFX.achievement(); showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon); }
                saveStatsDebounced();
            }
        } else if (section === CIRCUIT_ORDER[0]) {
            playerStats._circuitIdx = 1; // restart if going back to first
        } else {
            playerStats._circuitIdx = 0; // reset if out of order
        }
    }
}

function goToAchievements() { initAudio(); SFX.click(); playerStats.achViews++; trackSectionVisit('achievements'); saveStatsLocally(); checkAchievements(); renderAchievements(); switchScreen('achievements-screen'); const sc = document.getElementById('vscroll-container'); if(sc) sc.scrollTop = 0; }

function goToRanking() { 
    initAudio(); SFX.click();
    playerStats.rankingViews = (playerStats.rankingViews||0) + 1;
    trackSectionVisit('ranking');
    saveStatsLocally(); checkAchievements();
    switchScreen('ranking-screen');
}


function goToProfile(needsName = false) {
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    SFX.click();
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
    currentRankInfo = getRankInfo(playerStats); updateLogoDots(); document.getElementById('profile-rank-display').innerText = `Rango: ${currentRankInfo.title}`; { const isLight = document.body.classList.contains('light-mode'); document.getElementById('profile-rank-display').style.color = isLight ? darkenHex(currentRankInfo.color, 0.4) : currentRankInfo.color; }
    // Render PL panel
    (function renderPLPanel(){
        const s = playerStats;
        const plBase   = Math.floor((s.totalScore||0)*0.05);
        const plBest   = Math.floor((s.bestScore||0)*1.5);
        const plStreak = (s.maxStreak||0)*200;
        const plPerf   = (s.perfectGames||0)*1000;
        const plAchs   = (s.achievements||[]).length*300;
        const plAcc    = s.gamesPlayed>0 ? Math.floor(((s.totalCorrect||0)/(s.gamesPlayed*20))*5000) : 0;
        const plTotal  = plBase+plBest+plStreak+plPerf+plAchs+plAcc;
        const fmt = n => n.toLocaleString();
        // Precision %
        const totalAnswers = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
        const accuracy = totalAnswers>0 ? Math.min(100,Math.round((s.totalCorrect||0)/totalAnswers*100)) : 0;
        // PL total & rank color
        const plTotalEl = document.getElementById('pl-total');
        if(plTotalEl){ plTotalEl.innerText=fmt(plTotal); plTotalEl.style.color=currentRankInfo.color; }
        const plHeroEl = document.getElementById('pl-hero-total');
        if(plHeroEl){ plHeroEl.innerText=fmt(plTotal); plHeroEl.style.color=currentRankInfo.color; }
        // Panel border color
        const panel = document.getElementById('pl-panel');
        if(panel) panel.style.borderColor=`rgba(${currentRankInfo.rgb},0.28)`;
        // Ranking pos
        const posEl=document.getElementById('pl-ranking-pos');
        if(posEl) posEl.innerText=s.rankingPosition&&s.rankingPosition<999?`#${s.rankingPosition}`:'#—';
        // Build rows
        const rowsEl=document.getElementById('pl-rows');
        if(!rowsEl) return;
        const colors=['var(--accent-blue)','var(--accent-yellow)','var(--accent-orange)','var(--accent-green)','var(--accent-purple)','var(--accent-red)'];
        const rows=[
            { label:'Puntaje acum.',   raw:fmt(s.totalScore||0),    factor:'× 0.05',  result:plBase,   color:colors[0] },
            { label:'Récord',          raw:fmt(s.bestScore||0),      factor:'× 1.5',   result:plBest,   color:colors[1] },
            { label:'Racha máxima',    raw:`${s.maxStreak||0} aciertos`, factor:'× 200', result:plStreak, color:colors[2] },
            { label:'Partidas perfectas', raw:`${s.perfectGames||0} partidas`, factor:'× 1,000', result:plPerf, color:colors[3] },
            { label:'Logros',          raw:`${(s.achievements||[]).length} logros`, factor:'× 300', result:plAchs, color:colors[4] },
            { label:'Precisión',       raw:`${accuracy}%`,           factor:'× 5,000', result:plAcc,    color:colors[5] },
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
                // Next: Junior (bestScore >= 15000 && gamesPlayed >= 5)
                const c1 = s.bestScore >= 15000, c2 = (s.gamesPlayed||0) >= 5;
                condHtml = `<span style="color:var(--accent-blue);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: JUNIOR</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Récord ${fmt(s.bestScore||0)}/15,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/5</span>`;
            } else if (ri.title === 'Junior') {
                // Next: Pro (totalScore >= 60000 && totalCorrect >= 200 && maxStreak >= 12)
                const c1 = (s.totalScore||0) >= 60000, c2 = (s.totalCorrect||0) >= 200, c3 = (s.maxStreak||0) >= 12;
                condHtml = `<span style="color:var(--accent-red);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: PRO</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/60,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/200</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/12</span>`;
            } else if (ri.title === 'Pro') {
                // Next: Maestro (totalScore >= 150000 && gamesPlayed >= 50 && maxMult >= 4)
                const c1 = (s.totalScore||0) >= 150000, c2 = (s.gamesPlayed||0) >= 50, c3 = (s.maxMult||1) >= 4;
                condHtml = `<span style="color:var(--accent-purple);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: MAESTRO</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/150,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Partidas ${s.gamesPlayed||0}/50</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. máx. ${s.maxMult||1}/x4</span>`;
            } else if (ri.title === 'Maestro') {
                // Next: Leyenda (totalScore >= 400000 && totalCorrect >= 1500 && perfectGames >= 10)
                const c1 = (s.totalScore||0) >= 400000, c2 = (s.totalCorrect||0) >= 1500, c3 = (s.perfectGames||0) >= 10;
                condHtml = `<span style="color:var(--accent-yellow);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: LEYENDA</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/400,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/1,500</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/10</span>`;
            } else if (ri.title === 'Leyenda') {
                // Next: Mítico — requisitos extremos
                const totalAns = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
                const acc2 = totalAns>0?Math.round((s.totalCorrect||0)/totalAns*100):0;
                const c1=(s.totalScore||0)>=1200000, c2=(s.totalCorrect||0)>=5000, c3=(s.perfectGames||0)>=50;
                const c4=(s.achievements||[]).length>=200, c5=(s.maxStreak||0)>=40, c6=(s.maxMult||1)>=8;
                const c7=acc2>=85, c8=(s.maxLoginStreak||0)>=30;
                condHtml = `<span style="color:#ffffff;font-weight:700;font-size:0.62rem;letter-spacing:1px;text-shadow:0 0 8px rgba(255,255,255,0.5);">-- SIGUIENTE: MÍTICO --</span> &nbsp;`+
                    `<span style="${c1?'color:var(--accent-green)':'color:var(--text-secondary)'}">Acum. ${fmt(s.totalScore||0)}/1,200,000</span> &nbsp;`+
                    `<span style="${c2?'color:var(--accent-green)':'color:var(--text-secondary)'}">Aciertos ${s.totalCorrect||0}/5,000</span> &nbsp;`+
                    `<span style="${c3?'color:var(--accent-green)':'color:var(--text-secondary)'}">Perfectas ${s.perfectGames||0}/50</span> &nbsp;`+
                    `<span style="${c4?'color:var(--accent-green)':'color:var(--text-secondary)'}">Logros ${(s.achievements||[]).length}/165</span> &nbsp;`+
                    `<span style="${c5?'color:var(--accent-green)':'color:var(--text-secondary)'}">Racha ${s.maxStreak||0}/40</span> &nbsp;`+
                    `<span style="${c6?'color:var(--accent-green)':'color:var(--text-secondary)'}">Mult. ${s.maxMult||1}/x8</span> &nbsp;`+
                    `<span style="${c7?'color:var(--accent-green)':'color:var(--text-secondary)'}">Precisión ${acc2}%/85%</span> &nbsp;`+
                    `<span style="${c8?'color:var(--accent-green)':'color:var(--text-secondary)'}">Login días ${s.maxLoginStreak||0}/30</span>`;
            } else {
                condHtml = `<span style="color:#ffffff;font-weight:700;font-size:0.62rem;text-shadow:0 0 10px rgba(255,255,255,0.6);">-- RANGO MÍTICO ALCANZADO --</span>`;
            }
            nextEl.innerHTML = condHtml;
        }
        const accEl=document.getElementById('pl-accuracy-pct');
        if(accEl) accEl.innerText=`Precisión: ${accuracy}%`;
    })();
    renderAchievements(); switchScreen('profile-screen');
    if (needsName) setTimeout(() => { document.getElementById('profile-name-input').focus(); document.getElementById('profile-name-input').classList.add('shake'); setTimeout(() => document.getElementById('profile-name-input').classList.remove('shake'), 400); }, 400);
}

async function startGameCheck() {
    // iOS/Safari: AudioContext MUST be resumed synchronously inside a user gesture handler
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR") { 
        SFX.incorrect(); goToProfile(true); 
        return;
    }

    // ── Anti-trampa: detectar condiciones sospechosas ANTES de iniciar ──────
    // 1. Documento oculto o en segundo plano
    if (document.visibilityState === 'hidden' || document.hidden) {
        showToast('No se puede iniciar', 'La ventana no está en primer plano.', 'var(--accent-red)', SVG_SKULL);
        return;
    }
    // 2. Picture-in-Picture activo
    if (document.pictureInPictureElement) {
        showToast('No se puede iniciar', 'Desactiva el modo Picture-in-Picture.', 'var(--accent-red)', SVG_SKULL);
        return;
    }
    // 3. DocumentPictureInPicture (Chrome API)
    if (typeof documentPictureInPicture !== 'undefined' && documentPictureInPicture.window) {
        showToast('No se puede iniciar', 'Desactiva el modo Picture-in-Picture.', 'var(--accent-red)', SVG_SKULL);
        return;
    }
    // 4. La ventana no tiene el foco (podría estar cubierta por otra ventana)
    if (!document.hasFocus()) {
        showToast('No se puede iniciar', 'El juego no tiene el foco. Haz clic en la ventana del juego.', 'var(--accent-red)', SVG_SKULL);
        return;
    }
    // 5. Pantalla dividida o ventana muy reducida
    //    En desktop: innerWidth debe cubrir >= 55% de la pantalla
    //    En mobile se omite (screen.width puede ser distorsionado por devicePixelRatio)
    if (window.screen.width > 600) {
        const wRatio = window.innerWidth / window.screen.width;
        const hRatio = window.innerHeight / window.screen.height;
        if (wRatio < 0.55) {
            showToast('No se puede iniciar', 'Detectada pantalla dividida o ventana parcial. Maximiza el juego.', 'var(--accent-red)', SVG_SKULL);
            return;
        }
        // Altura muy reducida también indica split horizontal o snap
        if (hRatio < 0.45) {
            showToast('No se puede iniciar', 'Detectada ventana demasiado pequeña. Maximiza el juego.', 'var(--accent-red)', SVG_SKULL);
            return;
        }
    }
    // 6. Detectar elementos superpuestos sobre el área de juego (overlays externos)
    //    Comprobamos si el centro del botón de respuestas está tapado por otro elemento
    const appEl = document.getElementById('app');
    if (appEl) {
        const rect = appEl.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const topEl = document.elementFromPoint(cx, cy);
        if (topEl && !appEl.contains(topEl)) {
            showToast('No se puede iniciar', 'Se detectó un elemento superpuesto sobre el juego.', 'var(--accent-red)', SVG_SKULL);
            return;
        }
    }
    // ── Fin detección ──────────────────────────────────────────────────────

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
    // Nombre reservado — solo el UUID canónico puede usarlo
    if (val.trim() === 'CHRISTOPHER' && playerStats.uuid !== '00000000-spec-tral-0000-klickphantom0') {
        val = val.slice(0, -1);
    }
    e.target.value = val;
    document.getElementById('profile-warning').style.opacity = val ? '0' : '1'; 
});
document.getElementById('profile-name-input').addEventListener('change', e => { 
    const n = e.target.value.trim(); 
    // nameChanges solo se incrementa en 'blur' para evitar doble conteo (change+blur ambos disparan en desktop)
    playerStats.playerName = n || "JUGADOR"; 
    saveStatsLocally(); checkAchievements(); 
    submitLeaderboard();
});
document.getElementById('profile-name-input').addEventListener('keypress', function(e) { if(e.key === 'Enter') this.blur(); });
// iOS Safari: 'change' event fires late or not at all — use 'blur' explicitly
document.getElementById('profile-name-input').addEventListener('blur', function(e) {
    const n = e.target.value.trim();
    if(n && n !== "JUGADOR" && n !== playerStats.playerName) { playerStats.nameChanges++; }
    playerStats.playerName = n || "JUGADOR";
    saveStatsLocally(); checkAchievements();
    submitLeaderboard();
    document.getElementById('profile-warning').style.opacity = n ? '0' : '1';
});

let _logoDotsCached = null;
function updateLogoDots() {
    document.documentElement.style.setProperty('--rank-rgb', currentRankInfo.rgb);
    document.documentElement.style.setProperty('--rank-color', currentRankInfo.color);
    // Clases de rango en body — controlan ambientes y animaciones
    const isLight = document.body.classList.contains('light-mode');
    if (!_logoDotsCached || !_logoDotsCached.length) _logoDotsCached = document.querySelectorAll('.logo-dot');
    const shadow = isLight ? 'none' : `0 0 15px rgba(${currentRankInfo.rgb}, 0.5)`;
    for (let i = 0; i < _logoDotsCached.length; i++) {
        _logoDotsCached[i].style.color = currentRankInfo.color;
        _logoDotsCached[i].style.textShadow = shadow;
    }
    const favicon = document.getElementById('dynamic-favicon');
    if (favicon) {
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='rgb(${currentRankInfo.rgb})' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon></svg>`;
        favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
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
let lastSecondAnswers = 0; 
let ultraFastStreak = 0;   
let currentNoTimeoutStreak = 0;
let livesLostThisGame = 0;
let consecutiveLivesLost = 0;  // for u19 Resurreccion tracking
let frenziesThisGame = 0;      // for extra1 Doble Frenesí

function startGame() {
    _gameSessionId++; // invalidate stale feedback timeouts
    initAudio(); SFX.gameStart();
    
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
    lives = 3; multiplier = 1;
    lastSecondAnswers = 0; ultraFastStreak = 0; currentNoTimeoutStreak = 0; livesLostThisGame = 0; consecutiveLivesLost = 0; frenziesThisGame = 0;
    // Reset roulette state for new game
    totalCorrectThisGame = 0; nextRouletteTrigger = 10;
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

// _markUsed ya no es necesaria (el motor la gestiona internamente)
// Se mantiene como no-op por si algún llamador antiguo la referencia
function _markUsed() {}

// Alias legacy que ya no se usa (startGame llama _qeResetGame directamente)
const _recentQuestionIds = { clear: () => {} };
let _recentQueue = [];

// Cached game DOM elements (reset each game in startGame)
let _gTimerPath = null, _gTimerText = null, _gQuestionEl = null, _gAnswerBtns = null, _gAnswersGrid = null, _gAns = [], _gStreakDisp = null;

function _warmGameDOMCache() {
    _gTimerPath   = document.getElementById('timer-path');
    _gTimerText   = document.getElementById('timer-display');
    _gQuestionEl  = document.getElementById('question-text');
    _gAnswerBtns  = document.querySelectorAll('.answer-btn');
    _gAnswersGrid = document.getElementById('answers-grid');
    _gAns         = [0,1,2,3].map(i => document.getElementById('ans-' + i));
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
    // Elimina clases previas para reiniciar animación
    questionEl.classList.remove('q-enter', 'q-exit');
    answerBtns.forEach(btn => btn.classList.remove('q-enter', 'q-exit'));

    // Fuerza reflow para reiniciar animación
    void questionEl.offsetWidth;
    
    questionEl.innerText = currentQ.question;
    
    let mixedAnswers = currentQ.answers.map((text, idx) => ({ text: text, isCorrect: idx === currentQ.correctIndex }));
    mixedAnswers = shuffleArray(mixedAnswers);
    for(let i=0; i<4; i++) { 
        (_gAns[i]||document.getElementById(`ans-${i}`)).innerText = mixedAnswers[i].text;
        if (mixedAnswers[i].isCorrect) currentQ.currentCorrectIndex = i;
    }

    (_gAnswersGrid||document.getElementById('answers-grid')).classList.remove('answered'); 
    answerBtns.forEach(btn => { 
        btn.classList.remove('selected'); 
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
        if (timeLeft <= 0) handleTimeout(); 
    }, 250); // poll cada 250ms — reacciona al segundo exacto sin drift
}

function selectAnswer(selectedIndex) {
    if (!isAnsweringAllowed || isGamePaused) return; isAnsweringAllowed = false; clearInterval(timerInterval); SFX.select();
    (_gAnswersGrid||document.getElementById('answers-grid')).classList.add('answered'); (_gAnswerBtns ? _gAnswerBtns[selectedIndex] : document.querySelectorAll('.answer-btn')[selectedIndex]).classList.add('selected');
    
    const q = _currentQuestion;
    if (!q) return;
    const isCorrect = (selectedIndex === q.currentCorrectIndex); 
    const answerTime = timeLeft;
    currentGameLog.push({ correct: isCorrect, time: answerTime, category: q.category || q.type || null });
    
    if(isCorrect) { 
        playerStats.totalCorrect++; 
        const _qTimeLimit = (q && q._timeLimit) || TIMER_LIMIT;
        if(answerTime >= _qTimeLimit - 2) { currentFastAnswers++; playerStats.fastAnswersTotal++; }
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
    // Disable one WRONG answer button on the currently loaded question
    const q = _currentQuestion;
    const correctIdx = q ? q.currentCorrectIndex : -1;
    const btns = document.querySelectorAll('.answer-btn');
    let hidden = false;
    btns.forEach((btn, i) => {
        if (!hidden && i !== correctIdx) {
            btn.style.opacity = '0.2';
            btn.style.pointerEvents = 'none';
            btn.style.filter = 'grayscale(1)';
            hidden = true;
        }
    });
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
    // Reset any inline style overrides from previous feedback (e.g. shield cyan)
    points.style.borderColor = '';
    points.style.color = '';
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
                playerStats.achievements.push(id); SFX.achievement();
                showToast('Logro Desbloqueado', title, col, ico);
                // Track daily unlocks so da1-da5 "Productivo" count in-game achievements too
                const _igTodayStr = new Date().toISOString().split('T')[0];
                if (playerStats.lastLoginDate === _igTodayStr) {
                    playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + 1;
                }
                saveStatsDebounced(); renderAchievements();
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
            // Streak shield from roulette: protect racha on one mistake
            if (streakShieldActive) {
                streakShieldActive = false;
                updateRewardIndicator();
                showToast('RACHA PROTEGIDA', 'Tu racha ha sido salvada.', '#aaaaff', SVG_SHIELD);
                // Don't reset streak, but do lose a life
            } else {
                streak = 0;
                playerStats.currentFrenzyStreak = 0;
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
                    saveStatsDebounced(); renderAchievements();
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
                loadQuestion();
                switchScreen('question-screen');
                if (_applyHint) setTimeout(applyHintVisual, 180);
            }
        } else {
            endGame();
        }
    }, 2000);
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
    else playerStats.revengeGame = false;
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
    if (_animScoreTimer) { cancelAnimationFrame(_animScoreTimer); _animScoreTimer = null; } // cancelar animación de score en curso
    if (_saveTimeout) { clearTimeout(_saveTimeout); _saveTimeout = null; } // limpiar debounce pendiente
    _currentQuestion = null;
    document.getElementById('final-score-display').innerText = score.toLocaleString(); saveGameStats();
    
    SFX.gameEnd();
    
    const msg = document.getElementById('final-message');
    const rankLabel = document.getElementById('end-rank-label');

    if(score > 300000) { msg.innerText = "¡Leyenda!"; if(rankLabel) rankLabel.innerText = "Clasificación Final"; }
    else if(score > 100000) { msg.innerText = "¡Superviviente Nato!"; if(rankLabel) rankLabel.innerText = "Resultado"; }
    else if(score > 25000) { msg.innerText = "¡Buen Desempeño!"; if(rankLabel) rankLabel.innerText = "Resultado"; }
    else { msg.innerText = "Sigue practicando"; if(rankLabel) rankLabel.innerText = "Resultado"; }

    document.getElementById('final-name').innerText = playerStats.playerName || 'ESTUDIANTE';
    document.getElementById('final-correct-label').innerText = 'Aciertos';
    document.getElementById('final-correct').innerText = currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers;
    document.getElementById('final-streak').innerText = currentMaxStreak; 
    document.getElementById('final-speed').innerText = currentFastAnswers;
    
    document.getElementById('app').classList.remove('streak-active'); streak = 0; switchScreen('end-screen');
}

// --- FPS Controlled Particles (optimized: batched canvas draws) ---
const canvas = document.getElementById('particle-canvas'); 
const ctx = canvas.getContext('2d', { alpha: true }); 
let particlesArray = [];
let fpsInterval = 1000 / playerStats.maxFps;
let then = performance.now();
let _cpFrame = 0;
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
    const baseOpacity = streak >= 5 ? 0.65 : 0.42;
    const dynamicOpacity = Math.min(1, (_pIsLight ? baseOpacity * 2.2 : baseOpacity) * playerStats.particleOpacity + pulse * 0.12);
    const W = canvas.width, H = canvas.height;

    ctx.beginPath();
    ctx.fillStyle = `rgba(${_pRgb}, ${dynamicOpacity})`;

    for (let i = 0; i < particlesArray.length; i++) {
        const p = particlesArray[i];
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        p.x += p.dx * m * modeSpeed * timeScale * speedBoost;
        p.y += p.dy * m * modeSpeed * timeScale * speedBoost;
        const r = (p.s + pulse * 1.0) * sizeBoost;
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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!playerStats || playerStats.particleOpacity <= 0) return;

    _pIsLight = document.body.classList.contains('light-mode');
    _pRgb = _pIsLight ? darkenRgb(currentRankInfo.rgb, 0.55) : currentRankInfo.rgb;
    // No leer el analyser si el audio está suspendido (pestaña oculta)
    const pulse = (audioAnalyser && audioCtx && audioCtx.state === 'running') ? getAudioPulse() : 0;
    updateAndDrawParticles(timeScale, pulse);

    const _qm = playerStats.qualityMode;
    if (_qm === 'perf') {
        // Perf: sin conexiones nunca, reducir frecuencia de actualización
        _cpFrame++;
        return;
    }
    if (_qm === 'max') {
        // Max: conexiones siempre activas para efecto Cristalix completo
        connectParticles(pulse);
    } else {
        // Normal/custom: conexiones cuando hay racha o audio activo, o en frames pares
        if (streak >= 5 || pulse > 0.05 || (_cpFrame & 1) === 0) connectParticles(pulse);
    }
    _cpFrame++;
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
        if (p.x > W || p.x < 0) p.dx = -p.dx;
        if (p.y > H || p.y < 0) p.dy = -p.dy;
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
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
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e){}
    SFX.click();
    playerStats.kpViews = (playerStats.kpViews||0) + 1;
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

    const RANKS = [
        {
            title: 'Novato',
            color: '0,255,102',
            hex: '#00ff66',
            label: 'El punto de partida.',
            reqs: [],
            next: null
        },
        {
            title: 'Junior',
            color: '0,212,255',
            hex: '#00d4ff',
            label: 'Tus primeros pasos se consolidan.',
            reqs: [
                { label: 'Récord en partida', need: 15000, get: ()=>s.bestScore||0, fmt: v=>`${fmt(v)} / 15K` },
                { label: 'Partidas jugadas',  need: 5,     get: ()=>s.gamesPlayed||0, fmt: v=>`${v} / 5` },
            ]
        },
        {
            title: 'Pro',
            color: '255,42,95',
            hex: '#ff2a5f',
            label: 'Consistencia y precisión probadas.',
            reqs: [
                { label: 'Puntos acumulados', need: 60000,  get: ()=>s.totalScore||0,   fmt: v=>`${fmt(v)} / 60K` },
                { label: 'Aciertos totales',  need: 200,    get: ()=>s.totalCorrect||0,  fmt: v=>`${v} / 200` },
                { label: 'Racha máxima',      need: 12,     get: ()=>s.maxStreak||0,     fmt: v=>`${v} / 12` },
            ]
        },
        {
            title: 'Maestro',
            color: '181,23,158',
            hex: '#b5179e',
            label: 'Dominio del sistema de multiplicadores.',
            reqs: [
                { label: 'Puntos acumulados', need: 150000, get: ()=>s.totalScore||0,   fmt: v=>`${fmt(v)} / 150K` },
                { label: 'Partidas jugadas',  need: 50,     get: ()=>s.gamesPlayed||0,  fmt: v=>`${v} / 50` },
                { label: 'Multiplicador x4',  need: 4,      get: ()=>s.maxMult||1,      fmt: v=>`x${v} / x4` },
            ]
        },
        {
            title: 'Leyenda',
            color: '255,184,0',
            hex: '#ffb800',
            label: 'Solo los mejores llegan aquí.',
            reqs: [
                { label: 'Puntos acumulados',    need: 400000, get: ()=>s.totalScore||0,    fmt: v=>`${fmt(v)} / 400K` },
                { label: 'Aciertos totales',     need: 1500,   get: ()=>s.totalCorrect||0,  fmt: v=>`${v} / 1,500` },
                { label: 'Partidas perfectas',   need: 10,     get: ()=>s.perfectGames||0,  fmt: v=>`${v} / 10` },
            ]
        },
        {
            title: 'Mítico',
            color: '255,255,255',
            hex: '#ffffff',
            label: 'El rango supremo. Alcanzado por muy pocos.',
            reqs: [
                { label: 'Puntos acumulados',    need: 1200000, get: ()=>s.totalScore||0,              fmt: v=>`${fmt(v)} / 1.2M` },
                { label: 'Aciertos totales',     need: 5000,    get: ()=>s.totalCorrect||0,            fmt: v=>`${v} / 5,000` },
                { label: 'Partidas perfectas',   need: 50,      get: ()=>s.perfectGames||0,            fmt: v=>`${v} / 50` },
                { label: 'Logros desbloqueados', need: 200,     get: ()=>(s.achievements||[]).length,  fmt: v=>`${v} / 200` },
                { label: 'Racha máxima',         need: 40,      get: ()=>s.maxStreak||0,               fmt: v=>`${v} / 40` },
                { label: 'Multiplicador máx.',   need: 8,       get: ()=>s.maxMult||1,                 fmt: v=>`x${v} / x8` },
                { label: 'Precisión global',     need: 85,      get: ()=>accuracy,                     fmt: v=>`${v}% / 85%` },
                { label: 'Racha de login',       need: 30,      get: ()=>s.maxLoginStreak||0,          fmt: v=>`${v} / 30 días` },
            ]
        },
        {
            title: 'Divinidad',
            color: '180,100,255',
            hex: 'var(--divinity-color-static)',
            label: 'Más allá de todo. Un rango que trasciende lo conocido.',
            reqs: [
                { label: 'Puntos acumulados',    need: 3000000, get: ()=>s.totalScore||0,              fmt: v=>`${fmt(v)} / 3M` },
                { label: 'Aciertos totales',     need: 10000,   get: ()=>s.totalCorrect||0,            fmt: v=>`${v} / 10,000` },
                { label: 'Partidas perfectas',   need: 100,     get: ()=>s.perfectGames||0,            fmt: v=>`${v} / 100` },
                { label: 'Logros desbloqueados', need: 165, get: ()=>(s.achievements||[]).length,  fmt: v=>`${v} / 165` },
                { label: 'Racha máxima',         need: 60,      get: ()=>s.maxStreak||0,               fmt: v=>`${v} / 60` },
                { label: 'Multiplicador máx.',   need: 10,      get: ()=>s.maxMult||1,                 fmt: v=>`x${v} / x10` },
                { label: 'Precisión global',     need: 92,      get: ()=>accuracy,                     fmt: v=>`${v}% / 92%` },
                { label: 'Racha de login',       need: 60,      get: ()=>s.maxLoginStreak||0,          fmt: v=>`${v} / 60 días` },
                { label: 'Partidas jugadas',     need: 200,     get: ()=>s.gamesPlayed||0,             fmt: v=>`${v} / 200` },
                { label: 'Klick Pass completo',  need: 100,     get: ()=>kpClaimed,                    fmt: v=>`${v} / 100 niveles` },
            ]
        }
    ];

    // Determine which ranks are unlocked
    const _isChristopherRanks = (s.playerName||''). toUpperCase() === 'CHRISTOPHER' && s.uuid === '00000000-spec-tral-0000-klickphantom0';
    const ORDER = ['Novato','Junior','Pro','Maestro','Leyenda','Mítico','Divinidad'];
    const rankIdx = ORDER.indexOf(current);

    let html = '';
    RANKS.forEach((rank, i) => {
        // Divinidad — solo visible para CHRISTOPHER
        if (rank.title === 'Divinidad' && !_isChristopherRanks) return;

        const isUnlocked = i <= rankIdx;
        const isCurrent  = rank.title === current;
        const isNext     = i === rankIdx + 1;
        const isLocked   = !isUnlocked && !isNext;

        const allMet = rank.reqs.length === 0 || rank.reqs.every(r => r.get() >= r.need);
        const statusClass = isCurrent ? 'rank-row--current' : isUnlocked ? 'rank-row--done' : isNext ? 'rank-row--next' : 'rank-row--locked';

        // Build req pills
        let pillsHtml = '';
        if (rank.reqs.length > 0) {
            rank.reqs.forEach(r => {
                const val  = r.get();
                const met  = val >= r.need;
                const pct  = Math.min(100, Math.round((val / r.need) * 100));
                const dim  = isLocked ? 'opacity:0.4;' : '';
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

        // Crown/badge icon
        const badgeSvg = isCurrent
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(${rank.color},1)" stroke-width="2.5" width="20" height="20"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
            : isUnlocked
            ? `<svg viewBox="0 0 24 24" fill="rgba(${rank.color},0.7)" stroke="none" width="16" height="16"><path d="M20 6L9 17l-5-5"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="2" width="16" height="16"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`;

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
            ${pillsHtml ? `<div class="rrank-reqs">${pillsHtml}</div>` : '<div class="rrank-reqs rrank-novato">Sin requisitos — ¡todos comienzan aquí!</div>'}
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
setTimeout(() => {
    processDailyLogin(); currentRankInfo = getRankInfo(playerStats); updateLogoDots(); revokeInvalidAchievements(); checkAchievements(); submitLeaderboard(); fetchLeaderboard(); loadQuestions();
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
    // Se llama una sola vez sin importar cuántos eventos disparan.
    let _skipSent = false;
    function _activatePendingSW(sw) {
        if (_skipSent) return;
        _skipSent = true;
        sw.postMessage({ type: 'SKIP_WAITING' });
        // El banner se muestra al recibir controllerchange (señal más fiable)
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

        // Verificar actualizaciones cada 3 minutos (si el juego queda abierto)
        setInterval(() => reg.update(), 3 * 60 * 1000);

    }).catch(() => {}); // silencioso en file:// o sin HTTPS

    // Caso C: El SW cambió de controlador → señal más fiable de versión nueva activa
    // Usar un pequeño debounce para evitar doble disparo en Chrome
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

})();    // ── CHRISTOPHER: inyectar todo — stats, logros, KP ────────────────
    if (playerStats.playerName && playerStats.playerName.toUpperCase() === 'CHRISTOPHER') {
        // Stats numéricas — mínimos de Divinidad
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
        playerStats.ranksViews          = Math.max(playerStats.ranksViews||0,          50);
        playerStats.kpViews             = Math.max(playerStats.kpViews||0,             100);
        playerStats.precisPartidas90    = Math.max(playerStats.precisPartidas90||0,    10);
        playerStats.hadPerfectAccuracyGame = true;
        playerStats.rouletteSpins       = Math.max(playerStats.rouletteSpins||0,       200);
        playerStats.rankingViews        = Math.max(playerStats.rankingViews||0,        100);
        playerStats.nameChanges         = 0;
        playerStats.seenChristopher     = true;
        playerStats.christopherCardViews = Math.max(playerStats.christopherCardViews||0, 1);
        playerStats.christopherSeenCount = Math.max(playerStats.christopherSeenCount||0, 10);
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
        // PL local = 21M para consistencia visual en perfil
        playerStats.powerLevel = 21000000;
        // KP: 100 niveles reclamados
        const _kpAdmin = getKpState();
        _kpAdmin.claimed = Array.from({length: 100}, (_, i) => i + 1);
        _kpAdmin.perfectNoError = Math.max(_kpAdmin.perfectNoError||0, 100);
        saveKpState(_kpAdmin);
        // Logros: todos los IDs reales del juego
        // Logros: todos los IDs reales — siempre actualizado aunque se añadan nuevos
        const _achSet = new Set([...(playerStats.achievements||[]), ...ACHIEVEMENTS_MAP.keys()]);
        playerStats.achievements = [..._achSet];
        saveStatsLocally();
    }
    // ─────────────────────────────────────────────────────────────────
