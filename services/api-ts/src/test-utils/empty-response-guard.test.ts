import { describe, test, expect } from 'bun:test';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * GUARDRAIL: Detect ctx.json({}, 200) anti-pattern across all handlers.
 *
 * Returning an empty object {} with status 200 is dangerous because:
 * 1. SDK response transformers assume fields exist (e.g., BigInt(data.field.toString()))
 * 2. When the transformer throws, TanStack Query retries with exponential backoff
 * 3. TypeError is not an SdkError, so shouldRetry() treats it as a network failure
 * 4. Result: 7.5s delay (1s + 2s + 4s backoff) for what should be instant
 *
 * Correct patterns for "not found":
 *   ctx.json({ data: null }, 200)   — when absence is expected (list returns empty)
 *   ctx.json({ data: null }, 404)   — when absence means "not found"
 *   throw new NotFoundError()       — when absence is an error
 */
describe('Handler empty-response guard', () => {
  const handlersDir = join(import.meta.dir, '..', 'handlers');

  function getAllTsFiles(dir: string): string[] {
    const files: string[] = [];
    try {
      for (const entry of readdirSync(dir)) {
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            files.push(...getAllTsFiles(fullPath));
          } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts') && !entry.endsWith('.schema.ts')) {
            files.push(fullPath);
          }
        } catch { /* skip inaccessible entries */ }
      }
    } catch { /* skip inaccessible dirs */ }
    return files;
  }

  test('no handler returns ctx.json({}, 200) — use 404 or { data: null } instead', () => {
    const violations: string[] = [];
    const handlerFiles = getAllTsFiles(handlersDir);

    for (const file of handlerFiles) {
      const content = readFileSync(file, 'utf-8');
      // Match ctx.json({}, 200) or ctx.json({}, with any 2xx status
      // Allow ctx.json({}, 404) or ctx.json({}, 4xx)
      const matches = content.matchAll(/ctx\.json\(\s*\{\s*\}\s*,\s*2\d\d\s*\)/g);
      for (const match of matches) {
        const line = content.substring(0, match.index).split('\n').length;
        const relPath = file.replace(handlersDir, 'handlers');
        violations.push(`${relPath}:${line} — ctx.json({}, 2xx) crashes SDK transformers`);
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} handler(s) returning empty {} with 2xx status.\n` +
        `This crashes SDK response transformers and causes retry storms.\n\n` +
        violations.map(v => `  ✗ ${v}`).join('\n') + '\n\n' +
        `Fix: use ctx.json({ data: null }, 404) or throw new NotFoundError()`
      );
    }
  });
});
