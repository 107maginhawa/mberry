# Warm Liquid Glass UI Modernization

**Date:** 2026-05-12
**Status:** Design approved (revised after Codex review)
**Scope:** Persona-driven UI modernization across Memberry app

## Design Direction

**Aesthetic:** Warm Liquid Glass — inspired by iOS 26 liquid glass, adapted for web with warm cream/purple palette.

**Core Principles:**
- Translucent surfaces with backdrop-blur on desktop, opaque fallback on mobile (performance)
- Spring physics animations (bouncy, organic, alive)
- Warm palette preserved: primary purple #554B68, cream accent #F2DEB0, warm beige bg #FAF7F2
- Depth via layered glass surfaces, not flat cards
- Accessibility: prefers-reduced-motion kills ALL animation (springs + shimmer), contrast 4.5:1 minimum on translucent surfaces

**DESIGN.md Evolution (Codex #1):** Current DESIGN.md says "No decorative flourishes." Glass IS an intentional aesthetic evolution from clinical-minimal to warm-modern. Update DESIGN.md section 1 to reflect this: "Subtle depth and translucency reinforce hierarchy. Animation serves comprehension (stagger reveals reading order, CountUp draws attention to changes). Decoration that could be mistaken for data is still prohibited."

## Design Tokens

**Extend existing tokens** (Codex #4) — not a parallel system. Add glass variants to existing surface token family in `apps/memberry/src/styles/globals.css`:

```css
:root {
  /* Extend existing --color-surface with elevated variant */
  --color-surface-elevated: rgba(255, 255, 255, 0.80);
  --color-surface-elevated-hover: rgba(255, 255, 255, 0.90);
  --surface-blur: 12px;
  --color-surface-border-glass: rgba(255, 255, 255, 0.45);
  
  /* Extend existing --color-nav */
  --color-nav-elevated: rgba(255, 255, 255, 0.88);
  --nav-blur: 16px;
  
  /* Motion */
  --spring-bounce: 0.15;
  --spring-duration: 0.5s;
}

@media (max-width: 768px) {
  :root {
    --color-surface-elevated: rgba(255, 255, 255, 0.95);
    --surface-blur: 0px;
    --nav-blur: 0px;
  }
}

@media (prefers-reduced-motion: reduce) {
  :root {
    --spring-bounce: 0;
    --spring-duration: 0.01s;
  }
  /* Codex #5: also pause shimmer animations */
  .animate-shimmer { animation: none !important; }
}

.dark {
  --color-surface-elevated: rgba(45, 38, 53, 0.75);
  --color-surface-elevated-hover: rgba(45, 38, 53, 0.85);
  --color-surface-border-glass: rgba(255, 255, 255, 0.10);
  --color-nav-elevated: rgba(45, 38, 53, 0.85);
}
```

**Dark mode contrast rule (Codex #9):** All text on translucent surfaces must meet WCAG AA (4.5:1). If computed contrast falls below threshold, opacity floor rises to 0.90. Test with Chrome DevTools contrast checker on both light and dark.

## Component Approach (revised per Codex #11)

**Prototype first, abstract later.** Don't build 7 components before proving the pattern works.

### Phase 0 approach:
1. Apply glass styles INLINE on one dashboard stat card
2. Add ONE motion utility (`useSpringTransition` hook)
3. Validate: looks good at 375px + 1200px, light + dark, reduced-motion off + on
4. THEN extract into `GlassCard` component if pattern proves out
5. Only create additional components as needed per phase

### Eventual components (extracted as proven):
- **GlassCard** — elevated surface Card wrapper
- **GlassNav** — sticky nav with stronger blur. On mobile: opaque, no blur. Stacking: always above content, below sheets/dialogs (z-index 40)
- **GlassSheet** — frosted overlay + spring open/close
- **GlassPanel** — stat card with CountUp

## Motion Primitives

### PageTransition (Codex #3: specify exact placement)
Wrap the `<Outlet />` INSIDE `_authenticated.tsx` at line ~50, AFTER the layout chrome (sidebar + header + bottom nav). The chrome stays mounted. Only the content area transitions.

For officer layout: wrap `<Outlet />` inside the officer layout component, same pattern.

```tsx
// _authenticated.tsx — wrap ONLY the content outlet, not the shell
<main className="flex-1 overflow-y-auto">
  <AnimatePresence mode="wait">
    <motion.div key={location.pathname} /* spring config */ >
      <Outlet />
    </motion.div>
  </AnimatePresence>
</main>
```

### Animation + Data Policy (Codex #7)
- **Animate once on initial mount only.** Not on background refetch.
- **CountUp:** animate from 0 to value on first render. On refetch, snap to new value (no re-animation).
- **StaggerChildren:** animate on route entry. On refetch, no re-stagger.
- **Partial query failure:** failed widgets show error card immediately (no animation). Succeeded widgets animate normally.
- **Loading → data:** skeleton → content crossfade (opacity only, 150ms).

### Spring Config
```typescript
const SPRING_CONFIG = { damping: 25, stiffness: 300, mass: 0.5 };
```

## Mobile Behavior (Codex #6)

- **Cards:** opaque (0.95 opacity), no blur, normal shadows
- **Bottom nav:** opaque background, no blur
- **Header:** opaque background, no blur
- **Sheets/dialogs:** semi-transparent overlay (`bg-black/30`), content panel opaque
- **Stacking order:** content (z-0) < header (z-30) < bottom nav (z-40) < sheet overlay (z-50)
- **Animations:** springs still play (they're CPU, not GPU-blur). Reduced-motion kills them.

## Phase Rollout

### Phase 0: Prototype + Foundation
1. Add glass tokens to `globals.css` (extending existing, not parallel)
2. Update DESIGN.md section 1 with glass aesthetic rationale
3. Apply glass styles inline on ONE dashboard stat card as prototype
4. Add `useSpringTransition` hook
5. Wire `PageTransition` around content `<Outlet />` (not shell) in `_authenticated.tsx`
6. **Validate:** prototype card at 375px + 1200px, light + dark, reduced-motion on + off
7. If validated: extract `GlassCard` component
8. **Browser support check:** verify `backdrop-filter` support via caniuse (95%+ global). Add fallback: `@supports not (backdrop-filter: blur(1px)) { --surface-blur: 0px; --color-surface-elevated: rgba(255,255,255,0.95); }`

### Phase 1: P6 Dr. Rachel — Member Dashboard
- Apply glass treatment to all dashboard cards (using extracted GlassCard or inline)
- Add CountUp to stat widgets (animate once on mount)
- Add StaggerChildren to card grid (animate once on route entry)
- Typography/color token audit
- Replace spinners with shimmer skeletons
- Add empty states with `<EmptyState>`
- **Verify:** 375px + 1200px, light + dark, reduced-motion

### Phase 2-7: Same as before, applying proven patterns

Each phase follows same validation: mobile + desktop + dark + reduced-motion.

## Per-Page Checklist

Every page touched:
- [ ] Headings: `text-h1`/`h2`/`h3`/`h4` + `font-display`
- [ ] Body: `text-body`/`text-body-sm`
- [ ] Cards: glass treatment (elevated surface tokens)
- [ ] Colors: CSS variables, not generic Tailwind
- [ ] Loading: shimmer skeletons, never spinners
- [ ] Empty: `<EmptyState>` with contextual icon + CTA
- [ ] Error: error card with retry (not silent swallow)
- [ ] Lists/grids: stagger on initial mount only
- [ ] Stats: CountUp on initial mount only
- [ ] Touch targets: minimum 44x44px mobile
- [ ] `<PageHeader>` for title/subtitle
- [ ] Contrast: 4.5:1 on translucent surfaces (both themes)
- [ ] Reduced-motion: all animation disabled

## Validation Sequence (Codex #10)

Per phase, before moving to next:
1. **Browser support:** `@supports` fallback for backdrop-filter
2. **Mobile perf:** test on Chrome DevTools throttled 4x CPU slowdown
3. **Reduced-motion:** toggle `prefers-reduced-motion: reduce` in DevTools, confirm zero animation
4. **Dark mode:** toggle, verify contrast on all glass surfaces
5. **Visual regression:** screenshot at 375px + 1200px, compare before/after

## Constraints

- **No blur on mobile** (performance on budget Android)
- **No glass on text-heavy content** (readability)
- **No spring on form submissions** (feels laggy)
- **No new component library** — shadcn + Framer Motion only
- **No re-animation on data refetch** — animate once on mount
- **prefers-reduced-motion** disables ALL animation (springs + shimmer)
- Prototype first, extract components after validation
- One phase per session, validate before next

## Codex Review Integration

11 findings, 8 incorporated:
1. DESIGN.md conflict → update rationale (decorative vs functional)
2. Dashboard data quality → separate concern, not this spec
3. PageTransition placement → specified exact Outlet level
4. Token duplication → extend existing tokens, not parallel
5. Incomplete reduced-motion → added shimmer pause
6. Mobile behavior → specified stacking and opacity rules
7. Animation + async → animate once on mount, not on refetch
8. Silent fallbacks → noted as separate error-handling audit
9. Dark mode contrast → 4.5:1 minimum, opacity floor at 0.90
10. Validation sequence → added 5-step per-phase validation
11. Prototype first → Phase 0 is now inline prototype, then extract

## Files

| File | Role |
|------|------|
| `apps/memberry/src/styles/globals.css` | Extend existing tokens with glass variants |
| `apps/memberry/src/components/motion/` | Motion primitives (extracted after validation) |
| `apps/memberry/src/routes/_authenticated.tsx` | PageTransition around content Outlet only |
| `docs/ver-3/DESIGN.md` | Update section 1 with glass rationale |
| `apps/memberry/package.json` | framer-motion already installed |
