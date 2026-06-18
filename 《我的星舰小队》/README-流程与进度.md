# 《我的星舰小队》流程与进度（总览 · 续接说明）

> **新对话从这里接：** 先读本文件（尤其下方「📍 当前状态速览」）→（要改设计就读根文件 `系统玩法设计-v1.0.md`）→（要写代码看 `game/`，工程已就位）。
> **项目路径：`F:\Claude Code\《我的星舰小队》`** —— 注意**不是** Codex 的 `F:\Codex\星舰小队\game`；这是 Ron 自有的玩法设计副本，本项目对话**不要求遵守 Codex 的 CLAUDE.md**。
> **引擎**：Cocos Creator 3.8.x + TypeScript。**开发硬原则**：核心逻辑写成纯 TS（不依赖 cc 节点/组件/场景/装饰器），可在 Node/Vitest 单测；Cocos 只管显示/输入/资源/生命周期（见根文件 §4.6）。

## 📍 当前状态速览（2026-06-18 · 新对话先看这里）
- **阶段**：C1「复用 Codex 成熟 Cocos 工程为底座、按 v1.0 改造」进行中。工程在 **`game/`**（已复制 + 跑通，不再用 `prototype/`）。
- **块0-3 已完成并 push**（GitHub `rongshouquan/wechat-game` main）：底座复制+跑通 → **块0 战场对齐**(敌方 5×7 + 超时 120s) → **块1 效果装配层**(四类积木→`deriveUnit`) → **块2 能量条→三类触发**(被动/条件/CD，取消能量) → **块3 星核运行时 + 新手核「过载核心」**(普攻变原子炮)。
- **块4a 已完成（已 push）**：**插件运行时接线 + 品质制**——新增 `core/s7/S7PluginEffects.ts`(插件实例 词条+槽位+品质 → 效果积木，按品质缩放数值、传奇额外加一条小效果) + lineup 新增 `plugins?` + 装配器 `buildPlayerUnits` 解析插件积木(校验：≤3/未知/同名/同槽/品质)并与星核积木合并喂引擎。
- **块4b 已完成（已 push）**：**引擎消费全部 8 条定向词条**。4b-1：`RtUnit` 加 `affixes`(spawnUnit 从 deriveUnit 拷，无装配=ZERO_AFFIXES) + `dealDamage` 消费对Boss/对小怪加伤(按 `isBoss` 路由) + `heal` 消费治疗强度。4b-2：`dealDamage` 加破盾值(叠 shieldMult)、暴击(critRate>0 才掷 RNG→短路保零回归、命中×(1+critDmg)、暴击时日志带 `crit:true`)；`applyState` 加控制抗性(只缩 `CONTROL_TAGS=short_circuit/stun` 时长)；`fireTrigger` 加技能急速(触发 CD `/(1+skillHaste)`)。`npm test` **63 套件 / 720 测试全绿** + s7 校验器绿，零回归。
- **块4c 已完成（4c-1+4c-2，已提交，未 push）**：配置/校验对齐 v1.0。4c-1：插件槽名 `energy`→`skill`(技能/CD槽)。4c-2：清旧「插件强化 1-15 级」制——删 `enhance_cost_param`/`growth_band_param` 的 **plugin 行**(留 core 强化)、TS+.mjs 双校验器去 plugin 强化/成长校验、输入契约去 `pluginEnhanceById`，按"插件本就无强化"如实重定基 4 个测试(`s7_growth_band`/`s7_config`/`s7_battle_input_snapshot`/`s7_battle_input_run_request_adapter`)。`npm test` **63 套件 / 717 测试全绿** + 双配置校验器绿，零回归。
- **⚠️ 块4c 遗留待 Ron 定**：`tools/simulate-s7-progression.mjs`（B1 毕业预算模拟器，**独立手动脚本，不在 `npm test`/校验门内**）建立在"插件可强化 +1~15"旧经济上，删插件强化后**它会崩**。修它=重定插件经济（合成/回收成本、战力贡献），属**第二块数值 + 块4d**，不擅自重算。**待拍板：留作已知失效到第二块插件经济重做时一并修 / 还是现在先做点什么。**
- **块4 战斗侧(4a/4b/4c)全部完成**。
- **块5 驾驶员运行时 已完成（已 push）**：新增 `core/s7/S7PilotEffects.ts`(pilotId → 行为AI(覆盖 targetingTag)+驾驶天赋占位积木，不加原始属性)；lineup 加 `pilotId` + 适配器透传(快照已带 pilotId) + 装配器 `buildPlayerUnits` 解析+归属校验(unknown_pilot)并与星核/插件积木合并。代表驾驶员**晴岚 pil03=后排点杀**(backline_first)，余下驾驶员内容留第二块。`npm test` **64 套件 / 724 测试全绿** + s7 校验器绿，零回归。
- **🔄 块6 基地养成 + 货币对齐（进行中；货币映射已整体拍板见 §待拍板①/路线图§4；迁移=直接重置，已 push 远程备份）**：
  - ✅ **块6a-1 砍星核 5 阶强化（已 push）**：对齐 v1.0 §5.4「不做重复星核深层养成（留 P1）」。`enhance_cost_param` 清空（[]）、`growth_band_param` 删 core 段（12→8 行=4ship+4pilot）、输入契约去 `coreEnhance`+`bad_enhance_value`、双校验器去 core 强化/成长断言（改为"enhance 应为空"+"成长无 core"正向断言，control_point 校验留 P1）。`npm test` **64 套件 / 721 测试全绿** + 双校验器绿，零回归。
  - ✅ **块6a-2 货币键重构·删废弃币（已 push）**：删 battleLog/pluginMat/coreMat —— `S7_RESOURCE_KEYS` 12→9、双校验器 `RESOURCE_VOCAB`、`S7FreeResourceAnchorParam`/`S7UpgradeCostParam` 显式列、anchor/upgrade JSON 列、reward_param 35 条引用、s7_save 测试如实重定基(键集 toEqual 9 + 迁移断言废弃币丢弃)。`npm test` **64套件/721测试全绿** + 双校验器绿，零回归。**注**：① 升级成本不再扣 battleLog（§七.2 影响）；② 旧档加载自动丢弃废弃币（迁移=直接重置已定）。
  - **新增 starGem/pilotShardUniversal + 信标拆 3 档：推迟到第二块/对应内容块**（会逼 anchor 毕业预算填数值=Ron 的数值域；且新币暂无产出/消耗内容，现加=空挂）。
  - ⚠️ **块6b 建筑运行时 暂缓（待第二块）**：摸下来发现建筑配置表是**纯标签占位无数值**(成本/效果/离线产率全 tag)、建筑集没对齐 v1.0 修订版(缺驾驶员训练舱等)、采矿站是旧流程版(挂 PlayerState、产旧能量)。硬做要么编养成数值(Ron 域)要么只剩空壳→暂缓，等第二块建筑数值+建筑集对齐再做。
  - 🔄 **改先做 块6d 插件合成/回收/背包（规则 v1.0 §5.3 已定、回收率 recycle_param 已有，主要是工程）**：
    - ✅ **块6d-1 插件实例库存+背包（已 push）**：新增 `core/s7/S7PluginInventory.ts`(实例 `{instanceId,pluginId,quality}` + 序号计数 + createDefault/normalize + add/remove/find)；S7 存档 `S7PlayerState` 加 `pluginInventory` 字段、版本 **v2→v3**(加性迁移、旧档补默认空库存、无需重置)。`npm test` **65套件/728测试全绿** + s7 校验器绿，零回归。
    - ✅ **块6d-2 合成（已 push）**：新增 `core/s7/S7PluginCraftService.ts`——`synthesizePlugins(inv, 3个instanceId, pluginConfigs)`：3 同槽同品质→1 高一阶、槽内随机词条；**Ron 拍板·本地确定性种子**：随机用 `inv.nextActionSeq`(库存加该字段)派生确定性 RNG(复用 S7AutoBattleRng)、递增隐藏防"挑输入凑词条"；消费 3 输入=天然幂等(重放 instance_not_found 不双花)。新增 `tests/s7_plugin_craft.test.ts` 9 用例(精良→优秀/优秀→传奇/词条在槽池/确定性/幂等防重/5 类错误且不改库存)。`npm test` **66套件/736测试全绿** + s7 校验器绿，零回归。
    - ✅ **块6d-3 回收（已 push）**：新增 `core/s7/S7PluginRecycleService.ts`——`recyclePlugin(inv, resources, instanceId)`：插件 → **星贝(starCargo)** 入账 + 出库；回收星贝=基值[品质]×折损率(**占位**，第二块按 recycle_param 插件行区间[20,40]定点)；消费实例=天然幂等。新增 `tests/s7_plugin_recycle.test.ts` 4 用例。`npm test` **67套件/741测试全绿** + s7 校验器绿，零回归。⚠️ 配置遗留：`recycle_param.recycle_normal_plugin.currencyGroup` 仍写已删的 `plugin_mat`(回收按 v1.0 出星贝，该 tag 订正留第二块)。
  - ✅ **块6d 插件合成/回收/背包 整体完成**（背包=6d-1 库存 / 合成=6d-2 / 回收=6d-3）。
