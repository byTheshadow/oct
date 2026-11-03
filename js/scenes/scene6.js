/* =========================================================
 * Scene 6 · 飞行棋（2.5D 纸艺棋盘 · 亲手玩版）
 *   白团子："……接下来，要靠骰子啦。"
 *   等距视角的 6×6 蛇形棋盘：33 个纸片格 = 10月1日 到 11月2日（Scene 5 滚轮能填的整个范围）。
 *   有故事的日子标 ♪，小寒自己填的那天（App.state.userDay）金色描边 + 红心。
 *
 *   这一章从"看动画"改成"亲手玩"，每一步都由手指驱动，放着不动也会自己往下走：
 *   1. 骰子：按住蓄力，松手掷出（点数其实固定是 6，连点骰子白团子会吐槽）
 *   2. 折纸：手指拖动纸张，折多少由手指决定，共四折，折成纸飞机
 *   3. 飞行：按住加速，拖动转向，沿途接住音符
 *   4. 打卡：在屏幕上来回划，10月8日–10月28日 的 21 格依次亮起
 *   5. 翻看：点棋盘上任意一天看那天的内容，点"继续"才进入下一章
 *
 * 不用 three 舞台（config.chapters.scene6 里 stage:false），整章一张 2D canvas + 少量 DOM。
 *
 * 折纸和飞行共用同一套"纸片"渲染：每个纸片是原纸张上的一块多边形，
 * 折叠 / 抬翅 / 转向 / 飞行都只是对它的 3D 嵌入做不同的投影，
 * 所以纸张的纹理从折叠一直连到飞行，中间没有任何切换。
 * 调试：?scene=scene6&debug
 * ========================================================= */
