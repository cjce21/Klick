// ════════════════════════════════════════════════════════════════
//  MÓDULO 08 — BUCLE DE JUEGO
//  Contenido: startGame, startGameCheck, loadQuestion,
//             selectAnswer, handleTimeout, showFeedback,
//             saveGameStats, endGame, abandonGame, replayGame,
//             animateScore, applyHintVisual.
//
//  DEPENDENCIAS: playerStats [03], SFX [04], getRankInfo [05],
//                checkAchievements [06], showToast / switchScreen [07]
// ════════════════════════════════════════════════════════════════

// --- Variables de partida ---
let score = 0, lives = 3, streak = 0, multiplier = 1;
let isAnsweringAllowed = false, isGamePaused = false;
let timerInterval = null, timeLeft = 0;
let _currentQuestion = null;
let currentQuestionIndex = 0;
let currentWrongAnswers = 0, currentTimeoutAnswers = 0;
let currentMaxStreak = 0, totalCorrectThisGame = 0;
let livesLostThisGame = 0, consecutiveLivesLost = 0;
let currentFastAnswers = 0, lastSecondAnswers = 0, ultraFastStreak = 0;
let frenziesThisGame = 0, currentNoTimeoutStreak = 0;
let currentGameLog = [];
let _gameSessionId = 0;

// Premios de ruleta activos
let activeBoostNextQ = null, shieldActive = false, hintActive = false;
let extraTimeActive = 0, streakShieldActive = false;

const TIMER_LIMIT = 15;

// Cached DOM refs (se asignan en startGame para no buscarlos en cada tick)
let _scoreEl = null, _gAnswersGrid = null, _gAnswerBtns = null;
let _timerPath = null, _timerText = null;

// --- Animación de puntaje ---
let _animScoreTimer = null;
function animateScore(target) {
    if (_animScoreTimer) { cancelAnimationFrame(_animScoreTimer); _animScoreTimer = null; }
    const el = _scoreEl || document.getElementById('score-display');
    const curr = parseInt((el.innerText || '0').replace(/[^0-9]/g, '')) || 0;
    const diff = target - curr;
    if (diff <= 0) { el.innerText = target.toLocaleString(); return; }
    const duration = Math.min(700, Math.max(250, diff / 8));
    const startTime = performance.now();
    const startVal = curr;
    function _scoreFrame(now) {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - (1 - t) * (1 - t);
        el.innerText = Math.round(startVal + diff * eased).toLocaleString();
        if (t < 1) { _animScoreTimer = requestAnimationFrame(_scoreFrame); }
        else { el.innerText = target.toLocaleString(); _animScoreTimer = null; }
    }
    _animScoreTimer = requestAnimationFrame(_scoreFrame);
}

// --- Comprobación anti-trampas antes de iniciar ---
async function startGameCheck() {
    try { initAudio(); if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume(); } catch(e) {}
    if (!playerStats.playerName || playerStats.playerName === "JUGADOR") {
        SFX.incorrect(); goToProfile(true); return;
    }
    if (document.visibilityState === 'hidden' || document.hidden) {
        showToast('No se puede iniciar', 'La ventana no está en primer plano.', 'var(--accent-red)', SVG_SKULL); return;
    }
    if (document.pictureInPictureElement) {
        showToast('No se puede iniciar', 'Desactiva el modo Picture-in-Picture.', 'var(--accent-red)', SVG_SKULL); return;
    }
    const winRatio = window.innerWidth / window.screen.width;
    if (winRatio < 0.45 && window.screen.width > 600) {
        showToast('No se puede iniciar', 'Detectada pantalla dividida o ventana parcial. Abre el juego en pantalla completa.', 'var(--accent-red)', SVG_SKULL); return;
    }
    if (typeof documentPictureInPicture !== 'undefined' && documentPictureInPicture.window) {
        showToast('No se puede iniciar', 'Desactiva el modo Picture-in-Picture.', 'var(--accent-red)', SVG_SKULL); return;
    }
    if (!document.hasFocus()) {
        showToast('No se puede iniciar', 'El juego no tiene el foco. Haz clic en la ventana del juego.', 'var(--accent-red)', SVG_SKULL); return;
    }
    if (quizDataPool.length === 0) {
        const btn = document.querySelector('.btn-solid');
        const originalText = btn.innerText;
        btn.innerText = "Cargando..."; btn.style.opacity = "0.7";
        await loadQuestions();
        btn.innerText = originalText; btn.style.opacity = "1";
    }
    startGame();
}

