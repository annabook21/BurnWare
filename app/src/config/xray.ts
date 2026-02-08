/**
 * X-Ray Configuration (deprecated — delegates to OpenTelemetry)
 * This file maintains backward compatibility for existing imports.
 * New code should import from './tracing' instead.
 */

export { initializeTracing as initializeXRay, getTraceId, createSubsegment } from './tracing';
