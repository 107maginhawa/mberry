/**
 * API service entry point
 * Parses configuration and starts the server with proper dependency management
 *
 * Exports createApp and parseConfig for Boa bundle builds.
 */

import { createApp, initializeApp, cleanupApp } from '@/app';
import { parseConfig } from '@/core/config';
import { initObservability } from '@/core/observability';

// Export for Boa bundle
export { createApp, parseConfig };

// Initialize OpenTelemetry SDK BEFORE creating the app so auto-instrumentation
// captures Hono / pg / http bootstrap spans. No-op when OTEL_EXPORTER_OTLP_ENDPOINT
// is unset.
const otelTeardown = await initObservability();

// Parse configuration from CLI args and environment
const config = parseConfig();

// Create application with all dependencies
const app = createApp(config);
const log = app.logger.child({ module: 'main' });

// Handle graceful shutdown
let isShuttingDown = false;

async function handleShutdown(signal: string) {
  if (isShuttingDown) {
    return; // Already shutting down, ignore duplicate signals
  }
  
  isShuttingDown = true;
  log.info(`${signal} received, shutting down gracefully...`);
  
  try {
    await cleanupApp(app);
    await otelTeardown();
    log.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    log.error({ error }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

// Register signal handlers using process.once to ensure single execution
process.once('SIGTERM', () => handleShutdown('SIGTERM'));
process.once('SIGINT', () => handleShutdown('SIGINT'));

// Start serving HTTP first so the liveness probe (/livez) responds immediately —
// independent of database, storage, or job-scheduler init. Readiness (/readyz)
// stays unhealthy until initializeApp() resolves, which is the correct k8s split.
const server = Bun.serve({
  hostname: config.server.host,
  port: config.server.port,
  fetch: app.fetch,
  websocket: app.ws.websocket, // Hono's WebSocket handler
});

log.info(`🚀 Server running on http://${server.hostname}:${server.port}`);

// Initialize all application components in the background. Failures are logged
// but do NOT exit the process — /readyz will report unhealthy and k8s will hold
// traffic; /livez stays green so the pod isn't restart-looped.
initializeApp(app, config).catch((error) => {
  log.error({ error }, 'Failed to initialize application — /readyz will report unhealthy');
});
