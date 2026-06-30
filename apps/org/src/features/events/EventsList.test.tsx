import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Event rows link to the detail via a TanStack <Link>; mock it as a plain anchor
// so the presentational component renders without a RouterProvider.
vi.mock('@tanstack/react-router', () => ({
  Link: ({ to: _to, params: _p, children, ...rest }: any) => <a {...rest}>{children}</a>,
}))
import { EventsList } from './EventsList'

// Dates are relative to "today" (2026-06-30): 2027 = upcoming, 2026-01 = past.
const ev = (over: Partial<any> = {}) => ({
  id: 'd1', title: 'Spring Assembly', status: 'draft', startDate: '2027-03-01T06:00:00Z',
  endDate: null, registeredCount: 0, waitlistCount: 0, ...over,
})
const drafts = () => fireEvent.click(screen.getByRole('radio', { name: 'Drafts' }))

describe('EventsList', () => {
  it('draft rows show a Publish button (Drafts tab); published rows do not', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}}
      events={[ev(), ev({ id: 'p1', title: 'Gala', status: 'published', startDate: '2027-01-01T06:00:00Z' })]} />)
    // default Upcoming shows the published Gala without a Publish button
    expect(screen.getByText('Gala')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /publish gala/i })).not.toBeInTheDocument()
    // Drafts tab shows the draft with a Publish button
    drafts()
    expect(screen.getByRole('button', { name: /publish spring assembly/i })).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('disables every Publish button while any publish is in flight', () => {
    render(<EventsList status="ready" publishingId="d1" onPublish={() => {}}
      events={[ev(), ev({ id: 'd2', title: 'Second Draft' })]} />)
    drafts()
    expect(screen.getByRole('button', { name: /publish spring assembly/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /publish second draft/i })).toBeDisabled()
  })

  it('does not render an ISO date string', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}} events={[ev()]} />)
    drafts()
    expect(screen.queryByText(/2027-03-01T06:00:00Z/)).not.toBeInTheDocument()
  })

  it('Publish opens a confirm; onPublish fires only after confirming', () => {
    const onPublish = vi.fn()
    render(<EventsList status="ready" publishingId={null} onPublish={onPublish} events={[ev()]} />)
    drafts()
    fireEvent.click(screen.getByRole('button', { name: /publish spring assembly/i }))
    expect(onPublish).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^publish$/i }))
    expect(onPublish).toHaveBeenCalledWith('d1')
  })

  it('shows the registered count and fee on the row', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}}
      events={[ev({ id: 'p1', title: 'Gala', status: 'published', startDate: '2027-01-01T06:00:00Z', registeredCount: 38, registrationFee: 50000 })]} />)
    expect(screen.getByText(/38 going/)).toBeInTheDocument()
    expect(screen.getByText(/₱500\.00/)).toBeInTheDocument()
  })

  it('filter partitions Upcoming / Past / Drafts', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}} events={[
      ev({ id: 'd1', title: 'Draft One', status: 'draft' }),
      ev({ id: 'u1', title: 'Future Gala', status: 'published', startDate: '2027-01-01T06:00:00Z' }),
      ev({ id: 'p1', title: 'Old Assembly', status: 'completed', startDate: '2026-01-01T06:00:00Z', endDate: '2026-01-01T08:00:00Z' }),
    ]} />)
    // Upcoming (default)
    expect(screen.getByText('Future Gala')).toBeInTheDocument()
    expect(screen.queryByText('Old Assembly')).not.toBeInTheDocument()
    expect(screen.queryByText('Draft One')).not.toBeInTheDocument()
    // Past
    fireEvent.click(screen.getByRole('radio', { name: 'Past' }))
    expect(screen.getByText('Old Assembly')).toBeInTheDocument()
    expect(screen.queryByText('Future Gala')).not.toBeInTheDocument()
    // Drafts
    drafts()
    expect(screen.getByText('Draft One')).toBeInTheDocument()
    expect(screen.queryByText('Future Gala')).not.toBeInTheDocument()
  })

  it('a filter with no events shows a plain message', () => {
    render(<EventsList status="ready" publishingId={null} onPublish={() => {}}
      events={[ev({ status: 'draft' })]} />)
    // only a draft exists → Upcoming is empty
    expect(screen.getByText(/no upcoming events/i)).toBeInTheDocument()
  })

  it('renders loading, error, and empty states', () => {
    const { rerender } = render(<EventsList status="loading" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    rerender(<EventsList status="error" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    rerender(<EventsList status="empty" publishingId={null} onPublish={() => {}} events={[]} />)
    expect(screen.getByText(/no events yet/i)).toBeInTheDocument()
  })

  it('error: Try again calls onRetry', () => {
    const onRetry = vi.fn()
    render(<EventsList status="error" publishingId={null} onPublish={() => {}} events={[]} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
