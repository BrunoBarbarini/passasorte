/**
 * OpenTelemetry must be initialized before any instrumented module (http,
 * fastify, pg, ...) is imported (CLAUDE.md #24). This file has no other
 * imports for that reason and is loaded via `node --import` ahead of
 * main.ts (see package.json `start`/`dev` scripts), rather than imported
 * normally from within the app.
 */
import { startTelemetry } from "@passasorte/observability";

startTelemetry({
  serviceName: process.env.SERVICE_NAME ?? "passasorte-api",
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
});
