// ══════════════════════════════════════════════════════════════════
//  KLICK — Sistema de Novedades y Registro de Cambios
//  Archivo independiente · No afecta la lógica del juego
//  Solo se muestran los cambios del día actual + próximas implementaciones.
// ══════════════════════════════════════════════════════════════════

// ── Registro de cambios ────────────────────────────────────────────
// Tipos:  'fix' | 'add' | 'improve' | 'coming' | 'security' | 'revoke'
// 'revoke' → logros retirados por haber sido obtenidos de forma incorrecta
// El versionado sube: add/security → minor, fix/improve/revoke → patch

const KLICK_CHANGELOG = [
    // ── Versión base (histórica, no se muestra al usuario) ──────────
    { id: 'v010-init',     type: 'add',     date: '2025-01-01', title: 'Lanzamiento Beta', detail: 'Primera versión pública.' },
    { id: 'v010-ranking',  type: 'add',     date: '2025-01-01', title: 'Ranking Global',   detail: 'Tabla de clasificación.' },
    { id: 'v010-ranks',    type: 'add',     date: '2025-01-01', title: 'Sistema de Rangos',detail: 'Seis rangos progresivos.' },
    { id: 'v010-ach',      type: 'add',     date: '2025-01-01', title: 'Banco de Logros',  detail: 'Más de 300 logros.' },
    { id: 'v020-kp',       type: 'add',     date: '2025-01-15', title: 'Klick Pass',       detail: '100 niveles de progreso.' },
    { id: 'v020-rl',       type: 'add',     date: '2025-01-15', title: 'Recompensas',      detail: 'Ruleta de premios.' },
    { id: 'v020-audio',    type: 'add',     date: '2025-01-15', title: 'Audio Dinámico',   detail: 'Tres pistas musicales.' },
    { id: 'v021-ac',       type: 'fix',     date: '2025-02-01', title: 'Anti-Trampas v3',  detail: 'Detección mejorada.' },
    { id: 'v021-sw',       type: 'fix',     date: '2025-02-01', title: 'SW Actualización', detail: 'Corrección Service Worker.' },

    // ── Cambios actuales (se muestran al usuario) ────────────────────
    {
        id: 'v100-changelog-zone',
        type: 'add',
        date: '2026-03-07',
        title: 'Zona de Novedades',
        detail: 'Se estrena esta sección donde podrás consultar todas las actualizaciones, correcciones y nuevas funciones del juego en orden cronológico. La versión actual de Klick solo es visible aquí. Cada cambio indica su tipo: nuevo, mejora, corrección, seguridad o logro retirado.',
    },
    {
        id: 'v100-security-zone',
        type: 'add',
        date: '2026-03-07',
        title: 'Zona de Seguridad',
        detail: 'Nueva sección accesible desde el menú principal (icono de escudo). Muestra en tiempo real los jugadores bajo revisión y los que tienen el acceso suspendido. La información es visible para todos los jugadores sin filtros ni ocultamientos, con transparencia total sobre el estado del sistema.',
    },
    {
        id: 'v100-security-shield',
        type: 'security',
        date: '2026-03-07',
        title: 'Sistema Klick Shield — Revisión y Sanciones',
        detail: 'El sistema de integridad analiza cada sesión en silencio al terminar la partida. Pondera señales de comportamiento, aplica atenuantes automáticos y clasifica el resultado. Un evento aislado como una llamada, notificación o rotación de pantalla nunca genera consecuencias por sí solo. Las infracciones confirmadas activan avisos en pantalla y suspensiones temporales escalonadas en 5 niveles (de 2 h a 48 h). Las cuentas con infracciones repetidas pueden ser suspendidas de forma permanente por el administrador del sistema.',
    },
    {
        id: 'v100-security-ban-screens',
        type: 'security',
        date: '2026-03-07',
        title: 'Pantallas de aviso de seguridad',
        detail: 'Cuando el sistema detecta una infracción, se muestra una pantalla de aviso completa con el nivel de la sanción, la duración de la suspensión y el porcentaje de Nivel de Poder afectado. Si hay un ban activo al intentar jugar, aparece una pantalla con contador regresivo en tiempo real que indica exactamente cuánto falta para que expire. Si una cuenta es suspendida permanentemente por el administrador, se muestra una pantalla específica antes de eliminar los datos locales.',
    },
    {
        id: 'v100-pl-skill-focus',
        type: 'improve',
        date: '2026-03-07',
        title: 'Ajuste del sistema de Nivel de Poder',
        detail: 'El Nivel de Poder (PL) fue rebalanceado para centrarse en la habilidad real del jugador en lugar del tiempo dedicado. Los factores que más pesan ahora son la precisión, la racha máxima y el récord por partida. Como resultado, algunos jugadores verán una reducción en su PL acumulado: esto refleja una medición más fiel de su desempeño actual. La posición en el ranking se recalcula con estos nuevos criterios.',
    },
    {
        id: 'v100-ranking-profiles',
        type: 'add',
        date: '2026-03-07',
        title: 'Perfiles visibles desde la Clasificación',
        detail: 'Al tocar cualquier jugador en la tabla de clasificación se abre su tarjeta de perfil completa: Nivel de Poder, posición global, puntaje total, racha máxima y los logros que haya decidido destacar. Antes solo se mostraba el nombre y el PL en la lista. Ahora puedes conocer mejor a los jugadores con los que compites.',
    },
    {
        id: 'v100-top50',
        type: 'improve',
        date: '2026-03-07',
        title: 'Clasificación ampliada a Top 50',
        detail: 'La tabla de clasificación global ahora muestra los 50 mejores jugadores. Antes el límite era inferior. Con más posiciones visibles, más jugadores pueden ver su nombre en el ranking y tener un punto de referencia claro para seguir mejorando.',
    },
    {
        id: 'v100-pinned-achievements',
        type: 'add',
        date: '2026-03-07',
        title: 'Logros fijados visibles en perfiles',
        detail: 'Los logros que cada jugador elige destacar ahora aparecen correctamente al abrir su perfil desde la clasificación. Se muestran el icono, el nombre y el color del logro fijado. Antes, al ver el perfil de otro jugador, este apartado aparecía vacío o con datos incorrectos.',
    },
    {
        id: 'v100-achievements-revoke',
        type: 'improve',
        date: '2026-03-07',
        title: 'Logros retirados por configuración incorrecta',
        detail: 'Se han retirado de todos los perfiles los logros que fueron obtenidos debido a errores de configuración o bugs en versiones anteriores. Los logros afectados han sido corregidos y sus condiciones ahora funcionan de forma precisa. Los jugadores que los tenían deben obtenerlos nuevamente de forma legítima cumpliendo los requisitos actualizados.',
    },

    // ── Próximas Implementaciones ────────────────────────────────────
    {
        id: 'cs-blitz',
        type: 'coming',
        date: null,
        title: 'Modo Blitz',
        detail: 'Empieza con 60 segundos en el reloj. Cada respuesta correcta suma tiempo extra; los fallos y los timeouts lo reducen. La partida termina cuando el cronómetro llega a cero. Pensado para quienes buscan velocidad, presión y reacción instantánea.',
    },
    {
        id: 'cs-sudden',
        type: 'coming',
        date: null,
        title: 'Modo Muerte Súbita',
        detail: 'Una única vida. El primer error termina la partida sin posibilidad de continuar. Sin red de seguridad, sin multiplicadores de recuperación. Solo para los jugadores que exigen la perfección absoluta en cada respuesta.',
    },
    {
        id: 'cs-select',
        type: 'coming',
        date: null,
        title: 'Modo Selección de Materia',
        detail: 'Antes de iniciar la partida podrás elegir la categoría de preguntas: Lengua Española, Ciencias Sociales, Ciencias Naturales o Matemáticas. Domina tu materia o pon a prueba tus puntos débiles.',
    },
];

