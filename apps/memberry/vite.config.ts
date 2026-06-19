import { defineConfig } from 'vite'
import viteReact from '@vitejs/plugin-react'
import tsConfigPaths from 'vite-tsconfig-paths'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

// Shared /api → API proxy. Used by both the dev server and `vite preview`
// (the e2e suite serves a production build via preview in CI to avoid
// dev-mode dependency re-optimization, which transiently 404s route chunks
// under concurrent shards and blanks lazily-mounted routes).
const apiProxy = {
  '/api': {
    target: 'http://localhost:7213',
    changeOrigin: true,
    // FIX-009 (G8): proxy WebSocket upgrades too. The chat hook connects to
    // `/api/ws/comms/chat-rooms/:room`; without this the proxy never forwards
    // the Upgrade request and the socket hangs (permanent "Reconnecting…").
    ws: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  server: {
    port: 3004,
    proxy: apiProxy,
  },
  preview: {
    port: 3004,
    proxy: apiProxy,
  },
  plugins: [
    tsConfigPaths({
      ignoreConfigErrors: true
    }),
    tanstackRouter({
      routesDirectory: './src/routes',
      generatedRouteTree: './src/routeTree.gen.ts',
      // Colocated unit tests (*.test.ts/.spec.tsx) live alongside route files;
      // they don't export a Route, so exclude them from route generation to
      // silence the "does not export a Route" boot warnings.
      routeFileIgnorePattern: '\\.(test|spec)\\.(ts|tsx)$',
    }),
    viteReact(),
  ],
  build: {
    outDir: './dist',
    emptyOutDir: true,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Isolate the charting stack (recharts/d3) into its own chunk. It is a
        // leaf dependency consumed only by route-lazy chart components, so
        // splitting it keeps ~280kB off the critical path for the many routes
        // that never render a chart. React/router/app code is intentionally
        // left to Rollup's automatic chunking — hand-splitting the framework
        // breaks module init order and white-screens the app.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (/[\\/](recharts|d3-[^\\/]+|victory[^\\/]*|internmap)[\\/]/.test(id)) {
            return 'charts'
          }
        },
      },
    },
  },
  esbuild: {
    // Mark console.log as side-effect-free so the bundler can drop it in
    // production while keeping console.error/warn/info intact.
    pure: ['console.log'],
  },
})
