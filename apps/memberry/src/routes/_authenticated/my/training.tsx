import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Award, Calendar, BookOpen, CheckCircle } from 'lucide-react'
import { listMyCustomTrainingsOptions, searchTrainingsOptions } from '@monobase/sdk-ts/generated/react-query'

export const Route = createFileRoute('/_authenticated/my/training')({
  component: MyTraining,
})

const STATUS_STYLES: Record<string, string> = {
  enrolled: 'bg-green-100 text-green-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  pending_payment: 'bg-orange-100 text-orange-700',
  waitlisted: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

const TRAINING_STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

function MyTraining() {
  const { data, isLoading, error } = useQuery(
    listMyCustomTrainingsOptions()
  )

  // Network-wide trainings available for discovery (SO-9)
  const { data: availableData } = useQuery({
    ...searchTrainingsOptions({ query: { status: 'published' } }),
  })

  const items: Array<{ enrollment: any; training: any }> = (data as any)?.data ?? []

  const totalCredits = items.reduce((acc, item) => {
    const isCompleted = item.enrollment?.status === 'enrolled' // In reality would check attendance
    return acc + (isCompleted ? Number(item.training?.creditAmount ?? 0) : 0)
  }, 0)

  const enrolled = items.filter((i) => i.enrollment?.status === 'enrolled').length
  const pending = items.filter((i) => ['pending_approval', 'pending_payment', 'waitlisted'].includes(i.enrollment?.status)).length

  const statCards = [
    { label: 'Enrolled', value: enrolled, icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Pending', value: pending, icon: Calendar, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: 'CPE Credits', value: totalCredits.toFixed(1), icon: Award, color: 'text-amber-600', bg: 'bg-amber-100' },
    { label: 'Completed', value: items.filter((i) => i.enrollment?.status === 'enrolled').length, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100' },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">My Training</h1>
        <p className="text-sm text-muted-foreground">Training sessions and courses you&apos;re enrolled in</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="border rounded-xl p-4 bg-card flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : error || items.length === 0 ? (
        <div className="border rounded-xl p-12 text-center text-muted-foreground">
          No training sessions yet. Browse available trainings and enroll.
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Training</th>
                <th className="text-left p-3 font-medium">Type</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Credits</th>
                <th className="text-left p-3 font-medium">Enrollment</th>
                <th className="text-left p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.enrollment.id} className="border-t hover:bg-muted/20">
                  <td className="p-3">
                    <p className="font-medium line-clamp-1">{item.training.title}</p>
                  </td>
                  <td className="p-3 text-muted-foreground capitalize">
                    {item.training.type?.replace('_', ' ')}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {formatDate(item.training.startDate)}
                  </td>
                  <td className="p-3">
                    {Number(item.training.creditAmount) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Award className="w-3 h-3" />
                        {item.training.creditAmount} CPE
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[item.enrollment.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {item.enrollment.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TRAINING_STATUS_STYLES[item.training.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {item.training.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Network-wide available trainings (SO-9: cross-org promotion) */}
      {((availableData as any)?.data ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-3">Available Trainings</h2>
          <p className="text-sm text-muted-foreground mb-4">Network-wide trainings from across all organizations</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {((availableData as any)?.data ?? []).slice(0, 6).map((t: any) => (
              <div key={t.id} className="border rounded-xl p-4 bg-card hover:shadow-sm transition-shadow">
                <p className="font-semibold line-clamp-1">{t.title}</p>
                <p className="text-xs text-muted-foreground mt-1 capitalize">{t.type?.replace('_', ' ')}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{formatDate(t.startDate ?? t.startAt)}</span>
                  {Number(t.creditAmount ?? t.creditValue ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      <Award className="w-3 h-3" />
                      {t.creditAmount ?? t.creditValue} CPE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