- **其后**：块6b(建筑) / 块6 余项(货币新增键·独立结构) / 块7 活动——详见速览「🔜 下一步」。**这些原标"卡第二块数值"的，现归 Claude 出数值草案、Ron 拍板后落地，不再"等数值"**（角色调整见全局 CLAUDE.md 顶部 / 速览「🧭 角色与协作」）。
- **📌 当前总览（2026-06-18 收口）**：块0-5 全 + 货币映射拍板 + 块6a(砍星核强化+删废弃币) + 块6d(插件合成/回收/背包) 全部完成。**`npm test` 67 套件 / 741 测试全绿** + 双配置校验器绿，一路零回归，**全部已 push**（本地=远程 `origin/main`）。四层(星舰·驾驶员·插件·星核)全接进战斗；插件 品质/合成/回收/背包 的存档与逻辑已立起来。
- **🧭 角色与协作（2026-06-18 起·重要，见全局 CLAUDE.md 顶部）**：Claude 负责**项目顶层设计、数值体系搭建、全套工程代码、合规风控/平台规范、复杂问题排错重构优化、长周期迭代规划**；**Ron 是总决策人**——Claude 出的方案先用大白话精简讲清、经 Ron 确认后执行；觉得哪块适合 Codex 就主动提。**关键转变：数值/顶层方案由 Claude 出草案、Ron 拍板，不再"等 Ron 给数值"**（之前会话里"数值是 Ron 的活、我不擅编"的说法已作废）。
- **🔜 下一步候选（新对话从这里挑；不再有"卡死等数值"项）**：
  1. **块6b 建筑运行时**：建筑配置表目前纯标签无数值、建筑集没对齐 v1.0 修订版(缺驾驶员训练舱等)、采矿站是旧流程版。**→ 由 Claude 出一版「建筑数值体系(成本/离线产率/各级效果) + 建筑集对齐 v1.0」草案，大白话给 Ron 拍板，拍完即做实。**
  2. **块6 余项**：货币新增键(starGem/通用驾驶员碎片/信标拆3档)、独立结构(专属碎片/居民工人/宝箱)——由 Claude 连 anchor 毕业预算数值一并出草案、Ron 拍板。
  3. **块7 活动**(3天·7天，去每日任务)——靠前面产出，内容偏后。
  - **建议起点**：从 6b 起（Claude 先出建筑数值+建筑集对齐草案给 Ron 拍）；或 Ron 指定优先级。
