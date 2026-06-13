/**
 * generated-route-integrity — unified platform-wide codegen guard (AHA F-2)
 *
 * ONE deterministic regression net (no DB / no live server) that locks the
 * three codegen invariants whose breakage produced the P-1 dropped-route-prefix
 * defect class (jobs, marketplace, advertising) and that guard the P1.5
 * `@extension`-driven middleware. It SUPERSEDES the need for any NEW per-module
 * prefix net (the existing `jobs-route-prefix.test.ts` and
 * `marketplace-advertising-route-prefix.test.ts` stay as targeted twins).
 *
 * Why this exists
 * ---------------
 * When a `main.tsp` re-export (`interface X extends NS.Y {}`) loses its
 * `@route("/association/...")` decorator, TypeSpec drops the source namespace's
 * route prefix and emits the operations at ROOT paths (e.g. `/postings`,
 * `/applications`). app.ts mounts `orgContextMiddleware()` on `/association/*`
 * only, so root-path routes silently bypass the tenant boundary → 500s on
 * org-scoped NOT NULL inserts and a cross-org write risk. The bug is invisible
 * at the call site; it only shows up in the GENERATED artifacts. This net reads
 * those artifacts directly and goes RED the instant any future regen
 * reintroduces the defect on ANY module — not just the three already fixed.
 *
 * The three invariants
 * --------------------
 *  1. PREFIX (primary): every OpenAPI path AND every routes.ts registration
 *     must start with one of the 25 SANCTIONED root segments. A dropped prefix
 *     emits a novel root segment → not in the set → RED.
 *  2. SOURCE: every `interface X extends NS.Y {}` re-export in main.tsp must
 *     carry an `@route(...)` decorator EXCEPT the ABSOLUTE_PATH_REEXPORTS
 *     allowlist (ops with no namespace prefix to drop). A new bare re-export
 *     (the exact jobs defect) → not allowlisted → RED.
 *  3. EXTENSION COVERAGE: every operation declaring an `x-audit` /
 *     `x-require-officer` / `x-require-position` extension in the OpenAPI spec
 *     must get its corresponding middleware emitted on its routes.ts
 *     registration — and no operation that did NOT declare the extension may
 *     carry the middleware (bidirectional: catches both a missing guard and a
 *     mis-attached one).
 *
 * The two allowlists below are the INTENTIONAL forcing functions. Adding a
 * legitimate new root prefix, or a new absolute-path re-export, requires a
 * conscious edit here — that edit is the human checkpoint that the change is
 * deliberate and not a dropped-prefix regression.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import openapi from '@monobase/api-spec/openapi.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_TS = resolve(__dirname, '../../generated/openapi/routes.ts');
const MAIN_TSP = resolve(__dirname, '../../../../../specs/api/src/main.tsp');

const routesSource = readFileSync(ROUTES_TS, 'utf-8');
const mainTspSource = readFileSync(MAIN_TSP, 'utf-8');

type OpenApiDoc = {
  paths: Record<string, Record<string, { operationId?: string } & Record<string, unknown>>>;
};
const openapiPaths = (openapi as OpenApiDoc).paths;
const openapiPathKeys = Object.keys(openapiPaths);

const HTTP_VERBS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);
// Hono registrations only ever use these verbs in the generated file.
const HONO_VERBS = 'get|post|put|patch|delete';

/**
 * SANCTIONED root prefixes — the complete set of first path segments any
 * generated route is allowed to live under. FORCING FUNCTION: a dropped
 * `@route` prefix produces a novel segment (e.g. `postings`, `vendors`) that is
 * absent here → the prefix tests go RED. Adding a genuinely new top-level
 * surface means consciously adding its segment to this list.
 */
const SANCTIONED_PREFIXES = new Set([
  'accredited-providers',
  'admin',
  'association',
  'audit',
  'billing',
  'booking',
  'certificates',
  'comms',
  'communications',
  'credit-compliance',
  'dues',
  'email',
  'invitations',
  'invite',
  'membership',
  'notifs',
  'officer-terms',
  'onboarding',
  'org',
  'pay',
  'persons',
  'public',
  'reviews',
  'storage',
  'surveys',
]);

/**
 * ABSOLUTE_PATH_REEXPORTS — main.tsp re-exports that legitimately OMIT
 * `@route`. These declare absolute-path operations (no source-namespace prefix
 * to inherit), so there is nothing to drop. FORCING FUNCTION: every OTHER bare
 * re-export must be one of these; a new bare re-export (the jobs defect shape)
 * is not listed here → the source test goes RED. Adding one legitimately is a
 * conscious edit confirming the omission is intentional.
 */
