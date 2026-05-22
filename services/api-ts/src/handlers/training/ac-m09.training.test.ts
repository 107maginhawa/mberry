/**
 * AC-M09: Training Module — Pure Domain Logic Tests
 *
 * Covers (AC-M09-001 is in flow-020.attendance-credit.test.ts):
 *   AC-M09-002: Certificate public verification page
 *   AC-M09-004: Training type enforcement — only 5 platform types
 *   AC-M09-005: Post-completion lock — reject enrollment and modification
 *   AC-M09-006: Network visibility default when created without explicit setting
 */
import { describe, test, expect } from 'bun:test';

// ─── Domain Types ─────────────────────────────────────────

type TrainingStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled';
type TrainingVisibility = 'internal' | 'network';
type TrainingType =
  | 'seminar'
  | 'workshop'
  | 'webinar'
  | 'conference'
  | 'self-paced';

type EnrollmentStatus = 'enrolled' | 'completed' | 'cancelled' | 'noShow';

interface Training {
  id: string;
  type: TrainingType;
  status: TrainingStatus;
  visibility: TrainingVisibility;
  creditBearing: boolean;
  creditAmount: number;
  capacity: number | null;
}

interface Enrollment {
  id: string;
  trainingId: string;
  personId: string;
  status: EnrollmentStatus;
}

interface Certificate {
  id: string;
  certificateNumber: string;
  trainingId: string;
  personId: string;
  trainingTitle: string;
  personName: string;
  creditValue: number;
  issuedAt: Date;
  hmacSignature: string;
}

interface CertificateVerification {
  valid: boolean;
  trainingTitle: string | null;
  personName: string | null;
  issuedAt: Date | null;
  creditValue: number | null;
  error: string | null;
}

// ─── Domain Constants ─────────────────────────────────────

// AC-M09-004: Only these 5 types are platform-defined (not org-customizable)
const PLATFORM_TRAINING_TYPES: TrainingType[] = [
  'seminar',
  'workshop',
  'webinar',
  'conference',
  'self-paced',
];

// ─── Domain Functions ─────────────────────────────────────

/**
 * AC-M09-002: Verify a certificate by its certificate number and HMAC signature.
 * Public endpoint — returns training/member details or an error.
 */
function verifyCertificate(
  certificateNumber: string,
  certificate: Certificate | null,
  verifyHmac: (cert: Certificate) => boolean,
): CertificateVerification {
  if (!certificate) {
    return {
      valid: false,
      trainingTitle: null,
      personName: null,
      issuedAt: null,
      creditValue: null,
      error: 'Certificate not found.',
    };
  }
  if (certificate.certificateNumber !== certificateNumber) {
    return {
      valid: false,
      trainingTitle: null,
      personName: null,
      issuedAt: null,
      creditValue: null,
      error: 'Certificate number mismatch.',
    };
  }
  if (!verifyHmac(certificate)) {
    return {
      valid: false,
      trainingTitle: null,
      personName: null,
      issuedAt: null,
      creditValue: null,
      error: 'Certificate signature invalid (tampered).',
    };
  }
  return {
    valid: true,
    trainingTitle: certificate.trainingTitle,
    personName: certificate.personName,
    issuedAt: certificate.issuedAt,
    creditValue: certificate.creditValue,
    error: null,
  };
}

/**
 * AC-M09-004: Validate that a training type is one of the 5 platform-defined types.
 */
function isValidTrainingType(type: string): type is TrainingType {
  return PLATFORM_TRAINING_TYPES.includes(type as TrainingType);
}

/**
 * AC-M09-005: Post-completion lock — completed and cancelled trainings
 * reject new enrollments and enrollment modifications.
 */
function isTrainingLocked(training: Training): boolean {
  return training.status === 'completed' || training.status === 'cancelled';
}

/**
 * AC-M09-005: Validate enrollment attempt.
 * Returns error string or null if allowed.
 */
