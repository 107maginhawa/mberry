import { PositionRepository } from '@/handlers/association:member/repos/governance.repo';
import type { NewPosition } from '@/handlers/association:member/repos/governance.schema';

export interface ElectionPositionSlot {
  id: string;
  title: string;
  sortOrder: number;
}

/**
 * AHA FIX-002 (G2) — canonical position identity (Step 29 decision: honor the
 * `position` FK).
 *
 * Election position "slots" stored in `election.positions` (jsonb) MUST carry the
 * real `position` row id, because `election_nominee.position_id` /
 * `election_vote.position_id` are foreign keys to the canonical `position` table.
 * Minting a random UUID for the slot id (the old behaviour) guaranteed an FK
 * violation the moment anyone nominated or voted against that slot.
 *
 * This resolver maps each requested position title to an existing org position
 * (case-insensitive) or creates one, then returns slots keyed by the real id so
 * every downstream nominee/vote insert satisfies the FK.
 */
export async function resolveElectionPositionSlots(
  repo: PositionRepository,
  organizationId: string,
  titles: string[],
): Promise<ElectionPositionSlot[]> {
  if (titles.length === 0) return [];

  const existing = await repo.findByOrg(organizationId);
  const byTitle = new Map(existing.map((p) => [(p.title ?? '').trim().toLowerCase(), p]));

  const slots: ElectionPositionSlot[] = [];
  for (let i = 0; i < titles.length; i++) {
    const rawTitle = (titles[i] ?? '').trim();
    if (!rawTitle) continue;
    const key = rawTitle.toLowerCase();

    let position = byTitle.get(key);
    if (!position) {
      position = await repo.create({
        organizationId,
        title: rawTitle,
        level: 'national',
        termLengthMonths: 12,
        sortOrder: i,
      } as NewPosition);
      byTitle.set(key, position);
    }

    slots.push({ id: position.id, title: position.title, sortOrder: i });
  }
  return slots;
}
