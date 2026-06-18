// 块1a：效果装配层 deriveUnit 纯函数单测。
// 验证四类积木（修正/词条/行为/动作/触发）的合并与叠加规则；不接引擎、不读配置表。
import { describe, it, expect } from 'vitest';
import { deriveUnit, S7DeriveBaseStat } from '../assets/scripts/core/s7/S7BattleStatDerivation';
import { S7EffectBlock } from '../assets/scripts/core/s7/S7BattleEffectBlock';

// 基础属性取自 battle_unit_stat_param 的 bu_ship_vanguard（首版前排星舰基线）。
const BASE: S7DeriveBaseStat = {
  maxHp: 1200,
  attack: 110,
  armor: 40,
  attackIntervalSec: 1.2,
  attackRangeCells: 1,
  passiveEnergyPerSec: 6,
  sizeRows: 1,
  sizeCols: 1,
  targetingTag: 'nearest_random_tie',
  normalEffectRef: 'eff_basic_attack',
  ultimateEffectRef: 'eff_ult_clear_barrage',
  coreEffectRef: 'none',
};

describe('deriveUnit - 无积木时透传基础属性', () => {
  it('空积木列表返回与基础一致的属性', () => {
    const d = deriveUnit(BASE, []);
    expect(d.attack).toBe(110);
    expect(d.maxHp).toBe(1200);
    expect(d.armor).toBe(40);
    expect(d.attackIntervalSec).toBe(1.2);
    expect(d.targetingTag).toBe('nearest_random_tie');
    expect(d.normalEffectRef).toBe('eff_basic_attack');
    expect(d.coreEffectRef).toBe('none');
    expect(d.triggers).toEqual([]);
    // 词条全 0
    expect(d.affixes.critRate).toBe(0);
    expect(d.affixes.shieldBreak).toBe(0);
  });

  it('不传 blocks 参数也安全（默认空）', () => {
    expect(deriveUnit(BASE).attack).toBe(110);
  });
});

describe('deriveUnit - 修正类（modifier）', () => {
  it('单条 +15% 攻击', () => {
    const blocks: S7EffectBlock[] = [{ kind: 'modifier', stat: 'attack', op: 'pct', value: 0.15 }];
    expect(deriveUnit(BASE, blocks).attack).toBe(Math.round(110 * 1.15)); // 127
  });

  it('flat 先加、pct 后乘：( base + flat ) * (1 + pct)', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'modifier', stat: 'attack', op: 'flat', value: 40 },
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.5 },
    ];
    expect(deriveUnit(BASE, blocks).attack).toBe(Math.round((110 + 40) * 1.5)); // 225
  });

  it('多条 pct 线性相加（+10% +10% = ×1.2，不是 ×1.21）', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 0.1 },
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: 0.1 },
    ];
    expect(deriveUnit(BASE, blocks).maxHp).toBe(Math.round(1200 * 1.2)); // 1440
  });

  it('attackIntervalSec 用负 pct 表示加速', () => {
    const blocks: S7EffectBlock[] = [{ kind: 'modifier', stat: 'attackIntervalSec', op: 'pct', value: -0.25 }];
    expect(deriveUnit(BASE, blocks).attackIntervalSec).toBe(round6(1.2 * 0.75)); // 0.9
  });

  it('下限钳制：攻速不低于 0.1，属性不为负，血量不低于 1', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'modifier', stat: 'attackIntervalSec', op: 'pct', value: -2 }, // 会变负
      { kind: 'modifier', stat: 'attack', op: 'flat', value: -9999 },
      { kind: 'modifier', stat: 'maxHp', op: 'pct', value: -2 },
    ];
    const d = deriveUnit(BASE, blocks);
    expect(d.attackIntervalSec).toBe(0.1);
    expect(d.attack).toBe(0);
    expect(d.maxHp).toBe(1);
  });
});

