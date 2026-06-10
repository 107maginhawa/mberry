# Memberry Governance Module UI/UX Research and Upgrade Audit

## 1. Executive Summary

Wave 5 Governance (Elections + Documents) has **solid backend coverage** (358 tests, full state machine, BR-33/BR-34 enforcement) but the **frontend UX has critical gaps** that prevent it from feeling like a cohesive governance experience.

**Top 5 findings:**

1. **Elections are invisible to members** — no sidebar link, no dashboard widget, no notification. Members must navigate directly via URL or stumble onto elections from org home.
2. **Documents library is disconnected from officer nav** — the officer sidebar's DOCUMENTS section only shows "Credit Reports", not the full document library. The `/officer/documents` route exists but has no nav entry.
3. **No publish workflow for documents** — officers can upload documents (as draft) and archive them, but there's no "Publish" action to make drafts visible to members. Status promotion is impossible from the UI.
4. **Nominee display shows UUIDs instead of names** — both member and officer views render `personId` as monospace UUID strings, not human-readable names.
5. **No vote confirmation dialog** — members can cast ballots without a final confirmation step. The spec called for one but it was never implemented.

**6th critical finding (from design review):**

6. **Partial vote data integrity bug** — the ballot casts votes position-by-position in a sequential `for...of` loop. If network fails mid-loop, some positions are voted and others are not. The user sees "Failed to cast vote" but cannot tell which positions were recorded. This is a vote integrity issue.

**Highest-impact upgrades:**
- Add Elections + Documents links to member sidebar (direct routes, no `/governance` until dashboard exists)
- Fix nominee name display (API must join person names into election response)
- Add document publish workflow (draft→published button)
- Add vote confirmation dialog before ballot submission
- Fix partial vote bug (batch API endpoint or per-position retry tracking)
- Wire election lifecycle notifications (infra exists, just needs connection)

---

## 2. Selected Inspiration Apps

| App | Role | Why Selected | Patterns to Extract |
|---|---|---|---|
| **ElectionBuddy** | Election workflow | Market leader in association voting. 3-step setup, voter key auth, hybrid ballots, automated reminders, instant results with observer mode | 3-step election wizard, candidate bio/photo display, turnout monitoring dashboard, voting receipt confirmation, results auto-publish |
| **Simply Voting** | Ballot design | Membership org focus, eligibility-gated ballots, candidate profile pages, weighted voting support | Eligibility pre-check screen, ballot access gate with clear messaging, candidate comparison cards |
| **Boardable** | Board governance | Purpose-built for nonprofits. Agenda→minutes→resolutions pipeline. AI minutes, secure voting, document routing | Meeting-to-document pipeline, motion tracking with vote tallies, resolution status workflow, document approval routing |
| **OnBoard (Passageways)** | Board portal | #1 rated board management. Secure document sharing, granular permissions, annotation, version comparison | Document viewer with in-app preview, permission matrix UI, version diff/comparison, audit trail timeline |
| **Notion** | Document library | Best-in-class document organization. Database views, tags, filters, status columns, gallery/table/board views | Category-based views, tag filtering, status kanban, quick search with facets, inline preview |
| **DocuSign** | Audit trails | Industry standard for document lifecycle. Status tracking, completion certificates, immutable audit log | Document status timeline, completion confirmation, audit log with IP/timestamp, "envelope" status metaphor |
| **Google Drive** | File management | Familiar mental model for file browsing. Folder tree, recent files, shared with me, starred, trash | Familiar file browsing patterns, recent/starred shortcuts, access level indicators (link icon for shared) |

---

## 3. Pattern Catalog

| Pattern | Source | Problem Solved | Memberry Application | Priority |
|---|---|---|---|---|
| **3-Step Election Wizard** | ElectionBuddy | Complex election setup overwhelms officers | Current 3-step form is good — add step validation indicators and preview before save | P2 |
| **Candidate Profile Cards** | ElectionBuddy, Simply Voting | Voters can't evaluate nominees (currently show UUID only) | Replace UUID display with name + avatar + bio + optional photo. Fetch from person/roster data | P0 |
| **Eligibility Gate Screen** | Simply Voting | Members don't understand why they can't vote | Show clear eligibility status before ballot: dues status, membership tenure, suspension check. Current: generic error only | P1 |
| **Vote Confirmation Dialog** | ElectionBuddy, eBallot | Accidental vote submission | Add ConfirmDialog before castBallot with summary of selections. Pattern component already exists | P0 |
| **Voting Receipt** | ElectionBuddy | Members unsure if vote was recorded | After voting, show confirmation card with timestamp + "Your vote has been recorded" + election summary | P1 |
| **Election Status Timeline** | ElectionBuddy, Boardable | State machine not visually clear | `ElectionTimeline` component EXISTS but is orphaned. Wire it into ElectionDetail views | P1 |
| **Results Auto-Publish** | ElectionBuddy | Results hidden until officer manually publishes | Add optional auto-publish setting on election creation. Show countdown to results release | P2 |
| **Document Kanban/Status View** | Notion | Officers can't see document lifecycle at a glance | Add status column view (Draft→Published→Archived) alongside current card grid | P2 |
| **Document Publish Action** | Boardable, DocuSign | No way to promote draft→published | Add "Publish" button on document detail/card. Mutation: `updateDocument({ status: 'published' })` | P0 |
| **Document Preview** | OnBoard, Google Drive | Must download to view document contents | Add inline PDF preview (iframe or react-pdf) for PDF documents. Show image preview for images | P1 |
| **Access Level Indicators** | Google Drive, OnBoard | Members don't know who can see a document | Show access level badge prominently on document cards + detail page. Already partially implemented | P2 |
| **Audit Trail Timeline** | DocuSign, OnBoard | Access log is a flat table, hard to scan | Convert access log to vertical timeline with icons per action type | P2 |
| **Permission-Denied Explanation** | OnBoard | Members see "Access Denied" with no context | Current implementation is good — shows ShieldAlert + "restricted to authorized personnel". Add: "Contact your officer to request access" | P3 |
| **Governance Dashboard** | Boardable | No unified governance entry point | New page: active elections + recent documents + upcoming deadlines + governance stats | P1 |
| **Mobile Ballot** | ElectionBuddy | Voting on phone needs to be frictionless | Current ballot is responsive but radio buttons are small. Enlarge tap targets, add position-by-position flow on mobile | P1 |

