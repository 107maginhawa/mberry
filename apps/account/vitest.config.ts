import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsConfigPaths({ ignoreConfigErrors: true }),
    react(),
  ],
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['src/**/*.e2e.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/routeTree.gen.ts'],
      thresholds: {
        statements: 75,
        branches: 76,
        functions: 75,
        lines: 75,
      },
    },
  },
})
