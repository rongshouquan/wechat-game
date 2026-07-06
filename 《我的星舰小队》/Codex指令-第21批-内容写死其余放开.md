# Codex 指令 · 第21批 · 内容写死其余放开（hub / 战斗两场景 / 装配页比例手术）

> **新开对话执行本单（自包含，无需任何旧对话上下文）。** 背景：你负责微信小游戏《星舰小队》的美术生成批次，工具=内置 image_gen。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由提示词配方词承载。本批采用新指令公式（Ron 2026-07-06 定）：**内容清单写死 + 画风写死，其余全部放开自由发挥、多抽几版挑**。不使用任何参考图；从零生成；**禁止任何图上编辑/后处理**。

## 1. 本批任务

- 输出目录（新建）：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第21批-内容写死其余放开\`
- 抽数与命名（共 **12 图**）：
  - 主界面 **4 抽**：`主界面-星港hub-抽N.png`
  - 战斗·星盗场 **2 抽**：`战斗界面-星盗场-抽N.png`
  - 战斗·无人舰场 **2 抽**：`战斗界面-无人舰场-抽N.png`
  - 单舰装配页 **4 抽**：`单舰装配页-抽N.png`
- 同一 prompt 从零独立抽，只允许自然构图差异；保留 `原始生成\` 副本；末尾出 **12 图 contact-sheet** + 本批说明 md（含 prompt 全文与变更点）。
- 完成后输出完成报告：每张图绝对路径 + 说明 md 路径，由 Ron 带回验收。
- 提示词照抄勿改词。

## 2. 完整 Prompt

### 2.1 主界面·星港 hub（抽4）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: a real in-game screenshot style UI mockup of the starport hub — a floating starport island in outer space. Not a poster, not marketing key art, no title logo.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly; overall tone stays bright, never deep or dim.

Line treatment: every building keeps one thick deep clean outer contour; internal seam lines are same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated molded shell with at most two or three broad structural seams; platforms and large surfaces are big smooth one-piece color planes, not assembled from bricks, stones, tiles or blocks.

Must include (content requirements):
1. Ten buildings, each recognizable, each with a small name plaque: 船坞 / 驾驶员训练舱 / 星核展厅 / 星港补给站 / 商人小站 / 作战大厅 / 打捞港 / 居住舱 / 研究塔 / 深空回廊. (Imperfect plaque text is acceptable.)
2. Layout skeleton: 船坞 and 驾驶员训练舱 sit near the center and slightly larger, 星核展厅 above them forming a triangle; the other buildings arranged around them.
3. UI: top safe area kept clean, a compact currency bar below it; at the bottom a large warm-orange "出战" main button plus small backpack, mail and activity icons; a small daily supply gift-box near the activity icon.
4. A few tiny Q-cute chibi residents walking, chatting and working between the buildings.
5. Red-dot badges may appear only on non-ad entrances such as mail; the daily gift box and any ad-related entrance must have NO red dot.

Everything else — the island's size and shape, the entire background (space, clouds, planets, distant islets, anything you like), building designs, camera framing, density and lighting — is completely up to you. Compose freely and make it beautiful and atmospheric.

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, mechanical greebles, brick or stone-block masonry texture, tile or mosaic assembly, honeycomb texture, circuit patterns, ocean, water, sailing ships, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, monetization/VIP labels, damage numbers, watermark.
```

### 2.2 战斗界面 · 星盗场（抽2）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", automatic battle screen
Primary request: a real in-game battle screenshot — the player's starship squad fights enemy ships in outer space. Enemies occupy the upper half, player ships the lower half. Not a poster, no title logo.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starships, thick clean dark same-hue outlines, large clean color planes. Warm, bright, friendly; overall tone stays bright, never deep or dim.

Line treatment: every starship keeps one thick deep clean outer contour; internal seam lines are same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; each ship reads as one smooth integrated molded shell with at most two or three broad structural seams; big smooth one-piece surfaces, never assembled from blocks or tiles.

