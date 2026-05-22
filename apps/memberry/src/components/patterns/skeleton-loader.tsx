function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-[8px] animate-shimmer bg-[length:200%_100%] ${className ?? ""}`}
      style={{
        backgroundImage: "linear-gradient(90deg, var(--color-border-light) 0%, var(--color-surface) 50%, var(--color-border-light) 100%)",
        ...style,
      }}
    />
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bone className="h-[34px] w-[34px] !rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3.5" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <Bone className="h-3 w-[40%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-md border border-[var(--color-border-light)] p-5 space-y-3">
      <Bone className="h-4 w-[60%]" />
      <Bone className="h-8 w-[40%]" />
      <Bone className="h-3 w-[80%]" />
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Bone className="h-[120px] w-[120px] !rounded-full" />
      <Bone className="h-5 w-[200px]" />
      <Bone className="h-4 w-[150px]" />
      <div className="w-full space-y-3 mt-4">
        <Bone className="h-12 w-full rounded-md" />
        <Bone className="h-12 w-full rounded-md" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-md border border-[var(--color-border-light)] overflow-hidden">
      <div className="bg-[var(--color-surface-warm)] px-5 py-2.5 flex gap-5">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex gap-5 border-t border-[var(--color-border-light)]">
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
