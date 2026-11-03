/* =========================================================
 * Scene 4 · 五线谱选择题（5 题）
 *   接 Scene 3：代码海洋上方是一条成形的五线谱，白团子在左上角，收藏槽在右上角。
 *   每题对应唱片的一块碎片。白团子说"第一块……"，题目浮在五线谱上，
 *   下面是 2×2 的四个音符气泡（显示顺序每次打乱，内部按 correct 下标判对错）。
 *
 *   答对：气泡亮起、发一个音，碎片亮着飞进收藏槽，白团子小声"对啦……"。
 *         第 2 题答对时他再小声补一句彩蛋。
 *   答错：不扣分。先播这一题的惩罚（白团子一起被波及），碎片暗着飞进槽，
 *         然后正确答案亮起、发音，槽里那块变亮。停一会儿自动进下一题。
 *     1 玻璃裂纹      白团子"啊"一声、缩一下
 *     2 拍扁成饼      小寒和白团子一起变成饼
 *     3 整屏碎块掉落再拼回来
 *     4 屏幕转一圈    小寒和白团子头上都冒星星
 *     5 大猫爪印揉捏屏幕
 *   五题结束：五个音按题号连起来弹一遍（拼成一段旋律），BGM 再清晰一点。
 *   收藏槽里五块全亮、只缺最后一角（留给 Scene 9，这里不调 fillCorner）。
 *
 * 和 Scene 3 一样整章画在 #overlay 的 2D canvas（core/codesea.js）上；
 * 题目和选项是叠在 canvas 上面的 DOM 层（.s4-layer），样式在 css/scene4.css。
 * 调试：?scene=scene4&debug
 * ========================================================= */
