# UI Microcopy + Tone Audit — apps/memberry

**Date:** 2026-06-02 · **Scope:** `apps/memberry/src/**/*.{ts,tsx}` (444 files) · **Method:** Read-only regex scan + manual classification.

---

## 1. Verdict

**Microcopy score: 5.5 / 10.** Voice is functional but mechanical — terse, mostly Title Case, dominated by `"Failed to X"` errors and one-word success toasts. No consistent voice, no error-recovery guidance, almost no help text, inconsistent date/case/ellipsis conventions. Reads as an admin tool, not a member-facing healthcare app.

---

## 2. Per-Category Findings

### 2.1 Button-label verb inconsistency

167 unique button/link strings. Top buckets:

**SAVE bucket — 40 unique verbs for the same intent.** Highlights: `Save` (5) · `Save Changes` (3) · `Save Draft` (2) · `Save changes` (1) · `Save & Activate` (1) · `Submit Ballot` (1) · `Submit Payment Proof` (1) · `Confirm` (2) · `Confirm Refund` (1) · `Confirm Rejection` (1) · `Confirm Deny` (1) · `Update` (1) · `Apply` (1) · `Approve` (1) · `Generate Invoices` (2) · `Mark Paid` (2) · `Publish` (2) · `Publish Now` (2) · `Publish schedule` (1) · `Continue` (1) · `Next` (1) · plus 7 distinct "Add X" variants.

> Worst offender: dialog confirmations mix `Confirm` / `Confirm Refund` / `Confirm Rejection` / `Confirm Deny` inside `features/dues` and `features/membership`. Pick one pattern.

**CANCEL bucket** — controlled. `Cancel` (20), `Cancel booking request` (3), `Skip for now` (3), `Back` (2), `Dismiss` (1).

**DELETE bucket — 8 verbs:** `Delete` (2) · `Delete Membership` · `Delete this draft?` · `Delete this draft assessment?` · `Remove` · `Archive` (2) · `Revoke Seat` · `Deactivate`. The two button labels ending in `?` are questions on a button — belong in a dialog title instead.

**Case mix:** 48 Title Case unique, 21 sentence case unique. Codebase leans Title Case but `booking-event-editor.tsx:270` (`Save changes`, `Publish schedule`) and `gateway-setup.tsx:199` (`Save & Activate`) deviate. Pick Title Case everywhere.

### 2.2 Form labels — capitalization, colons, asterisks

Total `<FormLabel>` / `<Label>` strings scanned: **164**.

- **Case mix:** 56 multi-word labels are Title Case (`Due Date`, `Payment Method`, `License Number`, `Annual Dues Amount`). Only 4 use sentence case (`Location types`, `Anonymous responses`, `Reason for suspension`, `Type to confirm`). The 4 outliers should flip to Title Case OR (better) the whole codebase should flip to sentence case (modern UX best practice for form labels).
- **Trailing colons:** 0. Good — consistent.
- **Asterisks on required:** 25 labels embed `*` inline as part of the string (e.g. `"First Name *"`). Position is consistent (always ` *` with a single space before), but the convention is mixed: many other required fields are inferred from zod schema with no visible marker, so the same form has labeled-required (`"Email *"`) and unlabeled-required (`"Phone"`) fields side by side. Inconsistent affordance.

### 2.3 Error-message tone

Total `toast.error(...)` literal strings: **81**. Distribution:
- **Generic ("Failed to X"):** 49 (60%)
- **Helpful ("Please …"):** 5
- **Blame-y ("You/Invalid …"):** 2
- **Apologetic ("Sorry/Oops"):** 0
- **Other:** 25 (mostly specific business errors)

**60% of error messages are the un-recoverable pattern `"Failed to <verb>"`** with zero help, zero shape-of-fix, and zero next step. Examples:
`Failed to save` (4 occurrences across `dues-config-form.tsx`, `gateway-setup.tsx`, `category-editor.tsx`, `finances/funds.tsx`) — no clue what failed or what to do.

**Top 10 worst error messages:**