const ABSOLUTE_PATH_REEXPORTS = new Set([
  'AssocAnnouncementManagement',
  'DuesCustomManagement',
  'DuesMetricsManagement',
  'InviteManagement',
  'InviteTokenEndpoints',
  'MembershipCustomManagement',
  'OnboardingManagement',
  'PaymentLinkManagement',
  'PaymentTokenEndpoints',
  'PlatformAdminDashboardEndpoints',
  'PlatformAdminIdentityEndpoints',
  'PlatformPublicEndpoints',
  'PublicEventEndpoints',
  'ReceiptEndpoints',
  'StorageManagement',
]);

// The generated middleware identifier each extension maps to in routes.ts.
const AUDIT_MIDDLEWARE = 'createPerRouteAuditMiddleware';
const OFFICER_MIDDLEWARE = 'requireOfficerMiddleware';
const POSITION_MIDDLEWARE = 'requirePositionMiddleware';

// ---------------------------------------------------------------------------
// Pure helpers (proven against synthetic pre-fix defects during authoring).
// ---------------------------------------------------------------------------

const firstSegment = (path: string): string => path.split('/')[1] ?? '';

const novelSegments = (paths: string[], sanctioned: Set<string>): string[] =>
  [...new Set(paths.map(firstSegment))].filter((s) => !sanctioned.has(s)).sort();

type RouteBlock = {
  op: string | null;
  verb: string;
  path: string;
  audit: boolean;
  officer: boolean;
  position: boolean;
};

/**
 * Parse routes.ts into per-registration blocks. Each block runs from an
 * `app.<verb>('<path>', ...)` line to its closing `);`, and is keyed to its
 * operationId via the `registry.<op> as unknown as Handler` line. Records which
 * extension middlewares appear inside the block.
 */
const parseRouteBlocks = (src: string): RouteBlock[] => {
  const lines = src.split('\n');
  const start = new RegExp(`^\\s*app\\.(${HONO_VERBS})\\('([^']+)'`);
  const blocks: RouteBlock[] = [];
  for (let i = 0; i < lines.length; i++) {
    const ms = lines[i].match(start);
    if (!ms) continue;
    let body = lines[i];
    let j = i + 1;
    while (j < lines.length && !/^\s*\);\s*$/.test(lines[j])) {
      body += '\n' + lines[j];
      j++;
    }
    if (j < lines.length) body += '\n' + lines[j];
    const om = body.match(/registry\.(\w+)\s+as unknown as Handler/);
    blocks.push({
      op: om ? om[1] : null,
      verb: ms[1],
      path: ms[2],
      audit: body.includes(AUDIT_MIDDLEWARE),
      officer: body.includes(OFFICER_MIDDLEWARE),
      position: body.includes(POSITION_MIDDLEWARE),
    });
    i = j;
  }
  return blocks;
};

/** Names of `interface X extends NS.Y {}` re-exports in main.tsp lacking @route. */
const reExportsWithoutRoute = (tsp: string): string[] => {
  const lines = tsp.split('\n');
  const names: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const mm = lines[i].match(/interface\s+(\w+)\s+extends\s+([\w.]+)\s*\{\s*\}/);
    if (!mm) continue;
    let hasRoute = lines[i].includes('@route(');
    // @route may sit on the same line or on a preceding decorator/comment line.
    for (let j = i - 1; j >= Math.max(0, i - 5) && !hasRoute; j--) {
      const t = lines[j].trim();
      if (t.includes('@route(')) {
        hasRoute = true;
        break;
      }
      if (t === '' || t.startsWith('//') || t.startsWith('@') || t.startsWith('*') || t.startsWith('/*')) {
        continue;
      }
      break; // hit a real statement with no @route → bare re-export
    }
    if (!hasRoute) names.push(mm[1]);
  }
  return names.sort();
};

/** OpenAPI operationIds declaring a given `x-*` extension. */
const opsWithExtension = (ext: string): Set<string> => {
  const ids = new Set<string>();
  for (const p of openapiPathKeys) {
    for (const m of Object.keys(openapiPaths[p])) {
      if (!HTTP_VERBS.has(m)) continue;
      const op = openapiPaths[p][m];
      if (op && typeof op === 'object' && ext in op && op.operationId) ids.add(op.operationId);
    }
  }
  return ids;
};

