import { describe, test, expect, vi } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ChoiceQuestion } from './choice-question'
import userEvent from '@testing-library/user-event'

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, className, ...rest }: any) => (
    <button onClick={onClick} className={className} {...rest}>{children}</button>
  ),
}))

const OPTIONS = ['Option A', 'Option B', 'Option C']

const makeProps = (overrides: Partial<{
  options: string[]
  value: string | string[] | null
  onChange: (v: string | string[]) => void
  multiSelect: boolean
}> = {}) => ({
  options: overrides.options ?? OPTIONS,
  value: overrides.value ?? null,
  onChange: overrides.onChange ?? vi.fn(),
  ...(overrides.multiSelect !== undefined ? { multiSelect: overrides.multiSelect } : {}),
})

describe('ChoiceQuestion', () => {
  test('[AC-CQ-001] renders all options', () => {
    renderWithProviders(<ChoiceQuestion {...makeProps()} />)
    expect(screen.getByText('Option A')).toBeInTheDocument()
    expect(screen.getByText('Option B')).toBeInTheDocument()
    expect(screen.getByText('Option C')).toBeInTheDocument()
  })

  test('[AC-CQ-002] calls onChange with the selected option string (payload check, single)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<ChoiceQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByText('Option B'))
    expect(onChange).toHaveBeenCalledWith('Option B')
  })

  test('[AC-CQ-003] single-select: clicking a second option replaces the first (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(<ChoiceQuestion {...makeProps({ onChange })} />)
    await userEvent.click(screen.getByText('Option A'))
    await userEvent.click(screen.getByText('Option C'))
    // Second call should pass 'Option C', not an array
    expect(onChange).toHaveBeenLastCalledWith('Option C')
  })

  test('[AC-CQ-004] multi-select: clicking two options calls onChange with array containing both (payload check)', async () => {
    const onChange = vi.fn()
    // Render with Option A pre-selected (simulating parent-controlled state)
    renderWithProviders(
      <ChoiceQuestion options={OPTIONS} value={['Option A']} onChange={onChange} multiSelect />
    )
    await userEvent.click(screen.getByText('Option B'))
    expect(onChange).toHaveBeenLastCalledWith(['Option A', 'Option B'])
  })

  test('[AC-CQ-005] multi-select: deselecting an option removes it from array (payload check)', async () => {
    const onChange = vi.fn()
    renderWithProviders(
      <ChoiceQuestion options={OPTIONS} value={['Option A', 'Option B']} onChange={onChange} multiSelect />
    )
    await userEvent.click(screen.getByText('Option A'))
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1]![0] as string[]
    expect(lastCall).not.toContain('Option A')
    expect(lastCall).toContain('Option B')
  })

  test('[AC-CQ-006] controlled value: selected option is visually distinguished', () => {
    renderWithProviders(
      <ChoiceQuestion options={OPTIONS} value="Option B" onChange={vi.fn()} />
    )
    // The check icon appears only for the selected option
    const buttons = screen.getAllByRole('button')
    const selectedBtn = buttons.find((b) => b.textContent?.includes('Option B'))
    expect(selectedBtn?.className).toContain('border-[var(--color-primary)]')
  })
})