describe('deriveUnit - 定向词条（affix）', () => {
  it('同词条累加', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'affix', affix: 'critRate', value: 0.05 },
      { kind: 'affix', affix: 'critRate', value: 0.1 },
      { kind: 'affix', affix: 'shieldBreak', value: 0.3 },
    ];
    const d = deriveUnit(BASE, blocks);
    expect(d.affixes.critRate).toBeCloseTo(0.15, 6);
    expect(d.affixes.shieldBreak).toBeCloseTo(0.3, 6);
  });
});

describe('deriveUnit - 行为类（behavior）覆盖目标', () => {
  it('行为积木覆盖 targetingTag，后者覆盖前者', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'behavior', targetingTag: 'lowest_hp_ally' },
      { kind: 'behavior', targetingTag: 'backline_first' },
    ];
    expect(deriveUnit(BASE, blocks).targetingTag).toBe('backline_first');
  });
});

describe('deriveUnit - 动作类（action）按槽覆盖', () => {
  it('星核 action 覆盖 normal 槽（如过载核心把普攻换原子炮）', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'action', slot: 'normal', effectRef: 'eff_atomic_cannon', source: 'core_overload' },
    ];
    const d = deriveUnit(BASE, blocks);
    expect(d.normalEffectRef).toBe('eff_atomic_cannon');
    expect(d.ultimateEffectRef).toBe('eff_ult_clear_barrage'); // 未动
    expect(d.coreEffectRef).toBe('none');
  });

  it('分别覆盖 ultimate / core 槽', () => {
    const blocks: S7EffectBlock[] = [
      { kind: 'action', slot: 'ultimate', effectRef: 'eff_ult_burst_nuke' },
      { kind: 'action', slot: 'core', effectRef: 'eff_core_smallsun' },
    ];
    const d = deriveUnit(BASE, blocks);
    expect(d.ultimateEffectRef).toBe('eff_ult_burst_nuke');
    expect(d.coreEffectRef).toBe('eff_core_smallsun');
  });
});

describe('deriveUnit - 触发类（trigger）收集', () => {
  it('触发积木原样收集进 triggers 供块2 消费', () => {
    const t1: S7EffectBlock = { kind: 'trigger', on: 'battle_start', effectRef: 'eff_x' };
    const t2: S7EffectBlock = { kind: 'trigger', on: 'cd', cdSec: 8, effectRef: 'eff_y' };
    const d = deriveUnit(BASE, [t1, t2]);
    expect(d.triggers).toHaveLength(2);
    expect(d.triggers[1]).toMatchObject({ on: 'cd', cdSec: 8, effectRef: 'eff_y' });
  });
});

describe('deriveUnit - 综合：一艘装了占位插件的船', () => {
  it('武器插件(+攻+暴击) + 战术插件(+破盾) + 驾驶员(锁后排) 合成正确', () => {
    // 占位最小集：模拟"推进强化器"(+12%攻+5%暴击) + "破盾校准器"(+30%破盾) + 突袭手(锁后排)。
    const blocks: S7EffectBlock[] = [
      { kind: 'modifier', stat: 'attack', op: 'pct', value: 0.12, source: 'plg_thruster' },
      { kind: 'affix', affix: 'critRate', value: 0.05, source: 'plg_thruster' },
      { kind: 'affix', affix: 'shieldBreak', value: 0.3, source: 'plg_breaker' },
      { kind: 'behavior', targetingTag: 'backline_first', source: 'pilot_raider' },
    ];
    const d = deriveUnit(BASE, blocks);
    expect(d.attack).toBe(Math.round(110 * 1.12)); // 123
    expect(d.affixes.critRate).toBeCloseTo(0.05, 6);
    expect(d.affixes.shieldBreak).toBeCloseTo(0.3, 6);
    expect(d.targetingTag).toBe('backline_first');
    // 未被任何积木触碰的属性保持基线
    expect(d.maxHp).toBe(1200);
    expect(d.armor).toBe(40);
  });
});

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}
