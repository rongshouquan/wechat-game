// 战场空间朝向 · 唯一真源（B0.7 战场空间公约 · Ron 2026-07-05 拍板·防再犯）。纯 TS·不依赖 cc·可 vitest 测。
//
// 朝向铁律（与战斗演出 S7DemoController.fieldPlayerPos/fieldEnemyPos 同一套·那两个函数亦调用本模块）：
//   - **纵轴 = 深度、横轴 = 横排**；我方在下(前排朝上·贴近敌)、敌方在上(前排朝下·贴近我)。
//   - 引擎格 `p{row}c{col}` / `r{row}c{col}`：**行 row = 横排(左右)、列 col = 深度**。
//   - 我方前排 = col 大(近敌)、敌方前排 = col 0(近我) → 统一 `visualRow = (深度格数-1) - col`
//     （我方 col2→顶=前排；敌方 col0→底=前排），`visualCol = row`。
//
// 🔴 所有阵位/摆位类界面（备战九宫格 / 推演摆位 / 敌情沙盘 …）一律走本换算，**禁止自写坐标映射**（B0.6 #13）。
// 换新格数/换朝向只改这里，全线跟随。

export type S7FieldSide = 'player' | 'enemy';

/** 列=深度格数（引擎：我方 3 深·敌方 7 深）。 */
export const S7_FIELD_DEPTH: Record<S7FieldSide, number> = { player: 3, enemy: 7 };
/** 行=横排格数（引擎：我方 3 横·敌方 5 横）。 */
export const S7_FIELD_LATERAL: Record<S7FieldSide, number> = { player: 3, enemy: 5 };

/** 视觉格：visualRow 0=最上、visualCol 0=最左（标准从上到下、从左到右铺）。 */
export interface S7FieldVisualCell {
  visualRow: number;
  visualCol: number;
}

/**
 * 引擎格 (row=横排, col=深度) → 视觉格（唯一真源·朝向见文件头）。
 * 我方 col2/敌方 col0 = 前排 → 落在各自区域"贴近对方"的那一行。
 */
export function s7FieldVisualCell(side: S7FieldSide, row: number, col: number): S7FieldVisualCell {
  return { visualRow: (S7_FIELD_DEPTH[side] - 1) - col, visualCol: row };
}

/**
 * 某列是否本方前排（贴近对方的一排）：我方前排 = 最大列(col=深度-1·近敌)、敌方前排 = col 0(近我)。
 * 注意"前排"是**语义近敌列**、不等于 visualRow 0——我方前排落 visualRow 0(顶)、敌方前排落 visualRow 深度-1(底)。
 */
export function s7FieldIsFrontRow(side: S7FieldSide, col: number): boolean {
  return side === 'player' ? col === S7_FIELD_DEPTH.player - 1 : col === 0;
}

/**
 * 均匀网格摆放（自建等距网格用·推演页等）：引擎格 → 局部屏幕坐标 (x,y)。
 * anchorX/anchorY = visualCol0/visualRow0 那格的中心；cellW/cellH/gap 决定间距（向右 +x、向下 −y）。
 * 战斗演出的非等距场（fieldPlayerPos/fieldEnemyPos）不走这个、只借 s7FieldVisualCell 定朝向、各套自己的分数间距。
 */
export function s7FieldUniformPos(
  side: S7FieldSide, row: number, col: number,
  anchorX: number, anchorY: number, cellW: number, cellH: number, gap: number,
): { x: number; y: number } {
  const { visualRow, visualCol } = s7FieldVisualCell(side, row, col);
  return { x: anchorX + visualCol * (cellW + gap), y: anchorY - visualRow * (cellH + gap) };
}
