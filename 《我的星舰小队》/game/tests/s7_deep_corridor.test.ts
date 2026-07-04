// 深空回廊·核心逻辑测试（第2.5块·块3，GDD S10.7 / 附录B B5.2）：
// 层类型判定+优先级 / 敌阵生成确定性+随层缩放+戏法形状 / 回响Boss轮换 / 层作战计划 /
// 双层奖励(每层+里程碑+翻倍) / 进度推进(重打零奖) / 里程碑领取 / 解锁门控 / 规范化迁移。
// 深度自检：主动构造反例（戏法若没进敌阵/我方积木会红、重打已通层不推进、脏档不预领未来里程碑）。
import { describe, it, expect } from 'vitest';
import {
  isEchoBossLayer, isTrickLayer, isMilestoneLayer,
  corridorEnemyCount, corridorEnemyScaleBlocks, corridorFormation,
  corridorBossNodeIds, corridorEchoBoss,
  pickCorridorTrick, corridorLayerPlan,
  corridorLayerReward, corridorMilestoneReward, doubleCorridorReward,
  createDefaultS7Corridor, normalizeS7Corridor,
  nextCorridorLayer, canChallengeCorridorLayer, clearCorridorLayer,
  availableCorridorMilestones, canClaimCorridorMilestone, claimCorridorMilestone,
  corridorUnlocked,
  CORRIDOR_DEEP_TRICK_LAYER,
  S7CorridorEnemyPaletteEntry,
} from '../assets/scripts/core/s7/S7DeepCorridor';
import { corridorTrickEffect, neutralCorridorEffect, ATTRITION_EXTRA_HEALERS } from '../assets/scripts/core/s7/S7CorridorTricks';

const PALETTE: S7CorridorEnemyPaletteEntry[] = [
  { unitStatRef: 'bu_enemy_swarm', roleTag: 'minion' },
  { unitStatRef: 'bu_enemy_shield', roleTag: 'frontline' },
  { unitStatRef: 'bu_enemy_backline', roleTag: 'backline' },
  { unitStatRef: 'bu_enemy_charge', roleTag: 'assault' },
  { unitStatRef: 'bu_enemy_support', roleTag: 'backline_support' }, // 治疗型
];
const BOSSES = ['n030', 'n060', 'n084', 'n102', 'n120', 'n138', 'n150'];

/** 从 blocks 取某 stat 的 pct 修正值（无=0）。 */
function pctOf(blocks: readonly unknown[], stat: string): number {
  const b = blocks.find((x: any) => x.kind === 'modifier' && x.stat === stat && x.op === 'pct') as any;
  return b ? b.value : 0;
}
/** slotRef 'r{r}c{c}' → 列号。 */
function colOf(slot: string): number { return Number(slot.split('c')[1]); }
/** 敌阵里某 unitStatRef 的数量。 */
function countRef(units: { unitStatRef: string }[], ref: string): number {
  return units.filter((u) => u.unitStatRef === ref).length;
}

describe('S7DeepCorridor - 层类型判定 + 优先级', () => {
  it('戏法层=10的倍数但非25倍数；回响Boss=25倍数；里程碑=5倍数；层类型互斥优先Boss', () => {
    expect(isTrickLayer(10)).toBe(true);
    expect(isTrickLayer(20)).toBe(true);
    expect(isTrickLayer(7)).toBe(false);
    expect(isEchoBossLayer(25)).toBe(true);
    expect(isEchoBossLayer(50)).toBe(true);
    // 50 既是10倍数又是25倍数 → 归回响Boss、不是戏法层（Boss 优先）
    expect(isTrickLayer(50)).toBe(false);
    expect(isTrickLayer(100)).toBe(false);
    expect(isMilestoneLayer(5)).toBe(true);
    expect(isMilestoneLayer(25)).toBe(true); // 里程碑与层类型正交
    expect(isMilestoneLayer(6)).toBe(false);
    // 0/负层一律 false
    expect(isTrickLayer(0)).toBe(false);
    expect(isEchoBossLayer(0)).toBe(false);
    expect(isMilestoneLayer(0)).toBe(false);
  });
});

