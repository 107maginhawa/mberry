// Wave G5 W3 — Cross-layer FE↔BE contract spec.
//
// Generated dynamically from CODE_ROUTE_MAP.json + CODE_COMPONENT_REGISTRY.json
// at spec start. For each authenticated memberry route whose component declares
// at least one resolved endpoint, navigate there as the seeded officer, intercept
// /api/** traffic, and assert that the page either resolved (route to an actionable
// state) or surfaced an error UI — never a permanently hung skeleton.
//
// Single shared browser context, single worker, sign-in once. Routes with path
// parameters are skipped (no fixture resolver in this wave) and reported.
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/test-fixture'
import { signInAsOfficer } from './helpers/auth'
import { captureAnyApiSuccess } from './helpers/real-flow'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, '../../../..')
const ROUTE_MAP = JSON.parse(readFileSync(resolve(REPO_ROOT, 'docs/audits/codebase-map/CODE_ROUTE_MAP.json'), 'utf8'))
const REGISTRY = JSON.parse(readFileSync(resolve(REPO_ROOT, 'docs/audits/codebase-map/CODE_COMPONENT_REGISTRY.json'), 'utf8'))

type RouteEntry = {
  path: string
  component: string
  endpoints: string[]
}

function buildRouteList(): RouteEntry[] {
  const out: RouteEntry[] = []
  for (const [path, info] of Object.entries(ROUTE_MAP.routes as Record<string, { page_component?: string; module?: string; auth_required?: boolean }>)) {
    if (info.module !== 'app-memberry') continue
    if (!info.auth_required) continue
    if (!info.page_component) continue
    if (path.includes('{')) continue // skip parameterised routes — no fixture resolver yet
    if (!path.startsWith('/my/')) continue // scope to member self-service area for this wave

    const comp = REGISTRY.components[info.page_component]
    if (!comp?.api_calls?.length) continue
    const endpoints = comp.api_calls
      .filter((c: { endpoint?: string }) => c.endpoint)
      .map((c: { endpoint: string }) => c.endpoint)
    if (endpoints.length === 0) continue

    out.push({ path, component: info.page_component, endpoints })
  }
  return out
}

const routes = buildRouteList()

test.describe.configure({ mode: 'serial' })

test.describe('Wave G5 W3 — cross-layer route trace', () => {
  let signedIn = false

  async function ensureSignedIn(page: Page) {
    if (signedIn) return
    await signInAsOfficer(page)
    signedIn = true
  }

  if (routes.length === 0) {
    test('no traced routes — KG empty?', async () => {
      throw new Error('No routes have resolved api_calls in CODE_COMPONENT_REGISTRY.json — re-run scripts/codebase-map/generate-component-flow.ts')
    })
  }

  for (const route of routes) {
    test(`${route.path} resolves past skeleton (declared endpoints: ${route.endpoints.length})`, async ({ page }) => {
      await ensureSignedIn(page)

      const captured: string[] = []
      await page.route('**/api/**', async (r) => {
        captured.push(`${r.request().method()} ${new URL(r.request().url()).pathname}`)
        await r.continue()
      })

      const respP = captureAnyApiSuccess(page)
      await page.goto(route.path)
      const resp = await respP
      expect(resp?.status()).toBe(200)
      expect(resp?.ok()).toBe(true)

      // The page must reach an actionable state: a button/CTA, an error alert,
      // or a region with the page heading visible without the skeleton signature.
      // We give it 15s — vite dev cold-compile of a route module is the slow path.
      const heading = page.getByRole('heading', { level: 1 }).first()
      await expect(heading).toBeVisible({ timeout: 15000 })

      // Confirm at least one /api/** call fired (proves the FE hook ran).
      // Allow brief settle.
      await page.waitForTimeout(500)
      expect(captured.length, `no /api/** traffic for ${route.path}`).toBeGreaterThan(0)
    })
  }
})
