/* =========================================================
 * Prologue · 黑暗里的声音
 * 纯黑。两点蓝（白团子的眼睛）亮起、眨眼，随陀螺仪轻轻转动。
 * 两点蓝放在不受饱和度影响的 #overlay 里，是整部作品的第一抹颜色。
 * ========================================================= */
App.director.register('prologue', {
  enter(ctx) {
    const U = App.util;
    const ov = document.getElementById('overlay');

    const eyes = U.el('div', 'bt-eyes', ov);
    U.el('div', 'bt-eye', eyes);
    U.el('div', 'bt-eye', eyes);

    // 眼睛跟着手机倾斜看来看去
    App.stage.onUpdate(() => {
      eyes.style.setProperty('--lx', (App.tilt.x * 6).toFixed(2) + 'px');
      eyes.style.setProperty('--ly', (App.tilt.y * 4).toFixed(2) + 'px');
    });

    let blinkTimer = null;
    const blink = () => {
      eyes.classList.add('blink');
      setTimeout(() => eyes.classList.remove('blink'), 140);
      if (Math.random() < 0.25) setTimeout(() => {      // 偶尔连眨两下
        eyes.classList.add('blink');
        setTimeout(() => eyes.classList.remove('blink'), 120);
      }, 280);
      blinkTimer = setTimeout(blink, U.rand(1800, 4200));
    };
    this._cleanup = () => clearTimeout(blinkTimer);

    (async () => {
      await U.sleep(2200);
      if (!ctx.alive()) return;
      eyes.classList.add('on');
      await U.sleep(1800);
      blink();
      await U.sleep(900);
      if (!ctx.alive()) return;

      await App.dialog.say(App.config.text.prologue, { name: App.config.names.bt, voice: 'bt' });
      if (!ctx.alive()) return;

      clearTimeout(blinkTimer);
      eyes.classList.remove('on');
      eyes.classList.add('dim');
      await U.sleep(2600);
      ctx.next();
    })();
  },

  exit() {
    this._cleanup && this._cleanup();
  }
});