---

## 4. Current Memberry UI Audit

### Elections

| Area | Current State | Gap | Recommended Change | Priority |
|---|---|---|---|---|
| **Member nav** | No elections link in sidebar or bottom nav | Members can't find elections | Add "Elections" under Governance section in member sidebar | P0 |
| **Officer nav** | GOVERNANCE > Elections in officer sidebar ✓ | Working correctly | None needed | — |
| **Election list (member)** | Tab filtering (Active/Completed/All), status badges, type badges | Good UX — filters work well | Add count badges on tabs, add "No active elections" illustration | P3 |
| **Election list (officer)** | Stats row (Total/Active/Drafts/Published), full status visibility | Good — sees all states | Add "Cancelled" to stats, add bulk actions | P3 |
| **Election form** | 3-step wizard (Basics→Positions→Timeline) | Type mapping quirk: officer→general, bylaw→special. No preview step | Add Step 4 preview/confirm. Fix type mapping to match schema | P2 |
| **Nominee display** | Shows personId UUID in monospace | Critical UX gap — voters can't identify candidates | Fetch person name from roster. Show avatar + name + optional bio | P0 |
| **Voting ballot** | Per-position radio selection, sequential castBallot per position | No confirm dialog, small radio targets on mobile | Add ConfirmDialog, enlarge tap targets, add ballot summary | P0 |
| **Vote already cast** | Green banner "You have cast your vote" | Good — clear feedback | Add timestamp of when vote was cast | P3 |
| **Election timeline component** | `ElectionTimeline` exists as standalone component | Orphaned — not used anywhere | Wire into ElectionDetail (officer) and MemberElectionDetail | P1 |
| **Status transitions (officer)** | Inline confirm for phase actions (Open Nominations, etc.) | Works but could be more visible. No undo warning | Add consequence description ("12 nominees will be notified") | P2 |
| **Certify results** | Cross-module: creates officer terms, ends old terms, generates checklists | Works — strong backend | Show preview of what will happen before certifying | P2 |
| **Published results** | Green banner with date, winner Trophy icon, progress bars | Good visual hierarchy | Add downloadable results PDF (planned Wave 5 integration) | P2 |
| **Admin app** | Zero election UI | No admin oversight of elections | Add read-only election dashboard in admin app for platform-wide election monitoring | P2 |
| **SDK castBallot** | Uses raw SDK function, not React Query mutation | Inconsistent with other mutations | Wrap in useMutation for proper loading/error states | P2 |

### Documents

| Area | Current State | Gap | Recommended Change | Priority |
|---|---|---|---|---|
| **Officer nav** | DOCUMENTS section only has "Credit Reports" | Document library not in sidebar | Add "Document Library" to officer sidebar DOCUMENTS section | P0 |
| **Member nav** | No documents link in sidebar | Members can't find documents | Add "Documents" under Governance section in member sidebar | P0 |
| **Document library (officer)** | Card grid with upload, archive, category/status filters | Good layout. Missing publish action | Add "Publish" to card dropdown menu. Add status transition buttons | P0 |
| **Document browser (member)** | Category tabs, search, access filtering (client-side) | Client-side access filtering (metadata leaks) | Move access filtering to API query. Add access level badges | P1 |
| **Upload flow** | Drag-drop zone + form (title, category, access level) | Metadata-only — no actual file upload to storage | Implement actual S3/MinIO upload before createDocument call | P0 (backend) |
| **Document detail (officer)** | 3-tab layout (Details/Versions/Access Log) | Good structure. Access level editing works | Add status change actions (Publish/Archive buttons in header) | P0 |
| **Document detail (member)** | Metadata display + version history + download | Good access denied handling | Add inline PDF preview for PDFs | P1 |
| **Version upload** | File input + change notes + upload button | storageKey is computed string, not actual upload | Connect to actual storage upload flow | P0 (backend) |
| **Access log** | Table with user UUID, action, date, IP | Shows UUID instead of person name | Fetch person names for display | P1 |
| **Tags** | Tag manager with org tags, quick-add suggestions | Functional and well-designed | Add tag-based filtering in library view | P2 |
| **Delete** | Handler exists, no UI | Officers can't delete documents | Add delete option with ConfirmDialog (admin/officer only) | P2 |
| **Pagination** | Member: limit 100, Officer: limit 50 | Will break with many documents | Add infinite scroll or page-based pagination | P2 |
| **Admin app** | Zero document UI | No admin oversight of documents | Add read-only document stats in admin app | P3 |

### Shared Governance

