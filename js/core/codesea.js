/* =========================================================
 * 代码海洋：Scene 3 / Scene 4 共用的 2D canvas 渲染器。
 * 字符雨、会起浪的字符海面、溅射、漂在海里的彩蛋、字符汇聚成五线谱，
 * 全画在同一张 canvas 上，不用 three.js，不用实时模糊，不用几百个 DOM 节点。
 *
 *   const sea = App.codeSea.create(parentEl);   // 一般是 #overlay（要先 className = 'active'）
 *   sea.start();                                 // 开始画；章节 exit() 里一定要 sea.destroy()
 *
 * 可以直接改的参数（sea.state，每帧都读）：
 *   mix        0..1  青、紫荧光渗入的程度：越大，越多的字符从灰白变成青/紫（逐个渐变，不是整体变色）
 *   rain       0..1  字符雨的强度（0 = 不画）
 *   rainSpeed  倍数  字符雨向上冲的速度（下坠时越大越有"在掉"的感觉）
 *   surface    0..1+ 海面位置，屏幕高度的比例。> 1 表示还在屏幕下面看不见
 *   seaAlpha   0..1  整片海的亮度（五线谱成形后可以压暗当底）
 *   eggFade    0..1  彩蛋整体透明度
 *   shake      px    画面抖动幅度（每帧自己衰减）
 *   pulse      0..1  "鼓点"闪光（beat() 会把它设成 1，自己衰减）
 *
 * 方法：
 *   sea.disturb(x, y, amp)           在 (x, y) 处点一下波浪（屏幕 CSS 像素；y 在海面以上就落在水线上）
 *   sea.disturbLine(x0,y0,x1,y1,amp) 沿线段连点（划屏用）
 *   sea.splash(x, y, power)          溅起一团字符
 *   sea.beat(strength)               一下"鼓点"：闪一下、海面轻轻一震
 *   sea.addEgg(text, { row, x, vx, color, delay })   往海里放一句彩蛋（row = 海面下第几行）
 *   const done = sea.formStaff({ top, gap, left, right, notes, instant })
 *                                    海里的字符升起来，汇聚成五条谱线 + 几个音符，之后缓缓向右流动。
 *                                    返回 Promise，约 97% 的字符到位时 resolve。instant:true = 不演汇聚，一开始就是成形的谱子。
 *   sea.staffRect()                  五线谱的位置 { top, gap, x0, x1 }（Scene 4 用来摆题目）
 *   sea.surfaceAt(x) / sea.slopeAt(x)  某处水线的 y / 坡度（让猫跟着浪起伏）
 *   sea.hooks.pre / mid / post       每帧回调：pre(dt, t)；mid(g, dt, t)（在海和彩蛋之上、五线谱之下画东西）；post(g, dt, t)
 *   sea.canvas / sea.W / sea.H       画布、CSS 像素尺寸
 *
 * 全部坐标都是 CSS 像素，内部按 devicePixelRatio（最多 2）缩放。
 * 掉帧时会自动降级一档（字符雨隔列画、海面隔行隔列画、溅射减半）。
 * ========================================================= */
