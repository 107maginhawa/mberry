interface NpsGaugeProps {
  score: number
  promoters: number
  passives: number
  detractors: number
}

function getScoreColor(score: number): string {
  if (score < 0) return 'text-[var(--color-error)]'
  if (score <= 50) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-success)]'
}

function getScoreBg(score: number): string {
  if (score < 0) return 'bg-[var(--color-error-bg)]'
  if (score <= 50) return 'bg-[var(--color-warning-bg)]'
  return 'bg-[var(--color-success-bg)]'
}

function getScoreLabel(score: number): string {
  if (score < 0) return 'Needs Improvement'
  if (score <= 30) return 'Good'
  if (score <= 50) return 'Great'
  if (score <= 70) return 'Excellent'
  return 'World-Class'
}

export function NpsGauge({ score, promoters, passives, detractors }: NpsGaugeProps) {
  const total = promoters + passives + detractors
  const pPct = total > 0 ? Math.round((promoters / total) * 100) : 0
  const paPct = total > 0 ? Math.round((passives / total) * 100) : 0
  const dPct = total > 0 ? Math.round((detractors / total) * 100) : 0

  return (
    <div className="border rounded-xl p-6 space-y-4">
      {/* Score display */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-[var(--color-muted)] font-medium mb-1">
          NPS Score
        </p>
        <p className={`text-5xl font-bold font-display ${getScoreColor(score)}`}>
          {score > 0 ? '+' : ''}{score}
        </p>
        <span
          className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${getScoreBg(score)} ${getScoreColor(score)}`}
        >
          {getScoreLabel(score)}
        </span>
      </div>

      {/* Distribution bar */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex rounded-full overflow-hidden h-3">
            {dPct > 0 && (
              <div
                className="bg-[var(--color-error)] transition-all"
                style={{ width: `${dPct}%` }}
                title={`Detractors: ${dPct}%`}
              />
            )}
            {paPct > 0 && (
              <div
                className="bg-[var(--color-warning)] transition-all"
                style={{ width: `${paPct}%` }}
                title={`Passives: ${paPct}%`}
              />
            )}
            {pPct > 0 && (
              <div
                className="bg-[var(--color-success)] transition-all"
                style={{ width: `${pPct}%` }}
                title={`Promoters: ${pPct}%`}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-error)]" />
              <span className="text-[var(--color-muted)]">
                Detractors <span className="font-medium text-[var(--color-text)]">{detractors}</span>{' '}
                ({dPct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-warning)]" />
              <span className="text-[var(--color-muted)]">
                Passives <span className="font-medium text-[var(--color-text)]">{passives}</span>{' '}
                ({paPct}%)
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-success)]" />
              <span className="text-[var(--color-muted)]">
                Promoters <span className="font-medium text-[var(--color-text)]">{promoters}</span>{' '}
                ({pPct}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {total === 0 && (
        <p className="text-center text-sm text-[var(--color-muted)]">No responses yet</p>
      )}
    </div>
  )
}
