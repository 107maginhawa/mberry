/**
 * Observability Audit — Wave 4.5
 *
 * Walks handlers/ (excluding jobs/ and repos/ subdirs) and scores every
 * logger.{info|error|warn|debug}(...) call site against the required field set:
 *   traceId | correlationId | requestId
 *   userId | personId | actorId | hostId | clientId
 *   module:
 *   action:
 *
 * Also counts throw-site patterns (raw Error vs typed errors).
 *
 * Outputs: docs/quality/OBSERVABILITY_AUDIT.json
 * Usage:   bun run scripts/audit-observability.ts
 */

import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const HANDLERS_ROOT = 'services/api-ts/src/handlers';
const OUT_DIR = 'docs/quality';
const OUT_JSON = join(OUT_DIR, 'OBSERVABILITY_AUDIT.json');

interface CallSite {
  file: string;
  line: number;
  level: 'info' | 'error' | 'warn' | 'debug';
  hasTraceId: boolean;
  hasTenantId: boolean;
  hasUserId: boolean;
  hasModule: boolean;
  hasAction: boolean;
  snippet: string;
}

interface ErrorSite {
  file: string;
  line: number;
  pattern: 'throw new Error' | 'throw new HTTPException' | 'throw typed';
  snippet: string;
}

function walk(d: string): string[] {
  const out: string[] = [];
  try { statSync(d); } catch { return out; }
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      // skip jobs and repos subdirs — they have their own logging concerns
      if (e.name === 'jobs' || e.name === 'repos') continue;
      out.push(...walk(join(d, e.name)));
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
      out.push(join(d, e.name));
    }
  }
  return out;
}

const logCalls: CallSite[] = [];
const errorSites: ErrorSite[] = [];

// Matches: logger?.info(...  logger.info(...  log?.error(... etc.
const LOG_RE = /(logger|log|req\.log|ctx\.log)\s*\??\.(info|error|warn|debug)\s*\(([^)]*)/;
const TYPED_ERROR_RE = /\bthrow\s+new\s+([A-Z]\w+(?:Error|Exception))\b/;

for (const f of walk(HANDLERS_ROOT)) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(LOG_RE);
    if (m) {
      const inner = m[3];
      logCalls.push({
        file: f,
        line: i + 1,
        level: m[2] as CallSite['level'],
        hasTraceId: /traceId|correlationId|requestId/.test(inner),
        hasTenantId: /tenantId|orgId|organizationId/.test(inner),
        hasUserId: /userId|personId|actorId|hostId|clientId|actorPersonId/.test(inner),
        hasModule: /module['":\s]/.test(inner),
        hasAction: /action['":\s]|action_/.test(inner),
        snippet: line.trim().slice(0, 140),
      });
    }

    if (/\bthrow\s+new\s+Error\b/.test(line)) {
      errorSites.push({ file: f, line: i + 1, pattern: 'throw new Error', snippet: line.trim().slice(0, 140) });
    } else if (/\bthrow\s+new\s+HTTPException\b/.test(line)) {
      errorSites.push({ file: f, line: i + 1, pattern: 'throw new HTTPException', snippet: line.trim().slice(0, 140) });
    } else {
      const tm = line.match(TYPED_ERROR_RE);
      if (tm && tm[1] !== 'Error' && tm[1] !== 'HTTPException') {
        errorSites.push({ file: f, line: i + 1, pattern: 'throw typed', snippet: line.trim().slice(0, 140) });
      }
    }
  }
}

// Score each file
const byFile: Record<string, {
  totalLogs: number;
  full: number;
  partial: number;
  none: number;
  rawErrors: number;
  httpExceptions: number;
  typedErrors: number;
}> = {};

for (const c of logCalls) {
  const e = byFile[c.file] ?? { totalLogs: 0, full: 0, partial: 0, none: 0, rawErrors: 0, httpExceptions: 0, typedErrors: 0 };
  e.totalLogs++;
  const scored = [c.hasTraceId, c.hasUserId, c.hasModule, c.hasAction].filter(Boolean).length;
  if (scored >= 3) e.full++;
  else if (scored >= 1) e.partial++;
  else e.none++;
  byFile[c.file] = e;
}

for (const er of errorSites) {
  const e = byFile[er.file] ?? { totalLogs: 0, full: 0, partial: 0, none: 0, rawErrors: 0, httpExceptions: 0, typedErrors: 0 };
  if (er.pattern === 'throw new Error') e.rawErrors++;
  else if (er.pattern === 'throw new HTTPException') e.httpExceptions++;
  else e.typedErrors++;
  byFile[er.file] = e;
}

// Worst offenders: weighted score = none * 2 + rawErrors
const worst = Object.entries(byFile)
  .map(([f, s]) => ({
    file: f.replace(HANDLERS_ROOT + '/', ''),
    ...s,
    score: s.none * 2 + s.rawErrors,
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 20);

const totals = {
  handlerFiles: walk(HANDLERS_ROOT).length,
  logCallSites: logCalls.length,
  full: logCalls.filter(c => [c.hasTraceId, c.hasUserId, c.hasModule, c.hasAction].filter(Boolean).length >= 3).length,
  partial: logCalls.filter(c => {
    const n = [c.hasTraceId, c.hasUserId, c.hasModule, c.hasAction].filter(Boolean).length;
    return n >= 1 && n < 3;
  }).length,
  none: logCalls.filter(c => [c.hasTraceId, c.hasUserId, c.hasModule, c.hasAction].filter(Boolean).length === 0).length,
  errorSites: errorSites.length,
  throwNewError: errorSites.filter(e => e.pattern === 'throw new Error').length,
  throwHTTPException: errorSites.filter(e => e.pattern === 'throw new HTTPException').length,
  throwTyped: errorSites.filter(e => e.pattern === 'throw typed').length,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_JSON, JSON.stringify({ generatedAt: new Date().toISOString(), totals, worstOffenders: worst, allFiles: byFile }, null, 2));

console.log('Observability audit complete →', OUT_JSON);
console.log('');
console.log('Totals:');
console.log(`  Handler files scanned : ${totals.handlerFiles}`);
console.log(`  Log call sites        : ${totals.logCallSites}`);
console.log(`  Full coverage (≥3)    : ${totals.full} (${Math.round(totals.full / totals.logCallSites * 100)}%)`);
console.log(`  Partial (1–2)         : ${totals.partial} (${Math.round(totals.partial / totals.logCallSites * 100)}%)`);
console.log(`  None (0)              : ${totals.none} (${Math.round(totals.none / totals.logCallSites * 100)}%)`);
console.log(`  Error throw sites     : ${totals.errorSites}`);
console.log(`    throw new Error     : ${totals.throwNewError}`);
console.log(`    throw new HTTPExc.  : ${totals.throwHTTPException}`);
console.log(`    throw typed         : ${totals.throwTyped}`);
console.log('');
console.log('Top 10 worst offenders:');
for (const w of worst.slice(0, 10)) {
  console.log(`  score=${w.score} none=${w.none} logs=${w.totalLogs} | ${w.file}`);
}
