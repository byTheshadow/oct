/* =========================================================
 * 对话框（白团子说话用）
 *   await App.dialog.say(lines, { name, voice })
 *   lines 里每一项可以是字符串，或 { text, small:true }（小声）
 *   打字中点一下 = 立刻打完；打完后点一下 = 下一句
 * ========================================================= */
App.dialog = (function () {
  const U = App.util;
  let layer, nameEl, textEl, nextEl;
  let onTap = null;

  function init() {
    layer = document.getElementById('dialog-layer');
    nameEl = layer.querySelector('.dialog-name');
    textEl = layer.querySelector('.dialog-text');
    nextEl = layer.querySelector('.dialog-next');
    layer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (onTap) { const f = onTap; onTap = null; f(); }
    });
  }

  const waitTap = () => new Promise((r) => { onTap = r; });

  async function say(lines, opts = {}) {
    const voice = opts.voice || 'bt';
    nameEl.textContent = opts.name || '';
    layer.classList.add('on');

    for (const line of lines) {
      const L = typeof line === 'string' ? { text: line } : line;
      textEl.className = 'dialog-text' + (L.small ? ' small' : '');
      nextEl.classList.remove('on');

      let skipped = false;
      onTap = () => { skipped = true; };
      await U.typewrite(textEl, L.text, { voice: L.small ? null : voice, skip: () => skipped });
      onTap = null;

      nextEl.classList.add('on');
      await waitTap();
      App.audio.blip(App.audio.voices.tap);
    }

    nextEl.classList.remove('on');
    layer.classList.remove('on');
    await U.sleep(250);
  }

  /** 切章时调用 */
  function reset() {
    onTap = null;
    if (layer) {
      layer.classList.remove('on');
      nextEl.classList.remove('on');
      textEl.textContent = '';
    }
  }

  return { init, say, reset };
})();
