import * as React from "react"
import { cn } from "../lib/utils"
import { PageContainer, type PageContainerWidth } from "./page-container"

export type PageShellSpacing = "compact" | "default" | "roomy"

const SPACING_CLASSES: Record<PageShellSpacing, string> = {
  compact: "py-3 md:py-4",
  default: "py-5 md:py-7",
  roomy: "py-8 md:py-12",
}

export interface PageShellBreadcrumb {
  label: string
  href?: string
}

/**
 * Minimal interface a router Link must satisfy. Lets PageShell stay router-agnostic
 * while consumers (apps using TanStack Router, Next, etc.) inject their own Link.
 */
export type PageShellLinkComponent = React.ComponentType<{
  to: string
  className?: string
  children: React.ReactNode
}>

export interface PageShellProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /**
   * Breadcrumb items. Rendered as plain anchor tags by default. For router-aware
   * navigation, pass `headerSlot` instead with your own router-Link breadcrumbs.
   */
  breadcrumbs?: PageShellBreadcrumb[]
  /** Right-aligned action buttons in the header row. */
  actions?: React.ReactNode
  /** Slot rendered ABOVE the title row (use for router-aware breadcrumbs or banners). */
  headerSlot?: React.ReactNode
  /** Max-width preset; forwarded to PageContainer. */
  maxWidth?: PageContainerWidth
  /** Vertical rhythm preset. Default: 'default' (`py-5 md:py-7`). */
  spacing?: PageShellSpacing
  /** When true, the header sticks to the top of the scroll container. */
  sticky?: boolean
  /** Render the page-title element as a different heading (default: h1). */
  titleAs?: "h1" | "h2"
  /**
   * Router Link component used for breadcrumb hrefs. When omitted, breadcrumbs render
   * as plain `<a>` tags (hard reload). Apps pass their router's Link to keep SPA
   * navigation: `<PageShell LinkComponent={Link} ... />`.
   */
  LinkComponent?: PageShellLinkComponent
}

export const PageShell = React.forwardRef<HTMLDivElement, PageShellProps>(
  (
    {
      title,
      subtitle,
      breadcrumbs,
      actions,
      headerSlot,
      maxWidth = "default",
      spacing = "default",
      sticky = false,
      titleAs: TitleTag = "h1",
      LinkComponent,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const hasDataBreadcrumbs = !!breadcrumbs && breadcrumbs.length > 0
    return (
      <PageContainer
        ref={ref}
        width={maxWidth}
        className={cn(SPACING_CLASSES[spacing], className)}
        {...props}
      >
        <div
          className={cn(
            "mb-6",
            sticky && "sticky top-0 z-10 bg-[var(--color-bg)]/95 backdrop-blur-sm py-2",
          )}
        >
          {headerSlot}
          {hasDataBreadcrumbs && (
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 mb-2 text-sm font-medium text-[var(--color-muted)]"
            >
              {breadcrumbs!.map((crumb, i) => (
                <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {crumb.href ? (
                    LinkComponent ? (
                      <LinkComponent
                        to={crumb.href}
                        className="hover:text-[var(--color-primary)] transition-colors"
                      >
                        {crumb.label}
                      </LinkComponent>
                    ) : (
                      <a
                        href={crumb.href}
                        className="hover:text-[var(--color-primary)] transition-colors"
                      >
                        {crumb.label}
                      </a>
                    )
                  ) : (
                    <span
                      aria-current="page"
                      className="text-[var(--color-text)] font-semibold"
                    >
                      {crumb.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <TitleTag className="text-title">{title}</TitleTag>
              {subtitle && (
                <p className="text-caption text-[var(--color-muted)] mt-1">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
          </div>
        </div>
        {children}
      </PageContainer>
    )
  },
)
PageShell.displayName = "PageShell"
