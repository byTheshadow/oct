/* =========================================================
 * Scene 7 · 星空词云 + 照片 + 词频猜猜看
 *   白团子："这些，是我偷偷数的……不许笑。"
 *
 *   背景：一整片"真的"夜空 —— 预渲染的银河带（星云 + 尘埃暗带 + 上千颗细碎星点），
 *         中景闪烁星、带十字星芒的亮星、偶尔划过的流星；陀螺仪 + 手指拖动做三层视差。
 *
 *   7a：两道猜词题（发光星球按钮，没有对错惩罚，答错亮出正确答案）→
 *       【两个星座】炫少的词连成一只"猛兽爪印"，小寒的词连成一只"猫猫头"。
 *       星星一开始是暗的，用手指划过去把它们点亮（亮度 = 次数），连线随之长出来；
 *       两个星座都点亮后，两边都有的词（"喜欢"）之间架起一道金色星桥。
 *       → 数字卡片：1774 / 1038 / 736 / 1.5 万 从 0 滚上去，两人的占比条同时长出来。
 *   7b：16 颗词云星（亮度/大小 = 次数）。点星弹出白团子口吻的小注解卡片；
 *       空白处点一下会长出一颗新的小星星；抓住流星可以许愿；
 *       8 张照片藏在彩虹晕的"照片星"里，点开会从星星里飞出来。
 *       底部 10 颗进度星点满后，星星汇聚成大写字母 "Y"，金线一段段点亮，白团子收尾，ctx.next()。
 *
 * 不用 three 舞台（config.chapters.scene7 里 stage:false），整章画在 #overlay 里：
 *   一张 2D canvas（星空 + 星座 + 词云 + 粒子）
 *   + .s7-skydom（照片星，跟着星空一起视差平移）
 *   + .s7-layer（题目 / 数字卡 / 注解卡 / 灯箱 / 提示）
 * 可选文案（config.text.scene7 里不写也有默认值）：
 *   rankHint / rankShared / statsTap / wish / panHint / quizKicker
 * 调试：?scene=scene7&debug
 * ========================================================= */
