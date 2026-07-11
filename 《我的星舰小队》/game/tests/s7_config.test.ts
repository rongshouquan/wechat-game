import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigLoader, S7ConfigLoadError } from '../assets/scripts/config/s7/ConfigLoaderS7';
import { validateS7ConfigBundle } from '../assets/scripts/config/s7/ConfigValidatorS7';
import { S7ConfigTableName } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

const TABLE_NAMES: S7ConfigTableName[] = [
  'battle_template_config', 'ship_config', 'pilot_config', 'core_config', 'plugin_config',
  'source_tag_config', 'power_reference_param', 'free_resource_anchor_param',
  'enhance_cost_param', 'growth_band_param', 'refund_param', 'pressure_param', 'reward_param', 'shop_param',
  'merchant_refresh_param', 'recycle_param', 'anti_arbitrage_check',
  'enemy_schema_config', 'boss_skeleton_config', 'prebattle_preview_config',
  'ship_pilot_fit_config', 'core_plugin_fit_config',
  'building_config', 'building_unlock_config', 'building_level_cost_param',
  'building_level_effect_param', 'building_anchor_impact_check',
  'mainline_node_config', 'chapter_config', 'star_region_config', 'boss_node_config',
  'tutorial_trigger_config', 'unlock_checkpoint_config', 'protection_reset_config',
  'reward_pool_ref_config', 'no_ad_path_check_config', 'risk_fallback_70_config',
  'battle_unit_stat_param', 'battle_effect_param', 'battle_encounter_param',
  'battle_spawn_param', 'battle_boss_phase_param',
  'commission_affix_param', 'daily_puzzle_param',
];

function readSample<T>(table: S7ConfigTableName): T {
  return JSON.parse(readFileSync(path.join(S7_DIR, `${table}.sample.json`), 'utf-8')) as T;
}

function loadS7Bundle(): Record<S7ConfigTableName, unknown[]> {
  const bundle = {} as Record<S7ConfigTableName, unknown[]>;
  for (const t of TABLE_NAMES) bundle[t] = readSample<unknown[]>(t);
  return bundle;
}

