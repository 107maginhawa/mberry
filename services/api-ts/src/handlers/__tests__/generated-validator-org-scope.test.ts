/**
 * generated-validator-org-scope — AHA F-3 / P-2 / R-6 generator org-id guard
 *
 * Locks the org-id validator-emission invariants the cross-cutting audit (05
 * P-2 / 06 R-6) surfaced, AFTER the Step-A trace established the correct
 * required-vs-optional split (see
 * docs/aha/module-fix-plans/cross-cutting-platform-fix-report.md §Trace):
 *
 *  - PATH-param org-id (cross-org admin / national / accredited-provider
 *    routes — 39 ops, e.g. GET /admin/organizations/{organizationId}) is the
 *    ONLY "org id MUST be present in the request" class → it must be
 *    NON-optional. A path parameter is structurally always present (the route
 *    cannot match without it), so the generator must NEVER emit `.optional()`
 *    for ANY path param. This closes the latent bug class where a future
 *    TypeSpec slip marks a path param `required: false` and the generated Zod
 *    silently lets a structurally-present id be skippable.
 *
 *  - QUERY org-id filters (list/search) and `*UpdateSchema` PATCH partial
 *    bodies CORRECTLY stay optional. Org presence on those routes is enforced
 *    by `orgContextMiddleware` (the sole org-presence authority — app.ts mounts
 *    it on `/association/*`); the handlers read `ctx.get('organizationId')`,
 *    NOT the validator field (verified: listMemberships/listDuesInvoices/
 *    listElections/listPositions/listMembershipApplications/listListings/
 *    getMyCredits use ctx.get; searchEvents/getMyPrivacySettings treat absent
 *    org-id as "no filter / global"). Flipping these to required would be a
 *    contract regression with NO security gain — so they must remain optional.
 *
 * Two layers:
 *   1. UNIT — convertParameterToZod(): path param never optional; query param
 *      optional-when-not-required preserved (genuinely-optional unchanged).
 *   2. INTEGRATION — assert the generated validators.ts reflects the invariant
 *      so a future regen cannot silently regress it.
 */
import { describe, test, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { convertParameterToZod } from '../../../scripts/generate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VALIDATORS = readFileSync(
  resolve(__dirname, '../../generated/openapi/validators.ts'),
  'utf-8',
);

describe('F-3 convertParameterToZod path-param / org-id invariant (unit)', () => {
  test('path-param org-id is NEVER optional even when required:false', () => {
    const z = convertParameterToZod({
      name: 'organizationId',
      in: 'path',
      required: false,
      schema: { type: 'string', format: 'uuid' },
    });
    expect(z).not.toContain('.optional()');
    expect(z).toBe('z.string().uuid()');
  });

  test('path-param org-id with required:true stays non-optional', () => {
    const z = convertParameterToZod({
      name: 'organizationId',
      in: 'path',
      required: true,
      schema: { type: 'string', format: 'uuid' },
    });
    expect(z).not.toContain('.optional()');
  });

  test('generic path param never optional (structural invariant)', () => {
    const z = convertParameterToZod({
      name: 'providerId',
      in: 'path',
      required: false,
      schema: { type: 'string' },
    });
    expect(z).not.toContain('.optional()');
  });

  test('genuinely-optional QUERY org-id filter STAYS optional (middleware is the authority)', () => {
    const z = convertParameterToZod({
      name: 'organizationId',
      in: 'query',
      required: false,
      schema: { type: 'string', format: 'uuid' },
    });
    expect(z).toContain('.optional()');
  });

  test('required query param is non-optional', () => {
    const z = convertParameterToZod({
      name: 'foo',
      in: 'query',
      required: true,
      schema: { type: 'string' },
    });
    expect(z).not.toContain('.optional()');
  });
});

describe('F-3 generated validators.ts org-id invariants (regen-lock)', () => {
  function blockBody(name: string): string {
    const lines = VALIDATORS.split('\n');
    const start = lines.findIndex((l) =>
      new RegExp(`^export const ${name}\\b`).test(l),
    );
    if (start < 0) throw new Error(`validator block not found: ${name}`);
    let end = start;
    for (let i = start; i < lines.length; i++) {
      if (/^\}\)/.test(lines[i])) {
        end = i;
        break;
      }
    }
    return lines.slice(start, end + 1).join('\n');
  }
  function orgLine(name: string): string {
    const line = blockBody(name)
      .split('\n')
      .find((l) => /\b(organizationId|orgId)\b\s*:/.test(l));
    if (!line) throw new Error(`${name} declares no org-id field`);
    return line.trim();
  }

  test('PATH-param org-id ops emit NON-optional org id', () => {
    for (const op of [
      'GetOrganizationParams',
      'UpdateOrganizationParams',
      'ListOrgAccreditedProvidersParams',
    ]) {
      expect(orgLine(op), `${op} org-id must be non-optional`).not.toContain(
        '.optional()',
      );
    }
  });

  test('list/search QUERY org-id filters STAY optional (orgContextMiddleware is authority)', () => {
    for (const op of [
      'ListMembershipsQuery',
      'ListDuesInvoicesQuery',
      'SearchEventsQuery',
    ]) {
      expect(orgLine(op), `${op} org-id stays optional`).toContain(
        '.optional()',
      );
    }
  });

  test('PATCH *UpdateSchema partials keep org-id optional', () => {
    for (const schema of ['AdCampaignUpdateSchema', 'AnnouncementUpdateSchema']) {
      expect(orgLine(schema), `${schema} org-id stays optional`).toContain(
        '.optional()',
      );
    }
  });
});
