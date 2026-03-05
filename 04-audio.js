// ════════════════════════════════════════════════════════════════
//  MÓDULO 04 — MOTOR DE AUDIO
//  Contenido: WebAudio API, scheduler de música procedural,
//             sistema de pistas, SFX, gestión de volumen.
//
//  DEPENDENCIAS: playerStats [03-player-stats.js]
// ════════════════════════════════════════════════════════════════

const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
let masterMusicGain, masterSFXGain, masterLimiter, audioAnalyser, audioDataArray;
let isMusicPlaying = false, musicSeqStep = 0, nextNoteTime = 0, musicTimerID = null;
let chordIndex = 0;

const SCHED_AHEAD    = 0.12;  // segundos de anticipación al programar notas
const SCHED_INTERVAL = 25;    // ms entre ticks del scheduler

function initAudio() {
    if (!audioCtx) {
        audioCtx = new AudioContext();
        masterMusicGain = audioCtx.createGain();
        masterMusicGain.gain.value = playerStats.musicVol * 0.8;
        masterSFXGain = audioCtx.createGain();
        masterSFXGain.gain.value = playerStats.sfxVol;
        masterLimiter = audioCtx.createDynamicsCompressor();
        masterLimiter.threshold.value = -3;
        masterLimiter.knee.value = 3;
        masterLimiter.ratio.value = 12;
        masterLimiter.attack.value = 0.001;
        masterLimiter.release.value = 0.1;
        audioAnalyser = audioCtx.createAnalyser();
        audioAnalyser.fftSize = 64;
        audioDataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
        // Enrutado: music → analyser → limiter → out ; sfx → limiter → out
        masterMusicGain.connect(audioAnalyser);
        audioAnalyser.connect(masterLimiter);
        masterSFXGain.connect(masterLimiter);
        masterLimiter.connect(audioCtx.destination);
        startMusicEngine();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function updateVolumes() {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    if (masterMusicGain) masterMusicGain.gain.setTargetAtTime(playerStats.musicVol * 0.8, t, 0.05);
    if (masterSFXGain)   masterSFXGain.gain.setTargetAtTime(playerStats.sfxVol, t, 0.05);
}

let currentAudioPulse = 0;
let smoothedPulse = 0;
function getAudioPulse() {
    if (!audioAnalyser) return 0;
    audioAnalyser.getByteFrequencyData(audioDataArray);
    let sum = 0;
    for (let i = 0; i < 4; i++) sum += audioDataArray[i];
    const rawPulse = sum / (4 * 255);
    smoothedPulse += (rawPulse - smoothedPulse) * 0.15;
    currentAudioPulse = smoothedPulse;
    return currentAudioPulse;
}

function schedNote(freq, type, startTime, duration, vol, dest) {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(dest || masterSFXGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
}

function playSFX(notes) {
    if (!audioCtx || playerStats.sfxVol === 0) return;
    const now = audioCtx.currentTime + 0.01;
    notes.forEach(([freq, type, offset, duration, vol]) => {
        schedNote(freq, type, now + offset, duration, vol * playerStats.sfxVol);
    });
}

function playNoiseAt(time, duration, vol, cutoff = 5000) {
    if (!audioCtx) return;
    const sr = audioCtx.sampleRate;
    const buf = audioCtx.createBuffer(1, Math.ceil(sr * duration), sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src    = audioCtx.createBufferSource();
    const gain   = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();
    src.buffer = buf;
    filter.type = 'highpass';
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    src.connect(filter); filter.connect(gain); gain.connect(masterMusicGain);
    src.start(time);
}

// ── Sistema de pistas musicales ──────────────────────────────────────────────
const MUSIC_TRACKS = [
    { id: 'track_chill', name: 'Neon Chill',    desc: 'Ambiental · Suave',  color: 'var(--accent-blue)'   },
    { id: 'track_pulse', name: 'Dark Tide',     desc: 'Oscuro · Profundo', color: 'var(--accent-green)'  },
    { id: 'track_bass',  name: 'Deep Current',  desc: 'Bass · Groovy',     color: 'var(--accent-purple)' }
];

function renderTrackSelector() {
    const container = document.getElementById('track-selector');
    if (!container) return;
    const currentTrack = playerStats.selectedTrack || 'track_chill';
    container.innerHTML = MUSIC_TRACKS.map(t => {
        const isSelected = t.id === currentTrack;
        return `
        <div onclick="selectTrack('${t.id}')" class="track-option${isSelected ? ' selected' : ''}" style="
            flex:1;min-width:120px;padding:12px 15px;border-radius:var(--radius-md);
            border:1.5px solid ${isSelected ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.1)'};
            background:${isSelected ? 'rgba(255,255,255,0.07)' : 'transparent'};
            cursor:pointer;text-align:center;transition:all 0.25s;
            box-shadow:${isSelected ? '0 0 15px rgba(255,255,255,0.08)' : 'none'};
        ">
            <div style="font-size:0.8rem;font-weight:800;color:${isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'};text-transform:uppercase;letter-spacing:1px;">${t.name}</div>
            <div style="font-size:0.65rem;color:var(--text-secondary);margin-top:3px;">${t.desc}</div>
        </div>
    `}).join('');
}

function selectTrack(trackId) {
    if (!audioCtx) initAudio();
    SFX.click();
    const prev = playerStats.selectedTrack || 'track_chill';
    playerStats.selectedTrack = trackId;
    saveStatsLocally();
    renderTrackSelector();
    if (prev !== trackId) {
        playerStats.trackSwitches = (playerStats.trackSwitches || 0) + 1;
        if (!playerStats.tracksTriedSet) playerStats.tracksTriedSet = [];
        if (!playerStats.tracksTriedSet.includes(trackId)) playerStats.tracksTriedSet.push(trackId);
        if (playerStats.tracksTriedSet.length >= 3) playerStats.triedAllTracks = true;
        checkAchievements();
    }
    // Reiniciar motor musical con la nueva pista
    stopMusicEngine();
    chordIndex = 0; musicSeqStep = 0;
    startMusicEngine();
}

// ── SFX ──────────────────────────────────────────────────────────────────────
const SFX = {
    click:         () => playSFX([[1200, 'sine', 0, 0.06, 0.05]]),
    tick:          () => playSFX([[880, 'square', 0, 0.03, 0.03]]),
    select:        () => playSFX([[220, 'sine', 0, 0.12, 0.06], [330, 'sine', 0.03, 0.08, 0.05]]),
    correct:       () => playSFX([[659, 'sine', 0, 0.14, 0.10], [988, 'sine', 0.07, 0.18, 0.10], [1319, 'sine', 0.14, 0.22, 0.09]]),
    incorrect:     () => playSFX([[160, 'sawtooth', 0, 0.18, 0.08], [110, 'sawtooth', 0.06, 0.22, 0.12]]),
    streakTrigger: () => playSFX([[523, 'triangle', 0, 0.12, 0.10], [784, 'triangle', 0.10, 0.15, 0.12], [1047, 'triangle', 0.22, 0.28, 0.13]]),
    achievement:   () => playSFX([[1047, 'sine', 0, 0.10, 0.09], [1319, 'sine', 0.06, 0.12, 0.09], [1568, 'sine', 0.12, 0.15, 0.09], [2093, 'sine', 0.18, 0.30, 0.10]]),
    gameStart:     () => playSFX([[110, 'sine', 0, 0.25, 0.08], [440, 'triangle', 0.08, 0.20, 0.12], [660, 'sine', 0.20, 0.15, 0.11]]),
    gameEnd:       () => playSFX([[330, 'sine', 0, 0.18, 0.14], [415, 'sine', 0.10, 0.18, 0.14], [554, 'sine', 0.20, 0.22, 0.14]]),
    pcClick: () => {
        if (!audioCtx) return;
        const t = audioCtx.currentTime + 0.005;
        const sr = audioCtx.sampleRate;
        const buf = audioCtx.createBuffer(1, Math.ceil(sr * 0.04), sr);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        const src = audioCtx.createBufferSource();
        const g = audioCtx.createGain();
        const f = audioCtx.createBiquadFilter();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = 3200; f.Q.value = 0.8;
        g.gain.setValueAtTime(playerStats.sfxVol * 0.55, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.038);
        src.connect(f); f.connect(g); g.connect(audioCtx.destination); src.start(t);
        const o = audioCtx.createOscillator(), g2 = audioCtx.createGain();
        o.type = 'square'; o.frequency.setValueAtTime(4800, t); o.frequency.exponentialRampToValueAtTime(2000, t + 0.015);
        g2.gain.setValueAtTime(playerStats.sfxVol * 0.12, t);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
        o.connect(g2); g2.connect(audioCtx.destination); o.start(t); o.stop(t + 0.02);
    }
};

// iOS/iPad: desbloquear AudioContext en el primer gesto del usuario
function _iosAudioUnlock() {
    try {
        if (!audioCtx) initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    } catch(e) {}
    _audioPausedByFocus = false;
    document.removeEventListener('touchstart', _iosAudioUnlock);
    document.removeEventListener('mousedown', _iosAudioUnlock);
}
document.addEventListener('touchstart', _iosAudioUnlock, { once: true, passive: true });
document.addEventListener('mousedown',  _iosAudioUnlock, { once: true, passive: true });