describe('S7DeepCorridor - 敌阵生成（确定性 + 缩放）', () => {
  it('同层同种子逐字节一致；不同层不同（缩放必不同）', () => {
    const a = corridorFormation(12, PALETTE, neutralCorridorEffect());
    const b = corridorFormation(12, PALETTE, neutralCorridorEffect());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // 全服同层同阵
    const c = corridorFormation(13, PALETTE, neutralCorridorEffect());
    expect(a).not.toEqual(c);
  });

  it('随层爬升：深层敌方血/攻缩放 pct 更大', () => {
    const s10 = corridorEnemyScaleBlocks(10);
    const s50 = corridorEnemyScaleBlocks(50);
    expect(pctOf(s50, 'maxHp')).toBeGreaterThan(pctOf(s10, 'maxHp'));
    expect(pctOf(s50, 'attack')).toBeGreaterThan(pctOf(s10, 'attack'));
    expect(pctOf(s10, 'maxHp')).toBeGreaterThan(0);
  });

  it('数量随层缓增且封顶；调色板空→空敌阵（只带缩放·不崩）', () => {
    expect(corridorEnemyCount(1)).toBeLessThanOrEqual(corridorEnemyCount(200));
    expect(corridorEnemyCount(9999)).toBeLessThanOrEqual(12);
    const empty = corridorFormation(5, [], neutralCorridorEffect());
    expect(empty.units).toEqual([]);
    expect(empty.enemyBlocks.length).toBeGreaterThan(0);
  });

  it('常规敌阵不含治疗型（使"持久战·治疗单位多"成为可辨戏法）', () => {
    const f = corridorFormation(30, PALETTE, neutralCorridorEffect());
    expect(countRef(f.units, 'bu_enemy_support')).toBe(0);
  });
});

describe('S7DeepCorridor - 戏法真正作用到敌阵（反例守卫）', () => {
  it('后排火力：所有敌人摆在后排列（col≥4）', () => {
    const f = corridorFormation(10, PALETTE, corridorTrickEffect('backline_fire'));
    expect(f.units.length).toBeGreaterThan(0);
    for (const u of f.units) expect(colOf(u.slotRef)).toBeGreaterThanOrEqual(4);
    // 反例对照：常规层敌人有前排（col<4）
    const normal = corridorFormation(10, PALETTE, neutralCorridorEffect());
    expect(normal.units.some((u) => colOf(u.slotRef) < 4)).toBe(true);
  });

  it('铁甲潮：敌方修正积木真的进了敌阵 enemyBlocks（若戏法没生效此断言会红）', () => {
    const f = corridorFormation(10, PALETTE, corridorTrickEffect('iron_tide'));
    const armor = f.enemyBlocks.find((b: any) => b.kind === 'modifier' && b.stat === 'armor');
    expect(armor).toBeDefined();
    // 缩放积木也在（层缩放 + 戏法修正并存）
    expect(pctOf(f.enemyBlocks, 'maxHp')).toBeGreaterThan(0);
  });

  it('蜂群：敌数量约翻倍 + 削弱积木进敌阵', () => {
    const normal = corridorFormation(1, PALETTE, neutralCorridorEffect());
    const swarm = corridorFormation(1, PALETTE, corridorTrickEffect('swarm'));
    expect(swarm.units.length).toBe(normal.units.length * 2); // 层1未封顶：5→10
    // 削弱=负 pct 的 maxHp 修正在 enemyBlocks 里（与正的层缩放并存）
    expect(swarm.enemyBlocks.some((b: any) => b.kind === 'modifier' && b.stat === 'maxHp' && b.value < 0)).toBe(true);
  });

  it('持久战：敌阵追加治疗型单位（数量=ATTRITION_EXTRA_HEALERS）', () => {
    const f = corridorFormation(20, PALETTE, corridorTrickEffect('attrition'));
    expect(countRef(f.units, 'bu_enemy_support')).toBe(ATTRITION_EXTRA_HEALERS);
  });
});

