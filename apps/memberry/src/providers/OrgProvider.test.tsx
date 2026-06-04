/* eslint-disable @typescript-eslint/no-explicit-any */
// Per test-setup-root.ts §SDK stub guidance: when OrgProvider has already
// been preloaded by sibling tests (via routes/feature components), `mock.module`
// can't override the cached binding. Use the global stub's `.mockImplementation()`
// instead — it mutates the live jest.fn() reference.
import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { getOrganizationBySlugOptions } from '@monobase/sdk-ts/generated/react-query'
import { OrgProvider, useOrgProvider } from './OrgProvider'

;(globalThis as any).__routerParams = { orgSlug: 'test-slug' }

const _getOrgBySlugCalls: any[] = []
let _apiGetImpl: (...args: any[]) => Promise<any> = async () => ({ data: {} })
const _apiGetCalls: any[] = []

const _originalFetch = globalThis.fetch

function setOrgResult(result: any) {
  ;(getOrganizationBySlugOptions as any).mockImplementation((args: any) => {
    _getOrgBySlugCalls.push(args)
    return {
      queryKey: ['organization', 'slug', args?.path?.slug ?? 'test-slug'],
      queryFn: () => Promise.resolve(result),
    }
  })
}

const MOCK_ORG = {
  id: 'org-uuid-123',
  name: 'Test Organization',
  slug: 'test-slug',
}

const MOCK_OFFICER_RESPONSE = {
  data: {
    isOfficer: true,
    positions: [{ title: 'President', organizationId: 'org-uuid-123' }],
  },
}

const MOCK_MEMBER_RESPONSE = {
  data: {
    isOfficer: false,
    positions: [],
  },
}

function ContextReader() {
  const ctx = useOrgProvider()
  return (
    <div>
      <span data-testid="org-id">{ctx.orgId}</span>
      <span data-testid="org-slug">{ctx.orgSlug}</span>
      <span data-testid="role">{ctx.role}</span>
      <span data-testid="is-officer">{String(ctx.isOfficer)}</span>
      <span data-testid="is-loading">{String(ctx.isLoading)}</span>
    </div>
  )
}

describe('OrgProvider', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-slug' }
    _getOrgBySlugCalls.length = 0
    _apiGetImpl = async () => ({ data: {} })
    _apiGetCalls.length = 0
    ;(getOrganizationBySlugOptions as any).mockReset?.()
    setOrgResult(undefined)
    globalThis.fetch = (async (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input?.url ?? String(input)
      _apiGetCalls.push(url)
      if (url.includes('/persons/me/officer-role/')) {
        const body = await _apiGetImpl(url, init)
        return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return _originalFetch(input, init)
    }) as any
  })

  afterEach(() => {
    globalThis.fetch = _originalFetch
  })

  test('useOrgProvider throws outside provider', () => {
    expect(() => {
      renderWithProviders(<ContextReader />)
    }).toThrow('useOrgProvider must be used within <OrgProvider>')
  })

  test('provides org context when slug resolves', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE
    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })
    expect(screen.getByTestId('org-slug')).toHaveTextContent('test-slug')
  })

  test('sets isOfficer when officer data returns', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_OFFICER_RESPONSE
    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('is-officer')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('role')).toHaveTextContent('officer')
  })

  test('sets role to member when not officer', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE
    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })
    expect(screen.getByTestId('role')).toHaveTextContent('member')
    expect(screen.getByTestId('is-officer')).toHaveTextContent('false')
  })

  test('BR-W0a-3: extracts orgSlug from route params and resolves to org', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE
    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })
    expect(screen.getByTestId('org-slug')).toHaveTextContent('test-slug')
    expect(_getOrgBySlugCalls).toContainEqual({ path: { slug: 'test-slug' } })
  })

  test('BR-W0a-4: isOfficer true and positions exposed when officer data returns', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_OFFICER_RESPONSE

    function PositionsReader() {
      const ctx = useOrgProvider()
      return (
        <div>
          <span data-testid="is-officer">{String(ctx.isOfficer)}</span>
          <span data-testid="role">{ctx.role}</span>
          <span data-testid="positions-count">{ctx.permissions.length}</span>
          <span data-testid="position-title">{ctx.permissions[0]?.title ?? ''}</span>
        </div>
      )
    }

    renderWithProviders(
      <OrgProvider>
        <PositionsReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('is-officer')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('role')).toHaveTextContent('officer')
    expect(screen.getByTestId('positions-count')).toHaveTextContent('1')
    expect(screen.getByTestId('position-title')).toHaveTextContent('President')
  })

  test('BR-W0a-5: slug from params is passed to getOrganizationBySlugOptions (not UUID)', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE
    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })
    expect(_getOrgBySlugCalls).toContainEqual({ path: { slug: 'test-slug' } })
    expect(_apiGetCalls.some((c) => typeof c === 'string' && c.includes('org-uuid-123'))).toBe(true)
  })

  test('BR-W0a-6: context exposes orgSlug alongside orgId for membership enrichment', async () => {
    setOrgResult(MOCK_ORG)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE

    function MembershipReader() {
      const ctx = useOrgProvider()
      return (
        <div>
          <span data-testid="org-id">{ctx.orgId}</span>
          <span data-testid="org-slug">{ctx.orgSlug}</span>
        </div>
      )
    }

    renderWithProviders(
      <OrgProvider>
        <MembershipReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })
    expect(screen.getByTestId('org-slug')).toHaveTextContent('test-slug')
  })

  test('error state: when slug resolution returns null, org is null and orgId is empty', async () => {
    setOrgResult(null)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE

    function NullOrgReader() {
      const ctx = useOrgProvider()
      return (
        <div>
          <span data-testid="org-id">{ctx.orgId}</span>
          <span data-testid="role">{ctx.role ?? 'null'}</span>
        </div>
      )
    }

    renderWithProviders(
      <OrgProvider>
        <NullOrgReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('')
    })
    expect(screen.getByTestId('role')).toHaveTextContent('null')
    expect(_apiGetCalls.filter((c) => typeof c === 'string' && c.includes('/persons/me/officer-role/'))).toHaveLength(0)
  })

  test('empty orgId guard: officer query does not fire when orgId is empty string', async () => {
    setOrgResult(undefined)
    _apiGetImpl = async () => MOCK_MEMBER_RESPONSE

    function EmptyOrgReader() {
      const ctx = useOrgProvider()
      return <span data-testid="org-id">{ctx.orgId}</span>
    }

    renderWithProviders(
      <OrgProvider>
        <EmptyOrgReader />
      </OrgProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('')
    })
    expect(_apiGetCalls.filter((c) => typeof c === 'string' && c.includes('/persons/me/officer-role/'))).toHaveLength(0)
  })
})
