import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { TextQuestion } from './text-question'

describe('TextQuestion', () => {
  test('[AC-SQ-001] renders textarea with default placeholder', () => {
    renderWithProviders(<TextQuestion value={null} onChange={vi.fn()} />)
    expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument()
  })

  test('[AC-SQ-001] renders custom placeholder', () => {
    renderWithProviders(<TextQuestion value={null} onChange={vi.fn()} placeholder="Describe your experience" />)
    expect(screen.getByPlaceholderText('Describe your experience')).toBeInTheDocument()
  })

  test('[AC-SQ-002] renders character counter showing 0 / maxLength', () => {
    renderWithProviders(<TextQuestion value={null} onChange={vi.fn()} maxLength={500} />)
    expect(screen.getByText('0 / 500')).toBeInTheDocument()
  })

  test('[AC-SQ-003] calls onChange when user types', () => {
    const onChange = vi.fn()
    renderWithProviders(<TextQuestion value={null} onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledWith('hello')
  })

  test('[AC-SQ-004] displays controlled value', () => {
    renderWithProviders(<TextQuestion value="existing answer" onChange={vi.fn()} />)
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement
    expect(textarea.value).toBe('existing answer')
  })

  test('[AC-SQ-005] character counter reflects current length', () => {
    renderWithProviders(<TextQuestion value="hello" onChange={vi.fn()} maxLength={1000} />)
    expect(screen.getByText('5 / 1000')).toBeInTheDocument()
  })
})