describe('s7 tier a config', () => {
  it('loads and validates all s7 configs (tier a + tier b)', () => {
    const loader = new S7ConfigLoader();
    loader.loadFromData(loadS7Bundle());
    expect(loader.isLoaded()).toBe(true);
    expect(loader.loadedVersion).toBe('s7-0.1.0');
    expect(validateS7ConfigBundle(loadS7Bundle())).toEqual([]);
  });

  it('enforces exact default-plate counts', () => {
    const b = loadS7Bundle();
    expect(b.battle_template_config).toHaveLength(10);
    expect(b.ship_config).toHaveLength(20); // ⑥第一段重定基：默认盘 12→20（真源首发 20 舰·映射细表§12）
    expect(b.pilot_config).toHaveLength(20); // ⑩A1 驾驶员 20 真配（扩容=第一段四点②已拍）
    expect(b.core_config).toHaveLength(16); // 步5 收编重定基：7→16（core01-06 旧占位删除·core07-22=16 真核对齐星核真源）
    expect(b.plugin_config).toHaveLength(30) /* ⑩A3 插件对齐真源 30 件（18 原位改名+12 新增·发放路径泛化读表） */;
  });

  it('indexes rows by lowercase id', () => {
    const loader = new S7ConfigLoader();
    loader.loadFromData(loadS7Bundle());
    expect(loader.getById<{ name: string }>('ship_config', 'shp01')?.name).toBe('极焰号'); // ⑥第一段重定基：shp01 灰盒名→真源名（细表§12 映射）
    expect(loader.getById<{ rowId: string }>('power_reference_param', 'd28')?.rowId).toBe('d28');
  });

  it('keeps all ids lowercase and free of reserved ids', () => {
    const b = loadS7Bundle();
    const allIds: string[] = [];
    for (const t of TABLE_NAMES) {
      for (const row of b[t]) {
        const r = row as Record<string, unknown>;
        const id = (r.templateId ?? r.shipId ?? r.pilotId ?? r.coreId ?? r.pluginId ?? r.rowId
          ?? r.enemyId ?? r.bossId ?? r.previewId ?? r.shipRef ?? r.streamTag
          ?? r.buildingId ?? r.unlockId ?? r.costParamId ?? r.effectParamId ?? r.checkId
          ?? r.nodeId ?? r.chapterId ?? r.starfieldId ?? r.bossNodeId ?? r.tutorialStepId ?? r.unlockRef
          ?? r.rewardAnchorRef ?? r.checkTag) as string;
        allIds.push(id);
      }
    }
    for (const id of allIds) {
      expect(id).toMatch(/^[a-z0-9_]+$/);
      // 建筑条件预留行用 bld_rsv_* 作为合法建筑 ID（由 reservedFlag/releaseTag 区分），不受关系实体 rsv 硬禁约束。
      if (!id.startsWith('bld_')) expect(id).not.toMatch(/rsv/);
    }
  });

  it('rejects reserved template t11 in the default battle_template pool', () => {
    const b = loadS7Bundle();
    b.battle_template_config = [...b.battle_template_config, { schemaVersion: 's7-0.1.0', templateId: 't11', name: '复合', mainProblemTag: 'shield', secondaryTagCap: 1, applicableStageTypes: ['elite'], reservedSlotFlag: true }];
    expect(validateS7ConfigBundle(b).some((e) => e.id === 't11')).toBe(true);
    expect(() => new S7ConfigLoader().loadFromData(b)).toThrow(S7ConfigLoadError);
  });

  it('rejects reserved pilot pil_rsv01', () => {
    const b = loadS7Bundle();
    b.pilot_config = [...b.pilot_config, { schemaVersion: 's7-0.1.0', pilotId: 'pil_rsv01', name: '预留', roleNote: 'x', driveStyleNote: 'x', mainFitNote: 'x', coverProblemTags: ['burst'], freePathNote: 'x', forbiddenBindingNote: 'x' }];
    expect(validateS7ConfigBundle(b).some((e) => e.id === 'pil_rsv01')).toBe(true);
  });

  it('rejects fit refs pointing at reserved or unknown entities', () => {
    const b = loadS7Bundle();
    (b.core_config[0] as { shipFitRefs: string[] }).shipFitRefs = ['shp02', 'core_rsv01'];
    expect(validateS7ConfigBundle(b).some((e) => e.message.includes('core_rsv01'))).toBe(true);
  });
});

