import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RosterView } from './Roster'

describe('RosterView', () => {
  const members = [{ membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' }]

  it('lists members with a send link', () => {
    render(<RosterView orgName="Chapter A" members={members} isOfficer />)
    expect(screen.getByText('Chapter A')).toBeInTheDocument()
    expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /send pay-link/i })).toHaveAttribute('href', expect.stringContaining('m1'))
  })

  it('shows not-officer message', () => {
    render(<RosterView orgName="Chapter A" members={[]} isOfficer={false} />)
    expect(screen.getByText(/not an officer/i)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<RosterView orgName="Chapter A" members={[]} isOfficer />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })
})
