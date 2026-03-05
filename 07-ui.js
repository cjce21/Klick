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

function goToMainMenu() { SFX.click(); switchScreen('start-screen'); }

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