describe('s7 tier b economy params', () => {
  it('covers all four day anchors', () => {
    const pr = readSample<Array<{ anchorDay: string }>>('power_reference_param');
    expect(pr.map((r) => r.anchorDay).sort()).toEqual(['d14', 'd21', 'd28', 'd7']);
  });

  it('keeps free resource floor <= expected for every anchor and resource', () => {
    expect(validateS7ConfigBundle(loadS7Bundle())).toEqual([]); // floor>expected would surface here
    const rows = readSample<Array<Record<string, number | string>>>('free_resource_anchor_param');
    const floor = rows.find((r) => r.rowId === 'd28_floor')!;
    const exp = rows.find((r) => r.rowId === 'd28_expected')!;
    expect(Number(floor.fullCore)).toBeLessThanOrEqual(Number(exp.fullCore));
  });

  it('pins N150（终Boss）pressure to v0.9 snapshot and keeps min<=max', () => {
    // 步5 重定基：旧'≤14500'=B1 旧刻度护栏 → v0.7 快照 32094；定价重锚 v1 再重定基：32094=旧刻度
    // 读数 → 12080=刻度实测重标后同一到达期望的诚实读数（绊线哲学不变：压力表重校→红=提醒重落显示带）。
    const rows = readSample<Array<{ rowId: string; scope: string; refKey: string; pressureMax: number; pressureRecommend?: number; appliesToBoss?: boolean }>>('pressure_param');
    const finalBoss = rows.find((r) => r.rowId === 'bp_n150')!;
    expect(finalBoss.pressureRecommend).toBe(12080);
    for (const r of rows.filter((x) => x.scope === 'template_modifier')) expect(r.appliesToBoss).toBe(false);
  });

  it('首发无强化系统(enhance_cost_param 应为空)', () => {
    // 步5 重定基：旧 upgrade_cost_param'段总成本÷10+上限40'占位表已随公式化退役（舰=50×L^1.3 合金/员=40×L^1.2 记录·
    // 1-100 全段=A9-4 补段·见 s7_unit_upgrade_service.test 手推），本测只保留 enhance 空表断言。
    const en = readSample<unknown[]>('enhance_cost_param');
    expect(en).toHaveLength(0); // 砍星核5阶强化(§5.4)+插件不分等级(§5.3) → enhance 表为空
  });

  it('enforces merchant refresh rules and full-core non-recyclable', () => {
    const m = readSample<Array<{ freeRefreshPerCycle: number; paidRefreshCapPerCycle: number; refreshCostSequence: number[]; criticalPathItemBlock: boolean }>>('merchant_refresh_param')[0];
    expect(m.freeRefreshPerCycle).toBe(1);
    expect(m.paidRefreshCapPerCycle).toBeLessThanOrEqual(3);
    expect(m.refreshCostSequence).toEqual([80, 160, 320]);
    expect(m.criticalPathItemBlock).toBe(true);
    const rc = readSample<Array<{ itemType: string; recyclable: boolean }>>('recycle_param');
    expect(rc.find((r) => r.itemType === 'full_core')!.recyclable).toBe(false);
  });

  it('has at least 6 anti-arbitrage rules all blocking on fail', () => {
    const arb = readSample<Array<{ blockOnFail: boolean }>>('anti_arbitrage_check');
    expect(arb.length).toBeGreaterThanOrEqual(6);
    expect(arb.every((r) => r.blockOnFail === true)).toBe(true);
  });

  it('rejects reward pools that depend on ads and powerIndex outside power_reference_param', () => {
    const adBundle = loadS7Bundle();
    (adBundle.reward_param[0] as { noAdRequired: boolean }).noAdRequired = false;
    expect(validateS7ConfigBundle(adBundle).some((e) => e.table === 'reward_param')).toBe(true);

    const piBundle = loadS7Bundle();
    (piBundle.shop_param[0] as Record<string, unknown>).powerIndex = 999;
    expect(validateS7ConfigBundle(piBundle).some((e) => e.message.includes('powerIndex'))).toBe(true);
  });
});

