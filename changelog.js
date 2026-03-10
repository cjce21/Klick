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
        detail: 'Se estrena esta sección donde podrás ver todas las actualizaciones del juego en orden cronológico. La versión actual de Klick solo es visible aquí. Cada cambio está clasificado por tipo: nuevo, mejora, corrección, seguridad o logro retirado.',
    },
    {
        id: 'v100-ranking-profiles',
        type: 'add',
        date: '2026-03-07',
        title: 'Perfiles visibles desde la Clasificación',
        detail: 'Al tocar cualquier jugador en la tabla de clasificación se abre su perfil completo: Nivel de Poder, posición global, puntaje total, racha máxima y los logros que haya decidido destacar.',
    },
    {
        id: 'v100-top50',
        type: 'improve',
        date: '2026-03-07',
        title: 'Clasificación ampliada a Top 50',
        detail: 'La tabla de clasificación global ahora muestra los 50 mejores jugadores. Con más posiciones visibles, más jugadores pueden ver su nombre en el ranking y tener un punto de referencia claro.',
    },
    {
        id: 'v100-pl-skill-focus',
        type: 'improve',
        date: '2026-03-07',
        title: 'Rebalanceo del Nivel de Poder',
        detail: 'El cálculo del Nivel de Poder fue rediseñado para reflejar la habilidad real del jugador. Ahora los factores que más pesan son el récord por partida (×1.5), la racha máxima (×200 por acierto), las partidas perfectas (×1,000) y la eficiencia promedio por partida (hasta 15,000 PL). El puntaje acumulado sigue contando pero tiene un tope de 50,000 PL para que no sea el único factor determinante. Como resultado, algunos jugadores verán un ajuste en su PL: esto es una medición más fiel del desempeño real.',
    },
    {
        id: 'v100-security-zone',
        type: 'add',
        date: '2026-03-07',
        title: 'Zona de Seguridad',
        detail: 'Nueva sección accesible desde el menú principal. Muestra los jugadores que tienen el acceso suspendido o que están siendo monitoreados por el sistema de integridad.',
    },
    {
        id: 'v100-security-shield',
        type: 'security',
        date: '2026-03-07',
        title: 'Sistema Klick Shield — Primera versión',
        detail: 'Se activa el sistema de integridad del juego. Analiza el comportamiento de cada sesión al terminar la partida y determina si hubo conducta contraria a las normas. El proceso ocurre en silencio y de forma automática. Eventos aislados como notificaciones, llamadas o cambios de pantalla no generan consecuencias por sí solos — el sistema pondera múltiples señales antes de actuar. Las infracciones confirmadas muestran una pantalla de aviso con el nivel de sanción y la duración de la suspensión.',
    },
    {
        id: 'v110-ks-8levels',
        type: 'security',
        date: '2026-03-08',
        title: 'Klick Shield — Escala de 8 niveles',
        detail: 'El sistema de sanciones ahora tiene 8 niveles de escalada en lugar de 5. Los niveles van desde un aviso sin suspensión (nivel 1) hasta la revocación de acceso de 72 horas (nivel 8), pasando por suspensiones de 1, 3, 6, 12, 24 y 48 horas. Cada infracción escala al nivel inmediatamente superior al más alto registrado. El tiempo que una infracción permanece activa varía según su gravedad: nivel 1 vence en 3 días, nivel 2 en 5, nivel 3 en 7, nivel 4 en 10, nivel 5 en 13, nivel 6 en 16, nivel 7 en 19 y nivel 8 en 21 días.',
    },
    {
        id: 'v110-ks-penalty',
        type: 'security',
        date: '2026-03-08',
        title: 'Klick Shield — Penalización de Nivel de Poder',
        detail: 'Cada infracción confirmada reduce el Nivel de Poder del jugador. La penalización escala con el nivel de la sanción: desde un 5% en el nivel 1 hasta un 70% en el nivel 8. Esta reducción es permanente y refleja que el PL acumulado en condiciones irregulares no es válido.',
    },
    {
        id: 'v110-ks-local',
        type: 'security',
        date: '2026-03-08',
        title: 'Klick Shield — Funcionamiento local',
        detail: 'El sistema de detección opera completamente en tu dispositivo. Las decisiones de sanción, los contadores de advertencias y el historial de infracciones se gestionan de forma local. El estado se sincroniza con el servidor al iniciar sesión para mantener el registro actualizado. Las suspensiones temporales expiran automáticamente sin necesidad de intervención.',
    },
    {
        id: 'v110-ranking-live',
        type: 'improve',
        date: '2026-03-08',
        title: 'Clasificación en tiempo real',
        detail: 'La tabla de clasificación ahora se actualiza automáticamente cada 30 segundos mientras está visible. Ya no es necesario salir y volver a entrar para ver los cambios de posición o el estado de conexión de otros jugadores.',
    },
    {
        id: 'v100-achievements-revoke',
        type: 'revoke',
        date: '2026-03-08',
        title: 'Logros retirados por umbrales incorrectos',
        detail: 'Se han retirado los logros que fueron obtenidos con requisitos erróneos de versiones anteriores. Los afectados son: "Monarca" (requería 200 logros, ahora 300), "Coleccionista Total" (mismo ajuste), "Dios Klick" (requería 165 logros, ahora 300), y el rango "Mítico" (los requisitos completos del rango ahora se verifican correctamente). En la escala de colección, los umbrales de los logros m9, m10, Primer Escalón, Ascenso y Gran Coleccionista fueron reajustados. También se corrigieron los umbrales de Asiduo, Fiel, Tropiezo, AFK, Imparable, Frenesí Máximo, Veterano, Superviviente y Noche de Logros. Los jugadores que los tenían deben obtenerlos nuevamente cumpliendo los requisitos actuales.',
    },
    // ── 2026-03-08 (continuación) ────────────────────────────────────
    {
        id: 'v120-theme-instant',
        type: 'improve',
        date: '2026-03-08',
        title: 'Cambio de tema claro/oscuro instantáneo',
        detail: 'Cambiar entre Modo Claro y Modo Oscuro desde Configuración ahora es inmediato: el cambio se aplica en el mismo frame sin parpadeo intermedio. El color del rango, los puntos del logo y los gradientes del perfil se recalculan automáticamente al cambiar. Además, la pantalla ya no aparece en blanco en la carga inicial cuando se tiene el Modo Claro activado.',
    },
    {
        id: 'v120-perf-mode',
        type: 'improve',
        date: '2026-03-08',
        title: 'Modo de rendimiento optimizado',
        detail: 'Los modos Alto Rendimiento y Rendimiento Normal fueron mejorados. En Alto Rendimiento: las partículas se mueven a menor velocidad y con opacidad reducida, el pulso de audio no se procesa (menor carga de CPU), y el canvas solo se borra cuando efectivamente se va a dibujar, eliminando el parpadeo que ocurría antes en pantallas inactivas. En modo Normal: las líneas de conexión entre partículas ahora solo aparecen durante una racha activa o cuando hay audio perceptible, en lugar de dibujarse constantemente.',
    },
    {
        id: 'v120-particles-idle-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: partículas parpadeantes en reposo',
        detail: 'Las partículas de fondo mostraban un parpadeo visible cuando la pantalla estaba inactiva (sin racha, sin audio). El bug era que el canvas se limpiaba cada frame pero las partículas y conexiones se dibujaban solo en frames alternos, provocando destellos negros periódicos. Ahora el borrado y el dibujado siempre ocurren en el mismo frame.',
    },
    {
        id: 'v120-security-instant',
        type: 'improve',
        date: '2026-03-08',
        title: 'Zona de Seguridad: carga instantánea',
        detail: 'La Zona de Seguridad ahora se muestra de inmediato al entrar, usando los datos descargados al iniciar sesión. Antes se mostraba un spinner mientras esperaba la respuesta del servidor, lo que causaba un retardo visible cada vez que se accedía. La actualización desde el servidor sigue ocurriendo en segundo plano y refresca la pantalla si hay cambios.',
    },
    {
        id: 'v120-ranking-backbutton',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: botón Atrás desde perfil propio en clasificación',
        detail: 'Al abrir el perfil propio tocando tu entrada en la Clasificación Global y luego pulsar Atrás, el juego redirigía incorrectamente a la pantalla de inicio en lugar de volver a la clasificación. Ahora el botón Atrás devuelve correctamente a la Clasificación Global independientemente de si se accede al perfil propio o al de otro jugador desde allí.',
    },
    {
        id: 'v120-achievements-reorder',
        type: 'improve',
        date: '2026-03-08',
        title: 'Banco de Logros reorganizado',
        detail: 'Los logros del Banco de Logros han sido reordenados en 24 secciones temáticas con una progresión coherente: Bienvenida → Partidas → Días y fidelidad → Puntuación → Supervivencia → Racha y multiplicador → Velocidad → Frenesí → Aciertos → Errores → Ruleta → Klick Pass → Música → Interfaz → Configuración → Nombre → Colección → Clasificación → Rangos → Maestros → Especiales. Los logros de expansión (preguntas extremas, reflejos extremos) aparecen ahora junto a su grupo temático correspondiente.',
    },
    {
        id: 'v120-migration-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: migración de logros contaba IDs huérfanos',
        detail: 'La función de migración de logros contaba todos los IDs guardados en el perfil, incluyendo los de logros que ya no existen en el juego. Esto podía inflar artificialmente el conteo y evitar que se revocaran logros que debían eliminarse. Ahora el conteo filtra únicamente los IDs que existen en el catálogo actual.',
    },
    {
        id: 'v120-infraction-history-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: historial de infracciones invisible en modo claro',
        detail: 'Las entradas de nivel bajo en el historial de infracciones del Klick Shield usaban un color fijo blanco semitransparente, que resultaba invisible sobre el fondo blanco del Modo Claro. Ahora usan la variable de color secundario del tema, adaptándose correctamente a ambos modos.',
    },
    {
        id: 'v120-title-selector-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: selector de títulos invisible en modo claro',
        detail: 'Los botones del selector de títulos exclusivos (disponible para jugadores Mítico y Eterno) usaban colores blancos fijos para texto y bordes, volviéndose invisibles en Modo Claro. Ahora la paleta de colores del selector se adapta automáticamente al tema activo.',
    },
    {
        id: 'v120-title-selector-rankcolor-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: color de rango no se actualizaba al equipar título',
        detail: 'Al equipar un título exclusivo desde el selector, el texto del rango en el perfil se actualizaba correctamente pero su color quedaba con el valor anterior. Ahora el color se recalcula y aplica en el mismo momento en que se equipa el título.',
    },
    {
        id: 'v120-changelog-pills-fix',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: píldoras de tipo cortadas en la Zona de Novedades',
        detail: 'Las etiquetas de tipo en la Zona de Novedades (como "Retiros") se cortaban porque el ancho de la píldora era fijo en 90 px, insuficiente para textos más largos. Ahora las píldoras tienen ancho automático con un mínimo de 80 px y máximo de 120 px, mostrando siempre el texto completo y manteniendo alineación uniforme entre entradas.',
    },
    {
        id: 'v120-title-selector-own-profile',
        type: 'fix',
        date: '2026-03-08',
        title: 'Corrección: selector de títulos aparecía en perfiles ajenos',
        detail: 'El selector de títulos exclusivos (disponible para jugadores Eterno y Mítico) aparecía también al visitar el perfil de otro jugador desde la Clasificación, cuando debería estar restringido únicamente al perfil propio. Ahora el selector solo se muestra cuando estás viendo tu propio perfil.',
    },
    // ── 2026-03-09 ───────────────────────────────────────────────────
    {
        id: 'v130-shield-icon-fix',
        type: 'fix',
        date: '2026-03-09',
        title: 'Corrección: Escudo de la ruleta mostraba código en la barra de recompensa',
        detail: 'Al obtener el Escudo en la ruleta, la barra de recompensa activa mostraba el código fuente SVG en texto plano en lugar del ícono del escudo. El bug era que el contenido del ícono se asignaba con textContent en lugar de innerHTML, impidiendo que el SVG se interpretase como HTML. Ahora el ícono se renderiza correctamente.',
    },
    {
        id: 'v130-no-reveal-answer',
        type: 'improve',
        date: '2026-03-09',
        title: 'La respuesta correcta ya no se revela al fallar o agotar el tiempo',
        detail: 'Al responder incorrectamente o dejar pasar el tiempo, la pantalla de feedback ya no muestra cuál era la respuesta correcta. Esto mantiene la integridad del juego y evita que los jugadores memoricen las respuestas durante la partida.',
    },
    {
        id: 'v130-boost-lost-on-shield',
        type: 'fix',
        date: '2026-03-09',
        title: 'Corrección: el multiplicador de ruleta se conservaba indebidamente tras usar el Escudo',
        detail: 'Si tenías activo un multiplicador de puntos (x2, x3 o x4) de la ruleta y fallabas una pregunta protegida por el Escudo, el multiplicador permanecía activo para la siguiente pregunta como si no hubiera ocurrido nada. Los multiplicadores solo deben aplicarse a preguntas respondidas correctamente, por lo que ahora se consumen al fallar incluso cuando el Escudo absorbe la penalización de vida.',
    },
    {
        id: 'v130-stacked-shields-fix',
        type: 'fix',
        date: '2026-03-09',
        title: 'Corrección: el Escudo de Racha no se consumía si el Escudo de Vida también estaba activo',
        detail: 'Cuando ambos escudos (Escudo de Vida y Escudo de Racha) estaban activos al mismo tiempo y se fallaba una pregunta, el Escudo de Vida se consumía correctamente pero el Escudo de Racha quedaba intacto. Esto permitía que en la siguiente pregunta el Escudo de Racha se activase de nuevo de forma inmerecida. Ahora ambos escudos se consumen en el mismo fallo.',
    },
    // ── 2026-03-10 ───────────────────────────────────────────────────
    {
        id: 'v140-ks-review-warning-split',
        type: 'security',
        date: '2026-03-10',
        title: 'Klick Shield — Revisión y advertencia ahora son estados separados',
        detail: 'Estar "bajo revisión" y recibir una "advertencia formal" son ahora dos cosas distintas. Antes, la primera advertencia del sistema activaba la pantalla de advertencia y sumaba al contador de 3. Ahora, la revisión preventiva (cuando el sistema detecta actividad inusual por primera vez, o cuando se acumulan 3 sesiones leves en 7 días) tiene su propia pantalla informativa sin consecuencias y sin contar como advertencia. Solo los eventos de mayor peso activan una advertencia formal y suman al contador 1/3, 2/3, 3/3. Las revisiones no bloquean el juego ni reducen el Nivel de Poder.',
    },
    {
        id: 'v140-ks-false-positive-reduction',
        type: 'security',
        date: '2026-03-10',
        title: 'Klick Shield — Reducción de falsos positivos',
        detail: 'Se ajustaron varios pesos del sistema de detección para ser menos agresivos en situaciones cotidianas. Las señales de pérdida de foco (blur) ahora solo se registran si ya hay al menos 3 respuestas dadas en la sesión, evitando que notificaciones del sistema al abrir el juego contaminen el análisis. El tiempo mínimo fuera de foco que activa una señal subió de 12 a 20 segundos. El retraso para detectar cambios de ventana rápidos (Alt+Tab) se extendió de 180 ms a 400 ms, filtrando mejor las notificaciones transitorias del sistema operativo.',
    },
    {
        id: 'v140-sw-aggressive-update',
        type: 'improve',
        date: '2026-03-10',
        title: 'Actualizaciones automáticas más rápidas y fiables',
        detail: 'El detector de actualizaciones ahora es significativamente más activo. Durante el primer minuto tras abrir el juego comprueba cada 45 segundos si hay una versión nueva; luego pasa a 90 segundos. Además, cada vez que vuelves a la pestaña después de haberla dejado en segundo plano, el sistema comprueba inmediatamente si hay una actualización pendiente. Un nuevo mecanismo basado en ETag detecta cambios en el servidor aunque el Service Worker no los haya procesado aún, forzando una comprobación adicional. En conjunto, en la mayoría de los casos la actualización ocurrirá sin necesidad de limpiar la caché manualmente.',
    },
    {
        id: 'v140-perf-mode-answer-accent',
        type: 'improve',
        date: '2026-03-10',
        title: 'Modo rendimiento: acento de color en botones de respuesta',
        detail: 'Los botones de respuesta en Modo Rendimiento ahora muestran el acento de color inferior (rojo, azul, amarillo o verde) igual que en el modo normal. Antes, este detalle visual estaba ausente en rendimiento aunque sí aparecía en los otros modos. El único modo que permanece exento es el Máximo, donde el Cristalyx tiene sus propios efectos visuales que lo reemplazan.',
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
    {
        id: 'cs-shop',
        type: 'coming',
        date: null,
        title: 'Tienda de Personalización',
        detail: 'Pronto podrás personalizar tus partículas, elegir entre docenas de formas, colores, efectos animados y comportamientos de movimiento. También podrás equipar un título personalizado que aparece en tu perfil.',
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
        revoke:   { label: 'Retiros', color: '#ff3a3a' },
        coming:   { label: 'Próximo',          color: '#ffb800' },
    };

    const coming   = _versionedLog.filter(function(e) { return e.type === 'coming'; });
    const allDated = _versionedLog.filter(function(e) { return e.type !== 'coming' && e.date; });

    // Agrupar todos los cambios por versión manteniendo orden de aparición
    const versionOrder = [];
    const byVersion = {};
    for (const e of allDated) {
        if (!byVersion[e.version]) { byVersion[e.version] = []; versionOrder.push(e.version); }
        byVersion[e.version].push(e);
    }
    versionOrder.reverse(); // más reciente primero

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

    // ── Historial completo ──────────────────────────────────────────
    html += '<div class="cl-section-header cl-section-history"><span class="cl-section-dot cl-dot-history"></span><span>Historial de actualizaciones</span></div>';

    if (versionOrder.length === 0) {
        html += '<div style="padding:20px 0;text-align:center;font-size:0.72rem;color:var(--text-secondary);">Sin cambios registrados.</div>';
    } else {
        for (const ver of versionOrder) {
            const entries = byVersion[ver].slice().reverse();
            const groupDate = entries[0].date;
            const isToday = groupDate === TODAY;
            html += '<div class="cl-version-group">' +
                '<div class="cl-version-header">' +
                '<span class="cl-version-tag">' + ver + '</span>' +
                '<span class="cl-version-date"' + (isToday ? ' style="color:var(--accent-green,#00e85a)"' : '') + '>' +
                (isToday ? 'Hoy' : groupDate) + '</span>' +
                '</div>';
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
        '.cl-version-date { font-size:0.6rem;font-weight:600;letter-spacing:0.5px;color:var(--text-secondary);margin-left:auto; }',

        '.cl-entry {',
        '    display:flex;gap:12px;align-items:flex-start;',
        '    padding:11px 14px;border-radius:var(--radius-md);',
        '    background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.05);',
        '    margin-bottom:6px;',
        '}',
        '.cl-entry.cl-coming  { background:rgba(255,184,0,0.04);border-color:rgba(255,184,0,0.1); }',
        '.cl-entry.cl-revoke  { background:rgba(255,58,58,0.04);border-color:rgba(255,58,58,0.12); }',

        '.cl-entry-left { flex-shrink:0;padding-top:2px;display:flex;align-items:flex-start; }',
        '.cl-type-badge {',
        '    display:inline-flex;align-items:center;justify-content:center;',
        '    min-width:72px;height:22px;box-sizing:border-box;',
        '    font-size:0.5rem;font-weight:800;letter-spacing:0.8px;',
        '    text-transform:uppercase;border:1px solid;',
        '    border-radius:20px;padding:0 8px;white-space:nowrap;',
        '    flex-shrink:0;text-align:center;',
        '}',
        '.cl-entry-body { flex:1;min-width:0; }',
        '.cl-entry-title { font-size:0.82rem;font-weight:800;color:var(--text-primary);margin-bottom:3px;line-height:1.3; }',
        '.cl-entry-detail { font-size:0.72rem;color:var(--text-secondary);line-height:1.5;font-weight:400; }',
    ].join('\n');
    document.head.appendChild(style);
})();
