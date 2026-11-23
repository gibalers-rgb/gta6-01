// All sound is synthesized with WebAudio: no audio files, no network.
// A tiny step-sequencer plays a laid-back bass groove, and one-shots cover
// gunfire, pickups, crashes, sirens and mission jingles.

export function createAudio() {
  const A = {
    ctx: null,
    master: null,
    muted: false,
    musicOn: true,
    engineOsc: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    step: 0,
    nextStepTime: 0,
  };

  A.ensure = function ensure() {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = A.muted ? 0 : 0.5;
      A.master.connect(A.ctx.destination);
      A.nextStepTime = A.ctx.currentTime + 0.1;
      // Engine hum: a low sawtooth whose pitch follows the car.
      A.engineOsc = A.ctx.createOscillator();
      A.engineOsc.type = 'sawtooth';
      A.engineOsc.frequency.value = 50;
      A.engineGain = A.ctx.createGain();
      A.engineGain.gain.value = 0;
      const engineFilter = A.ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      A.engineOsc.connect(engineFilter);
      engineFilter.connect(A.engineGain);
      A.engineGain.connect(A.master);
      A.engineOsc.start();
      // Police siren: two alternating tones.
      A.sirenOsc = A.ctx.createOscillator();
      A.sirenOsc.type = 'triangle';
      A.sirenOsc.frequency.value = 720;
      A.sirenGain = A.ctx.createGain();
      A.sirenGain.gain.value = 0;
      A.sirenOsc.connect(A.sirenGain);
      A.sirenGain.connect(A.master);
      A.sirenOsc.start();
    } catch (err) {
      A.ctx = null;
    }
  };

  A.setMuted = function setMuted(m) {
    A.muted = m;
    if (A.master) A.master.gain.value = m ? 0 : 0.5;
  };

  A.blip = function blip(freq, dur, type = 'square', vol = 0.16) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const o = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur);
  };

  A.noise = function noise(dur, vol = 0.3, lowpass = 1200) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource();
    src.buffer = buf;
    const f = A.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = lowpass;
    const g = A.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t);
  };

  A.shot = function shot() { A.noise(0.12, 0.35, 2600); A.blip(180, 0.06, 'square', 0.1); };
  A.punch = function punch() { A.noise(0.08, 0.25, 700); };
  A.pickup = function pickup() { A.blip(880, 0.09); setTimeout(() => A.blip(1320, 0.12), 70); };
  A.crash = function crash() { A.noise(0.25, 0.4, 500); };
  A.horn = function horn() { A.blip(370, 0.18, 'sawtooth', 0.12); };
  A.door = function door() { A.noise(0.1, 0.2, 900); };
  A.busted = function busted() { A.blip(220, 0.3, 'sawtooth', 0.2); setTimeout(() => A.blip(165, 0.5, 'sawtooth', 0.2), 220); };

  A.jingle = function jingle() {
    if (!A.ctx || A.muted) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => setTimeout(() => A.blip(n, 0.16, 'triangle', 0.2), i * 110));
  };

  A.fail = function fail() {
    if (!A.ctx || A.muted) return;
    [392, 330, 262].forEach((n, i) => setTimeout(() => A.blip(n, 0.22, 'sawtooth', 0.14), i * 140));
  };

  // Called every frame: engine pitch, siren wail and the music sequencer.
  A.update = function update(dt, speedRatio, wanted) {
    if (!A.ctx) return;
    if (A.engineGain) {
      const target = speedRatio > 0.02 ? 0.05 + speedRatio * 0.06 : 0;
      A.engineGain.gain.value += (target - A.engineGain.gain.value) * 0.1;
      A.engineOsc.frequency.value = 46 + speedRatio * 130;
    }
    if (A.sirenGain) {
      const target = wanted > 0 && !A.muted ? 0.045 : 0;
      A.sirenGain.gain.value += (target - A.sirenGain.gain.value) * 0.08;
      A.sirenTimer += dt;
      if (A.sirenTimer > 0.45) {
        A.sirenTimer = 0;
        A.sirenOsc.frequency.value = A.sirenOsc.frequency.value > 800 ? 660 : 920;
      }
    }
    if (!A.musicOn || A.muted) return;
    // A minor groove: bass on steps, a hat tick on the off-beat.
    const bass = [110, 0, 110, 0, 130.8, 0, 98, 0, 110, 0, 110, 0, 146.8, 0, 123.5, 0];
    const stepDur = 0.21;
    while (A.nextStepTime < A.ctx.currentTime + 0.12) {
      const s = A.step % 16;
      const t = A.nextStepTime;
      if (bass[s] > 0) {
        const o = A.ctx.createOscillator();
        const g = A.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = bass[s];
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + stepDur * 0.9);
        o.connect(g); g.connect(A.master);
        o.start(t); o.stop(t + stepDur);
      }
      if (s % 2 === 1) {
        const len = Math.floor(A.ctx.sampleRate * 0.03);
        const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = A.ctx.createBufferSource();
        src.buffer = buf;
        const g = A.ctx.createGain();
        g.gain.value = 0.05;
        src.connect(g); g.connect(A.master);
        src.start(t);
      }
      A.step++;
      A.nextStepTime += stepDur;
    }
  };

  return A;
}
