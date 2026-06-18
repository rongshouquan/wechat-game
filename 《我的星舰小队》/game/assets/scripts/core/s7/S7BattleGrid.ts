// 战场网格尺寸：战斗引擎 + 配置校验器共用的「单一真源」（零依赖常量叶子模块）。
//
// v1.0 §4.1：敌方由 3×7 加深为 **5×7**（保 7 列、行数加深，让敌方战场更接近方形、摆怪更灵活/随机）；
//   做成可配置参数，最终行列比 C1b 真机布局时定。我方固定 3×3 九宫格、上阵 5 舰。
// v1.0 §4.1 目标语义说明：前排/后排用「最近/最远·第一/最后排」抽象，与具体行列数无关，
//   故仅改尺寸不影响目标选择正确性（引擎 frontmost/backmost 走「列」轴）。
//
// ⚠️ tools/validate-s7-configs.mjs 是本表的独立 Node 镜像（.mjs 无法 import TS），
//   改这里的行列数必须同步改它顶部的 ENEMY_ROWS/ENEMY_COLS（已加注释指回本文件）。
// 注：校验器按 `r{row}c{col}` 锚点格构造正则，当前实现假设行列数均为个位数（≤10）。

export const S7_PLAYER_ROWS = 3;
export const S7_PLAYER_COLS = 3;
export const S7_ENEMY_ROWS = 5;
export const S7_ENEMY_COLS = 7;
export const S7_MAX_PLAYER_UNITS = 5;
