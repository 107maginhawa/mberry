# Business Context -- Memberry

## 1. Problem Statement

Professional healthcare associations -- dental societies, medical associations, nursing organizations, pharmacy chapters -- across the Philippines manage their chapters using a patchwork of consumer-grade tools never designed for organizational governance.

**Current state:**

- **Membership records** live in personal spreadsheets owned by individual officers. No standardization across chapters. No continuity across officer terms.
- **Dues collection** happens through person-to-person GCash or Maya transfers. No structured invoicing, no receipts, no allocation of funds to the right buckets.
- **Communication** runs through Viber group chats that hard-cap at 250 members. Chapters with more members fragment into multiple groups. Critical announcements, election notices, and compliance reminders fail to reach portions of the membership.
- **Event management** relies on word of mouth, manual sign-in sheets, and post-hoc data entry that rarely happens. CPD credit tracking at the chapter level is effectively nonexistent.
- **Officer transitions** are data destruction events. When an officer's term ends, their spreadsheets, contact lists, payment screenshots, and institutional knowledge leave with them. The incoming officer starts from scratch.

**Specific pain points:**

| Pain Point | Description |
|---|---|
| **Revenue leakage** | Dues go untracked. Lapsed memberships are not followed up. Chapters have no visibility into how much revenue they are actually collecting versus how much they should be collecting. A treasurer described reconciling GCash screenshots against a spreadsheet as "a nightmare every quarter." |
| **Regulatory risk** | In the Philippines, professional membership is often tied to licensure (e.g., RA 9484 for dentists). A member who lapses without notice faces regulatory exposure -- and the association bears reputational and legal risk for failing to notify them. No one tracks this systematically. |
| **Viber 250-member cap** | Chapters outgrow a single Viber group and split into two or three. Announcements must be copy-pasted across groups. Some members end up in none of them. Officers described this as "like shouting into three separate rooms and hoping everyone hears." |
| **Institutional knowledge loss** | Every officer transition is a hard reset. Relationships, processes, vendor contacts, event templates, and historical context evaporate. An incoming treasurer reported spending "the first two months just figuring out what was owed and by whom." |
| **No audit trail** | Without a system of record, treasurers cannot demonstrate how funds were collected, allocated, or spent. This breeds distrust among members and creates governance risk during officer transitions. One chapter president noted: "We trust our treasurer, but we have no way to prove anything if someone asks." |
| **No data-driven decisions** | Association leaders cannot answer basic questions: How many active members do we have? What is our retention rate? Which events drive the most engagement? What percentage of members are compliant with CPD requirements? |

---

## 2. Market Validation

### Competitor signal

A peer dental society (a competitor organization to the initial target chapter) already contracted and paid a vendor to build a custom AMS solution. Their assessment of the delivered product was that it was "lacking." This confirms two critical signals:

1. **Willingness to pay exists.** Associations recognize the problem and are allocating real budget to solve it -- not theoretical interest, but money already spent.
2. **Existing solutions are inadequate.** The custom-built product did not meet expectations, leaving an open lane for a purpose-built platform.

### Global AMS market

- **Market size (2026):** USD $2.97 billion
- **Growth rate:** ~14% year-over-year
- **Key growth drivers:** digital transformation of member-based organizations, demand for integrated payment and communication tools, regulatory compliance requirements, shift from desktop-installed to cloud-based platforms

### No AMS players targeting Southeast Asian healthcare associations

Every major AMS platform (iMIS, GrowthZone, MemberClicks, Wild Apricot, Fonteva) is priced in USD, designed for US/EU organizational structures, integrates only with Western payment gateways (Stripe, PayPal), and offers no support for GCash, Maya, or Philippine bank transfers. None handle CPD credit tracking against PRC requirements. None support the multi-tier chapter hierarchy (national to regional to chapter) that is standard in Philippine healthcare associations. The gap is structural, not incremental.

### Philippine market sizing

The Philippines has 1,800+ PRC-registered professional specialties across 81 provinces, with thousands of local chapters spanning dentistry, medicine, nursing, pharmacy, and allied health. A conservative estimate puts the addressable market at 5,000+ association chapters needing management software.

