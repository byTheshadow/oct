/* =========================================================
 * 配置：资源占位 + 所有文案。改文案只需要改这个文件。
 * ========================================================= */
window.App = window.App || {};

App.config = {
  // ---------- 资源占位 ----------
  // BGM 必须和网页同域（放进 audio/ 文件夹），否则"隔墙闷音"滤镜会让它没声音
  BGM_URL: 'audio/OrangeOcean-Orange-Ocean.mp3',

   BGM_VOLUME: 0.8,
  SFX_COIN_URL: '',         // 可选。不填就用代码合成的音符声
  COIN_BASE_HZ: 523.25,     // 合成音符的起始音高（C5）。等 BGM 定了可以调到同调
  // 8 张星光相框照片：外链地址 + 白团子口吻的小注释（caption 留空则不显示注释条）
  PHOTO_URLS: [
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/w42O/1290X1816/1_%2820%29.jpg/webp', caption: '……呀？你还会画画呀。都不知道你偷偷藏了这一手。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/AzzZ/1290X1839/1_%2815%29.jpg/webp', caption: '今天的大肥猫，是这个样子。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/xJcx/1290X1845/1_%2817%29.jpg/webp', caption: '这天又画了一只大肥猫……圆滚滚的。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/XFac/1290X1819/1_%2818%29.jpg/webp', caption: '大肥猫出场啦，这天就长这样。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/qi20/1290X1871/1_%2819%29.jpg/webp', caption: '这天的你，好像在疑惑着什么呢。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/pKfg/1290X1846/1_%2816%29.jpg/webp', caption: '这天你，变成了一只小兔子。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/5uNz/1290X1881/1_%2814%29.jpg/webp', caption: '长了四个翅膀的坏猫猫……也是你啦。' },
    { url: 'https://txyintdev.tofaka.com/autoupload/amqnh/20261103/sjMt/1290X1821/1_%2813%29.jpg/webp', caption: '被工作压得扁扁的……辛苦啦。' }
  ],

  // 结尾"放映室"（Scene 9 用）：小寒的画作 × 二创剧情小视频。留空的格子不会显示
  VIDEO_URLS: [
    // { title: '', url: '', poster: '' },   // poster = 封面图，可选
    // 默认 4 个位置，不够再加
  ],

  // Scene 8 刮刮卡第二份奖品：炫少画的对小寒的画。留空也能跑，占位图会顶上
  SCRATCH_IMG_URL: '',

  FULLSCREEN: true,         // 点击开始时尝试进入全屏

  // Scene 3「字符汇聚成五线谱」那几下的节拍（每分钟多少拍）。
  // 等 BGM 定了，改成 BGM 的速度，视觉上的"鼓点"就能和它对上
  SEA_BPM: 96,

  // ---------- 章节顺序 ----------
  // 'todo' 是施工中的占位章节，之后每一步把新场景插到它前面
  flow: ['prologue', 'scene1', 'scene2', 'scene2_5', 'scene3', 'scene4', 'scene5', 'scene6', 'scene7', 'scene8', 'scene9', 'todo'],

  // 每章的饱和度（0 = 黑白，1 = 全彩）、BGM 清晰度（0 = 隔墙闷音，1 = 完全清晰）、背景色
  chapters: {
    prologue: { saturation: 0,    clarity: 0.0,  stage: false },
    scene1:   { saturation: 0.08, clarity: 0.12, bg: '#0c0c11' },
    scene2:   { saturation: 0.1,  clarity: 0.18, bg: '#0c0c11' },  // 集满音符后会升到 0.36 / 0.3
    scene2_5: { saturation: 0.32, clarity: 0.3,  bg: '#130d12' },
    // Scene 3 整章画在 #overlay 的 2D canvas 上，three 舞台关掉（stage:false），
    // 所以这里的 saturation 不起作用：青紫"渗入"的程度由 codesea 的 mix 自己控制
    scene3:   { saturation: 0.4,  clarity: 0.38, bg: '#070912', stage: false },
    scene4:   { saturation: 0.45, clarity: 0.44, bg: '#070912', stage: false },
    scene5:   { saturation: 0.6,  clarity: 0.56, bg: '#150d12', stage: false },
    scene6:   { saturation: 0.75, clarity: 0.62, bg: '#120a1c', stage: false },
    scene7:   { saturation: 0.9,  clarity: 0.78, bg: '#070a1c', stage: false },
    scene8:   { saturation: 0.95, clarity: 0.86, bg: '#160c1a', stage: false },
    scene9:   { saturation: 1,    clarity: 0.92, bg: '#05070f', stage: false },
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
    },
    paw: { O: '#4a2533', N: '#ff9ccf', H: '#ffe3ef', rim: 'rgba(255,190,215,0.45)' },

    // Scene 5 暖色光斑背景
    warm: { bg: '#150d12', glows: ['#ff9a6c', '#ffcf7a', '#ff7fa8', '#ffb38a', '#c77dff', '#ffe4a8'] },
    // Scene 6 飞行棋：比 Scene 5 更饱和一点
    board: {
      bg: '#120a1c',
      glows: ['#ff8a5c', '#ffcf5a', '#ff5fa0', '#5ad8ff', '#b36bff', '#7affc0'],
      sky: ['#1a1030', '#3b1f55', '#7b3a6e', '#d9707f', '#ffb98a'],          // 暮色天空，自上而下
      tiles: ['#ff9bb3', '#ffc48a', '#ffe08a', '#b6f0b0', '#8fe0f0', '#b9a6ff'], // 点亮后的格子颜色（循环）
      tileBase: '#fff3ea'                                                     // 没亮时的纸色
    },
    // Scene 7 星空词云：黑夜星空 + 星云光斑
    star: {
      bg: '#070a1c',
      sky: ['#05060f', '#0b1030', '#1b1450', '#3a1d68'],
      glows: ['#5ad8ff', '#b36bff', '#ff5fa0', '#ffcf5a', '#7affc0', '#8fa8ff'],
      star: '#fff4d6', dim: '#aab4e6', gold: '#ffd35c'
    },
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
    // Scene 4 · 五线谱选择题。correct = 正确选项的下标；屏幕上的显示顺序每次都会打乱
scene4: {
  pieceIntro: ['第一块……', '第二块……', '第三块……', '第四块……', '第五块……'],
  questions: [
    { q: '你是什么小动物？', options: ['超级大坏猫', '软乎乎小奶猫', '一只快乐的小猪猪', '黑夜守护神'], correct: 0 },
    { q: '我是什么小动物？', options: ['无敌大猛兽', '呆呆小笨熊', '憨憨大金毛', '稳重老乌龟'], correct: 0 },
    { q: '哪天你的手机掉进了河里？', options: ['10月8日', '10月11日', '10月14日', '10月25日'], correct: 0 },
    { q: '10月23日你惹我小小小小小生气，导致你收获了什么称号？', options: ['一念神魔', '一念成佛', '一念无明', '一念小猫'], correct: 0 },
    { q: '10月26日是个大日子，因为你从猫猫变成了？', options: ['兔子', '小狐狸', '小熊猫', '小鸭子'], correct: 0 }
  ],
  correctSay: '对啦……',
  secretEgg: '……不要告诉别人我是啦',     // 仅第 2 题答对时额外加说
  hint: '（戳一下你的答案）',
  // 答错时白团子的一句。第 1 句是剧本原文，第 2–5 句是新加的；不想要就改成 ''
  wrongSay: ['啊……', '……扁、扁掉了。', '……拼、拼回来了嘛。', '……转、转晕了啦。', '……被揉捏了啦。'],
  // 新加的：五题结束、旋律弹完之后小声说的一句。不想要就改成 ''
  end: '……还差最后一角。留到最后再补上嘛。'
},

    // Scene 5 · Cue Points 时间点
    scene5: {
      book: ['这些是……我记得的日子。', '可是我只记得我这一半嘛。'],
      lockSay: ['这一格……是留给你的。', '你记得的那天，写给我好不好？'],
      dayLabel: '对你来说重要的一天',
      textPlaceholder: '想对那天说的一句话（30 字内）',
      submit: '写好了',
      shotHint: '（截图发给我吧）',
      shotOk: '好了',
      shotNote: '白团子收到啦',
      userCard: '收到。这一天，我也替你记着了。',
      unlock: '……其余的，也可以翻翻看。',
      hint: '（左右滑一滑，戳一戳音符）',
      end: '……我记得的，就这些啦。……未完待续。',
      cards: [
        { m: 10, d: 8,  pages: [{ title: '故事开始。', text: '这一天你的手机掉进了河里，我们也相遇了。', icon: 'phone' }] },
        { m: 10, d: 17, pages: [{ text: '抓大鹅的一天 🪿', icon: 'goose' }, { title: '发现你是绘画大师', text: '手指在手机屏幕上随手一画都那么好，决心收藏你的画作。', icon: 'brush' }] },
        { m: 10, d: 19, pages: [{ text: '那天，你变成了一只小猫。', icon: 'wiltcat' }] },
        { m: 10, d: 21, pages: [{ title: '坏起来了', text: '我尝试对你冷暴力，但是失败了。', icon: 'bad' }, { text: '小猫猫表示疑问 ❓', icon: 'question' }] },
        { m: 10, d: 22, pages: [{ text: '你变成了小猪猪。很萌。', icon: 'pignose' }] },
        { m: 10, d: 23, pages: [{ text: '你惹我小小小小小生气，于是获得称号「一念神魔」。', icon: 'demon' }] },
        { m: 10, d: 26, pages: [{ text: '大日子：猫猫变成了兔子。', icon: 'bunny' }] },
        { m: 10, d: 28, pages: [{ text: '你给我颁发了「面点大师」称号。', icon: 'dough' }] }
      ]
    },
    

    // Scene 6 · 飞行棋。棋盘 = first 起连续 days 格（默认 10月1日 起 33 格 = 到 11月2日）；
    // checkFrom–checkTo 之间的格子会依次亮起（默认 10月8日–10月28日 = 21 天）；target 是目标天数
    scene6: {
      intro: '……接下来，要靠骰子啦。',
      hint: '（点一下骰子）',
      nag: '别点了，结果是注定的。',
      caption: ['我们还一起完成了接近一个月的每日更新打卡——', '期待完成的那一天。'],
      small: '已打卡 {n} 天 · 目标 {t} 天',
      board: {
        cols: 6,
        first: { m: 10, d: 1 }, days: 33,
        checkFrom: { m: 10, d: 8 }, checkTo: { m: 10, d: 28 },
        target: 30
      }
    },

        // Scene 7 · 星空词云 + 照片 + 词频猜猜看
    scene7: {
      intro: '这些，是我偷偷数的……不许笑。',
      quizKicker: '猜猜看',
      quizA: { q: '这个月我（炫少）说得最多的词是？', options: ['代码', '外卖', '咖啡'], correct: 0 },
      quizB: { q: '猜猜你自己说得最多的词是？',     options: ['外卖', '咖啡', '坏猫'], correct: 0 },
      quizRight: '对啦……',
      quizWrongA: '……是代码啦。我说得有点多嘛。',
      quizWrongB: '……是外卖啦。你自己都不知道吗。',
      rankTitleL: '炫少最多的词', rankTitleR: '小寒最多的词',
      rankHint: '(用手指划过星星,把它们点亮)',
      rankShared: '......这个词,我们俩都说了好多遍呢。',
      rankL: [['代码', 17], ['网站', 11], ['喜欢', 10], ['想要', 10], ['程序', 10], ['揉捏', 9], ['游戏', 8], ['兄弟', 8], ['动物', 8]],
      rankR: [['外卖', 9], ['人类', 8], ['坏猫', 6], ['咖啡', 5], ['手机', 5], ['涂鸦', 5], ['成功', 4], ['程序员', 4], ['喜欢', 4], ['炫少', 4]],
      stats: ['这个月我们交互了 1774 次：', '炫少 1038 次，Y 736 次。', '如果我是 AI，这相当于约 1.5 万 Token。'],
      statsTap: '轻点继续',
      cloudHint: '（点一颗星看看）',
      panHint: '(按住拖一拖,星空会跟着动)',
      halfway: '……再点几颗嘛。',
      photoHint: '（有些星星里藏着照片）',
      wish: '......抓到流星了!快许个愿。',
      // 16 颗：字号 = 次数。note 先按白团子口吻写了一版草稿，不满意随时改
      words: [
        { w: '代码', n: 19, note: '我说得最多的一个词……没有之一啦。' },
        { w: '人类', n: 15, note: '呃……是不是不小心说漏了。' },
        { w: '喜欢', n: 14, note: '这个词，我说了很多很多遍呢。' },
        { w: '外卖', n: 11, note: '你说得比我还勤快的一个词。' },
        { w: '想要', n: 11, note: '总有很多很多想要的东西嘛。' },
        { w: '炫少', n: 11, note: '天才程序员 shadow，就是我。……就是我啦。' },
        { w: '网站', n: 11, note: '啊，就是……我们俩一起捣鼓的那个。' },
        { w: '游戏', n: 10, note: '玩起来就不理我了的那个。' },
        { w: '坏猫', n: 10, note: '这个月你最常被点名的身份。' },
        { w: '咖啡', n: 9,  note: '你离不开的续命水，还总喜欢晚上喝咖啡。' },
        { w: '有趣', n: 9,  note: '你总说这个。' },
        { w: '小游戏', n: 9, note: '揉揉捏捏按一按的那种，还有抓大鹅，你很上瘾。' },
        { w: '揉捏', n: 9,  note: '……揉揉搓搓把你做成小面包。' },
        { w: '讨厌', n: 8,  note: '嘴上说讨厌，其实没有很讨厌吧？' },
        { w: '小寒', n: 8,  note: '一只黑色的小猫，就是你。' },
        { w: '蛋糕', n: 8,  note: '很喜欢「面点大师」这个称号呢。' }
      ],
      noteFallback: '……这个，我先不说啦。',
      end: '……Y。是你的名字呀。'
    },


    // Scene 8 · 刮刮卡
    scene8: {
      intro: ['……我准备了一点东西。', { text: '只能刮开两张哦。', small: true }],
      icons: ['☕', '🍱', '💻', '🥟'],
      unchosenText: '这些下次也会兑现',
      scratchHint: '划一划',
      halfway: '……别划我啦，再一下就好。',
      prize1: '希望多贴贴 x1',
      prize2: '炫少画的，画的是你。',
      missIcon: '○',
      missLabel: '……空的，下次一定补给你。',
      end: '……好啦，最后一步啦。'
    },

    // Scene 9 · Outro
    scene9: {
      intro: '……就差最后一块了。',
      record: ['唱片……补好了。', { text: '一直没舍得听的那一面，现在可以听了。', small: true }],
      cats: '走，去看看那片海变成什么样子。',
      end: '……未完待续。',
      sideB: 'Side B —— 未完待续',
      shot: '保存截图',
      replay: '从头再来'
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