import { useCallback } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { Button } from '@monobase/ui';

interface YesNoQuestionProps {
  value: boolean | null
  onChange: (value: boolean) => void
}

export function YesNoQuestion({ value, onChange }: YesNoQuestionProps) {
  const handleSelect = useCallback(
    (v: boolean) => onChange(v),
    [onChange],
  )

  return (
    <div className="flex justify-center gap-4">
      <Button
        type="button"
        onClick={() => handleSelect(true)}
        className={`flex items-center gap-3 px-8 py-5 rounded-[var(--radius-md)] text-lg font-semibold transition-all
          ${
            value === true
              ? 'bg-[var(--color-success-bg)] border-2 border-[var(--color-success)] text-[var(--color-success)] scale-105'
              : 'bg-[var(--color-surface-elevated)] border-2 border-[var(--color-surface-border-glass)] text-[var(--color-text)] hover:border-[var(--color-success)]'
          }`}
      >
        <ThumbsUp size={22} />
        Yes
      </Button>
      <Button
        type="button"
        onClick={() => handleSelect(false)}
        className={`flex items-center gap-3 px-8 py-5 rounded-[var(--radius-md)] text-lg font-semibold transition-all
          ${
            value === false
              ? 'bg-[var(--color-error-bg)] border-2 border-[var(--color-error)] text-[var(--color-error)] scale-105'
              : 'bg-[var(--color-surface-elevated)] border-2 border-[var(--color-surface-border-glass)] text-[var(--color-text)] hover:border-[var(--color-error)]'
          }`}
      >
        <ThumbsDown size={22} />
        No
      </Button>
    </div>
  )
}
