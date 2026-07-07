# Codex 指令 · 第30批 · 作战海报（五舰主角·套版B配方·带/不带驾驶员各2版）+ hub 去发灰 & 黑市改热气球

> **新开对话执行本单（完全自包含，无需任何旧对话上下文）。** 你负责微信小游戏《星舰小队》的美术生成批次，工具＝内置 `image_gen`。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由下方提示词里的配方词承载。**本批不使用任何参考图**（工具无参考图参数，一切靠文字）。**从零生成，禁止任何图上编辑/后处理。** 提示词照抄勿改词。

## 0. 本批任务与交付规格

- **输出目录（新建）**：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第30批-作战海报+hub去灰黑市热气球\`
- **原始生成副本**：同目录下 `原始生成\`。
- **两段共 8 张**：
  - **A 段·作战海报**：**带驾驶员** prompt 抽 **2 张**（`作战海报-带驾驶员-抽1.png`/`-抽2.png`）+ **不带驾驶员** prompt 抽 **2 张**（`作战海报-无驾驶员-抽1.png`/`-抽2.png`），共 4 张；竖版 9:16 海报。
  - **B 段·主界面 hub**：同一 prompt 抽 **4 张**（`主界面-星港hub-抽1.png`…`-抽4.png`）；竖屏成品界面截图。
- **收尾**：出两张 contact-sheet（`A-作战海报-contact-sheet.png` / `B-hub-contact-sheet.png`）+ 本批说明 md（含每段 prompt 全文与变更点）+ 迁移清单 csv。
- **完成报告**：每张图绝对路径 + 说明 md 路径，Ron 带回验收。

---

## A 段 · 作战海报（新思路·五舰当主角）

> **思路（Ron 拍板）**：五舰做成孤图 sprite 总偏冷、缺糖果味；改**出一张作战海报**，让 5 舰在完整糖果场景里以糖果姿态亮相。**必须体现我方五类星舰各自特点、一眼可分**；**画风套 15 批版 B 复现配方（S1 段逐字沿用）**，保证跟现有海报**同款画风、一看是同一游戏**。标题＝「星舰小队」。带/不带驾驶员各抽 2 张。

### A1 · 作战海报 · 带驾驶员（抽 2）

```text
Vertical 9:16 mobile game promotional poster (key art) for a game called "星舰小队".

Content script: a heroic battle high in bright candy-colored outer space among stars and soft candy nebula. The player's squad of FIVE distinct friendly starships charges forward together in dynamic formation, firing colorful candy projectile crossfire at a swarm of comedic space-pirate raider ships. The FIVE friendly ships are the main subject and must each be clearly distinct and instantly recognizable — each a cute rounded glossy candy-toy spaceship with a rounded bubble cockpit:
1) assault striker 影刃号 — a small zippy pointed craft, candy blueberry-purple hull with bright cyan blade-light, dashing at the front;
2) guard tank 磐石号 — a broad chubby ship with a big glowing blue energy-shield emitter on its front, candy steel-blue and cream-white;
3) artillery 烈阳号 — a stout ship with two big cannon barrels on its back, candy blazing orange and gold;
4) support 晨曦号 — a pure-white rounded ship with two glowing golden halo-ring wings on its sides;
5) engineering 迷雾号 — a plump toy-like gray-purple craft ringed with small mist-nozzle pods and soft lavender mist wisps.
The enemy pirates are cute-menacing rounded candy pirate ships with simple skull markings and little crooked pirate hats (comedic scrappy space pirates, not horror). Plus one protagonist pilot in a key-art hero portrait position: 驾驶员为Q萌儿童体型的Q版形象，但表情、神态、气质像大人一样沉稳自信——童身与大人派头形成反差萌，2-3 heads tall chibi pilot. A bold decorative Chinese title "星舰小队" placed cleanly at the top, readable.

Style direction S1: candy cute chibi toy style, rounded one-piece smooth-shell starships, thick rounded outlines, all characters and units use dark same-hue outlines based on their own colors, no white outlines, big clean color blocks, large complete color surfaces, few and shallow internal seam lines in darker same-hue body colors, no blocky or assembled construction texture, high-saturation mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink, 2-3 heads tall chibi pilot, playful and comfortable for young adult casual players, bright and cheerful, 温馨、温暖、亲切治愈的氛围.

