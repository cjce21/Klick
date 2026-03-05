// ════════════════════════════════════════════════════════════════
//  MÓDULO 07 — INTERFAZ DE USUARIO
//  Contenido: switchScreen, showToast, openSettings, setTheme,
//             sliders de configuración, navegación entre pantallas,
//             helper trackSectionVisit.
//
//  DEPENDENCIAS: playerStats [03], SFX [04], checkAchievements [06]
// ════════════════════════════════════════════════════════════════

// --- Sistema de pantallas ---
let _currentScreen = null;
function switchScreen(id) {
    if (_currentScreen) _currentScreen.classList.remove('active');
    const next = document.getElementById(id);
    const delay = /iPad|iPhone|iPod/.test(navigator.userAgent) ? 60 : 16;
    setTimeout(() => { if(next) { next.classList.add('active'); _currentScreen = next; } }, delay);
}
_currentScreen = document.querySelector('.screen.active');

// --- Toast notifications ---
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

// --- Configuración ---
const FPS_VALUES = [15, 30, 60, 120, 240];

function openSettings() {
    initAudio(); SFX.click();
    playerStats.configViews = (playerStats.configViews||0) + 1;
    trackSectionVisit('settings');
    saveStatsLocally(); checkAchievements();
    document.getElementById('op-music').value    = playerStats.musicVol;
    document.getElementById('op-sfx').value      = playerStats.sfxVol;
    document.getElementById('op-particles').value = playerStats.particleOpacity;
    document.getElementById('op-fps').value       = FPS_VALUES.indexOf(playerStats.maxFps) >= 0 ? FPS_VALUES.indexOf(playerStats.maxFps) : 2;
    document.getElementById('val-music').innerText    = Math.round(playerStats.musicVol*100)+'%';
    document.getElementById('val-sfx').innerText      = Math.round(playerStats.sfxVol*100)+'%';
    document.getElementById('val-particles').innerText = Math.round(playerStats.particleOpacity*100)+'%';
    document.getElementById('val-fps').innerText      = playerStats.maxFps+' FPS';
    // Tema
    const currentTheme = playerStats.theme || 'dark';
    const valThemeEl = document.getElementById('val-theme');
    if (valThemeEl) valThemeEl.innerText = currentTheme === 'light' ? 'Claro' : 'Oscuro';
    _syncThemeButtons(currentTheme);
    renderTrackSelector();
    switchScreen('settings-screen');
}

function _syncThemeButtons(theme) {
    const _darkBtn  = document.getElementById('theme-dark-btn');
    const _lightBtn = document.getElementById('theme-light-btn');
    if (!_darkBtn || !_lightBtn) return;
    if (theme === 'light') {
        _lightBtn.style.borderColor = 'rgba(0,0,0,0.4)'; _lightBtn.style.background = 'rgba(0,0,0,0.05)'; _lightBtn.firstElementChild.style.color = 'var(--text-primary)';
        _darkBtn.style.borderColor  = 'rgba(0,0,0,0.1)'; _darkBtn.style.background  = 'transparent';      _darkBtn.firstElementChild.style.color  = 'var(--text-secondary)';
    } else {
        _darkBtn.style.borderColor  = 'rgba(255,255,255,0.5)'; _darkBtn.style.background  = 'rgba(255,255,255,0.07)'; _darkBtn.firstElementChild.style.color  = 'var(--text-primary)';
        _lightBtn.style.borderColor = 'rgba(255,255,255,0.1)'; _lightBtn.style.background = 'transparent';             _lightBtn.firstElementChild.style.color = 'var(--text-secondary)';
    }
}

// Sliders de configuración
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
    playerStats.particleOpacity = parseFloat(e.target.value);
    document.getElementById('val-particles').innerText = Math.round(playerStats.particleOpacity*100)+'%';
    if(playerStats.particleOpacity===0) playerStats.particles0=true;
    if(playerStats.particleOpacity>=1.0) { playerStats.particles100=true; }
    if(playerStats.musicVol>=1.0 && playerStats.particleOpacity>=1.0) { playerStats.musicAt100=true; playerStats.particles100=true; }
    _deferredCheckAch(); saveStatsLocally();
});
document.getElementById('op-fps').addEventListener('input', (e) => {
    playerStats.maxFps = FPS_VALUES[parseInt(e.target.value)];
    fpsInterval = 1000/playerStats.maxFps; _smoothDelta = fpsInterval;
    document.getElementById('val-fps').innerText = playerStats.maxFps+' FPS';
    playerStats.fpsChanges = (playerStats.fpsChanges||0)+1;
    checkAchievements(); saveStatsLocally();
});
// iOS Safari fallback: disparar 'input' al soltar el dedo
['op-music','op-sfx','op-particles','op-fps'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => el.dispatchEvent(new Event('input', {bubbles:true})));
});

