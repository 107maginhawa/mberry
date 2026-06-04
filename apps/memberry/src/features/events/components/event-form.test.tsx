import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { EventForm } from './event-form'

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts.
// Per-test isolation (apps/memberry/scripts/test-isolated.ts) keeps vi.mock
// pollution scoped to this file.

vi.mock('@/components/patterns/date-picker', () => ({
  DateTimePicker: ({ value, onChange, ...rest }: any) => (
    <input data-testid="datetime-picker" type="text" value={value ?? ''} onChange={(e: any) => onChange?.(e.target.value)} {...rest} />
  ),
}))

// Radix Select* don't render inline under happy-dom; stub @monobase/ui to
// flat Select primitives that emit role="option" so visibility-selector
// assertions resolve.
vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, disabled, type, variant, className, ...props }: any) => (
    <button type={type} onClick={onClick} disabled={disabled} className={className} {...props}>{children}</button>
  ),
  // Pass register()'s props through unchanged so RHF can attach its ref
  // (uncontrolled mode). Forcing value={value ?? ''} froze inputs empty.
  Input: ({ type, ...props }: any) => (
    <input type={type ?? 'text'} {...props} />
  ),
  Label: ({ htmlFor, children }: any) => <label htmlFor={htmlFor}>{children}</label>,
  Textarea: ({ ...props }: any) => <textarea {...props} />,
  Select: ({ children, value, onValueChange, defaultValue, ...props }: any) => (
    <div data-testid="select" data-value={value ?? defaultValue ?? ''} {...props}>{children}</div>
  ),
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value }: any) => <div role="option" data-value={value}>{children}</div>,
  SelectTrigger: ({ children, ...props }: any) => <button data-testid="select-trigger" {...props}>{children}</button>,
  SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
}))

import {
  createEventMutation,
  updateEventMutation,
} from '@monobase/sdk-ts/generated/react-query'

const mockCreateMutation = createEventMutation as ReturnType<typeof vi.fn>
const mockUpdateMutation = updateEventMutation as ReturnType<typeof vi.fn>

function setupMocks() {
  mockCreateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
  mockUpdateMutation.mockReturnValue({ mutationFn: vi.fn().mockResolvedValue({}) })
}

describe('EventForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  test('renders all form sections', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByText('Basic Info')).toBeInTheDocument()
    expect(screen.getByText('Date & Time')).toBeInTheDocument()
    // "Location" appears as both section heading and form label
    expect(screen.getAllByText('Location')).toHaveLength(2)
    expect(screen.getByText('Registration')).toBeInTheDocument()
  })

  test('renders event type selector with options', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByLabelText('Event Type')).toBeInTheDocument()
    expect(screen.getByText('General Assembly')).toBeInTheDocument()
    expect(screen.getByText('Fellowship')).toBeInTheDocument()
    expect(screen.getByText('Medical Mission')).toBeInTheDocument()
  })

  test('renders Save Draft and Publish buttons', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByText('Save Draft')).toBeInTheDocument()
    expect(screen.getByText('Publish')).toBeInTheDocument()
  })

  test('renders Cancel button when onCancel provided', () => {
    const onCancel = vi.fn()
    renderWithProviders(<EventForm orgId="org-1" onCancel={onCancel} />)

    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  test('hides Cancel button when onCancel not provided', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    // Only "Cancel" in the menu — the form Cancel button should not appear
    const cancelButtons = screen.queryAllByText('Cancel')
    expect(cancelButtons).toHaveLength(0)
  })

  test('pre-fills form fields in edit mode', () => {
    const event = {
      id: 'evt-1',
      title: 'Board Meeting',
      description: 'Monthly board meeting',
      startDate: '2025-06-15T09:00:00Z',
      endDate: '2025-06-15T11:00:00Z',
      location: 'Conference Room A',
      registrationFee: 5000,
      capacity: 20,
      visibility: 'internal',
      status: 'draft',
      eventType: 'board_meeting',
    }

    renderWithProviders(<EventForm orgId="org-1" event={event} />)

    // Title input has value "Board Meeting"; eventType Select carries
    // 'board_meeting' on its wrapper data-value (no native <select> in
    // happy-dom, so display-value match is on inputs only).
    expect(screen.getByDisplayValue('Board Meeting')).toBeInTheDocument()
    const eventTypeSelect = screen.getAllByTestId('select').find(
      (el) => el.getAttribute('data-value') === 'board_meeting'
    )
    expect(eventTypeSelect).toBeTruthy()
    expect(screen.getByDisplayValue('Monthly board meeting')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Conference Room A')).toBeInTheDocument()
    // Fee is divided by 100: 5000 / 100 = 50
    expect(screen.getByDisplayValue('50')).toBeInTheDocument()
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  test('renders visibility selector', () => {
    renderWithProviders(<EventForm orgId="org-1" />)

    expect(screen.getByLabelText('Visibility')).toBeInTheDocument()
    expect(screen.getByText('Members Only')).toBeInTheDocument()
    expect(screen.getByText('Public')).toBeInTheDocument()
  })
})
