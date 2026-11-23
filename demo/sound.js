// The Last : ambiance sonore et musique générées dans le navigateur (WebAudio), sans aucun fichier audio.
// Vagues, vent, oiseaux le jour, grillons la nuit, musique qui suit la tension des scènes, et bruitages cartoon.
(function () {
  let ac = null, master = null, amb = null, mus = null, fx = null, noise = null;
  let muted = false, started = false, night = false, mode = "calm", modeGain = 0, step = 0, nextT = 0, timer = null;
  let lastBlip = 0;
  try { muted = localStorage.getItem("thelast-muted") === "1"; } catch (e) {}

  const P = [0, 2, 4, 7, 9]; // gamme pentatonique
  const hz = (semi) => 220 * Math.pow(2, semi / 12);

  function makeNoise() {
    const len = ac.sampleRate * 4, b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } // bruit brun
    return b;
  }
  function whiteBuf(sec) {
    const len = Math.floor(ac.sampleRate * sec), b = ac.createBuffer(1, len, ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function loopNoise(dest, type, freq, q, gain) {
    const src = ac.createBufferSource(); src.buffer = noise; src.loop = true;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); g.gain.value = gain;
    src.connect(f).connect(g).connect(dest); src.start();
    return { src, f, g };
  }
  function lfo(param, rate, depth, base) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = rate; g.gain.value = depth; param.value = base;
    o.connect(g).connect(param); o.start();
  }

  // Une note brève (marimba, cloche, cuivre…)
  function note(dest, f, t, dur, { type = "sine", vol = 0.2, attack = 0.005, cutoff = 0, detune = 0 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out = o;
    if (cutoff) { const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = cutoff; o.connect(lp); out = lp; }
    out.connect(g).connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function burstNoise(dest, t, dur, { type = "bandpass", freq = 1000, q = 1, vol = 0.3, sweep = 0 } = {}) {
    const src = ac.createBufferSource(); src.buffer = whiteBuf(dur + 0.05);
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(dest); src.start(t); src.stop(t + dur + 0.05);
  }

  function init() {
    if (ac) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    noise = makeNoise();
    const comp = ac.createDynamicsCompressor();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.8;
    master.connect(comp).connect(ac.destination);
    amb = ac.createGain(); amb.gain.value = 0.5; amb.connect(master);
    mus = ac.createGain(); mus.gain.value = 0.22; mus.connect(master);
    fx = ac.createGain(); fx.gain.value = 0.55; fx.connect(master);

    // Les vagues : bruit grave qui enfle et retombe
    const waves = loopNoise(amb, "lowpass", 500, 0.3, 0.35);
    lfo(waves.g.gain, 0.11, 0.2, 0.3);
    lfo(waves.f.frequency, 0.11, 220, 520);
    // Le vent, plus léger
    const wind = loopNoise(amb, "bandpass", 900, 0.6, 0.05);
    lfo(wind.f.frequency, 0.05, 400, 900);

    nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 120);
    document.addEventListener("visibilitychange", () => { if (!ac) return; if (document.hidden) ac.suspend(); else if (started) ac.resume(); });
  }

  // Séquenceur : musique selon l'ambiance, oiseaux le jour, grillons la nuit
  const BPM = { calm: 84, tension: 70, challenge: 132, night: 60 };
  function schedule() {
    if (!ac || ac.state !== "running") return;
    while (nextT < ac.currentTime + 0.4) {
      const t = nextT, s = step++;
      const m = night && mode === "calm" ? "night" : mode;
      const beat = 60 / BPM[m] / 2; // croches
      if (m === "calm") {
        // marimba douce, une phrase de 16 croches
        const bar = Math.floor(s / 16) % 4, roots = [0, 5, 7, 3];
        if (s % 2 === 0 || Math.random() < 0.25) {
          const deg = P[(s * 3 + bar) % 5] + roots[bar] + (s % 8 === 4 ? 12 : 0);
          note(mus, hz(deg + 12), t, 0.5, { vol: 0.12 + (s % 4 === 0 ? 0.05 : 0) });
        }
        if (s % 8 === 0) note(mus, hz(roots[bar] - 12), t, 1.2, { type: "triangle", vol: 0.14 });
      } else if (m === "tension") {
        if (s % 4 === 0) { note(mus, 55, t, 0.25, { vol: 0.5 }); note(mus, 52, t + 0.18, 0.25, { vol: 0.35 }); } // battement de cœur
        if (s % 16 === 0) { note(mus, hz(-9), t, 3.2, { type: "sawtooth", vol: 0.05, attack: 0.8, cutoff: 500 }); note(mus, hz(-8), t, 3.2, { type: "sawtooth", vol: 0.04, attack: 0.8, cutoff: 500 }); }
        if (s % 8 === 6) note(mus, hz(15 + (s % 16 === 6 ? 0 : 1)), t, 0.6, { vol: 0.05 });
      } else if (m === "challenge") {
        if (s % 2 === 0) burstNoise(mus, t, 0.08, { type: "highpass", freq: 6000, vol: 0.12 });
        if (s % 4 === 0) note(mus, 70, t, 0.18, { vol: 0.5 });
        if (s % 4 === 2) burstNoise(mus, t, 0.12, { freq: 1800, q: 0.8, vol: 0.25 });
        const riff = [0, 0, 7, 0, 5, 0, 3, 5];
        note(mus, hz(riff[s % 8] - 12), t, 0.16, { type: "square", vol: 0.05, cutoff: 900 });
      } else if (m === "night") {
        if (s % 16 === 0) note(mus, hz(P[(s / 16) % 5] - 3), t, 2.5, { type: "triangle", vol: 0.05, attack: 0.4 });
      }
      // la nature
      if (!night && Math.random() < 0.05) bird(t);
      if (night && s % 3 === 0) cricket(t);
      nextT += beat;
    }
  }
  function bird(t) {
    const f0 = 2400 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const o = ac.createOscillator(), g = ac.createGain(), tt = t + i * 0.12;
      o.frequency.setValueAtTime(f0, tt); o.frequency.exponentialRampToValueAtTime(f0 * 1.4, tt + 0.07);
      g.gain.setValueAtTime(0, tt); g.gain.linearRampToValueAtTime(0.04, tt + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.09);
      o.connect(g).connect(amb); o.start(tt); o.stop(tt + 0.1);
    }
  }
  function cricket(t) {
    for (let i = 0; i < 3; i++) note(amb, 4300 + Math.random() * 200, t + i * 0.045, 0.03, { vol: 0.018 });
  }

  // Bruitages
  const SFX = {
    blip(t) { note(fx, 880 + Math.random() * 200, t, 0.07, { vol: 0.06 }); },
    alert(t) { note(fx, 1046, t, 0.3, { vol: 0.12 }); note(fx, 1568, t + 0.11, 0.45, { vol: 0.1 }); },
    chime(t) { [0, 4, 7, 12].forEach((d, i) => note(fx, hz(d + 24), t + i * 0.08, 0.9, { vol: 0.1 })); },
    bonk(t) {
      const o = note(fx, 520, t, 0.25, { type: "triangle", vol: 0.4 });
      o.frequency.exponentialRampToValueAtTime(130, t + 0.2);
      burstNoise(fx, t, 0.08, { freq: 500, vol: 0.2 });
    },
    crash(t) { burstNoise(fx, t, 0.7, { type: "lowpass", freq: 1400, vol: 0.5, sweep: 0.2 }); SFX.bonk(t + 0.05); },
    splash(t) { burstNoise(fx, t, 0.5, { type: "highpass", freq: 1200, vol: 0.35, sweep: 2 }); burstNoise(fx, t + 0.1, 0.4, { freq: 600, vol: 0.2 }); },
    wasps(t) {
      const o = ac.createOscillator(), g = ac.createGain(), v = ac.createOscillator(), vg = ac.createGain();
      o.type = "sawtooth"; o.frequency.value = 210; v.frequency.value = 23; vg.gain.value = 18;
      v.connect(vg).connect(o.frequency);
      const lp = ac.createBiquadFilter(); lp.type = "bandpass"; lp.frequency.value = 900; lp.Q.value = 2;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.3); g.gain.setValueAtTime(0.18, t + 2.2); g.gain.linearRampToValueAtTime(0, t + 3);
      o.connect(lp).connect(g).connect(fx); o.start(t); v.start(t); o.stop(t + 3.1); v.stop(t + 3.1);
    },
    drone(t) {
      const o = ac.createOscillator(), g = ac.createGain(), lp = ac.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(140, t); o.frequency.linearRampToValueAtTime(175, t + 1.4); o.frequency.linearRampToValueAtTime(120, t + 3.6);
      lp.type = "lowpass"; lp.frequency.value = 700;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.8); g.gain.setValueAtTime(0.09, t + 2.6); g.gain.linearRampToValueAtTime(0, t + 3.8);
      o.connect(lp).connect(g).connect(fx); o.start(t); o.stop(t + 3.9);
    },
    whoosh(t) { burstNoise(fx, t, 0.6, { freq: 400, q: 1.5, vol: 0.25, sweep: 4 }); },
    thud(t) { note(fx, 90, t, 0.3, { vol: 0.5 }); burstNoise(fx, t, 0.15, { type: "lowpass", freq: 600, vol: 0.3 }); },
    drum(t) {
      for (let i = 0; i < 26; i++) { const k = i / 26; burstNoise(fx, t + Math.pow(k, 0.8) * 2.4, 0.09, { freq: 220 + k * 160, q: 1, vol: 0.12 + k * 0.25 }); }
      note(fx, 60, t + 2.5, 0.8, { vol: 0.6 });
    },
    cheer(t) {
      burstNoise(fx, t, 1.6, { freq: 1300, q: 0.4, vol: 0.18 });
      for (let i = 0; i < 4; i++) { const o = note(fx, 1800 + Math.random() * 600, t + 0.2 + Math.random() * 0.8, 0.3, { vol: 0.03 }); o.frequency.exponentialRampToValueAtTime(2600, t + 1.4); }
    },
    gasp(t) { burstNoise(fx, t, 0.6, { freq: 900, q: 3, vol: 0.2, sweep: 0.5 }); note(fx, hz(-5), t, 1.2, { type: "triangle", vol: 0.12 }); note(fx, hz(1), t, 1.2, { type: "triangle", vol: 0.08 }); },
    tension(t) { note(fx, hz(-12), t, 1.6, { type: "sawtooth", vol: 0.08, cutoff: 600, attack: 0.05 }); note(fx, hz(-11), t, 1.6, { type: "sawtooth", vol: 0.06, cutoff: 600, attack: 0.05 }); note(fx, hz(6), t + 0.05, 0.9, { vol: 0.05 }); },
    fanfare(t) {
      const seq = [[0, 0.16], [4, 0.16], [7, 0.16], [12, 0.7]];
      let tt = t;
      for (const [d, len] of seq) { note(fx, hz(d + 3), tt, len + 0.2, { type: "sawtooth", vol: 0.1, cutoff: 2200, attack: 0.02 }); note(fx, hz(d + 3 - 12), tt, len + 0.2, { type: "square", vol: 0.04, cutoff: 1200 }); tt += len; }
    },
    pop(t) { burstNoise(fx, t, 0.4, { type: "lowpass", freq: 2000, vol: 0.3, sweep: 0.3 }); note(fx, 160, t, 0.2, { vol: 0.25 }); },
    sad(t) { [7, 6, 5, 4].forEach((d, i) => note(fx, hz(d), t + i * 0.28, 0.4, { type: "triangle", vol: 0.1 })); },
  };

  window.TheLastSound = {
    start() {
      init();
      if (!ac) return;
      started = true;
      ac.resume();
    },
    get muted() { return muted; },
    setMuted(m) {
      muted = m;
      try { localStorage.setItem("thelast-muted", m ? "1" : "0"); } catch (e) {}
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.8, ac.currentTime, 0.1);
      if (!m) this.start();
    },
    setNight(n) {
      night = n;
      if (amb) amb.gain.setTargetAtTime(n ? 0.35 : 0.5, ac.currentTime, 1);
    },
    music(m) {
      if (!BPM[m] || m === mode) return;
      mode = m;
      if (mus) mus.gain.setTargetAtTime(m === "calm" ? 0.2 : 0.3, ac.currentTime, 0.4);
    },
    sfx(name) {
      if (!ac || muted || ac.state !== "running" || !SFX[name]) return;
      if (name === "blip") { if (ac.currentTime - lastBlip < 0.25) return; lastBlip = ac.currentTime; }
      SFX[name](ac.currentTime + 0.01);
    },
  };
})();
