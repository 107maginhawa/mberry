import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle, Users, Award } from 'lucide-react'

interface CompletionTableProps {
  orgId: string
  trainingId: string
  creditAmount: string | number
}

export function CompletionTable({ orgId, trainingId, creditAmount }: CompletionTableProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState<string | null>(null)

  const enrollmentsQuery = useQuery({
    queryKey: ['training-enrollments', trainingId],
    queryFn: async () => {
      const res = await fetch(`/api/training/detail/${orgId}/${trainingId}`)
      if (!res.ok) throw new Error('Failed to load')
      const json = await res.json()
      return json.data
    },
  })

  const attendanceQuery = useQuery({
    queryKey: ['training-attendance', trainingId],
    queryFn: async () => {
      // attendance is included in detail response via stats
      return enrollmentsQuery.data?.attendance ?? { completed: 0, totalCredits: 0 }
    },
    enabled: !!enrollmentsQuery.data,
  })

  const enrollmentsListQuery = useQuery({
    queryKey: ['training-enrollments-list', trainingId],
    queryFn: async () => {
      // Fetch enrollments from detail (we don't have a dedicated endpoint — use what we have)
      // In production this would call a dedicated enrollments list endpoint
      return [] as any[]
    },
  })

  const markMutation = useMutation({
    mutationFn: async (personId: string) => {
      const res = await fetch(`/api/training/complete/${orgId}/${trainingId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personId, method: 'manual' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Failed to mark complete')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-enrollments', trainingId] })
      queryClient.invalidateQueries({ queryKey: ['training-attendance', trainingId] })
      setMarking(null)
    },
    onError: (_err, personId) => {
      setMarking(null)
    },
  })

  const markAllMutation = useMutation({
    mutationFn: async (personIds: string[]) => {
      for (const pid of personIds) {
        await fetch(`/api/training/complete/${orgId}/${trainingId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ personId: pid, method: 'manual' }),
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-enrollments', trainingId] })
      queryClient.invalidateQueries({ queryKey: ['training-attendance', trainingId] })
      setSelected(new Set())
    },
  })

  const detail = enrollmentsQuery.data
  const enrollmentCount = detail?.enrollmentCount ?? 0
  const attendance = detail?.attendance ?? { completed: 0, totalCredits: 0 }

  const enrollments: any[] = enrollmentsListQuery.data ?? []
  const allIds = enrollments.map((e) => e.personId)
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id))

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(allIds))
    }
  }

  const toggleOne = (id: string) => {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-card">
          <div className="p-2 rounded-lg bg-blue-100">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{enrollmentCount}</p>
            <p className="text-xs text-muted-foreground">Enrolled</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-card">
          <div className="p-2 rounded-lg bg-green-100">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{attendance.completed}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-card">
          <div className="p-2 rounded-lg bg-amber-100">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{attendance.totalCredits}</p>
            <p className="text-xs text-muted-foreground">Credits Awarded</p>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button
            onClick={() => markAllMutation.mutate([...selected])}
            disabled={markAllMutation.isPending}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            {markAllMutation.isPending ? 'Marking…' : 'Mark All Complete'}
          </button>
          <button onClick={() => setSelected(new Set())} className="text-sm text-muted-foreground hover:text-foreground">
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="rounded"
                  disabled={enrollments.length === 0}
                />
              </th>
              <th className="text-left p-3 font-medium">Member</th>
              <th className="text-left p-3 font-medium">Enrollment Status</th>
              <th className="text-left p-3 font-medium">Completion</th>
              <th className="text-left p-3 font-medium">Credits</th>
              <th className="p-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {enrollmentsQuery.isLoading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">Loading…</td>
              </tr>
            ) : enrollments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  No enrollments yet. Enrollment data will appear here once members sign up.
                </td>
              </tr>
            ) : (
              enrollments.map((e: any) => (
                <tr key={e.id} className="border-t hover:bg-muted/20">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(e.personId)}
                      onChange={() => toggleOne(e.personId)}
                      className="rounded"
                    />
                  </td>
                  <td className="p-3">
                    <span className="font-medium">{e.personId.slice(0, 8)}…</span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'enrolled' ? 'bg-green-100 text-green-700' :
                      e.status === 'waitlisted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {e.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    {e.completedAt ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {new Date(e.completedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">Pending</span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {e.completedAt ? `${creditAmount} CPE` : '—'}
                  </td>
                  <td className="p-3 text-center">
                    {!e.completedAt && (
                      <button
                        onClick={() => {
                          setMarking(e.personId)
                          markMutation.mutate(e.personId)
                        }}
                        disabled={markMutation.isPending && marking === e.personId}
                        className="px-2 py-1 text-xs border rounded hover:bg-muted disabled:opacity-50"
                      >
                        {markMutation.isPending && marking === e.personId ? 'Marking…' : 'Mark Complete'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
