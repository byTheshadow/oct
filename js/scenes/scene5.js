/* =========================================================
 * Scene 5 · Cue Points 时间点
 *   接 Scene 4：五块碎片全亮，收藏槽常驻右上角，白团子常驻左上角。
 *   白团子翻出小本本，中间先上锁一个空音符——要小寒填"对你来说重要的一天"
 *   （月/日滚轮 + 一句话），提交后生成一张截图卡（零成本，靠她自己截图发回来）。
 *   确认后解锁五线谱：八张剧本卡 + 小寒填的那一天，按日期排好，同一天的并成和弦。
 *   戳开每个音符翻卡片；全部翻完后白团子说一句收尾，自动进 Scene 6。
 *
 * 不用 three 舞台（config.chapters.scene5 里 stage:false）。
 * #overlay 里一张 2D canvas 画暖色光斑背景 + 触碰特效（core/codesea.js 不在这里用，
 * 本章的海洋/字符渲染用不上，自己起一个更轻量的 canvas），其余（小本本/表单/五线谱/
 * 卡片阅读器）都是叠在上面的 DOM。
 * 调试：?scene=scene5&debug
 * ========================================================= */
App.director.register('scene5', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene5;
    const WARM = CFG.palettes.warm;
    const GLOW_COLORS = WARM.glows;
    const self = this;

    const ov = document.getElementById('overlay');
    ov.className = 'active';

    const layer = U.el('div', 's5-layer', ov);

    /* =========================================================
     * 背景：暖色光斑 + 触碰特效，画在一张轻量 2D canvas 上
     * ========================================================= */
    const canvas = U.el('canvas', 's5-canvas', ov);
    const g = canvas.getContext('2d');
    let W = 0, H = 0, dpr = 1;
    const glowSprites = {};
    const glows = [];

    function makeGlowSprite(color) {
      const s = 240;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, `rgba(${rgb},0.55)`);
      gr.addColorStop(0.45, `rgba(${rgb},0.22)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return c;
    }

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = ov.clientWidth || window.innerWidth;
      H = ov.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }

    function buildGlows() {
      glows.length = 0;
      const n = 6;
      for (let i = 0; i < n; i++) {
        const color = GLOW_COLORS[i % GLOW_COLORS.length];
        if (!glowSprites[color]) glowSprites[color] = makeGlowSprite(color);
        glows.push({
          color, sprite: glowSprites[color],
          bx: 0.14 + (i % 3) * 0.37,
          by: 0.2 + Math.floor(i / 3) * 0.52,
          r: U.rand(0.26, 0.4),
          phase: Math.random() * 6.28,
          speed: U.rand(0.07, 0.15),
          push: { x: 0, y: 0, vx: 0, vy: 0 }
        });
      }
    }

    function onResize() { layout(); }
    layout();
    buildGlows();
    window.addEventListener('resize', onResize);

    // 落点的涟漪 + 四散的小光点，拖动时留一条淡淡的暖色拖尾
    const sparks = [];
    const dust = [];
    function spark(x, y, color) {
      sparks.push({ x, y, age: 0, max: 0.5, color: color || U.pick(GLOW_COLORS) });
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * 6.28, sp = U.rand(30, 95);
        dust.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 10,
          age: 0, max: 0.45 + Math.random() * 0.35, color: color || U.pick(GLOW_COLORS),
          r: 1.4 + Math.random() * 1.6, glyph: Math.random() < 0.18
        });
      }
    }
    function addTrailBit(x, y) {
      const color = U.pick(GLOW_COLORS);
      dust.push({
        x, y, vx: U.rand(-10, 10), vy: U.rand(-16, -4),
        age: 0, max: 0.4 + Math.random() * 0.3, color,
        r: 1 + Math.random() * 1.3, glyph: Math.random() < 0.12
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

    let raf = 0, last = 0, t = 0, running = true;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = WARM.bg;
      g.fillRect(0, 0, W, H);

      for (const gw of glows) {
        gw.push.vx *= Math.exp(-dt * 2.4);
        gw.push.vy *= Math.exp(-dt * 2.4);
        gw.push.x = (gw.push.x + gw.push.vx * dt) * Math.exp(-dt * 1.1);
        gw.push.y = (gw.push.y + gw.push.vy * dt) * Math.exp(-dt * 1.1);
        const tiltX = App.tilt.x * 18, tiltY = App.tilt.y * 14;
        const cx = gw.bx * W + Math.sin(t * gw.speed + gw.phase) * 18 + tiltX + gw.push.x;
        const cy = gw.by * H + Math.cos(t * gw.speed * 0.8 + gw.phase) * 14 + tiltY + gw.push.y;
        const r = gw.r * Math.max(W, H);
        g.globalAlpha = 1;
        g.drawImage(gw.sprite, cx - r, cy - r, r * 2, r * 2);
      }

      for (let i = dust.length - 1; i >= 0; i--) {
        const p = dust[i]; p.age += dt;
        if (p.age >= p.max) { dust.splice(i, 1); continue; }
        p.vy += 55 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const a = 1 - p.age / p.max;
        g.globalAlpha = a;
        if (p.glyph) {
          g.font = '11px "Segoe UI Symbol", "Noto Sans SC", system-ui, sans-serif';
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillStyle = p.color;
          g.fillText('♪', p.x, p.y);
        } else {
          g.fillStyle = p.color;
          g.beginPath(); g.arc(p.x, p.y, p.r * a + 0.6, 0, 6.3); g.fill();
        }
      }
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]; s.age += dt;
        if (s.age >= s.max) { sparks.splice(i, 1); continue; }
        const e = s.age / s.max;
        g.globalAlpha = (1 - e) * 0.6;
        g.strokeStyle = s.color;
        g.lineWidth = 2;
        g.beginPath(); g.arc(s.x, s.y, 6 + e * 32, 0, 6.3); g.stroke();
      }
      g.globalAlpha = 1;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);

    function canvasRect() { return canvas.getBoundingClientRect(); }

    // ---------- 触碰特效：按下冒光波、拖动留拖尾、五声音阶随横坐标变音高 ----------
    const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19];
    function noteAt(x) {
      const k = PENTA[U.clamp(Math.floor(x / Math.max(1, W) * PENTA.length), 0, PENTA.length - 1)];
      A.blip({ freq: CFG.COIN_BASE_HZ * Math.pow(2, k / 12), type: 'sine', vol: 0.035, dur: 0.4, jitter: 0 });
    }
    let dragging = false, lastX = 0, lastY = 0, lastNoteT = 0;
    function toLocal(e) {
      const r = canvasRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function onDown(e) {
      const p = toLocal(e);
      dragging = true; lastX = p.x; lastY = p.y; lastNoteT = performance.now();
      spark(p.x, p.y);
      pushGlows(p.x, p.y, 0.55);
      noteAt(p.x);
    }
    function onMove(e) {
      if (!dragging) return;
      const p = toLocal(e);
      const dist = Math.hypot(p.x - lastX, p.y - lastY);
      if (dist < 4) return;
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

    self._destroyBg = function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
    self._destroyTouch = function () {
      ov.removeEventListener('pointerdown', onDown);
      ov.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };

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
    function makeIcon(name) {
      const wrap = document.createElement('div');
      wrap.className = 's5-icon s5-icon-' + (name || 'heart');
      const def = ICONS[name] || ICONS.heart;
      wrap.appendChild(App.sprites.render(def.map, def.pal, 4));
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
     * 小本本翻开动画
     * ========================================================= */
    async function showBook() {
      const book = U.el('div', 's5-book', layer);
      U.el('div', 's5-book-page', book);
      const cover = U.el('div', 's5-book-cover', book);
      cover.appendChild(App.sprites.render(BOOK_COVER, BOOK_PAL, 8));
      U.el('div', 's5-book-cover-back', cover);

      A.whoosh(0.05, 0.5);
      requestAnimationFrame(() => book.classList.add('on'));
      await U.sleep(600);
      if (!ctx.alive()) return;
      A.click(0.14);
      book.classList.add('flip');
      await U.sleep(1000);
      if (!ctx.alive()) return;
      await U.sleep(300);
      if (!ctx.alive()) return;
      book.classList.add('out');
      await U.sleep(520);
      book.remove();
    }

    /* =========================================================
     * 上锁：月/日滚轮 + 一句话，提交后出截图卡
     * ========================================================= */
    function buildWheel(container, items, startIndex, onChange) {
      const el = U.el('div', 's5-wheel', container);
      U.el('div', 's5-wheel-pad', el);
      const itemEls = items.map((label) => U.el('div', 's5-wheel-item', el, label));
      U.el('div', 's5-wheel-pad', el);
      U.el('div', 's5-wheel-frame', el);
      U.el('div', 's5-wheel-mask', el);

      function paint(idx) { itemEls.forEach((d, i) => d.classList.toggle('mid', i === idx)); }
      let timer = null;
      function onScroll() {
        clearTimeout(timer);
        timer = setTimeout(() => {
          const idx = U.clamp(Math.round(el.scrollTop / 36), 0, itemEls.length - 1);
          el.scrollTo({ top: idx * 36, behavior: 'smooth' });
          paint(idx);
          A.blip({ freq: 520, type: 'sine', vol: 0.02, dur: 0.04, jitter: 0 });
          onChange(idx);
        }, 110);
      }
      el.addEventListener('scroll', onScroll, { passive: true });
      el.scrollTop = startIndex * 36;
      paint(startIndex);
      return el;
    }

    function runLockForm() {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's5-lock', layer);
        const noteCanvas = App.sprites.set('note', 6).sit;
        noteCanvas.className = 's5-lock-note';
        wrap.appendChild(noteCanvas);
        U.el('div', 's5-lock-label', wrap, T.dayLabel);

        const form = U.el('div', 's5-form', wrap);
        const wheels = U.el('div', 's5-wheels', form);
        const MONTHS = [10, 11];
        const daysInMonth = (m) => (m === 10 ? 31 : 2);

        let month = 10, day = 8;
        const monthHost = U.el('div', null, wheels);
        const dayHost = U.el('div', null, wheels);

        function rebuildDayWheel(preferDay) {
          dayHost.innerHTML = '';
          const n = daysInMonth(month);
          const opts = [];
          for (let d = 1; d <= n; d++) opts.push(d + '日');
          const idx = Math.min((preferDay || day) - 1, n - 1);
          day = idx + 1;
          buildWheel(dayHost, opts, idx, (i) => { day = i + 1; });
        }
        buildWheel(monthHost, MONTHS.map((m) => m + '月'), 0, (idx) => {
          month = MONTHS[idx];
          rebuildDayWheel(1);
        });
        rebuildDayWheel(day);

        const inputRow = U.el('div', 's5-input-row', form);
        const input = document.createElement('textarea');
        input.className = 's5-text-input';
        input.rows = 2;
        input.maxLength = 30;
        input.placeholder = T.textPlaceholder;
        inputRow.appendChild(input);
        const count = U.el('div', 's5-text-count', inputRow, '0/30');

        const submitBtn = U.el('button', 's5-submit px-btn', form, T.submit);
        submitBtn.type = 'button';

        input.addEventListener('input', () => {
          const n = input.value.length;
          count.textContent = n + '/30';
          submitBtn.classList.toggle('ready', n > 0);
        });

        // 安卓软键盘顶起表单：visualViewport 缩小时把 wrap 往上挪
        function onVV() {
          const vv = window.visualViewport;
          if (!vv) return;
          const overlap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
          wrap.style.top = overlap > 60 ? `calc(6% - ${Math.min(overlap * 0.35, 90)}px)` : '14%';
        }
        if (window.visualViewport) {
          window.visualViewport.addEventListener('resize', onVV);
          window.visualViewport.addEventListener('scroll', onVV);
        }
        self._vvCleanup = function () {
          if (window.visualViewport) {
            window.visualViewport.removeEventListener('resize', onVV);
            window.visualViewport.removeEventListener('scroll', onVV);
          }
        };

        function showShot(data) {
          const shot = U.el('div', 's5-shot', layer);
          U.el('div', 's5-shot-date', shot, `${data.month}月${data.day}日`);
          U.el('div', 's5-shot-text', shot, data.text);
          U.el('div', 's5-shot-note', shot, T.shotNote);
          U.el('div', 's5-shot-hint', shot, T.shotHint);
          const ok = U.el('button', 'px-btn', shot, T.shotOk);
          ok.type = 'button';
          requestAnimationFrame(() => shot.classList.add('on'));
          A.whoosh(0.05, 0.4);
          ok.addEventListener('click', () => {
            A.blip(A.voices.tap);
            shot.classList.remove('on');
            setTimeout(() => shot.remove(), 520);
            resolve(data);
          });
        }

        submitBtn.addEventListener('click', () => {
          if (!submitBtn.classList.contains('ready')) return;
          const text = input.value.trim();
          if (!text) return;
          A.blip(A.voices.tap);
          self._vvCleanup();
          self._vvCleanup = null;
          wrap.classList.remove('on');
          wrap.classList.add('out');
          setTimeout(() => { wrap.remove(); showShot({ month, day, text }); }, 420);
        });

        requestAnimationFrame(() => wrap.classList.add('on'));
      });
    }

    /* =========================================================
     * 解锁：五线谱 + 音符卡片
     * ========================================================= */
    function buildSlots(userDay) {
      const slots = T.cards.map((c) => ({ m: c.m, d: c.d, pages: c.pages.slice(), userSlot: false }));
      if (userDay) {
        const match = slots.find((s) => s.m === userDay.month && s.d === userDay.day);
        const page = { text: userDay.text, icon: 'heart', isUser: true };
        if (match) match.pages.push(page);
        else slots.push({ m: userDay.month, d: userDay.day, pages: [page], userSlot: true });
      }
      slots.sort((a, b) => (a.m * 100 + a.d) - (b.m * 100 + b.d));
      slots.forEach((s, i) => { s.idx = i; s.readPages = new Set(); });
      return slots;
    }
    const allPagesRead = (s) => s.readPages.size >= s.pages.length;

    function showStaff(slots) {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's5-staff-wrap', layer);
        const staff = U.el('div', 's5-staff', wrap);
        const top0 = 78, gap = 26, stepX = 96;
        for (let i = 0; i < 5; i++) {
          const line = U.el('div', 's5-staff-line', staff);
          line.style.top = (top0 + i * gap) + 'px';
        }
        const n = slots.length;
        const pad = Math.max(W / 2 - 10, 120);
        const totalW = pad * 2 + stepX * Math.max(0, n - 1);
        staff.style.width = totalW + 'px';

        // 背景里慢慢飘起的小音符，填满空旷的上下空间
        const drift = U.el('div', 's5-drift-box', layer);
        const driftGl = ['♪', '♫', '♩', '✦', '✧'];
        const driftTimer = setInterval(() => {
          if (!ctx.alive()) return;
          const sp = U.el('span', 's5-drift', drift, U.pick(driftGl));
          sp.style.left = (6 + Math.random() * 88) + '%';
          sp.style.top = (H * (0.3 + Math.random() * 0.5)) + 'px';
          sp.style.color = U.pick(GLOW_COLORS);
          sp.style.fontSize = (10 + Math.random() * 12) + 'px';
          sp.style.animationDuration = (4.5 + Math.random() * 3) + 's';
          setTimeout(() => sp.remove(), 8000);
        }, 650);
        self._staffCleanup = () => clearInterval(driftTimer);

        // 音符位置
        const pos = slots.map((s, i) => {
          const level = (s.m * 31 + s.d) % 9;
          return { x: pad + stepX * i, y: top0 + gap * 4 - level * (gap / 2), level };
        });

        // 旋律丝带：音符之间的发光曲线，读过的两端会点亮
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('class', 's5-ribbon');
        svg.setAttribute('width', totalW);
        svg.setAttribute('height', 300);
        staff.appendChild(svg);
        const segs = [];
        for (let i = 0; i < n - 1; i++) {
          const p0 = pos[i], p1 = pos[i + 1], xm = (p0.x + p1.x) / 2;
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', `M${p0.x} ${p0.y} C${xm} ${p0.y} ${xm} ${p1.y} ${p1.x} ${p1.y}`);
          path.setAttribute('pathLength', '1');
          path.setAttribute('class', 's5-seg');
          path.style.transitionDelay = (0.5 + i * 0.12) + 's';
          svg.appendChild(path);
          segs.push(path);
        }
        function refreshSegs() {
          segs.forEach((sg, i) => sg.classList.toggle('lit', allPagesRead(slots[i]) && allPagesRead(slots[i + 1])));
        }

        let readerOpen = false;
        const els = [];

        slots.forEach((s, i) => {
          const color = GLOW_COLORS[i % GLOW_COLORS.length];
          const el = U.el('div', 's5-note' + (s.pages.length > 1 ? ' chord' : ''), staff);
          el.style.left = pos[i].x + 'px';
          el.style.top = pos[i].y + 'px';
          el.style.setProperty('--nc', color);
          el.style.setProperty('--d', (i * 0.09 + 0.3) + 's');
          el.style.setProperty('--ph', (i * 0.7) + 's');
          const orb = U.el('div', 's5-orb', el);
          U.el('div', 's5-note-glyph', orb, '♪');
          if (s.pages.length > 1) U.el('div', 's5-badge', el, '×' + s.pages.length);
          U.el('div', 's5-check', el, '✓');
          U.el('div', 's5-note-date', el, `${s.m}.${s.d}`);
          el.addEventListener('click', () => {
            if (!readerOpen) openReader(s, el, color);
          });
          els.push(el);
        });

        // 滚动：靠近中心的音符放大，经过中心时像八音盒一样轻响
        let lastC = 0, lastScroll = 0, touched = false;
        function onScroll() {
          const cx = wrap.scrollLeft + wrap.clientWidth / 2;
          let near = -1, nd = 1e9;
          pos.forEach((p, i) => {
            const d = Math.abs(p.x - cx);
            const f = Math.max(0, 1 - d / 120);
            els[i].style.setProperty('--f', f.toFixed(3));
            if (d < nd) { nd = d; near = i; }
          });
          if (near !== lastC && nd < 20) {
            lastC = near;
            const k = PENTA[pos[near].level];
            A.blip({ freq: CFG.COIN_BASE_HZ * Math.pow(2, k / 12), type: 'sine', vol: 0.03, dur: 0.5, jitter: 0 });
            const r = els[near].getBoundingClientRect(), cr = canvasRect();
            spark(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top, GLOW_COLORS[near % GLOW_COLORS.length]);
          }
          const ds = Math.abs(wrap.scrollLeft - lastScroll);
          if (ds > 4) pushGlows(W / 2, H * 0.5, Math.min(0.2, ds / 120));
          lastScroll = wrap.scrollLeft;
        }
        wrap.addEventListener('scroll', onScroll, { passive: true });
        wrap.addEventListener('pointerdown', () => { touched = true; });

        // 音符被点时：光环 + 迸出小音符
        function noteBurst(el, color) {
          const r = el.getBoundingClientRect(), lr = layer.getBoundingClientRect();
          const cx = r.left + r.width / 2 - lr.left, cy = r.top + r.height / 2 - lr.top;
          const ring = U.el('div', 's5-ring', layer);
          ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.style.setProperty('--nc', color);
          setTimeout(() => ring.remove(), 900);
          const gl = ['♪', '♫', '✦', '♩', '✧', '♥'];
          for (let k = 0; k < 10; k++) {
            const a = (k / 10) * 6.28 + Math.random() * 0.5, d = 46 + Math.random() * 56;
            const f = U.el('span', 's5-fly', layer, U.pick(gl));
            f.style.left = cx + 'px'; f.style.top = cy + 'px';
            f.style.setProperty('--dx', (Math.cos(a) * d).toFixed(0) + 'px');
            f.style.setProperty('--dy', (Math.sin(a) * d - 30).toFixed(0) + 'px');
            f.style.setProperty('--rot', ((Math.random() - 0.5) * 120).toFixed(0) + 'deg');
            f.style.color = k % 3 === 0 ? '#fff4e0' : color;
            setTimeout(() => f.remove(), 1400);
          }
        }

        // 进度：一排小点，读完一个亮一个
        const progress = U.el('div', 's5-progress', layer);
        const pdots = slots.map(() => U.el('span', 's5-pdot', progress));
        const ptxt = U.el('span', 's5-ptxt', progress, `0/${n}`);
        function updateProgress() {
          const done = slots.filter(allPagesRead).length;
          pdots.forEach((d, i) => d.classList.toggle('on', allPagesRead(slots[i])));
          ptxt.textContent = `${done}/${n}`;
          refreshSegs();
          if (done >= n) {
            wrap.classList.add('all');
            for (let k = 0; k < 7; k++) setTimeout(() => { if (ctx.alive()) A.coin(k * 2 % 11); }, k * 110);
            setTimeout(resolve, 1500);
          }
        }
        requestAnimationFrame(() => {
          wrap.classList.add('on');
          progress.classList.add('on');
          staff.classList.add('go');
          onScroll();
        });
        setTimeout(() => {
          if (!ctx.alive() || touched || wrap.scrollLeft > 0) return;
          wrap.scrollTo({ left: stepX, behavior: 'smooth' });
          setTimeout(() => { if (ctx.alive() && !touched) wrap.scrollTo({ left: 0, behavior: 'smooth' }); }, 1500);
        }, 2200);

        const hint = U.el('div', 'soft-hint sea', layer, T.hint);
        requestAnimationFrame(() => hint.classList.add('on'));
        setTimeout(() => { if (hint.parentNode) hint.classList.remove('on'); }, 3400);
        setTimeout(() => hint.remove(), 4600);

        function openReader(slot, noteEl, color) {
          readerOpen = true;
          let page = 0;
          const reader = U.el('div', 's5-reader', layer);
          U.el('div', 's5-reader-backdrop', reader);
          const card = U.el('div', 's5-reader-card', reader);
          card.style.setProperty('--nc', color);
          U.el('div', 's5-reader-date', card, `${slot.m}月${slot.d}日`);
          const closeBtn = U.el('button', 's5-reader-close', card, '✕');
          closeBtn.type = 'button';
          const iconWrap = U.el('div', 's5-icon-wrap', card);
          const titleEl = U.el('div', 's5-card-title', card);
          const textEl = U.el('div', 's5-card-text', card);
          const dots = U.el('div', 's5-reader-dots', card);
          const prevBtn = U.el('button', 's5-reader-arrow prev', card, '‹');
          const nextBtn = U.el('button', 's5-reader-arrow next', card, '›');
          prevBtn.type = 'button'; nextBtn.type = 'button';
          slot.pages.forEach((_, i) => U.el('div', 's5-reader-dot' + (i === 0 ? ' on' : ''), dots));

          function renderPage() {
            const p = slot.pages[page];
            iconWrap.innerHTML = '';
            iconWrap.appendChild(makeIcon(p.icon));
            titleEl.textContent = p.title || '';
            titleEl.style.display = p.title ? '' : 'none';
            textEl.textContent = p.isUser ? (T.userCard || p.text) : p.text;
            dots.querySelectorAll('.s5-reader-dot').forEach((d, i) => d.classList.toggle('on', i === page));
            prevBtn.disabled = page === 0;
            nextBtn.disabled = page === slot.pages.length - 1;
            slot.readPages.add(page);
          }
          renderPage();

          A.coin(slot.idx % 11);
          if (slot.pages.length > 1) setTimeout(() => { if (ctx.alive()) A.coin((slot.idx + 2) % 11); }, 90);

          noteEl.classList.add('pluck');
          setTimeout(() => noteEl.classList.remove('pluck'), 420);
          const r = noteEl.getBoundingClientRect(), cr = canvasRect();
          spark(r.left + r.width / 2 - cr.left, r.top + r.height / 2 - cr.top, color);
          noteBurst(noteEl, color);

          prevBtn.addEventListener('click', () => { if (page > 0) { page--; renderPage(); A.blip(A.voices.tap); } });
          nextBtn.addEventListener('click', () => { if (page < slot.pages.length - 1) { page++; renderPage(); A.blip(A.voices.tap); } });

          function close() {
            reader.classList.remove('on');
            setTimeout(() => reader.remove(), 320);
            readerOpen = false;
            if (allPagesRead(slot)) noteEl.classList.add('read');
            updateProgress();
          }
          closeBtn.addEventListener('click', close);
          reader.querySelector('.s5-reader-backdrop').addEventListener('click', close);
          requestAnimationFrame(() => reader.classList.add('on'));
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
      await U.sleep(500);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 2200 });
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
    if (this._destroyBg) { this._destroyBg(); this._destroyBg = null; }
    if (this._destroyTouch) { this._destroyTouch(); this._destroyTouch = null; }
    if (this._staffCleanup) { this._staffCleanup(); this._staffCleanup = null; }
    if (this._vvCleanup) { this._vvCleanup(); this._vvCleanup = null; }
    App.companion.reset();
    App.shards.hide();
  }
});