- **🛠 后续工作流程（每块照此）**：① **方案先行**：动手前用大白话精简讲清要做什么(含需我定的顶层/数值草案)+估时/估token，经 Ron 确认再做；② 复杂/高风险点先质疑、把取舍讲清；③ 逻辑纯 TS、可 Node/vitest 测、不依赖 cc；④ 每块改完 `npm test` + `npm run validate:configs:s7`，要零回归；⑤ 测试如实重定基(不为绿而绿)+ 完成前深度自检(主动找错/防假过)；⑥ 每块里程碑 `git commit`，干净节点 `git push` 备份；⑦ 新增 `assets/` 下 `.ts` 配套手写 `.ts.meta`(见 memory「cocos-meta-generation」)；⑧ 觉得某活适合 Codex 就提出来。
- **改造全貌**：`C1改造路线图-现状对齐v1.0-v0.1.md`（8 块顺序）。**设计唯一真源**：`系统玩法设计-v1.0.md`（改动看 §17 变更记录）；决策日志：`设计决策记录-v0.1.md`（货币映射/砍星核强化/插件合成随机等拍板留痕）。详细分块进度见下「C1 改造步骤进度」。
- **接手提示**：① 工程在 `game/`，`npm test` 跑 vitest（已锁 `pool:'forks'`）；逻辑纯 TS 可 Node 测，**不走 Codex 流程**。② 战斗引擎现为"配置驱动 + 四类积木(修正/触发/行为/动作) + 三类触发 + 星核质变"形态——驾驶员/插件只要产出效果积木即可接入（参考块3 `core/s7/S7CoreEffects.ts` + 装配器 `buildPlayerUnits` 接线）。
- **待拍板 / 遗留**：① **货币映射已整体拍板（2026-06-18，详见决策日志/路线图§4）**——保留 starOre=星矿/hullAlloy=星舰合金/pilotToken=驾驶记录/**starCargo=星贝**/supplyTicket=补给券/coreFrag=星核碎片/fullCore=完整星核/shipBlueprint=通用星舰碎片；**废弃 battleLog+pluginMat+coreMat**；**信标 beacon→拆 3 档**(beaconCommon/Rare/Epic)；**新增** starGem(星空宝石)、pilotShardUniversal(通用驾驶员碎片)；**独立结构**(非货币键)：专属碎片/居民/工人/宝箱×3。**裁定：砍星核 5 阶强化(对齐§5.4「不做重复星核深层养成留P1」)** → 连带清 enhance/growth 的 core 段 + coreEnhance；② core01-06 已注册但暂无战斗质变、过载核心"Boss首杀掉落"属奖励系统未做（块3 只做装备即生效）；③ n001 仍分批刷怪（与 v1.0 一次性冲突，留内容块）；④ 插件运行时(4a)是按「槽位」给占位修正(weapon加伤%/技能槽缩CD/战术加护甲，传奇加小affix)，**每条插件词条的精确效果/数值留第二块**（届时 `S7PluginEffects` 改为按 pluginId 索引）；⑤ 引擎已消费**全部 8 条 affix**(4b 完成：对Boss/对小怪加伤、治疗强度、破盾、暴击率/暴击伤害、控制抗性、技能急速)；**占位语义**(暴击倍率/各系数)精确值留第二块；⑥ 插件经「装配器 lineup.plugins」接通并测，**快照→适配器层暂未透传插件**(品质属「拥有实例」模型、要存档→块6/4d)；⑦ 旧「插件强化1-15级」+「星核5阶强化」制**已清(4c-2/6a-1)**：enhance 表空、growth 去 plugin/core 段、输入契约去 pluginEnhanceById/coreEnhance；**但 `simulate-s7-progression.mjs` 毕业预算模拟器(手动脚本)因此失效，待第二块经济重做时统一重写(见上⚠️)**；⑧ **块6d 插件合成/回收的数值是占位**：合成比例 3→1(v1.0已定)，但回收价(基值×折损率)、回收折损率定点 留第二块；且 `recycle_param.recycle_normal_plugin.currencyGroup` 仍写已删的 `plugin_mat`(6d-3 按 v1.0 出星贝，配置 tag 订正留第二块)；⑨ 插件/驾驶员经「装配器 lineup」接通；**快照→适配器对插件未透传品质**(要编队/装配存档，留后)；⑩ `npm run typecheck` 须先用 Cocos 打开生成 `temp/declarations/cc*` 才过（缺 cc 类型，与逻辑无关）；⑪ 用 Cocos Creator 3.8.8 打开工程做导入/构建/真机确认仍需 Ron 手动一次（含认新增 `core/s7/*.ts.meta`：S7PluginEffects/S7PilotEffects/S7PluginInventory/S7PluginCraftService/S7PluginRecycleService）。