// --- Tema claro / oscuro ---
function setTheme(theme) {
    const previousTheme = playerStats.theme || 'dark';
    playerStats.theme = theme;
    if (theme === 'light') playerStats.usedLightMode = true;
    if (theme === 'dark' && previousTheme === 'light') playerStats.switchedLightToDark = true;
    saveStatsLocally(); checkAchievements();
    document.body.classList.toggle('light-mode', theme === 'light');
    _syncThemeButtons(theme);
    // Actualiza color de logros si el banco está abierto
    renderAchievements();
}

// --- Navegación entre secciones ---
function trackSectionVisit(section) {
    if (!Array.isArray(playerStats.sectionsVisitedThisSession)) playerStats.sectionsVisitedThisSession = [];
    if (!playerStats.sectionsVisitedThisSession.includes(section)) {
        playerStats.sectionsVisitedThisSession.push(section);
    }
    const ALL_SECTIONS = ['profile', 'achievements', 'ranking', 'settings'];
    if (!playerStats.allSectionsVisited && ALL_SECTIONS.every(s => playerStats.sectionsVisitedThisSession.includes(s))) {
        playerStats.allSectionsVisited = true;
    }
}

function goToAchievements() {
    initAudio(); SFX.click();
    playerStats.achViews++; trackSectionVisit('achievements');
    saveStatsLocally(); checkAchievements(); renderAchievements();
    switchScreen('achievements-screen');
    const sc = document.getElementById('vscroll-container'); if(sc) sc.scrollTop = 0;
}

function goToRanking() {
    initAudio(); SFX.click();
    playerStats.rankingViews = (playerStats.rankingViews||0) + 1;
    trackSectionVisit('ranking');
    saveStatsLocally(); checkAchievements();
    switchScreen('ranking-screen');
}

function goToMainMenu() {
    SFX.click();
    if (playerStats._settingsOpenedAt && (Date.now() - playerStats._settingsOpenedAt) < 3000) {
        playerStats.quickSettingsExit = true;
    }
    playerStats._settingsOpenedAt = null;
    switchScreen('start-screen');
}

function onLogoClick() {
    initAudio(); SFX.pcClick();
    const logo = document.getElementById('logo-title');
    if (logo) { logo.style.transform = 'scale(1.06)'; setTimeout(() => logo.style.transform = '', 180); }
    if (!playerStats.clickedLogo) {
        playerStats.clickedLogo = true;
        saveStatsLocally();
        setTimeout(() => SFX.achievement(), 120);
        checkAchievements();
    }
}

// --- Campo de nombre ---
document.getElementById('profile-name-input').addEventListener('input', e => {
    let val = e.target.value.replace(/[^a-zA-Z0-9ÁÉÍÓÚÑáéíóúñ ]/g, '').toUpperCase();
    val = val.replace(/  +/g, ' ');
    const words = val.split(' ').filter(w => w.length > 0);
    if (words.length > 2) { val = words.slice(0, 2).join(' '); }
    if (words.length >= 2 && val.endsWith(' ')) val = val.trimEnd();
    e.target.value = val;
    document.getElementById('profile-warning').style.opacity = val ? '0' : '1';
});
document.getElementById('profile-name-input').addEventListener('change', e => {
    const n = e.target.value.trim();
    playerStats.playerName = n || "JUGADOR";
    saveStatsLocally(); checkAchievements(); submitLeaderboard();
});
document.getElementById('profile-name-input').addEventListener('keypress', function(e) { if(e.key === 'Enter') this.blur(); });
document.getElementById('profile-name-input').addEventListener('blur', function(e) {
    const n = e.target.value.trim();
    if(n && n !== "JUGADOR" && n !== playerStats.playerName) { playerStats.nameChanges++; }
    playerStats.playerName = n || "JUGADOR";
    saveStatsLocally(); checkAchievements(); submitLeaderboard();
});

