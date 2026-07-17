import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  // NestJS DI reads TS constructor-parameter metadata (emitDecoratorMetadata), which
  // Vitest's default esbuild transform does not emit -- swc does, so tests wire up DI
  // correctly the same way `nest build`'s tsc output does.
  plugins: [swc.vite()],
  test: {
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/global-setup.ts'],
  },
});
