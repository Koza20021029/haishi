/* 《海市》的聲音：沒有任何音檔，全部在瀏覽器裡即時合成，三頁共用。
   背景音樂：很慢的五聲音階和弦，像蜃氣一樣浮著；偶爾落下一顆珍珠般的高音。
   環境聲：海、雨、市場的人聲、日光燈的嗡嗡聲、風，各自一條音量，跟著畫面混（HaishiSound.mix）。
   音效：漣漪、鐵捲門、紙、夾子、秤、滴水、風聲（HaishiSound.fx）。
   瀏覽器規定要先按一下、點一下或按一個鍵才能出聲，所以第一次互動時才開始。
   開關記在 localStorage；頁面上有 [data-sound] 的按鈕會自動接上。 */
(() => {
  const KEY = 'haishi-sound';
  let on = true; try { on = localStorage.getItem(KEY) !== '0'; } catch (e) {}
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, out, music, amb, fx, verb, noise, brown, ready = false, timers = [];
  const level = { sea: .55, rain: 0, market: 0, hum: 0, wind: .25, music: .8 };   // 目標音量 0–1
  const beds = {};
  const listeners = new Set();

  /* ---------- 建立聲音的線路 ---------- */
  function build() {
    if (ctx || !AC) return !!ctx;
    try { ctx = new AC(); } catch (e) { return false; }
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3; comp.connect(ctx.destination);
    out = ctx.createGain(); out.gain.value = 0; out.connect(comp);
    // 殘響：一段自己做的、慢慢消失的雜訊，當成市場頂棚下面的回音
    verb = ctx.createConvolver(); verb.buffer = impulse(3.4, 2.6); const wet = ctx.createGain(); wet.gain.value = .55; verb.connect(wet); wet.connect(out);
    music = ctx.createGain(); music.gain.value = level.music * .5; music.connect(out); music.connect(verb);
    amb = ctx.createGain(); amb.gain.value = .9; amb.connect(out);
    fx = ctx.createGain(); fx.gain.value = .8; fx.connect(out); const fxv = ctx.createGain(); fxv.gain.value = .35; fx.connect(fxv); fxv.connect(verb);
    noise = noiseBuf(false); brown = noiseBuf(true);
    // 海：低沉的浪，一波一波湧上來又退下去
    beds.sea = bed(brown, [['lowpass', 460, .7]], .085, .55);
    // 雨：細細的高頻
    beds.rain = bed(noise, [['highpass', 1900, .6], ['lowpass', 7200, .6]], .23, .18);
    // 市場：中頻的人聲嘈雜，帶一點忽大忽小
    beds.market = bed(noise, [['bandpass', 520, .8], ['lowpass', 1400, .7]], .9, .3);
    // 風：很慢地掃過的窄頻
    beds.wind = bed(noise, [['bandpass', 340, 1.6]], .045, .4, true);
    // 日光燈：120Hz 的嗡嗡聲
    { const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 120; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(amb); o.start(); beds.hum = { g, k: .05 }; }
    Object.keys(level).forEach(apply);
    ready = true;
    return true;
  }
  function impulse(sec, decay) {
    const n = Math.floor(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay); }
    return b;
  }
  function noiseBuf(isBrown) {
    const n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); let last = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (isBrown) { last = (last + .02 * w) / 1.02; d[i] = last * 3.4; } else d[i] = w; }
    return b;
  }
  // 一條環境聲：雜訊 → 濾波 → 音量，再加一個很慢的起伏（lfo），像浪或人潮
  function bed(buf, filters, lfoHz, depth, sweep) {
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = Math.random();
    let node = src, first = null;
    filters.forEach(([type, freq, q]) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; node.connect(f); node = f; if (!first) first = f; });
    const g = ctx.createGain(); g.gain.value = 0; node.connect(g); g.connect(amb);
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = lfoHz; lfo.connect(lg);
    if (sweep) { lg.gain.value = 160; lg.connect(first.frequency); }    // 風：掃頻率
    else { const sw = ctx.createGain(); sw.gain.value = 1; g.connect(sw); lg.gain.value = depth; lg.connect(sw.gain); g.disconnect(); g.connect(sw); sw.connect(amb); }
    lfo.start(); src.start();
    return { g, k: sweep ? .5 : .55 };
  }
  function apply(name) {
    if (!ctx) return;
    const t = ctx.currentTime, v = level[name];
    if (name === 'music') music.gain.setTargetAtTime(v * .5, t, 1.4);
    else if (beds[name]) beds[name].g.gain.setTargetAtTime(v * beds[name].k, t, 1.1);
  }

  /* ---------- 背景音樂：D 的五聲音階，九秒換一個和弦 ---------- */
  const N = { D3: 146.83, E3: 164.81, A3: 220, B3: 246.94, D4: 293.66, E4: 329.63, Fs4: 369.99, A4: 440, B4: 493.88, D5: 587.33, E5: 659.25, Fs5: 739.99, A5: 880, B5: 987.77, D6: 1174.66 };
  const CHORDS = [['D3', 'A3', 'Fs4', 'A4'], ['B3', 'D4', 'Fs4', 'B4'], ['E3', 'B3', 'D4', 'A4'], ['A3', 'D4', 'E4', 'A4'], ['D3', 'A3', 'E4', 'Fs4'], ['B3', 'E4', 'Fs4', 'D5']];
  const BELLS = ['D5', 'E5', 'Fs5', 'A5', 'B5', 'D6', 'A4'];
  let chordI = 0;
  function pad(freq, t0, dur, gain = .07) {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900 + Math.random() * 500; lp.Q.value = .4;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + 3.2); g.gain.setValueAtTime(gain, t0 + dur - 3.5); g.gain.linearRampToValueAtTime(0, t0 + dur + 1);
    [[0, 'sine'], [5, 'triangle'], [-6, 'sine']].forEach(([cents, type], k) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * (k === 2 ? 2 : 1); o.detune.value = cents;
      const og = ctx.createGain(); og.gain.value = k === 2 ? .18 : .5; o.connect(og); og.connect(lp); o.start(t0); o.stop(t0 + dur + 1.2);
    });
    lp.connect(g); g.connect(music);
  }
  function bell(freq, t0 = ctx.currentTime, gain = .05, dest = music) {
    const o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq; m.frequency.value = freq * 2.01; mg.gain.setValueAtTime(freq * .9, t0); mg.gain.exponentialRampToValueAtTime(1, t0 + 1.6);
    m.connect(mg); mg.connect(o.frequency);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .006); g.gain.exponentialRampToValueAtTime(.0001, t0 + 3.2);
    o.connect(g); g.connect(dest); o.start(t0); m.start(t0); o.stop(t0 + 3.3); m.stop(t0 + 3.3);
  }
  function loopMusic() {
    if (!ctx || !on) return;
    const t = ctx.currentTime + .05, ch = CHORDS[chordI++ % CHORDS.length];
    ch.forEach((n, i) => pad(N[n], t + i * .35, 10.5, i ? .055 : .075));
    timers.push(setTimeout(loopMusic, 9000));
  }
  function loopBells() {
    if (!ctx || !on) return;
    if (level.music > .05) { const n = BELLS[Math.floor(Math.random() * BELLS.length)]; bell(N[n], ctx.currentTime + .02, .03 + level.music * .03);
      if (Math.random() < .35) bell(N[BELLS[Math.floor(Math.random() * BELLS.length)]], ctx.currentTime + .42, .022); }
    timers.push(setTimeout(loopBells, 2600 + Math.random() * 4200));
  }

  /* ---------- 音效 ---------- */
  function burst(t0, dur, type, freq, q, gain, dest = fx) {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t0, Math.random() * 3); s.stop(t0 + dur + .02);
    return f;
  }
  function tone(t0, f0, f1, dur, gain, type = 'sine', dest = fx) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t0); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur * .8);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + .004); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + .02);
  }
  const PENTA = ['D5', 'E5', 'Fs5', 'A5', 'B5', 'D6'];
  const FX = {
    // 點海面：水滴落下的「咚」，再跟一顆依位置決定音高的珍珠音
    ripple(o = {}) { const t = ctx.currentTime; tone(t, 760, 210, .22, .16); burst(t, .18, 'bandpass', 1400, 1.2, .05);
      bell(N[PENTA[Math.max(0, Math.min(PENTA.length - 1, Math.round((o.pitch ?? Math.random()) * (PENTA.length - 1))))]], t + .05, .06, fx); },
    chime(o = {}) { const t = ctx.currentTime; bell(N[PENTA[o.i ?? 2]], t, o.gain ?? .06, fx); },
    // 拉起鐵捲門：一片一片門板捲上去的嘩啦聲，越來越快
    shutter() { const t = ctx.currentTime; for (let k = 0; k < 16; k++) { const tt = t + k * (.034 - k * .0011); burst(tt, .05, 'bandpass', 1700 + k * 90, 3, .05 + k * .004); }
      burst(t, .55, 'lowpass', 220, .7, .1); },
    // 鐵捲門拉下來（換頁）
    shut() { const t = ctx.currentTime; for (let k = 0; k < 14; k++) burst(t + k * .038, .05, 'bandpass', 2300 - k * 80, 3, .055); burst(t + .52, .3, 'lowpass', 160, .8, .22); },
    paper() { const t = ctx.currentTime; burst(t, .09, 'highpass', 3200, .7, .07); burst(t + .05, .07, 'highpass', 4200, .7, .04); },
    clip() { const t = ctx.currentTime; tone(t, 1900, 1500, .05, .07, 'square'); burst(t, .04, 'highpass', 5000, .8, .06); },
    tick() { const t = ctx.currentTime; tone(t, 2600, 2600, .03, .02); },
    // 秤夠重了：「叮」兩聲
    scale() { const t = ctx.currentTime; tone(t, 1318.5, 1318.5, 1.3, .07); tone(t + .12, 1975.5, 1975.5, 1.5, .05); },
    // 冰上的一滴水
    drip() { const t = ctx.currentTime; tone(t, 620, 1500, .09, .12); tone(t + .1, 900, 1700, .07, .05); },
    // 東西放上秤：低低的一聲
    clunk() { const t = ctx.currentTime; tone(t, 140, 90, .25, .2); burst(t, .12, 'lowpass', 600, .7, .08); },
    // 成交：三顆音往上走
    deal() { const t = ctx.currentTime; ['A4', 'D5', 'Fs5', 'A5'].forEach((n, i) => bell(N[n], t + i * .14, .07, fx)); },
    // 起霧、換頁的風聲
    whoosh() { const t = ctx.currentTime, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noise; f.type = 'bandpass'; f.Q.value = 1.1; f.frequency.setValueAtTime(260, t); f.frequency.exponentialRampToValueAtTime(1800, t + .7);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.22, t + .45); g.gain.exponentialRampToValueAtTime(.0001, t + .95);
      src.connect(f); f.connect(g); g.connect(fx); src.start(t, Math.random() * 3); src.stop(t + 1); },
    // 海市散掉：一串往下飄的高音
    scatter() { const t = ctx.currentTime; ['D6', 'B5', 'A5', 'Fs5', 'E5'].forEach((n, i) => bell(N[n], t + i * .11, .035, fx)); }
  };

  /* ---------- 開始、開關、頁面切換 ---------- */
  function start() {
    if (!on || !AC) return;
    const fresh = !ctx; if (!build()) return;
    if (ctx.state === 'suspended') ctx.resume();
    out.gain.cancelScheduledValues(ctx.currentTime); out.gain.setTargetAtTime(.62, ctx.currentTime, fresh ? 1.2 : .4);
    if (!timers.length) { loopMusic(); setTimeout(loopBells, 1800); }
  }
  function stop() {
    timers.forEach(clearTimeout); timers = [];
    if (!ctx) return; out.gain.setTargetAtTime(0, ctx.currentTime, .25);
    setTimeout(() => { if (!on && ctx && ctx.state === 'running') ctx.suspend(); }, 1200);
  }
  function setOn(v) {
    on = !!v; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {}
    on ? start() : stop(); sync(); listeners.forEach(fn => fn(on));
  }
  function sync() { document.querySelectorAll('[data-sound]').forEach(b => { b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? '聲音：開著，按一下關掉' : '聲音：關著，按一下打開'); }); }
  // 第一次互動才開始（不是捲動，是按、點、按鍵）
  const first = e => { if (e.target && e.target.closest && e.target.closest('[data-sound]')) return; start(); };
  ['pointerdown', 'keydown'].forEach(ev => addEventListener(ev, first, { capture: true, passive: true }));
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-sound]'); if (!b) return; e.preventDefault();
    // 開著但還沒出聲（還沒互動過）：第一次按是「開始」，不是關掉
    if (on && (!ctx || ctx.state !== 'running')) { start(); sync(); return; }
    setOn(!on); });
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
  addEventListener('pageshow', e => { if (e.persisted && ctx && on) { ctx.resume(); out.gain.setTargetAtTime(.62, ctx.currentTime, .4); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync); else sync();

  let meter = null;
  window.HaishiSound = {
    isOn: () => on, toggle: () => setOn(!on), set: setOn, onChange: fn => listeners.add(fn),
    state: () => (ctx ? ctx.state : 'none'),
    // 檢查用：現在輸出的音量（RMS），沒有在出聲時是 0
    rms() { if (!ctx) return 0; if (!meter) { meter = ctx.createAnalyser(); meter.fftSize = 2048; out.connect(meter); }
      const d = new Float32Array(meter.fftSize); meter.getFloatTimeDomainData(d); let v = 0; for (const x of d) v += x * x; return Math.sqrt(v / d.length); },
    levels: () => ({ ...level }),
    // 環境聲和音樂的比例，例如 mix({ sea: .8, market: .2 })；沒給的維持原樣
    mix(o) { Object.keys(o).forEach(k => { if (!(k in level)) return; const v = Math.max(0, Math.min(1, o[k])); if (Math.abs(level[k] - v) < .02) return; level[k] = v; apply(k); }); },
    fx(name, o) { if (!on || !ready || !FX[name] || ctx.state !== 'running') return; try { FX[name](o); } catch (e) {} },
    // 換頁：先放一個轉場的聲音，再把整體音量收掉
    leave(kind) { if (!on || !ready) return; this.fx(kind === 'shutter' ? 'shut' : 'whoosh'); out.gain.setTargetAtTime(0, ctx.currentTime + .25, .22); }
  };
})();
