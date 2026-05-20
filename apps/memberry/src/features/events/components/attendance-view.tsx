import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input } from '@monobase/ui'
import { Skeleton } from '@monobase/ui'
import { UserCheck, QrCode, Hand, Search } from 'lucide-react'
import {
  listCustomEventAttendanceOptions,
  listCustomEventAttendanceQueryKey,
  checkInCustomEventMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'
import type { CheckIn, CheckInCreateRequest } from '@monobase/sdk-ts/generated/types.gen'

/**
 * Handler accepts personId for manual check-in without a prior registration record.
 * The generated CheckInCreateRequest requires registrationId; extend locally for this case.
 */
interface CheckInByPersonBody extends Omit<CheckInCreateRequest, 'registrationId' | 'method'> {
  personId: string
  method: 'manual' | 'qr_code' | 'badge'
}

interface AttendanceViewProps {
  eventId: string
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function AttendanceView({ eventId }: AttendanceViewProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [personIdInput, setPersonIdInput] = useState('')
  const [checkInError, setCheckInError] = useState<string | null>(null)
  const [checkInSuccess, setCheckInSuccess] = useState(false)

  const { data, isLoading } = useQuery(
    listCustomEventAttendanceOptions({ path: { eventId } }),
  )

  const checkInMut = useMutation({
    mutationFn: checkInCustomEventMutation().mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCustomEventAttendanceQueryKey({ path: { eventId } }) })
      setPersonIdInput('')
      setCheckInError(null)
      setCheckInSuccess(true)
      setTimeout(() => setCheckInSuccess(false), 2000)
    },
    onError: (err: Error) => {
      setCheckInError(err.message)
    },
  })

  const attendance: CheckIn[] = data?.data ?? []
  // Compute stats from attendance data (pagination doesn't include check-in method counts)
  const stats = {
    total: attendance.length,
    qr: attendance.filter((a) => a.method === 'qr_code').length,
    manual: attendance.filter((a) => a.method === 'manual').length,
  }

  // Handler accepts personId for manual check-in (no prior registration required)
  const doCheckIn = (personId: string) =>
    checkInMut.mutate({
      path: { eventId },
      body: { personId, method: 'manual' } as unknown as CheckInCreateRequest,
    })

  const filtered = search
    ? attendance.filter((a) =>
        a.personId.toLowerCase().includes(search.toLowerCase()),
      )
    : attendance

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <UserCheck className="w-4 h-4" />
            <p className="text-sm">Total</p>
          </div>
          <p className="text-[26px] font-bold font-display">{stats?.total ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <QrCode className="w-4 h-4" />
            <p className="text-sm">QR Scan</p>
          </div>
          <p className="text-[26px] font-bold font-display">{stats?.qr ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg border bg-[var(--color-surface)]">
          <div className="flex items-center gap-2 text-[var(--color-muted)] mb-1">
            <Hand className="w-4 h-4" />
            <p className="text-sm">Manual</p>
          </div>
          <p className="text-[26px] font-bold font-display">{stats?.manual ?? 0}</p>
        </div>
      </div>

      {/* Manual check-in */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-h4">Manual Check-in</h3>
        <div className="flex gap-2">
          <Input
            placeholder="Enter member ID..."
            value={personIdInput}
            onChange={(e) => {
              setPersonIdInput(e.target.value)
              setCheckInError(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && personIdInput.trim()) {
                doCheckIn(personIdInput.trim())
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={() => personIdInput.trim() && doCheckIn(personIdInput.trim())}
            disabled={!personIdInput.trim() || checkInMut.isPending}
          >
            {checkInMut.isPending ? 'Checking in...' : 'Check In'}
          </Button>
        </div>
        {checkInError && (
          <p role="alert" aria-live="polite" className="text-sm text-[var(--color-error)]">{checkInError}</p>
        )}
        {checkInSuccess && (
          <p className="text-sm text-green-600">Checked in successfully!</p>
        )}
      </div>

      {/* Search + list */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-[var(--color-muted)]" />
          <Input
            placeholder="Search by member ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border rounded-lg p-8 text-center text-[var(--color-muted)]">
            {search ? 'No attendance records match your search.' : 'No check-ins yet.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y">
            {filtered.map((record: any) => (
              <div key={record.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{record.personId}</p>
                  <p className="text-xs text-[var(--color-muted)]">
                    {formatTime(record.checkedInAt)}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  record.method === 'qr'
                    ? 'bg-[var(--color-info-bg)] text-[var(--color-info)]'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {record.method === 'qr' ? (
                    <><QrCode className="w-3 h-3" /> QR</>
                  ) : (
                    <><Hand className="w-3 h-3" /> Manual</>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
