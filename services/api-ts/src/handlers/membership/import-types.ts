/**
 * Shared types and schemas for member import.
 * Extracted to break circular dependency: importMembers ↔ csvImport.
 */

import { z } from 'zod';

// ─── Zod Validation Schema (V-08) ─────────────────────────

export const importMemberRowSchema = z.object({
  personId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  licenseNumber: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  tierId: z.string().min(1),
  categoryId: z.string().min(1).optional(),
  memberNumber: z.string().optional(),
  startDate: z.string().optional(),
  duesExpiryDate: z.string().optional(),
});

export const importMembersSchema = z.object({
  members: z.array(importMemberRowSchema).min(0),
});

export type ImportMemberRow = z.infer<typeof importMemberRowSchema>;

// ─── License Normalization (BR-23) ─────────────────────────

export function normalizeLicense(license: string): string {
  return license.toLowerCase().replace(/[\s-]/g, '').replace(/^0+/, '');
}
