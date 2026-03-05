// ════════════════════════════════════════════════════════════════
//  MÓDULO 10 — KLICK PASS
//  Contenido: 100 niveles secuenciales con misiones y recompensas,
//             renderizado del path, reclamación, badge del menú.
//
//  DEPENDENCIAS: playerStats [03], SFX [04], showToast [07],
//                switchScreen [07], saveGameStats hook [08]
// ════════════════════════════════════════════════════════════════

// ── Recompensas (suma exacta 100,000 ℙ) ──────────────────────────────────────
const _KP_REWARDS = [
  100,104,108,111,116,120,124,129,134,139,   // 1-10
  144,149,154,160,166,172,178,185,192,199,   // 11-20
  206,214,222,230,238,247,256,266,276,286,   // 21-30
  296,307,319,330,342,355,368,382,396,410,   // 31-40
  426,441,457,474,492,510,529,548,568,589,   // 41-50
  611,634,657,681,706,732,759,787,816,847,   // 51-60
  878,910,944,978,1015,1052,1091,1131,1173,1216, // 61-70
  1261,1307,1355,1405,1457,1511,1567,1624,1684,1746, // 71-80
  1811,1877,1947,2018,2093,2170,2250,2333,2419,2508, // 81-90
  2601,2697,2796,2899,3006,3117,3232,3351,3476,5000  // 91-100
];

