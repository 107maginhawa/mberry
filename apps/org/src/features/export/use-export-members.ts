import { useState } from 'react'
import { toast } from 'sonner'
import { listRosterMembers } from '@monobase/sdk-ts/generated'
import { membersToCsv, downloadCsv, type ExportMember } from './members-csv'

const OPEN_INVOICE = new Set(['generated', 'sent', 'overdue'])

// Fetches the full roster on demand (the More page doesn't preload it), builds the CSV
// client-side, and triggers a download. FE-only over the frozen listRosterMembers; no role
// gate beyond what the roster itself enforces (friendly 403). Anchored to the handler
// { data, totalCount } shape.
export function useExportMembers(orgId: string | null): { exportCsv: () => Promise<void>; isExporting: boolean } {
  const [isExporting, setExporting] = useState(false)

  async function exportCsv() {
    if (!orgId || isExporting) return
    setExporting(true)
    try {
      const { data, response } = await listRosterMembers({ query: { organizationId: orgId, pageSize: 100 } })
      if ((response as Response | undefined)?.status === 403) {
        toast.error('You need officer access to export members.')
        return
      }
      const rows = (((data as any)?.data ?? []) as any[])
      if (rows.length === 0) {
        toast.info('No members to export.')
        return
      }
      const members: ExportMember[] = rows.map((m) => ({
        name: m.name || [m.firstName, m.lastName].filter(Boolean).join(' ') || '(no name)',
        memberNumber: m.memberNumber ?? null,
        joinedAt: m.joinedAt ?? null,
        status: m.status,
        duesExpiryDate: m.duesExpiryDate ?? null,
        unpaid: m.status === 'pendingPayment' || OPEN_INVOICE.has(String(m.duesInvoiceStatus ?? '')),
      }))
      const total = Number((data as any)?.totalCount ?? members.length)
      downloadCsv('members.csv', membersToCsv(members))
      toast.success(
        total > members.length
          ? `Exported the first ${members.length} of ${total} members`
          : `Exported ${members.length} member${members.length === 1 ? '' : 's'}`,
      )
    } catch {
      toast.error('Could not export members.')
    } finally {
      setExporting(false)
    }
  }

  return { exportCsv, isExporting }
}
