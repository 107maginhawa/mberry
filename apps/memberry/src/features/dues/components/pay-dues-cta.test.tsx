import { describe, test, expect } from '@/test/vitest-shim'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { PayDuesCta } from './pay-dues-cta'

// [FIX-009 / Q-PD8] Member "Pay Now" entry point on the My Payments page.
// Presentational: shows a CTA routing to the org dues pay section only when an
// open invoice exists; renders nothing otherwise.

describe('PayDuesCta', () => {
  test('renders a Pay Now link to the org dues pay section when an open invoice exists', () => {
    renderWithProviders(
      <PayDuesCta openInvoiceCount={2} orgSlug="acme" amountDueCents={200000} currency="PHP" />,
    )

    const link = screen.getByRole('link', { name: /pay now/i })
    expect(link).toBeInTheDocument()
    expect(link.getAttribute('href')).toBe('/org/acme/dues')
  })

  test('renders nothing when there are no open invoices', () => {
    const { container } = renderWithProviders(
      <PayDuesCta openInvoiceCount={0} orgSlug="acme" />,
    )
    expect(screen.queryByRole('link', { name: /pay now/i })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  test('renders nothing when no org context (orgSlug) is available', () => {
    const { container } = renderWithProviders(
      <PayDuesCta openInvoiceCount={3} orgSlug={null} />,
    )
    expect(screen.queryByRole('link', { name: /pay now/i })).toBeNull()
    expect(container).toBeEmptyDOMElement()
  })

  test('surfaces the unpaid-invoice count to the member', () => {
    renderWithProviders(<PayDuesCta openInvoiceCount={3} orgSlug="acme" />)
    // a count of outstanding invoices is shown so the CTA is informative
    expect(screen.getByText(/3/)).toBeInTheDocument()
  })
})
