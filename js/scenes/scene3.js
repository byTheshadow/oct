/* =========================================================
 * Scene 3 · 代码海洋
 *   接 Scene 2.5 的坠落：两只猫还在掉，周围是向上冲的发光字符。
 *   海面从下面升上来，"啪"地落进去，溅起一团字符。
 *   然后是一片字符组成的海：划屏掀起代码浪，漂着五句彩蛋。青、紫荧光随着划屏慢慢渗进来。
 *   划够了（或者等够了），字符随着鼓点升起来，汇聚成五线谱和音符，缓缓流动。
 *   白团子从海面飞进屏幕角落，变成小头像，小声说："……这里是我写的哦。随便看看啦。"
 *
 * 整章画在 #overlay 里的一张 2D canvas 上（three 舞台在 config.chapters.scene3 里关掉了）。
 * 渲染都在 core/codesea.js，这里只管时间线、两只猫和输入。
 * 调试：?scene=scene3&debug
 * ========================================================= */
App.director.register('scene3', {
  enter(ctx) {
    const U = App.util, A = App.audio;
    const T = App.config.text.scene3;
    const PAL = App.config.palettes.sea;
    const CFG = App.config;

    App.shards.reset();
    App.shards.hide();

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const sea = App.codeSea.create(ov);
    const S = sea.state;
    this._sea = sea;

    // ---------- 两只猫（直接画在海洋 canvas 上） ----------
    const FINAL_SURFACE = 0.56;                       // 海面最终位置（屏高比例）
    function makeCat(name, scale, xFrac, phase) {
      return {
        frames: App.sprites.cat(name, scale), scale, xFrac, phase,
        frame: 'wide', x: 0, y: 0, rot: 0, sx: 1, sy: 1, alpha: 1, visible: true,
        dip: 0, dipV: 0, landed: false
      };
    }
    const black = makeCat('xiaohan', 5, 0.40, 0);        // 小寒：高一点
    const white = makeCat('baituanzi', 4, 0.62, 2.1);    // 白团子：矮一点
    const cats = [black, white];

    function drawCat(g, c) {
      if (!c.visible) return;
      const spr = c.frames[c.frame];
      g.save();
      g.imageSmoothingEnabled = false;
      g.globalAlpha = c.alpha;
      g.translate(c.x, c.y);
      g.rotate(c.rot);
      g.scale(c.sx, c.sy);
      // 猫图四周各留了 1 格给轮廓光，脚底要往下挪一格才贴着水线
      g.drawImage(spr, -spr.width / 2, -spr.height + c.scale, spr.width, spr.height);
      g.restore();
      g.globalAlpha = 1;
    }

    // ---------- 状态 ----------
    let landed = false;                                // 已经落进海里
    let swipeDist = 0;                                 // 累计划屏距离
    let swipeNeed = 0;
    let waiting = false;                               // 在等玩家划屏
    let forming = false;                               // 开始汇聚五线谱了
    let waitStart = 0;
    let swipeEnergyMix = 0;

    const CFG_FINAL_MIX = 0.85;                        // 划屏时青紫渗入的上限

    // 每帧：猫的位置、表情、弹簧；青紫渗入
    sea.hooks.pre = (dt, t) => {
      const W = sea.W, H = sea.H;
      for (const c of cats) {
        c.x = W * c.xFrac;
        if (!landed) {
          // 下坠中：悬在最终水线上方一点点，慢慢翻滚
          c.y = H * FINAL_SURFACE - 4 + Math.sin(t * 2.3 + c.phase) * 5;
          c.rot = Math.sin(t * 1.7 + c.phase) * 0.22;
          c.sx = c.sy = 1;
        } else {
          // 落进海里：贴着水线，随浪起伏；落地时的弹簧负责"咚"的一下
          c.dipV += (-c.dip * 90 - c.dipV * 9) * dt;
          c.dip += c.dipV * dt;
          c.y = sea.surfaceAt(c.x) + 3 + Math.max(0, c.dip);
          c.rot = U.clamp(sea.slopeAt(c.x) * 0.25, -0.3, 0.3) + Math.sin(t * 1.3 + c.phase) * 0.03;
          const sq = U.clamp(c.dip / 40, -0.25, 0.4);
          c.sx = 1 + sq * 0.7;
          c.sy = 1 - sq;
        }
      }
      // 青紫渗入：随时间慢慢涨，划屏的累计量再推一把
      const timeMix = U.clamp((t - 3.5) / 40, 0, 0.3);
      const target = 0.1 + timeMix + swipeEnergyMix;
      S.mix += (Math.min(target, CFG_FINAL_MIX) - S.mix) * Math.min(1, dt * 1.5);
    };

    sea.hooks.mid = (g) => {
      // 猫脚下的一小圈光
      if (landed) {
        for (const c of cats) {
          if (!c.visible) continue;
          const gr = g.createRadialGradient(c.x, c.y, 2, c.x, c.y, 46);
          gr.addColorStop(0, 'rgba(120,255,240,0.22)');
          gr.addColorStop(1, 'rgba(120,255,240,0)');
          g.fillStyle = gr;
          g.fillRect(c.x - 46, c.y - 20, 92, 40);
        }
      }
      drawCat(g, black);
      drawCat(g, white);
    };

    // 猫的眨眼 / 甩尾
    (async () => {
      while (ctx.alive()) {
        await U.sleep(U.rand(2000, 4200));
        if (!ctx.alive()) return;
        if (!landed) continue;
        const c = U.pick(cats);
        const f = Math.random() < 0.7 ? 'blink' : 'tail';
        c.frame = f;
        await U.sleep(f === 'blink' ? 140 : 300);
        if (c.frame === f) c.frame = 'sit';
      }
    })();

    // ---------- 输入：在海面上划 ----------
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16];
    let lastX = 0, lastY = 0, lastT = 0, down = false, lastNote = 0;
    function pos(e) {
      const r = sea.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      const p = pos(e);
      down = true;
      lastX = p.x; lastY = p.y; lastT = performance.now();
      if (landed) sea.disturb(p.x, Math.max(p.y, sea.surfaceAt(p.x)), 0.9);
      note(p.x, 0.04);
    }
    function onMove(e) {
      if (!down && e.pointerType === 'touch') return;
      const p = pos(e);
      const now = performance.now();
      const dx = p.x - lastX, dy = p.y - lastY;
      const dist = Math.hypot(dx, dy);
      const dt = Math.max(8, now - lastT);
      lastX = p.x; lastY = p.y; lastT = now;
      if (!landed || forming || dist < 1) return;
      const speed = dist / dt;                          // px / ms
      const amp = U.clamp(speed * 0.55, 0.15, 1.5);
      const sy = sea.surfaceAt(p.x);
      sea.disturbLine(p.x - dx, Math.max(p.y - dy, sy), p.x, Math.max(p.y, sy), amp);
      if (waiting) {
        swipeDist += dist;
        swipeEnergyMix = U.clamp(swipeDist / swipeNeed, 0, 1) * 0.5;
      }
      if (now - lastNote > 130 && speed > 0.25) { lastNote = now; note(p.x, 0.03); }
    }
    function onUp() { down = false; }
    // 划屏时弹一个五声音阶的音，横向位置决定音高
    function note(x, vol) {
      const k = PENTA[U.clamp(Math.floor(x / sea.W * PENTA.length), 0, PENTA.length - 1)];
      A.blip({ freq: CFG.COIN_BASE_HZ * Math.pow(2, k / 12), type: 'sine', vol, dur: 0.38, jitter: 0 });
    }
    sea.canvas.addEventListener('pointerdown', onDown);
    sea.canvas.addEventListener('pointermove', onMove);
    sea.canvas.addEventListener('pointerup', onUp);
    sea.canvas.addEventListener('pointercancel', onUp);
    sea.canvas.addEventListener('pointerleave', onUp);

    // ---------- 时间线 ----------
    (async () => {
      sea.start();
      const H = () => sea.H;

      // 1) 下坠：字符雨越冲越快，海面从屏幕下面加速升上来
      S.rain = 1;
      S.surface = 1.25;
      A.whoosh(0.07, 3.6);
      const FALL = 3600;
      await U.tween(FALL, (e) => {
        S.surface = 1.25 - (1.25 - FINAL_SURFACE) * e;
        S.rainSpeed = 1.6 + 3.4 * e;
      }, (t) => t * t * t);
      if (!ctx.alive()) return;

      // 2) 落海
      landed = true;
      black.frame = 'blink'; white.frame = 'blink';
      black.dipV = 260; white.dipV = 230;
      const sx = sea.W * 0.51, sy = sea.surfaceAt(sea.W * 0.51);
      sea.splash(sx, sy, 1.2);
      sea.disturb(sx, sy + 8, 3);
      sea.disturb(sea.W * 0.3, sy + 8, 1.6);
      sea.disturb(sea.W * 0.72, sy + 8, 1.6);
      S.shake = 9;
      A.click(0.32);
      A.blip({ freq: 70, type: 'sine', vol: 0.14, dur: 0.3, jitter: 0 });
      A.whoosh(0.06, 0.7);
      U.tween(1600, (e) => { S.rain = 1 - 0.82 * e; S.rainSpeed = 5 - 4.4 * e; }, U.ease.outCubic);
      await U.sleep(600);
      if (!ctx.alive()) return;
      black.frame = 'sit'; white.frame = 'sit';

      // 3) 彩蛋漂进来，等玩家划屏
      const rows = [3, 6, 9, 12, 15];
      const colors = [PAL.cyan, PAL.purple, PAL.white, PAL.cyan, PAL.purple];
      T.eggs.forEach((txt, i) => {
        sea.addEgg(txt, { row: rows[i], color: colors[i], delay: 0.4 + i * 0.7, x: Math.random() * sea.W * 0.5, vx: (i % 2 ? -1 : 1) * (9 + i * 2.2) });
      });
      await U.sleep(900);
      if (!ctx.alive()) return;

      const ovEl = document.getElementById('overlay');
      const hint = U.el('div', 'soft-hint sea', ovEl, T.hint);
      requestAnimationFrame(() => hint.classList.add('on'));
      swipeNeed = Math.min(sea.W, 500) * 3;
      swipeDist = 0;
      waiting = true;
      waitStart = performance.now();

      // 划够了，或者等了 18 秒，就往下走（至少要停留 4 秒让彩蛋飘一会儿）
      await new Promise((resolve) => {
        const timer = setInterval(() => {
          if (!ctx.alive()) { clearInterval(timer); resolve(); return; }
          const waited = performance.now() - waitStart;
          if ((swipeDist >= swipeNeed && waited > 4000) || waited > 18000) { clearInterval(timer); resolve(); }
        }, 120);
      });
      if (!ctx.alive()) return;
      waiting = false;
      hint.classList.remove('on');

      // 4) 随鼓点：字符升起来，汇聚成五线谱
      forming = true;
      const beatMs = 60000 / (CFG.SEA_BPM || 96);
      U.tween(beatMs * 2.5, (e) => { S.eggFade = 1 - e; S.seaAlpha = 1 - 0.6 * e; S.mix = Math.max(S.mix, 0.5 + 0.35 * e); }, U.ease.linear);
      sea.beat(1.2);
      const staffTop = sea.H * 0.22;             // 五线谱放高一点，别压到猫头
      const done = sea.formStaff({ top: staffTop, notes: 9 });
      for (let i = 1; i < 4; i++) {
        await U.sleep(beatMs);
        if (!ctx.alive()) return;
        sea.beat(0.8 + i * 0.1);
      }
      await done;
      if (!ctx.alive()) return;
      await U.sleep(beatMs);
      if (!ctx.alive()) return;
      sea.beat(0.7);

      // 5) 白团子浮到角落，变成小头像，小声说话
      const r = sea.canvas.getBoundingClientRect();
      const from = { x: r.left + white.x, y: r.top + white.y - white.frames.sit.height / 2 };
      white.visible = false;
      A.whoosh(0.04, 0.6);
      const flying = App.companion.show({ corner: 'tl', from, ms: 1000 });
      await flying;
      if (!ctx.alive()) return;
      await U.sleep(400);
      if (!ctx.alive()) return;
      await App.companion.say(T.say, { small: true, hold: 2400, speed: 75 });
      if (!ctx.alive()) return;
      await U.sleep(400);
      if (!ctx.alive()) return;
      ctx.next();
    })();
  },

  exit() {
    if (this._sea) { this._sea.destroy(); this._sea = null; }
    App.companion.reset();
    App.shards.hide();
  }
});