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
