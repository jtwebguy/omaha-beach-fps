// Procedural Web Audio sound effects — no external audio files required.
export class AudioSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this.makeNoise(2);
    this.startAmbience();
  }

  makeNoise(seconds) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  noiseBurst({ duration = 0.3, freq = 1200, q = 0.7, gain = 1, type = 'lowpass', attack = 0.002, when = 0 }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(filter).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + duration + 0.05);
  }

  tone({ freq = 440, duration = 0.2, gain = 0.3, type = 'sine', when = 0, slideTo = null }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + duration);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + duration + 0.05);
  }

  rifleShot() {
    this.noiseBurst({ duration: 0.08, freq: 6000, gain: 1.2 });
    this.noiseBurst({ duration: 0.5, freq: 900, gain: 0.9 });
    this.tone({ freq: 120, duration: 0.25, gain: 0.6, slideTo: 40 });
  }

  garandPing() {
    this.tone({ freq: 2600, duration: 0.6, gain: 0.18, when: 0.05 });
    this.tone({ freq: 3900, duration: 0.4, gain: 0.08, when: 0.05 });
  }

  reload() {
    this.noiseBurst({ duration: 0.06, freq: 3000, type: 'bandpass', q: 3, gain: 0.5, when: 0.3 });
    this.noiseBurst({ duration: 0.08, freq: 2000, type: 'bandpass', q: 3, gain: 0.6, when: 1.2 });
    this.noiseBurst({ duration: 0.1, freq: 1500, type: 'bandpass', q: 2, gain: 0.7, when: 1.9 });
  }

  dryFire() {
    this.noiseBurst({ duration: 0.04, freq: 2500, type: 'bandpass', q: 4, gain: 0.4 });
  }

  // Enemy rifle / MG at a distance — quieter and duller
  distantShot(distance = 50) {
    const g = Math.max(0.08, 0.7 - distance / 180);
    this.noiseBurst({ duration: 0.35, freq: 700 - Math.min(400, distance * 3), gain: g });
  }

  bulletWhiz() {
    this.noiseBurst({ duration: 0.15, freq: 3500, type: 'bandpass', q: 6, gain: 0.35 });
  }

  hit() {
    this.noiseBurst({ duration: 0.07, freq: 1500, type: 'bandpass', q: 2, gain: 0.5 });
  }

  hurt() {
    this.noiseBurst({ duration: 0.25, freq: 400, gain: 0.8 });
  }

  explosion(distance = 60) {
    const g = Math.max(0.15, 1.3 - distance / 120);
    this.noiseBurst({ duration: 1.8, freq: 300, gain: g, attack: 0.01 });
    this.tone({ freq: 70, duration: 1.2, gain: g * 0.7, slideTo: 25 });
  }

  startAmbience() {
    // Surf: looping filtered noise with slow swell
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(4);
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 500;
    const g = this.ctx.createGain(); g.gain.value = 0.12;
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.12;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 0.08;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start(); lfo.start();
  }
}
