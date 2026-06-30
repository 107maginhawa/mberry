import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RosterView } from './Roster'

// Mock Link as a plain anchor — unit tests for presentational components
// don't need a full router; navigation is tested at E2E layer.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, params, search, children, ...props }: any) => {
    const path = params ? String(to).replace(/\$(\w+)/g, (_: string, k: string) => params[k]) : to
    return <a href={path} {...props}>{children}</a>
  },
}))

// Mock the bulk hook so select-mode UI is tested in isolation from the SDK loop.
const { startSpy } = vi.hoisted(() => ({ startSpy: vi.fn() }))
vi.mock('./use-bulk-send', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useBulkSend: () => ({ results: {}, progress: { done: 0, total: 0 }, start: startSpy, reset: vi.fn() }),
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
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText(/officer or admin access/i)).toBeInTheDocument()
  })

  it('errored: Try again calls onRetry', () => {
    const onRetry = vi.fn()
    render(<RosterView orgName="Chapter A" members={[]} errored onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
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

  it('a member hidden by search is dropped from the count and the confirm (money-consent)', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /select olive/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /select ben/i }))
    expect(screen.getByRole('button', { name: /send links to 2 selected/i })).toBeInTheDocument()
    // Hide Ben — the confirmed/mintable set must drop to just the visible Olive.
    fireEvent.change(screen.getByRole('searchbox', { name: /search members/i }), { target: { value: 'olive' } })
    fireEvent.click(screen.getByRole('button', { name: /send links to 1 selected/i }))
    expect(screen.getByRole('heading', { name: /send 1 pay-link\?/i })).toBeInTheDocument()
  })

  it('select-all announces aria-checked="mixed" when some but not all rows are selected', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    const selectAll = screen.getByRole('checkbox', { name: /select all/i })
    expect(selectAll).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(screen.getByRole('checkbox', { name: /select olive/i }))
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed')
    fireEvent.click(screen.getByRole('checkbox', { name: /select ben/i }))
    expect(selectAll).toHaveAttribute('aria-checked', 'true')
  })

  it('Select all picks only the currently-filtered rows', () => {
    render(<RosterView orgName="Org" members={members} orgId="o1" />)
    fireEvent.click(screen.getByRole('button', { name: /^select$/i }))
    fireEvent.change(screen.getByRole('searchbox', { name: /search members/i }), { target: { value: 'olive' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /select all/i }))
    expect(screen.getByRole('button', { name: /send links to 1 selected/i })).toBeInTheDocument()
  })
})

describe('RosterView — directory (Slice 2)', () => {
  const rich = [
    { membershipId: 'm1', personId: 'p1', name: 'Maria Santos', memberNumber: '#00142', status: 'pendingPayment', joinedAt: '2019-05-01T00:00:00Z', tier: 'Gold', unpaid: true },
  ]

  it('maps engine pendingPayment → Pending badge, shows since/tier meta + count strip', () => {
    render(<RosterView orgName="Org" members={rich} totalCount={1} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByText(/Member since 2019/)).toBeInTheDocument()
    expect(screen.getByText(/Gold/)).toBeInTheDocument()
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })

  it('shows an Unpaid cue for an active member with an open invoice (full derivation)', () => {
    const activeUnpaid = [{ membershipId: 'm9', personId: 'p9', name: 'Open Invoice', status: 'active', unpaid: true }]
    render(<RosterView orgName="Org" members={activeUnpaid} />)
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Unpaid')).toBeInTheDocument()
  })

  it('does not double-mark a pendingPayment member (Pending only, no extra Unpaid)', () => {
    render(<RosterView orgName="Org" members={rich} />)
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.queryByText('Unpaid')).not.toBeInTheDocument()
  })

  it('count strip is honest about the pageSize cap', () => {
    render(<RosterView orgName="Org" members={rich} totalCount={150} />)
    expect(screen.getByText('Showing 1 of 150 members')).toBeInTheDocument()
  })

  it('renders filter chips and reports a chip change', () => {
    const onFilterChange = vi.fn()
    render(<RosterView orgName="Org" members={rich} filter="all" onFilterChange={onFilterChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Unpaid' }))
    expect(onFilterChange).toHaveBeenCalledWith('unpaid')
  })

  it('renders the add-member slot in the header', () => {
    render(<RosterView orgName="Org" members={rich} orgId="o1" addMemberSlot={<button>Add member</button>} />)
    expect(screen.getByRole('button', { name: 'Add member' })).toBeInTheDocument()
  })

  it('a filter that returns nothing offers "Show all", not the Import CTA', () => {
    const onFilterChange = vi.fn()
    render(<RosterView orgName="Org" members={[]} filter="unpaid" onFilterChange={onFilterChange} />)
    expect(screen.getByText(/no members match this filter/i)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /import roster/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /show all members/i }))
    expect(onFilterChange).toHaveBeenCalledWith('all')
  })
})
