/* 预渲染的弥散光贴图（白色径向渐变，用材质颜色染色）。全局共用一张，不要 dispose */
App.glow = (function () {
  let cvs = null, tex = null;

  function canvas() {
    if (cvs) return cvs;
    const s = 128;
    cvs = document.createElement('canvas');
    cvs.width = cvs.height = s;
    const g = cvs.getContext('2d');
    const gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,0.6)');
    gr.addColorStop(0.55, 'rgba(255,255,255,0.14)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    return cvs;
  }

  function texture() {
    if (tex) return tex;
    tex = new THREE.CanvasTexture(canvas());
    tex.userData.shared = true;
    return tex;
  }

  return { canvas, texture };
})();
