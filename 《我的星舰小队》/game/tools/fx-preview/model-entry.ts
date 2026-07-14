// 预览壳 v2 的模型入口（esbuild 打包成 IIFE 全局 S7FX·浏览器直用）。
// 预览 v2 与 Cocos S7BattleFxLayer 消费同一个 S7FxPlayModel——磨精改动一处两端生效。
export {
  S7FxPlayModel, S7FX_REF_W, S7FX_REF_H, S7FX_SHIP_COLOR, S7FX_ENEMY_COLOR,
  S7FX_GROUP_RING, S7FX_PILOT_OF_SHIP, S7FX_MUZZLES, S7FX_PART_RIGS,
  S7FX_PIRATE_FLAG_RIG, S7FX_MASTER_SIZE, s7FxVfxForProjectile,
} from '../../assets/scripts/core/s7/fx/S7FxPlayModel';
