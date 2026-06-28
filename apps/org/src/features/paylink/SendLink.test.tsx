import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SendLinkView } from './SendLink'

const invoices = [{ id: 'inv1', amount: 250000, status: 'sent' }]

describe('SendLinkView', () => {
  it('confirms before sending an invoice pay-link (no immediate send)', async () => {
    const onSendInvoice = vi.fn()
    render(
      <SendLinkView
        memberName="Olive Cruz"
        invoices={invoices}
        state={{ kind: 'idle' }}
        onSendInvoice={onSendInvoice}
        onSendCustom={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByText('₱2,500.00')).toBeInTheDocument()
    // Clicking "Send link" opens a confirm dialog — it must NOT send yet.
    await userEvent.click(screen.getAllByRole('button', { name: /send link/i })[0]!)
    expect(onSendInvoice).not.toHaveBeenCalled()
    expect(screen.getByText(/send olive cruz a payment link for ₱2,500\.00/i)).toBeInTheDocument()
    // Confirm → fires the send.
    await userEvent.click(screen.getByRole('button', { name: /send pay-link/i }))
    expect(onSendInvoice).toHaveBeenCalledWith('inv1', 250000)
  })

  it('confirms before revoking a sent link (no immediate revoke)', async () => {
    const onRevoke = vi.fn()
    render(
      <SendLinkView
        memberName="Olive Cruz"
        invoices={[]}
        state={{ kind: 'sent', url: 'http://x/pay/TOK', tokenId: 'TOK', expiresAt: '2026-09-01T00:00:00Z' }}
        onSendInvoice={vi.fn()}
        onSendCustom={vi.fn()}
        onRevoke={onRevoke}
      />,
    )
    expect(screen.getByText('http://x/pay/TOK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^revoke link$/i }))
    expect(onRevoke).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /yes, revoke/i }))
    expect(onRevoke).toHaveBeenCalledTimes(1)
  })
})