| Area | Current State | Gap | Recommended Change | Priority |
|---|---|---|---|---|
| **Governance dashboard** | Does not exist | No unified governance entry point | Create `/org/$orgSlug/governance` dashboard with active elections + recent documents | P1 |
| **Sidebar structure** | Elections under GOVERNANCE, Documents under DOCUMENTS (separate sections) | Disconnected — governance is one domain | Unify under single GOVERNANCE section: Elections, Documents, (future: Committees, Resolutions) | P1 |
| **Cross-module links** | None | Election results don't link to documents | After election publish, show "View Election Results Document" link (when PDF generation is implemented) | P2 |
| **Schema/TypeSpec drift** | Drizzle has `officer/bylaw`, TypeSpec has `general/special/byElection` | Inconsistency causes bugs | Align schema enums with TypeSpec. Fix form type mapping | P1 |

---

## 5. ASCII Wireframes

### 1. Governance Dashboard (Member)

```
┌─────────────────────────────────────────────────────┐
│ ← Organization    Governance                         │
│ Your governance hub                                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌─────────────────────┐ ┌─────────────────────┐     │
│ │ 🗳 Active Elections │ │ 📄 Documents        │     │
│ │        2            │ │       24             │     │
│ │  View Elections →   │ │  Browse Library →    │     │
│ └─────────────────────┘ └─────────────────────┘     │
│                                                      │
│ ── Active Elections ─────────────────────────────    │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🟢 2026 Board Election       Voting Open     │   │
│ │ Officer │ 3 positions │ Closes Jun 30        │   │
│ │                              Cast Vote →      │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🟡 Bylaw Amendment #4     Nominations Open   │   │
│ │ Bylaw │ 67% threshold │ Opens Jul 15         │   │
│ │                              View Details →   │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Recent Documents ─────────────────────────────   │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 📄 2025 Annual Financial Report    Published  │   │
│ │ Financial Reports │ 2.4 MB │ May 20           │   │
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ 📄 Updated Bylaws v3.2             Published  │   │
│ │ Bylaws │ 156 KB │ May 15                      │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ [View All Documents →]                               │
└─────────────────────────────────────────────────────┘
```

### 2. Election List / Status Page (Officer)

```
┌─────────────────────────────────────────────────────┐
│ Elections                          [+ New Election]  │
│ Manage officer elections and bylaw votes             │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐  │
│ │Total │ │Active│ │Draft │ │Done  │ │Cancelled │  │
│ │  5   │ │  2   │ │  1   │ │  1   │ │    1     │  │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────────┘  │
│                                                      │
│ ── DRAFT ── ── ── ── ── ── ── ── ── ── ── ── ──   │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🟤 2026 Treasurer Election        Draft      │   │
│ │ Officer │ 1 position │ No dates set          │   │
│ │ ┌─○─○─○─○─○┐  timeline: not started         │   │
│ │                                    Edit →     │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── ACTIVE ── ── ── ── ── ── ── ── ── ── ── ── ──  │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🟢 2026 Board Election      Voting Open      │   │
│ │ Officer │ 3 positions │ 47 voters │ 62%      │   │
│ │ ┌─●─●─●─○─○┐  timeline: voting phase        │   │
│ │                                  Manage →     │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── COMPLETED ── ── ── ── ── ── ── ── ── ── ── ──  │
│ ┌───────────────────────────────────────────────┐   │
│ │ ✅ 2025 Board Election        Published      │   │
│ │ Officer │ 3 positions │ Results: May 1       │   │
│ │ ┌─●─●─●─●─●┐  timeline: complete            │   │
│ │                                  Results →    │   │
│ └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### 3. Election Setup / Admin Flow (Officer)

```
┌─────────────────────────────────────────────────────┐
│ New Election                                         │
│                                                      │
│    ①───────②───────③───────④                        │
│  Basics  Positions Timeline  Review                  │
│    ●        ○        ○       ○                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Election Title *                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ 2026 Board Election                         │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Type                                                │
│  ┌──────────────────┐ ┌──────────────────┐         │
│  │ ● Officer        │ │ ○ Bylaw          │         │
│  │ Elect officers   │ │ Vote on bylaws   │         │
│  └──────────────────┘ └──────────────────┘         │
│                                                      │
│  Voting Mode                                         │
│  ┌──────┐ ┌──────────┐ ┌──────┐                    │
│  │●Online│ │○In-Person│ │○Hybrid│                   │
│  └──────┘ └──────────┘ └──────┘                    │
│                                                      │
│               [Cancel]  [Next: Positions →]          │
└─────────────────────────────────────────────────────┘

