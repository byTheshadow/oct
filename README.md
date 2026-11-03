# 一个月 · Side A

送给小寒的互动网页。竖屏手机优先，目标设备安卓 Chrome。

## 开工前：放进 three.js

本项目不走 CDN，需要把 three.js 放进 `lib/`：

1. 浏览器打开 `https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js`
2. 另存为 `lib/three.min.js`

用 r149 是因为它还提供单文件全局版本，而且不会在控制台刷弃用警告。r150 到 r159 也能用，r160 起没有这个文件了。

## 本地预览

浏览器不允许直接双击打开（音频和脚本会受限），要起一个本地服务：

```bash
cd 项目文件夹
python -m http.server 8000
```

电脑浏览器打开 `http://localhost:8000`。手机和电脑连同一个 Wi-Fi，打开 `http://电脑的局域网IP:8000`。

注意：陀螺仪在 `http` 下会被安卓 Chrome 禁用，本地预览时会自动改用手指位置做视差。要测陀螺仪，推到 GitHub Pages（`https`）上测。

调试参数：
- `?scene=scene1`：直接跳到某一章（仍需先点一下开始）
- `?debug`：左上角显示章节、帧率和倾斜值；电脑上按 N 跳到下一章
- 可以组合：`?scene=scene1&debug`

## 部署到 GitHub Pages

1. 把整个文件夹推到一个仓库的 `main` 分支（包括 `lib/three.min.js`）
2. 仓库 Settings → Pages → Source 选 "Deploy from a branch"，分支选 `main`，目录选 `/ (root)`
3. 等一两分钟，地址是 `https://你的用户名.github.io/仓库名/`

发给 ta 时提醒用 Chrome 或系统浏览器打开，不要用微信内置浏览器。

## 改内容

所有文案、颜色、资源路径都在 `js/config.js`：
- `BGM_URL`：橘子海 Orange Ocean 的音频，放进 `audio/` 后填路径。必须同域，否则闷音滤镜会让它没声音
- `SFX_COIN_URL`：可选的金币音效
- `PHOTO_URLS`：8 张照片
- `text`：每一章的台词
- `palettes`：两只猫的配色
- `chapters`：每章的饱和度和 BGM 清晰度

## 文件结构

```
index.html
css/main.css
js/config.js          资源占位 + 文案
js/core/              共用模块（舞台、音频、对话框、猫……）
js/scenes/            每章一个文件
js/main.js            启动
lib/three.min.js      需要自己放
audio/  img/          音频、照片
```