function validateEnrollment(training: Training, personId: string): string | null {
  if (isTrainingLocked(training)) {
    return 'This training has ended. No further enrollment.';
  }
  if (training.status === 'draft') {
    return 'Training is not yet published.';
  }
  return null;
}

/**
 * AC-M09-006: Default visibility for a newly published training is 'network'.
 * Officers can override to 'internal'.
 */
function resolveTrainingVisibility(explicit: TrainingVisibility | null | undefined): TrainingVisibility {
  return explicit ?? 'network';
}

// ─── Helpers ──────────────────────────────────────────────

function makeTraining(overrides: Partial<Training> = {}): Training {
  return {
    id: 'training-1',
    type: 'seminar',
    status: 'published',
    visibility: 'network',
    creditBearing: true,
    creditAmount: 8,
    capacity: 50,
    ...overrides,
  };
}

function makeCertificate(overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: 'cert-1',
    certificateNumber: 'CERT-2025-001',
    trainingId: 'training-1',
    personId: 'person-1',
    trainingTitle: 'Advanced Dental Implants Workshop',
    personName: 'Dr. Maria Santos',
    creditValue: 8,
    issuedAt: new Date('2025-03-15'),
    hmacSignature: 'valid-sig',
    ...overrides,
  };
}

// Simple HMAC mock: signature must equal 'valid-sig'
const validHmacVerifier = (cert: Certificate) => cert.hmacSignature === 'valid-sig';
const invalidHmacVerifier = (_cert: Certificate) => false;

// ─── AC-M09-002: Certificate Verification ────────────────

describe('[AC-M09-002] Certificate public verification', () => {
  test('AC-M09-002: valid certificate scan shows training details', () => {
    // Given: a valid certificate with correct HMAC
    const cert = makeCertificate();
    // When: verified
    const result = verifyCertificate('CERT-2025-001', cert, validHmacVerifier);
    // Then: verification passes with all public details
    expect(result.valid).toBe(true);
    expect(result.trainingTitle).toBe('Advanced Dental Implants Workshop');
    expect(result.personName).toBe('Dr. Maria Santos');
    expect(result.creditValue).toBe(8);
    expect(result.issuedAt).toBeInstanceOf(Date);
    expect(result.error).toBeNull();
  });

  test('AC-M09-002: non-existent certificate number returns invalid', () => {
    // Given: no certificate found for the number
    const result = verifyCertificate('CERT-FAKE-999', null, validHmacVerifier);
    // Then: invalid with descriptive error
    expect(result.valid).toBe(false);
    expect(result.trainingTitle).toBeNull();
    expect(result.error).toContain('not found');
  });

  test('AC-M09-002: tampered certificate (invalid HMAC) is rejected', () => {
    // Given: certificate exists but signature is invalid (tampered)
    const cert = makeCertificate({ hmacSignature: 'tampered-sig' });
    // When: verified with strict HMAC verifier
    const result = verifyCertificate('CERT-2025-001', cert, invalidHmacVerifier);
    // Then: rejected as tampered
    expect(result.valid).toBe(false);
    expect(result.error).toContain('signature invalid');
  });

  test('AC-M09-002: certificate number mismatch returns invalid', () => {
    // Given: certificate exists but URL has different number
    const cert = makeCertificate({ certificateNumber: 'CERT-2025-001' });
    // When: queried with different number
    const result = verifyCertificate('CERT-2025-002', cert, validHmacVerifier);
    // Then: mismatch error
    expect(result.valid).toBe(false);
    expect(result.error).toContain('mismatch');
  });
});

// ─── AC-M09-004: Training Type Enforcement ────────────────

