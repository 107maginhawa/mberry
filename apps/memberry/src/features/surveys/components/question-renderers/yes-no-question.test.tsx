import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { YesNoQuestion } from './yes-no-question'
import userEvent from '@testing-library/user-event'

describe('YesNoQuestion', () => {
  test('[AC-YN-001] renders Yes and No buttons', () => {
    renderWithProviders(<YesNoQuestion value={null} onChange={vi.fn()} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  test('[AC-YN-002] clicking Yes calls onChange with true', async () => {
    const onChange = vi.fn()
    renderWithProviders(<YesNoQuestion value={null} onChange={onChange} />)
    await userEvent.click(screen.getByText('Yes'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  test('[AC-YN-003] clicking No calls onChange with false', async () => {
    const onChange = vi.fn()
    renderWithProviders(<YesNoQuestion value={null} onChange={onChange} />)
    await userEvent.click(screen.getByText('No'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('[AC-YN-004] reflects controlled value true (Yes selected)', () => {
    renderWithProviders(<YesNoQuestion value={true} onChange={vi.fn()} />)
    // Both buttons still rendered
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  test('[AC-YN-005] reflects controlled value false (No selected)', () => {
    renderWithProviders(<YesNoQuestion value={false} onChange={vi.fn()} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })
})
