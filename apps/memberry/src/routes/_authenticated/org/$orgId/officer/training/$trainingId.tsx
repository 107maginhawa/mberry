import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ArrowLeft, Calendar, MapPin, Globe, Users, Award, Edit2 } from 'lucide-react'
import { TrainingForm } from '@/features/training/components/training-form'
import { CompletionTable } from '@/features/training/components/completion-table'

export const Route = createFileRoute('/_authenticated/org/$orgId/officer/training/$trainingId')({
  component: TrainingDetail,
})

const TYPE_LABELS: Record<string, string> = {
  seminar: 'Seminar',
  workshop: 'Workshop',
  convention: 'Convention',
  online_course: 'Online Course',
  skills_training: 'Skills Training',
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  published: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'details' | 'edit' | 'attendance'

function TrainingDetail() {
  const { orgId, trainingId } = Route.useParams()
  const [tab, setTab] = useState<Tab>('details')

  const { data, isLoading, error } = useQuery({
    queryKey: ['training', trainingId],
    queryFn: async () => {
      const res = await fetch(`/api/training/detail/${trainingId}`)
      if (!res.ok) throw new Error('Failed to load training')
      return res.json() as Promise<{ data: any }>
    },
  })

  const training = data?.data

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-muted/30 rounded animate-pulse" />
        <div className="h-40 bg-muted/30 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !training) {
    return (
      <div className="p-6">
        <p className="text-destructive">Failed to load training.</p>
      </div>
    )
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'attendance', label: `Attendance (${training.attendance?.completed ?? 0})` },
    { key: 'edit', label: 'Edit' },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div>
        <a
          href={`/org/${orgId}/officer/training`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ArrowLeft className="w-4 h-4" /> Training
        </a>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{training.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {TYPE_LABELS[training.type] ?? training.type}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[training.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {training.status.replace('_', ' ')}
              </span>
              {Number(training.creditValue) > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                  <Award className="w-3 h-3" />
                  {training.creditValue} CPE
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setTab('edit')}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg hover:bg-muted shrink-0"
          >
            <Edit2 className="w-4 h-4" /> Edit
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'details' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-4">
            {training.description && (
              <div className="border rounded-xl p-5 bg-card">
                <h2 className="font-semibold mb-2">About</h2>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{training.description}</p>
              </div>
            )}

            {training.scheduleDescription && (
              <div className="border rounded-xl p-5 bg-card">
                <h2 className="font-semibold mb-2">Schedule</h2>
                <p className="text-sm text-muted-foreground">{training.scheduleDescription}</p>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="border rounded-xl p-5 bg-card space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">Start</p>
                  <p className="text-muted-foreground">{formatDate(training.startAt)}</p>
                  {training.endAt && (
                    <>
                      <p className="font-medium mt-1">End</p>
                      <p className="text-muted-foreground">{formatDate(training.endAt)}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                {training.locationType === 'online' ? (
                  <Globe className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                ) : (
                  <MapPin className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                )}
                <div>
                  <p className="font-medium capitalize">{training.locationType?.replace('_', '-')}</p>
                  {training.locationDetails?.venue && (
                    <p className="text-muted-foreground">{training.locationDetails.venue}</p>
                  )}
                  {training.locationDetails?.address && (
                    <p className="text-muted-foreground text-xs">{training.locationDetails.address}</p>
                  )}
                  {training.locationDetails?.meetingUrl && (
                    <a
                      href={training.locationDetails.meetingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary text-xs hover:underline"
                    >
                      Join Meeting
                    </a>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Users className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                <div>
                  <p className="font-medium">Enrollment</p>
                  <p className="text-muted-foreground">
                    {training.enrollmentCount ?? 0} enrolled
                    {training.capacity ? ` / ${training.capacity} capacity` : ' (unlimited)'}
                  </p>
                  <p className="text-muted-foreground capitalize text-xs">
                    Mode: {training.enrollmentMode?.replace('_', ' ')}
                  </p>
                </div>
              </div>

              {training.regulatoryApproval !== 'not_applicable' && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Regulatory</p>
                  <p className="font-medium text-xs">{training.regulatoryApproval?.replace('_', ' ')}</p>
                  {training.regulatoryReference && (
                    <p className="text-xs text-muted-foreground">{training.regulatoryReference}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <CompletionTable trainingId={trainingId} creditValue={training.creditValue} />
      )}

      {tab === 'edit' && (
        <TrainingForm orgId={orgId} trainingId={trainingId} initial={training} />
      )}
    </div>
  )
}
