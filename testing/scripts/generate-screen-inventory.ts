/**
 * Auto-generate screen inventory from TanStack Router route files.
 * Scans apps/memberry/src/routes/ for .tsx files.
 * Outputs testing/generated/screen-inventory.json
 */

import { readdirSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, relative } from 'path'

const ROOT = resolve(import.meta.dir, '../..')
const ROUTES_DIR = resolve(ROOT, 'apps/memberry/src/routes')
const OUT_DIR = resolve(ROOT, 'testing/generated')
const OUT_PATH = resolve(OUT_DIR, 'screen-inventory.json')

interface Screen {
  file: string
  routePath: string
  isLayout: boolean
  isIndex: boolean
  requiresAuth: boolean
  hasParams: boolean
  params: string[]
}

function fileToRoute(filePath: string): string {
  let route = relative(ROUTES_DIR, filePath)
    .replace(/\.tsx$/, '')
    .replace(/\\/g, '/')
    .replace(/\/index$/, '')
    .replace(/^_authenticated/, '')

  // Convert $param to :param for readability
  route = route.replace(/\$(\w+)/g, ':$1')

  return '/' + route.replace(/^\/+/, '')
}

function scanDir(dir: string): Screen[] {
  const screens: Screen[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      screens.push(...scanDir(fullPath))
    } else if (entry.endsWith('.tsx') && !entry.startsWith('__')) {
      const relPath = relative(ROOT, fullPath)
      const routePath = fileToRoute(fullPath)
      const isLayout = entry.startsWith('_') && !entry.includes('index')
      const isIndex = entry === 'index.tsx'
      const requiresAuth = fullPath.includes('_authenticated')
      const params = [...routePath.matchAll(/:(\w+)/g)].map(m => m[1])

      screens.push({
        file: relPath,
        routePath,
        isLayout,
        isIndex,
        requiresAuth,
        hasParams: params.length > 0,
        params,
      })
    }
  }

  return screens
}

const screens = scanDir(ROUTES_DIR)
const pages = screens.filter(s => !s.isLayout)
const layouts = screens.filter(s => s.isLayout)

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify({
  generated: new Date().toISOString(),
  totalScreens: screens.length,
  pages: pages.length,
  layouts: layouts.length,
  authRequired: screens.filter(s => s.requiresAuth).length,
  withParams: screens.filter(s => s.hasParams).length,
  screens,
}, null, 2))

console.log(`Screen inventory: ${pages.length} pages + ${layouts.length} layouts → ${OUT_PATH}`)
