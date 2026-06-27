// apps/console/src/routes/__root.tsx — minimal, replaced in Task 2.
import { createRootRoute, Outlet } from '@tanstack/react-router'
export const Route = createRootRoute({ component: () => <Outlet /> })
