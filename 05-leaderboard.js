// ════════════════════════════════════════════════════════════════
//  MÓDULO 05 — CLASIFICACIÓN Y TARJETA DE JUGADOR
//  Contenido: calculatePowerLevel, submit/fetch leaderboard,
//             getRankInfo, openPlayerCard, closePlayerCard,
//             sistema de partículas exclusivo de la tarjeta.
//
//  DEPENDENCIAS: playerStats [03-player-stats.js]
// ════════════════════════════════════════════════════════════════

const GAS_URL = "https://script.google.com/macros/s/AKfycbxbLrjL45NYaQsRaSlZJXHKlQj-1Qh4f-CPxz4KsOMpfMI4jwwYC1UrNpnm_-f6ISeCww/exec";

function calculatePowerLevel(stats) {
    const base    = stats.totalScore * 0.05;
    const best    = stats.bestScore * 1.5;
    const streak  = stats.maxStreak * 200;
    const perf    = stats.perfectGames * 1000;
    const achs    = stats.achievements.length * 300;
    const winRate = stats.gamesPlayed > 0 ? (stats.totalCorrect / (stats.gamesPlayed * 20)) * 5000 : 0;
    return Math.floor(base + best + streak + perf + achs + winRate);
}

let _submitDebounceTimer = null;
async function submitLeaderboard() {
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR" || GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    clearTimeout(_submitDebounceTimer);
    _submitDebounceTimer = setTimeout(async () => {
        const pl = calculatePowerLevel(playerStats);
        playerStats.powerLevel = pl;
        const payload = {
            uuid: playerStats.uuid, name: playerStats.playerName,
            rankTitle: getRankInfo(playerStats).title,
            powerLevel: pl, totalScore: playerStats.totalScore, maxStreak: playerStats.maxStreak
        };
        try {
            await fetch(GAS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) });
            if (window._leaderboardData && Array.isArray(window._leaderboardData)) {
                const myPos = playerStats.rankingPosition || 999;
                window._leaderboardData.forEach((p, idx) => {
                    if (p.uuid !== playerStats.uuid && (p.powerLevel||0) > pl + 1000 && (idx+1) > myPos) {
                        playerStats.surpassedHighPLPlayer = true;
                    }
                });
            }
        } catch(e) {}
    }, 1200);
}

