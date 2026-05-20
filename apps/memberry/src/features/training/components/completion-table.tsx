import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckCircle, Users, Award } from 'lucide-react'
import { Checkbox } from '@monobase/ui'
import { Button } from '@monobase/ui'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@monobase/ui'
import {
  listCustomTrainingEnrollmentsOptions,
  listCustomTrainingEnrollmentsQueryKey,
  completeCustomTrainingMutation,
} from '@monobase/sdk-ts/generated/@tanstack/react-query.gen'

interface CompletionTableProps {
  orgId: string
  trainingId: string
  creditAmount: string | number
}

export function CompletionTable({ orgId, trainingId, creditAmount }: CompletionTableProps) {
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [marking, setMarking] = useState<string | null>(null)

  const enrollmentsListQuery = useQuery(
    listCustomTrainingEnrollmentsOptions({ path: { trainingId }, query: { organizationId: orgId } }),
  )

  const markMutation = useMutation({
    ...completeCustomTrainingMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCustomTrainingEnrollmentsQueryKey({ path: { trainingId }, query: { organizationId: orgId } }) })
      setMarking(null)
    },
    onError: () => { setMarking(null) },
  })

  const markAllMutation = useMutation({
    ...completeCustomTrainingMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: listCustomTrainingEnrollmentsQueryKey({ path: { trainingId }, query: { organizationId: orgId } }) })
      setSelected(new Set())
    },
  })

  const enrollments = (enrollmentsListQuery.data?.data ?? []) as any[]
  const enrollmentCount = enrollmentsListQuery.data?.pagination?.totalCount ?? enrollments.length
  const attendance = { completed: enrollments.filter((e: any) => e.completedAt).length, totalCredits: 0 }

  // enrollments already derived above
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
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-[var(--color-surface)]">
          <div className="p-2 rounded-lg bg-blue-100">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{enrollmentCount}</p>
            <p className="text-xs text-[var(--color-muted)]">Enrolled</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-[var(--color-surface)]">
          <div className="p-2 rounded-lg bg-green-100">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{attendance.completed}</p>
            <p className="text-xs text-[var(--color-muted)]">Completed</p>
          </div>
        </div>
        <div className="border rounded-xl p-4 flex items-center gap-3 bg-[var(--color-surface)]">
          <div className="p-2 rounded-lg bg-amber-100">
            <Award className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-xl font-bold">{attendance.totalCredits}</p>
            <p className="text-xs text-[var(--color-muted)]">Credits Awarded</p>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-[var(--color-primary)]/20 rounded-lg">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Button
            size="sm"
            onClick={() => {
              const ids = [...selected]
              // Fire one mutation per person (SDK doesn't support bulk)
              ids.forEach(pid =>
                markMutation.mutate({ path: { trainingId }, query: { organizationId: orgId }, body: { personId: pid, creditAmount: Number(creditAmount) } } as any)
              )
            }}
            disabled={markAllMutation.isPending}
          >
            {markAllMutation.isPending ? 'Marking…' : 'Mark All Complete'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-xl overflow-hidden">
        <Table className="text-sm">
          <TableHeader className="bg-[var(--color-surface-warm)]">
            <TableRow>
              <TableHead className="p-3 w-8">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  disabled={enrollments.length === 0}
                />
              </TableHead>
              <TableHead className="p-3">Member</TableHead>
              <TableHead className="p-3">Enrollment Status</TableHead>
              <TableHead className="p-3">Completion</TableHead>
              <TableHead className="p-3">Credits</TableHead>
              <TableHead className="p-3">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrollmentsListQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-[var(--color-muted)]">Loading…</TableCell>
              </TableRow>
            ) : enrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-[var(--color-muted)]">
                  No enrollments yet. Enrollment data will appear here once members sign up.
                </TableCell>
              </TableRow>
            ) : (
              enrollments.map((e: any) => (
                <TableRow key={e.id} className="border-t hover:bg-[var(--color-surface-warm)]">
                  <TableCell className="p-3">
                    <Checkbox
                      checked={selected.has(e.personId)}
                      onCheckedChange={() => toggleOne(e.personId)}
                    />
                  </TableCell>
                  <TableCell className="p-3">
                    <span className="font-medium">{e.personId.slice(0, 8)}…</span>
                  </TableCell>
                  <TableCell className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      e.status === 'enrolled' ? 'bg-green-100 text-green-700' :
                      e.status === 'waitlisted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {e.status.replace('_', ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="p-3">
                    {e.completedAt ? (
                      <span className="inline-flex items-center gap-1 text-green-700 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" />
                        {new Date(e.completedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-[var(--color-muted)] text-xs">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="p-3 text-xs">
                    {e.completedAt ? `${creditAmount} CPE` : '—'}
                  </TableCell>
                  <TableCell className="p-3 text-center">
                    {!e.completedAt && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMarking(e.personId)
                          markMutation.mutate({ path: { trainingId }, query: { organizationId: orgId }, body: { personId: e.personId, creditAmount: Number(creditAmount) } } as any)
                        }}
                        disabled={markMutation.isPending && marking === e.personId}
                      >
                        {markMutation.isPending && marking === e.personId ? 'Marking…' : 'Mark Complete'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
