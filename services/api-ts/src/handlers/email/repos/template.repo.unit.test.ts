/**
 * Pure-function unit tests for EmailTemplateRepository.
 *
 * Extracted (Wave-2 B3 finalize) from the deleted mock-only template.repo.test.ts.
 * The DB-path assertions that file carried (createTemplate persistence, getActiveTemplate
 * active-only lookup, updateTemplate version-bump, activate/archive) are now proven against
 * real Postgres in template.repo.integration.test.ts. What remains here is the genuinely
 * pure logic that has no SQL to migrate:
 *
 *   - validateVariables        — type/range/format checks on a values map (no I/O)
 *   - validateTemplateSyntax   — Handlebars.precompile guard (the S4 precompile fix; lazy
 *                                compile never threw at create time, making the guard a no-op)
 *   - validateVariableDefinitions — duplicate-id / missing-field / min>max checks
 *   - renderTemplate           — Handlebars render incl. formatCurrency/plural helpers
 *   - generateSampleVariables  — sample-value synthesis driven off variable defs
 *   - in-memory template cache — invalidateCache / clearCache / TTL hit
 *
 * The repo is constructed with a minimal stub DB only to satisfy the constructor guard;
 * the methods under test below either never touch it or have their DB seam spied out, so
 * these run as fast non-DB units (no `.integration.` suffix).
 */

import { describe, test, expect, mock, spyOn } from 'bun:test';
import { EmailTemplateRepository } from './template.repo';
import { ValidationError, NotFoundError } from '@/core/errors';
import type { EmailTemplate, TemplateVariable } from './email.schema';
import Handlebars from 'handlebars';

// Mock-Classification: N/A — these are pure-logic units; the stub DB only satisfies the
// constructor guard and is never exercised by the methods under test (or is spied out).

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  };
}

/** Minimal stub DB — just enough to pass the constructor guard. */
function makeStubDb() {
  return {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => Promise.resolve([])),
          orderBy: mock(() => ({ limit: mock(() => Promise.resolve([])) })),
        })),
        groupBy: mock(() => Promise.resolve([])),
      })),
    })),
    insert: mock(() => ({ values: mock(() => ({ returning: mock(() => Promise.resolve([])) })) })),
    update: mock(() => ({ set: mock(() => ({ where: mock(() => ({ returning: mock(() => Promise.resolve([])) })) })) })),
    delete: mock(() => ({ where: mock(() => Promise.resolve({ rowCount: 0 })) })),
  } as any;
}

function makeRepo(dbOverride?: any, loggerOverride?: any) {
  const db = dbOverride ?? makeStubDb();
  const logger = loggerOverride ?? makeLogger();
  return new EmailTemplateRepository(db, logger);
}

