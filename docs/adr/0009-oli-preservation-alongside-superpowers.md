# ADR-0009: OLI preservation alongside superpowers

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

OLI (Open Layer Intelligence, or the oli-engine codebase-mapping tool) provides structural analysis of the monorepo: module boundaries, dead references, interaction maps, and structure audits. It is a separate concern from the development workflow (superpowers, ADR-0008).

When GSD was replaced by superpowers (Wave 1), there was a risk that OLI infrastructure would be inadvertently removed or neglected as part of the cleanup. OLI provides value that superpowers skills do not duplicate:
- Codebase-map generation (`scripts/codebase-map/`, `.oli/`) produces machine-readable module ownership maps used by CI and audit scripts.
- The OLI engine at `~/Desktop/oli-engine/` runs `query interactions` to find cross-module dependencies and dead code.
- OLI's confidence scoring (MEDIUM/HIGH thresholds) gates structural audits separately from test coverage.

The decision was to explicitly preserve OLI as a parallel infrastructure layer, documented in `SUPERPOWERS_FLOW.md` under its own section, and referenced in CLAUDE.md memory notes.

Source: `docs/workflow/SUPERPOWERS_FLOW.md` §"OLI", CLAUDE.md (memory), `.oli/config.json`, commit `6e1c0356`.

## Decision

OLI infrastructure (`scripts/codebase-map/`, `.oli/config.json`, the engine at `~/Desktop/oli-engine/`) is preserved and maintained independently of the development workflow layer. Use OLI for codebase mapping, structure audits, and cross-module interaction analysis. OLI is not a workflow enforcer; it is an analysis tool invoked on demand or in CI.

## Consequences

### Positive
- Codebase map stays current as modules are added or renamed — OLI regeneration is a single script invocation.
- Dead-code detection (zero-reference handlers) is systematic rather than manual.
- Module boundary violations are detectable programmatically.

### Negative / tradeoffs
- OLI engine lives outside the monorepo (`~/Desktop/oli-engine/`) — it is not a versioned monorepo dependency. If the engine is not rebuilt after a version update, map output may be stale or use regex-fallback mode (noted in CLAUDE.md memory: "clears regex-fallback trust degrade").
- `.oli/config.json` must be updated when new handler directories or route table paths are added.

### Neutral
- OLI output lands in `docs/audits/codebase-map/` (per `.oli/config.json` `out_dir`).
- OLI excludes generated files, test files, and `node_modules` from its analysis (per `exclude_patterns`).

## Alternatives considered

- **Remove OLI with GSD cleanup** — rejected because OLI provides structural analysis capabilities (dead-code detection, module boundary mapping) that superpowers skills do not replicate.
- **Replace OLI with a custom audit script** — rejected because OLI's interaction-graph engine is more sophisticated than a regex-based grep script, and a custom replacement would require significant investment.

## References

- `docs/workflow/SUPERPOWERS_FLOW.md` §"OLI"
- `.oli/config.json` — module roots, confidence thresholds, output directory
- `scripts/codebase-map/` — regeneration scripts
- CLAUDE.md memory: `[oli-engine-bootstrap]` — how to run the engine
- CLAUDE.md memory: `[interactions-verb-migration]` — engine `query interactions` verb
- Commit `6e1c0356` — "chore(oli): regenerate codebase map + wrapper script"
