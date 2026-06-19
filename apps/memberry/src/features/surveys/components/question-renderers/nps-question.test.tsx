import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { NpsQuestion } from './nps-question'
import userEvent from '@testing-library/user-event'

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, 'aria-label': ariaLabel, 'aria-checked': ariaChecked, role, className, ...rest }: any) => (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-checked={ariaChecked}
      role={role}
      className={className}
      {...rest}
    >
      {children}
    </button>
  ),
}))

const makeProps = (overrides: Partial<{
  value: number | null
  onChange: (v: number) => void
}> = {}) => ({
  value: overrides.value ?? null,
  onChange: overrides.onChange ?? vi.fn(),
})

describe('NpsQuestion', () => {
  test('[AC-NQ-001] renders 11 buttons (0 through 10)', () => {
    renderWithProviders(<NpsQuestion {...makeProps()} />)
    const radiogroup = screen.getByRole('radiogroup')
    const buttons = radiogroup.querySelectorAll('button')
    expect(buttons).toHaveLength(11)
  })

  test('[AC-NQ-002] renders "Not at all likely" and "Extremely likely" labels', () => {
    renderWithProviders(<NpsQuestion {...makeProps()} />)
    expect(screen.getByText('Not at all likely')).toBeInTheDocument()
    expect(screen.getByText('Extremely likely')).toBeInTheDocument()
  })

  test('[AC-NQ-003] renders buttons for 0 to 10 with visible numbers', () => {
    renderWithProviders(<NpsQuestion {...makeProps()} />)
    expect(screen.getByText('0')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  test('[AC-NQ-004] calls onChange with 0 when "0 - Not at all likely" is clicked (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<NpsQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByRole('radio', { name: '0 - Not at all likely' }))
    expect(onChange).toHaveBeenCalledWith(0)
  })

  test('[AC-NQ-005] calls onChange with 10 when "10 - Extremely likely" is clicked (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<NpsQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByRole('radio', { name: '10 - Extremely likely' }))
    expect(onChange).toHaveBeenCalledWith(10)
  })

  test('[AC-NQ-006] calls onChange with 7 when "7 - Likely" is clicked (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<NpsQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByRole('radio', { name: '7 - Likely' }))
    expect(onChange).toHaveBeenCalledWith(7)
  })

  test('[AC-NQ-007] controlled value: selected button has aria-checked=true', () => {
    renderWithProviders(<NpsQuestion {...makeProps({ value: 8 })} />)
    const selectedBtn = screen.getByRole('radio', { name: '8 - Likely' })
    expect(selectedBtn).toHaveAttribute('aria-checked', 'true')
  })
})
