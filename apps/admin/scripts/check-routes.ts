#!/usr/bin/env bun
/**
 * Strict route-generation check (R1-4).
 *
 * The TanStack Router vite plugin generates `routeTree.gen.ts` from the route
 * files and validates each `createFileRoute(...)` call. That validation only
 * runs in the dev/build transform — so a malformed route id (e.g. the
 * `createFileRoute('/surveys/' as any)` cast that blanked the whole admin SPA in
 * local dev) threw ONLY in `bun dev`, while CI — running e2e against an app
 * whose route tree comes from the already-committed `routeTree.gen.ts` — stayed
 * green. CI was structurally blind to a dev-only route-gen failure.
 *
 * This script runs the SAME generator headlessly and fails (exit 1) if route
 * generation errors. It writes the tree to a throwaway temp path so the
 * committed `routeTree.gen.ts` is never mutated — it is a pure validation. Wired
 * into CI (lint-typecheck job) so a reintroduced non-string-literal route id
 * fails the build, not just someone's local dev.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Generator, getConfig } from '@tanstack/router-generator';

const root = new URL('..', import.meta.url).pathname.replace(/\/$/, '');

try {
  const config = getConfig(
    {
      routesDirectory: './src/routes',
      // Validate-only: emit to a temp file, never the committed tree.
      generatedRouteTree: join(tmpdir(), `admin-routeTree.check.${process.pid}.gen.ts`),
      routeFileIgnorePattern: '.test.',
    },
    root,
  );
  const generator = new Generator({ config, root });
  await generator.run();
  // eslint-disable-next-line no-console
  console.log('✓ route generation OK — all createFileRoute ids are valid string literals');
  process.exit(0);
} catch (err) {
  // eslint-disable-next-line no-console
  console.error(
    '✗ route generation FAILED — a route file is malformed (e.g. a non-string-literal route id / `as any` cast). This blanks the SPA in dev; fix the route id.',
  );
  // eslint-disable-next-line no-console
  console.error((err as Error).message);
  process.exit(1);
}
