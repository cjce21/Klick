// ════════════════════════════════════════════════════════════════
//  MÓDULO 06 — LOGROS (DATOS + LÓGICA)
//  Contenido: ACHIEVEMENTS_DATA con los ~283 logros, checkAchievements,
//             togglePin, getAutoProfileAchs, rarity score.
//
//  DEPENDENCIAS: SVGs [02], playerStats [03], SFX [04],
//                getRankInfo [05], showToast [07-ui.js]
// ════════════════════════════════════════════════════════════════

// ── Datos de logros ──────────────────────────────────────────────────────────
const ACHIEVEMENTS_DATA = [];
const colors = {
    blue:   'var(--accent-blue)',   green:  'var(--accent-green)',
    yellow: 'var(--accent-yellow)', orange: 'var(--accent-orange)',
    red:    'var(--accent-red)',    purple: 'var(--accent-purple)',
    dark:   'var(--text-secondary)'
};

const CHEATER_ACHIEVEMENT = { id: 'tramposo', title: 'TRAMPOSO', desc: 'Infringió las normas. Marca imborrable.', color: 'var(--accent-red)', icon: SVG_SKULL };

function addAchs(arr) { arr.forEach(a => ACHIEVEMENTS_DATA.push(a)); }

// ─── 1. BIENVENIDA ───────────────────────────────────────────────────────────
addAchs([
    { id: 'x1',       title: 'Primer Día',         desc: 'Inicia sesión por primera vez.',                               color: colors.blue,   icon: SVG_CLOCK },
    { id: 'm1',       title: 'Bautizado',           desc: 'Configura tu nombre de jugador por primera vez.',             color: colors.blue,   icon: SVG_USER },
    { id: 'ui7',      title: 'Nuevo en el Barrio',  desc: 'Juega tu primera partida con nombre registrado.',             color: colors.green,  icon: SVG_USER },
    { id: 'x3',       title: 'Aprendiz',            desc: 'Completa tu primera partida (sin importar el puntaje).',      color: colors.green,  icon: SVG_TARGET },
    { id: 'x2',       title: 'Paciente',            desc: 'Espera 10 segundos en el menú principal sin hacer nada.',     color: colors.dark,   icon: SVG_CLOCK },
    { id: 'u1',       title: 'Error Inicial',       desc: 'Equivócate al responder por primera vez.',                   color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u3',       title: 'Dormilón',            desc: 'Deja que el reloj llegue a cero en una pregunta.',            color: colors.dark,   icon: SVG_CLOCK },
    { id: 'secret_logo', title: '¡Klick!',          desc: 'Hiciste clic en el nombre del juego en la pantalla principal.', color: colors.yellow, icon: SVG_BOLT, hidden: true },
]);

// ─── 2. PARTIDAS JUGADAS ─────────────────────────────────────────────────────
const ptTiers=[1,5,10,25,50,100,200,500];
for(let i=0;i<8;i++) addAchs([{ id:`p${i+1}`, title:`Jugador ${i+1}`, desc:`Acumula ${ptTiers[i]} partidas jugadas.`, color:colors.blue, icon:SVG_TARGET }]);
const todayTiers=[3,5,8,10,15];
for(let i=0;i<5;i++) addAchs([{ id:`td${i+1}`, title:`Intenso ${i+1}`, desc:`Juega ${todayTiers[i]} partidas en un solo día.`, color:colors.orange, icon:SVG_FIRE }]);
addAchs([
    { id: 'x13', title: 'Noche de Fuego',    desc: 'Juega 10 partidas o más en un único día.',         color: colors.red,    icon: SVG_FIRE },
    { id: 'x20', title: 'Pura Determinación',desc: 'Juega 20 partidas en un mismo día.',               color: colors.red,    icon: SVG_FIRE },
    { id: 'u22', title: 'Maratón',           desc: 'Juega 50 partidas en un solo día.',                color: colors.purple, icon: SVG_HEART },
]);

// ─── 3. DÍAS Y FIDELIDAD ─────────────────────────────────────────────────────
const daysTiers=[1,2,3,5,7,15,21,30,60,90];
const daysTitles=['Hola Mundo','Doble','Triple','Cinco','Semana Activa','Quincena','Tres Semanas','Un Mes','Bimestre','Trimestre Fuego'];
for(let i=0;i<5;i++)  addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Inicia sesión durante ${daysTiers[i]} días consecutivos.`, color:colors.green, icon:SVG_CLOCK }]);
for(let i=5;i<10;i++) addAchs([{ id:`d${i+1}`, title:daysTitles[i], desc:`Juega en ${daysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const totalDaysTiers=[5,10,20,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`td2${i+1}`, title:`Asiduo ${i+1}`, desc:`Juega en ${totalDaysTiers[i]} días distintos en total.`, color:colors.green, icon:SVG_CLOCK }]);
const returnDayTiers=[3,7,15,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`ret${i+1}`, title:`Fiel ${i+1}`, desc:`Regresa a jugar ${returnDayTiers[i]} días diferentes en total.`, color:colors.green, icon:SVG_HEART }]);
addAchs([
    { id: 'x16', title: 'Regreso Triunfal', desc: 'Después de no jugar por un día, supera tu último récord.',    color: colors.yellow, icon: SVG_TROPHY },
    { id: 'x18', title: 'El Clásico',       desc: 'Usa el mismo nombre de jugador por 30 días seguidos.',        color: colors.purple, icon: SVG_USER },
]);

// ─── 4. PUNTUACIÓN ───────────────────────────────────────────────────────────
const bestScoreTiers=[5000,25000,75000,150000,300000,600000,1000000,2000000];
const bestScoreTitles=['Primera Marca','Principiante','Prometedor','Serio','Élite','Extraordinario','El Millón','Leyenda Viva'];
for(let i=0;i<8;i++) addAchs([{ id:`bs${i+1}`, title:bestScoreTitles[i], desc:`Alcanza un puntaje récord de ${bestScoreTiers[i].toLocaleString()} puntos.`, color:colors.yellow, icon:SVG_TROPHY }]);
const ptsTiers=[10000,50000,200000,500000,1000000,2500000,5000000,10000000];
for(let i=0;i<8;i++) addAchs([{ id:`pt${i+1}`, title:`Ahorrador ${i+1}`, desc:`Acumula ${ptsTiers[i].toLocaleString()} puntos totales.`, color:colors.green, icon:SVG_STAR }]);
const hsCountTiers=[1,3,5,10,20,35,50,100];
for(let i=0;i<8;i++) addAchs([{ id:`hs${i+1}`, title:`Récord ${i+1}`, desc:`Supera 100,000 puntos en ${hsCountTiers[i]} partidas distintas.`, color:colors.purple, icon:SVG_FIRE }]);
addAchs([
    { id: 'x7',    title: 'Un Golpe Certero',  desc: 'Consigue más de 3,000 puntos en las primeras 3 preguntas.',   color: colors.yellow, icon: SVG_BOLT },
    { id: 'x12',   title: 'Principiante Letal',desc: 'Consigue 50,000 puntos en tu primera partida del día.',       color: colors.blue,   icon: SVG_STAR },
    { id: 'x4',    title: 'Doble Victoria',    desc: 'Supera 75,000 puntos dos partidas seguidas.',                 color: colors.yellow, icon: SVG_TROPHY },
    { id: 'x6',    title: 'Consistente',       desc: 'Termina 5 partidas seguidas con al menos 25,000 puntos.',     color: colors.blue,   icon: SVG_SHIELD },
    { id: 'x15',   title: 'Punto de Quiebre',  desc: 'Alcanza exactamente 100,000 puntos (±500).',                  color: colors.purple, icon: SVG_TARGET },
    { id: 'extra2',title: 'Precisionista',     desc: 'Termina una partida con 100% de precisión (mín. 5 respuestas).', color: colors.yellow, icon: SVG_TARGET },
]);

