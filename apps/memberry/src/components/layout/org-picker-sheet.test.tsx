import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OrgPickerSheet } from './org-picker-sheet'
import type { OrgMembership } from '@/hooks/useMyOrgs'

// Mock @tanstack/react-router
const mockNavigate = vi.fn()
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={String(to)}>{children}</a>
  ),
}))

// Mock avatar component
vi.mock('@/components/patterns/avatar-initials', () => ({
  AvatarInitials: ({ name }: { name: string }) => (
    <div data-testid="avatar">{name}</div>
  ),
}))

// Mock @monobase/ui — Sheet must gate on `open` prop
vi.mock('@monobase/ui', () => ({
  Sheet: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div data-testid="sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sheet-content">{children}</div>
  ),
  SheetHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  SheetTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
  Button: ({
    children,
    onClick,
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>,
}))

function makeOrg(overrides: Partial<OrgMembership> = {}): OrgMembership {
  return {
    id: 'mem-1',
    organizationId: 'org-1',
    orgName: 'Test Org',
    orgSlug: 'test-org',
    status: 'active',
    ...overrides,
  }
}

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  orgs: [] as OrgMembership[],
  activeOrgSlug: null as string | null,
}

describe('OrgPickerSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders org list when open', () => {
    const orgs = [
      makeOrg({ id: '1', organizationId: 'o1', orgName: 'Alpha Dental', orgSlug: 'alpha' }),
      makeOrg({ id: '2', organizationId: 'o2', orgName: 'Beta Medical', orgSlug: 'beta' }),
    ]

    renderWithProviders(
      <OrgPickerSheet {...defaultProps} orgs={orgs} />
    )

    expect(screen.getByText('Your Organizations')).toBeInTheDocument()
    // Name appears in both avatar mock and org label
    expect(screen.getAllByText('Alpha Dental').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Beta Medical').length).toBeGreaterThanOrEqual(1)
  })

  test('renders nothing when closed', () => {
    const orgs = [
      makeOrg({ id: '1', organizationId: 'o1', orgName: 'Alpha Dental', orgSlug: 'alpha' }),
    ]

    renderWithProviders(
      <OrgPickerSheet {...defaultProps} open={false} orgs={orgs} />
    )

    expect(screen.queryByText('Your Organizations')).not.toBeInTheDocument()
    expect(screen.queryByText('Alpha Dental')).not.toBeInTheDocument()
  })

  test('shows member status for each org', () => {
    const orgs = [
      makeOrg({ id: '1', organizationId: 'o1', orgName: 'Org A', orgSlug: 'a', status: 'active' }),
      makeOrg({ id: '2', organizationId: 'o2', orgName: 'Org B', orgSlug: 'b', status: 'lapsed' }),
      makeOrg({ id: '3', organizationId: 'o3', orgName: 'Org C', orgSlug: 'c', status: 'grace' }),
      makeOrg({ id: '4', organizationId: 'o4', orgName: 'Org D', orgSlug: 'd', status: 'pending' }),
    ]

    renderWithProviders(
      <OrgPickerSheet {...defaultProps} orgs={orgs} />
    )

    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Lapsed')).toBeInTheDocument()
    expect(screen.getByText('Grace Period')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  test('renders empty state when no orgs', () => {
    renderWithProviders(
      <OrgPickerSheet {...defaultProps} orgs={[]} />
    )

    // Title still renders
    expect(screen.getByText('Your Organizations')).toBeInTheDocument()
    // Join link still renders
    expect(screen.getByText('Join another organization')).toBeInTheDocument()
    // No org buttons
    expect(screen.queryAllByTestId('badge')).toHaveLength(0)
  })
})
