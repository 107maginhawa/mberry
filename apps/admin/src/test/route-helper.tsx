/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creates an inline router mock for use inside vi.hoisted().
 * Cannot use React imports since vi.hoisted runs before imports.
 * Link returns null; for link-href tests, override Link in the test.
 */

let _captured: any = null

export function createRouterMock() {
  _captured = null

  const routerMock = {
    createFileRoute: () => (opts: { component: any }) => {
      _captured = opts.component
      return { component: opts.component }
    },
    createRootRouteWithContext: () => () => ({}),
    Link: () => null,
    redirect: () => {},
    Outlet: () => null,
    useParams: () => ({}),
    useSearch: () => ({}),
    useNavigate: () => () => {},
  }

  const getComponent = () => {
    if (!_captured) throw new Error('No component captured from createFileRoute')
    return _captured
  }

  return { routerMock, getComponent }
}
