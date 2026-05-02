# F0 Foundation + F1 Member Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build shared design system foundation and first flow slice (member dashboard + profile) with production UI matching docs/ver-3/ specs.

**Architecture:** Foundation layer (design tokens, shadcn components, layouts, shared patterns) then vertical TDD for member dashboard flow — write E2E test first, build UI to pass it. All visual decisions from docs/ver-3/DESIGN.md.

**Tech Stack:** Vite, TanStack Router/Query, Tailwind CSS, shadcn/ui, Playwright, General Sans + Plus Jakarta Sans + JetBrains Mono fonts, react-hook-form + zod

---

## File Structure

### Foundation (F0) — New/Modified Files

```
apps/memberry/
  src/
    styles/globals.css                          [MODIFY] — Replace fonts, color tokens, typography scale
    components/
      ui/                                       [CREATE via /shadcn] — Button, Card, Input, etc.
      layout/
        member-layout.tsx                       [CREATE] — Desktop sidebar + mobile bottom nav
        officer-layout.tsx                      [CREATE] — 7-section sidebar per spec
        page-header.tsx                         [CREATE] — Title + breadcrumbs + actions
      patterns/
        skeleton-loader.tsx                     [CREATE] — List, card, profile, table variants
        empty-state.tsx                         [CREATE] — Icon + headline + description + CTA
        error-boundary.tsx                      [CREATE] — Network, inline, form error variants
        stat-card.tsx                           [CREATE] — Number + label + trend + accent variant
        status-badge.tsx                        [CREATE] — Active/Grace/Lapsed/Pending/Suspended
        member-card.tsx                         [CREATE] — Avatar + name + status + actions
        confirm-dialog.tsx                      [CREATE] — Destructive/high-consequence/irreversible
        data-table.tsx                          [CREATE] — Pagination, sorting, filtering, responsive
        avatar.tsx                              [CREATE] — Initials-based, 3 sizes, status ring
    routes/
      _authenticated.tsx                        [MODIFY] — Wire up member layout with responsive nav
  tailwind.config.ts                            [MODIFY] — Fonts, spacing, radius, semantic colors
  package.json                                  [MODIFY] — Add font packages
```

### F1 Member Dashboard — New/Modified Files

```
apps/memberry/
  src/
    routes/_authenticated/
      dashboard.tsx                             [MODIFY] — Full member dashboard per spec
      my/
        profile.tsx                             [MODIFY] — Redesign to match spec layout
        settings.tsx                            [MODIFY] — Redesign with tabbed sections per spec
        organizations.tsx                       [MODIFY] — Redesign with proper cards per spec
  tests/
    e2e/
      f1-member-dashboard.spec.ts               [CREATE] — Full journey E2E test
    components/
      stat-card.spec.ts                         [CREATE] — Component visual test
      empty-state.spec.ts                       [CREATE] — Component visual test
      status-badge.spec.ts                      [CREATE] — Component visual test
```

---

## Task 1: Install Fonts + Update Design Tokens

**Files:**
- Modify: `apps/memberry/package.json`
- Modify: `apps/memberry/src/styles/globals.css`
- Modify: `apps/memberry/tailwind.config.ts`

- [ ] **Step 1: Install new font packages**

Run from project root:
```bash
cd apps/memberry && bun add @fontsource-variable/general-sans @fontsource-variable/plus-jakarta-sans @fontsource/jetbrains-mono
```

- [ ] **Step 2: Replace globals.css with DESIGN.md tokens**

Replace the entire `apps/memberry/src/styles/globals.css` with:

```css
/* Memberry Typography — matches docs/ver-3/DESIGN.md */
@import "@fontsource-variable/general-sans"; /* Display: headings, nav, stat values */
@import "@fontsource-variable/plus-jakarta-sans"; /* Body: paragraphs, forms, tables */
@import "@fontsource/jetbrains-mono/400.css"; /* Mono: numeric data, system IDs */
@import "@fontsource/jetbrains-mono/500.css";

/* Better Auth UI styles */
@import "@daveyplate/better-auth-ui/css";

@custom-variant dark (&:is(.dark *));

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* DESIGN.md color tokens — light mode */
    --color-primary: #554B68;
    --color-primary-mid: #675D78;
    --color-primary-light: #9E8890;
    --color-primary-lighter: #C8B4BC;
    --color-primary-subtle: #F0E8EC;
    --color-cream: #F2DEB0;
    --color-cream-light: #F9F0D8;
    --color-cream-dark: #D4BA82;
    --color-bg: #FAF7F2;
    --color-surface: #FFFFFF;
    --color-surface-warm: #FDF9F3;
    --color-text: #2D2635;
    --color-text-secondary: #554B60;
    --color-muted: #9E8890;
    --color-border: #E4D8DC;
    --color-border-light: #EDE5E8;
    --color-success: #5A8A6B;
    --color-success-bg: #EDF5F0;
    --color-warning: #C4960A;
    --color-warning-bg: #FDF8E8;
    --color-error: #B85454;
    --color-error-bg: #FDF0F0;
    --color-info: #5B7EB5;
    --color-info-bg: #EDF2F8;

    /* Shadows */
    --shadow-soft: 0 2px 12px rgba(85, 75, 104, 0.10);
    --shadow-medium: 0 4px 24px rgba(85, 75, 104, 0.08);
    --shadow-deep: 0 8px 32px rgba(85, 75, 104, 0.12);

    /* Radius — DESIGN.md */
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 18px;
    --radius-full: 9999px;

    /* shadcn compatibility variables (mapped to DESIGN.md tokens) */
    --radius: 12px;
    --background: var(--color-bg);
    --foreground: var(--color-text);
    --card: var(--color-surface);
    --card-foreground: var(--color-text);
    --popover: var(--color-surface);
    --popover-foreground: var(--color-text);
    --primary: var(--color-primary);
    --primary-foreground: #FFFFFF;
    --secondary: var(--color-primary-subtle);
    --secondary-foreground: var(--color-primary);
    --muted: var(--color-border-light);
    --muted-foreground: var(--color-muted);
    --accent: var(--color-cream-light);
    --accent-foreground: var(--color-primary);
    --destructive: var(--color-error);
    --destructive-foreground: #FFFFFF;
    --border: var(--color-border);
    --input: var(--color-border);
    --ring: var(--color-primary);

    /* Sidebar */
    --sidebar-background: var(--color-primary);
    --sidebar-foreground: #FFFFFF;
    --sidebar-primary: var(--color-cream);
    --sidebar-primary-foreground: var(--color-primary);
    --sidebar-accent: rgba(255, 255, 255, 0.12);
    --sidebar-accent-foreground: #FFFFFF;
    --sidebar-border: rgba(255, 255, 255, 0.12);
    --sidebar-ring: var(--color-cream);
  }

  .dark {
    --color-primary: #9E8890;
    --color-primary-mid: #C8B4BC;
    --color-primary-light: #675D78;
    --color-primary-lighter: #554B68;
    --color-primary-subtle: #2D2635;
    --color-cream: #D4BA82;
    --color-cream-light: #3D3520;
    --color-cream-dark: #F2DEB0;
    --color-bg: #1E1A22;
    --color-surface: #2A2530;
    --color-surface-warm: #302A36;
    --color-text: #F0E8EC;
    --color-text-secondary: #C8B4BC;
    --color-muted: #8A7E88;
    --color-border: #3D3644;
    --color-border-light: #342E3A;
    --color-success: #6BA87E;
    --color-success-bg: #1E2D22;
    --color-warning: #D4AA30;
    --color-warning-bg: #2D2A1A;
    --color-error: #D47070;
    --color-error-bg: #2D1E1E;
    --color-info: #7B9ED5;
    --color-info-bg: #1E222D;

    --shadow-soft: 0 2px 12px rgba(0, 0, 0, 0.20);
    --shadow-medium: 0 4px 24px rgba(0, 0, 0, 0.16);
    --shadow-deep: 0 8px 32px rgba(0, 0, 0, 0.24);

    --background: var(--color-bg);
    --foreground: var(--color-text);
    --card: var(--color-surface);
    --card-foreground: var(--color-text);
    --popover: var(--color-surface);
    --popover-foreground: var(--color-text);
    --primary: var(--color-primary);
    --primary-foreground: var(--color-text);
    --secondary: var(--color-primary-subtle);
    --secondary-foreground: var(--color-primary);
    --muted: var(--color-border-light);
    --muted-foreground: var(--color-muted);
    --accent: var(--color-cream-light);
    --accent-foreground: var(--color-cream);
    --destructive: var(--color-error);
    --destructive-foreground: #FFFFFF;
    --border: var(--color-border);
    --input: var(--color-border);
    --ring: var(--color-primary);

    --sidebar-background: #2D2635;
    --sidebar-foreground: #F0E8EC;
    --sidebar-primary: var(--color-cream);
    --sidebar-primary-foreground: #2D2635;
    --sidebar-accent: rgba(255, 255, 255, 0.08);
    --sidebar-accent-foreground: #F0E8EC;
    --sidebar-border: rgba(255, 255, 255, 0.08);
    --sidebar-ring: var(--color-cream);
  }

  * {
    @apply border-[var(--color-border)] outline-[var(--color-primary)]/50;
  }

  body {
    font-family: "Plus Jakarta Sans Variable", "Plus Jakarta Sans", sans-serif;
    font-weight: 400;
    color: var(--color-text);
    background-color: var(--color-bg);
    transition: background-color 300ms ease, color 300ms ease;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "General Sans Variable", "General Sans", sans-serif;
    font-weight: 700;
  }
}

/* Typography utility classes matching DESIGN.md 13-style scale */
@layer utilities {
  .text-hero { font-family: "General Sans Variable", sans-serif; font-size: 52px; font-weight: 700; line-height: 1.08; }
  .text-h1 { font-family: "General Sans Variable", sans-serif; font-size: 30px; font-weight: 700; line-height: 1.2; }
  .text-h2 { font-family: "General Sans Variable", sans-serif; font-size: 26px; font-weight: 700; line-height: 1.2; }
  .text-h3 { font-family: "General Sans Variable", sans-serif; font-size: 20px; font-weight: 700; line-height: 1.2; }
  .text-h4 { font-family: "General Sans Variable", sans-serif; font-size: 16px; font-weight: 600; line-height: 1.3; }
  .text-section-label { font-family: "General Sans Variable", sans-serif; font-size: 13px; font-weight: 600; line-height: 1.4; letter-spacing: 1.5px; text-transform: uppercase; }
  .text-body { font-family: "Plus Jakarta Sans Variable", sans-serif; font-size: 16px; font-weight: 400; line-height: 1.75; }
  .text-body-sm { font-family: "Plus Jakarta Sans Variable", sans-serif; font-size: 14px; font-weight: 400; line-height: 1.6; }
  .text-caption { font-family: "Plus Jakarta Sans Variable", sans-serif; font-size: 13px; font-weight: 500; line-height: 1.5; }
  .text-micro { font-family: "Plus Jakarta Sans Variable", sans-serif; font-size: 12px; font-weight: 600; line-height: 1.4; }
  .text-overline { font-size: 11px; font-weight: 600; line-height: 1.3; letter-spacing: 1.5px; text-transform: uppercase; }
  .text-mono { font-family: "JetBrains Mono", monospace; font-size: 13px; font-weight: 400; line-height: 1.5; }
  .text-mono-label { font-family: "JetBrains Mono", monospace; font-size: 11px; font-weight: 500; line-height: 1.3; letter-spacing: 1px; text-transform: uppercase; }
  .tabular-nums { font-variant-numeric: tabular-nums; }
}
```

