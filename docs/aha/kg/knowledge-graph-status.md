# Knowledge Graph Status — AHA Audit

Date: 2026-06-11 (prompt 01 — platform discovery)

| Item | Status | Notes |
| --- | --- | --- |
| Existing KG found | Yes | `.understand-anything/knowledge-graph.json` (3.2 MB) |
| KG tool/source | /understand-anything | 3,474 nodes, 8,259 edges, 11 layers, commit `0178b7c` |
| Generated | 2026-06-06 08:01 | 5 days before this audit |
| Appears fresh | Partially stale | Active dev Jun 6–11 (latest commit 2026-06-11). Module boundaries still valid; recent doc-restructure commits not represented. |
| Regeneration needed | Not yet | Refresh recommended before prompt 05 (cross-cutting) or if wiring questions can't be answered during prompt 02. Do not regenerate for prompt 01. |
| Missing areas | Doc restructure (commits 584ec0e9, fe9d1483, 7553767d), any Phase 47 changes after Jun 6 | |

Decision for this audit cycle: use existing KG as secondary evidence; rely on direct filesystem/code inspection as primary. Mark KG-derived claims `[NEEDS CONFIRMATION]` where recent code may have changed.
