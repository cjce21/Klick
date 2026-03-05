// ════════════════════════════════════════════════════════════════════════════
//  KLICK — script.js principal
//  Este archivo contiene la lógica que NO está en los módulos separados.
//
//  ORDEN DE CARGA (en index.html):
//    01-security.js  → Anti-trampas, UUID
//    02-svgs.js      → Constantes SVG
//    03-player-stats.js → playerStats, localStorage, migraciones
//    04-audio.js     → WebAudio, SFX, pistas musicales
//    05-leaderboard.js  → submitLeaderboard, fetchLeaderboard, getRankInfo
//    06-achievements.js → Logros, checkAchievements
//    07-ui.js        → switchScreen, showToast, openSettings, goToAchievements
//    08-game-loop.js → startGame, loadQuestion, selectAnswer, endGame
//    09-roulette.js  → Ruleta de recompensas
//    10-klickpass.js → Klick Pass 100 niveles
//    11-virtual-scroller.js → Renderizado eficiente de logros
//    12-service-worker.js   → Auto-actualización
//    script.js       → Motor musical, partículas, perfil, motor de preguntas, init
// ════════════════════════════════════════════════════════════════════════════

// ── MOTOR MUSICAL — stopMusicEngine ─────────────────────────────────────────
function stopMusicEngine() {
    isMusicPlaying = false;
    clearTimeout(musicTimerID);
    musicSeqStep = 0;
    chordIndex = 0;
}