const setMinus = (a: Set<string>, b: Set<string>): string[] => [...a].filter((x) => !b.has(x)).sort();

const ROUTE_BLOCKS = parseRouteBlocks(routesSource);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generated-route-integrity (AHA F-2 — unified codegen guard)', () => {
  // Sanity: a broken/empty read must not let the invariants pass vacuously.
  describe('artifacts loaded', () => {
    test('OpenAPI exposes paths', () => {
      expect(openapiPathKeys.length).toBeGreaterThan(0);
    });
    test('routes.ts registers Hono routes', () => {
      expect(ROUTE_BLOCKS.length).toBeGreaterThan(0);
    });
    test('every routes.ts registration resolves to an operationId (codegen format guard)', () => {
      const orphans = ROUTE_BLOCKS.filter((b) => !b.op).map((b) => `${b.verb.toUpperCase()} ${b.path}`);
      expect(orphans, `routes.ts registrations with no registry.<op> binding: ${orphans.join(', ')}`).toEqual([]);
    });
  });

  // Invariant 1 — PREFIX (primary P-1 / FIX-001 defect-class guard).
  describe('route-prefix invariant: no route escapes the 25 sanctioned root prefixes', () => {
    test('OpenAPI emits no path under a non-sanctioned root segment', () => {
      const novel = novelSegments(openapiPathKeys, SANCTIONED_PREFIXES);
      expect(
        novel,
        `OpenAPI emitted non-sanctioned root segment(s): ${novel.join(', ')} — a dropped @route prefix? Add the prefix to SANCTIONED_PREFIXES only if intentional.`,
      ).toEqual([]);
    });
    test('routes.ts registers no route under a non-sanctioned root segment', () => {
      const routePaths = ROUTE_BLOCKS.map((b) => '/' + firstSegment(b.path));
      const novel = novelSegments(routePaths, SANCTIONED_PREFIXES);
      expect(
        novel,
        `routes.ts registered non-sanctioned root segment(s): ${novel.join(', ')} — a dropped @route prefix bypasses orgContextMiddleware.`,
      ).toEqual([]);
    });
  });

  // Invariant 2 — SOURCE (catches the jobs defect at the TypeSpec source).
  describe('source invariant: main.tsp re-exports carry @route unless absolute-path', () => {
    test('every bare `interface X extends NS.Y {}` re-export is allowlisted', () => {
      const offenders = setMinus(new Set(reExportsWithoutRoute(mainTspSource)), ABSOLUTE_PATH_REEXPORTS);
      expect(
        offenders,
        `main.tsp re-export(s) missing @route and not in ABSOLUTE_PATH_REEXPORTS: ${offenders.join(', ')} — TypeSpec will drop the namespace route prefix and emit at ROOT paths.`,
      ).toEqual([]);
    });
  });

  // Invariant 3 — EXTENSION COVERAGE (P1.5 audit/officer/position middleware).
  describe('extension-coverage invariant: x-* declarations get their middleware', () => {
    const cases: Array<{ ext: string; mw: string; pick: (b: RouteBlock) => boolean }> = [
      { ext: 'x-audit', mw: AUDIT_MIDDLEWARE, pick: (b) => b.audit },
      { ext: 'x-require-officer', mw: OFFICER_MIDDLEWARE, pick: (b) => b.officer },
      { ext: 'x-require-position', mw: POSITION_MIDDLEWARE, pick: (b) => b.position },
    ];
    for (const c of cases) {
      const declared = opsWithExtension(c.ext);
      const emitted = new Set(ROUTE_BLOCKS.filter((b) => c.pick(b) && b.op).map((b) => b.op as string));

      test(`${c.ext}: every declaring op gets ${c.mw} (no missing guard)`, () => {
        const missing = setMinus(declared, emitted);
        expect(
          missing,
          `ops declaring ${c.ext} with no ${c.mw} in routes.ts: ${missing.join(', ')}`,
        ).toEqual([]);
      });

      test(`${c.ext}: no op carries ${c.mw} without declaring it (no spurious guard)`, () => {
        const spurious = setMinus(emitted, declared);
        expect(
          spurious,
          `ops carrying ${c.mw} in routes.ts without declaring ${c.ext}: ${spurious.join(', ')}`,
        ).toEqual([]);
      });
    }
  });
});