function startGame() {
    _gameSessionId++;
    score = 0; lives = 3; streak = 0; multiplier = 1;
    currentQuestionIndex = 0; currentWrongAnswers = 0; currentTimeoutAnswers = 0;
    currentMaxStreak = 0; totalCorrectThisGame = 0; livesLostThisGame = 0;
    consecutiveLivesLost = 0; currentFastAnswers = 0; lastSecondAnswers = 0;
    ultraFastStreak = 0; frenziesThisGame = 0; currentNoTimeoutStreak = 0;
    currentGameLog = [];
    activeBoostNextQ = null; shieldActive = false; hintActive = false;
    extraTimeActive = 0; streakShieldActive = false;
    _currentQuestion = null;

    // Registrar pistas para logros de silencio
    playerStats.lastGameTrack = playerStats.selectedTrack;
    if (playerStats.musicVol === 0) {
        playerStats.silentGames = (playerStats.silentGames||0) + 1;
    } else {
        playerStats.silentGames = 0;
    }

    // Registrar hora para logros de horario
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 1)  { playerStats.playedNocturno    = true; }
    if (hour >= 0  && hour < 6)  { playerStats.playedMadrugador  = true; }

    SFX.gameStart();
    // Cachear elementos de DOM frecuentes
    _scoreEl      = document.getElementById('score-display');
    _gAnswersGrid = document.getElementById('answers-grid');
    _gAnswerBtns  = Array.from(document.querySelectorAll('.answer-btn'));
    _timerPath    = document.getElementById('timer-path');
    _timerText    = document.getElementById('timer-text');

    updateHUD();
    switchScreen('question-screen');
    setTimeout(loadQuestion, 300);
}

function updateHUD() {
    if (_scoreEl) _scoreEl.innerText = score.toLocaleString();
    document.getElementById('lives-display').innerText = '❤️'.repeat(lives);
    document.getElementById('multiplier-display').innerText = `x${multiplier}`;
    document.getElementById('streak-display').innerText    = streak;
}

function loadQuestion() {
    const questionEl  = document.getElementById('question-text');
    const timerPath   = _timerPath  || document.getElementById('timer-path');
    const timerText   = _timerText  || document.getElementById('timer-text');
    const answerBtns  = _gAnswerBtns || Array.from(document.querySelectorAll('.answer-btn'));

    // Seleccionar pregunta del pool inteligente
    const q = _qeGetNext();
    if (!q) { endGame(); return; }
    _currentQuestion = q;
    currentQuestionIndex++;

    questionEl.innerText = q.question;
    answerBtns.forEach((btn, i) => {
        btn.innerText = q.shuffledAnswers[i];
        btn.className = 'answer-btn';
        btn.style.opacity = ''; btn.style.pointerEvents = ''; btn.style.filter = '';
    });

    // Animación de entrada
    questionEl.classList.add('q-enter');
    answerBtns.forEach((btn, i) => {
        btn.style.setProperty('--q-dur',   '0.4s');
        btn.style.setProperty('--q-delay', `${0.06 + i * 0.055}s`);
        btn.classList.add('q-enter');
    });

    // Tiempo de la pregunta
    let questionTime = TIMER_LIMIT;
    if (q.question && q.question.length > 120) questionTime = TIMER_LIMIT * 2;
    q._timeLimit = questionTime;
    if (extraTimeActive) { questionTime += extraTimeActive; extraTimeActive = 0; updateRewardIndicator(); }

    isAnsweringAllowed = true; isGamePaused = false;
    timeLeft = questionTime; timerText.innerText = timeLeft;

    timerPath.style.transition = 'none';
    timerPath.style.strokeDashoffset = '0';
    timerPath.style.stroke = 'var(--text-primary)';
    timerText.style.color = 'var(--text-primary)';
    void timerPath.offsetWidth;
    timerPath.style.transition = 'stroke-dashoffset 1s linear, stroke 0.3s ease';

    const timerTotal   = questionTime;
    const _timerStart  = performance.now();
    let _timerLastTick = timeLeft;
    let _timerPausedAt = 0, _timerPausedTotal = 0;

    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (isGamePaused) {
            if (_timerPausedAt === 0) _timerPausedAt = performance.now();
            return;
        }
        if (_timerPausedAt > 0) { _timerPausedTotal += performance.now() - _timerPausedAt; _timerPausedAt = 0; }
        const elapsed   = (performance.now() - _timerStart - _timerPausedTotal) / 1000;
        const remaining = Math.max(0, timerTotal - Math.floor(elapsed));
        if (remaining === _timerLastTick) return;
        _timerLastTick = remaining;
        timeLeft = remaining;
        timerText.innerText = timeLeft;
        timerPath.style.strokeDashoffset = 283 - (timeLeft / timerTotal) * 283;
        if (timeLeft <= 5 && timeLeft > 0) { SFX.tick(); timerPath.style.stroke = 'var(--accent-red)'; timerText.style.color = 'var(--accent-red)'; }
        if (timeLeft <= 0) handleTimeout();
    }, 250);
}

