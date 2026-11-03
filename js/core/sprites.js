/* =========================================================
 * 像素精灵：用字符画生成 canvas
 *   '.' 透明   O 描边   B 身体   S 阴影   N 鼻子/耳内   E 眼睛   H 高光
 *   （配角另有几个字母，见各自注释；颜色都在 config.palettes 里）
 * 画布四周各留 1 格给外轮廓光，所以 16×16 的猫会生成 18×18 格的画布。
 *
 *   App.sprites.cat('xiaohan')  → { sit, blink, tail, wide }
 *   App.sprites.set('pig')      → 配角的各帧，见下面 SETS
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
    tail: variant(CAT_SIT, [[9, 15, '.'], [12, 15, 'O']]),
    // 瞳孔放大、眼睛一亮（Scene 2.5 和守门猛兽对视）
    wide: variant(CAT_SIT, [
      [6, 3, 'H'], [6, 4, 'E'], [6, 5, 'E'], [7, 3, 'E'], [8, 3, 'E'], [8, 4, 'E'], [8, 5, 'H'],
      [6, 10, 'H'], [6, 11, 'E'], [6, 12, 'E'], [7, 12, 'E'], [8, 10, 'E'], [8, 11, 'E'], [8, 12, 'H']
    ])
  };

  const GRID = CAT_SIT.length + MARGIN * 2; // 18

  // ---------- 配角 ----------

  // 小猪猪，14×12
  const PIG = [
    '..OO......OO..',
    '.OSBO....OBSO.',
    '.OBBBOOOOBBBO.',
    'OBBBBBBBBBBBBO',
    'OBBHEBBBBHEBBO',
    'OBBEEBBBBEEBBO',
    'OBBBNNNNNNBBBO',
    'OBSBNONNONBSBO',
    'OBBBBNNNNBBBBO',
    '.OBBBBBBBBBBO.',
    '.OBSBBBBBBSBO.',
    '..OOOOOOOOOO..'
  ];
  const PIG_BLINK = variant(PIG, [
    [4, 3, 'B'], [4, 4, 'B'], [4, 9, 'B'], [4, 10, 'B'],
    [5, 3, 'O'], [5, 4, 'O'], [5, 9, 'O'], [5, 10, 'O']
  ]);

  // 坏猫：橘色虎斑，眉毛往中间压，半眯眼。T = 虎斑条纹
  const BADCAT = variant(CAT_SIT, [
    [5, 3, 'O'], [6, 4, 'O'], [6, 5, 'O'],
    [5, 12, 'O'], [6, 10, 'O'], [6, 11, 'O'],
    [5, 7, 'T'], [5, 8, 'T'],
    [10, 3, 'T'], [11, 3, 'T'], [10, 12, 'T'], [11, 12, 'T']
  ]);
  const BADCAT_BLINK = variant(BADCAT, [[7, 4, 'O'], [7, 5, 'O'], [7, 10, 'O'], [7, 11, 'O']]);
  const BADCAT_TAIL = variant(BADCAT, [[9, 15, '.'], [12, 15, 'O']]);

  // 守门猛兽：白色大猫兽，20×20。M = 嘴里，W = 獠牙
  const BEAST = [
    '..OO............OO..',
    '.OBBO..........OBBO.',
    '.OBNBO........OBNBO.',
    '.OBNNBOOOOOOOOBNNBO.',
    'OBBBBBBBBBBBBBBBBBBO',
    'OBOOBBBBBBBBBBBBOOBO',
    'OBBBOOBBBBBBBBOOBBBO',
    'OBBHEEBBBBBBBBHEEBBO',
    'OBBEEEBBBBBBBBEEEBBO',
    'OBBBBBBBNNNNBBBBBBBO',
    'OBBBBBBMMMMMMBBBBBBO',
    'OBBBBBBMWMMWMBBBBBBO',
    '.OBBBBBBWBBWBBBBBBO.',
    '..OBBBBBBBBBBBBBBO..',
    '.OBBSBBBBBBBBBBSBBO.',
    'OBBSSBBBBBBBBBBSSBBO',
    'OBBSBBBBBBBBBBBBSBBO',
    'OBBBBBBBBBBBBBBBBBBO',
    'OBOBOBBBBBBBBBBOBOBO',
    'OOOOOOOOOOOOOOOOOOOO'
  ];
  const BEAST_BLINK_EDITS = [
    [7, 3, 'B'], [7, 4, 'B'], [7, 5, 'B'], [7, 14, 'B'], [7, 15, 'B'], [7, 16, 'B'],
    [8, 3, 'O'], [8, 4, 'O'], [8, 5, 'O'], [8, 14, 'O'], [8, 15, 'O'], [8, 16, 'O']
  ];
  // 让开之后：眉毛松开、獠牙收起、嘴变成 w
  const BEAST_SOFT = variant(BEAST, [
    [5, 2, 'B'], [5, 3, 'B'], [5, 16, 'B'], [5, 17, 'B'],
    [6, 4, 'B'], [6, 5, 'B'], [6, 14, 'B'], [6, 15, 'B'],
    [10, 7, 'B'], [10, 9, 'B'], [10, 10, 'B'], [10, 12, 'B'],
    [11, 7, 'B'], [11, 8, 'B'], [11, 11, 'B'], [11, 12, 'B'],
    [12, 8, 'B'], [12, 11, 'B']
  ]);

  // 兔耳，8×8，用小寒的配色，接在头顶
  const EARS = [
    '.OO..OO.',
    'OBBOOBBO',
    'OBNOONBO',
    'OBNOONBO',
    'OBNOONBO',
    'OBNOONBO',
    'OBBOOBBO',
    '.OBBBBO.'
  ];

  // 音符 ♪，7×9。Y = 金色
  const NOTE = [
    '..OOOOO',
    '..OYYYO',
    '..OYOOO',
    '..OYO..',
    '..OYO..',
    'OOOYO..',
    'OHYYO..',
    'OYYYO..',
    'OOOOO..'
  ];

  // 问号砖块的一个面，10×10。D = 问号
  const QBLOCK = [
    'OOOOOOOOOO',
    'OYYYYYYYYO',
    'OYYDDDDYYO',
    'OYDDYYDDYO',
    'OYYYYYDDYO',
    'OYYYYDDYYO',
    'OYYYDDYYYO',
    'OYYYYYYYYO',
    'OYYYDDYYYO',
    'OOOOOOOOOO'
  ];

  // 空唱片套，12×12。D = 中间的空洞
  const SLEEVE = [
    'OOOOOOOOOOOO',
    'OBBBBBBBBBBO',
    'OBSSSSSSSSBO',
    'OBBBOOOOBBBO',
    'OBBODDDDOBBO',
    'OBBODDDDOBBO',
    'OBBODDDDOBBO',
    'OBBODDDDOBBO',
    'OBBBOOOOBBBO',
    'OBBBBBBBBBBO',
    'OBBBBBBBBBBO',
    'OOOOOOOOOOOO'
  ];

  // 配角清单：pal 对应 config.palettes 的键名
  const SETS = {
    pig:    { pal: 'pig',     frames: { sit: PIG, blink: PIG_BLINK } },
    badcat: { pal: 'badcat',  frames: { sit: BADCAT, blink: BADCAT_BLINK, tail: BADCAT_TAIL } },
    beast:  { pal: 'beast',   frames: {
      sit: BEAST,
      blink: variant(BEAST, BEAST_BLINK_EDITS),
      soft: BEAST_SOFT,
      softBlink: variant(BEAST_SOFT, BEAST_BLINK_EDITS)
    } },
    ears:   { pal: 'xiaohan', frames: { sit: EARS } },
    note:   { pal: 'note',    frames: { sit: NOTE } },
    sleeve: { pal: 'sleeve',  frames: { sit: SLEEVE } }
  };

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
  /** 返回 { sit, blink, tail, wide } 各帧 canvas。name 对应 config.palettes */
  function cat(name, scale = 4) {
    const key = name + '@' + scale;
    if (cache[key]) return cache[key];
    const pal = App.config.palettes[name];
    if (!pal) throw new Error('没有这个配色: ' + name);
    const frames = {};
    for (const k in CAT) frames[k] = render(CAT[k], pal, scale);
    return (cache[key] = frames);
  }

  /** 配角：返回 SETS[name] 里的各帧 canvas */
  function set(name, scale = 4) {
    const key = 'set:' + name + '@' + scale;
    if (cache[key]) return cache[key];
    const def = SETS[name];
    if (!def) throw new Error('没有这个精灵: ' + name);
    const pal = App.config.palettes[def.pal];
    if (!pal) throw new Error('没有这个配色: ' + def.pal);
    const frames = {};
    for (const k in def.frames) frames[k] = render(def.frames[k], pal, scale);
    return (cache[key] = frames);
  }

  return { cat, set, render, variant, CAT, SETS, ART: { QBLOCK }, GRID, MARGIN };
})();
