import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  server: {
    port: 3004,
    proxy: {
      '/api': {
        target: 'http://localhost:7213',
        changeOrigin: true,
        // FIX-009 (G8): proxy WebSocket upgrades too. The chat hook connects to
        // `/api/ws/comms/chat-rooms/:room`; without this the dev proxy never
        // forwards the Upgrade request and the socket hangs (permanent
        // "Reconnecting…"). Verified live: before this line the proxied upgrade
        // timed out; after it, the upgrade reaches the API on :7213.
        ws: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    tsConfigPaths({
      ignoreConfigErrors: true
    }),
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
    }),
    viteReact(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: 'esbuild',
  },
  esbuild: {
    // Mark console.log as side-effect-free so the bundler can drop it in
    // production while keeping console.error/warn/info intact.
    pure: ['console.log'],
  },
})