describe('S7DeepCorridor - 回响Boss（每25层·7 Boss 轮换）', () => {
  it('corridorBossNodeIds：乱序节点→按 nodeId 升序取 boss', () => {
    const nodes = [
      { nodeId: 'n060', nodeTypeTag: 'boss' }, { nodeId: 'n001', nodeTypeTag: 'normal' },
      { nodeId: 'n030', nodeTypeTag: 'boss' }, { nodeId: 'n150', nodeTypeTag: 'boss' },
    ];
    expect(corridorBossNodeIds(nodes)).toEqual(['n030', 'n060', 'n150']);
  });

  it('层25→首Boss(n030)·50→n060·175→末Boss(n150·第7个)', () => {
    expect(corridorEchoBoss(25, BOSSES)).toMatchObject({ bossNodeId: 'n030', sequence: 0, bossOrder: 1, cycle: 0 });
    expect(corridorEchoBoss(50, BOSSES)).toMatchObject({ bossNodeId: 'n060', bossOrder: 2, cycle: 0 });
    expect(corridorEchoBoss(175, BOSSES)).toMatchObject({ bossNodeId: 'n150', bossOrder: 7, cycle: 0 });
  });

  it('轮完7个后循环加倍率：层200 回到 n030 但 cycle=1、倍率更高', () => {
    const first = corridorEchoBoss(25, BOSSES)!; // n030 cycle0
    const second = corridorEchoBoss(200, BOSSES)!; // n030 cycle1
    expect(second.bossNodeId).toBe('n030');
    expect(second.cycle).toBe(1);
    expect(second.mult).toBeGreaterThan(first.mult); // 循环加倍率
    expect(second.enemyBlocks.length).toBeGreaterThan(0);
  });

  it('非25倍数层 / 无Boss配置 → null', () => {
    expect(corridorEchoBoss(30, BOSSES)).toBeNull();
    expect(corridorEchoBoss(24, BOSSES)).toBeNull();
    expect(corridorEchoBoss(25, [])).toBeNull();
  });
});

describe('S7DeepCorridor - 戏法层抽取 + 深层门控', () => {
  it('戏法层确定性抽取；非戏法层→null', () => {
    expect(pickCorridorTrick(10)).toBe(pickCorridorTrick(10));
    expect(pickCorridorTrick(7)).toBeNull();
    expect(pickCorridorTrick(25)).toBeNull(); // Boss 层不抽戏法
  });

  it('孤胆英雄仅深层出现：浅戏法层永不抽到、深层能抽到', () => {
    const shallow = [10, 20, 30, 40, 60, 70, 80, 90];
    for (const L of shallow) expect(pickCorridorTrick(L)).not.toBe('lone_hero');
    let deepHasLone = false;
    for (let L = CORRIDOR_DEEP_TRICK_LAYER; L <= 3000 && !deepHasLone; L += 10) {
      if (!isEchoBossLayer(L) && pickCorridorTrick(L) === 'lone_hero') deepHasLone = true;
    }
    expect(deepHasLone).toBe(true);
  });
});

