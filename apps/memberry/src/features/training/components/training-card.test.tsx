import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/utils'
import { TrainingCard } from './training-card'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...rest }: any) => <a href={String(to)} {...rest}>{children}</a>,
  useParams: () => ({ orgSlug: 'test-org' }),
}))

describe('TrainingCard', () => {
  const baseTraining = {
    id: 'train-1',
    title: 'CPE Dental Seminar 2025',
    type: 'seminar',
    status: 'published',
    creditAmount: '8',
    startDate: '2025-06-15T09:00:00Z',
    endDate: '2025-06-15T17:00:00Z',
    location: 'Manila Hotel',
    enrollmentCount: 45,
    capacity: 100,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders training title and link', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)

    const link = screen.getByText('CPE Dental Seminar 2025')
    expect(link).toBeInTheDocument()
    expect(link.closest('a')).toHaveAttribute('href', '/org/test-org/officer/training/train-1')
  })

  test('renders type badge', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    expect(screen.getByText('Seminar')).toBeInTheDocument()
  })

  test('renders status badge', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    expect(screen.getByText('published')).toBeInTheDocument()
  })

  test('renders credit amount badge', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    expect(screen.getByText('8 CPE')).toBeInTheDocument()
  })

  test('renders date range', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    // Date formatted as en-PH short
    expect(screen.getByText(/Jun/)).toBeInTheDocument()
  })

  test('renders location', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    expect(screen.getByText('Manila Hotel')).toBeInTheDocument()
  })

  test('shows Venue TBA when no location', () => {
    const noLocation = { ...baseTraining, location: null }
    renderWithProviders(<TrainingCard training={noLocation} orgId="org-1" />)
    expect(screen.getByText('Venue TBA')).toBeInTheDocument()
  })

  test('renders enrollment count with capacity', () => {
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)
    expect(screen.getByText('45 enrolled / 100')).toBeInTheDocument()
  })

  test('hides enrollment count when zero', () => {
    const noEnrollments = { ...baseTraining, enrollmentCount: 0 }
    renderWithProviders(<TrainingCard training={noEnrollments} orgId="org-1" />)
    expect(screen.queryByText(/enrolled/)).not.toBeInTheDocument()
  })

  test('actions menu toggles on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TrainingCard training={baseTraining} orgId="org-1" />)

    const actionsBtn = screen.getByLabelText('Actions')
    await user.click(actionsBtn)

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('hides Cancel for cancelled training', async () => {
    const user = userEvent.setup()
    const cancelled = { ...baseTraining, status: 'cancelled' }
    renderWithProviders(<TrainingCard training={cancelled} orgId="org-1" />)

    await user.click(screen.getByLabelText('Actions'))

    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
  })
})
