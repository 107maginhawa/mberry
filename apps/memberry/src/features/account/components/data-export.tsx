import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Download, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react'

type ExportStatus = 'Processing' | 'Ready' | 'Expired'

interface ExportRecord {
  id: string
  requestedAt: string
  status: ExportStatus
  downloadUrl?: string
}

const RATE_LIMIT_KEY = 'data_export_last_request'
const RATE_LIMIT_HOURS = 24

// Mock export history
const MOCK_EXPORTS: ExportRecord[] = [
  {
    id: 'exp-1',
    requestedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Expired',
  },
  {
    id: 'exp-2',
    requestedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Expired',
  },
  {
    id: 'exp-3',
    requestedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'Expired',
  },
]

const STATUS_CONFIG: Record<ExportStatus, { icon: React.ReactNode; className: string; label: string }> = {
  Processing: {
    icon: <Clock size={13} />,
    className: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)]',
    label: 'Processing',
  },
  Ready: {
    icon: <CheckCircle size={13} />,
    className: 'text-[var(--color-success)] bg-[var(--color-success-bg)]',
    label: 'Ready',
  },
  Expired: {
    icon: <AlertCircle size={13} />,
    className: 'text-[var(--color-muted)] bg-[var(--color-border-light)]',
    label: 'Expired',
  },
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
  const [exports, setExports] = useState<ExportRecord[]>(MOCK_EXPORTS)
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
      const res = await fetch('/api/persons/me/export', { credentials: 'include' })
      if (!res.ok) throw new Error('Export failed')
      const data = await res.json()

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
      <div className="rounded-[12px] border border-[var(--color-border-light)] bg-[var(--color-surface)] p-5">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-[var(--color-primary)] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-[15px] font-semibold">What's included in your export</h2>
            <p className="text-[13px] text-[var(--color-muted)] mt-1.5 leading-relaxed">
              Your export includes all personal data we hold about you: profile information,
              membership records, payment history, event registrations, training completions,
              certificates, and notifications. The export is delivered as a ZIP archive
              containing JSON and CSV files.
            </p>
            <p className="text-[13px] text-[var(--color-muted)] mt-2">
              Exports are available for 7 days after generation. You can request one export every{' '}
              {RATE_LIMIT_HOURS} hours.
            </p>
          </div>
        </div>
      </div>

      {/* Request button */}
      <div>
        <Button
          onClick={handleRequestExport}
          disabled={isRequesting || rateLimited}
          className="gap-2"
        >
          <Download size={15} />
          {isRequesting
            ? 'Requesting…'
            : rateLimited
              ? `Next export available in ${hoursUntilNextRequest()}h`
              : 'Request Data Export'}
        </Button>
        {rateLimited && (
          <p className="text-[12px] text-[var(--color-muted)] mt-2">
            You requested an export recently. Check back in {hoursUntilNextRequest()} hour(s).
          </p>
        )}
      </div>

      {/* Previous exports */}
      {exports.length > 0 && (
        <div>
          <h2 className="text-[15px] font-semibold mb-3">Previous Exports</h2>
          <div className="rounded-[12px] border border-[var(--color-border-light)] overflow-hidden">
            <table className="w-full text-[14px]">
              <thead className="bg-[var(--color-surface-warm)]">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-[var(--color-muted)] text-[12px] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-5 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {exports.map((e) => {
                  const config = STATUS_CONFIG[e.status]
                  return (
                    <tr
                      key={e.id}
                      className="border-t border-[var(--color-border-light)]"
                    >
                      <td className="px-5 py-3.5 text-[var(--color-muted)]">
                        {new Date(e.requestedAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold ${config.className}`}
                        >
                          {config.icon}
                          {config.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {e.status === 'Ready' && e.downloadUrl ? (
                          <a
                            href={e.downloadUrl}
                            className="text-[13px] font-semibold text-[var(--color-primary)] hover:underline inline-flex items-center gap-1"
                          >
                            <Download size={13} />
                            Download
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
