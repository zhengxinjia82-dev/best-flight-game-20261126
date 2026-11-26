// audio.js — All sound is synthesised with WebAudio: engine drone, wind,
// scoop splash, drop whoosh, fire crackle and chimes. One job: sound with
// no audio files, no network, started only after the first user gesture.
let ctx = null;
let master = null;
let engineOsc = null, engineGain = null, windSrc = null, windGain = null;
let muted = false;
let crackleTimer = null;

export function isMuted() { return muted; }

export function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // Engine: two detuned saws through a lowpass, pitch follows throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(lp); engineOsc2.connect(lp);
    lp.connect(engineGain); engineGain.connect(master);
    engineOsc.start(); engineOsc2.start();
    engineOsc._mate = engineOsc2;
    // Wind: looped filtered noise, loudness follows airspeed.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    windSrc = ctx.createBufferSource();
    windSrc.buffer = buf; windSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(bp); bp.connect(windGain); windGain.connect(master);
    windSrc.start();
  } catch { ctx = null; }
}

export function setEngine(throttle, speed) {
  if (!ctx || !engineOsc) return;
  const t = ctx.currentTime;
  engineOsc.frequency.setTargetAtTime(48 + throttle * 75 + speed * 0.25, t, 0.1);
  engineOsc._mate.frequency.setTargetAtTime(48.7 + throttle * 76 + speed * 0.25, t, 0.1);
  engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.15);
  windGain.gain.setTargetAtTime(Math.min(0.16, speed * 0.0016), t, 0.2);
}

function blip(freq, dur, type = 'sine', vol = 0.25, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t);
}

export function playScoop() { noiseBurst(0.9, 0.5, 900); blip(220, 0.3, 'sine', 0.12); }
export function playDrop() { noiseBurst(1.1, 0.55, 1600); }
export function playFireOut() { blip(660, 0.18, 'sine', 0.28); blip(880, 0.22, 'sine', 0.28, 0.12); blip(1320, 0.3, 'sine', 0.22, 0.24); }
export function playLegDone() { [523, 659, 784, 1046].forEach((f, i) => blip(f, 0.25, 'triangle', 0.25, i * 0.11)); }
export function playAlarm() { blip(440, 0.16, 'square', 0.12); blip(440, 0.16, 'square', 0.12, 0.22); }
export function playThud() { noiseBurst(0.35, 0.6, 300); blip(70, 0.3, 'sine', 0.4); }
export function playClick() { blip(900, 0.06, 'square', 0.12); }

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// Crackle near fires: a soft random pop loop while flying, volume by distance.
export function setCrackle(distanceToFire) {
  if (!ctx || muted) return;
  if (crackleTimer) return;
  crackleTimer = setInterval(() => {
    if (distanceToFire < 500 && Math.random() < 0.6) {
      noiseBurst(0.08, 0.05 + 0.1 * (1 - distanceToFire / 500), 2400);
    }
  }, 140);
}
