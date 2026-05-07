/**
 * Registry coverage report — run via `bun run test:registry`
 * Prints coverage stats and lists untested P0 items.
 * Exit code 0 = info only (no enforcement yet, that's T8).
 */

import { brRegistry, getBRStats } from './br-registry'
import { flowRegistry, getFlowStats } from './flow-registry'

const br = getBRStats()
const flow = getFlowStats()

console.log('\n═══ BR Registry Coverage ═══')
console.log(`Total: ${br.total} | Covered: ${br.covered} | Partial: ${br.partial} | Untested: ${br.untested}`)
console.log(`Coverage: ${br.coveragePercent}%`)

if (br.p0Untested.length > 0) {
  console.log(`\n⚠️  P0 BRs without tests (${br.p0Untested.length}):`)
  for (const item of br.p0Untested) {
    console.log(`  ${item.id}: ${item.name} [${item.module}]`)
  }
}

console.log('\n═══ Flow Registry Coverage ═══')
console.log(`Total: ${flow.total} | Covered: ${flow.covered} | Partial: ${flow.partial} | Untested: ${flow.untested}`)
console.log(`Coverage: ${flow.coveragePercent}%`)

const untestedFlows = flowRegistry.filter(f => f.status === 'untested')
if (untestedFlows.length > 0) {
  console.log(`\nUntested flows (${untestedFlows.length}):`)
  for (const f of untestedFlows) {
    console.log(`  ${f.id}: ${f.name} [${f.modules.join(' → ')}]`)
  }
}

console.log('\n═══ Summary ═══')
console.log(`BR: ${br.coveragePercent}% | Flows: ${flow.coveragePercent}% | Combined: ${Math.round(((br.covered + flow.covered) / (br.total + flow.total)) * 100)}%`)
console.log('')
