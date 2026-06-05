#!/usr/bin/env bun
/**
 * Run Hurl contract tests against the implementation under test.
 *
 * The implementation is whatever HTTP server is running on $API_URL
 * (default http://localhost:7213). The runner does not boot the impl —
 * that's the caller's responsibility, on purpose, so the same script
 * works against the JS impl, a future Rust impl, a remote staging URL, etc.
 *
 * Usage:
 *   # In one terminal: boot the impl
 *   cd services/api-ts && bun dev
 *
 *   # In another terminal: run the contract tests
 *   bun run test:contract
 *
 *   # Or against a remote target
 *   API_URL=https://stg.example.com bun run test:contract
 *
 * Variables injected into every Hurl scenario:
 *   - {{api}}          $API_URL
 *   - {{suffix}}       per-run unique string (timestamp-rand) for fixture isolation
 *   - {{admin_token}}  session token captured in admin preflight (cookie value)
 *   - {{admin_email}}  email of the admin user (signed up by preflight)
 *   - {{admin_password}}  password of the admin user (so scenarios can sign in
 *                         when they need to switch the cookie jar to admin)
 *   - {{mailpit_api}}  Mailpit HTTP API base, default http://localhost:8025
 */

import { spawnSync, spawn } from 'child_process'
import { readdirSync, existsSync } from 'fs'
import { join } from 'path'

const apiUrl = process.env.API_URL ?? 'http://localhost:7213'
const mailpitApi = process.env.MAILPIT_API ?? 'http://localhost:8025'
const adminEmail = process.env.CONTRACT_ADMIN_EMAIL ?? 'admin@contract-tests.local'
const adminPassword = process.env.CONTRACT_ADMIN_PASSWORD ?? 'AdminContractTest!1'
// Origin header value injected into every state-changing scenario request.
// Must match an entry in the impl's CORS_ORIGINS env (hono/csrf rejects mismatches).
// Default mirrors the memberry frontend dev origin, which is always in the dev CORS list.
const contractOrigin = process.env.CONTRACT_ORIGIN ?? 'http://localhost:3004'
// Seeded org id — every org-scoped endpoint needs an x-org-id header that resolves
// to a real organization the admin user belongs to. The seed module creates this
// org on every run; if the seed changes, override via CONTRACT_ORG_ID.
const contractOrgId = process.env.CONTRACT_ORG_ID ?? 'ed8e3a96-8126-4341-be42-e6eb7940c562'
// Seeded president user — IS a member of contractOrgId and holds officer roles
// (vs `admin_email` which is a fresh sign-up auto-promoted to platform-admin but
// not a member of any org). Officer-scoped tests use this account.
const seedOfficerEmail = process.env.CONTRACT_SEED_OFFICER_EMAIL ?? 'test@memberry.ph'
const seedOfficerPassword = process.env.CONTRACT_SEED_OFFICER_PASSWORD ?? 'TestPass123!'

const contractDir = join(import.meta.dir, '..', 'specs', 'api', 'tests', 'contract')

if (!existsSync(contractDir)) {
  console.error(`Contract test dir not found: ${contractDir}`)
  process.exit(1)
}

// Suffix lets each run use unique fixture identifiers (emails, etc.)
const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// Discover .hurl files
const allFiles = readdirSync(contractDir)
  .filter((f) => f.endsWith('.hurl'))
  .sort()
  .map((f) => join(contractDir, f))

if (allFiles.length === 0) {
  console.error('No .hurl files found in', contractDir)
  process.exit(1)
}

// Infrastructure preflight — skip specs that need external services not running.
// Mailpit serves SMTP capture for auth-* scenarios; stripe-mock is required by
// billing-lifecycle. When the service isn't reachable, skipping with a clear
// log is more useful than a 15s connection-refused fail.
const mailpitSpecs = new Set(['auth-password-reset.hurl', 'auth-verification.hurl'])
const stripeSpecs = new Set(['billing-extended-flow.hurl', 'billing-lifecycle.hurl'])

async function reachable(url: string, timeoutMs = 1000): Promise<boolean> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    await fetch(url, { signal: ctrl.signal }).catch(() => null)
    clearTimeout(t)
    return true
  } catch {
    return false
  }
}

const mailpitUp = await reachable(mailpitApi).then((ok) =>
  ok ? fetch(mailpitApi, { signal: AbortSignal.timeout(500) }).then(() => true).catch(() => false) : false,
)
const stripeMockUrl = process.env.STRIPE_API_BASE ?? 'http://localhost:12111'
const stripeUp = process.env.STRIPE_SECRET_KEY != null && (await reachable(stripeMockUrl))

const skipped: Array<{ file: string; reason: string }> = []
const files = allFiles.filter((f) => {
  const base = f.split('/').pop()!
  if (mailpitSpecs.has(base) && !mailpitUp) {
    skipped.push({ file: base, reason: `mailpit unreachable at ${mailpitApi}` })
    return false
  }
  if (stripeSpecs.has(base) && !stripeUp) {
    skipped.push({ file: base, reason: `stripe-mock or STRIPE_SECRET_KEY not configured` })
    return false
  }
  return true
})

