# UI-FORMS Audit — Memberry

**Scope:** `apps/memberry/src/**`, `apps/admin/src/**`
**Date:** 2026-06-02
**Method:** Static grep of `useForm`, `<form `, `useState` form patterns, `@monobase/ui` Form imports, `@hookform/resolvers`, aria attrs.

---

## 1. VERDICT

**MIXED — 6 / 10**

Strong baseline, weak convergence.

The library stack is unified (`react-hook-form` + Zod + `@monobase/ui` + sonner toast appears everywhere). But three competing field-wrapper dialects coexist (the shared `@monobase/ui` Form family, an in-app `components/patterns/form-field`, and a hand-rolled `Label + Input + <p>error` block), and **two forms still skip react-hook-form entirely** (`training-form`, `org-settings-form`, plus the `refund-form` mini-form). Required-asterisk markup is forked into at least 3 different className strings. A11y is patchy: only ~5 forms set `aria-describedby` explicitly when bypassing FormControl, no form sets `aria-invalid` outside the `@/components/patterns/form-field` wrapper. No unsaved-changes guard exists anywhere. `inputMode` is never used; numeric/email rely on `type=` only. Public auth pages are delegated to `@daveyplate/better-auth-ui`, so this audit covers in-app forms only.

The good news: the **canonical primitive already exists and works** (`@monobase/ui` Form), and the wrapper shim for the Zod-v4 / `@hookform/resolvers` v5.2 type mismatch is centralized at `apps/memberry/src/lib/zod-resolver.ts`. Convergence is a refactor problem, not a design problem.

---

## 2. FORM INVENTORY

Total: **22 forms** (19 react-hook-form-based, 3 useState-based).

