import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { NpsQuestion } from './nps-question'
import userEvent from '@testing-library/user-event'

describe('NpsQuestion', () => {
  test('[AC-NPS-001] renders 11 buttons (0-10)', () => {
    renderWithProviders(<NpsQuestion value={null} onChange={vi.fn()} />)
    // Buttons 0 through 10
    const buttons = screen.getAllByRole('radio')
    expect(buttons).toHaveLength(11)
  })

  test('[AC-NPS-002] renders scale labels', () => {
    renderWithProviders(<NpsQuestion value={null} onChange={vi.fn()} />)
    expect(screen.getByText('Not at all likely')).toBeInTheDocument()
    expect(screen.getByText('Extremely likely')).toBeInTheDocument()
  })

  test('[AC-NPS-003] each button shows its number', () => {
    renderWithProviders(<NpsQuestion value={null} onChange={vi.fn()} />)
    for (let i = 0; i <= 10; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument()
    }
  })

  test('[AC-NPS-004] clicking a button calls onChange with that number', async () => {
    const onChange = vi.fn()
    renderWithProviders(<NpsQuestion value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('radio', { name: /^7 - Likely/i }))
    expect(onChange).toHaveBeenCalledWith(7)
  })

  test('[AC-NPS-005] selected button has aria-checked=true', () => {
    renderWithProviders(<NpsQuestion value={5} onChange={vi.fn()} />)
    const checkedBtn = screen.getByRole('radio', { name: /^5 - Neutral/i })
    expect(checkedBtn).toHaveAttribute('aria-checked', 'true')
  })

  test('[AC-NPS-006] non-selected buttons have aria-checked=false', () => {
    renderWithProviders(<NpsQuestion value={5} onChange={vi.fn()} />)
    const unchecked = screen.getByRole('radio', { name: /^0 - Not at all likely/i })
    expect(unchecked).toHaveAttribute('aria-checked', 'false')
  })
})
