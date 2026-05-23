import type { ReactNode } from "react"
import { Link } from "@tanstack/react-router"

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
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[var(--color-muted)]">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span aria-hidden="true">/</span>}
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-[var(--color-primary)] transition-colors">{crumb.label}</Link>
              ) : (
                <span aria-current="page" className="text-[var(--color-text)] font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--color-muted)] mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
