import { describe, test, expect, vi } from '@/test/vitest-shim'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// SUT — first-party imports (static, so Confidence scanner detects SUT binding)
import { CreateChannelDialog } from '../components/create-channel-dialog'
import { ChannelList } from '../components/channel-list'

vi.mock('@monobase/ui', () => ({
  Dialog: ({ children, open }: any) => open ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>{children}</button>
  ),
  Input: ({ value, onChange, ...props }: any) => (
    <input value={value} onChange={onChange} {...props} />
  ),
  Textarea: ({ value, onChange, ...props }: any) => (
    <textarea value={value} onChange={onChange} {...props} />
  ),
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
  Skeleton: ({ className }: any) => <div className={className} />,
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/patterns/empty-state', () => ({
  EmptyState: ({ headline, description, action }: any) => (
    <div>
      <h3>{headline}</h3>
      <p>{description}</p>
      {action && <button onClick={action.onClick}>{action.label}</button>}
    </div>
  ),
}))

// [Tier-F] removed local SDK mock; using global stub in test-setup-root.ts
vi.mock('../hooks/use-unread-counts', () => ({
  useUnreadCounts: () => ({
    hasUnread: () => false,
    markRead: () => {},
  }),
}))

vi.mock('lucide-react', () => ({
  MessageSquare: () => <span>icon</span>,
  Plus: () => <span>+</span>,
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('CreateChannelDialog', () => {
  test('AC-002: renders Create Channel button text', () => {
    render(
      <CreateChannelDialog open onOpenChange={() => {}} onCreated={() => {}} />,
      { wrapper },
    )
    // Dialog title + submit button both say "Create Channel"
    expect(screen.getAllByText('Create Channel').length).toBeGreaterThanOrEqual(1)
  })

  test('AC-003: has name field (required) and description field (optional)', () => {
    render(
      <CreateChannelDialog open onOpenChange={() => {}} onCreated={() => {}} />,
      { wrapper },
    )
    expect(screen.getByLabelText(/channel name/i)).toBeDefined()
    expect(screen.getByLabelText(/description/i)).toBeDefined()
  })

  test('BR-002: submit disabled when name is empty', () => {
    render(
      <CreateChannelDialog open onOpenChange={() => {}} onCreated={() => {}} />,
      { wrapper },
    )
    const submit = screen.getByRole('button', { name: /create/i })
    expect(submit.hasAttribute('disabled')).toBe(true)
  })

  test('BR-002: submit enabled when name is filled', () => {
    render(
      <CreateChannelDialog open onOpenChange={() => {}} onCreated={() => {}} />,
      { wrapper },
    )
    const nameInput = screen.getByLabelText(/channel name/i)
    fireEvent.change(nameInput, { target: { value: 'general' } })
    const submit = screen.getByRole('button', { name: /create/i })
    expect(submit.hasAttribute('disabled')).toBe(false)
  })
})

describe('ChannelList empty states', () => {
  test('AC-005: officer empty state has Create Channel CTA', async () => {
    render(
      <ChannelList orgSlug="test" onSelectRoom={() => {}} isOfficer onCreateChannel={() => {}} />,
      { wrapper },
    )
    await waitFor(() => {
      expect(screen.getByText(/set up your channels/i)).toBeDefined()
    })
    expect(screen.getByText(/create channel/i)).toBeDefined()
  })

  test('AC-006: member empty state has no create CTA', async () => {
    render(
      <ChannelList orgSlug="test" onSelectRoom={() => {}} isOfficer={false} />,
      { wrapper },
    )
    await waitFor(() => {
      expect(screen.getByText(/no channels yet/i)).toBeDefined()
    })
    // Should NOT have a create button
    expect(screen.queryByText(/create channel/i)).toBeNull()
  })
})
