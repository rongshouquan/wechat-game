# Codex 指令 · 第24批 · 五舰+星盗特色测试（9 单位各 1 张 · 实底 · 看设计语言区分度）

> **新开对话执行本单（自包含，无需任何旧对话上下文）。** 背景：你负责微信小游戏《星舰小队》的美术生成批次，工具=内置 image_gen。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由提示词配方词承载。上一批（第23批，已中途叫停）暴露的问题：9 个单位共用同一段画风锚+同一串调色清单、每单位只差一句职能 → 产出全是同一套设计语言换形状，**缺乏单位特色**。本批修法：**每个单位写死《附录D》真源身份词（外形+颜色身份），通用调色清单从锚句移除（颜色随各单位身份走）**。
> 本批是**特色测试批**：每单位只出 1 张、实底不抠图，供 Ron 快速判断设计语言区分度；不是正式资产批。
> 不使用任何参考图；从零生成；禁止任何图上编辑/后处理。

## 1. 本批任务

- 输出目录（新建）：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第24批-五舰星盗特色测试\`
- **9 个单位各 1 张，共 9 图**：

| # | 单位 | 定位 | 机头朝向 | 命名 |
|---|---|---|---|---|
| 1 | 影刃号 | 我方·突击舰 | 朝上 | `我方-突击-影刃号.png` |
| 2 | 磐石号 | 我方·护卫舰 | 朝上 | `我方-护卫-磐石号.png` |
| 3 | 烈阳号 | 我方·炮击舰 | 朝上 | `我方-炮击-烈阳号.png` |
| 4 | 晨曦号 | 我方·支援舰 | 朝上 | `我方-支援-晨曦号.png` |
| 5 | 迷雾号 | 我方·工程舰 | 朝上 | `我方-工程-迷雾号.png` |
| 6 | 星盗艇 | 星盗·前排小怪 | **朝下** | `星盗-星盗艇.png` |
| 7 | 星盗炮台 | 星盗·后排小怪 | **炮口朝下** | `星盗-星盗炮台.png` |
| 8 | 海盗船长 | 星盗·精英(挥旗) | **朝下** | `星盗-海盗船长.png` |
| 9 | 星盗头目 | 星盗·精英(蓄力炮) | **朝下** | `星盗-星盗头目.png` |

- **画布**：正方形画布；单位居中、四周留足安全边距、完整可见不裁切。
- **背景**：统一"纯浅冷灰平底"（prompt 已写死）——**本批不要品红净底、不做去底、不出透明图**。
- 目录结构：9 张成品放顶层；`原始生成\` 保留同名副本。
- 末尾产出：**9 图 contact-sheet**（标文件名）+ `第24批-说明.md`（9 段 prompt 全文＋变更点速览）。
- 完成后输出完成报告：每张图绝对路径 + 说明 md 路径，由 Ron 带回验收。
- 提示词照抄勿改词；9 个 prompt 逐个独立执行。

## 2. 完整 Prompt（9 段）

### 2.1 我方 · 突击舰 · 影刃号

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly assault starship 影刃号 (Shadowblade) — a fast front-line striker that dives at enemies. One unit only, isolated on a flat background, no scene.

True-source identity (must read clearly): jet-black streamlined sharp-lined hull, blade-shaped wings, cool blue blade-light accents along the edges — a fast, sleek assassin feeling. Its palette is led by its own identity: deep black hull + cyan-blue blade glow, kept harmonious inside the game's bright candy world.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship is a rounded one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it heroic and cool.
```

### 2.2 我方 · 护卫舰 · 磐石号

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly guard starship 磐石号 (Bastion Rock) — a sturdy protector that shields the squad and holds the line. One unit only, isolated on a flat background, no scene.

True-source identity (must read clearly): a heavy hexagonal shield-ship — thick rounded armor mass with a clear hexagonal silhouette motif, and one big blue energy-shield element as its signature. Its palette is led by its own identity: sturdy deep blue + steel-white armor with glowing shield blue, kept harmonious inside the game's bright candy world.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship is a rounded one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it dependable and mighty.
```

### 2.3 我方 · 炮击舰 · 烈阳号

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly artillery starship 烈阳号 (Blazing Sun) — heavy long-range cannon firepower. One unit only, isolated on a flat background, no scene.

True-source identity (must read clearly): an orange-gold heavy-cannon ship — double-deck main cannons as the dominant silhouette feature, with hot glowing barrel cores. Its palette is led by its own identity: blazing orange + gold armor with heated glow accents, kept harmonious inside the game's bright candy world.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship is a rounded one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose and cannons pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark. Glowing barrel cores stay attached to the cannons as body glow, not as shots.

Within all the boundaries above, design freely and make it powerful and imposing.
```

### 2.4 我方 · 支援舰 · 晨曦号

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly support starship 晨曦号 (Dawnlight) — it keeps teammates fighting with shields and healing energy. One unit only, isolated on a flat background, no scene.

