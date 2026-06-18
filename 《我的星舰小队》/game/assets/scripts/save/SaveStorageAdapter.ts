/**
 * 存档底层读写适配器接口。
 * 真机侧（微信）走 wx.setStorageSync/getStorageSync；测试侧用内存实现，便于在 Node/Vitest 独立验证存档逻辑。
 */
export interface SaveStorageAdapter {
  getString(key: string): string | null;
  setString(key: string, value: string): void;
  removeString(key: string): void;
}

/** 内存存储适配器：仅用于 Node/Vitest 测试，模拟"应用重启后仍能读到上次写入内容"。 */
export class MemoryStorageAdapter implements SaveStorageAdapter {
  private store = new Map<string, string>();

  getString(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setString(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeString(key: string): void {
    this.store.delete(key);
  }
}

/**
 * 微信小游戏存储适配器：底层调用 wx.setStorageSync / wx.getStorageSync。
 * 不在此处 import 'wx' 类型，而是通过运行时注入的全局对象访问，避免核心模块直接依赖 Cocos/微信运行时
 *（符合 game/CLAUDE.md「核心逻辑不得依赖 cc，需可在 Node/Vitest 独立测试」的项目专属原则）。
 */
export interface WxStorageLike {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
}

export class WxStorageAdapter implements SaveStorageAdapter {
  constructor(private readonly wx: WxStorageLike) {}

  getString(key: string): string | null {
    const value = this.wx.getStorageSync(key);
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    return value;
  }

  setString(key: string, value: string): void {
    this.wx.setStorageSync(key, value);
  }

  removeString(key: string): void {
    this.wx.removeStorageSync(key);
  }
}

/**
 * 浏览器 localStorage 存储接口（Web/编辑器预览环境）。
 * 只声明用到的方法，避免直接依赖 DOM lib 类型，保持核心模块可在 Node/Vitest 注入测试。
 */
export interface LocalStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * 浏览器 localStorage 存档适配器：底层走 globalThis.localStorage。
 * 主要用于 Cocos Creator 编辑器/Web 预览环境（无 wx），让"停止预览后重进不丢关键状态"可被验证；
 * 真机仍走 WxStorageAdapter。空字符串视为无值，语义与 Wx/内存适配器一致。
 */
export class BrowserLocalStorageAdapter implements SaveStorageAdapter {
  constructor(private readonly storage: LocalStorageLike) {}

  getString(key: string): string | null {
    const value = this.storage.getItem(key);
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    return value;
  }

  setString(key: string, value: string): void {
    this.storage.setItem(key, value);
  }

  removeString(key: string): void {
    this.storage.removeItem(key);
  }
}
