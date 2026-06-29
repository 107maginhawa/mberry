import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AnnouncementsList } from './AnnouncementsList'
import type { AnnouncementListItem } from './use-list-announcements'

vi.mock('@/features/org/use-org', () => ({ useSelectedOrg: () => ({ orgId: 'o1' }) }))

const refetch = vi.fn()
const hookState = vi.hoisted(() => ({
  current: { status: 'ready', announcements: [] as AnnouncementListItem[], refetch: vi.fn() } as {
    status: string
    announcements: AnnouncementListItem[]
    refetch: () => void
  },
}))
vi.mock('./use-list-announcements', () => ({
  useListAnnouncements: () => hookState.current,
}))

beforeEach(() => refetch.mockClear())

describe('AnnouncementsList', () => {
  it('renders skeletons while loading', () => {
    hookState.current = { status: 'loading', announcements: [], refetch }
    render(<AnnouncementsList />)
    expect(screen.getByRole('status', { name: /loading announcements/i })).toBeInTheDocument()
  })

  it('renders the empty state', () => {
    hookState.current = { status: 'empty', announcements: [], refetch }
    render(<AnnouncementsList />)
    expect(screen.getByText(/no announcements yet/i)).toBeInTheDocument()
  })

  it('renders an error state with a working retry', () => {
    hookState.current = { status: 'error', announcements: [], refetch }
    render(<AnnouncementsList />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('renders posted announcements with title, body, status and date', () => {
    hookState.current = {
      status: 'ready',
      announcements: [
        { id: 'a1', title: 'Welcome', content: 'Hello members', status: 'sent', date: new Date('2026-06-02T00:00:00Z') },
      ],
      refetch,
    }
    render(<AnnouncementsList />)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Hello members')).toBeInTheDocument()
    expect(screen.getByText('Sent')).toBeInTheDocument()
  })
})
