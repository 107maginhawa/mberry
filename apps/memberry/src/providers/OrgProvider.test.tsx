import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OrgProvider, useOrgProvider } from './OrgProvider'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ orgSlug: 'test-slug' }),
}))

// Mock SDK query options
vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  getOrganizationBySlugOptions: vi.fn(),
}))

// Mock api
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

import { getOrganizationBySlugOptions } from '@monobase/sdk-ts/generated/react-query'
import { api } from '@/lib/api'

const mockGetOrgBySlug = getOrganizationBySlugOptions as ReturnType<typeof vi.fn>
const mockApiGet = api.get as ReturnType<typeof vi.fn>

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

/** Helper: child component that reads org context and renders values */
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
    vi.clearAllMocks()
  })

  test('useOrgProvider throws outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      renderWithProviders(<ContextReader />)
    }).toThrow('useOrgProvider must be used within <OrgProvider>')

    spy.mockRestore()
  })

  test('provides org context when slug resolves', async () => {
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

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
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_OFFICER_RESPONSE)

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
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

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

  // BR-W0a-3: Active org detection from URL slug
  test('BR-W0a-3: extracts orgSlug from route params and resolves to org', async () => {
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })

    // orgSlug must come from route params (mocked as 'test-slug')
    expect(screen.getByTestId('org-slug')).toHaveTextContent('test-slug')
    // getOrganizationBySlugOptions must be called with the slug from params
    expect(mockGetOrgBySlug).toHaveBeenCalledWith({ path: { slug: 'test-slug' } })
  })

  // BR-W0a-4: Officer role detection — isOfficer true + positions exposed
  test('BR-W0a-4: isOfficer true and positions exposed when officer data returns', async () => {
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_OFFICER_RESPONSE)

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

  // BR-W0a-5: UUID→slug — provider passes slug (not UUID) to slug-resolution query
  test('BR-W0a-5: slug from params is passed to getOrganizationBySlugOptions (not UUID)', async () => {
    // The router mock always returns orgSlug: 'test-slug' (not a UUID).
    // This verifies the provider uses the slug param, not any resolved UUID, for the query.
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

    renderWithProviders(
      <OrgProvider>
        <ContextReader />
      </OrgProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('org-id')).toHaveTextContent('org-uuid-123')
    })

    // slug-resolution query receives slug, not UUID
    expect(mockGetOrgBySlug).toHaveBeenCalledWith({ path: { slug: 'test-slug' } })
    // officer query uses resolved UUID, not slug
    expect(mockApiGet).toHaveBeenCalledWith(
      expect.stringContaining('org-uuid-123'),
    )
  })

  // BR-W0a-6: Membership enrichment — orgSlug available in context alongside orgId
  test('BR-W0a-6: context exposes orgSlug alongside orgId for membership enrichment', async () => {
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(MOCK_ORG),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

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

    // Both UUID (for API calls) and slug (for URLs) must be in context simultaneously
    expect(screen.getByTestId('org-slug')).toHaveTextContent('test-slug')
  })

  // Error state: slug resolution fails → org null, context still renders (no orgId guard skips loading)
  test('error state: when slug resolution returns null, org is null and orgId is empty', async () => {
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(null),
    })
    // officer query is disabled when orgId is empty — should not be called
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

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

    // role is null when no org resolved
    expect(screen.getByTestId('role')).toHaveTextContent('null')
    // officer query must not fire when orgId is empty
    expect(mockApiGet).not.toHaveBeenCalled()
  })

  // Empty orgId guard: queries don't fire when orgSlug is empty
  test('empty orgId guard: officer query does not fire when orgId is empty string', async () => {
    // org query returns nothing (simulates empty/missing slug scenario)
    mockGetOrgBySlug.mockReturnValue({
      queryKey: ['organization', 'slug', 'test-slug'],
      queryFn: () => Promise.resolve(undefined),
    })
    mockApiGet.mockResolvedValue(MOCK_MEMBER_RESPONSE)

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

    // orgId is '' so officer query must be skipped (enabled: !!orgId)
    expect(mockApiGet).not.toHaveBeenCalled()
  })
})
