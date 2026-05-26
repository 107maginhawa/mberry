import { useState, useRef, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@monobase/ui'
import { Input } from '@monobase/ui'
import { Checkbox } from '@monobase/ui'
import { Loader2, Users, UserCheck, Search, Camera, X } from 'lucide-react'
import { PageHeader } from '@/components/patterns/page-header'
import { GlassCard } from '@/components/motion/glass-card'
import { EmptyState } from '@/components/patterns/empty-state'
import { ListSkeleton } from '@/components/patterns/skeleton-loader'
import { listCustomEventRegistrationsOptions, listCustomEventRegistrationsQueryKey, checkInCustomEventMutation } from '@monobase/sdk-ts/generated/react-query'
import { useOrg } from '@/hooks/useOrg'

export const Route = createFileRoute(
  '/_authenticated/org/$orgSlug/officer/events/$eventId/attendance',
)({
  component: EventAttendance,
})

function EventAttendance() {
  const { orgId, orgSlug } = useOrg()
  const { eventId } = Route.useParams()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [checkInFlash, setCheckInFlash] = useState<{ name: string; success: boolean } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const queryOpts = listCustomEventRegistrationsOptions({ path: { eventId } })
  const regQueryKey = listCustomEventRegistrationsQueryKey({ path: { eventId } })

  const { data, isLoading, error } = useQuery(queryOpts)

  interface EventRegistration {
    id: string
    personId?: string
    memberId?: string
    memberName?: string
    personName?: string
    email?: string
    checkedIn?: boolean
  }

  const checkInMutOpts = checkInCustomEventMutation()
  const checkInMutation = useMutation<unknown, Error, EventRegistration, { previous: unknown }>({
    mutationFn: (reg) => (checkInMutOpts.mutationFn as (...args: unknown[]) => Promise<unknown>)({
      path: { eventId },
      body: { eventId, registrationId: reg.id, personId: reg.personId ?? reg.memberId, method: 'manual' as const },
    }),
    onMutate: async (reg) => {
      await queryClient.cancelQueries({ queryKey: regQueryKey })
      const previous = queryClient.getQueryData(regQueryKey)
      queryClient.setQueryData(regQueryKey, (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((r: EventRegistration) =>
            r.id === reg.id ? { ...r, checkedIn: true } : r
          ),
        }
      })
      return { previous }
    },
    onSuccess: (_data, reg) => {
      const name = reg.memberName ?? reg.personName ?? 'Member'
      setCheckInFlash({ name, success: true })
      setTimeout(() => setCheckInFlash(null), 2000)
      toast.success(`${name} checked in`)
    },
    onError: (err, _reg, context) => {
      if (context?.previous) queryClient.setQueryData(regQueryKey, context.previous)
      const apiErr = err as { body?: { message?: string }; message?: string }
      const msg = apiErr?.body?.message ?? apiErr?.message ?? 'Check-in failed'
      setCheckInFlash({ name: msg, success: false })
      setTimeout(() => setCheckInFlash(null), 3000)
      toast.error(msg)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: regQueryKey })
    },
  })

  // QR scanner handler — parse scanned data and trigger check-in
  const handleQrScan = (scannedData: string) => {
    // QR contains registration ID or person ID
    const reg = registrations.find(
      (r) => r.id === scannedData || r.personId === scannedData || r.memberId === scannedData
    )
    if (reg) {
      if (reg.checkedIn) {
        toast.info(`${reg.memberName ?? reg.personName ?? 'Member'} already checked in`)
      } else {
        checkInMutation.mutate(reg)
      }
    } else {
      toast.error('QR code not found in registration list')
    }
    setScannerOpen(false)
  }

  const registrations = (data?.data ?? []) as EventRegistration[]
  const presentCount = registrations.filter((r) => r.checkedIn).length
  const percentage = registrations.length > 0 ? Math.round((presentCount / registrations.length) * 100) : 0

  // Filter registrations by search query
  const filtered = searchQuery
    ? registrations.filter((r) => {
        const name = (r.memberName ?? r.personName ?? '').toLowerCase()
        const email = (r.email ?? '').toLowerCase()
        const q = searchQuery.toLowerCase()
        return name.includes(q) || email.includes(q)
      })
    : registrations

  return (
    <div className="space-y-6">
      {/* Check-in flash animation */}
      {checkInFlash && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center pointer-events-none ${
            checkInFlash.success ? 'bg-[var(--color-success)]/20' : 'bg-[var(--color-error)]/20'
          } animate-pulse`}
        >
          <div className={`text-3xl font-bold ${checkInFlash.success ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
            {checkInFlash.success ? `${checkInFlash.name} ✓` : checkInFlash.name}
          </div>
        </div>
      )}

      <PageHeader
        title="Event Check-In"
        subtitle="Search by name or scan QR code"
        breadcrumbs={[
          { label: 'Officer', href: `/org/${orgSlug}/officer/dashboard` },
          { label: 'Events', href: `/org/${orgSlug}/officer/events` },
          { label: 'Check-In' },
        ]}
        actions={
          <GlassCard className="px-3 py-2">
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[var(--color-muted)]" />
              <span className="text-sm font-medium">
                {presentCount} / {registrations.length} checked in ({percentage}%)
              </span>
            </div>
          </GlassCard>
        }
      />

      {/* Search + Scanner controls */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-muted)]" />
            <Input
              ref={searchInputRef}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
          <Button
            variant={scannerOpen ? 'default' : 'outline'}
            onClick={() => setScannerOpen(!scannerOpen)}
            aria-expanded={scannerOpen}
            aria-controls="qr-scanner"
          >
            {scannerOpen ? <X className="w-4 h-4 mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
            {scannerOpen ? 'Close Scanner' : 'Open Scanner'}
          </Button>
        </div>

        {/* QR Scanner panel */}
        {scannerOpen && (
          <div id="qr-scanner" role="region" aria-label="QR Code Scanner" className="border border-[var(--color-border)] rounded-lg p-4 bg-[var(--color-bg)]">
            <QrScannerView onScan={handleQrScan} onClose={() => setScannerOpen(false)} />
          </div>
        )}
      </GlassCard>

      {/* Attendance list */}
      {isLoading ? (
        <ListSkeleton rows={5} />
      ) : error ? (
        <div className="p-6 text-center text-[var(--color-error)]">
          Failed to load registrations.
        </div>
      ) : registrations.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8" />}
          headline="No registrations yet"
          description="Members who register for this event will appear here."
        />
      ) : (
        <>
          {searchQuery && (
            <p className="text-body-sm text-[var(--color-muted)]">
              Showing {filtered.length} of {registrations.length} registrations
            </p>
          )}
          <GlassCard className="divide-y divide-[var(--color-border-light)]">
            {filtered.map((reg) => {
              const memberId = reg.memberId ?? reg.personId
              const isPresent = !!reg.checkedIn

              return (
                <div
                  key={reg.id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-[var(--color-surface-warm)]/30"
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={isPresent}
                      disabled={isPresent || checkInMutation.isPending}
                      onCheckedChange={() => {
                        if (!isPresent) {
                          checkInMutation.mutate(reg)
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {reg.memberName ?? reg.personName ?? memberId}
                      </p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {reg.email ?? `ID: ${memberId}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPresent ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-success-bg)] text-[var(--color-success)]">
                        <UserCheck className="w-3 h-3" /> Present
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={checkInMutation.isPending}
                        onClick={() => checkInMutation.mutate(reg)}
                      >
                        {checkInMutation.isPending &&
                        checkInMutation.variables?.memberId === memberId ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          'Check In'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </GlassCard>
        </>
      )}
    </div>
  )
}

/**
 * QR Scanner component using html5-qrcode.
 * Gracefully handles camera permission denial.
 */
function QrScannerView({ onScan, onClose }: { onScan: (data: string) => void; onClose: () => void }) {
  const scannerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const scannerInstanceRef = useRef<any>(null)

  useEffect(() => {
    let mounted = true

    async function startScanner() {
      try {
        // Dynamic import — html5-qrcode is optional
        const { Html5Qrcode } = await import('html5-qrcode' /* webpackChunkName: "qr-scanner" */)
        if (!mounted || !scannerRef.current) return

        const scanner = new Html5Qrcode('qr-reader')
        scannerInstanceRef.current = scanner

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText: string) => {
            scanner.stop().catch(() => {})
            onScan(decodedText)
          },
          () => {} // ignore scan failures (no QR in frame)
        )
      } catch (err: any) {
        if (!mounted) return
        if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
          setError('Camera permission denied. Use manual search instead.')
        } else if (err?.message?.includes('No MultiFormat Readers') || err?.message?.includes('module')) {
          setError('QR scanner not available. Use manual search to check in attendees.')
        } else {
          setError('Camera not available. Use manual search to check in attendees.')
        }
      }
    }

    startScanner()

    return () => {
      mounted = false
      if (scannerInstanceRef.current) {
        scannerInstanceRef.current.stop().catch(() => {})
      }
    }
  }, [onScan])

  if (error) {
    return (
      <div className="text-center space-y-3 py-4">
        <p className="text-body-sm text-[var(--color-warning)]">{error}</p>
        <Button variant="outline" size="sm" onClick={onClose}>
          Use Manual Search
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div id="qr-reader" ref={scannerRef} className="mx-auto max-w-[300px]" />
      <p className="text-xs text-center text-[var(--color-muted)]">
        Point camera at attendee's QR code
      </p>
    </div>
  )
}
