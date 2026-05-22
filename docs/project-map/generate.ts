#!/usr/bin/env bun
/**
 * Project Map Generator
 *
 * Reads 5 sources, generates 4 markdown files:
 *   - INDEX.md           (dashboard)
 *   - routes.generated.md (route inventory)
 *   - br-coverage.generated.md (BR coverage)
 *   - gaps.generated.md  (cross-referenced gaps)
 *
 * Usage: bun docs/project-map/generate.ts
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, relative } from "path";
import { Glob } from "bun";

const ROOT = resolve(import.meta.dir, "../..");
const OUT = import.meta.dir;

// ── Routes to skip (redirects, layout wrappers — not standalone pages) ──
const SKIP_ROUTES = new Set([
  "/index",                  // Pure redirect: auth → /dashboard, guest → /auth/sign-in
  "/org/$orgId/officer",     // Layout wrapper with <Outlet />, not a standalone page
]);

// ── Source paths ──────────────────────────────────────────────
const ROUTE_TREE = resolve(ROOT, "apps/memberry/src/routeTree.gen.ts");
const BR_REGISTRY = resolve(ROOT, "docs/ver-3/business/br-registry.json");
const PERSONAS_DOC = resolve(ROOT, "docs/ver-3/business/personas-and-roles.md");
const JOURNEYS_FILE = resolve(OUT, "journeys.md");
const E2E_DIR = resolve(ROOT, "apps/memberry/tests/e2e");

// ── Types ─────────────────────────────────────────────────────
interface RouteInfo {
  path: string;
  group: "public" | "authenticated" | "officer";
  hasE2E: boolean;
  e2eFiles: string[];
}

type RuleClass = "p0-security" | "p0-data" | "p0-auth" | "p1-business" | "p2-deferred";

interface BrInfo {
  id: string;
  rule: string;
  phase: number;
  module: string;
  ruleClass: RuleClass;
  coverage: string; // derived, not stored
  deferredReason?: string;
  annotations?: string;
  tests: { backend: string[]; contract: string[]; e2e: string[] };
}

function deriveBrCoverage(ruleClass: RuleClass, tests: { backend: string[]; contract: string[]; e2e: string[] }): string {
  if (ruleClass === "p2-deferred") {
    return tests.backend.length > 0 ? "DEFERRED" : "UNTESTED";
  }
  const hasBackend = tests.backend.length > 0;
  const hasContract = tests.contract.length > 0;
  const hasE2e = tests.e2e.length > 0;
  if (!hasBackend) return "UNTESTED";
  switch (ruleClass) {
    case "p0-security": return hasContract ? "COMPLETE" : "INCOMPLETE";
    case "p0-data":
    case "p0-auth": return (hasContract && hasE2e) ? "COMPLETE" : "INCOMPLETE";
    case "p1-business": return (hasContract || hasE2e) ? "COMPLETE" : "INCOMPLETE";
    default: return "INCOMPLETE";
  }
}

interface JourneyStep {
  route: string;
  description: string;
}

interface Journey {
  id: string;
  title: string;
  persona: string;
  priority: string;
  status: string;
  steps: JourneyStep[];
  brs: string[];
}

type GapType =
  | "route-no-test"
  | "br-no-coverage"
  | "br-stub-only"
  | "br-partial"
  | "journey-untested"
  | "journey-dead-link"
  | "persona-unmapped";

interface Gap {
  type: GapType;
  target: string;
  detail: string;
  priority: string;
}

// ── 1. Parse routes from routeTree.gen.ts ─────────────────────
function parseRoutes(): RouteInfo[] {
  const content = readFileSync(ROUTE_TREE, "utf-8");
  const routes: RouteInfo[] = [];
  const seen = new Set<string>();

  // Strategy: parse import lines to derive full paths from file structure.
  // Import format: import { Route as XxxRouteImport } from './routes/path/to/file'
  const importRegex = /from\s+'\.\/routes\/([^']+)'/g;
  let match: RegExpExecArray | null;

  while ((match = importRegex.exec(content)) !== null) {
    let filePath = match[1];

    // Skip __root
    if (filePath === "__root") continue;

    // Convert file path to route path:
    // _authenticated/org/$orgId/officer/payments/index → /org/$orgId/officer/payments
    // _authenticated/my/credits/log → /my/credits/log
    // auth/$authView → /auth/$authView
    // onboarding → /onboarding

    // Strip _authenticated/ prefix (layout route, not a path segment)
    filePath = filePath.replace(/^_authenticated\//, "");

    // Strip /index suffix (index routes)
    filePath = filePath.replace(/\/index$/, "");

    // Skip bare _authenticated (layout wrapper, not a real page)
    if (filePath === "_authenticated") continue;

    const routePath = "/" + filePath;

    if (seen.has(routePath)) continue;
    seen.add(routePath);

    // Skip redirect-only routes and layout wrappers
    if (SKIP_ROUTES.has(routePath)) continue;

    // Determine group
    let group: RouteInfo["group"] = "public";
    if (match[1].startsWith("_authenticated")) {
      group = routePath.includes("/officer") ? "officer" : "authenticated";
    }

    routes.push({ path: routePath, group, hasE2E: false, e2eFiles: [] });
  }

  return routes;
}

// ── 2. Scan E2E test files for route references ───────────────
// Also tracks which files are stub-only (all tests are .fixme or .skip)
const stubOnlyFiles = new Set<string>();

function scanE2ETests(): Map<string, string[]> {
  const routeToTests = new Map<string, string[]>();
  const glob = new Glob("**/*.spec.ts");

  for (const file of glob.scanSync(E2E_DIR)) {
    const fullPath = resolve(E2E_DIR, file);
    const content = readFileSync(fullPath, "utf-8");
    const relPath = relative(ROOT, fullPath);

    // Detect stub-only files: all test calls are .fixme() or .skip()
    const hasRealTests = /test\s*\(/.test(content) && !/test\s*\(/.test(content.replace(/test\.fixme\s*\(/g, "").replace(/test\.skip\s*\(/g, ""));
    const hasFixmeOrSkip = /test\.(fixme|skip)\s*\(/.test(content);
    if (hasFixmeOrSkip && !hasRealTests) {
      stubOnlyFiles.add(relPath);
    }

    // Extract page.goto paths — handles both quoted strings and template literals
    // Match: page.goto(`/org/${VAR}/officer/settings/dues`)
    // Match: page.goto('/my/profile')
    const gotoRegex = /page\.goto\(([`'"])(.+?)\1\)/g;
    let m: RegExpExecArray | null;
    while ((m = gotoRegex.exec(content)) !== null) {
      let routePath = m[2];
      // Replace template literal expressions ${...} with $_ placeholder
      routePath = routePath.replace(/\$\{[^}]+\}/g, "$_");
      // Strip query params
      routePath = routePath.split("?")[0];
      // Replace UUIDs with $_
      routePath = routePath.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/$_"
      );
      // Replace numeric IDs
      routePath = routePath.replace(/\/\d+(?=\/|$)/g, "/$_");

      // Skip stub-only files — they don't provide real coverage
      if (!stubOnlyFiles.has(relPath)) {
        const existing = routeToTests.get(routePath) ?? [];
        if (!existing.includes(relPath)) {
          existing.push(relPath);
        }
        routeToTests.set(routePath, existing);
      }
    }

    // Also match navigate({ to: '/path' }) or navigate({ to: `template` })
    const navRegex = /navigate\(\{[^}]*to:\s*([`'"])(.+?)\1/g;
    while ((m = navRegex.exec(content)) !== null) {
      let routePath = m[2].replace(/\$\{[^}]+\}/g, "$_").split("?")[0];
      if (!stubOnlyFiles.has(relPath)) {
        const existing = routeToTests.get(routePath) ?? [];
        if (!existing.includes(relPath)) {
          existing.push(relPath);
        }
        routeToTests.set(routePath, existing);
      }
    }
  }

  return routeToTests;
}

// ── Helper: normalize path for matching ───────────────────────
function normalizePath(p: string): string {
  return p
    .replace(/\$\{[^}]+\}/g, "$_") // ${ORG_ID} → $_
    .replace(/\$\w+/g, "$_")       // $orgId, $param, $token → $_
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/$_") // UUIDs
    .replace(/\/\/$/, "/")          // double slash
    .replace(/\/$/, "");            // trailing slash
}

// ── Helper: build regex matchers for parameterized routes ────
// Converts /auth/$authView → /auth/[^/]+ so literal paths like /auth/sign-in match
interface RouteMatcher {
  route: RouteInfo;
  regex: RegExp;
}

function buildRouteMatchers(routes: RouteInfo[]): RouteMatcher[] {
  return routes.map((r) => {
    const pattern = r.path
      .replace(/\$\w+/g, "[^/]+") // $orgId → [^/]+
      .replace(/\//g, "\\/");      // escape slashes
    return { route: r, regex: new RegExp(`^${pattern}$`) };
  });
}

// ── 3. Match routes to E2E tests ──────────────────────────────
function matchRoutesToTests(
  routes: RouteInfo[],
  e2eMap: Map<string, string[]>
): void {
  const matchers = buildRouteMatchers(routes);

  for (const matcher of matchers) {
    for (const [testPath, files] of e2eMap) {
      // Parameterized match: route /auth/$authView matches test path /auth/sign-in
      // Also handles exact matches (regex still works for non-parameterized routes)
      if (matcher.regex.test(testPath)) {
        matcher.route.hasE2E = true;
        matcher.route.e2eFiles.push(
          ...files.filter((f) => !matcher.route.e2eFiles.includes(f))
        );
      }
    }
  }
}

// ── 4. Parse BR registry ─────────────────────────────────────
function parseBRs(): BrInfo[] {
  const raw = JSON.parse(readFileSync(BR_REGISTRY, "utf-8"));
  return Object.entries(raw).map(([id, data]: [string, any]) => {
    const ruleClass: RuleClass = data.ruleClass ?? "p1-business";
    const tests = {
      backend: data.tests?.backend ?? [],
      contract: data.tests?.contract ?? [],
      e2e: data.tests?.e2e ?? [],
    };
    return {
      id,
      rule: data.rule,
      phase: data.phase,
      module: data.module,
      ruleClass,
      coverage: deriveBrCoverage(ruleClass, tests),
      deferredReason: data.deferredReason,
      annotations: data.annotations,
      tests,
    };
  });
}

// ── 5. Parse personas ─────────────────────────────────────────
function parsePersonas(): string[] {
  const content = readFileSync(PERSONAS_DOC, "utf-8");
  const personas: string[] = [];
  const regex = /###\s+P\d+:\s+(.+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    personas.push(m[1].trim());
  }
  return personas;
}

// ── 6. Parse journeys ─────────────────────────────────────────
function parseJourneys(): Journey[] {
  if (!existsSync(JOURNEYS_FILE)) return [];

  const content = readFileSync(JOURNEYS_FILE, "utf-8");
  const journeys: Journey[] = [];
  let currentPersona = "";
  let currentJourney: Journey | null = null;

  for (const line of content.split("\n")) {
    // ## Persona: Name
    const personaMatch = line.match(/^##\s+Persona:\s+(.+)/);
    if (personaMatch) {
      currentPersona = personaMatch[1].trim();
      continue;
    }

    // ### J-XX: Title
    const journeyMatch = line.match(/^###\s+(J-\w+):\s+(.+)/);
    if (journeyMatch) {
      if (currentJourney) journeys.push(currentJourney);
      currentJourney = {
        id: journeyMatch[1],
        title: journeyMatch[2].trim(),
        persona: currentPersona,
        priority: "P1",
        status: "mapped",
        steps: [],
        brs: [],
      };
      continue;
    }

    if (!currentJourney) continue;

    // Step: 1. GET /path → description
    const stepMatch = line.match(/^\d+\.\s+(?:GET|POST|PUT|PATCH|DELETE)?\s*(\/\S+)\s*[→-]\s*(.+)/);
    if (stepMatch) {
      currentJourney.steps.push({
        route: stepMatch[1].trim(),
        description: stepMatch[2].trim(),
      });
      continue;
    }

    // - BRs: BR-01, BR-02
    const brMatch = line.match(/^-\s+BRs?:\s+(.+)/);
    if (brMatch) {
      currentJourney.brs = brMatch[1].split(",").map((s) => s.trim());
      continue;
    }

    // - Priority: P0
    const prioMatch = line.match(/^-\s+Priority:\s+(P\d)/);
    if (prioMatch) {
      currentJourney.priority = prioMatch[1];
      continue;
    }

    // - Status: mapped
    const statusMatch = line.match(/^-\s+Status:\s+(\w+)/);
    if (statusMatch) {
      currentJourney.status = statusMatch[1];
    }
  }

  if (currentJourney) journeys.push(currentJourney);
  return journeys;
}

// ── 7. Generate gaps ──────────────────────────────────────────
function generateGaps(
  routes: RouteInfo[],
  brs: BrInfo[],
  journeys: Journey[],
  personas: string[]
): Gap[] {
  const gaps: Gap[] = [];

  // Routes without tests
  for (const route of routes) {
    if (!route.hasE2E && route.path !== "/") {
      gaps.push({
        type: "route-no-test",
        target: route.path,
        detail: `No E2E test covers ${route.path} (${route.group})`,
        priority: "P2",
      });
    }
  }

  // BR coverage gaps (rule-class-based)
  for (const br of brs) {
    if (br.coverage === "DEFERRED") continue; // Skip deferred — not actionable now

    if (br.coverage === "UNTESTED") {
      gaps.push({
        type: "br-no-coverage",
        target: br.id,
        detail: `${br.id} (${br.rule}) has no tests at any layer`,
        priority: "P0",
      });
    } else if (br.coverage === "INCOMPLETE") {
      const annotation = br.annotations ? ` — ${br.annotations}` : "";
      gaps.push({
        type: "br-partial",
        target: br.id,
        detail: `${br.id} (${br.rule}) [${br.ruleClass}] is INCOMPLETE${annotation}`,
        priority: br.ruleClass.startsWith("p0-") ? "P0" : "P1",
      });
    }

    // Stub detection: BR has tests but annotations flag them as shallow
    if (br.annotations && /stub|smoke|not.*verified|not.*tested/i.test(br.annotations) && br.coverage === "COMPLETE") {
      gaps.push({
        type: "br-stub-only",
        target: br.id,
        detail: `${br.id} (${br.rule}) meets layer requirements but has quality concerns: ${br.annotations}`,
        priority: "P2",
      });
    }
  }

  // Journey-based gaps — reuse shared route matchers
  const routeMatchers = buildRouteMatchers(routes);

  function findMatchingRoute(stepRoute: string): RouteInfo | undefined {
    // Exact match first
    const exact = routes.find((r) => r.path === stepRoute);
    if (exact) return exact;

    // Parameterized match: /auth/sign-in matches /auth/$authView
    for (const { route, regex } of routeMatchers) {
      if (regex.test(stepRoute)) return route;
    }

    // Reverse: journey uses $orgId, route also uses $orgId
    const stepNorm = normalizePath(stepRoute);
    return routes.find((r) => normalizePath(r.path) === stepNorm);
  }

  for (const journey of journeys) {
    // Skip deferred journeys (e.g., routes in different apps)
    if (journey.status === "deferred") continue;

    for (const step of journey.steps) {
      const matchedRoute = findMatchingRoute(step.route);

      // Dead link check
      if (!matchedRoute) {
        gaps.push({
          type: "journey-dead-link",
          target: `${journey.id} → ${step.route}`,
          detail: `Journey ${journey.id} references nonexistent route ${step.route}`,
          priority: journey.priority,
        });
      }

      // Untested journey step
      if (matchedRoute && !matchedRoute.hasE2E) {
        gaps.push({
          type: "journey-untested",
          target: `${journey.id} step: ${step.route}`,
          detail: `Journey ${journey.id} step "${step.description}" route has no E2E test`,
          priority: journey.priority,
        });
      }
    }

    // BR coverage for journey
    for (const brRef of journey.brs) {
      const br = brs.find((b) => b.id === brRef);
      if (br && br.coverage !== "COMPLETE" && br.coverage !== "DEFERRED") {
        gaps.push({
          type: "br-partial",
          target: `${journey.id} → ${brRef}`,
          detail: `Journey ${journey.id} depends on ${brRef} (${br.rule}) which is ${br.coverage}`,
          priority: journey.priority,
        });
      }
    }
  }

  // Unmapped personas — match by extracting key role words
  const mappedPersonas = new Set(journeys.map((j) => j.persona));
  const mappedRoleWords = [...mappedPersonas].map((p) =>
    p.toLowerCase().replace(/\(.*\)/, "").trim().split(/\s+/)
  );
  for (const persona of personas) {
    const personaLower = persona.toLowerCase();
    const personaWords = personaLower.replace(/\(.*\)/, "").trim().split(/\s+/);
    // Match if first keyword matches (e.g., "Member" matches "Member (Dr. Maria Santos)")
    const isMapped = mappedRoleWords.some((words) =>
      words[0] === personaWords[0] || // "member" = "member"
      personaLower.includes(words.join(" ")) ||
      words.join(" ").includes(personaWords.join(" "))
    );
    if (!isMapped) {
      gaps.push({
        type: "persona-unmapped",
        target: persona,
        detail: `Persona "${persona}" has no journeys defined in journeys.md`,
        priority: "P2",
      });
    }
  }

  // Sort: P0 first, then P1, P2
  const prioOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  gaps.sort((a, b) => (prioOrder[a.priority] ?? 9) - (prioOrder[b.priority] ?? 9));

  return gaps;
}

// ── 8. Write output files ─────────────────────────────────────
function writeRoutes(routes: RouteInfo[]): void {
  const publicRoutes = routes.filter((r) => r.group === "public");
  const authRoutes = routes.filter((r) => r.group === "authenticated");
  const officerRoutes = routes.filter((r) => r.group === "officer");
  const tested = routes.filter((r) => r.hasE2E).length;

  let md = `# Route Inventory\n\n`;
  md += `> Auto-generated by \`generate.ts\`. Do not edit.\n\n`;
  md += `**Total:** ${routes.length} routes | **Tested:** ${tested} | **Untested:** ${routes.length - tested}\n\n`;

  const writeGroup = (title: string, group: RouteInfo[]) => {
    md += `## ${title} (${group.length})\n\n`;
    md += `| Route | E2E Test | Test File(s) |\n`;
    md += `|-------|----------|---------------|\n`;
    for (const r of group) {
      const status = r.hasE2E ? "yes" : "**NO**";
      const files = r.e2eFiles.length > 0 ? r.e2eFiles.map((f) => `\`${f}\``).join(", ") : "—";
      md += `| \`${r.path}\` | ${status} | ${files} |\n`;
    }
    md += `\n`;
  };

  writeGroup("Public Routes", publicRoutes);
  writeGroup("Authenticated (Member) Routes", authRoutes);
  writeGroup("Officer Routes", officerRoutes);

  writeFileSync(resolve(OUT, "routes.generated.md"), md);
}

function writeBRCoverage(brs: BrInfo[]): void {
  const complete = brs.filter((b) => b.coverage === "COMPLETE").length;
  const partial = brs.filter((b) => b.coverage === "PARTIAL").length;
  const deferred = brs.filter((b) => b.coverage === "DEFERRED").length;
  const none = brs.filter((b) => b.coverage !== "COMPLETE" && b.coverage !== "PARTIAL" && b.coverage !== "DEFERRED").length;

  let md = `# Business Rule Coverage\n\n`;
  md += `> Auto-generated by \`generate.ts\`. Do not edit.\n\n`;
  md += `**Total:** ${brs.length} BRs | **Complete:** ${complete} | **Partial:** ${partial} | **Deferred:** ${deferred}`;
  if (none > 0) md += ` | **None:** ${none}`;
  md += `\n\n`;

  md += `| BR | Rule | Phase | Module | Backend | Contract | E2E | Status |\n`;
  md += `|----|------|-------|--------|---------|----------|-----|--------|\n`;

  for (const br of brs) {
    const be = br.tests.backend.length > 0 ? `${br.tests.backend.length} file(s)` : "—";
    const ct = br.tests.contract.length > 0 ? `${br.tests.contract.length} file(s)` : "—";
    const e2e = br.tests.e2e.length > 0 ? `${br.tests.e2e.length} file(s)` : "—";
    const status =
      br.coverage === "COMPLETE"
        ? "COMPLETE"
        : br.coverage === "DEFERRED"
          ? `DEFERRED`
          : `**${br.coverage}**`;
    md += `| ${br.id} | ${br.rule} | ${br.phase} | ${br.module} | ${be} | ${ct} | ${e2e} | ${status} |\n`;
  }

  md += `\n`;

  // Deferred details
  const deferredBrs = brs.filter((b) => b.coverage === "DEFERRED");
  if (deferredBrs.length > 0) {
    md += `## Deferred BRs\n\n`;
    for (const br of deferredBrs) {
      md += `- **${br.id}** (${br.rule}): ${br.deferredReason ?? "No reason given"}\n`;
    }
    md += `\n`;
  }

  writeFileSync(resolve(OUT, "br-coverage.generated.md"), md);
}

function writeGaps(gaps: Gap[]): void {
  let md = `# Gaps & Action Items\n\n`;
  md += `> Auto-generated by \`generate.ts\`. Do not edit.\n\n`;
  md += `**Total gaps:** ${gaps.length}\n\n`;

  const byPriority = (prio: string) => gaps.filter((g) => g.priority === prio);
  const byType = (type: GapType) => gaps.filter((g) => g.type === type);

  const writeSection = (title: string, items: Gap[]) => {
    if (items.length === 0) return;
    md += `## ${title} (${items.length})\n\n`;
    md += `| Target | Type | Detail |\n`;
    md += `|--------|------|--------|\n`;
    for (const g of items) {
      md += `| \`${g.target}\` | ${g.type} | ${g.detail} |\n`;
    }
    md += `\n`;
  };

  writeSection("Critical (P0)", byPriority("P0"));
  writeSection("Important (P1)", byPriority("P1"));
  writeSection("Standard (P2)", byPriority("P2"));

  // Summary by type
  md += `## Summary by Type\n\n`;
  const types: GapType[] = [
    "route-no-test",
    "br-no-coverage",
    "br-stub-only",
    "br-partial",
    "journey-untested",
    "journey-dead-link",
    "persona-unmapped",
  ];
  md += `| Type | Count |\n`;
  md += `|------|-------|\n`;
  for (const t of types) {
    const count = byType(t).length;
    if (count > 0) md += `| ${t} | ${count} |\n`;
  }
  md += `\n`;

  writeFileSync(resolve(OUT, "gaps.generated.md"), md);
}

function writeIndex(routes: RouteInfo[], brs: BrInfo[], journeys: Journey[], gaps: Gap[], personas: string[]): void {
  const testedRoutes = routes.filter((r) => r.hasE2E).length;
  const completeBRs = brs.filter((b) => b.coverage === "COMPLETE").length;
  const mappedPersonas = new Set(journeys.map((j) => j.persona)).size;
  const p0Gaps = gaps.filter((g) => g.priority === "P0").length;
  const p1Gaps = gaps.filter((g) => g.priority === "P1").length;

  let md = `# Memberry Project Map\n\n`;
  md += `> Auto-generated by \`bun docs/project-map/generate.ts\`. Do not edit.\n\n`;
  md += `**Generated:** ${new Date().toISOString().split("T")[0]}\n\n`;

  md += `## Health Summary\n\n`;
  md += `| Metric | Value | Status |\n`;
  md += `|--------|-------|--------|\n`;
  md += `| Routes | ${testedRoutes}/${routes.length} tested | ${testedRoutes === routes.length ? "PASS" : `${routes.length - testedRoutes} gaps`} |\n`;
  md += `| Business Rules | ${completeBRs}/${brs.length} complete | ${completeBRs === brs.length ? "PASS" : `${brs.length - completeBRs} incomplete`} |\n`;
  md += `| Personas | ${mappedPersonas}/${personas.length} mapped | ${mappedPersonas === personas.length ? "PASS" : `${personas.length - mappedPersonas} unmapped`} |\n`;
  md += `| Journeys | ${journeys.length} defined | — |\n`;
  md += `| P0 Gaps | ${p0Gaps} | ${p0Gaps === 0 ? "PASS" : `**${p0Gaps} CRITICAL**`} |\n`;
  md += `| P1 Gaps | ${p1Gaps} | ${p1Gaps === 0 ? "PASS" : `${p1Gaps} important`} |\n`;
  md += `\n`;

  md += `## Quick Links\n\n`;
  md += `- [Route Inventory](routes.generated.md)\n`;
  md += `- [BR Coverage](br-coverage.generated.md)\n`;
  md += `- [User Journeys](journeys.md)\n`;
  md += `- [Gaps & Action Items](gaps.generated.md)\n`;
  md += `\n`;

  md += `## How to Use\n\n`;
  md += `- **Regenerate:** \`bun docs/project-map/generate.ts\`\n`;
  md += `- **Add journeys:** Edit \`journeys.md\` (only hand-maintained file)\n`;
  md += `- **All other files:** Auto-generated, do not edit\n`;

  writeFileSync(resolve(OUT, "INDEX.md"), md);
}

// ── Main ──────────────────────────────────────────────────────
function main() {
  console.log("Generating project map...\n");

  console.log("1. Parsing routes...");
  const routes = parseRoutes();
  console.log(`   Found ${routes.length} routes`);

  console.log("2. Scanning E2E tests...");
  const e2eMap = scanE2ETests();
  console.log(`   Found ${e2eMap.size} unique route references in tests`);

  console.log("3. Matching routes to tests...");
  matchRoutesToTests(routes, e2eMap);
  const tested = routes.filter((r) => r.hasE2E).length;
  console.log(`   ${tested}/${routes.length} routes have E2E coverage`);

  console.log("4. Parsing BR registry...");
  const brs = parseBRs();
  console.log(`   Found ${brs.length} business rules`);

  console.log("5. Parsing personas...");
  const personas = parsePersonas();
  console.log(`   Found ${personas.length} personas`);

  console.log("6. Parsing journeys...");
  const journeys = parseJourneys();
  console.log(`   Found ${journeys.length} journeys`);

  console.log("7. Generating gaps...");
  const gaps = generateGaps(routes, brs, journeys, personas);
  console.log(`   Found ${gaps.length} gaps`);

  console.log("\n8. Writing output files...");
  writeRoutes(routes);
  console.log("   ✓ routes.generated.md");
  writeBRCoverage(brs);
  console.log("   ✓ br-coverage.generated.md");
  writeGaps(gaps);
  console.log("   ✓ gaps.generated.md");
  writeIndex(routes, brs, journeys, gaps, personas);
  console.log("   ✓ INDEX.md");

  console.log(`\nDone. ${gaps.length} gaps found (${gaps.filter((g) => g.priority === "P0").length} P0, ${gaps.filter((g) => g.priority === "P1").length} P1).`);
}

main();
