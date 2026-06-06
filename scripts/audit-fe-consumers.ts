import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const APPS = ['apps/memberry/src', 'apps/admin/src'];
const HANDLER_DIRS = readdirSync('services/api-ts/src/handlers', { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);

function walk(d: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const matrix: Record<string, Record<string, number>> = {};
for (const app of APPS) {
  try { statSync(app); } catch { continue; }
  const files = walk(app);
  for (const mod of HANDLER_DIRS) {
    let hits = 0;
    for (const f of files) {
      // NOTE: colon-namespaced dirs (e.g. "association:member") won't boundary-match cleanly
      // with \b because ':' is a non-word char — hit counts for those dirs are approximate.
      let src: string;
      try {
        src = readFileSync(f, 'utf8');
      } catch (err) {
        console.error(`skip ${f}: ${(err as Error).message}`);
        continue;
      }
      const r = new RegExp(`\\b${escapeRegex(mod)}\\b`, 'gi');
      hits += (src.match(r) ?? []).length;
    }
    matrix[mod] = matrix[mod] ?? {};
    matrix[mod][app] = hits;
  }
}
console.log(JSON.stringify(matrix, null, 2));
