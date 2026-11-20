// Sound, synthesised with WebAudio only — no audio files, no network. Engine hum,
// sirens, gunshots, pickups and mission jingles, all from oscillators and noise.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenTimer = 0;
  let muted = false;

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

  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  function noise(dur, vol, lowpass) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass || 1200;
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
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.55;
        blip(660, 0.5, 'sine', 0.05);
        setTimeout(() => blip(520, 0.5, 'sine', 0.05), 260);
      }
    },
    shoot() {
      noise(0.12, 0.25, 900);
    },
    punch() {
      noise(0.08, 0.15, 500);
    },
    pickup() {
      blip(880, 0.12, 'square', 0.1);
      setTimeout(() => blip(1318, 0.16, 'square', 0.1), 90);
    },
    cash() {
      blip(1046, 0.1, 'triangle', 0.12);
      setTimeout(() => blip(1568, 0.18, 'triangle', 0.12), 100);
    },
    missionPass() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.14), i * 130));
    },
    missionFail() {
      [392, 330, 262].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sawtooth', 0.1), i * 160));
    },
    busted() {
      blip(220, 0.5, 'sawtooth', 0.12);
    },
  };
}
