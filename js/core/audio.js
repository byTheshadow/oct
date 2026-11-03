/* =========================================================
 * 音频：BGM（带"隔墙闷音"低通滤镜）+ WebAudio 合成音效
 *   unlock()          首次点击时调用
 *   playBgm(fadeSec)  淡入播放
 *   setClarity(t,sec) 0 = 隔着墙，1 = 完全清晰
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
  }

  // ---------- BGM ----------
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
    if (!ctx || !lp) return;
    const now = ctx.currentTime;
    lp.frequency.cancelScheduledValues(now);
    lp.frequency.setValueAtTime(lp.frequency.value, now);
    lp.frequency.exponentialRampToValueAtTime(freqFor(t), now + Math.max(0.01, sec));
    if (bgmStarted) rampGain(volFor(t), sec);
  }

  // 切到后台时暂停，回来继续
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
    try {
      if (bgmGain) { bgmGain.gain.cancelScheduledValues(0); bgmGain.gain.value = 0; }
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
    voices, unlock, playBgm, setClarity, blip, click, whoosh, coin, meow,
    setMuted, toggleMute,
    get muted() { return muted; },
    get ctx() { return ctx; },
    get clarity() { return clarity; }
  };
})();