True-source identity (must read clearly): a pure-white flowing-light ship with ring-shaped light wings — a serene, radiant guardian feeling; the glowing ring wings are its signature silhouette. Its palette is led by its own identity: pure white hull + soft gold and warm light glow, kept harmonious inside the game's bright candy world.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship is a rounded one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo detached from the ship; the glowing ring wings stay part of the ship body; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it graceful and reassuring.
```

### 2.5 我方 · 工程舰 · 迷雾号

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly engineering starship 迷雾号 (Mistveil) — a utility craft that blinds and weakens enemies with disruptive mist. One unit only, isolated on a flat background, no scene.

True-source identity (must read clearly): a gray-purple flat wide hull ringed with small mist nozzles — a mysterious utility feeling. A few SMALL decorative mist wisps hugging tight to the hull edge are part of its identity; keep them subtle and attached, never a big fog cloud. Its palette is led by its own identity: soft gray-purple + pale lavender glow, kept harmonious inside the game's bright candy world.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship is a rounded one-piece glossy candy starship with a closed canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: ship body plus its small attached mist wisps only — no engine flame plume, no exhaust trail, no big fog cloud, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark.

Within all the boundaries above, design freely and make it mysterious and clever.
```

### 2.6 星盗 · 星盗艇（前排小怪）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the enemy unit 星盗艇 — the weakest, most common pirate swarm chaser of the 捣蛋星盗 faction: a scrappy patched-up little pirate boat that attacks in packs; weak alone, scary in numbers. A tiny chibi pirate crew figure riding it is welcome. One unit only, isolated on a flat background, no scene.

Faction look (捣蛋星盗 = comedic scrappy space pirates): rounded pirate boat form, a skull-like pirate marking as a simple icon, a crooked little pirate hat or a small pirate flag where it fits naturally, menacing-cute and funny, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the boat keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at very small sprite scale.

Composition/framing: pure top-down view, nose pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: the unit body (and its tiny crew figure if any) only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous.
```

### 2.7 星盗 · 星盗炮台（后排小怪）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the enemy unit 星盗炮台 — a rear-line stationary pirate gun platform of the 捣蛋星盗 faction: it hides at the back of the pirate fleet and thumps away with its cannon; its gun is aimed straight downward toward the player fleet. One unit only, isolated on a flat background, no scene.

Faction look (捣蛋星盗 = comedic scrappy space pirates): rounded pirate platform form, a skull-like pirate marking as a simple icon, a crooked little pirate hat or a small pirate flag where it fits naturally, menacing-cute and funny, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the platform keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby body color by only 20-30%, never pure black stroke spam; the body reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small sprite scale.

Composition/framing: pure top-down view, gun barrel pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: the unit body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous.
```

### 2.8 星盗 · 海盗船长（精英 · 挥旗）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the enemy elite unit 海盗船长 of the 捣蛋星盗 faction — the rally unit of the pirate fleet: a fancier, more decorated pirate boat with a small chibi pirate captain figure on deck waving a big rally flag. The raised rally flag is the signature read — his flag-wave powers up nearby pirates. The captain figure is required, candy-cute chibi style, charming not scary. One unit only, isolated on a flat background, no scene.

Faction look (捣蛋星盗 = comedic scrappy space pirates): rounded pirate boat form, a skull-like pirate marking as a simple icon, a crooked pirate hat and a pirate flag where they fit naturally, menacing-cute and funny, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the boat keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small sprite scale.

Composition/framing: pure top-down view, nose pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: the unit and its deck figure only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous and commanding.
```

### 2.9 星盗 · 星盗头目（精英 · 蓄力炮）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the enemy elite unit 星盗头目 of the 捣蛋星盗 faction — the heavy-cannon unit of the pirate fleet, visibly charging up a big shot: one oversized cannon with a glowing energy core building up at the muzzle. The brightening muzzle is the signature read ("the glow means a big shot is coming"). Keep the charge glow attached to the muzzle as part of the ship body — NOT a separate projectile or beam. A small chibi chief figure on the ship is welcome, candy-cute style. One unit only, isolated on a flat background, no scene.

Faction look (捣蛋星盗 = comedic scrappy space pirates): rounded pirate ship form, a skull-like pirate marking as a simple icon, a crooked pirate hat and a small pirate flag where they fit naturally, menacing-cute and funny, not horror, with the same clean glossy candy finish as the player starships. Exact design and colors are up to you.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell forms, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small sprite scale.

Composition/framing: pure top-down view, nose and the big cannon pointing straight DOWNWARD, perfectly centered on a square canvas, full unit visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: the unit and its attached muzzle glow only — no engine flame plume, no exhaust, no smoke, no separate projectile, no beam, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; not horror, no gore, no dark war mood.

Within all the boundaries above, design freely and make it charmingly villainous and imposing.
```

## 3. 变更点速览（写进本批说明 md）

- **第23批中途叫停原因（Ron 验收）**：9 单位设计语言同质化——同一画风锚+同一调色清单复制 9 份、每单位只差一句职能，模型输出一套设计语言换形状。
- **本批修法**：①每单位写死《附录D 星舰真源/敌人真源》身份词（外形+颜色身份）；②通用调色清单（mint cyan/sky blue/lemon yellow…枚举）从画风锚移除，颜色一律随单位身份词；③画风锚只保留渲染手法词（软赛璐璐/糖果光泽/一体壳/描边）。
- **我方 5 舰=各定位专属★舰**（影刃/磐石/烈阳/晨曦/迷雾·对齐附录D §6），工程舰职能修正为迷雾号真源（致盲削弱），上批"放无人机"系错引蜂巢号。
- **星盗 4 单位命名对齐敌人真源**：星盗艇/星盗炮台/海盗船长/星盗头目（族群=捣蛋星盗·滑稽反派）。
- **测试规格**：各 1 抽、实底浅冷灰、无净底无抠图；朝向沿用拍板（我方朝上/星盗朝下）。
