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

// Detect child-logger / module-logger / forBindings constructs that bind
// observability fields once at file scope. If a file establishes such a
// binding, every log call below it inherits those fields — the per-call
// regex below should treat them as present, otherwise we under-credit the
// industry-standard pattern recommended in OBSERVABILITY_HANDOFF.md.
// Match both `.child({...})` and `?.child?.({...})` chains.
const CHILD_BIND_RE = /\??\.child\??\.?\s*\(\s*\{([^}]*)\}/;
const FOR_BINDINGS_RE = /\??\.forBindings\??\.?\s*\(\s*\{([^}]*)\}/;
const MODULE_LOGGER_RE = /createModuleLogger\s*\(\s*['"]([^'"]+)['"]/;

function detectFileBindings(src: string): {
  hasTraceId: boolean;
  hasTenantId: boolean;
  hasUserId: boolean;
  hasModule: boolean;
} {
  const bindings = { hasTraceId: false, hasTenantId: false, hasUserId: false, hasModule: false };
  const matchers = [CHILD_BIND_RE, FOR_BINDINGS_RE];
  for (const re of matchers) {
    const m = src.match(re);
    if (!m) continue;
    const inner = m[1];
    if (/traceId|correlationId|requestId/.test(inner)) bindings.hasTraceId = true;
    if (/tenantId|orgId|organizationId/.test(inner)) bindings.hasTenantId = true;
    if (/userId|personId|actorId|hostId|clientId|actorPersonId/.test(inner)) bindings.hasUserId = true;
    if (/module['":\s]/.test(inner)) bindings.hasModule = true;
  }
  // createModuleLogger('booking') binds module + (typically) traceId via host context
  if (MODULE_LOGGER_RE.test(src)) bindings.hasModule = true;
  return bindings;
}

// Walk forward from the index of the opening `{` of a log call's first arg
// to find the matching `}`. Returns the substring between them so multi-line
// object literals don't get truncated by the per-line LOG_RE.
function captureLogObject(src: string, startBraceIdx: number): string {
  let depth = 0;
  let i = startBraceIdx;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(startBraceIdx + 1, i);
    }
    i++;
  }
  return src.slice(startBraceIdx);
}

const LOG_RE_GLOBAL = /(logger|log|req\.log|ctx\.log)\s*\??\.(info|error|warn|debug)\s*\(/g;

for (const f of walk(HANDLERS_ROOT)) {
  const src = readFileSync(f, 'utf8');
  const fileBindings = detectFileBindings(src);
  const lines = src.split('\n');

  // Compute line numbers from offsets.
  const lineStartOffsets: number[] = [0];
  for (let i = 0; i < src.length; i++) if (src[i] === '\n') lineStartOffsets.push(i + 1);
  function lineFromOffset(off: number): number {
    let lo = 0, hi = lineStartOffsets.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStartOffsets[mid]! <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  // Capture every log call with its full first-arg body (multi-line aware).
  let lm: RegExpExecArray | null;
  LOG_RE_GLOBAL.lastIndex = 0;
  while ((lm = LOG_RE_GLOBAL.exec(src)) !== null) {
    const callStart = lm.index + lm[0].length;
    // Find next non-whitespace char — expect `{` to read object literal.
    let p = callStart;
    while (p < src.length && /\s/.test(src[p]!)) p++;
    let inner = '';
    if (src[p] === '{') inner = captureLogObject(src, p);
    else {
      // First arg not a literal — fall back to line slice.
      const line = lines[lineFromOffset(lm.index) - 1] || '';
      inner = line.slice(line.indexOf('(') + 1);
    }
    logCalls.push({
      file: f,
      line: lineFromOffset(lm.index),
      level: lm[2] as CallSite['level'],
      hasTraceId: fileBindings.hasTraceId || /traceId|correlationId|requestId/.test(inner),
      hasTenantId: fileBindings.hasTenantId || /tenantId|orgId|organizationId/.test(inner),
      hasUserId: fileBindings.hasUserId || /\b(userId|personId|actorId|hostId|clientId|actorPersonId)\b/.test(inner),
      hasModule: fileBindings.hasModule || /module['":\s]/.test(inner),
      hasAction: /\baction\s*:/.test(inner),
      snippet: (lines[lineFromOffset(lm.index) - 1] || '').trim().slice(0, 140),
    });
  }

  // Error throw scan — still per-line; throws live on one line in practice.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
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
