/**
 * Auto-generate endpoint inventory from OpenAPI spec.
 * Outputs testing/generated/endpoint-inventory.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'

const ROOT = resolve(import.meta.dir, '../..')
const SPEC_PATH = resolve(ROOT, 'specs/api/dist/openapi/openapi.json')
const OUT_DIR = resolve(ROOT, 'testing/generated')
const OUT_PATH = resolve(OUT_DIR, 'endpoint-inventory.json')

interface Endpoint {
  method: string
  path: string
  operationId?: string
  tags: string[]
  hasAuth: boolean
}

const spec = JSON.parse(readFileSync(SPEC_PATH, 'utf-8'))
const endpoints: Endpoint[] = []

for (const [path, methods] of Object.entries(spec.paths || {})) {
  for (const [method, op] of Object.entries(methods as Record<string, any>)) {
    if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
      endpoints.push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        tags: op.tags || [],
        hasAuth: !!(op.security && op.security.length > 0),
      })
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify({ generated: new Date().toISOString(), count: endpoints.length, endpoints }, null, 2))

console.log(`Endpoint inventory: ${endpoints.length} endpoints → ${OUT_PATH}`)

// Summary by tag
const byTag = new Map<string, number>()
for (const ep of endpoints) {
  for (const tag of ep.tags) {
    byTag.set(tag, (byTag.get(tag) || 0) + 1)
  }
}
for (const [tag, count] of [...byTag.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${tag}: ${count}`)
}