## 总流程：三大块
- **① 系统/玩法设计（定性）** —— ✅ 完成，根文件 `系统玩法设计-v1.0.md` 已冻结 v1.0（2026-06-17）。
- **② 数值/平衡设计（定量）** —— ✅ B1 节奏表 + 轻量B2 原型最小集（`第二块-数值设计/`）；精确数值待原型/真机校准。
- **③ 写代码**：
  - **C1a 纯 TS 逻辑核心（`prototype/`）—— ✅ 完成**：C1a-1 战斗骨架 / C1a-2 效果系统 / C1a-3 养成+循环切片。`npm run sim`、`node src/slice.ts`、`npm test`(7/7) 全绿。
  - **C1 改造（复用 Codex 工程按 v1.0 改逻辑）—— 🔄 进行中**：块0-3 ✅ 完成，块4-7 待做（见下「C1 改造步骤进度」与速览）。
  - **C1b Cocos 表现层 / C2 系统扩展到可玩 / C3 内容铺量+美术 / C4 打磨上线 —— 之后**。

## 当前位置 & 下次开工（重大转向：复用旧工程为底座）
**重大决定（2026-06-18）**：发现 Codex 的 `F:\Codex\星舰小队\game` 是个成熟 Cocos 3.8.8 工程（110 提交 / 82 脚本 / 57 vitest / 能 build 微信·真机过 / 灰盒UI / 全套基建；**战斗已≈v1.0：技能制·无能量·敌方3×7·清场或超时120s·护盾破盾**）。决定：
- **设计以 v1.0 为准**（冲突听根文件 `系统玩法设计-v1.0.md`）。
- **复用该工程为技术底座，按 v1.0 改造**（不重做、不照搬成品）。
- **工作方式（选 b）**：把 Codex 的 `game/` **复制进 `F:\Claude Code\《我的星舰小队》\game`**，用本工作区轻流程接着干（丢掉 Codex 重流程；Codex 的 S7 设计文档留作参考）。
- `prototype/`（从零写的 TS 引擎）**已被超越**，留作 v1.0 逻辑参考（星核/驾驶员/原子炮的 v1.0 实现可移植进新底座），不再单独发展。

