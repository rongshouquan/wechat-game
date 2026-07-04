// 悬赏词缀应用层测试（第2.5块·块2，GDD S10.8）：定位型过滤 / 'all' 命中 / 上阵数条件 / mod→积木翻译。
import { describe, it, expect } from 'vitest';
import {
  S7CommissionAffixDef,
  commissionAffixBlocks,
  matchedCommissionAffixes,
  S7_POSITION_TYPES,
} from '../assets/scripts/core/s7/S7CommissionAffix';

const DEFS: S7CommissionAffixDef[] = [
  {
    rowId: 'a_assault', affixName: '突击专属', positionType: 'assault', condLineupMax: 0,
    mods: [
      { channel: 'stat', key: 'attack', op: 'pct', value: 0.3 },
      { channel: 'stat', key: 'maxHp', op: 'pct', value: -0.3 },
    ],
    effectText: '突击攻+30%/血-30%',
  },
  {
    rowId: 'a_crit_all', affixName: '全体暴击', positionType: 'all', condLineupMax: 0,
    mods: [{ channel: 'affix', key: 'critRate', value: 0.4 }],
    effectText: '全体暴击率+40%',
  },
  {
    rowId: 'a_lone', affixName: '孤胆合约', positionType: 'all', condLineupMax: 3,
    mods: [{ channel: 'stat', key: 'attack', op: 'pct', value: 0.4 }],
    effectText: '上阵≤3全队攻+40%',
  },
];

describe('S7CommissionAffix - 定位型过滤', () => {
  it('精确定位型命中：突击词缀作用于突击单位，产出 2 块 modifier 积木', () => {
    const blocks = commissionAffixBlocks(DEFS, ['a_assault'], 'assault', 5);
    expect(blocks).toEqual([
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.3, source: 'commission_affix:a_assault' },
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: -0.3, source: 'commission_affix:a_assault' },
    ]);
  });

  it('定位型不匹配：突击词缀不作用于护卫单位', () => {
    expect(commissionAffixBlocks(DEFS, ['a_assault'], 'guard', 5)).toEqual([]);
  });

  it("'all' 定位型命中任意单位", () => {
    for (const pt of S7_POSITION_TYPES) {
      const blocks = commissionAffixBlocks(DEFS, ['a_crit_all'], pt, 5);
      expect(blocks).toEqual([{ kind: 'affix', affix: 'critRate', value: 0.4, source: 'commission_affix:a_crit_all' }]);
    }
  });

  it('affix 通道翻成 affix 积木（不是 modifier）', () => {
    const [blk] = commissionAffixBlocks(DEFS, ['a_crit_all'], 'assault', 5);
    expect(blk.kind).toBe('affix');
  });
});

describe('S7CommissionAffix - 上阵数条件（孤胆合约）', () => {
  it('上阵≤3 生效', () => {
    expect(commissionAffixBlocks(DEFS, ['a_lone'], 'assault', 3)).toEqual([
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.4, source: 'commission_affix:a_lone' },
    ]);
  });

  it('上阵 >3 不生效', () => {
    expect(commissionAffixBlocks(DEFS, ['a_lone'], 'assault', 4)).toEqual([]);
  });
});

describe('S7CommissionAffix - 健壮性与叠加', () => {
  it('未知词缀 id 跳过（脏配置/脏档防御）', () => {
    expect(commissionAffixBlocks(DEFS, ['nope', 'a_assault'], 'assault', 5)).toHaveLength(2);
  });

  it('多词缀叠加：突击专属 + 全体暴击 都作用于突击单位', () => {
    const blocks = commissionAffixBlocks(DEFS, ['a_assault', 'a_crit_all'], 'assault', 5);
    expect(blocks).toHaveLength(3); // 2 stat + 1 affix
  });

  it('matchedCommissionAffixes 返回命中的定义（备战词缀标记用）', () => {
    const hits = matchedCommissionAffixes(DEFS, ['a_assault', 'a_crit_all', 'a_lone'], 'assault', 5);
    expect(hits.map((d) => d.rowId)).toEqual(['a_assault', 'a_crit_all']); // a_lone 上阵5>3 不命中
  });

  it('op 缺省时 stat 通道按 pct 处理', () => {
    const defs: S7CommissionAffixDef[] = [{
      rowId: 'x', affixName: 'x', positionType: 'assault', condLineupMax: 0,
      mods: [{ channel: 'stat', key: 'armor', value: -0.5 }], effectText: 'x',
    }];
    expect(commissionAffixBlocks(defs, ['x'], 'assault', 5)).toEqual([
      { kind: 'modifier', stat: 'armor', op: 'pct', value: -0.5, source: 'commission_affix:x' },
    ]);
  });
});
