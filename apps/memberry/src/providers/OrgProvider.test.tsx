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
})
