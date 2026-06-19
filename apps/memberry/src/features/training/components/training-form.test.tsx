import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TrainingForm } from './training-form'

// Router (useNavigate, useParams) provided by global mock in test-setup-root.ts.
// Per-test isolation (apps/memberry/scripts/test-isolated.ts) means this file
// runs in its own bun:test process; vi.mock pollution stays scoped here.

vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="datetime-picker" type="text" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

// Stub Radix Select* — happy-dom doesn't render Radix popper content inline.
// Test asserts on `role="option"` elements; provide a flat stub that emits
// role="option" per SelectItem child. Mock at @monobase/ui level — covers
// Button/Input/Label/Textarea pass-through to keep TrainingForm rendering.
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, type, variant, className, ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
  Input: ({ id, type, value, onChange, ...props }: any) => (
    <input id={id} type={type ?? 'text'} value={value ?? ''} onChange={onChange} {...props} />
  ),
  Label: ({ htmlFor, children }: any) => <label htmlFor={htmlFor}>{children}</label>,
  Textarea: ({ id, value, onChange, ...props }: any) => (
    <textarea id={id} value={value ?? ''} onChange={onChange} {...props} />
  ),
  Select: ({ children, value, onValueChange, defaultValue, ...props }: any) => {
    const v = value ?? defaultValue ?? ''
    return (
      <select data-testid="select" data-value={v} value={v} onChange={(e) => onValueChange?.(e.target.value)} {...props}>{children}</select>
    )
  },
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ children, value }: any) => <option role="option" value={value}>{children}</option>,
  SelectTrigger: ({ children, ...props }: any) => <span data-testid="select-trigger" {...props}>{children}</span>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

describe('TrainingForm', () => {
  beforeEach(() => {
    ;(globalThis as any).__routerParams = { orgSlug: 'test-org' }
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
    // ISSUE-019: options must match the backend Training type enum
    // (seminar|workshop|webinar|self_paced|hands_on).
    expect(screen.getByRole('option', { name: 'Seminar' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Workshop' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Webinar' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Self-Paced Course' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Hands-on Training' })).toBeInTheDocument()
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
