# UI Consistency Spec

```yaml
# UI Consistency Spec — memberry
# Generated: 2026-05-30T00:00:00Z
# Source: infer-from-code
# Mode: pilot (oli-spec-ui --infer-from-code, sampled inference)
# spec_sha: sha256:pilot-7a3c1e9d
# curation:
#   gate: oli-spec-gate Phase C (3 structural decisions)
#   date: 2026-05-31
#   reviewer: Claude Opus + Elad (sign-off authority)
#   spec_sha_curated: sha256:phaseC-3decisions-2026-05-31
#   decisions_resolved:
#     - D1-pageshell    # EU-PAGESHELL-MISSING ×145 → EXTRACT canonical <PageShell> (contract blessed; adoption deferred)
#     - D2-button       # EU-BUTTON-CHAOS gini=0.623 + 101 className overrides → bless fullWidth prop + size xs/xl + tonal variant
#     - D3-dual-token   # EU-TAILWIND-CONFIG-DRIFT → admin migrates to var(--color-*) shape (memberry = base)
#   also_resolved: [input.size, input.variant, card.variant, modal.size, button.size.default, button.variant.default]
#   deferred_to_human: [typography.semantic_enum values, microcopy, tokens.colors.orphans file paths, spacing.arbitrary_outliers, icon avatar-gap, z_index low-evidence]
#   adoption_scope: SEPARATE planned phase AFTER this spec is blessed (145-file PageShell, 78-file Button, admin token migration). DO NOT mass-refactor from this gate.
# Notes:
#   - This is a brownfield first-pass spec produced by sampled grep/AST-lite analysis
#     (Babel AST not used in pilot; sample sizes per cluster listed in inferred_markers).
#   - Authoritative tailwind config: apps/memberry/tailwind.config.ts.
#     apps/admin/tailwind.config.ts uses a divergent (hsl-var) token system —
#     RESOLVED below (D3): admin migrates to memberry var(--color-*) shape.
#   - Canonical components live in packages/ui (29 shadcn-style primitives).

_meta:
  framework: vite+react
  router: tanstack-router
  apps:
    - apps/memberry  # 127 routes, 142 Button instantiations sampled
    - apps/admin     # 22 routes, 43 Button instantiations sampled
  component_library: shadcn-style local (packages/ui)
  styling: tailwind v3 + tailwindcss-animate + tailwind-merge + clsx
  classname_resolver:
    function: cn
    location: packages/ui/src/lib/utils.ts
    impl: twMerge(clsx(...inputs))
    consumers_outside_ui: 11 files (cn imported from @monobase/ui)
  canonical_dual_token_system: true  # RESOLVED D3 (2026-05-31): two configs diverge; admin migrates to memberry shape
  dual_token_resolution:             # D3 — EU-TAILWIND-CONFIG-DRIFT (was P2 [VERIFY])
    decision: "reconcile-to-memberry"
    base_app: apps/memberry                 # per CLAUDE.md memberry is the base token shape
    canonical_shape: "var(--color-*)"        # direct CSS-var ref, full color values
    divergent_app: apps/admin                # currently hsl(var(--*)) + calc(var(--radius))
    migration:                               # SPEC ONLY — adoption is a separate phase
      - "apps/admin/tailwind.config.ts: rewrite every hsl(var(--X)) → var(--color-X); rename keys to match memberry palette"
      - "apps/admin globals.css :root: redefine vars from HSL-channel triplets (H S% L%) to full color values prefixed --color-* IN LOCKSTEP with the config change, else admin theme breaks"
      - "apps/admin borderRadius: replace var(--radius)/calc(var(--radius)-Npx) with explicit sm:8px md:12px lg:18px (memberry scale)"
      - "Backfill admin palette parity: cream/surface/text-secondary/border-light/status-{success,warning,error,info}{,-bg} missing from admin config today"
    risk: "config-shape and :root var definitions MUST change together; a half-migration (config switched, :root unchanged) renders admin unstyled. Migrate atomically per-token-group."
    not_applied_here: true                   # gate writes the decision; the code migration runs in adoption phase

tokens:
  colors:
    primitive:
      # Source: apps/memberry/tailwind.config.ts (CSS-variable backed) — CANONICAL.
      # RESOLVED D3: var(--color-*) is the blessed shape. apps/admin hsl(var(--*)) migrates to it
      #   (see _meta.dual_token_resolution above). These primitives are the cross-app target.
      brand-primary: var(--color-primary)
      brand-primary-mid: var(--color-primary-mid)
      brand-primary-light: var(--color-primary-light)
      brand-primary-lighter: var(--color-primary-lighter)
      brand-primary-subtle: var(--color-primary-subtle)
      cream: var(--color-cream)
      cream-light: var(--color-cream-light)
      cream-dark: var(--color-cream-dark)
      surface: var(--color-surface)
      surface-warm: var(--color-surface-warm)
      bg: var(--color-bg)
      text: var(--color-text)
      text-secondary: var(--color-text-secondary)
      muted: var(--color-muted)
      border: var(--color-border)
      border-light: var(--color-border-light)
      status-success: var(--color-success)
      status-success-bg: var(--color-success-bg)
      status-warning: var(--color-warning)
      status-warning-bg: var(--color-warning-bg)
      status-error: var(--color-error)
      status-error-bg: var(--color-error-bg)
      status-info: var(--color-info)
      status-info-bg: var(--color-info-bg)
    semantic:
      brand: brand-primary
      surface: surface
      text: text
      text-muted: text-secondary
      border: border
      status:
        error: status-error
        warning: status-warning
        success: status-success
        info: status-info
    orphans:
      # [VERIFY: color-orphan] — hardcoded hex values found in source (raw color leakage)
      - { value: "#ef4444", count: 5, files: "[VERIFY] (memberry+admin)" }
      - { value: "#22c55e", count: 5, files: "[VERIFY]" }
      - { value: "#e5e7eb", count: 2, files: "[VERIFY]" }
      - { value: "#eab308", count: 1, files: "[VERIFY]" }
      - { value: "#6b7280", count: 1, files: "[VERIFY]" }
      - { value: "#2D2635", count: 1, files: "[VERIFY]" }

  spacing:
    # Source: apps/memberry/tailwind.config.ts theme.extend.spacing (explicit 4px scale)
    # Confirmed by usage distribution: top spacing literals all align with this scale.
    scale: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]
    # Top observed spacing usage (sample, both apps combined):
    #   p-4: 321 | gap-2: 303 | py-2: 219 | px-3: 212 | gap-3: 212 | py-3: 202
    #   px-4: 179 | gap-4: 161 | mt-1: 158 | space-y-6: 157
    arbitrary_outliers:
      # [VERIFY: spacing-outlier] — values off-scale found in code; recommend fold into scale or remove
      - { value: "py-[11px]", count: 3 }
      - { value: "gap-[3px]", count: 2 }
      - { value: "py-[8px]", count: 1 }   # already in scale; collapse to py-2
      - { value: "px-[16px]", count: 1 }  # already in scale; collapse to px-4
      - { value: "mt-[6px]", count: 1 }

  radius:
    # Source: apps/memberry/tailwind.config.ts theme.extend.borderRadius — CANONICAL.
    # RESOLVED D3: apps/admin calc(var(--radius)) migrates to these explicit values
    #   (see _meta.dual_token_resolution above).
    sm: 8
    md: 12
    lg: 18
    full: 9999

  typography:
    # [VERIFY: typography-advisory] (per CI-6 spec — typography advisory in v1)
    # Two type systems coexist:
    #   1. Custom semantic (memberry only): text-hero, text-h1..h4, text-body, text-body-sm
    #   2. Raw tailwind size (both apps): text-xs..text-3xl
    # Observed counts: text-sm 929, text-xs 619, text-h4 74, text-2xl 52, text-body-sm 43,
    #   text-h3 34, text-lg 23, text-h2 18, text-xl 15, text-base 14, text-3xl 12, text-h1 10
    # Recommendation: declare canonical semantic enum, deprecate raw text-* in pages.
    semantic_enum:  # [VERIFY: typography-semantic]
      hero:    { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      h1:      { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      h2:      { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      h3:      { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      h4:      { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      body:    { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      body-sm: { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
      caption: { font-size: "[VERIFY]", line-height: "[VERIFY]", font-weight: "[VERIFY]" }
    families:
      display: 'DM Sans Variable, DM Sans, sans-serif'
      body:    'Plus Jakarta Sans Variable, Plus Jakarta Sans, sans-serif'
      mono:    'JetBrains Mono, monospace'

  shadows:
    # Source: apps/memberry/tailwind.config.ts theme.extend.boxShadow
    soft:   var(--shadow-soft)
    medium: var(--shadow-medium)
    deep:   var(--shadow-deep)

  z_index:
    # Confirmed by usage clustering (observed: z-50:17, z-10:10, z-40:2, z-30:1, z-20:1)
    # Maps cleanly to canonical roles.
    base: 0
    dropdown: 10
    sticky: 20    # [VERIFY: low-evidence] (1 instance)
    overlay: 30   # [VERIFY: low-evidence] (1 instance)
    modal: 40
    popover: 40
    toast: 50

components:
  button:
    # Definition: packages/ui/src/components/button.tsx (CVA + Radix Slot)
    # Sample size: 185 instantiations (142 memberry + 43 admin)
    # RESOLVED D2 (2026-05-31): EU-BUTTON-CHAOS (gini=0.623) + EU-CLASSNAME-OVERRIDE-button-* (101 hits / 78 files).
    #   gini reflects a legitimately multi-variant codebase (not chaos to flatten). Root fix = give the
    #   CVA enough axes to ABSORB the common forbidden overrides instead of flagging them per-instance.
    #   The 101 overrides break down (UI_CONSISTENCY_REPORT): w-*:53 (≈w-full), bg-*:21, h-*:18,
    #   text-size:15, rounded-*:13, py-*:11, px-*:11, border-*:8, p-*:6, mx-*:2.
    #   → bless: fullWidth prop (absorbs w-full, the #1 category), size xs+xl (absorbs h-*/p-*/text-size
    #     micro/CTA buttons), variant tonal (absorbs bg-* soft-colored buttons).
    canonical_decision: D2-button
    size:
      enum: [xs, sm, default, lg, xl, icon]   # ADDED xs, xl (were [default,sm,lg,icon])
      defaultVariant: default
      added:
        xs: "h-7 px-2 text-xs"   # NEW — absorbs h-7/p-1/text-xs micro-button overrides
        xl: "h-11 px-10 text-base"  # NEW — absorbs CTA buttons hand-sized via h-*/px-*/text-*
      existing:
        default: "h-9 px-4 py-2"
        sm: "h-8 px-3 text-xs"
        lg: "h-10 px-8"
        icon: "h-9 w-9"
      observed_distribution:
        sm: 180
        icon: 37
        lg: 26
        default: 0   # RESOLVED: never set explicitly — it IS the CVA defaultVariant, so absence = default. Not a gap.
    variant:
      enum: [default, destructive, outline, secondary, ghost, link, tonal]   # ADDED tonal
      defaultVariant: default
      added:
        tonal: "bg-primary-subtle text-primary hover:bg-primary-lighter"  # NEW — soft brand fill; absorbs bg-* overrides
      observed_distribution:
        outline: 187
        ghost: 115
        destructive: 32
        secondary: 18
        link: 10
        default: 1   # RESOLVED: low explicit count is expected — default is the implicit fallthrough, not under-used.
    props:
      fullWidth:                 # NEW boolean prop — RESOLVED D2
        type: boolean
        applies: "w-full"
        rationale: "w-* is the single largest override category (53 hits, ~all w-full). A first-class prop removes the override class while keeping the layout affordance."
    className_override_audit:
      total_with_className: 11
      forbidden_token_hits:
        - { token: "bg-*",  count: 4 }   # → migrate to variant=tonal (or a colored variant)
        - { token: "w-*",   count: 4 }   # → migrate to fullWidth prop
        - { token: "text-*",count: 3 }   # → migrate to size xs/xl
        - { token: "h-*",   count: 2 }   # → migrate to size xs (h-7)
        - { token: "p-*",   count: 5 }   # → migrate to size xs/xl
        - { token: "border-*", count: 1 }
    forbidden_override_tokens:
      # w-* STAYS forbidden in className — fullWidth prop is the sanctioned path; raw w-* is not.
      ["p-*","px-*","py-*","m-*","h-*","w-*","text-{xs,sm,base,lg,xl,2xl}","rounded-*","bg-*","border-*"]
    allowlist:
      ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*","ms-*","me-*","sr-only","focus-visible:*"]
    adoption_note: "78-file override migration → SEPARATE phase. This gate only blesses the enum/prop additions in packages/ui/src/components/button.tsx; it does not edit call sites."

  input:
    # Definition: packages/ui/src/components/input.tsx (NO CVA — single canonical variant)
    # Sample: 0 className overrides found in apps (clean adherence).
    size:
      enum: [default]   # RESOLVED: input.tsx has no size prop. Single-variant primitive is CANONICAL — do not add CVA size.
      note: "Input is a single-variant primitive (h-9 px-3 py-1). Schema 'size' was a skill template artifact; code is authority."
    variant:
      enum: [default]  # RESOLVED: only `default` exists. error/disabled are HTML-attribute driven (aria-invalid / :disabled), NOT CVA variants — removed from enum.
    observed_className_overrides: 0
    forbidden_override_tokens:
      ["p-*","px-*","py-*","m-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist:
      ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*","ms-*","me-*","w-*","sr-only"]

  card:
    # Definition: packages/ui/src/components/card.tsx (no CVA)
    # Compound: Card / CardHeader / CardTitle / CardDescription / CardContent / CardFooter
    variant:
      enum: [default]   # RESOLVED: Card has no CVA — single variant is CANONICAL. Schema's [elevated,outlined] was a template artifact; not adopted.
    observed_className_overrides: 10   # P3 — moderate override usage
    forbidden_override_tokens:
      ["p-*","px-*","py-*","m-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist:
      ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*","ms-*","me-*","sr-only","max-w-*"]

  modal:
    # Canonical: packages/ui/src/components/dialog.tsx (Radix-backed)
    # Also: alert-dialog, sheet — see "interaction_composition" below.
    # Sample: 27 <Dialog|AlertDialog|Sheet> instantiations across both apps.
    size:
      enum: [default]   # RESOLVED: Dialog has fixed max-w-lg, no size prop. Single-variant is CANONICAL for v1; sm/md/lg/fullscreen deferred (no current demand in 27 instances).
      observed_default_max_width: "max-w-lg"
    forbidden_override_tokens:
      ["p-*","px-*","py-*","m-*","h-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist:
      ["data-*","aria-*","animate-*","sm:*","md:*","w-*","max-w-*","sr-only"]

  badge:
    # Definition: packages/ui/src/components/badge.tsx (CVA, variant only — no size)
    variant:
      enum: [default, secondary, destructive, outline]
      defaultVariant: default
    forbidden_override_tokens:
      ["p-*","px-*","py-*","m-*","h-*","w-*","text-{xs,sm,base,lg,xl}","rounded-*","bg-*","border-*"]
    allowlist:
      ["data-*","aria-*","animate-*","mt-*","mb-*","ml-*","mr-*","ms-*","me-*","sr-only"]

  icon:
    # Source: lucide-react (every icon used inline as JSX with className for size)
    # Observed Tailwind size classes on icons (sample, both apps):
    #   h-4 w-4: 110 | h-8 w-8: 23 | h-5 w-5: 19 | h-3 w-3: 16 | h-6 w-6: 15 | h-10 w-10: 15
    # Dominant cluster (h-4 w-4 = 16px): 110 instances → canonical "size-16"
    # [VERIFY] — recommend dedicated <Icon size={16|20|24}/> wrapper to remove h-*/w-* leakage
    size:
      enum: [12, 16, 20, 24, 32]
      defaultVariant: 16
      observed_distribution:
        16: 110
        32: 23
        20: 19
        12: 16
        24: 15
        40: 15
    forbidden_override_tokens:
      ["h-*","w-*","p-*","m-*"]
    allowlist:
      ["data-*","aria-*","text-*","stroke-*","fill-*"]

layout:
  primitives:
    # RESOLVED D1 (2026-05-31): EU-PAGESHELL-MISSING ×145.
    #   Decision = EXTRACT a canonical <PageShell> into packages/ui (verified state: memberry wraps content
    #   in `max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7` inline at routes/_authenticated.tsx:89;
    #   admin __root.tsx <main> has NO width/gutter wrapper → 0% coverage). A named, importable component
    #   is the only way to make adherence MEASURABLE and to give admin a shared shell.
    #   Current 145 unwrapped routes = accepted as GENESIS FLOOR (KNOWN debt); adoption ratchets in a
    #   separate phase. This gate blesses the CONTRACT only — it does not create the component or refactor routes.
    page_shell:
      decision: "extract-to-packages-ui"
      canonical_target: packages/ui/src/components/page-shell.tsx   # NEW component (adoption phase creates it)
      component_name: PageShell
      content_max_width: 1200            # default; from max-w-[1200px] + theme.maxWidth.content
      gutter_token: "px-5 md:px-6"       # 20px → 24px (default prop value)
      vertical_padding_token: "py-5 md:py-7"  # 20px → 28px (default prop value)
      contract:
        props:
          - { name: maxWidth, type: "'content'|'full'|number", default: "content", note: "content = 1200px" }
          - { name: gutter, type: string, default: "px-5 md:px-6" }
          - { name: verticalPadding, type: string, default: "py-5 md:py-7" }
          - { name: children, type: ReactNode, required: true }
        slots:
          - { name: header, optional: true, composes: PageHeader, note: "renders above content within the shell" }
          - { name: children, note: "main page content; centered + gutter-padded" }
        renders: "<div class='max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-7'>{header?}{children}</div>"
      adoption:
        memberry: "routes/_authenticated.tsx:89 — replace the inline div wrapper with <PageShell>"
        admin: "routes/__root.tsx:196 <main> — wrap <Outlet/> in <PageShell> (admin has none today; this is the parity fix)"
        genesis_floor: 145   # current unwrapped non-skipped routes; KNOWN debt, ratchet on next run after adoption
      observed_consistency: "memberry: content inherits _authenticated.tsx wrapper (file-route); admin: inline-only, no shared shell"
    page_header:
      component_name: PageHeader
      location: apps/memberry/src/components/patterns/page-header.tsx
      props: ["title","subtitle","breadcrumbs","actions"]
    grid:
      allowed_columns: [1, 2, 3, 4, 6, 12]   # [VERIFY: not-yet-enforced] — recommendation, not measured

  composition:
    rule: >
      Every authenticated route under apps/memberry must render inside the _authenticated.tsx
      file-route layout (TanStack file-based routing handles this automatically), which (post-D1
      adoption) mounts <PageShell> as the content wrapper.
      RESOLVED D1: apps/admin gains a shared shell by wrapping __root.tsx <main> in <PageShell>.
    skip_table:
      tanstack_router:
        - __root.tsx
        - _authenticated.tsx
        - _*.tsx              # layout-only route files (TanStack prefix convention)
        - join.tsx            # public landing
        - verify-email.tsx
        - onboarding.tsx

microcopy:
  # [VERIFY: requires-human-authoring] — not inferred in pilot (out of scope for first-pass)
  button_verbs: "[VERIFY] (recommended: Save, Submit, Continue, Cancel, Delete, Remove, Edit, Create, Add)"
  error_format: "[VERIFY] (recommend: '{field} {validation}. Try {fix}.')"

interaction_composition:
  # Library primitives present in packages/ui — these are the building blocks for complex interactions.
  # [VERIFY: usage-not-clustered-in-pilot]
  searchable_dropdown:
    composition: ["Command", "Popover"]
    available_in_ui_package: true
  date_picker:
    composition: ["Calendar", "Popover"]
    available_in_ui_package: true
  drawer:
    composition: ["Sheet"]
    available_in_ui_package: true
  confirm_dialog:
    composition: ["AlertDialog"]
    available_in_ui_package: true

inferred_markers:
  - section: components.button.size
    value: [default, sm, lg, icon]
    confidence: 0.98
    rationale: "CVA enum extracted directly from button.tsx source"
    requires_verify: false

  - section: components.button.variant
    value: [default, destructive, outline, secondary, ghost, link]
    confidence: 0.98
    rationale: "CVA enum extracted directly from button.tsx source"
    requires_verify: false

  - section: components.button.observed_distribution
    confidence: 0.85
    sample_size: 185
    rationale: "Sampled via grep across apps/memberry+apps/admin (no Babel AST). variant=outline dominates (101%), but Gini > 0.3 — multi-variant codebase."
    requires_verify: false   # RESOLVED D2 — gini accepted as legitimate multi-variant; default=0/1 explained (implicit fallthrough)

  - section: components.button.className_override_audit
    confidence: 0.70
    sample_size: 11
    rationale: "11 instances with className= prop. Half hit forbidden tokens — confirms forbidden_override_tokens list is correct (overrides happen, should be blocked)."
    requires_verify: false

  - section: components.input.size
    value: [default]
    confidence: 1.0
    rationale: "RESOLVED — code is authority. input.tsx has no size prop; single-variant primitive blessed as canonical. Removed schema 'size' artifact."
    requires_verify: false
    resolution: "keep single-variant; do NOT add CVA size"

  - section: components.input.variant
    value: [default]
    confidence: 1.0
    rationale: "RESOLVED — error/disabled are HTML-attribute driven (aria-invalid / :disabled), not CVA variants. enum narrowed to [default]."
    requires_verify: false

  - section: components.card.variant
    value: [default]
    confidence: 1.0
    rationale: "RESOLVED — Card has no CVA; single variant is canonical. [elevated/outlined] was a template artifact, not adopted."
    requires_verify: false

  - section: components.modal.size
    value: [default]
    confidence: 1.0
    rationale: "RESOLVED — Dialog fixed max-w-lg; single-variant canonical for v1. sm/md/lg/fullscreen deferred (no demand across 27 instances)."
    requires_verify: false

  - section: components.badge.variant
    value: [default, secondary, destructive, outline]
    confidence: 0.98
    rationale: "CVA enum extracted directly from badge.tsx source"
    requires_verify: false

  - section: components.icon.size
    value: [12, 16, 20, 24, 32]
    confidence: 0.78
    sample_size: 198
    rationale: "h-N w-N tailwind cluster on lucide-react icons; top 5 clusters cover ~88% of instances. h-4 w-4 (16px) is dominant @ 56%."
    alternatives:
      - { value: 40, count: 15 }
      - { value: 48, count: 8 }
    requires_verify: true

  - section: tokens.spacing.scale
    value: [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80]
    confidence: 0.95
    rationale: "Extracted directly from apps/memberry/tailwind.config.ts theme.extend.spacing. Distribution analysis confirms top observed values all hit this scale (p-4 / gap-2 / py-2 / px-3 etc.). Only ~8 arbitrary [px] outliers across thousands of usages."
    requires_verify: false

  - section: tokens.spacing.arbitrary_outliers
    confidence: 0.90
    rationale: "Found arbitrary px values: py-[11px] x3, gap-[3px] x2, py-[8px] x1, px-[16px] x1, mt-[6px] x1. Recommend fold or remove."
    requires_verify: true

  - section: tokens.colors.primitive
    confidence: 0.85
    rationale: "CSS-var palette extracted from apps/memberry/tailwind.config.ts. Underlying --color-* values not extracted in pilot (would need globals.css scan)."
    alternatives:
      - { source: "apps/admin/tailwind.config.ts", shape: "hsl(var(--*))", incompatible: true }
    requires_verify: true

  - section: tokens.colors.orphans
    confidence: 0.95
    sample_size: 15
    rationale: "Hardcoded hex literals leaked into source code. P1 — token boundary violations."
    requires_verify: false

  - section: tokens.colors.dual_token_system
    confidence: 0.99
    rationale: "Two divergent tailwind configs. apps/memberry uses var(--color-*) raw; apps/admin uses hsl(var(--*)) wrapping. Cross-app components will color-shift."
    requires_verify: false   # RESOLVED D3 — reconcile-to-memberry; admin migrates (see _meta.dual_token_resolution). Migration is adoption-phase.

  - section: tokens.radius
    value: { sm: 8, md: 12, lg: 18, full: 9999 }
    confidence: 0.92
    rationale: "Extracted from apps/memberry/tailwind.config.ts. apps/admin uses calc(var(--radius)) — divergent (same root cause as colors)."
    requires_verify: false   # RESOLVED D3 — admin migrates to explicit sm:8/md:12/lg:18 (adoption phase)

  - section: tokens.typography.semantic_enum
    confidence: 0.45
    rationale: "Two systems coexist: custom (text-hero/h1-h4/body) + raw tailwind (text-xs/sm/base). Custom system is documented in CSS (not pilot-scanned) — values need human extraction."
    requires_verify: true

  - section: tokens.z_index
    value: { base: 0, dropdown: 10, sticky: 20, overlay: 30, modal: 40, popover: 40, toast: 50 }
    confidence: 0.65
    sample_size: 31
    rationale: "Observed: z-50 (17), z-10 (10), z-40 (2), z-30 (1), z-20 (1). Clean canonical mapping; sticky/overlay have low evidence."
    requires_verify: true

  - section: layout.primitives.page_shell
    confidence: 1.0
    rationale: "RESOLVED D1 — decision=extract-to-packages-ui. Canonical contract (props/slots/render) blessed in layout.primitives.page_shell.contract. Current 145 unwrapped routes accepted as genesis floor; component creation + route adoption = separate phase."
    requires_verify: false
    resolution: "extract <PageShell> to packages/ui/src/components/page-shell.tsx; memberry _authenticated.tsx:89 + admin __root.tsx:196 adopt it"

  - section: layout.primitives.page_shell.content_max_width
    value: 1200
    confidence: 0.85
    rationale: "Observed max-w-[1200px] in memberry _authenticated.tsx layout. Also matches theme.extend.maxWidth.content: 1200px."
    requires_verify: false

  - section: layout.composition.skip_table
    confidence: 0.75
    rationale: "TanStack Router convention: _-prefixed files are layout-only; __root.tsx is root. Skip table reflects this. No app-router/pages-router complications."
    requires_verify: false

  - section: microcopy.button_verbs
    confidence: 0.0
    rationale: "Not inferred in pilot."
    requires_verify: true
```

---

## Pilot Notes (not part of spec body)

This file was produced by `oli-spec-ui --infer-from-code` in **pilot mode**:
- AST traversal via Babel was approximated with `grep -E` + targeted `Read`. Counts are accurate; tuple resolution (size, variant, className_token_set) is partial.
- `cn()` resolver was not simulated — `className` literals were taken at face value.
- Spec is intended as input to `/oli-spec-gate` for human curation of every `[VERIFY]` marker.

Downstream consumers:
- `/oli-spec-gate` — validates VERIFY markers, requires human curation
- `/oli-execute` Phase 5b — TDD-time gate on canonical enums and forbidden override tokens
- `/oli-check --ui-consistency` — cross-codebase audit, finding namespace `EU-`
