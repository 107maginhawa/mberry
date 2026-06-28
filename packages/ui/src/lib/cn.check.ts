/**
 * Standalone regression check for cn() — run: `bun src/lib/cn.check.ts`.
 * No test framework (packages/ui has none); just assert + main guard.
 *
 * Guards the P0: a custom font-size util (text-body) next to a color util
 * (text-primary-foreground) must NOT strip the color. If twMerge stops knowing
 * the design-system font sizes, this fails loudly.
 */
import assert from "node:assert"
import { cn } from "./utils"

function check() {
  const merged = cn("text-base text-primary-foreground", "text-body font-semibold")
  assert(
    merged.includes("text-primary-foreground"),
    `cn() dropped text-primary-foreground (button text color) — got: "${merged}"`,
  )
  assert(merged.includes("text-body"), `cn() dropped text-body — got: "${merged}"`)
  // size utils still collapse to one (text-base superseded by text-body)
  assert(!merged.includes("text-base"), `cn() kept stale text-base — got: "${merged}"`)
  console.log("cn.check OK:", merged)
}

if (import.meta.main) check()

export { check as cnCheck }
