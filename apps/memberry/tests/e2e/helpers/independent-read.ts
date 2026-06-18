/**
 * Clause 4 of the journey DoD — "independent read".
 *
 * Re-verify a journey's goal from a SEPARATE auth session reading durable
 * state, NOT the UI/context the test just drove. This catches the failure
 * where the driving session sees a cached/optimistic value but the change
 * never durably committed (or committed under the wrong tenant/person).
 *
 * `independentRead` mints a brand-new better-auth session (a fresh sign-in,
 * independent of the page's cookies) and exposes a read-only API client.
 * The caller asserts the GOAL STATE on the returned data.
 *
 *   const memberships = await independentRead({ email, password }, (api) =>
 *     api.get('/persons/me/memberships'),
 *   )
 *   expect(memberships.data?.data?.some((m) => m.organizationId === ORG_ID)).toBe(true)
 *
 * Auth can be a seeded role, explicit credentials (dynamically-created
 * users), or a pre-captured storageState.
 */
import { request as pwRequest } from '@playwright/test'
import { freshAuthState, signInState, type AuthRole, type AuthStorageState } from './programmatic-auth'
import { API_BASE } from './test-config'

export type IndependentAuth =
  | AuthRole
  | { email: string; password: string }
  | { storageState: AuthStorageState }

export interface ReaderApi {
  /** GET a durable resource as the independent session. */
  get<T = unknown>(
    path: string,
    opts?: { orgId?: string },
  ): Promise<{ status: number; data: T | null }>
}

async function resolveState(auth: IndependentAuth): Promise<AuthStorageState> {
  if (typeof auth === 'string') return freshAuthState(auth)
  if ('storageState' in auth) return auth.storageState
  return signInState(auth.email, auth.password)
}

export async function independentRead<T>(
  auth: IndependentAuth,
  read: (api: ReaderApi) => Promise<T>,
): Promise<T> {
  const storageState = await resolveState(auth)
  const ctx = await pwRequest.newContext({
    baseURL: API_BASE,
    storageState,
    extraHTTPHeaders: { Origin: 'http://localhost:3004' },
  })
  try {
    const api: ReaderApi = {
      async get(path, opts) {
        const res = await ctx.get(path, {
          headers: opts?.orgId ? { 'x-org-id': opts.orgId } : {},
        })
        const data = await res.json().catch(() => null)
        return { status: res.status(), data: data as never }
      },
    }
    return await read(api)
  } finally {
    await ctx.dispose()
  }
}
