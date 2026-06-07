/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, beforeEach, mock } from 'bun:test'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'

let _useMyOrgsReturn: any = {
  orgs: [],
  isLoading: false,
  error: null,
  activeOrgSlug: null,
}

mock.module('@/hooks/use-my-orgs', () => ({
  useMyOrgs: () => _useMyOrgsReturn,
}))

mock.module('@/components/patterns/avatar-initials', () => ({
  AvatarInitials: ({ name }: { name: string }) => <span>{name}</span>,
}))

const { OrgIconRail } = await import('./org-icon-rail')

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
    _useMyOrgsReturn = {
      orgs: [],
      isLoading: false,
      error: null,
      activeOrgSlug: null,
    }
  })

  test('renders nothing when no orgs', () => {
    _useMyOrgsReturn = { orgs: [], isLoading: false, error: null, activeOrgSlug: null }
    renderWithProviders(<OrgIconRail />)
    expect(screen.getByLabelText('Join an organization')).toBeInTheDocument()
  })

  test('renders org avatars', () => {
    _useMyOrgsReturn = { orgs: [ORG_A, ORG_B], isLoading: false, error: null, activeOrgSlug: null }
    renderWithProviders(<OrgIconRail />)
    expect(screen.getByLabelText('Switch to Philippine Dental Association')).toBeInTheDocument()
    expect(screen.getByLabelText('Switch to Manila Dental Society')).toBeInTheDocument()
  })

  test('highlights active org', () => {
    _useMyOrgsReturn = { orgs: [ORG_A, ORG_B], isLoading: false, error: null, activeOrgSlug: 'pda' }
    renderWithProviders(<OrgIconRail />)
    const activeButton = screen.getByLabelText('Switch to Philippine Dental Association')
    const inactiveButton = screen.getByLabelText('Switch to Manila Dental Society')
    expect(activeButton).toHaveAttribute('aria-current', 'true')
    expect(inactiveButton).not.toHaveAttribute('aria-current')
  })

  test('shows error state on fetch failure', () => {
    _useMyOrgsReturn = { orgs: [], isLoading: false, error: new Error('Network error'), activeOrgSlug: null }
    renderWithProviders(<OrgIconRail />)
    expect(screen.getByText('Failed to load orgs')).toBeInTheDocument()
  })
})
