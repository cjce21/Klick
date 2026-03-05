// ════════════════════════════════════════════════════════════════
//  MÓDULO 03 — ESTADÍSTICAS DEL JUGADOR Y PERSISTENCIA
//  Contenido: defaultStats, carga de localStorage, migraciones
//             de versión, guardado debounced, revocación de logros.
//
//  DEPENDENCIAS: generateUUID() [01-security.js]
// ════════════════════════════════════════════════════════════════

// --- Estructura base del jugador ---
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
    kpViews: 0, kpClaimDays: [], kpSessionClaims: 0
};

const STORAGE_KEY = 'klick_player_data_permanent';
let savedData = '{}';
try { savedData = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('klickStats_v9') || '{}'; } catch(e) {}
let playerStats = { ...defaultStats, ...JSON.parse(savedData) };

if (!playerStats.uuid) playerStats.uuid = generateUUID();

// ── MIGRACIÓN v2: revoca logros obtenidos con umbrales anteriores ──
(function migrateAchievementsV2() {
    if (playerStats.migratedV2) {
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
    const pf  = playerStats.maxQuestionReached || 0;
    const sk  = playerStats.maxStreak    || 0;

    const newBsTiers  = [5000,25000,75000,150000,300000,600000,1000000,2000000];
    const newPtsTiers = [10000,50000,200000,500000,1000000,2500000,5000000,10000000];
    const newPfTiers  = [10,20,30,50,75,100,150,200];
    const newSkTiers  = [5,10,15,20,25,30,40,50];

    const toRevoke = [];

    for(let i=0;i<8;i++) if(bs < newBsTiers[i]) toRevoke.push(`bs${i+1}`);
    for(let i=0;i<8;i++) if(tot < newPtsTiers[i]) toRevoke.push(`pt${i+1}`);
    if(bs < 100000) {
        playerStats.maxScoreCount = 0;
        for(let i=0;i<8;i++) toRevoke.push(`hs${i+1}`);
    } else {
        playerStats.maxScoreCount = Math.max(1, playerStats.maxScoreCount);
        for(let i=1;i<8;i++) toRevoke.push(`hs${i+1}`);
    }
    for(let i=0;i<8;i++) if(pf < newPfTiers[i]) toRevoke.push(`pf${i+1}`);
    for(let i=0;i<8;i++) if(sk < newSkTiers[i]) toRevoke.push(`sk${i+1}`);

    if(bs < 75000)  toRevoke.push('x4');
    if(bs < 25000)  toRevoke.push('x6');
    if(bs < 3000)   toRevoke.push('x7');
    if(bs < 50000)  toRevoke.push('x12');
    if(bs < 99500)  toRevoke.push('x15');

    if(toRevoke.length > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevoke.includes(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke.includes(id));
    }

    const toRevokeFin = [];
    if (playerStats.achievements.includes('fin1') && !playerStats.playedNocturno) toRevokeFin.push('fin1');
    if (playerStats.achievements.includes('fin2') && !playerStats.playedMadrugador) toRevokeFin.push('fin2');
    if (toRevokeFin.length > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevokeFin.includes(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevokeFin.includes(id));
    }

    playerStats.migratedV2  = true;
    playerStats.migratedV2b = true;
    saveStatsLocally();
})();

// ── MIGRACIÓN de IDs de pistas de música ──
(function migrateTrackIds() {
    const remap = { 'track_electro': 'track_pulse', 'track_frenzy': 'track_bass' };
    if (remap[playerStats.selectedTrack]) {
        playerStats.selectedTrack = remap[playerStats.selectedTrack];
    }
    if (playerStats.tracksTriedSet) {
        playerStats.tracksTriedSet = playerStats.tracksTriedSet.map(id => remap[id] || id);
    }
})();

// --- Guardado en localStorage ---
function saveStatsLocally() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(playerStats)); } catch(e) {}
}

// Guardado debounced para minimizar escrituras durante el gameplay
let _saveTimeout = null;
let _saveLastForced = 0;
function saveStatsDebounced(force = false) {
    clearTimeout(_saveTimeout);
    const now = Date.now();
    if (force || (now - _saveLastForced) > 10000) {
        _saveLastForced = now;
        saveStatsLocally();
        return;
    }
    _saveTimeout = setTimeout(() => { _saveLastForced = Date.now(); saveStatsLocally(); }, 1500);
}

// Guardado de emergencia al cerrar la página
window.addEventListener('beforeunload', () => {
    saveStatsLocally();
});

// --- Revocación de logros inválidos ---
function revokeInvalidAchievements() {
    const before = playerStats.achievements.length;
    const toRevoke = new Set();

    if (!playerStats.playedNocturno    && playerStats.achievements.includes('fin1')) toRevoke.add('fin1');
    if (!playerStats.playedMadrugador  && playerStats.achievements.includes('fin2')) toRevoke.add('fin2');

    const retTiers = [3,7,15,30,60];
    retTiers.forEach((t,i) => {
        if ((playerStats.totalDaysPlayed||0) < t && playerStats.achievements.includes(`ret${i+1}`)) toRevoke.add(`ret${i+1}`);
    });

    const bsTiers2 = [5000,25000,75000,150000,300000,600000,1000000,2000000];
    bsTiers2.forEach((t,i) => {
        if ((playerStats.bestScore||0) < t && playerStats.achievements.includes(`bs${i+1}`)) toRevoke.add(`bs${i+1}`);
    });

    if ((playerStats.bestScore||0) < 100000) {
        for(let i=0;i<8;i++) { if(playerStats.achievements.includes(`hs${i+1}`)) toRevoke.add(`hs${i+1}`); }
    }

    if (!( playerStats.nameChanges===0 && (playerStats.maxLoginStreak||0)>=30 ) && playerStats.achievements.includes('x18')) toRevoke.add('x18');

    if (toRevoke.size > 0) {
        playerStats.achievements = playerStats.achievements.filter(id => !toRevoke.has(id));
        playerStats.pinnedAchievements = playerStats.pinnedAchievements.filter(id => !toRevoke.has(id));
        saveStatsLocally();
        const revokedCount = before - playerStats.achievements.length;
        if (revokedCount > 0) {
            if (typeof showToast === 'function' && typeof SVG_SHIELD !== 'undefined') {
                showToast('Logros Corregidos', `Se retiraron ${revokedCount} logro(s) concedido(s) por error.`, 'var(--accent-orange)', SVG_SHIELD);
            }
            if (typeof renderAchievements === 'function') renderAchievements();
        }
    }
    return toRevoke.size;
}

// --- Login diario y racha ---
function processDailyLogin() {
    const now = new Date(); const todayStr = now.toISOString().split('T')[0];
    if (playerStats.lastLoginDate !== todayStr) {
        const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        if (playerStats.lastLoginDate === yesterdayStr) {
            playerStats.currentLoginStreak++;
            playerStats.maxLoginStreak = Math.max(playerStats.maxLoginStreak, playerStats.currentLoginStreak);
        } else {
            playerStats.currentLoginStreak = 1;
            if(playerStats.maxLoginStreak === 0) playerStats.maxLoginStreak = 1;
            if(playerStats.lastLoginDate) playerStats.missedADay = true;
        }
        playerStats.lastLoginDate = todayStr;
        playerStats.todayGames = 0;
        playerStats.dailyAchUnlocks = 0;
        playerStats.totalDaysPlayed = (playerStats.totalDaysPlayed || 0) + 1;
        saveStatsLocally();
        if (typeof checkAchievements === 'function') checkAchievements();
    }
}
