/**
 * Email type definitions shared between core services and handler modules.
 * Canonical home for types that core/email.ts and core/auth.ts need —
 * handler schemas re-export these for backward compatibility.
 */

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
