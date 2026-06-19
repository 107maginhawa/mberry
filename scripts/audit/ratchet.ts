export interface GateCounts {
  a: number
  b: number
  c: number
}

export interface RatchetResult {
  pass: boolean
  regressions: string[]
  improvements: string[]
}

export interface BRGateRow {
  verdict: string
  phase: number
  deferred: boolean
}

/**
 * Matrix-A gate count: phase-1 BRs that are not COMPLETE and not explicitly
 * deferred. A BR with a `deferredReason` in the registry is a known, reviewed
 * gap (e.g. a rule whose handler isn't built yet) — it should not register as a
 * phase-1 blocker. Reversible: drop the deferredReason when the work lands.
 */
export function countUndeferredPhase1Gaps(rows: BRGateRow[]): number {
  return rows.filter((r) => r.verdict !== 'COMPLETE' && r.phase === 1 && !r.deferred).length
}

const AXES = ['a', 'b', 'c'] as const

/** Compare current gap counts against a committed baseline. Grow = fail; shrink = ratchet-down signal. */
export function ratchetCheck(current: GateCounts, baseline: GateCounts): RatchetResult {
  const regressions: string[] = []
  const improvements: string[] = []
  for (const k of AXES) {
    if (current[k] > baseline[k]) regressions.push(`${k}: ${baseline[k]} → ${current[k]}`)
    else if (current[k] < baseline[k]) improvements.push(`${k}: ${baseline[k]} → ${current[k]}`)
  }
  return { pass: regressions.length === 0, regressions, improvements }
}
