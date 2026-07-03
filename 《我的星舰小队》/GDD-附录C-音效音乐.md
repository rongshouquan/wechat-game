# GDD 附录C · 音效/音乐事件钩子清单

> 真实音频素材**推迟**（Ron 定）；本文档只定"哪些事件要配音"，与代码 `game/assets/scripts/sound/SoundEventTypes.ts` 共用一份事件 id 真源——以后接素材时，只需把下表事件 id 对应到具体音频文件，不用改业务代码。
> C1 音频整体风格基调（听感/各场景情绪/参考）待真要接素材时再做；本阶段只钉事件钩子（C2）。

## C2 事件音效清单

### 短音效（一次性播放）

| 事件 id | 触发时机 | 代码钩子位置（S7DemoController） |
|---|---|---|
| `battle_victory` | 战斗胜利结算弹窗弹出 | `openResultPopup(true)` |
| `battle_defeat` | 战斗失败结算弹窗弹出 | `openResultPopup(false)` |
| `gacha_draw` | 抽卡出货（普通，无新到手/无专属） | `onGachaDraw` |
| `gacha_highlight` | 抽卡出货高光（新到手本体 / 专属本体） | `onGachaDraw`、`onGachaClaim` |
| `upgrade_level_up` | 星舰/驾驶员升级成功 | `onUpgradeUnit` |
| `upgrade_ascend` | 星舰升阶成功 | `onAscendUnit`（ship 分支） |
| `upgrade_star_up` | 驾驶员升星成功 | `onAscendUnit`（pilot 分支） |
| `chest_open` | 宝箱开箱选中一个奖励 | `onPickChestOption` |
| `reward_claim` | 通用奖励领取（邮件单领/一键领、离线收益领取、专属兑换箱非高光分支） | `onClaimMail`、`onClaimOffline`、`onGachaClaim` |
| `ui_click` | 主要按钮点击（预留，暂未全局接，避免高频点击噪音先于素材定调前过度铺开） | 预留 |
| `return_report` | 回港报告弹窗弹出（舰队归港，2026-07-02 包A） | 第2.5块建（回港报告） |
| `dispatch_done` | 每日委托秒结算/速刷入账（包A） | 第2.5块建（每日委托） |
| `tower_up` | 深空回廊通过一层（包A） | 第2.5块建（深空回廊） |
| `tower_milestone` | 深空回廊里程碑领取（包A） | 第2.5块建（深空回廊） |
| `puzzle_solve` | 每日推演解开（"妙手"高光，包A） | 第2.5块建（每日推演） |
| `trivia_pop` | 星港趣事弹泡出现（轻快，包A） | 第2.5块建（星港趣事） |

### 背景音乐（场景切换式，同一时刻只播一条）

| 场景 id | 触发时机 | 代码钩子位置 |
|---|---|---|
| `bgm_hub` | 主界面/星港等非战斗场景 | `dismissBattleScene`（结果窗收起回基地时切回） |
| `bgm_battle` | 出战进入战斗演出期间 | `onConfirmSortie`（确认出战时切入） |

## 工程实现说明

- `SoundService.playSfx(event)` / `playBgm(scene)`：业务代码只认事件 id，不关心背后播放实现。
- 当前阶段【只接 `MockSoundAdapter`】——记录调用、不真实出声；真机播放（Cocos `AudioSource` / 微信 `wx.createInnerAudioContext`）属后续任务，届时只换 adapter 实现，调用点不用改。
- 事件 id 增删以 `SoundEventTypes.ts` 为准；本文档与代码不一致时以代码为准并回头补文档。