describe('s7 tier b relation / schema configs', () => {
  it('keeps enemy/boss/preview template refs within t01-t10', () => {
    const b = loadS7Bundle();
    const templateIds = new Set((b.battle_template_config as Array<{ templateId: string }>).map((r) => r.templateId));
    for (const row of b.enemy_schema_config as Array<{ templateRefSlots: string[] }>) {
      for (const t of row.templateRefSlots) expect(templateIds.has(t)).toBe(true);
    }
    for (const row of b.boss_skeleton_config as Array<{ templateRefs: string[] }>) {
      for (const t of row.templateRefs) expect(templateIds.has(t)).toBe(true);
    }
    for (const row of b.prebattle_preview_config as Array<{ templateRef: string }>) {
      expect(templateIds.has(row.templateRef)).toBe(true);
    }
  });

  it('rejects template refs pointing at reserved t11', () => {
    const b = loadS7Bundle();
    (b.enemy_schema_config[0] as { templateRefSlots: string[] }).templateRefSlots = ['t01', 't11'];
    expect(validateS7ConfigBundle(b).some((e) => e.message.includes('t11'))).toBe(true);
  });

  it('keeps boss skeleton to one main + at most one secondary pressure', () => {
    const rows = readSample<Array<{ bossId: string; secondaryPressureTag: string }>>('boss_skeleton_config');
    expect(rows).toHaveLength(4);
    const tags = ['swarm', 'shield', 'backline', 'burst', 'berserk', 'summon'];
    for (const r of rows) expect(r.secondaryPressureTag === '' || tags.includes(r.secondaryPressureTag)).toBe(true);
  });

  it('covers every ship with a fit row and a non-empty alternative', () => {
    const b = loadS7Bundle();
    const fit = b.ship_pilot_fit_config as Array<{ shipRef: string; alternativePilotRefs: string[]; notUniqueFlag: boolean }>;
    expect(fit).toHaveLength(20); // ⑥第一段重定基：适配关系随 20 舰扩容（shp13-20 借位现有 pil 池占位）
    for (const r of fit) {
      expect(r.alternativePilotRefs.length).toBeGreaterThanOrEqual(1);
      expect(r.notUniqueFlag).toBe(true);
    }
    expect(validateS7ConfigBundle(b)).toEqual([]);
  });

  it('rejects ship_pilot_fit referencing reserved pilot', () => {
    const b = loadS7Bundle();
    (b.ship_pilot_fit_config[0] as { alternativePilotRefs: string[] }).alternativePilotRefs = ['pil_rsv01'];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'ship_pilot_fit_config')).toBe(true);
  });

  it('requires each stream to keep >=2 core and >=2 plugin solutions', () => {
    const rows = readSample<Array<{ streamTag: string; coreRefs: string[]; pluginRefs: string[] }>>('core_plugin_fit_config');
    expect(rows).toHaveLength(6);
    for (const r of rows) {
      expect(r.coreRefs.length).toBeGreaterThanOrEqual(2);
      expect(r.pluginRefs.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('s7 tier b building configs', () => {
  type Bld = { buildingKey: string; releaseTag: string; maxLevel: number; initialLevel: number; functionUnlockLevel: number; mainlineRequiredLevelCap: number; reservedFlag: boolean };

  it('has 8 buildings: 7 default + 1 conditional/post (v1.0 §7)', () => {
    const rows = readSample<Bld[]>('building_config');
    expect(rows).toHaveLength(8);
    const def = rows.filter((r) => r.releaseTag === 'default_release');
    const cond = rows.filter((r) => r.releaseTag === 'conditional_post');
    expect(def.map((r) => r.buildingKey).sort()).toEqual(
      ['dock', 'pilot_training_bay', 'habitat', 'supply_station', 'salvage_port', 'merchant_station', 'research_tower'].sort(),
    );
    expect(cond.map((r) => r.buildingKey).sort()).toEqual(['core_gallery']);
    for (const r of cond) expect(r.reservedFlag).toBe(true);
  });

  it('keeps every building at maxLevel 10, initial/function-unlock level 1', () => {
    const rows = readSample<Bld[]>('building_config');
    for (const r of rows) {
      expect(r.maxLevel).toBe(10);
      expect(r.initialLevel).toBe(1);
      expect(r.functionUnlockLevel).toBe(1);
      expect(r.mainlineRequiredLevelCap).toBeLessThanOrEqual(1);
    }
  });

  it('keeps no-ad anchor checks off building level >1 and only the dock entry as core-required', () => {
    const checks = readSample<Array<{ requiredLevelCap: number; impactJudgement: string }>>('building_anchor_impact_check');
    for (const c of checks) {
      expect(c.requiredLevelCap).toBeLessThanOrEqual(1);
      expect(c.impactJudgement).not.toBe('blocks_anchor');
    }
    const unlocks = readSample<Array<{ buildingId: string; corePathRequiredFlag: boolean }>>('building_unlock_config');
    for (const u of unlocks.filter((x) => x.corePathRequiredFlag)) {
      expect(u.buildingId).toBe('bld_dock');
    }
  });

  // "rejects a building unlock hung on a 70-fallback node" 已删除：70回退机制随150关拓扑改造作废（2026-07-02），
  // 白名单恒为空，该检查分支不再有意义（见 numeric-truth-b1-v1-ignore-codex 记忆的"Codex旧遗留"原则）。

  it('rejects requiredLevelCap > 1 in anchor impact check', () => {
    const b = loadS7Bundle();
    (b.building_anchor_impact_check[0] as { requiredLevelCap: number }).requiredLevelCap = 2;
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'building_anchor_impact_check')).toBe(true);
  });

  it('rejects merchant station marked as core-required', () => {
    const b = loadS7Bundle();
    const m = (b.building_unlock_config as Array<{ buildingId: string; corePathRequiredFlag: boolean }>).find((r) => r.buildingId === 'bld_merchant_station')!;
    m.corePathRequiredFlag = true;
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'building_unlock_config')).toBe(true);
  });
});

