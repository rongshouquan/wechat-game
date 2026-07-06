# Codex 指令 · 第27批 · 我方五舰补糖果Q萌 + hub 调亮到白天梦幻漂浮

> **新开对话执行本单（完全自包含，无需任何旧对话上下文）。** 你负责微信小游戏《星舰小队》的美术生成批次，工具＝内置 `image_gen`。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由下方各段提示词里的配方词承载。**本批不使用任何参考图**（工具无参考图参数，一切靠文字）。**从零生成，禁止任何图上编辑/后处理。** 提示词照抄勿改词。

## 0. 本批任务与交付规格

- **输出目录（新建）**：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第27批-五舰补糖果Q萌+hub调亮梦幻\`
- **原始生成副本**：同目录下 `原始生成\`。
- **两段共 19 张**：
  - **B 段·我方五舰单体 sprite**：5 舰各自 prompt、**每舰抽 3 张**（共 15 张），命名 `我方-突击-影刃号-抽1.png`…`-抽3.png`，其余四舰同理（`我方-护卫-磐石号-抽N` / `我方-炮击-烈阳号-抽N` / `我方-支援-晨曦号-抽N` / `我方-工程-迷雾号-抽N`）；浅冷灰实底、我方机头朝上。
  - **C 段·主界面 hub**：同一 prompt 抽 **4 张**，命名 `主界面-星港hub-抽1.png`…`-抽4.png`；竖屏成品界面截图。
- **收尾**：出两张 contact-sheet（`B-五舰-contact-sheet.png` / `C-hub-contact-sheet.png`）+ 本批说明 md（含每段 prompt 全文与变更点）+ 迁移清单 csv。
- **完成报告**：每张图绝对路径 + 说明 md 路径，Ron 带回验收。
- **（装配页本批不做——26批已 Ron 全过定稿。）**

---

## B 段 · 我方五舰单体 sprite 补糖果Q萌（每舰抽 3）

> **本段唯一目标**：26批五舰已成功读成"太空飞船"（徽章病治好），但**缺糖果Q萌软萌感**——出成了硬核酷帅尖翼战机，不如本作"捣蛋星盗"敌方单位那种圆滚滚萌。**修法**：给五舰补足糖果软萌（圆润、胖乎乎、糖果玩具感、对标星盗单位的萌度），**同时保留飞船解剖**（座舱舷窗/机翼/尾部引擎）**不许退回徽章**。口诀＝**糖果软萌优先、硬核绝不；但仍是一眼认得出的太空战机**。其余（身份词剖形/配色/线条/朝向/实底）沿用 26批、只把"酷炫战机"锚换成"糖果软萌锚"、并把身份词里的"尖锐 sharp/sleek"软化成"圆润 rounded"。五舰各长各的、不搞阵营统一。

### B1 · 我方 · 突击舰 · 影刃号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly assault starship 影刃号 (Shadowblade) — a fast front-line strike starfighter that dives at enemies. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starfighter, never an ocean boat): a swift interceptor-type space starfighter with a rounded arrowhead nose and softly swept blade-shaped wings; a glossy deep-black candy-gloss hull with a clear glowing cockpit canopy and cyan blade-light glowing along the wing edges. Palette: glossy deep black hull + cyan-blue blade glow, kept harmonious inside the game's bright candy world.

Cuteness anchor (KEY THIS BATCH): make it a cute, chunky, rounded, glossy candy-cute starship — plump, soft and adorable, matching the same candy-cute Q-cute charm level as this game's 捣蛋星盗 pirate enemy units (chunky rounded candy-toy forms). Candy-cute FIRST; do NOT make a sharp aggressive hardcore battle-jet. It must still clearly read as a real spaceship / starfighter — with a rounded cockpit canopy, wings and engine nozzles — cute and chunky, never an abstract emblem or badge, never an ocean boat. Rounded plump glossy candy forms with soft edges, friendly and charming.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT an abstract emblem, NOT a sharp hardcore battle-jet.

Within all the boundaries above, design freely and make it cute, chunky and charming, yet quick.
```

### B2 · 我方 · 护卫舰 · 磐石号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly guard starship 磐石号 (Bastion Rock) — a sturdy protector starship that shields the squad and holds the line. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a broad, sturdy, chunky armored guardian space starship — a wide rounded spacecraft body with a thick armored front, short stubby wings, a rounded cockpit canopy, and one big glowing blue energy-shield emitter mounted on its front as its signature feature (a hexagonal shield motif is welcome, but only as the shield emitter's shape, NOT as the whole ship). Palette: sturdy deep steel-blue + white armor with glowing shield-blue, kept harmonious inside the game's bright candy world.

