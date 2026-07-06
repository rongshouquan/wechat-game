# Codex 指令 · 第26批 · 装配治黄 + 我方五舰太空战机重出 + hub 外太空复验

> **新开对话执行本单（完全自包含，无需任何旧对话上下文）。** 你负责微信小游戏《星舰小队》的美术生成批次，工具＝内置 `image_gen`。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由下方各段提示词里的配方词承载。**本批不使用任何参考图**（工具无参考图参数，一切靠文字）。**从零生成，禁止任何图上编辑/后处理。** 提示词照抄勿改词。

## 0. 本批任务与交付规格

- **输出目录（新建）**：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第26批-装配治黄+五舰太空战机+hub外太空复验\`
- **原始生成副本**：同目录下 `原始生成\`。
- **三段共 23 张**：
  - **A 段·单舰装配页**：同一 prompt 抽 **4 张**，命名 `装配页-抽1.png`…`装配页-抽4.png`。
  - **B 段·我方五舰单体 sprite**：5 舰各自 prompt、**每舰抽 3 张**（共 15 张），命名 `我方-突击-影刃号-抽1.png`…`-抽3.png`，其余四舰同理（`我方-护卫-磐石号-抽N` / `我方-炮击-烈阳号-抽N` / `我方-支援-晨曦号-抽N` / `我方-工程-迷雾号-抽N`）。
  - **C 段·主界面 hub**：同一 prompt 抽 **4 张**，命名 `主界面-星港hub-抽1.png`…`-抽4.png`。
- **收尾**：出三张 contact-sheet（`A-装配-contact-sheet.png` / `B-五舰-contact-sheet.png` / `C-hub-contact-sheet.png`）+ 本批说明 md（含每段 prompt 全文与变更点）+ 迁移清单 csv。
- **完成报告**：每张图绝对路径 + 说明 md 路径，Ron 带回验收。
- **朝向/底色**：A 段=竖屏成品界面截图；B 段=浅冷灰实底（本批为设计测试，不抠图不净底），我方机头朝上；C 段=竖屏成品界面截图。

---

## A 段 · 单舰装配页（抽 4）

> 基底＝第20/22批装配页原词，动三刀：①**治黄**——机库从"暖象牙金+暖光"改"清爽奶白+天蓝通透日光"、加"避免整体偏黄/琥珀"守卫（给稳定冷锚，不删暖靠环境治）；②**治笑过头**——表情删"自信坏笑+抬下巴"，改"淡定沉稳、至多一抹极浅闭嘴微笑"，反差萌靠姿态撑；③**写死朝向**——机头朝左下、驾驶员站舰右前（附录B B0.8 公约）。头身比沿用 2-2.5。

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", single starship loadout page
Primary request: Create a real in-game screenshot style single-ship loadout page. The exam point is harmony between the large starship, the pilot standing beside it, and the UI panels in one coherent mobile game screen, kept in a fresh, clean, bright tone.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, warm bright friendly UI, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Keep the whole image fresh, clear and airy; avoid an overall yellow, amber or sepia color cast; avoid muddy, clashing or overly dark color combinations.

Line treatment: the starship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural separation seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights. The same line rule applies to the hangar environment and all props.

Scene/backdrop: a bright, airy starship hangar bay in clean cream-white and cool sky-blue tones under fresh clear daylight, with a big window view of candy nebula space acting as a cool color anchor. The environment is crisp and fresh — NOT a warm amber room, NOT a dark military garage. Hangar props stay minimal: at most a few large rounded soft containers, no stacks of small blocky crates, no busy machinery walls; the floor maintenance pad is large smooth color rings, not small tiles.

Main subject: one large C-position friendly starship shown as a polished 3/4 view on a circular maintenance pad, with its NOSE pointing toward the lower-left of the frame. The starship has a smooth integrated shell, rounded swept wings, a closed cockpit canopy, glossy enamel-like metal, softly glowing engine nozzles, no face, no eyes, no mouth, no blocky assembly texture. It looks like a collectible heroic spaceship, not a cockpit scene.

Pilot: a Q-cute child-body pilot standing at the ship's front-right / lower-right, strictly 2 to 2.5 heads tall — big head, small short body. 表情、神态像成熟老练的舰长一样淡定沉稳——童身与大人派头形成反差萌。The pilot's expression must read calm, composed and quietly assured, like a seasoned veteran captain: steady mild eyes, a relaxed level chin, at most a faint subtle closed-mouth smile. Absolutely NOT a smirk, NOT a grin, NOT chin lifted high, NOT laughing, NOT wide sparkling innocent eyes, NOT a baby smile. The maturity shows through calm composure and a relaxed commanding posture (arms crossed, or hands clasped behind the back), never through a big confident smile. Still warm and charming in the candy-cute style, never cold or grim. The pilot stands on the hangar floor beside the ship as a character illustration — not sitting, not inside the ship, not in an open cockpit.

UI layout: vertical 9:16 mobile screenshot. Top area has a compact title/status strip. Middle hero area: starship centered large, pilot standing beside it at front-right. Right or lower-middle has a plugin-slot panel with three plugin slots, one star-core slot, and one pilot slot indicator. Include a clear power card / battle power badge with a large number-like display. Bottom has a restrained action bar with equip/return style buttons. UI panels are cream-white rounded panels with soft trim, glossy and readable, and must not cover the ship and pilot.

UI constraints: draw only loadout-related UI: title/status strip, slot panel, power card, bottom action buttons. No unrelated hub icons, no battle controls, no gacha panels, no bottom avatar strip, no giant title logo, no tutorial overlay, no DEV tools.

Within all the boundaries above, compose and design freely and naturally.

Avoid: overall yellow/amber/sepia color cast, warm amber room lighting, pilot sitting in a cockpit, pilot inside open cockpit, open canopy with person inside, pilot as a giant portrait separated from the ship, baby face, wide sparkling innocent eyes, big grin, smirk, flat wireframe UI, dark cyberpunk hangar, gritty realism, mechanical greebles, panel lines, rivets, vents, grilles, blocky crate stacks, brick or tile textures, muddy clashing colors, excessive text, watermark, poster composition.
```

