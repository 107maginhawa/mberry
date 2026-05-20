/**
 * Pino logger configuration
 * Factory function that accepts config as parameter
 */

import pino from 'pino';
import type { Config } from '@/core/config';
import type { Logger } from '@/types/logger';

// Create logger instance with config
export function createLogger(config: Config): Logger {
  const logger = pino({
    level: config.logging.level,
    transport: config.logging.pretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss',
          },
        }
      : undefined,
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers,
      }),
      res: (res) => ({
        statusCode: res.statusCode,
      }),
      error: pino.stdSerializers.err,
    },
    base: {
      service: 'api',
    },
  });

  return logger;
}

/**
 * Mask an email address for safe logging.
 * "john.doe@example.com" → "j***@example.com"
 */
export function maskEmail(email: string | undefined | null): string {
  if (!email || typeof email !== 'string') return '[no-email]';
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return '***';
  return `${email[0]}***@${email.slice(atIndex + 1)}`;
}