Cuteness anchor (KEY THIS BATCH): make it a cute, chunky, rounded, glossy candy-cute starship — plump, soft and adorable, matching the same candy-cute Q-cute charm level as this game's 捣蛋星盗 pirate enemy units (chunky rounded candy-toy forms). Candy-cute FIRST; do NOT make a sharp aggressive hardcore battle-jet. It must still clearly read as a real spaceship / starship — with a rounded cockpit canopy, wings and engine nozzles — cute and chunky, never an abstract emblem, shield-badge or crest, never an ocean boat. Rounded plump glossy candy forms with soft edges, friendly and charming.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating shield-emblem, NOT a sharp hardcore battle-jet.

Within all the boundaries above, design freely and make it cute, chunky and dependable.
```

### B3 · 我方 · 炮击舰 · 烈阳号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly artillery starship 烈阳号 (Blazing Sun) — heavy long-range cannon firepower. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a heavy weapons space starship — a chunky rounded spacecraft body with a cockpit canopy and short swept wings, carrying two big rounded cannon barrels mounted along its back / spine as the dominant silhouette feature, with subtle warm glowing barrel cores as body material glow. Palette: blazing orange + gold hull with heated glow accents, kept harmonious inside the game's bright candy world.

Cuteness anchor (KEY THIS BATCH): make it a cute, chunky, rounded, glossy candy-cute starship — plump, soft and adorable, matching the same candy-cute Q-cute charm level as this game's 捣蛋星盗 pirate enemy units (chunky rounded candy-toy forms). Candy-cute FIRST; do NOT make a sharp aggressive hardcore battle-jet. It must still clearly read as a real spaceship / gunship-type starship — with a rounded cockpit canopy, wings and engine nozzles — cute and chunky, never an abstract emblem, never an ocean boat, never a bare floating cannon. Rounded plump glossy candy forms with soft edges, friendly and charming.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose and cannons pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no halo; barrel-core glow stays subtle body material glow, never a charge effect or a shot; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a sharp hardcore battle-jet.

Within all the boundaries above, design freely and make it cute, chunky and mighty.
```

### B4 · 我方 · 支援舰 · 晨曦号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly support starship 晨曦号 (Dawnlight) — it keeps teammates fighting with shields and healing energy. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a gentle, radiant pure-white support space starfighter — a smooth rounded spacecraft body with a cockpit canopy, its signature being two glowing golden halo-ring light-wings arcing softly from its sides (the ring-wings are part of the ship's wing structure, not a detached halo). Palette: pure white hull + soft gold and warm light glow, kept harmonious inside the game's bright candy world.

Cuteness anchor (KEY THIS BATCH): make it a cute, chunky, rounded, glossy candy-cute starship — plump, soft and adorable, matching the same candy-cute Q-cute charm level as this game's 捣蛋星盗 pirate enemy units (chunky rounded candy-toy forms). Candy-cute FIRST; do NOT make a sharp aggressive hardcore battle-jet. It must still clearly read as a real spaceship / starfighter — with a rounded cockpit canopy, wings and engine nozzles — cute and chunky, never an abstract emblem, pendant or ornament, never an ocean boat. Rounded plump glossy candy forms with soft edges, friendly and charming.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo detached from the ship; the glowing ring-wings stay part of the ship body; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating pendant/ornament, NOT a sharp hardcore battle-jet.

Within all the boundaries above, design freely and make it cute, rounded and gentle.
```

### B5 · 我方 · 工程舰 · 迷雾号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly engineering starship 迷雾号 (Mistveil) — a utility craft that blinds and weakens enemies with disruptive mist. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a wide-bodied gray-purple engineering / utility space craft — a broad rounded spacecraft body with a cockpit canopy and short swept wings, ringed with a few small mist-nozzle pods tucked tight along the hull edges; a few SMALL decorative mist wisps hugging tight to the hull edge are part of its identity (keep them subtle and attached, never a big fog cloud). Palette: soft gray-purple + pale lavender glow, kept harmonious inside the game's bright candy world.

Cuteness anchor (KEY THIS BATCH): make it a cute, chunky, rounded, glossy candy-cute starship — plump, soft and adorable, matching the same candy-cute Q-cute charm level as this game's 捣蛋星盗 pirate enemy units (chunky rounded candy-toy forms). Candy-cute FIRST; do NOT make a sharp aggressive hardcore battle-jet. It must still clearly read as a real spaceship / utility starship — with a rounded cockpit canopy, wings and engine nozzles — cute and chunky, never an abstract emblem, disk or amulet, never an ocean boat. Rounded plump glossy candy forms with soft edges, friendly and charming.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: ship body plus its small attached mist wisps only — no engine flame plume, no exhaust trail, no big fog cloud, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating disk/amulet, NOT a sharp hardcore battle-jet.

Within all the boundaries above, design freely and make it cute, chunky and quirky.
```

---

## C 段 · 主界面 hub 调亮到白天 + 梦幻漂浮（抽 4）

