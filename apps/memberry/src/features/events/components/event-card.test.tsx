import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { EventCard } from './event-card'

// Router (Link, useParams) provided by test-setup-root.ts global mock —
// drives useParams via globalThis.__routerParams. @monobase/ui Button +
// DropdownMenu render as real components against happy-dom; do not vi.mock
// either at file scope (Bun mock.module is process-global and pollutes
// every downstream test importing the same module).

describe('EventCard', () => {
  const baseEvent = {
    id: 'evt-1',
    title: 'Annual General Assembly 2025',
    status: 'published',
    startDate: '2025-06-15T09:00:00Z',
    endDate: '2025-06-15T17:00:00Z',
    location: 'Manila Hotel Ballroom',
    registrationCount: 120,
    capacity: 200,
  }

  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
    vi.clearAllMocks()
  })

  test('renders event title as link', () => {
    renderWithProviders(<EventCard event={baseEvent} orgId="org-1" />)

    const title = screen.getByText('Annual General Assembly 2025')
    expect(title).toBeInTheDocument()
    expect(title.closest('a')).toHaveAttribute('href', '/org/test-org/officer/events/evt-1')
  })

  test('renders status badge', () => {
    renderWithProviders(<EventCard event={baseEvent} orgId="org-1" />)
    expect(screen.getByText('published')).toBeInTheDocument()
  })

  test('renders location', () => {
    renderWithProviders(<EventCard event={baseEvent} orgId="org-1" />)
    expect(screen.getByText('Manila Hotel Ballroom')).toBeInTheDocument()
  })

  test('shows In-person when no location', () => {
    const noLoc = { ...baseEvent, location: null }
    renderWithProviders(<EventCard event={noLoc} orgId="org-1" />)
    expect(screen.getByText('In-person')).toBeInTheDocument()
  })

  test('renders registration count with capacity', () => {
    renderWithProviders(<EventCard event={baseEvent} orgId="org-1" />)
    expect(screen.getByText('120 / 200 registered')).toBeInTheDocument()
  })

  test('renders registration without capacity', () => {
    const noCapacity = { ...baseEvent, capacity: null }
    renderWithProviders(<EventCard event={noCapacity} orgId="org-1" />)
    expect(screen.getByText('120 registered')).toBeInTheDocument()
  })

  test('hides registration when no count', () => {
    const noReg = { ...baseEvent, registrationCount: undefined }
    renderWithProviders(<EventCard event={noReg} orgId="org-1" />)
    expect(screen.queryByText(/registered/)).not.toBeInTheDocument()
  })

  test('actions menu shows edit, duplicate, cancel', async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()
    const onCancel = vi.fn()
    const onDuplicate = vi.fn()

    renderWithProviders(
      <EventCard
        event={baseEvent}
        orgId="org-1"
        onEdit={onEdit}
        onCancel={onCancel}
        onDuplicate={onDuplicate}
      />,
    )

    await user.click(screen.getByLabelText('Event actions'))

    expect(screen.getByText('View Details')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('hides Cancel for cancelled events', async () => {
    const user = userEvent.setup()
    const cancelled = { ...baseEvent, status: 'cancelled' }

    renderWithProviders(
      <EventCard event={cancelled} orgId="org-1" onCancel={vi.fn()} />,
    )

    await user.click(screen.getByLabelText('Event actions'))
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })

  test('uses custom linkBase for links', () => {
    renderWithProviders(
      <EventCard event={baseEvent} orgId="org-1" linkBase="/custom/path" />,
    )

    const title = screen.getByText('Annual General Assembly 2025')
    expect(title.closest('a')).toHaveAttribute('href', '/custom/path/evt-1')
  })
})
