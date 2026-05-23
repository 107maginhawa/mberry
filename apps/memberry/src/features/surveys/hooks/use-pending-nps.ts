import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { isDismissed } from '../components/nps-modal'

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
  const firstPending = surveys.find((s) => !isDismissed(s.id)) ?? null

  return {
    pendingNps: firstPending,
    isLoading,
  }
}
