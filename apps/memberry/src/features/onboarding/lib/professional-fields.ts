import * as z from 'zod';

/**
 * Professional fields validation for healthcare association members.
 * All fields optional — not all users are licensed professionals.
 */

export const professionalFieldsSchema = z.object({
  licenseNumber: z.string().max(50, 'License number must be less than 50 characters').optional().or(z.literal('')),
  specialization: z.string().max(100, 'Specialization must be less than 100 characters').optional().or(z.literal('')),
  prcId: z.string().max(50, 'PRC ID must be less than 50 characters').optional().or(z.literal('')),
});

export type ProfessionalFields = z.infer<typeof professionalFieldsSchema>;

export function validateLicenseNumber(value: string | undefined): boolean {
  if (!value || value === '') return true;
  return value.length <= 50;
}

export function validatePrcId(value: string | undefined): boolean {
  if (!value || value === '') return true;
  return value.length <= 50;
}

export function normalizeLicenseNumber(value: string): string {
  return value.trim().replace(/[\s-]/g, '');
}