| # | Message | File:line | Why bad |
|---|---|---|---|
| 1 | `Failed to save` | `features/dues/components/dues-config-form.tsx:182` | No context, no fix path. Recurs 4× across modules. |
| 2 | `Action failed` | `features/membership/components/member-detail.tsx:140`, `application-list.tsx:96`, `:107` | "Action" is meaningless to a user. |
| 3 | `Something went wrong` | `routes/_authenticated/my/organizations.tsx:220` | The classic non-message. |
| 4 | `Failed to X` | `utils/error.ts:5` | Literally the string `"X"` — leaked placeholder constant. **Bug.** |
| 5 | `Update failed` / `Reinstatement failed` / `Refund failed` / `Export failed` | various | Same pattern — what to do next? |
| 6 | `Verification failed` | `routes/_authenticated/org/$orgSlug/officer/roster/$memberId.tsx:67` | Verify what? Try how? |
| 7 | `Connection test failed` | `features/dues/components/gateway-setup.tsx:51` | OK but no remediation ("check your secret key"). |
| 8 | `Bulk approve failed` | `features/membership/components/application-list.tsx:146` | Followed by partial-failure detail strings that leak IDs (`${f.id.slice(0,8)}…: ${f.reason}`). |
| 9 | `Person ID is required` | `features/membership/components/seat-management-panel.tsx:84` | "Person ID" is a developer concept; users see "member". |
| 10 | `UUID of the person` (placeholder) + `UUID of the parent association` | `features/membership/components/seat-management-panel.tsx:218`, `institutional-membership-form.tsx:128` | UUID is leaked from API contract into user UI. |

**Mild blame:** `You already have a pending application for this organization.` and `Invalid file type. Please upload JPEG, PNG, or PDF.` — the second one is fine because it offers the recovery. The first should be flipped to system-fault framing.

### 2.4 Success-message tone

Total `toast.success(...)` literal strings: **96**.

- **One-word "Done":** 0 — good, no `toast.success("Saved")` literal alone.
- **Generic short (`<= 3 words`):** 69 (72%) — `Assessment created`, `Survey deleted`, `Document archived`, `Gateway connected`, `Settings saved`. These read fine but never tell the user **what happens next**.
- **Specific + reassuring (>= 4 words):** 27 — e.g. `Refund of ₱X processed.`, `Assessment applied — invoices generated`, `Reminders sent to 12 members`.

**Top 10 success messages, classified:**

| # | Message | File | Verdict |
|---|---|---|---|
| 1 | `Refund of ${formatCents(...)} processed.` | `refund-form.tsx:40` | **Good** — specific. |
| 2 | `Assessment applied — invoices generated` | `special-assessments-list.tsx:119` | **Good** — tells user side-effect. |
| 3 | `Reminders sent to ${count} member(s)` | `officer/payments/index.tsx:28` | **Good** — quantified. |
| 4 | `Survey submitted successfully!` | `survey-flow.tsx:200` | **Bland** — drop "successfully", add "Thanks". |
| 5 | `Thanks for your feedback!` | `nps-modal.tsx:78` | **Good** — warm. |
| 6 | `Settings saved` | `org-settings-form.tsx:105` | **Bland** — no next action. |
| 7 | `Gateway connected` | `gateway-setup.tsx:59` | **Bland** — could say `Gateway connected — payments now enabled.` |
| 8 | `Document deleted` | `document-library.tsx:262` | **Bland**, missing undo affordance. |
| 9 | `#${name} created` | `create-channel-dialog.tsx:35` | **OK** — at least uses interpolated name. |
| 10 | `Vote recorded` | `poll-card.tsx:59` | **Bland** — could add `— view results`. |

### 2.5 Placeholders

Total placeholders: **179** (109 unique). Quality bucket:

- **Noun-only (a11y / unclear):** 11 — `Status`, `Method`, `Category`, `Training`, `Pricing`, `Unlimited`, `Juan`, `Cruz`, `John`, `Doe`. The names (`Juan`, `Cruz`, `John`, `Doe`) used as **first-name/last-name placeholders** are confusing — they look like populated values, not hints. Should be `e.g. Juan` style.
- **Has ellipsis (`...` or `…`):** 45 — good action-oriented examples: `Search by name or license number...`, `Type a message...`, `Search documents by title or tag...`.
- **Has email example:** 2 (`member@example.com`, `contact@org.com`) — both useful.
- **`e.g.` style:** 24 — generally good (`e.g. Manila Hotel, Ballroom or https://zoom.us/j/...`, `e.g. PRC-2024-001`).
- **Placeholder-as-label risk:** 3 instances detected — `training-form.tsx:110, 154, 168` (`Training title`, `Unlimited`, location URL). Even though these forms wrap each field in a `<Label>` elsewhere, the scan flagged Input without label within 8-line window. Confirm a11y manually for these 3 lines.
- **Mixed ellipsis style:** `Type a message...` and `Type a message…` exist (different files: `message-composer.tsx:69` vs `chat-thread.tsx:109`). Pick `…`.
- **Search placeholders use both `...` and `…`:** `Search invoices…` (`officer/finances/invoices/index.tsx:261`) vs `Search documents...` (`document-library.tsx:494`). Inconsistent.
- **Placeholder leaks UUID concept:** `UUID of the person`, `UUID of the parent association`, `Person UUID`, `Person UUID (optional)`, `person-uuid-1\n…` (officer/certificates.tsx:96). UUID is a developer term and should never appear in member-facing UI.