> **本段变更（相对26批 hub）**：26批把背景写成 "deep vast outer space / deep starry night sky"＝出成深黑夜空、像天黑了。Ron 要**回18批那种明亮糖果天空（下午/白天感、鲜艳、亮）**，并**新增"漂浮在太空中、轻飘飘、梦幻奇幻漂浮感"**。**只动背景那一段**：删净所有 deep/night/dark/vast 深空词、换成明亮糖果白天天空 + 漂浮梦幻；保留星星+远处行星+漂浮岛让它仍是"太空里的星港"、只是白天亮版。其余（十栋建筑性格词/居民/红点/线条/布局/画风锚）＝18批金标准原样，一字不动。（深黑夜空版不浪费＝留作未来夜间模式皮肤。）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: Create a real in-game screenshot style UI mockup, not a poster, not a marketing key art. The screen is the starport hub with exactly ten recognizable clickable buildings arranged as a layered triangular starport base.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot. Aim for the palette richness, candy gloss finish and lively charm of the locked poster 版B-抽3.

Line treatment: every building, platform and prop keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated shell with at most two or three broad structural seams; platforms, ramps and cliffs are large smooth one-piece color surfaces, not assembled from bricks, stones, tiles or blocks; no rivets, no vents, no grilles, no tiny micro-detail strokes. Buildings must be recognizable by silhouette and color, not by surface detail.

Scene/backdrop: the starport base floats weightlessly and dreamily in a bright, luminous daytime candy sky — soft candy colors of pale blue, mint, cream, soft pink and light lavender, like a bright sunny afternoon. A few soft floating cloud banks, a couple of small floating islets drifting nearby, sparse tiny twinkle-stars and one distant candy-colored planet far off give a gentle "floating in space" feel. The whole scene is airy, magical, whimsical and dreamy, as if the whole base is gently floating and weightless. BRIGHT, clear and vivid — never a dark night sky, never deep black space, never dim. Background saturation and detail stay one step lower than the foreground so buildings, plaques and UI remain fully readable.

Residents and liveliness: include 6-10 tiny Q-cute chibi residents (2-3 heads tall) walking, chatting, carrying small crates or waving between buildings, plus one or two tiny supply carts. They make the starport feel alive with cozy bustle. Residents are tiny background characters, clearly smaller than building doors, never blocking plaques, buttons or UI.

Core layout: vertical 9:16 mobile screenshot. Top safe area kept clean. Top UI has a compact currency bar with three resource chips. Main area is a compact, readable starport island. Bottom UI has a large warm-orange "出战" main button and small backpack, mail, and activity icons. Include a small daily supply gift-box island near the activity area. UI should feel like a playable game screenshot with clickable entrances, not a concept painting.

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

Composition/framing: center triangle must be clear: dock and pilot training bay centered and slightly larger, star-core showroom above them as top vertex. Inner ring buildings cluster closer to the center and sortie button. Outer ring buildings sit at the edge. The layout should resemble a lively polished mobile game hub: many entrances but still readable, with no uniform grid; the sense of richness comes from the number of buildings and the tiny residents, never from surface detail.

UI constraints: only draw these UI elements: top currency bar, bottom sortie button, backpack icon, mail icon, activity icon, daily supply gift box island, building entrance plates and lock states if needed. At most one or two red-dot badges in the whole screen (for example on the mail icon), and never on the daily supply gift box or any ad-related entrance. No extra menus, no bottom avatar bar, no giant title logo, no promotional slogan, no tutorial overlay, no DEV tools.

Rendering constraints: make buildings feel clickable through small entrance pads, soft glow, tiny readable plaques, and consistent rounded UI panels. Chinese text may be minimal and clean; do not invent extra labels beyond the required UI.

Within all the boundaries above, compose and design freely and naturally.

Avoid: dark night sky, deep black space, dim or dark lighting, night-mode look, poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, brick or stone-block masonry texture, tile or mosaic assembly, mechanical greebles, rivets, vents, grilles, honeycomb texture, circuit patterns, ocean, water, sailing ships, cockpit pilot, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, extra icons, monetization/VIP labels, damage numbers, hazy atmosphere, washed-out gray tones, watermark.
```

---

## 变更点速览（写进本批说明 md）

- **B 五舰（补糖果Q萌）**：26批治好徽章病但缺萌、出成硬核酷帅尖翼战机。改：删"sleek/heroic/cool 酷炫战机"堆词、换成"糖果软萌锚"（圆润胖乎乎糖果玩具感·对标本作星盗单位萌度），身份词 sharp/sleek→rounded；**保留飞船解剖不退回徽章**；口诀"糖果软萌优先、硬核绝不、仍是太空战机"。
- **C hub（调亮白天+梦幻漂浮）**：26批 "deep starry night sky" 出成深黑夜空。改：背景删净 deep/night/dark 词、回18批明亮糖果白天天空（保留星星+远行星+漂浮岛=仍太空但白天亮）、加"轻飘飘漂浮+梦幻奇幻感"；Avoid 增夜空/深黑/夜间模式。其余=18批金标准原样。深黑版留作未来夜间皮肤。
