function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-muted animate-pulse ${className ?? ''}`}
    />
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-3">
      <Bone className="h-4 w-[60%]" />
      <Bone className="h-8 w-[40%]" />
      <Bone className="h-3 w-[80%]" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="p-4">
              <Bone className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 space-y-2">
      <Bone className="h-3 w-[50%]" />
      <Bone className="h-8 w-[30%]" />
    </div>
  )
}
