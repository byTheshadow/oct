/* =========================================================
 * Scene 9 · Outro
 *   五块碎片归位：唱针落下，App.shards.fillCorner() 把唱片补全。
 *   这一刻：有 App.audio.crossToRealBgm 就调一下（切到完全清晰、真正开始播放橘子海），
 *   没有就退一步用 setClarity(1, 2.5) 顶一下。
 *   两只小猫起身，并肩走向代码海洋；字符海逐渐褪去，换成真正的海浪 / 泡沫 / 月光碎鳞。
 *   背后暗线彩蛋：白团子和猛兽的两道影子慢慢挪到一起，叠成一个轮廓。
 *   结尾："Side B —— 未完待续"，保存截图 + 从头再来。
 *
 * 不用 three 舞台（config.chapters.scene9 里 stage:false）。背景复用 Scene 3 那套
 * core/codesea.js 的 2D canvas（字符海），用它的 hooks.post 在同一张画布上叠"真实海洋"
 * 的渐变/泡沫/反光，以及两只猫和两道影子——这样保存截图时画的全是本地生成的内容，
 * 没有任何外链图片，不会遇到 Scene 7/8 那种跨域画布污染问题。
 * 调试：?scene=scene9&debug
 * ========================================================= */
App.director.register('scene9', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene9;
    const self = this;

    const ov = document.getElementById('overlay');
    ov.className = 'active';

    const sea = App.codeSea.create(ov);
    sea.start();
    sea.state.mix = 0.82;
    sea.state.rain = 0.5;
    sea.state.surface = 0.64;
    sea.state.seaAlpha = 1;

    const layer = U.el('div', 's9-layer', ov);

    App.companion.show({ corner: 'tl' });
    App.shards.show();

    /* =========================================================
     * 两只猫 + 两道影子的像素素材
     * ========================================================= */
    const CAT_SCALE = U.clamp(Math.round((sea.W || 390) / 130), 2, 4);
    const xh = App.sprites.cat('xiaohan', CAT_SCALE);
    const bt = App.sprites.cat('baituanzi', CAT_SCALE);

    function silhouette(src) {
      const c = document.createElement('canvas');
      c.width = src.width; c.height = src.height;
      const g = c.getContext('2d');
      g.drawImage(src, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = 'rgba(10, 8, 20, 0.9)';
      g.fillRect(0, 0, c.width, c.height);
      return c;
    }
    const btShadow = silhouette(bt.sit);
    const beastShadow = silhouette(App.sprites.set('beast', Math.max(2, Math.round(CAT_SCALE * 0.78))).sit);

    /* =========================================================
     * 叠在字符海之上：真实海洋 + 影子彩蛋 + 两只猫
     * ========================================================= */
    let realOcean = 0;     // 0..1：代码海 → 真实海
    let walkT = -1;        // <0 还没起步；0..1 走向海边的进度
    let shadowT = 0;       // 0..1：两道影子合一的进度

    function drawOverlay(g, dt, t) {
      const W = sea.W, H = sea.H;
      const sy = sea.state.surface * H;

      if (realOcean > 0.01) {
        g.save();
        g.globalAlpha = realOcean;
        const grad = g.createLinearGradient(0, sy, 0, H);
        grad.addColorStop(0, 'rgba(96, 206, 214, 0.5)');
        grad.addColorStop(1, 'rgba(8, 26, 64, 0.94)');
        g.fillStyle = grad;
        g.fillRect(0, sy, W, H - sy);

        g.strokeStyle = 'rgba(255,255,255,0.5)';
        g.lineWidth = 2;
        g.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = sy + Math.sin(x * 0.045 + t * 1.5) * 3 + Math.sin(x * 0.012 - t * 0.6) * 5;
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
        }
        g.stroke();

        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 44; i++) {
          const fx = (i * 71 + 13) % W;
          const fy = sy + ((i * 37 + 9) % Math.max(1, H - sy));
          const a = 0.14 + 0.24 * Math.max(0, Math.sin(t * 1.3 + i));
          g.globalAlpha = realOcean * a;
          g.fillStyle = '#eafcff';
          g.beginPath(); g.arc(fx, fy, 1.4, 0, Math.PI * 2); g.fill();
        }
        g.restore();
      }

      if (shadowT > 0.001) {
        const baseY = H * 0.18;
        const span = W * 0.14 * (1 - shadowT);
        const cx = W * 0.5;
        g.save();
        g.globalAlpha = 0.46 * Math.min(1, shadowT * 2.2);
        g.drawImage(btShadow, cx - span - btShadow.width / 2, baseY, btShadow.width, btShadow.height);
        g.globalAlpha = 0.36 * Math.min(1, shadowT * 2.2);
        g.drawImage(beastShadow, cx + span - beastShadow.width / 2, baseY - 5, beastShadow.width, beastShadow.height);
        g.restore();
      }

      if (walkT >= 0) {
        const e = U.clamp(walkT, 0, 1);
        const k = U.ease.inOutCubic(e);
        const x0 = W * 0.42, x1 = W * 0.5;
        const fx = U.lerp(x0, x1, k);
        const y = sy - 12;
        const bob = Math.sin(t * 7) * 2.2 * (1 - e * 0.4);
        const step = Math.floor(t * 6);
        const xhFrame = step % 2 === 0 ? xh.sit : xh.tail;
        const btFrame = (step + 1) % 2 === 0 ? bt.sit : bt.tail;
        g.drawImage(xhFrame, fx - xhFrame.width - 2, y - xhFrame.height + bob, xhFrame.width, xhFrame.height);
        g.drawImage(btFrame, fx + 2, y - btFrame.height + bob, btFrame.width, btFrame.height);
      }
    }
    sea.hooks.post = drawOverlay;

    /* =========================================================
     * 碎片归位：唱针落下 + 唱片补全
     * ========================================================= */
    async function completeRecord() {
      const center = App.shards.center();
      const needle = U.el('div', 's9-needle', layer);
      needle.style.left = (center.x - 5) + 'px';
      needle.style.top = (center.y - 44) + 'px';
      requestAnimationFrame(() => needle.classList.add('on'));
      A.whoosh(0.04, 0.4);
      await U.sleep(280);
      if (!ctx.alive()) return;
      needle.classList.add('drop');
      A.click(0.18);
      await App.shards.fillCorner();
      if (!ctx.alive()) return;
      A.coin(9); A.coin(10 % 11);
      needle.classList.remove('on');
      setTimeout(() => needle.remove(), 650);
    }

    /* =========================================================
     * 保存截图：只截这张本地生成的 canvas，没有外链图，不会遇到跨域画布污染
     * ========================================================= */
    function saveShot() {
      try {
        sea.canvas.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = '一个月_满月留影.png';
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 4000);
        }, 'image/png');
      } catch (e) {
        console.warn('[scene9] 截图失败', e);
      }
    }

    function showEndCard() {
      const card = U.el('div', 'end-card s9-end', layer);
      U.el('div', 's9-sideb', card, T.sideB || 'Side B —— 未完待续');
      const row = U.el('div', 's9-end-row', card);
      const shotBtn = U.el('button', 'px-btn', row, T.shot || '保存截图');
      shotBtn.type = 'button';
      shotBtn.addEventListener('click', () => { A.click(0.16); saveShot(); });
      const replayBtn = U.el('button', 'px-btn', row, T.replay || '从头再来');
      replayBtn.type = 'button';
      replayBtn.addEventListener('click', () => { A.click(0.16); App.director.go(CFG.flow[0]); });
      requestAnimationFrame(() => card.classList.add('on'));
    }

    /* =========================================================
     * 时间线
     * ========================================================= */
    (async () => {
      await U.sleep(650);
      if (!ctx.alive()) return;
      if (T.intro) await App.companion.say(T.intro, { hold: 1000 });
      if (!ctx.alive()) return;

      await completeRecord();
      if (!ctx.alive()) return;

      // crossToRealBgm 只负责合成 BGM → 文件 BGM 的交叉淡化，不改 clarity，
      // "完全清晰"这一下要自己补上
      if (App.audio.crossToRealBgm) App.audio.crossToRealBgm(4.5);
      A.setClarity(1, 4.5);

      if (T.record) await App.companion.say(T.record, { small: true, hold: 1600 });
      if (!ctx.alive()) return;

      walkT = 0;
      await U.tween(2600, (e) => {
        walkT = e;
        realOcean = Math.min(1, e * 1.15);
        shadowT = e;
      }, U.ease.inOutCubic);
      if (!ctx.alive()) return;

      await U.tween(1700, (e) => {
        sea.state.rain = 0.5 * (1 - e);
        sea.state.seaAlpha = Math.max(0.1, 1 - e * 0.9);
        sea.state.mix = Math.max(0.28, 0.82 - e * 0.5);
      }, U.ease.outQuad);
      if (!ctx.alive()) return;

      if (T.cats) await App.companion.say(T.cats, { small: true, hold: 1700 });
      if (!ctx.alive()) return;

      await U.sleep(350);
      if (!ctx.alive()) return;
      if (T.end) await App.companion.say(T.end, { small: true, hold: 1900 });
      if (!ctx.alive()) return;

      showEndCard();
    })();

    self._cleanup = function () { sea.destroy(); };
  },

  exit() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    App.companion.reset();
    App.shards.hide();
  }
});