No UI labels, no control annotations, no dense panel lines, no circuit patterns, no honeycomb texture, no fragmented scrap collage, no dark mood, no ocean, no sea surface, no water, no sailing ships.
```

### A2 · 作战海报 · 不带驾驶员（抽 2）

```text
Vertical 9:16 mobile game promotional poster (key art) for a game called "星舰小队".

Content script: a heroic battle high in bright candy-colored outer space among stars and soft candy nebula. The player's squad of FIVE distinct friendly starships charges forward together in dynamic formation, firing colorful candy projectile crossfire at a swarm of comedic space-pirate raider ships. The FIVE friendly ships are the main subject and must each be clearly distinct and instantly recognizable — each a cute rounded glossy candy-toy spaceship with a rounded bubble cockpit:
1) assault striker 影刃号 — a small zippy pointed craft, candy blueberry-purple hull with bright cyan blade-light, dashing at the front;
2) guard tank 磐石号 — a broad chubby ship with a big glowing blue energy-shield emitter on its front, candy steel-blue and cream-white;
3) artillery 烈阳号 — a stout ship with two big cannon barrels on its back, candy blazing orange and gold;
4) support 晨曦号 — a pure-white rounded ship with two glowing golden halo-ring wings on its sides;
5) engineering 迷雾号 — a plump toy-like gray-purple craft ringed with small mist-nozzle pods and soft lavender mist wisps.
The enemy pirates are cute-menacing rounded candy pirate ships with simple skull markings and little crooked pirate hats (comedic scrappy space pirates, not horror). The five starships fill the hero space of the poster. A bold decorative Chinese title "星舰小队" placed cleanly at the top, readable.

Style direction S1: candy cute chibi toy style, rounded one-piece smooth-shell starships, thick rounded outlines, all characters and units use dark same-hue outlines based on their own colors, no white outlines, big clean color blocks, large complete color surfaces, few and shallow internal seam lines in darker same-hue body colors, no blocky or assembled construction texture, high-saturation mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink, playful and comfortable for young adult casual players, bright and cheerful, 温馨、温暖、亲切治愈的氛围.

