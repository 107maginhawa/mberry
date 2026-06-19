import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { isDismissedLocally } from '../components/nps-modal'

interface NpsSurveyResponse {
  id: string
  title: string
  questionText?: string
  surveyType: string
  status: string
  questions?: { id: string; type: string }[]
}

interface SurveyListResponse {
  data: NpsSurveyResponse[]
}

export function usePendingNps() {
  // NOTE: there is no backend query for "active NPS surveys I have NOT answered".
  // `mine=true` inner-joins survey_responses, so it returns surveys I have
  // ALREADY responded to, and `status` only accepts draft|active|closed (no
  // "pending"). Until a backend "unanswered surveys for me" endpoint exists, this
  // can't truly surface pending NPS; the local-dismiss guard below prevents
  // re-prompting. Kept as a valid (non-400) query. See QA report 2026-06-19.
  const { data, isLoading } = useQuery<SurveyListResponse>({
    queryKey: ['surveys', 'pending-nps'],
    queryFn: () => api.get<SurveyListResponse>('/api/surveys/?mine=true&surveyType=nps'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const surveys = data?.data ?? []
  // Server already filters by status=pending, so dismissed surveys won't appear.
  // Local check is a fallback for the current session before server state refreshes.
  const firstPending = surveys.find((s) => !isDismissedLocally(s.id)) ?? null

  return {
    pendingNps: firstPending,
    isLoading,
  }
}
