import { Link } from "@tanstack/react-router"
import {
  PageShell as BasePageShell,
  type PageShellProps as BasePageShellProps,
} from "@monobase/ui"

export type PageShellProps = Omit<BasePageShellProps, "LinkComponent">

/**
 * Admin app's PageShell — pre-wires the @tanstack/react-router Link so route files
 * can pass `breadcrumbs` as plain data and still get SPA navigation.
 */
export function PageShell(props: PageShellProps) {
  return <BasePageShell {...props} LinkComponent={Link as never} />
}
