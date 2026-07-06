# Codex 指令 · 第28批 · 五舰改"胖圆糖果萌"形状（保剪影区分）+ hub 加黑市商船与 UI 微调

> **新开对话执行本单（完全自包含，无需任何旧对话上下文）。** 你负责微信小游戏《星舰小队》的美术生成批次，工具＝内置 `image_gen`。全局画风已锁定＝第15批版B-抽3（糖果软萌温馨·软赛璐璐+糖果光泽），风格由下方各段提示词里的配方词承载。**本批不使用任何参考图**（工具无参考图参数，一切靠文字）。**从零生成，禁止任何图上编辑/后处理。** 提示词照抄勿改词。

## 0. 本批任务与交付规格

- **输出目录（新建）**：`F:\星舰小队Codex输出\附录A美术总纲\锁样候选\第28批-五舰胖圆萌+hub黑市商船UI\`
- **原始生成副本**：同目录下 `原始生成\`。
- **两段共 19 张**：
  - **B 段·我方五舰单体 sprite**：5 舰各自 prompt、**每舰抽 3 张**（共 15 张），命名 `我方-突击-影刃号-抽1.png`…`-抽3.png`，其余四舰同理（`我方-护卫-磐石号-抽N` / `我方-炮击-烈阳号-抽N` / `我方-支援-晨曦号-抽N` / `我方-工程-迷雾号-抽N`）；浅冷灰实底、我方机头朝上。
  - **C 段·主界面 hub**：同一 prompt 抽 **4 张**，命名 `主界面-星港hub-抽1.png`…`-抽4.png`；竖屏成品界面截图。
- **收尾**：出两张 contact-sheet（`B-五舰-contact-sheet.png` / `C-hub-contact-sheet.png`）+ 本批说明 md（含每段 prompt 全文与变更点）+ 迁移清单 csv。
- **完成报告**：每张图绝对路径 + 说明 md 路径，Ron 带回验收。

---

## B 段 · 我方五舰单体 sprite（每舰抽 3）

> **本段唯一改动（相对27批）**：27批五舰身份句写的是"尖箭头/后掠刀翼/流线"等**尖锐形状词**，出图偏硬核冷、不够糖果萌；Ron 要的对味参照＝hub 里船坞上停的那只小星舰（矮胖紧凑、大圆鼓泡座舱、圆润无尖角、白蓝糖果色）。**修法＝把每舰的"形状词"从'尖/流线'改成'胖圆/大鼓泡座舱/圆润简洁'**（形状才是杠杆，萌形容词扭不过形状）。
>
> **⚠️ 两条硬要求（Ron 拍板）**：
> ① **别调过火**：胖圆程度对标"船坞那只小星舰"的中等胖圆即可——**仍要是一艘真飞船（有明确机鼻/座舱/机翼），不是没形状的软圆球、不是婴儿玩具**。
> ② **五舰剪影必须明显各不相同**：五舰**只共享"糖果胖圆萌"的处理手法**，**绝不能都长成船坞那只同一个胖圆样**！区分靠每舰写死的"**是五舰里的哪一个**"+标志特征+专属配色。画风锚/线条条款/座舱/构图/背景/硬约束五舰共用、照抄。

### B1 · 我方 · 突击舰 · 影刃号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly assault starship 影刃号 (Shadowblade) — a fast front-line strike craft that dives at enemies. One unit only, isolated on a flat background, no scene.

Ship identity (distinct silhouette — must clearly differ from the other four ships): this is the COMPACT, POINTED, SPEEDY one of the five — a small, zippy little strike-craft with a rounded pointed nose and short swept-back wings, the smallest and most streamlined of the fleet (but rounded and cute, never sharp or aggressive). Hull is a glossy dark candy color — deep navy-black lifted by glossy candy sheen and bright cyan edge-accents, dark but sweet, never grim or matte-black. Palette: glossy deep navy-black + bright cyan.

Cute form (shared across the five, but keep the distinct silhouette above): cozy, chunky, rounded proportions with soft rounded edges and a rounded bubble cockpit canopy — cute and chubby like a collectible candy toy starship, glossy candy finish, simple clean forms — yet still clearly a real, capable spaceship with a clear nose, cockpit and wings, never a shapeless blob.

Charm note: make it candy-sweet, adorable and chibi-cute, with a touch of dreamy magic.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT an abstract emblem, NOT a shapeless blob.

Within all the boundaries above, design freely and make it charming and quick.
```

