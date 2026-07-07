# Codex 指令 · 第31批 · hub（背景对齐18批·去"版B看齐"句·黑市热气球右上角·UI重排）

> **新开对话执行本单（完全自包含，无需任何旧对话上下文）。** 你负责微信小游戏《星舰小队》的美术生成批次，工具＝内置 `image_gen`。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由下方提示词里的配方词承载。**本批不使用任何参考图**（工具无参考图参数，一切靠文字）。**从零生成，禁止任何图上编辑/后处理。** 提示词照抄勿改词。

## 0. 本批任务与交付规格

- **只做 hub 一段**（作战海报本批暂缓）。
- **输出目录（新建）**：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第31批-hub对齐18批+黑市热气球UI重排\`
- **原始生成副本**：同目录下 `原始生成\`。
- **抽数**：同一 prompt 抽 **4 张**，命名 `主界面-星港hub-抽1.png`…`-抽4.png`；竖屏成品界面截图。
- **收尾**：contact-sheet（`hub-contact-sheet.png`）+ 本批说明 md（含 prompt 全文与变更点）+ 迁移清单 csv。
- **完成报告**：每张图绝对路径 + 说明 md 路径，Ron 带回验收。

## 变更点（相对30批·两处）

1. **删**画风锚末尾那句 "Aim for the palette richness…版B-抽3."（回18批原样收尾）。
2. **背景句改回18批一字不差**："a floating cozy starport base in a soft candy nebula sky."。
- 其余（黑市热气球挂右上角+名牌「黑市商船」、UI 重排、已删的"参考图空转段"保持删除）**一律不变**。
- 结果：本 prompt 除"黑市热气球 + UI 重排"外，与18批 hub 逐字一致。

## Prompt 全文

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: Create a real in-game screenshot style UI mockup, not a poster, not a marketing key art. The screen is the starport hub with exactly ten recognizable clickable buildings arranged as a layered triangular starport base, plus one cute black-market hot-air-balloon market floating at the top-right rim.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot.

Line treatment: every building, platform and prop keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated shell with at most two or three broad structural seams; platforms, ramps and cliffs are large smooth one-piece color surfaces, not assembled from bricks, stones, tiles or blocks; no rivets, no vents, no grilles, no tiny micro-detail strokes. Buildings must be recognizable by silhouette and color, not by surface detail.

Scene/backdrop: a floating cozy starport base in a soft candy nebula sky. The background should support the UI and buildings, not overpower them. Low-detail dreamy stars and clouds, saturation one step lower than foreground.

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