function selectAnswer(selectedIndex) {
    if (!isAnsweringAllowed || isGamePaused) return;
    isAnsweringAllowed = false; clearInterval(timerInterval); SFX.select();
    (_gAnswersGrid||document.getElementById('answers-grid')).classList.add('answered');
    (_gAnswerBtns ? _gAnswerBtns[selectedIndex] : document.querySelectorAll('.answer-btn')[selectedIndex]).classList.add('selected');

    const q = _currentQuestion;
    if (!q) return;
    const isCorrect  = (selectedIndex === q.currentCorrectIndex);
    const answerTime = timeLeft;
    currentGameLog.push({ correct: isCorrect, time: answerTime, category: q.category || q.type || null });

    if(isCorrect) {
        playerStats.totalCorrect++;
        const _qTimeLimit = (q && q._timeLimit) || TIMER_LIMIT;
        if(answerTime >= _qTimeLimit - 2) { currentFastAnswers++; playerStats.fastAnswersTotal++; }
        if(answerTime <= 1) { lastSecondAnswers++; playerStats.flashAnswersTotal = (playerStats.flashAnswersTotal||0) + 1; }
        if(answerTime >= _qTimeLimit - 3) { ultraFastStreak++; } else { ultraFastStreak = 0; }
        currentNoTimeoutStreak++;
        if(answerTime <= 2) playerStats.lastSecondAnswersTotal = (playerStats.lastSecondAnswersTotal||0) + 1;
        if(currentNoTimeoutStreak > (playerStats.maxNoTimeoutStreak||0)) playerStats.maxNoTimeoutStreak = currentNoTimeoutStreak;
    } else {
        playerStats.totalWrong++; currentWrongAnswers++;
        ultraFastStreak = 0; currentNoTimeoutStreak = 0;
    }
    saveStatsDebounced();
    setTimeout(() => showFeedback(isCorrect), 600);
}

function applyHintVisual() {
    const q = _currentQuestion;
    const correctIdx = q ? q.currentCorrectIndex : -1;
    const btns = document.querySelectorAll('.answer-btn');
    let hidden = false;
    btns.forEach((btn, i) => {
        if (!hidden && i !== correctIdx) {
            btn.style.opacity = '0.2'; btn.style.pointerEvents = 'none'; btn.style.filter = 'grayscale(1)';
            hidden = true;
        }
    });
}