// ── TRACK_CONFIGS — configuraciones de síntesis por pista ───────────────────
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
    // DARK TIDE: tétrico, profundo, oscuro
    track_pulse: {
        bpmBase: 60, bpmFrenzy: 78,
        CHORD_PROG: [[40,47,52,55],[38,45,50,53],[36,43,48,52],[41,48,53,57]],
        ARP_PAT: [0,2,1,3,2,0,3,1,0,2,3,0,1,3,2,1],
        arpType: 'sawtooth', bassType: 'sawtooth', kickFreq: 42,
        kickVol: 0.85, bassVol: 0.62, arpVol: 0.13,
        hasPad: true, hasHihat: false, hasDrone: true
    },
    // DEEP CURRENT: sawtooth bass dominant, groovey feel
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

    // Drone: Dark Tide (every 8 steps)
    if (tc.hasDrone && step % 8 === 0) {
        const droneDur = 2.4;
        [chord[0] - 24, chord[0] - 12].forEach((m, idx) => {
            const o = audioCtx.createOscillator(), g = audioCtx.createGain();
            o.type = 'sine';
            o.frequency.setValueAtTime(midiToHz(m), t);
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

    // Arp melody
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

// ── PLAYER CARD — abrir/cerrar tarjeta de jugador ───────────────────────────
function openPlayerCard(index) {
    const data = window._leaderboardData;
    if (!data || index == null) return;
    const p = data[index];
    if (!p) return;
    const isMe = p.uuid === playerStats.uuid;
    document.getElementById('pcard-big-name').textContent = p.name || 'JUGADOR';
    document.getElementById('pcard-chip-title').textContent = p.rankTitle || 'Novato';
    const chipDot = document.getElementById('pcard-chip-dot');
    const isLight = document.body.classList.contains('light-mode');

    function rankColor(title) {
        switch(title) {
            case 'Mítico':  return isLight ? '#000000' : '#ffffff';
            case 'Leyenda': return isLight ? '#8a6200' : 'var(--accent-yellow)';
            case 'Maestro': return isLight ? '#7a0a8c' : 'var(--accent-purple)';
            case 'Pro':     return isLight ? '#c41940' : 'var(--accent-red)';
            case 'Junior':  return isLight ? '#0070a8' : 'var(--accent-blue)';
            default:        return isLight ? '#0a7a3e' : 'var(--accent-green)';
        }
    }
    const rc = rankColor(p.rankTitle);
    if (chipDot) chipDot.style.background = rc;
    document.getElementById('pcard-pl').textContent = (p.powerLevel || 0).toLocaleString();
    document.getElementById('pcard-pos').textContent = `#${index + 1}`;
    document.getElementById('pcard-totalscore').textContent = (p.totalScore || 0).toLocaleString();
    document.getElementById('pcard-streak').textContent = (p.maxStreak || 0).toLocaleString();

    const ownData = document.getElementById('pcard-own-data');
    const mePill  = document.getElementById('pcard-me-pill');
    if (isMe) {
        if (ownData) ownData.style.display = 'block';
        if (mePill)  mePill.style.display  = 'flex';
        document.getElementById('pcard-bestscore').textContent = (playerStats.bestScore || 0).toLocaleString();
        document.getElementById('pcard-games').textContent     = (playerStats.gamesPlayed || 0).toLocaleString();
        const totalA = (playerStats.totalCorrect||0) + (playerStats.totalWrong||0) + (playerStats.totalTimeouts||0);
        const acc = totalA > 0 ? Math.round((playerStats.totalCorrect||0) / totalA * 100) : 0;
        document.getElementById('pcard-acc-pct').textContent = `${acc}%`;
        setTimeout(() => {
            const fill = document.getElementById('pcard-acc-fill');
            if (fill) { fill.style.width = acc + '%'; fill.style.background = rc; }
        }, 100);
    } else {
        if (ownData) ownData.style.display = 'none';
        if (mePill)  mePill.style.display  = 'none';
    }

    // Particle canvas
    const pcCanvas = document.getElementById('pcard-particle-canvas');
    if (pcCanvas) {
        pcCanvas.width  = window.innerWidth;
        pcCanvas.height = window.innerHeight;
    }

    const overlay = document.getElementById('pcard-overlay');
    if (overlay) overlay.style.display = 'flex';

    // Spawn some celebration particles
    spawnPcardParticles(rc);
}

function spawnPcardParticles(color) {
    const overlay = document.getElementById('pcard-overlay');
    if (!overlay) return;
    for (let i = 0; i < 20; i++) {
        const p = document.createElement('div');
        p.className = 'r-particle';
        p.style.background = i % 3 === 0 ? '#ffffff' : color;
        p.style.width  = (5 + Math.random() * 6) + 'px';
        p.style.height = p.style.width;
        p.style.zIndex = '5';
        p.style.position = 'absolute';
        p.style.left = (10 + Math.random() * 80) + '%';
        p.style.top  = (20 + Math.random() * 60) + '%';
        p.style.setProperty('--tx', (Math.random() - 0.5) * 200 + 'px');
        p.style.setProperty('--ty', (Math.random() - 0.8) * 200 + 'px');
        p.style.animationDelay    = Math.random() * 0.3 + 's';
        p.style.animationDuration = (0.7 + Math.random() * 0.5) + 's';
        overlay.appendChild(p);
        setTimeout(() => p.remove(), 1400);
    }
}

function closePlayerCard() {
    const overlay = document.getElementById('pcard-overlay');
    if (overlay) overlay.style.display = 'none';
}

function pcardOverlayClick(e) {
    if (e.target === document.getElementById('pcard-overlay')) closePlayerCard();
}

// ── CARGA DE PREGUNTAS ───────────────────────────────────────────────────────
let quizDataPool = [];

async function loadQuestions() {
    try {
        const res = await fetch('./questions.json');
        const data = await res.json();
        quizDataPool = Array.isArray(data) ? data : (data.questions || []);
        _qeSync();
    } catch(e) {
        console.error('Error cargando preguntas:', e);
        quizDataPool = [];
    }
}

// ── Colores de acento (usados en feedback de logros en partida) ──────────────
const colors = {
    blue:   'var(--accent-blue)',
    green:  'var(--accent-green)',
    yellow: 'var(--accent-yellow)',
    orange: 'var(--accent-orange)',
    red:    'var(--accent-red)',
    purple: 'var(--accent-purple)',
    dark:   'var(--text-secondary)'
};

// ── UTILIDADES ───────────────────────────────────────────────────────────────
function shuffleArray(array) {
    let current = array.length, random;
    while (current !== 0) {
        random = Math.floor(Math.random() * current);
        current--;
        [array[current], array[random]] = [array[random], array[current]];
    }
    return array;
}

function darkenHex(hex, factor) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const dr = Math.round(r * (1 - factor));
    const dg = Math.round(g * (1 - factor));
    const db = Math.round(b * (1 - factor));
    return `#${dr.toString(16).padStart(2,'0')}${dg.toString(16).padStart(2,'0')}${db.toString(16).padStart(2,'0')}`;
}

// ── LOGIN DIARIO ─────────────────────────────────────────────────────────────
function processDailyLogin() {
    const today = new Date().toISOString().split('T')[0];
    if (playerStats.lastLoginDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (playerStats.lastLoginDate === yesterday) {
        playerStats.currentLoginStreak = (playerStats.currentLoginStreak || 0) + 1;
    } else {
        playerStats.currentLoginStreak = 1;
    }
    if (playerStats.currentLoginStreak > (playerStats.maxLoginStreak || 0)) {
        playerStats.maxLoginStreak = playerStats.currentLoginStreak;
    }
    playerStats.lastLoginDate = today;
    playerStats.todayGames = 0;
    playerStats.dailyAchUnlocks = 0;
    saveStatsLocally();
}

// ── ACTUALIZAR FAVICON / LOGO DOTS según rango ───────────────────────────────
function updateLogoDots() {
    const rankColor = currentRankInfo ? currentRankInfo.color : 'var(--accent-green)';
    const dots = document.querySelectorAll('.logo-dot');
    dots.forEach(d => d.style.color = rankColor);
    // Actualizar favicon con color de rango
    const favicon = document.getElementById('dynamic-favicon');
    if (favicon) {
        const hexColor = currentRankInfo && currentRankInfo.color.startsWith('#')
            ? currentRankInfo.color
            : '#00ff66';
        const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='${hexColor}' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><polygon points='13 2 3 14 12 14 11 22 21 10 12 10 13 2'></polygon></svg>`;
        favicon.href = `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }
}

// ── PANTALLA DE PERFIL ───────────────────────────────────────────────────────
function goToProfile(needsName = false) {
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    SFX.click();
    playerStats.profileViews = (playerStats.profileViews || 0) + 1;
    trackSectionVisit('profile');
    document.getElementById('stat-games').innerText  = playerStats.gamesPlayed;
    document.getElementById('stat-score').innerText  = playerStats.bestScore.toLocaleString();
    document.getElementById('stat-streak').innerText = playerStats.maxStreak;
    document.getElementById('stat-days').innerText   = playerStats.maxLoginStreak;
    document.getElementById('profile-name-input').value = (playerStats.playerName === 'JUGADOR') ? '' : playerStats.playerName;
    document.getElementById('profile-warning').style.opacity = needsName ? '1' : '0';
    currentRankInfo = getRankInfo(playerStats);
    updateLogoDots();
    document.getElementById('profile-rank-display').innerText = `Rango: ${currentRankInfo.title}`;
    const isLight = document.body.classList.contains('light-mode');
    document.getElementById('profile-rank-display').style.color = isLight
        ? darkenHex(currentRankInfo.color, 0.4)
        : currentRankInfo.color;

    // Render PL panel
    (function renderPLPanel() {
        const s = playerStats;
        const plBase   = Math.floor((s.totalScore  || 0) * 0.05);
        const plBest   = Math.floor((s.bestScore   || 0) * 1.5);
        const plStreak = (s.maxStreak    || 0) * 200;
        const plPerf   = (s.perfectGames || 0) * 1000;
        const plAchs   = (s.achievements || []).length * 300;
        const plAcc    = s.gamesPlayed > 0
            ? Math.floor(((s.totalCorrect || 0) / (s.gamesPlayed * 20)) * 5000)
            : 0;
        const plTotal  = plBase + plBest + plStreak + plPerf + plAchs + plAcc;
        const fmt = n => n.toLocaleString();

        const totalAnswers = (s.totalCorrect || 0) + (s.totalWrong || 0) + (s.totalTimeouts || 0);
        const accuracy = totalAnswers > 0
            ? Math.min(100, Math.round((s.totalCorrect || 0) / totalAnswers * 100))
            : 0;

        const plTotalEl = document.getElementById('pl-total');
        if (plTotalEl) { plTotalEl.innerText = fmt(plTotal); plTotalEl.style.color = currentRankInfo.color; }
        const plHeroEl = document.getElementById('pl-hero-total');
        if (plHeroEl)  { plHeroEl.innerText  = fmt(plTotal); plHeroEl.style.color  = currentRankInfo.color; }
        const panel = document.getElementById('pl-panel');
        if (panel) panel.style.borderColor = `rgba(${currentRankInfo.rgb},0.28)`;
        const posEl = document.getElementById('pl-ranking-pos');
        if (posEl) posEl.innerText = s.rankingPosition && s.rankingPosition < 999 ? `#${s.rankingPosition}` : '#—';

        const rowsEl = document.getElementById('pl-rows');
        if (!rowsEl) return;
        const clr = ['var(--accent-blue)','var(--accent-yellow)','var(--accent-orange)','var(--accent-green)','var(--accent-purple)','var(--accent-red)'];
        const rows = [
            { label: 'Puntaje acum.',      raw: fmt(s.totalScore||0),                 factor: '× 0.05',  result: plBase,   color: clr[0] },
            { label: 'Récord',             raw: fmt(s.bestScore||0),                  factor: '× 1.5',   result: plBest,   color: clr[1] },
            { label: 'Racha máxima',       raw: `${s.maxStreak||0} aciertos`,          factor: '× 200',   result: plStreak, color: clr[2] },
            { label: 'Partidas perfectas', raw: `${s.perfectGames||0} partidas`,       factor: '× 1,000', result: plPerf,   color: clr[3] },
            { label: 'Logros',             raw: `${(s.achievements||[]).length} logros`, factor: '× 300',  result: plAchs,   color: clr[4] },
            { label: 'Precisión',          raw: `${accuracy}%`,                        factor: '× 5,000', result: plAcc,    color: clr[5] },
        ];
        rowsEl.innerHTML = rows.map((r, i) => `
            <div class="pl-calc-row">
                <span class="pl-calc-label" style="color:${r.color};">${r.label}</span>
                <span class="pl-calc-val">${r.raw}</span>
                <span class="pl-calc-factor">${r.factor}</span>
                <span class="pl-calc-result" style="color:${r.color};">+${fmt(r.result)}</span>
            </div>
            ${i === rows.length - 1 ? `<div class="pl-calc-divider"></div><div class="pl-calc-row" style="padding:6px 4px;">
                <span style="font-size:0.7rem;font-weight:800;color:var(--text-primary);text-transform:uppercase;letter-spacing:1px;grid-column:1/3;">Total PL</span>
                <span></span>
                <span style="font-size:clamp(0.8rem,1.5vw,0.95rem);font-weight:900;font-family:monospace;color:${currentRankInfo.color};text-align:right;">${fmt(plTotal)}</span>
            </div>` : ''}
        `).join('');

        // Barra de progreso hacia próximo hito
        const milestones = [10000, 100000, 1000000, 5000000, 10000000];
        let nextMs = milestones.find(m => m > plTotal) || 10000000;
        let prevMs = milestones[milestones.indexOf(nextMs) - 1] || 0;
        const prog = Math.min(1, (plTotal - prevMs) / Math.max(1, nextMs - prevMs));
        const pctRound = Math.round(prog * 100);
        setTimeout(() => {
            const bar = document.getElementById('pl-bar-total');
            if (bar) { bar.style.width = pctRound + '%'; bar.style.background = currentRankInfo.color; }
        }, 120);

        // Etiqueta condición siguiente rango
        const nextEl = document.getElementById('pl-next-label');
        if (nextEl) {
            const ri = currentRankInfo;
            let condHtml = '';
            if (ri.title === 'Novato') {
                const c1 = s.bestScore >= 15000, c2 = (s.gamesPlayed||0) >= 5;
                condHtml = `<span style="color:var(--accent-blue);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: JUNIOR</span> &nbsp;` +
                    `<span style="${c1?'color:var(--accent-green)':''}">Récord ≥ 15k ${c1?'✓':'✗'}</span> · ` +
                    `<span style="${c2?'color:var(--accent-green)':''}">5 partidas ${c2?'✓':'✗'}</span>`;
            } else if (ri.title === 'Junior') {
                const c1 = s.totalScore >= 60000, c2 = (s.totalCorrect||0) >= 200, c3 = s.maxStreak >= 12;
                condHtml = `<span style="color:var(--accent-red);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: PRO</span> &nbsp;` +
                    `<span style="${c1?'color:var(--accent-green)':''}">Acum. 60k ${c1?'✓':'✗'}</span> · ` +
                    `<span style="${c2?'color:var(--accent-green)':''}">200 aciertos ${c2?'✓':'✗'}</span> · ` +
                    `<span style="${c3?'color:var(--accent-green)':''}">Racha ×12 ${c3?'✓':'✗'}</span>`;
            } else if (ri.title === 'Pro') {
                const c1 = s.totalScore >= 150000, c2 = (s.gamesPlayed||0) >= 50, c3 = (s.maxMult||1) >= 4;
                condHtml = `<span style="color:var(--accent-purple);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: MAESTRO</span> &nbsp;` +
                    `<span style="${c1?'color:var(--accent-green)':''}">Acum. 150k ${c1?'✓':'✗'}</span> · ` +
                    `<span style="${c2?'color:var(--accent-green)':''}">50 partidas ${c2?'✓':'✗'}</span> · ` +
                    `<span style="${c3?'color:var(--accent-green)':''}">Mult. ×4 ${c3?'✓':'✗'}</span>`;
            } else if (ri.title === 'Maestro') {
                const c1 = s.totalScore >= 400000, c2 = (s.totalCorrect||0) >= 1500, c3 = (s.perfectGames||0) >= 10;
                condHtml = `<span style="color:var(--accent-yellow);font-weight:700;font-size:0.62rem;letter-spacing:1px;">SIGUIENTE: LEYENDA</span> &nbsp;` +
                    `<span style="${c1?'color:var(--accent-green)':''}">Acum. 400k ${c1?'✓':'✗'}</span> · ` +
                    `<span style="${c2?'color:var(--accent-green)':''}">1,500 aciertos ${c2?'✓':'✗'}</span> · ` +
                    `<span style="${c3?'color:var(--accent-green)':''}">10 perfectas ${c3?'✓':'✗'}</span>`;
            } else {
                condHtml = `<span style="color:var(--text-secondary);font-size:0.62rem;">Has alcanzado el rango máximo</span>`;
            }
            nextEl.innerHTML = condHtml;
        }
    })();

    saveStatsLocally();
    switchScreen('profile-screen');
}

// ── SAVENAME desde perfil ────────────────────────────────────────────────────
function saveName() {
    const input = document.getElementById('profile-name-input');
    const val = input.value.trim().toUpperCase().replace(/[^A-Z0-9ÁÉÍÓÚÜÑ ]/gi, '').slice(0, 16);
    if (!val) { document.getElementById('profile-warning').style.opacity = '1'; return; }
    playerStats.playerName = val;
    playerStats.nameChanges = (playerStats.nameChanges || 0) + 1;
    saveStatsLocally();
    SFX.click();
    document.getElementById('profile-warning').style.opacity = '0';
    checkAchievements();
    showToast('Nombre guardado', `Bienvenido, ${val}`, 'var(--accent-green)', SVG_USER);
}

// ── COUNTDOWN, HUD DE VIDAS/MULTI/RACHA ─────────────────────────────────────
function showCountdown(callback) {
    switchScreen('countdown-screen');
    const numEl  = document.getElementById('countdown-number');
    const lblEl  = document.getElementById('countdown-label');
    const steps  = [
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
    for (let i = 0; i < 3; i++) {
        const el = document.createElement('div');
        el.innerHTML = SVG_BOLT;
        if (i >= lives) el.classList.add('life-lost');
        c.appendChild(el);
    }
}

function updateMultiplierUI() {
    const b = document.getElementById('multiplier-badge');
    multiplier = Math.min(10, Math.max(1, Math.floor(streak / 5) + 1));
    if (multiplier > (playerStats.maxMult || 1)) playerStats.maxMult = multiplier;
    if (multiplier > 1) {
        b.style.display = 'block';
        b.innerText = `x${multiplier}`;
        const cls = multiplier <= 6 ? `mult-x${multiplier}`
                  : multiplier === 7 ? 'mult-x7'
                  : multiplier === 8 ? 'mult-x8'
                  : multiplier === 9 ? 'mult-x9' : 'mult-x10';
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
    } else {
        app.classList.remove('streak-active');
    }
}

function triggerMultiplierEffect(mult) {
    // Visual del badge CSS — no-op
}

// ══════════════════════════════════════════════════════════════════════════════
//  MOTOR DE PREGUNTAS INTELIGENTE
//  Garantías:
//  • Nunca repite una pregunta hasta dar TODAS las del pool (ciclo completo)
//  • Zona de exclusión = 40% del pool entre ciclos
//  • La primera pregunta de una nueva partida no coincide con la última de la anterior
// ══════════════════════════════════════════════════════════════════════════════
const _qe = {
    pool:     [],
    queue:    [],
    tail:     [],
    tailSize: 20,
    lastKey:  '',
};

function _qKey(q) {
    let h = 5381;
    const s = q.question;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) + h) ^ s.charCodeAt(i);
        h = h >>> 0;
    }
    return h.toString(36);
}

function _qRefill(excludeSet) {
    const pool = _qe.pool;
    if (!pool.length) return;
    const valid = [], invalid = [];
    for (let i = 0; i < pool.length; i++) {
        const k = _qKey(pool[i]);
        if (excludeSet && excludeSet.has(k)) invalid.push(pool[i]);
        else valid.push(pool[i]);
    }
    const useValid = valid.length >= Math.max(5, Math.floor(pool.length * 0.3));
    const source = useValid ? valid : [...pool];
    for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [source[i], source[j]] = [source[j], source[i]];
    }
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

function _qeSync() {
    _qe.pool     = quizDataPool;
    _qe.tailSize = Math.min(120, Math.max(20, Math.floor(quizDataPool.length * 0.4)));
    if (_qe.queue.length === 0) _qRefill(new Set(_qe.tail));
}

function _qeResetGame() {
    _qe.queue = [];
    _qRefill(new Set(_qe.tail));
}

function _qeGetNext() {
    if (!_qe.pool.length) return null;
    if (_qe.queue.length === 0) _qRefill(new Set(_qe.tail));
    const q = _qe.queue.shift();
    if (!q) return null;
    const key = _qKey(q);
    _qe.tail.push(key);
    if (_qe.tail.length > _qe.tailSize) _qe.tail.shift();
    _qe.lastKey = key;
    return q;
}

// Alias legacy (no-ops)
function _markUsed() {}
const _recentQuestionIds = { clear: () => {} };

// ── PARTÍCULAS PRINCIPALES ───────────────────────────────────────────────────
const canvas = document.getElementById('particle-canvas');
const ctx    = canvas.getContext('2d', { alpha: true });
let particlesArray = [];
let fpsInterval    = 1000 / playerStats.maxFps;
let then           = performance.now();
let _cpFrame       = 0;
let _smoothDelta   = fpsInterval;
const _EMA_K       = 0.12;

function initParticles() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    particlesArray = [];
    const isMobile = window.innerWidth < 768;
    const area = canvas.width * canvas.height;
    const num  = Math.round(Math.min(area / 15000, isMobile ? 30 : 60));
    for (let i = 0; i < num; i++) {
        particlesArray.push({
            x:  Math.random() * canvas.width,
            y:  Math.random() * canvas.height,
            dx: (Math.random() - 0.5) * 0.7,
            dy: (Math.random() - 0.5) * 0.7,
            s:  Math.random() * 1.4 + 0.4
        });
    }
}

