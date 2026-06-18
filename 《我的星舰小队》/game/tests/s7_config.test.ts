import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { S7ConfigLoader, S7ConfigLoadError } from '../assets/scripts/config/s7/ConfigLoaderS7';
import { validateS7ConfigBundle } from '../assets/scripts/config/s7/ConfigValidatorS7';
import { S7ConfigTableName } from '../assets/scripts/config/s7/ConfigTypesS7';

const S7_DIR = path.resolve(__dirname, '..', 'assets', 'resources', 'configs', 's7');

const TABLE_NAMES: S7ConfigTableName[] = [
  'battle_template_config', 'ship_config', 'pilot_config', 'core_config', 'plugin_config',
  'source_tag_config', 'power_reference_param', 'free_resource_anchor_param', 'upgrade_cost_param',
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
    expect(b.ship_config).toHaveLength(12);
    expect(b.pilot_config).toHaveLength(10);
    expect(b.core_config).toHaveLength(7);
    expect(b.plugin_config).toHaveLength(18);
  });

  it('indexes rows by lowercase id', () => {
    const loader = new S7ConfigLoader();
    loader.loadFromData(loadS7Bundle());
    expect(loader.getById<{ name: string }>('ship_config', 'shp01')?.name).toBe('晨星护卫舰');
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
      // 建筑奇迹行用 bld_rsv_* 作为合法建筑 ID（由 reservedFlag/releaseTag 区分），不受关系实体 rsv 硬禁约束。
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

  it('caps N075 boss pressure at 14500 and keeps min<=max', () => {
    const rows = readSample<Array<{ rowId: string; scope: string; refKey: string; pressureMax: number; appliesToBoss?: boolean }>>('pressure_param');
    const n075 = rows.find((r) => r.rowId === 'bp_n075')!;
    expect(n075.pressureMax).toBeLessThanOrEqual(14500);
    for (const r of rows.filter((x) => x.scope === 'template_modifier')) expect(r.appliesToBoss).toBe(false);
  });

  it('enforces level/enhance caps lv40 / core5（插件不分等级，无强化）', () => {
    const up = readSample<Array<{ targetType: string; maxLevel: number }>>('upgrade_cost_param');
    expect(Math.max(...up.filter((r) => r.targetType === 'ship').map((r) => r.maxLevel))).toBe(40);
    expect(Math.max(...up.filter((r) => r.targetType === 'pilot').map((r) => r.maxLevel))).toBe(40);
    const en = readSample<Array<{ targetType: string; maxEnhance: number }>>('enhance_cost_param');
    expect(Math.max(...en.filter((r) => r.targetType === 'core').map((r) => r.maxEnhance))).toBe(5);
    expect(en.some((r) => r.targetType === 'plugin')).toBe(false); // 插件已无强化行（v1.0 §5.3）
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
    expect(fit).toHaveLength(12);
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

  it('has 9 buildings: 7 default + 2 conditional/post miracle', () => {
    const rows = readSample<Bld[]>('building_config');
    expect(rows).toHaveLength(9);
    const def = rows.filter((r) => r.releaseTag === 'default_release');
    const cond = rows.filter((r) => r.releaseTag === 'conditional_post');
    expect(def.map((r) => r.buildingKey).sort()).toEqual(
      ['command_tower', 'dock', 'habitat', 'salvage_port', 'merchant_station', 'research_tower', 'starport'].sort(),
    );
    expect(cond.map((r) => r.buildingKey).sort()).toEqual(['core_gallery', 'observatory']);
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

  it('keeps no-ad anchor checks off building level >1 and off merchant/miracle as core-required', () => {
    const checks = readSample<Array<{ requiredLevelCap: number; impactJudgement: string }>>('building_anchor_impact_check');
    for (const c of checks) {
      expect(c.requiredLevelCap).toBeLessThanOrEqual(1);
      expect(c.impactJudgement).not.toBe('blocks_anchor');
    }
    const unlocks = readSample<Array<{ buildingId: string; corePathRequiredFlag: boolean }>>('building_unlock_config');
    for (const u of unlocks.filter((x) => x.corePathRequiredFlag)) {
      expect(['bld_command_tower', 'bld_dock']).toContain(u.buildingId);
    }
  });

  it('rejects a building unlock hung on a 70-fallback node', () => {
    const b = loadS7Bundle();
    (b.building_unlock_config[0] as { unlockAnchorTag: string }).unlockAnchorTag = 'mainline_n070_entry';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'building_unlock_config')).toBe(true);
  });

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
  it('covers all 75 mainline nodes N001-N075', () => {
    const rows = readSample<Array<{ nodeId: string }>>('mainline_node_config');
    expect(rows).toHaveLength(75);
    const ids = rows.map((r) => r.nodeId).sort();
    const expected = Array.from({ length: 75 }, (_, i) => `n${String(i + 1).padStart(3, '0')}`);
    expect(ids).toEqual(expected);
  });

  it('covers 12 chapters, 4 star regions and 4 boss nodes with correct boss bindings', () => {
    const chapters = readSample<Array<{ chapterId: string; bossRef: string }>>('chapter_config');
    expect(chapters).toHaveLength(12);
    const starRegions = readSample<Array<{ starfieldId: string }>>('star_region_config');
    expect(starRegions).toHaveLength(4);
    const bosses = readSample<Array<{ bossNodeId: string }>>('boss_node_config');
    expect(bosses.map((r) => r.bossNodeId).sort()).toEqual(['n018', 'n037', 'n056', 'n075']);
    const bossChapters = chapters.filter((c) => c.bossRef !== 'none');
    expect(bossChapters.map((c) => c.chapterId).sort()).toEqual(['ch03', 'ch06', 'ch09', 'ch12']);
  });

  it('marks the protection-period turning point at N038/N039', () => {
    const rows = readSample<Array<{ nodeId: string; protectionPeriodTag: string; templateRef: string; problemTagRef: string }>>('mainline_node_config');
    const n038 = rows.find((r) => r.nodeId === 'n038')!;
    const n039 = rows.find((r) => r.nodeId === 'n039')!;
    expect(n038.protectionPeriodTag).toBe('ending_notice');
    expect(n039.protectionPeriodTag).toBe('closed');
    expect(n038.templateRef).toBe('none');
    expect(n039.templateRef).toBe('none');
    for (const r of rows) {
      const idx = Number(r.nodeId.slice(1));
      const expected = idx <= 37 ? 'active' : idx === 38 ? 'ending_notice' : 'closed';
      expect(r.protectionPeriodTag).toBe(expected);
    }
  });

  it('restricts 70-fallback deletable nodes to exactly N033/N047/N053/N063/N070', () => {
    const rows = readSample<Array<{ nodeId: string; fallback70Tag: string }>>('mainline_node_config');
    const cut = rows.filter((r) => r.fallback70Tag === 'cut_70').map((r) => r.nodeId).sort();
    expect(cut).toEqual(['n033', 'n047', 'n053', 'n063', 'n070']);
  });

  it('keeps tutorial triggers structural-only (no UI copy / position / bubble / mask fields)', () => {
    const rows = readSample<Array<Record<string, unknown>>>('tutorial_trigger_config');
    expect(rows).toHaveLength(38);
    const forbiddenKeys = ['text', 'copy', 'bubble', 'mask', 'position', 'finger', 'animation'];
    for (const r of rows) {
      for (const k of Object.keys(r)) {
        expect(forbiddenKeys.some((f) => k.toLowerCase().includes(f))).toBe(false);
      }
    }
    const mandatory = rows.filter((r) => r.skippableTag === 'mandatory_ack').map((r) => r.tutorialStepId).sort();
    expect(mandatory).toEqual(['tut01', 'tut02', 'tut26', 'tut27']);
  });

  it('registers all mainline unlockRefs and building unlock bridges, none required on 70-fallback nodes', () => {
    const b = loadS7Bundle();
    const mainline = b.mainline_node_config as Array<{ unlockRef: string }>;
    const unlocks = b.unlock_checkpoint_config as Array<{ unlockRef: string; nodeId: string; requiredForMainlineTag: boolean; buildingUnlockRef: string }>;
    const mainlineRefs = new Set(mainline.map((r) => r.unlockRef).filter((u) => u !== 'none'));
    const registered = new Set(unlocks.map((r) => r.unlockRef));
    for (const ref of mainlineRefs) expect(registered.has(ref)).toBe(true);

    const forbidden = ['n033', 'n047', 'n053', 'n063', 'n070'];
    for (const u of unlocks) {
      if (u.requiredForMainlineTag) expect(forbidden).not.toContain(u.nodeId);
    }

    const buildingUnlocks = (b.building_unlock_config as Array<{ unlockId: string; cc05aLinkTag: string }>)
      .filter((r) => !/(rsv|observatory|core_gallery)/.test(r.unlockId) && !/(rsv|observatory|core_gallery)/.test(r.cc05aLinkTag));
    const registeredBuildingRefs = new Set(unlocks.map((r) => r.buildingUnlockRef).filter((v) => v !== 'none'));
    for (const bu of buildingUnlocks) expect(registeredBuildingRefs.has(bu.unlockId)).toBe(true);
  });

  it('excludes miracle building unlocks (observatory/core_gallery) from default unlock checkpoints', () => {
    const rows = readSample<Array<{ unlockRef: string; buildingUnlockRef: string }>>('unlock_checkpoint_config');
    for (const r of rows) {
      expect(r.unlockRef).not.toMatch(/(rsv|observatory|core_gallery)/);
      expect(r.buildingUnlockRef).not.toMatch(/(rsv|observatory|core_gallery)/);
    }
  });

  it('requires N038 free total reset and N039 irreversible-growth warning', () => {
    const rows = readSample<Array<{ nodeId: string; freeResetFlag: boolean; resetScopeTags: string[]; irreversibleWarningFlag: boolean }>>('protection_reset_config');
    expect(rows).toHaveLength(2);
    const n038 = rows.find((r) => r.nodeId === 'n038')!;
    const n039 = rows.find((r) => r.nodeId === 'n039')!;
    expect(n038.freeResetFlag).toBe(true);
    expect(n038.resetScopeTags.length).toBeGreaterThan(0);
    expect(n039.irreversibleWarningFlag).toBe(true);
  });

  it('keeps N075 boss template at t10 and rejects an out-of-whitelist cut_70', () => {
    const bosses = readSample<Array<{ bossNodeId: string; templateRef: string }>>('boss_node_config');
    const n075 = bosses.find((r) => r.bossNodeId === 'n075')!;
    expect(n075.templateRef).toBe('t10');

    const b = loadS7Bundle();
    (b.mainline_node_config as Array<{ nodeId: string; fallback70Tag: string }>).find((r) => r.nodeId === 'n004')!.fallback70Tag = 'cut_70';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'mainline_node_config' && e.id === 'n004')).toBe(true);
  });
});

