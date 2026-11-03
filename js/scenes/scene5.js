/* =========================================================
 * Scene 5 · Cue Points 时间点（梦幻版）
 *   接 Scene 4：五块碎片全亮，收藏槽常驻右上角，白团子常驻左上角。
 *   白团子翻出小本本 → 中间一颗上锁的音符，请小寒填"对你来说重要的一天"
 *   （3D 月/日滚轮 + 一句话）→ 提交后音符解锁迸光，生成一张星空明信片（截图发回来）
 *   → 五线谱展开：八张剧本卡 + 小寒那一天，按日期排好，同一天并成和弦。
 *   滑动时音符吸附到正中央并轻响；戳开音符，卡片从音符里"飞"出来，可左右滑翻页、下滑合上。
 *   全部翻完：整段旋律缩成一条星座，从左到右依次弹响，流星雨，白团子收尾 → Scene 6。
 *
 * 背景：#overlay 里一张 2D canvas：暮色渐变 + 低分辨率雾层（光斑/极光带）+ 闪烁星星
 *       + 上升的散景光点 + 偶尔的流星；触碰有涟漪、光尘、五声音阶。
 * 不用 three 舞台（config.chapters.scene5 里 stage:false）。
 * 调试：?scene=scene5&debug
 * ========================================================= */
