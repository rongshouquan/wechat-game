# 微信小游戏·原生 Canvas 项目规则（2026-07-11 自全局 CLAUDE.md 第二部分迁出）

> **适用范围**：不用引擎、纯微信小游戏框架＋Canvas 2D 的项目（如 breakout）。用引擎的项目（如《我的星舰小队》＝Cocos Creator）以全局 CLAUDE.md ⚑ 项目段＋项目内文档为准；本文的平台底线（顶部安全区、真机性能自测、画布清晰度适配思路）对引擎项目仍参考适用。
> 基本档案：微信**小游戏**（非小程序）；AppID `wx5809349b6eb8275a`；根目录 `F:\Claude Code\`，每款游戏独立子文件夹。

## 一、项目基本规则

1. `project.config.json`：`compileType` 必须 `"game"`；不要写 `libVersion`。
2. 技术栈：纯微信小游戏框架 + Canvas 2D API；CommonJS（`require`/`module.exports`）；不用第三方库、不用 npm/Webpack/Vite/React/Vue；用 Git。

## 二、真机兼容强制规则

1. **顶部安全区规避（必须）**：顶部刘海屏/状态栏/胶囊按钮区禁止放任何 UI 控件或展示内容（标题、关卡信息、返回/计时/加速/暂停等）。统一用 `wx.getMenuButtonBoundingClientRect()`（或 `statusBarHeight`）算安全偏移，所有顶部栏绘制起始 Y 在偏移之下。建议项目初期封统一工具函数共用。
2. **画布清晰度适配（必须）**：建 canvas 必须按 `pixelRatio` 分配物理像素——`canvas.width/height = screenWidth/screenHeight * pixelRatio`，并 `ctx.scale(pixelRatio, pixelRatio)`，绘制坐标仍按逻辑像素写。否则高清屏画面（美术/文字/UI）会糊、有锯齿（是适配问题非素材问题）。项目初始化阶段就配好。
3. **禁止使用**：`window`/`document`/DOM API；`canvas.addEventListener/removeEventListener`；`localStorage`；浏览器专属 Image/Audio 写法；Node.js 专属 API。
4. 触摸事件统一在 `Main.js` 处理（`wx.onTouchStart/onTouchMove/onTouchEnd`）；各场景只暴露 `onTouchStart/onTouchMove/onTouchEnd`。
5. 画布尺寸用 `wx.getSystemInfoSync().screenWidth/screenHeight`，禁用 `windowWidth/windowHeight`。

## 三、代码质量要求

1. 文件命名统一小写英文 + 下划线；资源路径大小写完全一致。
2. 每个模块职责清晰，不生成无用文件。
3. 所有代码能直接导入微信开发者工具运行；简单、稳定、可维护；优先保证真机可运行（非只模拟器能跑）。

## 四、性能优化硬规则

保证性能良好，防发烫、掉帧、卡顿、耗电快。**每阶段完成后必须关注**：

1. **Canvas 绘制**：减少每帧绘制对象；静态内容用离屏 Canvas 缓存；只重绘变化区域；避免 `shadowBlur` 等高开销特效。
2. **计算**：避免每帧不必要循环/复杂计算；碰撞检测、路径计算做剪枝；粒子受控、动画从简。
3. **定时器/动画**：用 `requestAnimationFrame` 驱动游戏循环，不用 `setInterval` 驱动核心逻辑；场景切换及时清定时器。
4. **内存**：及时释放无用对象/资源；游戏循环内别频繁创建对象（用对象池）；场景销毁清事件监听和引用。
5. **资源加载/目录**：按需加载，不一次性全加载；图片/音频复用；**项目早期就建最终资源目录结构**（如 `assets/characters/ backgrounds/ items/ effects/ ui/`），后续严格按此加载，禁止中途调整目录。

**自测标准：每阶段完成后必须在真机上确认不卡顿、不发烫、帧率稳定。**

## 五、原型与验证优先级

1. **原型优先**：前期用色块和简单 UI，不等美术，先验证玩法是否成立、好不好玩。
2. **数据驱动**：种族、宝物、羁绊、关卡等尽量用配置表驱动，调平衡只改配置不改逻辑。
3. **资源占位规范**：原型阶段用色块代美术时，统一占位命名和样式规则（按种族/类型区分颜色、文字标注用途），便于后期替换不遗漏。

## 六、每次开始新游戏前

先输出：① 你理解的项目目标 ② 准备采用的目录结构 ③ 第一阶段做什么 ④ 是否有必须确认的问题。没有必须确认的问题，再开始第一阶段。
