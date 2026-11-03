/* 通用小工具 */
App.util = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const ease = {
    linear: (t) => t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  };

  /** 补间：fn(缓动后的 t, 原始 t)。返回 Promise */
  function tween(ms, fn, easing = ease.outCubic) {
    return new Promise((resolve) => {
      const t0 = performance.now();
      function step(now) {
        const t = clamp((now - t0) / ms, 0, 1);
        fn(easing(t), t);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  function param(name) {
    return new URLSearchParams(location.search).get(name);
  }

  function el(tag, cls, parent, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  // 打字机：标点处停顿更久
  const PAUSE = { '…': 110, '，': 170, ',': 170, '。': 250, '？': 260, '?': 260, '！': 240, '、': 140 };

  /**
   * 把 text 逐字打进 target。
   * voice：App.audio.voices 里的键名（如 'bt'）或参数对象，每两个字响一次"嘟"
   * skip：返回 true 时立刻打完
   * abort：返回 true 时直接停下（不再写字，给被打断的气泡用）
   */
  async function typewrite(target, text, { speed = 55, voice = null, skip = () => false, abort = () => false } = {}) {
    target.textContent = '';
    const v = typeof voice === 'string' ? App.audio.voices[voice] : voice;
    let n = 0;
    for (let i = 0; i < text.length; i++) {
      if (abort()) return;
      if (skip()) { target.textContent = text; return; }
      const ch = text[i];
      target.textContent += ch;
      if (v && !PAUSE[ch] && ch.trim() && n++ % 2 === 0) App.audio.blip(v);
      await sleep(PAUSE[ch] || speed);
    }
  }

  return { clamp, lerp, rand, pick, sleep, ease, tween, param, el, typewrite };
})();
