/* =========================================================
 * Scene 7 · 星空词云 + 照片 + 词频猜猜看
 *   白团子："这些，是我偷偷数的……不许笑。"
 *   7a：两道猜词题（3 颗发光星球按钮，没有对错惩罚，答错亮出正确答案）→
 *       揭晓"星座榜单"（炫少 / 小寒 两列，次数决定亮度和大小，细线连起来）→
 *       数字打字机弹出（1774 / 1038 / 736 / 1.5 万 Token）。
 *   7b：黑夜星空，16 颗词云星（字号 = 次数）+ 8 张漂浮的"星光相框"照片。
 *       点星弹小注解（白团子口吻），点够 10 颗不同的词，星星汇聚、连线，
 *       变形成大写字母 "Y"，金色连线停留 3 秒，白团子收尾一句，ctx.next()。
 *
 * 不用 three 舞台（config.chapters.scene7 里 stage:false），整章画在 #overlay 里：
 * 一张 2D canvas（星空背景 + 词云星 + 变形连线）+ 少量 DOM（题目/星座榜单/数字弹出/照片相框/注解灯箱）。
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

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const canvas = U.el('canvas', 's7-canvas', ov);
    const g = canvas.getContext('2d');
    const layer = U.el('div', 's7-layer', ov);

    let W = 0, H = 0, dpr = 1;
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = ov.clientWidth || window.innerWidth;
      H = ov.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
    }
    function onResize() { layout(); if (wordStars.length) layoutWordsKeepingInside(); }
    layout();
    window.addEventListener('resize', onResize);

    function canvasRect() { return canvas.getBoundingClientRect(); }
    function toLocal(e) {
      const r = canvasRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    /* =========================================================
     * 颜色小工具 + 发光贴图（和 scene6 同一套做法）
     * ========================================================= */
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const rgb = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
    const glowSprites = {};
    function glowSprite(color) {
      if (glowSprites[color]) return glowSprites[color];
      const s = 180;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const col = hex(color);
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, rgb(col, 0.6));
      gr.addColorStop(0.42, rgb(col, 0.22));
      gr.addColorStop(1, rgb(col, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return (glowSprites[color] = c);
    }

    /* =========================================================
     * 背景：渐变星空 + 弥散光斑 + 一片小星星，陀螺仪轻微视差
     * ========================================================= */
    const bgGlows = PAL.glows.map((c, i) => ({ c, bx: 0.1 + (i * 0.33) % 0.85, by: 0.12 + (i * 0.27) % 0.75, r: 0.32 + (i % 3) * 0.08, ph: i * 1.6, sp: U.rand(0.05, 0.1) }));
    const bgStars = [];
    function seedBg() {
      bgStars.length = 0;
      for (let i = 0; i < 120; i++) {
        bgStars.push({ x: Math.random(), y: Math.random(), r: U.rand(0.5, 1.6), ph: Math.random() * 6.28, sp: U.rand(0.7, 2.1) });
      }
    }
    seedBg();

    function drawBackground(dt) {
      const sky = PAL.sky;
      const gr = g.createLinearGradient(0, 0, 0, H);
      sky.forEach((c, i) => gr.addColorStop(i / (sky.length - 1), c));
      g.globalAlpha = 1;
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);

      const tx = App.tilt.x * 16, ty = App.tilt.y * 12;
      g.globalCompositeOperation = 'lighter';
      for (const gw of bgGlows) {
        const cx = gw.bx * W + Math.sin(t * gw.sp + gw.ph) * 22 + tx;
        const cy = gw.by * H + Math.cos(t * gw.sp * 0.8 + gw.ph) * 16 + ty;
        const r = gw.r * Math.max(W, H);
        g.globalAlpha = 0.5;
        g.drawImage(glowSprite(gw.c), cx - r, cy - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      for (const s of bgStars) {
        const a = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        g.globalAlpha = a;
        g.fillStyle = PAL.star;
        g.beginPath();
        g.arc(s.x * W + tx * 0.3, s.y * H + ty * 0.3, s.r, 0, 6.3);
        g.fill();
      }
      g.globalAlpha = 1;
    }

    /* =========================================================
     * 词云星星
     * ========================================================= */
    let wordStars = [];
    let cloudActive = false, visitedCount = 0, halfwaySaid = false, morphTriggered = false;
    let resolveCloud = null;
    function starGlow(gold) {
      const color = gold ? PAL.gold : PAL.star;
      return glowSprite(color);
    }

    function layoutWords() {
      const unit = Math.min(W, H);
      const maxN = Math.max.apply(null, T.words.map((w) => w.n));
      const minN = Math.min.apply(null, T.words.map((w) => w.n));
      wordStars = T.words.map((wd, i) => {
        const sizeT = (wd.n - minN) / Math.max(1, maxN - minN);
        const r = unit * (0.026 + 0.05 * sizeT);
        return {
          w: wd.w, n: wd.n, note: wd.note, idx: i, r,
          curX: U.rand(0.14, 0.86), curY: U.rand(0.14, 0.78),
          phase: Math.random() * 6.28, visited: false, alpha: 1, gone: false,
          sx: 0, sy: 0, anchorIdx: -1
        };
      });
      // 简单斥力迭代：避免重叠，放不下就在迭代里自然挤开
      for (let iter = 0; iter < 240; iter++) {
        for (let a = 0; a < wordStars.length; a++) {
          for (let b = a + 1; b < wordStars.length; b++) {
            const A1 = wordStars[a], B1 = wordStars[b];
            const dx = (B1.curX - A1.curX) * W, dy = (B1.curY - A1.curY) * H;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = A1.r + B1.r + 16;
            if (dist < minD) {
              const push = (minD - dist) / 2 / dist;
              const nx = dx * push, ny = dy * push;
              A1.curX -= nx / W; A1.curY -= ny / H;
              B1.curX += nx / W; B1.curY += ny / H;
            }
          }
        }
        wordStars.forEach((s) => { s.curX = U.clamp(s.curX, 0.1, 0.9); s.curY = U.clamp(s.curY, 0.12, 0.8); });
      }
    }
    function layoutWordsKeepingInside() {
      wordStars.forEach((s) => { s.curX = U.clamp(s.curX, 0.08, 0.92); s.curY = U.clamp(s.curY, 0.1, 0.84); });
    }

    function drawCloud() {
      if (!wordStars.length) return;
      const beatSec = 60 / BPM;
      const beatPhase = (t % beatSec) / beatSec;
      const beatPulse = Math.max(0, 1 - beatPhase / 0.3);
      for (const s of wordStars) {
        if (s.gone) continue;
        const kBase = U.clamp(1.5 - s.r / (Math.min(W, H) * 0.08), 0.3, 1.5);
        const px = s.curX * W + App.tilt.x * kBase * 12;
        const py = s.curY * H + App.tilt.y * kBase * 10;
        s.sx = px; s.sy = py;
        const twinkle = 0.6 + 0.4 * Math.sin(t * 1.5 + s.phase);
        const flash = 1 + beatPulse * 0.4;
        const alpha = s.alpha;
        if (alpha <= 0.01) continue;
        g.save();
        g.globalCompositeOperation = 'lighter';
        const glowR = s.r * (1.9 + 0.35 * twinkle) * flash;
        g.globalAlpha = alpha * 0.9;
        g.drawImage(starGlow(s.visited), px - glowR, py - glowR, glowR * 2, glowR * 2);
        g.restore();
        g.globalAlpha = alpha;
        g.fillStyle = s.visited ? PAL.gold : '#ffffff';
        g.beginPath(); g.arc(px, py, s.r * 0.3, 0, 6.3); g.fill();
        g.font = `600 ${Math.round(s.r * 0.92)}px ${FONT}`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.shadowColor = s.visited ? PAL.gold : 'rgba(255,255,255,0.65)';
        g.shadowBlur = 8;
        g.fillStyle = 'rgba(255,250,240,0.95)';
        g.fillText(s.w, px, py + s.r * 1.55);
        g.shadowBlur = 0;
      }
      g.globalAlpha = 1;
    }

    // 点空白处：小涟漪
    const ripples = [];
    function ripple(x, y) {
      ripples.push({ x, y, age: 0, max: 0.5 });
      A.blip({ freq: 520, type: 'sine', vol: 0.025, dur: 0.1, jitter: 0.1 });
    }
    function drawRipples(dt) {
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i]; r.age += dt;
        if (r.age >= r.max) { ripples.splice(i, 1); continue; }
        const e = r.age / r.max;
        g.globalAlpha = (1 - e) * 0.5;
        g.strokeStyle = PAL.star;
        g.lineWidth = 1.6;
        g.beginPath(); g.arc(r.x, r.y, 6 + e * 34, 0, 6.3); g.stroke();
      }
      g.globalAlpha = 1;
    }
    function burstAt(x, y, gold) {
      const el = U.el('div', 's7-burst', layer);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.setProperty('--c', gold ? PAL.gold : PAL.star);
      setTimeout(() => el.remove(), 700);
    }

    /* =========================================================
     * "Y" 变形：10 个锚点（几何定义：左臂 / 右臂 / 竖干），顺序连线
     * ========================================================= */
    const ANCHORS = [
      { x: 0.30, y: 0.16 }, { x: 0.38, y: 0.29 }, { x: 0.46, y: 0.42 },   // 左臂
      { x: 0.70, y: 0.16 }, { x: 0.62, y: 0.29 }, { x: 0.54, y: 0.42 },   // 右臂
      { x: 0.50, y: 0.46 },                                              // 交汇点
      { x: 0.50, y: 0.58 }, { x: 0.50, y: 0.70 }, { x: 0.50, y: 0.82 }    // 竖干
    ];
    const ANCHOR_LINKS = [[0, 1], [1, 2], [2, 6], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];
    let morphAnchorStars = null, morphLineProgress = 0;

    function drawMorphLines() {
      if (!morphAnchorStars || morphLineProgress <= 0) return;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineWidth = 2.4;
      const pulse = 0.72 + 0.28 * Math.sin(t * 3.2);
      ANCHOR_LINKS.forEach(([ia, ib]) => {
        const A1 = morphAnchorStars[ia], B1 = morphAnchorStars[ib];
        if (!A1 || !B1) return;
        g.strokeStyle = rgb(hex(PAL.gold), morphLineProgress * pulse);
        g.beginPath(); g.moveTo(A1.sx, A1.sy); g.lineTo(B1.sx, B1.sy); g.stroke();
      });
      g.restore();
    }

    /* =========================================================
     * 帧循环
     * ========================================================= */
    let raf = 0, last = 0, t = 0, running = true;
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawBackground(dt);
      drawCloud();
      drawMorphLines();
      drawRipples(dt);
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);

    /* =========================================================
     * 画布点击：命中词云星 → 开注解；命中空白 → 小涟漪
     * ========================================================= */
    function hitTest(x, y) {
      let best = null, bestD = 1e9;
      for (const s of wordStars) {
        if (s.gone || s.alpha < 0.3) continue;
        const d = Math.hypot(s.sx - x, s.sy - y);
        const tol = s.r + 8;
        if (d <= tol && d < bestD) { bestD = d; best = s; }
      }
      return best;
    }
    function onCanvasDown(e) {
      if (!cloudActive) return;
      const p = toLocal(e);
      const hit = hitTest(p.x, p.y);
      if (hit) openWordNote(hit);
      else ripple(p.x, p.y);
    }
    canvas.addEventListener('pointerdown', onCanvasDown);

    // companion.say 自己支持被新的一句打断（见 companion.js 的 sayTok），所以这里不用互斥锁：
    // 每次点星星立刻计数、立刻反馈，旁白只是"尽量说完"，被下一次点击打断也没关系。
    function openWordNote(star) {
      A.blip({ freq: 640 + star.idx * 18, type: 'sine', vol: 0.045, dur: 0.14, jitter: 0.05 });
      burstAt(star.sx, star.sy, true);
      const firstTime = !star.visited;
      if (firstTime) { star.visited = true; visitedCount++; }
      const text = star.note || T.noteFallback;
      App.companion.say(text, { small: false, hold: 1500 });
      if (firstTime && visitedCount === 5 && !halfwaySaid) {
        halfwaySaid = true;
        setTimeout(() => { if (ctx.alive()) App.companion.say(T.halfway, { small: true, hold: 1100 }); }, 1900);
      }
      if (firstTime && visitedCount >= 10 && !morphTriggered) {
        morphTriggered = true;
        if (resolveCloud) resolveCloud();
      }
    }

    /* =========================================================
     * 照片：8 张漂浮的"星光相框"
     * ========================================================= */
    const photoEls = [];
    // 照片相对词云星星做斥力避让，让相框落在"词与词之间"而不是叠在字上挡住点击
    function layoutPhotoPositions(count) {
      const photoR = U.clamp(Math.min(W, H) * 0.095, 26, 40);
      const pts = [];
      for (let i = 0; i < count; i++) pts.push({ x: U.rand(0.12, 0.88) * W, y: U.rand(0.14, 0.8) * H });
      const obstacles = wordStars.map((s) => ({ x: s.curX * W, y: s.curY * H, r: s.r }));
      for (let iter = 0; iter < 160; iter++) {
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i];
          obstacles.forEach((o) => {
            const dx = p.x - o.x, dy = p.y - o.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = o.r + photoR + 30;
            if (dist < minD) { const k = (minD - dist) / dist; p.x += dx * k; p.y += dy * k; }
          });
          for (let j = 0; j < pts.length; j++) {
            if (j === i) continue;
            const q = pts[j];
            const dx = p.x - q.x, dy = p.y - q.y;
            const dist = Math.hypot(dx, dy) || 0.001;
            const minD = photoR * 2 + 16;
            if (dist < minD) {
              const k = (minD - dist) / dist / 2;
              p.x += dx * k; p.y += dy * k;
              q.x -= dx * k; q.y -= dy * k;
            }
          }
          p.x = U.clamp(p.x, photoR + 8, W - photoR - 8);
          p.y = U.clamp(p.y, photoR + 8, H - photoR - 8);
        }
      }
      return pts.map((p) => ({ xPct: (p.x / W) * 100, yPct: (p.y / H) * 100 }));
    }
    function buildPhotos() {
      const list = CFG.PHOTO_URLS || [];
      const positions = layoutPhotoPositions(list.length);
      for (let i = 0; i < list.length; i++) {
        const p = list[i] || {};
        const el = U.el('div', 's7-photo', layer);
        el.style.left = positions[i].xPct.toFixed(2) + '%';
        el.style.top = positions[i].yPct.toFixed(2) + '%';
        el.style.setProperty('--dx', U.rand(-14, 14).toFixed(1) + 'px');
        el.style.setProperty('--dy', U.rand(-16, 16).toFixed(1) + 'px');
        el.style.setProperty('--r0', U.rand(-4, 4).toFixed(1) + 'deg');
        el.style.setProperty('--r1', U.rand(-4, 4).toFixed(1) + 'deg');
        el.style.animationDuration = U.rand(9, 15).toFixed(1) + 's';
        el.style.animationDelay = (-U.rand(0, 12)).toFixed(1) + 's';
        const frame = U.el('div', 's7-photo-frame', el);
        if (p.url) {
          const img = U.el('img', 's7-photo-img', frame);
          img.loading = 'lazy';
          img.decoding = 'async';
          img.draggable = false;
          img.alt = '';
          img.addEventListener('error', () => {
            img.remove();
            U.el('div', 's7-photo-placeholder', frame, '✦');
          }, { once: true });
          img.src = p.url;
        } else {
          U.el('div', 's7-photo-placeholder', frame, '?');
        }
        el.addEventListener('pointerdown', (e) => e.stopPropagation());
        el.addEventListener('click', () => openLightbox(p));
        photoEls.push(el);
      }
    }
    function openLightbox(p) {
      A.click(0.14);
      const box = U.el('div', 's7-light', layer);
      box.addEventListener('pointerdown', (e) => e.stopPropagation());
      U.el('div', 's7-light-backdrop', box);
      const card = U.el('div', 's7-light-card', box);
      if (p.url) {
        const img = U.el('img', 's7-light-img', card);
        img.alt = ''; img.draggable = false;
        img.addEventListener('error', () => {
          img.remove();
          U.el('div', 's7-light-placeholder big', card, '✦');
        }, { once: true });
        img.src = p.url;
      } else {
        U.el('div', 's7-light-placeholder big', card, '?');
      }
      if (p.caption) U.el('div', 's7-light-caption', card, p.caption);
      function close() { box.classList.remove('on'); setTimeout(() => box.remove(), 280); }
      box.addEventListener('click', close);
      requestAnimationFrame(() => box.classList.add('on'));
    }

    /* =========================================================
     * 7a · 猜词题：3 颗悬浮发光星球按钮，没有对错惩罚
     * ========================================================= */
    function runQuiz(q) {
      return new Promise((resolve) => {
        const wrap = U.el('div', 's7-quiz', layer);
        U.el('div', 's7-quiz-q', wrap, q.q);
        const opts = U.el('div', 's7-quiz-opts', wrap);
        const btns = q.options.map((opt, i) => {
          const b = U.el('button', 's7-planet', opts);
          b.type = 'button';
          b.style.setProperty('--c', PAL.glows[i % PAL.glows.length]);
          b.style.animationDelay = (i * -1.3).toFixed(1) + 's';
          U.el('span', 's7-planet-label', b, opt);
          return b;
        });
        requestAnimationFrame(() => wrap.classList.add('on'));
        let answered = false;
        btns.forEach((b, i) => {
          b.addEventListener('click', () => {
            if (answered || !ctx.alive()) return;
            answered = true;
            const ok = i === q.correct;
            b.classList.add(ok ? 'ok' : 'bad');
            if (ok) { A.coin(6); } else { A.blip({ freq: 220, type: 'triangle', vol: 0.05, dur: 0.16, jitter: 0 }); btns[q.correct].classList.add('reveal'); }
            setTimeout(() => {
              wrap.classList.remove('on');
              wrap.classList.add('out');
              setTimeout(() => { wrap.remove(); resolve(ok); }, 380);
            }, ok ? 500 : 950);
          });
        });
      });
    }

    /* =========================================================
     * 星座榜单（SVG，两列）
     * ========================================================= */
    function showRank() {
      return new Promise((resolve) => {
        const NS = 'http://www.w3.org/2000/svg';
        const wrap = U.el('div', 's7-rank', layer);
        const svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('viewBox', '0 0 320 420');
        svg.setAttribute('class', 's7-rank-svg');
        wrap.appendChild(svg);

        function col(list, cx, colors, anchorRight) {
          const maxN = list[0][1];
          const n = list.length;
          const pts = list.map((item, i) => {
            const y = 46 + i * ((392 - 46) / Math.max(1, n - 1));
            const r = 4 + 9 * (item[1] / maxN);
            return { x: cx, y, r, n: item[1], w: item[0] };
          });
          let d = '';
          pts.forEach((p, i) => { d += (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' '; });
          const path = document.createElementNS(NS, 'path');
          path.setAttribute('d', d.trim());
          path.setAttribute('class', 's7-rank-line');
          svg.appendChild(path);
          pts.forEach((p, i) => {
            const c = document.createElementNS(NS, 'circle');
            c.setAttribute('cx', p.x); c.setAttribute('cy', p.y); c.setAttribute('r', p.r);
            c.setAttribute('class', 's7-rank-dot');
            c.style.setProperty('--d', (i * 0.07) + 's');
            c.style.fill = colors[i % colors.length];
            svg.appendChild(c);
            const label = document.createElementNS(NS, 'text');
            label.setAttribute('x', p.x + (anchorRight ? p.r + 8 : -p.r - 8));
            label.setAttribute('y', p.y + 4);
            label.setAttribute('text-anchor', anchorRight ? 'start' : 'end');
            label.setAttribute('class', 's7-rank-label');
            label.textContent = p.w;
            svg.appendChild(label);
            const num = document.createElementNS(NS, 'text');
            num.setAttribute('x', p.x);
            num.setAttribute('y', p.y - p.r - 5);
            num.setAttribute('text-anchor', 'middle');
            num.setAttribute('class', 's7-rank-num');
            num.textContent = p.n;
            svg.appendChild(num);
          });
        }
        col(T.rankL, 92, PAL.glows, true);
        col(T.rankR, 228, PAL.glows.slice().reverse(), false);
        U.el('div', 's7-rank-title l', wrap, T.rankTitleL);
        U.el('div', 's7-rank-title r', wrap, T.rankTitleR);

        A.whoosh(0.04, 0.6);
        requestAnimationFrame(() => wrap.classList.add('on'));
        setTimeout(() => {
          if (!ctx.alive()) { wrap.remove(); resolve(); return; }
          wrap.classList.remove('on'); wrap.classList.add('out');
          setTimeout(() => { wrap.remove(); resolve(); }, 450);
        }, 3200);
      });
    }

    /* =========================================================
     * 数字打字机弹出
     * ========================================================= */
    async function showStats() {
      const wrap = U.el('div', 's7-stats', layer);
      const card = U.el('div', 's7-stats-card', wrap);
      requestAnimationFrame(() => wrap.classList.add('on'));
      A.whoosh(0.04, 0.4);
      for (let i = 0; i < T.stats.length; i++) {
        if (!ctx.alive()) return;
        const lineEl = U.el('div', 's7-stats-line', card);
        const text = T.stats[i];
        await U.typewrite(lineEl, text, { speed: 46, voice: 'bt' });
        if (!ctx.alive()) return;
        lineEl.innerHTML = text.replace(/[0-9]+(\.[0-9]+)?/g, (m) => `<span class="num">${m}</span>`);
        await U.sleep(i === T.stats.length - 1 ? 1500 : 380);
      }
      if (!ctx.alive()) return;
      wrap.classList.remove('on'); wrap.classList.add('out');
      await U.sleep(450);
      wrap.remove();
    }

    /* =========================================================
     * 7b · 星空词云：布点、照片、提示、等待点够 10 颗
     * ========================================================= */
    function startCloud() {
      return new Promise((resolve) => {
        resolveCloud = resolve;
        layoutWords();
        buildPhotos();
        cloudActive = true;

        const hint1 = U.el('div', 'soft-hint sea', layer, T.cloudHint);
        requestAnimationFrame(() => hint1.classList.add('on'));
        setTimeout(() => { if (hint1.parentNode) hint1.classList.remove('on'); }, 3200);
        setTimeout(() => hint1.remove(), 4400);

        setTimeout(() => {
          if (!ctx.alive()) return;
          const hint2 = U.el('div', 'soft-hint sea s7-hint2', layer, T.photoHint);
          requestAnimationFrame(() => hint2.classList.add('on'));
          setTimeout(() => { if (hint2.parentNode) hint2.classList.remove('on'); }, 3200);
          setTimeout(() => hint2.remove(), 4400);
        }, 3600);
      });
    }

    function teardownCloud() {
      cloudActive = false;
      photoEls.forEach((el) => el.remove());
      photoEls.length = 0;
    }

    /* =========================================================
     * 变形成 "Y"
     * ========================================================= */
    async function morphToY() {
      teardownCloud();

      const visited = wordStars.filter((s) => s.visited);
      const rest = wordStars.filter((s) => !s.visited).sort((a, b) => b.n - a.n);
      const chosen = visited.concat(rest).slice(0, 10);
      const others = wordStars.filter((s) => chosen.indexOf(s) < 0);

      const avail = ANCHORS.map((a, i) => ({ x: a.x, y: a.y, i, used: false }));
      chosen.forEach((s) => {
        let bi = -1, bd = 1e9;
        avail.forEach((a, ai) => {
          if (a.used) return;
          const d = Math.hypot(a.x - s.curX, a.y - s.curY);
          if (d < bd) { bd = d; bi = ai; }
        });
        avail[bi].used = true;
        s.anchorIdx = avail[bi].i;
      });

      A.whoosh(0.05, 0.6);
      for (let i = 0; i < chosen.length; i++) {
        setTimeout(() => { if (ctx.alive()) A.coin(i); }, i * 70);
      }

      const fromX = chosen.map((s) => s.curX), fromY = chosen.map((s) => s.curY);
      const toPos = chosen.map((s) => ANCHORS[s.anchorIdx]);

      const orderedForLines = new Array(10);
      chosen.forEach((s) => { orderedForLines[s.anchorIdx] = s; });

      await U.tween(1300, (e) => {
        chosen.forEach((s, i) => {
          s.curX = U.lerp(fromX[i], toPos[i].x, e);
          s.curY = U.lerp(fromY[i], toPos[i].y, e);
        });
        others.forEach((s) => { s.alpha = 1 - e; });
        morphLineProgress = U.clamp((e - 0.5) / 0.5, 0, 1);
        morphAnchorStars = orderedForLines;
      }, U.ease.inOutCubic);
      if (!ctx.alive()) return;
      others.forEach((s) => { s.gone = true; });
      morphLineProgress = 1;
      A.coin(10 % 11);
      await U.sleep(3000);
    }

    /* =========================================================
     * 时间线
     * ========================================================= */
    (async () => {
      App.companion.show({ corner: 'tl' });
      App.shards.show();
      await U.sleep(650);
      if (!ctx.alive()) return;

      await App.companion.say(T.intro, { hold: 900 });
      if (!ctx.alive()) return;

      const r1 = await runQuiz(T.quizA);
      if (!ctx.alive()) return;
      await App.companion.say(r1 ? T.quizRight : T.quizWrongA, { small: true, hold: r1 ? 650 : 1300 });
      if (!ctx.alive()) return;

      const r2 = await runQuiz(T.quizB);
      if (!ctx.alive()) return;
      await App.companion.say(r2 ? T.quizRight : T.quizWrongB, { small: true, hold: r2 ? 650 : 1300 });
      if (!ctx.alive()) return;

      await showRank();
      if (!ctx.alive()) return;

      await showStats();
      if (!ctx.alive()) return;

      await startCloud();
      if (!ctx.alive()) return;

      await morphToY();
      if (!ctx.alive()) return;

      await U.sleep(300);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 2200 });
      if (!ctx.alive()) return;
      ctx.next();
    })();

    self._cleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointerdown', onCanvasDown);
    };
  },

  exit() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    App.companion.reset();
    App.shards.hide();
  }
});