describe('s7 tier c mainline / chapter / tutorial / unlock configs', () => {
  it('covers all 150 mainline nodes N001-N150（2026-07-02 拓扑改造）', () => {
    const rows = readSample<Array<{ nodeId: string }>>('mainline_node_config');
    expect(rows).toHaveLength(150);
    const ids = rows.map((r) => r.nodeId).sort();
    const expected = Array.from({ length: 150 }, (_, i) => `n${String(i + 1).padStart(3, '0')}`);
    expect(ids).toEqual(expected);
  });

  it('covers 25 chapters, 6 star regions and 7 boss nodes (6墙+n030剧情首Boss) with correct boss bindings', () => {
    const chapters = readSample<Array<{ chapterId: string; bossRef: string }>>('chapter_config');
    expect(chapters).toHaveLength(25);
    const starRegions = readSample<Array<{ starfieldId: string }>>('star_region_config');
    expect(starRegions).toHaveLength(6);
    const bosses = readSample<Array<{ bossNodeId: string }>>('boss_node_config');
    // n030=第5章章末剧情首Boss（Ron 2026-07-03），6 墙(n060/084/102/120/138/150) 数量不变 → 7 个 boss 节点。
    expect(bosses.map((r) => r.bossNodeId).sort()).toEqual(['n030', 'n060', 'n084', 'n102', 'n120', 'n138', 'n150']);
    const bossChapters = chapters.filter((c) => c.bossRef !== 'none');
    // ch05 挂 n030；6 区域末尾章节(ch10/14/17/20/23/25) 不变 → 7 个 boss 章节。
    expect(bossChapters.map((c) => c.chapterId).sort()).toEqual(['ch05', 'ch10', 'ch14', 'ch17', 'ch20', 'ch23', 'ch25']);
  });

  it('marks the protection-period turning point at N018/N019（原N038/N039前移）', () => {
    const rows = readSample<Array<{ nodeId: string; protectionPeriodTag: string; templateRef: string; problemTagRef: string }>>('mainline_node_config');
    const n018 = rows.find((r) => r.nodeId === 'n018')!;
    const n019 = rows.find((r) => r.nodeId === 'n019')!;
    expect(n018.protectionPeriodTag).toBe('ending_notice');
    expect(n019.protectionPeriodTag).toBe('closed');
    expect(n018.templateRef).toBe('none');
    expect(n019.templateRef).toBe('none');
    for (const r of rows) {
      const idx = Number(r.nodeId.slice(1));
      const expected = idx <= 17 ? 'active' : idx === 18 ? 'ending_notice' : 'closed';
      expect(r.protectionPeriodTag).toBe(expected);
    }
  });

  it('70回退机制已作废：所有节点 fallback70Tag 恒为 keep_70', () => {
    const rows = readSample<Array<{ nodeId: string; fallback70Tag: string }>>('mainline_node_config');
    const cut = rows.filter((r) => r.fallback70Tag !== 'keep_70');
    expect(cut).toEqual([]);
  });

  it('keeps tutorial triggers structural-only (no UI copy / position / bubble / mask fields)', () => {
    const rows = readSample<Array<Record<string, unknown>>>('tutorial_trigger_config');
    // 真实强引导只覆盖 n001-n005（见 S7DemoController），2026-07-02 拓扑改造后表精简为 5 步。
    expect(rows).toHaveLength(5);
    const forbiddenKeys = ['text', 'copy', 'bubble', 'mask', 'position', 'finger', 'animation'];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        expect(forbiddenKeys.some((f) => k.toLowerCase().includes(f))).toBe(false);
      }
    }
    const mandatory = rows.filter((r) => r.skippableTag === 'mandatory_ack').map((r) => r.tutorialStepId).sort();
    expect(mandatory).toEqual(['tut01', 'tut02']);
  });

  it('registers all mainline unlockRefs and building unlock bridges', () => {
    const b = loadS7Bundle();
    const mainline = b.mainline_node_config as Array<{ unlockRef: string }>;
    const unlocks = b.unlock_checkpoint_config as Array<{ unlockRef: string; nodeId: string; requiredForMainlineTag: boolean; buildingUnlockRef: string }>;
    const mainlineRefs = new Set(mainline.map((r) => r.unlockRef).filter((u) => u !== 'none'));
    const registered = new Set(unlocks.map((r) => r.unlockRef));
    for (const ref of mainlineRefs) expect(registered.has(ref)).toBe(true);

    const buildingUnlocks = (b.building_unlock_config as Array<{ unlockId: string; cc05aLinkTag: string }>)
      .filter((r) => !/(rsv|observatory|core_gallery)/.test(r.unlockId) && !/(rsv|observatory|core_gallery)/.test(r.cc05aLinkTag));
    const registeredBuildingRefs = new Set(unlocks.map((r) => r.buildingUnlockRef).filter((v) => v !== 'none'));
    for (const bu of buildingUnlocks) expect(registeredBuildingRefs.has(bu.unlockId)).toBe(true);
  });

  it('excludes reserved building unlocks (core_gallery) from default unlock checkpoints', () => {
    const rows = readSample<Array<{ unlockRef: string; buildingUnlockRef: string }>>('unlock_checkpoint_config');
    for (const r of rows) {
      expect(r.unlockRef).not.toMatch(/(rsv|observatory|core_gallery)/);
      expect(r.buildingUnlockRef).not.toMatch(/(rsv|observatory|core_gallery)/);
    }
  });

  it('requires N018 free total reset and N019 irreversible-growth warning', () => {
    const rows = readSample<Array<{ nodeId: string; freeResetFlag: boolean; resetScopeTags: string[]; irreversibleWarningFlag: boolean }>>('protection_reset_config');
    expect(rows).toHaveLength(2);
    const n018 = rows.find((r) => r.nodeId === 'n018')!;
    const n019 = rows.find((r) => r.nodeId === 'n019')!;
    expect(n018.freeResetFlag).toBe(true);
    expect(n018.resetScopeTags.length).toBeGreaterThan(0);
    expect(n019.irreversibleWarningFlag).toBe(true);
  });

  it('keeps N150（终Boss）template at t10 and rejects any cut_70 (whitelist已清空)', () => {
    const bosses = readSample<Array<{ bossNodeId: string; templateRef: string }>>('boss_node_config');
    const finalBoss = bosses.find((r) => r.bossNodeId === 'n150')!;
    expect(finalBoss.templateRef).toBe('t10');

    const b = loadS7Bundle();
    (b.mainline_node_config as Array<{ nodeId: string; fallback70Tag: string }>).find((r) => r.nodeId === 'n004')!.fallback70Tag = 'cut_70';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'mainline_node_config' && e.id === 'n004')).toBe(true);
  });
});

