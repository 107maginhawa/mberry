import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OrgIconRail } from './org-icon-rail'
import { useMyOrgs } from '@/hooks/useMyOrgs'

// Mock useMyOrgs
vi.mock('@/hooks/useMyOrgs', () => ({
  useMyOrgs: vi.fn(),
}))

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string; [k: string]: unknown }) => (
    <a href={String(to)} {...props}>{children}</a>
  ),
}))

// Mock @monobase/ui — pass-through wrappers
vi.mock('@monobase/ui', () => ({
  Button: ({ children, ...props }: { children: React.ReactNode; [k: string]: unknown }) => (
    <button {...props}>{children}</button>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}))

// Mock AvatarInitials to render name as text
vi.mock('@/components/patterns/avatar-initials', () => ({
  AvatarInitials: ({ name }: { name: string }) => <span>{name}</span>,
}))

const mockUseMyOrgs = vi.mocked(useMyOrgs)

const ORG_A = {
  id: 'mem-1',
  organizationId: 'org-1',
  orgName: 'Philippine Dental Association',
  orgSlug: 'pda',
  status: 'active',
}

const ORG_B = {
  id: 'mem-2',
  organizationId: 'org-2',
  orgName: 'Manila Dental Society',
  orgSlug: 'mds',
  status: 'active',
}

describe('OrgIconRail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders nothing when no orgs', () => {
    mockUseMyOrgs.mockReturnValue({
      orgs: [],
      isLoading: false,
      error: null,
      activeOrgSlug: null,
    })

    const { container } = renderWithProviders(<OrgIconRail />)

    expect(container.firstChild).toBeNull()
  })

  test('renders org avatars', () => {
    mockUseMyOrgs.mockReturnValue({
      orgs: [ORG_A, ORG_B],
      isLoading: false,
      error: null,
      activeOrgSlug: null,
    })

    renderWithProviders(<OrgIconRail />)

    expect(screen.getByLabelText('Switch to Philippine Dental Association')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Manila Dental Society')).toBeInTheDocument()
  })

  test('highlights active org', () => {
    mockUseMyOrgs.mockReturnValue({
      orgs: [ORG_A, ORG_B],
      isLoading: false,
      error: null,
      activeOrgSlug: 'pda',
    })

    renderWithProviders(<OrgIconRail />)

    const activeButton = screen.getByLabelText('Switch to Philippine Dental Association')
    const inactiveButton = screen.getByLabelText('Switch to Manila Dental Society')

    expect(activeButton).toHaveAttribute('aria-current', 'true')
    expect(inactiveButton).not.toHaveAttribute('aria-current')
  })

  test('shows error state on fetch failure', () => {
    mockUseMyOrgs.mockReturnValue({
      orgs: [],
      isLoading: false,
      error: new Error('Network error'),
      activeOrgSlug: null,
    })

    renderWithProviders(<OrgIconRail />)

    expect(screen.getByText('Failed to load orgs')).toBeInTheDocument()
  })
})
