import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { YesNoQuestion } from './yes-no-question'
import userEvent from '@testing-library/user-event'

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, className, ...rest }: any) => (
    <button onClick={onClick} className={className} {...rest}>{children}</button>
  ),
}))

vi.mock('lucide-react', () => ({
  ThumbsUp: () => <span data-testid="thumbs-up" />,
  ThumbsDown: () => <span data-testid="thumbs-down" />,
}))

const makeProps = (overrides: Partial<{
  value: boolean | null
  onChange: (v: boolean) => void
}> = {}) => ({
  value: overrides.value ?? null,
  onChange: overrides.onChange ?? vi.fn(),
})

describe('YesNoQuestion', () => {
  test('[AC-YN-001] renders Yes and No buttons', () => {
    renderWithProviders(<YesNoQuestion {...makeProps()} />)
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('No')).toBeInTheDocument()
  })

  test('[AC-YN-002] clicking Yes calls onChange with true (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<YesNoQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByText('Yes'))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  test('[AC-YN-003] clicking No calls onChange with false (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<YesNoQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByText('No'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  test('[AC-YN-004] controlled value true: Yes button gets selected style', () => {
    renderWithProviders(<YesNoQuestion {...makeProps({ value: true })} />)
    const buttons = screen.getAllByRole('button')
    const yesBtn = buttons.find((b) => b.textContent?.includes('Yes'))
    expect(yesBtn?.className).toContain('border-[var(--color-success)]')
  })

  test('[AC-YN-005] controlled value false: No button gets selected style', () => {
    renderWithProviders(<YesNoQuestion {...makeProps({ value: false })} />)
    const buttons = screen.getAllByRole('button')
    const noBtn = buttons.find((b) => b.textContent?.includes('No'))
    expect(noBtn?.className).toContain('border-[var(--color-error)]')
  })

  test('[AC-YN-006] renders thumbs icons', () => {
    renderWithProviders(<YesNoQuestion {...makeProps()} />)
    expect(screen.getByTestId('thumbs-up')).toBeInTheDocument()
    expect(screen.getByTestId('thumbs-down')).toBeInTheDocument()
  })
})
