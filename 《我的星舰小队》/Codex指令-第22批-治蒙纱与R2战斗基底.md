# Codex 指令 · 第22批 · 治蒙纱与R2战斗基底（hub / 战斗·星盗场 / 装配页）

> **新开对话执行本单（自包含，无需任何旧对话上下文）。** 背景：你负责微信小游戏《星舰小队》的美术生成批次，工具=内置 image_gen。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由提示词配方词承载。本批三处修正：①hub 治"蒙白纱"（画风锚逐字回滚第18批原句、删除后来加入的怕暗词）；②战斗以第17批R2 提示词为基底照搬（其作战单位为历批最佳），仅做敌人戏份与交火密度增补；③装配页回滚第20批原词、只做驾驶员头身比例一处修改。不使用任何参考图；从零生成；**禁止任何图上编辑/后处理**。

## 1. 本批任务

- 输出目录（新建）：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第22批-治蒙纱与R2战斗基底\`
- 抽数与命名（共 **12 图**）：主界面 **4 抽** `主界面-星港hub-抽N.png`；战斗·星盗场 **4 抽** `战斗界面-星盗场-抽N.png`；单舰装配页 **4 抽** `单舰装配页-抽N.png`。
- 同一 prompt 从零独立抽，只允许自然构图差异；保留 `原始生成\` 副本；末尾出 **12 图 contact-sheet** + 本批说明 md（含 prompt 全文与变更点）。
- 完成后输出完成报告：每张图绝对路径 + 说明 md 路径，由 Ron 带回验收。
- 提示词照抄勿改词。

## 2. 完整 Prompt

### 2.1 主界面·星港 hub（抽4）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: a real in-game screenshot style UI mockup of the starport hub — a starport in outer space. Not a poster, not marketing key art, no title logo.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot.

Line treatment: every building keeps one thick deep clean outer contour; internal seam lines are same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated molded shell with at most two or three broad structural seams; platforms and large surfaces are big smooth one-piece color planes, not assembled from bricks, stones, tiles or blocks.

Must include (content requirements):
1. Ten buildings, each recognizable, each with a small name plaque: 船坞 / 驾驶员训练舱 / 星核展厅 / 星港补给站 / 商人小站 / 作战大厅 / 打捞港 / 居住舱 / 研究塔 / 深空回廊. (Imperfect plaque text is acceptable.)
2. Layout skeleton: 船坞 and 驾驶员训练舱 sit near the center and slightly larger, 星核展厅 above them forming a triangle; the other buildings arranged around them.
3. UI: top safe area kept clean, a compact currency bar below it; at the bottom a large warm-orange "出战" main button plus small backpack, mail and activity icons; a small daily supply gift-box near the activity icon.
4. A few tiny Q-cute chibi residents walking, chatting and working between the buildings.
5. Red-dot badges may appear only on non-ad entrances such as mail; the daily gift box and any ad-related entrance must have NO red dot.

Everything else — the starport's overall form (island, platform, station, anything you like), the entire background (space, clouds, planets, distant islets, anything), building designs, camera framing, density and lighting — is completely up to you. Compose freely and make it beautiful and atmospheric.

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, mechanical greebles, brick or stone-block masonry texture, tile or mosaic assembly, honeycomb texture, circuit patterns, ocean, water, sailing ships, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, monetization/VIP labels, damage numbers, watermark.
```

### 2.2 战斗界面 · 星盗场（抽4 · 基底=第17批R2 战斗词照搬，仅四处增补）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", automatic battle screen
Primary request: Create a real in-game screenshot style battle UI mockup, not a poster. Upper half shows enemy space-pirate ships, lower half shows the player's starship squad. All units float clearly above a soft candy-nebula star background.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starships, thick clean dark same-hue outlines, large clean color planes, bright warm friendly tone.

Line treatment: every ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; each ship reads as one smooth integrated shell with at most two or three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; ships stay readable at small mobile size.

