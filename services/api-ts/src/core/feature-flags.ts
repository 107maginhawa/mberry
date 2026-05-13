/**
 * Lightweight feature flags — env-var based.
 *
 * Flags are read from environment variables prefixed with `FF_`.
 * Example: FF_NEW_DUES_FLOW=true → { newDuesFlow: true }
 *
 * For a 3-person team this is sufficient. Swap for LaunchDarkly/Unleash
 * when you need user-level targeting or gradual rollouts.
 */

import type { App } from '@/types/app';

export interface FeatureFlags {
  [key: string]: boolean;
}

/**
 * Parse FF_* environment variables into a typed flags object.
 * FF_SOME_FLAG=true  → { someFlag: true }
 * FF_SOME_FLAG=false → { someFlag: false }
 * FF_SOME_FLAG=1     → { someFlag: true }
 * Anything else      → { someFlag: false }
 */
export function parseFeatureFlags(env: Record<string, string | undefined> = process.env): FeatureFlags {
  const flags: FeatureFlags = {};

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith('FF_')) continue;

    // FF_NEW_DUES_FLOW → newDuesFlow
    const camelKey = key
      .slice(3) // remove FF_
      .toLowerCase()
      .replace(/_([a-z])/g, (_, c) => c.toUpperCase());

    flags[camelKey] = value === 'true' || value === '1';
  }

  return flags;
}

/**
 * Check if a specific flag is enabled.
 */
export function isEnabled(flags: FeatureFlags, flag: string): boolean {
  return flags[flag] === true;
}

/**
 * Register the /feature-flags endpoint.
 * Returns all flags as JSON — safe because these are deployment-level,
 * not user-level. No secrets exposed.
 */
export function registerRoutes(app: App): void {
  const flags = parseFeatureFlags();

  app.get('/feature-flags', (ctx) => {
    return ctx.json(flags, 200);
  });
}
