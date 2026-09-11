import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

/**
 * OpenTelemetry bootstrap (CLAUDE.md #24, #10).
 *
 * Traces are exported via OTLP/HTTP when OTEL_EXPORTER_OTLP_ENDPOINT is
 * configured; otherwise the SDK still instruments the process (spans are
 * created and can be inspected locally) but nothing is shipped anywhere -
 * this keeps `pnpm dev` usable with zero external dependencies while
 * staying wired for staging/production.
 *
 * Must be started before any instrumented module (http, pg, fastify, etc.)
 * is imported - call `startTelemetry()` as the very first line of the
 * service entrypoint.
 */
export interface TelemetryOptions {
  serviceName: string;
  serviceVersion?: string;
  otlpEndpoint?: string | undefined;
}

let sdk: NodeSDK | undefined;

export function startTelemetry(options: TelemetryOptions): void {
  if (sdk) {
    return;
  }

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: options.serviceName,
      [ATTR_SERVICE_VERSION]: options.serviceVersion ?? "0.0.0",
    }),
    ...(options.otlpEndpoint
      ? { traceExporter: new OTLPTraceExporter({ url: options.otlpEndpoint }) }
      : {}),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk.start();

  process.on("SIGTERM", () => {
    void stopTelemetry();
  });
}

export async function stopTelemetry(): Promise<void> {
  await sdk?.shutdown();
  sdk = undefined;
}