Player side (must include):
- EXACTLY five piloted friendly starships in the lower half, in a loose formation standing on an invisible 3x3 grid (never draw any grid lines).
- The five ships are the five ship classes of this game, one of each: assault (fast striker), guard (protects the squad), artillery (heavy long-range cannon fire), support (heals and assists allies), engineering (deploys drones). How each class looks and how the five are told apart is up to you — just make them clearly distinguishable at a glance and true to their roles.
- All five belong to one fleet and share the same hull language: smooth integrated shells, rounded wings, closed canopies, glossy enamel-like metal, no faces, no eyes, no mouths — harmonious together like one family.
- The engineering ship has deployed two tiny helper drones: each drone sits on its own free spot of the invisible player grid nearest to the engineering ship; drones are clearly smaller than any starship, each with its own very small slim HP bar and NO pilot avatar.
- HUD: above every piloted friendly ship, a small pilot head avatar plus a slim HP bar. Pilots appear only as these little avatars, never inside cockpits.

Enemy side (must include):
- 8 to 12 enemy units scattered naturally across the upper half on an invisible 5x7 grid (no grid lines, never fill the grid).
- Enemy faction — 捣蛋星盗 (mischievous space pirates), comedic villains: crooked pirate hats, worn mismatched paint, cocky rowdy little ships, pirate flags; naughty and playful, never scary. Mix these unit types, each instantly readable: several 星盗艇 pirate skiffs (a swarm of weak little ships firing small red bolts, toward the front rows); a couple of 星盗炮台 gun platforms (hanging at the back lobbing shells); one 海盗船长 pirate captain (waving a rally flag, nearby skiffs glowing fiercer); one 星盗头目 pirate chief (its cannon muzzle glowing while charging up a big shot). Exact designs are up to you.
- Enemy units have only slim HP bars above them, no avatars.

Battle presentation (must include): ships fire toward the targets they are attacking; colorful projectile crossfire and small impact flashes, battlefield stays readable. Top UI: compact stage info plus allied and enemy power chips, top safe area kept clean. One small round pause button at the lower-right corner.

Everything else — the entire background (space, nebula, clouds, planets, anything you like), effect styles, exact poses and spacing, detailed ship and enemy designs — is completely up to you. Compose freely and make it beautiful.