let _pIsLight = false, _pRgb = '0,255,102';

function darkenRgb(rgb, factor) {
    const [r, g, b] = rgb.split(',').map(Number);
    return `${Math.round(r*(1-factor))},${Math.round(g*(1-factor))},${Math.round(b*(1-factor))}`;
}

function updateAndDrawParticles(timeScale, pulse) {
    const m = streak >= 5 ? 2.5 : 1;
    const speedBoost    = 1 + (pulse * 1.2);
    const sizeBoost     = 1 + pulse * 0.8;
    const baseOpacity   = streak >= 5 ? 0.65 : 0.42;
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
    const isStreak   = streak >= 5;
    const baseOpacity = isStreak ? (_pIsLight ? 0.7 : 0.35) : (_pIsLight ? 0.4 : 0.18);
    const distMult   = 1 + pulse * 0.3;
    const screenFactor = Math.min(1, (canvas.width * canvas.height) / (1920 * 1080));
    const maxDistSq  = (canvas.width / 9) * (canvas.height / 9) * distMult * screenFactor;
    const pOp = playerStats.particleOpacity;
    const n   = particlesArray.length;
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
            ctx.moveTo(lines[i], lines[i+1]);
            ctx.lineTo(lines[i+2], lines[i+3]);
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
    _pRgb     = _pIsLight ? darkenRgb(currentRankInfo.rgb, 0.55) : currentRankInfo.rgb;
    const pulse = (audioAnalyser && audioCtx && audioCtx.state === 'running') ? getAudioPulse() : 0;
    updateAndDrawParticles(timeScale, pulse);
    if (streak >= 5 || pulse > 0.05 || (_cpFrame & 1) === 0) connectParticles(pulse);
    _cpFrame++;
}

