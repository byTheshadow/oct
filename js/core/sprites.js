/* =========================================================
 * 像素精灵：用字符画生成 canvas
 *   '.' 透明   O 描边   B 身体   S 阴影   N 鼻子/耳内   E 眼睛   H 高光
 * 画布四周各留 1 格给外轮廓光，所以 16×16 的猫会生成 18×18 格的画布。
 * ========================================================= */
App.sprites = (function () {
  const MARGIN = 1;

  // 坐着的正面小猫，16×16
  const CAT_SIT = [
    '................',
    '...O........O...',
    '..OBO......OBO..',
    '..OBNO....ONBO..',
    '..OBBBOOOOBBBO..',
    '.OBBBBBBBBBBBBO.',
    '.OBBHEBBBBHEBBO.',
    '.OBBEEBBBBEEBBO.',
    '.OBBBBBNNBBBBBO.',
    '..OBBBBBBBBBBO.O',
    '..OBBBBBBBBBBO.O',
    '.OBBBBBBBBBBBBOO',
    '.OBBBBBBBBBBBBO.',
    '.OBBSBBBBBBSBBO.',
    '.OBBSSBBBBSSBBO.',
    '..OOOOOOOOOOOO..'
  ];

  function variant(base, edits) {
    const rows = base.map((r) => r.split(''));
    edits.forEach(([r, c, ch]) => { rows[r][c] = ch; });
    return rows.map((r) => r.join(''));
  }

  const CAT = {
    sit: CAT_SIT,
    // 闭眼
    blink: variant(CAT_SIT, [
      [6, 4, 'B'], [6, 5, 'B'], [6, 10, 'B'], [6, 11, 'B'],
      [7, 4, 'O'], [7, 5, 'O'], [7, 10, 'O'], [7, 11, 'O']
    ]),
    // 甩尾巴
    tail: variant(CAT_SIT, [[9, 15, '.'], [12, 15, 'O']])
  };

  const GRID = CAT_SIT.length + MARGIN * 2; // 18

  function render(map, pal, scale = 4) {
    const W = map[0].length, H = map.length;
    const c = document.createElement('canvas');
    c.width = (W + MARGIN * 2) * scale;
    c.height = (H + MARGIN * 2) * scale;
    const g = c.getContext('2d');
    const solid = (x, y) => y >= 0 && y < H && x >= 0 && x < W && map[y][x] !== '.';

    if (pal.rim) {
      g.fillStyle = pal.rim;
      for (let y = -1; y <= H; y++) {
        for (let x = -1; x <= W; x++) {
          if (solid(x, y)) continue;
          if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
            g.fillRect((x + MARGIN) * scale, (y + MARGIN) * scale, scale, scale);
          }
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const ch = map[y][x];
        if (ch === '.') continue;
        g.fillStyle = pal[ch] || '#ff00ff';
        g.fillRect((x + MARGIN) * scale, (y + MARGIN) * scale, scale, scale);
      }
    }
    return c;
  }

  const cache = {};
  /** 返回 { sit, blink, tail } 三帧 canvas。name 对应 config.palettes */
  function cat(name, scale = 4) {
    const key = name + '@' + scale;
    if (cache[key]) return cache[key];
    const pal = App.config.palettes[name];
    if (!pal) throw new Error('没有这个配色: ' + name);
    const frames = {};
    for (const k in CAT) frames[k] = render(CAT[k], pal, scale);
    return (cache[key] = frames);
  }

  return { cat, render, variant, CAT, GRID, MARGIN };
})();
