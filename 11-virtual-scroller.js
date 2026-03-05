// ════════════════════════════════════════════════════════════════
//  MÓDULO 11 — VIRTUAL SCROLLER DE LOGROS
//  Contenido: renderizado de tarjetas de logros con virtual scroll
//             (solo renderiza las visibles), grid de perfil.
//
//  DEPENDENCIAS: ACHIEVEMENTS_DATA/MAP/INDEX [06],
//                playerStats [03], darkenHex [util]
// ════════════════════════════════════════════════════════════════

const CARD_HEIGHT   = 148;  // px — debe coincidir con el CSS
const CARD_GAP      = 12;
const ROW_PAD_PX    = 15;
const OVERSCAN_ROWS = 4;

let _vsColCount    = 2;
let _vsRowHeight   = CARD_HEIGHT + CARD_GAP;
let _vsRendered    = new Map();
let _vsAchSet      = null;
let _vsPinned      = [];
let _vsDisplayPin  = [];
let _vsScrollEl    = null;
let _vsSpacerEl    = null;
let _vsContentEl   = null;
let _vsInitialized = false;
let _vsScrollRAF   = null;

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

    const isLight = document.body.classList.contains('light-mode');
    const displayColor = isUnlocked ? (isLight ? darkenHex(ach.color, 0.4) : ach.color) : '';
    const bdrColor     = isUnlocked ? (isLight ? 'rgba(0,0,0,0.2)' : ach.color) : '';
    let shadow = '';
    if (!isLight) {
        if (isManualPin)      shadow = `0 0 14px ${ach.color}66`;
        else if (isInProfile) shadow = `0 0 7px ${ach.color}33`;
    }

    let badge = '';
    if (isManualPin)      badge = `<div class="ach-pin-badge ach-pin-manual">${SVG_PIN}</div>`;
    else if (isInProfile) badge = `<div class="ach-pin-badge ach-pin-auto">*</div>`;

    const isHidden  = ach.hidden && !isUnlocked;
    const iconColor = isUnlocked ? (isLight ? darkenHex(ach.color, 0.4) : ach.color) : 'var(--text-secondary)';
    const iconSVG   = isUnlocked ? ach.icon : SVG_LOCK;
    const title     = isHidden ? '???' : ach.title;
    const desc      = isUnlocked ? ach.desc : (isHidden ? 'Logro secreto — descúbrelo tú mismo.' : 'Sigue jugando para descubrirlo.');

    return `<div class="${cls}" style="border-color:${bdrColor};box-shadow:${shadow}" onclick="togglePin('${ach.id}')">` +
        badge +
        `<div class="ach-icon" style="color:${iconColor}">${iconSVG}</div>` +
        `<div class="ach-title">${title}</div>` +
        `<div class="ach-desc">${desc}</div>` +
        `</div>`;
}

function _vsRenderRow(rowIdx) {
    if (_vsRendered.has(rowIdx)) return;
    const cols  = _vsColCount;
    const start = rowIdx * cols;
    const end   = Math.min(start + cols, ACHIEVEMENTS_DATA.length);
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
    _vsScrollRAF = requestAnimationFrame(() => { _vsScrollRAF = null; _vsUpdate(); });
}

function _vsUpdate() {
    if (!_vsScrollEl || !_vsSpacerEl) return;
    const scrollTop  = _vsScrollEl.scrollTop;
    const viewHeight = _vsScrollEl.clientHeight;
    const totalRows  = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount);
    const firstRow   = Math.max(0, Math.floor(scrollTop / _vsRowHeight) - OVERSCAN_ROWS);
    const lastRow    = Math.min(totalRows - 1, Math.ceil((scrollTop + viewHeight) / _vsRowHeight) + OVERSCAN_ROWS);

    for (const [idx] of _vsRendered) { if (idx < firstRow || idx > lastRow) _vsRemoveRow(idx); }
    for (let r = firstRow; r <= lastRow; r++) _vsRenderRow(r);
}

function _vsRefreshRows(changedIds) {
    if (!_vsInitialized || !changedIds || changedIds.length === 0) return;
    const cols = _vsColCount;
    const rowsToRefresh = new Set();
    for (const id of changedIds) {
        const idx = ACHIEVEMENTS_INDEX.has(id) ? ACHIEVEMENTS_INDEX.get(id) : -1;
        if (idx >= 0) rowsToRefresh.add(Math.floor(idx / cols));
    }
    for (const rowIdx of rowsToRefresh) { _vsRemoveRow(rowIdx); _vsRenderRow(rowIdx); }
}

function _vsRefreshAll() {
    if (!_vsScrollEl || !_vsSpacerEl) return;
    if (_vsScrollRAF) { cancelAnimationFrame(_vsScrollRAF); _vsScrollRAF = null; }
    for (const [, el] of _vsRendered) el.remove();
    _vsRendered.clear();
    // Recalculate spacer height in case data or col count changed
    const totalH = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount) * _vsRowHeight;
    _vsSpacerEl.style.height = totalH + 'px';
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
            _vsRefreshAll(); // _vsRefreshAll now handles spacer height internally
        }
    });
    _vsInitialized = true;
}

function renderAchievements() {
    if (!_vsInitialized) _vsSetup();
    if (!_vsScrollEl)    return;

    _vsAchSet    = new Set(playerStats.achievements);
    _vsPinned    = playerStats.pinnedAchievements;
    _vsDisplayPin = getAutoProfileAchs();
    _vsColCount  = _vsGetCols();

    const totalRows = Math.ceil(ACHIEVEMENTS_DATA.length / _vsColCount);
    _vsSpacerEl.style.height = (totalRows * _vsRowHeight) + 'px';
    _vsRefreshAll();

    // Grid de perfil (3 slots)
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
            slot.style.boxShadow   = isLight ? 'none' : `0 0 12px ${ach.color}44`;
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

// Compatibilidad con código existente
let isAchievementsInitialized = true;
const achCardElements = {};