Step 4: Review (NEW)
┌─────────────────────────────────────────────────────┐
│    ①───────②───────③───────④                        │
│  Basics  Positions Timeline  Review                  │
│    ●        ●        ●       ●                       │
├─────────────────────────────────────────────────────┤
│  Review Your Election                                │
│                                                      │
│  Title:    2026 Board Election                       │
│  Type:     Officer                                   │
│  Mode:     Online                                    │
│  Positions: President, Vice President, Treasurer     │
│                                                      │
│  Timeline:                                           │
│  Nominations: Jun 1 – Jun 15                         │
│  Voting:      Jun 20 – Jun 30                        │
│                                                      │
│  ⚠ Dates are optional. You can set them later.      │
│                                                      │
│         [← Back]  [Save as Draft]                    │
└─────────────────────────────────────────────────────┘
```

### 4. Nomination Flow (Member)

```
┌─────────────────────────────────────────────────────┐
│ ← Elections    2026 Board Election                   │
│                                                      │
│ ┌─●─●─○─○─○┐ Nominations Open                      │
│  D  N  V  C  P                                       │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🟡 Nominations Open until Jun 15              │   │
│ │                                                │   │
│ │ You are eligible to be nominated ✓             │   │
│ │ ☐ Active member  ☐ 6+ months  ☐ Not suspended │   │
│ │                                                │   │
│ │        [Self-Nominate for a Position →]        │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── President ── (2 nominees) ─────────────────────  │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 👤 Dr. Maria Santos                           │   │
│ │ Member since 2019 │ PDA Chapter Manila         │   │
│ │ "Committed to modernizing our association..."  │   │
│ │                                   Nominated ● │   │
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ 👤 Dr. Juan Reyes                             │   │
│ │ Member since 2021 │ PDA Chapter Cebu           │   │
│ │ "Focus on member benefits and CPD credits..." │   │
│ │                                   Nominated ● │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Treasurer ── (1 nominee) ──────────────────────  │
│ ...                                                  │
└─────────────────────────────────────────────────────┘
```

### 5. Member Ballot / Voting Flow

```
┌─────────────────────────────────────────────────────┐
│ ← Election    Cast Your Vote                         │
│ 2026 Board Election                                  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ Position 1 of 3: President                           │
│ Select one candidate                                 │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ ○ Dr. Maria Santos                            │   │
│ │   Member since 2019 │ Manila Chapter           │   │
│ │   "Committed to modernizing our association"   │   │
│ └───────────────────────────────────────────────┘   │
│ ┌───────────────────────────────────────────────┐   │
│ │ ● Dr. Juan Reyes                    ✓ Selected│   │
│ │   Member since 2021 │ Cebu Chapter             │   │
│ │   "Focus on member benefits and CPD credits"   │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Progress ──  [●●○] 1 of 3 positions selected     │
│                                                      │
│              [Cancel]  [Review & Submit →]            │
└─────────────────────────────────────────────────────┘

Confirmation Dialog:
┌───────────────────────────────────┐
│  Confirm Your Ballot              │
│                                   │
│  President: Dr. Juan Reyes        │
│  Vice President: Dr. Ana Cruz     │
│  Treasurer: Dr. Mark Lim          │
│                                   │
│  ⚠ Your vote cannot be changed   │
│  after submission.                │
│                                   │
│  [Cancel]  [Submit Ballot]        │
└───────────────────────────────────┘
```

### 6. Voting Confirmation / Results Page

```
┌─────────────────────────────────────────────────────┐
│ ← Elections    2026 Board Election                   │
│                                                      │
│ ┌─●─●─●─●─●┐ Results Published                     │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ ✅ Your vote was recorded on Jun 25, 2:30 PM  │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 📊 Voter Turnout: 142 of 200 members (71%)   │   │
│ │ Published: Jun 30, 2026                        │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── President ──────────────────────────────────     │
│ ┌───────────────────────────────────────────────┐   │
│ │ 🏆 Dr. Juan Reyes           89 votes (63%)   │   │
│ │ ████████████████████░░░░░░░░░░               │   │
│ │    Dr. Maria Santos          53 votes (37%)   │   │
│ │ ████████████░░░░░░░░░░░░░░░░                 │   │
│ │                                 ← Your vote   │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Vice President ─────────────────────────────     │
│ ...                                                  │
│                                                      │
│ [📄 Download Results PDF]                            │
└─────────────────────────────────────────────────────┘
```

### 7. Document Library (Officer)

```
┌─────────────────────────────────────────────────────┐
│ Document Library                [+ Upload Document]  │
│ Manage organization documents                        │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌──────┐ ┌────────┐ ┌────────┐                     │
│ │Total │ │Published│ │ Draft  │                     │
│ │  24  │ │   18   │ │   4    │                     │
│ └──────┘ └────────┘ └────────┘                     │
│                                                      │
│ [All] [Bylaws(3)] [Minutes(8)] [Policies(4)]        │
│ [Forms(2)] [Election Results(3)] [Financial(4)]     │
│                                                      │
│ Status: [All ▾]  Search: [______________🔍]        │
│                                                      │
│ ┌──────────────┐ ┌──────────────┐ ┌────────────┐   │
│ │ Published ●  │ │ Draft ●      │ │ Published ●│   │
│ │ Bylaws       │ │ Minutes      │ │ Policies   │   │
│ │              │ │              │ │            │   │
│ │ 📄 Amended   │ │ 📄 May 2026  │ │ 📄 Code of │   │
│ │ Bylaws v3.2  │ │ Board Mtg    │ │ Ethics 2026│   │
│ │              │ │ Minutes      │ │            │   │
│ │ 156KB │ May15│ │ 45KB │ May20 │ │ 89KB│May10 │   │
│ │ 👥Members    │ │ 🔒Officers   │ │ 🌐Public   │   │
│ │ ···          │ │ [Publish] ··│ │ ···        │   │
│ └──────────────┘ └──────────────┘ └────────────┘   │
│                                                      │
│ Upload Zone:                                         │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │  📤 Drag and drop a file, or click to browse   │  │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
└─────────────────────────────────────────────────────┘
```

### 8. Document Detail / Preview Page (Member)

```
┌─────────────────────────────────────────────────────┐
│ ← Documents    Amended Bylaws v3.2                   │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌───────────────────────────────────────────────┐   │
│ │ 📄 Amended Bylaws v3.2                        │   │
│ │ bylaws-v3.2.pdf │ 156 KB │ Published          │   │
│ │                                                │   │
│ │ Category: Bylaws    Access: 👥 Members Only    │   │
│ │ Tags: [governance] [bylaws] [2026]             │   │
│ │ Updated: May 15, 2026                          │   │
│ │                              [⬇ Download]      │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Document Preview ─────────────────────────────   │
│ ┌───────────────────────────────────────────────┐   │
│ │                                                │   │
│ │    [PDF Preview Iframe / react-pdf]            │   │
│ │    Page 1 of 24                                │   │
│ │    [← Prev] [Page __] [Next →]                 │   │
│ │                                                │   │
│ └───────────────────────────────────────────────┘   │
│                                                      │
│ ── Version History ──────────────────────────────   │
│ │ v3  bylaws-v3.2.pdf  156KB  May 15            │   │
│ │     "Updated Article 7 election procedures"    │   │
│ │ v2  bylaws-v3.1.pdf  148KB  Jan 10            │   │
│ │     "Minor corrections"                        │   │
│ │ v1  bylaws-v3.0.pdf  142KB  Sep 1, 2025       │   │
│ │     "Initial adoption"                         │   │
└─────────────────────────────────────────────────────┘
```

### 9. Document Upload / Edit / Versioning Flow (Officer)

```
Upload New Document:
┌─────────────────────────────────────────────────────┐
│ Upload Document                                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐  │
│ │  📤 Drop file here or click to browse          │  │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘  │
│                                                      │
│ ✅ bylaws-v3.2.pdf (156 KB)           [✕ Remove]   │
│                                                      │
│ Title *                                              │
│ [Amended Bylaws v3.2                          ]      │
│                                                      │
│ Category          Access Level                       │
│ [Bylaws ▾]        [Members Only ▾]                   │
│                                                      │
│ Status                                               │
│ (●) Save as Draft    ( ) Publish immediately         │
│                                                      │
│              [Cancel]  [Upload Document]             │
└─────────────────────────────────────────────────────┘

