---
oli-version: "1.0"
based-on:
  - apps/memberry/src/**
  - packages/ui/src/**
  - docs/product/MODULE_MAP.md
  - docs/product/UI_BLUEPRINT.md
last-modified: 2026-06-02T10:58:54Z
last-modified-by: designer-improvements
---

# UI Improvements — Memberry (Designer's Prescriptive Pass)

A senior designer's redesign notes for Memberry. This is not a contract audit. It is a "what would I do if I were redesigning this today" pass, walking the source and proposing concrete changes that would make the product feel coherent, calm, and obviously valuable to a Philippine dental association member, officer, or admin.

---

## 1. THE BIG IDEAS

Five cross-cutting moves that, if adopted, would lift the entire product by a category. Ranked by leverage.

### BI-1. Replace the "Quick Actions strip" with a **single Obligation Card** at the top of every member surface

**Today.** `apps/memberry/src/routes/_authenticated/dashboard.tsx` opens with an `AlertBanner`, a greeting, an onboarding nudge, an "Your Organizations" grid, **three** parallel action widgets (Dues / CPD / Next Event), a `QuickActions` row, then two more columns of news + credits. Six competing entry points on first paint. The same logic repeats on `/org/$slug/home`, `/my/credits`, `/my/profile`. No surface answers "what should I do, today, before I close this tab?"

**The move.** Compute one `nextObligation` per user (overdue dues > grace-period invoice > expiring CPD credits > pending vote > expiring license > unread urgent announcement) and render it as the only hero of every member surface. Everything else descends in size and contrast. Officers get the same primitive scoped to "next governance act."

**Success criteria.** A first-time member on `/dashboard` can verbalize "the one thing I need to do" within 5 seconds. The dashboard renders 1 hero + ≤4 secondary tiles; not 6 peer tiles.

**Effort.** M — `dashboard.tsx`, `alert-banner.tsx`, `action-widget.tsx`, and a new `obligation-card.tsx`. Logic exists; only composition changes.

### BI-2. Collapse the **officer sidebar's 11 sections × 30+ links** into a verb-first command palette + 6 anchor sections

**Today.** `apps/memberry/src/components/layout/officer-sidebar.tsx` lists 8 labeled sections (`MEMBERS`, `FINANCES`, `ACTIVITIES`, `COMMUNICATIONS`, `GOVERNANCE`, `FEEDBACK`, `DOCUMENTS`, `SETTINGS`) totaling ~30 leaf links. `FINANCES` alone has 8 children (Overview, Invoices, Payments, Members, Dues Schedule, Assessments, Funds, Reports). Officers cannot find anything; they scan.

**The move.** Two pieces: (a) trim sidebar to **six anchors** (Dashboard, Members, Finances, Activities, Governance, Settings) — each anchor lands on a hub page with its own sub-nav; (b) add a global `Cmd+K` command palette (the `command.tsx` primitive already exists in `packages/ui/src/components/command.tsx`) seeded with verbs ("Send announcement…", "Mark payment paid…", "Open election…", "Import roster…", "Generate certificate…"). Verb-first navigation eliminates the need for officers to memorize the IA.

**Success criteria.** Officer sidebar fits on a 13" laptop without scroll. 80% of officer tasks are reachable in ≤2 keystrokes via palette.

**Effort.** M — sidebar refactor is trivial; the palette is one new component + a static action registry.

### BI-3. Unify the **empty-state grammar**: every empty state is a primary action, never a sentence

**Today.** Empty-state patterns are inconsistent — `EmptyState` primitive exists at `apps/memberry/src/components/patterns/empty-state.tsx` and is well-shaped, but it is bypassed everywhere. `member-table.tsx` ships a bare "No members found for X." `event-list.tsx` ships `'No drafts. Create a new event to get started.'` as raw text. `training-list.tsx` ships a centered border-rounded text-block with a link inside a sentence. `governance/index.tsx` simply doesn't render anything if there are no elections + no documents. Five empty states, five visual languages.

**The move.** A house rule: every empty state must use `EmptyState` and must include `action`. Replace narrative copy with imperative verbs ("Create your first event", "Invite members"). Add a secondary "Learn what this is" link for first-time users. The component is already accessible; the move is enforcement, not engineering.

**Success criteria.** Grep `border rounded-lg p-12 text-center` returns zero hits outside `EmptyState`. Every empty state has an action button.

**Effort.** S — mechanical refactor across ~15 sites.

### BI-4. Replace the **member-roster mega-table** with a triage-first card list, scope deep filters to a power-user side panel

**Today.** `apps/memberry/src/features/membership/components/member-table.tsx` (359 LOC) renders 9 columns (Checkbox, Name, License#, Category, Status, Dues Status, Training, Dues Expiry, Joined) plus a search input plus 3 filter `<Select>`s plus a 7-tab status strip. Mobile is unusable. Even on desktop, the eye doesn't know whether to start at "Status" (badge) or "Dues Status" (badge) or "Training" (badge). The table is doing four jobs (browse, search, triage, bulk-act).

**The move.** Three-pane layout: (a) **left**: vertical status counter ribbon (Active 412 / Grace 18 / Lapsed 7 / Pending 3) — clicking filters; (b) **center**: member rows as cards with name + avatar + a single colored left-bar encoding overall standing (green / amber / red) + 3 metadata lines (category · license · expiry); (c) **right**: collapsed power-filter panel that opens on `f`. Bulk actions live at the top of the center pane and only appear when ≥1 selected (this part is already there). Same data, different rhythm — the eye sees standing instantly.

**Success criteria.** Officer can identify the 5 most at-risk members in <3 seconds. Mobile roster is usable end-to-end.

**Effort.** M — new `member-card.tsx`; deprecate the dense table to an opt-in "Compact view" toggle for treasurers who need spreadsheet density.

### BI-5. Wire the existing **notifications backbone** into proactive nudges and treat the inbox as the second-most-important surface in the app

**Today.** `apps/memberry/src/components/notification-drawer.tsx` exists with category tabs (all / dues / events / training / comms). The backend has a multi-channel push pipeline (CLAUDE.md OneSignal section). Yet nothing nudges members: there is no "dues due in 7 days" badge, no "your CPD compliance year ends in 60 days, 12 credits short" toast, no "voting closes in 2 hours" inbox row. The notifications drawer is an unused archive.

**The move.** Server-side cron emits 6 nudge types into the inbox + push (already plumbed): (1) 30-day / 7-day / day-of dues, (2) 90-day / 30-day CPD shortfall, (3) 24h voting close, (4) license expiry 90/30/7-day, (5) event RSVP'd starting in 1h, (6) survey closing in 24h. Inbox surface shows them grouped by urgency, not by category. Add an unread count to the global header (the badge slot exists).

**Success criteria.** A member who logs in monthly never misses a renewal deadline. >40% of inbox notifications are time-sensitive (not just receipts).

**Effort.** L on the backend (jobs + schedule), S on the UI (drawer already exists).

---

## 2. PER-MODULE PRESCRIPTIVE RECOMMENDATIONS

### m01-auth-onboarding

**Primary user + task.** A first-time member who got an SMS invite from their chapter treasurer. They want to be inside the app, with their photo and license verified, in under 3 minutes.

**Today.** Routes at `apps/memberry/src/routes/auth/`, `verify/`, `verify-email.tsx`, `onboarding.tsx`, `join.tsx`. Each is a separate page; transitions are full-page reloads. The dashboard's `Link to="/onboarding"` (`dashboard.tsx:213`) is a passive "Complete your profile" pill below the AlertBanner — easy to miss.

**Friction.** The user does not know how far through onboarding they are. The "missing specialization" prompt is the only completion signal. Email verification + license capture + photo upload + organization-selection are not orchestrated as a single wizard.

**Rearrange.** DEMOTE the dashboard's "Complete your profile" pill until onboarding is complete; SURFACE a non-dismissable thin progress strip across the top of every authenticated page ("3 of 5 steps complete · Add license") until done.

**Re-present.** Replace the page-jumping flow with a **single wizard route** (`/onboarding`) that holds 5 steps in one URL with a stepper (the `progress.tsx` primitive supports this). Each step is a card; "Skip for now" is allowed on steps 4+ but never 1–3 (license, contact, photo).

**Subtract.** Remove the "specialization" check as a profile-completion proxy — it's an incomplete proxy that misleads dashboard logic. Remove the redundant `Add Bio` empty state on `/my/profile` — it competes with the onboarding stepper.

**Trust + polish.** Microcopy after email verify currently says nothing; replace with "We verified [maria@…ph]. You're 60% done — let's add your PRC license next." A captive-portal-style "We're checking your email…" with a 5s timeout + manual code fallback.

**30-day improvements (top 3):**
1. **[ROI: high, effort: M]** — Single-URL wizard with stepper. Outcome: onboarding completion ↑ ~20%.
2. **[ROI: high, effort: S]** — Persistent thin top-of-app progress strip until onboarding done. Outcome: returning incomplete users finish.
3. **[ROI: med, effort: S]** — Skip-able order: prove license last, not first, to lower abandon.

---

### m02-member-profile

**Primary user + task.** A member who needs to update their phone number on the way to work, or who is checking how their public directory profile looks.

**Today.** `apps/memberry/src/routes/_authenticated/my/profile.tsx` is 577 LOC, one page, modal-less edit mode that fully replaces the view (`if (editing) return <ProfileEditForm …>`). Six GlassCards stack vertically (Avatar+Standing, Bio, Contact, Address, Memberships, Directory, Licenses, Quick Links) — 8 sections, none collapsible. Total scroll on mobile is ~3.5 screens.

**Friction.** "Edit Profile" nukes the entire screen including the standing meter and trust badges — the user loses their context. The "Directory Profile" panel mixes a preview toggle, a visibility chip, a publish button, and a hidden "make public" link buried as a `Button variant="link"` (`profile.tsx:322`). No inline editing — every change is a full-form roundtrip.

**Rearrange.** SURFACE the Standing Meter + Trust Badges in a sticky-top column on desktop so they remain visible while the user edits a field. DEMOTE the "Quick Links" 4-card grid to the sidebar's account section (it duplicates nav). HIDE the "Address" card behind a "Show address" disclosure — it's needed only by ID-card printing and tax receipts.

**Re-present.** Inline edits per card with a pencil-to-save micro-interaction (no full-page edit mode). Form schema (`profileEditSchema` at `profile.tsx:391`) is small enough to split per card. Directory Profile becomes its own focused subroute `/my/profile/directory` with: visibility radio (Public / Members-only / Hidden), live preview, and one "Save" button.

**Subtract.** Drop "Quick Links" grid. Drop the "Email is managed through your account settings" disabled input — link to settings instead. Drop the "TrustSignals" placeholder values (`credentialCount: 0, ceCreditsEarned: 0`) until they're wired — fake zeros erode trust.

**Trust + polish.** Verified-license shield (`ShieldCheck` already in code, `profile.tsx:351`) needs a tooltip explaining what verification means and who verified it. Bio: 2000-char limit is invisible — show counter at 1800.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Inline-edit per card; kill full-page edit mode.
2. **[ROI: med, effort: S]** — Move Directory Profile to `/my/profile/directory` with live preview.
3. **[ROI: med, effort: S]** — Persistent right-rail StandingMeter on desktop.

---

### m04-org-admin

**Primary user + task.** A newly-elected chapter president opens the officer dashboard at 9 PM and wants to know the health of their chapter without clicking.

**Today.** `apps/memberry/src/features/admin/components/officer-dashboard.tsx` (467 LOC) renders 6 KPI cards + an ActionQueue + 6 ModuleSummaryCards. The KPI strip is visually flat (`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5`) — 6 peers, no hierarchy. The ActionQueue (great primitive) is below the fold on most laptops.

**Friction.** "Active Members 412, Grace 18, Lapsed 7, Collection Rate 73%, Upcoming Events 2, Active Elections 0" — the eye can't decide what matters. The ModuleSummaryCards repeat the same numbers a second time, in a different shape, three sections down.

**Rearrange.** Promote the ActionQueue **above** the KPI strip. The KPI strip is for context after the user has handled the queue. SURFACE per-module health as a colored left-bar on each ModuleSummaryCard (the data exists: `memberHealth: 'healthy'|'attention'|'critical'`).

**Re-present.** Collapse KPI strip from 6 peer tiles to a **single Operating Health bar** + 2 specific callouts. The bar is green / amber / red with a short label ("Healthy · 412 active, 0 lapsed in the last 30 days"). Click the bar to expand into the current 6-tile detail.

**Subtract.** Drop the ModuleSummaryCards row — they restate the queue + KPIs and add nothing. If kept, make them the only place metrics appear (remove KPI strip duplication).

**Trust + polish.** Greeting + "Membership health and action items at a glance" subtitle is templating filler — replace with a context line ("3 actions need you today, none urgent." / "1 critical action: 18 members in grace period."). Make the subtitle work for its space.

**30-day improvements:**
1. **[ROI: high, effort: S]** — Move ActionQueue above KPI strip; rewrite subtitle as a status sentence.
2. **[ROI: high, effort: M]** — Collapse KPI strip into a single Operating Health summary bar with expand-on-click.
3. **[ROI: med, effort: S]** — Remove ModuleSummaryCards row OR remove KPI strip — pick one.

---

### m05-membership

**Primary user + task.** A chapter secretary needs to find Dr. Cruz's record and check why his dues status says "grace period" but he paid last week.

**Today.** `apps/memberry/src/features/membership/components/member-table.tsx` — see BI-4 above. The roster's chief problem is also m05's chief problem.

**Friction.** The table is the only entry point; there's no per-member quick-peek (hover preview) — every check requires a full route push to `/officer/roster/$memberId`. Status badges in 3 separate columns (Status, Dues Status, Training) mean "is this person OK?" requires 3 glances + a mental AND.

**Rearrange.** Move "Joined" date to the detail page (it's never the triage signal). Collapse Status + Dues + Training into one "Standing" column with a single colored chip + a hover tooltip that breaks out the three sub-statuses. Promote "Last contact" / "Last payment" as the third visible metadata line — that's what officers actually look at.

**Re-present.** See BI-4 (card-per-member with left-bar standing). Add a hover popover that shows the membership history mini-timeline (joined → renewed → renewed → grace → ?) — answers the "why is this in grace?" question without navigating.

**Subtract.** Remove "License #" column from the default view — it's a search field, not a scan field. Move it to the compact-view toggle. Drop one of the 3 filter Selects (Dues Status duplicates the Status tabs once you understand the data model).

**Trust + polish.** "No invoice" small grey text (`member-table.tsx:303`) is misleading on a member who is current — replace with "—" or a positive "Paid in full". The 50-per-page pagination cap with no jump-to-page is painful for chapters with 800+ members.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Card-per-member with standing color-bar + hover history popover.
2. **[ROI: high, effort: S]** — Merge Status/Dues/Training into one Standing chip with tooltip breakdown.
3. **[ROI: med, effort: S]** — Power-filter side panel (open with `f`) to reclaim the toolbar.

---

### m06-dues-payments

**Primary user + task.** A member who got a "your dues are due" push notification and wants to upload a GCash screenshot to settle it.

**Today.** `apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx` (430 LOC) renders: DuesStatusCard → ArrearsBreakdown → PaymentScheduleTimeline → Per-invoice ProofUploadForm cards → renewal-info card (if expired) → Payment History. 6 sections on the member side. Officer side at `/officer/finances/*` is **8 sibling routes** (Overview, Invoices, Payments, Members, Dues Schedule, Assessments, Funds, Reports) — see sidebar at `officer-sidebar.tsx:67-77`.

**Friction.** Member side: the user lands here because they want to PAY. The "Pay" CTA is buried 3 sections down. The PaymentScheduleTimeline is gorgeous but unrelated to the act of paying — it's CFO porn for someone who just wants to upload a screenshot. Officer side: 8 sibling routes for "Finances" is unmanageable; the user can never remember which sibling holds what.

**Rearrange.** Member side: SURFACE the active ProofUploadForm as the hero. The Status / Arrears / Timeline collapse into a single accordion below it titled "How we got here". DEMOTE Payment History to a "Receipts" subroute. Officer side: collapse 8 routes into **one Finances page with tabs** (Overview · Invoices · Payments · Funds · Reports); deep-link to tab via query param.

**Re-present.** Per-invoice card today (`dues.tsx:236`) is a `GlassCard` with an invoice number, amount, period, status badge, and an inline form. Better: one focused payment surface with the **amount in the largest type on the page** and a single CTA "Upload proof to pay ₱1,200" — the form lives below the fold. If only one unpaid invoice, skip the per-invoice list entirely. If many, summary card + tabs by invoice.

**Subtract.** The "How Renewal Works" 5-step ordered list (`dues.tsx:314-320`) is helpful for first-time users but a permanent eyesore for returning users — fold behind a "How this works" disclosure that auto-expands on first visit only. Drop `ArrearsBreakdown` aging buckets from the member view (it's a CFO chart, not a member chart); keep on officer side.

**Trust + polish.** "Upload your GCash screenshot or bank transfer receipt to pay." (`dues.tsx:275`) — append "Your treasurer reviews and confirms within 1 business day." Manage expectations. The "All Dues Paid" success card (`dues.tsx:340`) needs a next-action: "Your next renewal opens on [date]. We'll remind you 30 days before."

**30-day improvements:**
1. **[ROI: high, effort: M]** — Restructure member dues page: form-first, single CTA, status collapses below.
2. **[ROI: high, effort: M]** — Collapse 8 officer Finances routes into one tabbed page.
3. **[ROI: med, effort: S]** — Add SLA microcopy ("treasurer confirms within 1 business day") on upload form.

---

### m07-communications

**Primary user + task.** An officer who needs to draft an announcement about a typhoon postponement and send it to all members tonight.

**Today.** `apps/memberry/src/features/communications/components/compose-form.tsx` is a vertical 6-field form (Title, Content, Audience, Channels, Visibility, Schedule) ending in **4 action buttons** (Send Now · Schedule · Save Draft · Cancel). No preview. No template picker. No "send to self for QA" option. On the receiver side, `/org/$orgSlug/home` lists announcements as a stack of `GlassCard` with title + body + date — no read/unread state, no pin, no urgency tier.

**Friction.** The composer has no preview — the sender hits "Send Now" blind. Channels (Push + Email) are toggles with no preview of the push title vs body split (OneSignal title is the announcement title; if it's 80 chars, it truncates and they won't know). The "Schedule" button appears conditionally based on `scheduledAt` (`compose-form.tsx:236`) — confusing state.

**Rearrange.** Split-screen: left = form, right = live preview rendered as "what the member sees" with three tabs (In-app card · Push notification · Email). Conditional "Schedule" button is a footgun — make Schedule a dedicated mode toggle ("Send now" vs "Schedule for…") with one CTA that updates label.

**Re-present.** Audience picker today is two buttons ("All Members" vs "By Category") (`compose-form.tsx:159`). Better: a chip-based audience builder ("Active members · Chapter 1 · with overdue dues · except officers") that reads as a sentence. The `audience-picker.tsx` component exists — surface it.

**Subtract.** Visibility (Internal vs Network) at the bottom (`compose-form.tsx:194`) is rarely-used and risky — move to a single "advanced" disclosure with default "Members only".

**Trust + polish.** Preflight before Send: "This will reach 412 members via push (412 opted-in) and email (387 opted-in). 25 members will receive in-app only. Continue?" The data is queryable. Receiver side needs a "pinned" lane for time-sensitive items.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Add live multi-channel preview pane to composer.
2. **[ROI: high, effort: S]** — Preflight confirmation modal showing reach + channel breakdown.
3. **[ROI: med, effort: M]** — Receiver-side pinned/urgent lane on `/org/$slug/home`.

---

### m08-events

**Primary user + task.** A member browsing to RSVP to the next regional convention; an officer creating a new training event and worrying about CPD credit assignment.

**Today.** Member side: `event-list.tsx` (219 LOC) renders 3 StatCards (Upcoming / Drafts / Showing) + 4 tab buttons + 2 filter dropdowns + card grid. Drafts tab makes no sense for members. The card design is solid. Officer side: same component (with create/cancel/duplicate menus on the card). `EventForm` is a single long form; complex post-event flows live in `post-event-actions.tsx` (~500 LOC).

**Friction.** Member sees "Drafts" tab they can never use. The StatCard row at top is officer-oriented ("Drafts"). On mobile, the 3-column type filter + 4-button status tab + search input wraps awkwardly. Event card "Cancel Event" confirm copy assumes officer mental model.

**Rearrange.** Member view drops the StatCards + Drafts tab; instead shows a date-grouped vertical list ("This week", "This month", "Later") which is the actual mental model for events. Officer view keeps the table-of-events but defaults to a **calendar-style monthly heatmap** above the list — events plotted on a month grid, list below for detail.

**Re-present.** The card is the right primitive — keep. But the upcoming-events surface should default to **timeline grouping** (already exists at `event-timeline.tsx`) for ≤20 events; fall back to card grid only for very long histories.

**Subtract.** Drop the 3-StatCard row from the member view (it's pure decoration). Drop the "Showing N" stat (it's the list length below; redundant). On the officer view, the type filter has 9 options — most are rarely used; group "less common" types behind a `…more` disclosure.

**Trust + polish.** RSVP'd state on a card has no visual lock-in — show a subtle ribbon "You're attending" with calendar-add link. Event detail needs a "Who's going" count when public — social proof drives attendance.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Date-grouped timeline as member default; calendar heatmap for officers.
2. **[ROI: high, effort: S]** — "You're attending" ribbon + add-to-calendar inline on card.
3. **[ROI: med, effort: S]** — Hide officer-only tabs (Drafts, Cancelled) from member view.

---

### m09-training

**Primary user + task.** A member 6 weeks from the end of their CPD cycle, short 12 credits, looking for training that fits their schedule.

**Today.** `training-list.tsx` (229 LOC): 4 StatCards (Published / Drafts / Enrollments / Credits Offered) + 3 tabs + search + type-select + 3-col card grid. **All four StatCards are officer metrics** — the member view is the same component.

**Friction.** Member sees "Drafts" tab they can't use, "Enrollments" stat they don't care about, "CPE Credits Offered" stat that is the wrong question (they want credits earnable by THEM in the time they have). The card doesn't say "this fits your remaining CPD shortfall".

**Rearrange.** Member view: SURFACE the user's CPD shortfall as a sticky header ("You need 12 more credits by Dec 31") and filter the default list to "trainings that close this gap". Sort by closest-to-credit-fit, then by date.

**Re-present.** Cards stay. But add a "credit fit" microbadge on each ("+4 credits · fits your shortfall" / "+10 credits · over your shortfall"). The data exists (training.creditAmount; user shortfall computed on dashboard).

**Subtract.** Officer StatCards from the member view. The "All Types" filter is fine but the 5 type options should be folded into a "Format" filter (Online / In-person / Workshop / Convention) — that's what members care about.

**Trust + polish.** Empty state at `training-list.tsx:192` is a sentence-with-inline-link — break to use the `EmptyState` primitive (see BI-3). For a member at 0% compliance, the empty state should be more urgent ("No upcoming trainings — talk to your chapter coordinator").

**30-day improvements:**
1. **[ROI: high, effort: M]** — Member-side: sticky shortfall header + credit-fit microbadge on cards.
2. **[ROI: med, effort: S]** — Replace officer StatCards on member view with personalized "your remaining gap" callout.
3. **[ROI: low, effort: S]** — Use `EmptyState` primitive uniformly.

---

### m10-credit-tracking

**Primary user + task.** A member checking whether they're going to comply with this year's CPD requirement before their license cycle closes.

**Today.** Two separate routes: `/my/credits` (multi-org rollup) and `/org/$slug/my-cpd` (per-org). They are structurally similar but live as two pages with different layouts. `/my/credits` has 4 StatCards (Earned / Required / Carryover / Remaining) + a table. `/my/cpd` per-org has 3 cards (Total Credits / Compliance % / Category Breakdown) + a history list. Carryover is hard-coded to 0 (`/my/credits/index.tsx:84`).

**Friction.** Two routes for the same question, three visual languages (4-card row vs 3-card row vs dashboard widget on `/dashboard`). The compliance number tells the user "73%" without translating to time ("You have 4 months to earn 12 more"). Self-Directed Learning cap exceeded shows as a warning bar (`my-cpd.tsx:99`) but doesn't suggest the user pivot to a non-SDL training.

**Rearrange.** Merge the two routes into `/my/credits` with an "All organizations" segmented control at top (default) and per-org filter chips. SURFACE compliance as a single hero number with a horizon ("23 of 60 credits · 4 months left · 9 credits/month needed"). The category breakdown becomes a stacked bar, not a list of numbers.

**Re-present.** Replace the 4 stat cards with one "trajectory" widget: a horizontal progress bar with two markers — "where you are" and "where you should be by today" — color shifts from green (on track) to amber (behind) to red (will not make it). Below: 3 specific trainings that would close the gap (cross-link to m09).

**Subtract.** Remove the "Carryover: 0" stat — hard-coded zero is noise. Remove the redundant `requiredCredits` display from the per-org page once unified.

**Trust + polish.** Manual credit log (`/my/credits/log`) — make it a one-line entry, not a form. Microcopy should say "We'll verify with your training provider; expect 3–5 business days." History rows missing certificate links — add "Download certificate" inline.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Unify `/my/credits` + `/org/$slug/my-cpd` into one route with org filter.
2. **[ROI: high, effort: S]** — Replace stat cards with "trajectory" widget (where you are vs where you should be).
3. **[ROI: med, effort: S]** — Inline "Download certificate" on history rows.

---

### m11-documents-credentials

**Primary user + task.** An officer publishing meeting minutes; a member hunting for the chapter bylaws PDF.

**Today.** `document-library.tsx` (581 LOC) renders status colors, access-level icons, category tabs, search, status filter, and DocumentCard tiles. The card stack is well-structured. But the access-level taxonomy (Public, Members Only, Unit Only, Officers Only, Privileged) is exposed raw to members who have no idea what "Unit Only" means.

**Friction.** Five access levels feel legalistic. Categories (Bylaws / Minutes / Policies / Forms / Election Results / Financial Reports / Other) are alphabetical-by-import; the member's mental model is "what's the latest big thing?" rather than "I want a policy". The library has no "Recently published" or "Pinned by officers" lane.

**Rearrange.** Member view leads with a "Recently published" carousel + a "Pinned by officers" lane; categories collapse into a secondary nav. Officer view stays close to today.

**Re-present.** Document tiles are good. Add "first 80 chars of the document title or an extracted abstract" so people don't have to open a PDF to know if it's the right one. Add a "summary chip" for bylaws ("Last amended 2024-03-15 · v2.1").

**Subtract.** Reduce the 5 access levels to 3 in the UI (Public, Members, Officers); the "Unit Only" and "Privileged" cases collapse into "Officers" with an internal-only sub-flag. The doc category tab strip has 8 chips — half are rare; group "Forms / Election Results / Financial Reports / Other" behind "More".

**Trust + polish.** Show the publisher avatar + date on every tile — provenance matters for governance docs. Add "Was this useful?" thumbs-up — guides officers about what's working.

**30-day improvements:**
1. **[ROI: high, effort: M]** — Member view: "Recently published" + "Pinned" lanes ahead of grid.
2. **[ROI: med, effort: S]** — Reduce access-level vocabulary to 3 user-facing labels.
3. **[ROI: med, effort: S]** — Tile shows publisher + date + abstract.

---

### m12-elections-governance

**Primary user + task.** A member who got an "election opens today" push, wants to read the candidates and vote in <2 minutes.

**Today.** `apps/memberry/src/routes/_authenticated/org/$orgSlug/governance/index.tsx` is a 2-card stat row (Active Elections / Documents) + Active Elections list + Documents list. Voting flow lives at `/elections/$id` via `voting-ballot.tsx` + `voting-ballot-confirm.test.tsx`. Officer side: `election-list.tsx` (146 LOC) — fine card list.

**Friction.** The /governance landing is officer-shaped: counts of active elections and documents are not what a member needs. A member wants a "VOTE NOW" CTA when there's an open ballot. The election card on the list doesn't surface "you haven't voted yet" — the member must click in to find out.

**Rearrange.** Governance landing for members: if there is an open ballot, the entire page is replaced with a hero "Cast your ballot — closes in 23h" CTA. If not, show the active-elections preview as small cards and surface the most-recent governance documents as the meat of the page. Officer view stays close to today.

**Re-present.** Voted-state indicator on each member-side election card ("You voted Mar 12" / "Cast your vote" pill). For bylaw votes, surface the actual amendment text in a 2-line preview — voters often don't open the PDF before voting.

**Subtract.** The 2-stat row at top of governance index is decoration; drop it. Drop the "ChevronRight" affordance on cards — the whole card is a link.

**Trust + polish.** Ballot must show "Your vote is anonymous · You can change your vote until [close time]" — voter trust depends on this microcopy being prominent, not buried. Post-vote confirmation needs a copy receipt with timestamp and ballot ID.

**30-day improvements:**
1. **[ROI: high, effort: S]** — Member governance index: open-ballot hero replaces stat row.
2. **[ROI: high, effort: S]** — Voted/not-voted pill on every election card.
3. **[ROI: med, effort: S]** — Anonymity + change-window microcopy on ballot.

---

### m14-national-dashboard

**Primary user + task.** A national federation officer comparing chapter performance month-over-month.

**Today.** Routes under `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reports/` (credits, financial). No first-class national surface yet visible; `association:operations` handlers exist but their UI is thin.

**Friction.** No cross-chapter rollup surface. Officers can't see "which chapters need attention" at a glance. Reports are static credit + financial pages.

**Rearrange / Re-present.** Build a `/national/dashboard` (or `/org/$slug/federation` if scoped) that's a chapter leaderboard: each chapter is a row with mini-sparklines (collection rate, member growth, CPD compliance) + a color status (healthy/attention/critical). Click drills into per-chapter dashboard.

**Subtract.** N/A (surface mostly absent).

**Trust + polish.** Comparison view ("vs last quarter", "vs national avg"). Time-zoom selector. Export to CSV/PDF for board meetings.

**30-day improvements:**
1. **[ROI: high, effort: L]** — Build the chapter-leaderboard view as the national hero surface.
2. **[ROI: med, effort: M]** — Per-chapter sparkline cards with click-through to chapter dashboard.
3. **[ROI: med, effort: S]** — Export-to-PDF for board packets.

---

### m19-committee-management

**Primary user + task.** A committee chair coordinating a sub-group within their chapter (e.g., the Continuing Education Committee).

**Today.** Routes not yet visible under `apps/memberry/src/routes/`. Backend support partial; committee surfaces likely planned.

**Rearrange / Re-present.** Treat committees as **named scoped channels** that bundle: a member subset (the committee), a private message channel (reuse `comms`), a documents shelf, an events lane. A committee page is a horizontal scroll of these 4 affordances + a chair-only Settings.

**Subtract.** Resist temptation to make committees a separate top-level nav — they belong inside the org as a "Committees" entry under MEMBERS.

**Trust + polish.** Roster page for a committee must say "appointed by [President] on [date]" — governance lineage matters in healthcare associations.

**30-day improvements:**
1. **[ROI: high, effort: L]** — Build committee container UI as 4-affordance hub.
2. **[ROI: med, effort: M]** — Committee chair dashboard (mirror officer dashboard but scoped).
3. **[ROI: low, effort: S]** — Provenance microcopy on roster.

---

### m20-booking

**Primary user + task.** A member booking a 15-min slot with a chapter officer (e.g., a treasurer for a fee question) or a host (e.g., a CE consultant).

**Today.** `apps/memberry/src/features/booking/components/booking-widget.tsx` + `booking-list.tsx` + `host-directory.tsx`. Routes at `/my/bookings`, `/my/bookings/host/$personId`, `/my/bookings/host/$personId/$slotId`.

**Friction.** Booking is buried — the member must navigate to "My Bookings" to discover the directory. A member usually wants to book from context ("I have a fee question" → click "Talk to the treasurer" on the dues page).

**Rearrange.** Every officer-roster row, every "talk to treasurer" CTA, every "need help?" prompt should offer "Book a slot" inline. The booking surface itself stays compact.

**Re-present.** Calendly-style two-column (date picker · time slots) — likely already approximately this; verify on mobile that the slot grid is thumb-friendly.

**Subtract.** Drop the standalone Host Directory if booking is always contextual; keep it only as an admin browse.

**Trust + polish.** Show "Hosted by [name] · Avg response 2h" to set expectations. After-booking screen needs an "Add to calendar" + "Reschedule" + "Cancel" trio, not just confirmation.

**30-day improvements:**
1. **[ROI: high, effort: S]** — Contextual "Book a slot" CTAs on dues, governance, and roster surfaces.
2. **[ROI: med, effort: S]** — Add-to-calendar + reschedule/cancel on confirmation.
3. **[ROI: low, effort: S]** — Host response-time microcopy.

---

### m21-billing

**Primary user + task.** A treasurer configuring Stripe Connect to accept online payments; a member checking a one-off paid invoice.

**Today.** `apps/memberry/src/features/billing/components/merchant-account-setup.tsx` is the only feature file — narrow surface. Most of dues is via proof-upload (manual confirm).

**Friction.** Gateway setup is presented as a singular setup card. There's no health check, no "test charge" flow, no visible status of "are payments actively flowing through this gateway?"

**Rearrange.** Promote a "Payments Health" panel in officer Finances overview — shows gateway-connected status, last 7-day volume, failed-payment count. Setup card collapses once configured.

**Re-present.** Setup as a 3-step checklist (Connect Stripe → Verify test charge → Enable for members) rather than a single form. Each step is its own card with explicit "what this means" microcopy.

**Subtract.** N/A; surface is minimal.

**Trust + polish.** Show the connected account email + "Last verified [date]" once configured — operators forget which Stripe account is wired.

**30-day improvements:**
1. **[ROI: med, effort: M]** — 3-step gateway setup checklist with test-charge step.
2. **[ROI: med, effort: S]** — "Payments Health" panel on Finances overview.
3. **[ROI: low, effort: S]** — Connected-account display when configured.

---

### m03-platform-admin (apps/admin, brief)

**Today.** Platform-ops surface for the multi-org admin. Distinct app (port 3003) — likely tenant management, license oversight, billing aggregation.

**Recommendation in 3 lines.**
1. Tenant list as a card-per-tenant view with health color (active members · MRR · last activity) sorted by attention-needed.
2. Per-tenant drill-in mirrors the officer dashboard but with platform-level KPIs (revenue, churn, support volume).
3. Global command palette ("Suspend tenant…", "Reset tenant…", "Impersonate officer…") — same primitive proposed for officers (BI-2).

---

## 3. PRESENTATION PRIMITIVE AUDIT

App-wide: are we using the right primitive for each data shape? **No, frequently.**

| Data shape | Current primitive | Better primitive | Where used today | Why change |
|---|---|---|---|---|
| Roster of members with multi-axis status | 9-col `<Table>` with 3 filter Selects + 7 tabs | Card-per-member with left-bar standing + power-filter side panel | `features/membership/components/member-table.tsx` | Density without scanning value; mobile unusable; eye can't triage 3 status badges |
| Single member's payments list | Inline mini-list inside `<GlassCard>` | Same — keep | `routes/.../dues.tsx:392` | Right shape, low count |
| Active dues invoices to act on | List of per-invoice cards with embedded forms | When count=1: one focused payment card. When count>1: collapsible accordion with a single hero amount | `routes/.../dues.tsx:230` | Per-card forms compete; user wants the amount, not the layout |
| Officer dashboard KPIs | 6 peer KPI cards in a strip + 6 ModuleSummaryCards below | Single Operating-Health bar + expandable detail + ActionQueue first | `features/admin/components/officer-dashboard.tsx` | 12 peer affordances on first paint = no hierarchy |
| Events list (member) | Card grid + StatCards + tabs | Date-grouped timeline ("This week / This month / Later") | `features/events/components/event-list.tsx` | Members think in time, not in status |
| Events list (officer) | Card grid | Monthly calendar heatmap + list-below | same | Officers schedule; need temporal layout |
| Announcements (receiver) | Stack of equal-weight `GlassCard` | Pinned/urgent lane + standard feed | `routes/.../home.tsx` | No way to triage; everything is medium-importance |
| Compose announcement | Single-column form, 4 action buttons | Split-pane form + live multi-channel preview, mode toggle (now/schedule) | `features/communications/components/compose-form.tsx` | Senders ship blind today |
| CPD credit history | `<Table>` rows + 4 stat cards | Trajectory bar (where you are vs where you should be) + table below | `routes/.../my/credits/index.tsx` | Compliance is about time-to-deadline, not point-in-time totals |
| Documents library | Card grid + tabs + filters | "Recent" + "Pinned" lanes leading; grid below | `features/documents/components/document-library.tsx` | Members hunt for "the new thing," not "Bylaws" |
| Empty states | Inconsistent — sentences, bordered boxes, mixed icons | `EmptyState` primitive everywhere, always with action button | many — see BI-3 | Already a designed primitive that's ignored |
| Profile (view) | 8 stacked `GlassCard` + page-replacement edit mode | Inline-edit per card + sticky StandingMeter | `routes/.../my/profile.tsx` | Full-page edit nukes context; mobile scroll-fatigue |
| Officer sidebar | 8 sections, ~30 leaf links | 6 anchor sections + Cmd+K palette | `components/layout/officer-sidebar.tsx` | Officers scan, not navigate |
| Governance landing (member) | 2-stat row + lists | Hero-CTA when ballot open, else mini-card overview | `routes/.../governance/index.tsx` | Members come here to vote, not browse stats |
| Officer Finances | 8 sibling routes | One Finances page with tabs | `routes/.../officer/finances/*` | 8 siblings impossible to remember |

---

## 4. CROSS-MODULE NARRATIVE COHERENCE

Does Memberry feel like one app, or like a federation of feature teams' islands?

**Persona: Member, mobile**

Journey: dashboard → org home → dues → upload receipt.

1. `/dashboard` shows three peer ActionWidgets (Dues / CPD / Next Event). The Dues widget says "₱1,200 · Overdue" with a "Pay now" link. Good.
2. Click "Pay now" → lands on `/org/$slug/dues`. The page now repeats the same status info in a `DuesStatusCard`, then shows ArrearsBreakdown, then PaymentScheduleTimeline, **then** the actual upload form. The CTA from step 1 has decayed.
3. Submit proof → toast success. No microcopy explaining what happens next.

**Seam 1.** The dashboard's "Pay now" implies the user is one step from paying. The destination doesn't honor that promise — it forces them to scroll past three CFO-style data displays. **Recommendation:** when the user arrives from the "Pay now" deep link, scroll directly to the form (the route already has `id="pay-dues-section"` but uses smooth-scroll on a button click, not on load — wire it to URL hash).

**Seam 2.** After submission, the user gets a toast but no clear "we'll notify you when [Treasurer] confirms; you'll get a push within 1 business day." **Recommendation:** swap success toast for a focused post-submit card that becomes the new page state.

**Persona: Officer, desktop**

Journey: officer dashboard → spot grace-period members → email them.

1. `/officer/dashboard` shows ActionQueue with "18 members in grace period". Good action item.
2. Click → lands on `/officer/roster?status=grace`. Member table filters to 18 rows. Good.
3. Need to email all 18 → no bulk email action exists. There's a Communications composer, but it's a separate context with its own audience picker that doesn't accept "the 18 members from this filter".

**Seam 3.** Triage and act-on are two different surfaces with no cross-pollination. **Recommendation:** roster bulk-action bar gets "Compose announcement to selected" that prefills the audience picker. The schema for audience already supports member-id arrays.

**Persona: Officer, evening, mobile**

Journey: get a push notification "10 pending applications" → tap → review one application.

1. Tap push → lands on `/officer/applications`. The list is dense. Each application row links to a detail page.
2. Detail page is a separate route with its own back nav — the user loses the queue.

**Seam 4.** "Review queue" patterns (applications, payment-proofs, nominations) should never lose context. **Recommendation:** review surfaces use a master-detail split (list on left, detail on right) with "Approve · Reject · Next" buttons — the next application loads automatically. Modeled after Gmail's review flow.

**Seam 5: identity drift.** Member surface uses `MemberSidebar` (white). Officer surface uses `OfficerSidebar` (deep purple `bg-[var(--color-primary)]`). Same human, two visual cities. **Recommendation:** the role-switch happens at the `(my)` ↔ `(org)/(officer)` boundary, not via a hard chromatic change. A persistent role pill in the header ("Acting as: Officer at Chapter X") would do the work without requiring two app skins.

---

## 5. UNDERUTILIZED OPPORTUNITIES

What's already in the codebase, but underused?

1. **Notification backbone** — `notification-drawer.tsx` + OneSignal pipeline + per-category filtering exists. Yet there are zero proactive nudges (no "dues due in 7 days", no "CPD shortfall", no "voting closes in 24h"). The push side is wired end-to-end; the missing piece is a scheduled-job cron that emits these into the queue. **Action:** ship 6 nudge types described in BI-5.

2. **Command palette primitive** — `packages/ui/src/components/command.tsx` exists (shadcn cmdk) but is not bound to a global Cmd+K. **Action:** wire it as the verb-first officer entry (BI-2).

3. **Empty-state primitive** — `EmptyState` (`apps/memberry/src/components/patterns/empty-state.tsx`) is well-designed and used in only a handful of places. The majority of empty surfaces use ad-hoc bordered text blocks. **Action:** mechanical refactor (BI-3).

4. **`AudiencePicker` component** — `apps/memberry/src/features/communications/components/audience-picker.tsx` exists but the actual composer (`compose-form.tsx:159`) uses two static buttons ("All Members" / "By Category"). **Action:** swap in the richer picker; surface as a sentence-chip builder.

5. **Certificate verification** — `apps/memberry/src/features/certificates/components/certificate-preview.tsx` includes verify URL/QR logic but is buried in officer flow. **Action:** add a "/v/$certId" public verification route + show the QR on the member-side certificate detail, so members can show their phone to anyone (employer, licensing board) for instant verification.

6. **Standing Meter + Trust Badges** — `features/profile/components/standing-meter.tsx` + `trust-badges.tsx` exist as well-designed primitives, used on `/my/profile`. They should appear on every member-self surface (in the header band) as a persistent identity strip — they answer "am I in good standing?" at a glance.

7. **`PaymentScheduleTimeline`** — Beautiful component buried inside member dues page. Could be the basis of a "membership history" panel on profile detail and on roster member detail.

8. **`DataTable` pattern** (`components/patterns/data-table.tsx`) — generic primitive that nobody uses. Either delete or adopt for the half-dozen rolled-your-own tables (member-table, payment-history-table, completion-table).

---

## 6. TOP 20 DECISIONS

A flat ranked list — the 20 most impactful UX changes the team could make, biggest leverage first.

| # | Module | Action verb | Expected impact | Effort |
|---|---|---|---|---|
| 1 | dashboard / cross-cutting | **Replace** 6-tile ActionWidget strip with single Obligation Card hero | Member completion of urgent tasks ↑ ~30%; first-paint clarity | M |
| 2 | m07-communications + m10 + m06 + m12 | **Wire** 6 scheduled nudge types into existing notification backbone | Renewal misses ↓; CPD shortfalls caught early; voting participation ↑ | L (backend), S (UI) |
| 3 | m04-org-admin | **Move** ActionQueue above KPI strip; rewrite subtitle as status sentence | Officers triage on landing; KPI strip stops competing | S |
| 4 | m05-membership | **Replace** dense member table with card-per-member + standing left-bar | Triage speed ↑; mobile usable | M |
| 5 | m06-dues-payments (officer) | **Collapse** 8 Finances sibling routes into one tabbed page | Officer navigation cognitive load ↓ | M |
| 6 | m07-communications | **Add** live multi-channel preview pane to composer | "Sent the wrong thing" incidents ↓; sender confidence ↑ | M |
| 7 | cross-cutting | **Adopt** `EmptyState` primitive uniformly with action verbs | Visual consistency; activation in zero-state contexts | S |
| 8 | m02-member-profile | **Replace** full-page edit mode with inline-edit per card | Edit friction ↓; context preserved | M |
| 9 | global officer | **Add** Cmd+K command palette (verb-first registry) | Officer task speed ↑ ~2× for power users | M |
| 10 | m10-credit-tracking | **Replace** 4 stat cards with trajectory widget + cross-link to fitting trainings | Compliance anxiety addressed; m09 conversion ↑ | M |
| 11 | m10-credit-tracking | **Unify** `/my/credits` + `/org/$slug/my-cpd` into one route | Eliminate duplicate mental model | M |
| 12 | m08-events (member) | **Default** event list to date-grouped timeline | Members find next event in 1 glance | M |
| 13 | m06-dues-payments (member) | **Restructure** dues page as form-first hero with status below | Pay-task completion in 1 scroll | M |
| 14 | global officer | **Trim** sidebar to 6 anchors; drop hub pages with sub-nav | First-time officer can find anything | M |
| 15 | m05-membership | **Merge** Status / Dues / Training badges into one Standing chip with tooltip | Eye-time per row ↓; triage speed ↑ | S |
| 16 | m12-elections-governance | **Replace** governance index with open-ballot hero when active | Voting participation ↑; reduce missed votes | S |
| 17 | m06-dues-payments | **Add** SLA microcopy ("treasurer confirms within 1 business day") on upload | Member trust ↑; support pings ↓ | S |
| 18 | cross-cutting (officer↔communications) | **Add** "Compose to selected" bulk action on roster | Cross-module workflow seam closed | S |
| 19 | m11-documents-credentials | **Add** "Recently published" + "Pinned" lanes ahead of grid | Members find new docs without filtering | M |
| 20 | global identity | **Replace** dual-skin role switch with persistent role pill in header | One coherent app, not two | S |

---

## Closing Note

The Memberry codebase is well-tooled: shadcn-derived primitives, good motion utilities (`GlassCard`, `StaggerGrid`, `CountUp`), tasteful color tokens, considered status colors. The design system is not the problem.

The problem is that surfaces are **composed by feature instead of by user obligation**. Most pages stack everything they could possibly show, with equal weight, in the order the team built it. The work ahead is largely subtractive: hide what isn't this moment's job, make the one thing the user came for impossible to miss, and let everything else recede.

The single highest-leverage move in this report is **BI-1 (Obligation Card)**. Ship that, and the cascade effects (members read the right thing first, officers stop hunting, dashboards stop competing) carry half the other recommendations forward.
