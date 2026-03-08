// Anti-flash: aplica el color de rango ANTES del primer render
// Este archivo DEBE cargarse en <head> sin defer ni async

// ANTI-FLASH: aplica el color de rango correcto antes del primer render
    (function() {
        try {
            var raw;
            try { raw = localStorage.getItem('klick_player_data_permanent') || localStorage.getItem('klickStats_v9'); } catch(e) {}
            raw = raw || '{}';
            var s = JSON.parse(raw);
            // Aplicar tema antes de pintar para evitar flash oscuro→claro
            var savedTheme = s.theme || 'dark';
            if (savedTheme === 'light') {
                document.documentElement.classList.add('light-mode');
                document.documentElement.style.background = '#f5f5f5';
            }
            var ts = s.totalScore||0, tc = s.totalCorrect||0, pf = s.perfectGames||0;
            var gp = s.gamesPlayed||0, mx = s.maxMult||1, sk = s.maxStreak||0;
            var ach = (s.achievements||[]).length;
            var tw = s.totalWrong||0, tt = s.totalTimeouts||0;
            var acc = (tc+tw+tt)>0 ? Math.round(tc/(tc+tw+tt)*100) : 0;
            var isLight = savedTheme === 'light';
            var color, rgb;
            // ── Divinidad: blanco/negro según interfaz (exclusivo CHRISTOPHER) ──
            if      (ts>=80000000)                                                                             { color=isLight?'#0d1117':'#ffffff'; rgb=isLight?'13,17,23':'255,255,255'; }
            // ── Mítico: ámbar ──────────────────────────────────────────────
            else if (ts>=1200000 && tc>=5500 && pf>=55 && gp>=320 && mx>=8 && sk>=45 && acc>=85 && ach>=280) { color='#ff9500'; rgb='255,149,0'; }
            // ── Eterno: índigo ─────────────────────────────────────────────
            else if (ts>=700000  && tc>=3200 && pf>=30 && gp>=200 && mx>=6 && sk>=35 && acc>=78 && ach>=160) { color='#6600ff'; rgb='102,0,255'; }
            // ── Leyenda: púrpura ───────────────────────────────────────────
            else if (ts>=400000  && tc>=1800 && pf>=15 && gp>=120 && mx>=5 && sk>=28 && acc>=70 && ach>=80)  { color='#b5179e'; rgb='181,23,158'; }
            // ── Maestro: rojo ──────────────────────────────────────────────
            else if (ts>=150000  && tc>=700  && pf>=5  && gp>=60  && mx>=4 && sk>=20 && acc>=65 && ach>=30)  { color='#ff2a5f'; rgb='255,42,95'; }
            // ── Pro: amarillo pollito ──────────────────────────────────────
            else if (ts>=60000   && tc>=250  &&           gp>=30  && mx>=3 && sk>=10 && acc>=60)              { color='#ffe566'; rgb='255,229,102'; }
            // ── Junior: azul ───────────────────────────────────────────────
            else if (ts>=20000   && tc>=75   &&           gp>=10)                                             { color='#00d4ff'; rgb='0,212,255'; }
            // ── Novato: verde ──────────────────────────────────────────────
            else                                                                                               { color='#00ff66'; rgb='0,255,102'; }
            document.documentElement.style.setProperty('--rank-color', color);
            document.documentElement.style.setProperty('--rank-rgb', rgb);
        } catch(e) {}
    })();
