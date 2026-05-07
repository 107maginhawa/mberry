---
phase: 06-ci-cd-devops-pipeline
plan: "03"
subsystem: devops
tags: [ci-cd, monitoring, github-actions, health-check]
dependency_graph:
  requires: [06-01]
  provides: [production-health-monitor]
  affects: [ops-visibility]
tech_stack:
  added: []
  patterns: [github-actions-schedule, github-issues-as-alerts]
key_files:
  created:
    - .github/workflows/monitor.yml
  modified: []
decisions:
  - Use GitHub Issues as alerting mechanism — zero cost, no external service, visibility in repo
  - Deduplicate incidents by label query — avoids issue spam during prolonged outages
  - Check /livez on /readyz failure — diagnostic triage (alive-but-not-ready vs completely down)
  - Guard with vars.PRODUCTION_API_URL — no-op until prod exists, safe to merge immediately
metrics:
  duration: "3 minutes"
  completed: "2026-05-06"
  tasks_completed: 1
  files_created: 1
---

# Phase 06 Plan 03: Production Health Monitor Summary

Scheduled GitHub Actions workflow that pings `/readyz` every 5 minutes and creates deduplicated GitHub Issues on failure, auto-closing on recovery.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create monitor.yml scheduled health check | ef1583c | .github/workflows/monitor.yml |

## What Was Built

`.github/workflows/monitor.yml` — a zero-cost production health monitor:

- Runs on a `*/5 * * * *` cron schedule plus `workflow_dispatch` for manual testing
- Pings `$PRODUCTION_API_URL/readyz`; if unhealthy, also pings `/livez` for diagnostics
- On failure: searches for open issues with labels `incident` + `production`
  - If found: adds a comment (dedup — no duplicate issues for ongoing outage)
  - If not found: creates a new incident issue with HTTP status, timestamp, and resolution steps
- On recovery (HTTP 200): auto-closes all open incident issues with a resolution comment
- The `if: vars.PRODUCTION_API_URL != ''` guard makes the workflow a no-op until the variable is set

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None. Issue body contains only HTTP status codes and timestamps — no secrets or PII exposed.

## Self-Check: PASSED

- `.github/workflows/monitor.yml` exists: FOUND
- Commit ef1583c exists: FOUND
- YAML valid: PASSED
- All acceptance criteria met: cron schedule, health-ping job, /readyz, /livez, incident labels, dedup logic, auto-close, PRODUCTION_API_URL guard, workflow_dispatch