function makeTemplate(overrides: Partial<EmailTemplate> = {}): EmailTemplate {
  return {
    id: 'tpl-1',
    organizationId: null,
    name: 'Welcome Email',
    description: 'Welcome new members',
    subject: 'Welcome, {{name}}!',
    bodyHtml: '<h1>Hello {{name}}</h1><p>Welcome to the platform.</p>',
    bodyText: 'Hello {{name}}, welcome to the platform.',
    tags: ['auth.welcome'],
    variables: [
      { id: 'name', type: 'string', label: 'Name', required: true },
    ] as TemplateVariable[],
    fromName: null,
    fromEmail: null,
    replyToEmail: null,
    replyToName: null,
    status: 'active',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EmailTemplate;
}

// ---------------------------------------------------------------------------
// Constructor guard (pure)
// ---------------------------------------------------------------------------

describe('EmailTemplateRepository (pure units)', () => {
  describe('constructor', () => {
    test('throws when db is null/undefined', () => {
      expect(() => new EmailTemplateRepository(null as any)).toThrow(
        'Database instance is required'
      );
    });

    test('creates instance with valid db', () => {
      const repo = makeRepo();
      expect(repo).toBeInstanceOf(EmailTemplateRepository);
    });
  });

  // ---------------------------------------------------------------------------
  // validateVariables (public, pure)
  // ---------------------------------------------------------------------------

  describe('validateVariables', () => {
    test('returns empty array when all required variables provided', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
      ];

      const errors = repo.validateVariables(defs, { name: 'Alice' });
      expect(errors).toEqual([]);
    });

    test('returns error for missing required variable', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
      ];

      const errors = repo.validateVariables(defs, {});
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("'name'");
      expect(errors[0]).toContain('missing');
    });

    test('treats empty string as missing for required variables', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
      ];

      const errors = repo.validateVariables(defs, { name: '' });
      expect(errors).toHaveLength(1);
    });

    test('treats null as missing for required variables', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
      ];

      const errors = repo.validateVariables(defs, { name: null });
      expect(errors).toHaveLength(1);
    });

    test('skips validation for optional variables that are not provided', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'nickname', type: 'string', label: 'Nickname', required: false },
      ];

      const errors = repo.validateVariables(defs, {});
      expect(errors).toEqual([]);
    });

    // --- string type ---

    test('validates string type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
      ];

      const errors = repo.validateVariables(defs, { name: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a string');
    });

    test('validates string minLength', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true, minLength: 3 },
      ];

      const errors = repo.validateVariables(defs, { name: 'AB' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('at least 3');
    });

    test('validates string maxLength', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true, maxLength: 5 },
      ];

      const errors = repo.validateVariables(defs, { name: 'Too Long Name' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('at most 5');
    });

    test('validates string pattern', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'code', type: 'string', label: 'Code', required: true, pattern: '^[A-Z]{3}$' },
      ];

      const errors = repo.validateVariables(defs, { code: 'abc' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('pattern');
    });

    test('validates string options', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'color', type: 'string', label: 'Color', required: true, options: ['red', 'blue'] },
      ];

      const errors = repo.validateVariables(defs, { color: 'green' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('one of');
    });

    test('accepts valid string with options', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'color', type: 'string', label: 'Color', required: true, options: ['red', 'blue'] },
      ];

      const errors = repo.validateVariables(defs, { color: 'red' });
      expect(errors).toEqual([]);
    });

    // --- number type ---

    test('validates number type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'age', type: 'number', label: 'Age', required: true },
      ];

      const errors = repo.validateVariables(defs, { age: 'twenty' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a number');
    });

    test('validates number min', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'age', type: 'number', label: 'Age', required: true, min: 18 },
      ];

      const errors = repo.validateVariables(defs, { age: 15 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('at least 18');
    });

    test('validates number max', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'age', type: 'number', label: 'Age', required: true, max: 100 },
      ];

      const errors = repo.validateVariables(defs, { age: 150 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('at most 100');
    });

    test('accepts valid number within range', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'age', type: 'number', label: 'Age', required: true, min: 18, max: 100 },
      ];

      const errors = repo.validateVariables(defs, { age: 25 });
      expect(errors).toEqual([]);
    });

    // --- boolean type ---

    test('validates boolean type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'active', type: 'boolean', label: 'Active', required: true },
      ];

      const errors = repo.validateVariables(defs, { active: 'yes' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be a boolean');
    });

    test('accepts valid boolean', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'active', type: 'boolean', label: 'Active', required: true },
      ];

      const errors = repo.validateVariables(defs, { active: false });
      expect(errors).toEqual([]);
    });

    // --- date/datetime type ---

    test('validates date type rejects non-date non-string', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'dob', type: 'date', label: 'DOB', required: true },
      ];

      const errors = repo.validateVariables(defs, { dob: 12345 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('date');
    });

    test('accepts date string for date type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'dob', type: 'date', label: 'DOB', required: true },
      ];

      const errors = repo.validateVariables(defs, { dob: '2026-01-15' });
      expect(errors).toEqual([]);
    });

    test('accepts Date object for date type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'dob', type: 'date', label: 'DOB', required: true },
      ];

      const errors = repo.validateVariables(defs, { dob: new Date() });
      expect(errors).toEqual([]);
    });

    test('validates datetime type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'ts', type: 'datetime', label: 'Timestamp', required: true },
      ];

      const errors = repo.validateVariables(defs, { ts: 12345 });
      expect(errors).toHaveLength(1);
    });

    // --- email type ---

    test('validates email format', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'email', type: 'email', label: 'Email', required: true },
      ];

      const errors = repo.validateVariables(defs, { email: 'not-an-email' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('valid email');
    });

    test('accepts valid email', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'email', type: 'email', label: 'Email', required: true },
      ];

      const errors = repo.validateVariables(defs, { email: 'user@example.com' });
      expect(errors).toEqual([]);
    });

    test('rejects email that is not a string', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'email', type: 'email', label: 'Email', required: true },
      ];

      const errors = repo.validateVariables(defs, { email: 42 });
      expect(errors).toHaveLength(1);
    });

    // --- url type ---

    test('validates url format', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'link', type: 'url', label: 'Link', required: true },
      ];

      const errors = repo.validateVariables(defs, { link: 'not a url' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('valid URL');
    });

    test('accepts valid url', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'link', type: 'url', label: 'Link', required: true },
      ];

      const errors = repo.validateVariables(defs, { link: 'https://example.com/path' });
      expect(errors).toEqual([]);
    });

    test('rejects url that is not a string', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'link', type: 'url', label: 'Link', required: true },
      ];

      const errors = repo.validateVariables(defs, { link: 123 });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('URL string');
    });

    // --- array type ---

    test('validates array type', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'items', type: 'array', label: 'Items', required: true },
      ];

      const errors = repo.validateVariables(defs, { items: 'not-array' });
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('must be an array');
    });

    test('accepts valid array', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'items', type: 'array', label: 'Items', required: true },
      ];

      const errors = repo.validateVariables(defs, { items: ['a', 'b'] });
      expect(errors).toEqual([]);
    });

    // --- multiple errors ---

    test('accumulates multiple validation errors', () => {
      const repo = makeRepo();
      const defs: TemplateVariable[] = [
        { id: 'name', type: 'string', label: 'Name', required: true },
        { id: 'age', type: 'number', label: 'Age', required: true },
        { id: 'email', type: 'email', label: 'Email', required: true },
      ];

      const errors = repo.validateVariables(defs, {});
      expect(errors).toHaveLength(3);
    });
  });

  // ---------------------------------------------------------------------------
  // validateTemplateSyntax (private — exercised via createTemplate; S4 precompile fix)
  //
  // validateTemplateSyntax parses via Handlebars.precompile (eager), NOT
  // Handlebars.compile (lazy — it never threw at create time, making the guard a
  // silent no-op). These patch precompile to drive the corrected implementation;
  // the real-PG proof that an invalid template is rejected BEFORE insert lives in
  // template.repo.integration.test.ts S4.
  // ---------------------------------------------------------------------------

  describe('template syntax validation (via createTemplate)', () => {
    test('wraps Handlebars compile errors as ValidationError', async () => {
      const repo = makeRepo();
      const originalPrecompile = Handlebars.precompile;

      Handlebars.precompile = (() => { throw new Error('Parse error'); }) as any;

      try {
        await expect(
          repo.createTemplate({
            name: 'Bad',
            subject: 'anything',
            bodyHtml: '<p>ok</p>',
            variables: [],
          } as any)
        ).rejects.toBeInstanceOf(ValidationError);
      } finally {
        Handlebars.precompile = originalPrecompile;
      }
    });

    test('ValidationError message includes original error', async () => {
      const repo = makeRepo();
      const originalPrecompile = Handlebars.precompile;

      Handlebars.precompile = (() => { throw new Error('Parse error on line 1'); }) as any;

      try {
        await expect(
          repo.createTemplate({
            name: 'Bad',
            subject: 'anything',
            bodyHtml: '<p>ok</p>',
            variables: [],
          } as any)
        ).rejects.toThrow('Invalid template syntax: Parse error on line 1');
      } finally {
        Handlebars.precompile = originalPrecompile;
      }
    });

    test('validates all template parts (subject, bodyHtml, bodyText)', async () => {
      const repo = makeRepo();
      const originalPrecompile = Handlebars.precompile;
      const compileCalls: string[] = [];

      Handlebars.precompile = ((template: string) => {
        compileCalls.push(template);
        return originalPrecompile(template);
      }) as any;

      spyOn(repo, 'createOne' as any).mockResolvedValue(makeTemplate());

      try {
        await repo.createTemplate({
          name: 'Full',
          subject: 'Subject {{name}}',
          bodyHtml: '<p>HTML {{name}}</p>',
          bodyText: 'Text {{name}}',
          variables: [{ id: 'name', type: 'string', label: 'Name', required: true }],
        } as any);

        expect(compileCalls).toContain('Subject {{name}}');
        expect(compileCalls).toContain('<p>HTML {{name}}</p>');
        expect(compileCalls).toContain('Text {{name}}');
      } finally {
        Handlebars.precompile = originalPrecompile;
      }
    });

    test('accepts valid Handlebars templates', async () => {
      const repo = makeRepo();
      const created = makeTemplate();
      spyOn(repo, 'createOne' as any).mockResolvedValue(created);

      const result = await repo.createTemplate({
        name: 'Welcome',
        subject: 'Hello {{name}}',
        bodyHtml: '<h1>Welcome {{name}}</h1>',
        bodyText: 'Welcome {{name}}',
        variables: [{ id: 'name', type: 'string', label: 'Name', required: true }],
      } as any);

      expect(result.id).toBe('tpl-1');
    });
  });

  // ---------------------------------------------------------------------------
  // validateVariableDefinitions (private — exercised via createTemplate; pure)
  // ---------------------------------------------------------------------------

  describe('variable definitions validation (via createTemplate)', () => {
    test('rejects duplicate variable IDs', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'Dupes',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: 'name', type: 'string', label: 'Name', required: true },
            { id: 'name', type: 'string', label: 'Name Again', required: false },
          ],
        } as any)
      ).rejects.toThrow('Duplicate variable ID: name');
    });

    test('rejects variable without id', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'NoId',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: '', type: 'string', label: 'Name', required: true },
          ],
        } as any)
      ).rejects.toThrow('Variables must have id, type, and label');
    });

    test('rejects variable without type', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'NoType',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: 'x', type: '', label: 'X', required: true },
          ],
        } as any)
      ).rejects.toThrow('Variables must have id, type, and label');
    });

    test('rejects variable without label', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'NoLabel',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: 'x', type: 'string', label: '', required: true },
          ],
        } as any)
      ).rejects.toThrow('Variables must have id, type, and label');
    });

    test('rejects string variable with empty options array', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'EmptyOpts',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: 'x', type: 'string', label: 'X', required: true, options: [] },
          ],
        } as any)
      ).rejects.toThrow('options array cannot be empty');
    });

    test('rejects number variable where min > max', async () => {
      const repo = makeRepo();

      await expect(
        repo.createTemplate({
          name: 'MinMax',
          subject: 'ok',
          bodyHtml: '<p>ok</p>',
          variables: [
            { id: 'x', type: 'number', label: 'X', required: true, min: 100, max: 10 },
          ],
        } as any)
      ).rejects.toThrow('min value cannot be greater than max value');
    });

    test('accepts valid variable definitions', async () => {
      const repo = makeRepo();
      spyOn(repo, 'createOne' as any).mockResolvedValue(makeTemplate());

      const result = await repo.createTemplate({
        name: 'Good',
        subject: 'ok',
        bodyHtml: '<p>ok</p>',
        variables: [
          { id: 'name', type: 'string', label: 'Name', required: true },
          { id: 'count', type: 'number', label: 'Count', required: false, min: 0, max: 100 },
        ],
      } as any);

      expect(result).toBeDefined();
    });

    test('skips variable validation when variables not provided', async () => {
      const repo = makeRepo();
      spyOn(repo, 'createOne' as any).mockResolvedValue(makeTemplate({ variables: [] as any }));

      const result = await repo.createTemplate({
        name: 'Simple',
        subject: 'Hello',
        bodyHtml: '<p>Hello</p>',
      } as any);

      expect(result).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // updateTemplate — content-field syntax/definition guards (pure branches)
  // (version-bump + missing-id persistence proven in integration; here we lock the
  // pure validation branches that throw BEFORE any write.)
  // ---------------------------------------------------------------------------

  describe('updateTemplate (pure validation branches)', () => {
    test('throws NotFoundError when template does not exist', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(null);

      await expect(
        repo.updateTemplate('nonexistent', { name: 'New Name' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test('validates syntax when subject is updated', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeTemplate());

      const originalPrecompile = Handlebars.precompile;
      Handlebars.precompile = (() => { throw new Error('Parse error'); }) as any;

      try {
        await expect(
          repo.updateTemplate('tpl-1', { subject: 'bad-template' })
        ).rejects.toBeInstanceOf(ValidationError);
      } finally {
        Handlebars.precompile = originalPrecompile;
      }
    });

    test('validates syntax when bodyHtml is updated', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeTemplate());

      const originalPrecompile = Handlebars.precompile;
      Handlebars.precompile = (() => { throw new Error('Parse error'); }) as any;

      try {
        await expect(
          repo.updateTemplate('tpl-1', { bodyHtml: 'bad-template' })
        ).rejects.toBeInstanceOf(ValidationError);
      } finally {
        Handlebars.precompile = originalPrecompile;
      }
    });

    test('validates variable definitions when variables are updated', async () => {
      const repo = makeRepo();
      spyOn(repo, 'findOneById' as any).mockResolvedValue(makeTemplate());

      await expect(
        repo.updateTemplate('tpl-1', {
          variables: [
            { id: 'x', type: 'string', label: 'X', required: true },
            { id: 'x', type: 'string', label: 'X again', required: false },
          ] as any,
        })
      ).rejects.toThrow('Duplicate variable ID');
    });
  });

  // ---------------------------------------------------------------------------
  // renderTemplate (pure Handlebars render; getActiveTemplate seam spied out)
  // ---------------------------------------------------------------------------

  describe('renderTemplate', () => {
    test('renders template with variables', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Welcome, {{name}}!',
        bodyHtml: '<h1>Hello {{name}}</h1>',
        bodyText: 'Hello {{name}}',
        variables: [
          { id: 'name', type: 'string', label: 'Name', required: true },
        ] as TemplateVariable[],
      });

      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.renderTemplate('tpl-1', { name: 'Alice' });

      expect(result.subject).toBe('Welcome, Alice!');
      expect(result.bodyHtml).toBe('<h1>Hello Alice</h1>');
      expect(result.bodyText).toBe('Hello Alice');
    });

    test('throws NotFoundError when template not found', async () => {
      const repo = makeRepo();
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(null);

      await expect(
        repo.renderTemplate('nonexistent', { name: 'Alice' })
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    test('throws ValidationError when required variable is missing', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        variables: [
          { id: 'name', type: 'string', label: 'Name', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      await expect(
        repo.renderTemplate('tpl-1', {})
      ).rejects.toBeInstanceOf(ValidationError);
    });

    test('renders without bodyText when template has none', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        bodyText: null,
        variables: [] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.renderTemplate('tpl-1', {});
      expect(result.bodyText).toBeUndefined();
    });

    test('renders with Handlebars helpers (formatCurrency)', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Invoice',
        bodyHtml: '<p>Amount: {{formatCurrency amount}}</p>',
        bodyText: null,
        variables: [
          { id: 'amount', type: 'number', label: 'Amount', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.renderTemplate('tpl-1', { amount: 5000 });

      // 5000 cents = $50.00
      expect(result.bodyHtml).toContain('$50.00');
    });

    test('renders with plural helper', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Items',
        bodyHtml: '<p>{{count}} {{plural count "item" "items"}}</p>',
        bodyText: null,
        variables: [
          { id: 'count', type: 'number', label: 'Count', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const singular = await repo.renderTemplate('tpl-1', { count: 1 });
      expect(singular.bodyHtml).toContain('1 item');

      const plural = await repo.renderTemplate('tpl-1', { count: 3 });
      expect(plural.bodyHtml).toContain('3 items');
    });
  });

  // ---------------------------------------------------------------------------
  // previewTemplate + generateSampleVariables (pure; getActiveTemplate spied out)
  // ---------------------------------------------------------------------------

  describe('previewTemplate', () => {
    test('uses provided variables when given', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Hi {{name}}',
        bodyHtml: '<p>{{name}}</p>',
        variables: [
          { id: 'name', type: 'string', label: 'Name', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1', { name: 'Bob' });
      expect(result.subject).toBe('Hi Bob');
    });

    test('generates sample variables when none provided', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Hi {{name}}',
        bodyHtml: '<p>{{name}}</p>',
        variables: [
          { id: 'name', type: 'string', label: 'Full Name', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      // Should use generated sample: "Sample Full Name"
      expect(result.subject).toBe('Hi Sample Full Name');
    });

    test('throws NotFoundError when template not found', async () => {
      const repo = makeRepo();
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(null);

      await expect(repo.previewTemplate('nonexistent')).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('sample variable generation (via previewTemplate)', () => {
    test('generates sample string from label', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: '{{greeting}}',
        bodyHtml: '<p>{{greeting}}</p>',
        variables: [
          { id: 'greeting', type: 'string', label: 'Greeting', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Sample Greeting');
    });

    test('uses first option for string with options', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: '{{tier}}',
        bodyHtml: '<p>{{tier}}</p>',
        variables: [
          { id: 'tier', type: 'string', label: 'Tier', required: true, options: ['gold', 'silver'] },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('gold');
    });

    test('uses defaultValue when defined', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: '{{city}}',
        bodyHtml: '<p>{{city}}</p>',
        variables: [
          { id: 'city', type: 'string', label: 'City', required: true, defaultValue: 'Manila' },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Manila');
    });

    test('generates sample number (42 default or min)', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Count: {{count}}',
        bodyHtml: '<p>{{count}}</p>',
        variables: [
          { id: 'count', type: 'number', label: 'Count', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Count: 42');
    });

    test('uses min for number when defined', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Score: {{score}}',
        bodyHtml: '<p>{{score}}</p>',
        variables: [
          { id: 'score', type: 'number', label: 'Score', required: true, min: 10 },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Score: 10');
    });

    test('generates sample boolean (true)', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Active: {{active}}',
        bodyHtml: '<p>{{active}}</p>',
        variables: [
          { id: 'active', type: 'boolean', label: 'Active', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Active: true');
    });

    test('generates sample email', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'To: {{contact}}',
        bodyHtml: '<p>{{contact}}</p>',
        variables: [
          { id: 'contact', type: 'email', label: 'Contact', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('To: sample@example.com');
    });

    test('generates sample url', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate({
        subject: 'Link: {{link}}',
        bodyHtml: '<p>{{link}}</p>',
        variables: [
          { id: 'link', type: 'url', label: 'Link', required: true },
        ] as TemplateVariable[],
      });
      spyOn(repo, 'getActiveTemplate').mockResolvedValue(tpl);

      const result = await repo.previewTemplate('tpl-1');
      expect(result.subject).toBe('Link: https://example.com');
    });
  });

  // ---------------------------------------------------------------------------
  // In-memory template cache (pure — Map-backed, no DB on the hit path)
  // ---------------------------------------------------------------------------

  describe('cache', () => {
    test('invalidateCache removes entry', () => {
      const repo = makeRepo();
      (repo as any).templateCache.set('tpl-1', {
        template: makeTemplate(),
        expiry: Date.now() + 300000,
      });

      expect((repo as any).templateCache.has('tpl-1')).toBe(true);
      repo.invalidateCache('tpl-1');
      expect((repo as any).templateCache.has('tpl-1')).toBe(false);
    });

    test('clearCache removes all entries', () => {
      const repo = makeRepo();
      (repo as any).templateCache.set('tpl-1', { template: makeTemplate(), expiry: Date.now() + 300000 });
      (repo as any).templateCache.set('tpl-2', { template: makeTemplate({ id: 'tpl-2' }), expiry: Date.now() + 300000 });

      expect((repo as any).templateCache.size).toBe(2);
      repo.clearCache();
      expect((repo as any).templateCache.size).toBe(0);
    });

    test('getActiveTemplate returns cached template when not expired', async () => {
      const repo = makeRepo();
      const tpl = makeTemplate();

      (repo as any).templateCache.set('tpl-1', {
        template: tpl,
        expiry: Date.now() + 300000,
      });

      const result = await repo.getActiveTemplate('tpl-1');
      expect(result).toEqual(tpl);
    });
  });
});