---

## B 段 · 我方五舰单体 sprite（每舰抽 3）

> **本段目标（关键）**：24批我方五舰被 Ron 否——太抽象、像徽章/护符，只值四五十分，离敌方 4 单位的八九十分很远。**修法两条铁律**：
> ① **是"太空星舰战机"不是"海船"**：身份词第一句必须是**具体的太空飞行器**（战机/突击机/炮艇式星舰/工程飞行器），**严禁一切海洋/海军船只词**（no boat / ship-of-the-sea / cruiser / frigate / naval vessel / deck / sail）——标志形状母题只当"舰上的一个特征"，不当整舰。
> ② **质感对标装配页里的英雄战机**：五舰要做到装配页/船坞里那种"光洁糖果漆·流线机身·座舱舷窗·尾部引擎"的精致收藏级战机质感（那是八九十分的样子），**不是扁平抽象形状**。
> 五舰各长各的、不搞阵营统一（五个不同定位本就该各异）；画风锚与线条条款五舰共用、照抄。

### B1 · 我方 · 突击舰 · 影刃号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly assault starship 影刃号 (Shadowblade) — a fast front-line strike starfighter that dives at enemies. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starfighter, never an ocean boat): a fast sleek interceptor-type space starfighter with a sharp arrowhead nose and swept blade-shaped wings; a glossy deep-black candy-gloss hull with a clear glowing cockpit canopy and cyan blade-light glowing along the wing edges — agile and cool, yet still glossy, polished and charming, fitting the bright candy world, never grim or edgy-dark. Palette: glossy deep black hull + cyan-blue blade glow, kept harmonious inside the game's bright candy world.

Quality & design-language anchor: match the sleek, glossy, heroic collectible-starfighter quality of the player ships shown in this game's loadout/hangar screens — a polished candy-gloss aerodynamic spaceship with a smooth integrated shell, swept wings, a clear cockpit canopy and softly glowing rear engine nozzles, here seen from a clean pure top-down view. It MUST instantly read as a proper cool spaceship / starfighter — NOT an abstract emblem or badge, NOT a boat, NOT a sailing ship, NOT a naval vessel.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT an abstract emblem.

