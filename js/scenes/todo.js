/* =========================================================
 * 施工中的占位章节：每完成一步，新场景插到它前面。
 * 最终版本会删掉它。
 * ========================================================= */
App.director.register('todo', {
  enter(ctx) {
    const U = App.util, S = App.stage;
    const T = App.config.text.todo;

    S.setView(10);
    S.focus(new THREE.Vector3(0, 0, 0), true);
    S.addGlows([
      { color: '#ffffff', size: 8, pos: [-2, -3, 1], opacity: 0.08 },
      { color: '#dfe4ff', size: 10, pos: [3, -4, -3], opacity: 0.06 }
    ]);
    S.addParticles({ count: 24, opacity: 0.35 });

    (async () => {
      await U.sleep(1200);
      if (!ctx.alive()) return;
      await App.dialog.say(T.lines, { name: App.config.names.bt, voice: 'bt' });
      if (!ctx.alive()) return;

      const ov = document.getElementById('overlay');
      ov.className = 'active';
      const card = U.el('div', 'end-card', ov);
      U.el('div', 'end-title', card, T.end);
      const btn = U.el('button', 'px-btn', card, T.replay);
      btn.addEventListener('click', () => App.director.go(App.config.flow[0]));
      requestAnimationFrame(() => card.classList.add('on'));
    })();
  }
});
