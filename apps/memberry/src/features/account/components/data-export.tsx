import { useState } from 'react'
import { Button } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Download, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { StatusBadge, type StatusBadgeVariant } from '@/components/patterns/status-badge'

type ExportStatus = 'Processing' | 'Ready' | 'Expired'

interface ExportRecord {
  id: string
  requestedAt: string
  status: ExportStatus
  downloadUrl?: string
}

const RATE_LIMIT_KEY = 'data_export_last_request'
const RATE_LIMIT_HOURS = 24


const STATUS_CONFIG: Record<ExportStatus, { icon: React.ReactNode; variant: StatusBadgeVariant; label: string }> = {
  Processing: { icon: <Clock size={12} />, variant: 'warning', label: 'Processing' },
  Ready: { icon: <CheckCircle size={12} />, variant: 'success', label: 'Ready' },
  Expired: { icon: <AlertCircle size={12} />, variant: 'muted', label: 'Expired' },
}

function getLastRequestTime(): Date | null {
  const stored = localStorage.getItem(RATE_LIMIT_KEY)
  return stored ? new Date(stored) : null
}

function isRateLimited(): boolean {
  const last = getLastRequestTime()
  if (!last) return false
  const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60)
  return hoursSince < RATE_LIMIT_HOURS
}

function hoursUntilNextRequest(): number {
  const last = getLastRequestTime()
  if (!last) return 0
  const hoursSince = (Date.now() - last.getTime()) / (1000 * 60 * 60)
  return Math.ceil(RATE_LIMIT_HOURS - hoursSince)
}

export function DataExport() {
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [isRequesting, setIsRequesting] = useState(false)
  const [rateLimited, setRateLimited] = useState(isRateLimited)

  async function handleRequestExport() {
    if (isRateLimited()) {
      setRateLimited(true)
      toast.error('Export already requested', {
        description: `You can request another export in ${hoursUntilNextRequest()} hour(s).`,
      })
      return
    }

    setIsRequesting(true)
    try {
      // T3: this endpoint is GET (services/api-ts/src/handlers/person/exportMyData.ts
      // registers `app.get('/persons/me/export', …)`). Previously POSTed,
      // which silently 405'd and left the Previous Exports list empty.
      const data = await api.get<any>('/api/persons/me/export')

      // Create downloadable JSON blob
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)

      const newExport: ExportRecord = {
        id: `exp-${Date.now()}`,
        requestedAt: new Date().toISOString(),
        status: 'Ready',
        downloadUrl: url,
      }

      setExports((prev) => [newExport, ...prev])
      localStorage.setItem(RATE_LIMIT_KEY, new Date().toISOString())
      setRateLimited(true)

      toast.success('Export ready', {
        description: `Exported ${data.categories?.length ?? 0} data categories. Click Download to save.`,
      })
    } catch {
      toast.error('Export failed', { description: 'Please try again later.' })
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Explanation */}
      <GlassCard className="p-5">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-h4">What's included in your export</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1.5 leading-relaxed">
              Your export includes all personal data we hold about you: profile information,
              membership records, payment history, event registrations, training completions,
              certificates, and notifications. The export is delivered as a JSON file.
            </p>
            <p className="text-sm text-[var(--color-muted)] mt-2">
              Exports are available for 7 days after generation. You can request one export every{' '}
              {RATE_LIMIT_HOURS} hours.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Request button */}
      <div>
        <Button
          onClick={handleRequestExport}
          disabled={isRequesting || rateLimited}
          className="gap-2"
        >
          <Download size={16} />
          {isRequesting
            ? 'Requesting…'
            : rateLimited
              ? `Next export available in ${hoursUntilNextRequest()}h`
              : 'Request Data Export'}
        </Button>
        {rateLimited && (
          <p className="text-xs text-[var(--color-muted)] mt-2">
            You requested an export recently. Check back in {hoursUntilNextRequest()} hour(s).
          </p>
        )}
      </div>

      {/* Previous exports */}
      {exports.length === 0 ? (
        <EmptyState
          icon={<FileText size={40} />}
          headline="No exports yet"
          description="Request an export above and it will appear here to download."
        />
      ) : (
        <div>
          <h2 className="text-h4 mb-3">Previous Exports</h2>
          <GlassCard className="overflow-hidden">
            <Table className="text-sm">
              <TableHeader className="bg-[var(--color-surface-warm)]">
                <TableRow>
                  <TableHead className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                    Date
                  </TableHead>
                  <TableHead className="px-5 py-3 font-semibold text-xs uppercase tracking-wide">
                    Status
                  </TableHead>
                  <TableHead className="px-5 py-3 w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exports.map((e) => {
                  const config = STATUS_CONFIG[e.status]
                  return (
                    <TableRow
                      key={e.id}
                      className="border-t border-[var(--color-border-light)]"
                    >
                      <TableCell className="px-5 py-3.5 text-[var(--color-muted)]">
                        {new Date(e.requestedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="px-5 py-3.5">
                        <StatusBadge variant={config.variant}>
                          {config.icon}
                          {config.label}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="px-5 py-3.5 text-right">
                        {e.status === 'Ready' && e.downloadUrl ? (
                          <a
                            href={e.downloadUrl}
                            className="text-sm font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                          >
                            <Download size={12} />
                            Download
                          </a>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
