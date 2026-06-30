import { NavIcon } from '@monobase/ui'
import { Download } from '@monobase/ui/icons'
import { useSelectedOrg } from '../org/use-org'
import { useExportMembers } from './use-export-members'

// Action row for the More page (styled like the tool links, but it's a button — it triggers a
// download, not navigation). Fetches the roster and exports a CSV client-side.
export function ExportMembers() {
  const { orgId } = useSelectedOrg()
  const { exportCsv, isExporting } = useExportMembers(orgId)
  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={!orgId || isExporting}
      className="flex min-h-tap w-full items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left hover:bg-[var(--color-surface-warm)] disabled:opacity-50"
    >
      <NavIcon icon={Download} size="lg" className="text-primary" aria-hidden />
      <span className="flex-1">
        <span className="block text-body font-medium text-foreground">{isExporting ? 'Exporting…' : 'Export members (CSV)'}</span>
        <span className="block text-caption text-muted-foreground">Download a roster + dues report</span>
      </span>
    </button>
  )
}
