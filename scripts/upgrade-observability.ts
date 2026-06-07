#!/usr/bin/env bun
/**
 * upgrade-observability — mechanical observability upgrader
 *
 * For every handler .ts file in services/api-ts/src/handlers/ (excluding
 * jobs/, repos/, .test.ts), this script:
 *
 *   1. Detects whether the file already binds traceId + module via a
 *      child-logger pattern (`.child({...})` / `?.child?.({...})`).
 *   2. If not, but the file uses `ctx.get('logger')`, injects the
 *      canonical pattern:
 *          const baseLogger = ctx.get('logger');
 *          const traceId = ctx.get('requestId');
 *          const logger = baseLogger?.child?.({ traceId, module: '<owner>' }) ?? baseLogger;
 *      …replacing the existing `const logger = ctx.get('logger')` line.
 *   3. For every `logger?.X({...})` / `logger.X({...})` call that does NOT
 *      already have an `action:` field, prepends
 *      `action: '<fileBase>.<counter>'` to the first arg object literal.
 *
 * The module name is derived from the path:
 *   handlers/billing/foo.ts        → 'billing'
 *   handlers/association:member/   → 'association:member'
 *   handlers/booking/utils/x.ts    → 'booking'
 *
 * Dry-run by default. Pass --write to mutate files.
 *
 * Usage:
 *   bun run scripts/upgrade-observability.ts          # report only
 *   bun run scripts/upgrade-observability.ts --write  # apply edits
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, basename } from 'path';

const HANDLERS_ROOT = 'services/api-ts/src/handlers';
const WRITE = process.argv.includes('--write');

function walk(d: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'jobs' || e.name === 'repos' || e.name === 'node_modules') continue;
    if (e.isDirectory()) out.push(...walk(join(d, e.name)));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) out.push(join(d, e.name));
  }
  return out;
}

function moduleNameFor(path: string): string {
  const parts = path.split('/');
  const handlersIdx = parts.indexOf('handlers');
  if (handlersIdx === -1 || handlersIdx + 1 >= parts.length) return 'handler';
  return parts[handlersIdx + 1]!;
}

let totalScanned = 0;
let totalSkipped = 0;
let totalUpgraded = 0;
let totalLogCallsAnnotated = 0;
const skippedFiles: { file: string; reason: string }[] = [];
const upgradedFiles: string[] = [];

for (const file of walk(HANDLERS_ROOT)) {
  totalScanned++;
  const src = readFileSync(file, 'utf8');

  // Skip if file does not log
  const hasLogCalls = /(logger|log)\s*\??\.(info|error|warn|debug)\s*\(/.test(src);
  if (!hasLogCalls) {
    totalSkipped++;
    skippedFiles.push({ file, reason: 'no log calls' });
    continue;
  }

  // Skip if file already binds the canonical pattern
  const hasChildBind = /\??\.child\??\.?\s*\(\s*\{[^}]*\b(traceId|module)\b[^}]*\}/.test(src);
  const hasModuleLogger = /createModuleLogger\s*\(/.test(src);

  let out = src;
  let mutated = false;
  let logCallsAnnotated = 0;

  const moduleName = moduleNameFor(file);
  const fileBase = basename(file, '.ts');

  // Step 1: inject child-logger bind if absent and ctx.get('logger') is present
  if (!hasChildBind && !hasModuleLogger) {
    // Replace `const logger = ctx.get('logger');` with the 3-line block
    const loggerDecl = /([ \t]*)const logger\s*=\s*ctx\.get\(\s*['"]logger['"]\s*\)\s*;/;
    if (loggerDecl.test(out)) {
      out = out.replace(
        loggerDecl,
        (_match, indent) =>
          `${indent}const baseLogger = ctx.get('logger');\n` +
          `${indent}const traceId = ctx.get('requestId');\n` +
          `${indent}const logger = baseLogger?.child?.({ traceId, module: '${moduleName}' }) ?? baseLogger;`,
      );
      mutated = true;
    } else if (/ctx\.get\(\s*['"]logger['"]\s*\)/.test(out)) {
      // ctx.get('logger') used inline but not assigned at top — log as needing manual review
      skippedFiles.push({ file, reason: 'logger used inline without top-level decl — manual review' });
      continue;
    } else {
      // No ctx.get('logger') — likely uses module/imported logger; needs manual review
      skippedFiles.push({ file, reason: 'no ctx.get(logger) — needs manual review' });
      continue;
    }
  }

  // Step 2: annotate every log call that lacks `action:` with a stable per-file id.
  // The replace callback receives the start offset → use it to peek ahead into
  // the source so the existence check is accurate (previous attempt did the
  // wrong substring math and double-annotated already-tagged calls).
  const logRe = /(\blogger\s*\??\.(?:info|error|warn|debug)\s*\(\s*)(\{)/g;
  let counter = 0;
  out = out.replace(logRe, (full, prefix, brace, offset: number) => {
    counter++;
    // Find the closing `}` of this object literal to define the inspect window.
    const start = (offset as number) + (full as string).length;
    let depth = 1;
    let end = start;
    while (end < out.length && depth > 0) {
      const ch = out[end];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) break;
      end++;
    }
    const objBody = out.slice(start, end);
    if (/\baction\s*:/.test(objBody)) {
      return full as string;
    }
    logCallsAnnotated++;
    return `${prefix}${brace} action: '${fileBase}.${counter}',`;
  });

  if (logCallsAnnotated > 0) mutated = true;

  if (mutated) {
    totalUpgraded++;
    totalLogCallsAnnotated += logCallsAnnotated;
    upgradedFiles.push(file);
    if (WRITE) writeFileSync(file, out, 'utf8');
  }
}

console.log(WRITE ? '== applied ==' : '== dry-run ==');
console.log(`Scanned   : ${totalScanned}`);
console.log(`Upgraded  : ${totalUpgraded}`);
console.log(`Log calls annotated with action: ${totalLogCallsAnnotated}`);
console.log(`Skipped   : ${skippedFiles.length}`);
if (skippedFiles.length > 0 && !WRITE) {
  console.log('\nSkipped reasons:');
  const byReason: Record<string, number> = {};
  for (const s of skippedFiles) byReason[s.reason] = (byReason[s.reason] ?? 0) + 1;
  for (const [r, c] of Object.entries(byReason).sort((a, b) => b[1] - a[1])) console.log(`  ${c.toString().padStart(4)} ${r}`);
}
