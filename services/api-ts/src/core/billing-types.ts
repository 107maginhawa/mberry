/**
 * Billing type definitions shared between core/config and core/billing.
 * Extracted to break circular dependency: config → billing → logger → config.
 */

/**
 * Stripe configuration
 */
export interface StripeConfig {
  secretKey?: string;
  webhookSecret?: string;
  url?: string; // Custom Stripe API URL for testing
}

/**
 * Billing configuration
 */
export interface BillingConfig {
  provider: 'stripe';
  stripe?: StripeConfig;
}