function handleTimeout() {
    if (!isAnsweringAllowed || isGamePaused) return;
    isAnsweringAllowed = false; clearInterval(timerInterval);
    playerStats.totalTimeouts++; currentTimeoutAnswers++;
    currentGameLog.push({ correct: false, timeout: true, time: 0 });
    ultraFastStreak = 0; currentNoTimeoutStreak = 0;
    saveStatsDebounced();
    (_gAnswersGrid||document.getElementById('answers-grid')).classList.add('answered');
    setTimeout(() => showFeedback(false, true), 600);
}

function showFeedback(isCorrect, isTimeout = false) {
    const scr    = document.getElementById('feedback-screen');
    const icon   = document.getElementById('feedback-icon-container');
    const title  = document.getElementById('feedback-title');
    const points = document.getElementById('feedback-points');
    points.style.borderColor = ''; points.style.color = '';
    const _achSetFB = new Set(playerStats.achievements);

    if (isCorrect) {
        SFX.correct(); scr.className = 'screen correct'; icon.innerHTML = SVG_CORRECT;
        title.innerText = 'CORRECTO';
        let earned = 800 + Math.round((timeLeft / ((_currentQuestion && _currentQuestion._timeLimit) || TIMER_LIMIT)) * 800);
        let boostMult = multiplier;
        if (activeBoostNextQ === 'boost')   { boostMult = multiplier * 2; activeBoostNextQ = null; }
        else if (activeBoostNextQ === 'triple') { boostMult = multiplier * 3; activeBoostNextQ = null; }
        else if (activeBoostNextQ === 'jackpot') { boostMult = multiplier * 4; activeBoostNextQ = null; }
        earned = earned * boostMult;
        updateRewardIndicator();
        score += earned; streak++; if(streak > currentMaxStreak) currentMaxStreak = streak;
        totalCorrectThisGame++; consecutiveLivesLost = 0;

        if(playerStats._twoConsecLives && streak >= 10) { playerStats.u19Earned = true; playerStats._twoConsecLives = false; }

        // Logros en-partida (se disparan inmediatamente)
        const inGameUnlock = (id, title, col, ico) => {
            if (!_achSetFB.has(id)) {
                _achSetFB.add(id); playerStats.achievements.push(id); SFX.achievement();
                showToast('Logro Desbloqueado', title, col, ico);
                playerStats.dailyAchUnlocks = (playerStats.dailyAchUnlocks||0) + 1;
                saveStatsDebounced(); renderAchievements();
            }
        };
        if (streak >= 10 && livesLostThisGame === 0) inGameUnlock('np1', 'Examen de Oro', colors.yellow, SVG_SHIELD);
        if (streak > 0 && streak % 5 === 0) {
            playerStats.frenziesTriggered++; playerStats.currentFrenzyStreak = (playerStats.currentFrenzyStreak||0) + 1;
            frenziesThisGame++; if(frenziesThisGame > (playerStats.maxFrenziesInGame||0)) playerStats.maxFrenziesInGame = frenziesThisGame;
        }
        if ((playerStats.currentFrenzyStreak||0) > (playerStats.maxFrenzyStreak||0)) playerStats.maxFrenzyStreak = playerStats.currentFrenzyStreak;
        if(timeLeft === 1) inGameUnlock('u5','Por los Pelos', colors.red, SVG_CLOCK);
        if(timeLeft === 2 || timeLeft === 3) inGameUnlock('u14','Calculador', colors.blue, SVG_CLOCK);
        if(currentQuestionIndex >= 49 && livesLostThisGame === 0) inGameUnlock('u9','Inmortal', colors.purple, SVG_SHIELD);
        if(currentQuestionIndex >= 19 && livesLostThisGame === 0) { inGameUnlock('x10','Economía', colors.green, SVG_HEART); playerStats.x10Earned = true; }
        if(currentQuestionIndex >= 29 && livesLostThisGame === 0) { inGameUnlock('x14','Invicto', colors.green, SVG_SHIELD); playerStats.invictoEarned = true; }
        if(lives === 1) inGameUnlock('x11','El Último Chance', colors.orange, SVG_SHIELD);
        if(lastSecondAnswers >= 3) inGameUnlock('u24','Extremis', colors.red, SVG_SHIELD);
        if(lastSecondAnswers >= 5) { playerStats.flashInOneGame = true; inGameUnlock('x19','Espectacular', colors.yellow, SVG_BOLT); }
        if(currentQuestionIndex >= 60) inGameUnlock('np3','Sin Límites', colors.purple, SVG_BOLT);
        if(currentQuestionIndex >= 99) inGameUnlock('u15','Superviviente', colors.green, SVG_SHIELD);
        if(ultraFastStreak >= 10) inGameUnlock('u21','Metralleta', colors.red, SVG_BOLT);
        if(currentQuestionIndex === 2 && score > 3000) { playerStats.fastStart3k = true; inGameUnlock('x7','Un Golpe Certero', colors.yellow, SVG_BOLT); }
        if(currentQuestionIndex < 10 && ultraFastStreak >= 10) inGameUnlock('x9','Todo Gas', colors.red, SVG_BOLT);
        if((playerStats.currentFrenzyStreak||0) >= 4) inGameUnlock('fin3','Momento Épico', colors.red, SVG_FIRE);

        points.innerText = `+${earned}`; points.style.display = 'block';

    } else {
        // Escudo de ruleta
        if (shieldActive) {
            shieldActive = false; playerStats.rouletteShieldUsed = true;
            saveStatsDebounced(); updateRewardIndicator(); SFX.correct();
            scr.className = 'screen shield'; icon.innerHTML = SVG_SHIELD;
            title.innerText = '¡ESCUDO!';
            points.innerText = 'Protegido';
            points.style.borderColor = 'rgba(0,212,255,0.45)'; points.style.color = '#00d4ff';
            points.style.display = 'block';
        } else {
            activeBoostNextQ = null; updateRewardIndicator(); SFX.incorrect();
            // Escudo de racha
            if (streakShieldActive && streak > 0) {
                streakShieldActive = false; updateRewardIndicator();
                scr.className = 'screen shield'; icon.innerHTML = SVG_SHIELD;
                title.innerText = '¡RACHA PROTEGIDA!';
                points.innerText = `Racha ${streak} salvada`; points.style.display = 'block';
            } else {
                scr.className = isTimeout ? 'screen timeout' : 'screen incorrect';
                icon.innerHTML = isTimeout ? SVG_TIMEOUT : SVG_INCORRECT;
                title.innerText = isTimeout ? 'TIEMPO' : 'INCORRECTO';
                streak = 0; playerStats.currentFrenzyStreak = 0; multiplier = 1;
                lives--;
                if (lives < 0) lives = 0;
                livesLostThisGame++;
                consecutiveLivesLost++;
                if(consecutiveLivesLost >= 2) { playerStats._twoConsecLives = true; }
                points.style.display = 'none';
            }
        }
    }

    // Actualizar multiplicador según streak
    const prevMult = multiplier;
    if(streak >= 35)      multiplier = 10;
    else if(streak >= 30) multiplier = 9;
    else if(streak >= 25) multiplier = 8;
    else if(streak >= 20) multiplier = 7;
    else if(streak >= 16) multiplier = 6;
    else if(streak >= 12) multiplier = 5;
    else if(streak >= 9)  multiplier = 4;
    else if(streak >= 6)  multiplier = 3;
    else if(streak >= 3)  multiplier = 2;
    else                  multiplier = 1;
    if(multiplier > (playerStats.maxMult||1)) playerStats.maxMult = multiplier;
    if(multiplier !== prevMult && multiplier > 1) SFX.streakTrigger();

    // Streak visual
    const appEl = document.getElementById('app');
    if (streak >= 5) { appEl.classList.add('streak-active'); } else { appEl.classList.remove('streak-active'); }

    updateHUD();
    animateScore(score);
    switchScreen('feedback-screen');

    const _sessionSnap = _gameSessionId;
    setTimeout(() => {
        if (_gameSessionId !== _sessionSnap) return;
        if (lives <= 0) { endGame(); return; }
        if (streak > 0 && streak % 5 === 0) {
            showRoulette();
        } else {
            switchScreen('question-screen');
            loadQuestion();
        }
    }, 1200);
}

