/**
 * Audit Service Interface
 * Provides a thin abstraction layer for module integration.
 * Depends on an injected AuditRepo — no direct handler imports.
 */

/**
 * Repo contract the audit service delegates to.
 * Implemented by AuditRepository in handlers/audit/repos/.
 */
export interface AuditRepo {
  logEvent(request: CreateAuditLogRequest, createdBy?: string): Promise<AuditLogEntry>;
  verifyIntegrity(entries?: AuditLogEntry[]): Promise<{
    verifiedCount: number;
    compromisedEntries: string[];
    totalChecked: number;
  }>;
  archiveOldLogs(archiveAfterDays?: number): Promise<number>;
  purgeArchivedLogs(daysOld?: number): Promise<number>;
  getAuditStatistics(): Promise<{
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    pendingPurge: number;
    lastVerification?: Date;
    integrityStatus: 'healthy' | 'compromised' | 'unknown';
  }>;
}

/** Minimal shape for audit log entries flowing through the service. */
export interface AuditLogEntry {
  id: string;
  eventType: string;
  category: string;
  action: string;
  outcome: string;
  organizationId: string;
  resourceType: string;
  resource: string;
  description: string;
  createdAt: Date;
  [key: string]: unknown;
}

/** Request payload for creating an audit log entry. */
export interface CreateAuditLogRequest {
  eventType: 'authentication' | 'data-access' | 'data-modification' | 'data-deletion' | 'system-config' | 'security' | 'compliance';
  eventSubType?: string;
  category: 'hipaa' | 'security' | 'privacy' | 'administrative' | 'clinical' | 'financial' | 'association';
  action: 'create' | 'read' | 'update' | 'delete' | 'login' | 'logout' | 'approve' | 'deny' | 'renew' | 'terminate' | 'reinstate' | 'mark-paid' | 'complete' | 'transfer' | 'delete-request' | 'delete-cancel' | 'anonymize' | 'export' | 'resign' | 'deceased' | 'suspend' | 'unsuspend' | 'capture' | 'finalize';
  outcome: 'success' | 'failure' | 'partial' | 'denied';
  organizationId?: string;
  user?: string;
  userType?: 'client' | 'host' | 'admin' | 'system';
  resourceType: string;
  resource: string;
  description: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  session?: string;
  request?: string;
}

/**
 * Minimal audit service interface
 * Exposes only the essential features needed by other modules
 */
export interface AuditService {
  logEvent(request: CreateAuditLogRequest, createdBy?: string): Promise<AuditLogEntry>;
  verifyIntegrity(entries?: AuditLogEntry[]): Promise<{
    verifiedCount: number;
    compromisedEntries: string[];
    totalChecked: number;
  }>;
  archiveOldLogs(archiveAfterDays?: number): Promise<number>;
  markForPurging(): Promise<number>;
  getAuditStatistics(): Promise<{
    totalEntries: number;
    activeEntries: number;
    archivedEntries: number;
    pendingPurge: number;
    lastVerification?: Date;
    integrityStatus: 'healthy' | 'compromised' | 'unknown';
  }>;
}

/**
 * AuditService implementation — delegates to injected AuditRepo
 */
class AuditServiceImpl implements AuditService {
  constructor(private repo: AuditRepo) {
    this.logEvent = this.repo.logEvent.bind(this.repo);
    this.verifyIntegrity = this.repo.verifyIntegrity.bind(this.repo);
    this.archiveOldLogs = this.repo.archiveOldLogs.bind(this.repo);
    this.markForPurging = this.repo.purgeArchivedLogs.bind(this.repo);
    this.getAuditStatistics = this.repo.getAuditStatistics.bind(this.repo);
  }

  logEvent: AuditService['logEvent'];
  verifyIntegrity: AuditService['verifyIntegrity'];
  archiveOldLogs: AuditService['archiveOldLogs'];
  markForPurging: AuditService['markForPurging'];
  getAuditStatistics: AuditService['getAuditStatistics'];
}

/**
 * Create an audit service instance from an injected repo
 */
export function createAuditService(repo: AuditRepo): AuditService {
  return new AuditServiceImpl(repo);
}