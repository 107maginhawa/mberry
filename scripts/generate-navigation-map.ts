#!/usr/bin/env bun
/**
 * Generates per-module NAVIGATION_MAP.md anchors for the journeys verification
 * dimension. Reads CODE_ROUTE_MAP.json (engine v6 output) and a hand-tuned
 * path→module regex table, then writes 22 files under
 * docs/product/modules/{name}/NAVIGATION_MAP.md plus a consolidated top-level
 * docs/product/NAVIGATION_MAP.md.
 *
 * Re-run after any frontend route add/rename so /oli-check --journeys can
 * decompose coverage per-module instead of inferring it heuristically every
 * cycle.
 *
 * Closes CHECK_LEARNINGS `low-confidence-heuristic` row (times_seen >= 7).
 *
 * Usage: bun scripts/generate-navigation-map.ts
 */

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const ROUTE_MAP = join(ROOT, 'docs/audits/codebase-map/CODE_ROUTE_MAP.json');
const MAP_META = join(ROOT, 'docs/audits/codebase-map/.map-meta.json');
const MODULES_DIR = join(ROOT, 'docs/product/modules');

const ALL_MODULES = [
  'm01-auth-onboarding', 'm02-member-profile', 'm03-platform-admin',
  'm04-org-admin', 'm05-membership', 'm06-dues-payments',
  'm07-communications', 'm08-events', 'm09-training',
  'm10-credit-tracking', 'm11-documents-credentials', 'm12-elections-governance',
  'm13-professional-feed', 'm14-national-dashboard', 'm15-job-board',
  'm16-advertising', 'm17-marketplace', 'm18-surveys-polls',
  'm19-committee-management', 'm20-booking', 'm21-billing', 'm22-email',
] as const;

type ModuleId = typeof ALL_MODULES[number];

const MODULE_MAP: Array<[RegExp, ModuleId]> = [
  [/^\/(join|onboarding|verify-email|sign-in|sign-up|reset-password|auth)\b/, 'm01-auth-onboarding'],
  [/^\/my\/(profile|settings|id-card|organizations|data-export)\b/, 'm02-member-profile'],
  [/^\/settings\/(account|security)\b/, 'm02-member-profile'],
  [/^\/(audit|compliance|impersonate|operators|verifications|breach|impersonation|feature-flags|pricing|platform-admin|platformadmin)\b/, 'm03-platform-admin'],
  [/^\/(associations|organizations|chapters|positions|officers|governance|terms|org)\b/, 'm04-org-admin'],
  [/^\/my\/membership\b/, 'm05-membership'],
  [/^\/(members?|applicants?|memberships?|membership-applications?|approvals?|tiers?)\b/, 'm05-membership'],
  [/^\/invite\b/, 'm05-membership'],
  [/^\/my\/(dues|payments|billing)\b/, 'm06-dues-payments'],
  [/^\/(dues|payments?|invoices?|billing|stripe|funds?|dunning|pay)\b/, 'm06-dues-payments'],
  [/^\/my\/(communications|messages|notifications)\b/, 'm07-communications'],
  [/^\/(communications?|comms|announcements?|messages?|chat|dm|email|notifications?|templates?)\b/, 'm07-communications'],
  [/^\/my\/events\b/, 'm08-events'],
  [/^\/(events?|registrations?|attendance|check-?ins?|waitlist|discover)\b/, 'm08-events'],
  [/^\/my\/(training|courses|cpd)\b/, 'm09-training'],
  [/^\/(trainings?|courses?|enrollments?|cpd|ce|quizzes?|quiz-attempts?)\b/, 'm09-training'],
  [/^\/my\/credits\b/, 'm10-credit-tracking'],
  [/^\/credits?\b|\/credit-entries\b/, 'm10-credit-tracking'],
  [/^\/my\/(documents|certificates|credentials)\b/, 'm11-documents-credentials'],
  [/^\/(documents?|certificates?|files?|storage|credentials?|verify)\b/, 'm11-documents-credentials'],
  [/^\/(elections?|nominees?|votes?|nominations?)\b/, 'm12-elections-governance'],
  [/^\/(feed|posts?)\b/, 'm13-professional-feed'],
  [/^\/(dashboard|analytics|insights|reports?|exports?|national-dashboard)\b/, 'm14-national-dashboard'],
  [/^\/(jobs?|job-board)\b/, 'm15-job-board'],
  [/^\/(advertis|ad-campaigns?|ad-creatives?)\b/, 'm16-advertising'],
  [/^\/(marketplace|products?)\b/, 'm17-marketplace'],
  [/^\/my\/(surveys|reviews)\b/, 'm18-surveys-polls'],
  [/^\/(surveys?|polls?|nps|reviews?)\b/, 'm18-surveys-polls'],
  [/^\/(committees?|committee-management)\b/, 'm19-committee-management'],
  [/^\/my\/(bookings|calendar|schedule)\b/, 'm20-booking'],
  [/^\/(bookings?|bookable|time-slots|schedule-exceptions)\b/, 'm20-booking'],
  [/^\/(stripe-connect|billing-config|subscriptions?)\b/, 'm21-billing'],
  [/^\/(email-queue|email-templates?|email-suppression)\b/, 'm22-email'],
];

