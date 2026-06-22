import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart3, MessageSquare, ChevronLeft, ChevronRight, Download, ShieldAlert } from 'lucide-react'
import { Skeleton, Tabs, TabsList, TabsTrigger } from '@monobase/ui'
import { Button } from '@monobase/ui'
import type { Survey as ApiSurvey } from '@monobase/sdk-ts/generated/types.gen'
import { api } from '@/lib/api'
import { NpsGauge } from './nps-gauge'

interface QuestionResult {
  id: string
  type: 'nps' | 'rating' | 'single_choice' | 'multi_choice' | 'text' | 'yes_no'
  text: string
  required: boolean
  sortOrder: number
  responses: number
  // NPS-specific
  npsScore?: number
  npsBreakdown?: { promoters: number; passives: number; detractors: number }
  // Rating-specific
  ratingAvg?: number
  ratingDistribution?: Record<string, number>
  // Choice-specific
  choiceDistribution?: Record<string, number>
  // Text responses
  textResponses?: string[]
  // Yes/No
  yesNoDistribution?: { yes: number; no: number }
}

interface SurveyDetail {
  id: string
  title: string
  description?: string
  surveyType: string
  status: string
  // BR-40 / R1-1: anonymity is nested under settings (not flat). The type is
  // DERIVED from the generated API contract so a backend shape change breaks
  // typecheck instead of silently never firing (the old flat read did exactly that).
  settings?: ApiSurvey['settings']
  responseCount?: number
  questions: QuestionResult[]
}

interface IndividualResponse {
  id: string
  respondentName?: string
  submittedAt: string
  answers: { questionId: string; questionText: string; value: string }[]
}

type TabView = 'analytics' | 'responses'

const PAGE_SIZE = 10