### 2.6 Help text + tooltips (`<FormDescription>`)

Only **4 `<FormDescription>` blocks in the entire memberry app.** This is a massive missed opportunity for trust + guidance:

| Text | File | Quality |
|---|---|---|
| `Email address is managed in your authentication settings` | `contact-info-form.tsx:107` | OK |
| `Your primary contact phone number` | `contact-info-form.tsx:134` | Filler — no shape, no example |
| `Select all languages you speak. The first language will be your primary language.` | `preferences-form.tsx:79` | Good |
| `Current detected timezone:` | `preferences-form.tsx:107` | OK |

Forms that should have FormDescription but don't:
- Dues amount input (`dues-config-form.tsx`) — should explain "What members will be billed annually".
- License number / PRC ID (`personal-info-form.tsx`) — should explain format ("13 characters, format `PRC-NNNNNNN`").
- Credit hours (`event-form.tsx`) — should explain "PRC requires 1 hr = 1 credit".
- Reason for suspension (`member-detail.tsx`) — should explain who sees this (audit log, member, both).

### 2.7 Loading states

Loading-text usage:
- `Saving...` × 15
- `Saving…` × 3 (Unicode ellipsis — inconsistent with the 15 above)
- `Submitting...` × 5
- `Loading...` × 4
- `Loading…` × 1

`<Skeleton>` is used **87 times** — far more often than text-based "Loading…". This is good — visual skeletons are the dominant loading pattern.

**Inconsistencies:**
- `Saving...` (15) vs `Saving…` (3) — pick `…`.
- `Loading...` (4) vs `Loading…` (1) — pick `…`.
- Some buttons use bare `Loading...`, some use `Just a moment…`, some have no text at all (just spinner). Pattern is `{isPending ? "Saving..." : "Save"}` in dues, but `{isPending && <Spinner />}` in others.

### 2.8 Empty-state CTAs

33 empty-state strings with **no detected CTA** within 15 lines. The worst missed-CTA opportunities:

| # | Empty state | File | Missing CTA |
|---|---|---|---|
| 1 | `No memberships yet` | `dashboard/components/member-dashboard.tsx:113` | Should offer "Join an organization" link. |
| 2 | `No credits yet` | `dashboard/components/credit-breakdown.tsx:33` | Should offer "Log a credit" or "Browse trainings". |
| 3 | `No upcoming events` | `routes/_authenticated/dashboard.tsx:317` | Should offer "Browse events". |
| 4 | `No notifications yet` | `notifications/components/notification-inbox.tsx:166` | OK to omit. |
| 5 | `No surveys yet` | `routes/_authenticated/my/surveys/index.tsx:88` | OK to omit. |

Cross-reference with Track G empty-state audit if it exists.

### 2.9 Date / time formatting

**133 date-format calls. 84 are `toLocaleDateString` with 25+ different options blocks** — each handler crafts its own format object. Major variants:

| Count | Format |
|---|---|
| 46 | `toLocaleDateString()` — no args (locale default, varies by browser!) |
| 11 | `'en-PH', { month: 'short', year: 'numeric' }` → "Jun 2026" |
| 9 | `'en-PH', { month: 'short', day: 'numeric', year: 'numeric' }` → "Jun 2, 2026" |
| 6 | `'en-PH', { month: 'short', day: 'numeric' }` → "Jun 2" |
| 6 | `'en-PH', { month: 'long', day: 'numeric', year: 'numeric' }` → "June 2, 2026" |
| 5 | `'en-PH', { year: 'numeric', month: 'short', day: 'numeric' }` (same as #9, different key order) |
| 4 | `'en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }` |
| 3 | `'en-US', DATE_FORMAT` constant — different locale! |
| 3 | date-fns `LLL dd, y` (date-picker only) |
| 2 | `'en-PH', { month: 'short', day: 'numeric', year: '2-digit' }` |
| 1 | `'en-PH', { weekday: 'short', month: 'short', day: ... }` |
| 1 | `'en-PH', { month: 'short', year: '2-digit' }` |

**The codebase has 46 calls with no locale argument**, which renders differently on different browsers/OS settings. Plus 3 `en-US` outliers in a Philippine-targeted app. There is no shared `formatDate(...)` util. There must be one.

### 2.10 Number formatting

- `formatCents` — 91 uses (currency only). Good.
- `Intl.NumberFormat` — 1 use (`routes/pay/$token.tsx`). **Suspiciously low.**
- `toFixed(...)` — 28 uses, mostly tests but several runtime: `refund-form.tsx`, `record-payment-form.tsx`, `proof-upload-form.tsx`, `fund-allocation-editor.tsx`. Hand-rolled rounding — no thousands separator.
- `₱` (Unicode peso): 40 hardcoded uses. `PHP` (ISO code): 81 uses. `P` ASCII prefix: 0. Currency display is uniformly `₱` — good, but it's still hand-typed in 40 places. Should be `formatCents()`'s job.

### 2.11 Pluralization

Plural-risk hot-spots found:

| File:line | Snippet | Issue |
|---|---|---|
| `dues/components/dues-config-form.tsx:329` | `` `${r.daysOffset} days` `` | "1 days" when offset is 1. |
| `dues/components/recent-activity-feed.tsx:33` | `` `${diffDays} days` `` | Same. |
| `officer/payments/index.tsx:28` | `` `${count} reminders` `` | "1 reminders". |
| `alert-banner.tsx:37` | `` ${overdueInvoices.length} unpaid invoice${overdueInvoices.length > 1 ? 's' : ''} `` | Manually pluralized — works but verbose. |
| `application-list.tsx:136` | `` All ${failed.length} approval${failed.length !== 1 ? 's' : ''} `` | Manually pluralized — works. |

Recommendation: introduce `pluralize(count, singular, plural?)` helper or `Intl.PluralRules`.

### 2.12 Domain-language consistency

Term-frequency scan of user-visible strings:

| Term | Count | Note |
|---|---|---|
| Member / members | 396 | **Canonical.** |
| Patient | 4 | All in code (role values), not user-visible. OK. |
| User | 143 | Mostly internal (types, comments, tests, `userEvent`). Avoid "user" in copy. |
| Dues | 291 | **Canonical** for member-payments. |
| Subscription | 3 | All in API paths (`/person-subscriptions/...`) — internal. OK. |
| Membership Fee | 0 | Avoided. Good. |
| Certificate | 80 | **Canonical**. |
| Credential | 32 | Used for provider credentials (`PRC ID`, "Credentials" page). Different concept from Certificate — OK to coexist. |
| CPD | 48 | **Canonical** in member-facing text. |
| CE Credit | 4 | Used in directory cards (`{ts.ceCreditsEarned} CE Credits`) — **conflict** with CPD. |
| Credit / credits | 169 | Generic; used as `CPE Credits`, `CPD credits`, `CE Credits`. Pick **one** umbrella term. |
| Officer | 455 | **Canonical** for org administrators. |
| Admin | 3 | Only in folder paths / type imports. Not in copy. OK. |
| Manager | 0 | Not used. Good. |
| Roster | 49 | OK. |
| Directory | 51 | OK. |
| Sign in | 13 (16 if counting variants) | `Sign In` (1), `Sign in` (2), `Log in` (1) — **inconsistent**. |
| Email | 142 | OK. |
| E-mail | 0 | Avoided. Good. |

**Verdict:** Domain language is *mostly* consistent. Real conflicts:
1. **`CE Credits` vs `CPD credits` vs `CPE Credits`** — three competing names for the same concept. `member-profile.tsx:141` shows `{n} CE Credits`, `training-form.tsx:163` says `CPE Credit Amount`, dashboard says `CPD credits`. Pick **CPD** (mentioned 48× and matches the regulator term).
2. **`Sign in` vs `Sign In` vs `Log in`** — small but visible. Pick `Sign in` (sentence-case verb).
3. **`Officer` vs button labels** — buttons say `Add Member`, `Remove officer` (mixed). Officer is a role; the verb should be `Assign officer` / `Remove officer`.

### 2.13 Trust-building microcopy

Currently the app has almost no trust copy in sensitive flows. One excellent example:
- `payment-history-table.tsx` — `"Your payments are safe — this is a display error."` after a fetch failure. **Keep this pattern.**
- `active-booking-card.tsx` — `"Secure your appointment with payment"` (the only "secure" microcopy in a positive context).

Sensitive flows missing trust copy:
- **Account deletion** (`/my/settings.tsx`, `/settings/account.tsx`) — no "We will keep your data for 30 days in case you change your mind" / "This cannot be undone" beyond the typing-DELETE guard.
- **Roster import** (`/officer/roster/import.tsx`) — no "Members will receive a welcome email if you check this option" reassurance.
- **Payment proof upload** (`proof-upload-form.tsx`) — error `"File too large. Maximum 10MB."` is fine, but no upstream reassurance like "Your proof is reviewed by your officer within 24 hours."
- **Profile / preferences** — no "Only your chapter officers can see this" badge on private fields.
- **Long forms** (event-form, election-form, survey-builder) — no time-to-complete estimate ("Takes 2 minutes").

---

## 3. Top 20 specific copy fixes

Each row: file:line → current → proposed.

| # | File:line | Current | Proposed |
|---|---|---|---|
| 1 | `utils/error.ts:5` | `"Failed to X"` | Replace fallback with `"Something didn't go through. Please try again — we'll log what happened."` (and audit callers — this looks like a leaked placeholder). |
| 2 | `features/dues/components/dues-config-form.tsx:182` | `toast.error("Failed to save")` | `toast.error("Dues settings couldn't save", { description: "Check your internet and try again." })` |
| 3 | `features/membership/components/member-detail.tsx:140` | `toast.error("Action failed")` | `toast.error("That change didn't save")` |
| 4 | `routes/_authenticated/my/organizations.tsx:220` | `toast.error("Something went wrong")` | `toast.error("We couldn't reach the server. Check your connection and try again.")` |
| 5 | `features/membership/components/seat-management-panel.tsx:84` | `toast.error("Person ID is required")` | `toast.error("Select a member to continue")` (and rename internal "Person ID" UI references to "Member"). |
| 6 | `features/membership/components/seat-management-panel.tsx:218` | placeholder `"UUID of the person"` | `placeholder="Member ID — e.g. mem_abc123"` (or hide this field and use a Combobox over members). |
| 7 | `features/membership/components/institutional-membership-form.tsx:128, 142, 177, 191` | `"UUID of the parent association"`, `"Membership tier ID"`, `"Person UUID"`, `"Person UUID (optional)"` | Replace all UUID-leaking placeholders with member-pickers or human-friendly hints (`"Parent organization"`, `"Membership tier"`, `"Primary contact (search by name)"`). |
| 8 | `routes/_authenticated/org/$orgSlug/officer/certificates.tsx:96` | placeholder `"person-uuid-1\nperson-uuid-2\n..."` | `placeholder="Paste member emails or IDs, one per line"` + add an "or pick from list" button. |
| 9 | `features/dues/components/refund-form.tsx:43` | `toast.error("Refund failed")` | `toast.error("Refund didn't process", { description: errMessage ?? "Try again or contact support." })` |
| 10 | `features/dues/components/dues-config-form.tsx:329` | `` `${r.daysOffset} days before due date` `` | Use `pluralize(daysOffset, "day", "days")` so "1 day" is correct. |
| 11 | `features/booking/components/booking-event-editor.tsx:270` | button `Save changes` / `Publish schedule` (sentence case) | `Save Changes` / `Publish Schedule` (match codebase Title Case). |
| 12 | `features/comms/components/message-composer.tsx:69` placeholder `Type a message...` and `features/comms/components/chat-thread.tsx:109` placeholder `Type a message…` | Two ellipsis styles in adjacent files. | Pick `…` everywhere. |
| 13 | `features/dues/components/special-assessments-list.tsx:258` | button `Delete this draft assessment?` (question on the button) | Button label `Delete draft` + dialog title `Delete this draft assessment?`. |
| 14 | `features/directory/components/member-profile.tsx:141` | `{n} CE Credits` | `{n} CPD credits` (match canonical term). |
| 15 | `features/training/components/training-form.tsx:163` | label `CPE Credit Amount` | `CPD Credit Hours` (match canonical term + clarify unit). |
| 16 | `features/training/components/training-list.test.tsx:145` (and source `training-form`) | `CPE Credits Offered` | `CPD Credits Offered`. |
| 17 | `features/admin/components/officer-management.tsx:80` | `toast.error("Failed to remove officer")` | `toast.error("Couldn't remove that officer", { description: "They may have already been removed. Refresh and try again." })` |
| 18 | `features/dues/components/proof-upload-form.tsx:82` | `toast.error("Invalid file type. Please upload JPEG, PNG, or PDF.")` | `toast.error("That file type isn't supported", { description: "Upload a JPEG, PNG, or PDF." })` (drop "invalid", drop the leading "Please"). |
| 19 | `features/notifications/components/notification-inbox.tsx:166` empty state `No notifications yet` | Static text only. | Add subtext: `"We'll ping you when there's something new — like dues reminders or chapter announcements."` |
| 20 | `features/dashboard/components/credit-breakdown.tsx:33` empty state `No credits yet` | Static text only. | Add subtext + CTA button: `"Earn CPD by attending trainings or logging activities."` → primary button `Log a credit`. |

---

## 4. Domain glossary (canonical terms)

Use these terms in user-facing copy. Avoid the alternatives.

| Concept | Use | Avoid |
|---|---|---|
| The person in the system | **Member** | User, Account holder, Patient |
| Membership payment | **Dues** | Subscription, Membership Fee |
| One-off member payment | **Special assessment** | Surcharge, Levy |
| A unit of continuing education | **CPD credit** | CE credit, CPE credit, CME credit |
| Continuing-education activity record | **Training** | Course, Event (Events are time-bounded gatherings; Trainings are credit-bearing activities) |
| The print-ready validation document | **Certificate** | Diploma, Credential |
| A professional qualification (license, accreditation) | **Credential** | Certificate, License (use "License Number" for the value only) |
| Person with elevated rights in an org | **Officer** | Admin, Manager |
| Membership directory | **Directory** | Roster (use "Roster" only for officer-facing member lists) |
| The act of authenticating | **Sign in** / **Sign out** | Log in, Logout |
| Org-wide message | **Announcement** | Broadcast, Memo |
| Person-to-person message | **Message** (in DM context) or **Chat** (in channel context) | DM (in copy; OK in URLs) |
| Currency | **₱X.XX** via `formatCents` | Hardcoded "PHP X", "P X" |
| Date | **Jun 2, 2026** (via shared `formatDate('medium')` helper) | Browser default, "06/02/26" |

---

## 5. Tone style guide (5 lines)

1. **Voice: a calm colleague.** Memberry sounds like a peer in the chapter — informed, helpful, never bureaucratic. Use first-person plural ("we", "we'll") and second-person ("you", "your"); never "the system" or "the user".
2. **Sentence case for everything except buttons.** Buttons stay Title Case (Memberry already leans Title Case); form labels, toasts, page titles, descriptions use sentence case. Drop trailing periods on toasts and buttons; keep them on multi-sentence descriptions.
3. **Errors: name what failed, why if known, and what to try next.** Pattern: `"<Thing> didn't <verb>"` + description `"<reason or remediation>"`. Never say "Action failed", "Something went wrong", or `Failed to X`.
4. **Successes: confirm + tell what changed downstream.** Pattern: `<noun> <past-tense verb>` (e.g. `Dues settings saved`) + an optional side-effect (`— invoices regenerated`). For destructive successes, include an undo affordance ("Document moved to archive · Undo").
5. **No developer terms in copy.** Never expose UUID, ID strings, internal role names, or stack traces. If an ID is truly necessary in UI, label it human-readably ("Member ID", "Invoice number") and never use the word "UUID".

---

## Appendix — methodology + raw artifacts

- File scan: 444 `.ts`/`.tsx` files under `apps/memberry/src` excluding `generated/` and `routeTree.gen.ts`.
- Tooling: pure Node regex extraction (no AST); manual classification of bucketed output.
- Raw JSON exports (not checked in):
  - `/tmp/microcopy-buttons.json` — 167 unique button/link labels + counts.
  - `/tmp/microcopy-toasts.json` — 96 success + 81 error toasts.
  - `/tmp/microcopy-misc.json` — placeholders, form labels, descriptions, zod messages, date formats, plural risks, loading states.