Scene/backdrop: same family as the locked poster background: dreamy candy-colored outer space, soft nebula, stars, pink-purple-blue cloud ribbons. Background saturation is lower than foreground by one step so ships and UI remain readable.

Battle layout: vertical 9:16 mobile screenshot. Top UI: compact current stage information and enemy/allied power chips. Right-lower corner: a small round pause button. No other controls. Enemy side is upper half with 8 to 12 pirate units, naturally scattered on an invisible 5x7 grid, not filling the whole screen, no grid lines. Player side is lower half with EXACTLY five piloted friendly starships in a loose formation on an invisible 3x3 grid, no grid lines. Ships should face the target they are attacking; several ships are visibly angled toward specific enemy ships. Fill the middle space between the two fleets with dense colorful crossfire — beams, missile trails and bolts crossing — plus one small candy-colored burst explosion and one shield flare; keep the battlefield readable and never let effects hide the units.

Friendly unit HUD: above every piloted friendly starship, draw a small pilot head avatar plus a slim HP bar. The pilot appears only as a small top-of-ship avatar; do not place pilots inside cockpits. Summoned drones get only a very small slim HP bar, no avatar. Enemy unit HUD: enemy ships have only slim HP bars, no enemy avatars, no boss portrait in this screen.

Ship design: the five friendly starships are five different ship classes, one of each, with clearly different silhouettes readable at small size:
1) assault ship: slender arrow / dart silhouette, fast forward wedge, rounded nose, red-orange accent;
2) guard ship: broad thick shield-like sturdy silhouette, rounded armor mass, blue-teal accent;
3) artillery ship: long elegant silhouette with one integrated central cannon barrel, yellow-red accent;
4) support ship: rounder body with soft halo-like ring wings, mint-white accent;
5) engineering ship: small carrier silhouette, green-orange accent.
All friendly ships are cute rounded smooth one-piece starships, no faces, no eyes, no mouths.
The engineering ship has deployed two tiny helper drones as independent little units: each drone sits on its own free spot of the invisible player grid nearest to the engineering ship, clearly smaller than any starship, each with its own very small slim HP bar and NO pilot avatar.

Enemy design: rounded pirate raider boats with skull-like pirate markings as simple icons, crooked little pirate hats and small pirate flags, still cute and readable, not horror, with the same clean glossy candy finish as the player ships and the same restrained line treatment. Mix these unit types, each instantly readable: several small pirate skiffs (a swarm of weak little ships toward the front), a couple of gun platforms hanging at the back, one pirate captain waving a rally flag, and one pirate chief charging up a big glowing cannon shot. The captain and the chief are clearly LARGER than the other pirates — the visual anchors of the enemy fleet. Exact designs and colors are up to you.

UI constraints: only draw the top stage/power UI, per-unit HP HUDs, friendly pilot avatars above ships, enemy HP bars, and the right-lower pause button. No bottom avatar bar. No skill buttons. No damage floating numbers. No speed button. No grid lines. No tutorial text. No title logo.

Everything else — background details, effect styles, exact poses and spacing, enemy designs and colors — is up to you. Compose freely and make it lively and beautiful.

