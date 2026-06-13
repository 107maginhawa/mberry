/**
 * Email type definitions shared between core services and handler modules.
 * Canonical home for types that core/email.ts and core/auth.ts need —
 * handler schemas re-export these for backward compatibility.
 */

/**
 * Sentinel UUID used as the `organizationId` for platform-system emails
 * that originate outside any organization context — primarily
 * better-auth signup verification and password reset, which run before
 * the user has joined an org.
 *
 * `email_queue.organization_id` is `uuid NOT NULL` to enforce
 * multi-tenant scoping for real org traffic; this constant lets system
 * emails coexist with that invariant without making the column
 * nullable (which would force every downstream guard — suppression
 * lookup, membership lookup, bulk rate limiter — to handle null).
 * The same sentinel is already used by the template seeder
 * (handlers/email/templates/initializer.ts) for system templates,
 * so org-scoped queries naturally pair platform queue rows with
 * platform templates.
 *
 * NEVER reference this value from org-scoped code paths — it is not
 * a real organization and will not appear in `organization` rows.
 */
export const SYSTEM_ORG_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Email template tags for identifying templates
 */
export enum EmailTemplateTags {
  // Auth templates
  AUTH_EMAIL_VERIFY = 'auth.email-verify',
  AUTH_PASSWORD_RESET = 'auth.password-reset',
  AUTH_2FA = 'auth.2fa',
  AUTH_WELCOME = 'auth.welcome',
  AUTH_MAGIC_LINK = 'auth.magic-link',
  // Platform admin (M03) — FIX-003 (G4): invite a platform admin to claim access
  ADMIN_INVITE = 'admin.invite',
}

/**
 * Queue email request interface
 */
export interface QueueEmailRequest {
  template?: string; // Direct template ID (alternative to templateTags)
  templateTags?: string[]; // Template tags for dynamic resolution (alternative to template)
  recipient: string;
  recipientName?: string;
  variables: Record<string, any>;
  metadata?: Record<string, any>;
  priority?: number;
  scheduledAt?: Date;
  organizationId?: string;
  emailCategory?: 'bulk' | 'transactional';
}

/**
 * Send email request interface (internal)
 */
export interface SendEmailRequest {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: {
    name?: string;
    email?: string;
  };
  replyTo?: {
    email?: string;
    name?: string;
  };
  /** Additional email headers (e.g. List-Unsubscribe for RFC 8058 compliance) */
  headers?: Record<string, string>;
  /** Context for generating unsubscribe token (injected by processEmail) */
  unsubscribeContext?: {
    email: string;
    orgId: string;
  };
}

/**
 * Email send result interface
 */
export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: 'smtp' | 'postmark' | 'onesignal';
  error?: string;
}

/**
 * Template preview result interface
 */
export interface TemplatePreviewResult {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
}

/**
 * Minimal email queue entry shape used by the core email service.
 * The Drizzle-inferred EmailQueueItem in handler schemas satisfies this.
 */
export interface EmailQueueEntry {
  id: string;
  recipientEmail: string;
  organizationId: string;
  templateTags: string[] | null;
  variables: Record<string, any>;
  metadata: unknown;
  emailCategory: string | null;
  attempts: number;
  status: string;
}

/**
 * Minimal email template shape used by the core email service.
 * The Drizzle-inferred EmailTemplate in handler schemas satisfies this.
 */
export interface EmailTemplateEntry {
  id: string;
  tags: string[] | null;
  fromEmail: string | null;
  fromName: string | null;
  replyToEmail: string | null;
  replyToName: string | null;
  /**
   * Template variable definitions (structural subset of the DB
   * `TemplateVariable[]`). Used for enqueue-time required-variable validation
   * (FIX-008 / BR-58). Kept structural so this lightweight types module stays
   * decoupled from the Drizzle schema.
   */
  variables?: Array<{
    id: string;
    required: boolean;
    defaultValue?: unknown;
  }> | null;
}

/**
 * Email configuration
 */
export interface EmailConfig {
  provider: 'smtp' | 'postmark' | 'onesignal';
  from: {
    name: string;
    email: string;
  };

  // SMTP configuration
  smtp?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };

  // Postmark configuration
  postmark?: {
    apiKey: string;
    messageStream?: string;
  };

  // OneSignal configuration
  onesignal?: {
    appId: string;
    apiKey: string;
  };
}