At a subscription price of P500-2,000 per month per chapter, the Philippine TAM alone is P30M-120M per year (~$530K-$2.1M). This is the wedge market. Southeast Asia and other emerging markets with similar association structures (Indonesia, Vietnam, Thailand) represent a much larger opportunity.

### Willingness to pay

Validated by the competitor signal above. A peer dental society paid a vendor for a custom AMS. Officers in discovery conversations described their current situation as unsustainable and expressed interest in a purpose-built platform, particularly one with a free trial that removes adoption risk.

---

## 3. Competitive Analysis

| Competitor Type | Examples | Price Range | Gap |
|---|---|---|---|
| **Western enterprise AMS** | iMIS, Fonteva (Salesforce) | $10,000-$50,000+/year | Enterprise pricing; requires dedicated IT staff; no SEA localization; no PH payment gateways; no CPD credit tracking against PRC requirements; no multi-tier chapter hierarchy support |
| **Western mid-market AMS** | MemberClicks, GrowthZone, YourMembership | $4,000-$25,000/year | US-centric payment integrations; English-only; USD pricing; limited financial operations; no GCash/Maya support; no mobile-first design |
| **Western small-org AMS** | Wild Apricot | $600-$3,600/year | Limited scalability; weak financial reporting; no hierarchical chapter support; no SEA presence; no healthcare regulatory framework support |
| **Local fintech (future risk)** | GCash, Maya | Free (payment link + roster) | Could add "association dues collection" as a feature -- payment link + simple roster. But no governance, no communications, no credit tracking, no compliance, no officer transitions. Speed risk: they move fast and have massive distribution. |
| **Custom development** | Local dev shops | $5,000-$20,000 one-off | Expensive one-off builds; no ongoing product development; vendor dependency; validated as "lacking" by competitor experience |
| **Generic SaaS workarounds** | Google Workspace, Airtable, Notion | $0-$500/year | No integrated payments; no compliance tracking; no member-facing portal; stitched together with manual processes |
| **Status quo** | Viber + GCash + Excel | Free | 250-member cap; no audit trail; no structured data; no receipts; data lost on officer transition; no compliance visibility |

### Competitive moat

1. **Domain depth.** Healthcare CPD requirements, multi-org membership, regulatory compliance (RA 9484, PRC requirements), fund allocation rules -- these are not features a generic AMS or fintech can bolt on quickly.
2. **Local payment gateways.** Native integration with PayMongo (GCash, Maya, bank transfer, credit card) from day one. Not Stripe with a workaround.
3. **Network effects.** More chapters on the platform means richer cross-org data, cross-org member matching, profession-wide compliance visibility. Each new chapter makes the platform more valuable for every existing chapter.
4. **Affordable pricing.** Free trial to minimal subscription (target: under $100/month per chapter). Inverts the competitor model of paying upfront for an unknown product.
5. **Localization.** Built for the PH market first -- organizational structures, payment methods, regulatory frameworks, mobile-first UX for smartphone-primary users.

---

## 4. Strategic Framing

### Memberry as GTM wedge

The AMS is the entry point, not the destination. It is the customer acquisition channel for a much larger health technology play.

### Phase 1: Association Management System

**Identity:** "The operating system for your healthcare chapter."

Ship to chapters. Solve the acute pain of membership management, dues collection, event management, and communication for individual chapters and their national organizations.

- Rapid adoption across chapters within a single association, then expansion to additional associations.
- Revenue model: free trial to minimal subscription per chapter.
- Success: chapters actively using the platform for dues collection and member communication, with measurable reduction in officer administrative burden.

### Phase 2: Professional Identity Platform

Every member gets a verified digital professional identity. A dentist who belongs to PDA, a specialty society, and a regional dental group maintains one profile that all three organizations can see (with permissioned access).

- Cross-org visibility: one profile, multiple memberships, portable credentials.
- Compliance tracking across organizations: CPD credits, licensure status, dues standing -- all in one place.
- Professional feed: network-wide announcements, training opportunities, cross-org event discovery.
- Value for the professional: convenience, portability, verified credentials.
- Value for associations: richer member data, cross-organization coordination, profession-wide analytics.

### Phase 3: Health Services Marketplace

With a verified base of healthcare professionals and their practice profiles, the platform becomes a distribution channel for higher-value products:

- **EMR/clinic management software** -- offer or integrate practice management tools.
- **Supply procurement** -- dental/medical supply marketplaces with group purchasing power.
- **Insurance products** -- professional liability insurance, health insurance, group plans.
- **Continuing education** -- accredited online learning with automatic CPD credit logging.
- **Job boards** -- connect healthcare professionals with employment opportunities.
- **Telehealth infrastructure** -- enable professionals to offer virtual consultations.
- **Pharma advertising** -- targeted, compliant reach to verified healthcare professionals by specialty and location.

This phase transforms the business model from SaaS subscriptions to a marketplace with transaction-based and referral-based revenue streams that are orders of magnitude larger than AMS subscriptions.

### The network effect

More chapters produce richer cross-org data. Richer data produces more value for each chapter. More value per chapter accelerates adoption of new chapters. This flywheel is the strategic asset. The AMS is the mechanism that starts it spinning.

---

## 5. Bridge from Current Workflow

Adoption depends on meeting officers and members where they are today. The platform must feel like an upgrade to their existing tools, not a replacement that requires learning an entirely new way of working.

| Current Tool | Current Workflow | Memberry Equivalent | Bridge Strategy |
|---|---|---|---|
| **Viber** | Group chat for announcements; fragmented across multiple groups when membership exceeds 250 | Communications module: announcements, segmented messaging, push notifications | Same feel (broadcast message to all members), no 250-member cap, group announcements with read tracking. Officers still "send a message" -- they just reach everyone. |
| **GCash** | Person-to-person transfer to treasurer for dues; treasurer screenshots as records | Online dues with QR code payment via PayMongo (GCash, Maya, bank transfer) | Member scans QR or taps payment link. Treasurer gets notification when payment arrives. Same GCash they already use, but with automatic receipt, automatic recording, automatic fund allocation. |
| **Excel / Google Sheets** | Manual roster maintained by secretary; often out of date; lost on officer transition | Member import via CSV; member self-update portal; persistent digital roster | One-time CSV import of existing spreadsheet. After that, members update their own profiles. Roster persists across officer transitions. Secretary still "manages the roster" -- but the roster manages itself. |
| **Cash at meetings** | Members pay dues in cash at events; treasurer records (or forgets to record) | Treasurer can record cash payments in-app with member attribution | Treasurer opens the app, selects the member, records the cash payment. Receipt generated. Same workflow as writing it in a notebook, but the data is structured, persistent, and auditable. |
| **Word of mouth** | Events promoted via Viber, Facebook, or word of mouth; manual sign-in sheets | Event creation with registration, QR check-in, automatic attendance logging | Officers create event in-app and share the link. Members register. At the event, QR check-in replaces paper sign-in. CPD credits auto-logged. |

**Key principle:** "Better than spreadsheets" is not enough. The platform needs to feel like an upgrade, not extra work. Every feature must be easier than the manual alternative it replaces, or officers will not adopt it.

---

## 6. Assumptions and Validation Status

