import { useCallback } from 'react'
import { Button } from '@monobase/ui';

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
      <div className="flex flex-wrap justify-center gap-2">
        {Array.from({ length: 11 }, (_, i) => (
          <Button
            key={i}
            type="button"
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
