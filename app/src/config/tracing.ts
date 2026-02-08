/**
 * Tracing Configuration
 * OpenTelemetry setup for distributed tracing (replaces X-Ray SDK)
 * Exports the same API surface as the old xray.ts for backward compatibility.
 */

import { logger } from './logger';

let tracingInitialized = false;

// Lazy imports to avoid loading OTel when tracing is disabled
let otelApi: typeof import('@opentelemetry/api') | null = null;

/**
 * Initialize OpenTelemetry tracing
 * Must be called before any other imports that should be instrumented.
 */
export async function initializeTracing(): Promise<void> {
  if (process.env.ENABLE_TRACING !== 'true') {
    logger.info('Tracing disabled (set ENABLE_TRACING=true to enable)');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    otelApi = await import('@opentelemetry/api');

    const exporter = new OTLPTraceExporter({
      // ADOT collector or X-Ray daemon OTLP endpoint
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

    const sdk = new NodeSDK({
      traceExporter: exporter,
      instrumentations: [getNodeAutoInstrumentations({
        // Disable noisy FS instrumentation
        '@opentelemetry/instrumentation-fs': { enabled: false },
      })],
      serviceName: process.env.OTEL_SERVICE_NAME || 'burnware-api',
    });

    sdk.start();
    tracingInitialized = true;
    logger.info('OpenTelemetry tracing initialized');

    // Graceful shutdown
    process.on('SIGTERM', () => sdk.shutdown().catch(() => {}));
  } catch (error) {
    logger.warn('Failed to initialize tracing, continuing without it', { error });
  }
}

/**
 * Get current trace ID
 */
export function getTraceId(): string | undefined {
  if (!tracingInitialized || !otelApi) return undefined;
  try {
    const span = otelApi.trace.getActiveSpan();
    return span?.spanContext().traceId;
  } catch {
    return undefined;
  }
}

/**
 * Create a child span for an operation.
 * Returns an object with close() and addError() for backward compatibility with X-Ray subsegments.
 */
export function createSubsegment(name: string) {
  if (!tracingInitialized || !otelApi) return null;
  try {
    const tracer = otelApi.trace.getTracer('burnware-api');
    const span = tracer.startSpan(name);
    return {
      close: () => span.end(),
      addError: (error: Error) => {
        span.recordException(error);
        span.setStatus({ code: otelApi!.SpanStatusCode.ERROR, message: error.message });
      },
    };
  } catch {
    return null;
  }
}