// ── Motor de versionado por fecha ─────────────────────────────────
// Todos los cambios de un mismo día comparten la misma versión.
// La versión sube cuando aparece una nueva fecha:
//   - Si ese día tiene al menos un 'add' o 'security' → sube minor, reset patch
//   - Si solo tiene 'fix' / 'improve' / 'revoke'      → sube patch
function _buildVersionLog(entries) {
    let major = 0, minor = 0, patch = 0;
    const result = [];

    // Agrupar fechas en orden (sin coming)
    const dated = entries.filter(e => e.type !== 'coming' && e.date);
    const dates = [...new Set(dated.map(e => e.date))]; // fechas únicas, en orden de aparición

    const versionByDate = {};
    for (const d of dates) {
        const group = dated.filter(e => e.date === d);
        const hasNew = group.some(e => e.type === 'add' || e.type === 'security');
        if (hasNew) { minor++; patch = 0; }
        else { patch++; }
        versionByDate[d] = 'Beta ' + major + '.' + minor + '.' + patch;
    }

    for (const e of entries) {
        if (e.type === 'coming') { result.push({ ...e, version: null }); continue; }
        result.push({ ...e, version: versionByDate[e.date] || 'Beta 0.0.0' });
    }
    return result;
}

const _versionedLog = _buildVersionLog(KLICK_CHANGELOG);

