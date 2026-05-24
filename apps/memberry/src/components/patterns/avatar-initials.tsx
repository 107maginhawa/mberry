const SIZES = {
  sm: { container: "h-[34px] w-[34px]", text: "text-xs" },
  md: { container: "h-[42px] w-[42px]", text: "text-base" },
  lg: { container: "h-[56px] w-[56px]", text: "text-[22px]" },
} as const

const BG_COLORS = [
  "bg-[var(--color-primary)]",
  "bg-[var(--color-primary-mid)]",
  "bg-[var(--color-primary-light)]",
] as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return "?"
  if (parts.length === 1) return parts[0]![0]!.toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

interface AvatarInitialsProps {
  name: string
  size?: "sm" | "md" | "lg"
  photoUrl?: string | null
  statusRing?: "success" | "warning" | "error" | "info"
}

export function AvatarInitials({ name, size = "sm", photoUrl, statusRing }: AvatarInitialsProps) {
  const sizeConfig = SIZES[size]
  const bgIndex = name.length % BG_COLORS.length

  const ringClasses: Record<string, string> = {
    success: "ring-[3px] ring-offset-2 ring-[var(--color-success)]",
    warning: "ring-[3px] ring-offset-2 ring-[var(--color-warning)]",
    error: "ring-[3px] ring-offset-2 ring-[var(--color-error)]",
    info: "ring-[3px] ring-offset-2 ring-[var(--color-info)]",
  }
  const ringClass = statusRing ? ringClasses[statusRing] ?? "" : ""

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeConfig.container} rounded-full object-cover ${ringClass}`}
      />
    )
  }

  return (
    <div
      className={`${sizeConfig.container} ${BG_COLORS[bgIndex]} rounded-full flex items-center justify-center ${ringClass}`}
    >
      <span className={`${sizeConfig.text} font-display font-bold text-white`}>
        {getInitials(name)}
      </span>
    </div>
  )
}
