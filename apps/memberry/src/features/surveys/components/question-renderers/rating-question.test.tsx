import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { RatingQuestion } from './rating-question'
import userEvent from '@testing-library/user-event'

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, 'aria-label': ariaLabel, ...rest }: any) => (
    <button onClick={onClick} aria-label={ariaLabel} {...rest}>{children}</button>
  ),
}))

// Mock lucide Star to a simple span so the SVG doesn't cause issues
vi.mock('lucide-react', () => ({
  Star: ({ className }: any) => <span data-testid="star-icon" className={className} />,
}))

const makeProps = (overrides: Partial<{
  value: number | null
  onChange: (v: number) => void
  maxStars: number
}> = {}) => ({
  value: overrides.value ?? null,
  onChange: overrides.onChange ?? vi.fn(),
  ...(overrides.maxStars !== undefined ? { maxStars: overrides.maxStars } : {}),
})

describe('RatingQuestion', () => {
  test('[AC-RQ-001] renders 5 star buttons by default', () => {
    renderWithProviders(<RatingQuestion {...makeProps()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  test('[AC-RQ-002] renders custom maxStars count', () => {
    renderWithProviders(<RatingQuestion {...makeProps({ maxStars: 3 })} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  test('[AC-RQ-003] star buttons have descriptive aria-labels', () => {
    renderWithProviders(<RatingQuestion {...makeProps()} />)
    expect(screen.getByRole('button', { name: '1 star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '3 stars' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 stars' })).toBeInTheDocument()
  })

  test('[AC-RQ-004] calls onChange with the star value clicked (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<RatingQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  test('[AC-RQ-005] clicking first star calls onChange with 1 (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<RatingQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByRole('button', { name: '1 star' }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  test('[AC-RQ-006] controlled value: value prop is accepted without error', () => {
    // Just verify it renders without throwing when a value is set
    expect(() => {
      renderWithProviders(<RatingQuestion {...makeProps({ value: 4 })} />)
    }).not.toThrow()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })
})
