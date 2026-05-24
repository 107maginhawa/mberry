import { useCallback } from 'react'
import { Button } from '@monobase/ui';

const NPS_ARIA_LABELS = [
  '0 - Not at all likely',
  '1 - Not likely',
  '2 - Not likely',
  '3 - Unlikely',
  '4 - Unlikely',
  '5 - Neutral',
  '6 - Somewhat likely',
  '7 - Likely',
  '8 - Likely',
  '9 - Very likely',
  '10 - Extremely likely',
] as const

interface NpsQuestionProps {
  value: number | null
  onChange: (value: number) => void
}

export function NpsQuestion({ value, onChange }: NpsQuestionProps) {
  const handleSelect = useCallback(
    (n: number) => onChange(n),
    [onChange],
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="NPS score from 0 to 10">
        {Array.from({ length: 11 }, (_, i) => (
          <Button
            key={i}
            type="button"
            role="radio"
            aria-checked={value === i}
            aria-label={NPS_ARIA_LABELS[i]}
            onClick={() => handleSelect(i)}
            className={`w-12 h-12 md:w-14 md:h-14 rounded-[var(--radius-md)] text-lg font-semibold transition-all
              ${
                value === i
                  ? 'bg-[var(--color-primary)] text-white shadow-md scale-105'
                  : 'bg-[var(--color-surface-elevated)] text-[var(--color-text)] hover:bg-[var(--color-surface-elevated-hover)] border border-[var(--color-surface-border-glass)]'
              }`}
          >
            {i}
          </Button>
        ))}
      </div>
      <div className="flex justify-between text-xs text-[var(--color-muted)] px-1">
        <span>Not at all likely</span>
        <span>Extremely likely</span>
      </div>
    </div>
  )
}
