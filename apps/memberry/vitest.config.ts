import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'
import { resolve } from 'path'

export default mergeConfig(
  viteConfig,
  defineConfig({
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['tests/e2e/**', 'node_modules/**'],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/test/**', 'src/**/*.test.{ts,tsx}', 'src/routeTree.gen.ts'],
        thresholds: {
          statements: 67,
          branches: 62,
          functions: 58,
          lines: 70,
        },
      },
    },
  })
)
