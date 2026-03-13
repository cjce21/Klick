// Anti-flash v3 — aplica el color de rango ANTES del primer render
// Cargar en <head> sin defer ni async
// ⚠ Umbrales IDÉNTICOS a RANK_TIERS en script.js (sistema v3 — solo in-game)
// Rangos: Novato → Junior → Pro → Maestro → Leyenda → Mítico
// Sin condiciones de calendario (sin maxLoginStreak, sin totalDaysPlayed)

(function() {
    try {
        var raw;
        try { raw = localStorage.getItem('klick_player_data_permanent') || localStorage.getItem('klickStats_v9'); } catch(e) {}
        var s = JSON.parse(raw || '{}');

        // Métricas in-game puras
        var ts  = s.totalScore    || 0;   // puntos acumulados totales
        var tc  = s.totalCorrect  || 0;   // aciertos totales
        var tw  = s.totalWrong    || 0;
        var tt  = s.totalTimeouts || 0;
        var pf  = s.perfectGames  || 0;   // partidas perfectas
        var sk  = s.maxStreak     || 0;   // racha máxima de aciertos
        var mx  = s.maxMult       || 1;   // multiplicador máximo alcanzado
        var bs  = s.bestScore     || 0;   // mejor score en una sola partida
        var gp  = s.gamesPlayed   || 0;   // partidas jugadas

        // Precisión global (0–1)
        var totalAns = tc + tw + tt;
        var acc = totalAns > 0 ? tc / totalAns : 0;

        var color, rgb;

        // Orden estricto de mayor a menor prioridad — idéntico a RANK_TIERS[]
        if (ts >= 1000000 && tc >= 4000 && pf >= 40 && sk >= 35 && mx >= 8 && acc >= 0.82) {
            color = '#ffffff'; rgb = '255,255,255';   // Mítico
        } else if (ts >= 300000 && tc >= 1200 && pf >= 8 && mx >= 6) {
            color = '#ffb800'; rgb = '255,184,0';     // Leyenda
        } else if (ts >= 100000 && tc >= 400 && pf >= 3 && mx >= 4) {
            color = '#b5179e'; rgb = '181,23,158';    // Maestro
        } else if (ts >= 35000 && tc >= 120 && sk >= 10) {
            color = '#ff2a5f'; rgb = '255,42,95';     // Pro
        } else if (bs >= 8000 && gp >= 3) {
            color = '#00d4ff'; rgb = '0,212,255';     // Junior
        } else {
            color = '#00ff66'; rgb = '0,255,102';     // Novato
        }

        document.documentElement.style.setProperty('--rank-color', color);
        document.documentElement.style.setProperty('--rank-rgb',   rgb);
    } catch(e) {}
})();
