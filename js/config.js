/* =========================================================
 * 配置：资源占位 + 所有文案。改文案只需要改这个文件。
 * ========================================================= */
window.App = window.App || {};

App.config = {
  // ---------- 资源占位 ----------
  // BGM 必须和网页同域（放进 audio/ 文件夹），否则"隔墙闷音"滤镜会让它没声音
  BGM_URL: '',              // 例：'audio/orange-ocean.mp3'
  BGM_VOLUME: 0.8,
  SFX_COIN_URL: '',         // 可选。不填就用代码合成的音符声
  COIN_BASE_HZ: 523.25,     // 合成音符的起始音高（C5）。等 BGM 定了可以调到同调
  PHOTO_URLS: ['', '', '', '', '', '', '', ''],

  FULLSCREEN: true,         // 点击开始时尝试进入全屏

  // Scene 3「字符汇聚成五线谱」那几下的节拍（每分钟多少拍）。
  // 等 BGM 定了，改成 BGM 的速度，视觉上的"鼓点"就能和它对上
  SEA_BPM: 96,

  // ---------- 章节顺序 ----------
  // 'todo' 是施工中的占位章节，之后每一步把新场景插到它前面
  flow: ['prologue', 'scene1', 'scene2', 'scene2_5', 'scene3', 'todo'],

  // 每章的饱和度（0 = 黑白，1 = 全彩）、BGM 清晰度（0 = 隔墙闷音，1 = 完全清晰）、背景色
  chapters: {
    prologue: { saturation: 0,    clarity: 0.0,  stage: false },
    scene1:   { saturation: 0.08, clarity: 0.12, bg: '#0c0c11' },
    scene2:   { saturation: 0.1,  clarity: 0.18, bg: '#0c0c11' },  // 集满音符后会升到 0.36 / 0.3
    scene2_5: { saturation: 0.32, clarity: 0.3,  bg: '#130d12' },
    // Scene 3 整章画在 #overlay 的 2D canvas 上，three 舞台关掉（stage:false），
    // 所以这里的 saturation 不起作用：青紫"渗入"的程度由 codesea 的 mix 自己控制
    scene3:   { saturation: 0.4,  clarity: 0.38, bg: '#070912', stage: false },
    todo:     { saturation: 0.32, clarity: 0.3,  bg: '#08080b' }
  },

  // ---------- 像素配色 ----------
  // O 描边 / B 身体 / S 阴影 / N 鼻子和耳内 / E 眼睛 / H 眼睛高光 / rim 外轮廓光
  // 配角另有：T 虎斑条纹、M 嘴里、W 獠牙、Y 金色、D 深色
  palettes: {
    xiaohan: {   // 小寒：黑猫，琥珀色眼睛
      O: '#060609', B: '#25252e', S: '#191920', N: '#6b4652',
      E: '#f0c04e', H: '#fff7dc', rim: 'rgba(205,205,230,0.55)'
    },
    baituanzi: { // 白团子：白猫，蓝眼睛
      O: '#56637a', B: '#f6f7fb', S: '#d5dae6', N: '#f4a7b6',
      E: '#5cb6ff', H: '#ffffff', rim: 'rgba(160,210,255,0.35)'
    },
    pig: {       // 小猪猪
      O: '#5a2f3a', B: '#f6b3c3', S: '#e48ea4', N: '#d9718b',
      E: '#2a1418', H: '#ffffff', rim: 'rgba(255,190,210,0.35)'
    },
    badcat: {    // 坏猫：橘色虎斑，绿眼睛
      O: '#1d1611', B: '#c88a4e', S: '#a4693a', N: '#e7a0a0', T: '#8d5528',
      E: '#7cc75a', H: '#f2ffe0', rim: 'rgba(255,210,160,0.35)'
    },
    beast: {     // 守门猛兽：白色大猫兽，蓝眼睛（白团子的另一面）
      O: '#46516b', B: '#f3f5fa', S: '#cdd4e3', N: '#f4a7b6', M: '#2b3042', W: '#ffffff',
      E: '#4aa8ff', H: '#ffffff', rim: 'rgba(160,210,255,0.38)'
    },
    note:       { O: '#5a3d0e', Y: '#ffd35c', H: '#fff7d0', rim: 'rgba(255,214,110,0.5)' },  // 音符 ♪
    qblock:     { O: '#5b3a12', Y: '#f2b83a', D: '#7a4a12' },   // 问号砖块
    qblockUsed: { O: '#3d2a14', Y: '#8a6b45', D: '#8a6b45' },   // 顶开以后
    sleeve:     { O: '#2a2a35', B: '#d8c9a6', S: '#b8a682', D: '#121218', rim: 'rgba(255,240,210,0.3)' }, // 空唱片套
    pad:        { body: '#efe2ec', cap: '#f7d3e1' },             // 接住小猫的软垫
    castle: {
      wall: '#cfd0da', tower: '#c3c4cf', roof: '#7f88b6', trim: '#a9abb9',
      door: '#1d1c26', doorway: '#f7e8c6', window: '#ffe7a8', flag: '#f2a5bf'
    },
    room: {      // 城堡里面
      floorA: '#d9d5df', floorB: '#c8c3d1', wall: '#8e8aa2', moon: '#d9e8ff', banner: '#f2a5bf'
    },

    // Scene 3 代码海洋（codesea.js）：字符的四种底色 + 背景
    sea: {
      gray: '#c9d3e8', cyan: '#56f0e0', purple: '#a98cff', white: '#ffffff',
      bg: '#070912', glowCyan: '#2fd8d0', glowPurple: '#7a55ff'
    },
    // 唱片碎片收藏槽（shards.js）：五块碎片各一个颜色，黑胶底色，补上最后一角的金色
    shards: {
      colors: ['#6cc4ff', '#b08cff', '#4fe0c8', '#ff9ccf', '#ffd35c'],
      vinyl: '#1a1a24', vinylGroove: '#262633', gold: '#ffe28a'
    }
  },

  names: {
    bt: '？？？',        // Scene 2.5 之前白团子还没报名字
    btReal: '白团子'
  },

  // ---------- 文案 ----------
  text: {
    gate: '戴上耳机，点一下',

    prologue: [
      '……啊，有人来了。',
      '你好呀。我是……嗯，讲故事的人。',
      { text: '名字先不说啦。', small: true },
      '本来想把这个月好好讲给你听的。但是唱片摔坏了，缺了一角。',
      '我还不小心，掉进最里面的城堡里了……',
      '你能来找我吗？路上有点怪，但是不危险的。'
    ],

    scene1: {
      hint: '（可以戳戳小猫）',
      thoughts: ['这里……是哪里？', '刚才那个声音……在前面？'],
      puff: '喵？'
    },

    // ⚠ 剧本 v4 没带进这个窗口：以下台词按启动包里的关键词先写了一版，对照剧本替换即可
    scene2: {
      see: '那是……城堡？',
      hint: '（按住蓄力，松开就跳）',
      miss: '还没到时候呢',
      calls: [                    // 每跳完一格，白团子在远处小声喊一句（第 3 句在门口）
        '……喂——听得到吗？',
        '对对，就是这边！',
        '到、到门口了吗……'
      ],
      egg: 'if (you.smile) { day++ }',
      pig: '哼唧',
      badcat: '喵',
      bunny: '……？',              // 兔耳缩回去之后
      arrive: '到了。'
    },

    scene2_5: {
      door: '门……在这里。',
      startle: '……！',
      growl: '呜——',
      hint: '（盯住它，点一下屏幕）',
      purr: '呼噜……',
      found: '找到你了。',
      btFirst: ['……诶？', '真、真的找过来了呀。'],
      princess: '你就是……城堡里的公主？',
    flustered: [
        '公主？我我我……',
        '我才不是什么公主啦！',
        { text: '……只是不小心掉进来的。', small: true }
      ],
      namePre: ['啊，还没告诉你我的名字。', '我叫——'],
      name: ['白团子！'],          // 从这一句起对话框显示 names.btReal
      record: [
        '你看，这个。',
        '本来装着一张唱片，这个月的歌全在里面。',
        '可是它摔成五块了……',
        '碎片都掉到城堡下面去了。',
        '你愿意……陪我一起把它们捡回来吗？',
        '每一块，都是这个月里一件很重要的事。',
        { text: '你答对了，它就会亮一下……答错也没关系嘛，我陪你。', small: true }
      ],
      agree: '喵。',
      uhoh: '诶？',
      falling: '哇啊啊——'
    },

    // Scene 3 · 代码海洋。eggs 是漂在海面上的五句彩蛋（剧本原文）；
    // say 是五线谱成形之后，白团子在角落里小声说的那一句
    scene3: {
      hint: '（在海面上划一划）',
      eggs: [
        'if (you.smile) { day++ }',
        'const shadow = "天才程序员";',
        'const 小寒 = new BlackCat();',
        '// 10.08: phone.fallInto(river) 🌊',
        'while (坏猫) { 揉捏(); }'
      ],
      say: '……这里是我写的哦。随便看看啦。'
    },

    todo: {
      lines: [
        '……路还在修啦。',
        { text: '下一段，很快就能走过来了嘛。', small: true }
      ],
      end: '步骤 3 · 第一轮完成',
      replay: '从头再来'
    }
  }
};