let _logoDotsCached = null;
function updateLogoDots() {
    document.documentElement.style.setProperty('--rank-rgb', currentRankInfo.rgb);
    document.documentElement.style.setProperty('--rank-color', currentRankInfo.color);
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

// goToKlickPass is defined in 10-klickpass.js

function goToProfile(needsName = false) {
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    SFX.click();
    playerStats.profileViews = (playerStats.profileViews||0) + 1;
    const gp = playerStats.gamesPlayed || 0;
    if (gp > 0 && gp <= 5 && (playerStats._lastProfileViewAfterGame||0) < gp) {
        playerStats._lastProfileViewAfterGame = gp;
        playerStats.profileViewedAfterGames = (playerStats.profileViewedAfterGames||0) + 1;
    }
    if (playerStats._newBestScoreTime && (Date.now() - playerStats._newBestScoreTime) < 30000) {
        playerStats.viewedProfileAfterRecord = true;
        playerStats._newBestScoreTime = null;
    }
    trackSectionVisit('profile');
    document.getElementById('stat-games').innerText = playerStats.gamesPlayed;
    document.getElementById('stat-score').innerText = playerStats.bestScore.toLocaleString();
    document.getElementById('stat-streak').innerText = playerStats.maxStreak;
    document.getElementById('stat-days').innerText = playerStats.maxLoginStreak;
    document.getElementById('profile-name-input').value = (playerStats.playerName === "JUGADOR") ? "" : playerStats.playerName;
    document.getElementById('profile-warning').style.opacity = needsName ? '1' : '0';
    currentRankInfo = getRankInfo(playerStats);
    updateLogoDots();
    document.getElementById('profile-rank-display').innerText = `Rango: ${currentRankInfo.title}`;
    {
        const isLight = document.body.classList.contains('light-mode');
        document.getElementById('profile-rank-display').style.color = isLight ? darkenHex(currentRankInfo.color, 0.4) : currentRankInfo.color;
    }
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
        const totalAnswers = (s.totalCorrect||0)+(s.totalWrong||0)+(s.totalTimeouts||0);
        const accuracy = totalAnswers>0 ? Math.min(100,Math.round((s.totalCorrect||0)/totalAnswers*100)) : 0;
        const plTotalEl = document.getElementById('pl-total');
        if(plTotalEl){ plTotalEl.innerText=fmt(plTotal); plTotalEl.style.color=currentRankInfo.color; }
        const plHeroEl = document.getElementById('pl-hero-total');
        if(plHeroEl){ plHeroEl.innerText=fmt(plTotal); plHeroEl.style.color=currentRankInfo.color; }
        const panel = document.getElementById('pl-panel');
        if(panel) panel.style.borderColor=`rgba(${currentRankInfo.rgb},0.28)`;
        const posEl=document.getElementById('pl-ranking-pos');
        if(posEl) posEl.innerText=s.rankingPosition&&s.rankingPosition<999?`#${s.rankingPosition}`:'#—';
        const rowsEl=document.getElementById('pl-rows');
        if(!rowsEl) return;
        const clrs=['var(--accent-blue)','var(--accent-yellow)','var(--accent-orange)','var(--accent-green)','var(--accent-purple)','var(--accent-red)'];
        const rows=[
            { label:'Puntaje acum.',      raw:fmt(s.totalScore||0),              factor:'× 0.05',   result:plBase,   color:clrs[0] },
            { label:'Récord',             raw:fmt(s.bestScore||0),               factor:'× 1.5',    result:plBest,   color:clrs[1] },
            { label:'Racha máxima',       raw:`${s.maxStreak||0} aciertos`,      factor:'× 200',    result:plStreak, color:clrs[2] },
            { label:'Partidas perfectas', raw:`${s.perfectGames||0} partidas`,   factor:'× 1,000',  result:plPerf,   color:clrs[3] },
            { label:'Logros',             raw:`${(s.achievements||[]).length} logros`, factor:'× 300', result:plAchs, color:clrs[4] },
            { label:'Precisión',          raw:`${accuracy}%`,                    factor:'× 5,000',  result:plAcc,    color:clrs[5] },
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
        const milestones=[10000,100000,1000000,5000000,10000000];
        let nextMs=milestones.find(m=>m>plTotal)||10000000;
        let prevMs=milestones[milestones.indexOf(nextMs)-1]||0;
        const prog=Math.min(1,(plTotal-prevMs)/Math.max(1,nextMs-prevMs));
        const pctRound=Math.round(prog*100);
        setTimeout(()=>{
            const bar=document.getElementById('pl-bar-total');
            if(bar){ bar.style.width=pctRound+'%'; bar.style.background=currentRankInfo.color; }
        },120);
        const accEl=document.getElementById('pl-accuracy-pct');
        if(accEl) accEl.innerText=`Precisión: ${accuracy}%`;
    })();
    renderAchievements();
    switchScreen('profile-screen');
    if (needsName) setTimeout(() => {
        const inp = document.getElementById('profile-name-input');
        inp.focus(); inp.classList.add('shake');
        setTimeout(() => inp.classList.remove('shake'), 400);
    }, 400);
}