interface SurveyResultsProps {
  orgId: string
  surveyId: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RatingBars({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const labels = ['5', '4', '3', '2', '1']
  return (
    <div className="space-y-1.5">
      {labels.map((label) => {
        const count = distribution[label] ?? 0
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className="w-4 text-right text-xs text-[var(--color-muted)]">{label}</span>
            <div className="flex-1 bg-[var(--color-surface-warm)] rounded-full h-4 overflow-hidden">
              <div
                className="bg-[var(--color-primary)] h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-[var(--color-muted)] w-12 text-right">
              {count} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

function ChoiceBars({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const sorted = Object.entries(distribution).sort(([, a], [, b]) => b - a)
  return (
    <div className="space-y-1.5">
      {sorted.map(([label, count]) => {
        const pct = total > 0 ? Math.round((count / total) * 100) : 0
        return (
          <div key={label} className="flex items-center gap-2 text-sm">
            <span className="w-32 truncate text-xs">{label}</span>
            <div className="flex-1 bg-[var(--color-surface-warm)] rounded-full h-4 overflow-hidden">
              <div
                className="bg-[var(--color-primary)] h-full rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-[var(--color-muted)] w-12 text-right">
              {count} ({pct}%)
            </span>
          </div>
        )
      })}
    </div>
  )
}

function YesNoBars({ yes, no }: { yes: number; no: number }) {
  const total = yes + no
  const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0
  const noPct = total > 0 ? Math.round((no / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span className="w-8 text-xs">Yes</span>
        <div className="flex-1 bg-[var(--color-surface-warm)] rounded-full h-4 overflow-hidden">
          <div
            className="bg-[var(--color-success)] h-full rounded-full transition-all"
            style={{ width: `${yesPct}%` }}
          />
        </div>
        <span className="text-xs text-[var(--color-muted)] w-12 text-right">
          {yes} ({yesPct}%)
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="w-8 text-xs">No</span>
        <div className="flex-1 bg-[var(--color-surface-warm)] rounded-full h-4 overflow-hidden">
          <div
            className="bg-[var(--color-error)] h-full rounded-full transition-all"
            style={{ width: `${noPct}%` }}
          />
        </div>
        <span className="text-xs text-[var(--color-muted)] w-12 text-right">
          {no} ({noPct}%)
        </span>
      </div>
    </div>
  )
}

function downloadCsv(surveyId: string, title: string) {
  const url = `/api/surveys/${surveyId}/export?format=csv`
  const a = document.createElement('a')
  a.href = url
  a.download = `${title.replace(/[^a-zA-Z0-9]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function SurveyResults({ orgId, surveyId }: SurveyResultsProps) {
  const [tab, setTab] = useState<TabView>('analytics')
  const [responsePage, setResponsePage] = useState(0)

  const { data: survey, isLoading, isError, error } = useQuery({
    queryKey: ['survey', surveyId],
    queryFn: () => api.get<SurveyDetail>(`/api/surveys/${surveyId}`),
  })

  // Always enabled: `total` is the authoritative response count (GET
  // /surveys/{id} doesn't return one), used for the header count, the tab
  // label, and the BR-40 small-pool warning — not just the Responses tab.
  const { data: responsesData, isLoading: responsesLoading } = useQuery({
    queryKey: ['survey-responses', surveyId, responsePage],
    queryFn: () =>
      api.get<{ data: IndividualResponse[]; pagination: { totalCount: number; totalPages: number } }>(
        `/api/surveys/${surveyId}/responses?offset=${responsePage * PAGE_SIZE}&limit=${PAGE_SIZE}`,
      ),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 rounded" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="p-4 rounded-lg bg-[var(--color-error-bg)] text-[var(--color-error)] text-sm">
        Unable to load survey results. Please try refreshing the page.
      </div>
    )
  }

  if (error || !survey) {
    return (
      <div className="border rounded-lg p-12 text-center text-[var(--color-error)]">
        Failed to load survey results
      </div>
    )
  }

  // The list endpoint returns the count under pagination.totalCount (not a flat
  // `total`); reading it flat silently yielded 0 before, leaving the count and
  // the BR-40 small-pool warning dead.
  const totalResponses = responsesData?.pagination?.totalCount ?? survey.responseCount ?? 0
  const totalPages = responsesData?.pagination?.totalPages ?? 0
  const anonymous = survey.settings?.anonymous === true

  // BR-40 edge case: an anonymous survey with a very small response pool
  // (<10) risks re-identification by inference, even though the platform
  // stores no identity. Warn the creator. Skip at 0 responses — nothing to
  // infer yet.
  const showSmallPoolWarning = anonymous && totalResponses >= 1 && totalResponses < 10

  return (
    <div className="space-y-6">
      {/* BR-40: small-pool anonymity inference warning (creator-facing) */}
      {showSmallPoolWarning && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-bg)] p-3 text-sm text-[var(--color-warning)]"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Only {totalResponses} response{totalResponses !== 1 ? 's' : ''} so far. With fewer than 10
            responses, members may be re-identifiable by inference even though their identity is not
            stored. Consider waiting for more responses before sharing results.
          </span>
        </div>
      )}

      {/* Survey header */}
      <div className="border rounded-lg p-4">
        <h2 className="font-semibold text-lg">{survey.title}</h2>
        {survey.description && (
          <p className="text-sm text-[var(--color-muted)] mt-1">{survey.description}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-muted)]">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-medium">{totalResponses} response{totalResponses !== 1 ? 's' : ''}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--color-info-bg)] text-[var(--color-info)] font-medium">
              {survey.surveyType}
            </span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded font-medium ${
                survey.status === 'active'
                  ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
                  : survey.status === 'closed'
                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {survey.status}
            </span>
            {anonymous && (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                Anonymous
              </span>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv(surveyId, survey.title)}
            className="ml-auto gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as TabView)}>
        <TabsList>
          <TabsTrigger value="analytics" className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="responses" className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Responses ({totalResponses})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Analytics tab */}
      {tab === 'analytics' && (
        <div className="space-y-6">
          {survey.questions.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-[var(--color-muted)]">
              No questions in this survey
            </div>
          ) : (
            survey.questions
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((q, i) => (
                <div key={q.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-[var(--color-muted)]">Q{i + 1}</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-warm)] text-[var(--color-muted)]">
                      {q.type.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-[var(--color-muted)]">
                      {q.responses} response{q.responses !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="font-medium text-sm">{q.text}</p>

                  {/* NPS */}
                  {q.type === 'nps' && q.npsBreakdown && (
                    <NpsGauge
                      score={q.npsScore ?? 0}
                      promoters={q.npsBreakdown.promoters}
                      passives={q.npsBreakdown.passives}
                      detractors={q.npsBreakdown.detractors}
                    />
                  )}

                  {/* Rating */}
                  {q.type === 'rating' && q.ratingDistribution && (
                    <div className="space-y-2">
                      <p className="text-2xl font-bold font-display">
                        {q.ratingAvg?.toFixed(1) ?? '—'}
                        <span className="text-sm font-normal text-[var(--color-muted)]"> / 5</span>
                      </p>
                      <RatingBars distribution={q.ratingDistribution} total={q.responses} />
                    </div>
                  )}

                  {/* Choice */}
                  {(q.type === 'single_choice' || q.type === 'multi_choice') &&
                    q.choiceDistribution && (
                      <ChoiceBars distribution={q.choiceDistribution} total={q.responses} />
                    )}

                  {/* Yes/No */}
                  {q.type === 'yes_no' && q.yesNoDistribution && (
                    <YesNoBars yes={q.yesNoDistribution.yes} no={q.yesNoDistribution.no} />
                  )}

                  {/* Text responses */}
                  {q.type === 'text' && q.textResponses && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {q.textResponses.length === 0 ? (
                        <p className="text-sm text-[var(--color-muted)]">No text responses</p>
                      ) : (
                        q.textResponses.map((resp, ri) => (
                          <div
                            key={ri}
                            className="bg-[var(--color-surface-warm)] rounded-lg p-3 text-sm"
                          >
                            {resp}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* Responses tab */}
      {tab === 'responses' && (
        <div className="space-y-4">
          {responsesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg" />
              ))}
            </div>
          ) : !responsesData || responsesData.data.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-[var(--color-muted)]">
              No responses yet
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[var(--color-surface-warm)]">
                      <th className="text-left p-3 font-medium">#</th>
                      {!anonymous && (
                        <th className="text-left p-3 font-medium">Respondent</th>
                      )}
                      <th className="text-left p-3 font-medium">Submitted</th>
                      {survey.questions.slice(0, 3).map((q) => (
                        <th key={q.id} className="text-left p-3 font-medium truncate max-w-[150px]">
                          {q.text}
                        </th>
                      ))}
                      {survey.questions.length > 3 && (
                        <th className="text-left p-3 font-medium">...</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {responsesData.data.map((resp, i) => (
                      <tr
                        key={resp.id}
                        className="border-t hover:bg-[var(--color-surface-warm)] transition-colors"
                      >
                        <td className="p-3 text-[var(--color-muted)]">
                          {responsePage * PAGE_SIZE + i + 1}
                        </td>
                        {!anonymous && (
                          <td className="p-3">{resp.respondentName ?? 'Anonymous'}</td>
                        )}
                        <td className="p-3 text-[var(--color-muted)]">
                          {formatDate(resp.submittedAt)}
                        </td>
                        {survey.questions.slice(0, 3).map((q) => {
                          const answer = resp.answers.find((a) => a.questionId === q.id)
                          return (
                            <td key={q.id} className="p-3 truncate max-w-[150px]">
                              {answer?.value ?? '\u2014'}
                            </td>
                          )
                        })}
                        {survey.questions.length > 3 && (
                          <td className="p-3 text-[var(--color-muted)]">
                            +{survey.questions.length - 3} more
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[var(--color-muted)]">
                    Page {responsePage + 1} of {totalPages} ({totalResponses} total)
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setResponsePage((p) => Math.max(0, p - 1))}
                      disabled={responsePage === 0}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setResponsePage((p) => Math.min(totalPages - 1, p + 1))}
                      disabled={responsePage >= totalPages - 1}
                      aria-label="Next page"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
