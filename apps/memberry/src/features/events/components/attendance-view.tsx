import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { UserCheck, QrCode, Hand, Search } from 'lucide-react'

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

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/attendance/${eventId}`)
      if (!res.ok) throw new Error('Failed to load attendance')
      return res.json() as Promise<{
        data: any[]
        meta: { total: number; qr: number; manual: number }
      }>
    },
  })

  const checkInMutation = useMutation({
    mutationFn: async (personId: string) => {
      const res = await fetch(`/api/events/checkin/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, method: 'manual' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as any).message ?? 'Check-in failed')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', eventId] })
      setPersonIdInput('')
      setCheckInError(null)
      setCheckInSuccess(true)
      setTimeout(() => setCheckInSuccess(false), 2000)
    },
    onError: (err: Error) => {
      setCheckInError(err.message)
    },
  })

  const attendance = data?.data ?? []
  const stats = data?.meta

  const filtered = search
    ? attendance.filter((a: any) =>
        a.personId.toLowerCase().includes(search.toLowerCase()),
      )
    : attendance

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <UserCheck className="w-4 h-4" />
            <p className="text-sm">Total</p>
          </div>
          <p className="text-2xl font-bold">{stats?.total ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <QrCode className="w-4 h-4" />
            <p className="text-sm">QR Scan</p>
          </div>
          <p className="text-2xl font-bold">{stats?.qr ?? 0}</p>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Hand className="w-4 h-4" />
            <p className="text-sm">Manual</p>
          </div>
          <p className="text-2xl font-bold">{stats?.manual ?? 0}</p>
        </div>
      </div>

      {/* Manual check-in */}
      <div className="border rounded-lg p-4 space-y-3">
        <h3 className="text-sm font-semibold">Manual Check-in</h3>
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
                checkInMutation.mutate(personIdInput.trim())
              }
            }}
            className="flex-1"
          />
          <button
            onClick={() => personIdInput.trim() && checkInMutation.mutate(personIdInput.trim())}
            disabled={!personIdInput.trim() || checkInMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50 hover:bg-primary/90"
          >
            {checkInMutation.isPending ? 'Checking in...' : 'Check In'}
          </button>
        </div>
        {checkInError && (
          <p className="text-sm text-destructive">{checkInError}</p>
        )}
        {checkInSuccess && (
          <p className="text-sm text-green-600">Checked in successfully!</p>
        )}
      </div>

      {/* Search + list */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
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
          <div className="border rounded-lg p-8 text-center text-muted-foreground">
            {search ? 'No attendance records match your search.' : 'No check-ins yet.'}
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden divide-y">
            {filtered.map((record: any) => (
              <div key={record.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{record.personId}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(record.checkedInAt)}
                  </p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  record.method === 'qr'
                    ? 'bg-blue-100 text-blue-800'
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