describe('s7 tier d bridge configs', () => {
  // 70回退机制（原白名单/reward_review_comfort/risk_fallback_70_config 具体行）随150关拓扑改造作废（2026-07-02）。
  const EXPECTED_NO_AD_CHECK_TAGS = [
    'no_ad_boss1_check', 'no_ad_boss2_check', 'no_ad_boss3_check',
    'no_ad_boss4_check', 'no_ad_boss5_check', 'no_ad_boss6_check',
  ];

  it('covers all 10 reward pool anchors bidirectionally with mainline rewardAnchorRef, full 150-node coverage', () => {
    const rows = readSample<Array<{ rewardAnchorRef: string; nodeRefs: string[] }>>('reward_pool_ref_config');
    // 9 个基础锚点 + reward_first_boss(n030 剧情首Boss) = 10（Ron 2026-07-03）。150 节点全覆盖不变（n030 从 basic 挪到 first_boss 锚点）。
    expect(rows).toHaveLength(10);
    const mainline = readSample<Array<{ nodeId: string; rewardAnchorRef: string }>>('mainline_node_config');

    const anchorsFromMainline = new Set(mainline.map((r) => r.rewardAnchorRef));
    expect(new Set(rows.map((r) => r.rewardAnchorRef))).toEqual(anchorsFromMainline);

    const allNodeRefs = rows.flatMap((r) => r.nodeRefs);
    expect(allNodeRefs.length).toBe(150);
    expect(new Set(allNodeRefs).size).toBe(150);
    for (const ref of allNodeRefs) {
      const m = mainline.find((r) => r.nodeId === ref)!;
      const owner = rows.find((r) => r.nodeRefs.includes(ref))!;
      expect(m.rewardAnchorRef).toBe(owner.rewardAnchorRef);
    }
  });

  it('covers all 6 no-ad path check tags bidirectionally with mainline noAdCheckTag（每个大Boss一个检查点）', () => {
    const rows = readSample<Array<{ checkTag: string; nodeId: string; forbiddenDependencyTag: string[] }>>('no_ad_path_check_config');
    expect(rows).toHaveLength(6);
    expect([...rows.map((r) => r.checkTag)].sort()).toEqual([...EXPECTED_NO_AD_CHECK_TAGS].sort());

    const mainline = readSample<Array<{ nodeId: string; noAdCheckTag: string }>>('mainline_node_config');
    const checkTagsFromMainline = new Set(mainline.filter((r) => r.noAdCheckTag !== 'none').map((r) => r.noAdCheckTag));
    expect(new Set(rows.map((r) => r.checkTag))).toEqual(checkTagsFromMainline);

    for (const r of rows) {
      const m = mainline.find((mm) => mm.nodeId === r.nodeId)!;
      expect(m.noAdCheckTag).toBe(r.checkTag);
    }
  });

  it('70回退登记表已作废：risk_fallback_70_config 恒为空', () => {
    const rows = readSample<unknown[]>('risk_fallback_70_config');
    expect(rows).toHaveLength(0);
  });

  it('rejects a reward_pool_ref_config row count other than 10', () => {
    const b = loadS7Bundle();
    (b.reward_pool_ref_config as unknown[]).pop(); // 10 → 9，应被拒
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'reward_pool_ref_config' && e.id === '-')).toBe(true);
  });

  it('rejects a rewardParamRef referencing a nonexistent reward_param row', () => {
    const b = loadS7Bundle();
    const row = (b.reward_pool_ref_config as Array<{ rewardAnchorRef: string; sourceTag: string; rewardParamRef: string[] }>)
      .find((r) => r.sourceTag !== 'source_none')!;
    row.rewardParamRef = [...row.rewardParamRef, 'nonexistent_reward_param_row'];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'reward_pool_ref_config' && e.id === row.rewardAnchorRef)).toBe(true);
  });

  it('rejects a no_ad_path_check_config row pointing at a node whose noAdCheckTag disagrees', () => {
    const b = loadS7Bundle();
    const row = (b.no_ad_path_check_config as Array<{ checkTag: string; nodeId: string }>)[0];
    row.nodeId = 'n001'; // n001 的 noAdCheckTag=none，与本行 checkTag 不一致
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'no_ad_path_check_config' && e.id === row.checkTag)).toBe(true);
  });

  it('rejects a risk_fallback_70_config row length mismatch (恒应为0)', () => {
    const b = loadS7Bundle();
    (b.risk_fallback_70_config as unknown[]).push({
      schemaVersion: 's7-0.1.0', nodeId: 'n004', fallback70Tag: 'cut_70',
      fallbackReasonTag: 'test_injected', replacementRef: 'n005_test', criticalPathTag: false,
    });
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'risk_fallback_70_config')).toBe(true);
  });
});