// ── Misiones (100 niveles) ────────────────────────────────────────────────────
const _KP_MISSIONS = [
// TRAMO 1 — INICIACIÓN (1-10)
{lv:1,  title:'Primera Partida',      mission:'Completa tu primera partida.',                          chk:(ps)=>(ps.gamesPlayed||0)>=1},
{lv:2,  title:'Primeros Aciertos',    mission:'Consigue 5 respuestas correctas en total.',             chk:(ps)=>(ps.totalCorrect||0)>=5},
{lv:3,  title:'En Marcha',            mission:'Completa 3 partidas.',                                  chk:(ps)=>(ps.gamesPlayed||0)>=3},
{lv:4,  title:'Diez Correctas',       mission:'Acumula 10 respuestas correctas.',                      chk:(ps)=>(ps.totalCorrect||0)>=10},
{lv:5,  title:'Racha Inicial',        mission:'Logra una racha de 3 aciertos consecutivos.',           chk:(ps)=>(ps.maxStreak||0)>=3},
{lv:6,  title:'Constante',            mission:'Completa 5 partidas.',                                  chk:(ps)=>(ps.gamesPlayed||0)>=5},
{lv:7,  title:'Veinte Correctas',     mission:'Acumula 20 respuestas correctas.',                      chk:(ps)=>(ps.totalCorrect||0)>=20},
{lv:8,  title:'Primer Récord',        mission:'Consigue al menos 5,000 puntos en una partida.',        chk:(ps)=>(ps.bestScore||0)>=5000},
{lv:9,  title:'Racha x5',             mission:'Logra una racha de 5 aciertos consecutivos.',           chk:(ps)=>(ps.maxStreak||0)>=5},
{lv:10, title:'Despegue',             mission:'Completa 10 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=10},
// TRAMO 2 — APRENDIZ (11-25)
{lv:11, title:'Cincuenta Aciertos',   mission:'Acumula 50 respuestas correctas.',                      chk:(ps)=>(ps.totalCorrect||0)>=50},
{lv:12, title:'Puntuación 10k',       mission:'Alcanza 10,000 puntos en una sola partida.',            chk:(ps)=>(ps.bestScore||0)>=10000},
{lv:13, title:'Acumulado 20k',        mission:'Acumula 20,000 puntos entre todas tus partidas.',       chk:(ps)=>(ps.totalScore||0)>=20000},
{lv:14, title:'Racha x8',             mission:'Logra una racha de 8 aciertos consecutivos.',           chk:(ps)=>(ps.maxStreak||0)>=8},
{lv:15, title:'Quince Partidas',      mission:'Completa 15 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=15},
{lv:16, title:'Cien Correctas',       mission:'Acumula 100 respuestas correctas.',                     chk:(ps)=>(ps.totalCorrect||0)>=100},
{lv:17, title:'Puntuación 15k',       mission:'Supera los 15,000 puntos en una partida.',              chk:(ps)=>(ps.bestScore||0)>=15000},
{lv:18, title:'Acumulado 50k',        mission:'Acumula 50,000 puntos en total.',                       chk:(ps)=>(ps.totalScore||0)>=50000},
{lv:19, title:'Racha x10',            mission:'Logra una racha de 10 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=10},
{lv:20, title:'Veinte Partidas',      mission:'Completa 20 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=20},
{lv:21, title:'Sin Fallos I',         mission:'Termina una partida sin ningún error (mín. 5 preguntas).', chk:(ps,ks)=>(ks.perfectNoError||0)>=1},
{lv:22, title:'Puntuación 20k',       mission:'Supera los 20,000 puntos en una partida.',              chk:(ps)=>(ps.bestScore||0)>=20000},
{lv:23, title:'Doscientas Correctas', mission:'Acumula 200 respuestas correctas.',                     chk:(ps)=>(ps.totalCorrect||0)>=200},
{lv:24, title:'Acumulado 80k',        mission:'Acumula 80,000 puntos en total.',                       chk:(ps)=>(ps.totalScore||0)>=80000},
{lv:25, title:'Treinta Partidas',     mission:'Completa 30 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=30},
// TRAMO 3 — INTERMEDIO (26-40)
{lv:26, title:'Racha x12',            mission:'Logra una racha de 12 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=12},
{lv:27, title:'Puntuación 25k',       mission:'Consigue 25,000 puntos en una sola partida.',           chk:(ps)=>(ps.bestScore||0)>=25000},
{lv:28, title:'500 Correctas',        mission:'Acumula 500 respuestas correctas.',                     chk:(ps)=>(ps.totalCorrect||0)>=500},
{lv:29, title:'Acumulado 150k',       mission:'Acumula 150,000 puntos en total.',                      chk:(ps)=>(ps.totalScore||0)>=150000},
{lv:30, title:'Cuarenta Partidas',    mission:'Completa 40 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=40},
{lv:31, title:'Multiplicador x2',     mission:'Alcanza el multiplicador x2 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=2},
{lv:32, title:'Sin Fallos II',        mission:'Termina 3 partidas sin ningún error.',                   chk:(ps,ks)=>(ks.perfectNoError||0)>=3},
{lv:33, title:'Puntuación 30k',       mission:'Supera los 30,000 puntos en una partida.',              chk:(ps)=>(ps.bestScore||0)>=30000},
{lv:34, title:'Racha x15',            mission:'Logra una racha de 15 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=15},
{lv:35, title:'Cincuenta Partidas',   mission:'Completa 50 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=50},
{lv:36, title:'1,000 Correctas',      mission:'Acumula 1,000 respuestas correctas.',                   chk:(ps)=>(ps.totalCorrect||0)>=1000},
{lv:37, title:'Acumulado 250k',       mission:'Acumula 250,000 puntos en total.',                      chk:(ps)=>(ps.totalScore||0)>=250000},
{lv:38, title:'Puntuación 40k',       mission:'Supera los 40,000 puntos en una sola partida.',         chk:(ps)=>(ps.bestScore||0)>=40000},
{lv:39, title:'Multiplicador x3',     mission:'Alcanza el multiplicador x3 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=3},
{lv:40, title:'Sin Fallos III',       mission:'Termina 5 partidas sin ningún error.',                   chk:(ps,ks)=>(ks.perfectNoError||0)>=5},
// TRAMO 4 — AVANZADO (41-55)
{lv:41, title:'Puntuación 50k',       mission:'Consigue 50,000 puntos en una sola partida.',           chk:(ps)=>(ps.bestScore||0)>=50000},
{lv:42, title:'Racha x18',            mission:'Logra una racha de 18 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=18},
{lv:43, title:'Setenta Partidas',     mission:'Completa 70 partidas.',                                 chk:(ps)=>(ps.gamesPlayed||0)>=70},
{lv:44, title:'Acumulado 400k',       mission:'Acumula 400,000 puntos en total.',                      chk:(ps)=>(ps.totalScore||0)>=400000},
{lv:45, title:'2,000 Correctas',      mission:'Acumula 2,000 respuestas correctas.',                   chk:(ps)=>(ps.totalCorrect||0)>=2000},
{lv:46, title:'Puntuación 60k',       mission:'Supera los 60,000 puntos en una partida.',              chk:(ps)=>(ps.bestScore||0)>=60000},
{lv:47, title:'Multiplicador x4',     mission:'Alcanza el multiplicador x4 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=4},
{lv:48, title:'Sin Fallos IV',        mission:'Termina 10 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=10},
{lv:49, title:'Racha x20',            mission:'Logra una racha de 20 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=20},
{lv:50, title:'Cien Partidas',        mission:'Completa 100 partidas. La mitad del camino.',           chk:(ps)=>(ps.gamesPlayed||0)>=100},
{lv:51, title:'Acumulado 600k',       mission:'Acumula 600,000 puntos en total.',                      chk:(ps)=>(ps.totalScore||0)>=600000},
{lv:52, title:'3,000 Correctas',      mission:'Acumula 3,000 respuestas correctas.',                   chk:(ps)=>(ps.totalCorrect||0)>=3000},
{lv:53, title:'Puntuación 75k',       mission:'Consigue 75,000 puntos en una sola partida.',           chk:(ps)=>(ps.bestScore||0)>=75000},
{lv:54, title:'Sin Fallos V',         mission:'Termina 15 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=15},
{lv:55, title:'Racha x22',            mission:'Logra una racha de 22 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=22},
// TRAMO 5 — EXPERTO (56-70)
{lv:56, title:'120 Partidas',         mission:'Completa 120 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=120},
{lv:57, title:'Acumulado 800k',       mission:'Acumula 800,000 puntos en total.',                      chk:(ps)=>(ps.totalScore||0)>=800000},
{lv:58, title:'Puntuación 90k',       mission:'Supera los 90,000 puntos en una partida.',              chk:(ps)=>(ps.bestScore||0)>=90000},
{lv:59, title:'Multiplicador x5',     mission:'Alcanza el multiplicador x5 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=5},
{lv:60, title:'5,000 Correctas',      mission:'Acumula 5,000 respuestas correctas.',                   chk:(ps)=>(ps.totalCorrect||0)>=5000},
{lv:61, title:'Sin Fallos VI',        mission:'Termina 20 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=20},
{lv:62, title:'Racha x25',            mission:'Logra una racha de 25 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=25},
{lv:63, title:'Puntuación 100k',      mission:'Consigue 100,000 puntos o más en una partida.',         chk:(ps)=>(ps.bestScore||0)>=100000},
{lv:64, title:'150 Partidas',         mission:'Completa 150 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=150},
{lv:65, title:'Acumulado 1M',         mission:'Acumula 1,000,000 de puntos en total.',                 chk:(ps)=>(ps.totalScore||0)>=1000000},
{lv:66, title:'Sin Fallos VII',       mission:'Termina 25 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=25},
{lv:67, title:'7,000 Correctas',      mission:'Acumula 7,000 respuestas correctas.',                   chk:(ps)=>(ps.totalCorrect||0)>=7000},
{lv:68, title:'Multiplicador x6',     mission:'Alcanza el multiplicador x6 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=6},
{lv:69, title:'Puntuación 120k',      mission:'Supera los 120,000 puntos en una sola partida.',        chk:(ps)=>(ps.bestScore||0)>=120000},
{lv:70, title:'Racha x28',            mission:'Logra una racha de 28 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=28},
// TRAMO 6 — ÉLITE (71-85)
{lv:71, title:'200 Partidas',         mission:'Completa 200 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=200},
{lv:72, title:'Acumulado 1.2M',       mission:'Acumula 1,200,000 puntos en total.',                    chk:(ps)=>(ps.totalScore||0)>=1200000},
{lv:73, title:'10,000 Correctas',     mission:'Acumula 10,000 respuestas correctas.',                  chk:(ps)=>(ps.totalCorrect||0)>=10000},
{lv:74, title:'Sin Fallos VIII',      mission:'Termina 30 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=30},
{lv:75, title:'Puntuación 150k',      mission:'Consigue 150,000 puntos en una partida.',               chk:(ps)=>(ps.bestScore||0)>=150000},
{lv:76, title:'Racha x30',            mission:'Logra una racha de 30 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=30},
{lv:77, title:'Multiplicador x7',     mission:'Alcanza el multiplicador x7 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=7},
{lv:78, title:'250 Partidas',         mission:'Completa 250 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=250},
{lv:79, title:'Acumulado 1.5M',       mission:'Acumula 1,500,000 puntos en total.',                    chk:(ps)=>(ps.totalScore||0)>=1500000},
{lv:80, title:'Sin Fallos IX',        mission:'Termina 35 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=35},
{lv:81, title:'15,000 Correctas',     mission:'Acumula 15,000 respuestas correctas.',                  chk:(ps)=>(ps.totalCorrect||0)>=15000},
{lv:82, title:'Puntuación 180k',      mission:'Supera los 180,000 puntos en una sola partida.',        chk:(ps)=>(ps.bestScore||0)>=180000},
{lv:83, title:'Racha x33',            mission:'Logra una racha de 33 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=33},
{lv:84, title:'Multiplicador x8',     mission:'Alcanza el multiplicador x8 en cualquier partida.',     chk:(ps)=>(ps.maxMult||1)>=8},
{lv:85, title:'300 Partidas',         mission:'Completa 300 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=300},
// TRAMO 7 — MAESTRÍA (86-99)
{lv:86, title:'Acumulado 2M',         mission:'Acumula 2,000,000 puntos en total.',                    chk:(ps)=>(ps.totalScore||0)>=2000000},
{lv:87, title:'Puntuación 200k',      mission:'Consigue 200,000 puntos en una sola partida.',          chk:(ps)=>(ps.bestScore||0)>=200000},
{lv:88, title:'20,000 Correctas',     mission:'Acumula 20,000 respuestas correctas.',                  chk:(ps)=>(ps.totalCorrect||0)>=20000},
{lv:89, title:'Sin Fallos X',         mission:'Termina 40 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=40},
{lv:90, title:'Racha x35',            mission:'Logra una racha de 35 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=35},
{lv:91, title:'400 Partidas',         mission:'Completa 400 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=400},
{lv:92, title:'Acumulado 2.5M',       mission:'Acumula 2,500,000 puntos en total.',                    chk:(ps)=>(ps.totalScore||0)>=2500000},
{lv:93, title:'Puntuación 250k',      mission:'Consigue 250,000 puntos en una sola partida.',          chk:(ps)=>(ps.bestScore||0)>=250000},
{lv:94, title:'Racha x38',            mission:'Logra una racha de 38 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=38},
{lv:95, title:'25,000 Correctas',     mission:'Acumula 25,000 respuestas correctas.',                  chk:(ps)=>(ps.totalCorrect||0)>=25000},
{lv:96, title:'500 Partidas',         mission:'Completa 500 partidas.',                                chk:(ps)=>(ps.gamesPlayed||0)>=500},
{lv:97, title:'Acumulado 3M',         mission:'Acumula 3,000,000 puntos en total.',                    chk:(ps)=>(ps.totalScore||0)>=3000000},
{lv:98, title:'Racha x40',            mission:'Logra una racha de 40 aciertos consecutivos.',          chk:(ps)=>(ps.maxStreak||0)>=40},
{lv:99, title:'Sin Fallos XI',        mission:'Termina 50 partidas sin ningún error.',                  chk:(ps,ks)=>(ks.perfectNoError||0)>=50},
// TRAMO 8 — CIMA (100)
{lv:100,title:'Rango Mítico',         mission:'Alcanza el rango Mítico.',                              chk:(ps)=>getRankInfo(ps).title==='Mítico'},
];

const KP_TOTAL  = 100;
const KP_LEVELS = _KP_MISSIONS.map((m, i) => ({ ...m, reward: _KP_REWARDS[i] }));
const KP_STORAGE_KEY = 'klick_kp_state';

function getKpState() {
    try { return JSON.parse(localStorage.getItem(KP_STORAGE_KEY) || '{}'); } catch(e) { return {}; }
}
function saveKpState(state) {
    try { localStorage.setItem(KP_STORAGE_KEY, JSON.stringify(state)); } catch(e) {}
}

function kpCanClaim(lv) {
    const state   = getKpState();
    const claimed = new Set(state.claimed || []);
    if (claimed.has(lv)) return false;
    if (lv > 1 && !claimed.has(lv - 1)) return false;
    const mission = KP_LEVELS[lv - 1];
    return mission && mission.chk(playerStats, state);
}

function kpClaim(lv) {
    if (!kpCanClaim(lv)) return;
    SFX.achievement();
    const state = getKpState();
    state.claimed = state.claimed || [];
    state.claimed.push(lv);
    state.kpPinceles = (state.kpPinceles || 0) + _KP_REWARDS[lv - 1];

    // Rastrear días de reclamación para logros kpa7/kpa8
    const today = new Date().toISOString().split('T')[0];
    state.claimDays = state.claimDays || [];
    if (!state.claimDays.includes(today)) state.claimDays.push(today);

    // Sesión de reclamaciones (sincronizar en playerStats para que checkAchievements lo lea)
    state.sessionClaims = (state.sessionClaims || 0) + 1;
    playerStats.kpSessionClaims = Math.max(playerStats.kpSessionClaims || 0, state.sessionClaims);

    saveKpState(state);

    // Logros de KlickPass
    playerStats.kpClaimDays = state.claimDays;
    checkAchievements();

    showToast(`Nivel ${lv} reclamado`, `+${_KP_REWARDS[lv-1].toLocaleString()} ℙ`, 'var(--accent-yellow)', SVG_STAR);
    _kpUpdateNodeCard(lv, 'claimed');
    _kpUpdateHeader();
    _kpUpdateMenuBadge();
}

function _kpUpdateMenuBadge() {
    const _badgeState   = getKpState();
    const _badgeClaimed = new Set(_badgeState.claimed || []);
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
    else           { badge.style.display = 'none'; }
}

function _kpUpdateHeader() {
    const state   = getKpState();
    const claimed = (state.claimed || []).length;
    const pct     = (claimed / KP_TOTAL) * 100;
    const countEl  = document.getElementById('kp-progress-count');
    const barEl    = document.getElementById('kp-total-bar-fill');
    const rewardEl = document.getElementById('kp-reward-total');
    if (countEl)  countEl.textContent = claimed + ' / ' + KP_TOTAL;
    if (barEl)    barEl.style.width   = pct + '%';
    if (rewardEl) {
        const total = (state.claimed || []).reduce((s, id) => { const l = KP_LEVELS[id-1]; return s + (l ? l.reward : 0); }, 0);
        rewardEl.textContent = total > 0 ? total.toLocaleString() + ' ℙ reclamados de 100,000' : 'Sin recompensas reclamadas aún';
    }
}
function renderKpHeader() { _kpUpdateHeader(); }

function _kpUpdateNodeCard(lvNum, status) {
    const container = document.getElementById('kp-path-container');
    if (!container) return;
    const node = container.querySelector('[data-kp-node="' + lvNum + '"]');
    const card = container.querySelector('[data-kp-card="' + lvNum + '"]');
    if (!node || !card) return;
    node.classList.remove('unlocked', 'claimed');
    card.classList.remove('unlocked', 'claimed');
    if (status === 'claimed') {
        node.classList.add('claimed');
        node.innerHTML = '<div class="kp-node-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>';
        card.classList.add('claimed');
        const lbl = card.querySelector('.kp-card-level');
        if (lbl) lbl.textContent = lbl.textContent.replace(/BLOQUEADO|DISPONIBLE|EN CURSO/, 'COMPLETADO');
        const dot = card.querySelector('.kp-status-dot'); if (dot) dot.remove();
        const claimBtn = card.querySelector('.kp-claim-btn'); if (claimBtn) claimBtn.remove();
    } else if (status === 'unlocked') {
        node.classList.add('unlocked');
        node.innerHTML = '<span class="kp-node-num">' + String(lvNum).padStart(2,'0') + '</span><span class="kp-node-sub">NV</span>';
        card.classList.add('unlocked');
        const lbl = card.querySelector('.kp-card-level');
        if (lbl) lbl.textContent = lbl.textContent.replace('BLOQUEADO', 'DISPONIBLE');
        const bottom = card.querySelector('.kp-card-bottom');
        if (bottom) {
            if (!bottom.querySelector('.kp-status-dot')) { const dot = document.createElement('span'); dot.className = 'kp-status-dot'; bottom.appendChild(dot); }
            if (!bottom.querySelector('.kp-claim-btn'))  { const btn = document.createElement('button'); btn.className = 'kp-claim-btn'; btn.textContent = 'RECLAMAR'; btn.setAttribute('onclick', 'kpClaim(' + lvNum + ')'); bottom.appendChild(btn); }
        }
    }
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

// ── Hook en saveGameStats para trackear perfectNoError ───────────────────────
(function() {
    const _orig = saveGameStats;
    saveGameStats = function() {
        const correct   = currentQuestionIndex - (currentWrongAnswers||0) - (currentTimeoutAnswers||0);
        const isPerfect = (currentWrongAnswers||0) === 0 && (currentTimeoutAnswers||0) === 0 && correct >= 5;
        _orig.apply(this, arguments);
        if (isPerfect) {
            const kpSt = getKpState();
            kpSt.perfectNoError = (kpSt.perfectNoError || 0) + 1;
            saveKpState(kpSt);
        }
        setTimeout(_kpUpdateMenuBadge, 200);
    };
})();

// ── Init ──────────────────────────────────────────────────────────────────────
_kpUpdateMenuBadge();
