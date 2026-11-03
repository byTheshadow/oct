/* =========================================================
 * 角落里的白团子：像素头像 + 头上冒气泡。Scene 3 起常驻，Scene 5–9 复用。
 *
 *   App.companion.show({ corner: 'tl', from: {x, y} })
 *       淡入。corner：'tl' 左上（默认）/ 'tr' / 'bl' / 'br'。
 *       传 from（屏幕坐标）会让头像从那个点飞进角落，返回 Promise。
 *   await App.companion.say('……这里是我写的哦。', { small: true, hold: 2200 })
 *       头上冒气泡，逐字打出来，停 hold 毫秒后收起。
 *       text 也可以是数组（逐句说）。small:true = 小声（浅蓝小字，不出"嘟嘟"声）。
 *       说完返回 true；中途被打断（新的 say / hush / hide / reset）返回 false。
 *   await App.companion.react('flinch')
 *       动作：'flinch' 缩一下 / 'pancake' 变小饼 / 'stars' 头上冒星星 /
 *             'happy' 开心蹦两下 / 'nod' 轻轻点头 / 'surprise' 惊讶。
 *       可选参数 { hold: 毫秒 }。动作做完自动回到站姿，返回 true；被打断返回 false。
 *   App.companion.define('myMove', async (c, opts) => {...})
 *       注册新动作。c 提供：frame(name) / set({sx,sy,tx,ty,rot}) / tweenPose(ms, 目标, 缓动) /
 *       tween(ms, fn, 缓动) / sleep(ms) / stars(on) / orbit(秒) / blip(参数) / alive()
 *   App.companion.frame('blink')    直接换表情帧：'sit' | 'blink' | 'wide' | 'tail'
 *   App.companion.center()          头像中心的屏幕坐标（给"飞向白团子"的东西当终点）
 *   App.companion.hide() / reset()  收起；reset 还会打断一切动作，切章时在 exit() 里调
 *
 * 头像挂在 #app 下（z-index 26，在 #overlay 之上、对话框之下、黑场之下），
 * 不会被 director 切章时清空，所以每个用到它的章节 enter() 里 show()、exit() 里 reset()。
 * ========================================================= */
