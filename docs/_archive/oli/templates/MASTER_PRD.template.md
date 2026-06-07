# Product Requirements Document

**Product Name:** [Product Name]
**Version:** [0.1.0]
**Date:** [YYYY-MM-DD]
**Author:** [Name]
**Status:** Draft | Review | Approved

---

## 1. Product Overview

**Name:** [Product Name]

**One-Line Description:**
<!-- One sentence: what is this, for whom, core value prop -->

**Problem Statement:**
<!-- What pain does this solve? Who feels it? Why now? -->

**Target Users:**
<!-- Primary and secondary personas. Role, context, goals, technical level -->

**Success Definition:**
<!-- In plain English, what does "this worked" look like in 6 months? -->

---

## 2. Success Metrics

| Metric | Baseline | Target | Measurement Method |
|--------|----------|--------|--------------------|
| <!-- e.g. Weekly Active Users --> | <!-- current --> | <!-- goal --> | <!-- how measured --> |
| | | | |

---

## 3. Module Breakdown

Each row maps to a `MODULE_SPEC.template.md` file.

| Module Name | Priority | Description | Key Entities |
|-------------|----------|-------------|--------------|
| <!-- e.g. tenant --> | P0 / P1 / P2 | <!-- what it does --> | <!-- comma-separated entity names --> |
| | | | |

**Handler module placement:** `services/api-ts/src/handlers/[module]/`
**TypeSpec placement:** `specs/api/src/modules/[module].tsp`

---

## 4. Non-Functional Requirements

### Performance
<!-- Response time targets, throughput, caching strategy -->

### Security
<!-- Auth model (Better-Auth roles), PII handling, data encryption at rest/transit -->

### Compliance
<!-- GDPR, HIPAA, SOC2, audit trail requirements -->

### Scalability
<!-- Horizontal scaling assumptions, multi-tenancy model, connection pooling -->

### Availability
<!-- Uptime target, failover strategy, maintenance windows -->

---

## 5. Out of Scope

<!-- Explicit list of features/concerns this product will NOT handle. -->
<!-- Being explicit here prevents scope creep. -->

- [Thing we are not building and why]
- [Integration we are not doing in v1]

---

## 6. Assumptions and Dependencies

**Assumptions:**
<!-- Facts we're treating as true without verification -->
- [Assumption 1]

**External Dependencies:**
<!-- Third-party services, infrastructure, other teams -->
- [Dependency 1 — owner, status, risk if unavailable]

**Internal Dependencies:**
<!-- Monobase modules this product relies on -->
- Better-Auth (identity, sessions)
- [Other modules from the 9 built-in handler modules]

---

## 7. Open Questions

| # | Question | Owner | Due Date | Resolution |
|---|----------|-------|----------|------------|
| 1 | <!-- question --> | <!-- name --> | <!-- date --> | <!-- answer or TBD --> |

---

## 8. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 0.1.0 | [YYYY-MM-DD] | [Name] | Initial draft |
