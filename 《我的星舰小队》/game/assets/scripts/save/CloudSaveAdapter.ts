/**
 * 云存档适配器接口与版本比较（C29）。
 *
 * 范围：仅处理本地存档快照（SaveData）的「上传 / 下载 / 版本比较 / 冲突占位」。
 * 与 C08 本地存档保持清晰边界——本模块只整体存取 SaveData 快照，不解析其内部结构、
 * 不读写底层 SaveStorageAdapter、不触碰迁移逻辑（迁移仍归 SaveService.migrateSaveData）。
 *
 * 整体存取语义：上传 / 下载的是一整份 SaveData 快照，包含当前 SaveData 的【所有】字段
 * （含 v6 起的 adFrequencyState / defeatSupplyState，由 SaveService 维护），本模块不解析任何字段的内部语义。
 *
 * 明确不做（属后续任务或越界）：
 *  - 不接真实云账号、不写真实云函数、不调用 wx.cloud 或任何真实后端配置；真机 adapter 另起占位。
 *  - 冲突只做「状态枚举 + 结果表达」，不做任何字段级合并 / 自动选边等复杂合并策略。
 *
 * 时间来源沿用《存档与防重规格》：lastOnlineTime 由本地存档写入，本模块只读不改，
 * 不直接读取系统时间。
 */
import { SaveData } from './SaveService';

/**
 * 云端存档快照：在本地 SaveData 之外附加一个「云修订号」revision。
 *
 * revision 与 SaveData.saveVersion 是两个不同维度：
 *  - saveVersion：存档「结构版本」，结构不兼容变更时递增（C08 既有语义，本模块不改）。
 *  - revision：同一份玩家存档在云端的「修订序号」，每次成功上传 +1，用于判断哪一份快照更新、
 *    以及两端是否从同一基线分叉（同 revision 但内容不同 = 冲突）。
 */
export interface CloudSaveSnapshot {
  /** 云修订号，单调递增；每次成功上传 +1。首次上传建议从 1 起。 */
  revision: number;
  /** 本地存档快照；云端整体存取，不解析内部结构。 */
  data: SaveData;
}

/**
 * 本地与云端快照的比较状态（从「本地」视角表达）：
 * - cloud_empty  云端无档（首次同步 / 云端被清空）
 * - local_newer  本地 revision 高于云端（应上传）
 * - cloud_newer  云端 revision 高于本地（应下载）
 * - in_sync      revision 相同且内容一致（无需同步）
 * - conflict     revision 相同但 lastOnlineTime 或内容不一致（两端从同一基线分叉，需上层决策；本模块只占位不合并）
 */
export type CloudSyncStatus =
  | 'cloud_empty'
  | 'local_newer'
  | 'cloud_newer'
  | 'in_sync'
  | 'conflict';

/** 冲突来源标记，仅 conflict 时有意义，供上层埋点 / 提示用；本模块不据此做合并。 */
export type CloudConflictReason = 'last_online_time' | 'content' | 'both';

export interface CloudCompareResult {
  status: CloudSyncStatus;
  /** 仅当 status === 'conflict' 时给出，标记差异来源。 */
  conflictReason?: CloudConflictReason;
  log: string[];
}

/** 上传结果：是否被云端接受、最终同步状态、以及云端当前权威快照。 */
export interface CloudUploadResult {
  /** 本次上传是否被接受并写入云端（in_sync 的幂等上传也视为已接受）。 */
  accepted: boolean;
  /** 比较 / 处置后的状态：accepted 时为 local_newer / cloud_empty / in_sync；被拒时为 cloud_newer / conflict。 */
  status: CloudSyncStatus;
  /** 仅 conflict 时给出差异来源。 */
  conflictReason?: CloudConflictReason;
  /** 处置后云端权威快照：接受则为新写入快照；冲突 / 落后则为云端既有快照（让上层据此决定下载或合并）。 */
  record: CloudSaveSnapshot | null;
  log: string[];
}

/**
 * 云存档底层适配器接口（平台边界）。
 * 真机侧由后续真实 adapter（如基于微信云开发的实现，属本任务之后）落地，本任务【不得】写真实云调用；
 * 仅提供 MockCloudSaveAdapter 供 Node/Vitest 测试。
 *
 * 约定：adapter 只负责「整存整取一份快照 + 基于 revision 的乐观并发判定」，不做字段级合并、不发奖、不读系统时间。
 */
export interface CloudSaveAdapter {
  /**
   * 上传一份本地快照。基于 revision 做乐观并发：
   * 云端为空或本地更新则写入并返回 accepted；云端更新则拒绝（cloud_newer）；
   * 同 revision 但内容不同则拒绝并标记 conflict（占位，不合并）。
   */
  upload(snapshot: CloudSaveSnapshot): Promise<CloudUploadResult>;
  /** 下载云端当前权威快照；云端无档返回 null。 */
  download(): Promise<CloudSaveSnapshot | null>;
}

/** 去掉 lastOnlineTime 后的内容签名，用于把「时间差异」与「内容差异」分开判定。 */
function contentSignatureExcludingTime(data: SaveData): string {
  const { lastOnlineTime: _ignored, ...rest } = data;
  return JSON.stringify(rest);
}

/**
 * 比较本地快照与云端快照，返回同步状态（纯函数，无副作用）。
 * 冲突合并不在此处理——同 revision 但 lastOnlineTime / 内容不同时仅返回 conflict 占位及差异来源。
 */
export function compareCloudSave(
  local: CloudSaveSnapshot,
  cloud: CloudSaveSnapshot | null,
): CloudCompareResult {
  const log: string[] = [];

  if (cloud === null) {
    log.push('cloud_save_compare_cloud_empty');
    return { status: 'cloud_empty', log };
  }

  if (local.revision > cloud.revision) {
    log.push(`cloud_save_compare_local_newer local=${local.revision} cloud=${cloud.revision}`);
    return { status: 'local_newer', log };
  }

  if (local.revision < cloud.revision) {
    log.push(`cloud_save_compare_cloud_newer local=${local.revision} cloud=${cloud.revision}`);
    return { status: 'cloud_newer', log };
  }

  // revision 相同：比较 lastOnlineTime 与内容，判定 in_sync / conflict。
  const timeDiffers = local.data.lastOnlineTime !== cloud.data.lastOnlineTime;
  const contentDiffers = contentSignatureExcludingTime(local.data) !== contentSignatureExcludingTime(cloud.data);

  if (!timeDiffers && !contentDiffers) {
    log.push(`cloud_save_compare_in_sync revision=${local.revision}`);
    return { status: 'in_sync', log };
  }

  const conflictReason: CloudConflictReason =
    timeDiffers && contentDiffers ? 'both' : timeDiffers ? 'last_online_time' : 'content';
  log.push(`cloud_save_compare_conflict revision=${local.revision} reason=${conflictReason}`);
  return { status: 'conflict', conflictReason, log };
}

/** 构造云快照：包装一份本地存档数据与给定 revision。首次上传建议 revision=1。 */
export function createCloudSnapshot(data: SaveData, revision: number): CloudSaveSnapshot {
  return { revision, data };
}

/** 基于上一份云快照推进一个修订：revision +1、替换为新的本地数据。用于本地变更后上传。 */
export function bumpCloudSnapshot(prev: CloudSaveSnapshot, data: SaveData): CloudSaveSnapshot {
  return { revision: prev.revision + 1, data };
}
