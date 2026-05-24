import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { isDismissedLocally } from '../components/nps-modal'

interface NpsSurveyResponse {
  id: string
  title: string
  questionText?: string
  surveyType: string
  status: string
}

interface SurveyListResponse {
  data: NpsSurveyResponse[]
}

export function usePendingNps() {
  const { data, isLoading } = useQuery<SurveyListResponse>({
    queryKey: ['surveys', 'pending-nps'],
    queryFn: () => api.get<SurveyListResponse>('/surveys?mine=true&status=pending&surveyType=nps'),
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