Within all the boundaries above, design freely and make it heroic and cool.
```

### B2 · 我方 · 护卫舰 · 磐石号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly guard starship 磐石号 (Bastion Rock) — a sturdy protector starship that shields the squad and holds the line. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a broad, sturdy, heavy-armored guardian space starship — a wide rounded aerodynamic spacecraft body with a thick armored forward hull, short stubby wings, a cockpit canopy, and one big glowing blue energy-shield emitter mounted on its front as its signature feature (a hexagonal shield motif is welcome, but only as the shield emitter's shape, NOT as the whole ship). Palette: sturdy deep steel-blue + white armor with glowing shield-blue, kept harmonious inside the game's bright candy world.

Quality & design-language anchor: match the sleek, glossy, heroic collectible-starfighter quality of the player ships shown in this game's loadout/hangar screens — a polished candy-gloss aerodynamic spaceship with a smooth integrated shell, a clear cockpit canopy and softly glowing rear engine nozzles, here seen from a clean pure top-down view. It MUST instantly read as a proper cool spaceship / starship — NOT an abstract emblem, shield-badge or crest, NOT a boat, NOT a sailing ship, NOT a naval vessel.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating shield-emblem.

Within all the boundaries above, design freely and make it dependable and mighty.
```

### B3 · 我方 · 炮击舰 · 烈阳号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly artillery starship 烈阳号 (Blazing Sun) — heavy long-range cannon firepower. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a heavy weapons space starship — an aerodynamic spacecraft body with a cockpit canopy and swept wings, carrying two big cannon barrels mounted along its back / spine as the dominant silhouette feature, with subtle hot glowing barrel cores as body material glow. Palette: blazing orange + gold hull with heated glow accents, kept harmonious inside the game's bright candy world.

Quality & design-language anchor: match the sleek, glossy, heroic collectible-starfighter quality of the player ships shown in this game's loadout/hangar screens — a polished candy-gloss aerodynamic spaceship with a smooth integrated shell, a clear cockpit canopy and softly glowing rear engine nozzles, here seen from a clean pure top-down view. It MUST instantly read as a proper cool spaceship / gunship-type starship — NOT an abstract emblem, NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a bare floating cannon.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose and cannons pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no halo; barrel-core glow stays subtle body material glow, never a charge effect or a shot; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel.

Within all the boundaries above, design freely and make it powerful and imposing.
```

### B4 · 我方 · 支援舰 · 晨曦号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly support starship 晨曦号 (Dawnlight) — it keeps teammates fighting with shields and healing energy. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a graceful, radiant pure-white support space starfighter — a smooth aerodynamic spacecraft body with a cockpit canopy, its signature being two glowing golden halo-ring light-wings arcing gracefully from its sides (the ring-wings are part of the ship's wing structure, not a detached halo). Palette: pure white hull + soft gold and warm light glow, kept harmonious inside the game's bright candy world.

Quality & design-language anchor: match the sleek, glossy, heroic collectible-starfighter quality of the player ships shown in this game's loadout/hangar screens — a polished candy-gloss aerodynamic spaceship with a smooth integrated shell, a clear cockpit canopy and softly glowing rear engine nozzles, here seen from a clean pure top-down view. It MUST instantly read as a proper cool spaceship / starfighter — NOT an abstract emblem, pendant or ornament, NOT a boat, NOT a sailing ship, NOT a naval vessel.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo detached from the ship; the glowing ring-wings stay part of the ship body; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating pendant/ornament.

Within all the boundaries above, design freely and make it graceful and reassuring.
```

### B5 · 我方 · 工程舰 · 迷雾号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly engineering starship 迷雾号 (Mistveil) — a utility craft that blinds and weakens enemies with disruptive mist. One unit only, isolated on a flat background, no scene.

Ship identity (must read clearly as a cool SPACE starship, never an ocean boat): a wide-bodied gray-purple engineering / utility space craft — a broad smooth aerodynamic spacecraft body with a cockpit canopy and short swept wings, ringed with a few small mist-nozzle pods tucked tight along the hull edges; a few SMALL decorative mist wisps hugging tight to the hull edge are part of its identity (keep them subtle and attached, never a big fog cloud). Palette: soft gray-purple + pale lavender glow, kept harmonious inside the game's bright candy world.

