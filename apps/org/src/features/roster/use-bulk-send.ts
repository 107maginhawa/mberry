import { useRef, useState } from 'react'
import { listDuesInvoices, sendPaymentLink } from '@monobase/sdk-ts/generated'

export type BulkMember = { membershipId: string; personId: string; name: string }

export type BulkResult =
  | { status: 'pending' }
  | { status: 'minting' }
  | { status: 'sent'; url: string }
  | { status: 'no-dues' }
  | { status: 'error'; message: string }

const OUTSTANDING = new Set(['generated', 'sent', 'overdue'])
const ms = (d: unknown) => new Date(d as string).getTime()

// Oldest by periodStart, tie-break createdAt. Mirrors the single-send seam.
function pickOldest<T extends { periodStart: unknown; createdAt?: unknown }>(invoices: T[]): T {
  return invoices.reduce((a, b) => {
    const d = ms(a.periodStart) - ms(b.periodStart)
    if (d !== 0) return d < 0 ? a : b
    return ms(a.createdAt) <= ms(b.createdAt) ? a : b
  })
}

function errMessage(response: Response): string {
  return response.status === 403
    ? 'You are not an officer of this organization.'
    : 'Could not create the pay-link.'
}

export function useBulkSend(
  orgId: string,
  members: BulkMember[],
): { results: Record<string, BulkResult>; progress: { done: number; total: number }; running: boolean; start: () => void } {
  const [results, setResults] = useState<Record<string, BulkResult>>({})
  const [done, setDone] = useState(0)
  const [running, setRunning] = useState(false)
  // Synchronous guard so a double-tap (or a re-render before state flips) can't start twice.
  const startedRef = useRef(false)

  const set = (id: string, r: BulkResult) => setResults((prev) => ({ ...prev, [id]: r }))

  async function start() {
    if (startedRef.current) return
    startedRef.current = true
    setRunning(true)
    setResults(Object.fromEntries(members.map((m) => [m.membershipId, { status: 'pending' as const }])))

    for (const m of members) {
      set(m.membershipId, { status: 'minting' })
      try {
        const { data } = await listDuesInvoices({ query: { membershipId: m.membershipId, pageSize: 50 } })
        const outstanding = (data?.data ?? []).filter((inv: any) => OUTSTANDING.has(inv.status))
        if (outstanding.length === 0) {
          set(m.membershipId, { status: 'no-dues' })
        } else {
          const inv = pickOldest(outstanding as any[])
          const { data: link, response } = await sendPaymentLink({
            path: { organizationId: orgId },
            body: { personId: m.personId, amount: BigInt(Number(inv.totalAmount)), invoiceId: inv.id },
          })
          const res = response as Response
          if (res.status === 201 && link) {
            set(m.membershipId, { status: 'sent', url: `${window.location.origin}${link.paymentUrl}` })
          } else {
            set(m.membershipId, { status: 'error', message: errMessage(res) })
          }
        }
      } catch {
        set(m.membershipId, { status: 'error', message: 'Could not create the pay-link.' })
      }
      setDone((d) => d + 1)
    }
    setRunning(false)
  }

  return { results, progress: { done, total: members.length }, running, start }
}
