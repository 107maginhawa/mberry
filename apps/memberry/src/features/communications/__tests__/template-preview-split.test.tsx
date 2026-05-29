import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@monobase/ui', () => ({
  Button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
  Input: ({ onChange, value, ...props }: any) => <input value={value} onChange={onChange} {...props} />,
  Textarea: ({ onChange, value, ...props }: any) => <textarea value={value} onChange={onChange} {...props} />,
}))

const { TemplateSplitEditor } = await import('../components/template-split-editor')

describe('TemplateSplitEditor', () => {
  test('AC-001: renders split layout with editor and preview panes', () => {
    const { container } = render(
      <TemplateSplitEditor body="Hello {{member.name}}" onChange={() => {}} />,
    )
    // Should have 2 panes in a grid
    const grid = container.querySelector('[data-testid="split-editor"]')
    expect(grid).toBeDefined()
    expect(grid?.children.length).toBe(2)
  })

  test('AC-002: preview updates live as body changes', () => {
    const { rerender } = render(
      <TemplateSplitEditor body="Hello" onChange={() => {}} />,
    )
    // Both editor textarea and preview render the text
    expect(screen.getAllByText('Hello').length).toBeGreaterThanOrEqual(1)

    rerender(<TemplateSplitEditor body="Updated content" onChange={() => {}} />)
    expect(screen.getAllByText('Updated content').length).toBeGreaterThanOrEqual(1)
  })

  test('AC-003: merge fields render with sample values in preview', () => {
    render(
      <TemplateSplitEditor body="Dear {{member.name}}, your dues are {{member.duesAmount}}" onChange={() => {}} />,
    )
    // Preview pane should show rendered values
    expect(screen.getByText(/Dr. Maria Santos/)).toBeDefined()
    expect(screen.getByText(/₱2,500/)).toBeDefined()
  })

  test('AC-005: mobile preview toggle exists', () => {
    render(
      <TemplateSplitEditor body="Test" onChange={() => {}} />,
    )
    const toggle = screen.getByRole('button', { name: /mobile/i })
    expect(toggle).toBeDefined()
  })

  test('BR-001: empty content shows placeholder', () => {
    render(
      <TemplateSplitEditor body="" onChange={() => {}} />,
    )
    expect(screen.getByText(/start typing to see preview/i)).toBeDefined()
  })

  test('BR-002: unknown merge fields rendered with highlight styling', () => {
    const { container } = render(
      <TemplateSplitEditor body="Hello {{unknown.field}}" onChange={() => {}} />,
    )
    const highlighted = container.querySelector('[data-testid="unresolved-merge-field"]')
    expect(highlighted).toBeDefined()
    expect(highlighted?.textContent).toContain('{{unknown.field}}')
  })
})
