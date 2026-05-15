import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { OrgAnnouncements } from './org-announcements'

// Mock @tanstack/react-router (unused but may be transitive)
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={String(to)}>{children}</a>
  ),
}))

describe('OrgAnnouncements', () => {
  test('renders Org News heading', () => {
    renderWithProviders(
      <OrgAnnouncements announcements={[]} orgNames={{}} />
    )

    expect(screen.getByText('Org News')).toBeInTheDocument()
  })

  test('shows empty state when no announcements', () => {
    renderWithProviders(
      <OrgAnnouncements announcements={[]} orgNames={{}} />
    )

    expect(screen.getByText('No recent announcements')).toBeInTheDocument()
    expect(screen.getByText('News from your organizations will appear here')).toBeInTheDocument()
  })

  test('shows error message when isError is true', () => {
    renderWithProviders(
      <OrgAnnouncements announcements={[]} orgNames={{}} isError />
    )

    expect(screen.getByText('Unable to load announcements')).toBeInTheDocument()
  })

  test('renders announcement titles', () => {
    const announcements = [
      { id: 'a-1', title: 'Annual General Meeting', subject: 'AGM Notice', createdAt: new Date().toISOString() },
      { id: 'a-2', title: 'New CPD Guidelines', createdAt: new Date().toISOString() },
    ]

    renderWithProviders(
      <OrgAnnouncements announcements={announcements} orgNames={{}} />
    )

    // Uses subject if available, falls back to title
    expect(screen.getByText('AGM Notice')).toBeInTheDocument()
    expect(screen.getByText('New CPD Guidelines')).toBeInTheDocument()
  })

  test('renders content preview stripped of HTML', () => {
    const announcements = [
      {
        id: 'a-1',
        title: 'Update',
        content: '<p>Important <strong>update</strong> about membership renewal.</p>',
        createdAt: new Date().toISOString(),
      },
    ]

    renderWithProviders(
      <OrgAnnouncements announcements={announcements} orgNames={{}} />
    )

    expect(screen.getByText(/Important update about membership renewal/)).toBeInTheDocument()
  })

  test('renders org name when orgNames mapping provided', () => {
    const announcements = [
      { id: 'a-1', title: 'Notice', organizationId: 'org-1', createdAt: new Date().toISOString() },
    ]

    renderWithProviders(
      <OrgAnnouncements
        announcements={announcements}
        orgNames={{ 'org-1': 'Philippine Dental Association' }}
      />
    )

    expect(screen.getByText('Philippine Dental Association')).toBeInTheDocument()
  })

  test('renders "Today" for announcements created today', () => {
    const announcements = [
      { id: 'a-1', title: 'Fresh News', createdAt: new Date().toISOString() },
    ]

    renderWithProviders(
      <OrgAnnouncements announcements={announcements} orgNames={{}} />
    )

    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  test('limits display to 5 announcements max', () => {
    const announcements = Array.from({ length: 8 }, (_, i) => ({
      id: `a-${i}`,
      title: `Announcement ${i + 1}`,
      createdAt: new Date().toISOString(),
    }))

    renderWithProviders(
      <OrgAnnouncements announcements={announcements} orgNames={{}} />
    )

    // Only first 5 should render
    expect(screen.getByText('Announcement 1')).toBeInTheDocument()
    expect(screen.getByText('Announcement 5')).toBeInTheDocument()
    expect(screen.queryByText('Announcement 6')).not.toBeInTheDocument()
  })
})
