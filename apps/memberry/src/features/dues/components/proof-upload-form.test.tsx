import { describe, test, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/utils'
import { ProofUploadForm } from './proof-upload-form'

vi.mock('@monobase/sdk-ts/generated/react-query', () => ({
  submitPaymentProofMutation: vi.fn(() => ({ mutationFn: vi.fn().mockResolvedValue({}) })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe('ProofUploadForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('renders form fields', () => {
    renderWithProviders(
      <ProofUploadForm
        invoiceId="inv-1"
        invoiceAmount={50000}
        currency="PHP"
        orgId="org-1"
      />
    )

    expect(screen.getByText('Payment Method')).toBeInTheDocument()
    expect(screen.getByText('Reference Number (optional)')).toBeInTheDocument()
    expect(screen.getByText('Proof of Payment')).toBeInTheDocument()
    expect(screen.getByText('Submit Payment Proof')).toBeInTheDocument()
  })

  test('shows upload instructions when no file selected', () => {
    renderWithProviders(
      <ProofUploadForm
        invoiceId="inv-1"
        invoiceAmount={50000}
        currency="PHP"
        orgId="org-1"
      />
    )

    expect(screen.getByText('Upload GCash screenshot or bank transfer receipt')).toBeInTheDocument()
    expect(screen.getByText('JPEG, PNG, or PDF (max 10MB)')).toBeInTheDocument()
  })

  test('submit button is disabled when no file or method selected', () => {
    renderWithProviders(
      <ProofUploadForm
        invoiceId="inv-1"
        invoiceAmount={50000}
        currency="PHP"
        orgId="org-1"
      />
    )

    const button = screen.getByText('Submit Payment Proof')
    expect(button).toBeDisabled()
  })

  test('renders select method placeholder', () => {
    renderWithProviders(
      <ProofUploadForm
        invoiceId="inv-1"
        invoiceAmount={50000}
        currency="PHP"
        orgId="org-1"
      />
    )

    expect(screen.getByText('Select method')).toBeInTheDocument()
  })
})