App.director.register('scene7', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene7;
    const PAL = CFG.palettes.star;
    const self = this;
    const FONT = '"Noto Sans SC", "PingFang SC", system-ui, sans-serif';
    const BPM = CFG.SEA_BPM || 96;
    const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const canvas = U.el('canvas', 's7-canvas', ov);
    const g = canvas.getContext('2d');
    const skyDom = U.el('div', 's7-skydom', ov);
    const layer = U.el('div', 's7-layer', ov);

    /* =========================================================
     * 全部状态先声明（避免布局函数在声明前被调用）
     * ========================================================= */
    let W = 0, H = 0, dpr = 1, t = 0, running = true;
    let phase = 'intro';            // intro → quiz → rank → stats → cloud → morph
    let skyAlpha = 0;
    const pan = { x: 0, y: 0 };
    const PAN_MAX = 46;
    let ox = 0, oy = 0;             // 当前视差偏移（陀螺仪 + 拖动）
    let ptr = null;

    // 星空
    const SKY_M = 64;
    let sky = null, skyW = 0, skyH = 0;
    let midStars = [], brightStars = [];
    const extraStars = [];          // 点空白处长出来的小星星
    const meteors = [];
    let nextMeteor = 3.5, wishSaid = false;

    // 星座
    let consts = [], sharedPairs = [];
    let rankAlpha = 0, bridgeP = 0, rankIdle = 0, rankFinishing = false, rankResolve = null, litCount = 0;

    // 词云
    let wordStars = [], cloudActive = false, visitedCount = 0, halfwaySaid = false, morphTriggered = false;
    let resolveCloud = null, callTimer = 0, wordLabelA = 1;
    const NEED = Math.min(10, (T.words || []).length);
    const photoEls = [];
    let noteEl = null, noteTimer = 0, progressEl = null;

    // 变形 Y
    let morphStars = null, linkP = [], yGlow = 0;

    // 粒子 / 涟漪 / 手指拖尾
    const particles = [], ripples = [], trail = [];

    const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760];

    /* =========================================================
     * 小工具
     * ========================================================= */
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const rgb = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
    const ez = {
      out: (e) => 1 - Math.pow(1 - e, 3),
      inOut: (e) => (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2)
    };
    const sleep = (ms) => U.sleep(ms);

    // 自带的补间：不依赖外部缓动名，场景退出后自动停
    function tween(ms, fn, ease) {
      return new Promise((res) => {
        const t0 = performance.now();
        function step(now) {
          if (!running) { res(); return; }
          const e = Math.min(1, (now - t0) / ms);
          fn(ease ? ease(e) : e);
          if (e < 1) requestAnimationFrame(step); else res();
        }
        requestAnimationFrame(step);
      });
    }

    const glowCache = {};
    function glowOf(color) {
      if (glowCache[color]) return glowCache[color];
      const s = 128;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const col = hex(color);
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, rgb(col, 0.8));
      gr.addColorStop(0.16, rgb(col, 0.36));
      gr.addColorStop(0.45, rgb(col, 0.09));
      gr.addColorStop(1, rgb(col, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return (glowCache[color] = c);
    }

    // 十字星芒（真实星空照片里亮星的衍射光）
    function spike(x, y, L, a, col) {
      if (a <= 0.01 || L < 2) return;
      g.globalAlpha = 1;
      g.lineWidth = 1;
      let gr = g.createLinearGradient(x - L, y, x + L, y);
      gr.addColorStop(0, rgb(col, 0)); gr.addColorStop(0.5, rgb(col, a)); gr.addColorStop(1, rgb(col, 0));
      g.strokeStyle = gr;
      g.beginPath(); g.moveTo(x - L, y); g.lineTo(x + L, y); g.stroke();
      gr = g.createLinearGradient(x, y - L, x, y + L);
      gr.addColorStop(0, rgb(col, 0)); gr.addColorStop(0.5, rgb(col, a)); gr.addColorStop(1, rgb(col, 0));
      g.strokeStyle = gr;
      g.beginPath(); g.moveTo(x, y - L); g.lineTo(x, y + L); g.stroke();
    }

    function softHint(text, ms) {
      if (!text) return;
      const h = U.el('div', 's7-hint', layer, text);
      requestAnimationFrame(() => h.classList.add('on'));
      setTimeout(() => h.classList.remove('on'), ms);
      setTimeout(() => h.remove(), ms + 700);
    }

    function localRectCenter(el) {
      const r = el.getBoundingClientRect(), o = ov.getBoundingClientRect();
      return { x: r.left - o.left + r.width / 2, y: r.top - o.top + r.height / 2 };
    }

    /* =========================================================
     * 星空：预渲染银河 + 中景闪烁星 + 亮星
     * ========================================================= */
    function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2; }

    function buildSky() {
      const w = W + SKY_M * 2, h = H + SKY_M * 2;
      const sd = Math.min(dpr, 1.5);
      const c = document.createElement('canvas');
      c.width = Math.round(w * sd); c.height = Math.round(h * sd);
      const x = c.getContext('2d');
      x.scale(sd, sd);

      const bg = x.createLinearGradient(0, 0, w * 0.35, h);
      PAL.sky.forEach((col, i) => bg.addColorStop(i / (PAL.sky.length - 1), col));
      x.fillStyle = bg;
      x.fillRect(0, 0, w, h);

      // 银河轴线：左下 → 右上
      const ax0 = -w * 0.08, ay0 = h * 0.95, ax1 = w * 1.08, ay1 = h * 0.05;
      const dx = ax1 - ax0, dy = ay1 - ay0, len = Math.hypot(dx, dy);
      const nx = -dy / len, ny = dx / len;
      const band = Math.min(w, h) * 0.24;
      const onBand = (k, off) => [ax0 + dx * k + nx * off, ay0 + dy * k + ny * off];

      // 彩色星云
      x.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 24; i++) {
        const [px, py] = onBand(Math.random(), gauss() * band * 0.7);
        const r = band * U.rand(0.5, 1.4);
        const col = hex(PAL.glows[i % PAL.glows.length]);
        const a = U.rand(0.04, 0.1);
        const rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, rgb(col, a)); rg.addColorStop(0.5, rgb(col, a * 0.4)); rg.addColorStop(1, rgb(col, 0));
        x.fillStyle = rg;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      // 银河核心的暖白雾
      for (let i = 0; i < 12; i++) {
        const [px, py] = onBand(Math.random(), gauss() * band * 0.25);
        const r = band * U.rand(0.35, 0.8);
        const rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, 'rgba(255,238,215,0.07)'); rg.addColorStop(1, 'rgba(255,238,215,0)');
        x.fillStyle = rg;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      // 细碎星点：银河带里密，外面稀
      const tints = ['255,255,255', '205,218,255', '255,230,205', '225,210,255'];
      function dot(px, py) {
        const big = Math.random() < 0.05;
        const r = big ? U.rand(0.8, 1.3) : U.rand(0.25, 0.7);
        x.fillStyle = `rgba(${tints[(Math.random() * tints.length) | 0]},${U.rand(0.25, 0.95).toFixed(2)})`;
        if (big) { x.beginPath(); x.arc(px, py, r, 0, 6.283); x.fill(); }
        else x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      const nBand = Math.round(U.clamp(w * h / 230, 900, 4200));
      const nAll = Math.round(U.clamp(w * h / 950, 250, 1200));
      for (let i = 0; i < nBand; i++) { const [px, py] = onBand(Math.random(), gauss() * band); dot(px, py); }
      for (let i = 0; i < nAll; i++) dot(Math.random() * w, Math.random() * h);

      // 尘埃暗带（让银河有"层次"，不是一片均匀的光）
      x.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 18; i++) {
        const [px, py] = onBand(Math.random(), gauss() * band * 0.18 + band * 0.06);
        const r = band * U.rand(0.12, 0.38);
        const rg = x.createRadialGradient(px, py, 0, px, py, r);
        rg.addColorStop(0, 'rgba(4,5,16,0.38)'); rg.addColorStop(1, 'rgba(4,5,16,0)');
        x.fillStyle = rg;
        x.fillRect(px - r, py - r, r * 2, r * 2);
      }
      sky = c; skyW = w; skyH = h;
    }

    function seedStars() {
      const tints = ['#ffffff', '#cfe0ff', '#ffe2c4', '#dccfff'];
      midStars = [];
      const n = Math.round(U.clamp(W * H / 6500, 40, 110));
      for (let i = 0; i < n; i++) {
        midStars.push({ x: Math.random(), y: Math.random(), r: U.rand(0.6, 1.3), ph: Math.random() * 6.28, sp: U.rand(0.6, 2.2), col: hex(tints[i % tints.length]) });
      }
      brightStars = [];
      const n2 = Math.round(U.clamp(W * H / 38000, 7, 16));
      for (let i = 0; i < n2; i++) {
        const c = tints[i % tints.length];
        brightStars.push({ x: Math.random(), y: Math.random(), r: U.rand(1.1, 1.9), ph: Math.random() * 6.28, sp: U.rand(0.4, 1.1), hex: c, col: hex(c) });
      }
    }

    function spawnMeteor() {
      const ang = U.rand(2.45, 2.8);
      const sp = U.rand(520, 820);
      meteors.push({
        x: U.rand(0.35, 1.05) * W, y: U.rand(-0.05, 0.4) * H,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        life: 0, max: U.rand(0.75, 1.15), len: U.rand(90, 170)
      });
    }

    function drawBackground(dt) {
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = PAL.bg;
      g.fillRect(0, 0, W, H);
      if (sky) {
        g.globalAlpha = skyAlpha;
        g.drawImage(sky, -SKY_M + ox * 0.3, -SKY_M + oy * 0.3, skyW, skyH);
      }

      g.globalCompositeOperation = 'lighter';
      const mx = ox * 0.6, my = oy * 0.6;
      for (const s of midStars) {
        const a = skyAlpha * (0.2 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)));
        g.globalAlpha = 1;
        g.fillStyle = rgb(s.col, a);
        g.beginPath(); g.arc(s.x * W + mx, s.y * H + my, s.r, 0, 6.283); g.fill();
      }
      const bx = ox * 0.8, by = oy * 0.8;
      for (const s of brightStars) {
        const tw = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        const x = s.x * W + bx, y = s.y * H + by;
        const R = s.r * 9 * tw;
        g.globalAlpha = skyAlpha * 0.6 * tw;
        g.drawImage(glowOf(s.hex), x - R, y - R, R * 2, R * 2);
        spike(x, y, s.r * 7 * tw, 0.45 * tw * skyAlpha, s.col);
        g.globalAlpha = skyAlpha;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x, y, s.r * 0.75, 0, 6.283); g.fill();
      }

      // 点出来的小星星
      for (const s of extraStars) {
        const age = t - s.born;
        const k = Math.min(1, age / 0.8);
        const tw = 0.6 + 0.4 * Math.sin(t * 2 + s.ph);
        const x = s.x + ox * 0.9, y = s.y + oy * 0.9;
        const R = 9 * tw * k;
        g.globalAlpha = 0.7 * k;
        g.drawImage(glowOf(s.hex), x - R, y - R, R * 2, R * 2);
        g.globalAlpha = k;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x, y, 1.1, 0, 6.283); g.fill();
      }

      // 流星
      if (!REDUCED && phase !== 'morph' && phase !== 'intro') {
        nextMeteor -= dt;
        if (nextMeteor <= 0) { spawnMeteor(); nextMeteor = U.rand(4.5, 9); }
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.life += dt; m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.life >= m.max) { meteors.splice(i, 1); continue; }
        const a = Math.sin((m.life / m.max) * Math.PI);
        const sp = Math.hypot(m.vx, m.vy);
        const tx = m.x - (m.vx / sp) * m.len, ty = m.y - (m.vy / sp) * m.len;
        const gr = g.createLinearGradient(m.x, m.y, tx, ty);
        gr.addColorStop(0, `rgba(255,255,255,${(0.95 * a).toFixed(3)})`);
        gr.addColorStop(0.3, `rgba(180,210,255,${(0.4 * a).toFixed(3)})`);
        gr.addColorStop(1, 'rgba(180,210,255,0)');
        g.globalAlpha = 1;
        g.strokeStyle = gr;
        g.lineWidth = 1.8;
        g.lineCap = 'round';
        g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(tx, ty); g.stroke();
        g.globalAlpha = a;
        g.drawImage(glowOf('#ffffff'), m.x - 12, m.y - 12, 24, 24);
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }

    /* =========================================================
     * 粒子 / 涟漪 / 手指拖尾
     * ========================================================= */
    function sparkle(x, y, colHex, n, power) {
      const col = hex(colHex);
      for (let i = 0; i < n; i++) {
        if (particles.length > 420) particles.shift();
        const a = Math.random() * 6.283, s = U.rand(0.3, 1) * (power || 90);
        particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0, max: U.rand(0.5, 1), r: U.rand(0.8, 2.1), col });
      }
    }
    function drawParticles(dt) {
      if (!particles.length) return;
      g.save();
      g.globalCompositeOperation = 'lighter';
      const damp = Math.exp(-dt * 3);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life >= p.max) { particles.splice(i, 1); continue; }
        p.vx *= damp; p.vy = p.vy * damp + 26 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = 1 - p.life / p.max;
        g.fillStyle = rgb(p.col);
        g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
      }
      g.restore();
    }
    function ripple(x, y) {
      ripples.push({ x, y, age: 0, max: 0.6 });
      A.blip({ freq: 520, type: 'sine', vol: 0.022, dur: 0.1, jitter: 0.1 });
    }
    function drawRipples(dt) {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]; r.age += dt;
        if (r.age >= r.max) { ripples.splice(i, 1); continue; }
        const e = r.age / r.max;
        g.globalAlpha = (1 - e) * 0.45;
        g.strokeStyle = PAL.star;
        g.lineWidth = 1.2;
        g.beginPath(); g.arc(r.x, r.y, 5 + ez.out(e) * 30, 0, 6.283); g.stroke();
      }
      g.globalAlpha = 1;
    }
    function drawTrail(dt) {
      if (!trail.length) return;
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = trail[i];
        p.age += dt;
        if (p.age > 0.5) { trail.splice(i, 1); continue; }
        const a = 1 - p.age / 0.5;
        const R = 10 * a + 3;
        g.globalAlpha = a * 0.7;
        g.drawImage(glowOf(PAL.star), p.x - R, p.y - R, R * 2, R * 2);
      }
      g.restore();
    }

    /* =========================================================
     * 7a · 猜词题：发光星球按钮，没有对错惩罚
     * ========================================================= */
    function runQuiz(q, idx, total) {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's7-quiz', layer);
        U.el('div', 's7-quiz-kicker', wrap, (T.quizKicker || '猜猜看') + ' ' + idx + '/' + total);
        U.el('div', 's7-quiz-q', wrap, q.q);
        const opts = U.el('div', 's7-quiz-opts', wrap);
        const btns = q.options.map((opt, i) => {
          const b = U.el('button', 's7-planet', opts);
          b.type = 'button';
          b.style.setProperty('--c', PAL.glows[(i + idx) % PAL.glows.length]);
          b.style.animationDelay = (i * -1.1).toFixed(1) + 's';
          U.el('span', 's7-planet-label', b, opt);
          return b;
        });
        requestAnimationFrame(() => wrap.classList.add('on'));
        A.whoosh(0.03, 0.4);
        let answered = false;
        btns.forEach((b, i) => {
          b.addEventListener('click', () => {
            if (answered || !ctx.alive()) return;
            answered = true;
            wrap.classList.add('answered');
            const ok = i === q.correct;
            b.classList.add(ok ? 'ok' : 'bad');
            const c = localRectCenter(b);
            if (ok) {
              A.coin(6);
              sparkle(c.x, c.y, PAL.gold, 26, 140);
            } else {
              A.blip({ freq: 220, type: 'triangle', vol: 0.05, dur: 0.16, jitter: 0 });
              btns[q.correct].classList.add('reveal');
              const c2 = localRectCenter(btns[q.correct]);
              setTimeout(() => sparkle(c2.x, c2.y, PAL.gold, 18, 110), 220);
            }
            setTimeout(() => {
              wrap.classList.remove('on');
              wrap.classList.add('out');
              setTimeout(() => { wrap.remove(); resolve(ok); }, 420);
            }, ok ? 650 : 1100);
          });
        });
      });
    }

    /* =========================================================
     * 两个星座：炫少 = 猛兽爪印，小寒 = 猫猫头
     *   pts 是 0..1 的方框坐标；order 决定"次数第 i 多的词"放在哪个点上
     * ========================================================= */
    const SHAPE_PAW = {
      pts: [[0.14, 0.40], [0.36, 0.16], [0.64, 0.16], [0.86, 0.40],
            [0.27, 0.67], [0.50, 0.52], [0.73, 0.67], [0.63, 0.90], [0.37, 0.90]],
      edges: [[4, 5], [5, 6], [6, 7], [7, 8], [8, 4]],
      order: [5, 1, 2, 0, 3, 4, 6, 7, 8]
    };
    const SHAPE_CAT = {
      pts: [[0.20, 0.05], [0.35, 0.32], [0.65, 0.32], [0.80, 0.05], [0.92, 0.50],
            [0.74, 0.85], [0.50, 0.96], [0.26, 0.85], [0.08, 0.50], [0.50, 0.60]],
      edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 0]],
      order: [9, 0, 3, 1, 2, 8, 4, 7, 5, 6]
    };

    function buildConst(list, shape, title, color) {
      const maxN = Math.max.apply(null, list.map((it) => it[1]));
      const stars = list.map((item, i) => {
        const slot = i < shape.order.length ? shape.order[i] : -1;
        const p = slot >= 0 ? shape.pts[slot] : [U.rand(0.15, 0.85), U.rand(0.15, 0.85)];
        return { w: item[0], n: item[1], k: item[1] / maxN, u: p[0], v: p[1], slot, lit: false, litT: 0, x: 0, y: 0, sx: 0, sy: 0 };
      });
      const bySlot = {};
      stars.forEach((s) => { if (s.slot >= 0) bySlot[s.slot] = s; });
      const edges = shape.edges
        .filter((e) => bySlot[e[0]] && bySlot[e[1]])
        .map((e) => ({ a: bySlot[e[0]], b: bySlot[e[1]], p: 0 }));
      return { title, stars, edges, color, done: false, doneT: 0, cx: 0, cy: 0, s: 0 };
    }

    function layoutConsts() {
      if (consts.length < 2) return;
      const portrait = H > W * 1.1;
      let s, boxes;
      if (portrait) {
        s = Math.min(W * 0.62, H * 0.28);
        boxes = [{ cx: W * 0.5, cy: H * 0.35 }, { cx: W * 0.5, cy: H * 0.73 }];
      } else {
        s = Math.min(W * 0.3, H * 0.52);
        boxes = [{ cx: W * 0.29, cy: H * 0.56 }, { cx: W * 0.71, cy: H * 0.56 }];
      }
      consts.forEach((c, i) => {
        c.cx = boxes[i].cx; c.cy = boxes[i].cy; c.s = s;
        c.stars.forEach((st) => { st.x = c.cx + (st.u - 0.5) * s; st.y = c.cy + (st.v - 0.5) * s; });
      });
    }

    function rankTouch(x, y) {
      if (phase !== 'rank' || rankFinishing) return;
      consts.forEach((c) => c.stars.forEach((s) => {
        if (!s.lit && Math.hypot(s.sx - x, s.sy - y) < 30) ignite(c, s);
      }));
    }

    function ignite(c, s) {
      s.lit = true; s.litT = t; rankIdle = 0;
      A.blip({ freq: SCALE[litCount % SCALE.length], type: 'sine', vol: 0.04, dur: 0.24, jitter: 0.01 });
      litCount++;
      sparkle(s.sx, s.sy, c.color, 10, 70);
      if (!c.done && c.stars.every((q) => q.lit)) {
        c.done = true; c.doneT = t;
        setTimeout(() => { if (ctx.alive()) { A.coin(4); A.coin(7); } }, 200);
        if (consts.every((q) => q.done)) finishRank();
      }
    }

    function updateRank(dt) {
      if (phase !== 'rank' || rankFinishing || !consts.length) return;
      rankIdle += dt;
      // 一直没人划：8 秒后自己一颗一颗亮起来，保证剧情能往下走
      if (rankIdle > 8) {
        rankIdle = 7.75;
        for (const c of consts) {
          const s = c.stars.find((q) => !q.lit);
          if (s) { ignite(c, s); break; }
        }
      }
    }

    async function finishRank() {
      rankFinishing = true;
      await sleep(800);
      if (!ctx.alive()) return;
      if (sharedPairs.length) {
        A.whoosh(0.04, 0.8);
        await tween(1400, (e) => { bridgeP = e; }, ez.inOut);
        if (!ctx.alive()) return;
        sharedPairs.forEach((p) => { sparkle(p[0].sx, p[0].sy, PAL.gold, 16, 100); sparkle(p[1].sx, p[1].sy, PAL.gold, 16, 100); });
        A.coin(9);
        await App.companion.say(T.rankShared || '……这个词，我们俩都说了好多遍呢。', { small: true, hold: 1600 });
      } else {
        await sleep(1600);
      }
      if (!ctx.alive()) return;
      await tween(800, (e) => { rankAlpha = 1 - e; }, ez.inOut);
      consts = []; sharedPairs = []; bridgeP = 0;
      if (rankResolve) { const r = rankResolve; rankResolve = null; r(); }
    }

    function runRank() {
      return new Promise((resolve) => {
        rankResolve = resolve;
        consts = [
          buildConst(T.rankL, SHAPE_PAW, T.rankTitleL, PAL.glows[0]),
          buildConst(T.rankR, SHAPE_CAT, T.rankTitleR, PAL.glows[2])
        ];
        layoutConsts();
        sharedPairs = [];
        consts[0].stars.forEach((a) => {
          const b = consts[1].stars.find((q) => q.w === a.w);
          if (b) sharedPairs.push([a, b]);
        });
        rankIdle = 0; rankFinishing = false; litCount = 0;
        phase = 'rank';
        A.whoosh(0.04, 0.6);
        tween(900, (e) => { rankAlpha = e; }, ez.out);
        softHint(T.rankHint || '（用手指划过星星，把它们点亮）', 3600);
      });
    }

    function bridgeCtrl(a, b) {
      const mx = (a.sx + b.sx) / 2, my = (a.sy + b.sy) / 2;
      const dx = b.sx - a.sx, dy = b.sy - a.sy, d = Math.hypot(dx, dy) || 1;
      const bend = d * 0.24;
      return { x: mx - (dy / d) * bend, y: my + (dx / d) * bend };
    }
    function qpt(a, c, b, u) {
      const v = 1 - u;
      return [v * v * a.sx + 2 * v * u * c.x + u * u * b.sx, v * v * a.sy + 2 * v * u * c.y + u * u * b.sy];
    }

    function drawRank(dt) {
      if (!consts.length || rankAlpha <= 0.001) return;
      const fx = ox * 0.85, fy = oy * 0.85;
      const unitK = U.clamp(Math.min(W, H) / 400, 0.8, 1.3);
      const gold = hex(PAL.gold);

      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      consts.forEach((c) => {
        const col = hex(c.color);
        c.stars.forEach((s) => { s.sx = s.x + fx; s.sy = s.y + fy; });

        // 连线：两端都亮了才长出来
        c.edges.forEach((e) => {
          if (e.a.lit && e.b.lit) e.p = Math.min(1, e.p + dt * 2.4);
          if (e.p <= 0) return;
          const k = ez.out(e.p);
          const ex = U.lerp(e.a.sx, e.b.sx, k), ey = U.lerp(e.a.sy, e.b.sy, k);
          const glow = c.done ? 0.16 + 0.08 * Math.sin(t * 3) : 0.1;
          g.globalAlpha = rankAlpha;
          g.lineWidth = 4;
          g.strokeStyle = rgb(col, glow);
          g.beginPath(); g.moveTo(e.a.sx, e.a.sy); g.lineTo(ex, ey); g.stroke();
          g.lineWidth = 1.1;
          g.strokeStyle = rgb(col, 0.75);
          g.beginPath(); g.moveTo(e.a.sx, e.a.sy); g.lineTo(ex, ey); g.stroke();
        });

        // 星星
        c.stars.forEach((s, i) => {
          if (!s.lit) {
            const br = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 0.9);
            g.globalAlpha = rankAlpha * (0.3 + 0.3 * br);
            g.fillStyle = '#dfe6ff';
            g.beginPath(); g.arc(s.sx, s.sy, 1.3 + 1.5 * s.k, 0, 6.283); g.fill();
            g.globalAlpha = rankAlpha * 0.16 * br;
            g.strokeStyle = '#dfe6ff';
            g.lineWidth = 1;
            g.beginPath(); g.arc(s.sx, s.sy, 7 + 6 * br, 0, 6.283); g.stroke();
            return;
          }
          const age = t - s.litT;
          const pop = age < 0.6 ? 1 + 0.9 * Math.sin((age / 0.6) * Math.PI) : 1;
          const tw = 0.75 + 0.25 * Math.sin(t * 1.7 + i * 1.3);
          const R = (10 + 24 * s.k) * tw * pop * unitK;
          g.globalAlpha = rankAlpha;
          g.drawImage(glowOf(c.color), s.sx - R, s.sy - R, R * 2, R * 2);
          g.globalAlpha = rankAlpha * 0.85;
          g.drawImage(glowOf('#ffffff'), s.sx - R * 0.4, s.sy - R * 0.4, R * 0.8, R * 0.8);
          if (s.k > 0.55) spike(s.sx, s.sy, R * 1.25, 0.5 * rankAlpha * tw, [255, 255, 255]);
          g.globalAlpha = rankAlpha;
          g.fillStyle = '#ffffff';
          g.beginPath(); g.arc(s.sx, s.sy, 1.4 + 1.8 * s.k, 0, 6.283); g.fill();
        });
      });

      // 两边都有的词：金色星桥 + 沿桥游走的小光点
      if (bridgeP > 0) {
        sharedPairs.forEach(([a, b]) => {
          const c = bridgeCtrl(a, b);
          const N = 40, upto = Math.max(1, Math.round(N * bridgeP));
          const pts = [];
          for (let i = 0; i <= upto; i++) pts.push(qpt(a, c, b, (i / N)));
          g.globalAlpha = rankAlpha;
          [[6, 0.12], [2, 0.8]].forEach(([lw, al]) => {
            g.lineWidth = lw;
            g.strokeStyle = rgb(gold, al);
            g.beginPath();
            pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
            g.stroke();
          });
          const u = bridgeP * ((t * 0.35) % 1);
          const p = qpt(a, c, b, u);
          g.drawImage(glowOf(PAL.gold), p[0] - 14, p[1] - 14, 28, 28);
        });
      }
      g.restore();

      // 文字：词 + 次数，放在远离星座中心的一侧
      g.save();
      const fs = W < 360 ? 11 : 12;
      consts.forEach((c) => {
        const ccx = c.cx + fx, ccy = c.cy + fy;
        c.stars.forEach((s) => {
          if (!s.lit) return;
          const a = rankAlpha * Math.min(1, (t - s.litT) / 0.45);
          let dx = s.sx - ccx, dy = s.sy - ccy;
          const d = Math.hypot(dx, dy);
          if (d < 8) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
          const off = 13 + 9 * s.k;
          const lx = s.sx + dx * off, ly = s.sy + dy * off;
          g.textAlign = dx > 0.35 ? 'left' : dx < -0.35 ? 'right' : 'center';
          g.textBaseline = dy > 0.35 ? 'top' : dy < -0.35 ? 'bottom' : 'middle';
          g.globalAlpha = a;
          g.shadowColor = c.color;
          g.shadowBlur = 8;
          g.font = `600 ${fs}px ${FONT}`;
          g.fillStyle = 'rgba(255,248,236,0.96)';
          const label = s.w;
          g.fillText(label, lx, ly);
          // 次数：更小更淡，紧跟在词后面（居中时放在下方）
          const lw = g.measureText(label).width;
          g.shadowBlur = 0;
          g.font = `500 ${fs - 2}px ${FONT}`;
          g.fillStyle = 'rgba(255,224,150,0.75)';
          const align = g.textAlign;
          g.textAlign = 'left';
          if (align === 'left') g.fillText(String(s.n), lx + lw + 4, ly);
          else if (align === 'right') g.fillText(String(s.n), lx + 4, ly);
          else g.fillText(String(s.n), lx + lw / 2 + 4, ly);
        });
        if (c.done && c.title) {
          const a = rankAlpha * Math.min(1, (t - c.doneT) / 0.9);
          g.globalAlpha = a;
          g.textAlign = 'center';
          g.textBaseline = 'bottom';
          g.shadowColor = c.color;
          g.shadowBlur = 14;
          g.font = `600 ${W < 360 ? 14 : 15}px ${FONT}`;
          g.fillStyle = '#fff4d6';
          g.fillText('✦ ' + c.title + ' ✦', ccx, ccy - c.s / 2 - 18);
        }
      });
      g.restore();
    }

    /* =========================================================
     * 数字卡片：数字从 0 滚上去 + 两人占比条
     * ========================================================= */
    function buildCountLine(el, text) {
      const nums = [];
      text.split(/(\d+(?:\.\d+)?)/).forEach((part, i) => {
        if (!part) return;
        if (i % 2 === 1) {
          const dec = (part.split('.')[1] || '').length;
          const sp = U.el('span', 'num', el);
          sp.textContent = (0).toFixed(dec);
          nums.push({ el: sp, target: parseFloat(part), dec, raw: part });
        } else {
          el.appendChild(document.createTextNode(part));
        }
      });
      return nums;
    }
    function countUp(nums, ms) {
      if (!nums.length) return sleep(260);
      let lastTick = 0;
      return tween(ms, (e) => {
        nums.forEach((n) => { n.el.textContent = (n.target * e).toFixed(n.dec); });
        if (e < 1 && e - lastTick > 0.09) {
          lastTick = e;
          A.blip({ freq: 900 + e * 700, type: 'square', vol: 0.008, dur: 0.03, jitter: 0.02 });
        }
        if (e >= 1) nums.forEach((n) => { n.el.textContent = n.raw; n.el.classList.add('done'); });
      }, ez.out);
    }
    function waitTapOrTimeout(el, ms) {
      return new Promise((res) => {
        let done = false, tm = 0;
        const fin = () => {
          if (done) return;
          done = true;
          el.removeEventListener('click', fin);
          clearTimeout(tm);
          res();
        };
        el.addEventListener('click', fin);
        tm = setTimeout(fin, ms);
      });
    }

    async function showStats() {
      phase = 'stats';
      const wrap = U.el('div', 's7-stats', layer);
      const card = U.el('div', 's7-stats-card', wrap);
      requestAnimationFrame(() => wrap.classList.add('on'));
      A.whoosh(0.04, 0.4);
      await sleep(350);
      for (let i = 0; i < T.stats.length; i++) {
        if (!ctx.alive()) return;
        const lineEl = U.el('div', 's7-stats-line' + (i === 0 ? ' hero' : ''), card);
        const nums = buildCountLine(lineEl, T.stats[i]);
        requestAnimationFrame(() => lineEl.classList.add('on'));
        if (nums.length === 2) {
          const bar = U.el('div', 's7-split', card);
          const a = U.el('span', 's7-split-a', bar), b = U.el('span', 's7-split-b', bar);
          const tot = (nums[0].target + nums[1].target) || 1;
          requestAnimationFrame(() => requestAnimationFrame(() => {
            a.style.width = (nums[0].target / tot * 100).toFixed(1) + '%';
            b.style.width = (nums[1].target / tot * 100).toFixed(1) + '%';
          }));
        }
        await countUp(nums, i === 0 ? 1500 : 950);
        if (!ctx.alive()) return;
        if (nums.length) A.coin(3 + i);
        await sleep(380);
      }
      if (!ctx.alive()) return;
      const tip = U.el('div', 's7-stats-tip', card, T.statsTap || '轻点继续');
      requestAnimationFrame(() => tip.classList.add('on'));
      wrap.style.pointerEvents = 'auto';
      await waitTapOrTimeout(wrap, 5200);
      if (!ctx.alive()) return;
      A.click(0.12);
      wrap.style.pointerEvents = '';
      wrap.classList.remove('on'); wrap.classList.add('out');
      await sleep(480);
      wrap.remove();
    }

    /* =========================================================
     * 7b · 词云星
     * ========================================================= */
    function layoutWords() {
      const unit = Math.min(W, H);
      const ns = T.words.map((w) => w.n);
      const maxN = Math.max.apply(null, ns), minN = Math.min.apply(null, ns);
      wordStars = T.words.map((wd, i) => {
        const k = (wd.n - minN) / Math.max(1, maxN - minN);
        const fs = Math.round(U.clamp(unit * 0.03, 11, 13) + 5 * k);
        return {
          w: wd.w, n: wd.n, note: wd.note, idx: i, k, fs,
          r: unit * (0.02 + 0.028 * k), lw: wd.w.length * fs,
          curX: U.rand(0.14, 0.86), curY: U.rand(0.2, 0.8),
          phase: Math.random() * 6.28, visited: false, alpha: 1, gone: false,
          born: t + i * 0.07, pop: 0, call: 0, sx: 0, sy: 0, anchorIdx: -1
        };
      });
      for (let iter = 0; iter < 220; iter++) {
        for (let a = 0; a < wordStars.length; a++) {
          for (let b = a + 1; b < wordStars.length; b++) {
            const A1 = wordStars[a], B1 = wordStars[b];
            const dx = (B1.curX - A1.curX) * W, dy = (B1.curY - A1.curY) * H;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = Math.max(A1.r + B1.r + 30, (A1.lw + B1.lw) * 0.5 + 8);
            if (dist < minD) {
              const push = (minD - dist) / 2 / dist;
              A1.curX -= dx * push / W; A1.curY -= dy * push / H;
              B1.curX += dx * push / W; B1.curY += dy * push / H;
            }
          }
        }
        clampWords();
      }
    }
    function clampWords() {
      wordStars.forEach((s) => { s.curX = U.clamp(s.curX, 0.1, 0.9); s.curY = U.clamp(s.curY, 0.18, 0.8); });
    }

    function drawCloud(dt) {
      if (!wordStars.length) return;
      const beatSec = 60 / BPM;
      const bp = (t % beatSec) / beatSec;
      const pulse = REDUCED ? 0 : Math.max(0, 1 - bp / 0.25);

      g.save();
      g.globalCompositeOperation = 'lighter';
      for (const s of wordStars) {
        s.pop = Math.max(0, s.pop - dt * 1.8);
        s.call = Math.max(0, s.call - dt * 0.9);
        s.sx = s.curX * W + ox; s.sy = s.curY * H + oy;
        if (s.gone) continue;
        const appear = U.clamp((t - s.born) / 0.7, 0, 1);
        const alpha = s.alpha * appear;
        if (alpha <= 0.01) continue;
        const tw = 0.75 + 0.25 * Math.sin(t * 1.6 + s.phase);
        const colHex = s.visited ? PAL.gold : (s.k > 0.45 ? PAL.star : '#c4d6ff');
        const R = s.r * (2.4 + 0.5 * tw + pulse * 0.3 + s.pop * 1.6 + s.call * 1.4);
        g.globalAlpha = alpha * 0.9;
        g.drawImage(glowOf(colHex), s.sx - R, s.sy - R, R * 2, R * 2);
        g.globalAlpha = alpha * 0.9;
        g.drawImage(glowOf('#ffffff'), s.sx - R * 0.35, s.sy - R * 0.35, R * 0.7, R * 0.7);
        spike(s.sx, s.sy, R * (0.85 + 0.35 * s.k), alpha * (0.3 + 0.35 * s.k + s.pop * 0.4) * tw, hex(colHex));
        g.globalAlpha = alpha;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(s.sx, s.sy, Math.max(1.5, s.r * 0.16), 0, 6.283); g.fill();
      }
      g.restore();

      if (wordLabelA <= 0.01) return;
      g.save();
      g.textAlign = 'center';
      g.textBaseline = 'top';
      for (const s of wordStars) {
        if (s.gone) continue;
        const appear = U.clamp((t - s.born - 0.2) / 0.7, 0, 1);
        const alpha = s.alpha * appear * wordLabelA;
        if (alpha <= 0.01) continue;
        g.font = `${s.visited ? 600 : 500} ${s.fs}px ${FONT}`;
        g.globalAlpha = alpha * (s.visited ? 1 : 0.8);
        g.shadowColor = s.visited ? PAL.gold : 'rgba(150,180,255,0.8)';
        g.shadowBlur = s.visited ? 10 : 6;
        g.fillStyle = s.visited ? '#ffe9a8' : 'rgba(238,242,255,0.95)';
        g.fillText(s.w, s.sx, s.sy + s.r * 0.9 + 6);
      }
      g.restore();
    }

    function updateCloud(dt) {
      if (phase !== 'cloud' || !cloudActive) return;
      // 每隔一会儿，某颗还没点过的星会"眨一下眼"引导手指
      callTimer -= dt;
      if (callTimer <= 0) {
        callTimer = 2.4;
        const pool = wordStars.filter((s) => !s.visited && !s.gone);
        if (pool.length) pool[(Math.random() * pool.length) | 0].call = 1;
      }
    }

    function hitWord(x, y) {
      let best = null, bestD = 1e9;
      for (const s of wordStars) {
        if (s.gone || s.alpha < 0.3) continue;
        const d = Math.hypot(s.sx - x, s.sy - y);
        const inStar = d <= Math.max(s.r + 12, 26);
        const top = s.sy + s.r * 0.9 + 2;
        const inLabel = Math.abs(x - s.sx) <= s.lw / 2 + 6 && y >= top && y <= top + s.fs + 12;
        if ((inStar || inLabel) && d < bestD) { bestD = d; best = s; }
      }
      return best;
    }

    function closeNote() {
      clearTimeout(noteTimer);
      if (!noteEl) return;
      const el = noteEl;
      noteEl = null;
      el.classList.remove('on');
      setTimeout(() => el.remove(), 300);
    }
    function showNote(star) {
      closeNote();
      const el = U.el('div', 's7-note', layer);
      const head = U.el('div', 's7-note-head', el);
      U.el('span', 's7-note-word', head, star.w);
      U.el('span', 's7-note-n', head, '×' + star.n);
      U.el('div', 's7-note-text', el, star.note || T.noteFallback);
      const bw = Math.min(250, W - 32);
      el.style.width = bw + 'px';
      const left = U.clamp(star.sx - bw / 2, 16, W - 16 - bw);
      el.style.left = left + 'px';
      el.style.setProperty('--ax', U.clamp(star.sx - left, 18, bw - 18).toFixed(0) + 'px');
      if (star.sy > H * 0.42) {
        el.classList.add('above');
        el.style.top = (star.sy - star.r * 1.4 - 10) + 'px';
      } else {
        el.style.top = (star.sy + star.r + star.fs + 22) + 'px';
      }
      requestAnimationFrame(() => el.classList.add('on'));
      noteEl = el;
      noteTimer = setTimeout(closeNote, 3000);
    }

    function buildProgress() {
      progressEl = U.el('div', 's7-progress', layer);
      const dots = U.el('div', 's7-progress-dots', progressEl);
      for (let i = 0; i < NEED; i++) U.el('span', 's7-pdot', dots);
      U.el('div', 's7-progress-label', progressEl, `0 / ${NEED}`);
      requestAnimationFrame(() => progressEl.classList.add('on'));
    }
    function updateProgress() {
      if (!progressEl) return;
      const dots = progressEl.querySelectorAll('.s7-pdot');
      dots.forEach((d, i) => {
        const on = i < visitedCount;
        if (on && !d.classList.contains('on')) { d.classList.add('on', 'pop'); setTimeout(() => d.classList.remove('pop'), 520); }
      });
      const label = progressEl.querySelector('.s7-progress-label');
      if (label) label.textContent = `${Math.min(visitedCount, NEED)} / ${NEED}`;
    }

    function openWord(star) {
      star.pop = 1;
      A.blip({ freq: 640 + star.idx * 18, type: 'sine', vol: 0.045, dur: 0.16, jitter: 0.05 });
      sparkle(star.sx, star.sy, PAL.gold, 12, 80);
      const firstTime = !star.visited;
      if (firstTime) { star.visited = true; visitedCount++; updateProgress(); }
      showNote(star);
      if (firstTime && visitedCount === Math.ceil(NEED / 2) && !halfwaySaid) {
        halfwaySaid = true;
        setTimeout(() => { if (ctx.alive() && phase === 'cloud') App.companion.say(T.halfway, { small: true, hold: 1100 }); }, 1600);
      }
      if (firstTime && visitedCount >= NEED && !morphTriggered) {
        morphTriggered = true;
        cloudActive = false;
        setTimeout(() => { if (resolveCloud) { const r = resolveCloud; resolveCloud = null; r(); } }, 1400);
      }
    }

    function catchMeteor(m, i) {
      meteors.splice(i, 1);
      sparkle(m.x, m.y, PAL.gold, 22, 130);
      A.coin(5); setTimeout(() => { if (ctx.alive()) A.coin(8); }, 120);
      if (!wishSaid) {
        wishSaid = true;
        App.companion.say(T.wish || '……抓到流星了！快许个愿。', { small: true, hold: 1300 });
      }
    }

    function tapCloud(x, y) {
      for (let i = meteors.length - 1; i >= 0; i--) {
        if (Math.hypot(meteors[i].x - x, meteors[i].y - y) < 46) { catchMeteor(meteors[i], i); return; }
      }
      const hit = cloudActive ? hitWord(x, y) : null;
      if (hit) { openWord(hit); return; }
      ripple(x, y);
      if (extraStars.length > 36) extraStars.shift();
      const tints = [PAL.star, '#cfe0ff', '#ffe2c4', '#dccfff'];
      extraStars.push({ x: x - ox * 0.9, y: y - oy * 0.9, born: t, ph: Math.random() * 6.28, hex: tints[(Math.random() * tints.length) | 0] });
    }

    /* =========================================================
     * 照片星：藏着照片的彩虹晕星星，点开从星星里飞出来
     * ========================================================= */
    function layoutPhotoPositions(count) {
      const photoR = 24;
      const pts = [];
      for (let i = 0; i < count; i++) pts.push({ x: U.rand(0.12, 0.88) * W, y: U.rand(0.2, 0.8) * H });
      const obstacles = wordStars.map((s) => ({ x: s.curX * W, y: s.curY * H + s.r * 0.6, r: Math.max(s.r, s.lw / 2) + 8 }));
      for (let iter = 0; iter < 160; iter++) {
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          obstacles.forEach((o) => {
            const dx = p.x - o.x, dy = p.y - o.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = o.r + photoR + 14;
            if (dist < minD) { const k = (minD - dist) / dist; p.x += dx * k; p.y += dy * k; }
          });
          for (let j = 0; j < pts.length; j++) {
            if (j === i) continue;
            const q = pts[j];
            const dx = p.x - q.x, dy = p.y - q.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = photoR * 2 + 20;
            if (dist < minD) {
              const k = (minD - dist) / dist / 2;
              p.x += dx * k; p.y += dy * k;
              q.x -= dx * k; q.y -= dy * k;
            }
          }
          p.x = U.clamp(p.x, photoR + 10, W - photoR - 10);
          p.y = U.clamp(p.y, H * 0.17, H * 0.82);
        }
      }
      return pts.map((p) => ({ xPct: (p.x / W) * 100, yPct: (p.y / H) * 100 }));
    }

    function buildPhotoStars() {
      const list = CFG.PHOTO_URLS || [];
      const positions = layoutPhotoPositions(list.length);
      list.forEach((p, i) => {
        p = p || {};
        const el = U.el('button', 's7-pstar', skyDom);
        el.type = 'button';
        el.setAttribute('aria-label', '藏着照片的星星');
        el.style.left = positions[i].xPct.toFixed(2) + '%';
        el.style.top = positions[i].yPct.toFixed(2) + '%';
        el.style.setProperty('--d', (-U.rand(0, 2.6)).toFixed(2) + 's');
        el.style.setProperty('--in', (0.8 + i * 0.12).toFixed(2) + 's');
        U.el('span', 's7-pstar-spark', el);
        const thumb = U.el('span', 's7-pstar-thumb', el);
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', () => {
          if (phase !== 'cloud') return;
          if (!el.classList.contains('open')) {
            el.classList.add('open');
            if (p.url) thumb.style.backgroundImage = `url("${p.url}")`;
            else thumb.textContent = '?';
            const c = localRectCenter(el);
            sparkle(c.x, c.y, '#ffe2c4', 14, 90);
          }
          openLightbox(p, el);
        });
        photoEls.push(el);
      });
    }

    function openLightbox(p, fromEl) {
      A.click(0.14);
      A.whoosh(0.03, 0.35);
      closeNote();
      const box = U.el('div', 's7-light', layer);
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      U.el('div', 's7-light-backdrop', box);
      const card = U.el('div', 's7-light-card', box);
      if (fromEl) {
        const c = localRectCenter(fromEl);
        card.style.setProperty('--fx', (c.x - W / 2).toFixed(0) + 'px');
        card.style.setProperty('--fy', (c.y - H / 2).toFixed(0) + 'px');
      }
      const frame = U.el('div', 's7-light-frame loading', card);
      if (p.url) {
        U.el('div', 's7-light-loading', frame, '✦');
        const img = U.el('img', 's7-light-img', frame);
        img.alt = ''; img.draggable = false; img.decoding = 'async';
        img.addEventListener('load', () => { frame.classList.remove('loading'); img.classList.add('ok'); }, { once: true });
        img.addEventListener('error', () => {
          img.remove();
          frame.classList.remove('loading');
          U.el('div', 's7-light-placeholder', frame, '✦');
        }, { once: true });
        img.src = p.url;
      } else {
        frame.classList.remove('loading');
        U.el('div', 's7-light-placeholder', frame, '?');
      }
      if (p.caption) U.el('div', 's7-light-caption', card, p.caption);
      U.el('div', 's7-light-close', card, '轻点任意处关闭');
      function close() {
        box.classList.remove('on');
        setTimeout(() => box.remove(), 420);
      }
      box.addEventListener('click', close);
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('on')));
    }

    function startCloud() {
      return new Promise((resolve) => {
        resolveCloud = resolve;
        layoutWords();
        wordLabelA = 1;
        buildPhotoStars();
        buildProgress();
        phase = 'cloud';
        cloudActive = true;
        callTimer = 2.5;
        A.whoosh(0.04, 0.6);
        softHint(T.cloudHint, 3000);
        setTimeout(() => { if (ctx.alive() && phase === 'cloud') softHint(T.photoHint, 3000); }, 3900);
        setTimeout(() => { if (ctx.alive() && phase === 'cloud') softHint(T.panHint || '（按住拖一拖，星空会跟着动）', 2800); }, 7800);
      });
    }

    /* =========================================================
     * 变形成 "Y"
     * ========================================================= */
    const Y_UNIT = [
      [0.06, 0.00], [0.23, 0.17], [0.40, 0.34],   // 左臂
      [0.94, 0.00], [0.77, 0.17], [0.60, 0.34],   // 右臂
      [0.50, 0.45],                               // 交汇点
      [0.50, 0.63], [0.50, 0.81], [0.50, 1.00]    // 竖干
    ];
    const Y_LINKS = [[0, 1], [1, 2], [2, 6], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];
    function yAnchors() {
      const s = Math.min(W * 0.64, H * 0.46);
      const h = s * 1.2;
      const left = W / 2 - s / 2, top = H * 0.53 - h / 2;
      return Y_UNIT.map(([u, v]) => ({ x: (left + u * s) / W, y: (top + v * h) / H }));
    }

    async function morphToY() {
      phase = 'morph';
      cloudActive = false;
      closeNote();
      if (progressEl) { progressEl.classList.add('out'); const pe = progressEl; setTimeout(() => pe.remove(), 600); progressEl = null; }
      photoEls.forEach((el) => el.classList.add('out'));
      setTimeout(() => { photoEls.forEach((el) => el.remove()); photoEls.length = 0; }, 700);

      const anchors = yAnchors();
      const visited = wordStars.filter((s) => s.visited);
      const rest = wordStars.filter((s) => !s.visited).sort((a, b) => b.n - a.n);
      const chosen = visited.concat(rest).slice(0, anchors.length);
      const others = wordStars.filter((s) => chosen.indexOf(s) < 0);

      const used = anchors.map(() => false);
      chosen.forEach((s) => {
        let bi = -1, bd = 1e9;
        anchors.forEach((a, ai) => {
          if (used[ai]) return;
          const d = Math.hypot((a.x - s.curX) * W, (a.y - s.curY) * H);
          if (d < bd) { bd = d; bi = ai; }
        });
        used[bi] = true;
        s.anchorIdx = bi;
      });
      morphStars = new Array(anchors.length);
      chosen.forEach((s) => { morphStars[s.anchorIdx] = s; });
      linkP = Y_LINKS.map(() => 0);

      A.whoosh(0.05, 0.7);
      chosen.forEach((s, i) => setTimeout(() => { if (ctx.alive()) A.coin(i); }, i * 70));

      const fromX = chosen.map((s) => s.curX), fromY = chosen.map((s) => s.curY);
      await tween(1500, (e) => {
        chosen.forEach((s, i) => {
          const a = anchors[s.anchorIdx];
          s.curX = U.lerp(fromX[i], a.x, e);
          s.curY = U.lerp(fromY[i], a.y, e);
        });
        others.forEach((s) => { s.alpha = 1 - e; });
        wordLabelA = 1 - e;
      }, ez.inOut);
      if (!ctx.alive()) return;
      others.forEach((s) => { s.gone = true; });

      // 金线一段一段点亮
      for (let i = 0; i < Y_LINKS.length; i++) {
        const [ia, ib] = Y_LINKS[i];
        if (!morphStars[ia] || !morphStars[ib]) continue;
        await tween(170, (e) => { linkP[i] = e; }, ez.out);
        if (!ctx.alive()) return;
        A.blip({ freq: SCALE[i % SCALE.length], type: 'triangle', vol: 0.035, dur: 0.16, jitter: 0 });
        sparkle(morphStars[ib].sx, morphStars[ib].sy, PAL.gold, 6, 60);
      }
      A.coin(10 % 11);
      await tween(900, (e) => { yGlow = e; }, ez.out);
      if (!ctx.alive()) return;
      chosen.forEach((s) => sparkle(s.sx, s.sy, PAL.gold, 8, 110));
      await sleep(2600);
    }

    function drawMorph() {
      if (!morphStars) return;
      const gold = hex(PAL.gold);
      g.save();
      g.globalCompositeOperation = 'lighter';
      if (yGlow > 0) {
        let cx = 0, cy = 0, n = 0;
        morphStars.forEach((s) => { if (s) { cx += s.sx; cy += s.sy; n++; } });
        if (n) {
          cx /= n; cy /= n;
          const R = Math.min(W, H) * 0.6;
          g.globalAlpha = 0.4 * yGlow * (0.85 + 0.15 * Math.sin(t * 2));
          g.drawImage(glowOf(PAL.gold), cx - R, cy - R, R * 2, R * 2);
        }
      }
      const pulse = 0.75 + 0.25 * Math.sin(t * 3.2);
      g.lineCap = 'round';
      Y_LINKS.forEach(([ia, ib], i) => {
        const p = linkP[i];
        const a = morphStars[ia], b = morphStars[ib];
        if (!p || !a || !b) return;
        const ex = U.lerp(a.sx, b.sx, p), ey = U.lerp(a.sy, b.sy, p);
        g.globalAlpha = 1;
        [[8, rgb(gold, 0.12 * pulse)], [2.4, rgb(gold, 0.85 * pulse)], [1, 'rgba(255,255,240,0.9)']].forEach(([lw, st]) => {
          g.lineWidth = lw;
          g.strokeStyle = st;
          g.beginPath(); g.moveTo(a.sx, a.sy); g.lineTo(ex, ey); g.stroke();
        });
      });
      g.restore();
    }

    /* =========================================================
     * 布局 + 帧循环
     * ========================================================= */
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = ov.clientWidth || window.innerWidth;
      H = ov.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      buildSky();
      seedStars();
    }
    let resizeTimer = 0;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!running) return;
        layout();
        if (consts.length) layoutConsts();
        if (wordStars.length && phase === 'cloud') clampWords();
      }, 140);
    }
    layout();
    window.addEventListener('resize', onResize);

    let raf = 0, last = performance.now();
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;

      const tilt = App.tilt || { x: 0, y: 0 };
      if (!ptr || !ptr.drag) { const k = Math.exp(-dt * 1.8); pan.x *= k; pan.y *= k; }
      ox = (tilt.x || 0) * 14 + pan.x;
      oy = (tilt.y || 0) * 10 + pan.y;
      skyDom.style.transform = `translate3d(${ox.toFixed(1)}px,${oy.toFixed(1)}px,0)`;

      updateRank(dt);
      updateCloud(dt);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground(dt);
      drawRank(dt);
      drawCloud(dt);
      drawMorph();
      drawParticles(dt);
      drawRipples(dt);
      drawTrail(dt);
    }
    raf = requestAnimationFrame(frame);

    /* =========================================================
     * 手势：星座阶段 = 划过点亮；其它阶段 = 点按 / 拖动星空
     * ========================================================= */
    function toLocal(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      const p = toLocal(e);
      ptr = { id: e.pointerId, x0: p.x, y0: p.y, px0: pan.x, py0: pan.y, drag: false };
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* 忽略 */ }
      if (phase === 'rank') {
        trail.push({ x: p.x, y: p.y, age: 0 });
        rankTouch(p.x, p.y);
      }
    }
    function onMove(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const p = toLocal(e);
      if (phase === 'rank') {
        ptr.drag = true;
        trail.push({ x: p.x, y: p.y, age: 0 });
        if (trail.length > 48) trail.shift();
        rankTouch(p.x, p.y);
        return;
      }
      const dx = p.x - ptr.x0, dy = p.y - ptr.y0;
      if (!ptr.drag && Math.hypot(dx, dy) > 10) ptr.drag = true;
      if (ptr.drag) {
        pan.x = U.clamp(ptr.px0 + dx * 0.45, -PAN_MAX, PAN_MAX);
        pan.y = U.clamp(ptr.py0 + dy * 0.45, -PAN_MAX, PAN_MAX);
      }
    }
    function onUp(e) {
      if (!ptr || e.pointerId !== ptr.id) return;
      const wasDrag = ptr.drag;
      ptr = null;
      if (wasDrag || phase === 'rank') return;
      const p = toLocal(e);
      if (phase === 'cloud') tapCloud(p.x, p.y);
      else if (phase !== 'morph') ripple(p.x, p.y);
    }
    function onCancel() { ptr = null; }
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    /* =========================================================
     * 时间线
     * ========================================================= */
    (async () => {
      App.companion.show({ corner: 'tl' });
      App.shards.show();
      tween(1800, (e) => { skyAlpha = e; }, ez.out);
      await sleep(900);
      if (!ctx.alive()) return;

      phase = 'quiz';
      await App.companion.say(T.intro, { hold: 900 });
      if (!ctx.alive()) return;

      const r1 = await runQuiz(T.quizA, 1, 2);
      if (!ctx.alive()) return;
      await App.companion.say(r1 ? T.quizRight : T.quizWrongA, { small: true, hold: r1 ? 650 : 1300 });
      if (!ctx.alive()) return;

      const r2 = await runQuiz(T.quizB, 2, 2);
      if (!ctx.alive()) return;
      await App.companion.say(r2 ? T.quizRight : T.quizWrongB, { small: true, hold: r2 ? 650 : 1300 });
      if (!ctx.alive()) return;

      await runRank();
      if (!ctx.alive()) return;

      await showStats();
      if (!ctx.alive()) return;

      await startCloud();
      if (!ctx.alive()) return;

      await morphToY();
      if (!ctx.alive()) return;

      await sleep(300);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 2200 });
      if (!ctx.alive()) return;
      ctx.next();
    })();

    self._cleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      clearTimeout(resizeTimer);
      clearTimeout(noteTimer);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
    };
  },

  exit() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    App.companion.reset();
    App.shards.hide();
  }
});