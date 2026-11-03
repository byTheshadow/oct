/* =========================================================
 * 陀螺仪倾斜：App.tilt.x / App.tilt.y，范围约 -1..1，已平滑
 * 没有陀螺仪时用手指/鼠标位置兜底。
 * 以第一次读数为"拿手机的自然角度"，之后慢慢跟随，长时间换姿势也不会偏。
 * ========================================================= */
App.tilt = (function () {
  const U = App.util;
  const s = { x: 0, y: 0, tx: 0, ty: 0, hasGyro: false };
  let g0 = null, b0 = null, lastGyro = 0;
  const RANGE = 25; // 倾斜多少度算满幅

  function onOrient(e) {
    if (e.gamma == null || e.beta == null) return;
    if (g0 === null) { g0 = e.gamma; b0 = e.beta; }
    g0 += (e.gamma - g0) * 0.004;
    b0 += (e.beta - b0) * 0.004;
    s.tx = U.clamp((e.gamma - g0) / RANGE, -1, 1);
    s.ty = U.clamp((e.beta - b0) / RANGE, -1, 1);
    s.hasGyro = true;
    lastGyro = performance.now();
  }

  function onPointer(e) {
    if (performance.now() - lastGyro < 1500) return;
    s.tx = U.clamp((e.clientX / innerWidth - 0.5) * 2, -1, 1);
    s.ty = U.clamp((e.clientY / innerHeight - 0.5) * 2, -1, 1);
  }

  function start() {
    window.addEventListener('deviceorientation', onOrient);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onPointer, { passive: true });
  }

  /** iOS 需要授权；安卓 Chrome 直接可用。必须在点击里调用 */
  function requestPermission() {
    const D = window.DeviceOrientationEvent;
    if (D && typeof D.requestPermission === 'function') {
      D.requestPermission().catch(() => {});
    }
  }

  function update(dt) {
    const k = 1 - Math.exp(-6 * dt);
    s.x += (s.tx - s.x) * k;
    s.y += (s.ty - s.y) * k;
  }

  return {
    start, requestPermission, update,
    get x() { return s.x; },
    get y() { return s.y; },
    get hasGyro() { return s.hasGyro; }
  };
})();