function saveGameStats() {
    const prevBest = playerStats.bestScore || 0;
    if (score > playerStats.bestScore) {
        playerStats.bestScore = score;
        if (score >= 100000) playerStats.maxScoreCount = (playerStats.maxScoreCount || 0) + 1;
        playerStats.ui9Pending = true;
    }
    // x15: Punto de Quiebre — score exactamente 100k ±500
    if (score >= 99500 && score <= 100500) playerStats.hitExactly100k = true;
    playerStats.gamesPlayed++;
    playerStats.todayGames = (playerStats.todayGames || 0) + 1;
    playerStats.totalScore += score;
    if (playerStats.maxStreak < currentMaxStreak) playerStats.maxStreak = currentMaxStreak;
    // perfectGames: solo cuando acaba sin errores ni timeouts Y ≥50 preguntas
    if (currentQuestionIndex >= 50 && currentWrongAnswers === 0 && currentTimeoutAnswers === 0) {
        playerStats.perfectGames = (playerStats.perfectGames || 0) + 1;
    }
    if (currentQuestionIndex > (playerStats.maxQuestionReached || 0)) playerStats.maxQuestionReached = currentQuestionIndex;
    // extra2 Precisionista: 100% precisión con mín. 5 respuestas
    const gameCorrect = currentQuestionIndex - currentWrongAnswers - currentTimeoutAnswers;
    if (currentWrongAnswers === 0 && currentTimeoutAnswers === 0 && gameCorrect >= 5) playerStats.hadPerfectAccuracyGame = true;
    // x5: La Revancha
    const prevGameCorrect = playerStats.lastGameCorrect || 0;
    playerStats.revengeGame = (prevGameCorrect === 0 && gameCorrect >= 10);
    // x8: Sin Prisa — termina con <5 respuestas rápidas
    playerStats.xSinPrisa = (currentFastAnswers < 5 && currentQuestionIndex >= 5);
    // x12: Principiante Letal — 50k en la primera partida del día
    if (playerStats.todayGames === 1 && score >= 50000) playerStats.firstGameOfDay50k = true;
    // x16: Regreso Triunfal — tras no jugar un día, supera su último récord
    if ((playerStats.missedADay || false) && score > prevBest && prevBest > 0) {
        playerStats.returnTriumph = (playerStats.returnTriumph || 0) + 1;
    }
    playerStats.missedADay = false;
    // x4: Doble Victoria — supera 75k dos partidas seguidas
    if (score >= 75000 && (playerStats.previousGameScore || 0) >= 75000) playerStats.doubleVictory = true;
    // x6: Consistente — 5 partidas seguidas con ≥25k
    if (score >= 25000) {
        playerStats.consecutiveGames25k = (playerStats.consecutiveGames25k || 0) + 1;
    } else {
        playerStats.consecutiveGames25k = 0;
    }
    if ((playerStats.consecutiveGames25k || 0) >= 5) playerStats.consistent5Games = true;
    playerStats.previousGameScore = score;
    // extra4 Silencioso: partida con música a 0%
    if ((playerStats.musicVol || 1) === 0) playerStats.gamesAtMusicZero = (playerStats.gamesAtMusicZero || 0) + 1;
    // u11: Fénix
    if (livesLostThisGame >= 2 && currentMaxStreak >= 30) playerStats.fenixEarned = true;
    // u19: Resurrección
    if (playerStats.u19Earned) { playerStats.u19PersistEarned = true; playerStats.u19Earned = false; }
    // Pista de música
    if (playerStats.lastGameTrack && playerStats.lastGameTrack === playerStats.selectedTrack) {
        playerStats.sameTrackGames = (playerStats.sameTrackGames || 0) + 1;
    } else {
        playerStats.sameTrackGames = 1;
    }
    playerStats.lastGameTrack = playerStats.selectedTrack;
    playerStats.lastGameCorrect = gameCorrect;
    playerStats.profileViewedAfterGames = 0;
    currentRankInfo = getRankInfo(playerStats);
    saveStatsLocally();
    checkAchievements();
    submitLeaderboard();
}

