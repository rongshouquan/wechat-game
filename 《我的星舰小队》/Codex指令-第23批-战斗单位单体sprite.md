# Codex 指令 · 第23批 · 战斗单位单体 sprite（我方5舰+无人机 / 星盗4型 · 量产轨第一小批）

> **新开对话执行本单（自包含，无需任何旧对话上下文）。** 背景：你负责微信小游戏《星舰小队》的美术生成批次，工具=内置 image_gen。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由提示词配方词承载。战斗画面管线已改为"**单位单独出图 → 人工挑选 → 程序合成上战场**"：本批=第一步，为 10 个战斗单位各出俯视 sprite 候选。**通过筛选的 sprite 将直接成为正式游戏资产候选**（不是一次性效果图），命名与交付必须严格按本单执行。
> 不使用任何参考图；从零生成；**除本单指定的官方去底脚本外，禁止任何图上编辑/修图/重画/上色**。

## 1. 本批任务

- 输出目录（新建）：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第23批-战斗单位单体sprite\`
- **10 个单位，共 29 张成品**（同一单位同一 prompt 独立抽，只允许自然造型差异）：

| # | 单位 | 阵营 | 机头朝向 | 抽数 | 成品命名 |
|---|---|---|---|---|---|
| 1 | 突击舰 | 我方 | 朝上 | 3 | `我方-突击舰-抽N.png` |
| 2 | 护卫舰 | 我方 | 朝上 | 3 | `我方-护卫舰-抽N.png` |
| 3 | 炮击舰 | 我方 | 朝上 | 3 | `我方-炮击舰-抽N.png` |
| 4 | 支援舰 | 我方 | 朝上 | 3 | `我方-支援舰-抽N.png` |
| 5 | 工程舰 | 我方 | 朝上 | 3 | `我方-工程舰-抽N.png` |
| 6 | 工程无人机 | 我方 | 朝上 | 2 | `我方-无人机-抽N.png` |
| 7 | 星盗小艇 | 星盗 | **朝下** | 3 | `星盗-小艇-抽N.png` |
| 8 | 星盗炮台 | 星盗 | **炮口朝下** | 3 | `星盗-炮台-抽N.png` |
| 9 | 星盗船长（举旗） | 星盗 | **朝下** | 3 | `星盗-船长-抽N.png` |
| 10 | 星盗头目（蓄力炮） | 星盗 | **朝下** | 3 | `星盗-头目-抽N.png` |

- **画布**：正方形画布（先例第02批实测 1254×1254 可行）；单位居中、四周留足安全边距、完整可见不裁切。
- **相对大小不用管**：每张图单位都占满合理画幅即可，小艇不用画小、船长头目不用画大——上战场的相对缩放由后续合成批控制。
- **净底出图**：全部用纯 `#ff00ff` 品红平底（prompt 已写死）。
- **去底后处理（唯一允许的后处理）**：官方脚本 `C:\Users\Administrator\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py`，通用参数 `--key-color '#ff00ff' --soft-matte --opaque-threshold 220 --despill --force`；逐图检查边缘，必要时微调 `--transparent-threshold`（先例第02批用过 18），每图实际参数记进说明 md。
- **废抽规则**：某抽若出现 非正方形 / 背景不纯（渐变、阴影、棋盘格）/ 朝向画反 / 单位不完整 → 该抽作废重抽，**不许修图救**。
- 目录结构：成品透明 PNG 放目录顶层；品红原图放 `原始生成\`（同名加 `-chroma` 后缀）。
- 末尾产出：**29 图 contact-sheet**（把透明成品拼在纯浅灰 `#EEEEEE` 底上、每格标文件名）+ `第23批-说明.md`（10 段 prompt 全文＋每图去底参数表＋变更点速览）+ `迁移清单.csv`。
- 完成后输出完成报告：每张成品绝对路径 + 说明 md 路径，由 Ron 带回验收。
- 提示词照抄勿改词；10 个 prompt 逐个独立执行。

## 2. 完整 Prompt（10 段）

### 2.1 我方 · 突击舰（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single friendly starship: an assault ship — a fast front-line striker that dives at enemies. Design the ship yourself so its look clearly expresses this role. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights; the ship must stay readable at small battle-sprite scale.

The ship is a cute rounded smooth one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the ship.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo under the ship; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.2 我方 · 护卫舰（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single friendly starship: a guard ship — a sturdy protector that shields the squad and holds the line. Design the ship yourself so its look clearly expresses this role. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights; the ship must stay readable at small battle-sprite scale.

The ship is a cute rounded smooth one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the ship.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo under the ship; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.3 我方 · 炮击舰（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single friendly starship: an artillery ship — heavy long-range cannon firepower. Design the ship yourself so its look clearly expresses this role. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights; the ship must stay readable at small battle-sprite scale.

The ship is a cute rounded smooth one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the ship.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo under the ship; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.4 我方 · 支援舰（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single friendly starship: a support ship — it keeps teammates fighting with healing / support energy. Design the ship yourself so its look clearly expresses this role. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights; the ship must stay readable at small battle-sprite scale.

The ship is a cute rounded smooth one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the ship.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo under the ship; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.5 我方 · 工程舰（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single friendly starship: an engineering ship — a utility craft that deploys tiny helper drones in battle. Design the ship yourself so its look clearly expresses this role; do NOT draw the drones in this image, the ship only. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights; the ship must stay readable at small battle-sprite scale.