| # | Path | State | Validation | Schema Source | Field Primitive | Error Display | Submit Loading |
|---|------|-------|------------|---------------|-----------------|----------------|----------------|
| 1 | `features/dues/components/record-payment-form.tsx` | RHF + Controller | zodResolver | local `z.object` | `@/components/patterns/form-field` (FormField) | wrapper-managed | `mutation.isPending` text swap |
| 2 | `features/dues/components/proof-upload-form.tsx` | RHF + Controller | zodResolver | local | hand-rolled `<Label> + <p>` | inline `<p id=*-error>` + manual `aria-describedby` | `busy = isUploading \|\| isPending` |
| 3 | `features/dues/components/dues-config-form.tsx` | RHF | zodResolver | local | hand-rolled | inline + manual `aria-describedby` | `saveMutation.isPending` |
| 4 | `features/dues/components/refund-form.tsx` | **useState** | hand-rolled (`amountError` const) | none | hand-rolled `<Label>+<Input>` | inline `<p>` only on amount | `mutation.isPending` |
| 5 | `features/person/components/contact-info-form.tsx` | RHF | zodResolver | `../schemas` | **`@monobase/ui` Form/FormField/FormItem/FormControl/FormLabel/FormDescription/FormMessage** | `<FormMessage />` | parent-driven (formId pattern) |
| 6 | `features/person/components/address-form.tsx` | RHF | zodResolver (`required` toggle) | `../schemas` | `@monobase/ui` Form (but FormLabel children include hand-rolled `<span className="text-red-500">*</span>`) | `<FormMessage />` | parent-driven |
| 7 | `features/person/components/preferences-form.tsx` | RHF | zodResolver | `../schemas` | `@monobase/ui` Form full suite | `<FormMessage />` | parent-driven |
| 8 | `features/person/components/personal-info-form.tsx` | RHF | zodResolver | `../schemas` | `@monobase/ui` Form (with hand-rolled `<span className="text-red-500">*</span>` inside FormLabel) | `<FormMessage />` | parent-driven |
| 9 | `features/training/components/training-form.tsx` | **useState** + helper `field(key)` | **none** (disabled button heuristic only) | none | hand-rolled `<Label>+<Input>` with `<span className="text-[var(--color-error)]">*</span>` | none — toast only | `saveMutation.isPending` ('Saving…' / 'Publishing…') |
| 10 | `features/admin/components/org-settings-form.tsx` | **useState** + draft/saved diff | **none** | none | hand-rolled `<Label>+<Input>` with asterisk span | toast only | `isSaving` boolean |
| 11 | `features/events/components/event-form.tsx` | RHF + Controller | zodResolver | local `z.object` | hand-rolled `<Label>+<Input>` + manual `aria-describedby` | inline `<p>` | `mutation.isPending` (Save Draft / Publish split) |
| 12 | `features/membership/components/institutional-membership-form.tsx` | RHF | zodResolver | local | hand-rolled + manual `aria-describedby` | inline `<p>` | `formState.isSubmitting` |
| 13 | `features/communications/components/compose-form.tsx` | RHF + Controller | zodResolver (biome-ignore) | local | hand-rolled + manual `aria-describedby` (with title-count) | inline `<p>` | per-submit handler |
| 14 | `features/communications/components/template-form.tsx` | RHF | zodResolver (biome-ignore) | local | hand-rolled | inline `<p>` | per-submit |
| 15 | `features/elections/components/election-form.tsx` | RHF + custom `useState` for positions wizard step | zodResolver (basics step only) | local | hand-rolled | inline + `serverError` state | `createMut.isPending` / `updateMut.isPending` |
| 16 | `features/surveys/components/survey-builder.tsx` | RHF + custom `useState` for questions | zodResolver (basics only) | local | hand-rolled + manual `aria-describedby` | inline `<p>` | mutation flag |
| 17 | `features/events/components/post-event-actions.tsx` | inline form (no useForm) — Zod for derived schema | hand-rolled | local | hand-rolled | inline | mutation |
| 18 | `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx` | RHF + Controller | zodResolver | local | hand-rolled with `aria-describedby` | inline `<p>` | mutation |
| 19 | `routes/_authenticated/org/$orgSlug/officer/roster/index.tsx` | RHF | zodResolver | local `addMemberSchema` | hand-rolled | inline | `formState.isSubmitting` |
| 20 | `routes/_authenticated/my/profile.tsx` | RHF | zodResolver | local `profileEditSchema` (17 fields) | hand-rolled | inline | mutation |
| 21 | `routes/_authenticated/my/credits/log.tsx` | RHF + Controller | zodResolver | local `creditLogSchema` | hand-rolled with `aria-describedby` | inline `<p>` | `formState.isSubmitting` |
| 22 | `routes/org/$slug.tsx` (public apply) | RHF + `useState` cloud | zodResolver + extra `useState` | local | hand-rolled | inline | `submitting` useState |
| — | `routes/_authenticated/my/bookings/host.$personId.$slotId.tsx` | inline (booking submit) | none | n/a | hand-rolled | toast | mutation |
| — | `features/booking/components/booking-event-editor.tsx` | useState (`formData`) | none | n/a | hand-rolled | toast | mutation |
| — | `apps/admin/src/routes/operators/index.tsx` | useState only | none | n/a | hand-rolled `<Input type="email">` | toast | mutation |

Admin app has **zero** `useForm` usage — all forms are useState ad-hoc.

---

## 3. DIALECT MAP — How forms drift from the canonical

The canonical baseline (anchor: `features/person/components/contact-info-form.tsx`) is:
**`<Form>` provider + `<FormField control name render>` + `<FormItem>` + `<FormLabel>` + `<FormControl>` + `<FormDescription>` + `<FormMessage />`** from `@monobase/ui` — all wired via `useForm()`, validated by `zodResolver(schema)` from `@/lib/zod-resolver`, with submit triggered through `form.handleSubmit(handleSubmit)`.

**Dialect A — Custom in-app FormField wrapper (`@/components/patterns/form-field`)**
- Used by: `dues/record-payment-form` (single user).
- Drift: bespoke `FormField` injects `id`, `aria-describedby`, `aria-invalid` via `React.cloneElement`. Functionally equivalent to `@monobase/ui` but a parallel implementation. Pulls `<Label>` from `@monobase/ui` but reinvents the surrounding wiring.
- Risk: drift in styling, no `useFormContext` integration, error type narrowed to `FieldError` (no nested errors).