describe('S7DeepCorridor - 层作战计划（组合）', () => {
  it('回响Boss层：formation=null·echoBoss有值·无戏法', () => {
    const p = corridorLayerPlan(50, PALETTE, BOSSES);
    expect(p.formation).toBeNull();
    expect(p.echoBoss?.bossNodeId).toBe('n060');
    expect(p.trickId).toBeNull();
    expect(p.lineupCap).toBe(5); // Boss 层满编·无戏法规则
  });

  it('戏法层：formation有值·trickId有值·规则字段=该戏法作用清单（组合无串味）', () => {
    for (const L of [10, 20, 30, 40, 60, 70, 80, 90]) {
      const p = corridorLayerPlan(L, PALETTE, BOSSES);
      expect(p.formation).not.toBeNull();
      expect(p.echoBoss).toBeNull();
      expect(p.trickId).not.toBeNull();
      const eff = corridorTrickEffect(p.trickId!);
      expect(p.lineupCap).toBe(eff.lineupCap);
      expect(p.timeLimitSecOverride).toBe(eff.timeLimitSec);
      expect(p.disablePlayerCores).toBe(eff.disablePlayerCores);
      expect(p.playerBlocks).toEqual(eff.playerBlocks);
      expect(p.isMilestone).toBe(L % 5 === 0); // 10/20/... 均为里程碑
    }
  });

  it('普通层：formation有值·无戏法·无Boss', () => {
    const p = corridorLayerPlan(7, PALETTE, BOSSES);
    expect(p.formation).not.toBeNull();
    expect(p.trickId).toBeNull();
    expect(p.echoBoss).toBeNull();
    expect(p.isMilestone).toBe(false);
    expect(p.lineupCap).toBe(5);
  });

  it('作战计划确实携带非默认戏法规则（反例守卫·防组合写死默认值）', () => {
    // 找到实际抽到某戏法的层，验 plan 真把该戏法的非默认规则带了上来（若组合写死默认此断言会红）。
    const findLayerFor = (trick: string): number => {
      for (let L = 10; L <= 5000; L += 10) if (!isEchoBossLayer(L) && pickCorridorTrick(L) === trick) return L;
      return -1;
    };
    const eliteL = findLayerFor('elite_squad');
    expect(eliteL).toBeGreaterThan(0);
    expect(corridorLayerPlan(eliteL, PALETTE, BOSSES).lineupCap).toBe(3);

    const blitzL = findLayerFor('blitz');
    expect(blitzL).toBeGreaterThan(0);
    expect(corridorLayerPlan(blitzL, PALETTE, BOSSES).timeLimitSecOverride).toBe(40);

    const silentL = findLayerFor('silent_zone');
    expect(silentL).toBeGreaterThan(0);
    expect(corridorLayerPlan(silentL, PALETTE, BOSSES).disablePlayerCores).toBe(true);

    const turbL = findLayerFor('turbulence');
    expect(turbL).toBeGreaterThan(0);
    expect(corridorLayerPlan(turbL, PALETTE, BOSSES).playerBlocks.length).toBeGreaterThan(0);
  });
});

describe('S7DeepCorridor - 双层奖励', () => {
  it('每层小奖：正数·随层增长·不含星矿（守 S9 星矿四来源）', () => {
    const r1 = corridorLayerReward(1);
    const r100 = corridorLayerReward(100);
    expect(r1.hullAlloy).toBeGreaterThan(0);
    expect(r1.pilotToken).toBeGreaterThan(0);
    expect(r1.starCargo).toBeGreaterThan(0);
    expect(r1.starOre).toBeUndefined();
    expect(r100.hullAlloy).toBeGreaterThan(r1.hullAlloy);
    expect(corridorLayerReward(0)).toEqual({});
  });

  it('里程碑：星矿/星贝/通用碎片 + 信标按深度升档（浅普通→稀有→史诗）', () => {
    const m5 = corridorMilestoneReward(5);
    expect(m5.starOre).toBeGreaterThan(0);
    expect(m5.starCargo).toBeGreaterThan(0);
    expect(m5.shipBlueprint).toBeGreaterThan(0);
    expect(m5.beaconCommon).toBeGreaterThan(0);
    expect(corridorMilestoneReward(25).beaconRare).toBeGreaterThan(0);
    expect(corridorMilestoneReward(25).beaconCommon).toBeUndefined();
    expect(corridorMilestoneReward(50).beaconEpic).toBeGreaterThan(0);
    expect(corridorMilestoneReward(7)).toEqual({}); // 非里程碑层
  });

  it('翻倍：全部键 ×2·无排除项（碎片/史诗信标也翻·Ron 拍板）', () => {
    const doubled = doubleCorridorReward({ starOre: 200, shipBlueprint: 3, beaconEpic: 1 });
    expect(doubled).toEqual({ starOre: 400, shipBlueprint: 6, beaconEpic: 2 });
    // 真实里程碑翻倍：逐键恰好 2 倍
    const m = corridorMilestoneReward(50);
    const d = doubleCorridorReward(m);
    for (const k of Object.keys(m)) expect(d[k]).toBe(m[k] * 2);
  });
});

