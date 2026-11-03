/* =========================================================
 * 启动
 *   ?scene=scene1   直接跳到某一章（仍需点一下开始）
 *   ?debug          左上角显示章节和帧率；电脑上按 N 跳下一章
 * ========================================================= */
(function () {
  const U = App.util;

  if (!window.THREE || !App.stage) {
    document.getElementById('boot-error').hidden = false;
    return;
  }

  App.stage.init(document.getElementById('stage'));
  App.dialog.init();
  App.tilt.start();

  const startId = U.param('scene') || App.config.flow[0];

  // ---------- 开场："戴上耳机，点一下" ----------
  const ov = document.getElementById('overlay');
  ov.className = 'active';
  const hint = U.el('div', 'gate-hint', ov);
  U.el('span', null, hint, App.config.text.gate);
  setTimeout(() => hint.classList.add('on'), 1500);

  // 用 click 而不是 pointerdown：安卓上只有 click/pointerup 才算"用户手势"，全屏和声音才放行
  ov.addEventListener('click', async function start() {
    ov.removeEventListener('click', start);
    const unlocking = App.audio.unlock();
    App.tilt.requestPermission();
    enterImmersive();
    hint.classList.remove('on');
    hint.classList.add('off');

    await unlocking;
    const ch = App.config.chapters[startId] || {};
    App.audio.setClarity(ch.clarity || 0, 0.01);
    App.audio.playBgm(5);
    await U.sleep(700);
    App.director.go(startId);
  });

  // ---------- 全屏 + 竖屏锁定 + 屏幕常亮 ----------
  let wakeLock = null;
  function requestWakeLock() {
    try {
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then((l) => { wakeLock = l; }).catch(() => {});
    } catch (e) { /* 忽略 */ }
  }
  function enterImmersive() {
    if (App.config.FULLSCREEN) {
      const de = document.documentElement;
      try {
        const r = de.requestFullscreen && de.requestFullscreen({ navigationUI: 'hide' });
        if (r && r.then) {
          r.then(() => {
            try {
              if (screen.orientation && screen.orientation.lock) screen.orientation.lock('portrait').catch(() => {});
            } catch (e) { /* 忽略 */ }
          }).catch(() => {});
        }
      } catch (e) { /* 忽略 */ }
    }
    requestWakeLock();
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && wakeLock) requestWakeLock();
  });

  // ---------- 调试 ----------
  if (U.param('debug') !== null) {
    const dbg = document.getElementById('debug');
    setInterval(() => {
      dbg.textContent =
        `${App.director.current || '-'}  ${Math.round(App.stage.fps)}fps\n` +
        `tilt ${App.tilt.x.toFixed(2)}, ${App.tilt.y.toFixed(2)}${App.tilt.hasGyro ? ' (gyro)' : ''}`;
    }, 300);
    window.addEventListener('keydown', (e) => {
      if (e.key === 'n' || e.key === 'N') App.director.next();
    });
  }
})();
