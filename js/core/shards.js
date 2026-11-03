/* =========================================================
 * 唱片碎片：全局状态 + 角落里的黑胶收藏槽
 *
 *   App.state.shards      长度 5 的数组，每块 { got, lit }
 *                         got = 已经飞进收藏槽，lit = 已经亮起。
 *                         答错的碎片：got 但没 lit（暗着进槽），揭晓正确答案后再 light()。
 *   App.state.shardCorner 唱片边缘那块"最后一角"补上没有（留给 Scene 9）
 *
 *   App.shards.reset()                  状态清零（新一轮开始时，Scene 3 的 enter 里调）
 *   App.shards.show() / hide()          显示 / 收起收藏槽（右上角，静音按钮下面）
 *   await App.shards.collect(i, { lit, from, ms })
 *       第 i 块（0–4）碎片从屏幕坐标 from 飞进槽里。lit:false = 暗着进槽。
 *       不传 from 就从屏幕中间偏上飞。落进去时槽会"咚"地弹一下。
 *   await App.shards.light(i)           第 i 块从暗变亮，闪两下
 *   await App.shards.fillCorner()       补上最后一角（金色），Scene 9 用
 *   App.shards.center()                 槽的屏幕中心坐标
 *   App.shards.count / litCount         已收集 / 已点亮的数量
 *
 * 画法：25×25 的像素网格，一格 = 一个 canvas 像素，CSS 里放大 3 倍（pixelated）。
 * 五块碎片是按角度切的五个扇形，边界带一点锯齿，像摔碎的茬口；
 * 圆周上留了一个小缺口，就是"最后一角"。飞行的碎片用同样大小的 canvas，
 * 所以落下去的时候刚好严丝合缝地盖在槽里的对应位置。
 * ========================================================= */
App.state = App.state || {};

