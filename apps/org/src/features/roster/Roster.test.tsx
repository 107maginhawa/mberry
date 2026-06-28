import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RosterView } from './Roster'

// Mock Link as a plain anchor — unit tests for presentational components
// don't need a full router; navigation is tested at E2E layer.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

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

  it('shows empty state with Import roster CTA', () => {
    render(<RosterView orgName="Chapter A" members={[]} />)
    expect(screen.getByText(/no members yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /import roster/i })).toHaveAttribute('href', '/import')
  })

  it('filters the list by the search query (name/number/status)', () => {
    const many = [
      { membershipId: 'm1', personId: 'p1', name: 'Olive Cruz', memberNumber: 'A-1', status: 'active' },
      { membershipId: 'm2', personId: 'p2', name: 'Ben Santos', memberNumber: 'B-2', status: 'lapsed' },
    ]
    render(<RosterView orgName="Chapter A" members={many} />)
    expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
    expect(screen.getByText('Ben Santos')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/search members/i), { target: { value: 'olive' } })
    expect(screen.getByText('Olive Cruz')).toBeInTheDocument()
    expect(screen.queryByText('Ben Santos')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/search members/i), { target: { value: 'zzz' } })
    expect(screen.getByText(/no members match/i)).toBeInTheDocument()
  })
})