**Dialect B — Hand-rolled `<Label> + <Input> + inline <p role="alert">`**
- Used by: 11 forms (`proof-upload`, `dues-config`, `event-form`, `compose-form`, `template-form`, `election-form`, `institutional-membership-form`, `providers.tsx`, `roster/index.tsx`, `profile.tsx`, `credits/log.tsx`, `surveys/survey-builder`).
- Drift: each repeats the same 7–12 lines: `<div className="space-y-1.5"><Label htmlFor>...<Input id aria-describedby={errors.x ? 'x-error' : undefined} ...{...register('x')} />{errors.x && <p id="x-error" role="alert" className="text-xs text-[var(--color-error)]">{errors.x.message}</p>}</div>`. Asterisk varies (`*`, `<span className="text-red-500">*</span>`, `<span className="text-[var(--color-error)]">*</span>`).
- Risk: every form pays a11y cost itself; easy to forget `aria-describedby`; `aria-invalid` never set; inconsistent asterisk visuals; no `FormMessage` context awareness for nested fields.

**Dialect C — useState rolling-own (no react-hook-form, no schema)**
- Used by: `training-form`, `admin/org-settings-form`, `dues/refund-form`, `booking/booking-event-editor`, `apps/admin/src/routes/operators/index.tsx`.
- Drift: `useState` per field (or one `useState({...})` blob), validation lives in the `disabled={!form.title || !form.startDate}` button predicate or in a single `const xError = condition ? msg : null`.
- Risk: no submit-time validation aggregation, errors typically not shown except via toast on server reject, no `isDirty`, no `formState` — must hand-roll dirty/saved diff (see `org-settings-form` with `JSON.stringify(draft) !== JSON.stringify(saved)`).

**Mixed-dialect outlier — `address-form` and `personal-info-form`**
- They import the full `@monobase/ui` Form suite (canonical primitive) but **still hand-roll** `<span className="text-red-500">*</span>` inside `<FormLabel>` instead of letting the primitive handle it. So even the "canonical" person-feature forms have visual drift (red-500 vs `var(--color-error)`).

