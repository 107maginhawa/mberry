import { describe, test, expect, vi, beforeEach } from '@/test/vitest-shim'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
// SUT — static first-party import (Confidence scanner reads top-of-file)
import { DeliveryFunnel } from '../components/delivery-funnel'

// Mocks
// @monobase/ui rendered as real components against happy-dom.

vi.mock('@/components/patterns/page-header', () => ({
  PageHeader: ({ title }: any) => <h1>{title}</h1>,
}))

vi.mock('@/components/motion/glass-card', () => ({
  GlassCard: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock('@/components/patterns/skeleton-loader', () => ({
  ListSkeleton: () => <div data-testid="loading">Loading...</div>,
}))

vi.mock('@/hooks/useOrg', () => ({
  useOrg: () => ({ orgId: 'org-test', orgSlug: 'test-org' }),
}))

const mockGet = vi.fn()
vi.mock('@/lib/api', () => ({
  api: { get: (...args: any[]) => mockGet(...args) },
}))

// Router (Link, createFileRoute) provided by global mock in test-setup-root.ts.

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('DeliveryFunnel (AC-001, AC-002, AC-003)', () => {
  test('AC-001: renders 4 funnel stages', () => {
    render(
      <DeliveryFunnel sent={100} delivered={90} opened={60} clicked={20} />,
      { wrapper },
    )
    expect(screen.getByText('Sent')).toBeDefined()
    expect(screen.getByText('Delivered')).toBeDefined()
    expect(screen.getByText('Opened')).toBeDefined()
    expect(screen.getByText('Clicked')).toBeDefined()
  })

  test('AC-002: shows rate percentages', () => {
    render(
      <DeliveryFunnel sent={100} delivered={90} opened={60} clicked={20} />,
      { wrapper },
    )
    // Rates display as "(90%)" inline within spans
    expect(screen.getByText('(90%)')).toBeDefined() // delivery rate
    expect(screen.getByText('(60%)')).toBeDefined() // open rate
    expect(screen.getByText('(20%)')).toBeDefined() // click rate
  })

  test('AC-003: funnel bars have proportional widths', () => {
    const { container } = render(
      <DeliveryFunnel sent={100} delivered={80} opened={40} clicked={10} />,
      { wrapper },
    )
    const bars = container.querySelectorAll('[data-testid^="funnel-bar-"]')
    expect(bars.length).toBe(4)
    // First bar (sent) = 100% width
    expect(bars[0].getAttribute('style')).toContain('width: 100%')
    // Delivered = 80%
    expect(bars[1].getAttribute('style')).toContain('width: 80%')
  })

  test('BR-001: empty state when sent is 0', () => {
    render(
      <DeliveryFunnel sent={0} delivered={0} opened={0} clicked={0} />,
      { wrapper },
    )
    expect(screen.getByText(/no data yet/i)).toBeDefined()
  })

  test('BR-002: open rate color coding — success when > 50%', () => {
    const { container } = render(
      <DeliveryFunnel sent={100} delivered={100} opened={60} clicked={10} />,
      { wrapper },
    )
    const openRate = container.querySelector('[data-testid="open-rate"]')
    expect(openRate?.className).toContain('text-[var(--color-success)]')
  })

  test('BR-002: open rate color coding — warning when < 20%', () => {
    const { container } = render(
      <DeliveryFunnel sent={100} delivered={100} opened={15} clicked={5} />,
      { wrapper },
    )
    const openRate = container.querySelector('[data-testid="open-rate"]')
    expect(openRate?.className).toContain('text-[var(--color-warning)]')
  })
})