**C1 改造步骤进度**：
1. ✅ 复制 `F:\Codex\星舰小队\game` → `《我的星舰小队》\game`（已拷 `assets/ settings/ tests/ tools/` + `package.json package-lock.json tsconfig.json project.config.json .gitignore`；**未拷** `build/ library/ temp/ node_modules/ .creator/ profiles/ .git/ CLAUDE.md .claude/ project.private.config.json` —— 可重建/本地/Codex 重流程）。
2. ✅ 跑通（2026-06-18）：`npm i`(79 包) → `npm test` **57 套件 / 672 测试全绿** → `validate:configs` / `validate:configs:s7`(43 表) 均绿。
   - 为让纯逻辑测试脱离 Cocos 编辑器在 Node 下跑，改了两处：① 根 `tsconfig.json` 去掉 `extends "./temp/tsconfig.cocos.json"`（temp/ 不入库，缺失会让 vitest 整体崩）使其自包含；② 新增 `vitest.config.ts`（pin `test.include` + esbuild `tsconfigRaw`）。两处都不影响 Cocos 编辑器。
   - ⚠️ 仍需 Ron 手动一次：用 **Cocos Creator 3.8.8 打开本工程**确认能导入/构建（GUI 步骤无法代跑）。`npm run typecheck` 须先开过 Cocos 生成 `temp/declarations/cc*` 才能过（仅缺 cc 类型声明，与逻辑无关）。
