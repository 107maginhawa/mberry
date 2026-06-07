import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const FORBIDDEN = /^(new|make|do|process)[A-Z]/;
const STRICT = process.env.LINT_HANDLER_VERBS_STRICT === 'true';

function walk(d: string): string[] {
  const out: string[] = [];
  try { statSync(d); } catch { return out; }
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === 'jobs' || e.name === 'repos' || e.name === '__tests__') continue;
      out.push(...walk(p));
    } else if (e.name.endsWith('.ts') && !e.name.endsWith('.test.ts')) {
      out.push(p);
    }
  }
  return out;
}

interface Violation { file: string; symbol: string; line: number; exempt?: string }

const violations: Violation[] = [];

for (const f of walk('services/api-ts/src/handlers')) {
  const src = readFileSync(f, 'utf8');
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/export\s+(?:async\s+)?function\s+(\w+)/);
    if (!m) continue;
    if (!FORBIDDEN.test(m[1])) continue;
    // Check for exempt comment on this or prev line
    const exemptThis = line.match(/lint:handler-verb-exempt:\s*(.+)/);
    const exemptPrev = i > 0 ? lines[i - 1].match(/lint:handler-verb-exempt:\s*(.+)/) : null;
    const exempt = exemptThis?.[1] ?? exemptPrev?.[1];
    if (exempt) continue;
    violations.push({ file: f, symbol: m[1], line: i + 1, exempt });
  }
}

if (violations.length) {
  console.error(`Handler verb lint: ${violations.length} violation(s)`);
  for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.symbol}`);
  console.error('\nAllowed prefixes: get, list, create, update, delete, upsert, bulk, mark, cancel, complete, approve, deny, revoke, confirm, cast, certify, add, register, submit, send, renew, remove');
  console.error('Forbidden: new*, make*, do*, process*');
  console.error('Exemption: add `// lint:handler-verb-exempt: <reason>` comment on the export line.');
  if (STRICT) process.exit(1);
  else console.error('\n(warn-only mode; set LINT_HANDLER_VERBS_STRICT=true to fail)');
} else {
  console.log('Handler verbs: OK');
}