App.director.register('scene5', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene5;
    const WARM = CFG.palettes.warm;
    const GLOW_COLORS = WARM.glows;
    const self = this;

    // 本章所有需要收尾的东西都丢进来，exit() 时统一清理
    const disposers = [];
    self._disposers = disposers;

    const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    const COARSE = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    const buzz = (p) => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* iOS 没有震动，忽略 */ } };
    const later = (fn, ms) => setTimeout(() => { if (ctx.alive()) fn(); }, ms);
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    const tone = (k, vol, dur) => A.blip({
      freq: CFG.COIN_BASE_HZ * Math.pow(2, k / 12), type: 'sine', vol: vol || 0.03, dur: dur || 0.45, jitter: 0
    });

    // 文案兜底：config 里没写这些 key 也能跑
    const TX = {
      focusTap: T.focusTap || '轻触音符，翻开这一天',
      focusChord: T.focusChord || '{n} 段回忆，轻触翻开',
      focusMine: T.focusMine || '你的那一天，轻触翻开',
      focusRead: T.focusRead || '已经翻开过啦 ✓',
      swipeTip: T.swipeTip || '左右滑动翻页，点空白处合上',
      closeTip: T.closeTip || '点空白处合上'
    };

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const canvas = U.el('canvas', 's5-canvas', ov);
    const layer = U.el('div', 's5-layer', ov);

    /* =========================================================
     * 背景画布
     * ========================================================= */
    const g = canvas.getContext('2d');
    const fog = document.createElement('canvas');      // 1/4 分辨率的雾层，光斑和极光带都画在这里再放大
    const fg = fog.getContext('2d');
    const FOG_SCALE = 0.25;
    let W = 0, H = 0, dpr = 1, sky = null;

    const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
    const sprCache = {};
    function sprite(color, kind) {
      const key = color + kind;
      if (sprCache[key]) return sprCache[key];
      const s = kind === 'glow' ? 128 : kind === 'bokeh' ? 64 : 48;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const rgb = rgbOf(color);
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      if (kind === 'glow') {
        gr.addColorStop(0, `rgba(${rgb},0.5)`);
        gr.addColorStop(0.45, `rgba(${rgb},0.18)`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
      } else if (kind === 'bokeh') {      // 扁平的散景圆片，边缘柔
        gr.addColorStop(0, `rgba(${rgb},0.5)`);
        gr.addColorStop(0.62, `rgba(${rgb},0.36)`);
        gr.addColorStop(0.82, `rgba(${rgb},0.1)`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
      } else {                            // dot：白色热芯的小光点
        gr.addColorStop(0, 'rgba(255,255,255,1)');
        gr.addColorStop(0.16, `rgba(${rgb},0.95)`);
        gr.addColorStop(0.45, `rgba(${rgb},0.28)`);
        gr.addColorStop(1, `rgba(${rgb},0)`);
      }
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return (sprCache[key] = c);
    }

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = ov.clientWidth || window.innerWidth;
      H = ov.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      fog.width = Math.max(1, Math.round(W * FOG_SCALE));
      fog.height = Math.max(1, Math.round(H * FOG_SCALE));
      sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#0b0610');
      sky.addColorStop(0.5, WARM.bg);
      sky.addColorStop(0.82, '#2a1224');
      sky.addColorStop(1, '#3d1a2c');
    }

    // 大光斑：会被触碰推开、随陀螺仪轻微视差
    const glows = [];
    for (let i = 0; i < 6; i++) {
      glows.push({
        color: GLOW_COLORS[i % GLOW_COLORS.length],
        bx: 0.14 + (i % 3) * 0.37 + U.rand(-0.05, 0.05),
        by: 0.2 + Math.floor(i / 3) * 0.52 + U.rand(-0.05, 0.05),
        r: U.rand(0.26, 0.4),
        phase: Math.random() * 6.28,
        speed: U.rand(0.07, 0.15),
        push: { x: 0, y: 0, vx: 0, vy: 0 }
      });
    }
    // 极光带：一串光斑沿正弦线排开，慢慢起伏
    const veils = [
      { y: 0.2, amp: 0.05, sp: 0.18, ph: 0, color: '#c77dff', a: 0.55 },
      { y: 0.33, amp: 0.04, sp: -0.13, ph: 2, color: '#ff7fa8', a: 0.42 },
      { y: 0.8, amp: 0.05, sp: 0.1, ph: 4, color: '#ff9a6c', a: 0.38 }
    ];
    // 星星
    const stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random(), y: Math.pow(Math.random(), 1.4) * 0.85,
        s: U.rand(1.1, 3), tw: U.rand(0.6, 2.2), ph: Math.random() * 6.28, z: U.rand(0.3, 1),
        c: Math.random() < 0.75 ? '#fff4e0' : U.pick(GLOW_COLORS)
      });
    }
    // 上升的散景光点
    const motes = [];
    const newMote = (init) => ({
      x: Math.random(), y: init ? Math.random() : 1.08, r: U.rand(4, 14),
      vy: U.rand(0.012, 0.035), sw: U.rand(0.01, 0.03), ph: Math.random() * 6.28,
      c: U.pick(GLOW_COLORS), a: U.rand(0.25, 0.6)
    });
    for (let i = 0; i < 22; i++) motes.push(newMote(true));
    // 流星
    const meteors = [];
    let nextMeteor = 3.5;
    function meteor(fast) {
      const ang = U.rand(0.35, 0.6), sp = U.rand(380, 620) * (fast ? 1.25 : 1);
      const c = U.pick(GLOW_COLORS);
      meteors.push({
        x: U.rand(0.3, 1.15) * W, y: U.rand(-0.05, 0.35) * H,
        vx: -Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
        age: 0, max: U.rand(0.7, 1.1), len: U.rand(70, 140), rgb: rgbOf(c), c
      });
    }

    layout();
    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    // 触碰特效：涟漪 + 光尘
    const sparks = [];
    const dust = [];
    function spark(x, y, color) {
      const c = color || U.pick(GLOW_COLORS);
      sparks.push({ x, y, age: 0, max: 0.6, color: c });
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, sp = U.rand(30, 95);
        dust.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
          age: 0, max: 0.45 + Math.random() * 0.35, color: c,
          r: 1.4 + Math.random() * 1.6, glyph: Math.random() < 0.18
        });
      }
    }
    function burst(x, y, color, n) {
      sparks.push({ x, y, age: 0, max: 0.9, color: color || '#ffd98a', big: true });
      for (let i = 0; i < (n || 18); i++) {
        const a = Math.random() * 6.28, sp = U.rand(60, 210);
        dust.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40,
          age: 0, max: 0.7 + Math.random() * 0.6, color: Math.random() < 0.3 ? '#fff4e0' : (color || U.pick(GLOW_COLORS)),
          r: 1.6 + Math.random() * 2, glyph: Math.random() < 0.3
        });
      }
    }
    function addTrailBit(x, y) {
      dust.push({
        x, y, vx: U.rand(-10, 10), vy: U.rand(-16, -4),
        age: 0, max: 0.45 + Math.random() * 0.35, color: U.pick(GLOW_COLORS),
        r: 1 + Math.random() * 1.4, glyph: Math.random() < 0.12
      });
    }
    function pushGlows(x, y, amp) {
      for (const gw of glows) {
        const cx = gw.bx * W, cy = gw.by * H;
        const dx = cx - x, dy = cy - y, d = Math.hypot(dx, dy) + 1;
        if (d < Math.max(W, H) * 0.55) {
          const f = amp * 70 / d;
          gw.push.vx += (dx / d) * f;
          gw.push.vy += (dy / d) * f;
        }
      }
    }
    function shower(n) { for (let i = 0; i < n; i++) later(() => meteor(true), i * U.rand(80, 200)); }

    function drawFog() {
      const fs = fog.width / Math.max(1, W);
      fg.setTransform(1, 0, 0, 1, 0, 0);
      fg.globalCompositeOperation = 'source-over';
      fg.globalAlpha = 1;
      fg.clearRect(0, 0, fog.width, fog.height);
      fg.setTransform(fs, 0, 0, fs, 0, 0);
      fg.globalCompositeOperation = 'lighter';
      const tx = (App.tilt && App.tilt.x) || 0, ty = (App.tilt && App.tilt.y) || 0;
      for (const v of veils) {
        const spr = sprite(v.color, 'glow'), r = H * 0.2;
        fg.globalAlpha = v.a * (0.75 + 0.25 * Math.sin(t * 0.3 + v.ph));
        for (let k = 0; k < 9; k++) {
          const x = (k / 8) * W * 1.3 - W * 0.15 + tx * 10;
          const y = v.y * H + Math.sin(k * 0.8 + t * v.sp + v.ph) * H * v.amp + ty * 8;
          fg.drawImage(spr, x - r, y - r * 0.6, r * 2, r * 1.2);
        }
      }
      fg.globalAlpha = 1;
      for (const gw of glows) {
        const cx = gw.bx * W + Math.sin(t * gw.speed + gw.phase) * 18 + tx * 18 + gw.push.x;
        const cy = gw.by * H + Math.cos(t * gw.speed * 0.8 + gw.phase) * 14 + ty * 14 + gw.push.y;
        const r = gw.r * Math.max(W, H);
        fg.drawImage(sprite(gw.color, 'glow'), cx - r, cy - r, r * 2, r * 2);
      }
    }

    let raf = 0, last = 0, t = 0, running = true;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;
      const tx = (App.tilt && App.tilt.x) || 0, ty = (App.tilt && App.tilt.y) || 0;

      for (const gw of glows) {
        gw.push.vx *= Math.exp(-dt * 2.4);
        gw.push.vy *= Math.exp(-dt * 2.4);
        gw.push.x = (gw.push.x + gw.push.vx * dt) * Math.exp(-dt * 1.1);
        gw.push.y = (gw.push.y + gw.push.vy * dt) * Math.exp(-dt * 1.1);
      }

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      drawFog();
      g.drawImage(fog, 0, 0, W, H);

      g.globalCompositeOperation = 'lighter';
      // 星星
      for (const s of stars) {
        const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * s.tw + s.ph));
        const x = s.x * W + tx * s.z * 14, y = s.y * H + ty * s.z * 10, r = s.s * 2.2;
        g.globalAlpha = a;
        g.drawImage(sprite(s.c, 'dot'), x - r, y - r, r * 2, r * 2);
      }
      // 散景光点
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        m.y -= m.vy * dt;
        if (m.y < -0.08) { motes[i] = newMote(false); continue; }
        const x = (m.x + Math.sin(t * 0.5 + m.ph) * m.sw) * W + tx * 22;
        const y = m.y * H + ty * 16;
        const edge = Math.min(1, (1.08 - m.y) * 4, (m.y + 0.08) * 4);
        g.globalAlpha = m.a * edge;
        g.drawImage(sprite(m.c, 'bokeh'), x - m.r, y - m.r, m.r * 2, m.r * 2);
      }
      // 流星
      if (!REDUCED) {
        nextMeteor -= dt;
        if (nextMeteor <= 0) { meteor(false); nextMeteor = U.rand(4, 9); }
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]; m.age += dt;
        if (m.age >= m.max) { meteors.splice(i, 1); continue; }
        m.x += m.vx * dt; m.y += m.vy * dt;
        const a = Math.sin((m.age / m.max) * Math.PI);
        const sp = Math.hypot(m.vx, m.vy), ux = m.vx / sp, uy = m.vy / sp;
        const ex = m.x - ux * m.len, ey = m.y - uy * m.len;
        const gr = g.createLinearGradient(m.x, m.y, ex, ey);
        gr.addColorStop(0, `rgba(255,250,235,${a})`);
        gr.addColorStop(0.3, `rgba(${m.rgb},${a * 0.5})`);
        gr.addColorStop(1, `rgba(${m.rgb},0)`);
        g.globalAlpha = 1;
        g.strokeStyle = gr; g.lineWidth = 1.6; g.lineCap = 'round';
        g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(ex, ey); g.stroke();
        g.globalAlpha = a;
        g.drawImage(sprite(m.c, 'dot'), m.x - 5, m.y - 5, 10, 10);
      }
      // 光尘
      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i]; p.age += dt;
        if (p.age >= p.max) { dust.splice(i, 1); continue; }
        p.vy += 55 * dt;
        p.vx *= Math.exp(-dt * 1.5);
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.age / p.max;
        g.globalAlpha = a;
        if (p.glyph) {
          g.font = '12px "Segoe UI Symbol", "Noto Sans SC", system-ui, sans-serif';
          g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillStyle = p.color;
          g.fillText('♪', p.x, p.y);
        } else {
          const r = (p.r * a + 0.6) * 3;
          g.drawImage(sprite(p.color, 'dot'), p.x - r, p.y - r, r * 2, r * 2);
        }
      }
      // 涟漪：两圈错开
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.age += dt;
        if (s.age >= s.max) { sparks.splice(i, 1); continue; }
        const e = s.age / s.max, R = s.big ? 70 : 34;
        g.strokeStyle = s.color;
        g.lineWidth = s.big ? 2.4 : 1.8;
        g.globalAlpha = (1 - e) * 0.6;
        g.beginPath(); g.arc(s.x, s.y, 6 + e * R, 0, 6.3); g.stroke();
        if (e > 0.18) {
          const e2 = (e - 0.18) / 0.82;
          g.globalAlpha = (1 - e2) * 0.35;
          g.beginPath(); g.arc(s.x, s.y, 4 + e2 * R * 0.7, 0, 6.3); g.stroke();
        }
      }
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 1;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
    disposers.push(() => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    });

    function canvasRect() { return canvas.getBoundingClientRect(); }
    function centerOf(el) {
      const r = el.getBoundingClientRect(), cr = canvasRect();
      return { x: r.left + r.width / 2 - cr.left, y: r.top + r.height / 2 - cr.top };
    }
    function flash(color) {
      if (REDUCED) return;
      const b = U.el('div', 's5-bloom', layer);
      b.style.setProperty('--c', color || '#ffe4a8');
      setTimeout(() => b.remove(), 1500);
    }

    // ---------- 空白处触碰：光波 + 拖尾 + 五声音阶随横坐标变音高 ----------
    function noteAt(x) {
      tone(PENTA[U.clamp(Math.floor(x / Math.max(1, W) * PENTA.length), 0, PENTA.length - 1)], 0.035, 0.4);
    }
    const isUI = (e) => e.target && e.target.closest &&
      e.target.closest('.s5-form-shell, .s5-shot, .s5-reader, .s5-note, .s5-lock-orb, .s5-focus');
    let dragging = false, lastX = 0, lastY = 0, lastNoteT = 0;
    function toLocal(e) {
      const r = canvasRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      if (isUI(e)) return;
      const p = toLocal(e);
      dragging = true; lastX = p.x; lastY = p.y; lastNoteT = performance.now();
      spark(p.x, p.y);
      pushGlows(p.x, p.y, 0.55);
      noteAt(p.x);
    }
    function onMove(e) {
      if (!dragging) return;
      const p = toLocal(e);
      if (Math.hypot(p.x - lastX, p.y - lastY) < 4) return;
      addTrailBit(p.x, p.y);
      pushGlows(p.x, p.y, 0.1);
      const now = performance.now();
      if (now - lastNoteT > 120 && Math.random() < 0.45) { lastNoteT = now; noteAt(p.x); }
      lastX = p.x; lastY = p.y;
    }
    function onUp() { dragging = false; }
    ov.addEventListener('pointerdown', onDown);
    ov.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    disposers.push(() => {
      ov.removeEventListener('pointerdown', onDown);
      ov.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    });

    /* =========================================================
     * 像素图标 + 小本本封面
     * ========================================================= */
    const ICONS = {
      phone: { map: ['.OOOOO.', 'OBBBBBO', 'OBHHHBO', 'OBHHHBO', 'OBHHHBO', 'OBBBBBO', 'OB.O.BO', '.OOOOO.'],
        pal: { O: '#2a2a35', B: '#49505f', H: '#8fd9ff' } },
      goose: { map: ['...OO...', '..OBBO..', '.OBBBOY.', 'OBBBBBO.', 'OBBBBBBO', '.OBBBBO.', '..O..O..'],
        pal: { O: '#4a4030', B: '#f4f1e6', Y: '#f0a23c' } },
      brush: { map: ['......OO', '.....OBO', '....OBO.', '...OBO..', '..OBO...', '.OBO....', 'OYO.....', 'YO......'],
        pal: { O: '#2a1c14', B: '#caa15a', Y: '#ff8fb3' } },
      wiltcat: { map: ['.O....O.', 'OSO..OSO', 'OBBOOBBO', 'OBBBBBBO', 'OBEBBEBO', 'OBBBBBBO', '.OBNNBO.', '..OOOO..'],
        pal: { O: '#060609', S: '#191920', B: '#25252e', E: '#6b4652', N: '#2a1a20' } },
      bad: { map: ['..OOOO..', '.OBBBBO.', 'OBBBBBBO', 'OBBBBBBO', '.OO..OO.', '..O..O..'],
        pal: { O: '#1a1218', B: '#4a3850' } },
      question: { map: ['.OOOO.', 'OO..OO', '....OO', '...OO.', '..OO..', '..OO..', '......', '..OO..'],
        pal: { O: '#ffcf7a' } },
      pignose: { map: ['.OOOOOO.', 'OBBBBBBO', 'OBBNNBBO', 'OBBNNBBO', 'OBBBBBBO', '.OOOOOO.'],
        pal: { O: '#5a2f3a', B: '#f6b3c3', N: '#d9718b' } },
      demon: { map: ['O.....O', 'OY...YO', '.OYYYO.', 'OYEYEYO', 'OYYYYYO', '.OYWYO.', '..OOO..'],
        pal: { O: '#2a0a14', Y: '#ff5a7a', E: '#140008', W: '#ffe3ef' } },
      bunny: { map: ['.OO..OO.', 'OBBOOBBO', 'OBNOONBO', 'OBNOONBO', 'OBBOOBBO', '.OBBBBO.', '..OOOO..'],
        pal: { O: '#060609', B: '#25252e', N: '#6b4652' } },
      dough: { map: ['..OOOO..', '.OBBBBO.', 'OBBHBBBO', 'OBBBBBBO', 'OBBBBBBO', '.OBBBBO.', '..OOOO..'],
        pal: { O: '#8a6b3a', B: '#f4e3c0', H: '#fff6e0' } },
      heart: { map: ['.OO.OO.', 'OBBOBBO', 'OBBBBBO', '.OBBBO.', '..OBO..', '...O...'],
        pal: { O: '#5a1830', B: '#ff8fb3' } }
    };
    function makeIcon(name, scale) {
      const wrap = document.createElement('div');
      wrap.className = 's5-icon s5-icon-' + (name || 'heart');
      const def = ICONS[name] || ICONS.heart;
      wrap.appendChild(App.sprites.render(def.map, def.pal, scale || 4));
      return wrap;
    }

    const BOOK_COVER = [
      '.OOOOOOOO.',
      'OBBBBBBBBO',
      'OBBBBBBBBO',
      'OBB..YY.BO',
      'OBB.YYY.BO',
      'OBB..Y..BO',
      'OBB..Y..BO',
      'OBYYYY..BO',
      'OBBBBBBBBO',
      '.OOOOOOOO.'
    ];
    const BOOK_PAL = { O: '#3d1830', B: '#ff8fb3', Y: '#ffd35c' };

    /* =========================================================
     * 小本本：浮起 → 封面翻开 → 内页扇开、五线谱浮现 → 光尘迸出
     * ========================================================= */
    async function showBook() {
      const stage = U.el('div', 's5-book-stage', layer);
      U.el('div', 's5-book-halo', stage);
      const book = U.el('div', 's5-book', stage);
      U.el('div', 's5-book-page', book);
      const lines = U.el('div', 's5-book-lines', book);
      for (let i = 0; i < 5; i++) U.el('i', null, lines).style.setProperty('--i', i);
      for (let i = 0; i < 3; i++) U.el('div', 's5-book-leaf', book).style.setProperty('--i', i);
      const cover = U.el('div', 's5-book-cover', book);
      cover.appendChild(App.sprites.render(BOOK_COVER, BOOK_PAL, 8));
      U.el('div', 's5-book-cover-back', cover);

      A.whoosh(0.05, 0.5);
      requestAnimationFrame(() => stage.classList.add('on'));
      await U.sleep(750);
      if (!ctx.alive()) return;
      A.click(0.14); buzz(8);
      stage.classList.add('flip');
      await U.sleep(480);
      if (!ctx.alive()) return;
      const c = centerOf(book);
      burst(c.x, c.y - 10, '#ffd98a', 24);
      [7, 9, 12, 16].forEach((k, i) => later(() => tone(k, 0.03, 0.7), i * 95));
      await U.sleep(1200);
      if (!ctx.alive()) return;
      stage.classList.add('out');
      await U.sleep(620);
      stage.remove();
    }

    /* =========================================================
     * 上锁：3D 月/日滚轮 + 一句话 → 音符解锁 → 星空明信片
     * ========================================================= */
    const ROW = 34, VIS = 5;
    function buildWheel(container, items, startIndex, onChange) {
      const box = U.el('div', 's5-wheel-box', container);
      const el = U.el('div', 's5-wheel', box);
      el.style.height = ROW * VIS + 'px';
      const padH = ROW * (VIS - 1) / 2;
      U.el('div', 's5-wheel-pad', el).style.height = padH + 'px';
      const itemEls = items.map((label, i) => {
        const d = U.el('div', 's5-wheel-item', el, label);
        d.style.height = ROW + 'px';
        d.addEventListener('click', () => el.scrollTo({ top: i * ROW, behavior: REDUCED ? 'auto' : 'smooth' }));
        return d;
      });
      U.el('div', 's5-wheel-pad', el).style.height = padH + 'px';
      U.el('div', 's5-wheel-frame', box).style.height = ROW + 'px';
      U.el('div', 's5-wheel-mask', box);

      let cur = startIndex, committed = startIndex, rafId = 0, timer = null;
      function paint() {
        rafId = 0;
        const p = el.scrollTop / ROW;
        itemEls.forEach((d, i) => {
          const off = i - p, ao = Math.abs(off);
          if (ao > 3) { d.style.opacity = '0'; return; }
          d.style.transform = `perspective(260px) rotateX(${(-off * 24).toFixed(1)}deg)`;
          d.style.opacity = Math.max(0, 1 - ao * 0.32).toFixed(2);
          d.classList.toggle('mid', ao < 0.5);
        });
        const idx = U.clamp(Math.round(p), 0, itemEls.length - 1);
        if (idx !== cur) {
          cur = idx;
          A.blip({ freq: 620, type: 'sine', vol: 0.018, dur: 0.035, jitter: 0 });
          buzz(3);
        }
      }
      function onScroll() {
        if (!rafId) rafId = requestAnimationFrame(paint);
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (cur !== committed) { committed = cur; onChange(cur); }
        }, 160);
      }
      el.addEventListener('scroll', onScroll, { passive: true });
      el.scrollTop = startIndex * ROW;
      paint();
      const destroy = () => { clearTimeout(timer); cancelAnimationFrame(rafId); };
      disposers.push(destroy);
      return { box, destroy };
    }

    function runLockForm() {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's5-lock', layer);
        const noteBox = U.el('div', 's5-lock-orb', wrap);
        U.el('div', 's5-lock-ring', noteBox);
        U.el('div', 's5-lock-ring r2', noteBox);
        const noteCanvas = App.sprites.set('note', 6).sit;
        noteCanvas.className = 's5-lock-note';
        noteBox.appendChild(noteCanvas);
        noteBox.addEventListener('click', () => {
          noteBox.classList.remove('boing');
          void noteBox.offsetWidth;
          noteBox.classList.add('boing');
          tone(U.pick([7, 9, 12, 14]), 0.035, 0.6);
          const c = centerOf(noteBox);
          spark(c.x, c.y, '#ffd98a');
          buzz(6);
        });
        U.el('div', 's5-lock-label', wrap, T.dayLabel);

        const shell = U.el('div', 's5-form-shell', wrap);
        const form = U.el('div', 's5-form', shell);
        const inner = U.el('div', 's5-form-in', form);
        const wheels = U.el('div', 's5-wheels', inner);
        const MONTHS = [10, 11];
        const daysInMonth = (m) => (m === 10 ? 31 : 2);

        let month = 10, day = 8;
        const monthHost = U.el('div', 's5-wheel-host', wheels);
        U.el('div', 's5-wheel-sep', wheels, '✦');
        const dayHost = U.el('div', 's5-wheel-host', wheels);
        let dayWheel = null;

        function rebuildDayWheel(preferDay) {
          if (dayWheel) dayWheel.destroy();
          dayHost.innerHTML = '';
          const n = daysInMonth(month);
          const opts = [];
          for (let d = 1; d <= n; d++) opts.push(d + '日');
          const idx = Math.min((preferDay || day) - 1, n - 1);
          day = idx + 1;
          dayWheel = buildWheel(dayHost, opts, idx, (i) => { day = i + 1; });
        }
        buildWheel(monthHost, MONTHS.map((m) => m + '月'), 0, (idx) => {
          month = MONTHS[idx];
          rebuildDayWheel(1);
        });
        rebuildDayWheel(day);

        const inputRow = U.el('div', 's5-input-row', inner);
        const input = document.createElement('textarea');
        input.className = 's5-text-input';
        input.rows = 2;
        input.maxLength = 30;
        input.placeholder = T.textPlaceholder;
        inputRow.appendChild(input);
        const count = U.el('div', 's5-text-count', inputRow, '0/30');

        const submitBtn = U.el('button', 's5-submit px-btn', inner, T.submit);
        submitBtn.type = 'button';

        let lastLen = 0;
        input.addEventListener('input', () => {
          const n = Array.from(input.value).length;
          count.textContent = n + '/30';
          count.classList.toggle('warn', n >= 26);
          submitBtn.classList.toggle('ready', input.value.trim().length > 0);
          if (n > lastLen) {                 // 打字时输入框上冒一点点光尘
            const r = input.getBoundingClientRect(), cr = canvasRect();
            addTrailBit(r.left - cr.left + U.rand(16, r.width - 16), r.top - cr.top + 4);
          }
          lastLen = n;
        });

        // ---------- 软键盘：聚焦时收起上方的音符，键盘挡住输入框就把整块往上推 ----------
        function fit() {
          const vv = window.visualViewport;
          const focused = document.activeElement === input;
          wrap.classList.toggle('kb', focused && COARSE);
          if (!vv || !focused) { wrap.style.transform = ''; return; }
          const shift = -(parseFloat((wrap.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0);
          const natural = input.getBoundingClientRect().bottom + shift;
          const visibleBottom = vv.offsetTop + vv.height - 14;
          const need = Math.max(0, natural - visibleBottom);
          wrap.style.transform = need > 0 ? `translateY(${-need}px)` : '';
        }
        const onFocus = () => setTimeout(fit, 60);
        const onBlur = () => setTimeout(fit, 60);
        input.addEventListener('focus', onFocus);
        input.addEventListener('blur', onBlur);
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', fit);
          window.visualViewport.addEventListener('scroll', fit);
        }
        let vvOff = false;
        const cleanupVV = () => {
          if (vvOff) return; vvOff = true;
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', fit);
            window.visualViewport.removeEventListener('scroll', fit);
          }
        };
        disposers.push(cleanupVV);

        function showShot(data) {
          const shot = U.el('div', 's5-shot', layer);
          const skyEl = U.el('div', 's5-shot-sky', shot);
          for (let i = 0; i < 16; i++) {
            const s = U.el('i', 's5-twk', skyEl, Math.random() < 0.6 ? '✦' : '·');
            s.style.left = (4 + Math.random() * 92) + '%';
            s.style.top = (4 + Math.random() * 92) + '%';
            s.style.fontSize = (8 + Math.random() * 10) + 'px';
            s.style.animationDelay = (Math.random() * 3) + 's';
          }
          U.el('div', 's5-shot-hint', shot, T.shotHint);
          const pcShell = U.el('div', 's5-postcard-shell', shot);
          const pc = U.el('div', 's5-postcard', pcShell);
          const inn = U.el('div', 's5-postcard-in', pc);
          U.el('div', 's5-pc-date', inn, `${data.month}月${data.day}日`);
          const deco = U.el('div', 's5-pc-staff', inn);
          for (let i = 0; i < 5; i++) U.el('i', null, deco);
          U.el('span', 's5-pc-heart', deco, '♥');
          U.el('div', 's5-pc-text', inn, `「${data.text}」`);
          const foot = U.el('div', 's5-pc-foot', inn);
          foot.appendChild(makeIcon('heart', 3));
          U.el('span', 's5-pc-note', foot, T.shotNote);

          const ok = U.el('button', 'px-btn s5-shot-ok', shot, T.shotOk);
          ok.type = 'button';
          requestAnimationFrame(() => shot.classList.add('on'));
          A.whoosh(0.05, 0.4);
          later(() => {
            const c = centerOf(pc);
            burst(c.x, c.y - 40, '#ffcf7a', 20);
            [12, 16, 19].forEach((k, i) => later(() => tone(k, 0.028, 0.8), i * 110));
          }, 650);
          let done = false;
          ok.addEventListener('click', () => {
            if (done) return; done = true;
            A.blip(A.voices.tap); buzz(10);
            shot.classList.remove('on');
            setTimeout(() => shot.remove(), 650);
            resolve(data);
          });
        }

        let sent = false;
        submitBtn.addEventListener('click', () => {
          if (sent || !submitBtn.classList.contains('ready')) return;
          const text = input.value.trim();
          if (!text) return;
          sent = true;
          input.blur();
          A.blip(A.voices.tap); buzz([8, 40, 14]);
          cleanupVV();
          wrap.classList.remove('kb');
          wrap.style.transform = '';
          noteBox.classList.add('unlock');
          later(() => {
            const c = centerOf(noteBox);
            burst(c.x, c.y, '#ffd98a', 32);
            pushGlows(c.x, c.y, 1);
            [0, 4, 7, 12].forEach((k, i) => later(() => tone(k + 7, 0.035, 0.7), i * 80));
          }, 280);
          later(() => { wrap.classList.remove('on'); wrap.classList.add('out'); }, 560);
          later(() => { wrap.remove(); showShot({ month, day, text }); }, 1050);
        });

        requestAnimationFrame(() => wrap.classList.add('on'));
      });
    }

    /* =========================================================
     * 解锁：五线谱 + 音符卡片
     * ========================================================= */
    function buildSlots(userDay) {
      const slots = T.cards.map((c) => ({ m: c.m, d: c.d, pages: c.pages.slice(), hasUser: false }));
      if (userDay) {
        const match = slots.find((s) => s.m === userDay.month && s.d === userDay.day);
        const page = { text: userDay.text, icon: 'heart', isUser: true };
        if (match) { match.pages.push(page); match.hasUser = true; }
        else slots.push({ m: userDay.month, d: userDay.day, pages: [page], hasUser: true });
      }
      slots.sort((a, b) => (a.m * 100 + a.d) - (b.m * 100 + b.d));
      slots.forEach((s, i) => { s.idx = i; s.readPages = new Set(); });
      return slots;
    }
    const allPagesRead = (s) => s.readPages.size >= s.pages.length;

    function showStaff(slots) {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's5-staff-wrap', layer);
        const spacer = U.el('div', 's5-spacer', wrap);   // 撑住滚动宽度：结尾缩放五线谱时不让 scrollLeft 被夹回去
        const staff = U.el('div', 's5-staff', wrap);
        const top0 = 64, gap = 24, stepX = 104;
        for (let i = 0; i < 5; i++) {
          const line = U.el('div', 's5-staff-line', staff);
          line.style.top = (top0 + i * gap) + 'px';
          line.style.setProperty('--i', i);
        }
        const n = slots.length;
        const pad = Math.round((wrap.clientWidth || W) / 2);
        const span = stepX * Math.max(0, n - 1);
        const totalW = pad * 2 + span;
        staff.style.width = totalW + 'px';
        spacer.style.width = totalW + 'px';

        const pos = slots.map((s, i) => {
          const level = (s.m * 31 + s.d) % 9;
          return { x: pad + stepX * i, y: top0 + gap * 4 - level * (gap / 2), level };
        });
        pos.forEach((p) => { U.el('div', 's5-snap', staff).style.left = (p.x - 1) + 'px'; });

        // 背景里慢慢飘起的小音符
        const drift = U.el('div', 's5-drift-box', layer);
        const driftGl = ['♪', '♫', '♩', '✦', '✧'];
        const driftTimer = setInterval(() => {
          if (!ctx.alive() || REDUCED) return;
          const sp = U.el('span', 's5-drift', drift, U.pick(driftGl));
          sp.style.left = (6 + Math.random() * 88) + '%';
          sp.style.top = (H * (0.25 + Math.random() * 0.55)) + 'px';
          sp.style.color = U.pick(GLOW_COLORS);
          sp.style.fontSize = (10 + Math.random() * 12) + 'px';
          sp.style.animationDuration = (4.5 + Math.random() * 3) + 's';
          setTimeout(() => sp.remove(), 8000);
        }, 700);
        disposers.push(() => clearInterval(driftTimer));

        // 旋律丝带：底层一段段曲线（读过两端会点亮）+ 顶层一串流动的光珠
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 's5-ribbon');
        svg.setAttribute('width', totalW);
        svg.setAttribute('height', 240);
        staff.appendChild(svg);
        const segs = [];
        let fullD = n ? `M${pos[0].x} ${pos[0].y}` : '';
        for (let i = 0; i < n - 1; i++) {
          const p0 = pos[i], p1 = pos[i + 1], xm = (p0.x + p1.x) / 2;
          const c = `C${xm} ${p0.y} ${xm} ${p1.y} ${p1.x} ${p1.y}`;
          fullD += ' ' + c;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', `M${p0.x} ${p0.y} ${c}`);
          path.setAttribute('pathLength', '1');
          path.setAttribute('class', 's5-seg');
          path.style.transitionDelay = (0.5 + i * 0.12) + 's';
          svg.appendChild(path);
          segs.push(path);
        }
        if (n > 1) {
          const flow = document.createElementNS(NS, 'path');
          flow.setAttribute('d', fullD);
          flow.setAttribute('pathLength', '1');
          flow.setAttribute('class', 's5-flow');
          svg.appendChild(flow);
        }
        function refreshSegs() {
          segs.forEach((sg, i) => sg.classList.toggle('lit', allPagesRead(slots[i]) && allPagesRead(slots[i + 1])));
        }

        let readerOpen = false, finished = false;
        const els = [];
        slots.forEach((s, i) => {
          const color = s.hasUser ? '#ff8fb3' : GLOW_COLORS[i % GLOW_COLORS.length];
          s.color = color;
          const el = U.el('div', 's5-note' + (s.pages.length > 1 ? ' chord' : '') + (s.hasUser ? ' mine' : ''), staff);
          el.style.left = pos[i].x + 'px';
          el.style.top = pos[i].y + 'px';
          el.style.setProperty('--nc', color);
          el.style.setProperty('--d', (i * 0.09 + 0.3) + 's');
          el.style.setProperty('--ph', (i * 0.7) + 's');
          const body = U.el('div', 's5-note-body', el);
          U.el('div', 's5-orb-halo', body);
          const orb = U.el('div', 's5-orb', body);
          U.el('div', 's5-note-glyph', orb, s.hasUser ? '♥' : (s.pages.length > 1 ? '♫' : '♪'));
          if (s.pages.length > 1) U.el('div', 's5-badge', body, '×' + s.pages.length);
          U.el('div', 's5-check', body, '✓');
          U.el('div', 's5-note-date', el, `${s.m}.${s.d}`);
          el.addEventListener('click', () => {
            if (readerOpen || finished) return;
            centerOn(i);
            openReader(s, el, color);
          });
          els.push(el);
        });

        // 当前聚焦的那一天：大字日期 + 一句提示，点它也能打开
        const focus = U.el('div', 's5-focus', layer);
        const fDate = U.el('div', 's5-focus-date', focus);
        const fSub = U.el('div', 's5-focus-sub', focus);
        let focusIdx = -1;
        function focusText(s) {
          if (allPagesRead(s)) return TX.focusRead;
          if (s.hasUser && s.pages.length === 1) return TX.focusMine;
          if (s.pages.length > 1) return TX.focusChord.replace('{n}', s.pages.length);
          return TX.focusTap;
        }
        function setFocus(i, quiet) {
          if (i < 0) return;
          const changed = i !== focusIdx;
          focusIdx = i;
          els.forEach((e, k) => e.classList.toggle('focus', k === i));
          const s = slots[i];
          focus.style.setProperty('--nc', s.color);
          fDate.textContent = `${s.m}月${s.d}日`;
          fSub.textContent = focusText(s);
          if (changed && !quiet) {
            focus.classList.remove('swap');
            void focus.offsetWidth;
            focus.classList.add('swap');
          }
        }
        focus.addEventListener('click', () => {
          if (readerOpen || finished || focusIdx < 0) return;
          openReader(slots[focusIdx], els[focusIdx], slots[focusIdx].color);
        });

        function centerOn(i) {
          wrap.scrollTo({ left: pos[i].x - wrap.clientWidth / 2, behavior: REDUCED ? 'auto' : 'smooth' });
        }

        // 滚动：近中心的音符放大、两侧沿弧线下沉；经过中心时像八音盒一样轻响
        let lastTick = -1, scrollRaf = 0, lastScroll = 0, touched = false;
        function measure() {
          scrollRaf = 0;
          if (finished) return;
          const cw = wrap.clientWidth, cx = wrap.scrollLeft + cw / 2;
          let near = -1, nd = 1e9;
          pos.forEach((p, i) => {
            const d = p.x - cx, ad = Math.abs(d);
            els[i].style.setProperty('--f', Math.max(0, 1 - ad / (stepX * 1.15)).toFixed(3));
            els[i].style.setProperty('--o', U.clamp(d / (cw / 2), -1, 1).toFixed(3));
            if (ad < nd) { nd = ad; near = i; }
          });
          if (near !== focusIdx) setFocus(near);
          if (near !== lastTick && nd < 18) {
            lastTick = near;
            tone(PENTA[pos[near].level], 0.03, 0.5);
            const c = centerOf(els[near].querySelector('.s5-orb'));
            spark(c.x, c.y, slots[near].color);
            if (touched) buzz(3);
          }
          const ds = Math.abs(wrap.scrollLeft - lastScroll);
          if (ds > 3) pushGlows(W / 2, H * 0.5, Math.min(0.2, ds / 120));
          lastScroll = wrap.scrollLeft;
        }
        const onWrapScroll = () => { if (!scrollRaf) scrollRaf = requestAnimationFrame(measure); };
        wrap.addEventListener('scroll', onWrapScroll, { passive: true });
        wrap.addEventListener('pointerdown', () => { touched = true; });
        disposers.push(() => cancelAnimationFrame(scrollRaf));

        // 音符被点时：光环 + 迸出小音符
        function noteBurst(el, color) {
          const c = centerOf(el.querySelector('.s5-orb'));
          const ring = U.el('div', 's5-ring', layer);
          ring.style.left = c.x + 'px'; ring.style.top = c.y + 'px';
          ring.style.setProperty('--nc', color);
          setTimeout(() => ring.remove(), 900);
          const gl = ['♪', '♫', '✦', '♩', '✧', '♥'];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * 6.28 + Math.random() * 0.5, d = 46 + Math.random() * 56;
            const f = U.el('span', 's5-fly', layer, U.pick(gl));
            f.style.left = c.x + 'px'; f.style.top = c.y + 'px';
            f.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
            f.style.setProperty('--dy', (Math.sin(a) * d - 30).toFixed(0) + 'px');
            f.style.setProperty('--rot', ((Math.random() - 0.5) * 120).toFixed(0) + 'deg');
            f.style.color = k % 3 === 0 ? '#fff4e0' : color;
            setTimeout(() => f.remove(), 1400);
          }
        }

        // 进度：一排小点，读完一个亮一个
        const progress = U.el('div', 's5-progress', layer);
        const pdots = slots.map((s) => {
          const d = U.el('span', 's5-pdot', progress);
          d.style.setProperty('--nc', s.color);
          return d;
        });
        const ptxt = U.el('span', 's5-ptxt', progress, `0/${n}`);
        function updateProgress() {
          const done = slots.filter(allPagesRead).length;
          pdots.forEach((d, i) => {
            if (allPagesRead(slots[i]) && !d.classList.contains('on')) d.classList.add('on', 'pop');
          });
          ptxt.textContent = `${done}/${n}`;
          refreshSegs();
          if (focusIdx >= 0) setFocus(focusIdx, true);
          if (done >= n && !finished) {
            finished = true;
            later(grandFinale, 650);
          }
        }

        // 全部读完：整段旋律缩成一条星座，从左到右依次弹响 + 流星雨
        function grandFinale() {
          wrap.classList.add('all');
          focus.classList.add('hide');
          const cw = wrap.clientWidth, sl = wrap.scrollLeft;
          const margin = Math.max(30, cw * 0.14);
          const s = span > 0 ? Math.min(1, (cw - margin * 2) / span) : 1;
          const tx = cw / 2 + sl - (pad + span / 2) * s;
          staff.style.transformOrigin = '0 50%';
          staff.style.transform = `translateX(${tx.toFixed(1)}px) scale(${s.toFixed(3)})`;
          els.forEach((el) => { el.style.setProperty('--f', '1'); el.style.setProperty('--o', '0'); });
          A.whoosh(0.05, 0.6);

          later(() => {
            els.forEach((el, i) => later(() => {
              el.classList.remove('pluck');
              void el.offsetWidth;
              el.classList.add('pluck');
              tone(PENTA[pos[i].level], 0.035, 0.8);
              const c = centerOf(el.querySelector('.s5-orb'));
              burst(c.x, c.y, slots[i].color, 8);
            }, i * 160));
            const tEnd = n * 160;
            later(() => {
              wrap.classList.add('sing');
              shower(14);
              flash('#ffe4a8');
              buzz([10, 50, 10, 50, 20]);
              for (let k = 0; k < 6; k++) later(() => A.coin((k * 2) % 11), k * 110);
            }, tEnd + 150);
            later(resolve, tEnd + 1900);
          }, 1300);
        }

        requestAnimationFrame(() => {
          wrap.classList.add('on');
          progress.classList.add('on');
          focus.classList.add('on');
          staff.classList.add('go');
          measure();
        });
        // 没人碰的话，轻轻往右探一下再回来，暗示可以滑
        later(() => {
          if (touched || wrap.scrollLeft > 2 || n < 2) return;
          wrap.scrollTo({ left: stepX, behavior: 'smooth' });
          later(() => { if (!touched) wrap.scrollTo({ left: 0, behavior: 'smooth' }); }, 1400);
        }, 2400);

        const hint = U.el('div', 'soft-hint sea', layer, T.hint);
        requestAnimationFrame(() => hint.classList.add('on'));
        setTimeout(() => { if (hint.parentNode) hint.classList.remove('on'); }, 3600);
        setTimeout(() => hint.remove(), 4800);

        /* ---------- 卡片阅读器：从音符里飞出来 ---------- */
        function openReader(slot, noteEl, color) {
          readerOpen = true;
          layer.classList.add('reading');
          let page = 0, typeTimer = 0, busy = false, closing = false;

          const reader = U.el('div', 's5-reader', layer);
          const backdrop = U.el('div', 's5-reader-backdrop', reader);
          const card = U.el('div', 's5-reader-card' + (slot.hasUser ? ' mine' : ''), reader);
          card.style.setProperty('--nc', color);
          const oc = centerOf(noteEl.querySelector('.s5-orb'));
          card.style.setProperty('--ox', (oc.x - W / 2).toFixed(0) + 'px');
          card.style.setProperty('--oy', (oc.y - H / 2).toFixed(0) + 'px');

          const inn = U.el('div', 's5-reader-in', card);
          const skyEl = U.el('div', 's5-reader-sky', inn);
          for (let i = 0; i < 9; i++) {
            const s = U.el('i', 's5-twk', skyEl, slot.hasUser && i % 3 === 0 ? '♥' : '✦');
            s.style.left = (4 + Math.random() * 92) + '%';
            s.style.top = (4 + Math.random() * 92) + '%';
            s.style.fontSize = (7 + Math.random() * 7) + 'px';
            s.style.animationDelay = (Math.random() * 3) + 's';
          }
          U.el('div', 's5-reader-date', inn, `${slot.m}月${slot.d}日`);
          const closeBtn = U.el('button', 's5-reader-close', inn, '✕');
          closeBtn.type = 'button';
          closeBtn.setAttribute('aria-label', '合上');
          const stageEl = U.el('div', 's5-reader-stage', inn);
          const iconWrap = U.el('div', 's5-icon-wrap', stageEl);
          const titleEl = U.el('div', 's5-card-title', stageEl);
          const textEl = U.el('div', 's5-card-text', stageEl);
          const ghost = U.el('span', 'ghost', textEl);
          const live = U.el('span', 'live', textEl);
          const multi = slot.pages.length > 1;
          const dots = U.el('div', 's5-reader-dots', inn);
          slot.pages.forEach((_, i) => U.el('div', 's5-reader-dot' + (i === 0 ? ' on' : ''), dots));
          if (!multi) dots.style.display = 'none';
          const prevBtn = U.el('button', 's5-reader-arrow prev', inn, '‹');
          const nextBtn = U.el('button', 's5-reader-arrow next', inn, '›');
          prevBtn.type = 'button'; nextBtn.type = 'button';
          if (!multi) { prevBtn.style.display = 'none'; nextBtn.style.display = 'none'; }
          U.el('div', 's5-reader-tip', reader, multi ? TX.swipeTip : TX.closeTip);

          function finishTyping() {
            if (!typeTimer) return;
            clearInterval(typeTimer); typeTimer = 0;
            live.textContent = ghost.textContent;
            textEl.classList.remove('typing');
          }
          function typeText(str) {
            clearInterval(typeTimer); typeTimer = 0;
            ghost.textContent = str;
            if (REDUCED || !str) { live.textContent = str; return; }
            const chars = Array.from(str);
            let i = 0;
            live.textContent = '';
            textEl.classList.add('typing');
            typeTimer = setInterval(() => {
              i++;
              live.textContent = chars.slice(0, i).join('');
              if (i >= chars.length) finishTyping();
            }, 55);
          }
          disposers.push(() => clearInterval(typeTimer));

          function renderPage() {
            const p = slot.pages[page];
            iconWrap.innerHTML = '';
            iconWrap.appendChild(makeIcon(p.icon));
            let title = p.title || '', body = p.text;
            if (p.isUser && T.userCard) { title = `「${p.text}」`; body = T.userCard; }
            titleEl.textContent = title;
            titleEl.style.display = title ? '' : 'none';
            titleEl.classList.toggle('quote', !!p.isUser);
            typeText(body);
            dots.querySelectorAll('.s5-reader-dot').forEach((d, i) => d.classList.toggle('on', i === page));
            prevBtn.disabled = page === 0;
            nextBtn.disabled = page === slot.pages.length - 1;
            slot.readPages.add(page);
          }
          function goPage(np) {
            if (busy || closing) return;
            if (np < 0 || np >= slot.pages.length) {
              card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge');
              buzz(12);
              return;
            }
            const dir = np > page ? 1 : -1;
            busy = true;
            A.blip(A.voices.tap); buzz(6);
            tone(PENTA[(slot.idx + np * 2) % PENTA.length] + 12, 0.025, 0.4);
            stageEl.classList.add(dir > 0 ? 'out-l' : 'out-r');
            setTimeout(() => {
              page = np;
              renderPage();
              stageEl.classList.remove('out-l', 'out-r');
              stageEl.classList.add(dir > 0 ? 'in-r' : 'in-l');
              void stageEl.offsetWidth;
              stageEl.classList.remove('in-r', 'in-l');
              busy = false;
            }, 190);
          }
          renderPage();

          A.coin(slot.idx % 11);
          if (multi) later(() => A.coin((slot.idx + 2) % 11), 90);
          buzz(10);
          noteEl.classList.add('pluck');
          setTimeout(() => noteEl.classList.remove('pluck'), 450);
          spark(oc.x, oc.y, color);
          noteBurst(noteEl, color);

          prevBtn.addEventListener('click', () => goPage(page - 1));
          nextBtn.addEventListener('click', () => goPage(page + 1));

          // 手势：左右滑翻页、下滑合上、轻点文字跳过打字
          let sx = 0, sy = 0, dx = 0, dy = 0, drag = false;
          card.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            drag = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
            card.classList.add('drag');
            try { card.setPointerCapture(e.pointerId); } catch (_) { /* 旧浏览器 */ }
          });
          card.addEventListener('pointermove', (e) => {
            if (!drag) return;
            dx = e.clientX - sx; dy = e.clientY - sy;
            if (Math.abs(dx) > Math.abs(dy)) {
              stageEl.style.transform = `translateX(${(dx * 0.35).toFixed(1)}px)`;
              card.style.setProperty('--tilt', (dx * 0.03).toFixed(2) + 'deg');
              card.style.setProperty('--drop', '0px');
            } else if (dy > 0) {
              stageEl.style.transform = '';
              card.style.setProperty('--drop', (dy * 0.5).toFixed(1) + 'px');
            }
          });
          function endDrag() {
            if (!drag) return;
            drag = false;
            card.classList.remove('drag');
            stageEl.style.transform = '';
            card.style.setProperty('--tilt', '0deg');
            card.style.setProperty('--drop', '0px');
            if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 45) goPage(dx < 0 ? page + 1 : page - 1);
            else if (dy > 90) close();
            else if (Math.abs(dx) < 6 && Math.abs(dy) < 6) finishTyping();
          }
          card.addEventListener('pointerup', endDrag);
          card.addEventListener('pointercancel', endDrag);

          function close() {
            if (closing) return;
            closing = true;
            finishTyping();
            clearInterval(typeTimer);
            A.blip(A.voices.tap);
            reader.classList.remove('on');
            reader.classList.add('closing');
            layer.classList.remove('reading');
            setTimeout(() => reader.remove(), 450);
            readerOpen = false;
            if (allPagesRead(slot) && !noteEl.classList.contains('read')) {
              later(() => {
                noteEl.classList.add('read', 'bloom');
                const c = centerOf(noteEl.querySelector('.s5-orb'));
                burst(c.x, c.y, color, 16);
                tone(PENTA[pos[slot.idx].level] + 12, 0.035, 0.7);
                buzz(14);
                later(() => noteEl.classList.remove('bloom'), 950);
              }, 320);
            }
            later(updateProgress, 330);
          }
          closeBtn.addEventListener('click', close);
          backdrop.addEventListener('click', close);
          requestAnimationFrame(() => requestAnimationFrame(() => reader.classList.add('on')));
        }
      });
    }

    // 万一切章时表单/五线谱的 Promise 还没 resolve，兜底别让它永远挂着
    function raceAlive(promise) {
      return new Promise((resolve) => {
        let done = false;
        const finish = (v) => { if (done) return; done = true; clearInterval(iv); resolve(v); };
        promise.then(finish);
        const iv = setInterval(() => { if (!ctx.alive()) finish(undefined); }, 500);
      });
    }

    /* =========================================================
     * 结尾
     * ========================================================= */
    async function finale() {
      await U.sleep(400);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 2400 });
    }

    /* =========================================================
     * 时间线
     * ========================================================= */
    (async () => {
      App.companion.show({ corner: 'tl' });
      App.shards.show();
      await U.sleep(700);
      if (!ctx.alive()) return;

      await App.companion.say(T.book, { small: true, hold: 850 });
      if (!ctx.alive()) return;

      await showBook();
      if (!ctx.alive()) return;

      await App.companion.say(T.lockSay, { hold: 650 });
      if (!ctx.alive()) return;

      const userDay = await raceAlive(runLockForm());
      if (!ctx.alive()) return;
      App.state.userDay = userDay;
      flash('#ffd98a');

      await App.companion.say(T.unlock, { small: true, hold: 850 });
      if (!ctx.alive()) return;

      const slots = buildSlots(userDay);
      await raceAlive(showStaff(slots));
      if (!ctx.alive()) return;

      await finale();
      if (!ctx.alive()) return;
      ctx.next();
    })();
  },

  exit() {
    if (this._disposers) {
      this._disposers.forEach((fn) => { try { fn(); } catch (e) { /* 忽略 */ } });
      this._disposers = null;
    }
    App.companion.reset();
    App.shards.hide();
  }
});