Avoid: damage numbers, floating combat text, skill buttons, speed button, bottom avatar bar, square tactical grid, card battle UI, pilot sitting in a cockpit, open cockpit with a visible person, giant pilot portrait, poster collage, title logo, dark war mood, deep dark dim background, gritty realism, panel lines, mechanical greebles, brick or stone-block texture, tile or mosaic assembly, honeycomb texture, circuit patterns, excessive explosions hiding the units, watermark.
```

### 2.3 战斗界面 · 无人舰场（抽2）

与 2.2 完全相同，仅将"Enemy faction"一段替换为：

```text
- Enemy faction — 失控无人舰 (rogue drone fleet), cold mechanical feel: clean geometric drone ships, blue/red malfunction lights, stray sparks; cool-colored, orderly, lifeless yet still cute and readable. Mix these unit types, each instantly readable: a couple of 护盾巡卫 shield wardens (each wrapped in a glowing hexagonal blue shield); one 母舰单元 carrier unit (its belly hatch releasing a few tiny drones); one 点名者 designator (projecting one thin red lock-on line toward a back-row player ship); several 干扰机 jammer drones (crackling with small electric arcs). Exact designs are up to you.
```

### 2.4 单舰装配页（抽4 · =第20批原词，唯一改动：驾驶员比例手术）

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", single starship loadout page
Primary request: Create a real in-game screenshot style single-ship loadout page. The exam point is harmony between the large starship, the pilot standing beside it, and the UI panels in one coherent mobile game screen.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, warm bright friendly UI, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Avoid muddy, clashing or overly dark color combinations.

Line treatment: the starship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never black or dark brown; the hull reads as one integrated smooth shell with at most three broad structural separation seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; big clean color blocks with a few glossy highlights. The same line rule applies to the hangar environment and all props.

Scene/backdrop: cozy starship hangar bay in warm ivory-and-gold tones with soft warm lighting, and a big window view of candy nebula space. The environment supports the ship and UI, not a dark military garage. Hangar props stay minimal: at most a few large rounded soft containers, no stacks of small blocky crates, no busy machinery walls; the floor maintenance pad is large smooth color rings, not small tiles.

Main subject: one large C-position friendly starship shown as a polished 3/4 view on a circular maintenance pad. The starship has a smooth integrated shell, rounded wings, closed canopy, glossy enamel-like metal, no face, no eyes, no mouth, no blocky assembly texture. It should look like a collectible heroic ship, not a cockpit scene.

Pilot: a Q-cute child-body pilot standing beside the ship, strictly 2 to 2.5 heads tall — toddler-like chibi proportions with a big head and a small short body, round chubby baby-fat cheeks; absolutely NOT teenager proportions, NOT tall and slim. 表情、神态、气质像大人一样沉稳自信——童身与大人派头形成强烈反差萌。The pilot's expression must read like a veteran ace fleet commander: calm steady eyes, chin slightly lifted, a confident smirk at one corner of the mouth, relaxed commanding posture such as arms crossed or hands clasped behind the back. Absolutely not a baby smile, not wide sparkling innocent eyes, not shy or cutesy — still warm and charming in the candy-cute style, never cold or grim. The pilot stands on the hangar floor next to the ship as a character illustration, not sitting, not inside the ship, not in an open cockpit.

UI layout: vertical 9:16 mobile screenshot. Top area has a compact title/status strip. Middle hero area: starship centered large, pilot standing beside it. Right or lower-middle has a plugin-slot panel with three plugin slots, one star-core slot, and one pilot slot indicator. Include a clear power card / battle power badge with a large number-like display. Bottom has a restrained action bar with equip/return style buttons. UI panels are cream-white rounded panels with gold trim, glossy and readable, and must not cover the ship and pilot.

UI constraints: draw only loadout-related UI: title/status strip, slot panel, power card, bottom action buttons. No unrelated hub icons, no battle controls, no gacha panels, no bottom avatar strip, no giant title logo, no tutorial overlay, no DEV tools.

Within all the boundaries above, compose and design freely and naturally.

Avoid: pilot sitting in a cockpit, pilot inside open cockpit, open canopy with person inside, pilot as a giant portrait separated from the ship, baby face, wide sparkling innocent eyes, teenager proportions, tall slim body, flat wireframe UI, dark cyberpunk hangar, gritty realism, mechanical greebles, panel lines, rivets, vents, grilles, blocky crate stacks, brick or tile textures, muddy clashing colors, excessive text, watermark, poster composition.
```

## 3. 变更点速览（相对第20批）

- **指令公式换代（Ron 定稿）**：写死=内容清单（真源拍板项）+画风锚+平台规则；**全部"中间层教画词"删除**（构图坐标/密度形容/比例控制/"丰富感来自XX"/轮廓样式分配/配色分配一律不写），结尾明示"其余全放开自由发挥"。
- **线条条款试验（仅 hub/战斗）**：删除"禁铆钉/通风口/格栅/微细节笔触"点名句及禁词表中 rivets/vents/grilles 三词（防负面反向提醒·Ron 假设验证），保留正面一体壳规则①②③与 panel lines/greebles 泛称；**装配页沿用第20批原词不参与试验**（对照组）。若机械微细节回潮，下批复原。
- **战斗**：敌人改按附录D敌人真源出**两个场景**——星盗场（星盗艇/炮台/挥旗船长/蓄力头目）+无人舰场（六边形蓝盾巡卫/吐无人机母舰/红色锁定线点名者/电弧干扰机），族群基调句照真源、具体造型放开、数量锁 8-12；五舰只报五类+职能一句、区分方式全放开；家族统一感=共用装配页舰体词；**召唤单位写死"落在离工程舰最近的空格、独立格位、小血条无头像"**；敌舰颜色不再指定。
- **装配页**：第20批原词一字不动，唯一 diff=驾驶员比例手术（严格 2-2.5 头身幼童比例·大头短身·婴儿肥圆脸颊·明写"绝非少年比例/不高不瘦"，Avoid 补 teenager proportions/tall slim body），表情气质姿态词原样保留。
