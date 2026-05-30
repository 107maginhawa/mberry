#!/usr/bin/env bun
/**
 * Wave G5 W2 — Component → hook → endpoint trace.
 *
 * Reads docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json and walks every
 * .tsx/.ts component under apps/*, packages/*, services/*. Detects SDK hook usage
 * (useQuery + *Options, useMutation + *Mutation, @monobase/sdk-ts/flows), resolves
 * each call to an OpenAPI operationId, and looks up the corresponding endpoint in
 * docs/audits/codebase-map/CODE_API_SURFACE.json.
 *
 * Backfills the existing `api_calls: []` slot in CODE_COMPONENT_REGISTRY.json with
 * structured entries `{kind, name, operation_id, endpoint, imported_from, confidence}`,
 * and attaches a `loading_state_hygiene` block per component for the W5 gate.
 *
 * No new npm dependency. Uses Bun's built-in text parsing + regex (the lint-no-skips /
 * lint-shallow-tests pattern in scripts/).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, resolve, relative } from 'path'

const ROOT = resolve(import.meta.dir, '..', '..')
const REGISTRY_PATH = join(ROOT, 'docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json')
const API_SURFACE_PATH = join(ROOT, 'docs/audits/codebase-map/CODE_API_SURFACE.json')
const SDK_REACT_QUERY = join(ROOT, 'packages/sdk-ts/src/generated/@tanstack/react-query.gen.ts')
const META_PATH = join(ROOT, 'docs/audits/codebase-map/.map-meta.json')

type ApiCall = {
  kind: 'react-query-options' | 'react-query-mutation' | 'sdk-flow' | 'raw-fetch'
  name: string
  operation_id?: string
  endpoint?: string
  imported_from?: string
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
} | { method: string; endpoint: string }

type LoadingHygiene = {
  has_skeleton: boolean
  has_error_branch: boolean
  has_timeout: boolean
  has_inline_error_marker: boolean
  has_skeleton_ok_marker: boolean
  violation: 'SKELETON_WITHOUT_ERROR_BRANCH' | null
}

type ComponentEntry = {
  name?: string
  file_path: string
  module?: string
  type?: string
  api_calls?: ApiCall[]
  loading_state_hygiene?: LoadingHygiene
  [k: string]: unknown
}

function buildSdkSymbolMap(): Map<string, { kind: 'options' | 'mutation'; operationId: string }> {
  const src = readFileSync(SDK_REACT_QUERY, 'utf8')
  const map = new Map<string, { kind: 'options' | 'mutation'; operationId: string }>()
  const optionsRe = /^export const (\w+)Options\s*=/gm
  const mutationRe = /^export const (\w+)Mutation\s*=/gm
  for (const m of src.matchAll(optionsRe)) {
    map.set(m[1] + 'Options', { kind: 'options', operationId: m[1] })
  }
  for (const m of src.matchAll(mutationRe)) {
    map.set(m[1] + 'Mutation', { kind: 'mutation', operationId: m[1] })
  }
  return map
}

function buildOperationToEndpoint(): Map<string, { method: string; path: string }> {
  const surface = JSON.parse(readFileSync(API_SURFACE_PATH, 'utf8'))
  const m = new Map<string, { method: string; path: string }>()
  for (const [key, ep] of Object.entries(surface.endpoints) as [string, { handler_function?: string; method: string; path: string }][]) {
    if (ep.handler_function) m.set(ep.handler_function, { method: ep.method, path: ep.path })
  }
  return m
}

function extractImportsFromSdk(src: string) {
  const sdkRq: string[] = []
  const sdkFlows: string[] = []
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@monobase\/sdk-ts\/generated\/react-query['"]/g)) {
    sdkRq.push(...m[1].split(',').map((s) => s.trim().split(' as ')[0]).filter(Boolean))
  }
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@monobase\/sdk-ts\/flows['"]/g)) {
    sdkFlows.push(...m[1].split(',').map((s) => s.trim().split(' as ')[0]).filter(Boolean))
  }
  return { sdkRq, sdkFlows }
}

function detectLoadingHygiene(src: string): LoadingHygiene {
  // Skeleton/spinner signals: animate-spin, Loader2, Skeleton, animate-pulse rendered when isPending/isLoading.
  const skeletonSignals = /(animate-spin|Loader2|<Skeleton|animate-pulse)/
  // Branch detectors — order matters: we need any of these patterns to fire.
  const errorBranch = /\bisError\b|\.isError\b|onError\s*[:=]|catch\s*\(/
  const timeoutBranch = /setTimeout\(|window\.setTimeout/
  const skeletonOk = /\/\/\s*oli-execute:\s*skeleton-ok/
  const inlineErr = /\/\/\s*oli-execute:\s*error-handled-inline/

  const hasSkeleton = skeletonSignals.test(src) && /isPending|isLoading/.test(src)
  const hasErr = errorBranch.test(src)
  const hasTimeout = timeoutBranch.test(src)
  const skeletonOkMarker = skeletonOk.test(src)
  const inlineErrMarker = inlineErr.test(src)

  let violation: LoadingHygiene['violation'] = null
  if (hasSkeleton && !hasErr && !skeletonOkMarker && !inlineErrMarker) {
    violation = 'SKELETON_WITHOUT_ERROR_BRANCH'
  }

  return {
    has_skeleton: hasSkeleton,
    has_error_branch: hasErr,
    has_timeout: hasTimeout,
    has_inline_error_marker: inlineErrMarker,
    has_skeleton_ok_marker: skeletonOkMarker,
    violation,
  }
}

function extractRawFetchCalls(src: string): ApiCall[] {
  const out: ApiCall[] = []
  // Match fetch(`...`) and apiClient.x(`...`) URL strings with /api/ prefix.
  const fetchRe = /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g
  for (const m of src.matchAll(fetchRe)) {
    if (m[1].includes('/api/') || m[1].startsWith('/')) {
      out.push({ method: 'UNKNOWN', endpoint: m[1] })
    }
  }
  return out
}

function buildHookCalls(
  src: string,
  sdkRq: string[],
  sdkFlows: string[],
  sdkMap: Map<string, { kind: 'options' | 'mutation'; operationId: string }>,
  opToEp: Map<string, { method: string; path: string }>,
): ApiCall[] {
  const out: ApiCall[] = []
  const seen = new Set<string>()
  for (const sym of sdkRq) {
    if (!new RegExp(`\\b${sym}\\b`).test(src)) continue
    const entry = sdkMap.get(sym)
    if (!entry) {
      // Hook imported but no matching SDK symbol — could be a re-exported helper.
      out.push({
        kind: 'react-query-options',
        name: sym,
        imported_from: '@monobase/sdk-ts/generated/react-query',
        confidence: 'LOW',
      })
      continue
    }
    const key = `rq:${sym}`
    if (seen.has(key)) continue
    seen.add(key)
    const ep = opToEp.get(entry.operationId)
    out.push({
      kind: entry.kind === 'mutation' ? 'react-query-mutation' : 'react-query-options',
      name: sym,
      operation_id: entry.operationId,
      endpoint: ep ? `${ep.method} ${ep.path}` : undefined,
      imported_from: '@monobase/sdk-ts/generated/react-query',
      confidence: ep ? 'HIGH' : 'MEDIUM',
    })
  }
  for (const sym of sdkFlows) {
    if (!new RegExp(`\\b${sym}\\b`).test(src)) continue
    const key = `flow:${sym}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({
      kind: 'sdk-flow',
      name: sym,
      imported_from: '@monobase/sdk-ts/flows',
      confidence: 'MEDIUM',
    })
  }
  return out
}

function isComponentPath(p: string) {
  return /\.(tsx|ts)$/.test(p) && !/\.test\./.test(p) && !/\.gen\./.test(p)
}

function walk(root: string, out: string[]) {
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next' || name === 'dist' || name === 'build' || name === 'generated') continue
    const p = join(root, name)
    let s
    try { s = statSync(p) } catch { continue }
    if (s.isDirectory()) walk(p, out)
    else if (isComponentPath(p)) out.push(p)
  }
}

async function main() {
  const sdkMap = buildSdkSymbolMap()
  const opToEp = buildOperationToEndpoint()
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'))
  const components: Record<string, ComponentEntry> = registry.components

  // Discover every component-shaped file under apps + packages frontend.
  const allFiles: string[] = []
  walk(join(ROOT, 'apps/memberry/src'), allFiles)
  walk(join(ROOT, 'apps/admin/src'), allFiles)

  let updated = 0
  let added = 0
  let violations = 0

  for (const abs of allFiles) {
    const rel = relative(ROOT, abs)
    let src: string
    try { src = readFileSync(abs, 'utf8') } catch { continue }

    const { sdkRq, sdkFlows } = extractImportsFromSdk(src)
    if (sdkRq.length === 0 && sdkFlows.length === 0 && !/fetch\s*\(/.test(src)) {
      // Still capture loading hygiene if the file has skeleton signals (helpful for the gate).
      if (!/(animate-spin|Loader2|Skeleton|animate-pulse)/.test(src)) continue
    }

    const apiCalls = [
      ...buildHookCalls(src, sdkRq, sdkFlows, sdkMap, opToEp),
      ...extractRawFetchCalls(src),
    ]
    const hygiene = detectLoadingHygiene(src)
    if (hygiene.violation) violations++

    if (components[rel]) {
      components[rel].api_calls = apiCalls
      components[rel].loading_state_hygiene = hygiene
      updated++
    } else {
      components[rel] = {
        name: rel.split('/').pop()!.replace(/\.tsx?$/, ''),
        file_path: rel,
        module: rel.startsWith('apps/memberry') ? 'app-memberry' : rel.startsWith('apps/admin') ? 'app-admin' : 'unknown',
        type: rel.includes('/routes/') ? 'page' : rel.includes('/components/') ? 'component' : 'utility',
        props_in: [],
        events_out: [],
        slots: [],
        state_access: [],
        api_calls: apiCalls,
        loading_state_hygiene: hygiene,
        routes_used_in: [],
        confidence: 'LOW',
      }
      added++
    }
  }

  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n')

  // Update .map-meta.json with new hash + sha.
  const meta = JSON.parse(readFileSync(META_PATH, 'utf8'))
  meta.timestamp = new Date().toISOString()
  meta.regen_note = `Wave G5 W2: component→hook→endpoint trace backfill. Visited ${allFiles.length} files; updated ${updated}, added ${added}; loading_state_hygiene violations: ${violations}.`
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + '\n')

  console.log(`✓ ${updated} components updated, ${added} added, ${violations} loading_state_hygiene violations`)
  if (violations > 0) console.log('  Run scripts/gates/loading-state-hygiene.ts to see them.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
