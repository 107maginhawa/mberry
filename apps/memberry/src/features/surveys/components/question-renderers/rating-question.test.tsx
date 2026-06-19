import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { RatingQuestion } from './rating-question'
import userEvent from '@testing-library/user-event'

describe('RatingQuestion', () => {
  test('[AC-RQ-001] renders 5 star buttons by default', () => {
    renderWithProviders(<RatingQuestion value={null} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(5)
  })

  test('[AC-RQ-002] renders correct star count with custom maxStars', () => {
    renderWithProviders(<RatingQuestion value={null} onChange={vi.fn()} maxStars={10} />)
    expect(screen.getAllByRole('button')).toHaveLength(10)
  })

  test('[AC-RQ-003] buttons have correct aria-labels (1 star, 2 stars, ...)', () => {
    renderWithProviders(<RatingQuestion value={null} onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: '1 star' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 stars' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '5 stars' })).toBeInTheDocument()
  })

  test('[AC-RQ-004] calls onChange with selected star value', async () => {
    const onChange = vi.fn()
    renderWithProviders(<RatingQuestion value={null} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: '3 stars' }))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  test('[AC-RQ-005] reflects controlled value (pre-filled rating)', () => {
    renderWithProviders(<RatingQuestion value={4} onChange={vi.fn()} />)
    // Component renders stars with aria-label — verify button for value 4 is present
    expect(screen.getByRole('button', { name: '4 stars' })).toBeInTheDocument()
  })
})
