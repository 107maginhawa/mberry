import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SendLinkView } from './SendLink'

const invoices = [{ id: 'inv1', amount: 250000, status: 'sent' }]

describe('SendLinkView', () => {
  it('renders outstanding invoices with peso amounts and a send action', async () => {
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
    await userEvent.click(screen.getAllByRole('button', { name: /send link/i })[0]!)
    expect(onSendInvoice).toHaveBeenCalledWith('inv1', 250000)
  })

  it('shows the link + copy + revoke when sent', () => {
    render(
      <SendLinkView
        memberName="Olive Cruz"
        invoices={[]}
        state={{ kind: 'sent', url: 'http://x/pay/TOK', tokenId: 'TOK', expiresAt: '2026-09-01T00:00:00Z' }}
        onSendInvoice={vi.fn()}
        onSendCustom={vi.fn()}
        onRevoke={vi.fn()}
      />,
    )
    expect(screen.getByText('http://x/pay/TOK')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument()
  })
})