describe('S7DeepCorridor - 进度推进（只能打下一层 + 重打零奖）', () => {
  it('只有"下一层"推进最高层；重打已通层/越级 → 不推进（重打零奖天然实现）', () => {
    const s = createDefaultS7Corridor();
    expect(nextCorridorLayer(s)).toBe(1);
    expect(clearCorridorLayer(s, 1)).toBe(true);
    expect(s.highestClearedLayer).toBe(1);
    // 重打已通层：不推进、返回 false（=不发首通小奖）
    expect(clearCorridorLayer(s, 1)).toBe(false);
    expect(s.highestClearedLayer).toBe(1);
    // 越级：不推进
    expect(clearCorridorLayer(s, 3)).toBe(false);
    expect(s.highestClearedLayer).toBe(1);
    // 下一层继续
    expect(clearCorridorLayer(s, 2)).toBe(true);
    expect(nextCorridorLayer(s)).toBe(3);
    expect(canChallengeCorridorLayer(s, 3)).toBe(true);
    expect(canChallengeCorridorLayer(s, 2)).toBe(false);
    expect(canChallengeCorridorLayer(s, 4)).toBe(false);
  });
});

describe('S7DeepCorridor - 里程碑领取（塔页手动开·可积攒）', () => {
  it('可开=已通到+是里程碑+未开；开箱记状态·不可重开·不可预领未通层', () => {
    const s = createDefaultS7Corridor();
    s.highestClearedLayer = 12; // 通到 12 层
    expect(availableCorridorMilestones(s)).toEqual([5, 10]);
    expect(canClaimCorridorMilestone(s, 5)).toBe(true);
    expect(canClaimCorridorMilestone(s, 15)).toBe(false); // 未通到
    expect(canClaimCorridorMilestone(s, 7)).toBe(false); // 非里程碑

    const reward = claimCorridorMilestone(s, 5);
    expect(reward).toEqual(corridorMilestoneReward(5));
    expect(s.claimedMilestones).toEqual([5]);
    expect(availableCorridorMilestones(s)).toEqual([10]);
    // 不可重开
    expect(claimCorridorMilestone(s, 5)).toBeNull();
    expect(s.claimedMilestones).toEqual([5]);
    // 不可开未通到的
    expect(claimCorridorMilestone(s, 15)).toBeNull();
  });
});

describe('S7DeepCorridor - 解锁门控（首Boss通关后）', () => {
  it('首Boss(n030)已通=解锁；未通/无Boss配置=锁', () => {
    expect(corridorUnlocked([], 'n030')).toBe(false);
    expect(corridorUnlocked(['n001', 'n030'], 'n030')).toBe(true);
    expect(corridorUnlocked(['n030'], null)).toBe(false);
  });
});

describe('S7DeepCorridor - 规范化（存档 v22 迁移·防脏档）', () => {
  it('默认=空塔；旧档无 corridor 字段→默认', () => {
    expect(createDefaultS7Corridor()).toEqual({ highestClearedLayer: 0, claimedMilestones: [] });
    expect(normalizeS7Corridor(undefined)).toEqual({ highestClearedLayer: 0, claimedMilestones: [] });
    expect(normalizeS7Corridor(null)).toEqual({ highestClearedLayer: 0, claimedMilestones: [] });
  });

  it('脏档：非里程碑/超最高层/重复项被剔除·去重升序·负最高层归0', () => {
    const n = normalizeS7Corridor({ highestClearedLayer: 12, claimedMilestones: [10, 5, 5, 7, 15] });
    // 5/10 保留（是里程碑且≤12）；7 非里程碑剔除；15 >12 剔除（不预领未来）；去重升序
    expect(n).toEqual({ highestClearedLayer: 12, claimedMilestones: [5, 10] });
    expect(normalizeS7Corridor({ highestClearedLayer: -3 }).highestClearedLayer).toBe(0);
    expect(normalizeS7Corridor({ highestClearedLayer: 5.7 }).highestClearedLayer).toBe(0); // 非整数归0
  });
});
