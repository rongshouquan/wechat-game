import { describe, it, expect } from 'vitest';
import {
  BrowserLocalStorageAdapter,
  LocalStorageLike,
} from '../assets/scripts/save/SaveStorageAdapter';

/** 用 Map 模拟浏览器 localStorage，供两个独立 adapter 实例共享（模拟"重启预览"后底层存储仍在）。 */
function makeFakeLocalStorage(): LocalStorageLike {
  const store = new Map<string, string>();
  return {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
  };
}

describe('BrowserLocalStorageAdapter', () => {
  it('跨 adapter 实例可读取已写入内容（模拟停止预览后重启仍能恢复）', () => {
    const ls = makeFakeLocalStorage();

    const writer = new BrowserLocalStorageAdapter(ls);
    writer.setString('starship_squad_save_v1', '{"starCoin":10}');

    // 新建一个全新 adapter 实例（模拟重启预览/重新装配 AppContext），底层存储不变
    const reader = new BrowserLocalStorageAdapter(ls);
    expect(reader.getString('starship_squad_save_v1')).toBe('{"starCoin":10}');
  });

  it('未写入的 key 返回 null', () => {
    const adapter = new BrowserLocalStorageAdapter(makeFakeLocalStorage());
    expect(adapter.getString('missing')).toBeNull();
  });

  it('空字符串视为无值（与 Wx/内存适配器语义一致）', () => {
    const ls = makeFakeLocalStorage();
    const adapter = new BrowserLocalStorageAdapter(ls);
    adapter.setString('k', '');
    expect(adapter.getString('k')).toBeNull();
  });

  it('removeString 后读取返回 null', () => {
    const ls = makeFakeLocalStorage();
    const adapter = new BrowserLocalStorageAdapter(ls);
    adapter.setString('k', 'v');
    adapter.removeString('k');
    expect(adapter.getString('k')).toBeNull();
  });
});