App.companion = (function () {
  const U = App.util;

  // 头顶的小星星，5×5
  const STAR = [
    '..Y..',
    '..Y..',
    'YYYYY',
    '.YYY.',
    '.Y.Y.'
  ];
  const STAR_PAL = { Y: '#ffd35c' };

  let root, bobEl, spriteEl, spriteCtx, starsEl, bubbleEl, ghostEl, liveEl;
  let starEls = [];
  let frames = null;
  let built = false, shown = false, busy = false;
  let corner = 'tl';
  let curFrame = 'sit';
  let sayTok = 0, reactTok = 0, idleTok = 0, flyTok = 0;
  const pose = { sx: 1, sy: 1, tx: 0, ty: 0, rot: 0 };
  const reactions = {};

  // ---------- 搭 DOM ----------
  function build() {
    if (built) return;
    built = true;
    const app = document.getElementById('app');
    root = U.el('div', 'cmp tl', app);
    U.el('div', 'cmp-frame', root);
    bobEl = U.el('div', 'cmp-bob', root);
    spriteEl = U.el('canvas', 'cmp-sprite', bobEl);
    starsEl = U.el('div', 'cmp-stars', bobEl);

    frames = App.sprites.cat('baituanzi', 3);          // 18 格 × 3px = 54px，一格就是 3 个 CSS 像素
    spriteEl.width = frames.sit.width;
    spriteEl.height = frames.sit.height;
    spriteCtx = spriteEl.getContext('2d');
    spriteCtx.imageSmoothingEnabled = false;
    drawFrame('sit');

    const starImg = App.sprites.render(STAR, STAR_PAL, 3);
    for (let i = 0; i < 3; i++) {
      const c = U.el('canvas', 'cmp-star', starsEl);
      c.width = starImg.width;
      c.height = starImg.height;
      c.getContext('2d').drawImage(starImg, 0, 0);
      starEls.push(c);
    }

    bubbleEl = U.el('div', 'cmp-bubble', root);
    const body = U.el('div', 'cmp-bubble-body', bubbleEl);
    ghostEl = U.el('span', 'cmp-ghost', body);          // 看不见，只负责把气泡撑到最终大小，打字时不会跳
    liveEl = U.el('span', 'cmp-live', body);
    U.el('div', 'cmp-bubble-tail', bubbleEl);
  }

  function drawFrame(name) {
    const f = frames[name];
    if (!f) return;
    curFrame = name;
    spriteCtx.clearRect(0, 0, spriteEl.width, spriteEl.height);
    spriteCtx.drawImage(f, 0, 0);
  }

  function applyPose() {
    spriteEl.style.transform =
      `translate(${pose.tx.toFixed(2)}px, ${pose.ty.toFixed(2)}px) rotate(${pose.rot.toFixed(3)}rad) scale(${pose.sx.toFixed(3)}, ${pose.sy.toFixed(3)})`;
  }
  function resetPose() {
    pose.sx = pose.sy = 1;
    pose.tx = pose.ty = pose.rot = 0;
    applyPose();
  }

  function setCorner(c) {
    if (!built) return;
    if (['tl', 'tr', 'bl', 'br'].indexOf(c) < 0) c = 'tl';
    corner = c;
    root.classList.remove('tl', 'tr', 'bl', 'br');
    root.classList.add(c);
  }

  // ---------- 显示 / 隐藏 ----------
  function show(o = {}) {
    build();
    setCorner(o.corner || corner);
    shown = true;
    root.classList.add('on');
    startIdle();
    if (!o.from) return Promise.resolve();

    // 从 from 飞进角落：先量出角落里的位置，再从"from 的位置、大一圈"补间回 0
    const my = ++flyTok;
    root.style.transform = '';
    const r = root.getBoundingClientRect();
    const dx0 = o.from.x - (r.left + r.width / 2);
    const dy0 = o.from.y - (r.top + r.height / 2);
    return U.tween(o.ms || 950, (e, t) => {
      if (my !== flyTok) return;
      const lift = -Math.sin(Math.PI * t) * 36;
      const s = 1.5 - 0.5 * e;
      root.style.transform =
        `translate(${(dx0 * (1 - e)).toFixed(1)}px, ${(dy0 * (1 - e) + lift).toFixed(1)}px) scale(${s.toFixed(3)})`;
    }, U.ease.inOutCubic).then(() => { if (my === flyTok) root.style.transform = ''; });
  }

  function hide() {
    if (!built) return;
    shown = false;
    flyTok++;
    idleTok++;
    hush();
    root.classList.remove('on');
    root.style.transform = '';
  }

  /** 切章时调用：收起、打断所有说话和动作、姿势归位 */
  function reset() {
    if (!built) return;
    hide();
    reactTok++;
    busy = false;
    resetPose();
    setStars(false);
    drawFrame('sit');
  }

  // ---------- 说话 ----------
  async function say(text, o = {}) {
    build();
    if (Array.isArray(text)) {
      // 逐句说：句与句之间气泡不收，最后一句说完才收
      for (let i = 0; i < text.length; i++) {
        const line = typeof text[i] === 'string' ? { text: text[i] } : text[i];
        const o2 = Object.assign({}, o, line, { last: i === text.length - 1 });
        if (!(await say1(line.text, o2, true))) return false;
      }
      return true;
    }
    return say1(text, o, false);
  }

  async function say1(text, o, inList) {
    const my = ++sayTok;
    const small = !!o.small;
    const voice = o.voice !== undefined ? o.voice : (small ? null : 'bt');
    const hold = o.hold != null ? o.hold : 1800;
    ghostEl.textContent = text;
    liveEl.textContent = '';
    bubbleEl.classList.toggle('small', small);
    bubbleEl.classList.add('on');
    root.classList.add('talk');
    await U.typewrite(liveEl, text, { speed: o.speed || 60, voice, abort: () => my !== sayTok });
    if (my !== sayTok) return false;
    root.classList.remove('talk');
    await U.sleep(hold);
    if (my !== sayTok) return false;
    if (!inList || o.last) bubbleEl.classList.remove('on');
    return true;
  }

  /** 立刻收起气泡，打断正在说的话 */
  function hush() {
    if (!built) return;
    sayTok++;
    root.classList.remove('talk');
    bubbleEl.classList.remove('on');
  }

  // ---------- 表情 / 空闲 ----------
  function frame(name) {
    build();
    drawFrame(name);
  }

  function startIdle() {
    const my = ++idleTok;
    (async () => {
      while (my === idleTok && shown) {
        await U.sleep(U.rand(2200, 4800));
        if (my !== idleTok || !shown || busy) continue;
        const wag = Math.random() < 0.3;
        const f = wag ? 'tail' : 'blink';
        drawFrame(f);
        await U.sleep(wag ? 280 : 130);
        if (my === idleTok && !busy && curFrame === f) drawFrame('sit');
      }
    })();
  }

  // ---------- 星星 ----------
  function setStars(on) {
    if (!built) return;
    starsEl.classList.toggle('on', !!on);
  }
  function orbit(sec) {
    // 椭圆轨道，中心在头顶
    const cx = 33, cy = 9, rx = 19, ry = 5;
    starEls.forEach((s, i) => {
      const a = sec * 5.2 + i * (Math.PI * 2 / starEls.length);
      const x = cx + Math.cos(a) * rx - 10;
      const y = cy + Math.sin(a) * ry - 10;
      s.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      s.style.opacity = Math.sin(a) > 0 ? '1' : '0.55';       // 绕到"后面"时淡一点
    });
  }

  // ---------- 动作 ----------
  function makeApi(my) {
    const alive = () => my === reactTok;
    const tween = (ms, fn, easing) => U.tween(ms, (e, t) => { if (alive()) fn(e, t); }, easing);
    return {
      alive,
      frame: (n) => { if (alive()) drawFrame(n); },
      set: (p) => { if (!alive()) return; Object.assign(pose, p); applyPose(); },
      tween,
      tweenPose(ms, target, easing) {
        const from = Object.assign({}, pose);
        return tween(ms, (e) => {
          for (const k in target) pose[k] = from[k] + (target[k] - from[k]) * e;
          applyPose();
        }, easing);
      },
      sleep: U.sleep,
      stars: (on) => { if (alive()) setStars(on); },
      orbit,
      blip: (p) => { if (alive()) App.audio.blip(p); }
    };
  }

  async function react(kind, opts = {}) {
    build();
    const fn = reactions[kind];
    if (!fn) { console.warn('[companion] 没有这个动作:', kind); return false; }
    const my = ++reactTok;
    busy = true;
    try { await fn(makeApi(my), opts); } catch (e) { console.error(e); }
    if (my !== reactTok) return false;                 // 被新动作或 reset 打断了，收尾交给它们
    resetPose();
    drawFrame('sit');
    setStars(false);
    busy = false;
    return true;
  }

  function define(kind, fn) { reactions[kind] = fn; }

  const E = U.ease;

  // 缩一下："啊"
  define('flinch', async (c, o) => {
    c.frame('blink');
    c.blip({ freq: 560, type: 'triangle', vol: 0.05, dur: 0.12, jitter: 0 });
    await c.tweenPose(110, { sx: 0.8, sy: 0.8 }, E.outQuad);
    await c.sleep(o.hold != null ? o.hold : 160);
    await c.tweenPose(220, { sx: 1, sy: 1 }, E.outBack);
  });

  // 被拍扁成小饼，过一会儿"啵"地弹回来
  define('pancake', async (c, o) => {
    c.frame('blink');
    c.blip({ freq: 110, type: 'sine', vol: 0.1, dur: 0.18, jitter: 0 });
    await c.tweenPose(130, { sx: 1.28, sy: 0.34 }, E.outQuad);
    const hold = o.hold != null ? o.hold : 1200;
    await c.tween(hold, (e, t) => {
      c.set({ sx: 1.28 + Math.sin(t * hold / 70) * 0.025, sy: 0.34 + Math.sin(t * hold / 90) * 0.012 });
    }, E.linear);
    c.blip({ freq: 720, type: 'sine', vol: 0.05, dur: 0.1, jitter: 0 });
    await c.tweenPose(260, { sx: 1, sy: 1 }, E.outBack);
  });

  // 头晕：头顶转一圈小星星，身子左右晃
  define('stars', async (c, o) => {
    c.frame('blink');
    c.stars(true);
    const dur = o.hold != null ? o.hold : 1800;
    await c.tween(dur, (e, t) => {
      c.orbit(t * dur / 1000);
      c.set({ rot: Math.sin(t * dur / 150) * 0.13 * (1 - t * 0.6) });
    }, E.linear);
    c.stars(false);
    await c.tweenPose(160, { rot: 0 }, E.outQuad);
  });

  // 开心：摇尾巴蹦两下
  define('happy', async (c) => {
    for (let i = 0; i < 2; i++) {
      c.frame(i % 2 ? 'sit' : 'tail');
      c.blip({ freq: 880 + i * 220, type: 'sine', vol: 0.035, dur: 0.1, jitter: 0 });
      await c.tweenPose(120, { ty: -7, sx: 0.96, sy: 1.06 }, E.outQuad);
      await c.tweenPose(110, { ty: 0, sx: 1.06, sy: 0.92 }, E.linear);
    }
    await c.tweenPose(120, { sx: 1, sy: 1 }, E.outQuad);
  });

  // 轻轻点头："对啦……"
  define('nod', async (c) => {
    for (let i = 0; i < 2; i++) {
      await c.tweenPose(120, { ty: 3, sy: 0.95 }, E.outQuad);
      await c.tweenPose(140, { ty: 0, sy: 1 }, E.outQuad);
    }
  });

  // 惊讶：睁大眼睛，往上弹一下
  define('surprise', async (c, o) => {
    c.frame('wide');
    c.blip({ freq: 1040, type: 'triangle', vol: 0.04, dur: 0.1, jitter: 0 });
    await c.tweenPose(100, { ty: -6, sx: 0.94, sy: 1.1 }, E.outQuad);
    await c.tweenPose(140, { ty: 0, sx: 1, sy: 1 }, E.outBack);
    await c.sleep(o.hold != null ? o.hold : 400);
  });

  return {
    show, hide, reset, say, hush, react, define, frame, setCorner,
    center() {
      if (!built) return { x: 0, y: 0 };
      const r = root.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    get visible() { return shown; },
    get el() { build(); return root; }
  };
})();