Upload New Version (on detail page):
┌───────────────────────────────────────┐
│ Upload New Version                    │
│                                       │
│ [Choose File]  bylaws-v3.3.pdf (160KB)│
│                                       │
│ Change Notes                          │
│ [Updated Article 12 dues schedule   ] │
│                                       │
│     [Cancel]  [Upload Version]        │
└───────────────────────────────────────┘
```

### 10. Mobile Governance View

```
┌─────────────────────┐
│ ≡  Governance    🔔 │
├─────────────────────┤
│                     │
│ ┌─────────────────┐ │
│ │🗳 Active: 2     │ │
│ │📄 Documents: 24 │ │
│ └─────────────────┘ │
│                     │
│ ── Elections ────── │
│                     │
│ ┌─────────────────┐ │
│ │🟢 2026 Board    │ │
│ │ Voting Open     │ │
│ │ Closes Jun 30   │ │
│ │  [Cast Vote →]  │ │
│ └─────────────────┘ │
│                     │
│ ── Documents ────── │
│                     │
│ ┌─────────────────┐ │
│ │📄 Bylaws v3.2   │ │
│ │ Published │156KB│ │
│ │ 👥 Members Only │ │
│ └─────────────────┘ │
│ ┌─────────────────┐ │
│ │📄 Board Minutes │ │
│ │ Published │45KB │ │
│ │ 🌐 Public       │ │
│ └─────────────────┘ │
│                     │
│ [View All →]        │
│                     │
├─────────────────────┤
│ 🏠  📋  🎓  👤    │
│Home Act  Cred Prof  │
└─────────────────────┘
```

---

## 6. Recommended Sidebar / Information Architecture

### Officer Sidebar

```
GOVERNANCE
  📊 Dashboard        → /org/:slug/officer/governance
  🗳 Elections        → /org/:slug/officer/elections
  📄 Document Library → /org/:slug/officer/documents
  (future: Committees, Resolutions)

OPERATIONS
  (existing items...)
```

### Member Sidebar

```
(existing: Dashboard, Activities, Events, Credits, Profile)

GOVERNANCE (NEW section)
  🗳 Elections    → /org/:slug/elections
  📄 Documents   → /org/:slug/documents
```

### Admin App Sidebar

```
(existing: Associations, Organizations, Members, ...)

GOVERNANCE (NEW section — read-only monitoring)
  🗳 Elections    → /elections (platform-wide stats)
  📄 Documents   → /documents (platform-wide stats)
```

### Visibility Matrix

| Nav Item | Admin | Officer | Member |
|---|---|---|---|
| Governance Dashboard | Read-only stats | Full management | Active elections + recent docs |
| Elections | Platform-wide monitoring | Create/manage/certify | View/vote when eligible |
| Documents | Platform-wide stats | Upload/manage/publish | Browse published only |
| Committees | — | Future | Future |
| Resolutions | — | Future | Future |

---

## 7. Cross-Module Flow Map

```
Identity/Members ──→ Dues Status ──→ Eligibility Check
                         │                    │
                         │                    ▼
                         │         ┌──────────────────┐
                         │         │ Nomination Flow   │
                         │         │ BR-34: active +   │
                         │         │ 6mo tenure +      │
                         │         │ not suspended     │
                         │         └────────┬─────────┘
                         │                  │
                         ▼                  ▼
                  ┌──────────────┐  ┌──────────────────┐
                  │ Ballot Access│  │ Candidate Display │
                  │ BR-33: dues  │  │ Profile + bio +   │
                  │ paid + active│  │ platform statement│
                  └──────┬───────┘  └──────────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Voting Flow  │
                  │ Per-position │
                  │ + confirm    │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐     ┌──────────────┐
                  │ Results      │────→│ Documents    │
                  │ Certify +    │     │ Auto-generate│
                  │ Publish      │     │ results PDF  │
                  └──────┬───────┘     └──────┬───────┘
                         │                    │
                         ▼                    ▼
                  ┌──────────────┐     ┌──────────────┐
                  │ Officer Term │     │ Document     │
                  │ Transition   │     │ Library      │
                  │ Old→Complete │     │ Versioned +  │
                  │ New→Active   │     │ Access-gated │
                  └──────────────┘     └──────────────┘