describe('s7 commission_affix_param + positionType validation (第2.5块·块2 悬赏词缀)', () => {
  it('rejects commission_affix_param with illegal positionType', () => {
    const b = loadS7Bundle();
    (b.commission_affix_param[0] as { positionType: string }).positionType = 'tank';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'commission_affix_param' && e.message.includes('positionType'))).toBe(true);
  });

  it('rejects commission_affix_param stat mod with unknown stat key', () => {
    const b = loadS7Bundle();
    (b.commission_affix_param[0] as { mods: Array<Record<string, unknown>> }).mods = [{ channel: 'stat', key: 'luck', op: 'pct', value: 0.3 }];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'commission_affix_param' && e.message.includes('stat mod.key'))).toBe(true);
  });

  it('rejects commission_affix_param affix mod with unknown affix key', () => {
    const b = loadS7Bundle();
    (b.commission_affix_param[0] as { mods: Array<Record<string, unknown>> }).mods = [{ channel: 'affix', key: 'lifesteal', value: 0.3 }];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'commission_affix_param' && e.message.includes('affix mod.key'))).toBe(true);
  });

  it('rejects commission_affix_param with empty mods', () => {
    const b = loadS7Bundle();
    (b.commission_affix_param[0] as { mods: unknown[] }).mods = [];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'commission_affix_param' && e.message.includes('mods'))).toBe(true);
  });

  it('rejects battle_unit_stat_param ship row missing positionType', () => {
    const b = loadS7Bundle();
    const ship = (b.battle_unit_stat_param as Array<Record<string, unknown>>).find((r) => r.targetType === 'ship')!;
    delete ship.positionType;
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'battle_unit_stat_param' && e.message.includes('positionType'))).toBe(true);
  });
});

