# ADR-0008: Superpowers workflow replaces GSD

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

The repository previously used the GSD (Get Stuff Done) workflow enforcer defined in CLAUDE.md. GSD required every code change to be gated through a GSD command entry point (`/gsd-quick`, `/gsd-execute-phase`, etc.) and maintained planning artifacts and task context via a command-based workflow.

Problems observed with GSD in this codebase:
- GSD commands added friction to small fixes — a one-line bug fix required going through a full GSD planning flow.
- The enforcement model ("start work through a GSD command, do not make direct edits") relied on behavioral compliance rather than CI. An AI agent that skipped the gate produced no observable error.
- GSD planning artifacts (branch templates, task states) diverged from the actual work being done, creating false confidence in plan coverage.
- The superpowers skill chain (brainstorming → writing-plans → subagent-driven-development → verification-before-completion → code-review) provides equivalent or better structure for AI-agent-driven development without requiring a command gate.

The decision to replace GSD with superpowers was made during Wave 1 of the codebase hardening initiative. The CLAUDE.md `## GSD Workflow Enforcement` block was replaced with `## Development Workflow` pointing to `docs/workflow/SUPERPOWERS_FLOW.md`. GSD branch-template keys were dropped from planning artifacts.

Source: `docs/workflow/SUPERPOWERS_FLOW.md`, CLAUDE.md §"Development Workflow" (note: CLAUDE.md still contains the GSD enforcement block — it is superseded by the superpowers flow for execution; the GSD block is retained for backward compat with any skill that references it), commits `5eda5ae6`, `bd521cfe`.

## Decision

The superpowers skill chain is the development workflow for this codebase. Entry points are: `/superpowers:brainstorming` (new feature), `/superpowers:systematic-debugging` (bug), `/superpowers:verification-before-completion` (pre-commit), `/superpowers:dispatching-parallel-agents` (parallel tasks), `/superpowers:requesting-code-review` (pre-merge). Trust comes from tests and CI gates, not workflow enforcement.

## Consequences

### Positive
- No command gate for small fixes — a one-line change can go directly to pre-commit verification.
- CI is the enforcement layer (typecheck, test coverage, contract tests, hand-wired route diff) — not behavioral compliance.
- The skill chain is composable: each skill can be used independently or chained.
- Works naturally with AI agent dispatch patterns (see `/superpowers:dispatching-parallel-agents`).

### Negative / tradeoffs
- Less rigid than GSD — without the command gate, it is possible to skip the planning step on complex features. This requires discipline.
- The transition left some GSD-era references in CLAUDE.md that can confuse new contributors until fully cleaned up.

### Neutral
- GSD skills remain available in the skill registry for projects that use them; they are simply no longer enforced as the entry point for this codebase.

## Alternatives considered

- **Keep GSD with looser enforcement** — rejected because the core problem was the behavioral-compliance model, not the strictness level.
- **No structured workflow** — rejected because AI agents without a planning step produce inconsistent output at module scale.

## References

- `docs/workflow/SUPERPOWERS_FLOW.md`
- `CLAUDE.md` §"Development Workflow" (superpowers entry points table)
- Commit `5eda5ae6` — "docs(claude): replace GSD enforcement with superpowers workflow"
- Commit `6f278715` — "docs(workflow): add superpowers-based dev workflow doc"
- Commit `bd521cfe` — "chore(planning): drop GSD branch-template keys"