- [ ] **Step 3: Update tailwind.config.ts**

Replace the entire `apps/memberry/tailwind.config.ts` with:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{ts,tsx}",
    "./node_modules/@daveyplate/better-auth-ui/dist/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"General Sans Variable"', '"General Sans"', "sans-serif"],
        body: ['"Plus Jakarta Sans Variable"', '"Plus Jakarta Sans"', "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        border: "var(--color-border)",
        input: "var(--color-border)",
        ring: "var(--color-primary)",
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        primary: {
          DEFAULT: "var(--color-primary)",
          mid: "var(--color-primary-mid)",
          light: "var(--color-primary-light)",
          lighter: "var(--color-primary-lighter)",
          subtle: "var(--color-primary-subtle)",
          foreground: "#FFFFFF",
        },
        cream: {
          DEFAULT: "var(--color-cream)",
          light: "var(--color-cream-light)",
          dark: "var(--color-cream-dark)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          warm: "var(--color-surface-warm)",
        },
        "text-secondary": "var(--color-text-secondary)",
        muted: {
          DEFAULT: "var(--color-muted)",
          foreground: "var(--color-muted)",
        },
        success: {
          DEFAULT: "var(--color-success)",
          bg: "var(--color-success-bg)",
        },
        warning: {
          DEFAULT: "var(--color-warning)",
          bg: "var(--color-warning-bg)",
        },
        error: {
          DEFAULT: "var(--color-error)",
          bg: "var(--color-error-bg)",
        },
        info: {
          DEFAULT: "var(--color-info)",
          bg: "var(--color-info-bg)",
        },
        destructive: {
          DEFAULT: "var(--color-error)",
          foreground: "#FFFFFF",
        },
        accent: {
          DEFAULT: "var(--color-cream-light)",
          foreground: "var(--color-primary)",
        },
        card: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text)",
        },
        popover: {
          DEFAULT: "var(--color-surface)",
          foreground: "var(--color-text)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar-background)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
        "border-light": "var(--color-border-light)",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "18px",
        full: "9999px",
      },
      spacing: {
        "1": "4px",
        "2": "8px",
        "3": "12px",
        "4": "16px",
        "5": "20px",
        "6": "24px",
        "8": "32px",
        "10": "40px",
        "12": "48px",
        "16": "64px",
        "20": "80px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        deep: "var(--shadow-deep)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      maxWidth: {
        content: "1200px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

- [ ] **Step 4: Remove old font packages**

```bash
cd apps/memberry && bun remove @fontsource/montserrat @fontsource/merriweather @fontsource/open-sans
```

- [ ] **Step 5: Verify build compiles**

```bash
cd apps/memberry && bun run typecheck
```

Expected: No type errors. Warnings about unused CSS classes are OK.

- [ ] **Step 6: Commit**

```bash
git add apps/memberry/package.json apps/memberry/src/styles/globals.css apps/memberry/tailwind.config.ts
git commit -m "feat(f0): design system tokens — fonts, colors, spacing per DESIGN.md"
```

---

## Task 2: Install shadcn/ui Components

**Files:**
- Create: `apps/memberry/src/components/ui/*.tsx` (via /shadcn skill)
- Modify: `apps/memberry/package.json` (auto-updated by shadcn)

- [ ] **Step 1: Initialize shadcn/ui if not already initialized**

Check if `apps/memberry/components.json` exists. If not, run:
```bash
cd apps/memberry && bunx shadcn@latest init --defaults
```

When prompted, select: TypeScript, Tailwind CSS, src/components/ui, @/components/ui, @/lib/utils

- [ ] **Step 2: Install foundation components**

Run each via the `/shadcn` skill (or CLI). Install one at a time:

```bash
cd apps/memberry
bunx shadcn@latest add button
bunx shadcn@latest add card
bunx shadcn@latest add input
bunx shadcn@latest add label
bunx shadcn@latest add form
bunx shadcn@latest add table
bunx shadcn@latest add dialog
bunx shadcn@latest add sheet
bunx shadcn@latest add badge
bunx shadcn@latest add skeleton
bunx shadcn@latest add alert
bunx shadcn@latest add tabs
bunx shadcn@latest add dropdown-menu
bunx shadcn@latest add command
bunx shadcn@latest add separator
bunx shadcn@latest add avatar
bunx shadcn@latest add progress
bunx shadcn@latest add scroll-area
bunx shadcn@latest add tooltip
bunx shadcn@latest add select
bunx shadcn@latest add switch
bunx shadcn@latest add checkbox
```

- [ ] **Step 3: Verify components installed**

```bash
ls apps/memberry/src/components/ui/
```

Expected: 22 component files (button.tsx, card.tsx, input.tsx, etc.)

- [ ] **Step 4: Verify build still compiles**

```bash
cd apps/memberry && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/memberry/src/components/ui/ apps/memberry/package.json apps/memberry/components.json
git commit -m "feat(f0): install 22 shadcn/ui components"
```

---

## Task 3: Build Shared Pattern Components

**Files:**
- Create: `apps/memberry/src/components/patterns/status-badge.tsx`
- Create: `apps/memberry/src/components/patterns/stat-card.tsx`
- Create: `apps/memberry/src/components/patterns/empty-state.tsx`
- Create: `apps/memberry/src/components/patterns/skeleton-loader.tsx`
- Create: `apps/memberry/src/components/patterns/page-header.tsx`
- Create: `apps/memberry/src/components/patterns/avatar-initials.tsx`
- Create: `apps/memberry/src/components/patterns/confirm-dialog.tsx`

- [ ] **Step 1: Create StatusBadge component**

Create `apps/memberry/src/components/patterns/status-badge.tsx`:

```tsx
const STATUS_CONFIG = {
  active: { label: "Active", className: "text-success bg-success-bg" },
  grace: { label: "Grace", className: "text-warning bg-warning-bg" },
  lapsed: { label: "Lapsed", className: "text-error bg-error-bg" },
  pending: { label: "Pending", className: "text-info bg-info-bg" },
  suspended: { label: "Suspended", className: "text-muted bg-[var(--color-border-light)]" },
} as const

type MembershipStatus = keyof typeof STATUS_CONFIG

export function StatusBadge({ status }: { status: MembershipStatus }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending
  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-micro font-semibold ${config.className}`}
    >
      {config.label}
    </span>
  )
}
```

- [ ] **Step 2: Create StatCard component**

Create `apps/memberry/src/components/patterns/stat-card.tsx`:

```tsx
interface StatCardProps {
  label: string
  value: string | number
  change?: { value: string; positive: boolean }
  accent?: boolean
}

