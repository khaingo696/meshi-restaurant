// Procedural sound (Web Audio, no files): a wooden panel on its rail, the knock
// as it reaches the pocket, and the warm air of the room as it opens.
// Browsers only allow sound after a click / tap / key press, so the context is
// unlocked on the first one; until then every cue is silently skipped.

const STORE = 'meshi-door-sound';

export function createSound(enabled) {
  let ctx = null, out = null, noise = null;
  let muted = !enabled;
  try { if (localStorage.getItem(STORE) === 'off') muted = true; } catch { /* private mode */ }

  function unlock() {
    if (!enabled) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) {
      ctx = new AC();
      out = ctx.createGain();
      out.gain.value = muted ? 0 : 1;
      // a touch of room: a short, dark feedback echo
      const delay = ctx.createDelay(0.2), fb = ctx.createGain(), damp = ctx.createBiquadFilter();
      delay.delayTime.value = 0.045;
      fb.gain.value = 0.28;
      damp.type = 'lowpass';
      damp.frequency.value = 1800;
      out.connect(ctx.destination);
      out.connect(delay).connect(damp).connect(fb).connect(delay);
      damp.connect(ctx.destination);
      const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      let b = 0;
      for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 6 + (Math.random() * 2 - 1) * 0.25; }   // warm-ish noise
      noise = buf;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  const ready = () => ctx && ctx.state !== "closed" && !muted;   // cues scheduled while resuming play once it runs

  const src = () => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    s.loop = true;
    s.loopStart = Math.random();
    return s;
  };
  const env = (g, t, attack, hold, release, level) => {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(level, t + attack);
    g.gain.setValueAtTime(level, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  };

  // wood sliding on wood: a band of friction noise, a low rumble, and the tick of the rail
  function slide(duration = 0.5, strength = 0.6) {
    if (!ready()) return;
    const t = ctx.currentTime, end = t + duration + 0.25;
    const n = src(), band = ctx.createBiquadFilter(), low = ctx.createBiquadFilter(), g = ctx.createGain(), lg = ctx.createGain();
    band.type = 'bandpass';
    band.Q.value = 0.9;
    band.frequency.setValueAtTime(520, t);
    band.frequency.linearRampToValueAtTime(820, t + duration * 0.6);
    band.frequency.linearRampToValueAtTime(600, t + duration);
    low.type = 'lowpass';
    low.frequency.value = 170;
    const tick = ctx.createOscillator(), tickGain = ctx.createGain(), grain = ctx.createGain();   // the rail's uneven grain
    tick.type = 'square';
    tick.frequency.setValueAtTime(14, t);
    tick.frequency.linearRampToValueAtTime(26, t + duration * 0.6);
    tickGain.gain.value = 0.3;                    // grain gain swings 0.7 .. 1.3
    grain.gain.value = 1;
    tick.connect(tickGain).connect(grain.gain);
    env(g, t, Math.min(0.12, duration * 0.3), duration * 0.45, duration * 0.4, 0.09 * strength);
    env(lg, t, 0.1, duration * 0.4, duration * 0.5, 0.22 * strength);
    n.connect(band).connect(grain).connect(g).connect(out);
    n.connect(low).connect(lg).connect(out);
    n.start(t, Math.random());
    tick.start(t);
    n.stop(end);
    tick.stop(end);
  }

  // the panel reaching the pocket: a soft wooden knock
  function knock(strength = 0.8, at = 0) {
    if (!ready()) return;
    const t = ctx.currentTime + at;
    const body = ctx.createOscillator(), bg = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(150, t);
    body.frequency.exponentialRampToValueAtTime(72, t + 0.18);
    env(bg, t, 0.004, 0.01, 0.28, 0.35 * strength);
    body.connect(bg).connect(out);
    const n = src(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
    hp.type = 'bandpass';
    hp.frequency.value = 1900;
    hp.Q.value = 1.4;
    env(ng, t, 0.002, 0.005, 0.05, 0.12 * strength);
    n.connect(hp).connect(ng).connect(out);
    body.start(t);
    n.start(t);
    body.stop(t + 0.5);
    n.stop(t + 0.2);
  }

  // the room's air, warm and low, swelling as the door opens and fading with the intro
  function room(duration = 2.6) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const n = src(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    env(g, t, 0.9, duration - 1.6, 0.7, 0.06);
    n.connect(lp).connect(g).connect(out);
    n.start(t);
    n.stop(t + duration + 0.2);
  }

  return {
    get enabled() { return enabled; },
    get muted() { return muted; },
    unlock, slide, knock, room,
    setMuted(m) {
      muted = m;
      try { localStorage.setItem(STORE, m ? 'off' : 'on'); } catch { /* private mode */ }
      if (out) out.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.05);
      if (!m) unlock();
    },
    dispose() {
      const c = ctx;
      ctx = null;
      if (c) setTimeout(() => c.close().catch(() => {}), 3000);   // let the last cue ring out
    },
  };
}
