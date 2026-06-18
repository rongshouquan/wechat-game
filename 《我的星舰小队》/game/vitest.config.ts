import { defineConfig } from 'vitest/config';

// 让纯 TS 逻辑测试在 Node 下脱离 Cocos 编辑器运行。
// 工程根 tsconfig.json 通过 extends 引用 ./temp/tsconfig.cocos.json（Cocos 编辑器自动生成、
// 已被 .gitignore 忽略、不入库），新机器/未开过编辑器时该文件不存在，会让 esbuild 解析
// tsconfig 时整体报错。这里直接提供 tsconfigRaw，令 esbuild 跳过对 tsconfig.json 的发现与
// extends 解析；测试本身只 import 解耦后的纯逻辑模块（相对路径，无 cc / 别名），无需类型声明即可运行。
export default defineConfig({
  esbuild: {
    tsconfigRaw: {
      compilerOptions: {
        target: 'es2020',
        useDefineForClassFields: false,
        experimentalDecorators: true,
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    // Windows 上 worker_threads 池偶发 SIGABRT(退出码134/255) worker 崩溃；
    // 改用 forks(子进程)池，纯逻辑测试稳定可复现，速度无明显差异。
    pool: 'forks',
  },
});
