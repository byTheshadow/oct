/* =========================================================
 * Scene 8 · 刮刮卡
 *   白团子："……我准备了一点东西。只能刮开两张哦。"
 *   4 张卡悬浮（☕🍱💻🥟），玩家点选任意 2 张，开始刮。
 *   不管选的是哪两张，刮开后固定露出两份真实奖品：
 *     ①"希望多贴贴 x1"  ②炫少画的对小寒的画（config.SCRATCH_IMG_URL，留空也能跑）
 *   没被选中的另外 2 张自动翻面，显示"这些下次也会兑现"。
 *   两张都刮开后，白团子说一句过渡台词，ctx.next() 进 Scene 9。
 *
 * 不用 three 舞台（config.chapters.scene8 里 stage:false），整章画在 #overlay 的 DOM 里，
 * 刮的效果是每张卡自己的一张 canvas：destination-out 擦涂层，另开一张低分辨率的
 * "覆盖率遮罩" canvas 做累计擦除面积的采样（采样本身节流，不跟手每一帧都算）。
 * 调试：?scene=scene8&debug
 * ========================================================= */
App.director.register('scene8', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene8;
    const self = this;

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const layer = U.el('div', 's8-layer', ov);

    App.companion.show({ corner: 'tl' });
    App.shards.show();

    /* =========================================================
     * 两份真实奖品：固定内容，只是随机落在玩家选中的哪张卡上
     * ========================================================= */
    function buildPrizeSticker(host) {
      U.el('div', 's8-prize-icon', host, '♥');
      U.el('div', 's8-prize-label', host, T.prize1 || '希望多贴贴 x1');
    }
    function buildPrizeDrawing(host) {
      const url = CFG.SCRATCH_IMG_URL;
      if (url) {
        const img = U.el('img', 's8-prize-img', host);
        img.alt = '';
        img.draggable = false;
        img.decoding = 'async';
        img.addEventListener('error', () => {
          img.remove();
          U.el('div', 's8-prize-placeholder', host, '✦');
        }, { once: true });
        img.src = url;
      } else {
        U.el('div', 's8-prize-placeholder', host, '✦');
      }
      if (T.prize2) U.el('div', 's8-prize-caption', host, T.prize2);
    }
    const PRIZES = [buildPrizeSticker, buildPrizeDrawing];

    /* =========================================================
     * 四张卡
     * ========================================================= */
    const ICONS = T.icons || ['☕', '🍱', '💻', '🥟'];
    const cardsWrap = U.el('div', 's8-cards', layer);
    const cards = ICONS.map((icon, i) => {
      const el = U.el('div', 's8-card', cardsWrap);
      el.style.setProperty('--d', (i * 0.42).toFixed(2) + 's');
      const flip = U.el('div', 's8-card-flip', el);
      const face = U.el('div', 's8-card-face', flip);
      U.el('div', 's8-card-icon', face, icon);
      const surface = U.el('div', 's8-card-surface', face);
      const content = U.el('div', 's8-card-content', surface);
      const back = U.el('div', 's8-card-back', flip);
      U.el('div', 's8-card-back-text', back, T.unchosenText || '这些下次也会兑现');
      return { el, face, surface, content, idx: i, picked: false };
    });

    let pickedCount = 0, phaseLocked = false, halfwaySaid = false, scratchedCount = 0;

    cards.forEach((c) => {
      c.el.addEventListener('click', () => {
        if (phaseLocked || !ctx.alive()) return;
        if (c.picked) {
          c.picked = false;
          c.el.classList.remove('picked');
          pickedCount--;
          return;
        }
        if (pickedCount >= 2) return;
        c.picked = true;
        c.el.classList.add('picked');
        pickedCount++;
        A.click(0.14);
        if (pickedCount === 2) {
          phaseLocked = true;
          setTimeout(() => { if (ctx.alive()) startScratchPhase(); }, 420);
        }
      });
    });

    function startScratchPhase() {
      const chosen = cards.filter((c) => c.picked);
      const others = cards.filter((c) => !c.picked);
      const order = Math.random() < 0.5 ? [0, 1] : [1, 0];
      chosen.forEach((c, i) => {
        c.el.classList.add('active');
        PRIZES[order[i]](c.content);
        mountScratch(c);
      });
      others.forEach((c) => c.el.classList.add('flipped'));
      A.whoosh(0.05, 0.5);
    }

    /* =========================================================
     * 单张卡的刮刮层
     * ========================================================= */
    function burstAt(cardEl) {
      const r = cardEl.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const colors = ['#ffd35c', '#ff9ccf', '#6cc4ff', '#b08cff'];
      for (let i = 0; i < 14; i++) {
        const el = U.el('div', 's8-spark', layer);
        const ang = Math.random() * 6.28, dist = 36 + Math.random() * 64;
        el.style.left = cx + 'px';
        el.style.top = cy + 'px';
        el.style.setProperty('--dx', (Math.cos(ang) * dist).toFixed(1) + 'px');
        el.style.setProperty('--dy', (Math.sin(ang) * dist).toFixed(1) + 'px');
        el.style.setProperty('--c', colors[i % colors.length]);
        setTimeout(() => el.remove(), 900);
      }
    }

    function mountScratch(c) {
      const canvas = U.el('canvas', 's8-scratch', c.surface);
      const g = canvas.getContext('2d');
      let w = 0, h = 0, dpr = 1;

      // 低分辨率遮罩：只负责统计累计擦除面积，不负责好看
      const MW = 26, MH = 20;
      const maskCv = document.createElement('canvas');
      maskCv.width = MW; maskCv.height = MH;
      const mg = maskCv.getContext('2d');
      function paintMaskFull() {
        mg.globalCompositeOperation = 'source-over';
        mg.clearRect(0, 0, MW, MH);
        mg.fillStyle = '#fff';
        mg.fillRect(0, 0, MW, MH);
      }

      function paintFoil() {
        const gr = g.createLinearGradient(0, 0, w, h);
        gr.addColorStop(0, '#d7dcee');
        gr.addColorStop(0.5, '#f1f3fa');
        gr.addColorStop(1, '#b7c0d9');
        g.fillStyle = gr;
        g.fillRect(0, 0, w, h);
        g.save();
        g.beginPath(); g.rect(0, 0, w, h); g.clip();
        g.strokeStyle = 'rgba(255,255,255,0.45)';
        g.lineWidth = 3;
        for (let x = -h; x < w; x += 11) {
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h, h); g.stroke();
        }
        g.restore();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = '600 12px "Noto Sans SC", "PingFang SC", system-ui, sans-serif';
        g.fillStyle = 'rgba(60, 50, 80, 0.55)';
        g.fillText(T.scratchHint || '划一划', w / 2, h / 2);
      }

      function layout() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const r = c.surface.getBoundingClientRect();
        w = Math.max(1, r.width);
        h = Math.max(1, r.height);
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        paintFoil();
      }

      let lastX = null, lastY = null, drawing = false, done = false, lastSample = 0, lastRustle = 0;

      function toLocal(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
      }
      function scratchAt(x, y) {
        g.globalCompositeOperation = 'destination-out';
        g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill();
        mg.globalCompositeOperation = 'destination-out';
        mg.beginPath(); mg.arc((x / w) * MW, (y / h) * MH, 3.2, 0, Math.PI * 2); mg.fill();
      }
      function scratchSound() {
        A.blip({ freq: 2400 + Math.random() * 2600, type: 'square', vol: 0.014, dur: 0.02, jitter: 0.6 });
      }
      function strokeTo(x, y) {
        if (lastX == null) {
          scratchAt(x, y);
        } else {
          const dx = x - lastX, dy = y - lastY, dist = Math.hypot(dx, dy);
          const steps = Math.max(1, Math.min(18, Math.floor(dist / 9)));
          for (let i = 1; i <= steps; i++) scratchAt(lastX + (dx * i) / steps, lastY + (dy * i) / steps);
        }
        lastX = x; lastY = y;
        const now = performance.now();
        if (now - lastRustle > 65) { lastRustle = now; scratchSound(); }
      }

      function checkCoverage() {
        const now = performance.now();
        if (now - lastSample < 130) return;
        lastSample = now;
        let d;
        try { d = mg.getImageData(0, 0, MW, MH).data; } catch (e) { return; }
        let clear = 0;
        for (let i = 3; i < d.length; i += 4) if (d[i] < 24) clear++;
        const ratio = clear / (MW * MH);
        if (ratio >= 0.5 && !halfwaySaid) {
          halfwaySaid = true;
          if (ctx.alive()) App.companion.say(T.halfway || '……快好了嘛，别急。', { small: true, hold: 1100 });
        }
        if (ratio >= 0.6 && !done) finish();
      }

      function finish() {
        done = true;
        canvas.classList.add('done');
        setTimeout(() => canvas.remove(), 460);
        A.coin(8);
        burstAt(c.el);
        App.companion.react(scratchedCount === 0 ? 'surprise' : 'happy');
        scratchedCount++;
        if (scratchedCount >= 2) {
          setTimeout(async () => {
            if (!ctx.alive()) return;
            if (T.end) await App.companion.say(T.end, { small: true, hold: 1700 });
            if (!ctx.alive()) return;
            ctx.next();
          }, 950);
        }
      }

      function onDown(e) {
        if (done || !ctx.alive()) return;
        drawing = true; lastX = lastY = null;
        try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
        const p = toLocal(e);
        strokeTo(p.x, p.y);
        checkCoverage();
      }
      function onMove(e) {
        if (!drawing || done || !ctx.alive()) return;
        const p = toLocal(e);
        strokeTo(p.x, p.y);
        checkCoverage();
      }
      function onUp() { drawing = false; lastX = lastY = null; checkCoverage(); }

      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);

      function onResize() { if (!done) layout(); }
      window.addEventListener('resize', onResize);

      requestAnimationFrame(() => { layout(); paintMaskFull(); });

      c._cleanupScratch = () => {
        window.removeEventListener('resize', onResize);
        canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp);
      };
    }

    /* =========================================================
     * 开场
     * ========================================================= */
    (async () => {
      await U.sleep(500);
      if (!ctx.alive()) return;
      await App.companion.say(T.intro, { hold: 1000 });
      if (!ctx.alive()) return;
      requestAnimationFrame(() => cardsWrap.classList.add('on'));
    })();

    self._cleanup = function () {
      cards.forEach((c) => { if (c._cleanupScratch) c._cleanupScratch(); });
    };
  },

  exit() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    App.companion.reset();
    App.shards.hide();
  }
});