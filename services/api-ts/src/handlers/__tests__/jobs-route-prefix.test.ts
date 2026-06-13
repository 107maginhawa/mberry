/**
 * jobs-route-prefix — org-context reachability invariant (AHA FIX-001 jobs / P-1)
 *
 * Root cause (twin of the marketplace/advertising D-11 defect): the Jobs module
 * interfaces are re-exported in specs/api/src/main.tsp
 * (`interface JobsJobPostingManagement extends JobsModule.JobBoardPostingManagement {}`,
 * `interface JobsJobApplicationManagement extends JobsModule.JobBoardApplicationManagement {}`)
 * WITHOUT an `@route("/association/jobs")` decorator. Every other association
 * module's re-export carries one (e.g. `@route("/association/marketplace")`).
 * Without it, TypeSpec drops the source namespace's `@route("/association/jobs")`
 * prefix and emits the operations at ROOT paths (`/postings`, `/applications`,
 * `/postings/{postingId}`, `/applications/{applicationId}`).
 *
 * app.ts mounts `orgContextMiddleware()` on `/association/*` only. Root-path
 * routes therefore never pass through the tenant-context boundary; the
 * org-scoped `job_posting.organization_id` (NOT NULL) is left to body-supplied
 * input with no membership guard → 500 on org-less inserts and a cross-org
 * write risk.
 *
 * This test is a deterministic regression net (no DB / no live server). It
 * proves — in BOTH the generated OpenAPI spec AND the generated Hono route
 * registrations (routes.ts) — that every jobs operation lives under
 * `/association/jobs/*`, i.e. inside the org-context middleware boundary. It
 * also proves none of those operations leak back to the root namespace.
 *
 * If a future spec/codegen change drops the prefix again, this test goes RED.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import openapi from '@monobase/api-spec/openapi.json';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROUTES_TS = resolve(__dirname, '../../generated/openapi/routes.ts');
const routesSource = readFileSync(ROUTES_TS, 'utf-8');

const openapiPaths = Object.keys((openapi as { paths: Record<string, unknown> }).paths);

// Every operation defined in jobs.tsp, with the org-context-scoped path it MUST
// be reachable at, and the Hono-style path (':' params) that routes.ts must
// register.
const JOBS_PREFIX = '/association/jobs';

const EXPECTED = [
  // job postings
  { op: 'createJobPosting', method: 'post', openapi: `${JOBS_PREFIX}/postings`, hono: `'${JOBS_PREFIX}/postings'` },
  { op: 'searchJobPostings', method: 'get', openapi: `${JOBS_PREFIX}/postings`, hono: `'${JOBS_PREFIX}/postings'` },
  { op: 'getJobPosting', method: 'get', openapi: `${JOBS_PREFIX}/postings/{postingId}`, hono: `'${JOBS_PREFIX}/postings/:postingId'` },
  { op: 'updateJobPosting', method: 'patch', openapi: `${JOBS_PREFIX}/postings/{postingId}`, hono: `'${JOBS_PREFIX}/postings/:postingId'` },
  { op: 'deleteJobPosting', method: 'delete', openapi: `${JOBS_PREFIX}/postings/{postingId}`, hono: `'${JOBS_PREFIX}/postings/:postingId'` },
  // job applications
  { op: 'createJobApplication', method: 'post', openapi: `${JOBS_PREFIX}/applications`, hono: `'${JOBS_PREFIX}/applications'` },
  { op: 'updateJobApplication', method: 'patch', openapi: `${JOBS_PREFIX}/applications/{applicationId}`, hono: `'${JOBS_PREFIX}/applications/:applicationId'` },
] as const;

// Root-level paths that MUST NOT exist (would bypass org-context middleware).
const FORBIDDEN_ROOT_PATHS = [
  '/postings',
  '/applications',
];

describe('jobs routes are org-context scoped (FIX-001 jobs / P-1)', () => {
  describe('OpenAPI spec emits the /association/jobs prefix', () => {
    for (const e of EXPECTED) {
      test(`${e.op} → ${e.method.toUpperCase()} ${e.openapi}`, () => {
        const item = (openapi as { paths: Record<string, Record<string, { operationId?: string }>> }).paths[e.openapi];
        expect(item, `OpenAPI is missing path ${e.openapi}`).toBeDefined();
        expect(item[e.method]?.operationId).toBe(e.op);
      });
    }
  });

  describe('generated Hono routes register under the /association/jobs prefix', () => {
    for (const e of EXPECTED) {
      test(`${e.op} → app.${e.method}(${e.hono})`, () => {
        const needle = `app.${e.method}(${e.hono}`;
        expect(
          routesSource.includes(needle),
          `routes.ts does not register ${needle}`,
        ).toBe(true);
      });
    }
  });

  describe('no jobs operation leaks to a root path', () => {
    for (const p of FORBIDDEN_ROOT_PATHS) {
      test(`OpenAPI has no root path ${p}`, () => {
        expect(openapiPaths).not.toContain(p);
      });
      test(`OpenAPI has no root sub-path under ${p}`, () => {
        const leaks = openapiPaths.filter((k) => k === p || k.startsWith(`${p}/`));
        expect(leaks, `OpenAPI leaks root path(s): ${leaks.join(', ')}`).toEqual([]);
      });
      test(`routes.ts does not register a root path ${p}`, () => {
        // Match `app.<verb>('/postings` at the start of the Hono path arg
        // (covers `/postings` and `/postings/:postingId`), but NOT the
        // prefixed `'/association/jobs/postings'`.
        const leak = new RegExp(`app\\.(get|post|patch|put|delete)\\('${p.replace(/[/]/g, '\\$&')}`);
        expect(routesSource).not.toMatch(leak);
      });
    }
  });
});
