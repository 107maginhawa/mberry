import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BarChart3, CheckCircle2, Clock } from 'lucide-react'
import { Button } from '@monobase/ui'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface PollOption {
  label: string
  votes: number
}

interface PollData {
  id: string
  title: string
  options: PollOption[]
  totalVotes: number
  deadline?: string | null
  hasVoted: boolean
  selectedOption?: string
  status: 'active' | 'closed'
}

interface PollCardProps {
  surveyId: string
  /** Compact mode for embedding in announcements */
  compact?: boolean
  /** Auto-refresh interval in ms (default: 5000 for active polls) */
  refreshInterval?: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

export function PollCard({ surveyId, compact, refreshInterval = 5000 }: PollCardProps) {
  const queryClient = useQueryClient()
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const { data: poll, isLoading } = useQuery({
    queryKey: ['poll', surveyId],
    queryFn: () => api.get<PollData>(`/api/surveys/${surveyId}`),
    refetchInterval: (query) => {
      const data = query.state.data
      return data?.status === 'active' ? refreshInterval : false
    },
  })

  const voteMut = useMutation({
    mutationFn: (option: string) =>
      api.post(`/api/surveys/${surveyId}/responses`, {
        answers: [{ questionId: 'q1', value: option }],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['poll', surveyId] })
      toast.success('Vote recorded')
    },
    onError: () => toast.error('Failed to vote'),
  })

  useEffect(() => {
    if (poll?.selectedOption) {
      setSelectedOption(poll.selectedOption)
    }
  }, [poll?.selectedOption])

  if (isLoading || !poll) {
    return (
      <div className="border rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-[var(--color-surface-warm)] rounded w-3/4 mb-3" />
        <div className="space-y-2">
          <div className="h-8 bg-[var(--color-surface-warm)] rounded" />
          <div className="h-8 bg-[var(--color-surface-warm)] rounded" />
          <div className="h-8 bg-[var(--color-surface-warm)] rounded" />
        </div>
      </div>
    )
  }

  const hasVoted = poll.hasVoted || voteMut.isSuccess
  const showResults = hasVoted || poll.status === 'closed'

  return (
    <div className={`border rounded-lg ${compact ? 'p-3' : 'p-4'} space-y-3`}>
      {/* Title */}
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-[var(--color-primary)]" />
        <p className={`font-medium ${compact ? 'text-sm' : ''}`}>{poll.title}</p>
      </div>

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const pct = poll.totalVotes > 0 ? Math.round((option.votes / poll.totalVotes) * 100) : 0
          const isSelected = selectedOption === option.label || poll.selectedOption === option.label

          if (showResults) {
            return (
              <div key={option.label} className="relative">
                <div
                  className={`relative z-10 flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                    isSelected
                      ? 'font-medium'
                      : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                    <span>{option.label}</span>
                  </div>
                  <span className="text-xs text-[var(--color-muted)]">
                    {option.votes} ({pct}%)
                  </span>
                </div>
                <div
                  className="absolute inset-0 rounded-lg bg-[var(--color-primary)] opacity-10 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            )
          }

          return (
            // ui-c-exempt: methodology-carry — poll-option selectable button styling
            <Button
              key={option.label}
              variant={selectedOption === option.label ? 'outline' : 'ghost'}
              className={`w-full justify-start text-sm py-2 ${
                selectedOption === option.label
                  ? 'border-[var(--color-primary)] bg-primary/5'
                  : 'border hover:border-[var(--color-primary)]'
              }`}
              onClick={() => setSelectedOption(option.label)}
              disabled={poll.status === 'closed' || voteMut.isPending}
            >
              {option.label}
            </Button>
          )
        })}
      </div>

      {/* Vote button + meta */}
      <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
        <span>{poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-2">
          {poll.deadline && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Closes {formatDate(poll.deadline)}
            </span>
          )}
          {!showResults && selectedOption && (
            <Button
              size="sm"
              onClick={() => voteMut.mutate(selectedOption)}
              disabled={voteMut.isPending}
            >
              {voteMut.isPending ? 'Voting...' : 'Vote'}
            </Button>
          )}
          {hasVoted && (
            <span className="text-[var(--color-success)] flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Voted
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
