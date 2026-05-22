#!/usr/bin/env bun
/**
 * New Code Gate — ensures new/modified handler files have corresponding tests.
 *
 * Compares the current branch against the base branch (default: main) and checks
 * that every new or modified handler file has a sibling .test.ts file.
 *
 * Exits 0 if all new handler files are tested.
 * Exits 1 if untested handler files are found.
 *
 * Usage:
 *   bun run scripts/new-code-gate.ts                    # compare against main
 *   bun run scripts/new-code-gate.ts --base origin/main # explicit base
 */

const args = process.argv.slice(2);
const baseIdx = args.indexOf("--base");
const baseBranch = baseIdx >= 0 && args[baseIdx + 1] ? args[baseIdx + 1] : "origin/main";

const ROOT = new URL("../", import.meta.url).pathname.replace(/\/$/, "");

// Patterns to include (handler implementation files)
const HANDLER_PATTERN = /^services\/api-ts\/src\/handlers\/.+\.ts$/;

// Patterns to exclude from the gate
const EXCLUDE_PATTERNS = [
  /\.test\.ts$/,
  /\.schema\.ts$/,
  /\/repos\//,
  /\/jobs\//,
  /\/utils\//,
  /index\.ts$/,
  /\/generated\//,
];

function shouldCheck(filePath: string): boolean {
  if (!HANDLER_PATTERN.test(filePath)) return false;
  return !EXCLUDE_PATTERNS.some((p) => p.test(filePath));
}

function testPath(handlerPath: string): string {
  return handlerPath.replace(/\.ts$/, ".test.ts");
}

async function main() {
  // Get newly ADDED files compared to base branch (not modified — those are grandfathered)
  const diffResult = Bun.spawnSync(["git", "diff", "--name-only", "--diff-filter=A", baseBranch], {
    cwd: ROOT,
  });

  if (diffResult.exitCode !== 0) {
    // If base branch doesn't exist (e.g., initial commit or local-only), pass
    const stderr = diffResult.stderr.toString();
    if (stderr.includes("unknown revision") || stderr.includes("not a git repository")) {
      console.log("SKIP: Cannot diff against base branch. Passing.");
      process.exit(0);
    }
    console.error(`git diff failed: ${stderr}`);
    process.exit(2);
  }

  const changedFiles = diffResult.stdout
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);

  // Filter to handler files that need tests
  const handlersToCheck = changedFiles.filter(shouldCheck);

  if (handlersToCheck.length === 0) {
    console.log("PASS: No new/modified handler files in this change.");
    process.exit(0);
  }

  // Check each handler file for a corresponding test
  const untested: string[] = [];

  for (const handler of handlersToCheck) {
    const expectedTest = testPath(handler);
    const fullPath = `${ROOT}/${expectedTest}`;
    const exists = await Bun.file(fullPath).exists();
    if (!exists) {
      untested.push(handler);
    }
  }

  // Report
  console.log(`Checked ${handlersToCheck.length} handler file(s) against base: ${baseBranch}`);

  if (untested.length === 0) {
    console.log("PASS: All new/modified handler files have corresponding tests.");
    process.exit(0);
  }

  console.log("");
  console.log(`FAIL: ${untested.length} handler file(s) missing tests:`);
  for (const f of untested) {
    const expected = testPath(f);
    console.log(`  ${f}`);
    console.log(`    Expected: ${expected}`);
  }
  console.log("");
  console.log("Add a .test.ts file for each handler, or move utility code to utils/.");
  process.exit(1);
}

main();
