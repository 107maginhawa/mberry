import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RosterView } from './Roster'

describe('RosterView', () => {
  const members = [{ membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' }]

  it('lists members with a send link', () => {
    render(<RosterView orgName="Chapter A" members={members} />)
    expect(screen.getByText('Chapter A')).toBeInTheDocument()
    expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /send pay-link/i })).toHaveAttribute('href', expect.stringContaining('m1'))
  })

  it('shows errored state when roster query fails (e.g. 403 not an officer)', () => {
    render(<RosterView orgName="Chapter A" members={[]} errored />)
    expect(screen.getByText(/roster unavailable/i)).toBeInTheDocument()
    expect(screen.getByText(/officer or admin access/i)).toBeInTheDocument()
  })

  it('shows empty state', () => {
    render(<RosterView orgName="Chapter A" members={[]} />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
  })
})