**Schema-source dialect**
- 0 forms import schemas from `@monobase/api-spec` or generated SDK validators.
- 5 forms define a `z.object` literal inline at the top of the component file.
- 4 forms (person/*) import from a colocated `../schemas` file.
- Profile-edit reinvents a 17-field schema in the route file rather than reusing `personSchemas`.
- Two communications forms (`compose`, `template`) attach `// biome-ignore` because `zodResolver` casts diverge.

---

## 4. CANONICAL FORM TEMPLATE

**Reference path:** `apps/memberry/src/features/person/components/contact-info-form.tsx`

Why this one wins:
- Imports the full `@monobase/ui` Form family — no parallel primitive.
- Uses `zodResolver` from `@/lib/zod-resolver` (the centralized v3/v4 shim).
- Schema lives in `../schemas` (colocated, importable).
- `form.handleSubmit(handleSubmit)` with named handler.
- Uses `useEffect` + `form.reset(...)` to handle async-loaded defaults.
- Supports both standalone (`showButtons`) and parent-controlled (`formId`) submit.
- `<FormDescription>` for help text (no inline `<p className="text-muted-foreground">` hack).
- `<FormMessage />` for errors (free `aria-describedby` + `aria-invalid` wiring via the FormControl context).
- Email field uses `disabled` + `bg-muted` (proper read-only styling).

The two lines it should fix to be fully canonical:
- It does not set `inputMode="email"` on the email Input (no form does — cross-cutting).
- The `FormLabel` uses an `Icon + label text` pattern rather than required-asterisk. (Canonical should add required-asterisk via a `required` prop on `FormLabel`, not via children.)

Sibling references for specific shapes:
- **Form with Controller-driven Select/DatePicker**: `features/dues/components/record-payment-form.tsx` (but using the wrong wrapper).
- **Multi-step wizard pattern**: `features/elections/components/election-form.tsx` uses `useState<Step>('basics')` + only validates the basics step via Zod — fragile; future canonical wizard should validate every step.

---

## 5. TOP 10 FORMS TO MIGRATE (ranked by visibility / impact)

Auth flows skipped — handled by `@daveyplate/better-auth-ui` package, not project code.

1. **`routes/_authenticated/my/profile.tsx`** (Dialect B, 17 fields, every member touches it) — biggest hand-rolled form; refactor to `@monobase/ui` Form + share schema with `features/person/components/schemas`. **HIGH.**
2. **`features/dues/components/record-payment-form.tsx`** (Dialect A) — replace `@/components/patterns/form-field` import with `@monobase/ui` `FormField`/`FormItem`/`FormControl`. Officer hot path. **HIGH.**
3. **`features/dues/components/dues-config-form.tsx`** (Dialect B, ~340 lines, every officer configures this) — convert hand-rolled blocks to canonical primitive. **HIGH.**
4. **`features/dues/components/proof-upload-form.tsx`** (Dialect B) — proof-of-payment is a critical member flow. **HIGH.**
5. **`features/training/components/training-form.tsx`** (Dialect C, no validation at all) — adopt RHF + Zod schema; remove the heuristic `disabled={!form.title || !form.startDate}`. **HIGH.**
6. **`features/admin/components/org-settings-form.tsx`** (Dialect C, no validation, manual draft/saved diff) — adopt `formState.isDirty` and Zod. **HIGH.**
7. **`features/events/components/event-form.tsx`** (Dialect B, dual submit Save Draft/Publish) — biggest officer config form besides dues. **MED.**
8. **`features/communications/components/compose-form.tsx`** + **`template-form.tsx`** (Dialect B with biome-ignore) — clean up Zod v4 cast by moving through the shim resolver. **MED.**
9. **`features/elections/components/election-form.tsx`** (Dialect B + custom wizard, partial schema) — refactor wizard to validate every step; also fix `serverError` to flow through `setError('root')`. **MED.**
10. **`features/membership/components/institutional-membership-form.tsx`** (Dialect B) — bulk-org onboarding; canonical primitive will improve error a11y across 6+ fields. **MED.**

Tail: `routes/_authenticated/my/credits/log.tsx`, `routes/_authenticated/org/$orgSlug/officer/settings/providers.tsx`, `routes/_authenticated/org/$orgSlug/officer/roster/index.tsx`, `routes/org/$slug.tsx`, `features/dues/components/refund-form.tsx`, `apps/admin/src/routes/operators/index.tsx`.

---

## 6. CROSS-CUTTING IMPROVEMENTS — single fixes that touch every form

1. **Delete `apps/memberry/src/components/patterns/form-field.tsx` after migrating its one user.** Single primitive: `@monobase/ui` Form. (1 importer.)
2. **Add a `required` prop to `@monobase/ui` `FormLabel`** that renders `<span aria-hidden className="ml-0.5 text-[var(--color-error)]">*</span>` — eliminates the 16+ inline asterisk spans (3 color variants: `text-red-500`, `text-[var(--color-error)]`, `text-destructive`).
3. **Migrate every `useState` form-state to `useForm`.** Specifically: `training-form`, `org-settings-form`, `refund-form`, `booking-event-editor`, `apps/admin/operators`.
4. **Set `inputMode` everywhere `type=` is set.** 0 forms currently use `inputMode`. Map: `type="email"` → also `inputMode="email"` + `autoComplete="email"`; `type="tel"` → `inputMode="tel"`; numeric currency → `inputMode="decimal"`; integer count → `inputMode="numeric"`. ~30 numeric inputs and 5 email inputs to update.
5. **Add `autoComplete` to identity/contact fields.** Currently absent across all 22 forms.
6. **Adopt one disabled-while-submitting + label-swap pattern.** Currently ~6 variants in use (`isPending`, `isSubmitting`, `isUploading || isPending`, `isSaving`, `submitting`, `mutation.isPending`). Use `useMutationFeedback` (already exists at `apps/memberry/src/hooks/use-mutation-feedback.ts`) + `formState.isSubmitting` consistently.
7. **Add a global unsaved-changes guard.** No form uses `useBlocker`, `beforeunload`, or any blocker. The TanStack Router `useBlocker({ shouldBlockFn: () => form.formState.isDirty })` should ship as a `useUnsavedChangesGuard(form)` hook and be opted into by every edit form.
8. **No form auto-saves.** That's a defensible product choice, but should be documented; do not adopt blur-save for the long forms (events, profile, dues-config) without a guard pattern.
9. **Move inline `z.object({ ... })` blobs into colocated `*-schemas.ts` files** matching the `features/person/components/schemas.ts` pattern. Easier to share between create vs edit modes and import server-side too.
10. **Server-error display path.** Today some forms set a `serverError` `useState`, others show toast only, others rely on `mutation.isError` ad-hoc. Canonical: surface server errors via `setError('root.serverError', { message })` and render once at the top of `<form>` via a shared `<FormRootError form={form}/>` component.

---

## 7. A11Y FORM FINDINGS (per-form violations)

Recurring issues:
- **`aria-invalid` never set on hand-rolled fields.** Only the `@/components/patterns/form-field` wrapper and `@monobase/ui` FormControl set it. So Dialect B forms (11 of them) are missing `aria-invalid` on every field.
- **Asterisk required-marker is not announced to screen readers.** Every form uses raw `*` text in the label. Should wrap in `<span aria-hidden="true">*</span>` and add `aria-required="true"` (or rely on the underlying `required` HTML attribute) on the input.
- **`htmlFor`/`id` matched: 83 occurrences.** Generally good — Dialect B forms hand-write matching `id="x"` and `htmlFor="x"`. But because the linkage is manual, expect drift.
- **`role="alert"` on error `<p>`: applied in Dialect B forms.** Good.
- **No focus management on submit failure.** No form sets `shouldFocusError: true` on `useForm` (it's actually the RHF default but several forms override `mode: 'onBlur'` and rely on toast for server errors — server errors don't focus the offending field).
- **Per-field findings:**
  - `refund-form.tsx`: `<Label>Amount ({currency})</Label>` has no `htmlFor`. **P1.**
  - `refund-form.tsx`: `<Textarea>` for "Reason (required)" has no `htmlFor`, no `aria-required`, no error display. **P1.**
  - `training-form.tsx`: all `<Label>` use `<Label>Title <span>*</span></Label>` with no `htmlFor`, no associated input id. **P1 across ~12 fields.**
  - `org-settings-form.tsx`: same — no `htmlFor` matching. **P1.**
  - `event-form.tsx`: numeric fields (capacity, fee, credit) lack `inputMode`; sets `aria-describedby` only when error present (loses help text when error appears). **P2.**
  - `compose-form.tsx`: title field `aria-describedby={errors.title ? 'title-error' : 'title-count'}` — toggling between announcements loses the count hint after error. Should combine ids. **P2.**
  - `institutional-membership-form.tsx`: same toggling pattern — loses help text on error. **P2.**
  - `surveys/survey-builder.tsx`: questions list is built via `useState` outside RHF; no validation on individual questions until submit. **P2.**
  - `address-form.tsx`: country `<Select>` is wrapped in `<FormItem>` but `<FormLabel>` injects `<span className="text-red-500">*</span>` inside label children — color drifts from token. **P3.**
  - `personal-info-form.tsx`: same red-500 drift on 3 fields. **P3.**
  - `apps/admin/src/routes/operators/index.tsx`: bare `<Input type="email">` with no label, no schema, no error display. **P0 — fully unlabelled field in admin app.**
  - Public org apply form (`routes/org/$slug.tsx`): `<Label>Membership Tier <span>*</span></Label>` with no `htmlFor`, manual `setSelectedTierId` outside RHF state. **P1.**

A11y score per dialect:
- **Canonical (`@monobase/ui` Form)**: 8/10 — fixed by FormControl Slot wiring; still loses to required-asterisk announcement and color tokens.
- **Dialect A (patterns/form-field)**: 8/10 — best a11y of any hand-rolled wrapper but stops at the wrapper boundary.
- **Dialect B (hand-rolled)**: 5/10 — `aria-invalid` missing, error-vs-help-text mutually exclusive `aria-describedby`.
- **Dialect C (useState)**: 3/10 — many fields entirely unlabelled, no validation, no error surface.

---

## Appendix — Stack constants (good news)

- `react-hook-form` used in **19 / 22 form files** (project pin via root `package.json`).
- `zodResolver` import via `@/lib/zod-resolver` shim: **19 / 19 RHF forms** route through the shim (no direct `@hookform/resolvers/zod` import outside the shim).
- `sonner` `toast.success` / `toast.error` is the single toast library.
- `formState.isSubmitting` and `mutation.isPending` are interchangeable in the codebase; both gate submit-button disabled state in roughly half of forms each.
- `defaultValues` is provided on every RHF form (13 occurrences).
- `mode: 'onBlur'` is set on the route-level forms; feature components mostly leave RHF default (`onSubmit`). Worth standardizing.