// ─── 5. SUPERVIVENCIA ────────────────────────────────────────────────────────
const pfTiers=[10,20,30,50,75,100,150,200];
for(let i=0;i<8;i++) addAchs([{ id:`pf${i+1}`, title:`Resistencia ${i+1}`, desc:`Llega a la pregunta ${pfTiers[i]} en una sola partida.`, color:colors.yellow, icon:SVG_TARGET }]);
addAchs([
    { id: 'x10',   title: 'Economía',         desc: 'Completa 20 preguntas sin perder ninguna vida.',          color: colors.green,  icon: SVG_HEART },
    { id: 'x14',   title: 'Invicto',          desc: 'Llega a la pregunta 30 sin perder una vida.',             color: colors.green,  icon: SVG_SHIELD },
    { id: 'np1',   title: 'Examen de Oro',    desc: 'Logra 10 aciertos seguidos sin perder ninguna vida.',     color: colors.yellow, icon: SVG_SHIELD },
    { id: 'u9',    title: 'Inmortal',         desc: 'Completa 50 preguntas seguidas sin perder ninguna vida.', color: colors.purple, icon: SVG_SHIELD },
    { id: 'np3',   title: 'Sin Límites',      desc: 'Completa una partida de más de 60 preguntas.',            color: colors.purple, icon: SVG_BOLT },
    { id: 'extra3',title: 'Maratonista',      desc: 'Supera las 80 preguntas en una sola partida.',            color: colors.green,  icon: SVG_SHIELD },
    { id: 'u15',   title: 'Superviviente',    desc: 'Llega a 100 preguntas en una sola partida.',              color: colors.green,  icon: SVG_SHIELD },
    { id: 'x11',   title: 'El Último Chance', desc: 'Responde correctamente estando en la última vida.',       color: colors.orange, icon: SVG_SHIELD },
]);

// ─── 6. RACHA Y MULTIPLICADOR ────────────────────────────────────────────────
const strkTiers=[5,10,15,20,25,30,40,50];
for(let i=0;i<8;i++) addAchs([{ id:`sk${i+1}`, title:`Racha ${i+1}`, desc:`Logra una racha de ${strkTiers[i]} aciertos consecutivos.`, color:colors.orange, icon:SVG_FIRE }]);
const multTiers=[2,3,4,5,6,7,8,9,10];
const multTitles=['x2 Conseguido','x3 Poder','x4 Élite','x5 Maestro','x6 Leyenda','x7 Épico','x8 Mítico','x9 Trascendente','x10 Dios'];
for(let i=0;i<9;i++) addAchs([{ id:`mx${i+1}`, title:multTitles[i], desc:`Alcanza el multiplicador x${multTiers[i]} en una partida.`, color:colors.red, icon:SVG_BOLT }]);
addAchs([
    { id: 'u16', title: 'Frenesí Eterno',  desc: 'Mantén una racha de 50 o más aciertos consecutivos.',        color: colors.red,    icon: SVG_FIRE },
    { id: 'u23', title: 'Imparable',       desc: 'Consigue una racha de 30+ sin usar la ruleta ni perder vida.',color: colors.purple, icon: SVG_FIRE },
    { id: 'np4', title: 'La Última Bala',  desc: 'Consigue exactamente 1 acierto antes de perder todas las vidas.', color: colors.dark, icon: SVG_SKULL },
    { id: 'extra1',title: 'Combo Perfecto',desc: 'Mantén x5 o más multiplicador durante al menos 5 preguntas.', color: colors.orange, icon: SVG_FIRE },
]);

// ─── 7. VELOCIDAD ────────────────────────────────────────────────────────────
addAchs([
    { id: 'u5',  title: 'Por los Pelos',    desc: 'Acierta una pregunta con exactamente 1 segundo restante.',    color: colors.red,    icon: SVG_CLOCK },
    { id: 'u14', title: 'Calculador',       desc: 'Acierta una pregunta con 2 o 3 segundos restantes.',         color: colors.blue,   icon: SVG_CLOCK },
    { id: 'x9',  title: 'Todo Gas',         desc: 'Responde las primeras 10 preguntas en menos de 3 segundos cada una.', color: colors.red, icon: SVG_BOLT },
    { id: 'u21', title: 'Metralleta',       desc: 'Responde 10 preguntas seguidas en menos de 3 segundos.',     color: colors.red,    icon: SVG_BOLT },
    { id: 'u24', title: 'Extremis',         desc: 'Responde 3 preguntas en 1 segundo o menos en una partida.',  color: colors.red,    icon: SVG_SHIELD },
    { id: 'x19', title: 'Espectacular',     desc: 'Responde 5 preguntas en menos de 1 segundo en una partida.', color: colors.yellow, icon: SVG_BOLT },
]);
const fastTiers=[5,15,30,60,100];
for(let i=0;i<5;i++) addAchs([{ id:`sp${i+1}`, title:`Reflejos ${i+1}`, desc:`Responde correctamente en los primeros 2s en ${fastTiers[i]} ocasiones.`, color:colors.blue, icon:SVG_BOLT }]);
const noTOTiers=[5,15,30,50,75];
for(let i=0;i<5;i++) addAchs([{ id:`nt${i+1}`, title:`Sin Timeout ${i+1}`, desc:`Completa ${noTOTiers[i]} preguntas seguidas sin dejar que el tiempo expire.`, color:colors.green, icon:SVG_CLOCK }]);

// ─── 8. FRENESÍ ──────────────────────────────────────────────────────────────
const frenTiers=[1,5,10,25,50];
for(let i=0;i<5;i++) addAchs([{ id:`r${i+1}`, title:`Frenesí ${i+1}`, desc:`Activa el Frenesí ${frenTiers[i]} veces en total.`, color:colors.orange, icon:SVG_FIRE }]);
addAchs([
    { id: 'fin3',   title: 'Momento Épico',   desc: 'Activa el Frenesí 4 veces en una misma partida.',            color: colors.red,    icon: SVG_FIRE },
    { id: 'u_bisturi',title:'Bisturí',        desc: 'Mantén 90%+ de precisión con al menos 500 respuestas totales.', color: colors.orange, icon: SVG_FIRE, hidden: true },
]);

