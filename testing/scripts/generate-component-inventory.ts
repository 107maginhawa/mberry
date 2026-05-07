/**
 * Auto-generate component inventory from apps/memberry/src/features/.
 * Finds all .tsx files that export React components (not hooks, not utils).
 * Outputs testing/generated/component-inventory.json
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, relative } from 'path'

const ROOT = resolve(import.meta.dir, '../..')
const FEATURES_DIR = resolve(ROOT, 'apps/memberry/src/features')
const OUT_DIR = resolve(ROOT, 'testing/generated')
const OUT_PATH = resolve(OUT_DIR, 'component-inventory.json')

interface ComponentEntry {
  file: string
  feature: string
  name: string
  hasTest: boolean
  testFile?: string
}

function scanDir(dir: string): ComponentEntry[] {
  const components: ComponentEntry[] = []

  for (const entry of readdirSync(dir)) {
    const fullPath = resolve(dir, entry)
    const stat = statSync(fullPath)

    if (stat.isDirectory()) {
      components.push(...scanDir(fullPath))
    } else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx') && !entry.startsWith('use-')) {
      const relPath = relative(ROOT, fullPath)
      // Only include files in components/ directories (not pages, not lib)
      if (!relPath.includes('/components/')) continue

      const content = readFileSync(fullPath, 'utf-8')
      // Quick heuristic: has JSX export
      if (!content.includes('export') || (!content.includes('return (') && !content.includes('return <'))) continue

      const feature = relPath.split('/features/')[1]?.split('/')[0] || 'unknown'
      const name = entry.replace('.tsx', '')
      const testPath = fullPath.replace('.tsx', '.test.tsx')
      let hasTest = false
      try { statSync(testPath); hasTest = true } catch {}

      components.push({
        file: relPath,
        feature,
        name,
        hasTest,
        testFile: hasTest ? relative(ROOT, testPath) : undefined,
      })
    }
  }

  return components
}

const components = scanDir(FEATURES_DIR)
const tested = components.filter(c => c.hasTest)
const untested = components.filter(c => !c.hasTest)

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify({
  generated: new Date().toISOString(),
  totalComponents: components.length,
  tested: tested.length,
  untested: untested.length,
  coveragePercent: components.length > 0 ? Math.round((tested.length / components.length) * 100) : 0,
  components,
}, null, 2))

console.log(`Component inventory: ${components.length} total | ${tested.length} tested | ${untested.length} untested → ${OUT_PATH}`)

if (untested.length > 0) {
  console.log('\nUntested components:')
  for (const c of untested.slice(0, 15)) {
    console.log(`  ${c.feature}/${c.name}`)
  }
  if (untested.length > 15) console.log(`  ... and ${untested.length - 15} more`)
}