| # | Assumption | Status | Validation Method | Risk if Wrong |
|---|---|---|---|---|
| A-1 | Professional healthcare associations in the Philippines are receptive to adopting a digital platform for chapter management, provided it is easy to use and low/no cost to start. | **Partially validated** -- initial conversations with PDA chapter officers indicate strong interest; competitor's willingness to pay confirms market awareness. | Customer discovery interviews; pilot deployment with 1-2 chapters. | If associations are not receptive, the entire GTM strategy fails. Mitigation: start with a single champion chapter and prove value before scaling. |
| A-2 | Current chapter officers (president, treasurer, secretary) are willing to invest time in onboarding to a new platform, even though they are unpaid volunteers. | **Hypothesized** -- not yet validated. Officer burnout and time constraints are known risks. | Onboarding time tracking during pilot; officer satisfaction surveys. | If officers will not invest onboarding time, the platform will not get populated with data. Mitigation: minimize onboarding to under 30 minutes; offer white-glove setup assistance for initial chapters. |
| A-3 | A sufficient percentage of members (target: >60%) have smartphones and are comfortable making digital payments via GCash or Maya. | **Likely valid** -- GCash has 94M+ registered users in the Philippines; mobile penetration is ~155%. Healthcare professionals skew urban and higher-income. | Member survey during pilot; payment method adoption rates post-launch. | If members cannot or will not pay digitally, the core value proposition of automated dues collection weakens. Mitigation: support manual payment recording by officers as a fallback. |
| A-4 | Average annual membership dues per member are in the range of PHP 500-5,000 (USD $9-$90), making the economics viable for a low-cost subscription model where the platform fee is a fraction of collected dues. | **Partially validated** -- initial research suggests PDA chapter dues are in this range, but variation across associations is unknown. | Dues schedule collection from 5+ associations across different professions. | If dues are significantly lower, the platform subscription may exceed the value of automated collection. Mitigation: offer free tier for very small chapters; monetize through higher-value services. |
| A-5 | Payment gateway integration with GCash, Maya, and Philippine bank transfers can be completed within 3-4 months using existing aggregator APIs (PayMongo, Xendit, or DragonPay). | **Likely valid** -- PayMongo and Xendit offer well-documented APIs with GCash and Maya support. Integration timelines for similar projects are typically 4-8 weeks per gateway. | Proof-of-concept integration during technical spike. | If payment integration takes significantly longer, the MVP will launch without automated payments -- the single most important feature for treasurer adoption. Mitigation: begin integration early; have manual payment recording fallback. |
| A-6 | PRC (Professional Regulation Commission) data or APIs for license verification are accessible or can be manually supplemented, enabling compliance tracking features. | **Unvalidated** -- PRC does not currently offer a public API. Manual verification may be required initially. | Inquiry to PRC; research into existing verification services; legal review of data access. | If PRC data is inaccessible, compliance features will rely on self-reported data, reducing trustworthiness. Mitigation: allow manual compliance data entry with officer verification; pursue PRC partnership as a separate workstream. |
| A-7 | Multi-chapter hierarchical structures (national to regional to chapter) are common across Philippine healthcare associations, not unique to the initial target customer (PDA). | **Partially validated** -- PMA, PNA, and PPhA all appear to use similar hierarchical structures. | Organizational chart review for 5+ target associations. | If hierarchical structures vary significantly, the platform's multi-tier architecture may need substantial customization per association. Mitigation: design a flexible hierarchy model that supports 1-N levels with configurable relationships. |
| A-8 | Officers will trust a third-party platform with their financial data and member records, given the current baseline of zero institutional memory. | **Hypothesized** -- not yet validated. Trust is earned, not assumed, particularly for financial data. | Officer interviews during pilot; analysis of what data officers are willing to enter first versus last. | If officers do not trust the platform, they will maintain parallel spreadsheets and the platform becomes extra work rather than a replacement. Mitigation: transparent data handling; export-anytime policy; privacy-first design. |
| A-9 | Members who are already comfortable with GCash/Maya will prefer paying dues through a platform payment link over person-to-person transfer to a treasurer. | **Hypothesized** -- convenience suggests yes, but habit and trust in the treasurer relationship may resist change. | Payment method adoption rates in pilot; member interviews. | If members prefer paying the treasurer directly, online payment adoption will be low and the treasurer's reconciliation burden will not decrease. Mitigation: support both flows; make online payment visibly easier. |
| A-10 | The "free trial to minimal subscription" model generates enough revenue to sustain the platform at 50+ chapters. | **Unvalidated** -- unit economics depend on actual subscription pricing, payment gateway fees, and infrastructure costs at scale. | Financial modeling once pilot data on chapter sizes and dues amounts is available. | If the economics do not work, the platform needs either higher pricing (risking adoption), external funding, or acceleration of Phase 2/3 revenue streams. |

---

## 7. Failure Criteria (Pilot)

These are the signals that something is fundamentally broken. If any of these thresholds are hit during the pilot with the first chapter, the response is: pause, interview, fix before acquiring the next chapter.