describe('s7 daily_puzzle_param validation (第2.5块·块4 每日推演·静态那道闸+结构)', () => {
  const puzzleErr = (b: Record<S7ConfigTableName, unknown[]>, sub: string): boolean =>
    validateS7ConfigBundle(b).some((e) => e.table === 'daily_puzzle_param' && e.message.includes(sub));

  it('闸 c：候选战队包数量 <6 被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { candidatePacks: unknown[] };
    p.candidatePacks = p.candidatePacks.slice(0, 5); // 5 < 6
    expect(puzzleErr(b, '候选战队包数量')).toBe(true);
  });

  it('闸 c：候选战队包数量 >8 被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { candidatePacks: Record<string, unknown>[] };
    p.candidatePacks = [...p.candidatePacks, { packId: 'pk9', shipId: 'shp01', pilotId: 'pil01' }]; // 8 → 9
    expect(puzzleErr(b, '候选战队包数量')).toBe(true);
  });

  it('作者解不是正好 5 项被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { authorSolution: unknown[] };
    p.authorSolution = p.authorSolution.slice(0, 4); // 4 ≠ 5
    expect(puzzleErr(b, 'authorSolution 必须正好')).toBe(true);
  });

  it('作者解引用不在候选内的 packId 被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { authorSolution: Record<string, unknown>[] };
    p.authorSolution[0].packId = 'pk_ghost';
    expect(puzzleErr(b, '不在候选内')).toBe(true);
  });

  it('敌阵引用非 enemy 战斗单位被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { enemyFormation: Record<string, unknown>[] };
    p.enemyFormation[0].unitStatRef = 'bu_ship_vanguard'; // 玩家船不是 enemy 单位
    expect(puzzleErr(b, '不是 enemy 战斗单位')).toBe(true);
  });

  it('战队包引用不存在的星舰被拒', () => {
    const b = loadS7Bundle();
    const p = b.daily_puzzle_param[0] as { candidatePacks: Record<string, unknown>[] };
    p.candidatePacks[0].shipId = 'shp99';
    expect(puzzleErr(b, 'pack.shipId')).toBe(true);
  });

  it('非法 threatType 被拒', () => {
    const b = loadS7Bundle();
    (b.daily_puzzle_param[0] as { threatType: string }).threatType = 'lightning';
    expect(puzzleErr(b, 'threatType')).toBe(true);
  });
});
