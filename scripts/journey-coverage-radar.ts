/**
 * Journey-coverage review radar (Track 2, lean — ADVISORY, never blocks).
 *
 * Maps a PR's changed backend handler modules to the must-never-break journeys
 * (`// @journey-firewall` specs) that exercise them, and warns when a touched
 * flow has NO covering journey — a nudge to add/extend a firewall journey.
 *
 * Heuristic by design: it matches handler-dir names against the API path
 * segments the journeys call. It does NOT use the (skipped) whole-repo
 * knowledge graph. Always exits 0; this is a warning, not a gate.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';

const STOP = new Set(['api', 'me', 'my', 'org', 'public', 'mine', 'v1', '']);

/** API path segments a journey spec exercises (handler-flow tokens). */
export function journeyTokens(src: string): string[] {
  const toks = new Set<string>();
  const strRe = /['"`]([^'"`]*\/[^'"`]*)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = strRe.exec(src))) {
    const path = m[1]!;
    if (!path.startsWith('/')) continue;
    for (let seg of path.split('/')) {
      seg = (seg.split('?')[0] ?? '').trim();
      if (!seg || seg.startsWith('{') || seg.startsWith('$') || /^\d+$/.test(seg)) continue;
      if (STOP.has(seg)) continue;
      if (!/^[a-z][a-z0-9-]+$/.test(seg)) continue;
      toks.add(seg);
    }
  }
  return [...toks];
}

/** Backend handler module dir for a changed file, or null if not a flow file. */
export function moduleOf(path: string): string | null {
  const m = path.match(/services\/api-ts\/src\/handlers\/([^/]+)\//);
  return m ? m[1]! : null;
}

export interface ChangedModule {
  file: string;
  module: string;
}

/** Split touched handler modules into journey-covered vs uncovered (deduped by module). */
export function classifyChanges(
  changed: string[],
  journeyTokenSet: Set<string>,
): { covered: ChangedModule[]; uncovered: ChangedModule[] } {
  const covered: ChangedModule[] = [];
  const uncovered: ChangedModule[] = [];
  const seen = new Set<string>();
  const tokens = [...journeyTokenSet];
  for (const file of changed) {
    const module = moduleOf(file);
    if (!module || seen.has(module)) continue;
    seen.add(module);
    const isCovered = tokens.some(
      (t) => t.length >= 3 && module.length >= 3 && (t.includes(module) || module.includes(t)),
    );
    (isCovered ? covered : uncovered).push({ file, module });
  }
  return { covered, uncovered };
}

const JOURNEY_MARKER = /^[ \t]*\/\/[ \t]*@journey-firewall\b/m;
const E2E_ROOTS = ['apps/memberry/tests/e2e', 'apps/admin/tests/e2e'];

function walk(d: string): string[] {
  const out: string[] = [];
  try { statSync(d); } catch { return out; }
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (p.endsWith('.spec.ts')) out.push(p);
  }
  return out;
}

function main() {
  const base =
    process.env.RADAR_BASE ||
    (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/main');
  let changed: string[] = [];
  try {
    const range = execSync(`git merge-base ${base} HEAD`, { encoding: 'utf8' }).trim();
    changed = execSync(`git diff --name-only ${range} HEAD`, { encoding: 'utf8' })
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    try {
      changed = execSync('git diff --name-only HEAD~1 HEAD', { encoding: 'utf8' })
        .split('\n').map((s) => s.trim()).filter(Boolean);
    } catch {
      console.log('journey-coverage radar: no diff base available — skipping (advisory).');
      return;
    }
  }

  const journeySpecs = E2E_ROOTS.flatMap((r) => walk(r)).filter((f) =>
    JOURNEY_MARKER.test(readFileSync(f, 'utf8')),
  );
  const tokenSet = new Set<string>();
  for (const f of journeySpecs) for (const t of journeyTokens(readFileSync(f, 'utf8'))) tokenSet.add(t);

  const { covered, uncovered } = classifyChanges(changed, tokenSet);

  console.log(`\n── Journey-coverage radar (advisory) ─ base ${base} ──`);
  console.log(`@journey-firewall journeys: ${journeySpecs.length} | changed handler modules: ${covered.length + uncovered.length}`);
  if (covered.length) {
    console.log(`✓ covered by a journey: ${covered.map((c) => c.module).join(', ')}`);
  }
  if (uncovered.length) {
    console.log(`⚠ touched flow with NO covering must-never-break journey:`);
    for (const u of uncovered) console.log(`    • ${u.module}  (${u.file})`);
    console.log(`  Consider adding/extending a // @journey-firewall journey (see CONTRIBUTING.md).`);
  } else if (covered.length) {
    console.log('All touched backend flows are covered by a must-never-break journey.');
  } else {
    console.log('No backend handler modules changed.');
  }
  console.log('(Heuristic, advisory — does not block. Whole-repo knowledge graph intentionally skipped.)\n');
}

if (import.meta.main) main();