function endGame() {
    clearInterval(timerInterval);
    isAnsweringAllowed = false;
    if (_animScoreTimer) { cancelAnimationFrame(_animScoreTimer); _animScoreTimer = null; }
    _currentQuestion = null;
    document.getElementById('app').classList.remove('streak-active');
    SFX.gameEnd();
    saveGameStats();

    // Support both possible element IDs for the final score
    const finalEl = document.getElementById('final-score-display') || document.getElementById('end-score');
    if (finalEl) finalEl.innerText = score.toLocaleString();
    const endStreak = document.getElementById('end-streak');
    const endCorrect = document.getElementById('end-correct');
    const endQuestions = document.getElementById('end-questions');
    if (endStreak) endStreak.innerText   = currentMaxStreak;
    if (endCorrect) endCorrect.innerText  = totalCorrectThisGame;
    if (endQuestions) endQuestions.innerText = currentQuestionIndex;

    switchScreen('end-screen');
    streak = 0;
}

function abandonGame() {
    if(lives <= 0) return;
    SFX.click();
    isGamePaused = true;
    clearInterval(timerInterval);
    document.getElementById('abandon-modal').classList.add('active');
}

function cancelAbandon() {
    SFX.click();
    isGamePaused = false;
    document.getElementById('abandon-modal').classList.remove('active');
}

