import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    // Playwright e2e specs live in src/e2e/ and use @playwright/test runner, not vitest.
    // Restrict include to *.test.* only so vitest never picks up *.spec.* e2e files.
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
