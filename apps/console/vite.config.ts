import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      // Colocated unit tests live alongside route files — exclude them from route
      // generation to silence "does not export a Route" boot warnings.
      routeFileIgnorePattern: '\\.(test|spec)\\.(ts|tsx)$',
    }),
    react(),
    tsconfigPaths(),
  ],
  server: {
    port: 3006,
    proxy: {
      '/api': {
        target: 'http://localhost:7213',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 3006,
    proxy: {
      '/api': {
        target: 'http://localhost:7213',
        changeOrigin: true,
        ws: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