// Sanity-check hurl is installed
const probe = spawnSync('hurl', ['--version'], { stdio: 'ignore' })
if (probe.error || probe.status !== 0) {
  console.error('Hurl is not installed. Install it from https://hurl.dev/docs/installation.html')
  console.error('  macOS:  brew install hurl')
  console.error('  Linux:  see hurl.dev install instructions')
  process.exit(127)
}

/**
 * Admin preflight: ensure an admin user exists and capture its session.
 *
 * The impl auto-promotes any sign-up whose email is in AUTH_ADMIN_EMAILS to
 * the admin role. We sign up the configured admin email on the first run;
 * on subsequent runs (with a persistent test DB) sign-up returns 4xx and
 * we fall back to sign-in. Either way we end up with a session_token cookie
 * scoped to an admin role, which we inject as {{admin_token}}.
 */
async function ensureAdminSession(): Promise<string | null> {
  // hono/csrf requires Origin on state-changing requests; Better-Auth sign-up is mounted
  // behind that middleware so we send Origin explicitly here too (Node fetch does not
  // populate it for same-host calls).
  const authHeaders = { 'Content-Type': 'application/json', Origin: contractOrigin } as const

  const signUp = await fetch(`${apiUrl}/auth/sign-up/email`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email: adminEmail, password: adminPassword, name: 'Contract Admin' }),
  })

  if (signUp.ok) {
    return extractSessionCookie(signUp.headers.get('set-cookie'))
  }

  const signIn = await fetch(`${apiUrl}/auth/sign-in/email`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ email: adminEmail, password: adminPassword }),
  })

  if (!signIn.ok) {
    return null
  }
  return extractSessionCookie(signIn.headers.get('set-cookie'))
}

function extractSessionCookie(setCookieHeader: string | null): string | null {
  if (!setCookieHeader) return null
  const match = setCookieHeader.match(/better-auth\.session_token=([^;]+)/)
  return match?.[1] ?? null
}

/**
 * Env preflight: warn (not fail) if the env vars contract scenarios depend on
 * look misconfigured. The runner doesn't try to fix anything — it just tells
 * the caller what's expected.
 */
function envPreflightWarnings(adminTokenAvailable: boolean): string[] {
  const warnings: string[] = []

  if (!adminTokenAvailable) {
    warnings.push(
      `admin preflight failed: could not sign up or sign in as "${adminEmail}". ` +
        `Make sure AUTH_ADMIN_EMAILS on the impl includes "${adminEmail}" and that the email password ` +
        `has not been changed underneath the runner. {{admin_token}} will be unavailable; ` +
        `admin-gated scenarios will not pass.`,
    )
  }

  // Mailpit reachability — only matters for auth-* scenarios.
  return warnings
}

const adminToken = await ensureAdminSession()
const warnings = envPreflightWarnings(adminToken != null)

console.log(`→ ${files.length} contract scenario(s) against ${apiUrl}`)
console.log(`  suffix=${suffix}`)
console.log(`  admin_token=${adminToken ? `(captured for ${adminEmail})` : '(unavailable)'}`)
console.log(`  mailpit_api=${mailpitApi}`)
if (skipped.length > 0) {
  console.log(`  skipped=${skipped.length} (infra prerequisite missing)`)
  for (const s of skipped) console.log(`    ⤬ ${s.file}: ${s.reason}`)
}
if (warnings.length > 0) {
  for (const w of warnings) console.warn(`  ⚠ ${w}`)
}
console.log()

// `timestamp` mirrors `suffix` for legacy scenarios that referenced {{timestamp}}.
// `origin` value is injected into every state-changing request by inject-csrf-into-hurl.ts
// so hono/csrf origin verification passes.
const variables = [
  '--variable', `api=${apiUrl}`,
  '--variable', `suffix=${suffix}`,
  '--variable', `timestamp=${suffix}`,
  '--variable', `origin=${contractOrigin}`,
  '--variable', `org_id=${contractOrgId}`,
  '--variable', `mailpit_api=${mailpitApi}`,
  '--variable', `admin_email=${adminEmail}`,
  '--variable', `admin_password=${adminPassword}`,
  '--variable', `seed_officer_email=${seedOfficerEmail}`,
  '--variable', `seed_officer_password=${seedOfficerPassword}`,
  ...(adminToken ? ['--variable', `admin_token=${adminToken}`] : []),
]

// Serialize execution (--jobs=1). Hurl 8.x defaults to 10 parallel workers,
// which causes flaky session-related failures: many specs sign in as the
// shared seed_officer/admin, and Better-Auth's "invalidate all sessions on
// role change" middleware (auth.ts:217) can clear an in-flight worker's
// session when another worker signs in concurrently. Serial run-time is
// ~30s for 99 files; cheap insurance for repeatable green.
const child = spawn(
  'hurl',
  ['--test', '--jobs', '1', ...variables, ...files],
  { stdio: 'inherit' },
)

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