export function StatCard({ label, value, change, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-md border p-5 ${
        accent
          ? "bg-cream-light border-cream"
          : "bg-surface border-border-light"
      }`}
    >
      <p className="text-caption text-muted">{label}</p>
      <p className="text-h1 tabular-nums mt-1" style={{ color: "var(--color-primary)" }}>
        {value}
      </p>
      {change && (
        <p className={`text-micro mt-1 ${change.positive ? "text-success" : "text-error"}`}>
          {change.positive ? "+" : ""}{change.value}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create EmptyState component**

Create `apps/memberry/src/components/patterns/empty-state.tsx`:

```tsx
import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  headline: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, headline, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="text-primary-lighter mb-4">{icon}</div>}
      <h3 className="text-h3" style={{ color: "var(--color-primary)" }}>{headline}</h3>
      {description && (
        <p className="text-body-sm text-muted mt-2 max-w-[400px]">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-[22px] py-[10px] rounded-sm bg-primary text-white text-body-sm font-semibold hover:bg-primary-mid transition-colors duration-150"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create SkeletonLoader variants**

Create `apps/memberry/src/components/patterns/skeleton-loader.tsx`:

```tsx
function Bone({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-sm bg-[var(--color-border-light)] animate-shimmer bg-[length:200%_100%] bg-gradient-to-r from-[var(--color-border-light)] via-[var(--color-surface)] to-[var(--color-border-light)] ${className ?? ""}`}
    />
  )
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Bone className="h-[34px] w-[34px] rounded-full shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3.5" style={{ width: `${60 + (i % 3) * 15}%` }} />
            <Bone className="h-3 w-[40%]" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton() {
  return (
    <div className="rounded-md border border-border-light p-5 space-y-3">
      <Bone className="h-4 w-[60%]" />
      <Bone className="h-8 w-[40%]" />
      <Bone className="h-3 w-[80%]" />
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="flex flex-col items-center gap-4">
      <Bone className="h-[120px] w-[120px] rounded-full" />
      <Bone className="h-5 w-[200px]" />
      <Bone className="h-4 w-[150px]" />
      <div className="w-full space-y-3 mt-4">
        <Bone className="h-12 w-full rounded-md" />
        <Bone className="h-12 w-full rounded-md" />
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-md border border-border-light overflow-hidden">
      <div className="bg-surface-warm px-5 py-2.5 flex gap-5">
        {Array.from({ length: cols }).map((_, i) => (
          <Bone key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="px-5 py-3.5 flex gap-5 border-t border-border-light">
          {Array.from({ length: cols }).map((_, j) => (
            <Bone key={j} className="h-3.5 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Create PageHeader component**

Create `apps/memberry/src/components/patterns/page-header.tsx`:

```tsx
import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; href?: string }[]
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="mb-6">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 mb-2 text-caption text-muted">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-primary transition-colors">{crumb.label}</a>
              ) : (
                <span className="text-[var(--color-text)] font-semibold">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2">{title}</h1>
          {subtitle && <p className="text-body-sm text-muted mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create AvatarInitials component**

Create `apps/memberry/src/components/patterns/avatar-initials.tsx`:

```tsx
const SIZES = {
  sm: { container: "h-[34px] w-[34px]", text: "text-[12px]" },
  md: { container: "h-[42px] w-[42px]", text: "text-[16px]" },
  lg: { container: "h-[56px] w-[56px]", text: "text-[22px]" },
} as const

const BG_COLORS = ["bg-primary", "bg-primary-mid", "bg-primary-light"] as const

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarInitialsProps {
  name: string
  size?: "sm" | "md" | "lg"
  photoUrl?: string | null
  statusRing?: "success" | "warning" | "error" | "info"
}

export function AvatarInitials({ name, size = "sm", photoUrl, statusRing }: AvatarInitialsProps) {
  const sizeConfig = SIZES[size]
  const bgIndex = name.length % BG_COLORS.length
  const ringClass = statusRing
    ? `ring-[3px] ring-offset-2 ring-${statusRing}`
    : ""

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={`${sizeConfig.container} rounded-full object-cover ${ringClass}`}
      />
    )
  }

  return (
    <div
      className={`${sizeConfig.container} ${BG_COLORS[bgIndex]} rounded-full flex items-center justify-center ${ringClass}`}
    >
      <span className={`${sizeConfig.text} font-display font-bold text-white`}>
        {getInitials(name)}
      </span>
    </div>
  )
}
```

- [ ] **Step 7: Create ConfirmDialog component**

Create `apps/memberry/src/components/patterns/confirm-dialog.tsx`:

```tsx
import { useState, type ReactNode } from "react"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string | ReactNode
  confirmLabel: string
  onConfirm: () => void
  variant?: "destructive" | "high-consequence" | "irreversible"
  confirmText?: string // required text for irreversible
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  confirmText,
}: ConfirmDialogProps) {
  const [typedText, setTypedText] = useState("")
  const canConfirm = variant === "irreversible" ? typedText === confirmText : true

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative bg-surface rounded-md border border-border p-6 max-w-md w-full mx-4 shadow-deep">
        <h3 className="text-h3 mb-2">{title}</h3>
        <div className="text-body-sm text-text-secondary mb-4">{description}</div>

        {variant === "irreversible" && confirmText && (
          <div className="mb-4">
            <label className="text-caption text-muted block mb-1.5">
              Type <span className="font-mono font-semibold">{confirmText}</span> to confirm
            </label>
            <input
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              className="w-full px-4 py-[11px] border border-border rounded-sm text-body-sm focus:border-primary focus:ring-[4px] focus:ring-primary-subtle outline-none"
              autoFocus
            />
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setTypedText(""); onOpenChange(false) }}
            className="px-[22px] py-[10px] rounded-sm border-[1.5px] border-border text-body-sm font-semibold text-primary hover:border-primary hover:bg-primary-subtle transition-colors duration-150"
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); setTypedText(""); onOpenChange(false) }}
            disabled={!canConfirm}
            className="px-[22px] py-[10px] rounded-sm bg-error text-white text-body-sm font-semibold hover:bg-error/90 disabled:opacity-50 transition-colors duration-150"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Verify build**

```bash
cd apps/memberry && bun run typecheck
```

- [ ] **Step 9: Commit**

```bash
git add apps/memberry/src/components/patterns/
git commit -m "feat(f0): shared pattern components — badges, cards, skeletons, empty states, dialogs"
```

---

## Task 4: Build Member Layout Shell

**Files:**
- Create: `apps/memberry/src/components/layout/member-sidebar.tsx`
- Create: `apps/memberry/src/components/layout/member-bottom-nav.tsx`
- Modify: `apps/memberry/src/routes/_authenticated.tsx`

- [ ] **Step 1: Create member sidebar (desktop)**

Create `apps/memberry/src/components/layout/member-sidebar.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { Home, Calendar, Award, User } from "lucide-react"

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

interface MemberSidebarProps {
  userEmail?: string
}

export function MemberSidebar({ userEmail }: MemberSidebarProps) {
  return (
    <aside className="hidden md:flex w-[250px] bg-primary text-white flex-col shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/[0.12]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-cream flex items-center justify-center">
            <span className="text-primary font-display font-bold text-[14px]">M</span>
          </div>
          <span className="font-display text-h3 text-white">Memberry</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-2.5 px-6 py-2.5 text-body-sm text-white/65 hover:text-white hover:bg-white/[0.08] transition-colors duration-150"
            activeProps={{
              className:
                "flex items-center gap-2.5 px-6 py-2.5 text-body-sm text-white font-semibold bg-white/[0.12] border-l-[3px] border-cream pl-[21px]",
            }}
          >
            <Icon size={18} className="shrink-0" style={{ opacity: "inherit" }} />
            {label}
          </Link>
        ))}
      </nav>

      {/* User */}
      <div className="px-6 py-4 border-t border-white/[0.12]">
        <p className="text-[11px] text-white/50 truncate">{userEmail}</p>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create member bottom nav (mobile)**

Create `apps/memberry/src/components/layout/member-bottom-nav.tsx`:

```tsx
import { Link } from "@tanstack/react-router"
import { Home, Calendar, Award, User } from "lucide-react"

const NAV_ITEMS = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/my/events", label: "Activities", icon: Calendar },
  { to: "/my/credits", label: "Credits", icon: Award },
  { to: "/my/profile", label: "Profile", icon: User },
] as const

export function MemberBottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-surface border-t border-border-light flex items-center justify-around z-40">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-[3px] text-muted"
          activeProps={{ className: "flex flex-col items-center gap-[3px] text-primary" }}
        >
          <Icon size={22} />
          <span className="text-[11px] font-medium">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
```

- [ ] **Step 3: Update _authenticated.tsx to use new layout**

Replace `apps/memberry/src/routes/_authenticated.tsx` with:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { requireAuth } from "@/utils/guards"
import { MemberSidebar } from "@/components/layout/member-sidebar"
import { MemberBottomNav } from "@/components/layout/member-bottom-nav"

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: requireAuth,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext() as any

  return (
    <div className="flex min-h-screen bg-background">
      <MemberSidebar userEmail={user?.email} />
      <main className="flex-1 overflow-auto pb-[68px] md:pb-0">
        <div className="max-w-content mx-auto px-5 md:px-6 py-5 md:py-7">
          <Outlet />
        </div>
      </main>
      <MemberBottomNav />
    </div>
  )
}
```

- [ ] **Step 4: Verify build and existing tests still pass**

```bash
cd apps/memberry && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/memberry/src/components/layout/ apps/memberry/src/routes/_authenticated.tsx
git commit -m "feat(f0): member layout shell — desktop sidebar + mobile bottom nav per DESIGN.md"
```

---

## Task 5: Write F1 E2E Journey Test (TDD — test first)

**Files:**
- Create: `apps/memberry/tests/e2e/f1-member-dashboard.spec.ts`

- [ ] **Step 1: Write the failing E2E test**

Create `apps/memberry/tests/e2e/f1-member-dashboard.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"

const MEMBER_EMAIL = "member@memberry.ph"
const MEMBER_PASSWORD = "TestPass123!"
const ORG_ID = "ed8e3a96-8126-4341-be42-e6eb7940c562"

async function signInAsMember(page: import("@playwright/test").Page) {
  await page.goto("/auth/sign-in")
  await page.getByLabel("Email").fill(MEMBER_EMAIL)
  await page.getByLabel("Password").fill(MEMBER_PASSWORD)
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.waitForURL("**/dashboard")
}

test.describe("F1: Member Dashboard + Profile", () => {
  test.beforeEach(async ({ page }) => {
    await signInAsMember(page)
  })

  // --- Dashboard ---

  test("dashboard shows greeting and org membership cards", async ({ page }) => {
    // Should show greeting with member name
    await expect(page.getByText(/welcome|good/i)).toBeVisible()

    // Should show at least one org membership card
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()

    // Should show membership status badge
    await expect(page.locator("[data-testid='status-badge']").first()).toBeVisible()
  })

  test("dashboard shows credit summary widget", async ({ page }) => {
    // Credit summary section should exist
    await expect(page.getByText(/credits|cpd/i)).toBeVisible()
  })

  test("dashboard renders correctly on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/dashboard")

    // Mobile bottom nav should be visible
    await expect(page.locator("nav").filter({ has: page.getByText("Home") })).toBeVisible()

    // Desktop sidebar should be hidden
    await expect(page.locator("aside")).not.toBeVisible()
  })

  // --- Profile ---

  test("profile shows member info with photo area and details", async ({ page }) => {
    await page.goto("/my/profile")

    // Should show profile heading
    await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible()

    // Should show avatar/photo area
    await expect(page.locator("[data-testid='profile-avatar']")).toBeVisible()

    // Should show org memberships section
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()
  })

  test("profile edit saves changes", async ({ page }) => {
    await page.goto("/my/profile")

    // Click edit button
    await page.getByRole("button", { name: /edit/i }).click()

    // Should show editable form
    await expect(page.getByLabel(/first name|name/i)).toBeVisible()
  })

  // --- Organizations ---

  test("organizations page shows membership cards with status", async ({ page }) => {
    await page.goto("/my/organizations")

    // Should show page heading
    await expect(page.getByRole("heading", { name: /organizations/i })).toBeVisible()

    // Should show org cards with status badges
    await expect(page.getByText("PDA Metro Manila")).toBeVisible()
    await expect(page.locator("[data-testid='status-badge']").first()).toBeVisible()
  })

  // --- Settings ---

  test("settings shows tabbed sections", async ({ page }) => {
    await page.goto("/my/settings")

    // Should show settings heading
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible()

    // Should show tab navigation
    await expect(page.getByRole("tab", { name: /general|privacy|security|notifications/i }).first()).toBeVisible()
  })

  // --- Navigation ---

  test("sidebar navigation works on desktop", async ({ page }) => {
    // Click Profile in sidebar
    await page.locator("aside").getByText("Profile").click()
    await expect(page).toHaveURL(/\/my\/profile/)

    // Click Home
    await page.locator("aside").getByText("Home").click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("bottom nav works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto("/dashboard")

    // Tap Profile in bottom nav
    await page.locator("nav").filter({ has: page.getByText("Home") }).getByText("Profile").click()
    await expect(page).toHaveURL(/\/my\/profile/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Expected: Tests FAIL — dashboard is a stub heading, no greeting, no org cards, no status badges. This is correct TDD behavior.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/memberry/tests/e2e/f1-member-dashboard.spec.ts
git commit -m "test(f1): E2E journey test for member dashboard + profile (red)"
```

---

## Task 6: Build Member Dashboard Page

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/dashboard.tsx`

- [ ] **Step 1: Implement the dashboard page**

Replace `apps/memberry/src/routes/_authenticated/dashboard.tsx` with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { getPersonOptions, listPersonMembershipsOptions } from "@monobase/sdk-ts/react"
import { PageHeader } from "@/components/patterns/page-header"
import { StatCard } from "@/components/patterns/stat-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { AvatarInitials } from "@/components/patterns/avatar-initials"
import { EmptyState } from "@/components/patterns/empty-state"
import { CardSkeleton, ListSkeleton } from "@/components/patterns/skeleton-loader"
import { Calendar, Award, Bell, UserPlus } from "lucide-react"

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
})

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function DashboardPage() {
  const person = useQuery(getPersonOptions({ path: { id: "me" } }))
  const memberships = useQuery(listPersonMembershipsOptions({ path: { id: "me" } }))

  const displayName = person.data?.firstName
    ? `${person.data.firstName}`
    : "there"

  return (
    <div>
      <PageHeader
        title={`${getGreeting()}, ${displayName}`}
        subtitle="Your membership health at a glance"
      />

      {/* Onboarding prompt — show if profile incomplete */}
      {person.data && !person.data.specialization && (
        <Link
          to="/onboarding"
          className="block rounded-md border border-cream bg-cream-light p-4 mb-6 hover:border-cream-dark transition-colors"
        >
          <div className="flex items-center gap-3">
            <UserPlus size={20} className="text-primary shrink-0" />
            <div>
              <p className="text-body-sm font-semibold">Complete your profile</p>
              <p className="text-caption text-muted">Add your specialization and preferences</p>
            </div>
          </div>
        </Link>
      )}

      {/* Org Membership Cards */}
      <section className="mb-8">
        <h2 className="text-h4 mb-4">Your Organizations</h2>
        {memberships.isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : !memberships.data?.length ? (
          <EmptyState
            headline="No memberships yet"
            description="Join an organization to get started"
            action={{ label: "Find Organizations", onClick: () => {} }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {memberships.data.map((m: any) => (
              <Link
                key={m.id}
                to="/org/$orgId/members"
                params={{ orgId: m.organizationId }}
                className="block rounded-md border border-border-light bg-surface p-5 hover:shadow-soft transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <AvatarInitials
                      name={m.organizationName ?? "Org"}
                      size="md"
                    />
                    <div>
                      <p className="text-body-sm font-semibold">{m.organizationName}</p>
                      {m.memberNumber && (
                        <p className="text-caption text-muted">#{m.memberNumber}</p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={m.status ?? "pending"} />
                </div>
                {m.duesExpiry && (
                  <p className="text-caption text-muted mt-3">
                    Dues expire: {new Date(m.duesExpiry).toLocaleDateString()}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Quick Stats */}
      <section className="mb-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          <StatCard label="Organizations" value={memberships.data?.length ?? 0} />
          <StatCard label="CPD Credits" value="--" />
          <StatCard label="Upcoming Events" value="--" />
          <StatCard label="Notifications" value="--" />
        </div>
      </section>

      {/* Activity placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="rounded-md border border-border-light bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar size={18} className="text-muted" />
            <h3 className="text-h4">Upcoming Events</h3>
          </div>
          <EmptyState
            headline="No upcoming events"
            description="Events you register for will appear here"
          />
        </section>

        <section className="rounded-md border border-border-light bg-surface p-5">
          <div className="flex items-center gap-2 mb-3">
            <Award size={18} className="text-muted" />
            <h3 className="text-h4">Credit Progress</h3>
          </div>
          <EmptyState
            headline="No credits yet"
            description="Complete trainings and events to earn CPD credits"
          />
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the dashboard renders**

```bash
cd apps/memberry && bun run typecheck
```

- [ ] **Step 3: Run E2E tests**

Start API + app servers (if not running), then:
```bash
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Dashboard tests should pass now. Profile/settings tests may still fail — that's expected.

- [ ] **Step 4: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/dashboard.tsx
git commit -m "feat(f1): member dashboard — greeting, org cards, stats, activity sections"
```

---

## Task 7: Redesign Organizations Page

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/my/organizations.tsx`

- [ ] **Step 1: Rewrite organizations page per spec**

Replace `apps/memberry/src/routes/_authenticated/my/organizations.tsx` with:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { listPersonMembershipsOptions } from "@monobase/sdk-ts/react"
import { PageHeader } from "@/components/patterns/page-header"
import { StatusBadge } from "@/components/patterns/status-badge"
import { AvatarInitials } from "@/components/patterns/avatar-initials"
import { EmptyState } from "@/components/patterns/empty-state"
import { ListSkeleton } from "@/components/patterns/skeleton-loader"
import { Building2 } from "lucide-react"

export const Route = createFileRoute("/_authenticated/my/organizations")({
  component: MyOrganizationsPage,
})

function MyOrganizationsPage() {
  const memberships = useQuery(listPersonMembershipsOptions({ path: { id: "me" } }))

  return (
    <div className="max-w-[720px]">
      <PageHeader
        title="Organizations"
        subtitle="Your memberships across all organizations"
        actions={
          <button className="px-[22px] py-[10px] rounded-sm border-[1.5px] border-border text-body-sm font-semibold text-primary hover:border-primary hover:bg-primary-subtle transition-colors duration-150">
            Find Organizations
          </button>
        }
      />

      {memberships.isLoading ? (
        <ListSkeleton rows={3} />
      ) : !memberships.data?.length ? (
        <EmptyState
          icon={<Building2 size={40} />}
          headline="No memberships yet"
          description="Join a professional organization to access events, training, and credentials"
          action={{ label: "Find Organizations", onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {memberships.data.map((m: any) => (
            <Link
              key={m.id}
              to="/org/$orgId/members"
              params={{ orgId: m.organizationId }}
              className="flex items-center gap-4 rounded-md border border-border-light bg-surface p-5 hover:shadow-soft transition-shadow"
            >
              <AvatarInitials name={m.organizationName ?? "Org"} size="md" />
              <div className="flex-1 min-w-0">
                <p className="text-body-sm font-semibold truncate">{m.organizationName}</p>
                <div className="flex items-center gap-2 mt-1">
                  {m.memberNumber && (
                    <span className="text-caption text-muted">#{m.memberNumber}</span>
                  )}
                  {m.organizationType && (
                    <span className="text-caption text-muted">{m.organizationType}</span>
                  )}
                </div>
                {m.duesExpiry && (
                  <p className="text-caption text-muted mt-1">
                    Dues expire: {new Date(m.duesExpiry).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={m.status ?? "pending"} />
                {m.status === "grace" || m.status === "lapsed" ? (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                    className="px-4 py-[7px] rounded-sm bg-primary text-white text-[13px] font-semibold hover:bg-primary-mid transition-colors duration-150"
                  >
                    Pay Dues
                  </button>
                ) : null}
              </div>
            </Link>
          ))}

          {/* Cross-org independence notice */}
          <p className="text-caption text-muted text-center mt-4">
            Each organization manages its own membership, dues, and credits independently.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build + run E2E tests**

```bash
cd apps/memberry && bun run typecheck
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Organizations test should now pass.

- [ ] **Step 3: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/my/organizations.tsx
git commit -m "feat(f1): organizations page — membership cards with status, pay CTA, per spec"
```

---

## Task 8: Redesign Profile Page

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/my/profile.tsx`

- [ ] **Step 1: Rewrite profile page per spec**

The profile page needs a two-column layout on desktop (1/3 photo + status, 2/3 info sections) and single column on mobile. Read the current file at `apps/memberry/src/routes/_authenticated/my/profile.tsx` first, then update it to:

1. Use `PageHeader` component
2. Use `AvatarInitials` component (lg size, 120px on desktop)
3. Use `StatusBadge` for org membership status
4. Add `data-testid="profile-avatar"` to the avatar wrapper
5. Desktop: flex layout with `w-1/3` photo column and `w-2/3` details column
6. Mobile: single column, avatar centered above info
7. Keep existing data fetching logic (`getPersonOptions`, `updatePersonMutation`)
8. Keep existing edit form but wrap fields with proper styling from design tokens
9. Add collapsible sections: Contact, Professional Details, Org Memberships
10. Add quick links at bottom: Privacy, Security, ID Card, Data Export

Key changes from current:
- Replace hardcoded colors with design token classes
- Replace current avatar placeholder with `AvatarInitials` component
- Add responsive breakpoints (single column < md, two column >= md)
- Use `text-h2`, `text-body-sm`, `text-caption` utility classes

Do NOT delete the existing edit functionality — enhance it with proper form styling.

- [ ] **Step 2: Verify build + run E2E tests**

```bash
cd apps/memberry && bun run typecheck
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Profile tests should now pass.

- [ ] **Step 3: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/my/profile.tsx
git commit -m "feat(f1): profile page — two-column layout, avatar, sections per spec"
```

---

## Task 9: Redesign Settings Page

**Files:**
- Modify: `apps/memberry/src/routes/_authenticated/my/settings.tsx`

- [ ] **Step 1: Rewrite settings page per spec**

The settings page needs tabbed navigation (General, Privacy, Security, Notifications). Read the current file at `apps/memberry/src/routes/_authenticated/my/settings.tsx` first, then update it to:

1. Use `PageHeader` component
2. Use shadcn `Tabs` component for 4-tab navigation
3. Keep existing data fetching logic for notifications and privacy
4. Desktop: `max-w-[600px]` centered, vertical tab list on left
5. Mobile: tabs as segmented control at top
6. General tab: edit profile link + danger zone (account deletion)
7. Privacy tab: existing privacy toggles with improved styling
8. Security tab: change password, change email, MFA section, active sessions
9. Notifications tab: existing notification preferences with matrix layout

Key changes from current:
- Wrap in `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` from shadcn
- Add `role="tab"` attributes (shadcn Tabs does this automatically)
- Replace toggle switches with shadcn `Switch` component
- Add danger zone with `ConfirmDialog` for account deletion

- [ ] **Step 2: Verify build + run E2E tests**

```bash
cd apps/memberry && bun run typecheck
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Settings tests should now pass.

- [ ] **Step 3: Commit**

```bash
git add apps/memberry/src/routes/_authenticated/my/settings.tsx
git commit -m "feat(f1): settings page — tabbed sections (general, privacy, security, notifs)"
```

---

## Task 10: Add StatusBadge data-testid + Final E2E Pass

**Files:**
- Modify: `apps/memberry/src/components/patterns/status-badge.tsx` (add data-testid)

- [ ] **Step 1: Add data-testid to StatusBadge**

In `apps/memberry/src/components/patterns/status-badge.tsx`, add `data-testid="status-badge"` to the `<span>`:

```tsx
<span
  data-testid="status-badge"
  className={`inline-flex items-center px-3 py-1 rounded-full text-micro font-semibold ${config.className}`}
>
```

- [ ] **Step 2: Run full E2E test suite**

```bash
cd apps/memberry && bun run test:e2e f1-member-dashboard
```

Expected: All F1 tests pass (green).

- [ ] **Step 3: Run existing E2E tests to ensure no regressions**

```bash
cd apps/memberry && bun run test:e2e
```

Expected: Existing tests still pass. Dashboard now shows real content instead of stub heading.

- [ ] **Step 4: Run typecheck**

```bash
cd apps/memberry && bun run typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/memberry/src/components/patterns/status-badge.tsx
git commit -m "test(f1): add data-testid to StatusBadge, all F1 E2E tests pass (green)"
```

---

## Verification Checklist

After all tasks complete:

1. **`bun run typecheck`** — zero type errors
2. **`bun run test:e2e f1-member-dashboard`** — all F1 journey tests pass
3. **`bun run test:e2e`** — full suite passes (no regressions)
4. **Manual check:** Start API (`cd services/api-ts && bun dev`) + app (`cd apps/memberry && bun dev`), sign in as member@memberry.ph, verify:
   - Dashboard shows greeting + org cards + stats
   - Profile shows avatar + info sections
   - Organizations shows membership cards with status badges
   - Settings shows tabbed sections
   - Mobile viewport (375px) shows bottom nav, hides sidebar
5. **Design check:** Fonts are General Sans (headings) + Plus Jakarta Sans (body). Colors match DESIGN.md. Sidebar is 250px dark purple. Cards have proper border-radius (12px) and shadows.