function confirmAbandon() {
    _gameSessionId++;
    document.getElementById('abandon-modal').classList.remove('active');
    isAnsweringAllowed = false; isGamePaused = false;
    clearInterval(timerInterval);
    lives = 0; _currentQuestion = null;
    initAudio(); SFX.incorrect();
    const penalty = 300;
    playerStats.totalScore = Math.max(0, playerStats.totalScore - penalty);
    saveStatsLocally(); submitLeaderboard();
    showToast('Partida Abandonada', `Penalización de -300 pts.`, 'var(--text-secondary)', SVG_INCORRECT);
    document.getElementById('app').classList.remove('streak-active');
    streak = 0;
    switchScreen('start-screen');
}

function replayGame() { SFX.click(); startGame(); }

// ── Sistema de preguntas: carga y smart engine ────────────────────────────────
let quizDataPool = [];
async function loadQuestions() {
    try {
        const response = await fetch('preguntas.json');
        if (!response.ok) throw new Error('No se pudo cargar el archivo');
        quizDataPool = await response.json();
        while(quizDataPool.length < 20) {
            quizDataPool.push({ "question": "Por favor, carga el juego en un servidor web.", "answers": ["Entendido", "Ok", "Comprendo", "Solucionar"], "correctIndex": 0 });
        }
    } catch (error) {
        quizDataPool = [
            { "question": "ERROR: No se pudo cargar 'preguntas.json'. ¿Estás abriendo el HTML directamente (file://) en vez de usar un servidor local?", "answers": ["Sí, ese es el error", "Debo usar Live Server", "Falta el archivo JSON", "Todas las anteriores"], "correctIndex": 3 }
        ];
    }
    _qeSync();
}

function shuffleArray(array) {
    let current = array.length, random;
    while (current !== 0) { random = Math.floor(Math.random() * current); current--; [array[current], array[random]] = [array[random], array[current]]; }
    return array;
}

// ── Motor de preguntas inteligente (_qe) ─────────────────────────────────────
const _qe = {
    pool: [], queue: [], tail: [], tailSize: 20, lastKey: ''
};

function _qKey(q) {
    let h = 5381;
    const s = q.question;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h) ^ s.charCodeAt(i); h = h >>> 0; }
    return h.toString(36);
}

function _qRefill(excludeSet) {
    const pool = _qe.pool;
    if (!pool.length) return;
    const valid = [], invalid = [];
    for (let i = 0; i < pool.length; i++) {
        const k = _qKey(pool[i]);
        if (excludeSet && excludeSet.has(k)) invalid.push(pool[i]);
        else valid.push(pool[i]);
    }
    const useValid = valid.length >= Math.max(5, Math.floor(pool.length * 0.3));
    const source = useValid ? valid : [...pool];
    for (let i = source.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [source[i], source[j]] = [source[j], source[i]];
    }
    if (invalid.length) {
        for (let i = invalid.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [invalid[i], invalid[j]] = [invalid[j], invalid[i]];
        }
        _qe.queue = [...source, ...invalid];
    } else {
        _qe.queue = source;
    }
}