App.director.register('scene4', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene4;
    const PAL = CFG.palettes.sea;
    const COLORS = CFG.palettes.shards.colors;
    const self = this;

    // 五个题号对应的音（App.audio.coin 的五声音阶下标）：E G A D' C'，最后落在高音 C 上
    const MELODY = [2, 3, 4, 6, 5];
    const beatMs = 60000 / (CFG.SEA_BPM || 96);

    // 正常流程里 Scene 3 已经 reset 过；调试直跳或重进本章时兜个底
    if (App.shards.count) App.shards.reset();

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const sea = App.codeSea.create(ov);
    const S = sea.state;
    this._sea = sea;

    // 接 Scene 3 结尾的样子：雨很淡、海压暗、彩蛋不显示
    Object.assign(S, { mix: 0.62, rain: 0.14, rainSpeed: 0.7, seaAlpha: 0.45, eggFade: 0 });
    let mixTarget = 0.62;

    // ---------- 布局 ----------
    // 顶部约 140px 留给左上角白团子和右上角静音按钮 + 收藏槽
    const W0 = sea.W, H0 = sea.H;
    const gap = U.clamp(Math.round(H0 * 0.036), 20, 30);
    const staffTop = Math.max(150, Math.round(H0 * 0.2));
    const optTop = staffTop + gap * 4 + 30;
    const optBottom = optTop + 2 * 58 + 10;                  // 两行气泡大约的高度
    S.surface = Math.max((optBottom + 70) / H0, 0.7);
    sea.formStaff({ top: staffTop, gap, left: W0 * 0.05, right: W0 * 0.95, notes: 7, instant: true, flow: 16 });
    const R = sea.staffRect();
    const qMid = R.top + R.gap * 2;                           // 题目卡片压在五线谱正中

    // ---------- 小寒猫（画在海洋 canvas 上） ----------
    // 画法和 Scene 3 的 makeCat / drawCat 一样；fx 是惩罚和动作叠加上去的变形
    const cat = {
      frames: App.sprites.cat('xiaohan', 5), scale: 5,
      frame: 'sit', x: 0, y: 0, rot: 0, sx: 1, sy: 1,
      fx: { sx: 1, sy: 1, ty: 0, rot: 0 },
      dip: 0, dipV: 0, stars: false, lock: false
    };
    const STAR = ['..Y..', '..Y..', 'YYYYY', '.YYY.', '.Y.Y.'];
    const starImg = App.sprites.render(STAR, { Y: '#ffd35c' }, 3);

    // 大猫爪印，16×14。O 描边 / N 肉垫 / H 高光（配色：config.palettes.paw）
    const PAW = [
      '....OO....OO....',
      '...OHNO..OHNO...',
      '...ONNO..ONNO...',
      '....OO....OO....',
      '.OO..........OO.',
      'OHNO........OHNO',
      'ONNO..OOOO..ONNO',
      '.OO..ONNNNO..OO.',
      '....OHNNNNNO....',
      '...ONNNNNNNNO...',
      '...ONNNNNNNNO...',
      '...ONNNNNNNNO...',
      '....ONNNNNNO....',
      '.....OOOOOO.....'
    ];

    sea.hooks.pre = (dt, t) => {
      cat.x = sea.W * 0.76;
      cat.dipV += (-cat.dip * 90 - cat.dipV * 9) * dt;
      cat.dip += cat.dipV * dt;
      cat.y = sea.surfaceAt(cat.x) + 3 + Math.max(0, cat.dip) + cat.fx.ty;
      cat.rot = U.clamp(sea.slopeAt(cat.x) * 0.25, -0.3, 0.3) + Math.sin(t * 1.3) * 0.03 + cat.fx.rot;
      const sq = U.clamp(cat.dip / 40, -0.25, 0.4);
      cat.sx = (1 + sq * 0.7) * cat.fx.sx;
      cat.sy = (1 - sq) * cat.fx.sy;
      S.mix += (mixTarget - S.mix) * Math.min(1, dt * 1.2);
    };

    sea.hooks.mid = (g, dt, t) => {
      const gr = g.createRadialGradient(cat.x, cat.y, 2, cat.x, cat.y, 46);
      gr.addColorStop(0, 'rgba(120,255,240,0.22)');
      gr.addColorStop(1, 'rgba(120,255,240,0)');
      g.fillStyle = gr;
      g.fillRect(cat.x - 46, cat.y - 20, 92, 40);

      const spr = cat.frames[cat.frame];
      g.save();
      g.imageSmoothingEnabled = false;
      g.translate(cat.x, cat.y);
      g.rotate(cat.rot);
      g.scale(cat.sx, cat.sy);
      g.drawImage(spr, -spr.width / 2, -spr.height + cat.scale, spr.width, spr.height);
      g.restore();

      if (cat.stars) {
        // 头顶一圈小星星，椭圆轨道；绕到"后面"时淡一点
        const headY = cat.y - spr.height * cat.sy * 0.95;
        for (let i = 0; i < 3; i++) {
          const a = t * 5.2 + i * (Math.PI * 2 / 3);
          g.globalAlpha = Math.sin(a) > 0 ? 1 : 0.55;
          g.drawImage(starImg, cat.x + Math.cos(a) * 30 - starImg.width / 2, headY + Math.sin(a) * 7 - starImg.height / 2);
        }
      }
      g.globalAlpha = 1;
    };

    function catHop() {
      return U.tween(340, (e, k) => { cat.fx.ty = -Math.sin(Math.PI * k) * 22; }, U.ease.linear)
        .then(() => { cat.fx.ty = 0; cat.dipV = 120; });
    }

    // 待机：眨眼 / 甩尾（惩罚期间 lock 住不打扰）
    (async () => {
      while (ctx.alive()) {
        await U.sleep(U.rand(2000, 4200));
        if (!ctx.alive()) return;
        if (cat.lock) continue;
        const f = Math.random() < 0.7 ? 'blink' : 'tail';
        cat.frame = f;
        await U.sleep(f === 'blink' ? 140 : 300);
        if (!cat.lock && cat.frame === f) cat.frame = 'sit';
      }
    })();

    // 背景里轻轻的鼓点（碎屏的时候停一下）
    let quiet = false;
    (async () => {
      while (ctx.alive()) {
        await U.sleep(beatMs * 2);
        if (!ctx.alive()) return;
        if (!quiet) sea.beat(0.28);
      }
    })();

    // 点海面还是会起一点浪
    sea.canvas.addEventListener('pointerdown', (e) => {
      const r = sea.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      sea.disturb(x, Math.max(y, sea.surfaceAt(x)), 0.7);
    });

    // ---------- 小工具 ----------
    // 改 #overlay 的变形前先确认这一章还在，免得切章后还写到下一章的画面上
    function ovT(transform, origin) {
      if (!ctx.alive()) return;
      ov.style.transform = transform;
      if (origin !== undefined) ov.style.transformOrigin = origin;
    }
    function centerOf(el) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function toCanvas(p) {
      const r = sea.canvas.getBoundingClientRect();
      return { x: p.x - r.left, y: p.y - r.top };
    }
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
    function fxCanvas() {
      const c = U.el('canvas', 's4-fx', ov);
      c.width = sea.canvas.width;
      c.height = sea.canvas.height;
      return c;
    }
    function sayWrong(i) {
      const line = T.wrongSay && T.wrongSay[i];
      if (line) App.companion.say(line, { small: i !== 0, hold: 1100 });
    }

    // ---------- 题目 DOM ----------
    const layer = U.el('div', 's4-layer', ov);
    const noteIcon = App.sprites.set('note', 2).sit;

    function iconCanvas() {
      const c = document.createElement('canvas');
      c.className = 's4-opt-note';
      c.width = noteIcon.width;
      c.height = noteIcon.height;
      c.getContext('2d').drawImage(noteIcon, 0, 0);
      return c;
    }

    function buildQuestion(i) {
      const q = T.questions[i];
      const color = COLORS[i];

      const qEl = U.el('div', 's4-q', layer);
      qEl.style.top = qMid + 'px';
      qEl.style.setProperty('--c', color);
      const body = U.el('div', 's4-q-body', qEl);
      U.el('div', 's4-q-tag', body, `♪ ${i + 1} / ${T.questions.length}`);
      U.el('div', 's4-q-text', body, q.q);

      const grid = U.el('div', 's4-opts locked', layer);
      grid.style.top = optTop + 'px';
      grid.style.setProperty('--c', color);
      const order = shuffle(q.options.map((_, k) => k));
      const btns = order.map((k, n) => {
        const b = U.el('button', 's4-opt', grid);
        b.type = 'button';
        b.dataset.k = k;
        b.style.transitionDelay = (120 + n * 80) + 'ms';
        const bd = U.el('span', 's4-opt-body', b);
        bd.appendChild(iconCanvas());
        U.el('span', 's4-opt-text', bd, q.options[k]);
        return b;
      });
      return { qEl, grid, btns, q };
    }

    async function showQuestion(Q) {
      void Q.qEl.offsetWidth;
      Q.qEl.classList.add('on');
      Q.btns.forEach((b) => b.classList.add('on'));
      A.whoosh(0.03, 0.4);
      Q.btns.forEach((b, n) => setTimeout(() => {
        if (ctx.alive()) A.blip({ freq: 880 + n * 120, type: 'sine', vol: 0.02, dur: 0.06, jitter: 0 });
      }, 120 + n * 80));
      await U.sleep(520);
      Q.btns.forEach((b) => { b.style.transitionDelay = ''; });   // 之后亮起 / 变暗不要再有延迟
    }

    function waitChoice(Q) {
      return new Promise((resolve) => {
        Q.grid.classList.remove('locked');
        const onClick = (e) => {
          const b = e.target.closest('.s4-opt');
          if (!b || !ctx.alive()) return;
          Q.grid.removeEventListener('click', onClick);
          Q.grid.classList.add('locked');                  // 锁住，防止连点判两次
          A.blip(A.voices.tap);
          resolve(b);
        };
        Q.grid.addEventListener('click', onClick);
      });
    }

    async function hideQuestion(Q) {
      Q.qEl.classList.add('out');
      Q.grid.classList.add('out');
      await U.sleep(380);
      Q.qEl.remove();
      Q.grid.remove();
    }

    // ---------- 答对 / 答错 ----------
    async function onCorrect(i, Q, b) {
      b.classList.add('ok');
      Q.btns.forEach((x) => { if (x !== b) x.classList.add('dim'); });
      A.coin(MELODY[i]);
      sea.beat(1);
      catHop();
      App.companion.react('nod');
      const fly = App.shards.collect(i, { lit: true, from: centerOf(b), ms: 850 });
      await App.companion.say(T.correctSay, { small: true, hold: 900 });
      if (!ctx.alive()) return;
      if (i === 1 && T.secretEgg) {
        await U.sleep(250);
        if (!ctx.alive()) return;
        App.companion.frame('blink');                      // 不好意思地闭一下眼
        await App.companion.say(T.secretEgg, { small: true, hold: 1700, speed: 85 });
        if (!ctx.alive()) return;
        App.companion.frame('sit');
      }
      await fly;
      await U.sleep(450);
    }

    async function onWrong(i, Q, b, right) {
      b.classList.add('bad');
      A.blip({ freq: 196, type: 'square', vol: 0.03, dur: 0.14, jitter: 0 });
      const from = centerOf(b);
      await U.sleep(260);
      if (!ctx.alive()) return;
      await PUNISH[i](from);
      if (!ctx.alive()) return;

      await App.shards.collect(i, { lit: false, from, ms: 750 });
      if (!ctx.alive()) return;

      // 揭晓：正确答案亮起，槽里那块跟着亮
      right.classList.add('ok');
      Q.btns.forEach((x) => { if (x !== right && x !== b) x.classList.add('dim'); });
      A.coin(MELODY[i]);
      sea.beat(0.7);
      await App.shards.light(i);
      await U.sleep(1500);
    }

    // ---------- 五个惩罚 ----------

    // 1. 玻璃裂纹：从点中的气泡处裂开
    function buildCracks(cx, cy) {
      const segs = [];
      const reach = Math.hypot(sea.W, sea.H);
      const out = (x, y) => x < -20 || y < -20 || x > sea.W + 20 || y > sea.H + 20;
      function ray(x, y, ang, len, d, branch) {
        let L = 0;
        while (L < len) {
          const step = U.rand(14, 34);
          ang += U.rand(-0.35, 0.35);
          const x1 = x + Math.cos(ang) * step, y1 = y + Math.sin(ang) * step;
          segs.push({ x0: x, y0: y, x1, y1, d: d + L, w: branch ? 1 : 1.6 });
          x = x1; y = y1; L += step;
          if (!branch && Math.random() < 0.16) {
            ray(x, y, ang + U.pick([-1, 1]) * U.rand(0.5, 1.1), U.rand(30, 90), d + L, true);
          }
          if (out(x, y)) break;
        }
      }
      const n = 9;
      for (let k = 0; k < n; k++) {
        ray(cx, cy, (k / n) * Math.PI * 2 + U.rand(-0.25, 0.25), U.rand(reach * 0.25, reach * 0.7), 0, false);
      }
      // 撞击点周围两圈碎玻璃
      [22, 50].forEach((r) => {
        const m = 10;
        const pts = [];
        for (let k = 0; k < m; k++) {
          const a = (k / m) * Math.PI * 2 + U.rand(-0.2, 0.2);
          const rr = r * U.rand(0.8, 1.2);
          pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
        }
        for (let k = 0; k < m; k++) {
          const p = pts[k], q = pts[(k + 1) % m];
          segs.push({ x0: p[0], y0: p[1], x1: q[0], y1: q[1], d: r, w: 1 });
        }
      });
      return segs;
    }

    function drawCracks(g, segs, upto, cx, cy) {
      g.setTransform(sea.dpr, 0, 0, sea.dpr, 0, 0);
      g.clearRect(0, 0, sea.W, sea.H);
      const gl = g.createRadialGradient(cx, cy, 0, cx, cy, 90);
      gl.addColorStop(0, 'rgba(255,255,255,0.22)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gl;
      g.fillRect(cx - 90, cy - 90, 180, 180);
      g.lineCap = 'square';
      g.lineJoin = 'miter';
      // 先画一层暗的粗线当阴影，再画亮的细线
      [['rgba(0,0,0,0.6)', 2], ['rgba(235,250,255,0.9)', 0]].forEach(([color, extra]) => {
        g.strokeStyle = color;
        for (const w of [1, 1.6]) {
          g.lineWidth = w + extra;
          g.beginPath();
          for (const s of segs) {
            if (s.d > upto || s.w !== w) continue;
            g.moveTo(s.x0, s.y0);
            g.lineTo(s.x1, s.y1);
          }
          g.stroke();
        }
      });
    }

    async function fxCrack(from) {
      cat.lock = true;
      cat.frame = 'wide';
      App.companion.react('flinch', { hold: 260 });
      sayWrong(0);
      A.click(0.34);
      [0, 50, 110].forEach((d, n) => setTimeout(() => {
        A.blip({ freq: 2600 - n * 500, type: 'square', vol: 0.018, dur: 0.03, jitter: 0.2 });
      }, d));
      S.shake = 7;

      const p = toCanvas(from);
      const c = fxCanvas();
      const g = c.getContext('2d');
      const segs = buildCracks(p.x, p.y);
      const maxD = segs.reduce((m, s) => Math.max(m, s.d), 1);
      await U.tween(220, (e) => drawCracks(g, segs, e * maxD, p.x, p.y), U.ease.outQuad);
      await U.sleep(1100);
      cat.frame = 'sit';
      cat.lock = false;
      c.classList.add('fade');
      await U.sleep(520);
      c.remove();
    }

    // 2. 拍扁成饼：时长和白团子的 pancake 对齐
    async function fxPancake() {
      cat.lock = true;
      cat.frame = 'blink';
      const hold = 1100;
      A.blip({ freq: 110, type: 'sine', vol: 0.14, dur: 0.22, jitter: 0 });
      A.click(0.25);
      S.shake = 8;
      const sy = sea.surfaceAt(cat.x);
      sea.splash(cat.x, sy, 0.35);
      sea.disturb(cat.x, sy + 6, 1.6);
      App.companion.react('pancake', { hold });

      await U.tween(130, (e) => { cat.fx.sx = 1 + 0.55 * e; cat.fx.sy = 1 - 0.68 * e; }, U.ease.outQuad);
      await U.tween(hold, (e, t) => {
        const ms = t * hold;
        cat.fx.sx = 1.55 + Math.sin(ms / 70) * 0.03;
        cat.fx.sy = 0.32 + Math.sin(ms / 90) * 0.015;
      }, U.ease.linear);
      A.blip({ freq: 720, type: 'sine', vol: 0.05, dur: 0.1, jitter: 0 });
      await U.tween(280, (e) => {
        cat.fx.sx = 1.55 + (1 - 1.55) * e;
        cat.fx.sy = 0.32 + (1 - 0.32) * e;
      }, U.ease.outBack);
      cat.fx.sx = cat.fx.sy = 1;
      cat.frame = 'wide';
      await U.sleep(250);
      cat.frame = 'sit';
      cat.lock = false;
      sayWrong(1);
    }

    // 3. 整屏碎成方块掉下去，再一块块飞回来拼好
    async function fxShatter() {
      const src = sea.canvas, dpr = sea.dpr, W = sea.W, H = sea.H;
      const snap = document.createElement('canvas');
      snap.width = src.width;
      snap.height = src.height;
      snap.getContext('2d').drawImage(src, 0, 0);

      quiet = true;
      cat.lock = true;
      cat.frame = 'wide';
      layer.classList.add('hidden');
      App.companion.react('flinch', { hold: 1200 });
      for (let k = 0; k < 6; k++) setTimeout(() => A.click(0.12 + Math.random() * 0.1), k * 55);
      A.blip({ freq: 90, type: 'sine', vol: 0.12, dur: 0.3, jitter: 0 });

      const c = fxCanvas();
      const g = c.getContext('2d');
      const cols = 5, rows = Math.max(7, Math.round(cols * H / W));
      const tw = W / cols, th = H / rows;
      const tiles = [];
      for (let r = 0; r < rows; r++) {
        for (let q = 0; q < cols; q++) {
          tiles.push({
            x: q * tw, y: r * th,
            vx: U.rand(-90, 90), vy: U.rand(-160, -20), vr: U.rand(-2.6, 2.6),
            delay: U.rand(0, 0.22), dx: 0, dy: 0, rot: 0
          });
        }
      }
      const draw = () => {
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.globalAlpha = 1;
        g.fillStyle = PAL.bg;
        g.fillRect(0, 0, W, H);
        for (const p of tiles) {
          g.save();
          g.translate(p.x + tw / 2 + p.dx, p.y + th / 2 + p.dy);
          g.rotate(p.rot);
          // 每块缩进半个像素，块与块之间留出细缝
          g.drawImage(snap, p.x * dpr, p.y * dpr, tw * dpr, th * dpr, -tw / 2 + 0.5, -th / 2 + 0.5, tw - 1, th - 1);
          g.restore();
        }
      };

      const FALL = 950;
      await U.tween(FALL, (e, k) => {
        const sec = (k * FALL) / 1000;
        for (const p of tiles) {
          const tt = Math.max(0, sec - p.delay);
          p.dx = p.vx * tt;
          p.dy = p.vy * tt + 0.5 * 2200 * tt * tt;
          p.rot = p.vr * tt;
        }
        draw();
      }, U.ease.linear);
      if (!ctx.alive()) return;
      for (const p of tiles) { p.fx = p.dx; p.fy = p.dy; p.fr = p.rot; }
      await U.sleep(220);
      if (!ctx.alive()) return;

      A.whoosh(0.06, 0.6);
      const BACK = 720;
      await U.tween(BACK, (e, k) => {
        const ms = k * BACK;
        for (const p of tiles) {
          const q = U.clamp((ms - p.delay * 600) / (BACK - 140), 0, 1);
          const f = 1 - U.ease.outBack(q);
          p.dx = p.fx * f;
          p.dy = p.fy * f;
          p.rot = p.fr * f;
        }
        draw();
      }, U.ease.linear);
      c.remove();
      quiet = false;
      if (!ctx.alive()) return;

      A.blip({ freq: 1320, type: 'sine', vol: 0.04, dur: 0.2, jitter: 0 });
      S.shake = 3;
      layer.classList.remove('hidden');
      cat.frame = 'sit';
      cat.lock = false;
      App.companion.react('surprise', { hold: 200 });
      sayWrong(2);
    }

    // 4. 屏幕转一圈，小寒和白团子都头晕冒星星
    async function fxSpin() {
      cat.lock = true;
      cat.frame = 'blink';
      cat.stars = true;
      App.companion.react('stars', { hold: 2000 });
      A.whoosh(0.07, 1.3);
      for (let n = 0; n < 5; n++) setTimeout(() => {
        A.blip({ freq: 980 - n * 110, type: 'triangle', vol: 0.03, dur: 0.12, jitter: 0 });
      }, 150 + n * 180);

      ovT('', '50% 50%');
      const spin = U.tween(1300, (e, t) => {
        const s = 1 - 0.2 * Math.sin(Math.PI * t);
        ovT(`rotate(${(e * 360).toFixed(2)}deg) scale(${s.toFixed(3)})`);
      }, U.ease.inOutCubic);
      const wob = U.tween(2000, (e, t) => {
        cat.fx.rot = Math.sin((t * 2000) / 150) * 0.16 * (1 - t * 0.6);
      }, U.ease.linear);
      await spin;
      ovT('', '');
      await wob;
      cat.fx.rot = 0;
      cat.stars = false;
      cat.frame = 'sit';
      cat.lock = false;
      sayWrong(3);
    }

    // 5. 大猫爪印落下来，把整个画面"揉捏"三下
    App.companion.define('knead', async (c, o) => {
      c.frame('blink');
      const n = o.times || 3, ms = o.ms || 380;
      for (let i = 0; i < n; i++) {
        const v = i % 2 === 0;
        await c.tween(ms, (e, t) => {
          const s = Math.sin(Math.PI * t);
          c.set(v ? { sx: 1 + 0.22 * s, sy: 1 - 0.26 * s } : { sx: 1 - 0.18 * s, sy: 1 + 0.2 * s });
        }, U.ease.linear);
      }
      c.frame('wide');
      await c.sleep(220);
    });

    function pomf(n) {
      A.blip({ freq: 260 - n * 20, type: 'sine', vol: 0.09, dur: 0.16, jitter: 0 });
      A.blip({ freq: 520 - n * 30, type: 'triangle', vol: 0.03, dur: 0.1, jitter: 0 });
    }

    async function fxPaw() {
      const app = document.getElementById('app');
      const paw = App.sprites.render(PAW, CFG.palettes.paw, 10);
      paw.className = 's4-paw';
      app.appendChild(paw);
      self._paw = paw;
      const pw = paw.width, ph = paw.height;
      const r = sea.canvas.getBoundingClientRect();
      const x = r.left + sea.W / 2;
      const y = r.top + (qMid + optTop + 60) / 2;
      paw.style.width = pw + 'px';
      paw.style.left = (x - pw / 2) + 'px';
      paw.style.top = (y - ph / 2) + 'px';
      paw.style.opacity = '0';

      cat.lock = true;
      cat.frame = 'blink';
      A.whoosh(0.05, 0.35);
      await U.tween(260, (e) => {
        paw.style.opacity = e.toFixed(3);
        paw.style.transform = `rotate(${(-0.3 + 0.18 * e).toFixed(3)}rad) scale(${(2.2 - 1.2 * e).toFixed(3)})`;
      }, U.ease.outQuad);
      if (!ctx.alive()) return;
      S.shake = 6;
      pomf(0);
      App.companion.react('knead', { times: 3, ms: 380 });

      ovT('', `${(x - r.left).toFixed(1)}px ${(y - r.top).toFixed(1)}px`);
      for (let n = 0; n < 3; n++) {
        const v = n % 2 === 0;
        if (n) pomf(n);
        await U.tween(380, (e, t) => {
          const s = Math.sin(Math.PI * t);
          ovT(v ? `scale(${(1 + 0.07 * s).toFixed(3)}, ${(1 - 0.09 * s).toFixed(3)})`
                : `scale(${(1 - 0.06 * s).toFixed(3)}, ${(1 + 0.08 * s).toFixed(3)})`);
          paw.style.transform = `rotate(-0.12rad) scale(${(1 - 0.1 * s).toFixed(3)}, ${(1 - 0.14 * s).toFixed(3)})`;
          cat.fx.sx = v ? 1 + 0.25 * s : 1 - 0.15 * s;
          cat.fx.sy = v ? 1 - 0.25 * s : 1 + 0.18 * s;
        }, U.ease.linear);
        if (!ctx.alive()) return;
      }
      ovT('', '');
      cat.fx.sx = cat.fx.sy = 1;

      await U.tween(420, (e) => {
        paw.style.opacity = (1 - e).toFixed(3);
        paw.style.transform = `rotate(-0.12rad) translateY(${(-30 * e).toFixed(1)}px) scale(${(1 + 0.1 * e).toFixed(3)})`;
      }, U.ease.outQuad);
      paw.remove();
      self._paw = null;
      cat.frame = 'sit';
      cat.lock = false;
      sayWrong(4);
    }

    const PUNISH = [fxCrack, fxPancake, fxShatter, fxSpin, fxPaw];

    // ---------- 结尾：五个音连起来 ----------
    async function finale() {
      await U.sleep(300);
      if (!ctx.alive()) return;
      const notes = MELODY.map((m, k) => {
        const el = U.el('div', 's4-mnote', layer, '♪');
        el.style.setProperty('--c', COLORS[k]);
        el.style.left = (R.x0 + (R.x1 - R.x0) * (k + 1) / 6) + 'px';
        el.style.top = (R.top + R.gap * 4 - (m - 1) * R.gap / 2) + 'px';
        return el;
      });
      for (let k = 0; k < notes.length; k++) {
        notes[k].classList.add('on');
        A.coin(MELODY[k]);
        sea.beat(0.7);
        await U.sleep(k === notes.length - 1 ? beatMs * 1.5 : beatMs * 0.75);
        if (!ctx.alive()) return;
      }
      // 收一个 C 大三和弦，BGM 再清晰一点
      A.coin(0); A.coin(2); A.coin(3);
      sea.beat(1.1);
      const ch = CFG.chapters.scene4 || {};
      A.setClarity(Math.min(1, (ch.clarity != null ? ch.clarity : 0.44) + 0.08), 3);
      notes.forEach((n) => n.classList.add('out'));
      App.companion.react('happy');
      await U.sleep(700);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 2200 });
      if (!ctx.alive()) return;
      await U.sleep(500);
    }

    // ---------- 时间线 ----------
    (async () => {
      sea.start();
      App.companion.show({ corner: 'tl' });
      App.shards.show();
      await U.sleep(900);
      if (!ctx.alive()) return;

      let hint = null;
      for (let i = 0; i < T.questions.length; i++) {
        App.companion.say(T.pieceIntro[i], { hold: 700, speed: 90 });
        await U.sleep(650);
        if (!ctx.alive()) return;

        const Q = buildQuestion(i);
        await showQuestion(Q);
        if (!ctx.alive()) return;
        if (i === 0 && T.hint) {
          hint = U.el('div', 'soft-hint sea', ov, T.hint);
          requestAnimationFrame(() => hint.classList.add('on'));
        }

        const b = await waitChoice(Q);
        if (!ctx.alive()) return;
        if (hint) { hint.classList.remove('on'); hint = null; }

        const k = +b.dataset.k;
        const right = Q.btns.find((x) => +x.dataset.k === Q.q.correct);
        if (k === Q.q.correct) await onCorrect(i, Q, b);
        else await onWrong(i, Q, b, right);
        if (!ctx.alive()) return;

        mixTarget = 0.62 + (i + 1) * 0.05;                  // 每答一题，青紫再渗进来一点
        await hideQuestion(Q);
        if (!ctx.alive()) return;
      }

      await finale();
      if (!ctx.alive()) return;
      ctx.next();
    })();
  },

  exit() {
    if (this._sea) { this._sea.destroy(); this._sea = null; }
    if (this._paw) { this._paw.remove(); this._paw = null; }
    const ov = document.getElementById('overlay');
    ov.style.transform = '';
    ov.style.transformOrigin = '';
    App.companion.reset();
    App.shards.hide();
  }
});