Quality & design-language anchor: match the sleek, glossy, heroic collectible-starfighter quality of the player ships shown in this game's loadout/hangar screens — a polished candy-gloss aerodynamic spaceship with a smooth integrated shell, a clear cockpit canopy and softly glowing rear engine nozzles, here seen from a clean pure top-down view. It MUST instantly read as a proper cool spaceship / utility starship — NOT an abstract emblem, disk or amulet, NOT a boat, NOT a sailing ship, NOT a naval vessel.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: ship body plus its small attached mist wisps only — no engine flame plume, no exhaust trail, no big fog cloud, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating disk/amulet.

Within all the boundaries above, design freely and make it mysterious and clever.
```

---

## C 段 · 主界面 hub 外太空复验（抽 4）

> 基底＝**第18批 hub 金标准原词**（Ron 认"鲜艳清澈透亮"的那版），**只动一处**：把背景那句从"糖果星云白天天空"换成"太空中的星港"，并带上第20批验证过有效的守卫句"深邃只属背景、岛体保持明亮温暖"（正是它让20批换成太空后没发灰）。其余（建筑性格词/居民/红点/线条/布局）一字不动。另：18批原词里那句"用附带海报当参考图"因工具无参考图输入=空转，已改写成纯文字风格目标句（保留"配色丰富/糖果光泽/鲜活"这些真正有用的词）。

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: Create a real in-game screenshot style UI mockup, not a poster, not a marketing key art. The screen is the starport hub with exactly ten recognizable clickable buildings arranged as a layered triangular starport base.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot. Aim for the palette richness, candy gloss finish and lively charm of the locked poster 版B-抽3.

Line treatment: every building, platform and prop keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated shell with at most two or three broad structural seams; platforms, ramps and cliffs are large smooth one-piece color surfaces, not assembled from bricks, stones, tiles or blocks; no rivets, no vents, no grilles, no tiny micro-detail strokes. Buildings must be recognizable by silhouette and color, not by surface detail.

Scene/backdrop: the starport base floats in deep, vast outer space — a deep starry night sky with sparse small stars, one distant ringed planet, and soft cloud banks below the island edge. Deepness belongs to the background ONLY: the starport island itself stays bright, warm, vivid and candy-colored, clear and fully readable. Background saturation and detail stay one step lower than the foreground so buildings, plaques and UI remain fully readable.

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

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, brick or stone-block masonry texture, tile or mosaic assembly, mechanical greebles, rivets, vents, grilles, honeycomb texture, circuit patterns, ocean, water, sailing ships, cockpit pilot, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, extra icons, monetization/VIP labels, damage numbers, hazy atmosphere, washed-out gray tones, watermark.
```

---

## 变更点速览（写进本批说明 md）

- **A 装配（治黄+治表情+朝向）**：机库暖调→清爽奶白+天蓝日光+"禁整体偏黄"守卫（20 vs 22批实证：两批颜色词全同，22批发黄真因＝舰体抽到红橙暖色叠暖机库，故治环境给稳定冷锚而非删词）；表情删"自信坏笑+抬下巴"→"淡定沉稳+极浅闭嘴微笑+靠姿态撑反差萌"；写死机头朝左下、人站舰右前（B0.8）。
- **B 五舰（太空战机重出）**：24批身份词写成抽象形状母题→模型出徽章/护符（Ron 否、四五十分）。改：①身份词首句＝具体太空飞行器 + 标志特征降级为舰上特征；②严禁一切海洋/海军船只词；③质感对标装配页英雄战机（座舱/机翼/引擎/糖果漆）；④不搞五舰阵营统一。敌方 4 单位已定稿、本批不重出。
- **C hub（外太空复验）**：底＝18批金标准整版，只把背景换成太空星港 + 带20批亮岛守卫句；"参考图"空转句改写成纯文字风格目标句。与18批金标准并排比"够不够艳丽高透"。