function _qeSync() {
    _qe.pool = quizDataPool;
    _qe.tailSize = Math.min(120, Math.max(20, Math.floor(quizDataPool.length * 0.4)));
    if (_qe.queue.length === 0) _qRefill(new Set(_qe.tail));
}

function _qeResetGame() {
    _qe.queue = [];
    _qRefill(new Set(_qe.tail));
}

function _qeGetNext() {
    if (!_qe.pool.length) return null;
    if (_qe.queue.length === 0) _qRefill(new Set(_qe.tail));
    const q = _qe.queue.shift();
    if (!q) return null;
    const key = _qKey(q);
    _qe.tail.push(key);
    if (_qe.tail.length > _qe.tailSize) _qe.tail.shift();
    _qe.lastKey = key;
    return q;
}

function getNextQuestion() { return _qeGetNext(); }
function _markUsed() {}
const _recentQuestionIds = { clear: () => {} };

// ── showCountdown ─────────────────────────────────────────────────────────────
function showCountdown(callback) {
    switchScreen('countdown-screen');
    const numEl = document.getElementById('countdown-number');
    const lblEl = document.getElementById('countdown-label');
    const steps = [
        { text: '3', label: 'Prepárate...' },
        { text: '2', label: '¡Concéntrate!' },
        { text: '1', label: '¡Ya casi!' },
        { text: '¡YA!', label: '' }
    ];
    let i = 0;
    function tick() {
        if (i >= steps.length) { callback(); return; }
        numEl.style.transform = 'scale(0.5)'; numEl.style.opacity = '0';
        lblEl.style.opacity = '0';
        setTimeout(() => {
            numEl.textContent = steps[i].text;
            lblEl.textContent = steps[i].label;
            numEl.style.transform = 'scale(1)'; numEl.style.opacity = '1';
            lblEl.style.opacity = '1';
            SFX.tick();
            i++;
            setTimeout(tick, i < steps.length ? 800 : 400);
        }, 150);
    }
    tick();
}

// ── HUD updates ───────────────────────────────────────────────────────────────
function updateLivesUI() {
    const c = document.getElementById('lives-container');
    c.innerHTML = '';
    for(let i = 0; i < 3; i++) {
        let el = document.createElement('div');
        el.innerHTML = SVG_BOLT;
        if(i >= lives) el.classList.add('life-lost');
        c.appendChild(el);
    }
}

function updateMultiplierUI() {
    const b = document.getElementById('multiplier-badge');
    multiplier = Math.min(10, Math.max(1, Math.floor(streak / 5) + 1));
    if(multiplier > (playerStats.maxMult||1)) { playerStats.maxMult = multiplier; }
    if(multiplier > 1) {
        b.style.display = 'block';
        b.innerText = `x${multiplier}`;
        const cls = multiplier <= 6 ? `mult-x${multiplier}` :
                    multiplier === 7 ? 'mult-x7' :
                    multiplier === 8 ? 'mult-x8' :
                    multiplier === 9 ? 'mult-x9' : 'mult-x10';
        b.className = 'multiplier-badge ' + cls;
    } else {
        b.style.display = 'none';
        b.className = 'multiplier-badge';
    }
}

let _appEl = null;
function updateStreakVisuals() {
    if (!_appEl) _appEl = document.getElementById('app');
    const app = _appEl;
    if (streak >= 5) {
        if (!app.classList.contains('streak-active')) { app.classList.add('streak-active'); SFX.streakTrigger(); }
        if (streak % 5 === 0) triggerMultiplierEffect(multiplier);
    } else app.classList.remove('streak-active');
}

function triggerMultiplierEffect(mult) {
    // Effects removed per user request — multiplier badge CSS handles visual feedback
}