App.codeSea = (function () {
  const U = App.util;
  const CHARS = '01234567890123456789abcdefghijklmnopqrstuvwxyz{}[]()<>=+-*/;:.,_&|!?#%$~^猫寒坏揉捏天才';
  const NCH = CHARS.length;
  const NOTE_CHARS = ['♪', '♩', '♫', '♬'];
  const FONT = 'ui-monospace, Menlo, Consolas, "Noto Sans Mono", "Noto Sans SC", "PingFang SC", monospace';
  const clamp = U.clamp;

  // 稳定的伪随机：同一个 (a, b) 永远得到同一个 0..1 的数
  function rnd(a, b) {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  function create(parent) {
    const pal = App.config.palettes.sea;
    const cvs = U.el('canvas', 'code-sea', parent);
    const g = cvs.getContext('2d');

    const S = {
      mix: 0.1, rain: 1, rainSpeed: 1, surface: 1.3, seaAlpha: 1,
      eggFade: 1, shake: 0, pulse: 0, lowQ: false
    };
    const hooks = {};

    let W = 0, H = 0, dpr = 1, cw = 9, ch = 16, AMP = 8;
    let atlas = null, glowCyan = null, glowPurple = null;
    let noteSprites = [];
    let streams = [];
    let sCols = 0, sRows = 0, sw = 9, sh = 16;
    let hh = null, hv = null, cellIdx = null, cellR = null, cellR2 = null, cellSkip = null;
    const parts = [];
    const eggs = [];
    let staff = null;
    let raf = 0, last = 0, t = 0, acc = 0, running = false, destroyed = false;
    const perf = { sum: 0, n: 0, done: false };

    // ---------- 布局 ----------
    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = parent.clientWidth || window.innerWidth;
      H = parent.clientHeight || window.innerHeight;
      cvs.width = Math.round(W * dpr);
      cvs.height = Math.round(H * dpr);
      const u = clamp(W / 390, 0.85, 1.5);
      cw = 9 * u;
      ch = 16 * u;
      AMP = 8 * u;
      buildAtlas();
      buildGlows();
      buildNotes();

      // 字符雨：每列一条
      const cols = Math.ceil(W / cw) + 1;
      streams = [];
      for (let c = 0; c < cols; c++) streams.push(newStream(c, true));

      // 海：一块比字符稍稀的网格，每格一个"水位"
      sCols = Math.max(8, Math.round(W / (cw * 1.25)));
      sw = W / sCols;
      sh = ch * 1.05;
      sRows = Math.ceil((H * 0.66) / sh) + 2;
      const n = sCols * sRows;
      hh = new Float32Array(n);
      hv = new Float32Array(n);
      cellIdx = new Uint8Array(n);
      cellR = new Float32Array(n);
      cellR2 = new Float32Array(n);
      cellSkip = new Uint8Array(n);
      for (let r = 0; r < sRows; r++) {
        for (let c = 0; c < sCols; c++) {
          const i = r * sCols + c;
          cellIdx[i] = Math.floor(rnd(c * 3 + 1, r * 5 + 2) * NCH);
          cellR[i] = rnd(c + 200, r + 31);
          cellR2[i] = rnd(c + 900, r + 57);
          cellSkip[i] = rnd(c + 77, r + 13) < 0.32 ? 1 : 0;     // 一部分格子平时是空的，浪经过时才亮出来
        }
      }
    }

    // 字符图集：每个字符 × 4 种颜色（灰白 / 青 / 紫 / 白），之后全靠 drawImage 贴
    function buildAtlas() {
      const gwd = Math.ceil(cw * dpr), ghd = Math.ceil(ch * dpr);
      const a = document.createElement('canvas');
      a.width = NCH * gwd;
      a.height = 4 * ghd;
      const ag = a.getContext('2d');
      ag.textAlign = 'center';
      ag.textBaseline = 'middle';
      ag.font = `bold ${Math.round(ch * dpr * 0.86)}px ${FONT}`;
      const colors = [pal.gray, pal.cyan, pal.purple, pal.white];
      for (let ci = 0; ci < 4; ci++) {
        ag.fillStyle = colors[ci];
        for (let i = 0; i < NCH; i++) ag.fillText(CHARS[i], i * gwd + gwd / 2, ci * ghd + ghd / 2, gwd * 1.1);
      }
      atlas = { cvs: a, gwd, ghd };
    }

    function makeGlow(color) {
      const s = 96;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const rgb = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)];
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, `rgba(${rgb},1)`);
      gr.addColorStop(0.35, `rgba(${rgb},0.35)`);
      gr.addColorStop(1, `rgba(${rgb},0)`);
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return c;
    }
    function buildGlows() {
      glowCyan = makeGlow(pal.glowCyan);
      glowPurple = makeGlow(pal.glowPurple);
    }

    // 音符：预渲染成带光晕的小图（♪ ♩ ♫ ♬ × 青 / 紫 / 白）
    function buildNotes() {
      const size = Math.round(ch * 2.1);
      noteSprites = [];
      const colors = [pal.cyan, pal.purple, pal.white];
      for (let k = 0; k < NOTE_CHARS.length; k++) {
        noteSprites[k] = colors.map((col) => {
          const c = document.createElement('canvas');
          c.width = c.height = Math.ceil(size * dpr);
          const x = c.getContext('2d');
          x.scale(dpr, dpr);
          x.textAlign = 'center';
          x.textBaseline = 'middle';
          x.font = `bold ${Math.round(size * 0.78)}px "Segoe UI Symbol", "Noto Sans Symbols", "Noto Sans SC", system-ui, sans-serif`;
          x.shadowColor = col;
          x.shadowBlur = 9;
          x.fillStyle = col;
          x.fillText(NOTE_CHARS[k], size / 2, size / 2 + 1);
          x.shadowBlur = 0;
          x.globalAlpha = 0.55;
          x.fillStyle = '#ffffff';
          x.fillText(NOTE_CHARS[k], size / 2, size / 2 + 1);
          c.cssSize = size;
          return c;
        });
      }
    }

    // ---------- 字符 ----------
    function gl(idx, ci, x, y, a) {
      if (a <= 0.012) return;
      g.globalAlpha = a > 1 ? 1 : a;
      g.drawImage(atlas.cvs, idx * atlas.gwd, ci * atlas.ghd, atlas.gwd, atlas.ghd, x, y, cw, ch);
    }
    // 带"渗入"的字符：r 小于 mix 的字符变成青/紫，r 越接近 mix 越是半透明地过渡
    function tg(idx, r, r2, x, y, a, mixv) {
      const f = clamp((mixv - r) / 0.14, 0, 1);
      if (f <= 0) gl(idx, 0, x, y, a);
      else if (f >= 1) gl(idx, r2 < 0.5 ? 1 : 2, x, y, a);
      else { gl(idx, 0, x, y, a * (1 - f)); gl(idx, r2 < 0.5 ? 1 : 2, x, y, a * f); }
    }

    // ---------- 字符雨 ----------
    function newStream(c, init) {
      const far = Math.random() < 0.45;
      const len = 7 + Math.floor(Math.random() * 14);
      const s = {
        c, far, len,
        v: far ? 110 + Math.random() * 110 : 220 + Math.random() * 260,
        y: init ? Math.random() * (H + len * ch) - len * ch * 0.3 : H + Math.random() * H * 0.6 + 10,
        seed: Math.floor(Math.random() * 100000),
        r: new Float32Array(len), r2: new Float32Array(len)
      };
      for (let k = 0; k < len; k++) { s.r[k] = Math.random(); s.r2[k] = Math.random(); }
      return s;
    }

    function drawRain(dt) {
      if (S.rain < 0.02) return;
      const step = S.lowQ ? 2 : 1;
      for (let i = 0; i < streams.length; i += step) {
        let s = streams[i];
        s.y -= s.v * S.rainSpeed * dt;
        if (s.y + s.len * ch < -ch) { s = streams[i] = newStream(s.c, false); }
        const x = s.c * cw;
        const base = (s.far ? 0.42 : 0.92) * S.rain;
        for (let k = 0; k < s.len; k++) {
          const y = s.y + k * ch;
          if (y < -ch || y > H) continue;
          const a = base * Math.pow(1 - k / s.len, 1.7);
          const idx = (s.seed + k * 13 + (k % 4 === 0 ? (t * 4) | 0 : 0)) % NCH;
          if (k === 0) gl(idx, 3, x, y, base);                // 雨头是亮白的
          else tg(idx, s.r[k], s.r2[k], x, y, a, S.mix);
        }
      }
      g.globalAlpha = 1;
    }

    // ---------- 海 ----------
    function stepWave() {
      const C = sCols, R = sRows;
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const i = r * C + c, h = hh[i];
          const l = c > 0 ? hh[i - 1] : h, rt = c < C - 1 ? hh[i + 1] : h;
          const u = r > 0 ? hh[i - C] : h, d = r < R - 1 ? hh[i + C] : h;
          hv[i] = (hv[i] + (l + rt + u + d - 4 * h) * 0.22) * 0.985;
        }
      }
      for (let i = 0; i < hh.length; i++) hh[i] = clamp(hh[i] + hv[i], -3, 3);
    }

    function disturb(x, y, amp) {
      if (!hh) return;
      const sy = S.surface * H;
      const c0 = Math.round(x / sw), r0 = Math.max(0, Math.round((y - sy) / sh));
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const c = c0 + dc, r = r0 + dr;
          if (c < 0 || c >= sCols || r < 0 || r >= sRows) continue;
          hh[r * sCols + c] += amp * Math.exp(-(dc * dc + dr * dr) / 1.5);
        }
      }
    }
    function disturbLine(x0, y0, x1, y1, amp) {
      const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (sw * 0.8)));
      for (let i = 1; i <= n; i++) disturb(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, amp / Math.sqrt(n));
    }

    const colAt = (x) => clamp(Math.round(x / sw), 0, sCols - 1);
    const surfaceAt = (x) => (hh ? S.surface * H + hh[colAt(x)] * AMP : S.surface * H);
    const slopeAt = (x) => {
      if (!hh) return 0;
      const c = colAt(x);
      return hh[Math.min(sCols - 1, c + 1)] - hh[Math.max(0, c - 1)];
    };
    const hAt = (x, row) => (hh ? hh[clamp(row, 0, sRows - 1) * sCols + colAt(x)] : 0);

    function drawSea() {
      const sy = S.surface * H;
      if (sy > H + 24) return;
      const m = S.mix, sa = S.seaAlpha;

      // 水体
      const gr = g.createLinearGradient(0, sy, 0, H);
      gr.addColorStop(0, `rgba(47,216,208,${((0.07 + 0.13 * m) * sa).toFixed(3)})`);
      gr.addColorStop(1, `rgba(90,60,190,${((0.15 + 0.22 * m) * sa).toFixed(3)})`);
      g.globalAlpha = 1;
      g.fillStyle = gr;
      g.fillRect(0, sy, W, H - sy);

      // 水线：一条发光的曲线
      g.beginPath();
      for (let c = 0; c < sCols; c++) {
        const x = c * sw + sw / 2, y = sy + hh[c] * AMP;
        if (c === 0) g.moveTo(0, y); else g.lineTo(x, y);
      }
      g.lineTo(W, sy + hh[sCols - 1] * AMP);
      g.lineJoin = 'round';
      g.strokeStyle = `rgba(86,240,224,${(0.13 * sa).toFixed(3)})`;
      g.lineWidth = 6;
      g.stroke();
      g.strokeStyle = `rgba(190,255,248,${(0.6 * sa).toFixed(3)})`;
      g.lineWidth = 1.5;
      g.stroke();

      // 字符
      const cs = S.lowQ ? 2 : 1;
      for (let r = 0; r < sRows; r++) {
        const y0 = sy + r * sh;
        if (y0 > H) break;
        if (S.lowQ && r > 0 && (r & 1)) continue;
        const depth = Math.exp(-r * 0.085);
        for (let c = 0; c < sCols; c += cs) {
          const i = r * sCols + c, h = hh[i];
          if (cellSkip[i] && r > 0 && Math.abs(h) < 0.16) continue;
          const y = y0 + h * AMP, x = c * sw + h * 3;
          let idx = cellIdx[i];
          if ((c + r) % 5 === 0) idx = (idx + ((t * 2) | 0)) % NCH;      // 少数字符慢慢闪
          let a = (0.07 + 0.38 * depth) * sa;
          if (h < 0) a *= 1 + h * 0.5;
          a = Math.min(1, a + Math.min(1, Math.abs(h) * 1.4) * 0.55 * sa);
          if (r === 0) { gl(idx, 1, x, y - ch * 0.5, Math.min(1, 0.85 * sa)); continue; }
          tg(idx, cellR[i], cellR2[i], x, y, a, m);
          if (h > 0.35) gl(idx, 3, x, y, Math.min(1, (h - 0.3) * 1.3) * sa);   // 浪尖发白
        }
      }
      g.globalAlpha = 1;
    }

    // ---------- 溅射 ----------
    function splash(x, y, power = 1) {
      const n = Math.round(46 * power * (S.lowQ ? 0.6 : 1));
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
        const sp = 140 + Math.random() * 420 * power;
        parts.push({
          x: x + (Math.random() - 0.5) * 60, y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          idx: Math.floor(Math.random() * NCH), life: 0, max: 0.9 + Math.random() * 0.8,
          ci: Math.random() < 0.5 ? 1 : 3
        });
      }
    }
    function drawParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life += dt;
        if (p.life >= p.max) { parts.splice(i, 1); continue; }
        p.vy += 900 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        gl(p.idx, p.ci, p.x, p.y, 1 - p.life / p.max);
      }
      g.globalAlpha = 1;
    }

    // ---------- 彩蛋：漂在海里的代码 ----------
    function textSprite(text, color) {
      const fpx = Math.round(ch * 0.95);
      const font = `${fpx}px ${FONT}`;
      const m = document.createElement('canvas').getContext('2d');
      m.font = font;
      const pad = 12, tw = Math.ceil(m.measureText(text).width) + pad * 2 + 6, th = fpx + 16;
      const c = document.createElement('canvas');
      c.width = Math.ceil(tw * dpr);
      c.height = Math.ceil(th * dpr);
      const x = c.getContext('2d');
      x.scale(dpr, dpr);
      // 深色底板：四角各缺一个像素，和对话框 / Scene 2 的代码彩蛋同一种切角
      const n = 3;
      x.fillStyle = 'rgba(6,8,16,0.9)';
      x.fillRect(n, 0, tw - n * 2, th);
      x.fillRect(0, n, tw, th - n * 2);
      x.fillStyle = color;                            // 左边一条色带，像代码编辑器里的行标
      x.globalAlpha = 0.85;
      x.fillRect(0, n, 3, th - n * 2);
      x.globalAlpha = 1;
      x.font = font;
      x.textBaseline = 'middle';
      x.shadowColor = color;
      x.shadowBlur = 6;
      x.fillStyle = color;
      x.fillText(text, pad + 3, th / 2 + 1);
      x.shadowBlur = 0;
      x.globalAlpha = 0.55;
      x.fillStyle = '#ffffff';
      x.fillText(text, pad + 3, th / 2 + 1);
      c.cw = tw; c.chh = th;
      return c;
    }

    function addEgg(text, o = {}) {
      const color = o.color || pal.cyan;
      const spr = textSprite(text, color);
      const vx = o.vx != null ? o.vx : (Math.random() < 0.5 ? -1 : 1) * (9 + Math.random() * 8);
      eggs.push({
        spr, vx, row: o.row != null ? o.row : 4,
        x: o.x != null ? o.x : Math.random() * Math.max(10, W - spr.cw),
        delay: o.delay || 0, age: 0, phase: Math.random() * 6.28
      });
    }

    function drawEggs(dt) {
      if (S.eggFade < 0.01 || !eggs.length) return;
      const sy = S.surface * H;
      for (const e of eggs) {
        e.age += dt;
        e.x += e.vx * dt;
        if (e.vx > 0 && e.x > W + 20) e.x = -e.spr.cw - 20;
        if (e.vx < 0 && e.x < -e.spr.cw - 20) e.x = W + 20;
        const ain = clamp((e.age - e.delay) / 1.2, 0, 1);
        if (ain <= 0) continue;
        const cx = e.x + e.spr.cw / 2;
        const y = sy + (e.row + 0.5) * sh + hAt(cx, e.row) * AMP * 0.9 - e.spr.chh / 2;
        const a = ain * S.eggFade * (0.62 + 0.38 * Math.sin(t * 1.3 + e.phase)) * S.seaAlpha;
        g.globalAlpha = Math.min(1, a + Math.abs(hAt(cx, e.row)) * 0.3);
        g.drawImage(e.spr, e.x, y, e.spr.cw, e.spr.chh);
      }
      g.globalAlpha = 1;
    }

    // ---------- 五线谱 ----------
    function formStaff(o = {}) {
      const top = o.top != null ? o.top : H * 0.3;
      const gap = o.gap != null ? o.gap : Math.max(24, Math.round(H * 0.045));
      const x0 = o.left != null ? o.left : W * 0.06;
      const x1 = o.right != null ? o.right : W * 0.94;
      const L = x1 - x0;
      const stepX = cw * 1.5;
      const per = Math.max(8, Math.floor(L / stepX));
      const spread = o.spread != null ? o.spread : 1.2;
      const inst = !!o.instant;                       // instant：直接是成形的样子（Scene 4 一开场就要有谱子）
      const sy = Math.min(H * 0.95, Math.max(S.surface * H, H * 0.4));
      const st = {
        top, gap, x0, x1, L, stepX, time: 0, flow: 0,
        flowSpeed: o.flow != null ? o.flow : 20,
        ps: [], notes: [], form: 0, done: false, resolve: null
      };
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < per; j++) {
          st.ps.push({
            line: i, hx: j * stepX + (i % 2) * stepX * 0.5,
            idx: Math.floor(Math.random() * NCH), r: Math.random(), r2: Math.random() * 0.7,
            sx: Math.random() * W, sy: sy + Math.random() * (H - sy),
            delay: inst ? -5 : Math.random() * spread, dur: inst ? 0.01 : 0.9 + Math.random() * 0.9
          });
        }
      }
      const nn = o.notes != null ? o.notes : 9;
      for (let k = 0; k < nn; k++) {
        st.notes.push({
          g: k % NOTE_CHARS.length, c: k % 3,
          hx: (k + Math.random() * 0.8) * (L / nn), half: Math.floor(Math.random() * 9),
          sx: Math.random() * W, sy: sy + Math.random() * (H - sy),
          delay: inst ? -5 : 0.3 + Math.random() * (spread + 0.6), dur: inst ? 0.01 : 1.1 + Math.random() * 0.9,
          phase: Math.random() * 6.28
        });
      }
      staff = st;
      return new Promise((res) => { st.resolve = res; });
    }

    const inOut = U.ease.inOutCubic;

    function drawStaff(dt) {
      const st = staff;
      if (!st) return;
      st.time += dt;
      st.flow += st.flowSpeed * dt;
      const mixv = Math.max(S.mix, 0.65);

      // 谱线本身：一条很淡的细线，字符沿着它排
      g.globalAlpha = (0.26 + 0.2 * S.pulse) * st.form;
      g.fillStyle = pal.cyan;
      for (let i = 0; i < 5; i++) g.fillRect(st.x0, st.top + i * st.gap, st.L, 1);

      let arrived = 0;
      const edgeW = st.L * 0.08;
      for (const p of st.ps) {
        const e = clamp((st.time - p.delay) / p.dur, 0, 1);
        if (e <= 0) continue;
        const k = inOut(e);
        const xr = (((p.hx + st.flow) % st.L) + st.L) % st.L;
        const tx = st.x0 + xr, ty = st.top + p.line * st.gap - ch * 0.5;
        const x = p.sx + (tx - p.sx) * k, y = p.sy + (ty - p.sy) * k - Math.sin(Math.PI * k) * 40;
        let a = Math.min(1, e * 6) * (0.72 + 0.28 * S.pulse);
        if (e >= 1) {
          arrived++;
          a *= Math.min(1, xr / edgeW, (st.L - xr) / edgeW);        // 两头淡出，字符绕回来时不会"啪"地弹出
        }
        tg(p.idx, p.r, p.r2, x, y, a, mixv);
      }

      // 音符
      for (const n of st.notes) {
        const e = clamp((st.time - n.delay) / n.dur, 0, 1);
        if (e <= 0) continue;
        const k = inOut(e);
        const xr = (((n.hx + st.flow * 1.5) % st.L) + st.L) % st.L;
        const tx = st.x0 + xr;
        const ty = st.top + 4 * st.gap - n.half * st.gap / 2 + Math.sin(t * 2 + n.phase) * 3;
        const x = n.sx + (tx - n.sx) * k, y = n.sy + (ty - n.sy) * k - Math.sin(Math.PI * k) * 50;
        let a = Math.min(1, e * 5);
        if (e >= 1) a *= Math.min(1, xr / edgeW, (st.L - xr) / edgeW);
        const spr = noteSprites[n.g][n.c];
        const sz = spr.cssSize * (1 + 0.3 * S.pulse);
        g.globalAlpha = a;
        g.drawImage(spr, x - sz / 2, y - sz / 2, sz, sz);
      }
      g.globalAlpha = 1;

      st.form += ((arrived / st.ps.length) - st.form) * Math.min(1, dt * 4);
      if (!st.done && arrived >= st.ps.length * 0.97) {
        st.done = true;
        st.resolve && st.resolve();
      }
    }

    // ---------- 背景 ----------
    function blob(img, cx, cy, r, a) {
      g.globalAlpha = a;
      g.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    }
    function drawBg() {
      g.globalAlpha = 1;
      g.fillStyle = pal.bg;
      g.fillRect(-20, -20, W + 40, H + 40);
      const m = S.mix;
      blob(glowCyan, W * 0.82 + Math.sin(t * 0.21) * 22, H * 0.22, W * 0.75, 0.08 + 0.2 * m);
      blob(glowPurple, W * 0.15 + Math.cos(t * 0.17) * 26, H * 0.8, W * 0.9, 0.09 + 0.24 * m);
      g.globalAlpha = 1;
    }

    // ---------- 主循环 ----------
    function frame(now) {
      if (destroyed) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000;
      last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;

      // 简易性能探测：第 1.2 秒起统计 60 帧，平均帧间隔超过 26ms（< 约 38fps）就降级
      if (!perf.done && t > 1.2) {
        perf.sum += dt; perf.n++;
        if (perf.n >= 60) {
          perf.done = true;
          if (perf.sum / perf.n > 0.026) S.lowQ = true;
        }
      }

      S.pulse *= Math.exp(-dt * 5);
      S.shake *= Math.exp(-dt * 7);
      if (hooks.pre) hooks.pre(dt, t);

      acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n < 3) { stepWave(); acc -= 1 / 60; n++; }
      if (acc > 0.1) acc = 0;

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (S.shake > 0.2) g.translate((Math.random() - 0.5) * S.shake, (Math.random() - 0.5) * S.shake);

      drawBg();
      drawRain(dt);
      drawSea();
      drawEggs(dt);
      drawParts(dt);
      g.globalAlpha = 1;
      if (hooks.mid) hooks.mid(g, dt, t);
      drawStaff(dt);
      g.globalAlpha = 1;
      if (hooks.post) hooks.post(g, dt, t);
    }

    function start() {
      if (running || destroyed) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    function destroy() {
      destroyed = true;
      stop();
      window.removeEventListener('resize', onResize);
      if (cvs.parentNode) cvs.parentNode.removeChild(cvs);
    }
    function onResize() { layout(); }
    window.addEventListener('resize', onResize);

    layout();

    function beat(strength = 1) {
      S.pulse = 1;
      S.shake = Math.max(S.shake, 1.5 * strength);
      disturb(W * (0.25 + Math.random() * 0.5), S.surface * H + sh, 0.5 * strength);
    }

    return {
      canvas: cvs, state: S, hooks,
      get W() { return W; }, get H() { return H; }, get dpr() { return dpr; },
      get cell() { return { w: cw, h: ch }; },
      start, stop, destroy,
      disturb, disturbLine, splash, beat, addEgg, formStaff,
      surfaceAt, slopeAt,
      staffRect: () => (staff ? { top: staff.top, gap: staff.gap, x0: staff.x0, x1: staff.x1 } : null)
    };
  }

  return { create };
})();