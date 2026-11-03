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
    createMuteButton();
    await U.sleep(700);
    App.director.go(startId);
  });

  // ---------- 右上角静音按钮（音频解锁之后才出现） ----------
  const ICON_ON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
    '<path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const ICON_OFF =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
    '<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  function createMuteButton() {
    const btn = document.createElement('button');
    btn.id = 'mute-btn';
    btn.type = 'button';
    const paint = () => {
      btn.innerHTML = App.audio.muted ? ICON_OFF : ICON_ON;
      btn.setAttribute('aria-label', App.audio.muted ? '取消静音' : '静音');
    };
    paint();
    // 用 click，且阻止冒泡，避免点按钮时触发舞台上的点击（跳跃蓄力、戳小猫等）
    ['pointerdown', 'pointerup'].forEach((t) => btn.addEventListener(t, (e) => e.stopPropagation()));
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      App.audio.toggleMute();
      paint();
    });
    document.getElementById('app').appendChild(btn);
    requestAnimationFrame(() => btn.classList.add('on'));
  }

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