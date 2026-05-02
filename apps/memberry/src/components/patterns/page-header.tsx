import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 mb-2 text-[13px] font-medium text-[var(--color-muted)]">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-[var(--color-primary)] transition-colors">{crumb.label}</a>
              ) : (
                <span className="text-[var(--color-text)] font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[26px] font-bold font-display leading-[1.2]">{title}</h1>
          {subtitle && <p className="text-[14px] text-[var(--color-muted)] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
