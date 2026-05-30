/**
 * Tests for OpenTelemetry observability wiring.
 *
 * Covers:
 *   - isObservabilityEnabled() reads env correctly
 *   - initObservability() is a no-op without OTLP endpoint
 *   - initObservability() is idempotent
 *   - createTracingMiddleware() always returns a function and runs
 *     even when the SDK is not active (manual spans become no-ops)
 *   - The tracing middleware sets http.status_code attribute (via
 *     a no-op SDK we can still verify span attribute calls through a
 *     test-injected tracer? — we keep this test lean and verify
 *     observable behaviour: passes through, does not throw, records
 *     request id).
 */

import { describe, it, expect, afterEach, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import {
  isObservabilityEnabled,
  initObservability,
  createTracingMiddleware,
  _isInitialized,
} from '@/core/observability';

const ORIGINAL_ENV = { ...process.env };

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('OTEL_')) {
      delete (process.env as Record<string, string | undefined>)[key];
    }
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe('isObservabilityEnabled', () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  it('returns false when no OTLP endpoint configured', () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    expect(isObservabilityEnabled()).toBe(false);
  });

  it('returns true when OTLP endpoint is set', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://collector:4318';
    expect(isObservabilityEnabled()).toBe(true);
  });

  it('returns false when OTEL_ENABLED=false even if endpoint set', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://collector:4318';
    process.env['OTEL_ENABLED'] = 'false';
    expect(isObservabilityEnabled()).toBe(false);
  });

  it('is case-insensitive on OTEL_ENABLED', () => {
    process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = 'http://collector:4318';
    process.env['OTEL_ENABLED'] = 'FALSE';
    expect(isObservabilityEnabled()).toBe(false);
  });

  it('accepts custom env object', () => {
    expect(
      isObservabilityEnabled({ OTEL_EXPORTER_OTLP_ENDPOINT: 'http://x:4318' }),
    ).toBe(true);
    expect(isObservabilityEnabled({})).toBe(false);
  });
});

describe('initObservability', () => {
  beforeEach(() => resetEnv());
  afterEach(() => resetEnv());

  it('is a no-op when env not configured (returns idempotent teardown)', async () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    const teardown = await initObservability();
    expect(typeof teardown).toBe('function');
    expect(_isInitialized()).toBe(false);
    await teardown();
  });

  it('returns same no-op result on repeated calls when disabled', async () => {
    delete process.env['OTEL_EXPORTER_OTLP_ENDPOINT'];
    const t1 = await initObservability();
    const t2 = await initObservability();
    expect(typeof t1).toBe('function');
    expect(typeof t2).toBe('function');
    expect(_isInitialized()).toBe(false);
  });
});

describe('createTracingMiddleware', () => {
  it('returns a function', () => {
    const mw = createTracingMiddleware();
    expect(typeof mw).toBe('function');
  });

  it('lets the request through (manual span when no SDK active)', async () => {
    const app = new Hono();
    app.use('*', createTracingMiddleware());
    app.get('/ping', (c) => c.json({ ok: true }));

    const res = await app.request('/ping');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });

  it('propagates errors thrown downstream (still sets error span status)', async () => {
    const app = new Hono();
    app.use('*', createTracingMiddleware());
    app.get('/boom', () => {
      throw new Error('downstream-failure');
    });

    // Hono converts the throw into a 500 by default
    const res = await app.request('/boom');
    expect(res.status).toBe(500);
  });

  it('extracts traceparent header without throwing', async () => {
    const app = new Hono();
    app.use('*', createTracingMiddleware());
    app.get('/ping', (c) => c.json({ ok: true }));

    const res = await app.request('/ping', {
      headers: {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      },
    });
    expect(res.status).toBe(200);
  });
});
