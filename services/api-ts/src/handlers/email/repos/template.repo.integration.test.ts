/**
 * Real-PG integration suite for EmailTemplateRepository (B3 email S4).
 *
 * REPLACES THE MOCK ILLUSION: template.repo.test.ts mocks the DB at the class
 * level ("DB-dependent methods mock at the class level via spyOn") and never
 * executes a single real statement. This suite stands up an isolated scratch
 * schema (LIKE public.email_template INCLUDING ALL → schema-faithful
 * nullability/defaults/indexes) and proves the DB-backed paths the mock can NOT:
 *   - createTemplate persists with status='draft' (DB default) + jsonb round-trip.
 *   - Invalid Handlebars → ValidationError BEFORE insert (count stays 0).
 *   - NON-UNIQUE name: two templates with the same name both succeed (count=2) —
 *     template name is NOT a dedup key (no unique constraint in the live catalog).
 *   - getActiveTemplate returns the row ONLY when status='active' (draft→null,
 *     activate→returns, archive→null).
 *   - buildWhereConditions raw `tags::jsonb @> '[...]'::jsonb` AND-containment:
 *     a row tagged only ['welcome'] is EXCLUDED by @> ['welcome','onboarding'].
 *   - updateTemplate bumps version by 1; missing id → NotFoundError.
 *
 * The pure Handlebars helpers (validateVariableDefinitions / validateVariables /
 * generateSampleVariables / renderTemplate string rendering) are NOT DB paths —
 * they stay covered by the unit file (S7 extracts them); this suite only proves
 * the DB seams.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createScratch } from '@/test-utils/pg-scratch';
import type { ScratchDb } from '@/test-utils/pg-scratch';
import { EmailTemplateRepository } from './template.repo';
import { NotFoundError, ValidationError } from '@/core/errors';

const ORG = '00000000-0000-4000-8000-0000000000d4';

let H: ScratchDb;

beforeAll(async () => {
  H = await createScratch(['email_template']);
});

afterAll(async () => {
  await H?.teardown();
});

function repo() {
  return new EmailTemplateRepository(H.db as never);
}

function baseTemplate(overrides: Record<string, unknown> = {}) {
  return {
    organizationId: ORG,
    name: 'welcome-email',
    subject: 'Hello {{firstName}}',
    bodyHtml: '<p>Welcome, {{firstName}}</p>',
    variables: [],
    ...overrides,
  } as never;
}

describe('EmailTemplateRepository.createTemplate — persistence (real PG)', () => {
  test('persists with status=draft (DB default) and jsonb round-trips', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const created = await r.createTemplate(
      baseTemplate({
        name: 'persist-tpl',
        variables: [{ id: 'firstName', type: 'string', label: 'First name', required: true }],
      })
    );

    const { rows } = await H.scopedPool.query(
      `SELECT name, subject, body_html, status, variables, organization_id
         FROM "${H.schema}".email_template WHERE id = $1`,
      [created.id]
    );
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.name).toBe('persist-tpl');
    expect(row.subject).toBe('Hello {{firstName}}');
    expect(row.body_html).toBe('<p>Welcome, {{firstName}}</p>');
    // DB default — not passed in.
    expect(row.status).toBe('draft');
    expect(row.organization_id).toBe(ORG);
    // jsonb round-trips as a real array of objects, not a string.
    expect(row.variables).toEqual([
      { id: 'firstName', type: 'string', label: 'First name', required: true },
    ]);
  });

  test('invalid Handlebars subject → ValidationError BEFORE insert (count stays 0)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    let threw = false;
    try {
      await r.createTemplate(baseTemplate({ name: 'bad-syntax', subject: 'Hi {{/if}}' }));
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(ValidationError);
    }
    expect(threw).toBe(true);

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_template WHERE name = $1`,
      ['bad-syntax']
    );
    expect(rows[0].n).toBe(0);
  });

  test('NON-UNIQUE name: two templates with the same name BOTH succeed (count=2)', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    await r.createTemplate(baseTemplate({ name: 'dupe-name' }));
    await r.createTemplate(baseTemplate({ name: 'dupe-name', subject: 'Second {{x}}' }));

    const { rows } = await H.scopedPool.query(
      `SELECT count(*)::int AS n FROM "${H.schema}".email_template WHERE name = $1`,
      ['dupe-name']
    );
    // No unique constraint on name in the live catalog — name is NOT a dedup key.
    expect(rows[0].n).toBe(2);
  });
});

describe('EmailTemplateRepository.getActiveTemplate — active-only lookup (real PG)', () => {
  test('returns null for a draft, returns the row after activate, null again after archive', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const created = await r.createTemplate(baseTemplate({ name: 'lifecycle-tpl' }));

    // draft → not active → null
    expect(await r.getActiveTemplate(created.id)).toBeNull();

    // activate → status persists + getActiveTemplate now returns it
    await r.activateTemplate(created.id);
    const { rows: activeRows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".email_template WHERE id = $1`,
      [created.id]
    );
    expect(activeRows[0].status).toBe('active');
    // cache was invalidated by activate, so this is a fresh DB read of the active row
    const fetched = await r.getActiveTemplate(created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(created.id);
    expect(fetched?.status).toBe('active');

    // archive → status persists + getActiveTemplate returns null again
    await r.archiveTemplate(created.id);
    const { rows: archivedRows } = await H.scopedPool.query(
      `SELECT status FROM "${H.schema}".email_template WHERE id = $1`,
      [created.id]
    );
    expect(archivedRows[0].status).toBe('archived');
    expect(await r.getActiveTemplate(created.id)).toBeNull();
  });
});

describe('EmailTemplateRepository.buildWhereConditions — raw jsonb @> + status (real PG)', () => {
  test('status filter returns only the matching rows', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const draft = await r.createTemplate(baseTemplate({ name: 'status-draft' }));
    const toActivate = await r.createTemplate(baseTemplate({ name: 'status-active' }));
    await r.activateTemplate(toActivate.id);

    const active = await r.findMany({ status: 'active' });
    const ids = active.map((t) => t.id);
    expect(ids).toContain(toActivate.id);
    expect(ids).not.toContain(draft.id);
  });

  test('tags @> AND-containment: a row tagged only [welcome] is EXCLUDED by @>[welcome,onboarding]', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const both = await r.createTemplate(
      baseTemplate({ name: 'tags-both', tags: ['welcome', 'onboarding'] })
    );
    const onlyWelcome = await r.createTemplate(
      baseTemplate({ name: 'tags-welcome', tags: ['welcome'] })
    );

    const result = await r.findMany({ tags: ['welcome', 'onboarding'] });
    const ids = result.map((t) => t.id);
    // @> requires the row's tags to CONTAIN both → only the [welcome,onboarding] row.
    expect(ids).toContain(both.id);
    expect(ids).not.toContain(onlyWelcome.id);
  });
});

describe('EmailTemplateRepository.updateTemplate — version bump + missing id (real PG)', () => {
  test('updateTemplate bumps version by 1 and persists the new subject', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    const created = await r.createTemplate(baseTemplate({ name: 'version-tpl' }));

    const { rows: before } = await H.scopedPool.query(
      `SELECT version FROM "${H.schema}".email_template WHERE id = $1`,
      [created.id]
    );
    const v0 = before[0].version as number;

    await r.updateTemplate(created.id, { subject: 'Updated {{firstName}}' });

    const { rows: after } = await H.scopedPool.query(
      `SELECT version, subject FROM "${H.schema}".email_template WHERE id = $1`,
      [created.id]
    );
    expect(after[0].version).toBe(v0 + 1);
    expect(after[0].subject).toBe('Updated {{firstName}}');
  });

  test('updateTemplate on a missing id → NotFoundError', async () => {
    if (!H.dbReachable) return;
    const r = repo();
    let threw = false;
    try {
      await r.updateTemplate('00000000-0000-4000-8000-0000000fffff', { subject: 'x' });
    } catch (e) {
      threw = true;
      expect(e).toBeInstanceOf(NotFoundError);
    }
    expect(threw).toBe(true);
  });
});