### B2 · 我方 · 护卫舰 · 磐石号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly guard starship 磐石号 (Bastion Rock) — a sturdy protector that shields the squad and holds the line. One unit only, isolated on a flat background, no scene.

Ship identity (distinct silhouette — must clearly differ from the other four ships): this is the BROADEST, ROUNDEST, most ARMORED one of the five — a wide, thick, chubby guardian ship with a big rounded armored body, short stubby wings, and one big glowing blue energy-shield emitter mounted on its front as its unmistakable signature (a hexagonal shield motif is welcome, but only as the emitter's shape). It clearly reads as the heaviest, widest, most solid of the fleet. Palette: sturdy deep steel-blue + white armor with glowing shield-blue.

Cute form (shared across the five, but keep the distinct silhouette above): cozy, chunky, rounded proportions with soft rounded edges and a rounded bubble cockpit canopy — cute and chubby like a collectible candy toy starship, glossy candy finish, simple clean forms — yet still clearly a real, capable spaceship with a clear nose, cockpit and wings, never a shapeless blob.

Charm note: make it candy-sweet, adorable and chibi-cute, with a touch of dreamy magic.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating shield-emblem, NOT a shapeless blob.

Within all the boundaries above, design freely and make it charming and dependable.
```

### B3 · 我方 · 炮击舰 · 烈阳号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly artillery starship 烈阳号 (Blazing Sun) — heavy long-range cannon firepower. One unit only, isolated on a flat background, no scene.

Ship identity (distinct silhouette — must clearly differ from the other four ships): this is the CANNON one of the five — a chunky rounded gunship whose unmistakable signature is TWO big rounded cannon barrels mounted along its back / spine, pointing forward, over a stout rounded body with short wings. The twin dorsal cannons are the instant read. Palette: blazing orange + gold hull with subtle warm barrel-core glow.

Cute form (shared across the five, but keep the distinct silhouette above): cozy, chunky, rounded proportions with soft rounded edges and a rounded bubble cockpit canopy — cute and chubby like a collectible candy toy starship, glossy candy finish, simple clean forms — yet still clearly a real, capable spaceship with a clear nose, cockpit and wings, never a shapeless blob.

Charm note: make it candy-sweet, adorable and chibi-cute, with a touch of dreamy magic.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose and cannons pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no muzzle flash, no cast shadow, no halo; barrel-core glow stays subtle body material glow, never a charge effect or a shot; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a shapeless blob.

Within all the boundaries above, design freely and make it charming and mighty.
```

### B4 · 我方 · 支援舰 · 晨曦号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly support starship 晨曦号 (Dawnlight) — it keeps teammates fighting with shields and healing energy. One unit only, isolated on a flat background, no scene.

Ship identity (distinct silhouette — must clearly differ from the other four ships): this is the RING-WINGED one of the five — a rounded pure-white support ship whose unmistakable signature is TWO glowing golden halo-ring wings arcing out from its sides (the ring-wings are part of the wing structure, not a detached halo). The twin side halo-rings are the instant read. Palette: pure white hull + soft gold and warm light glow.

Cute form (shared across the five, but keep the distinct silhouette above): cozy, chunky, rounded proportions with soft rounded edges and a rounded bubble cockpit canopy — cute and chubby like a collectible candy toy starship, glossy candy finish, simple clean forms — yet still clearly a real, capable spaceship with a clear nose, cockpit and wings, never a shapeless blob.

Charm note: make it candy-sweet, adorable and chibi-cute, with a touch of dreamy magic.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: pure ship body only — no engine flame plume, no exhaust, no smoke, no projectile, no cast shadow, no halo detached from the ship; the glowing ring-wings stay part of the ship body; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a floating pendant/ornament, NOT a shapeless blob.

Within all the boundaries above, design freely and make it charming and graceful.
```

### B5 · 我方 · 工程舰 · 迷雾号（抽 3）

```text
Use case: stylized-concept
Asset type: game asset test, top-down battle sprite for the WeChat mini-game "星舰小队"
Primary request: Create ONE top-down battle sprite of the friendly engineering starship 迷雾号 (Mistveil) — a utility craft that blinds and weakens enemies with disruptive mist. One unit only, isolated on a flat background, no scene.

Ship identity (distinct silhouette — must clearly differ from the other four ships): this is the WIDE, MISTY one of the five — a wide, flat-ish, chubby gray-purple utility craft ringed with several small mist-nozzle pods along its hull, with a few SMALL mist wisps hugging tight to the hull edges as its signature (subtle and attached, never a big fog cloud). It clearly reads as the widest, most spread-out one of the fleet. Palette: soft gray-purple + pale lavender glow.

Cute form (shared across the five, but keep the distinct silhouette above): cozy, chunky, rounded proportions with soft rounded edges and a rounded bubble cockpit canopy — cute and chubby like a collectible candy toy starship, glossy candy finish, simple clean forms — yet still clearly a real, capable spaceship with a clear nose, cockpit and wings, never a shapeless blob.

Charm note: make it candy-sweet, adorable and chibi-cute, with a touch of dreamy magic.

Style anchor: match the locked global style "第15批版B-抽3" rendering: candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece smooth-shell starship, thick clean dark same-hue outlines, big clean color blocks, bright friendly polished finish.

Line treatment: the ship keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the nearby hull color by only 20-30%, never pure black stroke spam; the hull reads as one integrated smooth shell with at most three broad structural seams; no rivets, no vents, no grilles, no panel lines, no tiny micro-detail strokes; readable at small battle-sprite scale.

The ship has a closed cockpit canopy: no face, no eyes, no mouth, no pilot visible, no blocky assembly texture.

Composition/framing: pure top-down view, nose pointing straight upward, perfectly centered on a square canvas, full ship visible with generous safe margin, no cropping, no UI frame.

Background: perfectly flat solid pale cool light-gray background, one uniform color only — no gradient, no shadow, no floor plane, no scene, no texture.

Hard constraints: ship body plus its small attached mist wisps only — no engine flame plume, no exhaust trail, no big fog cloud, no projectile, no cast shadow, no halo; no background scene, no UI, no text, no logo, no watermark; NOT a boat, NOT a sailing ship, NOT a naval vessel, NOT a shapeless blob.

Within all the boundaries above, design freely and make it charming and clever.
```

---

## C 段 · 主界面 hub（每图抽 4）

> **本段改动（相对27批已认可的 hub）**：27批 hub 方向 Ron 认可，本段**只加两处、别的不变**：①星港边缘加一艘**黑市商船**（作用类似建筑、但表现成停靠港边的商船·不占常驻图标·低调）；②UI 微调——顶部货币栏**只 3 种带文案**（星贝/星矿/补给券）**靠左**、「活动」图标挪**左上角**（底部只留背包/邮件）。背景漂浮梦幻、十栋建筑、居民、线条等一字不变。

```text
Use case: ui-mockup
Asset type: vertical mobile game screenshot candidate for "星舰小队", main hub screen
Primary request: Create a real in-game screenshot style UI mockup, not a poster, not a marketing key art. The screen is the starport hub with exactly ten recognizable clickable buildings arranged as a layered triangular starport base, plus one low-key black-market ship docked at the rim.

Style anchor: match the locked global style "第15批版B-抽3": candy-cute cozy sci-fi, soft cel shading, glossy candy highlights, rounded one-piece forms, thick clean dark same-hue outlines, big clean color blocks, mint cyan, sky blue, lemon yellow, candy orange, cream white, dreamy light purple and soft pink. Warm, bright, friendly, polished mobile game screenshot. Aim for the palette richness, candy gloss finish, character vibe and liveliness of the locked poster 版B-抽3.

Line treatment: every building, platform and prop keeps one thick deep clean outer contour; internal seam lines must be same-hue lines made by darkening the local body color by only 20-30%, never black or dark brown; each building reads as one smooth integrated shell with at most two or three broad structural seams; platforms, ramps and cliffs are large smooth one-piece color surfaces, not assembled from bricks, stones, tiles or blocks; no rivets, no vents, no grilles, no tiny micro-detail strokes. Buildings must be recognizable by silhouette and color, not by surface detail.

Scene/backdrop: a cozy starport base floating weightlessly and dreamily in a soft candy nebula sky, with a gentle whimsical and magical floating feel. The background should support the UI and buildings, not overpower them. Low-detail dreamy stars and clouds, saturation one step lower than foreground.

Residents and liveliness: include 6-10 tiny Q-cute chibi residents (2-3 heads tall, same vibe as the crowd in the reference poster's base corner) walking, chatting, carrying small crates or waving between buildings, plus one or two tiny supply carts. They make the starport feel alive with cozy bustle. Residents are tiny background characters, clearly smaller than building doors, never blocking plaques, buttons or UI.

Core layout: vertical 9:16 mobile screenshot. Top safe area kept clean. Top-LEFT corner: the 活动 (activity) icon. Just below the top safe area, aligned to the LEFT, a compact currency bar with EXACTLY three labeled resource chips, each showing its Chinese name text: 星贝, 星矿, 补给券. Main area is a compact, readable starport island. Bottom UI has a large warm-orange "出战" main button and small backpack and mail icons only (no activity icon at the bottom). Include a small daily supply gift-box island near the bottom. UI should feel like a playable game screenshot with clickable entrances, not a concept painting.

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

Plus one extra, NOT counted among the ten buildings: at the starport's outer edge, a low-key 黑市商船 (black-market merchant ship) is docked at the rim — a slightly mysterious but still candy-cute trader vessel that acts like an extra entrance. Keep it subtle and low-key, parked at the edge as a docked ship, NOT a prominent standard building, no big name plaque; it should feel like a special ship that quietly pulled in to trade.

Composition/framing: center triangle must be clear: dock and pilot training bay centered and slightly larger, star-core showroom above them as top vertex. Inner ring buildings cluster closer to the center and sortie button. Outer ring buildings sit at the edge. The layout should resemble a lively polished mobile game hub: many entrances but still readable, with no uniform grid; the sense of richness comes from the number of buildings and the tiny residents, never from surface detail.

UI constraints: only draw these UI elements: top-left activity icon, top-left labeled three-chip currency bar (星贝/星矿/补给券), bottom sortie button, backpack icon, mail icon, daily supply gift box island, building entrance plates and lock states if needed. At most one or two red-dot badges in the whole screen (for example on the mail icon), and never on the daily supply gift box or any ad-related entrance. No extra menus, no bottom avatar bar, no giant title logo, no promotional slogan, no tutorial overlay, no DEV tools.

Rendering constraints: make buildings feel clickable through small entrance pads, soft glow, tiny readable plaques, and consistent rounded UI panels. Chinese text may be minimal and clean; do not invent extra labels beyond the required UI.

Within all the boundaries above, compose and design freely and naturally.

Avoid: poster composition, giant "星舰小队" logo, split-screen battle poster, cinematic key art, flat wireframe UI, dark cyberpunk, military hard sci-fi, panel lines, brick or stone-block masonry texture, tile or mosaic assembly, mechanical greebles, rivets, vents, grilles, honeycomb texture, circuit patterns, ocean, water, sailing ships, cockpit pilot, pilot sitting in an open cockpit, open cockpit with a person inside, bottom avatar strip, extra icons, monetization/VIP labels, damage numbers, watermark.
```

---

## 变更点速览（写进本批说明 md）

- **B 五舰（改胖圆萌形状·保剪影区分）**：把27批"尖箭头/后掠刀翼/流线"尖锐形状词，改成对标 hub 船坞那只的"矮胖/大圆鼓泡座舱/圆润简洁"胖圆形状。**两硬约束**：①别过火——仍是真飞船（有机鼻/座舱/机翼）、非软圆球非婴儿玩具；②**五舰剪影必须明显各异**——每舰写死"是五舰里的哪一个"（影刃=最小最尖速度型/磐石=最宽最圆最装甲+前盾/烈阳=背驮双炮/晨曦=两侧光环翼/迷雾=最宽最扁+喷雾），只共享糖果胖圆的处理手法、绝不同一个胖圆样。影刃深黑提亮为"亮糖果深蓝黑+青光"。
- **C hub（加两处·别的不变）**：①星港边缘加黑市商船（类建筑作用·表现成停靠商船·不占10栋·非常驻图标·低调）；②UI 微调：顶部货币只3种带文案（星贝/星矿/补给券）靠左、活动图标挪左上角、底部只留背包/邮件。背景漂浮梦幻/十栋/居民/线条一字不变。
