import { describe, test, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ActionWidget, CreditRing } from './action-widget'
import { Award } from 'lucide-react'

// Mock @tanstack/react-router
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: Record<string, string> }) => (
    <a href={String(to)} data-params={JSON.stringify(params)}>{children}</a>
  ),
}))

describe('ActionWidget', () => {
  const defaultProps = {
    icon: <Award size={18} />,
    label: 'Credits',
    value: '42',
  }

  test('renders label and value', () => {
    renderWithProviders(<ActionWidget {...defaultProps} />)

    expect(screen.getByText('Credits')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  test('renders subtitle when provided', () => {
    renderWithProviders(<ActionWidget {...defaultProps} subtitle="CPD units earned" />)

    expect(screen.getByText('CPD units earned')).toBeInTheDocument()
  })

  test('renders action link when provided', () => {
    renderWithProviders(
      <ActionWidget
        {...defaultProps}
        action={{ label: 'View all', to: '/my/credits' }}
      />
    )

    const link = screen.getByText(/View all/)
    expect(link.closest('a')).toHaveAttribute('href', '/my/credits')
  })

  test('renders error state when errorMessage provided', () => {
    renderWithProviders(
      <ActionWidget
        {...defaultProps}
        errorMessage="Failed to load credit data"
      />
    )

    expect(screen.getByText('Failed to load credit data')).toBeInTheDocument()
    // Value should NOT be rendered in error state
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })

  test('renders status dot with correct aria-label', () => {
    renderWithProviders(
      <ActionWidget {...defaultProps} status="success" />
    )

    expect(screen.getByText('Good standing')).toBeInTheDocument()
  })

  test('renders custom statusLabel over default', () => {
    renderWithProviders(
      <ActionWidget {...defaultProps} status="warning" statusLabel="Expiring soon" />
    )

    expect(screen.getByText('Expiring soon')).toBeInTheDocument()
  })

  test('renders children instead of value/subtitle when provided', () => {
    renderWithProviders(
      <ActionWidget {...defaultProps}>
        <p>Custom content here</p>
      </ActionWidget>
    )

    expect(screen.getByText('Custom content here')).toBeInTheDocument()
    // Default value display should be replaced by children
    expect(screen.queryByText('42')).not.toBeInTheDocument()
  })
})

describe('CreditRing', () => {
  test('renders SVG with correct aria-label', () => {
    renderWithProviders(<CreditRing earned={15} required={20} />)

    expect(screen.getByRole('img', { name: '15 of 20 credits earned' })).toBeInTheDocument()
  })

  test('renders with zero required (no requirement set)', () => {
    renderWithProviders(<CreditRing earned={10} required={0} />)

    expect(screen.getByRole('img', { name: '10 of 10 credits earned' })).toBeInTheDocument()
  })

  test('renders with custom size', () => {
    renderWithProviders(<CreditRing earned={5} required={10} size={80} />)

    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('width', '80')
    expect(svg).toHaveAttribute('height', '80')
  })

  test('renders when earned exceeds required (capped at 100%)', () => {
    renderWithProviders(<CreditRing earned={25} required={20} />)

    expect(screen.getByRole('img', { name: '25 of 20 credits earned' })).toBeInTheDocument()
  })
})
