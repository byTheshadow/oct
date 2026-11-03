/* =========================================================
 * 音频：程序合成氛围 BGM + 文件 BGM（带"隔墙闷音"低通滤镜）+ WebAudio 合成音效
 *   unlock()          首次点击时调用（同时启动合成 BGM）
 *   playBgm(fadeSec)  文件 BGM 淡入播放
 *   crossToRealBgm(fadeSec)  合成 BGM 淡出，文件 BGM 淡入（Scene 9 enter 调用一次）
 *   setClarity(t,sec) 0 = 隔着墙，1 = 完全清晰（合成 BGM 和文件 BGM 都跟随）
 *   setMuted(bool) / toggleMute()  全局静音（BGM + 所有音效），状态存 localStorage
 *   blip / click / whoosh / coin(i) / meow
 * ========================================================= */
App.audio = (function () {
  const cfg = App.config;
  let ctx = null, master = null;
  let bgmEl = null, lp = null, bgmGain = null, bgmStarted = false;
  let clarity = 0;
  let noiseBuf = null, coinBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('oct.muted') === '1'; } catch (e) { /* 忽略 */ }

  const voices = {
    bt:  { freq: 640, type: 'triangle', vol: 0.045, dur: 0.05, jitter: 0.08 }, // 白团子："嘟嘟"
    cat: { freq: 430, type: 'sine',     vol: 0.03,  dur: 0.04, jitter: 0.1 },  // 小寒的思考气泡
    tap: { freq: 990, type: 'sine',     vol: 0.025, dur: 0.03, jitter: 0 }
  };

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    return ctx;
  }

  /** 静音：master 是 BGM 和所有合成音效的共同出口，砍它一个就全静音 */
  function setMuted(m) {
    muted = !!m;
    try { localStorage.setItem('oct.muted', muted ? '1' : '0'); } catch (e) { /* 忽略 */ }
    if (master && ctx && ctx.state !== 'closed') {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.08);
    }
    return muted;
  }
  const toggleMute = () => setMuted(!muted);

  const ready = () => !!ctx && ctx.state === 'running';

  /** 必须在点击事件里调用 */
  async function unlock() {
    if (!ensure()) return;
    const resumed = ctx.state !== 'running' ? ctx.resume() : Promise.resolve();
    // 部分安卓 WebView 需要先播一个静音 buffer
    try {
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(master);
      s.start(0);
    } catch (e) { /* 忽略 */ }
    try { await resumed; } catch (e) { /* 忽略 */ }
    setupBgm();
    loadCoin();
    if (pendingCrossSec !== null) {
      // 调试直跳 Scene 9 时，enter() 可能早于首次点击：这里补上过渡，不再起合成 BGM
      const sec = pendingCrossSec;
      pendingCrossSec = null;
      crossToRealBgm(sec);
    } else {
      startSynth();
    }
  }

  // ---------- 文件 BGM ----------
  const freqFor = (t) => 320 * Math.pow(20000 / 320, t);
  const volFor = (t) => cfg.BGM_VOLUME * (0.55 + 0.45 * t);

  function setupBgm() {
    if (bgmEl || !cfg.BGM_URL || !ctx) return;
    bgmEl = new Audio(cfg.BGM_URL);
    bgmEl.loop = true;
    bgmEl.preload = 'auto';
    bgmEl.setAttribute('playsinline', '');
    const src = ctx.createMediaElementSource(bgmEl);
    lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.6;
    lp.frequency.value = freqFor(clarity);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = 0.0001;
    src.connect(lp);
    lp.connect(bgmGain);
    bgmGain.connect(master);
  }

  function rampGain(target, sec) {
    const now = ctx.currentTime;
    bgmGain.gain.cancelScheduledValues(now);
    bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
    bgmGain.gain.linearRampToValueAtTime(target, now + Math.max(0.01, sec));
  }

  function playBgm(fadeSec = 4) {
    if (!bgmEl) return;
    bgmStarted = true;
    const p = bgmEl.play();
    if (p && p.catch) p.catch((e) => console.warn('[audio] BGM 播放失败', e));
    rampGain(volFor(clarity), fadeSec);
  }

  function setClarity(t, sec = 3) {
    clarity = t;
    if (!ctx) return; // 解锁前只记下数值，startSynth / setupBgm 会按它初始化
    const now = ctx.currentTime;
    if (lp) {
      lp.frequency.cancelScheduledValues(now);
      lp.frequency.setValueAtTime(lp.frequency.value, now);
      lp.frequency.exponentialRampToValueAtTime(freqFor(t), now + Math.max(0.01, sec));
      if (bgmStarted) rampGain(volFor(t), sec);
    }
    if (synthOn) {
      synthLp.frequency.cancelScheduledValues(now);
      synthLp.frequency.setValueAtTime(synthLp.frequency.value, now);
      synthLp.frequency.exponentialRampToValueAtTime(synthFreqFor(t), now + Math.max(0.01, sec));
      rampSynthGain(synthVolFor(t), sec);
    }
  }

  // ---------- 合成 BGM（Scene 9 之前的氛围声）----------
  // 四个和弦循环，每个和弦 4 个振荡器，靠长起音/长释音互相交叉淡化；
  // 琶音随机留白，所以听起来不会机械重复。
  // 没有卷积混响，空间感只用一个 DelayNode 反馈做。同时发声的振荡器约 8~11 个。
  const SYNTH_VOL = 0.7;       // 比 coin(0.09) 这类音效低，垫在下面
  const STEP_SEC = 1;          // 调度步长
  const STEPS_PER_CHORD = 8;
  const CHORD_ATTACK = 3.5;
  const LOOKAHEAD = 1.5;       // 向前排程的秒数
  const TICK_MS = 500;
  // 相对根音的半音数。根音取自 COIN_BASE_HZ，金币音（同根大调五声）不会和它打架
  const CHORDS = [
    [0, 7, 14, 16],   // I add9
    [-3, 4, 12, 16],  // vi
    [-7, 0, 9, 14],   // IV add9
    [-5, 2, 7, 14]    // V 空五度
  ];

  let synthOn = false, synthRetired = false;
  let synthTimer = null, synthStep = 0, synthNextT = 0, synthRoot = 0;
  let synthBus = null, synthLp = null, synthGain = null, synthEcho = null, synthLfo = null;
  let pendingCrossSec = null;

  const synthFreqFor = (t) => 420 * Math.pow(5200 / 420, t);
  const synthVolFor = (t) => SYNTH_VOL * (0.6 + 0.4 * t);

  function synthRootHz() {
    let f = cfg.COIN_BASE_HZ > 0 ? cfg.COIN_BASE_HZ : 261.63;
    while (f >= 262) f /= 2;
    while (f < 131) f *= 2;
    return f;
  }

  function rampSynthGain(target, sec) {
    const now = ctx.currentTime;
    synthGain.gain.cancelScheduledValues(now);
    synthGain.gain.setValueAtTime(synthGain.gain.value, now);
    synthGain.gain.linearRampToValueAtTime(target, now + Math.max(0.01, sec));
  }

  /** 排一个自带包络、到点自己结束的振荡器 */
  function synthNote(dest, type, freq, detune, t, attack, hold, release, peak) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
    o.connect(g); g.connect(dest);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t);
    o.stop(t + attack + hold + release + 0.05);
  }

  const semiHz = (semi) => synthRoot * Math.pow(2, semi / 12);

  function scheduleChord(tones, t) {
    const chordSec = STEP_SEC * STEPS_PER_CHORD;
    const hold = chordSec - CHORD_ATTACK;
    tones.forEach((semi, i) => {
      // 最高音用一点点锯齿波：它的泛音最受低通影响，clarity 变化主要靠它听出来
      const sheen = i === tones.length - 1;
      synthNote(
        synthBus, sheen ? 'sawtooth' : 'triangle', semiHz(semi),
        sheen ? 5 : (i - 1) * 3, t, CHORD_ATTACK, hold, CHORD_ATTACK, sheen ? 0.012 : 0.038
      );
    });
  }

  function scheduleArp(tones, t) {
    const semi = tones[Math.floor(Math.random() * tones.length)];
    const octave = Math.random() < 0.3 ? 24 : 12;
    const dest = Math.random() < 0.7 ? synthEcho : synthBus;
    synthNote(dest, 'sine', semiHz(semi + octave), 0, t, 0.03, 0, 1.8, 0.03);
  }

  function scheduleStep(step, t) {
    const inChord = step % STEPS_PER_CHORD;
    const chord = Math.floor(step / STEPS_PER_CHORD) % CHORDS.length;
    if (inChord === 0) scheduleChord(CHORDS[chord], t);
    if (inChord >= 2 && Math.random() < 0.45) scheduleArp(CHORDS[chord], t + Math.random() * 0.12);
  }

  function synthTick() {
    if (!synthOn || !ctx || ctx.state === 'closed') return;
    const now = ctx.currentTime;
    // 主线程卡顿后只对齐时钟，不补排错过的音，免得一次炸出一串
    if (synthNextT < now) synthNextT = now + 0.05;
    // ctx 暂停时 currentTime 不动，这里不会多排，切回来也不会叠声
    while (synthNextT < now + LOOKAHEAD) {
      scheduleStep(synthStep++, synthNextT);
      synthNextT += STEP_SEC;
    }
  }

  function startSynth() {
    if (synthOn || synthRetired || !ctx || ctx.state === 'closed') return;
    synthOn = true;
    synthRoot = synthRootHz();

    synthBus = ctx.createGain();
    synthLp = ctx.createBiquadFilter();
    synthLp.type = 'lowpass';
    synthLp.Q.value = 0.5;
    synthLp.frequency.value = synthFreqFor(clarity);
    synthGain = ctx.createGain();
    synthGain.gain.value = 0.0001;
    synthBus.connect(synthLp);
    synthLp.connect(synthGain);
    synthGain.connect(master);

    // 反馈延迟：琶音的"远处回声"
    synthEcho = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.46;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.38;
    synthEcho.connect(synthBus);
    synthEcho.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(synthBus);

    // 极慢的 LFO 推滤波器截止频率，让 pad 有"呼吸"
    synthLfo = ctx.createOscillator();
    const lfoDepth = ctx.createGain();
    synthLfo.frequency.value = 0.07;
    lfoDepth.gain.value = 180; // 音分
    synthLfo.connect(lfoDepth);
    lfoDepth.connect(synthLp.detune);
    synthLfo.start();

    rampSynthGain(synthVolFor(clarity), 4);
    synthStep = 0;
    synthNextT = ctx.currentTime + 0.05;
    synthTick();
    synthTimer = setInterval(synthTick, TICK_MS);
  }

  function stopSynthTimer() {
    if (synthTimer !== null) clearInterval(synthTimer);
    synthTimer = null;
  }

  function fadeOutSynth(sec) {
    if (!synthOn) return;
    synthOn = false;
    stopSynthTimer();
    rampSynthGain(0.0001, sec);
    const out = synthGain, lfo = synthLfo;
    setTimeout(() => {
      try { lfo.stop(); out.disconnect(); } catch (e) { /* 忽略 */ }
    }, (Math.max(0.01, sec) + 0.2) * 1000);
  }

  /**
   * Scene 9：合成 BGM 淡出，文件 BGM 淡入。
   * BGM_URL 还没填时什么都不做，合成 BGM 继续放，避免这一幕变成无声。
   */
  function crossToRealBgm(fadeSec = 2.5) {
    if (synthRetired || !cfg.BGM_URL) return;
    if (!ctx) { pendingCrossSec = fadeSec; return; }
    setupBgm();
    if (!bgmEl) return;
    synthRetired = true;
    playBgm(fadeSec);
    fadeOutSynth(fadeSec);
  }

  // 切到后台时暂停，回来继续
  // （合成 BGM 全部挂在 ctx 下，suspend/resume 自动带上；调度器看 currentTime，暂停期间不排新音）
  document.addEventListener('visibilitychange', () => {
    if (!ctx || ctx.state === 'closed') return;
    if (document.hidden) {
      if (bgmEl && bgmStarted) bgmEl.pause();
      ctx.suspend();
    } else {
      ctx.resume();
      if (bgmEl && bgmStarted) bgmEl.play().catch(() => {});
    }
  });

  // 关闭/离开网页时强制停掉 BGM。
  // 上一版用 ctx.suspend()（异步 Promise）+ 渐变，标签页关得比它们生效更快，声音就"卡"住了。
  // 这一版每一步都是同步、立即生效的：先把音量直接砍到 0，再释放音频资源并销毁 AudioContext。
  function hardStop() {
    synthOn = false;
    stopSynthTimer();
    try {
      if (bgmGain) { bgmGain.gain.cancelScheduledValues(0); bgmGain.gain.value = 0; }
      if (synthGain) { synthGain.gain.cancelScheduledValues(0); synthGain.gain.value = 0; }
      if (master) { master.gain.cancelScheduledValues(0); master.gain.value = 0; }
    } catch (e) { /* 忽略 */ }
    try {
      if (bgmEl) {
        bgmEl.muted = true;
        bgmEl.pause();
        bgmEl.removeAttribute('src');
        bgmEl.load();
        bgmStarted = false;
      }
    } catch (e) { /* 忽略 */ }
    try { if (ctx && ctx.state !== 'closed') ctx.close(); } catch (e) { /* 忽略 */ }
  }
  // pagehide 的 persisted=true 表示页面进了前进/后退缓存、之后可能被恢复，这时不能销毁
  window.addEventListener('pagehide', (e) => { if (!e.persisted) hardStop(); });
  window.addEventListener('beforeunload', hardStop);
  window.addEventListener('unload', hardStop);

  // ---------- 合成音效 ----------
  function env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function blip(opts = {}) {
    if (!ready()) return;
    const { freq = 660, type = 'triangle', vol = 0.05, dur = 0.05, jitter = 0.06 } = opts;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq * (1 + (Math.random() - 0.5) * jitter);
    env(g, t, 0.004, vol, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise() {
    if (!noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.6);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  /** 路块拼上时的"咔哒" */
  function click(vol = 0.22) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 1.5;
    const g = ctx.createGain();
    env(g, t, 0.002, vol, 0.045);
    n.connect(bp); bp.connect(g); g.connect(master);
    n.start(t); n.stop(t + 0.08);

    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    env(g2, t, 0.002, vol * 0.9, 0.09);
    o.connect(g2); g2.connect(master);
    o.start(t); o.stop(t + 0.15);
  }

  /** 轻轻的"呼"，用于升起、转场 */
  function whoosh(vol = 0.05, dur = 0.5) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    n.buffer = noise();
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.Q.value = 0.8;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f); f.connect(g); g.connect(master);
    n.start(t); n.stop(t + dur + 0.05);
  }

  /** 音符金币：i 越大音越高（五声音阶，和 BGM 不容易打架） */
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  function coin(i = 0) {
    if (!ready()) return;
    const semi = SCALE[Math.min(Math.max(i, 0), SCALE.length - 1)];
    const t = ctx.currentTime;
    if (coinBuf) {
      const s = ctx.createBufferSource();
      s.buffer = coinBuf;
      s.playbackRate.value = Math.pow(2, semi / 12);
      const g = ctx.createGain();
      g.gain.value = 0.7;
      s.connect(g); g.connect(master);
      s.start(t);
      return;
    }
    const f = cfg.COIN_BASE_HZ * Math.pow(2, semi / 12);
    [[1, 'triangle', 0.09], [2, 'sine', 0.035]].forEach(([mul, type, v]) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.value = f * mul;
      env(g, t, 0.004, v, 0.45);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + 0.5);
    });
  }

  async function loadCoin() {
    if (!cfg.SFX_COIN_URL || coinBuf || !ctx) return;
    try {
      const r = await fetch(cfg.SFX_COIN_URL);
      const ab = await r.arrayBuffer();
      coinBuf = await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
    } catch (e) {
      console.warn('[audio] 金币音效加载失败，改用合成音', e);
    }
  }

  /** 合成一声"喵" */
  function meow(vol = 0.12) {
    if (!ready()) return;
    const t = ctx.currentTime, d = 0.5;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(480, t);
    o.frequency.linearRampToValueAtTime(820, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(560, t + d);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.Q.value = 3;
    f.frequency.setValueAtTime(900, t);
    f.frequency.linearRampToValueAtTime(1800, t + 0.15);
    f.frequency.linearRampToValueAtTime(1100, t + d);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.05);
    g.gain.setValueAtTime(vol, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(t); o.stop(t + d + 0.05);
  }

  return {
    voices, unlock, playBgm, crossToRealBgm, setClarity, blip, click, whoosh, coin, meow,
    setMuted, toggleMute,
    get muted() { return muted; },
    get ctx() { return ctx; },
    get clarity() { return clarity; }
  };
})();