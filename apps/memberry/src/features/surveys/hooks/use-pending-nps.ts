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
  myResponseStatus?: string | null
}

interface SurveyListResponse {
  data: NpsSurveyResponse[]
}

export function usePendingNps() {
  const { data, isLoading } = useQuery<SurveyListResponse>({
    queryKey: ['surveys', 'pending-nps'],
    queryFn: () => api.get<SurveyListResponse>('/api/surveys/?mine=true&available=true&surveyType=nps'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const surveys = data?.data ?? []
  // available-mode returns active surveys with myResponseStatus null when unanswered; filter to unanswered + not locally dismissed
  const firstPending = surveys.find((s) => (s.myResponseStatus == null) && !isDismissedLocally(s.id)) ?? null

  return {
    pendingNps: firstPending,
    isLoading,
  }
}
