// Fully procedural sound: wind, snow crunch, a temple bowl, a soft drone. No audio files.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = true;
  }
  start() {
    // no audio engine at all while sound is off: an open (even silent) output can hiss on some headphones
    if (this.muted) return;
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(ctx.destination);

    // noise buffer shared by wind and footsteps
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = w * 0.6 + last * 3; }
    this.noise = buf;

    // wind: two band-passed noise layers with slow gusts
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 2400;
    this.windGain.connect(this.windFilter).connect(this.master);
    for (const [f, q, g] of [[380, 0.7, 0.5], [900, 1.2, 0.25]]) {
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lfoG = ctx.createGain(); lfoG.gain.value = f * 0.45;
      lfo.connect(lfoG).connect(bp.frequency);
      const gg = ctx.createGain(); gg.gain.value = g;
      src.connect(bp).connect(gg).connect(this.windGain);
      src.start(0, Math.random() * 2); lfo.start();
    }
    // warm drone (inside)
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.master);
    for (const [f, g] of [[98, 0.05], [147.3, 0.03], [196.4, 0.015]]) {
      const o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg).connect(this.droneGain); o.start();
    }
    // simple reverb for the bowl
    this.verb = ctx.createConvolver();
    const ir = ctx.createBuffer(2, ctx.sampleRate * 4, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = ir.getChannelData(c);
      for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / ch.length, 3);
    }
    this.verb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.35;
    this.verb.connect(vg).connect(this.master);
    if (this.amb) this.ambience(this.amb); // pick up wherever the story is
  }
  setMuted(m) {
    this.muted = m;
    if (!this.ctx) return;
    clearTimeout(this._suspendT);
    if (m) {
      // fade out, then pause the whole audio engine so it is truly silent
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
      this._suspendT = setTimeout(() => { if (this.muted) this.ctx.suspend(); }, 400);
    } else {
      this.ctx.resume();
      this.master.gain.setTargetAtTime(0.9, this.ctx.currentTime, 0.1);
    }
  }
  ambience({ wind = 0, drone = 0, muffle = false } = {}) {
    this.amb = { wind, drone, muffle }; // remembered, so sound switched on later matches the scene
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.windGain.gain.setTargetAtTime(wind, t, 1.2);
    this.droneGain.gain.setTargetAtTime(drone, t, 2);
    this.windFilter.frequency.setTargetAtTime(muffle ? 500 : 2400, t, 1);
  }
  step(soft = false) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = soft ? 'lowpass' : 'bandpass';
    bp.frequency.value = soft ? 500 : 1700 + Math.random() * 700;
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    const peak = soft ? 0.12 : 0.22;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + (soft ? 0.12 : 0.2));
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random() * 2, 0.3);
  }
  bowl(f0 = 392, gain = 0.32) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [ratio, a, dec] of [[1, 1, 7], [2.71, 0.45, 4.5], [5.18, 0.2, 2.6], [8.4, 0.08, 1.5]]) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f0 * ratio;
      const o2 = ctx.createOscillator();
      o2.frequency.value = f0 * ratio * 1.004; // slow beating
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * a, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); o2.connect(g);
      g.connect(this.master); g.connect(this.verb);
      o.start(t); o2.start(t); o.stop(t + dec); o2.stop(t + dec);
    }
  }
  ignite() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (let i = 0; i < 6; i++) {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
      const g = ctx.createGain();
      const s = t + i * 0.05 + Math.random() * 0.04;
      g.gain.setValueAtTime(0.0001, s);
      g.gain.linearRampToValueAtTime(0.08, s + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, s + 0.04);
      src.connect(hp).connect(g).connect(this.master);
      src.start(s, Math.random() * 2, 0.06);
    }
  }
  // ------------------------------------------------------------ temple score
  // A slow generative piece in D gong pentatonic (D E F# A B):
  // an "om" drone, a xiao (bamboo flute) melody, sparse guqin plucks,
  // singing bowls now and then, and a wooden fish during the offering.
  musicStart(level = 0.4) {
    this.level = level; // remembered, so switching sound on later starts at the story's level
    if (!this.ctx) return;
    const ctx = this.ctx;
    if (!this.music) {
      const bus = ctx.createGain();
      bus.gain.value = 0;
      const dry = ctx.createGain(); dry.gain.value = 0.75;
      const wet = ctx.createGain(); wet.gain.value = 0.9;
      // gate: the player's music on/off switch, separate from the story's level changes
      const gate = ctx.createGain(); gate.gain.value = this.musicOn ? 1 : 0;
      bus.connect(gate);
      gate.connect(dry).connect(this.master);
      gate.connect(wet).connect(this.verb);
      this.music = { bus, gate, phraseEnd: ctx.currentTime + 2.5, lastF: 0, beat: 1.1, timers: [] };
      this._drone(bus);
      this.music.timers.push(setInterval(() => this._schedule(), 150));
      const bowlLoop = () => {
        if (!this.music) return;
        const f = [293.66, 220, 329.63, 246.94][Math.floor(Math.random() * 4)];
        if (this.musicOn) this.bowl(f, 0.09 + Math.random() * 0.05);
        this.music.timers.push(setTimeout(bowlLoop, 15000 + Math.random() * 12000));
      };
      this.music.timers.push(setTimeout(bowlLoop, 6000));
    }
    this.musicLevel(level, 3);
  }
  /** Player toggle for the score; wind, steps and ritual sounds keep playing. */
  setMusicOn(on) {
    this.musicOn = on;
    if (this.music) this.music.gate.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.25);
  }
  musicLevel(level, seconds = 4) {
    this.level = level;
    if (!this.music) return;
    this.music.bus.gain.setTargetAtTime(level, this.ctx.currentTime, seconds / 3);
  }
  _note(deg) {
    // degree 0 = D4; five steps per octave
    const PENTA = [0, 2, 4, 7, 9];
    const o = Math.floor(deg / 5);
    const n = PENTA[((deg % 5) + 5) % 5] + 12 * o;
    return 293.66 * Math.pow(2, n / 12);
  }
  _drone(bus) {
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0.55;
    out.connect(bus);
    // slow breathing swell
    const swell = ctx.createOscillator(); swell.frequency.value = 0.045;
    const swellG = ctx.createGain(); swellG.gain.value = 0.18;
    swell.connect(swellG).connect(out.gain); swell.start();
    // low fifth (D2 + A2), filtered saw
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.03;
    const lfoG = ctx.createGain(); lfoG.gain.value = 120;
    lfo.connect(lfoG).connect(lp.frequency); lfo.start();
    lp.connect(out);
    for (const [f, g] of [[73.42, 0.09], [73.42 * 1.003, 0.07], [110, 0.05], [146.83, 0.025]]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg).connect(lp); o.start();
    }
    // a hummed "om": saw through vowel formants
    const om = ctx.createOscillator(); om.type = 'sawtooth'; om.frequency.value = 146.83;
    const omV = ctx.createOscillator(); omV.frequency.value = 4.6;
    const omVG = ctx.createGain(); omVG.gain.value = 0.6;
    omV.connect(omVG).connect(om.frequency); omV.start();
    const omG = ctx.createGain(); omG.gain.value = 0.0;
    for (const [f, q, g] of [[420, 9, 0.5], [780, 10, 0.28], [2600, 14, 0.04]]) {
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q;
      const gg = ctx.createGain(); gg.gain.value = g;
      om.connect(bp).connect(gg).connect(omG);
    }
    omG.connect(out);
    om.start();
    // the om comes and goes like a distant chant
    const omLfo = ctx.createOscillator(); omLfo.frequency.value = 0.022;
    const omLfoG = ctx.createGain(); omLfoG.gain.value = 0.11;
    omLfo.connect(omLfoG).connect(omG.gain); omLfo.start();
    const omBase = ctx.createConstantSource(); omBase.offset.value = 0.1;
    omBase.connect(omG.gain); omBase.start();
  }
  _schedule() {
    const m = this.music, ctx = this.ctx;
    if (!m || ctx.state !== 'running') return;
    if (m.phraseEnd > ctx.currentTime + 1.0) return;
    // compose the next phrase
    let t = Math.max(m.phraseEnd, ctx.currentTime + 0.1);
    const B = m.beat;
    // guqin: a low open fifth to open the phrase, sometimes an octave harmonic
    this._qin(t, 73.42, 0.22);
    this._qin(t + B * 0.5, 110, 0.14);
    if (Math.random() < 0.5) this._qin(t + B * 2, this._note(Math.random() < 0.5 ? 0 : 3), 0.08);
    let deg = m.deg ?? 3;
    const n = 3 + Math.floor(Math.random() * 4);
    let prev = m.lastF;
    for (let i = 0; i < n; i++) {
      // gentle random walk, mostly steps, occasional leap
      const r = Math.random();
      deg += r < 0.4 ? -1 : r < 0.8 ? 1 : (Math.random() < 0.5 ? -2 : 2);
      deg = Math.max(-2, Math.min(8, deg));
      if (i === n - 1) deg = Math.random() < 0.6 ? 0 : 3; // settle on D or A
      const dur = B * [1, 1, 1.5, 2, 2, 3][Math.floor(Math.random() * 6)] * (i === n - 1 ? 2 : 1);
      const f = this._note(deg);
      this._flute(t, f, dur, 0.11, Math.random() < 0.6 ? prev : 0);
      prev = f;
      t += dur;
    }
    m.deg = deg;
    m.lastF = prev;
    m.phraseEnd = t + B * (2 + Math.random() * 3); // breathe between phrases
  }
  _flute(t, f, dur, gain, fromF) {
    const ctx = this.ctx, bus = this.music.bus;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(gain, t + 0.22);
    env.gain.linearRampToValueAtTime(gain * 0.85, t + Math.max(0.3, dur * 0.6));
    env.gain.linearRampToValueAtTime(gain * 0.9, t + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.7);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    lp.connect(env).connect(bus);
    const vib = ctx.createOscillator(); vib.frequency.value = 4.8 + Math.random() * 0.6;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(f * 0.007, t + Math.min(dur, 0.9));
    vib.connect(vibG);
    const oscs = [];
    for (const [type, mult, g] of [['sine', 1, 1], ['triangle', 1.002, 0.3], ['sine', 2, 0.06]]) {
      const o = ctx.createOscillator(); o.type = type;
      if (fromF) {
        o.frequency.setValueAtTime(fromF * mult, t);
        o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.14);
      } else {
        o.frequency.setValueAtTime(f * mult * 0.985, t);
        o.frequency.exponentialRampToValueAtTime(f * mult, t + 0.1);
      }
      vibG.connect(o.frequency);
      const gg = ctx.createGain(); gg.gain.value = g;
      o.connect(gg).connect(lp);
      oscs.push(o);
    }
    // breath noise riding the tone
    const br = ctx.createBufferSource(); br.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.5; bp.Q.value = 3;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, t);
    bg.gain.linearRampToValueAtTime(gain * 0.5, t + 0.08);
    bg.gain.linearRampToValueAtTime(gain * 0.12, t + 0.35);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.5);
    br.connect(bp).connect(bg).connect(bus);
    const end = t + dur + 0.8;
    vib.start(t); vib.stop(end);
    for (const o of oscs) { o.start(t); o.stop(end); }
    br.start(t, Math.random() * 2); br.stop(end);
  }
  _qin(t, f, gain) {
    const ctx = this.ctx, bus = this.music.bus;
    const vib = ctx.createOscillator(); vib.frequency.value = 3.6;
    const vibG = ctx.createGain();
    vibG.gain.setValueAtTime(0, t);
    vibG.gain.linearRampToValueAtTime(0, t + 0.7);
    vibG.gain.linearRampToValueAtTime(f * 0.006, t + 1.4); // 吟: a slow vibrato after the pluck
    vib.connect(vibG);
    const parts = [[1, 1, 3.8], [2, 0.45, 2.4], [3, 0.25, 1.5], [4.01, 0.12, 0.9], [5.03, 0.06, 0.6]];
    for (const [k, a, dec] of parts) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(f * k * 1.008, t);
      o.frequency.exponentialRampToValueAtTime(f * k, t + 0.09);
      vibG.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(gain * a, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + dec + 0.05);
    }
    vib.start(t); vib.stop(t + 4);
    // the finger on the string
    const n = ctx.createBufferSource(); n.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(gain * 0.25, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    n.connect(bp).connect(ng).connect(bus);
    n.start(t, Math.random() * 2, 0.05);
  }
  /** Wooden fish (木鱼): `count` soft knocks, steady like a chant keeping time. */
  muyu(count = 8, interval = 0.85, gain = 0.22) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.1;
    for (let i = 0; i < count; i++) {
      const t = t0 + i * interval;
      const g = gain * (i === count - 1 ? 0.7 : 1) * (0.9 + Math.random() * 0.1);
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(720, t);
      o.frequency.exponentialRampToValueAtTime(540, t + 0.06);
      const e = ctx.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.linearRampToValueAtTime(g, t + 0.002);
      e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(e); e.connect(this.master); e.connect(this.verb);
      o.start(t); o.stop(t + 0.2);
      const n = ctx.createBufferSource(); n.buffer = this.noise;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 2;
      const ne = ctx.createGain();
      ne.gain.setValueAtTime(g * 0.5, t);
      ne.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
      n.connect(bp).connect(ne).connect(this.master);
      n.start(t, Math.random() * 2, 0.04);
    }
  }
  door() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.linearRampToValueAtTime(52, t + 1.6);
    const lp = ctx.createBiquadFilter(); lp.type = 'bandpass'; lp.frequency.value = 420; lp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.2);
    g.gain.linearRampToValueAtTime(0.0, t + 1.7);
    o.connect(lp).connect(g).connect(this.master);
    o.start(t); o.stop(t + 1.8);
  }
}