let _resizeTimer;
window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
        initParticles();
        const _po = document.getElementById('pcard-overlay');
        if (_po && _po.style.display !== 'none') {
            const _pc2 = document.getElementById('pcard-particle-canvas');
            if (_pc2) { _pc2.width = window.innerWidth; _pc2.height = window.innerHeight; }
        }
    }, 150);
});

initParticles();
requestAnimationFrame(animateParticles);

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        then = performance.now();
        _smoothDelta = fpsInterval;
        _unmuteByFocus();
    }
});

// ── PARTÍCULAS DE RULETA (canvas overlay) ────────────────────────────────────
const rlCanvas = document.getElementById('roulette-particle-canvas');
const rlCtx    = rlCanvas ? rlCanvas.getContext('2d', { alpha: true }) : null;
let rlParticles = [];
let rlAnimFrame = null;
let rlThen = 0;
let rlColor = '255,184,0';

function initRlParticles(color) {
    if (!rlCanvas || !rlCtx) return;
    rlCanvas.width  = window.innerWidth;
    rlCanvas.height = window.innerHeight;
    rlColor = color || '255,184,0';
    rlParticles = [];
    const num = Math.min(40, Math.floor(rlCanvas.width * rlCanvas.height / 20000));
    for (let i = 0; i < num; i++) {
        rlParticles.push({
            x:  Math.random() * rlCanvas.width,
            y:  Math.random() * rlCanvas.height,
            dx: (Math.random() - 0.5) * 0.7,
            dy: (Math.random() - 0.5) * 0.7,
            s:  Math.random() * 2 + 1
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
        p.x += p.dx * timeScale;
        p.y += p.dy * timeScale;
        rlCtx.moveTo(p.x + p.s, p.y);
        rlCtx.arc(p.x, p.y, p.s, 0, Math.PI * 2);
    }
    rlCtx.fill();
    const maxDistSq = (W / 10) * (H / 10);
    rlCtx.lineWidth = 0.6;
    const rlBuckets = 5;
    const rlLines   = new Array(rlBuckets).fill(null).map(() => []);
    for (let a = 0; a < rlParticles.length; a++) {
        for (let b = a + 1; b < rlParticles.length; b++) {
            const dx = rlParticles[a].x - rlParticles[b].x;
            const dy = rlParticles[a].y - rlParticles[b].y;
            const dSq = dx * dx + dy * dy;
            if (dSq < maxDistSq) {
                const alpha = (1 - dSq / maxDistSq) * 0.25;
                const bi    = Math.min(rlBuckets - 1, Math.floor(alpha * rlBuckets / 0.25));
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

// Patch showRoulette para iniciar partículas overlay
const _origShowRoulette = showRoulette;
showRoulette = function() {
    _origShowRoulette.apply(this, arguments);
    if (rlCanvas) {
        rlCanvas.width  = window.innerWidth;
        rlCanvas.height = window.innerHeight;
    }
    initRlParticles(currentRankInfo ? currentRankInfo.rgb : '255,184,0');
    if (!rlAnimFrame) {
        rlThen = performance.now();
        rlAnimFrame = requestAnimationFrame(animateRlParticles);
    }
};

// ── RENDERIZAR KLICK PASS PATH ───────────────────────────────────────────────
function renderKpPath() {
    const state = getKpState();
    const container = document.getElementById('kp-path-container');
    if (!container) return;
    const claimedSet = new Set(state.claimed);
    const _canClaim  = (lvNum) => {
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
    let rowIndex = 0;
    KP_LEVELS.forEach((lvl) => {
        const lvNum     = lvl.lv;
        const isClaimed  = claimedSet.has(lvNum);
        const isUnlocked = !isClaimed && _canClaim(lvNum);
        const isFinal    = lvNum === 100;
        const cls        = isClaimed ? 'claimed' : (isUnlocked ? 'unlocked' : '');
        if (tramoStart[lvNum]) {
            const t   = tramoStart[lvNum];
            const sep = document.createElement('div');
            sep.className = 'kp-tramo-sep';
            sep.innerHTML = `<span class="kp-tramo-name">${t.name}</span><span class="kp-tramo-desc">${t.desc}</span>`;
            frag.appendChild(sep);
        }
        const nodeHTML = isClaimed
            ? `<div class="kp-node-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg></div>`
            : `<span class="kp-node-num">${String(lvNum).padStart(2,'0')}</span><span class="kp-node-sub">NV</span>`;
        const node = document.createElement('div');
        node.className = `kp-node ${cls}${isFinal ? ' final-node' : ''}`;
        node.setAttribute('data-kp-level', lvNum);
        node.innerHTML = nodeHTML;
        const statusLbl  = isClaimed ? 'COMPLETADO' : (isUnlocked ? 'DISPONIBLE' : 'BLOQUEADO');
        const levelLabel = isFinal ? 'NIVEL FINAL' : `NV ${String(lvNum).padStart(3,'0')}`;
        const claimBtn   = isUnlocked ? `<button class="kp-claim-btn" onclick="kpClaim(${lvNum})">RECLAMAR</button>` : '';
        const dotHTML    = (isUnlocked && !isClaimed) ? `<span class="kp-status-dot"></span>` : '';
        const card = document.createElement('div');
        card.className = `kp-card ${cls}${isFinal ? ' final-card' : ''}`;
        card.setAttribute('data-kp-card', lvNum);
        card.innerHTML =
            `<div class="kp-card-level">${levelLabel} · ${statusLbl}</div>` +
            `<div class="kp-card-title">${lvl.title}</div>` +
            `<div class="kp-card-mission">${lvl.mission}</div>` +
            `<div class="kp-card-bottom"><span class="kp-reward-pill">${lvl.reward.toLocaleString()} ℙ</span>${dotHTML}${claimBtn}</div>`;
        const spacer = document.createElement('div');
        spacer.className = 'kp-row-spacer';
        const row = document.createElement('div');
        row.className  = 'kp-level-row';
        row.dataset.side = (rowIndex % 2 === 0) ? 'left' : 'right';
        rowIndex++;
        row.appendChild(card);
        row.appendChild(node);
        row.appendChild(spacer);
        frag.appendChild(row);
    });
    container.innerHTML = '';
    container.appendChild(frag);
    // Animación escalonada en primeras 20 filas
    const rows = container.querySelectorAll('.kp-level-row');
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
        const r = rows[i];
        r.style.opacity   = '0';
        r.style.transform = 'translateY(5px)';
        setTimeout(((row) => () => {
            row.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
            row.style.opacity    = '1';
            row.style.transform  = 'translateY(0)';
        })(r), i * 12);
    }
    _kpUpdateHeader();
    setTimeout(() => {
        const target = KP_LEVELS.find(l => !claimedSet.has(l.lv) && _canClaim(l.lv))
                    || KP_LEVELS.find(l => !claimedSet.has(l.lv));
        if (target) {
            const el = container.querySelector(`[data-kp-card="${target.lv}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 280);
}

// ── INICIALIZACIÓN PRINCIPAL ─────────────────────────────────────────────────
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
