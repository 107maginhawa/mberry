import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Alert, AlertDescription, Button, StatusBadge } from '@monobase/ui'
import type { BulkMember, BulkResult } from './use-bulk-send'

const STATUS_LABEL: Record<BulkResult['status'], string> = {
  pending: 'Waiting',
  minting: 'Minting…',
  sent: 'Sent',
  'no-dues': 'No dues',
  error: 'Failed',
}

export function BulkResults({
  members,
  results,
  progress,
  onBack,
}: {
  members: BulkMember[]
  results: Record<string, BulkResult>
  progress: { done: number; total: number }
  onBack: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => { headingRef.current?.focus() }, [])

  const done = progress.done >= progress.total
  const sentUrls = members
    .map((m) => results[m.membershipId])
    .filter((r): r is { status: 'sent'; url: string } => r?.status === 'sent')
    .map((r) => r.url)
  const counts = {
    sent: sentUrls.length,
    failed: members.filter((m) => results[m.membershipId]?.status === 'error').length,
    noDues: members.filter((m) => results[m.membershipId]?.status === 'no-dues').length,
  }

  return (
    <div className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h1 ref={headingRef} tabIndex={-1} className="text-title font-semibold text-foreground outline-none">
        {done ? `Sent ${progress.total} link${progress.total === 1 ? '' : 's'}` : `Sending ${progress.total} links`}
      </h1>
      <p role="status" aria-live="polite" className="text-body text-muted-foreground">
        {done
          ? `${counts.sent} sent · ${counts.failed} failed · ${counts.noDues} no dues`
          : `Minting ${progress.done} of ${progress.total}…`}
      </p>
      {done && counts.sent === 0 && (
        <Alert className="border-warning bg-warning-bg text-warning">
          <AlertDescription>No links sent — no outstanding dues.</AlertDescription>
        </Alert>
      )}

      <ul className="flex flex-col gap-3">
        {members.map((m) => {
          const r = results[m.membershipId] ?? { status: 'pending' as const }
          return (
            <li
              key={m.membershipId}
              className="flex flex-col gap-2 rounded-lg border border-[var(--color-border-light)] bg-surface px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-body font-medium text-foreground truncate">{m.name}</span>
                <StatusBadge variant={r.status === 'sent' ? 'success' : r.status === 'error' ? 'error' : 'muted'}>
                  {STATUS_LABEL[r.status]}
                </StatusBadge>
              </div>
              {r.status === 'sent' && (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-caption text-muted-foreground break-all">{r.url}</span>
                  <Button
                    className="min-h-tap shrink-0"
                    onClick={() => { navigator.clipboard.writeText(r.url); toast.success('Link copied') }}
                    aria-label={`Copy link for ${m.name}`}
                  >
                    Copy
                  </Button>
                </div>
              )}
              {r.status === 'error' && <span className="text-caption text-error">{r.message}</span>}
            </li>
          )
        })}
      </ul>

      <p className="text-caption text-muted-foreground">
        Links are distributed manually until SMS sending is available.
      </p>
      <div className="flex flex-wrap gap-3">
        {sentUrls.length > 0 && (
          <Button
            variant="outline"
            className="min-h-tap"
            onClick={() => { navigator.clipboard.writeText(sentUrls.join('\n')); toast.success('All links copied') }}
            aria-label="Copy all sent links"
          >
            Copy all sent links
          </Button>
        )}
        <Button className="min-h-tap" onClick={onBack} disabled={!done} aria-label="Back to roster">
          Back to roster
        </Button>
      </div>
    </div>
  )
}