App.director.register('scene6', {
  enter(ctx) {
    const U = App.util, A = App.audio, CFG = App.config;
    const T = CFG.text.scene6;
    const BD = T.board;
    const PAL = CFG.palettes.board;
    const GLOWS = PAL.glows;
    const self = this;
    const clamp = U.clamp, lerp = U.lerp;
    const FONT = '"Noto Sans SC", "PingFang SC", system-ui, sans-serif';
    const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

    // 文案兜底：config 里没写这些 key 也能跑
    const TX = {
      dieHint: T.dieHint || '按住骰子蓄力，松手掷出',
      folds: T.foldHints || ['向左拖，把信纸对折', '向下拖，把两个角折向中线', '向下拖，两边再折一次', '向上拨，抬起翅膀'],
      flyHint: T.flyHint || '按住加速，拖动转向，接住音符',
      allNotes: T.allNotes || '音符全接住了！',
      lightHint: T.lightHint || '在屏幕上来回划，点亮这些日子',
      exploreHint: T.exploreHint || '点一点格子，看看那一天',
      emptyDay: T.emptyDay || '这一天还没有故事',
      checkedDay: T.checkedDay || '这一天打过卡',
      next: T.next || '继续'
    };

    const ov = document.getElementById('overlay');
    ov.className = 'active';
    const canvas = U.el('canvas', 's6-canvas', ov);
    const g = canvas.getContext('2d');
    const layer = U.el('div', 's6-layer', ov);

    let W = 0, H = 0, dpr = 1;

    // ---------- 颜色小工具 ----------
    const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const rgb = (c, a) => (a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`);
    const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
    const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return d; };

    // ---------- 日期 <-> 格子下标 ----------
    const DAYS = BD.days;
    const COLS = BD.cols || 6;
    const ROWS = Math.ceil(DAYS / COLS);
    function dateIndex(m, d) {
      return (m === BD.first.m) ? d - BD.first.d : (31 - BD.first.d + 1) + (d - 1);
    }
    function indexDate(i) {
      let m = BD.first.m, d = BD.first.d + i;
      if (d > 31) { m += 1; d -= 31; }
      return { m, d };
    }
    const checkFrom = dateIndex(BD.checkFrom.m, BD.checkFrom.d);
    const checkTo = dateIndex(BD.checkTo.m, BD.checkTo.d);
    const landIdx = Math.floor((DAYS - 1) / 2);               // 飞到"一半"降落

    const eventIdx = new Set();
    (CFG.text.scene5.cards || []).forEach((c) => {
      const i = dateIndex(c.m, c.d);
      if (i >= 0 && i < DAYS) eventIdx.add(i);
    });
    const ud = App.state && App.state.userDay;
    const userIdx = ud ? dateIndex(ud.month, ud.day) : -1;
    if (userIdx >= 0 && userIdx < DAYS) eventIdx.add(userIdx);

    // ---------- 棋盘：蛇形排列，u = 列，v = 行 ----------
    const TILE_C = PAL.tiles.map(hex);
    const BASE_C = hex(PAL.tileBase);
    const tiles = [];
    for (let i = 0; i < DAYS; i++) {
      const row = Math.floor(i / COLS);
      let col = i % COLS;
      if (row % 2 === 1) col = COLS - 1 - col;
      tiles.push({
        i, u: col, v: row, col: TILE_C[i % TILE_C.length],
        lit: 0, target: 0, pop: 0, popV: 0, zoff: -5, entT: -1, phase: Math.random() * 6.28
      });
    }

    // ---------- 相机 / 投影（等距，略抬高视角） ----------
    const RS = 0.6, ZS = 0.88;                                 // 纵向压缩 / 高度比例
    let K = 30, ox = 0, oy = 0;
    const cam = { u: (COLS - 1) / 2, v: (ROWS - 1) / 2, z: 0, zoom: 1, roll: 0 };
    function proj(u, v, z) {
      const kz = K * cam.zoom, du = u - cam.u, dv = v - cam.v;
      return [ox + kz * (du - dv), oy + kz * (RS * (du + dv) - ZS * (z - cam.z))];
    }
    // 屏幕点 → 棋盘格（z≈0 平面上反投影）
    function tileAt(x, y) {
      const kz = K * cam.zoom, X = (x - ox) / kz, Y = (y - oy) / kz / RS;
      const u = cam.u + (X + Y) / 2, v = cam.v + (Y - X) / 2;
      let best = null, bd = 0.72;
      for (const tl of tiles) {
        const d = Math.max(Math.abs(tl.u - u), Math.abs(tl.v - v));
        if (d < bd) { bd = d; best = tl; }
      }
      return best;
    }

    // ---------- 背景素材 ----------
    const stars = [];
    const petals = [];
    const clouds = [];
    const bgGlows = GLOWS.map((c, i) => ({ c, bx: 0.12 + (i * 0.37) % 0.8, by: 0.15 + (i * 0.23) % 0.7, r: 0.4 + (i % 3) * 0.1, ph: i * 1.7 }));
    const glowSprites = {};
    function glowSprite(color) {
      if (glowSprites[color]) return glowSprites[color];
      const s = 160;
      const c = document.createElement('canvas');
      c.width = c.height = s;
      const x = c.getContext('2d');
      const col = hex(color);
      const gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      gr.addColorStop(0, rgb(col, 0.55));
      gr.addColorStop(0.4, rgb(col, 0.2));
      gr.addColorStop(1, rgb(col, 0));
      x.fillStyle = gr;
      x.fillRect(0, 0, s, s);
      return (glowSprites[color] = c);
    }
    function makeCloud(w, tint) {
      const h = Math.round(w * 0.5);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      const puffs = [[0.22, 0.62, 0.2], [0.4, 0.46, 0.26], [0.62, 0.52, 0.24], [0.8, 0.64, 0.18], [0.5, 0.7, 0.26]];
      puffs.forEach(([px, py, pr]) => {
        const r = pr * w;
        const gr = x.createRadialGradient(px * w, py * h, 0, px * w, py * h, r);
        gr.addColorStop(0, rgb(tint, 0.5));
        gr.addColorStop(0.6, rgb(tint, 0.22));
        gr.addColorStop(1, rgb(tint, 0));
        x.fillStyle = gr;
        x.fillRect(px * w - r, py * h - r, r * 2, r * 2);
      });
      return c;
    }
    function seedBackground() {
      stars.length = 0; petals.length = 0; clouds.length = 0;
      for (let i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.58, r: U.rand(0.6, 1.7), ph: Math.random() * 6.28, sp: U.rand(0.8, 2.2) });
      for (let i = 0; i < 20; i++) petals.push({ x: Math.random(), y: Math.random(), s: U.rand(4, 9), sp: U.rand(0.012, 0.03), sw: U.rand(0.4, 1.2), ph: Math.random() * 6.28, rot: Math.random() * 6.28, par: U.rand(0.7, 1.5), c: U.pick(PAL.tiles) });
      const tints = [[255, 205, 200], [255, 226, 205], [235, 205, 255]];
      for (let i = 0; i < 9; i++) {
        clouds.push({ spr: makeCloud(Math.round(U.rand(180, 300)), tints[i % 3]), x: Math.random(), y: U.rand(0.62, 0.98), v: U.rand(4, 11), par: U.rand(0.15, 0.4), a: U.rand(0.5, 0.85), fg: false });
      }
      for (let i = 0; i < 3; i++) {
        clouds.push({ spr: makeCloud(Math.round(U.rand(260, 380)), [255, 235, 235]), x: Math.random(), y: U.rand(0.2, 0.9), v: U.rand(14, 24), par: U.rand(1.5, 2.2), a: 0.18, fg: true });
      }
    }

    function layout() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = ov.clientWidth || window.innerWidth;
      H = ov.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      // 同时受宽和高限制：矮屏、横屏下棋盘也放得下，并给底部纸条留位置
      const span = (COLS - 1 + ROWS - 1) + 1.9;
      const byW = (W - 30) / span;
      const byH = (H * 0.56) / (span * RS + 1.4);
      K = clamp(Math.min(byW, byH), 16, 46);
      ox = W / 2;
      oy = H * 0.47;
      sheet.S = Math.min(H * 0.4, 340, W * 0.8 * 1.35) / 1.35;
      sheet.ox = W / 2;
      sheet.oy = H * 0.47;
    }

    // =========================================================
    // 折纸：纸片 + 3D 嵌入
    // =========================================================
    const SW = 1, SH = 1.35;
    const LIFT = 0.55;                                          // 俯视下 1 单位高度 = 屏幕上抬多少个纸张单位
    const ID = [1, 0, 0, 1, 0, 0];
    // 仿射 [a,b,c,d,e,f]: x' = a x + c y + e ; y' = b x + d y + f
    const amul = (m, n) => [
      m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
      m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
      m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]
    ];
    const aapply = (m, p) => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]];
    function ainv(m) {
      const det = m[0] * m[3] - m[1] * m[2];
      const a = m[3] / det, b = -m[1] / det, c = -m[2] / det, d = m[0] / det;
      return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
    }
    function reflectM(p, m) {                                   // 关于过 p、法线 m 的直线的镜像
      const ux = -m[1], uy = m[0];
      const a = 2 * ux * ux - 1, b = 2 * ux * uy, d = 2 * uy * uy - 1;
      return [a, b, b, d, p[0] - (a * p[0] + b * p[1]), p[1] - (b * p[0] + d * p[1])];
    }

    let pieces = [], ops = [], creases = [];
    const sheet = { on: false, S: 200, ox: 0, oy: 0, phi: 0, sc: 1, alpha: 0, morph: 0, shadow: 1, bob: 0 };
    const plane = { u: 0, v: 0, z: 0.6, psi: 0, pitch: 0, roll: 0, ps: 1.05 };

    function makeSheet() {
      pieces = [{ poly: [[-SW / 2, -SH / 2], [SW / 2, -SH / 2], [SW / 2, SH / 2], [-SW / 2, SH / 2]], M: ID.slice(), layer: 0, fold: null }];
      ops = []; creases = [];
    }
    function clipHalf(poly, p, m, keepPos) {
      const sg = keepPos ? 1 : -1, out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = sg * ((a[0] - p[0]) * m[0] + (a[1] - p[1]) * m[1]);
        const db = sg * ((b[0] - p[0]) * m[0] + (b[1] - p[1]) * m[1]);
        if (da >= -1e-9) out.push(a);
        if ((da > 1e-9 && db < -1e-9) || (da < -1e-9 && db > 1e-9)) {
          const t = da / (da - db);
          out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        }
      }
      if (out.length < 3) return null;
      let area = 0;
      for (let i = 0; i < out.length; i++) { const a = out[i], b = out[(i + 1) % out.length]; area += a[0] * b[1] - b[0] * a[1]; }
      return Math.abs(area) < 1e-5 ? null : out;
    }
    function addOp(p, m, kind) { ops.push({ p, m, kind, theta: 0 }); return ops.length - 1; }
    function splitAll(oi) {
      const op = ops[oi], out = [];
      for (const pc of pieces) {
        const Mi = ainv(pc.M);
        const flat = pc.poly.map((q) => aapply(pc.M, q));
        const mv = clipHalf(flat, op.p, op.m, true), st = clipHalf(flat, op.p, op.m, false);
        if (mv && st) {
          out.push({ poly: mv.map((q) => aapply(Mi, q)), M: pc.M, layer: pc.layer, fold: oi });
          out.push({ poly: st.map((q) => aapply(Mi, q)), M: pc.M, layer: pc.layer, fold: pc.fold });
        } else if (mv) {
          out.push({ poly: pc.poly, M: pc.M, layer: pc.layer, fold: oi });
        } else out.push(pc);
      }
      pieces = out;
    }
    function commitFold(oi) {
      const op = ops[oi];
      const R = reflectM(op.p, op.m);
      const mv = pieces.filter((pc) => pc.fold === oi);
      const rest = pieces.filter((pc) => pc.fold !== oi);
      const top = rest.reduce((m, pc) => Math.max(m, pc.layer), 0);
      const maxL = mv.reduce((m, pc) => Math.max(m, pc.layer), 0);
      mv.forEach((pc) => { pc.M = amul(R, pc.M); pc.layer = top + 1 + (maxL - pc.layer); pc.fold = null; });
    }
    function releaseFold(oi) { pieces.forEach((pc) => { if (pc.fold === oi) pc.fold = null; }); }

    // 纸片上一点 → 3D（X, Y 向下, Z 向上）
    function embed(pc, q) {
      const f = aapply(pc.M, q);
      let X = f[0], Y = f[1], Z = 0;
      if (pc.fold !== null) {
        const op = ops[pc.fold];
        const d = (f[0] - op.p[0]) * op.m[0] + (f[1] - op.p[1]) * op.m[1];
        const k = 1 - Math.cos(op.theta);
        X -= d * k * op.m[0]; Y -= d * k * op.m[1];
        Z = d * Math.sin(op.theta);
      }
      return [X, Y, Z + pc.layer * 0.012];
    }

    // 飞机的世界姿态：模型 (X, Y向下, Z) → 世界 (u, v, z) 的 3 个基向量
    function planeBasis() {
      const cp = Math.cos(plane.psi), sp = Math.sin(plane.psi);
      let eX = [-sp, cp, 0], eY = [cp, sp, 0], eZ = [0, 0, 1];
      const cP = Math.cos(plane.pitch), sP = Math.sin(plane.pitch);
      const eY2 = [eY[0] * cP + eZ[0] * sP, eY[1] * cP + eZ[1] * sP, eY[2] * cP + eZ[2] * sP];
      const eZ2 = [eZ[0] * cP - eY[0] * sP, eZ[1] * cP - eY[1] * sP, eZ[2] * cP - eY[2] * sP];
      const cR = Math.cos(plane.roll), sR = Math.sin(plane.roll);
      const eX3 = [eX[0] * cR - eZ2[0] * sR, eX[1] * cR - eZ2[1] * sR, eX[2] * cR - eZ2[2] * sR];
      const eZ3 = [eZ2[0] * cR + eX[0] * sR, eZ2[1] * cR + eX[1] * sR, eZ2[2] * cR + eX[2] * sR];
      return { eX: eX3, eY: eY2, eZ: eZ3 };
    }
    const LIGHT_TD = (() => { const l = [-0.45, 0.35, 0.82], n = Math.hypot(...l); return l.map((x) => x / n); })();
    const LIGHT_W = (() => { const l = [-0.565, 0.071, 0.82], n = Math.hypot(...l); return l.map((x) => x / n); })();

    // 当前 3D→屏幕 的 2×3 矩阵 + 原点 + 世界基
    function viewState() {
      const a = clamp(sheet.morph, 0, 1);
      const S = sheet.S * sheet.sc, c = Math.cos(sheet.phi), s = Math.sin(sheet.phi);
      const Ltd = [c * S, -s * S, s * S * LIFT, s * S, c * S, -c * S * LIFT];
      const B = planeBasis(), ps = plane.ps, kz = K * cam.zoom;
      const colX = B.eX.map((x) => x * ps), colY = B.eY.map((x) => -x * ps), colZ = B.eZ.map((x) => x * ps);
      const P0 = (v) => kz * (v[0] - v[1]);
      const P1 = (v) => kz * (RS * (v[0] + v[1]) - ZS * v[2]);
      const Lw = [P0(colX), P0(colY), P0(colZ), P1(colX), P1(colY), P1(colZ)];
      const L = Ltd.map((x, i) => x * (1 - a) + Lw[i] * a);
      const Ow = proj(plane.u, plane.v, plane.z);
      const O = [sheet.ox * (1 - a) + Ow[0] * a, (sheet.oy + sheet.bob) * (1 - a) + Ow[1] * a];
      return { L, O, B, a };
    }

    // 纸张纹理
    function texFront() {
      const w = 512, h = Math.round(512 * SH);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      const gr = x.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, '#fffaf4'); gr.addColorStop(1, '#ffe7de');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(120,80,70,${Math.random() * 0.035})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      x.strokeStyle = 'rgba(120,150,220,0.34)'; x.lineWidth = 1.4;
      for (let y = h * 0.15; y < h * 0.96; y += h * 0.05) { x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); }
      x.strokeStyle = 'rgba(240,110,150,0.5)'; x.lineWidth = 1.8;
      x.beginPath(); x.moveTo(w * 0.15, 0); x.lineTo(w * 0.15, h); x.stroke();
      // 小涂鸦：几行手写的波浪线 + 小爱心 + 音符
      x.strokeStyle = 'rgba(110,90,150,0.45)'; x.lineWidth = 2.2; x.lineCap = 'round';
      [0.24, 0.29, 0.34].forEach((fy, k) => {
        x.beginPath();
        const y0 = h * fy;
        x.moveTo(w * 0.22, y0);
        for (let px = w * 0.22; px < w * (0.62 - k * 0.07); px += 14) x.lineTo(px, y0 + Math.sin(px * 0.09 + k) * 4);
        x.stroke();
      });
      x.fillStyle = 'rgba(240,110,150,0.65)';
      x.font = `${Math.round(w * 0.12)}px ${FONT}`;
      x.fillText('♥', w * 0.7, h * 0.86);
      x.fillStyle = 'rgba(255,170,90,0.7)';
      x.font = `${Math.round(w * 0.09)}px ${FONT}`;
      x.fillText('♪', w * 0.78, h * 0.22);
      x.fillText('♫', w * 0.62, h * 0.66);
      return c;
    }
    function texBack() {
      const w = 512, h = Math.round(512 * SH);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d');
      const gr = x.createLinearGradient(w, 0, 0, h);
      gr.addColorStop(0, '#e6deff'); gr.addColorStop(1, '#b4c7ff');
      x.fillStyle = gr; x.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(70,80,150,${Math.random() * 0.035})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); }
      x.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 46; i++) {
        const px = Math.random() * w, py = Math.random() * h, r = 1.5 + Math.random() * 3.2;
        x.beginPath();
        x.moveTo(px, py - r * 2); x.lineTo(px + r * 0.5, py - r * 0.5); x.lineTo(px + r * 2, py); x.lineTo(px + r * 0.5, py + r * 0.5);
        x.lineTo(px, py + r * 2); x.lineTo(px - r * 0.5, py + r * 0.5); x.lineTo(px - r * 2, py); x.lineTo(px - r * 0.5, py - r * 0.5);
        x.closePath(); x.fill();
      }
      return c;
    }
    const TEX_F = texFront(), TEX_B = texBack();

    function pieceMatrix(pc, vs) {
      const E0 = embed(pc, [0, 0]), E1 = embed(pc, [1, 0]), E2 = embed(pc, [0, 1]);
      const sc = (E) => [vs.O[0] + vs.L[0] * E[0] + vs.L[1] * E[1] + vs.L[2] * E[2], vs.O[1] + vs.L[3] * E[0] + vs.L[4] * E[1] + vs.L[5] * E[2]];
      const s0 = sc(E0), s1 = sc(E1), s2 = sc(E2);
      const m = [s1[0] - s0[0], s1[1] - s0[1], s2[0] - s0[0], s2[1] - s0[1], s0[0], s0[1]];
      // 可见面的法线（模型空间），用来打光
      const a = [E1[0] - E0[0], E1[1] - E0[1], E1[2] - E0[2]], b = [E2[0] - E0[0], E2[1] - E0[1], E2[2] - E0[2]];
      let n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      const nl = Math.hypot(...n) || 1; n = n.map((x) => x / nl);
      if (n[2] < 0) n = n.map((x) => -x);
      return { m, n, det: m[0] * m[3] - m[1] * m[2] };
    }

    function drawPieces() {
      if (!sheet.on || sheet.alpha <= 0.01) return;
      const vs = viewState();
      const list = pieces.map((pc) => ({ pc, pm: pieceMatrix(pc, vs) }));
      list.sort((p, q) => (p.pc.layer + (p.pc.fold !== null && ops[p.pc.fold].kind === 'flap' ? 1000 : 0)) - (q.pc.layer + (q.pc.fold !== null && ops[q.pc.fold].kind === 'flap' ? 1000 : 0)));
      const shadowA = (1 - vs.a) * sheet.shadow;
      g.save();
      g.globalAlpha = sheet.alpha;
      for (const { pc, pm } of list) {
        const m = pm.m, front = pm.det > 0;
        const sc = Math.sqrt(Math.abs(pm.det)) || 1;
        g.setTransform(m[0] * dpr, m[1] * dpr, m[2] * dpr, m[3] * dpr, m[4] * dpr, m[5] * dpr);
        g.beginPath();
        pc.poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.closePath();
        // 底色 + 阴影（兼当接缝补丁）
        if (shadowA > 0.02) {
          g.shadowColor = `rgba(25,8,45,${0.42 * shadowA})`;
          g.shadowBlur = 22 * dpr;
          g.shadowOffsetY = 12 * dpr;
        }
        g.fillStyle = front ? '#fff0e6' : '#cdd7ff';
        g.fill();
        g.shadowColor = 'transparent'; g.shadowBlur = 0; g.shadowOffsetY = 0;
        g.lineWidth = 1.1 / Math.max(0.2, sc);
        g.strokeStyle = front ? '#fff0e6' : '#cdd7ff';
        g.stroke();
        g.save();
        g.clip();
        g.drawImage(front ? TEX_F : TEX_B, -SW / 2, -SH / 2, SW, SH);
        // 折痕
        creases.forEach((cr) => {
          g.beginPath(); g.moveTo(cr[0], cr[1]); g.lineTo(cr[2], cr[3]);
          g.strokeStyle = 'rgba(120,80,130,0.35)'; g.lineWidth = 1.5 / sc; g.stroke();
          g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1 / sc;
          g.beginPath(); g.moveTo(cr[0] + 1.2 / sc / 2, cr[1]); g.lineTo(cr[2] + 1.2 / sc / 2, cr[3]); g.stroke();
        });
        // 光影：把法线混合到"俯视光"和"世界光"
        const n = pm.n;
        const sTd = n[0] * LIGHT_TD[0] + (-n[1]) * LIGHT_TD[1] + n[2] * LIGHT_TD[2];
        const B = vs.B;
        const nw = [0, 1, 2].map((k) => n[0] * B.eX[k] + n[1] * (-B.eY[k]) + n[2] * B.eZ[k]);
        const sW = nw[0] * LIGHT_W[0] + nw[1] * LIGHT_W[1] + nw[2] * LIGHT_W[2];
        const shade = sTd * (1 - vs.a) + sW * vs.a;
        if (shade < 0.8) g.fillStyle = `rgba(40,20,70,${clamp((0.8 - shade) * 0.95, 0, 0.6)})`;
        else g.fillStyle = `rgba(255,255,255,${clamp((shade - 0.8) * 1.2, 0, 0.35)})`;
        g.fillRect(-SW, -SH, SW * 2, SH * 2);
        g.restore();
        // 纸边
        g.lineWidth = 1 / Math.max(0.2, sc);
        g.strokeStyle = 'rgba(110,70,120,0.38)';
        g.beginPath();
        pc.poly.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        g.closePath();
        g.stroke();
      }
      g.restore();
    }

    // 飞行时落在棋盘上的影子
    function drawPlaneGroundShadow() {
      if (!sheet.on || sheet.morph < 0.05) return;
      const B = planeBasis(), ps = plane.ps;
      g.save();
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const h = Math.max(0, plane.z);
      g.fillStyle = `rgba(20,6,40,${0.26 * sheet.morph * clamp(1 - h * 0.28, 0.35, 1)})`;
      g.beginPath();
      for (const pc of pieces) {
        pc.poly.forEach((q, i) => {
          const E = embed(pc, q);
          const wu = plane.u + ps * (E[0] * B.eX[0] - E[1] * B.eY[0] + E[2] * B.eZ[0]);
          const wv = plane.v + ps * (E[0] * B.eX[1] - E[1] * B.eY[1] + E[2] * B.eZ[1]);
          const p = proj(wu + h * 0.12, wv + h * 0.12, 0.02);
          if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
        });
        g.closePath();
      }
      g.fill();
      g.restore();
    }

    // =========================================================
    // 粒子（世界坐标）+ 光尾
    // =========================================================
    const parts = [];
    const trail = [];
    function burst(u, v, z, n, colors, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.28, sp = U.rand(0.6, 2.6) * (o.speed || 1);
        parts.push({
          u, v, z, vu: Math.cos(a) * sp, vv: Math.sin(a) * sp, vz: U.rand(1.2, 3.4) * (o.up || 1),
          age: 0, max: U.rand(0.9, 1.7), type: o.type || (Math.random() < 0.5 ? 'paper' : 'dot'),
          color: U.pick(colors || PAL.tiles), size: U.rand(0.06, 0.13), rot: Math.random() * 6.28, vr: U.rand(-6, 6)
        });
      }
    }
    function drawParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.age += dt;
        if (p.age >= p.max) { parts.splice(i, 1); continue; }
        p.vz -= 3.4 * dt; p.vu *= Math.exp(-dt * 0.8); p.vv *= Math.exp(-dt * 0.8);
        p.u += p.vu * dt; p.v += p.vv * dt; p.z += p.vz * dt;
        if (p.z < 0.05 && p.vz < 0) { p.z = 0.05; p.vz *= -0.28; }
        const pt = proj(p.u, p.v, p.z), kz = K * cam.zoom;
        const a = 1 - smooth(0.55, 1, p.age / p.max);
        g.globalAlpha = a;
        g.fillStyle = p.color;
        if (p.type === 'paper') {
          p.rot += p.vr * dt;
          const w = p.size * kz * 1.6, sq = Math.abs(Math.cos(p.rot));
          g.save(); g.translate(pt[0], pt[1]); g.rotate(p.rot * 0.5);
          g.fillRect(-w / 2, -w * 0.3 * sq, w, w * 0.6 * sq + 0.8);
          g.restore();
        } else if (p.type === 'heart') {
          g.font = `${Math.round(p.size * kz * 3.2)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('♥', pt[0], pt[1]);
        } else {
          g.beginPath(); g.arc(pt[0], pt[1], Math.max(1, p.size * kz * 0.55), 0, 6.3); g.fill();
        }
      }
      g.globalAlpha = 1;
    }
    function drawTrail(dt) {
      for (let i = trail.length - 1; i >= 0; i--) { trail[i].age += dt; if (trail[i].age > 1.3) trail.splice(i, 1); }
      if (trail.length < 2) return;
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const k = 1 - Math.min(1, b.age / 1.3);
        const pa = proj(a.u, a.v, a.z - 0.05), pb = proj(b.u, b.v, b.z - 0.05);
        g.strokeStyle = `rgba(255,200,170,${0.5 * k * k})`;
        g.lineWidth = 1 + 7 * k * cam.zoom * 0.6;
        g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.6 * k * k * k})`;
        g.lineWidth = 0.8 + 2 * k;
        g.beginPath(); g.moveTo(pa[0], pa[1]); g.lineTo(pb[0], pb[1]); g.stroke();
      }
      g.restore();
    }

    // =========================================================
    // 画面
    // =========================================================
    let boardAlpha = 0, dim = 0, shakeAmp = 0, t = 0;
    let entering = false, entT0 = 0;
    let following = false;
    let selectedTile = null;

    function drawBackground(dt) {
      const sky = PAL.sky;
      const gr = g.createLinearGradient(0, 0, 0, H);
      sky.forEach((c, i) => gr.addColorStop(i / (sky.length - 1), c));
      g.globalAlpha = 1;
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);

      const px = (cam.u - 2.5) * 5 + App.tilt.x * 10, py = (cam.v - 2.5) * 3 + App.tilt.y * 8;
      // 弥散光
      g.globalCompositeOperation = 'lighter';
      for (const gw of bgGlows) {
        const cx = gw.bx * W + Math.sin(t * 0.11 + gw.ph) * 24 - px * 1.2;
        const cy = gw.by * H + Math.cos(t * 0.09 + gw.ph) * 18 - py;
        const r = gw.r * Math.max(W, H);
        g.globalAlpha = 0.55;
        g.drawImage(glowSprite(gw.c), cx - r, cy - r, r * 2, r * 2);
      }
      g.globalCompositeOperation = 'source-over';
      // 星星
      for (const s of stars) {
        const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
        g.globalAlpha = a * 0.9;
        g.fillStyle = '#fff4e8';
        const x = (s.x * W - px * 0.5 + W) % W, y = s.y * H - py * 0.3;
        g.beginPath(); g.arc(x, y, s.r, 0, 6.3); g.fill();
      }
      g.globalAlpha = 1;
      // 地平线暖光
      const hg = g.createRadialGradient(W / 2, oy + K * 2, 10, W / 2, oy + K * 2, W * 0.95);
      hg.addColorStop(0, 'rgba(255,170,140,0.22)');
      hg.addColorStop(1, 'rgba(255,170,140,0)');
      g.fillStyle = hg;
      g.fillRect(0, 0, W, H);
      // 远处的云
      for (const c of clouds) {
        if (c.fg) continue;
        c.x += c.v * dt / W;
        const w = c.spr.width * (W / 390), h = c.spr.height * (W / 390);
        let x = ((c.x * W - px * c.par * 4) % (W + w) + (W + w)) % (W + w) - w;
        g.globalAlpha = c.a;
        g.drawImage(c.spr, x, c.y * H - h / 2 - py * c.par * 2, w, h);
      }
      g.globalAlpha = 1;
      // 棋盘下的薄雾
      const mp = proj(cam.u, cam.v, -1.4);
      const mg = g.createRadialGradient(mp[0], mp[1], 10, mp[0], mp[1], K * cam.zoom * 8);
      mg.addColorStop(0, 'rgba(255,190,170,0.26)');
      mg.addColorStop(1, 'rgba(255,190,170,0)');
      g.fillStyle = mg;
      g.fillRect(0, 0, W, H);
    }

    function drawForeground(dt) {
      const px = (cam.u - 2.5) * 5;
      for (const c of clouds) {
        if (!c.fg) continue;
        c.x += c.v * dt / W;
        const w = c.spr.width * (W / 390) * cam.zoom, h = c.spr.height * (W / 390) * cam.zoom;
        let x = ((c.x * W - px * c.par * 6) % (W + w) + (W + w)) % (W + w) - w;
        g.globalAlpha = c.a * (0.5 + 0.5 * smooth(1, 1.6, cam.zoom));
        g.drawImage(c.spr, x, c.y * H - h / 2, w, h);
      }
      for (const p of petals) {
        p.y += p.sp * dt * 3; p.ph += dt * p.sw;
        if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); }
        const x = (p.x * W + Math.sin(p.ph) * 26 * p.par + W) % W, y = p.y * H;
        g.save();
        g.translate(x, y); g.rotate(p.rot + Math.sin(p.ph) * 0.8);
        g.globalAlpha = 0.55;
        g.fillStyle = p.c;
        g.beginPath(); g.ellipse(0, 0, p.s * p.par, p.s * 0.55 * p.par * Math.abs(Math.cos(p.ph * 1.3)) + 0.6, 0, 0, 6.3); g.fill();
        g.restore();
      }
      g.globalAlpha = 1;
    }

    const easeBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    function drawTile(tl) {
      const a = 0.45;
      const zt = tl.zoff + tl.pop + Math.sin(t * 0.9 + tl.phase) * 0.045;
      const th = 0.34;
      const alpha = boardAlpha * clamp(1 + tl.zoff / 2.2, 0, 1);
      if (alpha <= 0.01) return;
      const A = proj(tl.u - a, tl.v - a, zt), B = proj(tl.u + a, tl.v - a, zt), C = proj(tl.u + a, tl.v + a, zt), D = proj(tl.u - a, tl.v + a, zt);
      const B2 = proj(tl.u + a, tl.v - a, zt - th), C2 = proj(tl.u + a, tl.v + a, zt - th), D2 = proj(tl.u - a, tl.v + a, zt - th);
      const topC = mixc(BASE_C, tl.col, 0.1 + tl.lit * 0.82);
      const kz = K * cam.zoom;
      g.globalAlpha = alpha;
      // 地面软影
      const sh = proj(tl.u + 0.12, tl.v + 0.12, -1.3);
      g.fillStyle = 'rgba(30,5,50,0.13)';
      g.beginPath();
      g.moveTo(sh[0], sh[1] - kz * RS * a * 1.1);
      g.lineTo(sh[0] + kz * a * 1.1, sh[1]);
      g.lineTo(sh[0], sh[1] + kz * RS * a * 1.1);
      g.lineTo(sh[0] - kz * a * 1.1, sh[1]);
      g.closePath(); g.fill();
      // 亮着的格子：底部光晕
      if (tl.lit > 0.02) {
        const c0 = proj(tl.u, tl.v, zt - th * 0.4);
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = alpha * tl.lit * 0.55;
        const r = kz * 1.7;
        g.drawImage(glowSprite(rgb(tl.col).length ? '#' + tl.col.map((x) => ('0' + (x | 0).toString(16)).slice(-2)).join('') : '#ffffff'), c0[0] - r, c0[1] - r, r * 2, r * 2);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = alpha;
      }
      // 侧面
      g.fillStyle = rgb(mixc(topC, BLACK, 0.34));
      g.beginPath(); g.moveTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(C2[0], C2[1]); g.lineTo(B2[0], B2[1]); g.closePath(); g.fill();
      g.fillStyle = rgb(mixc(topC, BLACK, 0.18));
      g.beginPath(); g.moveTo(D[0], D[1]); g.lineTo(C[0], C[1]); g.lineTo(C2[0], C2[1]); g.lineTo(D2[0], D2[1]); g.closePath(); g.fill();
      // 顶面
      const tg = g.createLinearGradient(A[0], A[1], C[0], C[1]);
      tg.addColorStop(0, rgb(mixc(topC, WHITE, 0.28)));
      tg.addColorStop(1, rgb(topC));
      g.fillStyle = tg;
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]); g.closePath(); g.fill();
      g.lineWidth = 1;
      g.strokeStyle = `rgba(255,255,255,${0.35 + tl.lit * 0.4})`;
      g.stroke();
      // 翻看时选中的格子：白色描边
      if (tl === selectedTile) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.5;
        g.stroke();
      }
      // 小寒填的那天：金边 + 呼吸
      if (tl.i === userIdx) {
        const pul = 0.5 + 0.5 * Math.sin(t * 3);
        const A2 = proj(tl.u - a - 0.06, tl.v - a - 0.06, zt), B3 = proj(tl.u + a + 0.06, tl.v - a - 0.06, zt), C3 = proj(tl.u + a + 0.06, tl.v + a + 0.06, zt), D3 = proj(tl.u - a - 0.06, tl.v + a + 0.06, zt);
        g.save();
        g.shadowColor = '#ffd35c'; g.shadowBlur = 8 + pul * 10;
        g.strokeStyle = '#ffd35c'; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(A2[0], A2[1]); g.lineTo(B3[0], B3[1]); g.lineTo(C3[0], C3[1]); g.lineTo(D3[0], D3[1]); g.closePath(); g.stroke();
        g.restore();
      }
      // 文字
      const cc = proj(tl.u, tl.v, zt);
      const dd = indexDate(tl.i);
      const ink = rgb(mixc([70, 35, 85], tl.col, 0.0));
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const has = eventIdx.has(tl.i);
      g.font = `700 ${Math.round(kz * 0.46)}px ${FONT}`;
      g.fillStyle = ink;
      const label = (tl.i === 0 || dd.d === 1) ? `${dd.m}.${dd.d}` : String(dd.d);
      g.fillText(label, cc[0], cc[1] + (has ? kz * 0.12 : 0));
      if (has) {
        g.font = `${Math.round(kz * 0.4)}px ${FONT}`;
        g.fillStyle = tl.i === userIdx ? '#ff4f86' : rgb(mixc([255, 140, 70], tl.col, 0.2));
        g.fillText(tl.i === userIdx ? '♥' : '♪', cc[0], cc[1] - kz * 0.2);
      }
      g.globalAlpha = 1;
    }

    function drawFlag(tl, color, wave) {
      const zt = tl.zoff + Math.sin(t * 0.9 + tl.phase) * 0.045;
      const base = proj(tl.u - 0.25, tl.v - 0.25, zt), top = proj(tl.u - 0.25, tl.v - 0.25, zt + 1.05);
      g.globalAlpha = boardAlpha;
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(base[0], base[1]); g.lineTo(top[0], top[1]); g.stroke();
      const kz = K * cam.zoom, w = kz * 0.62, h = kz * 0.34, sw = Math.sin(t * 4 + wave) * kz * 0.05;
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(top[0], top[1]);
      g.quadraticCurveTo(top[0] + w * 0.5, top[1] + sw, top[0] + w, top[1] + h * 0.5 + sw);
      g.quadraticCurveTo(top[0] + w * 0.5, top[1] + h * 0.7 - sw, top[0], top[1] + h);
      g.closePath(); g.fill();
      g.globalAlpha = 1;
    }

    const tileOrder = tiles.slice().sort((p, q) => (p.u + p.v) - (q.u + q.v));
    function drawBoard() {
      for (const tl of tileOrder) drawTile(tl);
      drawFlag(tiles[0], '#ff8fb3', 0);
      drawFlag(tiles[DAYS - 1], '#ffd35c', 1.7);
    }

    // ---------- 飞行途中要接的音符 ----------
    const notes = [];
    function seedNotes() {
      notes.length = 0;
      let side = 1;
      for (let i = 1; i <= landIdx; i++) {
        if (!eventIdx.has(i)) continue;
        // 放在路线一侧，要转向才接得到；屏幕横向 = (u+, v-)
        notes.push({ i, u: tiles[i].u + side * 0.3, v: tiles[i].v - side * 0.3, z: 0.95, got: false, ph: i * 1.3, mine: i === userIdx });
        side = -side;
      }
    }
    function drawNotes() {
      if (!fl.active) return;
      const kz = K * cam.zoom;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const n of notes) {
        if (n.got) continue;
        const p = proj(n.u, n.v, n.z + Math.sin(t * 3 + n.ph) * 0.08);
        const r = kz * 0.7;
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.8;
        g.drawImage(glowSprite('#ffd35c'), p[0] - r, p[1] - r, r * 2, r * 2);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        g.font = `700 ${Math.round(kz * 0.62)}px ${FONT}`;
        g.fillStyle = n.mine ? '#ff4f86' : '#fff4d0';
        g.fillText(n.mine ? '♥' : '♪', p[0], p[1]);
      }
      g.globalAlpha = 1;
    }

    // =========================================================
    // 手势输入：整章共用一套，由当前阶段决定怎么解释
    // =========================================================
    const input = { down: false, sx: 0, sy: 0, x: 0, y: 0, moved: false, mode: '', fold: null, scrub: 0 };
    function localXY(e) {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }
    function onDown(e) {
      if (e.target && e.target.closest && e.target.closest('button')) return;
      const [x, y] = localXY(e);
      input.down = true; input.moved = false;
      input.sx = input.x = x; input.sy = input.y = y;
      if (input.fold) input.fold.down(x, y);
      if (input.mode === 'explore') pickTile(x, y);
    }
    function onMove(e) {
      if (!input.down) return;
      const [x, y] = localXY(e);
      const step = Math.hypot(x - input.x, y - input.y);
      input.x = x; input.y = y;
      if (Math.hypot(x - input.sx, y - input.sy) > 8) input.moved = true;
      if (input.fold) input.fold.move(x, y);
      if (input.mode === 'light') input.scrub += step;
    }
    function onUp() {
      if (!input.down) return;
      input.down = false;
      if (input.fold) input.fold.up(input.moved);
    }
    ov.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);

    // =========================================================
    // 帧循环
    // =========================================================
    let raf = 0, last = performance.now(), running = true;

    // 飞行路径（沿棋盘格中心的平滑曲线，按弧长采样）
    const path = (() => {
      const ctrl = [];
      for (let i = 0; i <= landIdx; i++) ctrl.push([tiles[i].u, tiles[i].v]);
      const f = ctrl[0], s2 = ctrl[1], l = ctrl[ctrl.length - 1], p2 = ctrl[ctrl.length - 2];
      const Pp = [[2 * f[0] - s2[0], 2 * f[1] - s2[1]]].concat(ctrl, [[2 * l[0] - p2[0], 2 * l[1] - p2[1]]]);
      const pts = [];
      for (let k = 1; k < Pp.length - 2; k++) {
        const p0 = Pp[k - 1], p1 = Pp[k], pp2 = Pp[k + 1], p3 = Pp[k + 2];
        for (let j = 0; j < 24; j++) {
          const u = j / 24, u2 = u * u, u3 = u2 * u;
          const cr = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u2 + (-a + 3 * b - 3 * c + d) * u3);
          pts.push([cr(p0[0], p1[0], pp2[0], p3[0]), cr(p0[1], p1[1], pp2[1], p3[1])]);
        }
      }
      pts.push(ctrl[ctrl.length - 1]);
      const cum = [0];
      for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, cum, len: cum[cum.length - 1] };
    })();
    function pathAt(s) {
      s = clamp(s, 0, path.len);
      let lo = 0, hi = path.cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (path.cum[mid] <= s) lo = mid; else hi = mid; }
      const f = (s - path.cum[lo]) / ((path.cum[hi] - path.cum[lo]) || 1);
      const a = path.pts[lo], b = path.pts[hi];
      return { u: a[0] + (b[0] - a[0]) * f, v: a[1] + (b[1] - a[1]) * f, psi: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    const FLY_SEC = 8.2;                                        // 全程不碰屏幕时大约飞这么久
    const fl = { active: false, s: 0, v: 0, lastTile: -1, ou: 0, ov: 0, got: 0 };

    function updateFlight(dt) {
      const sn0 = fl.s / path.len;
      const base = path.len / FLY_SEC * 1.15;
      const ramp = (0.45 + 0.55 * smooth(0, 0.12, sn0)) * (1 - 0.65 * smooth(0.9, 1, sn0));
      const boost = input.down ? 1.7 : 1;
      fl.v += (base * ramp * boost - fl.v) * (1 - Math.exp(-dt * 4));
      fl.s = Math.min(path.len, fl.s + fl.v * dt);
      const sn = fl.s / path.len;
      const p = pathAt(fl.s);
      const look = pathAt(fl.s + 0.7);
      const prevPsi = plane.psi;
      plane.psi += angDiff(look.psi, plane.psi) * (1 - Math.exp(-dt * 7));
      const rate = angDiff(plane.psi, prevPsi) / Math.max(dt, 1e-3);
      plane.roll += (clamp(rate * 0.17, -0.85, 0.85) - plane.roll) * (1 - Math.exp(-dt * 6));
      // 转向：手指在屏幕上的位移换算成世界偏移，松手回到航线；临近降落时收回
      let tu = 0, tv = 0;
      if (input.down) {
        const kz = K * cam.zoom;
        const X = (input.x - input.sx) / kz * 1.2, Y = (input.y - input.sy) / kz / RS * 1.2;
        tu = (X + Y) / 2; tv = (Y - X) / 2;
        const m = Math.hypot(tu, tv);
        if (m > 0.85) { tu *= 0.85 / m; tv *= 0.85 / m; }
      }
      const keep = 1 - smooth(0.88, 0.98, sn);
      fl.ou += (tu * keep - fl.ou) * (1 - Math.exp(-dt * 9));
      fl.ov += (tv * keep - fl.ov) * (1 - Math.exp(-dt * 9));
      plane.u = p.u + fl.ou; plane.v = p.v + fl.ov;
      const zT = lerp(0.35, 1.0, smooth(0, 0.14, sn)) + 0.09 * Math.sin(sn * Math.PI * 7) - 0.88 * smooth(0.9, 1, sn);
      const dz = zT - plane.z;
      plane.z += dz * (1 - Math.exp(-dt * 8));
      plane.pitch += (clamp(dz * 1.5, -0.4, 0.45) - plane.pitch) * (1 - Math.exp(-dt * 5));
      // 翅膀轻轻扇动
      const wing = ops.filter((o) => o.kind === 'wing');
      wing.forEach((o) => { o.theta = 0.62 + 0.05 * Math.sin(t * 5); });
      // 光尾
      if (Math.random() < 0.9) trail.push({ u: plane.u, v: plane.v, z: plane.z, age: 0 });
      if (Math.random() < 0.5) parts.push({ u: plane.u, v: plane.v, z: plane.z - 0.05, vu: U.rand(-0.3, 0.3), vv: U.rand(-0.3, 0.3), vz: U.rand(0, 0.5), age: 0, max: U.rand(0.6, 1.1), type: 'dot', color: U.pick(PAL.tiles), size: U.rand(0.05, 0.1), rot: 0, vr: 0 });
      // 经过哪一格
      let nearest = 0, nd = 1e9;
      for (let i = 0; i <= landIdx; i++) { const d = Math.hypot(tiles[i].u - plane.u, tiles[i].v - plane.v); if (d < nd) { nd = d; nearest = i; } }
      if (nearest !== fl.lastTile && nd < 0.7) {
        fl.lastTile = nearest;
        tiles[nearest].popV = 5.5;
        const sc = [0, 2, 4, 7, 9, 12, 14, 16];
        A.blip({ freq: CFG.COIN_BASE_HZ * Math.pow(2, sc[nearest % sc.length] / 12), type: 'sine', vol: 0.028, dur: 0.5, jitter: 0 });
      }
      // 接音符
      for (const n of notes) {
        if (n.got || Math.hypot(n.u - plane.u, n.v - plane.v) > 0.42) continue;
        n.got = true;
        fl.got++;
        A.coin(Math.min(fl.got * 2, 10));
        vibrate(18);
        burst(n.u, n.v, n.z, 12, n.mine ? ['#ff8fb3', '#ffd35c'] : ['#ffd35c', '#fff4d0'], { type: 'dot', speed: 0.7, up: 0.6 });
        updateHud();
      }
      // 相机
      if (following) {
        const lu = plane.u + Math.cos(plane.psi) * 0.9, lv = plane.v + Math.sin(plane.psi) * 0.9;
        const k = 1 - Math.exp(-dt * 3.4);
        cam.u += (lu - cam.u) * k; cam.v += (lv - cam.v) * k;
      }
      cam.roll += (-plane.roll * 0.05 - cam.roll) * (1 - Math.exp(-dt * 3));
    }

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      let dt = (now - last) / 1000; last = now;
      if (!(dt > 0)) dt = 0.016;
      dt = Math.min(dt, 0.05);
      t += dt;
      sheet.bob = sheet.bobbing ? Math.sin(t * 1.8) * 3 : sheet.bob;

      if (shakeAmp > 0.25) {
        ov.style.transform = `translate(${((Math.random() - 0.5) * shakeAmp).toFixed(1)}px, ${((Math.random() - 0.5) * shakeAmp).toFixed(1)}px)`;
        shakeAmp *= Math.exp(-dt * 6);
      } else if (shakeAmp > 0) { shakeAmp = 0; ov.style.transform = ''; }

      // 格子：入场、亮起、弹簧
      for (const tl of tiles) {
        if (entering) {
          const e = clamp((t - entT0 - tl.i * 0.03) / 0.8, 0, 1);
          tl.zoff = -5 * (1 - easeBack(e));
          if (e <= 0) tl.zoff = -5;
        }
        tl.lit += (tl.target - tl.lit) * Math.min(1, dt * 7);
        tl.popV += (-tl.pop * 90 - tl.popV * 9) * dt;
        tl.pop += tl.popV * dt;
      }
      if (fl.active) updateFlight(dt);

      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (Math.abs(cam.roll) > 1e-4) {
        g.translate(W / 2, H / 2); g.rotate(cam.roll); g.translate(-W / 2, -H / 2);
      }
      drawBackground(dt);
      if (boardAlpha > 0.01) drawBoard();
      drawNotes();
      drawParts(dt);
      drawTrail(dt);
      drawPlaneGroundShadow();
      if (dim > 0.01) {
        const vg = g.createRadialGradient(W / 2, sheet.oy, H * 0.12, W / 2, sheet.oy, H * 0.75);
        vg.addColorStop(0, `rgba(25,8,45,${dim * 0.55})`);
        vg.addColorStop(1, `rgba(15,4,30,${dim})`);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.fillStyle = vg; g.fillRect(-20, -20, W + 40, H + 40);
      }
      drawPieces();
      drawForeground(dt);
    }

    // =========================================================
    // 工具
    // =========================================================
    function shake(amp) { if (!REDUCED) shakeAmp = Math.max(shakeAmp, amp); }
    function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 忽略 */ } }
    const tween = (ms, fn, ease) => U.tween(ms, (e, k) => { if (ctx.alive()) fn(e, k); }, ease);
    function rustle(n, vol) {
      for (let k = 0; k < n; k++) setTimeout(() => {
        if (ctx.alive()) A.blip({ freq: 2200 + Math.random() * 2800, type: 'square', vol: vol * (0.6 + Math.random() * 0.6), dur: 0.02, jitter: 0.5 });
      }, k * 26);
    }

    // 底部的操作提示：一张小纸条
    let hintEl = null;
    function setHint(text, dir) {
      if (hintEl) { const old = hintEl; old.classList.remove('on'); setTimeout(() => old.remove(), 300); hintEl = null; }
      if (!text) return;
      const el = U.el('div', 's6-hint', layer);
      if (dir) {
        const arrow = U.el('span', 's6-hint-arrow', el, '➜');
        arrow.style.setProperty('--r', Math.atan2(dir[1], dir[0]).toFixed(3) + 'rad');
      }
      U.el('span', null, el, text);
      requestAnimationFrame(() => el.classList.add('on'));
      hintEl = el;
    }

    // ---------- 骰子 ----------
    const PIPS = { 1: [[4, 4]], 2: [[2, 2], [6, 6]], 3: [[2, 2], [4, 4], [6, 6]], 4: [[2, 2], [2, 6], [6, 2], [6, 6]], 5: [[2, 2], [2, 6], [4, 4], [6, 2], [6, 6]], 6: [[2, 2], [4, 2], [6, 2], [2, 6], [4, 6], [6, 6]] };
    const DIE_PAL = { O: '#6a2f5a', B: '#fff2f6', P: '#e0457b', rim: 'rgba(255,170,215,0.55)' };
    const faces = {};
    for (let n = 1; n <= 6; n++) {
      const rows = ['.OOOOOOO.'];
      for (let r = 1; r <= 7; r++) rows.push('OBBBBBBBO');
      rows.push('.OOOOOOO.');
      const arr = rows.map((s) => s.split(''));
      PIPS[n].forEach(([pr, pc]) => { arr[pr][pc] = 'P'; });
      faces[n] = App.sprites.render(arr.map((a) => a.join('')), DIE_PAL, 14);
    }
    const die = U.el('button', 's6-die', layer);
    die.type = 'button';
    die.setAttribute('aria-label', TX.dieHint);
    const dieRing = U.el('span', 's6-die-ring', die);
    const dieCv = U.el('canvas', null, die);
    dieCv.width = faces[1].width; dieCv.height = faces[1].height;
    const dg = dieCv.getContext('2d');
    dg.imageSmoothingEnabled = false;
    function showFace(n) { dg.clearRect(0, 0, dieCv.width, dieCv.height); dg.drawImage(faces[n], 0, 0); }
    showFace(5);
    let dieY = 0;
    function dieXform(scale, ty, rot) {
      die.style.top = dieY + 'px';
      die.style.transform = `translate(-50%, calc(-50% + ${ty.toFixed(1)}px)) rotate(${rot.toFixed(3)}rad) scale(${scale.toFixed(3)})`;
    }

    // 按住蓄力：骰子压扁发抖，音调升高；松手掷出。蓄力越满，后面甩得越狠
    let thrown = false, extraTaps = 0, nagged = false, onThrow = null, power = 0;
    let dieReady = false, chargeTimer = 0, chargeT0 = 0;
    const thrownP = new Promise((res) => { onThrow = res; });
    function stopCharge() {
      clearInterval(chargeTimer); chargeTimer = 0;
      dieRing.style.setProperty('--p', '0');
    }
    function startCharge() {
      if (chargeTimer) return;
      chargeT0 = performance.now();
      die.classList.remove('idle');
      let lastStep = -1;
      chargeTimer = setInterval(() => {
        if (!ctx.alive()) { stopCharge(); return; }
        power = clamp((performance.now() - chargeT0) / 1100, 0, 1);
        dieRing.style.setProperty('--p', power.toFixed(3));
        const jit = REDUCED ? 0 : power * 3;
        dieXform(1 - power * 0.14, (Math.random() - 0.5) * jit, (Math.random() - 0.5) * jit * 0.02);
        const st = Math.floor(power * 6);
        if (st !== lastStep) {
          lastStep = st;
          A.blip({ freq: 260 * Math.pow(2, st / 6), type: 'triangle', vol: 0.03, dur: 0.07, jitter: 0 });
          vibrate(6 + st * 3);
        }
      }, 30);
    }
    function release() {
      if (!chargeTimer) return;
      stopCharge();
      dieRing.remove();
      thrown = true;
      onThrow();
    }
    die.addEventListener('pointerdown', (e) => {
      if (!ctx.alive()) return;
      if (thrown) {
        extraTaps++;
        A.blip({ freq: 300 + extraTaps * 40, type: 'square', vol: 0.02, dur: 0.05, jitter: 0 });
        if (extraTaps >= 3 && !nagged) { nagged = true; App.companion.say(T.nag, { small: true, hold: 1600 }); }
        return;
      }
      if (!dieReady) return;
      try { die.setPointerCapture(e.pointerId); } catch (err) { /* 旧浏览器 */ }
      startCharge();
    });
    die.addEventListener('pointerup', release);
    die.addEventListener('pointercancel', release);
    die.addEventListener('click', (e) => {                     // 键盘（Enter / 空格）直接掷出
      if (e.detail !== 0 || thrown || !dieReady) return;
      power = 0.6; thrown = true; dieRing.remove(); onThrow();
    });

    async function throwDie() {
      const y0 = dieY, y1 = H * 0.5;
      const pw = 0.6 + power * 0.4;
      vibrate([30, 30, 60]);
      A.whoosh(0.07, 0.5);
      await tween(320, (e) => { dieY = lerp(y0, y1, e); dieXform(1 + 1.9 * e, -20 * e, e * 0.6); }, U.ease.outCubic);
      if (!ctx.alive()) return;
      const DUR = 1900;
      let bounce = 0, nextSwap = 0;
      await tween(DUR, (e, k) => {
        const ms = k * DUR, phase = k * 3, b = Math.floor(phase), f = phase - b, decay = 1 - k * 0.7;
        dieXform(2.9 + Math.sin(Math.PI * f) * 0.7 * decay, -Math.sin(Math.PI * f) * 150 * pw * decay, 0.6 + k * 5.2 * (1 - k * 0.5) + Math.sin(ms / 90) * 0.12 * (1 - k));
        if (b > bounce) {
          bounce = b; shake((16 - b * 3) * pw); A.click(0.2);
          A.blip({ freq: 120, type: 'sine', vol: 0.1, dur: 0.18, jitter: 0 });
          vibrate(b === 2 ? 90 : 45);
        }
        if (ms >= nextSwap) { showFace(1 + Math.floor(Math.random() * 6)); nextSwap = ms + 60 + k * 170; }
      }, U.ease.linear);
      if (!ctx.alive()) return;
      showFace(6);
      dieXform(2.9, 0, 0);
      shake(12);
      vibrate([60, 40, 120]);
      A.coin(5); A.coin(7);
      await U.sleep(800);
      if (!ctx.alive()) return;
      await tween(420, (e) => dieXform(2.9 * (1 - e) + 0.01, -60 * e, e * 0.8), U.ease.outQuad);
      die.style.display = 'none';
    }

    // =========================================================
    // 折纸：每一折都跟手
    //   hint：提示文字；dir：屏幕上的拖动方向；dist：拖满需要的像素；apply(p)：p∈[0,1] 时纸的姿态
    //   过半松手自动折完，不到一半弹回；轻点一下直接折完；12 秒没动静也自动折完
    // =========================================================
    function foldGesture(hint, dir, dist, apply) {
      return new Promise((resolve) => {
        let p = 0, base = 0, sx = 0, sy = 0, done = false, token = 0, lastSound = 0;
        if (input.down) { sx = input.x; sy = input.y; }     // 上一步手指还没抬起时，从当前位置算起
        setHint(hint, dir);
        const finish = async () => {
          if (done) return;
          done = true; token++;
          input.fold = null;
          clearTimeout(auto);
          setHint(null);
          const from = p;
          await tween(120 + 240 * (1 - from), (e) => apply(lerp(from, 1, e)), U.ease.outCubic);
          vibrate(16);
          resolve();
        };
        const auto = setTimeout(() => {
          if (!ctx.alive()) { resolve(); return; }
          if (!input.down) finish();
        }, 12000);
        input.fold = {
          down(x, y) { token++; sx = x; sy = y; base = p; },
          move(x, y) {
            const d = ((x - sx) * dir[0] + (y - sy) * dir[1]) / dist;
            p = clamp(base + d, 0, 1);
            apply(p);
            if (Math.abs(p - lastSound) > 0.14) { lastSound = p; rustle(2, 0.011); vibrate(4); }
            if (p >= 0.98) finish();
          },
          up(moved) {
            if (!moved || p >= 0.5) { finish(); return; }
            const from = p, my = ++token;
            tween(240, (e) => { if (my === token) { p = lerp(from, 0, e); apply(p); } }, U.ease.outCubic);
          }
        };
      });
    }

    async function foldPlane() {
      makeSheet();
      sheet.on = true; sheet.morph = 0; sheet.phi = 0; sheet.sc = 1; sheet.alpha = 0; sheet.shadow = 1;
      plane.u = tiles[0].u; plane.v = tiles[0].v; plane.z = 0.6; plane.psi = 0; plane.pitch = 0; plane.roll = 0;
      const oy0 = H * 0.47;
      // 1) 纸飘下来，盖住棋盘
      A.whoosh(0.05, 0.9);
      tween(700, (e) => { dim = e; }, U.ease.outQuad);
      await tween(1100, (e, k) => {
        sheet.alpha = clamp(k * 4, 0, 1);
        sheet.oy = oy0 - (1 - e) * H * 0.45;
        sheet.phi = (1 - e) * -0.5 + Math.sin(k * 9) * 0.06 * (1 - k);
        sheet.sc = 0.75 + 0.25 * e;
        sheet.bob = 0;
      }, U.ease.outCubic);
      if (!ctx.alive()) return;
      sheet.phi = 0; sheet.sc = 1; sheet.oy = oy0;
      sheet.bobbing = true;
      const reach = sheet.S * 0.8;

      // 2) 对折，再展开，留下中线折痕
      let o1 = addOp([0, 0], [1, 0], 'flap');
      splitAll(o1);
      await foldGesture(TX.folds[0], [-1, 0], reach, (p) => { ops[o1].theta = Math.PI * p; });
      if (!ctx.alive()) return;
      A.click(0.1);
      await U.sleep(160);
      rustle(4, 0.008);
      await tween(560, (e) => { ops[o1].theta = Math.PI * (1 - e); }, U.ease.inOutCubic);
      if (!ctx.alive()) return;
      releaseFold(o1);
      creases.push([0, -SH / 2, 0, SH / 2]);
      await U.sleep(160);
      if (!ctx.alive()) return;

      // 3) 两个上角折到中线
      const apex = [0, -SH / 2];
      const q = Math.SQRT1_2;
      let oL = addOp(apex, [-q, -q], 'flap'); splitAll(oL);
      let oR = addOp(apex, [q, -q], 'flap'); splitAll(oR);
      await foldGesture(TX.folds[1], [0, 1], reach, (p) => { ops[oL].theta = Math.PI * p; ops[oR].theta = Math.PI * p; });
      if (!ctx.alive()) return;
      A.click(0.12);
      commitFold(oL); commitFold(oR);
      await U.sleep(180);
      if (!ctx.alive()) return;

      // 4) 两条斜边再折到中线
      const c22 = Math.cos(Math.PI / 8), s22 = Math.sin(Math.PI / 8);
      let o3 = addOp(apex, [-c22, -s22], 'flap'); splitAll(o3);
      let o4 = addOp(apex, [c22, -s22], 'flap'); splitAll(o4);
      await foldGesture(TX.folds[2], [0, 1], reach, (p) => { ops[o3].theta = Math.PI * p; ops[o4].theta = Math.PI * p; });
      if (!ctx.alive()) return;
      A.click(0.12);
      commitFold(o3); commitFold(o4);
      await U.sleep(180);
      if (!ctx.alive()) return;

      // 5) 翅膀抬起
      let wL = addOp([0, 0], [-1, 0], 'wing'); splitAll(wL);
      let wR = addOp([0, 0], [1, 0], 'wing'); splitAll(wR);
      await foldGesture(TX.folds[3], [0, -1], reach * 0.6, (p) => { ops[wL].theta = 0.62 * p; ops[wR].theta = 0.62 * p; });
      if (!ctx.alive()) return;
      A.coin(4); A.coin(6);
      await U.sleep(450);
      if (!ctx.alive()) return;
      sheet.bobbing = false;
    }

    // 折好的飞机转向、缩小、飞到起点
    async function takeOff() {
      const start = pathAt(0.001);
      // 屏幕上的目标朝向：沿路径方向的屏幕向量
      const fu = Math.cos(start.psi), fv = Math.sin(start.psi);
      const hx = fu - fv, hy = RS * (fu + fv);
      const phiT = Math.atan2(hx, -hy);
      const bob0 = sheet.bob;
      A.whoosh(0.06, 1.4);
      // 在屏幕里先转向并轻轻抬头
      await tween(700, (e) => { sheet.phi = phiT * e; sheet.bob = bob0 * (1 - e); }, U.ease.inOutCubic);
      if (!ctx.alive()) return;
      sheet.bob = 0;
      // 缩小，飞向起点；相机同时拉近
      plane.u = start.u; plane.v = start.v; plane.psi = start.psi; plane.z = 0.8; plane.pitch = 0.12;
      const cu0 = cam.u, cv0 = cam.v;
      tween(1300, (e) => { dim = 1 - e; }, U.ease.outQuad);
      await tween(1300, (e) => {
        sheet.morph = e;
        sheet.shadow = 1 - e;
        cam.zoom = lerp(1, 1.35, e);
        cam.u = lerp(cu0, start.u + 1.0, e); cam.v = lerp(cv0, start.v + 0.6, e);
      }, U.ease.inOutCubic);
      if (!ctx.alive()) return;
      sheet.morph = 1; sheet.phi = 0;
      burst(plane.u, plane.v, 0.4, 14, ['#fff4e8', '#ffd0b8', '#ffb3c8'], { type: 'dot', speed: 0.7 });
    }

    // 飞行小计分：只是彩蛋，接不到也不影响往下走
    let hudEl = null;
    function updateHud() {
      if (!hudEl) return;
      hudEl.textContent = `♪ ${fl.got} / ${notes.length}`;
      hudEl.classList.remove('pop');
      void hudEl.offsetWidth;
      hudEl.classList.add('pop');
    }

    async function flyAlong() {
      seedNotes();
      if (notes.length) {
        hudEl = U.el('div', 's6-hud', layer);
        hudEl.textContent = `♪ 0 / ${notes.length}`;
      }
      setHint(TX.flyHint);
      fl.s = 0; fl.v = 0; fl.ou = 0; fl.ov = 0; fl.got = 0;
      fl.active = true; following = true; fl.lastTile = -1;
      A.whoosh(0.06, 3.2);
      A.coin(2); A.coin(4);
      tween(2600, (e) => { cam.zoom = lerp(1.35, 1.78, e); }, U.ease.inOutCubic);
      setTimeout(() => { if (ctx.alive()) setHint(null); }, 3200);
      while (fl.s < path.len) {
        await U.sleep(50);
        if (!ctx.alive()) return;
      }
      // 降落：平稳落到那一格，弹一下
      const T0 = tiles[landIdx];
      A.whoosh(0.04, 0.5);
      fl.active = false;
      const z0p = plane.z, pt0 = plane.pitch, r0 = plane.roll, u0p = plane.u, v0p = plane.v;
      await tween(420, (e) => {
        plane.z = lerp(z0p, 0.1, e); plane.pitch = lerp(pt0, 0.08, e); plane.roll = lerp(r0, 0, e);
        plane.u = lerp(u0p, T0.u, e); plane.v = lerp(v0p, T0.v, e);
      }, U.ease.outQuad);
      if (!ctx.alive()) return;
      plane.u = T0.u; plane.v = T0.v; plane.roll = 0;
      T0.popV = 7;
      shake(6); vibrate(60); A.click(0.16);
      A.coin(2); A.coin(4); A.coin(6);
      burst(T0.u, T0.v, 0.3, 36, null, { speed: 1.1, up: 1.1 });
      parts.push(...Array.from({ length: 8 }, () => ({ u: T0.u, v: T0.v, z: 0.3, vu: U.rand(-0.5, 0.5), vv: U.rand(-0.5, 0.5), vz: U.rand(1.5, 2.6), age: 0, max: U.rand(1.3, 2), type: 'heart', color: '#ff7fa8', size: U.rand(0.07, 0.11), rot: 0, vr: 0 })));
      if (hudEl) {
        if (notes.length && fl.got === notes.length) hudEl.textContent = TX.allNotes;
        const h = hudEl; hudEl = null;
        setTimeout(() => h.classList.add('off'), 1600);
      }
      await U.sleep(700);
      if (!ctx.alive()) return;
      // 镜头拉远
      following = false;
      const z0 = cam.zoom, u0 = cam.u, v0 = cam.v, c0 = cam.roll;
      A.whoosh(0.05, 1.4);
      await tween(1700, (e) => {
        cam.zoom = lerp(z0, 1, e);
        cam.u = lerp(u0, (COLS - 1) / 2, e); cam.v = lerp(v0, (ROWS - 1) / 2, e);
        cam.roll = lerp(c0, 0, e);
      }, U.ease.inOutCubic);
    }

    // 打卡：手指每划过一段就点亮下一天；停手 2.6 秒后自动亮完
    async function lightChecks() {
      const PER_TILE = 16;
      input.mode = 'light';
      input.scrub = 0;
      setHint(TX.lightHint);
      let i = checkFrom, idle = 0, tick = 0;
      while (i <= checkTo) {
        await U.sleep(30);
        if (!ctx.alive()) return;
        tick++;
        idle = input.down ? 0 : idle + 30;
        let go = false;
        if (input.scrub >= PER_TILE) { input.scrub -= PER_TILE; go = true; }
        else if (idle > 2600 && tick % 3 === 0) go = true;
        if (!go) continue;
        tiles[i].target = 1;
        tiles[i].popV = 5;
        A.coin((i - checkFrom) % 9);
        vibrate(5);
        if (i === userIdx) burst(tiles[i].u, tiles[i].v, 0.3, 14, ['#ffd35c', '#ffe9a8'], { type: 'dot' });
        updateDots(i - checkFrom + 1);
        i++;
      }
      input.mode = '';
      setHint(null);
      A.coin(5); A.coin(7); A.coin(9);
    }

    // ---------- 翻看：点格子看那一天 ----------
    function dayText(tl) {
      const dd = indexDate(tl.i);
      if (tl.i === userIdx && ud && ud.text) return `「${ud.text}」`;
      const card = (CFG.text.scene5.cards || []).find((c) => c.m === dd.m && c.d === dd.d);
      const page = card && card.pages && card.pages[0];
      if (page) return page.title || page.text;
      return tl.target ? TX.checkedDay : TX.emptyDay;
    }
    let popEl = null;
    function pickTile(x, y) {
      const tl = tileAt(x, y);
      if (popEl) { const old = popEl; old.classList.remove('on'); setTimeout(() => old.remove(), 180); popEl = null; }
      selectedTile = tl;
      if (!tl) return;
      tl.popV = 6;
      A.blip({ freq: CFG.COIN_BASE_HZ * Math.pow(2, [0, 2, 4, 7, 9][tl.i % 5] / 12), type: 'sine', vol: 0.03, dur: 0.3, jitter: 0 });
      vibrate(8);
      const dd = indexDate(tl.i);
      const p = proj(tl.u, tl.v, 0.2);
      const el = U.el('div', 's6-pop', layer);
      U.el('div', 's6-pop-date', el, `${dd.m}月${dd.d}日`);
      U.el('div', 's6-pop-text', el, dayText(tl));
      const hw = Math.min(120, (W - 24) / 2);
      el.style.left = clamp(p[0], hw + 12, W - hw - 12) + 'px';
      el.style.top = p[1] + 'px';
      if (p[1] < H * 0.3) el.classList.add('below');
      requestAnimationFrame(() => el.classList.add('on'));
      popEl = el;
    }
    function explore() {
      return new Promise((resolve) => {
        input.mode = 'explore';
        setHint(TX.exploreHint);
        const btn = U.el('button', 's6-next px-btn', captionEl, TX.next);
        btn.type = 'button';
        requestAnimationFrame(() => btn.classList.add('on'));
        btn.addEventListener('click', () => {
          input.mode = '';
          selectedTile = null;
          setHint(null);
          A.blip(A.voices.tap); vibrate(10);
          resolve();
        }, { once: true });
      });
    }

    // ---------- 打卡纸：30 个孔，打过卡的那天打穿 ----------
    let dotEls = [], captionEl = null, countEl = null;
    function showCaption() {
      const box = U.el('div', 's6-caption', layer);
      captionEl = box;
      U.el('div', 's6-cap-main', box, T.caption[0]);
      U.el('div', 's6-cap-main', box, T.caption[1]);
      const dots = U.el('div', 's6-dots', box);
      for (let i = 0; i < BD.target; i++) dotEls.push(U.el('span', 's6-dot', dots));
      countEl = U.el('div', 's6-cap-small', box, T.small.replace('{n}', 0).replace('{t}', BD.target));
      requestAnimationFrame(() => box.classList.add('on'));
    }
    function updateDots(n) {
      dotEls.forEach((d, i) => d.classList.toggle('on', i < n));
      if (countEl) countEl.textContent = T.small.replace('{n}', n).replace('{t}', BD.target);
    }

    // =========================================================
    // 总时间线
    // =========================================================
    function onResize() { layout(); dieY = Math.min(H * 0.74, H - 170); if (!thrown) dieXform(1, 0, 0); }
    layout();
    seedBackground();
    dieY = Math.min(H * 0.74, H - 170);
    dieXform(0.01, 0, 0);
    window.addEventListener('resize', onResize);
    raf = requestAnimationFrame(frame);

    // 供调试脚本使用
    if (U.param('debug') !== null) window.__s6 = { cam, plane, sheet, ops, pieces: () => pieces, tiles, fl, parts, path, notes, input };

    (async () => {
      App.companion.show({ corner: 'tl' });
      App.shards.show();
      await U.sleep(700);
      if (!ctx.alive()) return;

      await App.companion.say(T.intro, { hold: 800 });
      if (!ctx.alive()) return;

      // 格子一块块升起来，骰子弹出
      A.whoosh(0.04, 1.0);
      boardAlpha = 1;
      entering = true; entT0 = t;
      for (let i = 0; i < DAYS; i += 3) {
        setTimeout(() => { if (ctx.alive()) A.blip({ freq: 420 + i * 14, type: 'sine', vol: 0.014, dur: 0.1, jitter: 0 }); }, i * 30);
      }
      await U.sleep(DAYS * 30 + 700);
      if (!ctx.alive()) return;
      entering = false;
      tiles.forEach((tl) => { tl.zoff = 0; });
      await tween(380, (e) => dieXform(e, 0, 0), U.ease.outBack);
      if (!ctx.alive()) return;
      die.classList.add('idle');
      dieReady = true;
      setHint(TX.dieHint);

      await thrownP;
      if (!ctx.alive()) return;
      setHint(null);
      die.classList.remove('idle');
      await throwDie();
      if (!ctx.alive()) return;

      await foldPlane();
      if (!ctx.alive()) return;
      await takeOff();
      if (!ctx.alive()) return;
      await flyAlong();
      if (!ctx.alive()) return;
      showCaption();
      await U.sleep(500);
      if (!ctx.alive()) return;
      await lightChecks();
      if (!ctx.alive()) return;
      await U.sleep(500);
      if (!ctx.alive()) return;
      await explore();
      if (!ctx.alive()) return;
      ctx.next();
    })();

    self._cleanup = function () {
      running = false;
      cancelAnimationFrame(raf);
      stopCharge();
      input.fold = null;
      window.removeEventListener('resize', onResize);
      ov.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      layer.remove();
      canvas.remove();
      try { delete window.__s6; } catch (e) { /* 忽略 */ }
    };
  },

  exit() {
    if (this._cleanup) { this._cleanup(); this._cleanup = null; }
    const ov = document.getElementById('overlay');
    ov.style.transform = '';
    App.companion.reset();
    App.shards.hide();
  }
});