/**
 * 云存档 mock 适配器（C29）。
 *
 * 纯内存、确定性，仅用于 Node/Vitest。绝不接微信云开发 / wx.cloud / 真实云函数 / 真实账号，
 * 也不读真实后端配置。通过深拷贝整存整取快照，模拟「云端只存一份序列化后的快照」这一边界，
 * 避免与本地对象别名共享导致的误判。
 *
 * 并发判定复用 compareCloudSave：
 *  - 云端无档 / 本地更新 -> 接受写入（accepted）
 *  - 内容一致的同 revision 重传 -> 幂等接受（in_sync，云端不变）
 *  - 云端更新 -> 拒绝（cloud_newer，提示上层先下载）
 *  - 同 revision 但 lastOnlineTime / 内容不同 -> 拒绝并标记 conflict（占位，不做合并）
 */
import {
  CloudSaveAdapter,
  CloudSaveSnapshot,
  CloudUploadResult,
  compareCloudSave,
} from './CloudSaveAdapter';

/** 深拷贝快照，模拟云端「序列化存储」边界，隔离引用别名。 */
function cloneSnapshot(snapshot: CloudSaveSnapshot): CloudSaveSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as CloudSaveSnapshot;
}

export class MockCloudSaveAdapter implements CloudSaveAdapter {
  /** 云端当前权威快照；null 表示云端无档。 */
  private record: CloudSaveSnapshot | null;

  constructor(initial: CloudSaveSnapshot | null = null) {
    this.record = initial ? cloneSnapshot(initial) : null;
  }

  async download(): Promise<CloudSaveSnapshot | null> {
    return this.record ? cloneSnapshot(this.record) : null;
  }

  async upload(snapshot: CloudSaveSnapshot): Promise<CloudUploadResult> {
    const comparison = compareCloudSave(snapshot, this.record);
    const log = [...comparison.log];

    switch (comparison.status) {
      case 'cloud_empty':
      case 'local_newer': {
        // 接受写入：云端权威快照更新为本次上传。
        this.record = cloneSnapshot(snapshot);
        log.push(`cloud_save_upload_accepted status=${comparison.status} revision=${snapshot.revision}`);
        return { accepted: true, status: comparison.status, record: cloneSnapshot(this.record), log };
      }
      case 'in_sync': {
        // 同 revision 且内容一致：幂等接受，云端无需改动。
        log.push(`cloud_save_upload_noop_in_sync revision=${snapshot.revision}`);
        return { accepted: true, status: 'in_sync', record: this.record ? cloneSnapshot(this.record) : null, log };
      }
      case 'cloud_newer': {
        // 云端更新：拒绝上传，返回云端既有快照供上层决定下载。
        log.push(`cloud_save_upload_rejected_cloud_newer cloud=${this.record?.revision}`);
        return { accepted: false, status: 'cloud_newer', record: this.record ? cloneSnapshot(this.record) : null, log };
      }
      case 'conflict':
      default: {
        // 同 revision 分叉：拒绝并占位，不合并；返回云端既有快照与差异来源。
        log.push(`cloud_save_upload_rejected_conflict reason=${comparison.conflictReason}`);
        return {
          accepted: false,
          status: 'conflict',
          conflictReason: comparison.conflictReason,
          record: this.record ? cloneSnapshot(this.record) : null,
          log,
        };
      }
    }
  }

  /** 测试 / 调试辅助：直接读取云端当前快照（深拷贝），不经下载语义。 */
  peek(): CloudSaveSnapshot | null {
    return this.record ? cloneSnapshot(this.record) : null;
  }

  /** 测试 / 调试辅助：直接置入或清空云端快照（传 null 模拟云端无档）。 */
  seed(record: CloudSaveSnapshot | null): void {
    this.record = record ? cloneSnapshot(record) : null;
  }
}