No UI labels, no control annotations, no dense panel lines, no circuit patterns, no honeycomb texture, no fragmented scrap collage, no dark mood, no ocean, no sea surface, no water, no sailing ships.
```

---

## B 段 · 主界面 hub（抽 4）

> **本段改动（相对29批·两处）**：①**去发灰**——29批背景堆了 "floating weightlessly and dreamily / whimsical / magical" 一串软焦梦幻词=蒙蒙发灰不高清；删掉那堆、背景回 18 批清爽写法、只留一个轻"漂浮"（**不加"调亮/高清"补偿词**，删病因即可）。②**黑市商船改热气球**——29批那只深色海盗船丑且不搭，改成**糖果风可爱热气球**式的黑市飘浮市集、挂在**星港右上角边缘**、名牌仍「黑市商船」。UI 排布＝29批（Ron 已认可）一字不变。

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: Create a real in-game screenshot style UI mockup, not a poster, not a marketing key art. The screen is the starport hub with exactly ten recognizable clickable buildings arranged as a layered triangular starport base, plus one cute black-market hot-air-balloon market floating at the top-right rim.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot. Aim for the palette richness, candy gloss finish, character vibe and liveliness of the locked poster 版B-抽3.

Line treatment: every building, platform and prop keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated shell with at most two or three broad structural seams; platforms, ramps and cliffs are large smooth one-piece color surfaces, not assembled from bricks, stones, tiles or blocks; no rivets, no vents, no grilles, no tiny micro-detail strokes. Buildings must be recognizable by silhouette and color, not by surface detail.

Scene/backdrop: a cozy starport base gently floating in a soft candy nebula sky. The background should support the UI and buildings, not overpower them. Low-detail dreamy stars and clouds, saturation one step lower than foreground.

Residents and liveliness: include 6-10 tiny Q-cute chibi residents (2-3 heads tall, same vibe as the crowd in the reference poster's base corner) walking, chatting, carrying small crates or waving between buildings, plus one or two tiny supply carts. They make the starport feel alive with cozy bustle. Residents are tiny background characters, clearly smaller than building doors, never blocking plaques, buttons or UI.

Core layout: vertical 9:16 mobile screenshot. Top safe area kept clean. Top UI (just below the safe area): at the VERY TOP, a compact currency bar with EXACTLY three labeled resource chips, each showing its Chinese name text: 星贝, 星矿, 补给券. Directly BELOW the currency bar, in the top-left area, sits the 活动 (activity) icon. Bottom-LEFT corner: the mail icon on the far left, then the backpack icon to its right. Bottom-center: a large warm-orange "出战" main button. Bottom-right: a small daily supply gift-box island. The main area in between is a compact, readable starport island. UI should feel like a playable game screenshot with clickable entrances, not a concept painting.

Ten buildings, all visible and individually recognizable:
1. Center triangle lower-left: 船坞, slightly larger, rounded ship-dock building with a small ship platform.
2. Center triangle lower-right: 驾驶员训练舱, slightly larger, cozy training pod building.
3. Center triangle top vertex: 星核展厅, the main visual anchor, glowing star-core showroom above the dock and training bay.
4. Inner ring: 星港补给站, capsule supply station / gacha depot.
5. Inner ring: 商人小站, warm small shop stall.
6. Inner ring near the sortie button: 作战大厅, tactical hall entrance, close to the bottom-right sortie direction.
7. Outer ring: 打捞港, salvage dock with beacon crates.
8. Outer ring: 居住舱, cozy habitat module.
9. Outer ring: 研究塔, slim research tower with soft blue light.
10. Outer ring edge: 深空回廊, a star-gate doorway at the base edge leading into deep space.

Plus one extra floating market (in addition to the ten buildings): at the starport's TOP-RIGHT edge, a cute 黑市商船 (black-market trader) shown as an adorable candy-styled HOT-AIR BALLOON floating at the rim — a rounded candy balloon with a small hanging market basket/gondola of goods, candy-colored and charming with a light touch of mysterious black-market flavor (appealing, never shady or ugly). It has its own small name plaque reading 黑市商船. It floats at the top-right edge as a clickable entrance.

Composition/framing: center triangle must be clear: dock and pilot training bay centered and slightly larger, star-core showroom above them as top vertex. Inner ring buildings cluster closer to the center and sortie button. Outer ring buildings sit at the edge. The layout should resemble a lively polished mobile game hub: many entrances but still readable, with no uniform grid; the sense of richness comes from the number of buildings and the tiny residents, never from surface detail.

UI constraints: only draw these UI elements: top labeled three-chip currency bar (星贝/星矿/补给券) at the very top, the 活动 activity icon just below the currency bar, the bottom-left mail and backpack icons (mail leftmost), the bottom-center 出战 button, the bottom-right daily supply gift box island, building entrance plates and lock states if needed. At most one or two red-dot badges in the whole screen (for example on the mail icon), and never on the daily supply gift box or any ad-related entrance. No extra menus, no bottom avatar bar, no giant title logo, no promotional slogan, no tutorial overlay, no DEV tools.

Rendering constraints: make buildings feel clickable through small entrance pads, soft glow, tiny readable plaques, and consistent rounded UI panels. Chinese text may be minimal and clean; do not invent extra labels beyond the required UI.

Within all the boundaries above, compose and design freely and naturally.

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, brick or stone-block masonry texture, tile or mosaic assembly, mechanical greebles, rivets, vents, grilles, honeycomb texture, circuit patterns, ocean, water, sailing ships, cockpit pilot, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, extra icons, monetization/VIP labels, damage numbers, watermark.
```

---

## 变更点速览（写进本批说明 md）

- **A 作战海报（新思路·五舰主角）**：套 15 批版 B 复现配方（S1 段逐字沿用=同款画风），内容改成"5 类星舰组队冲锋当主角、各展定位一眼可分"（影刃紫莓尖突击/磐石蓝盾扛线/烈阳橙双炮/晨曦白环翼/迷雾紫雾工程）+糖果星盗群+糖果星云；标题「星舰小队」；带驾驶员/不带各抽 2。**海报=立5舰糖果长相+当KV，不直接当俯视sprite用**（后续照定稿长相派生sprite）。
- **B hub（去发灰+黑市热气球）**：①删29批背景那串软焦梦幻词（weightlessly/dreamily/whimsical/magical=发灰真凶）·回18批清爽背景+轻"漂浮"·不加补偿词；②黑市商船→糖果可爱热气球·挂右上角边缘·名牌仍「黑市商船」。UI排布=29批不变。
