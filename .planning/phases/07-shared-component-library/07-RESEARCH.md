# Phase 7: Shared Component Library - Research

**Researched:** 2026-05-06
**Domain:** Bun workspace package creation, shadcn/ui extraction, Tailwind CSS v4, component preview
**Confidence:** HIGH

## Summary

Three apps exist in this monorepo — `account` (port 3002), `memberry` (port 3004), `admin` (port 3003). The duplication situation is asymmetric:

- `apps/account/src/components/` — 43 files, flat directory (no `ui/` subdirectory). All are shadcn/ui wrappers using `@/lib/utils` path alias. No `components.json` present.
- `apps/memberry/src/components/ui/` — 25 files (subset of account's). Has `components.json` configured at `apps/memberry/`.
- `apps/admin/src/` — NO shadcn components at all. Uses raw Tailwind HTML. Has `src/lib/utils.ts` (the `cn` function) but no `@/components` imports.

The Tailwind theming is NOT uniform across apps — account and admin use `hsl(var(--border))` CSS variables while memberry uses `var(--color-border)` CSS custom properties with different token names and different font families. This means a shared package CANNOT use per-app theme tokens in component definitions — it must use the standard shadcn `hsl(var(--*))` convention and each app's `globals.css` defines those tokens.

**Primary recommendation:** Create `packages/ui` as a Bun workspace package with source-level exports (no build step — same pattern as `sdk-ts`). Extract the common shadcn/ui components from `account` as the canonical source. Apps consume via `@monobase/ui` workspace alias. For component preview, use Ladle (Storybook-compatible, Vite-native, much lighter) rather than full Storybook — fits the Bun/Vite stack.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Shared component source | packages/ui | — | Single canonical definition, not per-app |
| CSS variables / theming | Each app's globals.css | — | Apps differ in brand tokens; package uses standard shadcn var names |
| cn() utility | packages/ui | — | Duplicated in all three apps today; extract once |
| Component preview | packages/ui (Ladle) | — | Preview lives with the package, not inside any app |
| Tailwind content scanning | Each app's tailwind.config.ts | — | Each app must add `packages/ui/src/**/*.{ts,tsx}` to content array |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| clsx | ^2.1.1 | className merging | Already in all apps |
| tailwind-merge | ^3.3.1 | Tailwind class conflict resolution | Already in all apps |
| class-variance-authority | ^0.7.1 | Component variant definitions | Already in account + memberry |
| @radix-ui/react-slot | ^1.2.3 | asChild pattern | Used in Button, all apps |
| lucide-react | ^0.451.0 | Icon library | Already in account + memberry |

### Supporting (component preview)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ladle/react | ^4.x | Component preview/stories | Vite-native, no webpack, fast |

**Version verification:** [ASSUMED] Ladle current version is approximately 4.x — must run `npm view @ladle/react version` before pinning.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ladle | Storybook 8 | Storybook is 10x heavier, requires webpack or complex Vite config, builder plugins; Ladle is Vite-native and zero-config |
| Ladle | Histoire | Histoire is Vue-first, React support secondary |
| source exports (no build) | tsup build | Build step adds CI complexity; source exports work identically in Vite bundler mode as proven by sdk-ts |

**Installation (packages/ui):**
```bash
# From monorepo root
cd packages/ui && bun add -D @ladle/react
# Radix UI deps are peer deps — each app already has them
```

## Architecture Patterns

### System Architecture Diagram

```
apps/account/src/        apps/memberry/src/       apps/admin/src/
  components/ (43)         components/ui/ (25)       (raw Tailwind, no shadcn)
       |                        |                          |
       | EXTRACT                | EXTRACT                  | ADD new shadcn
       v                        v                          v
                    packages/ui/src/
                      components/          <-- canonical shadcn wrappers
                      lib/utils.ts         <-- cn() function
                      index.ts             <-- barrel export
                      *.stories.tsx        <-- Ladle stories
                      package.json         <-- @monobase/ui
                         |
           ┌─────────────┼─────────────┐
           v             v             v
      account          memberry       admin
  import from       import from    import from
  @monobase/ui      @monobase/ui   @monobase/ui
  (replaces local)  (replaces local) (new usage)
```

### Recommended Package Structure
```
packages/ui/
├── package.json            # @monobase/ui, source exports
├── tsconfig.json           # extends @monobase/typescript-config/app.json
├── .ladle/
│   └── config.mjs          # Ladle config pointing to src/**/*.stories.tsx
├── src/
│   ├── lib/
│   │   └── utils.ts        # cn() — single source of truth
│   ├── components/
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── form.tsx
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx
│   │   ├── checkbox.tsx
│   │   ├── switch.tsx
│   │   ├── sheet.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── progress.tsx
│   │   ├── textarea.tsx
│   │   ├── tooltip.tsx
│   │   ├── alert.tsx
│   │   ├── popover.tsx
│   │   └── ...
│   ├── stories/
│   │   ├── button.stories.tsx
│   │   ├── card.stories.tsx
│   │   └── ...
│   └── index.ts            # re-exports all components + utils
```

### Pattern 1: Source-level Workspace Package (no build step)

**What:** Export raw `.tsx` sources via package.json `exports` map. Consuming apps' Vite/bundler compiles them. No tsup/esbuild build step in the package itself.
**When to use:** Always — this is the established pattern in this monorepo (sdk-ts uses same approach).

```json
// packages/ui/package.json
{
  "name": "@monobase/ui",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./components/*": "./src/components/*.tsx",
    "./lib/utils": "./src/lib/utils.ts"
  },
  "files": ["src"],
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@ladle/react": "^4.x",
    "@monobase/typescript-config": "workspace:*",
    "tailwindcss": "^3"
  }
}
```

### Pattern 2: Critical — Tailwind Content Array Update

**What:** Each app's `tailwind.config.ts` must scan `packages/ui/src/**/*.{ts,tsx}` to generate CSS for shared component classes. Without this, shared component classes will be purged.
**When to use:** Required in every consuming app.

```typescript
// apps/account/tailwind.config.ts (and same for memberry, admin)
const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",  // ADD THIS
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // ... rest unchanged
}
```

[VERIFIED: shadcn/ui monorepo docs pattern — official recommendation for shared packages]

### Pattern 3: Import Path Rewrite

**What:** Each app's `tsconfig.json` already uses `vite-tsconfig-paths` and `baseUrl + paths`. Adding `@monobase/ui` as a workspace dep means imports just work via the `exports` map — no path alias config needed.
**When to use:** After adding `"@monobase/ui": "workspace:*"` to each app's `package.json`.

```tsx
// Before (in apps/account)
import { Button } from "@/components/button"

// After
import { Button } from "@monobase/ui"
// or specific
import { Button } from "@monobase/ui/components/button"
```

### Pattern 4: Component Source — Use Account as Canonical

Account has more components (43 vs 25 in memberry). Use account's versions as the baseline since they are more complete. Notable differences between account and memberry button.tsx:
- Account button: `focus-visible:ring-1`, height `h-9`/`h-8`/`h-10` 
- Memberry button: `focus-visible:ring-2 focus-visible:ring-offset-2`, height `h-10`/`h-9`/`h-11`

Memberry's button follows older shadcn defaults. Account's is slightly customized. The canonical version should be the account version. After extraction, memberry's `ui/` folder is deleted.

### Pattern 5: cn() — Extract to packages/ui

All three apps have identical `src/lib/utils.ts` with the `cn()` function. Extract to `packages/ui/src/lib/utils.ts`. Apps import `cn` from `@monobase/ui/lib/utils` OR keep a local re-export shim at `src/lib/utils.ts` that just re-exports from the package (easier migration, avoids touching every file).

```typescript
// apps/account/src/lib/utils.ts (shim — keeps @/lib/utils imports working)
export { cn } from "@monobase/ui/lib/utils"
```

### Anti-Patterns to Avoid

- **Build step in packages/ui:** Don't add tsup/esbuild. Source exports are simpler and proven by sdk-ts.
- **CSS variables IN the package:** Don't put `globals.css` theme tokens in the package. Each app owns its theme. The package uses `var(--primary)` etc. as CSS var references — they resolve at runtime from the app's CSS.
- **Storybook:** Full Storybook requires webpack builder or complex Vite config, `@storybook/builder-vite`, addon ecosystem. Ladle is a single-dep Vite-native alternative that runs `ladle serve` with zero config and renders all `*.stories.tsx` files.
- **Deleting app components before migration is complete:** Remove per-app components only AFTER imports are updated and typecheck passes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Component variants | Custom variant system | class-variance-authority (already used) | Type-safe variants, tree-shakeable |
| className merging | Custom merge function | clsx + tailwind-merge (already used) | Handles Tailwind conflict resolution |
| Component preview server | Custom Vite app | Ladle | Zero config, built for this exact use case |
| TypeScript exports resolution | Custom resolution scripts | Bun workspace + package.json exports | Built-in workspace protocol handles it |

## Common Pitfalls

### Pitfall 1: Tailwind Not Generating Classes for Shared Components

**What goes wrong:** Buttons and other shared components render with no styles in consuming apps.
**Why it happens:** Tailwind scans only paths in `content:[]`. If `packages/ui/src` isn't listed, all Tailwind classes in the shared package get purged.
**How to avoid:** Add `"../../packages/ui/src/**/*.{ts,tsx}"` to every app's tailwind config before running dev.
**Warning signs:** Shared components render as plain unstyled HTML.

### Pitfall 2: @/lib/utils Import Breaks After Extraction

**What goes wrong:** Components in `packages/ui` use `import { cn } from "@/lib/utils"` — this path alias only works inside an app, not in a package.
**Why it happens:** `@/` resolves to `src/` via tsconfig paths, which doesn't exist at the package level in the same way.
**How to avoid:** When copying components to `packages/ui`, rewrite `@/lib/utils` → `../lib/utils` (relative) or `@monobase/ui/lib/utils`. Set up packages/ui/tsconfig.json with its own `@/*` → `./src/*` paths so the alias works during Ladle.

### Pitfall 3: React Version Conflicts

**What goes wrong:** Bun workspace links `@monobase/ui` but each app's React version mismatches peerDeps.
**Why it happens:** If packages/ui declares `"react": "^18"` in peerDeps but apps use React 19.
**How to avoid:** Use `"react": "^19.0.0"` in peerDeps since all apps use React 19 [VERIFIED: account/package.json shows `"react": "^19.1.1"`].

### Pitfall 4: Memberry Theming Divergence

**What goes wrong:** Shared Button from `packages/ui` looks correct in account but wrong in memberry (different primary color, font, sizing).
**Why it happens:** Memberry uses different CSS custom property names (`--color-primary` vs `--primary`). The shared button uses `bg-primary` which maps to `hsl(var(--primary))` in account but `var(--color-primary)` in memberry via the tailwind config color mapping.
**How to avoid:** Both apps map `primary` to different underlying CSS vars — this is handled entirely in each app's `tailwind.config.ts`. The shared component uses `bg-primary` and each app resolves it via its own tailwind config. This should work correctly as long as both apps define the `primary` color in their tailwind config. **Action needed:** Verify memberry's tailwind config defines `primary.DEFAULT` mapping.

### Pitfall 5: Admin App Has No Shadcn Setup

**What goes wrong:** Admin imports `Button` from `@monobase/ui` but its `globals.css` has no CSS variables for `--primary`, `--ring` etc. so the component is unstyled.
**Why it happens:** Admin currently uses raw Tailwind with inline hardcoded classes, no shadcn CSS variable layer.
**How to avoid:** Admin's `globals.css` already has `--primary`, `--ring`, `--border` etc. [VERIFIED: checked `apps/admin/src/styles/globals.css`]. So the CSS variables ARE present. Admin just never consumed shadcn components before. Should work once Tailwind content array is updated.

## Code Examples

### packages/ui/package.json
```json
{
  "name": "@monobase/ui",
  "version": "0.1.0",
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./lib/utils": "./src/lib/utils.ts",
    "./components/*": "./src/components/*.tsx"
  },
  "files": ["src"],
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "*"
  },
  "dependencies": {
    "@radix-ui/react-slot": "^1.2.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  },
  "devDependencies": {
    "@ladle/react": "^4.x",
    "@monobase/eslint-config": "workspace:*",
    "@monobase/typescript-config": "workspace:*",
    "@types/react": "^19.0.0",
    "bun-types": "^1.2.21",
    "typescript": "^5.9.2"
  },
  "scripts": {
    "storybook": "ladle serve",
    "typecheck": "tsc --noEmit"
  }
}
```

### packages/ui/tsconfig.json
```json
{
  "extends": "@monobase/typescript-config/app.json",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Ladle story example
```tsx
// packages/ui/src/stories/button.stories.tsx
import type { Story } from "@ladle/react"
import { Button } from "../components/button"

export const Default: Story = () => <Button>Click me</Button>
export const Destructive: Story = () => <Button variant="destructive">Delete</Button>
export const Outline: Story = () => <Button variant="outline">Cancel</Button>
```

### App consumption after migration
```tsx
// apps/account/src/routes/some-page.tsx
import { Button } from "@monobase/ui"
import { Card, CardHeader, CardContent } from "@monobase/ui"
// OR granular:
import { Button } from "@monobase/ui/components/button"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Storybook with webpack | Ladle (Vite-native) | ~2023 | 10x faster startup, zero webpack config |
| shadcn copy-paste only | shadcn as design pattern, extracted to packages | 2024 onward | Monorepos extract to shared pkg |
| Build step required for packages | Source exports via exports map | Bun/Vite era | No compilation needed for workspace packages |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Ladle ~v4.x is current, Vite-native, React 19 compatible | Standard Stack | Must verify with `npm view @ladle/react version` before install |
| A2 | Account button.tsx is the canonical version to prefer over memberry's | Architecture | Could cause visual regression in memberry if sizes/focus ring differ — test both |
| A3 | Radix UI deps should be peer deps in packages/ui, not direct | Standard Stack | If some Radix packages aren't in an app's direct deps, they won't be available |

## Open Questions

1. **Which Radix packages to list as peer deps vs direct deps in packages/ui?**
   - What we know: Account app has 17 Radix packages. Memberry has similar. Admin has only `@radix-ui/react-slot`.
   - What's unclear: If packages/ui declares Radix as peer deps, admin app will break because it doesn't have them installed.
   - Recommendation: List Radix packages as direct deps in packages/ui (not peer). This ensures they're always available. Bun's workspace deduplication means no version conflict risk.

2. **How far to migrate admin app?**
   - What we know: Admin uses raw HTML with Tailwind classes. CSS variables are present. No shadcn components at all.
   - What's unclear: UINF-03 says "all three apps import from packages/ui" — does admin need to be migrated from raw HTML to shadcn, or just need to HAVE the ability to import?
   - Recommendation: Admin has no existing components to replace — the requirement is "import from packages/ui instead of local copies." Since admin has no local copies, the minimal compliance is adding packages/ui as a dep and using at least one shared component (e.g., Button in one route). Full admin UI migration is out of scope for this phase.

3. **Ladle CSS variable setup for stories**
   - What we know: Stories need CSS variables to render correctly (otherwise components appear unstyled).
   - What's unclear: Does Ladle support a global CSS import? 
   - Recommendation: Ladle supports `.ladle/components.tsx` for global providers and can import CSS. Add a `globals.css` to `packages/ui/` with the shadcn CSS variable defaults for story preview purposes.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Bun | Package management | ✓ | 1.2.21 | — |
| Node.js | Vite/Ladle | ✓ | v22.19.0 | — |
| @ladle/react | Component preview | ✗ (not installed) | — | Storybook (heavier) |

**Missing dependencies with no fallback:** None — Ladle installs via bun.

**Missing dependencies with fallback:** Ladle not yet installed — `bun add -D @ladle/react` in packages/ui.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test (unit) + TypeScript typecheck |
| Config file | bun is zero-config |
| Quick run command | `cd packages/ui && bun run typecheck` |
| Full suite command | `bun run typecheck` (all workspaces) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UINF-01 | packages/ui contains Radix-UI wrapper components | typecheck | `cd packages/ui && bun run typecheck` | ❌ Wave 0 |
| UINF-02 | Component preview runs and shows components | manual smoke | `cd packages/ui && bun run storybook` | ❌ Wave 0 |
| UINF-03 | All three apps import from @monobase/ui | typecheck | `bun run typecheck` (monorepo root) | ❌ Wave 0 |

### Sampling Rate
- **Per task:** `cd packages/ui && bun run typecheck`
- **Per wave:** `bun run typecheck` from root + manual Ladle smoke
- **Phase gate:** All three apps typecheck clean with shared imports + Ladle serves components

### Wave 0 Gaps
- [ ] `packages/ui/` — package does not exist yet, must be created
- [ ] `packages/ui/src/lib/utils.ts` — cn() utility
- [ ] `packages/ui/src/index.ts` — barrel export
- [ ] `packages/ui/tsconfig.json` — TypeScript config
- [ ] `packages/ui/package.json` — workspace package definition
- [ ] `packages/ui/.ladle/config.mjs` — Ladle config

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | UI components are presentational only |
| V6 Cryptography | no | — |

No security concerns — this is a pure UI component extraction phase. No data handling, no auth, no PII.

## Project Constraints (from CLAUDE.md)

| Directive | Impact on This Phase |
|-----------|---------------------|
| Bun workspace: `"workspaces": ["apps/*","packages/*","services/*","specs/*"]` | packages/ui is auto-discovered |
| No `/api` prefix on routes | Not relevant (no backend work) |
| Use sonner not shadcn useToast | sonner is NOT a shared component — stays per-app |
| `@/lib/utils` path alias convention | Extract cn() to packages/ui, apps keep shim at src/lib/utils.ts |
| Never edit generated files | Not applicable — no generated files in UI layer |
| shadcn skill: `NEVER manually create or edit files in src/components/ui/` | This phase moves files OUT of src/components/ui — extraction is the correct operation, not manual creation |
| `bun install` to install deps | Use `bun install` from monorepo root after adding packages/ui |
| Post-implementation: restart API server | Not relevant (frontend-only phase) |
| Tailwind `^3` in all apps | packages/ui devDep should also be tailwind ^3 |

## Sources

### Primary (HIGH confidence)
- [VERIFIED: codebase grep] — account has 43 components flat in `src/components/`, memberry has 25 in `src/components/ui/`, admin has zero shadcn components
- [VERIFIED: file read] — `apps/account/package.json`, `apps/memberry/package.json`, `apps/admin/package.json` — Radix UI dep lists confirmed
- [VERIFIED: file read] — `packages/sdk-ts/package.json` — source exports pattern confirmed (no build step)
- [VERIFIED: file read] — `package.json` root — Bun workspaces: `["apps/*","packages/*","services/*","specs/*"]`
- [VERIFIED: file read] — `apps/admin/src/styles/globals.css` — CSS variables present in admin
- [VERIFIED: file read] — `apps/memberry/components.json` — shadcn config confirmed, `src/components/ui` alias

### Secondary (MEDIUM confidence)
- [CITED: shadcn/ui docs] — shadcn monorepo pattern recommends adding packages path to tailwind content array
- [CITED: Ladle docs] — Ladle is Vite-native, zero-config, renders `*.stories.tsx` files

### Tertiary (LOW confidence)
- [ASSUMED] — Ladle version ~4.x, React 19 compatible — verify before install

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps verified in existing package.json files
- Architecture: HIGH — pattern mirrors existing sdk-ts workspace package
- Pitfalls: HIGH — Tailwind content array pitfall is the #1 shadcn monorepo issue; CSS var concern verified by reading actual config files
- Component preview tool: MEDIUM — Ladle recommendation based on Vite-native fit; version unverified

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable ecosystem)