Avoid: damage numbers, floating combat text, bottom portrait bar, square tactical grid, card battle UI, pilot sitting in a cockpit, open cockpit with a visible person, giant pilot portrait, poster collage, title logo, dark war mood, gritty realism, panel lines, mechanical greebles, rivets, vents, grilles, excessive explosions hiding the units, watermark.
```

### 2.3 单舰装配页（抽4 · =第20批原词，唯一改动：头身比例）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", single starship loadout page
Primary request: Create a real in-game screenshot style single-ship loadout page. The exam point is harmony between the large starship, the pilot standing beside it, and the UI panels in one coherent mobile game screen.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, warm bright friendly UI, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Avoid muddy, clashing or overly dark color combinations.

Line treatment: the starship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural separation seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights. The same line rule applies to the hangar environment and all props.

Scene/backdrop: cozy starship hangar bay in warm ivory-and-gold tones with soft warm lighting, and a big window view of candy nebula space. The environment supports the ship and UI, not a dark military garage. Hangar props stay minimal: at most a few large rounded soft containers, no stacks of small blocky crates, no busy machinery walls; the floor maintenance pad is large smooth color rings, not small tiles.

Main subject: one large C-position friendly starship shown as a polished 3/4 view on a circular maintenance pad. The starship has a smooth integrated shell, rounded wings, closed canopy, glossy enamel-like metal, no face, no eyes, no mouth, no blocky assembly texture. It should look like a collectible heroic ship, not a cockpit scene.

Pilot: a Q-cute child-body pilot standing beside the ship, strictly 2 to 2.5 heads tall — big head, small short body. 表情、神态、气质像大人一样沉稳自信——童身与大人派头形成强烈反差萌。The pilot's expression must read like a veteran ace fleet commander: calm steady eyes, chin slightly lifted, a confident smirk at one corner of the mouth, relaxed commanding posture such as arms crossed or hands clasped behind the back. Absolutely not a baby smile, not wide sparkling innocent eyes, not shy or cutesy — still warm and charming in the candy-cute style, never cold or grim. The pilot stands on the hangar floor next to the ship as a character illustration, not sitting, not inside the ship, not in an open cockpit.

UI layout: vertical 9:16 mobile screenshot. Top area has a compact title/status strip. Middle hero area: starship centered large, pilot standing beside it. Right or lower-middle has a plugin-slot panel with three plugin slots, one star-core slot, and one pilot slot indicator. Include a clear power card / battle power badge with a large number-like display. Bottom has a restrained action bar with equip/return style buttons. UI panels are cream-white rounded panels with gold trim, glossy and readable, and must not cover the ship and pilot.

UI constraints: draw only loadout-related UI: title/status strip, slot panel, power card, bottom action buttons. No unrelated hub icons, no battle controls, no gacha panels, no bottom avatar strip, no giant title logo, no tutorial overlay, no DEV tools.

Within all the boundaries above, compose and design freely and naturally.

Avoid: pilot sitting in a cockpit, pilot inside open cockpit, open canopy with person inside, pilot as a giant portrait separated from the ship, baby face, wide sparkling innocent eyes, flat wireframe UI, dark cyberpunk hangar, gritty realism, mechanical greebles, panel lines, rivets, vents, grilles, blocky crate stacks, brick or tile textures, muddy clashing colors, excessive text, watermark, poster composition.
```

## 3. 变更点速览

- **hub（治蒙纱）**：画风锚**逐字回滚第18批原句**（恢复 "polished mobile game screenshot" 收尾、删除 "overall tone stays bright, never deep or dim" 怕暗句=蒙纱元凶）；"floating starport island"改为"**a starport in outer space**"（形态放开：岛/平台/空间站随它）；其余内容清单与放开结构=第21批原样；线条条款维持"删④"版（建筑侧实验无碍）。
- **战斗（R2 基底）**：画风锚/线条条款（含"禁铆钉格栅微细节"恢复——21批删除后小单位线条感变重、R2 带着则干净）/背景句/五舰"轮廓+点缀色"段=**第17批R2 原文照搬**（历批最佳单位的配方）。四处增补：①敌人段=R2 画风词+星盗单位类型（小艇群/后排炮台/举旗船长/蓄力头目），**船长与头目明显大一号当画面锚**，不指定颜色、无"破旧"类脏词，敌舰同糖果光泽（治上批画风跑偏+单调同质）；②中场交火密度提档+一小朵糖果爆花+一次护盾闪（治空旷）；③"恰好5艘有人舰"+隐形 3×3/5×7 格+无人机独立单位就近空格（既定规则并入）；④"其余放开"结尾句。
- **装配页**：**第20批原词一字不动**，唯一 diff="2-3 heads tall"→"strictly 2 to 2.5 heads tall — big head, small short body"；第21批追加的婴儿肥脸颊与 teenager/tall-slim 禁词**全部撤销**。