interface RouteRow {
  path: string;
  logical: string;
  page: string | null;
  app: string;
  auth: boolean | null;
  params: string[];
  middleware: string[];
}

function logical(p: string): string {
  return p.replace(/^\/_authenticated\b/, '')
          .replace(/^\/_admin\b/, '')
          .replace(/^\/\(auth\)\b/, '')
          .replace(/^\/_layout\b/, '') || '/';
}

/** Strip org-scope and role-scope prefixes so leaf-module tokens win
 *  the regex matching below. Without this, routes like
 *  `/org/$slug/elections/$id/vote` bucket under m04-org-admin
 *  instead of m12-elections. */
function leafPath(p: string): string {
  const L = logical(p);
  return L.replace(/^\/org\/\$?\w+\/officer\//, '/')
          .replace(/^\/org\/\$?\w+\//, '/')
          .replace(/^\/associations\/\$?\w+\/officer\//, '/')
          .replace(/^\/associations\/\$?\w+\//, '/');
}

function mapModule(p: string): ModuleId | null {
  // First pass: try the leaf path (strips org-scope prefix). This routes
  // `/org/$slug/elections/$id` to m12-elections via the leaf token.
  const leaf = leafPath(p);
  for (const [re, mod] of MODULE_MAP) {
    // Skip the m04-org-admin generic catch-all on the leaf pass — that one
    // needs the un-stripped path to fire (after no leaf token matched).
    if (mod === 'm04-org-admin') continue;
    if (re.test(leaf)) return mod;
  }
  // Fallback: try the original logical path. This catches m04-org-admin's
  // bare `/associations/` and `/org/` entry points that have no leaf module.
  const L = logical(p);
  for (const [re, mod] of MODULE_MAP) if (re.test(L)) return mod;
  return null;
}

function renderModuleFile(mod: ModuleId, rows: RouteRow[], sha: string, mapSha: string): string {
  const ts = new Date().toISOString();
  const lines: string[] = [];
  lines.push('---');
  lines.push('name: navigation-map');
  lines.push(`module: ${mod}`);
  lines.push(`route-count: ${rows.length}`);
  lines.push('derivation: heuristic-path-tokens-from-CODE_ROUTE_MAP');
  lines.push(`derived-from-head: ${sha}`);
  lines.push(`derived-from-map: ${mapSha}`);
  lines.push(`last-generated: ${ts}`);
  lines.push('last-generated-by: scripts/generate-navigation-map.ts (P2-14)');
  lines.push(`status: ${rows.length === 0 ? 'NO-UI (deferred or backend-only)' : 'INFERRED — needs human review'}`);
  lines.push('---');
  lines.push('');
  lines.push(`# Navigation Map — ${mod}`);
  lines.push('');
  lines.push('**Anchor file for the journeys verification dimension.** Declares which frontend routes belong to this product module, so `/oli-check --journeys` decomposes coverage per-module instead of inferring it heuristically every cycle.');
  lines.push('');
  if (rows.length === 0) {
    lines.push('## Status: no frontend routes');
    lines.push('');
    lines.push('This module currently has zero routes mapped to it. Possible reasons:');
    lines.push('- The module is **deferred to a future milestone** (see MASTER_PRD v3.0 descope list — m13/m15/m16/m17 are explicitly future-scope).');
    lines.push("- The module is **backend-only** (m22-email's queue is API-only; no UI surface).");
    lines.push('- Routes exist but the path-token heuristic in `scripts/generate-navigation-map.ts` failed to map them — review the unmapped block in the consolidated `docs/product/NAVIGATION_MAP.md` and add a regex.');
    lines.push('');
    lines.push('Journeys dimension treats this as `⊘ no-ui` in the coverage matrix (not a gap).');
    return lines.join('\n') + '\n';
  }
  lines.push(`## Routes (${rows.length})`);
  lines.push('');
  lines.push('| Path | Logical | Page Component | App | Auth | Params | Middleware |');
  lines.push('|------|---------|----------------|-----|------|--------|------------|');
  for (const r of rows) {
    const params = r.params.join(', ') || '—';
    const mw = r.middleware.join(', ') || '—';
    const page = r.page ?? '—';
    const auth = r.auth === true ? 'yes' : r.auth === false ? 'no' : '—';
    const appShort = r.app === 'apps/memberry' ? 'memberry' : r.app === 'apps/admin' ? 'admin' : r.app;
    lines.push(`| \`${r.path}\` | \`${r.logical}\` | ${page} | ${appShort} | ${auth} | ${params} | ${mw} |`);
  }
  lines.push('');
  lines.push('## Derivation');
  lines.push('');
  lines.push(`Generated by \`scripts/generate-navigation-map.ts\` from \`docs/audits/codebase-map/CODE_ROUTE_MAP.json\` at HEAD \`${sha}\`. The path→module mapping uses a hand-tuned regex table; results are \`[INFERRED]\` and require human review where the route's intent is ambiguous. To regenerate after a route add/rename, run the generator and commit the diff.`);
  lines.push('');
  lines.push('## How journeys consumes this');
  lines.push('');
  lines.push("The journeys dimension reads this file to determine which routes' coverage attributes (page-load latency, nav-link integrity, error-boundary presence, role-gate enforcement) roll up to this module's verdict in the coverage matrix. Without an explicit NAVIGATION_MAP, journeys infers module ownership from the route path tokens at every run — slower, brittle, and not declared.");
  return lines.join('\n') + '\n';
}

function renderConsolidated(byModule: Record<string, RouteRow[]>, sha: string, mapSha: string, totalRoutes: number): string {
  const ts = new Date().toISOString();
  const lines: string[] = [];
  lines.push('---');
  lines.push('name: navigation-map-consolidated');
  lines.push(`route-count: ${totalRoutes}`);
  lines.push(`derived-from-head: ${sha}`);
  lines.push(`derived-from-map: ${mapSha}`);
  lines.push(`last-generated: ${ts}`);
  lines.push('last-generated-by: scripts/generate-navigation-map.ts (P2-14)');
  lines.push('---');
  lines.push('');
  lines.push('# Navigation Map — Consolidated');
  lines.push('');
  lines.push(`Top-level index of all ${totalRoutes} frontend routes across both apps, bucketed by product module. See per-module \`docs/product/modules/{name}/NAVIGATION_MAP.md\` for the full route table per module.`);
  lines.push('');
  lines.push('## Schema (canonical)');
  lines.push('');
  lines.push('Each per-module `NAVIGATION_MAP.md` file carries frontmatter declaring:');
  lines.push('- `name: navigation-map` — sentinel for journeys-dim consumers');
  lines.push('- `module: m{NN}-{slug}` — the product module ID this file anchors');
  lines.push('- `route-count: <int>` — number of routes assigned to this module');
  lines.push('- `derivation: heuristic-path-tokens-from-CODE_ROUTE_MAP` — provenance');
  lines.push('- `derived-from-head: <git_sha>` — code anchor');
  lines.push('- `derived-from-map: <map_sha>` — codebase-map snapshot anchor');
  lines.push('- `last-generated: <ISO-8601>` — regeneration timestamp');
  lines.push('- `status: INFERRED | NO-UI (deferred|backend-only) | HUMAN-REVIEWED`');
  lines.push('');
  lines.push('Body is a table of routes (path, logical, page_component, app, auth, params, middleware) plus a how-to-consume section.');
  lines.push('');
  lines.push('## Module distribution');
  lines.push('');
  lines.push('| Module | Routes | Status |');
  lines.push('|--------|--------|--------|');
  for (const mod of ALL_MODULES) {
    const rows = byModule[mod] || [];
    const status = rows.length === 0 ? '⊘ no-ui' : 'INFERRED';
    lines.push(`| ${mod} | ${rows.length} | ${status} |`);
  }
  lines.push('');
  lines.push('## Re-generation');
  lines.push('');
  lines.push('```sh');
  lines.push('bun scripts/generate-navigation-map.ts');
  lines.push('git add docs/product/NAVIGATION_MAP.md docs/product/modules/*/NAVIGATION_MAP.md');
  lines.push("git commit -m 'docs(nav-map): regenerate after route changes'");
  lines.push('```');
  lines.push('');
  lines.push('Re-run after any route add, rename, or removal. Always commit alongside the route change.');
  return lines.join('\n') + '\n';
}

function main(): void {
  if (!existsSync(ROUTE_MAP)) {
    console.error(`ERROR: CODE_ROUTE_MAP not found at ${ROUTE_MAP}. Run \`oli-engine scan . --write\` first.`);
    process.exit(1);
  }
  const j = JSON.parse(readFileSync(ROUTE_MAP, 'utf8')) as { routes: Record<string, Omit<RouteRow, 'path' | 'logical'>> };
  const sha = execSync('git rev-parse HEAD').toString().trim().slice(0, 8);
  const mapMeta = JSON.parse(readFileSync(MAP_META, 'utf8')) as { git_sha?: string };
  const mapSha = mapMeta.git_sha?.slice(0, 8) ?? 'unknown';

  const routes: RouteRow[] = Object.entries(j.routes).map(([path, meta]) => ({
    path,
    logical: logical(path),
    page: (meta as any).page_component ?? null,
    app: (meta as any).module ?? 'unknown',
    auth: (meta as any).auth_required ?? null,
    params: (meta as any).params ?? [],
    middleware: (meta as any).middleware ?? [],
  }));

  const byModule: Record<string, RouteRow[]> = {};
  for (const r of routes) {
    const mod = mapModule(r.path);
    const key = mod ?? (r.logical === '/' ? 'shared-root' : 'unmapped');
    if (!byModule[key]) byModule[key] = [];
    byModule[key].push(r);
  }

  let written = 0;
  for (const mod of ALL_MODULES) {
    const rows = byModule[mod] ?? [];
    const dir = join(MODULES_DIR, mod);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'NAVIGATION_MAP.md'), renderModuleFile(mod, rows, sha, mapSha));
    written++;
  }

  writeFileSync(join(ROOT, 'docs/product/NAVIGATION_MAP.md'),
    renderConsolidated(byModule, sha, mapSha, routes.length));

  console.log(`Wrote ${written} per-module NAVIGATION_MAP.md + 1 consolidated`);
  console.log(`Total routes: ${routes.length}`);
  for (const mod of ALL_MODULES) {
    const count = (byModule[mod] ?? []).length;
    console.log(`  ${mod}: ${count}`);
  }
  if (byModule.unmapped?.length) {
    console.log(`WARN: ${byModule.unmapped.length} unmapped routes — add regex to MODULE_MAP:`);
    for (const r of byModule.unmapped) console.log(`  ${r.path}`);
  }
}

main();