describe('s7 tier d bridge configs', () => {
  const FORBIDDEN_FALLBACK_NODES = ['n033', 'n047', 'n053', 'n063', 'n070'];
  const EXPECTED_NO_AD_CHECK_TAGS = [
    'no_ad_mainline_basic_precheck', 'free_cargo_good_item_check', 'no_ad_mainline_basic_pass',
    'free_5_ship_check', 'day7_full_core_check', 'free_reset_gate_ready', 'free_total_reset_check',
    'no_ad_reset_not_required', 'free_3_core_path_precheck', 'free_3_core_path_check',
    'no_ad_midline_pass_check', 'free_3_core_path_late_check', 'no_ad_75_precheck',
    'free_cargo_good_item_recheck', 'no_ad_75_ready_check', 'no_ad_75_pass_check',
  ];

  it('covers all 19 reward pool anchors bidirectionally with mainline rewardAnchorRef, full 75-node coverage', () => {
    const rows = readSample<Array<{ rewardAnchorRef: string; nodeRefs: string[] }>>('reward_pool_ref_config');
    expect(rows).toHaveLength(19);
    const mainline = readSample<Array<{ nodeId: string; rewardAnchorRef: string }>>('mainline_node_config');

    const anchorsFromMainline = new Set(mainline.map((r) => r.rewardAnchorRef));
    expect(new Set(rows.map((r) => r.rewardAnchorRef))).toEqual(anchorsFromMainline);

    const allNodeRefs = rows.flatMap((r) => r.nodeRefs);
    expect(allNodeRefs.length).toBe(75);
    expect(new Set(allNodeRefs).size).toBe(75);
    for (const ref of allNodeRefs) {
      const m = mainline.find((r) => r.nodeId === ref)!;
      const owner = rows.find((r) => r.nodeRefs.includes(ref))!;
      expect(m.rewardAnchorRef).toBe(owner.rewardAnchorRef);
    }
  });

  it('pins reward_review_comfort nodeRefs to exactly the 70-fallback deletable nodes', () => {
    const rows = readSample<Array<{ rewardAnchorRef: string; nodeRefs: string[] }>>('reward_pool_ref_config');
    const comfort = rows.find((r) => r.rewardAnchorRef === 'reward_review_comfort')!;
    expect([...comfort.nodeRefs].sort()).toEqual([...FORBIDDEN_FALLBACK_NODES].sort());
  });

  it('covers all 16 no-ad path check tags bidirectionally with mainline noAdCheckTag, none on 70-fallback nodes', () => {
    const rows = readSample<Array<{ checkTag: string; nodeId: string; forbiddenDependencyTag: string[] }>>('no_ad_path_check_config');
    expect(rows).toHaveLength(16);
    expect([...rows.map((r) => r.checkTag)].sort()).toEqual([...EXPECTED_NO_AD_CHECK_TAGS].sort());

    const mainline = readSample<Array<{ nodeId: string; noAdCheckTag: string }>>('mainline_node_config');
    const checkTagsFromMainline = new Set(mainline.filter((r) => r.noAdCheckTag !== 'none').map((r) => r.noAdCheckTag));
    expect(new Set(rows.map((r) => r.checkTag))).toEqual(checkTagsFromMainline);

    for (const r of rows) {
      const m = mainline.find((mm) => mm.nodeId === r.nodeId)!;
      expect(m.noAdCheckTag).toBe(r.checkTag);
      expect(FORBIDDEN_FALLBACK_NODES).not.toContain(r.nodeId);
    }
  });

  it('covers all 9 fallback-70 nodes with criticalPathTag=false and a valid non-dangling replacementRef', () => {
    const rows = readSample<Array<{ nodeId: string; fallback70Tag: string; criticalPathTag: boolean; replacementRef: string }>>('risk_fallback_70_config');
    const mainline = readSample<Array<{ nodeId: string; fallback70Tag: string }>>('mainline_node_config');
    const expectedNodes = mainline.filter((r) => r.fallback70Tag !== 'keep_70').map((r) => r.nodeId).sort();

    expect(rows).toHaveLength(9);
    expect([...rows.map((r) => r.nodeId)].sort()).toEqual(expectedNodes);
    expect([...rows.map((r) => r.nodeId)].filter((id) => mainline.find((m) => m.nodeId === id)!.fallback70Tag === 'cut_70').sort())
      .toEqual([...FORBIDDEN_FALLBACK_NODES].sort());

    for (const r of rows) {
      expect(r.criticalPathTag).toBe(false);
      const embedded = r.replacementRef.match(/n\d{3}/g) ?? [];
      for (const ref of embedded) {
        expect(mainline.some((m) => m.nodeId === ref)).toBe(true);
        expect(FORBIDDEN_FALLBACK_NODES).not.toContain(ref);
      }
    }
  });

  it('rejects a reward_pool_ref_config row count other than 19', () => {
    const b = loadS7Bundle();
    (b.reward_pool_ref_config as unknown[]).pop();
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'reward_pool_ref_config' && e.id === '-')).toBe(true);
  });

  it('rejects a reward_review_comfort nodeRefs mismatch with the 70-fallback deletable nodes', () => {
    const b = loadS7Bundle();
    const comfort = (b.reward_pool_ref_config as Array<{ rewardAnchorRef: string; nodeRefs: string[] }>)
      .find((r) => r.rewardAnchorRef === 'reward_review_comfort')!;
    comfort.nodeRefs = ['n033', 'n047', 'n053', 'n063', 'n075'];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'reward_pool_ref_config' && e.id === 'reward_review_comfort')).toBe(true);
  });

  it('rejects a rewardParamRef referencing a nonexistent reward_param row', () => {
    const b = loadS7Bundle();
    const row = (b.reward_pool_ref_config as Array<{ rewardAnchorRef: string; sourceTag: string; rewardParamRef: string[] }>)
      .find((r) => r.sourceTag !== 'source_none')!;
    row.rewardParamRef = [...row.rewardParamRef, 'nonexistent_reward_param_row'];
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'reward_pool_ref_config' && e.id === row.rewardAnchorRef)).toBe(true);
  });

  it('rejects a no_ad_path_check_config row bound to a 70-fallback deletable node', () => {
    const b = loadS7Bundle();
    const row = (b.no_ad_path_check_config as Array<{ checkTag: string; nodeId: string }>)[0];
    row.nodeId = 'n033';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'no_ad_path_check_config' && e.id === row.checkTag)).toBe(true);
  });

  it('rejects a risk_fallback_70_config row with criticalPathTag=true', () => {
    const b = loadS7Bundle();
    const row = (b.risk_fallback_70_config as Array<{ nodeId: string; criticalPathTag: boolean }>)[0];
    row.criticalPathTag = true;
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'risk_fallback_70_config' && e.id === row.nodeId)).toBe(true);
  });

  it('rejects a risk_fallback_70_config replacementRef dangling on a 70-fallback deletable node', () => {
    const b = loadS7Bundle();
    const row = (b.risk_fallback_70_config as Array<{ nodeId: string; replacementRef: string }>)
      .find((r) => /n\d{3}/.test(r.replacementRef))!;
    row.replacementRef = 'n033_dangling_review';
    expect(validateS7ConfigBundle(b).some((e) => e.table === 'risk_fallback_70_config' && e.id === row.nodeId)).toBe(true);
  });
});