// ─── 9. ACIERTOS ACUMULADOS ──────────────────────────────────────────────────
const corrTiers=[10,50,100,250,500,1000,2500,5000];
for(let i=0;i<8;i++) addAchs([{ id:`ac${i+1}`, title:`Aciertos ${i+1}`, desc:`Acumula ${corrTiers[i].toLocaleString()} respuestas correctas en tu carrera.`, color:colors.green, icon:SVG_CORRECT }]);
addAchs([
    { id: 'x8',   title: 'Perfeccionista',desc: 'Termina una partida con todas las vidas intactas.',            color: colors.yellow, icon: SVG_HEART },
    { id: 'x5',   title: 'La Revancha',   desc: 'Después de una partida con 0 aciertos, consigue más de 10.',  color: colors.orange, icon: SVG_FIRE },
    { id: 'u11',  title: 'Fénix',         desc: 'Pierde 2 vidas al inicio pero llega a 30 aciertos consecutivos.', color: colors.orange, icon: SVG_FIRE },
    { id: 'u19',  title: 'Resurrección',  desc: 'Pierde 2 vidas seguidas y encadena 10 aciertos consecutivos.', color: colors.yellow, icon: SVG_HEART },
]);
// Additional frenzy milestone achievements (r6-r8)
const frenTiers2=[100,200,500];
for(let i=0;i<3;i++) addAchs([{ id:`r${i+6}`, title:`Frenesí ${i+6}`, desc:`Activa el Frenesí ${frenTiers2[i]} veces en total.`, color:colors.red, icon:SVG_FIRE }]);

// ─── 10. ERRORES E IRONÍA ────────────────────────────────────────────────────
const wrnTiers=[10,50,100,250,500];
for(let i=0;i<5;i++) addAchs([{ id:`wr${i+1}`, title:`Torpeza ${i+1}`, desc:`Acumula ${wrnTiers[i]} respuestas incorrectas en tu carrera.`, color:colors.dark, icon:SVG_INCORRECT }]);
const toTiers=[5,20,50,100,250];
for(let i=0;i<5;i++) addAchs([{ id:`to${i+1}`, title:`Ausente ${i+1}`, desc:`Deja el reloj llegar a cero ${toTiers[i]} veces.`, color:colors.dark, icon:SVG_CLOCK }]);
addAchs([
    { id: 'u2',  title: 'Tropiezo',    desc: 'Acumula 100 respuestas incorrectas en tu carrera.',              color: colors.dark,   icon: SVG_INCORRECT },
    { id: 'u4',  title: 'AFK',         desc: 'Deja que el reloj llegue a cero 50 veces en total.',             color: colors.dark,   icon: SVG_CLOCK },
    { id: 'u10', title: 'Desastre',    desc: 'Pierde las 3 vidas en las primeras 3 preguntas.',                color: colors.dark,   icon: SVG_SKULL },
    { id: 'u18', title: 'Suicida',     desc: 'Pierde las 3 vidas en menos de 30 segundos de partida.',         color: colors.dark,   icon: SVG_SKULL },
    { id: 'u12', title: 'Tragedia',    desc: 'Pierde la última vida durante una racha de 20 o más.',           color: colors.dark,   icon: SVG_INCORRECT },
]);

