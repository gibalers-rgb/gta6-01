// Solmar Heat — synthesized sound.
// No audio files: every effect is built with the Web Audio API so the game
// stays a handful of static files with zero network requests. The context
// is created lazily on the first user gesture (browsers block autoplay).

let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenTimer = null;
let sirenHigh = false;

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  } catch (_e) {
    ctx = null; // sound is optional; the game plays fine silent
  }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.35;
  return muted;
}

function tone(freq, dur, type = 'square', vol = 0.2, slideTo = null) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur);
}

export function sfxPickup() {
  tone(880, 0.09, 'sine', 0.25);
  setTimeout(() => tone(1320, 0.12, 'sine', 0.25), 70);
}

export function sfxSteal() {
  tone(220, 0.12, 'sawtooth', 0.18, 440);
}

export function sfxCrash() {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 0.18, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
  src.connect(gain);
  gain.connect(master);
  src.start(t0);
}

export function sfxMissionDone() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 90));
}

export function sfxBusted() {
  [392, 311, 233].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.2), i * 160));
}

// Engine hum: one oscillator whose pitch follows the car's speed.
export function setEngine(speedRatio) {
  if (!ctx || muted) return;
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineGain = ctx.createGain();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    engineGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.setTargetAtTime(55 + speedRatio * 165, ctx.currentTime, 0.05);
  engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.06 : 0, ctx.currentTime, 0.1);
}

export function stopEngine() {
  if (engineGain) engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
}

// Two-tone police siren while the player is wanted.
export function setSiren(on) {
  if (on && !sirenTimer && ctx && !muted) {
    sirenTimer = setInterval(() => {
      sirenHigh = !sirenHigh;
      tone(sirenHigh ? 950 : 700, 0.28, 'square', 0.07);
    }, 300);
  } else if (!on && sirenTimer) {
    clearInterval(sirenTimer);
    sirenTimer = null;
  }
}
