let ctx = null;
let master = null;
let ambientStarted = false;

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function env(gainNode, t0, attack, decay, peak = 0.06) {
  const g = gainNode.gain;
  g.cancelScheduledValues(t0);
  g.setValueAtTime(0.0001, t0);
  g.exponentialRampToValueAtTime(peak, t0 + attack);
  g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone(freq, dur = 0.12, type = 'sine', gain = 0.05, slide = 0) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t0 + dur);
  env(g, t0, 0.005, dur, gain);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.12, gain = 0.04, freq = 1400, q = 1) {
  const c = ensure();
  if (!c) return;
  const t0 = c.currentTime;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(filter).connect(g).connect(master);
  src.start(t0);
}

function startAmbient() {
  if (ambientStarted) return;
  const c = ensure();
  if (!c) return;
  ambientStarted = true;
  const len = c.sampleRate * 3;
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    last = last * 0.98 + (Math.random() * 2 - 1) * 0.02;
    data[i] = last;
  }
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  const g = c.createGain();
  g.gain.value = 0.16;
  src.connect(filter).connect(g).connect(master);
  src.start();

  const lfo = c.createOscillator();
  const lfoGain = c.createGain();
  lfo.frequency.value = 0.07;
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain).connect(g.gain);
  lfo.start();
}

export function createAudio() {
  return {
    start() {
      ensure();
      startAmbient();
    },
    click() {
      tone(880, 0.05, 'triangle', 0.03);
    },
    tick() {
      tone(300, 0.04, 'square', 0.015);
    },
    pick() {
      noise(0.08, 0.03, 900, 1.2);
      tone(220, 0.07, 'sine', 0.025);
    },
    snap() {
      noise(0.06, 0.05, 2200, 1.4);
      tone(1500, 0.09, 'triangle', 0.04, -400);
      tone(340, 0.14, 'sine', 0.03);
    },
    equip() {
      tone(520, 0.1, 'sine', 0.04);
      setTimeout(() => tone(780, 0.16, 'sine', 0.04), 90);
    },
    error() {
      tone(180, 0.16, 'sawtooth', 0.03, -60);
      tone(120, 0.2, 'square', 0.02);
    },
    success() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.04), i * 110));
    },
  };
}
