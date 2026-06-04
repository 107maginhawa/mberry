import { describe, test, expect } from 'bun:test'
import { createDefaultQueryClient } from '@monobase/sdk-ts/react/provider'

/**
 * GUARDRAIL: Verify QueryClient defaults prevent the retry-storm regression.
 *
 * Context: apps/memberry/src/main.tsx previously used `new QueryClient()` with
 * zero config, bypassing the SDK's defaults. This caused staleTime=0 (refetch
 * every mount) and retry=3 with exponential backoff. When a response transformer
 * threw, the 7.5s retry delay made pages feel broken.
 *
 * These tests ensure createDefaultQueryClient() always provides sane defaults
 * and that main.tsx continues to use it.
 */
describe('QueryClient defaults (regression guard)', () => {
  test('createDefaultQueryClient sets staleTime > 0', () => {
    const client = createDefaultQueryClient()
    const defaults = client.getDefaultOptions()
    expect(defaults.queries?.staleTime).toBeGreaterThan(0)
  })

  test('createDefaultQueryClient sets gcTime > default 5min', () => {
    const client = createDefaultQueryClient()
    const defaults = client.getDefaultOptions()
    // Default gcTime is 5 minutes (300000ms). SDK sets 30min.
    expect(defaults.queries?.gcTime).toBeGreaterThan(300_000)
  })

  test('createDefaultQueryClient uses custom retry function (not default retry=3)', () => {
    const client = createDefaultQueryClient()
    const defaults = client.getDefaultOptions()
    // Must be a function (shouldRetry), not a number.
    // Default retry=3 causes retry storms on transformer errors.
    expect(typeof defaults.queries?.retry).toBe('function')
  })

  test('main.tsx imports createDefaultQueryClient (static check)', async () => {
    // Read main.tsx source to verify it uses createDefaultQueryClient, not bare QueryClient.
    // Use Node fs (works under both Vite and bun:test).
    const fs = await import('node:fs')
    const path = await import('node:path')
    const mainPath = path.resolve(import.meta.dirname ?? __dirname, '..', 'main.tsx')
    const code = fs.readFileSync(mainPath, 'utf8')
    expect(code).toContain('createDefaultQueryClient')
    expect(code).not.toMatch(/new QueryClient\(\s*\)/)
  })
})
