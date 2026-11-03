# 启动包：步骤 2（Scene 2 跳一跳 + Scene 2.5 城堡）

把这份文件、剧本 v4、以及当前项目代码（至少 `js/` 和 `css/`）一起带进新窗口。

## 一、项目现状（步骤 1 已完成）

已经能跑通：开场提示 → Prologue（黑暗里的两点蓝 + 白团子求救）→ Scene 1（黑猫坐在悬空小岛上，路块升起，小猫蹦上去）→ 施工中占位章节 → 从头再来。

## 二、相对剧本 v4 的设定变更

**主角从像素小人改成像素小猫**：小寒是黑猫（琥珀色眼睛），白团子是白猫（蓝眼睛），白团子比小寒矮一点。原剧本里依赖"人形 + 猫耳"的地方改成：

| 原剧本 | 改为 |
|---|---|
| Scene 1 连点十下冒出黑猫耳 | 连点十下炸毛 + "喵？"（已实现） |
| Scene 2 集满音符冒出兔耳 | 不变：小黑猫头上短暂冒出一对兔耳 |
| Scene 2.5 守门时小人冒出猫耳，猛兽先眨眼 | 小黑猫瞳孔放大、眼睛一亮，猛兽先眨眼 |
| 猛兽外形 | 建议做成白色大猫兽（白团子的另一面），蓝眼睛 |
| Scene 9 小寒头上冒出黑猫耳 | 两只猫的尾巴勾在一起（待定） |

## 三、架构约定

- **不用 ES modules**：全部是普通 `<script>`，挂在全局 `App` 命名空间下，按 `index.html` 里的顺序加载。新场景文件加在 `js/scenes/`，并在 `index.html` 里 `todo.js` 之前引入。
- **three.js r149 全局版**，放在 `lib/three.min.js`。代码兼容 r149–r159。
- **颜色管理已关闭**：写什么 hex 就显示什么颜色。
- **明暗靠烘焙**：`stage.shadedMesh()` 按面朝向算顶点色，不用灯光。
- **饱和度**：CSS `saturate()` 滤镜作用在 `#stage` 上。`#overlay` 和 `#dialog-layer` 不受影响。
- **章节顺序**：`config.flow`。新章节插在 `'todo'` 前面，并在 `config.chapters` 里配饱和度、BGM 清晰度、背景色。
- **文案全部放 `config.text`**，场景代码里不写死台词。

## 四、已有模块速查

```js
// 章节
App.director.register(id, { enter(ctx){}, exit(){} })
ctx.alive()   // 每次 await 后检查，章节已切走就 return
ctx.next()

// 舞台（等距正交相机，相机方向 (1,1,1)）
App.stage.layers.far / mid / near     // 三层视差，mid 不动
App.stage.onUpdate((dt, t) => {})     // 返回取消函数；切章自动清空
App.stage.focus(vec3, instant, k)     // 相机平滑跟随
App.stage.setView(h)                  // 画面可见高度（世界单位）
App.stage.project(vec3) → {x, y}      // 世界坐标 → 屏幕像素
App.stage.island({ w, d, h, depth, color, cap, under })  // 顶面在 y=0
App.stage.shadedMesh(geometry, color)
App.stage.addGlows([{ color, size, pos, opacity, stretch, blend, amp, speed }], layer)
App.stage.addParticles({ count, area, color, size, opacity, speed, layer })
App.stage.pixelTexture(canvas)
App.stage.el                          // 画布容器，监听点击用
// 世界方向：-x/-z 对角线 = 屏幕正上方；(1,0,-1) = 屏幕右

// 小猫
const c = new App.Cat('xiaohan' | 'baituanzi', 高度).addTo(App.stage.layers.mid).setPosition(x, y, z)
c.hopTo(vec3, ms, 跳高)  c.hopInPlace()  c.blink()  c.flick()  c.tilt(±1)  c.puff()
c.hit(clientX, clientY)  c.headPos(out)  c.idle = false  // 关掉随机眨眼甩尾

// 像素图
App.sprites.render(字符画数组, 配色) → canvas
App.sprites.variant(底图, [[行, 列, 字符], ...])

// UI
await App.dialog.say(lines, { name, voice: 'bt' })   // lines: 字符串 或 { text, small:true }
const b = App.bubble.create(out => c.headPos(out)); await b.say(text, { hold })

// 音频
App.audio.coin(i)  // 第 i 个音符，五声音阶递增；填了 SFX_COIN_URL 就用音效文件变调
App.audio.click()  App.audio.whoosh()  App.audio.meow()  App.audio.blip(参数)
App.audio.setClarity(0..1, 秒)

// 倾斜
App.tilt.x / App.tilt.y   // -1..1，已平滑

// 工具
App.util.sleep / tween(ms, fn, ease) / ease / rand / pick / el / typewrite
```

## 五、步骤 2 要做的事

**Scene 2 · 通往城堡的路**（新文件 `js/scenes/scene2.js`）
- 接 Scene 1 结尾：小猫站在最后一个路块上，镜头前方出现城堡剪影
- 跳一跳玩法：长按蓄力（小猫压扁、蓄力条或音调升高），松手起跳，跳远距离和按住时长成正比
- 平台间距不同，跳满 3 格到达城堡门前的岛；每跳一格城堡变近
- 失误：掉下去被软垫弹回原平台，字幕"还没到时候呢"，不会 game over
- 音符金币 ♪ 悬在平台上方，起跳路过吃到，调 `App.audio.coin(i)`
- 问号砖块：顶开弹出代码彩蛋 `if (you.smile) { day++ }`
- 小猪猪、坏猫蹲在远处平台当观众，点了"哼唧"或"喵"（需要新画两个像素精灵）
- 集满音符：画面渗进一抹粉（饱和度和色调稍微变化），小黑猫头上短暂冒出兔耳
- 每跳完一格，白团子在远处小声喊一句（文案进 `config.text.scene2`）

**Scene 2.5 · 城堡门口**（新文件 `js/scenes/scene2_5.js`）
- 守门猛兽（新精灵，建议比小猫大 2 倍）：点屏幕，小黑猫眼睛一亮，猛兽先眨眼，让开
- 城堡里：白团子（`new App.Cat('baituanzi', 1.05)`）抱着空唱片套缩在角落
- 白团子在这里报出名字：之后对话框的 name 用 `config.names.btReal`
- 对话按剧本 v4（"找到你了""公主？我我我……""唱片摔成五块"）
- 转场：城堡地面碎裂，两只猫一起往下坠，镜头跟随，接 Scene 3

**新增配置**：`config.flow` 改成 `['prologue', 'scene1', 'scene2', 'scene2_5', 'todo']`，并补 `chapters` 和 `text`。

## 六、需要注意

- 中低端安卓：同屏光斑不超过约 6 个，不用实时模糊
- 长按蓄力用 `pointerdown` / `pointerup`，记得处理 `pointercancel`
- 新精灵沿用 `App.sprites.render` 的字符画格式，配色写进 `config.palettes`
- 每章结束调用 `ctx.next()`，所有异步流程在 await 后检查 `ctx.alive()`
