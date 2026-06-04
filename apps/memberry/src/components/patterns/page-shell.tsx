import { Link } from "@tanstack/react-router"
import {
  PageShell as BasePageShell,
  type PageShellProps as BasePageShellProps,
} from "@monobase/ui"

export type PageShellProps = Omit<BasePageShellProps, "LinkComponent">

/**
 * Memberry's PageShell — pre-wires the @tanstack/react-router Link so route files
 * can pass `breadcrumbs` as plain data and still get SPA navigation. For raw access
 * (e.g. non-router breadcrumb scenarios), import `PageShell` from `@monobase/ui`
 * directly.
 */
export function PageShell(props: PageShellProps) {
  return <BasePageShell {...props} LinkComponent={Link as never} />
}
