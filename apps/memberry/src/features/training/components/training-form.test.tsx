import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TrainingForm } from './training-form'

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({ orgSlug: 'test-org' }),
}))

vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="datetime-picker" type="text" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, type, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} type={type} {...props}>{children}</button>
  ),
  Input: ({ value, onChange, placeholder, type, ...props }: any) => (
    <input value={value} onChange={onChange} placeholder={placeholder} type={type} {...props} />
  ),
  Label: ({ children }: any) => <label>{children}</label>,
  Textarea: ({ value, onChange, placeholder, rows, ...props }: any) => (
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows} {...props} />
  ),
  // Render Select as a native select with a hidden input for display value detection
  Select: ({ children, value, onValueChange }: any) => (
    <div data-testid="select" data-value={value}>
      <input type="hidden" data-select-value={value} />
      {children}
    </div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => (
    <div data-testid="select-item" data-value={value} role="option">{children}</div>
  ),
  SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
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

    // With mocked @monobase/ui Select, options render as role="option" elements
    expect(screen.getByRole('option', { name: 'Seminar' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Convention' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Online Course' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Skills Training' })).toBeInTheDocument()
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
    // With mocked Select, the selected type is shown via data-value attribute on the select container
    expect(screen.getByTestId('select')).toHaveAttribute('data-value', 'workshop')
  })
})