// Version actual = ultimo entry no-coming
const KLICK_VERSION = (function() {
    for (let i = _versionedLog.length - 1; i >= 0; i--) {
        if (_versionedLog[i].version) return _versionedLog[i].version;
    }
    return 'Beta 0.0.0';
})();

// ── Renderizado ────────────────────────────────────────────────────
function renderChangelog() {
    const container = document.getElementById('changelog-list');
    if (!container) return;

    const TODAY = new Date().toISOString().split('T')[0];

    const typeConfig = {
        fix:      { label: 'Corrección',       color: '#ff6b35' },
        add:      { label: 'Nuevo',            color: '#00e85a' },
        improve:  { label: 'Mejora',           color: '#00d4ff' },
        security: { label: 'Seguridad',        color: '#b5179e' },
        revoke:   { label: 'Logros retirados', color: '#ff3a3a' },
        coming:   { label: 'Próximo',          color: '#ffb800' },
    };

    const coming  = _versionedLog.filter(function(e) { return e.type === 'coming'; });
    // Solo los cambios del dia de hoy (no historico)
    const todayEntries = _versionedLog.filter(function(e) { return e.type !== 'coming' && e.date === TODAY; }).reverse();

    let html = '';

    // ── Coming Soon ─────────────────────────────────────────────────
    if (coming.length) {
        html += '<div class="cl-section-header"><span class="cl-section-dot cl-dot-coming"></span><span>Próximas Implementaciones</span></div>';
        for (const e of coming) {
            const cfg = typeConfig.coming;
            html += '<div class="cl-entry cl-coming">' +
                '<div class="cl-entry-left"><div class="cl-type-badge" style="color:' + cfg.color + ';border-color:rgba(255,184,0,0.2);background:rgba(255,184,0,0.06);">' + cfg.label + '</div></div>' +
                '<div class="cl-entry-body"><div class="cl-entry-title">' + e.title + '</div><div class="cl-entry-detail">' + e.detail + '</div></div>' +
                '</div>';
        }
    }

    // ── Cambios de hoy ──────────────────────────────────────────────
    html += '<div class="cl-section-header cl-section-history"><span class="cl-section-dot cl-dot-history"></span><span>Actualizaciones de hoy</span></div>';

    // Si no hay cambios hoy, buscar la última fecha disponible y mostrar esos cambios
    let displayEntries = todayEntries;
    let displayLabel = 'Actualizaciones de hoy';
    if (todayEntries.length === 0) {
        const nonComing = _versionedLog.filter(function(e) { return e.type !== 'coming'; });
        if (nonComing.length > 0) {
            const lastDate = nonComing[nonComing.length - 1].date;
            displayEntries = nonComing.filter(function(e) { return e.date === lastDate; }).reverse();
            displayLabel = 'Última actualización (' + lastDate + ')';
        }
        // Reemplazar encabezado ya escrito
        html = html.replace('>Actualizaciones de hoy<', '>' + displayLabel + '<');
    }

    if (displayEntries.length === 0) {
        html += '<div style="padding:20px 0;text-align:center;font-size:0.72rem;color:var(--text-secondary);">Sin cambios registrados.</div>';
    } else {
        // Agrupar por version
        const byVersion = {};
        for (const e of displayEntries) {
            if (!byVersion[e.version]) byVersion[e.version] = [];
            byVersion[e.version].push(e);
        }
        for (const ver in byVersion) {
            const entries = byVersion[ver];
            html += '<div class="cl-version-group"><div class="cl-version-header"><span class="cl-version-tag">' + ver + '</span></div>';
            for (const e of entries) {
                const cfg = typeConfig[e.type] || typeConfig.add;
                html += '<div class="cl-entry' + (e.type === 'revoke' ? ' cl-revoke' : '') + '">' +
                    '<div class="cl-entry-left"><div class="cl-type-badge" style="color:' + cfg.color + ';border-color:' + cfg.color + '22;background:' + cfg.color + '0d;">' + cfg.label + '</div></div>' +
                    '<div class="cl-entry-body"><div class="cl-entry-title">' + e.title + '</div><div class="cl-entry-detail">' + e.detail + '</div></div>' +
                    '</div>';
            }
            html += '</div>';
        }
    }

    container.innerHTML = html;
}