// ─── 11. RULETA DE RECOMPENSAS ───────────────────────────────────────────────
const SVG_WHEEL = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/></svg>`;
addAchs([
    { id: 'rl1',  title: 'Primera Ruleta',     desc: 'Gira la ruleta de recompensas por primera vez.',               color: colors.yellow, icon: SVG_WHEEL },
    { id: 'rl6',  title: 'Rodillo de Suerte',  desc: 'Gira la ruleta 10 veces en total.',                           color: colors.blue,   icon: SVG_WHEEL },
    { id: 'rl7',  title: 'Rulero Empedernido', desc: 'Gira la ruleta 50 veces en total.',                           color: colors.purple, icon: SVG_WHEEL },
    { id: 'rl2',  title: 'Afortunado',         desc: 'Obtén una Vida Extra en la ruleta.',                          color: colors.red,    icon: SVG_HEART },
    { id: 'rl8',  title: 'Gran Premio',        desc: 'Consigue la Vida Extra 3 veces en distintas partidas.',       color: colors.red,    icon: SVG_HEART },
    { id: 'rl3',  title: 'Escudo Dorado',      desc: 'Obtén el Escudo en la ruleta.',                               color: colors.yellow, icon: SVG_SHIELD },
    { id: 'rl9',  title: 'Invulnerable',       desc: 'Activa el Escudo y supera la pregunta sin perder vida.',      color: colors.yellow, icon: SVG_SHIELD },
    { id: 'rl4',  title: 'Potenciado',         desc: 'Obtén cualquier multiplicador de puntos en la ruleta.',       color: colors.orange, icon: SVG_STAR },
    { id: 'rl5',  title: 'Frenesí Regalado',   desc: 'Activa el Frenesí mediante la ruleta.',                       color: colors.purple, icon: SVG_FIRE },
    { id: 'rl10', title: 'Combo Especial',     desc: 'Consigue cualquier premio de ruleta durante una racha de 20+.', color: colors.orange, icon: SVG_BOLT },
]);

// ─── 12. KLICK PASS ──────────────────────────────────────────────────────────
addAchs([
    { id: 'kpa1', title: 'Primer Paso',         desc: 'Reclama tu primer nivel del Klick Pass.',                    color: colors.green,  icon: SVG_TARGET },
    { id: 'kpa6', title: 'Explorador del Pase', desc: 'Abre el Klick Pass por primera vez.',                        color: colors.green,  icon: SVG_TARGET },
    { id: 'kpa2', title: 'En Camino',           desc: 'Completa 25 niveles del Klick Pass.',                        color: colors.blue,   icon: SVG_TARGET },
    { id: 'kpa7', title: 'Constante',           desc: 'Reclama al menos un nivel del Klick Pass en 3 días distintos.', color: colors.blue, icon: SVG_TARGET },
    { id: 'kpa3', title: 'A Mitad de Ruta',     desc: 'Completa 50 niveles del Klick Pass.',                        color: colors.yellow, icon: SVG_TARGET },
    { id: 'kpa8', title: 'Dedicado',            desc: 'Reclama al menos un nivel del Klick Pass en 7 días distintos.', color: colors.yellow, icon: SVG_STAR },
    { id: 'kpa4', title: 'Casi en la Cima',     desc: 'Completa 75 niveles del Klick Pass.',                        color: colors.orange, icon: SVG_STAR },
    { id: 'kpa9', title: 'Sin Pausas',          desc: 'Completa 10 niveles del Klick Pass en una sola sesión.',     color: colors.orange, icon: SVG_BOLT },
    { id: 'kpa5', title: 'Pase Completado',     desc: 'Reclama los 100 niveles del Klick Pass en su totalidad.',   color: colors.red,    icon: SVG_STAR },
    { id: 'kpa10',title: 'Coleccionista Total', desc: 'Completa el Klick Pass y desbloquea más de 200 logros.',    color: colors.red,    icon: SVG_TROPHY },
]);

// ─── 13. MÚSICA Y AUDIO ──────────────────────────────────────────────────────
addAchs([
    { id: 'trk1',   title: 'Explorador Musical', desc: 'Cambia de pista musical al menos una vez desde Configuración.', color: colors.green, icon: SVG_STAR },
    { id: 'trk2',   title: 'DJ Klick',           desc: 'Prueba las 3 pistas musicales disponibles.',                   color: colors.blue,  icon: SVG_STAR },
    { id: 'trk3',   title: 'Fiel al Ritmo',      desc: 'Juega 10 partidas con la misma pista sin cambiarla.',          color: colors.purple,icon: SVG_FIRE },
    { id: 'extra4', title: 'Silencioso',          desc: 'Juega 5 partidas con la música completamente apagada.',       color: colors.dark,  icon: SVG_CLOCK },
]);

// ─── 14. INTERFAZ Y EXPLORACIÓN ──────────────────────────────────────────────
addAchs([
    { id: 'm4', title: 'Curioso',      desc: 'Abre el Banco de Logros por primera vez.',      color: colors.orange, icon: SVG_TROPHY },
    { id: 'm5', title: 'Investigador', desc: 'Visita el Banco de Logros 10 veces.',            color: colors.blue,   icon: SVG_TROPHY },
    { id: 'm6', title: 'Obsesivo',     desc: 'Visita el Banco de Logros 50 veces.',            color: colors.purple, icon: SVG_TROPHY },
]);
const profileVisTiers=[1,5,15,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`pv${i+1}`, title:`Egocéntrico ${i+1}`, desc:`Visita tu perfil ${profileVisTiers[i]} veces.`, color:colors.purple, icon:SVG_USER }]);
const rankVisTiers=[1,5,15,30,60];
for(let i=0;i<5;i++) addAchs([{ id:`rv${i+1}`, title:`Espía de Clasificación ${i+1}`, desc:`Visita la Clasificación Global ${rankVisTiers[i]} veces.`, color:colors.blue, icon:SVG_TROPHY }]);
addAchs([
    { id: 'ui1', title: 'Explorador',           desc: 'Visita todas las secciones del menú en una misma sesión.',      color: colors.blue,   icon: SVG_TARGET },
    { id: 'ui10',title: 'El Circuito',          desc: 'Navega por las 4 secciones del juego en orden secuencial.',     color: colors.purple, icon: SVG_FIRE },
    { id: 'ui2', title: 'Vuelvo en Un Segundo', desc: 'Entra y sal del menú de Configuración en menos de 3 segundos.', color: colors.yellow, icon: SVG_BOLT },
    { id: 'ui5', title: 'El Perfil Importa',    desc: 'Visita tu perfil después de cada una de tus primeras 5 partidas.', color: colors.blue, icon: SVG_USER },
    { id: 'ui6', title: 'Fan de Clasificación', desc: 'Visita la Clasificación mientras hay menos de 5 jugadores.',    color: colors.dark,   icon: SVG_TROPHY },
    { id: 'ui8', title: 'Bien Conectado',       desc: 'La clasificación global carga sin errores 10 veces.',           color: colors.blue,   icon: SVG_TARGET },
    { id: 'ui9', title: 'Puntaje en Mente',     desc: 'Revisa tu perfil inmediatamente después de un puntaje récord.', color: colors.yellow, icon: SVG_STAR },
]);

// ─── 15. CONFIGURACIÓN ───────────────────────────────────────────────────────
const cfgVisTiers=[1,5,15,30];
for(let i=0;i<4;i++) addAchs([{ id:`cv${i+1}`, title:`Ajustador ${i+1}`, desc:`Abre el menú de Configuración ${cfgVisTiers[i]} veces.`, color:colors.purple, icon:SVG_USER }]);
addAchs([
    { id: 'cfg1',  title: 'Silencio Total',  desc: 'Pon la música en 0% desde Configuración.',                        color: colors.dark,   icon: SVG_CLOCK },
    { id: 'cfg2',  title: 'Oídos Abiertos',  desc: 'Sube la música al 100% desde Configuración.',                    color: colors.green,  icon: SVG_STAR },
    { id: 'cfg3',  title: 'Sordomudo',        desc: 'Pon tanto la música como el SFX en 0%.',                         color: colors.dark,   icon: SVG_SKULL },
    { id: 'cfg7',  title: 'Fantasma',         desc: 'Pon las partículas en 0%.',                                      color: colors.dark,   icon: SVG_SKULL },
    { id: 'cfg8',  title: 'Purpurina',        desc: 'Pon las partículas en 100% y la música en 100% al mismo tiempo.',color: colors.purple, icon: SVG_STAR },
    { id: 'cfg4',  title: 'Ajuste Fino',      desc: 'Cambia el valor de FPS al menos 5 veces.',                      color: colors.purple, icon: SVG_BOLT },
    { id: 'cfg6',  title: 'Ahorro de Batería',desc: 'Activa 15 FPS en Configuración.',                               color: colors.dark,   icon: SVG_CLOCK },
    { id: 'cfg5',  title: 'Velocista',        desc: 'Activa 240 FPS en Configuración.',                              color: colors.red,    icon: SVG_FIRE },
    { id: 'cfg9',  title: 'Luz del Día',      desc: 'Activa el Modo Claro desde Configuración.',                     color: colors.yellow, icon: SVG_BOLT },
    { id: 'cfg10', title: 'Vuelta a Casa',    desc: 'Cambia del Modo Claro al Oscuro después de haberlo activado.',   color: colors.dark,   icon: SVG_MOON },
]);

// ─── 16. NOMBRE ──────────────────────────────────────────────────────────────
addAchs([
    { id: 'm2', title: 'Agente Secreto', desc: 'Cambia tu nombre de jugador 5 veces.',  color: colors.purple, icon: SVG_USER },
    { id: 'm3', title: 'Identidad Falsa',desc: 'Cambia tu nombre de jugador 20 veces.', color: colors.red,    icon: SVG_USER },
]);

// ─── 17. LOGROS META Y COLECCIÓN ─────────────────────────────────────────────
addAchs([
    { id: 'm8',  title: 'Coleccionista', desc: 'Desbloquea 10 logros en total.',                                     color: colors.green,  icon: SVG_STAR },
    { id: 'm9',  title: 'Completista',   desc: 'Alcanza el hito de 50 logros desbloqueados.',                        color: colors.orange, icon: SVG_STAR },
    { id: 'm10', title: 'Centenario',    desc: 'Consigue 100 logros desbloqueados.',                                  color: colors.red,    icon: SVG_STAR },
    { id: 'm7',  title: 'Diseñador',     desc: 'Fija tu primer logro en el perfil.',                                  color: colors.yellow, icon: SVG_STAR },
    { id: 'np2', title: 'Presumido',     desc: 'Fija 3 logros de color Rojo, Naranja o Dorado en tu perfil.',        color: colors.red,    icon: SVG_STAR },
]);
const pinTiers=[1,5,10,20,50];
for(let i=0;i<5;i++) addAchs([{ id:`pin${i+1}`, title:`Curador ${i+1}`, desc:`Fija logros en el perfil ${pinTiers[i]} veces en total.`, color:colors.blue, icon:SVG_PIN }]);
const dailyAchTiers=[1,3,5,8,12];
for(let i=0;i<5;i++) addAchs([{ id:`da${i+1}`, title:`Productivo ${i+1}`, desc:`Desbloquea ${dailyAchTiers[i]} logros nuevos en un mismo día.`, color:colors.purple, icon:SVG_STAR }]);
addAchs([{ id: 'extra5', title: 'Día Épico', desc: 'Desbloquea 10 logros en un mismo día.', color: colors.purple, icon: SVG_STAR }]);

// ─── 18. CLASIFICACIÓN GLOBAL Y PODER ────────────────────────────────────────
addAchs([
    { id: 'nm1',  title: 'Primera Sangre',  desc: 'Aparece por primera vez en la Clasificación Global.',            color: colors.red,    icon: SVG_TROPHY },
    { id: 'nm8',  title: 'PL 10,000',       desc: 'Alcanza 10,000 Puntos de Poder (Nivel inicial).',               color: colors.green,  icon: SVG_STAR },
    { id: 'nm2',  title: 'Top 10',          desc: 'Entra en el Top 10 de la Clasificación.',                        color: colors.orange, icon: SVG_TROPHY },
    { id: 'nm9',  title: 'PL 100,000',      desc: 'Alcanza 100,000 Puntos de Poder.',                               color: colors.blue,   icon: SVG_STAR },
    { id: 'nm5',  title: 'Vigilia',         desc: 'Sube en la Clasificación en 3 días consecutivos.',               color: colors.blue,   icon: SVG_CLOCK },
    { id: 'nm6',  title: 'Impostado',       desc: 'Supera a otro jugador que tenía más de 1,000 PL que tú.',        color: colors.purple, icon: SVG_BOLT },
    { id: 'nm7',  title: 'Remontada',       desc: 'Estabas en puesto 15+ y ascendiste al Top 5 en una partida.',    color: colors.orange, icon: SVG_FIRE },
    { id: 'nm3',  title: 'Podio',           desc: 'Entra en el Top 3 de la Clasificación.',                         color: colors.yellow, icon: SVG_TROPHY },
    { id: 'nm4',  title: 'El Primero',      desc: 'Llega al primer lugar de la Clasificación.',                     color: colors.yellow, icon: SVG_STAR },
    { id: 'nm10', title: 'PL 1,000,000',    desc: 'Alcanza 1,000,000 de Puntos de Poder. Meta del Top Mundial.',    color: colors.yellow, icon: SVG_STAR },
    { id: 'pod1', title: 'Rey Klick',       desc: 'Eres Leyenda y ocupas el 1.er lugar de la clasificación.',       color: '#6e8fad',     icon: SVG_TROPHY },
    { id: 'pod2', title: 'Señor Klick',     desc: 'Eres Leyenda y ocupas el 2.º lugar de la clasificación.',        color: '#ff5e00',     icon: SVG_TROPHY },
    { id: 'pod3', title: 'Caballero Klick', desc: 'Eres Leyenda y ocupas el 3.er lugar de la clasificación.',       color: '#ccff00',     icon: SVG_TROPHY },
]);

// ─── 19. RANGOS ──────────────────────────────────────────────────────────────
addAchs([
    { id: 'u_junior', title: 'Junior',   desc: 'Alcanza el rango Junior.',                                          color: colors.blue,   icon: SVG_TROPHY },
    { id: 'u6',       title: 'Pro',      desc: 'Alcanza el rango Pro.',                                              color: colors.red,    icon: SVG_TROPHY },
    { id: 'u7',       title: 'Maestro',  desc: 'Alcanza el rango Maestro.',                                          color: colors.purple, icon: SVG_TROPHY },
    { id: 'u8',       title: 'Leyenda',  desc: 'Alcanza el codiciado rango Leyenda.',                               color: colors.yellow, icon: SVG_TROPHY },
    { id: 'u_mitico', title: 'Mítico',   desc: 'Alcanza el rango Mítico. El más difícil de conseguir.',             color: '#ffffff',     icon: SVG_STAR },
    { id: 'fin4',     title: 'El Pacto', desc: 'Juega durante 7 días seguidos y alcanza el rango Junior.',          color: colors.green,  icon: SVG_SHIELD },
    { id: 'x17',      title: 'Veterano', desc: 'Acumula más de 100 partidas jugadas.',                              color: colors.blue,   icon: SVG_TROPHY },
]);

// ─── 20. ÚNICOS DE HORARIO Y SITUACIÓN ───────────────────────────────────────
addAchs([
    { id: 'fin1', title: 'Nocturno',   desc: 'Juega una partida después de las 11:00 PM.',                          color: colors.dark,   icon: SVG_CLOCK },
    { id: 'fin2', title: 'Madrugador', desc: 'Juega una partida antes de las 6:00 AM.',                            color: colors.blue,   icon: SVG_CLOCK },
    { id: 'fin5', title: 'Monarca',    desc: 'Alcanza simultáneamente el rango Leyenda y 200 logros.',              color: colors.yellow, icon: SVG_TROPHY },
]);

// ─── 21. MAESTROS DE COLECCIÓN ───────────────────────────────────────────────
addAchs([
    { id: 'master1', title: 'Casi Dios',     desc: 'Desbloquea 150 logros en total.',                              color: colors.yellow, icon: SVG_STAR },
    { id: 'master2', title: 'Semidivino',    desc: 'Desbloquea 200 logros en total.',                              color: colors.orange, icon: SVG_STAR },
    { id: 'master4', title: 'Leyenda Total', desc: 'Desbloquea 250 logros en total.',                              color: colors.purple, icon: SVG_STAR },
    { id: 'master5', title: 'A las Puertas', desc: 'Desbloquea 275 logros en total. El límite está a la vista.',   color: colors.yellow, icon: SVG_STAR },
    { id: 'master3', title: 'Dios Klick',    desc: 'Desbloquea todos los logros del juego. Eres absoluto.',        color: colors.red,    icon: SVG_STAR },
]);

// ── Índices O(1) ──────────────────────────────────────────────────────────────
const ACHIEVEMENTS_MAP   = new Map(ACHIEVEMENTS_DATA.map(a => [a.id, a]));
const ACHIEVEMENTS_INDEX = new Map(ACHIEVEMENTS_DATA.map((a, i) => [a.id, i]));

// ── Rarity score (para auto-completar el perfil con los más raros) ────────────
const RARITY_SCORE = {master3:100,master5:98,master4:96,master2:91,master1:86,fin5:83,u8:81,u7:79,u15:76,nm4:74,nm3:71,nm10:69,u9:66,u23:63,u11:61,u16:59,nm9:56,u19:53,u24:51,np1:49,np3:47,u21:44,u_bisturi:42};
function getAchRarity(id) { return RARITY_SCORE[id] || 10; }

function getAutoProfileAchs() {
    const result = [];
    if (playerStats.achievements.includes('tramposo')) result.push('tramposo');
    playerStats.pinnedAchievements.filter(id => id !== 'tramposo')
        .forEach(id => { if (result.length < 3 && playerStats.achievements.includes(id)) result.push(id); });
    if (result.length < 3) {
        const rest = playerStats.achievements
            .filter(id => id !== 'tramposo' && !result.includes(id))
            .sort((a,b) => getAchRarity(b) - getAchRarity(a));
        rest.forEach(id => { if (result.length < 3) result.push(id); });
    }
    return result;
}

// ── togglePin ─────────────────────────────────────────────────────────────────
function togglePin(achId) {
    if (achId === 'tramposo') {
        showToast('Condena Permanente', 'Los tramposos no pueden ocultar sus actos.', 'var(--accent-red)', SVG_SKULL);
        return;
    }
    if (!playerStats.achievements.includes(achId)) return;
    SFX.click();
    const index = playerStats.pinnedAchievements.indexOf(achId);
    if (index > -1) {
        playerStats.pinnedAchievements.splice(index, 1);
        showToast('Quitado del perfil', 'Ya no aparecerá destacado.', 'var(--text-secondary)', SVG_PIN);
    } else {
        if (playerStats.pinnedAchievements.length >= 3) {
            showToast('Límite', 'Máximo 3 fijados', 'var(--accent-red)', SVG_INCORRECT); return;
        }
        playerStats.pinnedAchievements.push(achId);
        playerStats.totalPins = (playerStats.totalPins||0) + 1;
        const ach_data = ACHIEVEMENTS_MAP.get(achId);
        showToast('Fijado en Perfil', ach_data ? ach_data.title : achId, ach_data ? ach_data.color : '', ach_data ? ach_data.icon : '');
    }
    saveStatsLocally(); checkAchievements(); renderAchievements();
}

// ── checkAchievements ────────────────────────────────────────────────────────
let _achCheckPending = false;
let _deferAchTimer = 0;
function _deferredCheckAch() {
    clearTimeout(_deferAchTimer);
    _deferAchTimer = setTimeout(checkAchievements, 800);
}
function checkAchievements() {
    if (_achCheckPending) return;
    _achCheckPending = true;
    try { _checkAchievementsImpl(); } finally { _achCheckPending = false; }
}
function _checkAchievementsImpl() {
    let newlyUnlocked = [];
    const achSet = new Set(playerStats.achievements);
    const unlock = (id) => {
        if (!achSet.has(id)) {
            achSet.add(id);
            playerStats.achievements.push(id);
            const f = ACHIEVEMENTS_MAP.get(id);
            if(f) newlyUnlocked.push(f);
        }
    };

    if (achSet.has('tramposo')) {
        if (!playerStats.pinnedAchievements.includes('tramposo')) {
            playerStats.pinnedAchievements.unshift('tramposo');
            if (playerStats.pinnedAchievements.length > 3) playerStats.pinnedAchievements.pop();
        } else if (playerStats.pinnedAchievements.indexOf('tramposo') !== 0) {
            playerStats.pinnedAchievements.splice(playerStats.pinnedAchievements.indexOf('tramposo'), 1);
            playerStats.pinnedAchievements.unshift('tramposo');
        }
    }

    const normalAchs = playerStats.achievements.filter(id => id !== 'tramposo').length;

    // META
    if (playerStats.nameChanges >= 1) unlock('m1'); if (playerStats.nameChanges >= 5) unlock('m2'); if (playerStats.nameChanges >= 20) unlock('m3');
    if (playerStats.achViews >= 1) unlock('m4'); if (playerStats.achViews >= 10) unlock('m5'); if (playerStats.achViews >= 50) unlock('m6');
    if (playerStats.pinnedAchievements.filter(id => id !== 'tramposo').length > 0) unlock('m7');
    if (normalAchs >= 10) unlock('m8'); if (normalAchs >= 50) unlock('m9'); if (normalAchs >= 100) unlock('m10');
    if (normalAchs >= 150) unlock('master1'); if (normalAchs >= 200) unlock('master2'); if (normalAchs >= 250) unlock('master4'); if (normalAchs >= 275) unlock('master5'); if (normalAchs >= 282) unlock('master3');

    // DÍAS
    const days = playerStats.maxLoginStreak;
    for(let i=0;i<5;i++) if(days>=daysTiers[i]) unlock(`d${i+1}`);
    const totalDays = playerStats.totalDaysPlayed || 0;
    for(let i=5;i<10;i++) if(totalDays>=daysTiers[i]) unlock(`d${i+1}`);

    // PARTIDAS
    const pts = playerStats.gamesPlayed; for(let i=0;i<8;i++) if(pts>=ptTiers[i]) unlock(`p${i+1}`);
    const tot = playerStats.totalScore; for(let i=0;i<8;i++) if(tot>=ptsTiers[i]) unlock(`pt${i+1}`);
    const hsc = playerStats.maxScoreCount; for(let i=0;i<8;i++) if(hsc>=hsCountTiers[i]) unlock(`hs${i+1}`);
    const fr = playerStats.frenziesTriggered; for(let i=0;i<8;i++) if(fr>=frTiers[i]) unlock(`r${i+1}`);
    const pf = playerStats.maxQuestionReached||0; for(let i=0;i<8;i++) if(pf>=pfTiers[i]) unlock(`pf${i+1}`);
    const sp = playerStats.fastAnswersTotal; for(let i=0;i<8;i++) if(sp>=spdTiers[i]) unlock(`sp${i+1}`);
    const ac = playerStats.totalCorrect; for(let i=0;i<8;i++) if(ac>=acTiers[i]) unlock(`ac${i+1}`);
    const sk = playerStats.maxStreak; for(let i=0;i<8;i++) if(sk>=strkTiers[i]) unlock(`sk${i+1}`);
    const mx = playerStats.maxMult||1; for(let i=0;i<5;i++) if(mx>=multTiers[i]) unlock(`mx${i+1}`);
    const rv = playerStats.rankingViews||0; for(let i=0;i<5;i++) if(rv>=rankVisTiers[i]) unlock(`rv${i+1}`);
    const cv = playerStats.configViews||0; for(let i=0;i<4;i++) if(cv>=cfgVisTiers[i]) unlock(`cv${i+1}`);
    const nt = playerStats.maxNoTimeoutStreak||0; for(let i=0;i<5;i++) if(nt>=noTimoutTiers[i]) unlock(`nt${i+1}`);

    // ÚNICOS
    if (playerStats.totalWrong > 0) unlock('u1'); if (playerStats.totalWrong >= 100) unlock('u2');
    if (playerStats.totalTimeouts > 0) unlock('u3'); if (playerStats.totalTimeouts >= 50) unlock('u4');
    if (playerStats.todayGames >= 50) unlock('u22'); if ((playerStats.maxStreak||0) >= 25) unlock('u23');
    const rank = getRankInfo(playerStats).title;
    let projectedRank = rank;
    if (typeof score !== 'undefined' && score > 0 && typeof currentQuestionIndex !== 'undefined') {
        const proj = Object.assign({}, playerStats, {
            totalScore: (playerStats.totalScore || 0) + score,
            bestScore: Math.max(playerStats.bestScore || 0, score),
            gamesPlayed: (playerStats.gamesPlayed || 0) + 1,
            totalCorrect: (playerStats.totalCorrect || 0) + (currentQuestionIndex - (currentWrongAnswers||0) - (currentTimeoutAnswers||0)),
            maxStreak: Math.max(playerStats.maxStreak || 0, typeof currentMaxStreak !== 'undefined' ? currentMaxStreak : 0),
            maxMult: Math.max(playerStats.maxMult || 1, typeof multiplier !== 'undefined' ? multiplier : 1)
        });
        projectedRank = getRankInfo(proj).title;
    }
    const effectiveRank = [rank, projectedRank].includes('Mítico') ? 'Mítico'
        : [rank, projectedRank].includes('Leyenda') ? 'Leyenda'
        : [rank, projectedRank].includes('Maestro') ? 'Maestro'
        : [rank, projectedRank].includes('Pro') ? 'Pro'
        : [rank, projectedRank].includes('Junior') ? 'Junior' : 'Novato';
    if (effectiveRank==="Junior"||effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico") unlock('u_junior');
    if (effectiveRank==="Pro"||effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico") unlock('u6');
    if (effectiveRank==="Maestro"||effectiveRank==="Leyenda"||effectiveRank==="Mítico") unlock('u7');
    if (effectiveRank==="Leyenda"||effectiveRank==="Mítico") unlock('u8');
    if (effectiveRank==="Mítico") unlock('u_mitico');
    if (playerStats.clickedLogo) unlock('secret_logo');

    // RULETA
    const rlSpins = playerStats.rouletteSpins||0;
    if(rlSpins>=1) unlock('rl1'); if(rlSpins>=10) unlock('rl6'); if(rlSpins>=50) unlock('rl7');
    if((playerStats.rouletteLifeWins||0)>=1) unlock('rl2');
    if((playerStats.rouletteShieldWins||0)>=1) unlock('rl3');
    if((playerStats.rouletteBoostWins||0)>=1) unlock('rl4');
    if((playerStats.rouletteFrenzyWins||0)>=1) unlock('rl5');
    if((playerStats.rouletteLifeWins||0)>=3) unlock('rl8');
    if(playerStats.rouletteShieldUsed) unlock('rl9');
    if(playerStats.rouletteComboSpecial) unlock('rl10');

    // KLICK PASS
    const kpClaimed = (typeof getKpState === 'function' ? getKpState().claimed : []).length || 0;
    if ((playerStats.kpViews||0) >= 1) unlock('kpa6');
    if (kpClaimed >= 1) unlock('kpa1');
    if ((playerStats.kpClaimDays||[]).length >= 3) unlock('kpa7');
    if (kpClaimed >= 25) unlock('kpa2');
    if ((playerStats.kpClaimDays||[]).length >= 7) unlock('kpa8');
    if (kpClaimed >= 50) unlock('kpa3');
    if ((playerStats.kpSessionClaims||0) >= 10) unlock('kpa9');
    if (kpClaimed >= 75) unlock('kpa4');
    if (kpClaimed >= 100) unlock('kpa5');
    if (kpClaimed >= 100 && normalAchs >= 200) unlock('kpa10');

    // ESCALABLES GENERALES
    const wr = playerStats.totalWrong||0; for(let i=0;i<5;i++) if(wr>=wrnTiers[i]) unlock(`wr${i+1}`);
    const to = playerStats.totalTimeouts||0; for(let i=0;i<5;i++) if(to>=toTiers[i]) unlock(`to${i+1}`);
    const td = playerStats.todayGames||0; for(let i=0;i<5;i++) if(td>=todayTiers[i]) unlock(`td${i+1}`);

    // CLASIFICACIÓN
    const pl = playerStats.powerLevel||0;
    if(pl>=10000) unlock('nm8'); if(pl>=100000) unlock('nm9'); if(pl>=1000000) unlock('nm10');
    const rp = playerStats.rankingPosition||999;
    if(rp<=20) unlock('nm1'); if(rp<=10) unlock('nm2'); if(rp<=3) unlock('nm3'); if(rp===1) unlock('nm4');
    if(rp===1 && (rank==='Leyenda'||rank==='Mítico')) unlock('pod1');
    if(rp===2 && (rank==='Leyenda'||rank==='Mítico')) unlock('pod2');
    if(rp===3 && (rank==='Leyenda'||rank==='Mítico')) unlock('pod3');

    // MULTIPLICADORES x6-x10
    if(mx>=6) unlock('mx6'); if(mx>=7) unlock('mx7'); if(mx>=8) unlock('mx8'); if(mx>=9) unlock('mx9'); if(mx>=10) unlock('mx10');

    // PISTAS MUSICALES
    if((playerStats.trackSwitches||0)>=1) unlock('trk1');
    if(playerStats.triedAllTracks) unlock('trk2');
    if((playerStats.sameTrackGames||0)>=10) unlock('trk3');

    // CONFIG Y UI
    if(playerStats.musicSetTo0) unlock('cfg1');
    if(playerStats.musicAt100) unlock('cfg2');
    if(playerStats.musicSetTo0 && playerStats.sfxSetTo0) unlock('cfg3');
    if((playerStats.fpsChanges||0)>=5) unlock('cfg4');
    if(playerStats.maxFps===240) unlock('cfg5');
    if(playerStats.maxFps===15) unlock('cfg6');
    if(playerStats.particles0) unlock('cfg7');
    if(playerStats.musicAt100 && playerStats.particles100) unlock('cfg8');
    if(playerStats.usedLightMode) unlock('cfg9');
    if(playerStats.switchedLightToDark) unlock('cfg10');
    if(playerStats.allSectionsVisited) unlock('ui1');
    if(playerStats.nameChanges>=1 && playerStats.gamesPlayed>=1) unlock('ui7');

    const pvv = playerStats.profileViews||0; for(let i=0;i<5;i++) if(pvv>=profileVisTiers[i]) unlock(`pv${i+1}`);
    const retv = playerStats.totalDaysPlayed||0; for(let i=0;i<5;i++) if(retv>=returnDayTiers[i]) unlock(`ret${i+1}`);
    const bsv = playerStats.bestScore||0; for(let i=0;i<8;i++) if(bsv>=bestScoreTiers[i]) unlock(`bs${i+1}`);
    const fts = playerStats.maxFrenzyStreak||0; for(let i=0;i<5;i++) if(fts>=frenzyTimeTiers[i]) unlock(`ft${i+1}`);

    // ÚNICOS EXTRA
    if(playerStats.gamesPlayed>=1) unlock('x3');
    if(playerStats.gamesPlayed>=1 || playerStats.maxLoginStreak>=1) unlock('x1');
    if(playerStats.gamesPlayed>=100) unlock('x17');
    if(playerStats.nameChanges===0 && playerStats.maxLoginStreak>=30) unlock('x18');
    if((rank==='Leyenda'||rank==='Mítico') && normalAchs>=200) unlock('fin5');
    if(days>=7 && (rank==='Junior'||rank==='Pro'||rank==='Maestro'||rank==='Leyenda'||rank==='Mítico')) unlock('fin4');
    if((playerStats.maxMult||1)>=4) unlock('u16');
    if((playerStats.extremisCount||0)>=1) unlock('u24');
    if((playerStats.profileViewedAfterGames||0)>=5) unlock('ui5');
    if(playerStats.viewedProfileAfterRecord) unlock('ui9');
    if(playerStats.quickSettingsExit) unlock('ui2');
    if(playerStats.visitedRankingWithFewPlayers) unlock('ui6');
    if(playerStats.circuitCompleted) unlock('ui10');
    if(playerStats.idledOnMainMenu) unlock('x2');
    if((playerStats.consecutiveRankUpDays||0)>=3) unlock('nm5');
    if(playerStats.surpassedHighPLPlayer) unlock('nm6');
    if(playerStats.rankRemontada) unlock('nm7');
    if((playerStats.successfulLeaderboardLoads||0)>=10) unlock('ui8');

    if((playerStats.maxFrenziesInGame||0)>=2) unlock('extra1');
    if(playerStats.hadPerfectAccuracyGame) unlock('extra2');
    if((playerStats.maxQuestionReached||0)>=80) unlock('extra3');
    if((playerStats.gamesAtMusicZero||0)>=5) unlock('extra4');
    if((playerStats.dailyAchUnlocks||0)>=10) unlock('extra5');

    if(playerStats.playedNocturno) unlock('fin1');
    if(playerStats.playedMadrugador) unlock('fin2');

    if(playerStats.doubleVictory) unlock('x4');
    if(playerStats.consistent5Games) unlock('x6');
    if(playerStats.fastStart3k) unlock('x7');
    if(playerStats.firstGameOfDay50k) unlock('x12');
    if((playerStats.bestScore||0)>=99500 && (playerStats.bestScore||0)<=100500) unlock('x15');
    if(playerStats.hitExactly100k) unlock('x15');
    if(playerStats.revengeGame) unlock('x5');
    if(playerStats.xSinPrisa) unlock('x8');
    if((playerStats.todayGames||0)>=10) unlock('x13');
    if((playerStats.todayGames||0)>=20) unlock('x20');
    if((playerStats.maxQuestionReached||0)>=30 && (playerStats.invictoEarned||false)) unlock('x14');
    if((playerStats.x10Earned||false)) unlock('x10');
    if((playerStats.maxQuestionReached||0)>=100) unlock('u15');
    if((playerStats.maxQuestionReached||0)>=60) unlock('np3');
    if((playerStats.flashAnswersTotal||0)>=1) unlock('u13');
    if(playerStats.flashInOneGame) unlock('x19');
    if((playerStats.lastSecondAnswersTotal||0)>=50) unlock('u17');

    const _bTotalAns = (playerStats.totalCorrect||0)+(playerStats.totalWrong||0)+(playerStats.totalTimeouts||0);
    const _bAcc = _bTotalAns >= 500 ? (playerStats.totalCorrect||0) / _bTotalAns : 0;
    if (_bAcc >= 0.90) unlock('u_bisturi');

    const pinTot = playerStats.totalPins||0;
    const pinTiers2=[1,5,10,20,50]; for(let i=0;i<5;i++) if(pinTot>=pinTiers2[i]) unlock(`pin${i+1}`);

    const dau = playerStats.dailyAchUnlocks||0;
    const daTiers2=[1,3,5,8,12]; for(let i=0;i<5;i++) if(dau>=daTiers2[i]) unlock(`da${i+1}`);

    const td2Tiers=[5,10,20,30,60]; for(let i=0;i<5;i++) if((playerStats.totalDaysPlayed||0)>=td2Tiers[i]) unlock(`td2${i+1}`);

    if((playerStats.returnTriumph||0)>=1) unlock('x16');
    if(playerStats.fenixEarned) unlock('u11');
    if(playerStats.u19PersistEarned) unlock('u19');

    let redGoldCount = 0;
    playerStats.pinnedAchievements.forEach(id => {
        const ach = ACHIEVEMENTS_MAP.get(id);
        if (ach && (ach.color === colors.red || ach.color === colors.yellow || ach.color === colors.orange)) redGoldCount++;
    });
    if (redGoldCount >= 3) unlock('np2');

    if (newlyUnlocked.length > 0) {
        playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + newlyUnlocked.length;
        saveStatsDebounced();
        if (typeof _vsInitialized !== 'undefined' && _vsInitialized) {
            _vsAchSet = new Set(playerStats.achievements);
            _vsDisplayPin = getAutoProfileAchs();
            _vsRefreshRows(newlyUnlocked.map(a => a.id));
            const progEl = document.getElementById('achievements-progress-text');
            if (progEl) progEl.innerText = `Desbloqueados: ${_vsAchSet.size - (_vsAchSet.has('tramposo') ? 1 : 0)} / ${ACHIEVEMENTS_DATA.length}`;
        } else {
            if (typeof renderAchievements === 'function') renderAchievements();
        }
        newlyUnlocked.forEach((ach, index) => {
            setTimeout(() => {
                if (typeof SFX !== 'undefined') SFX.achievement();
                if (typeof showToast === 'function') showToast('Logro Desbloqueado', ach.title, ach.color, ach.icon);
            }, index * 1300);
        });
    }
}