App.shards = (function () {
  const U = App.util;
  const N = 5;
  const G = 25;                    // 网格边长
  const CX = 12, CY = 12;          // 圆心所在格
  const R = 11.7;                  // 圆盘半径（格）
  const TAU = Math.PI * 2;

  const fresh = () => Array.from({ length: N }, () => ({ got: false, lit: false }));
  App.state.shards = fresh();
  App.state.shardCorner = false;

  const P = () => App.config.palettes.shards;

  // ---------- 几何：每个格子属于哪块碎片 ----------
  const cells = [];
  (function buildCells() {
    const sec = [];
    for (let y = 0; y < G; y++) {
      sec[y] = [];
      for (let x = 0; x < G; x++) {
        const dx = x - CX, dy = y - CY;
        const r = Math.hypot(dx, dy);
        let s = -1, corner = false;
        if (r <= R && r >= 1.8) {
          let ang = Math.atan2(dx, -dy);                    // 0 = 正上方，顺时针为正
          if (ang < 0) ang += TAU;
          if (r > 8.4 && ang > 0.72 && ang < 1.02) {
            corner = true;                                  // 右上角的小缺口
          } else {
            let a2 = ang + 0.16 * Math.sin(r * 1.15 + ang * 2.0);   // 茬口：边界上叠一点锯齿
            a2 = ((a2 % TAU) + TAU) % TAU;
            s = Math.min(N - 1, Math.floor(a2 / (TAU / N)));
          }
        }
        sec[y][x] = corner ? -2 : s;
      }
    }
    for (let y = 0; y < G; y++) {
      for (let x = 0; x < G; x++) {
        const s = sec[y][x];
        if (s === -1) continue;
        const dx = x - CX, dy = y - CY;
        const r = Math.hypot(dx, dy);
        let edge = false;
        if (s >= 0) {
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([ox, oy]) => {
            const t = (sec[y + oy] || [])[x + ox];
            if (t !== undefined && t >= 0 && t !== s) edge = true;
          });
        }
        cells.push({
          x, y, s,
          corner: s === -2,
          edge,
          rim: r > 10.8,
          label: r <= 4.4,
          groove: (r >= 5.6 && r < 6.3) || (r >= 8.2 && r < 8.9)
        });
      }
    }
  })();

  // ---------- 颜色小工具 ----------
  const cache = {};
  function hex(c) {
    return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  }
  function mix(a, b, t) {
    const key = a + b + t;
    if (cache[key]) return cache[key];
    const A = hex(a), B = hex(b);
    const v = A.map((n, i) => Math.round(n + (B[i] - n) * t));
    return (cache[key] = `rgb(${v[0]},${v[1]},${v[2]})`);
  }

  function cellColor(c, mode) {
    const pal = P();
    if (c.corner) return null;                       // 缺口单独处理
    if (mode === 'empty') {
      if (c.edge) return 'rgba(255,255,255,0.16)';
      if (c.rim) return 'rgba(255,255,255,0.2)';
      return 'rgba(255,255,255,0.05)';
    }
    const col = pal.colors[c.s];
    if (mode === 'dim') {
      if (c.edge) return '#0b0b11';
      if (c.rim) return '#2e2e3c';
      if (c.label) return mix(pal.vinyl, col, 0.24);
      if (c.groove) return pal.vinylGroove;
      return pal.vinyl;
    }
    // lit / flash
    let out;
    if (c.edge) out = mix(col, '#000000', 0.45);
    else if (c.rim) out = mix(col, '#ffffff', 0.2);
    else if (c.label) out = mix(col, '#ffffff', 0.38);
    else if (c.groove) out = mix(col, '#000000', 0.2);
    else out = col;
    return mode === 'flash' ? mix(out, '#ffffff', 0.7) : out;
  }

  /** 画一张圆盘。modes[i]：'empty' | 'dim' | 'lit' | 'flash' | 'off'；corner：'missing' | 'flash' | 'filled' | 'off' */
  function paint(canvas, modes, corner) {
    const g = canvas.getContext('2d');
    g.clearRect(0, 0, G, G);
    const gold = P().gold;
    for (const c of cells) {
      if (c.corner) {
        if (corner === 'filled') g.fillStyle = gold;
        else if (corner === 'flash') g.fillStyle = '#ffffff';
        else if (corner === 'missing' && (c.x + c.y) % 2 === 0) g.fillStyle = 'rgba(255,255,255,0.3)';
        else continue;
      } else {
        const m = modes[c.s];
        if (m === 'off') continue;
        g.fillStyle = cellColor(c, m);
      }
      g.fillRect(c.x, c.y, 1, 1);
    }
  }

  // ---------- 收藏槽 DOM ----------
  let root = null, slot = null, visible = false;
  let flashIdx = -1, cornerFlash = false, epoch = 0;

  function build() {
    if (root) return;
    root = U.el('div', 'shard-slot', document.getElementById('app'));
    slot = U.el('canvas', null, root);
    slot.width = slot.height = G;
    paintSlot();
  }

  function modeOf(i) {
    if (i === flashIdx) return 'flash';
    const s = App.state.shards[i];
    if (!s.got) return 'empty';
    return s.lit ? 'lit' : 'dim';
  }

  function paintSlot() {
    if (!slot) return;
    const modes = [];
    for (let i = 0; i < N; i++) modes.push(modeOf(i));
    paint(slot, modes, cornerFlash ? 'flash' : (App.state.shardCorner ? 'filled' : 'missing'));
  }

  function pulse() {
    if (!root) return;
    root.classList.remove('pulse');
    void root.offsetWidth;                            // 重启动画
    root.classList.add('pulse');
  }

  function show() { build(); paintSlot(); visible = true; root.classList.add('on'); }
  function hide() { if (root) { visible = false; root.classList.remove('on'); } }

  function reset() {
    epoch++;
    App.state.shards = fresh();
    App.state.shardCorner = false;
    flashIdx = -1;
    cornerFlash = false;
    if (root) {
      root.classList.remove('pulse');
      document.querySelectorAll('.shard-fly').forEach((n) => n.remove());
    }
    paintSlot();
  }

  function center() {
    if (!root) return { x: window.innerWidth - 50, y: 90 };
    const r = slot.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // ---------- 动作 ----------
  async function collect(i, o = {}) {
    build();
    if (i < 0 || i >= N || App.state.shards[i].got) return;
    if (!visible) show();
    const my = epoch;
    const lit = o.lit !== false;
    const rect = slot.getBoundingClientRect();
    const tx = rect.left + rect.width / 2, ty = rect.top + rect.height / 2;
    const sx = o.from ? o.from.x : window.innerWidth / 2;
    const sy = o.from ? o.from.y : window.innerHeight * 0.42;

    const fly = U.el('canvas', 'shard-fly', document.getElementById('app'));
    fly.width = fly.height = G;
    const modes = ['off', 'off', 'off', 'off', 'off'];
    modes[i] = lit ? 'lit' : 'dim';
    paint(fly, modes, 'off');
    fly.style.left = rect.left + 'px';
    fly.style.top = rect.top + 'px';
    fly.style.width = rect.width + 'px';
    fly.style.height = rect.height + 'px';

    await U.tween(o.ms || 900, (e, t) => {
      const x = sx + (tx - sx) * e;
      const y = sy + (ty - sy) * e - Math.sin(Math.PI * e) * 70;     // 划一道弧
      const s = 2.8 - 1.8 * e;
      const rot = (1 - e) * 0.7;
      fly.style.transform = `translate(${(x - tx).toFixed(1)}px, ${(y - ty).toFixed(1)}px) rotate(${rot.toFixed(3)}rad) scale(${s.toFixed(3)})`;
    }, U.ease.inOutCubic);
    fly.remove();
    if (my !== epoch) return;

    App.state.shards[i].got = true;
    App.state.shards[i].lit = lit;
    paintSlot();
    pulse();
  }

  async function light(i) {
    build();
    const s = App.state.shards[i];
    if (!s || !s.got || s.lit) return;
    const my = epoch;
    s.lit = true;
    for (let k = 0; k < 2; k++) {
      flashIdx = i; paintSlot();
      await U.sleep(110);
      if (my !== epoch) return;
      flashIdx = -1; paintSlot();
      await U.sleep(80);
      if (my !== epoch) return;
    }
    pulse();
  }

  async function fillCorner() {
    build();
    if (App.state.shardCorner) return;
    const my = epoch;
    App.state.shardCorner = true;
    for (let k = 0; k < 3; k++) {
      cornerFlash = true; paintSlot();
      await U.sleep(110);
      if (my !== epoch) return;
      cornerFlash = false; paintSlot();
      await U.sleep(90);
      if (my !== epoch) return;
    }
    pulse();
  }

  return {
    N, reset, show, hide, collect, light, fillCorner, center,
    get count() { return App.state.shards.filter((s) => s.got).length; },
    get litCount() { return App.state.shards.filter((s) => s.lit).length; },
    get visible() { return visible; }
  };
})();