3. ✅ 精读 S7 引擎 + config + **亲自读源码复核**，产出 `C1改造路线图-现状对齐v1.0-v0.1.md`（现状↔v1.0 对齐表 + 8 块改造顺序 + 货币映射待拍板）。核实**纠正盘点 3 错**：敌方实为 **3×7**(非5×7)、超时**配置驱动**(非硬编码30s)、引擎**仍用能量条**(与 v1.0「取消能量」冲突=最大一块改动)。利好：输入契约已含 pilot/core/plugin 槽位+校验、引擎已有 coreEffectRef 钩子、AoE 动作积木已具备。
4. 🔄 **逐块改造中**（顺序已定，从块0起；货币映射§4 待拍板，块6 前需定）：
   - ✅ **块0 战场对齐**（2026-06-18）：敌方 3×7→**5×7**，并抽出单一真源 `core/s7/S7BattleGrid.ts`（引擎 + 配置校验器 + `.mjs` 工具共用，改尺寸只改这一处+工具镜像）；超时 30/40/45→**120s**（v1.0 §4.3）。**易错点已记录**：网格尺寸原散落 7 处（引擎 const/出怪正则/越界消息、校验器 slot正则/footprint边界/maxConcurrent上限21→35、.mjs 同款），已全部同步。`npm test` 57套件/672测试 + 双 .mjs 校验器全绿（`vitest.config.ts` 已锁 `pool:'forks'` 规避 Win worker 偶发崩溃）。
     - ⚠️ 遗留观察（非块0范围，留后处理）：① n001 仍是 w1+w2 **分批刷怪**，与 v1.0 §8「一次性刷新不分批」冲突，待内容块处理；② 引擎"纵深=列"而 v1.0 文案"纵深=行"，仅命名差异（目标语义走 frontmost/backmost 不受影响），最终轴向 C1b 真机布局定。
   - ✅ **块1 效果装配层 完成**（驾驶员/星核/插件四层运行时的共同地基）：
     - ✅ **块1a**（2026-06-18）：新增 `core/s7/S7BattleEffectBlock.ts`（四类积木类型：修正/触发/行为/动作，对应 v1.0 §4.6）+ `core/s7/S7BattleStatDerivation.ts`（纯函数 `deriveUnit(base, blocks)`：把四层积木合并成最终单位=属性+词条+目标+动作槽+触发表）。叠加规则：同 stat flat 先加再乘(1+Σpct)、affix 累加、behavior 后覆盖前、action 按槽覆盖、trigger 收集。`tests/s7_battle_stat_derivation.test.ts` 13 用例；**全套 58套件/685测试全绿，零回归**（未动引擎/配置，积木数据用测试内占位集证明）。
     - ✅ **块1b**（2026-06-18）：`deriveUnit` 接进引擎——玩家单位输入新增可选 `effectBlocks?`；`placePlayerUnits` 带积木时走 `deriveUnit(基线, blocks)`、不带则走原路径（零行为变化）；`spawnUnit` 用装配结果（`derived ?? stat`）建 RtUnit。集成测试证明 +100% maxHp 在战斗里翻倍、空积木与基线完全一致。**全套 59套件/687测试全绿 + s7校验器绿，零回归。**
     - **边界**：块1 只做"属性+效果+目标"装配；能量条→三类触发=块2；星核质变/插件品质制/驾驶员行为的完整内容=块3/4/5。
   - ✅ **块2 能量条→三类触发 完成**（拍板：CD 走显式字段=B 方案 / 开局即放 / 星核钩子平移留块3；详见 `块2-能量改三类触发-设计草案-v0.1.md`）：
     - ✅ **块2a-1**（2026-06-18）：`battle_unit_stat_param` 加 `ultimateCdSec` 字段（大招 CD，与普攻间隔同类；17 行占位均 10s，无大招写 0，精确值第二块定）+ TS/.mjs 双校验器认它（仅校验 ≥0）。**引擎尚未消费**，687 测试 + s7 校验器全绿、零行为变化。
     - ✅ **块2a-2**（2026-06-18）：引擎**能量→三类触发**完成。删 energy 字段/常量/gainEnergy/受击涨能/energy_change 日志/finalState.energy；主循环 9 步→7 步，新增 `stepTriggers`(CD 开局即放读 ultimateCdSec / battle_start / hp_below；短路晕眩拦触发) + `fireTrigger`(星核钩子平移：首次触发后放一次 coreEffectRef)；spawnUnit 给每单位建 RtTrigger(自带大招→默认CD + 装配额外触发)。**实际只 5 个测试受影响**(远好于预估31)：#4(开局大招清场→改测纯普攻寻敌)、#5/#6(能量描述→技能触发, 去 energy_change 断言)、#13(每tick回盾→短CD)、#25(反复短路→短CD)；删 1 个测受击满能测试(测的是已移除的能量机制)。**全套 59套件/686测试全绿 + 双校验器绿**。
       - 🔎 **自检纠了一处假过**：stun 测试原把敌人改带大招却没设 CD→按新规则敌人根本不放招、断言空过；已补 `ultimateCdSec:0.4` 让敌人真想放、再验证被晕压住(窗口取 >apply 排除开局即放那发)。
     - ✅ **块2b**（2026-06-18）：事件/条件型触发——`on_kill`(击杀时,可重复)、`on_hit`(受击时,可重复)、`ally_down`(己方阵亡到阈值,一次性)。dealDamage 采集击杀/受击事件 + 各方阵亡计数;stepTriggers 评估后清事件标志(1 tick 延迟)。S7TriggerBlock 加 `ally_down`。装配层的条件型积木经 effectBlocks 自动接入。新增 6 集成测试(on_kill 含对照+多次击杀重复性, on_hit 含对照, ally_down)。**全套 60套件/692测试全绿,零回归。**
       - 🔎 **深度自检(应 Ron 追问)纠了一处测试设计缺陷**:触发标志原误用了带 AoE 伤害的 `eff_ult_shield_bubble`,加上星核钩子(coreEffectRef)首触发后放黑洞清场,致"多次触发"测试假过(只触发1次)→改用纯自盾 `eff_state_shield` + 测试内 `coreEffectRef:none` 隔离;并验证了星核钩子确实工作。
   - ✅ **块3 星核运行时 + 新手核「过载核心」 完成**：
     - ✅ **块3a**（2026-06-18）：星核运行时机制。积木加 `set` 运算(质变设绝对值)；新增 `eff_atomic_cannon`(原子炮 AoE 效果, battle_effect_param 18→19)；新增 `core/s7/S7CoreEffects.ts` 解析器(coreId→效果积木)；**过载核心** = action(普攻槽→原子炮)+ modifier(攻击间隔 set 10s)。集成测试(带对照)证明:装核→普攻变原子炮、开局即放、AoE 多目标、间隔 10s;不装→普通单体普攻。全套 61套件/696测试全绿,零回归。
       - ⚠️ 注意:原子炮的 AoE 是"本舰射程内最近 16 个"(靠 maxTargets),非字面"以目标列为中心半场";命中范围随该舰射程,精确形状/数值留第二块。
     - ✅ **块3b**（2026-06-18）：打通生产装备路径。过载核心注册进 core_config(=**core07**,行数6→7,校验器/.mjs/测试同步)；lineup 新增 `coreId`(适配器透传)；assembler `buildPlayerUnits` 解析 `coreBlocks(coreId)`→effectBlocks 喂引擎。端到端测试:lineup 带 core07→该单位装出原子炮+间隔set积木(带对照)。全套 61套件/698测试全绿,零回归。
       - 透明说明:① 其余 6 核(core01-06)已注册可校验,但**尚无战斗质变**(coreBlocks 返回空),内容留后续/第二块;② 过载核心的"Boss首杀掉落"(获取)属奖励/进度系统、未实现,块3 只做"装备即生效"。
   - 🔄 **块4 插件品质制（拆 4a/4b/4c 战斗侧本批 + 4d 挪块6）**：
     - ✅ **块4a**（2026-06-18）：插件运行时接线 + 品质制。新增 `core/s7/S7PluginEffects.ts`——`pluginBlocks(pluginId, slotTag, quality)` 把插件实例(词条+槽位+品质)解析成效果积木，品质缩放(精良×1/优秀×1.6/传奇×2.2，占位)、传奇额外加一条 affix 小效果；首版按槽位给占位修正(weapon=attack+%/energy(技能CD)=attackIntervalSec-%/tactical=armor+%)，**每条词条精确效果留第二块**(届时改按 pluginId 索引)。lineup `S7BattleLineupUnitInput` 加 `plugins?:{pluginId,quality}[]`；`buildPlayerUnits` 解析+校验(≤3/未知/同名/同槽/品质非法 5 类错误码)并与 `coreBlocks` 合并喂 `deriveUnit`。新增 `tests/s7_plugin_quality.test.ts` 12 用例(解析器品质递增/传奇额外效果、引擎「装武器插件→伤害变高、传奇>优秀>精良」带「不装=基线」对照、技能槽缩CD→攻击次数变多对照、装配器校验、核+插件并存)。**62套件/710测试全绿 + s7校验器绿，零回归。**
       - 透明说明：① affix(暴击/破盾等)装配层只收集、**引擎暂未消费**→块4b；② 插件只接到「装配器 lineup」层，快照→适配器透传留块6/4d(品质属拥有实例模型、要存档)；③ 占位数值/词条非最终，第二块定。
     - ✅ **块4b 引擎消费定向词条 完成（拆 4b-1/4b-2，因 8 词条挂 5 个结算点、其中 3 条要新约定）**：
       - ✅ **块4b-1**（2026-06-18）：确定性纯乘子组。`RtUnit` 加 `affixes`(spawnUnit 从 `deriveUnit` 拷，无装配=冻结 `ZERO_AFFIXES`)；`dealDamage` 加 `raw *= 1+(isBoss?dmgVsBoss:dmgVsSwarm)`(小怪=非Boss目标)、`heal` 加 `*(1+healPower)`。新增 `tests/s7_affix_consumption.test.ts` 5 用例(对小怪/对Boss加伤各带对照+**跨分支防假过**「装错对象不生效」、治疗强度带0值对照)。**63套件/715测试全绿+s7校验器绿，零回归。**
       - ✅ **块4b-2**（2026-06-18）：余下 4 条。`dealDamage` 加破盾值(叠 shieldMult)、暴击(`critRate>0 && rng.next()` 短路掷随机→零回归不扰动并列裁决；命中 `raw*=(1+critDmg)`；暴击时伤害日志带 `crit:true`，`S7AutoBattleLogEntry` 加 `crit?` 字段、非暴击不带保形状)；`applyState` 加控制抗性(仅 `CONTROL_TAGS=['short_circuit','stun']`，`duration*=(1-clamp(resist,0,1))`)；`fireTrigger` 的 CD 推进加技能急速(`cdSec/(1+skillHaste)`)。测试 +5 用例(暴击三组合/破盾比shieldAfter/控制比眩晕到期/急速比释放次数，皆同种子换词条对照)。**63套件/720测试全绿+s7校验器绿，零回归。** 占位语义(倍率/系数)精确值留第二块。
     - ✅ **块4c 配置/校验对齐 v1.0 完成（拆 4c-1 槽名 / 4c-2 清强化）**：
       - ✅ **块4c-1**（2026-06-18）：插件槽名 `energy`→`skill`(技能/CD槽)。改 `S7PluginSlot` 类型、`ConfigValidatorS7`+`validate-s7-configs.mjs` 槽枚举、`S7PluginEffects` 槽键+注释、plugin_config 4 行(plg07/11/13/18)、`s7_plugin_quality` 测试引用。零回归。
       - ✅ **块4c-2**（2026-06-18）：清旧「插件强化 1-15 级」制(与「不分等级」冲突)。删 `enhance_cost_param`(留 3 core 行)/`growth_band_param`(留 12 行=4ship+4pilot+4core) 的 plugin 行、TS+.mjs 去 plugin 强化/成长校验(`pluginMaxEnh===15`、`byTarget.plugin`、`checkGrowthBandCoverage(...1,15)`、`S7_GROWTH_TARGET_TYPES`/`EXPECTED_SECONDARY` 的 plugin)、输入契约去 `pluginEnhanceById`+`plugin_enhance_unknown_ref`(及只为它服务的 `pluginIdSet`)，按真实行为如实重定基 4 个测试(删 3 条被删功能的测试)。**63套件/717测试全绿+双校验器绿，零回归。** ⚠️ `simulate-s7-progression.mjs` 因此失效→遗留待第二块(见速览⚠️)。
     - 块4d（挪入块6）：合成(3同→1高阶,槽内随机词条)/回收换星贝/背包——要改插件存档模型(扁平列表→实例表)+迁移说明，随块6 存档改动一起做。
   - ✅ **块5 驾驶员运行时**（2026-06-18）：新增 `core/s7/S7PilotEffects.ts`(pilotId→行为AI behavior(覆盖 targetingTag)+驾驶天赋占位 modifier，不加原始属性，同构 core/plugin 解析器)；lineup `S7BattleLineupUnitInput` 加 `pilotId`、适配器 `S7BattleInputRunRequestAdapter` 透传(快照已带)、`buildPlayerUnits` 解析+归属校验(`unknown_pilot`)并与 core/plugin 积木合并。代表驾驶员 **pil03 晴岚=后排点杀**(behavior `backline_first`)，余下留第二块。新增 `tests/s7_pilot_runtime.test.ts` 7 用例(解析器、装配器接线+校验+三层并存、引擎「换目标」用前排1血/后排海量血的死亡数对照防假过)。**64套件/724测试全绿+s7校验器绿，零回归。** 自检纠错:引擎集成测试初版因 `maxConcurrentOnField`(全局同屏上限)被前排占额致后排不出怪→改设 2。
   - 其后：块6 基地养成+货币(含 4d 插件合成/回收/背包) → 块7 3天7天活动(去每日任务)。
