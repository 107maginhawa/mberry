import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TextQuestion } from './text-question'

// Mock Textarea to a plain textarea so we can interact with it
vi.mock('@monobase/ui', () => ({
  Textarea: ({ value, onChange, placeholder, maxLength, rows, className }: any) => (
    <textarea
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      maxLength={maxLength}
      rows={rows}
      className={className}
      data-testid="text-area"
    />
  ),
}))

const makeProps = (overrides: Partial<{
  value: string | null
  onChange: (v: string) => void
  maxLength: number
  placeholder: string
}> = {}) => ({
  value: overrides.value ?? null,
  onChange: overrides.onChange ?? vi.fn(),
  ...(overrides.maxLength !== undefined ? { maxLength: overrides.maxLength } : {}),
  ...(overrides.placeholder !== undefined ? { placeholder: overrides.placeholder } : {}),
})

describe('TextQuestion', () => {
  test('[AC-TQ-001] renders textarea with default placeholder', () => {
    renderWithProviders(<TextQuestion {...makeProps()} />)
    expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument()
  })

  test('[AC-TQ-002] renders custom placeholder', () => {
    renderWithProviders(<TextQuestion {...makeProps({ placeholder: 'Enter your thoughts' })} />)
    expect(screen.getByPlaceholderText('Enter your thoughts')).toBeInTheDocument()
  })

  test('[AC-TQ-003] shows character count / maxLength', () => {
    renderWithProviders(<TextQuestion {...makeProps({ value: 'hello', maxLength: 500 })} />)
    expect(screen.getByText('5 / 500')).toBeInTheDocument()
  })

  test('[AC-TQ-004] calls onChange with typed value (payload check)', () => {
    const onChange = vi.fn()
    renderWithProviders(<TextQuestion {...makeProps({ onChange })} />)
    const textarea = screen.getByTestId('text-area')
    fireEvent.change(textarea, { target: { value: 'My answer text' } })
    expect(onChange).toHaveBeenCalledWith('My answer text')
  })

  test('[AC-TQ-005] does not call onChange when text exceeds maxLength', () => {
    const onChange = vi.fn()
    renderWithProviders(<TextQuestion {...makeProps({ onChange, maxLength: 5 })} />)
    const textarea = screen.getByTestId('text-area')
    fireEvent.change(textarea, { target: { value: '123456' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  test('[AC-TQ-006] shows controlled value when provided', () => {
    renderWithProviders(<TextQuestion {...makeProps({ value: 'Existing answer' })} />)
    expect(screen.getByDisplayValue('Existing answer')).toBeInTheDocument()
  })
})
