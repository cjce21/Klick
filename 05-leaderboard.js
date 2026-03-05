// ════════════════════════════════════════════════════════════════
//  MÓDULO 05 — CLASIFICACIÓN GLOBAL Y RANGOS
//  Contenido: cálculo de Power Level, submit/fetch leaderboard,
//             función getRankInfo, lógica de rangos.
//
//  DEPENDENCIAS: playerStats [03], showToast [07-ui.js]
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
        try { await fetch(GAS_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(payload) }); } catch(e) {}
    }, 1200);
}

async function fetchLeaderboard() {
    if(GAS_URL === "URL_DE_TU_GOOGLE_APPS_SCRIPT_AQUI") return;
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
            if(isMe) { playerStats.rankingPosition = pos; saveStatsLocally(); checkAchievements(); }

            let rankTitle = p.rankTitle;
            const podiumTitles = { 1: 'Rey Klick', 2: 'Señor Klick', 3: 'Caballero Klick' };
            if (pos <= 3 && rankTitle === 'Leyenda') rankTitle = podiumTitles[pos];

            const posLabel = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
            const rc = rankTitleColor(p.rankTitle);
            html += `<div class="ranking-row${isMe ? ' is-me' : ''}" style="${isMe ? 'background:rgba(var(--rank-rgb),0.08);border-color:rgba(var(--rank-rgb),0.3);' : ''}">
                <span class="rank-pos">${posLabel}</span>
                <span class="rank-name" style="color:${isMe ? 'var(--rank-color)' : ''}">${p.name}</span>
                <span class="rank-title-badge" style="color:${rc};border-color:${rc}40">${rankTitle}</span>
                <span class="rank-pl">${(p.powerLevel||0).toLocaleString()} PL</span>
            </div>`;
        });

        const el = document.getElementById('ranking-list');
        if (el) { el.innerHTML = html || '<p style="text-align:center;color:var(--text-secondary);padding:20px">Sin datos aún</p>'; }
        const loadEl = document.getElementById('ranking-loading');
        if (loadEl) loadEl.style.display = 'none';
    } catch(e) {
        const el = document.getElementById('ranking-loading');
        if (el) el.innerText = 'Error al cargar. Verifica tu conexión.';
    }
}

// ── Rangos del jugador ───────────────────────────────────────────────────────
function getRankInfo(stats) {
    const totalAnswers = (stats.totalCorrect||0)+(stats.totalWrong||0)+(stats.totalTimeouts||0);
    const accuracy = totalAnswers>0 ? Math.round((stats.totalCorrect||0)/totalAnswers*100) : 0;
    if (stats.totalScore >= 1200000 && stats.totalCorrect >= 5000 && stats.perfectGames >= 50 &&
        (stats.achievements||[]).length >= 200 && stats.maxStreak >= 40 && (stats.maxMult||1) >= 8 &&
        accuracy >= 85 && stats.maxLoginStreak >= 30)
        return { title: "Mítico", color: "#ffffff", rgb: "255,255,255", mitico: true };
    if (stats.totalScore >= 400000 && stats.totalCorrect >= 1500 && stats.perfectGames >= 10) return { title: "Leyenda", color: "var(--accent-yellow)", rgb: "255,184,0" };
    if (stats.totalScore >= 150000 && stats.gamesPlayed >= 50 && (stats.maxMult||1) >= 4)     return { title: "Maestro", color: "var(--accent-purple)", rgb: "181,23,158" };
    if (stats.totalScore >= 60000  && stats.totalCorrect >= 200 && stats.maxStreak >= 12)      return { title: "Pro",     color: "var(--accent-red)",    rgb: "255,42,95" };
    if (stats.bestScore  >= 15000  && stats.gamesPlayed >= 5)                                  return { title: "Junior",  color: "var(--accent-blue)",   rgb: "0,212,255" };
    return { title: "Novato", color: "var(--accent-green)", rgb: "0,255,102" };
}

let currentRankInfo = getRankInfo(playerStats);