// ── Estilos propios ────────────────────────────────────────────────
(function injectChangelogStyles() {
    const style = document.createElement('style');
    style.textContent = [
        '#changelog-screen .content-scroll { padding: 0 15px 40px; }',

        '.cl-section-header {',
        '    display: flex; align-items: center; gap: 10px;',
        '    font-size: 0.6rem; font-weight: 800; letter-spacing: 3px;',
        '    text-transform: uppercase; color: var(--text-secondary);',
        '    margin: 20px 0 10px; padding-bottom: 8px;',
        '    border-bottom: 1px solid rgba(255,255,255,0.05);',
        '}',
        '.cl-section-header:first-child { margin-top: 0; }',
        '.cl-section-dot { width:6px;height:6px;border-radius:50%;flex-shrink:0; }',
        '.cl-dot-coming  { background:#ffb800;box-shadow:0 0 8px rgba(255,184,0,0.6); }',
        '.cl-dot-history { background:var(--text-secondary); }',

        '.cl-version-group { margin-bottom: 6px; }',
        '.cl-version-header { display:flex;align-items:center;gap:10px;padding:10px 0 6px; }',
        '.cl-version-tag { font-size:0.65rem;font-weight:900;letter-spacing:1.5px;color:var(--text-primary);text-transform:uppercase; }',

        '.cl-entry {',
        '    display:flex;gap:12px;align-items:flex-start;',
        '    padding:11px 14px;border-radius:var(--radius-md);',
        '    background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);',
        '    margin-bottom:6px;',
        '}',
        '.cl-entry.cl-coming  { background:rgba(255,184,0,0.04);border-color:rgba(255,184,0,0.1); }',
        '.cl-entry.cl-revoke  { background:rgba(255,58,58,0.04);border-color:rgba(255,58,58,0.12); }',

        '.cl-entry-left { flex-shrink:0;padding-top:1px; }',
        '.cl-type-badge {',
        '    display:inline-flex;align-items:center;justify-content:center;',
        '    width:90px;height:22px;box-sizing:border-box;',
        '    font-size:0.52rem;font-weight:800;letter-spacing:1.2px;',
        '    text-transform:uppercase;border:1px solid;',
        '    border-radius:20px;padding:0 6px;white-space:nowrap;overflow:hidden;',
        '    flex-shrink:0;',
        '}',
        '.cl-entry-body { flex:1;min-width:0; }',
        '.cl-entry-title { font-size:0.82rem;font-weight:800;color:var(--text-primary);margin-bottom:3px;line-height:1.3; }',
        '.cl-entry-detail { font-size:0.72rem;color:var(--text-secondary);line-height:1.5;font-weight:400; }',
    ].join('\n');
    document.head.appendChild(style);
})();
