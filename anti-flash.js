// Anti-flash: aplica el color de rango ANTES del primer render
// Este archivo DEBE cargarse en <head> sin defer ni async
// IMPORTANTE: los umbrales deben ser idénticos a getRankInfo() en script.js

(function() {
    try {
        var raw;
        try { raw = localStorage.getItem('klick_player_data_permanent') || localStorage.getItem('klickStats_v9'); } catch(e) {}
        raw = raw || '{}';
        var s = JSON.parse(raw);
        var ts = s.totalScore  || 0;
        var tc = s.totalCorrect|| 0;
        var pf = s.perfectGames|| 0;
        var gp = s.gamesPlayed || 0;
        var mx = s.maxMult     || 1;
        var sk = s.maxStreak   || 0;
        var bs = s.bestScore   || 0;
        var ml = s.maxLoginStreak || 0;
        var ach= (s.achievements || []).length;
        var tw = s.totalWrong  || 0;
        var tt = s.totalTimeouts || 0;
        var acc = (tc + tw + tt) > 0 ? Math.round(tc / (tc + tw + tt) * 100) : 0;

        var color, rgb;

        // Orden idéntico a getRankInfo(): de mayor a menor
        if (ts >= 1200000 && tc >= 5000 && pf >= 50 && ach >= 200 &&
            sk >= 40 && mx >= 8 && acc >= 85 && ml >= 30) {
            color = '#ffffff'; rgb = '255,255,255';
        } else if (ts >= 400000 && tc >= 1500 && pf >= 10) {
            color = '#ffb800'; rgb = '255,184,0';
        } else if (ts >= 150000 && gp >= 50 && mx >= 4) {
            color = '#b5179e'; rgb = '181,23,158';
        } else if (ts >= 60000 && tc >= 200 && sk >= 12) {
            color = '#ff2a5f'; rgb = '255,42,95';
        } else if (bs >= 15000 && gp >= 5) {
            color = '#00d4ff'; rgb = '0,212,255';
        } else {
            color = '#00ff66'; rgb = '0,255,102';
        }

        document.documentElement.style.setProperty('--rank-color', color);
        document.documentElement.style.setProperty('--rank-rgb', rgb);
    } catch(e) {}
})();
