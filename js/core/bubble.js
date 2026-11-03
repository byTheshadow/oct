/* =========================================================
 * 跟随 3D 物体的像素气泡
 *   const b = App.bubble.create(out => cat.headPos(out));
 *   await b.say('这里……是哪里？', { hold: 1600, voice: 'cat' });
 * 切章时 #world-ui 会被清空，回调也会被 stage.clear() 清掉。
 * ========================================================= */
App.bubble = (function () {
  const U = App.util;

  function create(getWorldPos) {
    const root = U.el('div', 'bubble', document.getElementById('world-ui'));
    const box = U.el('div', 'bubble-box', root);
    const body = U.el('div', 'bubble-body', box);
    U.el('div', 'bubble-tail', box);

    const v = new THREE.Vector3();
    App.stage.onUpdate(() => {
      getWorldPos(v);
      const p = App.stage.project(v);
      root.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    });

    let token = 0;
    async function say(text, { hold = 1600, voice = 'cat', speed = 70 } = {}) {
      const my = ++token;
      body.textContent = '';
      root.classList.add('on');
      await U.typewrite(body, text, { voice, speed, abort: () => my !== token });
      if (my !== token) return;
      await U.sleep(hold);
      if (my === token) root.classList.remove('on');
    }

    function hide() { token++; root.classList.remove('on'); }

    return { say, hide, el: root };
  }

  return { create };
})();
