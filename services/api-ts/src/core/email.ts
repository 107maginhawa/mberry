/**
 * Email Service Interface
 * Provides a thin abstraction layer over email functionality for module integration
 * This service is injected into the app context for use by other modules
 */

import type { Logger } from '@/types/logger';
import type { Config } from '@/core/config';
import type {
  QueueEmailRequest,
  SendEmailRequest,
  EmailSendResult,
  TemplatePreviewResult,
  EmailQueueEntry,
  EmailTemplateEntry,
  EmailConfig,
} from '@/core/email-types';
import { BusinessLogicError } from '@/core/errors';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import postmark from 'postmark';
import * as OneSignal from '@onesignal/node-onesignal';

// Re-export EmailConfig from canonical location for backward compatibility
export type { EmailConfig } from '@/core/email-types';

/**
 * Email provider interface
 */
interface EmailProvider {
  send(request: SendEmailRequest): Promise<EmailSendResult>;
}

/**
 * SMTP provider implementation
 */
class SMTPProvider implements EmailProvider {
  private transporter: Transporter | null = null;
  private config: EmailConfig['smtp'];

  constructor(config: EmailConfig['smtp']) {
    this.config = config;
  }
  
  /**
   * Lazy initialization of SMTP transporter - only creates instance when first needed
   */
  private ensureInitialized(): Transporter {
    if (this.transporter) {
      return this.transporter;
    }
    
    if (!this.config) {
      throw new Error(
        'SMTP configuration is required for email operations. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables.'
      );
    }
    
    // Only configure SMTP AUTH when both user and pass are non-empty.
    // Local dev (mailpit / MailHog / docker-compose) accepts unauthenticated
    // sends; nodemailer offers SMTP AUTH PLAIN whenever `auth` is present,
    // and PLAIN with empty creds is rejected ("Missing credentials for
    // PLAIN") — silently failing every reset / verify email in tests.
    const hasCreds =
      this.config.auth.user.length > 0 && this.config.auth.pass.length > 0;
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      ...(hasCreds
        ? {
            auth: {
              user: this.config.auth.user,
              pass: this.config.auth.pass,
            },
          }
        : {}),
    });

    return this.transporter;
  }
  
  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    try {
      const transporter = this.ensureInitialized();
      const result = await transporter.sendMail({
        from: request.from ? { 
          name: request.from.name || '', 
          address: request.from.email || '' 
        } : undefined,
        to: request.to,
        subject: request.subject,
        html: request.html,
        text: request.text,
        replyTo: request.replyTo?.email
      });
      
      return {
        success: true,
        messageId: result?.messageId || 'unknown',
        provider: 'smtp'
      };
    } catch (error) {
      return {
        success: false,
        provider: 'smtp',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Postmark provider implementation
 */
class PostmarkProvider implements EmailProvider {
  private client: postmark.ServerClient | null = null;
  private config: EmailConfig;

  constructor(config: EmailConfig) {
    this.config = config;
  }
  
  /**
   * Lazy initialization of Postmark client - only creates instance when first needed
   */
  private ensureInitialized(): postmark.ServerClient {
    if (this.client) {
      return this.client;
    }
    
    if (!this.config.postmark) {
      throw new Error(
        'Postmark configuration is required for email operations. Please set POSTMARK_API_KEY environment variable.'
      );
    }
    
    this.client = new postmark.ServerClient(this.config.postmark.apiKey);
    
    return this.client;
  }
  
  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    try {
      const client = this.ensureInitialized();
      const fromEmail = request.from?.email || this.config.from.email;
      const fromName = request.from?.name || this.config.from.name;
      const messageStream = this.config.postmark?.messageStream || 'outbound';
      
      const result = await client.sendEmail({
        From: `${fromName} <${fromEmail}>`,
        To: request.to,
        Subject: request.subject,
        HtmlBody: request.html,
        TextBody: request.text,
        ReplyTo: request.replyTo?.email || undefined,
        MessageStream: messageStream
      });
      
      return {
        success: true,
        messageId: result.MessageID,
        provider: 'postmark'
      };
    } catch (error) {
      return {
        success: false,
        provider: 'postmark',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * OneSignal provider implementation
 */
class OneSignalProvider implements EmailProvider {
  private client: OneSignal.DefaultApi | null = null;
  private config: EmailConfig;
  
  constructor(config: EmailConfig) {
    this.config = config;
  }
  
  /**
   * Lazy initialization of OneSignal client - only creates instance when first needed
   */
  private ensureInitialized(): OneSignal.DefaultApi {
    if (this.client) {
      return this.client;
    }
    
    if (!this.config.onesignal) {
      throw new Error(
        'OneSignal configuration is required for email operations. Please set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY environment variables.'
      );
    }
    
    const configuration = OneSignal.createConfiguration({
      restApiKey: this.config.onesignal.apiKey,
    });
    
    this.client = new OneSignal.DefaultApi(configuration);
    
    return this.client;
  }
  
  async send(request: SendEmailRequest): Promise<EmailSendResult> {
    try {
      const client = this.ensureInitialized();
      const notification = new OneSignal.Notification();
      
      notification.app_id = this.config.onesignal!.appId;
      notification.include_email_tokens = [request.to];
      notification.email_subject = request.subject;
      notification.email_body = request.html;
      notification.include_unsubscribed = true; // Required for transactional emails
      
      // Set from email if provided
      if (request.from) {
        notification.email_from_name = request.from.name;
        notification.email_from_address = request.from.email;
      }
      
      const result = await client.createNotification(notification);
      
      return {
        success: true,
        messageId: result.id || 'unknown',
        provider: 'onesignal'
      };
    } catch (error) {
      return {
        success: false,
        provider: 'onesignal',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}


// ─── Repo contracts (implemented by handler repos, injected at construction) ──

/**
 * Template repo contract — subset used by the email service.
 */
export interface EmailTemplateRepo {
  previewTemplate(templateId: string, variables?: Record<string, any>): Promise<TemplatePreviewResult>;
  renderTemplate(templateId: string, variables: Record<string, any>): Promise<TemplatePreviewResult>;
  findMany(filters?: Record<string, unknown>): Promise<EmailTemplateEntry[]>;
}

/**
 * Queue repo contract — subset used by the email service.
 */
export interface EmailQueueRepo {
  queueEmail(request: QueueEmailRequest): Promise<EmailQueueEntry>;
  getPendingEmails(limit: number): Promise<EmailQueueEntry[]>;
  markAsProcessing(id: string): Promise<unknown>;
  markAsSent(id: string, provider: string, messageId: string): Promise<unknown>;
  markAsFailed(id: string, error: string, attempts: number): Promise<unknown>;
  updateOneById(id: string, data: Record<string, unknown>): Promise<unknown>;
}

/**
 * Suppression reasons recognised by the send pipeline.
 * Mirrors `suppression_reason` pgEnum (suppression.schema.ts).
 */
export type EmailSuppressionReason = 'hard_bounce' | 'unsubscribe' | 'complaint' | 'manual';

/**
 * Suppression reasons that block delivery even for transactional mail.
 * `unsubscribe` is intentionally NOT here — transactional mail (dues invoices,
 * receipts, security notices) overrides a marketing unsubscribe (BR-57). A
 * `manual` admin suppression is treated as hard (an admin deliberately blocked
 * the address) and is never overridden.
 */
const TRANSACTIONAL_HARD_SUPPRESSION_REASONS: readonly EmailSuppressionReason[] = [
  'hard_bounce',
  'complaint',
  'manual',
];

/**
 * Suppression repo contract — subset used by the email service.
 */
export interface EmailSuppressionRepo {
  isSuppressed(email: string, organizationId: string): Promise<boolean>;
  /**
   * Reason-aware lookup (BR-57): returns the suppression reason or null.
   * Optional for back-compat with stubs/impls that predate BR-57; when absent
   * the guard falls back to the boolean `isSuppressed` (all reasons block).
   */
  getSuppressionReason?(email: string, organizationId: string): Promise<EmailSuppressionReason | null>;
}

/**
 * Membership lookup contract — checks member status for send-time guards.
 */
export interface EmailMembershipLookup {
  findByPersonAndOrg(personId: string, organizationId: string): Promise<{ status: string } | null>;
}

/**
 * Bulk rate limiter contract.
 */
export interface EmailBulkRateLimiter {
  canSend(orgId: string): boolean;
}

/**
 * Dependencies injected into createEmailService.
 */
export interface EmailServiceDeps {
  templateRepo: EmailTemplateRepo;
  queueRepo: EmailQueueRepo;
  suppressionRepo: EmailSuppressionRepo;
  membershipLookup: EmailMembershipLookup;
  bulkRateLimiter: EmailBulkRateLimiter;
  generateUnsubToken: (email: string, orgId: string) => string;
  initializeTemplates: (...args: any[]) => Promise<void>;
}

/**
 * Email service interface
 */
export interface EmailService {
  /**
   * Initialize default email templates
   */
  initializeDefaultTemplates(): Promise<void>;

  /**
   * Queue an email for sending (modern templateId-based)
   */
  queueEmail(request: QueueEmailRequest): Promise<EmailQueueEntry>;
  
  /**
   * Send an email immediately (used by job processor)
   */
  sendEmail(request: SendEmailRequest): Promise<EmailSendResult>;
  
  /**
   * Preview a template with variables
   */
  previewTemplate(templateId: string, variables?: Record<string, any>): Promise<TemplatePreviewResult>;
  
  /**
   * Render a template (used by job processor)
   */
  renderTemplate(templateId: string, variables: Record<string, any>): Promise<TemplatePreviewResult>;
  
  /**
   * Process pending emails (called by job)
   */
  processPendingEmails(): Promise<void>;
  
}

/**
 * EmailService implementation
 */
/** Membership statuses that block email delivery at send time */
const BLOCKED_MEMBERSHIP_STATUSES = ['deceased', 'resigned', 'expelled', 'lapsed'] as const;

class EmailServiceImpl implements EmailService {
  private templateRepo: EmailTemplateRepo;
  private queueRepo: EmailQueueRepo;
  private suppressionRepo: EmailSuppressionRepo;
  private membershipLookup: EmailMembershipLookup;
  private bulkRateLimiter: EmailBulkRateLimiter;
  private _generateUnsubToken: (email: string, orgId: string) => string;
  private _initializeTemplates: (...args: any[]) => Promise<void>;
  private provider: EmailProvider | null = null;
  private config: Config['email'];
  private fullConfig: Config;
  private db: unknown;
  private logger: Logger;

  constructor(
    config: Config,
    logger: Logger,
    db: unknown,
    deps: EmailServiceDeps,
  ) {
    this.db = db;
    this.logger = logger;
    this.templateRepo = deps.templateRepo;
    this.queueRepo = deps.queueRepo;
    this.suppressionRepo = deps.suppressionRepo;
    this.membershipLookup = deps.membershipLookup;
    this.bulkRateLimiter = deps.bulkRateLimiter;
    this._generateUnsubToken = deps.generateUnsubToken;
    this._initializeTemplates = deps.initializeTemplates;
    this.config = config.email;
    this.fullConfig = config;

    // Bind methods to maintain context
    this.initializeDefaultTemplates = this.initializeDefaultTemplates.bind(this);
    this.queueEmail = this.queueEmail.bind(this);
    this.sendEmail = this.sendEmail.bind(this);
    this.previewTemplate = this.previewTemplate.bind(this);
    this.renderTemplate = this.renderTemplate.bind(this);
    this.processPendingEmails = this.processPendingEmails.bind(this);
  }
  
  /**
   * Initialize default email templates
   */
  async initializeDefaultTemplates(): Promise<void> {
    await this._initializeTemplates(this.db, this.logger);
  }
  
  /**
   * Lazy initialization of email provider - only creates instance when first needed
   */
  private ensureProviderInitialized(): EmailProvider {
    if (this.provider) {
      return this.provider;
    }
    
    // Initialize provider based on configuration
    if (this.config.provider === 'postmark') {
      this.provider = new PostmarkProvider(this.config);
    } else if (this.config.provider === 'onesignal') {
      this.provider = new OneSignalProvider(this.config);
    } else {
      this.provider = new SMTPProvider(this.config.smtp);
    }
    
    return this.provider;
  }
  
  
  /**
   * Send an email immediately
   * Injects RFC 8058 List-Unsubscribe and List-Unsubscribe-Post headers on
   * every outbound email (T-25-06). Token is HMAC-signed — no plaintext PII
   * in the URL beyond the orgId.
   */
  async sendEmail(request: SendEmailRequest): Promise<EmailSendResult> {
    const provider = this.ensureProviderInitialized();

    // Add default from if not provided
    if (!request.from) {
      request.from = {
        name: this.config.from.name,
        email: this.config.from.email
      };
    }

    // Inject unsubscribe headers (RFC 8058 one-click unsubscribe)
    const ctx = request.unsubscribeContext;
    if (ctx) {
      const token = this._generateUnsubToken(ctx.email, ctx.orgId);
      const appUrl = ((this.fullConfig as unknown as Record<string, unknown>)?.['app'] as Record<string, unknown>)?.['url'] as string ?? 'https://example.com';
      // Param MUST be `orgId` — the unsubscribe handler reads c.req.query('orgId')
      // (handlers/email/unsubscribeEmail.ts); `&org=` 400s the one-click link.
      const unsubUrl = `${appUrl}/email/unsubscribe?token=${encodeURIComponent(token)}&email=${encodeURIComponent(ctx.email)}&orgId=${encodeURIComponent(ctx.orgId)}`;
      request.headers = {
        ...(request.headers ?? {}),
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      };
    }

    return provider.send(request);
  }
  
  /**
   * Queue an email for sending with template tags
   */
  async queueEmail(request: QueueEmailRequest): Promise<EmailQueueEntry> {
    // Validate that template tags are provided
    if (!request.templateTags || request.templateTags.length === 0) {
      throw new Error('Template tags are required');
    }

    // FIX-008 (BR-53): reject at enqueue time if no ACTIVE template matches the
    // requested tags. Previously this was deferred to processing, turning a
    // caller error into a silent failed queue item.
    const template = await this.resolveTemplateByTags(request.templateTags);
    if (!template) {
      throw new BusinessLogicError(
        `No active email template found for tags: ${request.templateTags.join(', ')}`,
        'TEMPLATE_INACTIVE',
      );
    }

    // FIX-008 (BR-58): reject at enqueue time if any required template variable
    // is missing, preventing later render failures. A variable with a default
    // value is not required; an empty string counts as missing.
    const provided = request.variables ?? {};
    const missing = (template.variables ?? [])
      .filter(v => v.required && v.defaultValue === undefined)
      .map(v => v.id)
      .filter(id => {
        const value = provided[id];
        return value === undefined || value === null || value === '';
      });
    if (missing.length > 0) {
      throw new BusinessLogicError(
        `Missing required template variables: ${missing.join(', ')}`,
        'MISSING_REQUIRED_VARIABLES',
      );
    }

    // Queue the email - final rendering happens during processing
    return this.queueRepo.queueEmail(request);
  }
  
  /**
   * Preview a template with variables
   */
  async previewTemplate(templateId: string, variables?: Record<string, any>): Promise<TemplatePreviewResult> {
    return this.templateRepo.previewTemplate(templateId, variables);
  }
  
  /**
   * Render a template with variables
   */
  async renderTemplate(templateId: string, variables: Record<string, any>): Promise<TemplatePreviewResult> {
    return this.templateRepo.renderTemplate(templateId, variables);
  }
  
  /**
   * Process pending emails from the queue
   */
  async processPendingEmails(): Promise<void> {
    const pendingEmails = await this.queueRepo.getPendingEmails(50);
    
    for (const email of pendingEmails) {
      await this.processEmail(email);
    }
  }
  
  /**
   * Process a single email through the guard pipeline then send.
   *
   * Guard execution order:
   *   1. Suppression check   — skip suppressed recipients (mark failed)
   *   2. Membership status   — skip deceased/resigned/expelled (mark failed)
   *   3. Bulk rate limit     — defer bulk emails that exceed org rate (reschedule)
   *
   * Guards fire BEFORE template resolution to avoid unnecessary DB work.
   * Every guard skip is logged for audit trail (T-25-04).
   */
  private async processEmail(email: EmailQueueEntry): Promise<void> {
    try {
      // Mark as processing
      await this.queueRepo.markAsProcessing(email.id);

      // -----------------------------------------------------------------------
      // Guard 1: Suppression check (reason-aware — BR-57)
      //
      // Transactional mail overrides a marketing `unsubscribe` suppression so an
      // unsubscribed member still receives dues invoices, receipts, and security
      // notices. It is NEVER allowed past a deliverability/CAN-SPAM suppression
      // (`hard_bounce`/`complaint`) or a deliberate admin `manual` block. Bulk
      // mail is blocked by any suppression reason.
      // -----------------------------------------------------------------------
      const suppression = await this.getSuppressionStatus(email.recipientEmail, email.organizationId);
      if (suppression.suppressed) {
        const isTransactional = email.emailCategory === 'transactional';
        const overridable =
          suppression.reason !== null &&
          !(TRANSACTIONAL_HARD_SUPPRESSION_REASONS as readonly string[]).includes(suppression.reason);

        if (!(isTransactional && overridable)) {
          await this.queueRepo.markAsFailed(email.id, 'Recipient is suppressed', email.attempts);
          this.logger?.info(
            { emailId: email.id, recipient: email.recipientEmail, reason: suppression.reason },
            'Email skipped: recipient suppressed',
          );
          return;
        }

        this.logger?.info(
          { emailId: email.id, reason: suppression.reason },
          'Transactional email overriding marketing suppression (BR-57)',
        );
      }

      // -----------------------------------------------------------------------
      // Guard 2: Deceased / departed membership check
      // Checked at send time (not queue time) per business rule decision.
      // Only applies when recipientPersonId is provided in metadata.
      // -----------------------------------------------------------------------
      const recipientPersonId = (email.metadata as Record<string, any> | null)?.['recipientPersonId'] as string | undefined;
      if (recipientPersonId) {
        const membership = await this.membershipLookup.findByPersonAndOrg(recipientPersonId, email.organizationId);
        if (membership && (BLOCKED_MEMBERSHIP_STATUSES as readonly string[]).includes(membership.status)) {
          await this.queueRepo.markAsFailed(
            email.id,
            `Recipient membership is ${membership.status}`,
            email.attempts,
          );
          this.logger?.info(
            { emailId: email.id, status: membership.status },
            'Email skipped: recipient inactive membership',
          );
          return;
        }
      }

      // -----------------------------------------------------------------------
      // Guard 3: Bulk rate limit
      // Transactional emails bypass. Bulk emails that exceed the org limit are
      // rescheduled (not failed) so they can be retried later (T-25-05).
      // -----------------------------------------------------------------------
      if (email.emailCategory === 'bulk') {
        if (!this.bulkRateLimiter.canSend(email.organizationId)) {
          // Reschedule 60 seconds forward; reset status to pending
          await this.queueRepo.updateOneById(email.id, {
            scheduledAt: new Date(Date.now() + 60_000),
            status: 'pending',
          });
          this.logger?.info(
            { emailId: email.id, orgId: email.organizationId },
            'Bulk email deferred: rate limit exceeded',
          );
          return;
        }
      }

      // -----------------------------------------------------------------------
      // All guards passed — resolve template and send
      // -----------------------------------------------------------------------

      // Resolve template by tags
      const template = await this.resolveTemplateByTags(email.templateTags || []);
      if (!template) {
        throw new Error(`No active template found for tags: ${email.templateTags?.join(', ') || 'none'}`);
      }

      // Render template with variables
      const rendered = await this.templateRepo.renderTemplate(
        template.id,
        email.variables
      );

      // Send email (unsubscribe headers injected inside sendEmail)
      const result = await this.sendEmail({
        to: email.recipientEmail,
        subject: rendered.subject,
        html: rendered.bodyHtml,
        text: rendered.bodyText,
        from: template?.fromEmail ? {
          name: template.fromName || this.config.from.name,
          email: template.fromEmail
        } : undefined,
        replyTo: template?.replyToEmail ? {
          email: template.replyToEmail,
          name: template.replyToName || undefined
        } : undefined,
        unsubscribeContext: {
          email: email.recipientEmail,
          orgId: email.organizationId,
        },
      });

      if (result.success) {
        // Mark as sent
        await this.queueRepo.markAsSent(
          email.id,
          result.provider,
          result.messageId!
        );
      } else {
        // Mark as failed
        await this.queueRepo.markAsFailed(
          email.id,
          result.error || 'Unknown error',
          email.attempts
        );
      }
    } catch (error) {
      this.logger?.error({ error, emailId: email.id }, 'Failed to process email');
      // Mark as failed
      await this.queueRepo.markAsFailed(
        email.id,
        error instanceof Error ? error.message : 'Unknown error',
        email.attempts
      );
    }
  }
  
  
  /**
   * Reason-aware suppression status for Guard 1 (BR-57).
   * Prefers the reason-returning lookup; falls back to the boolean `isSuppressed`
   * for suppression repos that don't yet implement `getSuppressionReason`
   * (reason then unknown — treated as a hard block, preserving prior behaviour).
   */
  private async getSuppressionStatus(
    email: string,
    organizationId: string,
  ): Promise<{ suppressed: boolean; reason: string | null }> {
    if (typeof this.suppressionRepo.getSuppressionReason === 'function') {
      const reason = await this.suppressionRepo.getSuppressionReason(email, organizationId);
      return { suppressed: reason !== null, reason };
    }
    const suppressed = await this.suppressionRepo.isSuppressed(email, organizationId);
    return { suppressed, reason: null };
  }

  /**
   * Resolve template by tags
   */
  private async resolveTemplateByTags(tags: string[]): Promise<EmailTemplateEntry | null> {
    // Find template by checking if any of the tags match
    const templates = await this.templateRepo.findMany({
      status: 'active'
    });
    
    // Find template where its tags array contains any of the provided tags
    const template = templates.find(t =>
      t.tags && t.tags.some(tag => tags.includes(tag))
    );
    
    return template || null;
  }
}

/**
 * Create an email service instance
 * Factory function following the pattern of other services
 */
export function createEmailService(
  config: Config,
  logger: Logger,
  db: unknown,
  deps: EmailServiceDeps,
): EmailService {
  return new EmailServiceImpl(config, logger, db, deps);
}