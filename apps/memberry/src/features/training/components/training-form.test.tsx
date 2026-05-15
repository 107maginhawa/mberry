import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TrainingForm } from './training-form'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

describe('TrainingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders all form sections', () => {
    renderWithProviders(<TrainingForm orgId="org-1" />)

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    // "Location" appears as both section heading and form label
    expect(screen.getAllByText('Location')).toHaveLength(2)
    expect(screen.getByText('Credits')).toBeInTheDocument()
  })

  test('renders type selector with all options', () => {
    renderWithProviders(<TrainingForm orgId="org-1" />)

    const select = screen.getByDisplayValue('Seminar')
    expect(select).toBeInTheDocument()
    expect(screen.getByText('Workshop')).toBeInTheDocument()
    expect(screen.getByText('Convention')).toBeInTheDocument()
    expect(screen.getByText('Online Course')).toBeInTheDocument()
    expect(screen.getByText('Skills Training')).toBeInTheDocument()
  })

  test('renders Save Draft and Publish buttons', () => {
    renderWithProviders(<TrainingForm orgId="org-1" />)

    expect(screen.getByText('Save Draft')).toBeInTheDocument()
    expect(screen.getByText('Publish')).toBeInTheDocument()
  })

  test('buttons are disabled when title is empty', () => {
    renderWithProviders(<TrainingForm orgId="org-1" />)

    expect(screen.getByText('Save Draft')).toBeDisabled()
    expect(screen.getByText('Publish')).toBeDisabled()
  })

  test('pre-fills form in edit mode', () => {
    const initial = {
      type: 'workshop',
      title: 'Existing Training',
      description: 'A description',
      startDate: '2025-06-15T09:00:00Z',
      endDate: '2025-06-15T17:00:00Z',
      location: 'Manila Hotel',
      creditAmount: '5',
      registrationFee: 10000,
      capacity: '50',
    }

    renderWithProviders(
      <TrainingForm orgId="org-1" initial={initial} trainingId="train-1" />,
    )

    expect(screen.getByDisplayValue('Existing Training')).toBeInTheDocument()
    expect(screen.getByDisplayValue('A description')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Manila Hotel')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Workshop')).toBeInTheDocument()
  })
})
