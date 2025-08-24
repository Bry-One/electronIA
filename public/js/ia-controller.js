// --- Caps & sécurité ---
const SAFETY = {
  VOL_MIN: 0,
  VOL_MAX: 60,              // volume % max autorisé
  DVOL_MAX_PER_SEC: 10,     // variation max de volume par seconde
  FREQ_MIN: 10, FREQ_MAX: 3000
};

const IA_STATE = {
  targetFeel: 6,     // consigne 0..10 (UI slider)
  userBias: 0,       // effet des clics Plus/Moins
  lastUpdateTs: performance.now(),
  _i: 0              // intégrateur PI
};

function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function rateLimit(current, target, maxDeltaPerSec, dt){
  const maxΔ = maxDeltaPerSec * dt;
  const Δ = clamp(target - current, -maxΔ, maxΔ);
  return current + Δ;
}

// Estimation “ressentie” (0..10) sans capteurs (MVP)
function estimateFeel(step){
  const v = step.volume ?? 0;          // %
  const f = step.freq ?? 0;            // Hz
  const volPart  = (v / SAFETY.VOL_MAX) * 10;             // 0..10
  const freqPart = clamp((f - 400) / 800, 0, 1) * 3;      // 0..3
  return clamp(volPart * 0.8 + freqPart * 0.2, 0, 10);
}

// Contrôleur PI sur volume (MVP)
function adjustVolumePI(currentVol, feel, dt){
  const e = (IA_STATE.targetFeel - feel) + IA_STATE.userBias;
  const Kp = 4.0, Ki = 0.5;
  IA_STATE._i += e * dt;
  let target = currentVol + (Kp * e + Ki * IA_STATE._i);
  target = clamp(target, SAFETY.VOL_MIN, SAFETY.VOL_MAX);
  return rateLimit(currentVol, target, SAFETY.DVOL_MAX_PER_SEC, dt);
}

window.setTargetFeel = (v) => { IA_STATE.targetFeel = +v; };
window.bumpBias = (delta) => { IA_STATE.userBias = 0.8 * IA_STATE.userBias + 0.2 * delta; };

// Point d’entrée : adapte un step et renvoie un step SAFE
window.aiPolicyAdapt = function(channel, step){
  const now = performance.now();
  const dt  = Math.max(0.05, (now - IA_STATE.lastUpdateTs) / 1000);
  IA_STATE.lastUpdateTs = now;

  const feel = estimateFeel(step);
  const currentVol = step.volume ?? 0;
  const newVol = adjustVolumePI(currentVol, feel, dt);

  const newFreq = clamp(step.freq ?? 0, SAFETY.FREQ_MIN, SAFETY.FREQ_MAX);

  return { ...step, volume: newVol, freq: newFreq };
};