Documents Flow:
  Upload → Draft → Publish → (Active) → Archive
                      │
                      ▼
            ┌──────────────────┐
            │ Access Control   │
            │ public           │ → All (including non-members)
            │ tenantOnly       │ → All org members
            │ unitOnly         │ → Unit/chapter members
            │ restricted       │ → Officers only
            │ privileged       │ → Admin only
            └──────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │ Version History  │
            │ v1 → v2 → v3    │
            │ Change notes     │
            │ Upload dates     │
            └──────────────────┘
                      │
                      ▼
            ┌──────────────────┐
            │ Access Log       │
            │ Who viewed/      │
            │ downloaded when  │
            │ + IP address     │
            └──────────────────┘
```

**Data moving between modules:**
- **Members → Elections**: personId, membership status, dues expiry, tenure date, suspension status
- **Elections → Documents**: election results data for PDF generation (planned, not implemented)
- **Elections → Officers**: winner personId + positionId for term creation
- **Documents → Access Control**: organizationId + accessLevel + member role for visibility filtering

---

## 8. Gap Analysis

| Gap | Admin Impact | Member Impact | Shared State | Recommended Fix | Priority | Complexity |
|---|---|---|---|---|---|---|
| No member nav for Elections | — | Can't find elections without direct URL | Election visibility | Add Elections to member sidebar GOVERNANCE section | P0 | Low |
| No member nav for Documents | — | Can't find document library | Document visibility | Add Documents to member sidebar GOVERNANCE section | P0 | Low |
| Officer Documents not in sidebar | Can't find document library from nav | — | Document management | Add "Document Library" to officer sidebar DOCUMENTS section | P0 | Low |
| Nominee shows UUID not name | Officers see UUIDs when managing | Voters can't identify candidates | Person data join | Fetch person name from roster. Show avatar + name | P0 | Medium |
| No vote confirmation dialog | — | Risk of accidental vote submission | Vote integrity | Add ConfirmDialog with ballot summary before submit | P0 | Low |
| No document publish workflow | Officers can't make drafts visible | Members never see draft documents | Document status | Add "Publish" action to document card/detail. Update status via mutation | P0 | Low |
| ElectionTimeline orphaned | Timeline not visible in officer detail | Timeline not visible in member detail | UI component | Wire existing component into both detail views | P1 | Low |
| No governance dashboard | No unified governance view | No governance entry point | Navigation | Create governance dashboard page for both apps | P1 | Medium |
| Schema/TypeSpec enum drift | — | — | Data integrity | Align Drizzle enums with TypeSpec definitions | P1 | Medium |
| Access log shows UUID | Officers see UUIDs in access log | — | Person data join | Fetch person name for access log display | P1 | Medium |
| No file upload to storage | Upload creates metadata only | — | File storage | Implement S3/MinIO upload before createDocument | P0 (backend) | High |
| Client-side access filtering | — | Restricted doc metadata leaks via API | Security | Move access filter to API query parameter | P1 | Medium |
| No document preview | — | Must download to view PDF | UX friction | Add inline PDF preview (react-pdf or iframe) | P1 | Medium |
| No delete UI for documents | Officers can't remove documents | — | Document lifecycle | Add delete with ConfirmDialog | P2 | Low |
| No pagination | — | Breaks at scale | Performance | Add infinite scroll or pagination | P2 | Medium |
| No admin app governance | No platform-wide election monitoring | — | Admin oversight | Add read-only governance stats in admin | P2 | Medium |
| castBallot not React Query mutation | — | Inconsistent loading/error states | SDK pattern | Wrap in useMutation | P2 | Low |
| **Partial vote bug (sequential loop)** | — | **Positions 1-2 voted, position 3 fails = partial ballot** | **Vote integrity** | **Batch API endpoint or per-position retry tracking** | **P0** | **Medium** |
| **No election notifications** | No lifecycle alerts | **Members miss voting windows** | **Notification system** | **Wire election events to existing notification infra** | **P1** | **Medium** |
| **No self-nomination flow** | — | **Members can't nominate themselves** | **Nomination access** | **Add SelfNominationDialog for member-facing nomination** | **P1** | **Medium** |
| **No abstain option on ballot** | — | Forced candidate selection per position | Governance legitimacy | Add "Abstain" option per position | P2 | Low |
| **Mobile bottom nav has no governance entry** | — | Mobile members can't reach governance | Mobile navigation | Add 5th tab or "More" menu with governance links | P1 | Medium |
| Election results PDF not generated | No auto-generated results document | No downloadable results | Cross-module | Implement pg-boss job for PDF generation on certify | P2 | High |
| **Officer sidebar + mobile nav duplication** | Nav arrays duplicated in 2 files | — | Maintenance trap | Flag: both officer-sidebar.tsx AND officer-mobile-nav.tsx must be updated together | P2 | Low |

---

## 9. Phased Upgrade Plan

### Phase 1: Foundational Governance UX (P0 — immediate)

| Change | Why | Files | Complexity |
|---|---|---|---|
| Add Elections + Documents to member sidebar | Members can't find governance features. Link to `/elections` and `/documents` directly (not `/governance` — dashboard comes in Phase 2) | `member-sidebar.tsx`, `member-bottom-nav.tsx` (add 5th tab or "More" menu) | Low |
| Add Document Library to officer sidebar | Officers can't navigate to documents. Add under existing DOCUMENTS section alongside Credit Reports (don't merge with GOVERNANCE section) | `officer-sidebar.tsx` AND `officer-mobile-nav.tsx` (both must be updated — duplicated nav arrays) | Low |
| Fix nominee name display | Voters see UUIDs, can't evaluate candidates | **Backend:** `getElection` handler must join person name/avatar into nominee response. **Frontend:** `election-detail.tsx`, `member-election-detail.tsx`, `voting-ballot.tsx` | Medium |
| Add vote confirmation dialog | Prevent accidental votes, build voter trust | `voting-ballot.tsx` — use existing `ConfirmDialog` pattern. Show ballot summary (all positions + selections) | Low |
| Add document publish action | Officers can't make drafts visible to members | `document-library.tsx` card dropdown + officer `$documentId.tsx` header — call `updateDocumentMutation({ status: 'published' })` | Low |
| **Fix partial vote bug** | **Sequential castBallot loop can leave partial ballots on network failure** | **Option A (preferred):** New `castBallots` batch API endpoint accepting all positions atomically. **Option B:** Per-position retry tracking in `voting-ballot.tsx` showing which positions succeeded/failed | **Medium** |

**Phase 1 note:** All sidebar links go directly to existing routes (`/elections`, `/documents`). Governance dashboard route comes in Phase 2.

### Phase 2: Elections Workflow Polish (P1)

| Change | Why | Files | Complexity |
|---|---|---|---|
| Wire ElectionTimeline component | Visual state machine not shown (component exists, orphaned) | Import `ElectionTimeline` in officer `election-detail.tsx` and member `$electionId/index.tsx` | Low |
| Add eligibility gate messaging | Members don't understand why they can't vote | `voting-ballot.tsx` — show checklist: ☐ Active ☐ Dues paid ☐ 6+ months ☐ Not suspended. Wireframe needed for denied state | Medium |
| Add voting receipt/confirmation | Members unsure if vote was recorded | `$electionId/index.tsx` — show timestamp, confirmation card after voting | Low |
| Create governance dashboard | No unified governance entry point | New route: `_authenticated/org/$orgSlug/governance/index.tsx` — active elections + recent docs. Then update sidebar links from Phase 1 | Medium |
| **Wire election lifecycle notifications** | **Members miss voting windows** | Wire `ElectionOpened`, `ElectionPublished` domain events to existing notification infra (`notification-drawer.tsx`, `notification-inbox.tsx`) | Medium |
| **Add self-nomination flow** | **Members can only be nominated by officers, no self-serve** | New component: `SelfNominationDialog` — member selects position, submits nomination (uses `createCandidateMutation` with own personId) | Medium |
| **Add governance widget to officer dashboard** | **Officers miss election/document activity** | Add stat cards (active elections, pending documents) to existing officer dashboard | Low |
| Fix schema/TypeSpec enum drift | Data inconsistency between API layers | `elections.schema.ts` enums vs `governance.tsp` — align | Medium |

### Phase 3: Document Library Enhancement (P1-P2)

| Change | Why | Files | Complexity |
|---|---|---|---|
| Add inline PDF preview | Members must download to view | `$documentId.tsx` member detail — add iframe or react-pdf viewer | Medium |
| Move access filtering to API | Restricted document metadata leaks to client | `searchDocuments.ts` handler — add `accessLevel` filter param | Medium |
| Fix access log person names | Officers see UUIDs in access log | `$documentId.tsx` officer detail — join person data for access log entries | Medium |
| Add delete UI | Officers can't remove documents | `document-library.tsx` — add "Delete" to card dropdown with ConfirmDialog | Low |
| Add pagination | Will break at scale | Both `document-library.tsx` and `document-browser.tsx` — cursor or offset pagination | Medium |

### Phase 4: Governance Auditability (P2-P3)

| Change | Why | Files | Complexity |
|---|---|---|---|
| Election results PDF generation | No downloadable results archive | New pg-boss job: `generateElectionResultsPdf.ts` — @react-pdf/renderer | High |
| Admin app governance monitoring | No platform-wide governance oversight | New admin routes: `/elections`, `/documents` — read-only stats | Medium |
| Audit trail timeline | Access log is flat table, hard to scan | `$documentId.tsx` access log tab — vertical timeline component | Medium |
| Election history / member governance record | No view of a member's governance participation history | New component showing elections voted in, terms served | Medium |
| Document approval workflow | No multi-step approval before publish | New feature: approval routing with sign-off chain | High |

---

## 10. Implementation Notes for AI Coding Agent

### Screens to improve first (priority order)
1. Member sidebar — add GOVERNANCE section (elections + documents links)
2. Officer sidebar — add Document Library to DOCUMENTS section
3. Nominee display — replace UUID with person name in all election views
4. Vote confirmation — add ConfirmDialog to VotingBallot
5. Document publish — add Publish button to DocumentLibrary card dropdown

### Existing components to reuse
- `GlassCard` (`@/components/motion/glass-card`) — all content cards
- `ConfirmDialog` (`@/components/patterns/confirm-dialog`) — vote confirm, delete confirm
- `StatusBadge` (`@/components/patterns/status-badge`) — election/document status
- `StatCard` (`@/components/patterns/stat-card`) — dashboard stats
- `EmptyState` (`@/components/patterns/empty-state`) — empty lists
- `PageHeader` (`@/components/patterns/page-header`) — route headers
- `ElectionTimeline` (`@/features/elections/components/election-timeline.tsx`) — orphaned, wire it in
- `DataTable` (`@/components/patterns/data-table`) — tabular data
- Toast via `sonner` — all notifications

### New components needed
- `GovernanceDashboard` — active elections + recent documents + stats
- `CandidateCard` — nominee display with avatar, name, bio, platform statement
- `EligibilityChecklist` — visual BR-34 check results (active ✓, tenure ✓, not suspended ✓)
- `BallotConfirmDialog` — specialized confirm showing all selections
- `DocumentPreview` — inline PDF viewer (iframe or react-pdf)
- `PublishDialog` — confirm before publishing draft document

### How to preserve design system
- All content cards use `GlassCard`
- All route pages use `PageHeader` with breadcrumbs
- Colors from CSS custom properties (`--color-primary`, `--color-success`, etc.)
- Toast via `sonner`, never `useToast`
- UI primitives from `@monobase/ui` package
- Icons from `lucide-react`

### How to avoid overbuilding
- Phase 1 is **5 changes, all Low-Medium complexity** — do these first
- Don't build governance dashboard until Phase 2
- Don't build PDF generation until Phase 4
- Don't add admin app governance until Phase 4
- Document preview can use a simple `<iframe src="/api/.../download">` before investing in react-pdf

### How to enforce election state transitions
- Backend `VALID_TRANSITIONS` map in `updateElectionStatus.ts` already enforces — UI should reflect this
- Officer detail already disables/hides actions based on status — keep this pattern
- Add `ElectionTimeline` to make current phase visually obvious

### How to show dues-gated and eligibility-gated access
- `castVote.ts` already checks membership status via `computeMembershipStatus`
- Frontend should pre-check eligibility BEFORE showing ballot (not just error on submit)
- Show checklist: ☐ Active member ☐ 6+ months tenure ☐ Dues paid ☐ Not suspended
- Use `MembershipRepository.findByPersonAndOrg` to fetch status data

### How to separate document access levels
- API-side: Add `accessLevel` filter to `searchDocuments` handler
- Officer view: shows all access levels, can change via edit
- Member view: API returns only `public` + `tenantOnly` documents (no client-side filtering)
- Detail page: already shows access denied for restricted docs — keep this pattern

### Backend requirements not yet implemented
- **File upload to S3/MinIO** — createDocument/uploadVersion send metadata only, no file bytes
- **Document status promotion** — no `publishDocument` handler (use `updateDocument` with `{ status: 'published' }`)
- **Election results PDF generation** — pg-boss job + @react-pdf/renderer template planned
- **API-side access filtering** — searchDocuments currently returns all documents regardless of access level
- **Person name join for nominees** — `getElection` handler at `services/api-ts/src/handlers/elections/getElection.ts` must join person name/avatar into nominee data. Preferred: API-side join (not frontend roster lookup)
- **Batch ballot submission** — new `castBallots` endpoint accepting all position selections atomically (fixes partial vote bug)
- **Self-nomination endpoint** — may use existing `createCandidateMutation` with member's own personId, but verify auth allows member-initiated nomination

### Maintenance traps to flag
- `officer-sidebar.tsx` and `officer-mobile-nav.tsx` have **duplicated nav section arrays** — both must be updated together when adding nav items
- `election-form.tsx` maps `officer→general`, `bylaw→special` at line 159 — will break if TypeSpec enums change
- `POSITION_NAV_CONFIG` in `position-nav.ts` only covers 4 position titles — non-standard officer titles fall through to "show all" safety net

### Test expectations
- Add `*.test.tsx` files colocated with new components (existing pattern: `document-library.test.tsx`, `election-list.test.tsx`)
- Test loading, error, empty, and populated states for all new components
- Test vote confirmation dialog shows correct selections
- Test eligibility gate shows correct check results

### Design review adjustments incorporated
- **P0 added:** Partial vote sequential loop bug (data integrity)
- **P1 added:** Election lifecycle notifications, self-nomination flow, mobile bottom nav governance entry
- **Architecture:** Keep DOCUMENTS and GOVERNANCE as separate sidebar sections (don't merge — Credit Reports are not governance docs)
- **Sequencing:** Phase 1 links go to `/elections` and `/documents` directly. Governance dashboard route added in Phase 2, then sidebar links updated
- **Officer dashboard:** Add governance stat widget to existing dashboard (Phase 2) in addition to standalone governance page

## 11. Execution Gate Compliance

When implementing this plan, enforce:
- **TDD proof artifacts** — each phase must produce `TDD_PROOF.md` mapping spec items to test files
- **Test-first for all new components** — write failing test before implementation
- **Git-history verification** — test commits must precede implementation commits
- **Per-slice verification** — each wireframe/screen change verified with passing tests before moving to next

Phase 1 execution slices:
1. `w5-ux-01-member-nav` — sidebar + bottom nav links
2. `w5-ux-02-officer-nav` — document library sidebar link
3. `w5-ux-03-nominee-names` — backend join + frontend display
4. `w5-ux-04-vote-confirm` — confirmation dialog
5. `w5-ux-05-doc-publish` — publish action + mutation
6. `w5-ux-06-ballot-batch` — batch ballot API + frontend integration

Each slice: RED test → GREEN implementation → REFACTOR → TDD_PROOF entry → next slice.

---

Sources:
- [ElectionBuddy Features](https://electionbuddy.com/features/)
- [ElectionBuddy Process](https://electionbuddy.com/process/)
- [Designing User-Friendly Hybrid Ballots](https://electionbuddy.com/blog/2026/03/27/designing-user-friendly-hybrid-ballots/)
- [Boardable Features](https://boardable.com/features/)
- [OnBoard Board Management](https://www.onboardmeetings.com/)
- [Simply Voting for Membership Organizations](https://www.simplyvoting.com/membership-organizations/)
- [eBallot Membership Associations](https://www.eballot.com/sales-resources/membership-associations)
- [BigPulse Voting for Associations](https://www.bigpulsevoting.com/industries/associations/)