describe('[AC-M09-004] Training type — only 5 platform-defined types', () => {
  test('AC-M09-004: exactly 5 platform training types defined', () => {
    // Given: platform type list
    // Then: exactly 5
    expect(PLATFORM_TRAINING_TYPES).toHaveLength(5);
  });

  test('AC-M09-004: all 5 platform types are valid', () => {
    // Given: each platform type
    const types: string[] = ['seminar', 'workshop', 'webinar', 'conference', 'self-paced'];
    // Then: all valid
    for (const type of types) {
      expect(isValidTrainingType(type)).toBe(true);
    }
  });

  test('AC-M09-004: org-custom training type is rejected', () => {
    // Given: org tries to create custom type
    const customTypes = ['masterclass', 'bootcamp', 'hands-on', 'symposium'];
    // Then: all rejected
    for (const type of customTypes) {
      expect(isValidTrainingType(type)).toBe(false);
    }
  });

  test('AC-M09-004: empty string type is rejected', () => {
    expect(isValidTrainingType('')).toBe(false);
  });

  test('AC-M09-004: case-sensitive — uppercase types are rejected', () => {
    // Given: types in different case
    expect(isValidTrainingType('Seminar')).toBe(false);
    expect(isValidTrainingType('WORKSHOP')).toBe(false);
  });
});

// ─── AC-M09-005: Post-Completion Lock ────────────────────

describe('[AC-M09-005] Post-completion lock — reject enrollment and modification', () => {
  test('AC-M09-005: completed training rejects new enrollment', () => {
    // Given: completed training
    const training = makeTraining({ status: 'completed' });
    // When: enrollment attempted
    const error = validateEnrollment(training, 'person-new');
    // Then: rejected
    expect(error).not.toBeNull();
    expect(error).toContain('No further enrollment');
  });

  test('AC-M09-005: cancelled training rejects enrollment', () => {
    // Given: cancelled training
    const training = makeTraining({ status: 'cancelled' });
    // When: enrollment attempted
    const error = validateEnrollment(training, 'person-new');
    // Then: rejected
    expect(error).not.toBeNull();
    expect(error).toContain('No further enrollment');
  });

  test('AC-M09-005: published training allows enrollment', () => {
    // Given: published training
    const training = makeTraining({ status: 'published' });
    // When: enrollment attempted
    const error = validateEnrollment(training, 'person-new');
    // Then: allowed
    expect(error).toBeNull();
  });

  test('AC-M09-005: draft training rejects enrollment (not yet published)', () => {
    // Given: draft training
    const training = makeTraining({ status: 'draft' });
    // When: enrollment attempted
    const error = validateEnrollment(training, 'person-new');
    // Then: rejected with appropriate message
    expect(error).not.toBeNull();
    expect(error).toContain('not yet published');
  });

  test('AC-M09-005: isTrainingLocked returns true only for completed/cancelled', () => {
    const statuses: TrainingStatus[] = ['draft', 'published', 'active', 'completed', 'cancelled'];
    const lockedStatuses = statuses.filter((s) =>
      isTrainingLocked(makeTraining({ status: s })),
    );
    expect(lockedStatuses).toEqual(['completed', 'cancelled']);
  });
});

// ─── AC-M09-006: Network Visibility Default ──────────────

describe('[AC-M09-006] Network visibility default when not explicitly set', () => {
  test('AC-M09-006: null visibility defaults to network', () => {
    // Given: training created without explicit visibility
    const visibility = resolveTrainingVisibility(null);
    // Then: defaults to network (visible to all association members)
    expect(visibility).toBe('network');
  });

  test('AC-M09-006: undefined visibility defaults to network', () => {
    // Given: visibility field omitted
    const visibility = resolveTrainingVisibility(undefined);
    // Then: defaults to network
    expect(visibility).toBe('network');
  });

  test('AC-M09-006: explicit internal overrides the network default', () => {
    // Given: officer explicitly sets internal
    const visibility = resolveTrainingVisibility('internal');
    // Then: internal respected
    expect(visibility).toBe('internal');
  });

  test('AC-M09-006: explicit network is preserved', () => {
    // Given: officer explicitly sets network (same as default)
    const visibility = resolveTrainingVisibility('network');
    // Then: network
    expect(visibility).toBe('network');
  });

  test('AC-M09-006: published training without explicit visibility is network-accessible', () => {
    // Given: training published without setting visibility
    const training = makeTraining({ visibility: resolveTrainingVisibility(null) });
    // Then: network-visible by default
    expect(training.visibility).toBe('network');
  });
});
