import { describe, it, expect } from 'vitest';
import { createDefaultSaveData, SaveData } from '../assets/scripts/save/SaveService';
import {
  bumpCloudSnapshot,
  compareCloudSave,
  createCloudSnapshot,
} from '../assets/scripts/save/CloudSaveAdapter';
import { MockCloudSaveAdapter } from '../assets/scripts/save/MockCloudSaveAdapter';

const T0 = 1_700_000_000_000;

/** 构造一份带可控差异的本地存档快照。 */
function makeSaveData(now: number, starCoin = 0): SaveData {
  const data = createDefaultSaveData(now);
  data.playerState.resources.starCoin = starCoin;
  return data;
}

describe('CloudSaveAdapter - mock 上传后可下载', () => {
  it('云端无档时上传被接受，随后下载得到同一份快照', async () => {
    const adapter = new MockCloudSaveAdapter();
    const snapshot = createCloudSnapshot(makeSaveData(T0, 500), 1);

    const upload = await adapter.upload(snapshot);
    expect(upload.accepted).toBe(true);
    expect(upload.status).toBe('cloud_empty');

    const downloaded = await adapter.download();
    expect(downloaded).not.toBeNull();
    expect(downloaded!.revision).toBe(1);
    expect(downloaded!.data.playerState.resources.starCoin).toBe(500);
  });

  it('mock 经序列化边界深拷贝，下载结果与上传对象不共享引用', async () => {
    const adapter = new MockCloudSaveAdapter();
    const snapshot = createCloudSnapshot(makeSaveData(T0, 100), 1);
    await adapter.upload(snapshot);

    // 修改本地原对象不应影响云端已存快照
    snapshot.data.playerState.resources.starCoin = 999;
    const downloaded = await adapter.download();
    expect(downloaded!.data.playerState.resources.starCoin).toBe(100);
  });
});

describe('CloudSaveAdapter - 版本比较各状态', () => {
  it('云端无档 -> cloud_empty', () => {
    const local = createCloudSnapshot(makeSaveData(T0), 1);
    const result = compareCloudSave(local, null);
    expect(result.status).toBe('cloud_empty');
  });

  it('本地版本新于云端 -> local_newer', () => {
    const cloud = createCloudSnapshot(makeSaveData(T0), 1);
    const local = createCloudSnapshot(makeSaveData(T0 + 1000), 2);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('local_newer');
  });

  it('云端版本新于本地 -> cloud_newer', () => {
    const cloud = createCloudSnapshot(makeSaveData(T0 + 1000), 3);
    const local = createCloudSnapshot(makeSaveData(T0), 2);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('cloud_newer');
  });

  it('版本相同且内容一致 -> in_sync', () => {
    const data = makeSaveData(T0, 300);
    const cloud = createCloudSnapshot(data, 5);
    const local = createCloudSnapshot(makeSaveData(T0, 300), 5);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('in_sync');
    expect(result.conflictReason).toBeUndefined();
  });
});

describe('CloudSaveAdapter - 版本相同但冲突 -> conflict 占位', () => {
  it('同 revision 但 lastOnlineTime 不同 -> conflict(last_online_time)', () => {
    const cloud = createCloudSnapshot(makeSaveData(T0, 300), 4);
    const local = createCloudSnapshot(makeSaveData(T0 + 5000, 300), 4);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('conflict');
    expect(result.conflictReason).toBe('last_online_time');
  });

  it('同 revision、同时间但内容不同 -> conflict(content)', () => {
    const cloud = createCloudSnapshot(makeSaveData(T0, 300), 4);
    const local = createCloudSnapshot(makeSaveData(T0, 999), 4);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('conflict');
    expect(result.conflictReason).toBe('content');
  });

  it('同 revision、时间与内容都不同 -> conflict(both)', () => {
    const cloud = createCloudSnapshot(makeSaveData(T0, 300), 4);
    const local = createCloudSnapshot(makeSaveData(T0 + 5000, 999), 4);
    const result = compareCloudSave(local, cloud);
    expect(result.status).toBe('conflict');
    expect(result.conflictReason).toBe('both');
  });
});

describe('CloudSaveAdapter - mock 上传并发判定', () => {
  it('本地更新可覆盖上传，云端推进到新 revision', async () => {
    const adapter = new MockCloudSaveAdapter(createCloudSnapshot(makeSaveData(T0, 100), 1));
    const next = bumpCloudSnapshot(createCloudSnapshot(makeSaveData(T0, 100), 1), makeSaveData(T0 + 1000, 200));

    const upload = await adapter.upload(next);
    expect(upload.accepted).toBe(true);
    expect(upload.status).toBe('local_newer');
    expect(adapter.peek()!.revision).toBe(2);
    expect(adapter.peek()!.data.playerState.resources.starCoin).toBe(200);
  });

  it('云端更新时上传被拒，返回云端权威快照供上层下载', async () => {
    const adapter = new MockCloudSaveAdapter(createCloudSnapshot(makeSaveData(T0 + 9000, 800), 3));
    const stale = createCloudSnapshot(makeSaveData(T0, 100), 2);

    const upload = await adapter.upload(stale);
    expect(upload.accepted).toBe(false);
    expect(upload.status).toBe('cloud_newer');
    expect(upload.record!.revision).toBe(3);
    // 云端未被脏写
    expect(adapter.peek()!.data.playerState.resources.starCoin).toBe(800);
  });

  it('同 revision 分叉上传被拒并标记 conflict，云端不被覆盖', async () => {
    const adapter = new MockCloudSaveAdapter(createCloudSnapshot(makeSaveData(T0, 300), 4));
    const diverged = createCloudSnapshot(makeSaveData(T0 + 5000, 999), 4);

    const upload = await adapter.upload(diverged);
    expect(upload.accepted).toBe(false);
    expect(upload.status).toBe('conflict');
    expect(upload.conflictReason).toBe('both');
    expect(adapter.peek()!.data.playerState.resources.starCoin).toBe(300);
  });

  it('同 revision 且内容一致重传 -> 幂等接受，云端 revision 不变', async () => {
    const adapter = new MockCloudSaveAdapter(createCloudSnapshot(makeSaveData(T0, 300), 4));
    const same = createCloudSnapshot(makeSaveData(T0, 300), 4);

    const upload = await adapter.upload(same);
    expect(upload.accepted).toBe(true);
    expect(upload.status).toBe('in_sync');
    expect(adapter.peek()!.revision).toBe(4);
  });
});