5. 保持"逻辑纯 TS 可 Node 测"；每块改完 vitest + 提交。

**差距分析速记**：战斗引擎 + 全套基建（config/save+云/ads+mock/analytics/防重/Node模拟器/vitest/微信build/灰盒UI）可直接复用；驾驶员/星核/基地**需新增**；插件/货币/活动**需改架构**；总体**中等改造量，远小于重做**。
**敌方格子**：3×7 → **5×7（可配置，最终 C1b 真机定）**，保 7 列；目标语义用"最近/最远·第一/最后排"。

## 文件索引
- `系统玩法设计-v1.0.md` —— 【根文件·唯一真源】完整系统/玩法设计（已冻结 v1.0）。
- `设计决策记录-v0.1.md` —— 对话决策日志（过程留痕）。
- `第二块-数值设计/`：`节奏表-B1-普通玩家主干-v0.1.md`、`轻量B2-原型最小集-数值与内容-v0.1.md`。
- `prototype/` —— C1a 纯 TS 逻辑核心（`src/` 下 engine/content/progression/sim/slice + 测试）；`prototype/README.md` 有运行说明。
- 分项稿（已并入根文件）：`资源货币方案-提案-v1.md`、`资源与玩法产出总表-v1.md`、`插件方案-v1.md`、`战斗单位四层定位-v1.md`。

## 关键已锁定决策（速记，避免重新讨论）
纯自动战斗 · 竖屏上下 · 九宫格上阵 5 舰 · 技能制(取消能量,三类触发) · 首发无限射程(打后排靠目标优先级,非射程) · 胜利=清场(含召唤物)/超时 120s 判负 · 四层(星舰打什么·驾驶员怎么打·插件调数值·星核质变) · 插件品质制(精良/优秀/传奇)+合成(无等级,3同→1高阶) · 星贝=starCargo(回收/商人消费币) · 星核三渠道+随机为主+极品才稀缺+宝库限定核 · 新手核=过载核心(Boss首杀固定给,普攻变「原子炮」开局大范围秒一片) · 站位=受击优先级/范围点名/保护 · 无体力 · 纯广告首发(预留内购,无内购SDK) · 本地存档(预留云) · Cocos+TS 且逻辑与引擎解耦 · 体验平滑不憋屈。

## Git
每个里程碑已提交（`git log` 见 `《我的星舰小队》:` 系列，从“根文件冻结”到块3b“原子炮装备路径”+ README 速览）。**块0-3 + README 速览已 push**（本地 main == `origin/main`）；**块4a 已提交、未 push**。新增改动继续按里程碑提交。
