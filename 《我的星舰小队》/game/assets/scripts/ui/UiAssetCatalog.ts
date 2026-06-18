/**
 * 集中式 UI 资源加载层（P57-1；S6-ART-ENG-01 拆出纯 TS 路径真源）。
 *
 * 职责：按 assetId 取 SpriteFrame 的加载入口，并对登记了 9-slice inset 的资源在
 * 加载后写入 insets（resources 缓存同一 SpriteFrame 实例，重复赋值幂等）。
 * 规则：`assetId -> 路径 / inset` 唯一登记在纯 TS 模块 UiAssetPaths（可被 Vitest 校验），
 * 本文件 re-export 以保持既有引用不变；禁止把 `atlases/...` 路径散落硬编码到各 View/Presenter。
 *
 * 边界：本层只做"assetId -> 路径 -> SpriteFrame"，不含任何战斗/数值/配置/养成业务逻辑；
 * 资源本体由 P57 接入（commit cef31b7 / 归一化 09a765c），台账见
 * 项目管理\运行记录\资产授权台账.md。
 */
import { resources, SpriteFrame } from 'cc';
import { NINE_SLICE_INSETS, UI_ASSET_PATHS, uiAssetPath } from './UiAssetPaths';

export { UI_ASSET_PATHS, uiAssetPath };

const SPRITE_FRAME_SUFFIX = '/spriteFrame';

/**
 * 按 assetId 异步加载 SpriteFrame。未登记或加载失败时返回 null（仅打日志，不抛出），
 * 由调用方决定降级（保留原灰盒外观），不阻断场景装配。
 */
export function loadUiSpriteFrame(assetId: string): Promise<SpriteFrame | null> {
  const base = UI_ASSET_PATHS[assetId];
  if (!base) {
    console.warn('[UiAssetCatalog] 未登记的 assetId，跳过:', assetId);
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    resources.load(base + SPRITE_FRAME_SUFFIX, SpriteFrame, (err, sf) => {
      if (err || !sf) {
        console.warn('[UiAssetCatalog] SpriteFrame 加载失败', assetId, base, err);
        resolve(null);
        return;
      }
      applyNineSliceInsets(assetId, sf);
      resolve(sf);
    });
  });
}

/** 对登记的 9-slice 资源写入冻结 inset；失败安全静默（最多退化为整图拉伸）。 */
function applyNineSliceInsets(assetId: string, sf: SpriteFrame): void {
  const insets = NINE_SLICE_INSETS[assetId];
  if (!insets) {
    return;
  }
  try {
    sf.insetLeft = insets.left;
    sf.insetRight = insets.right;
    sf.insetTop = insets.top;
    sf.insetBottom = insets.bottom;
  } catch (err) {
    console.warn('[UiAssetCatalog] 写入 9-slice inset 失败（已忽略）', assetId, err);
  }
}
