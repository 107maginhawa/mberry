/**
 * OpenTelemetry tracing wiring (Wave G4 / S-C4-040).
 *
 * Initialization is gated on environment so dev / test runs incur zero
 * overhead and the SDK only activates when an OTLP endpoint is configured:
 *
 *   OTEL_EXPORTER_OTLP_ENDPOINT   http://collector:4318 (HTTP/protobuf)
 *   OTEL_SERVICE_NAME             memberry-api (default)
 *   OTEL_ENABLED                  optional override ("false" disables)
 *
 * The SDK is started exactly once in `initObservability()` (called from
 * `index.ts` before app construction). Auto-instrumentations register on
 * import; we additionally export a Hono middleware (`createTracingMiddleware`)
 * that produces a manual server span per request, so coverage is guaranteed
 * even where auto-instrumentation gaps exist (Bun shim differences).
 *
 * Manual spans always run (they are no-ops when no SDK is active), which
 * means trace context propagation via the standard `traceparent` header
 * works even when the SDK is disabled — useful for cross-service correlation
 * in environments where only the collector is missing.
 */

import type { MiddlewareHandler } from 'hono';
import {
  trace,
  context,
  propagation,
  SpanStatusCode,
  type Span,
} from '@opentelemetry/api';

const SERVICE_NAME_DEFAULT = 'memberry-api';

let sdkStarted = false;
let sdkInstance: { shutdown: () => Promise<void> } | null = null;

/**
 * Returns whether OTel SDK should be initialized given current env vars.
 * Exported for test visibility.
 */
export function isObservabilityEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env['OTEL_ENABLED']?.toLowerCase() === 'false') return false;
  return Boolean(env['OTEL_EXPORTER_OTLP_ENDPOINT']);
}

/**
 * Initialize OpenTelemetry SDK. Idempotent — safe to call multiple times.
 *
 * Returns a teardown function for tests / graceful shutdown.
 * No-ops when `isObservabilityEnabled()` returns false.
 */
export async function initObservability(): Promise<() => Promise<void>> {
  if (sdkStarted) return () => Promise.resolve();
  if (!isObservabilityEnabled()) return () => Promise.resolve();

  // Lazy import so the heavy SDK is only loaded when actually enabled.
  // This also keeps test boot time fast.
  const [{ NodeSDK }, { getNodeAutoInstrumentations }, { OTLPTraceExporter }, { resourceFromAttributes }] = await Promise.all([
    import('@opentelemetry/sdk-node'),
    import('@opentelemetry/auto-instrumentations-node'),
    import('@opentelemetry/exporter-trace-otlp-http'),
    import('@opentelemetry/resources'),
  ]);

  const serviceName = process.env['OTEL_SERVICE_NAME'] ?? SERVICE_NAME_DEFAULT;
  const sdk = new NodeSDK({
    serviceName,
    resource: resourceFromAttributes({
      'service.name': serviceName,
      'service.namespace': 'memberry',
      'deployment.environment': process.env['NODE_ENV'] ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${process.env['OTEL_EXPORTER_OTLP_ENDPOINT']!.replace(/\/$/, '')}/v1/traces`,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // pg + http are the high-value spans; trim the noisy ones.
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
      }),
    ],
  });

  sdk.start();
  sdkStarted = true;
  sdkInstance = sdk;

  return async () => {
    if (sdkInstance) {
      try {
        await sdkInstance.shutdown();
      } catch {
        // best-effort on shutdown
      }
      sdkInstance = null;
      sdkStarted = false;
    }
  };
}

/**
 * Hono middleware that produces a manual `http.server` span per request,
 * extracts the inbound `traceparent` context, and sets `request.id`
 * + standard HTTP attributes. Runs unconditionally — when no SDK is
 * active, the underlying spans are no-ops with negligible cost.
 */
export function createTracingMiddleware(): MiddlewareHandler {
  const tracer = trace.getTracer(SERVICE_NAME_DEFAULT);

  return async function tracingMiddleware(c, next) {
    // Extract any incoming W3C trace context (traceparent / tracestate)
    const incoming = propagation.extract(context.active(), {
      traceparent: c.req.header('traceparent'),
      tracestate: c.req.header('tracestate'),
    });

    const method = c.req.method.toUpperCase();
    const url = new URL(c.req.url);

    await tracer.startActiveSpan(
      `${method} ${url.pathname}`,
      {
        attributes: {
          'http.method': method,
          'http.route': url.pathname,
          'http.target': url.pathname + url.search,
          'http.scheme': url.protocol.replace(':', ''),
          'http.host': url.host,
          'net.host.name': url.hostname,
          'request.id': c.get('requestId') ?? undefined,
        },
      },
      incoming,
      async (span: Span) => {
        try {
          await next();
          const status = c.res.status;
          span.setAttribute('http.status_code', status);
          if (status >= 500) {
            span.setStatus({ code: SpanStatusCode.ERROR });
          }
        } catch (err) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: err instanceof Error ? err.message : String(err),
          });
          span.recordException(err as Error);
          throw err;
        } finally {
          span.end();
        }
      },
    );
  };
}

/** Exported for tests to assert idempotency. */
export function _isInitialized(): boolean {
  return sdkStarted;
}
