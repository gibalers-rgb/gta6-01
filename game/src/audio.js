// Sound, synthesised with WebAudio only — no audio files, no network. Engine
// hum, sirens, a horn, gunshots, pickups and job jingles come from one small
// tone helper, and a procedural music loop — a bassline with chord stabs —
// keeps the city moving.
export function makeAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenIn = 0;
  let muted = false;
  let musicIn = 0;
  let musicAt = 0;
  // A minor-key loop: bass notes with a stab chord every four steps.
  const BASS = [55, 0, 65.41, 0, 73.42, 0, 82.41, 98, 0, 82.41, 73.42, 0, 65.41, 0, 55, 0];
  const STAB = [220, 261.63, 329.63];
  const STEP_SECS = 0.32;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume();
  }

  /** One enveloped oscillator note. */
  function tone(freq, dur, type, vol, when) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime + (when || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  }

  function hiss(dur, vol, cutoff) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.2;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    engine(speed, inCar) {
      if (!ensure() || muted) return;
      const target = inCar ? 0.05 + Math.min(0.09, Math.abs(speed) / 6000) : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + Math.abs(speed) / 6, ctx.currentTime, 0.08);
    },
    siren(dt, wanted) {
      if (!ensure() || muted || wanted === 0) return;
      sirenIn -= dt;
      if (sirenIn <= 0) {
        sirenIn = 0.55;
        tone(660, 0.5, 'sine', 0.05);
        tone(520, 0.5, 'sine', 0.05, 0.26);
      }
    },
    /** One tick of the music loop: bass note, hat, and a stab each bar. */
    music(dt, playing) {
      if (!ensure() || muted || !playing) return;
      musicIn -= dt;
      if (musicIn > 0) return;
      musicIn += STEP_SECS;
      const bass = BASS[musicAt % BASS.length];
      if (bass) tone(bass, STEP_SECS * 0.9, 'triangle', 0.07);
      if (musicAt % 2 === 1) hiss(0.03, 0.03, 6000);
      if (musicAt % 16 === 8) {
        for (const f of STAB) tone(f, 0.5, 'sine', 0.03);
      }
      musicAt += 1;
    },
    /** Two-tone car horn (H while driving). */
    honk() {
      tone(370, 0.28, 'square', 0.09);
      tone(466, 0.28, 'square', 0.07);
    },
    shoot() {
      hiss(0.12, 0.25, 900);
    },
    punch() {
      hiss(0.08, 0.15, 500);
    },
    pickup() {
      tone(880, 0.12, 'square', 0.1);
      tone(1318, 0.16, 'square', 0.1, 0.09);
    },
    cash() {
      tone(1046, 0.1, 'triangle', 0.12);
      tone(1568, 0.18, 'triangle', 0.12, 0.1);
    },
    jobDone() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'triangle', 0.14, i * 0.13));
    },
    jobFailed() {
      [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sawtooth', 0.1, i * 0.16));
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.12);
    },
  };
}
