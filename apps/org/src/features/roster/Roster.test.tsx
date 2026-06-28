import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RosterView } from './Roster'

// Mock Link as a plain anchor — unit tests for presentational components
// don't need a full router; navigation is tested at E2E layer.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: any) => <a href={to} {...props}>{children}</a>,
}))

// Mock the bulk hook so select-mode UI is tested in isolation from the SDK loop.
const { startSpy } = vi.hoisted(() => ({ startSpy: vi.fn() }))
vi.mock('./use-bulk-send', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useBulkSend: () => ({ results: {}, progress: { done: 0, total: 0 }, running: false, start: startSpy }),
}))

beforeEach(() => startSpy.mockClear())

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

describe('RosterView — select mode', () => {
  const members = [
    { membershipId: 'm1', personId: 'p1', name: 'Olive', status: 'active' },
    { membershipId: 'm2', personId: 'p2', name: 'Ben', status: 'active' },
  ]

  it('Select toggle reveals checkboxes and hides the per-row send link', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    expect(screen.queryByRole('checkbox', { name: /select olive/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    expect(screen.getByRole('checkbox', { name: /select olive/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /send pay-link to olive/i })).not.toBeInTheDocument()
  })

  it('sticky bar reflects the selected count and opens a confirm before minting', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /select olive/i }))
    fireEvent.click(screen.getByRole('button', { name: /send links to 1 selected/i }))
    // ConfirmDialog open, loop NOT started yet
    expect(startSpy).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /send pay-links/i }))
    expect(startSpy).toHaveBeenCalled()
  })

  it('Select all picks only the currently-filtered rows', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.change(screen.getByRole('searchbox', { name: /search members/i }), { target: { value: 'olive' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(screen.getByRole('button', { name: /send links to 1 selected/i })).toBeInTheDocument()
  })
})