The ship is a cute rounded smooth one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the ship.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo under the ship; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.6 我方 · 工程无人机（抽2）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a tiny helper drone deployed by the engineering ship — a cute, simple, round little utility craft, clearly simpler and humbler than any starship. One unit only, isolated game asset, no scene.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink.

Line treatment: the drone keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby body color by only 20-30%, never black or dark brown; the body reads as one integrated smooth shell with at most two broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; it must stay readable at very small sprite scale.

The drone is a cute rounded one-piece glossy candy machine: no face, no eyes, no mouth, no pilot, no character.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full body visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the drone.

Hard constraints: pure body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it adorable and functional.
```

### 2.7 星盗 · 小艇（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single enemy unit of the 星盗 (space-pirate) faction: the weak swarm skiff — the smallest and most common pirate chaser; it appears in groups in battle, so keep it simple and instantly readable. A tiny pirate crew figure riding it is welcome. One unit only, isolated game asset, no scene.

Faction look: a rounded pirate raider boat with a skull-like pirate marking as a simple icon, a crooked little pirate hat or a small pirate flag where it fits naturally, menacing-cute and readable, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright and friendly overall finish.

Line treatment: the boat keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; it must stay readable at very small sprite scale.

Composition/framing: pure top-down view, nose pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the unit.

Hard constraints: the unit body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous.
```

### 2.8 星盗 · 炮台（抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single enemy unit of the 星盗 (space-pirate) faction: a rear-line floating gun platform — a stationary pirate weapon emplacement that hangs at the back of the pirate fleet, its guns aimed straight downward. One unit only, isolated game asset, no scene.

Faction look: a rounded pirate weapon platform with a skull-like pirate marking as a simple icon, a crooked little pirate hat or a small pirate flag where it fits naturally, menacing-cute and readable, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright and friendly overall finish.

Line treatment: the platform keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby body color by only 20-30%, never black or dark brown; the body reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; it must stay readable at small sprite scale.

Composition/framing: pure top-down view, gun barrels pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the unit.

Hard constraints: the unit body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no ground, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous.
```

### 2.9 星盗 · 船长（举旗 · 抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single enemy unit of the 星盗 (space-pirate) faction: the pirate captain — a mid-boss unit clearly fancier and more decorated than common pirate boats, with a small pirate captain figure on deck waving a rally flag. The tiny captain figure is required, drawn in the same candy-cute chibi style, charming not scary. One unit only, isolated game asset, no scene.

Faction look: a rounded pirate raider boat with a skull-like pirate marking as a simple icon, a crooked pirate hat and a pirate flag where they fit naturally, menacing-cute and readable, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright and friendly overall finish.

Line treatment: the boat keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; it must stay readable at small sprite scale.

Composition/framing: pure top-down view, nose pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the unit.

Hard constraints: the unit and its deck figure only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no ground, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous and commanding.
```

### 2.10 星盗 · 头目（蓄力炮 · 抽3）

```text
Use case: stylized-concept
Asset type: game asset candidate, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of a single enemy unit of the 星盗 (space-pirate) faction: the pirate chief — the heavy anchor unit of the fleet, visibly charging up a big glowing cannon. Keep the charge glow attached to the cannon muzzle as part of the ship body — a glowing energy core at the muzzle — NOT a separate projectile or beam. A small chief figure on the ship is welcome, candy-cute chibi style. One unit only, isolated game asset, no scene.

Faction look: a rounded pirate raider ship with a skull-like pirate marking as a simple icon, a crooked pirate hat and a small pirate flag where they fit naturally, menacing-cute and readable, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright and friendly overall finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; it must stay readable at small sprite scale.

Composition/framing: pure top-down view, nose and the big cannon pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid #ff00ff chroma-key background for background removal. The background must be one uniform color only — no checkerboard, no transparency grid, no shadow, no gradient, no floor plane, no lighting variation, no texture. Do not use #ff00ff anywhere on the unit.

Hard constraints: the unit and its muzzle glow only — no engine flame plume, no exhaust, no smoke, no separate projectile, no beam, no cast shadow, no ground, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous and imposing.
```

## 3. 变更点速览（写进本批说明 md）

- **管线**：复用第02批色键管线（`#ff00ff` 净底 + 官方 `remove_chroma_key.py` 去底），画布回归正方形 sprite 规格；除去底外零后处理。
- **画风词**：画风锚+线条条款=第22批装配页现行口径；星盗族群词=第22批战斗版（骷髅标记/歪帽/海盗旗/可爱不惊悚/同糖果光泽），不指定颜色。
- **设计自由度**（Ron 2026-07-06 拍板）：每单位只给一句定位职能、造型全放开；**不复用**17R2 的"轮廓+点缀色"分配词（属中间层教画词）。
- **朝向**（Ron 2026-07-06 拍板）：我方机头朝上、星盗机头/炮口**直接朝下**出图（免旋转、全场光影方向一致）。
- **工程无人机=第10单位（总控补充）**：召唤单位是战斗画面既定内容（B1.3），合成批必需；Ron 挑选时可整组否掉。
- 相对大小由合成批控制，sprite 一律占满画幅。
