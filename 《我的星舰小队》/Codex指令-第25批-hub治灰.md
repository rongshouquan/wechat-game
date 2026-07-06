# Codex 指令 · 第25批 · hub 治灰（背景与光照收回写死 · 4 抽）

> **新开对话执行本单（自包含，无需任何旧对话上下文）。⚠️ 若第24批尚在执行，等它完成后再开本批（同目录严格串行）。** 背景：你负责微信小游戏《星舰小队》的美术生成批次，工具=内置 image_gen。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由提示词配方词承载。第21/22批 hub 连续两版整体发灰蒙纱（对比第18批"鲜艳清澈透亮"标准）；本批诊断结论=发灰源于"背景与光照被放进了自由发挥清单"：模型自由发挥必画深空黑紫底+雾状云海+柔光滤镜。**本批手术：把背景与光照从放开清单收回、逐字回滚第18批背景段；其余（内容清单/星港形态放开/构图密度放开）与第22批一字不动。**
> 不使用任何参考图；从零生成；禁止任何图上编辑/后处理。

## 1. 本批任务

- 输出目录（新建）：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第25批-hub治灰\`
- 抽数与命名（共 **4 图**）：主界面 **4 抽** `主界面-星港hub-抽N.png`。
- 同一 prompt 从零独立抽，只允许自然构图差异；保留 `原始生成\` 副本；末尾出 **4 图 contact-sheet** + 本批说明 md（含 prompt 全文与变更点）+ 迁移清单.csv。
- 完成后输出完成报告：每张图绝对路径 + 说明 md 路径，由 Ron 带回验收。
- 提示词照抄勿改词。

## 2. 完整 Prompt

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: a real in-game screenshot style UI mockup of the starport hub — a starport in outer space. Not a poster, not marketing key art, no title logo.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot with rich vivid palette, candy gloss finish and lively charm.

Line treatment: every building keeps one thick deep clean outer contour; internal seam lines are same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated molded shell with at most two or three broad structural seams; platforms and large surfaces are big smooth one-piece color planes, not assembled from bricks, stones, tiles or blocks.

Scene/backdrop: a floating cozy starport base in a soft candy nebula sky. The background should support the UI and buildings, not overpower them. Low-detail dreamy stars and clouds, saturation one step lower than foreground.

Must include (content requirements):
1. Ten buildings, each recognizable, each with a small name plaque: 船坞 / 驾驶员训练舱 / 星核展厅 / 星港补给站 / 商人小站 / 作战大厅 / 打捞港 / 居住舱 / 研究塔 / 深空回廊. (Imperfect plaque text is acceptable.)
2. Layout skeleton: 船坞 and 驾驶员训练舱 sit near the center and slightly larger, 星核展厅 above them forming a triangle; the other buildings arranged around them.
3. UI: top safe area kept clean, a compact currency bar below it; at the bottom a large warm-orange "出战" main button plus small backpack, mail and activity icons; a small daily supply gift-box near the activity icon.
4. A few tiny Q-cute chibi residents walking, chatting and working between the buildings.
5. Red-dot badges may appear only on non-ad entrances such as mail; the daily gift box and any ad-related entrance must have NO red dot.

Everything else — the starport's overall form (island, platform, station, anything you like), building designs, camera framing and density — is completely up to you. Compose freely and make it beautiful and atmospheric.

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, mechanical greebles, brick or stone-block masonry texture, tile or mosaic assembly, honeycomb texture, circuit patterns, ocean, water, sailing ships, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, monetization/VIP labels, damage numbers, hazy atmosphere, washed-out gray tones, watermark.
```

## 3. 变更点速览（写进本批说明 md）

- **基底=第22批 hub prompt**，共动三刀，其余一字未改：
  1. **放开句收回背景与光照**："the entire background (…) / density and lighting" 从自由发挥清单移除，只保留"星港形态/建筑设计/取景/密度"放开。
  2. **逐字回滚第18批 Scene/backdrop 段**（糖果星云天·低细节星云·背景饱和度只比前景低一档·背景托前景不压前景）——第18批=现存 hub 最佳且背景写死，第21/22批放开背景后连续发灰。
  3. **画风锚句尾并入第18批有效词** "rich vivid palette, candy gloss finish, lively charm"；Avoid 增两项 "hazy atmosphere / washed-out gray tones"。
- **回验点（Ron 拍板记录）**：本批与第18批 hub 并排对比"鲜艳/艳丽/清澈透亮/不发灰"；Ron 保留意见在案（他认为背景光照文字未必是发灰主因）——若本批仍灰，总控假设作废、另查根因。
