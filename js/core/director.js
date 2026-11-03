/* =========================================================
 * 章节管理
 *   App.director.register('scene1', { enter(ctx) {...}, exit() {...} })
 *   ctx.alive()  这一章还在不在（异步流程里每次 await 之后检查）
 *   ctx.next()   进入 config.flow 里的下一章
 * 切章时：黑场 → exit() → 清空舞台/UI → 设置饱和度、BGM 清晰度 → enter() → 亮场
 * ========================================================= */
App.director = (function () {
  const U = App.util;
  const scenes = {};
  let current = null, currentId = null, token = 0, busy = false;

  function register(id, scene) { scenes[id] = scene; }

  async function go(id) {
    if (busy || !scenes[id]) {
      if (!scenes[id]) console.warn('[director] 没有这一章：', id);
      return;
    }
    busy = true;
    const my = ++token;
    const fade = document.getElementById('fade');

    if (current) {
      fade.classList.add('on');
      await U.sleep(950);
      try { current.exit && current.exit(); } catch (e) { console.error(e); }
    }

    App.stage.clear();
    App.dialog.reset();
    document.getElementById('world-ui').innerHTML = '';
    const ov = document.getElementById('overlay');
    ov.innerHTML = '';
    ov.className = '';

    const ch = App.config.chapters[id] || {};
    App.stage.setSaturation(ch.saturation != null ? ch.saturation : 1);
    App.stage.setVisible(ch.stage !== false);
    if (ch.bg) App.stage.setBackground(ch.bg);
    if (ch.clarity != null) App.audio.setClarity(ch.clarity, 4);

    current = scenes[id];
    currentId = id;
    busy = false;

    const ctx = {
      id,
      alive: () => my === token,
      next: () => { if (my === token) next(); }
    };
    try { current.enter(ctx); } catch (e) { console.error(e); }

    await U.sleep(60);
    fade.classList.remove('on');
  }

  function next() {
    const flow = App.config.flow;
    const i = flow.indexOf(currentId);
    go(flow[(i + 1) % flow.length]);
  }

  return {
    register, go, next,
    get current() { return currentId; }
  };
})();