| Signal | Threshold | What It Means | Response |
|---|---|---|---|
| **Low member registration** | Fewer than 20 members register in the first 2 weeks | Onboarding flow is broken, or officers are not promoting the platform, or members do not see the value | Interview officers and non-registering members. Is it awareness, friction, or apathy? Fix the root cause before continuing. |
| **No online payments** | Fewer than 5 online payments processed in the first month | Payment adoption is failing. Members may not trust the platform, the payment flow may be too complex, or they prefer paying the treasurer directly. | Interview members who paid cash instead of online. Observe a member attempting to pay online. Simplify or redesign the payment flow. |
| **Reversion to messaging apps** | The pilot chapter reverts to WhatsApp/Viber for official communications within 6 weeks | The communications module is not meeting their needs -- either too complex, not reliable enough, or missing features they depend on in Viber. | Interview officers about what drove them back. Identify the specific gap. This is an adoption failure, not a feature failure -- the product did not earn its place in their workflow. |
| **Treasurer abandonment** | Treasurer does not use the dues module after initial training | Treasurer UX needs redesign. The dues module is either too complex, does not match the treasurer's mental model, or creates more work than the spreadsheet it replaces. | Shadow the treasurer for a work session. Watch where they get stuck. Redesign the treasurer workflow based on observation, not assumptions. |
| **Officer churn** | Officers describe the platform as "extra work" rather than "easier" in feedback | The platform is additive to their workload rather than replacing existing effort. This is a fundamental value proposition failure. | Identify which tasks feel like extra work. Either automate them, remove them, or make them visibly faster than the manual alternative. |

---

## 8. Anti-Persona (Who This Is NOT For)

Not every association is a good fit. Clarity on who this is not for prevents wasted effort and misaligned expectations.

| Anti-Persona | Why They Are Not a Fit |
|---|---|
| **National-level associations with full-time staff and existing IT systems** | They already have an AMS (or the budget for one). Their needs are enterprise-grade: complex reporting, integrations with government systems, multi-department workflows. Memberry v1 is not built for this. They may be Phase 2 customers when the platform matures. |
| **Associations with fewer than 10 members** | Not enough complexity to justify software. A group chat and a shared spreadsheet genuinely work at this scale. The overhead of setting up a platform exceeds the administrative pain it solves. |
| **Associations that meet only once per year** | Their management needs are minimal: collect annual dues, organize one event. A payment link and a Google Form cover this. They do not need ongoing membership management, communications, or credit tracking. |
| **Associations outside the Philippines (for now)** | v1 is built for Philippine payment gateways, Philippine regulatory frameworks, and Philippine association structures. Associations in countries without PayMongo/GCash/Maya support cannot use the core payment features. International expansion is Phase 2+. |
| **Non-healthcare professional associations** | While the platform architecture could serve any association, the domain-specific features (CPD credit tracking, PRC compliance, healthcare regulatory frameworks) are healthcare-specific. Trade associations, alumni groups, and hobby clubs are not the target. The domain depth is the moat; going generic dilutes it. |

---

## 9. Glossary

| Term | Definition |
|---|---|
| **AMS** | Association Management System -- software platform for managing member-based organizations |
| **CPD / CE** | Continuing Professional Development / Continuing Education -- required ongoing learning for licensed professionals |
| **GCash** | Leading mobile wallet / payment platform in the Philippines (94M+ users) |
| **Maya** | Second-largest mobile wallet / payment platform in the Philippines (formerly PayMaya) |
| **PayMongo** | Philippine payment gateway aggregator supporting GCash, Maya, bank transfers, and credit cards |
| **NPC** | National Privacy Commission -- Philippine government body enforcing the Data Privacy Act |
| **PDA** | Philippine Dental Association -- initial target association for platform deployment |
| **PMA** | Philippine Medical Association |
| **PNA** | Philippine Nurses Association |
| **PPhA** | Philippine Pharmacists Association |
| **PRC** | Professional Regulation Commission -- Philippine government agency overseeing professional licensure |
| **RA 9484** | Republic Act 9484 (Philippine Dental Act of 2007) -- mandates PDA membership for practicing dentists |
| **RA 10173** | Republic Act 10173 (Data Privacy Act of 2012) -- Philippine data protection law |
| **Fund allocation** | The splitting of a single dues payment across multiple designated funds (e.g., 60% to national, 30% to chapter, 10% to special fund) |
| **Chapter hierarchy** | The organizational structure where a national association contains regional bodies which contain local chapters |
| **Officer transition** | The periodic (usually annual or biennial) handover of chapter leadership from outgoing to incoming officers |
| **TAM** | Total Addressable Market |
| **PWA** | Progressive Web App -- a web application installable to the home screen with offline capabilities |
