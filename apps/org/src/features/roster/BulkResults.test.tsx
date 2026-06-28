import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BulkResults } from './BulkResults'

const members = [
  { membershipId: 'm1', personId: 'p1', name: 'Olive' },
  { membershipId: 'm2', personId: 'p2', name: 'Ben' },
  { membershipId: 'm3', personId: 'p3', name: 'Ana' },
]

beforeEach(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })
})

describe('BulkResults', () => {
  it('renders a labeled status for each member and the running progress', () => {
    render(
      <BulkResults
        members={members}
        progress={{ done: 1, total: 3 }}
        results={{
          m1: { status: 'sent', url: 'https://app.test/pay/a' },
          m2: { status: 'no-dues' },
          m3: { status: 'minting' },
        }}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/Minting 1 of 3/i)).toBeInTheDocument()
    expect(screen.getByText('Olive')).toBeInTheDocument()
    expect(screen.getByText(/no dues/i)).toBeInTheDocument()
    expect(screen.getByText('https://app.test/pay/a')).toBeInTheDocument()
  })

  it('Copy copies a single link; Copy all copies every sent link', () => {
    render(
      <BulkResults
        members={members}
        progress={{ done: 3, total: 3 }}
        results={{
          m1: { status: 'sent', url: 'https://app.test/pay/a' },
          m2: { status: 'sent', url: 'https://app.test/pay/b' },
          m3: { status: 'no-dues' },
        }}
        onBack={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /copy link for olive/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://app.test/pay/a')
    fireEvent.click(screen.getByRole('button', { name: /copy all sent links/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('https://app.test/pay/b'))
  })

  it('shows a tally and fires onBack', () => {
    const onBack = vi.fn()
    render(
      <BulkResults
        members={members}
        progress={{ done: 3, total: 3 }}
        results={{ m1: { status: 'sent', url: 'u' }, m2: { status: 'error', message: 'x' }, m3: { status: 'no-dues' } }}
        onBack={onBack}
      />,
    )
    expect(screen.getByText(/1 sent/i)).toBeInTheDocument()
    expect(screen.getByText(/1 failed/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to roster/i }))
    expect(onBack).toHaveBeenCalled()
  })

  it('shows an explicit message when nothing was sent', () => {
    render(
      <BulkResults
        members={[members[0]!]}
        progress={{ done: 1, total: 1 }}
        results={{ m1: { status: 'no-dues' } }}
        onBack={() => {}}
      />,
    )
    expect(screen.getByText(/no links sent/i)).toBeInTheDocument()
  })
})