async function fetchLeaderboard() {
    if (GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
    try {
        const res = await fetch(GAS_URL);
        const topPlayers = await res.json();
        const isLight = document.body.classList.contains('light-mode');

        function rankTitleColor(title) {
            switch(title) {
                case 'Mítico':  return isLight ? '#000000' : '#ffffff';
                case 'Leyenda': return isLight ? '#8a6200' : 'var(--accent-yellow)';
                case 'Maestro': return isLight ? '#7a0a8c' : 'var(--accent-purple)';
                case 'Pro':     return isLight ? '#c41940' : 'var(--accent-red)';
                case 'Junior':  return isLight ? '#0070a8' : 'var(--accent-blue)';
                default:        return isLight ? '#0a7a3e' : 'var(--accent-green)';
            }
        }

        window._leaderboardData = topPlayers;

        let html = "";
        topPlayers.forEach((p, index) => {
            const pos = index + 1;
            const isMe = p.uuid === playerStats.uuid;
            if (isMe) {
                const prevPos = playerStats.rankingPosition || 999;
                playerStats.rankingPosition = pos;
                const todayStr = new Date().toISOString().split('T')[0];
                if (pos < prevPos) {
                    if (playerStats._lastRankUpDate !== todayStr) {
                        const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
                        const yesterdayStr = yesterday.toISOString().split('T')[0];
                        if (playerStats._lastRankUpDate === yesterdayStr) {
                            playerStats.consecutiveRankUpDays = (playerStats.consecutiveRankUpDays||0) + 1;
                        } else {
                            playerStats.consecutiveRankUpDays = 1;
                        }
                        playerStats._lastRankUpDate = todayStr;
                    }
                }
                if (prevPos >= 15 && pos <= 5) playerStats.rankRemontada = true;
                saveStatsLocally(); checkAchievements();
            }

            let rankTitle = p.rankTitle;
            const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
            if (pos <= 3 && (p.rankTitle === 'Leyenda' || p.rankTitle === 'Mítico')) rankTitle = podiumTitles[pos];

            const meClass = isMe ? 'is-me' : '';
            html += `<div class="rank-card ${meClass}" onclick="openPlayerCard(${index})" title="Ver perfil">
                <div class="rc-pos">${pos}</div>
                <div class="rc-info">
                    <div class="rc-name">${p.name}</div>
                    <div class="rc-title">${rankTitle}</div>
                </div>
                <div class="rc-score">${p.powerLevel.toLocaleString()} <span>PL</span></div>
            </div>`;
        });
        document.getElementById('ranking-list').innerHTML = html;
        playerStats.successfulLeaderboardLoads = (playerStats.successfulLeaderboardLoads||0) + 1;
        saveStatsLocally();
    } catch(e) {
        if (document.getElementById('ranking-list').innerHTML.includes('ranking-loading')) {
            document.getElementById('ranking-list').innerHTML = `<div class="ranking-loading">Error al conectar con la base de datos. Reintentando...</div>`;
        }
    }
}

setInterval(() => {
    if (document.visibilityState !== 'hidden' && typeof isAnsweringAllowed !== 'undefined' && !isAnsweringAllowed) {
        submitLeaderboard(); fetchLeaderboard();
    }
}, 60000);

// ── getRankInfo ────────────────────────────────────────────────────────────────
function getRankInfo(stats) {
    const totalAnswers = (stats.totalCorrect||0)+(stats.totalWrong||0)+(stats.totalTimeouts||0);
    const accuracy = totalAnswers>0 ? Math.round((stats.totalCorrect||0)/totalAnswers*100) : 0;
    if (stats.totalScore >= 1200000 && stats.totalCorrect >= 5000 && stats.perfectGames >= 50 &&
        (stats.achievements||[]).length >= 200 && stats.maxStreak >= 40 && (stats.maxMult||1) >= 8 &&
        accuracy >= 85 && stats.maxLoginStreak >= 30)
        return { title: "Mítico", color: "#ffffff", rgb: "255,255,255", mitico: true };
    if (stats.totalScore >= 400000 && stats.totalCorrect >= 1500 && stats.perfectGames >= 10) return { title: "Leyenda", color: "var(--accent-yellow)", rgb: "255,184,0" };
    if (stats.totalScore >= 150000 && stats.gamesPlayed >= 50 && (stats.maxMult||1) >= 4)     return { title: "Maestro", color: "var(--accent-purple)", rgb: "181,23,158" };
    if (stats.totalScore >= 60000 && stats.totalCorrect >= 200 && stats.maxStreak >= 12)      return { title: "Pro", color: "var(--accent-red)", rgb: "255,42,95" };
    if (stats.bestScore >= 15000 && stats.gamesPlayed >= 5)                                    return { title: "Junior", color: "var(--accent-blue)", rgb: "0,212,255" };
    return { title: "Novato", color: "var(--accent-green)", rgb: "0,255,102" };
}
let currentRankInfo = getRankInfo(playerStats);

// ── PLAYER CARD ────────────────────────────────────────────────────────────────
function _pcardRankVars(title) {
    const light = document.body.classList.contains('light-mode');
    const map = {
        'Mítico':  { color: light ? '#000000' : '#ffffff', rgb: '255,255,255' },
        'Leyenda': { color: light ? '#8a6200' : '#ffb800', rgb: '255,184,0'   },
        'Maestro': { color: light ? '#7a0a8c' : '#b5179e', rgb: '181,23,158'  },
        'Pro':     { color: light ? '#c41940' : '#ff2a5f', rgb: '255,42,95'   },
        'Junior':  { color: light ? '#0070a8' : '#00d4ff', rgb: '0,212,255'   },
    };
    return map[title] || { color: light ? '#0a7a3e' : '#00ff66', rgb: '0,255,102' };
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

    const maxD2 = (W / 8) * (H / 8);
    c.lineWidth = 0.6;
    const alphaBuckets = {};
    for (let a = 0; a < pts.length; a++) {
        for (let b = a + 1; b < pts.length; b++) {
            const dx = pts[a].x - pts[b].x, dy = pts[a].y - pts[b].y;
            const d2 = dx*dx + dy*dy;
            if (d2 < maxD2) {
                const alpha = Math.round((1 - d2 / maxD2) * 0.22 * 20) / 20;
                const key = alpha.toFixed(2);
                if (!alphaBuckets[key]) alphaBuckets[key] = [];
                alphaBuckets[key].push(a, b);
            }
        }
    }
    for (const key in alphaBuckets) {
        c.strokeStyle = `rgba(${_pc.rgb},${key})`;
        c.beginPath();
        const bucket = alphaBuckets[key];
        for (let i = 0; i < bucket.length; i += 2) {
            const a = bucket[i], b = bucket[i+1];
            c.moveTo(pts[a].x, pts[a].y);
            c.lineTo(pts[b].x, pts[b].y);
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

function openPlayerCard(index) {
    const data = window._leaderboardData;
    if (!data || !data[index]) return;
    const p   = data[index];
    const pos = index + 1;
    const isMe = p.uuid === playerStats.uuid;

    const baseRank = p.rankTitle || 'Novato';
    const { color, rgb } = _pcardRankVars(baseRank);

    let displayTitle = baseRank;
    const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
    if (pos <= 3 && (baseRank === 'Leyenda' || baseRank === 'Mítico')) displayTitle = podiumTitles[pos];

    const overlay = document.getElementById('pcard-overlay');
    overlay.style.setProperty('--pcard-color', color);
    overlay.style.setProperty('--pcard-rgb', rgb);

    const nameEl = document.getElementById('pcard-big-name');
    nameEl.textContent = p.name;
    nameEl.style.color = color;
    nameEl.style.textShadow = `0 0 60px rgba(${rgb},0.45)`;
    const len = p.name.length;
    const fs = len <= 6  ? 'clamp(2.8rem,10vw,5rem)'
              : len <= 9  ? 'clamp(2rem,8vw,4rem)'
              : len <= 12 ? 'clamp(1.5rem,6.5vw,3rem)'
              :              'clamp(1.1rem,5.5vw,2.4rem)';
    nameEl.style.fontSize = fs;
    document.getElementById('pcard-chip-dot').style.cssText = `background:${color}; box-shadow:0 0 6px rgba(${rgb},0.8)`;
    document.getElementById('pcard-chip-title').textContent = displayTitle;

    document.getElementById('pcard-me-pill').classList.toggle('show', isMe);

    const plEl = document.getElementById('pcard-pl');
    plEl.textContent = (p.powerLevel || 0).toLocaleString();
    plEl.style.color = color;

    const posEl = document.getElementById('pcard-pos');
    posEl.textContent = `#${pos}`;
    posEl.style.color = isMe ? color : '';

    document.getElementById('pcard-totalscore').textContent = (p.totalScore || 0).toLocaleString();
    document.getElementById('pcard-streak').textContent     = (p.maxStreak  || 0).toLocaleString();

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

    _pcStart(rgb);
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    if (typeof SFX !== 'undefined') SFX.pcClick();
}

function closePlayerCard() {
    const overlay = document.getElementById('pcard-overlay');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
    _pcStop();
}

function pcardOverlayClick(e) {
    if (e.target === document.getElementById('pcard-overlay')) closePlayerCard();
}
