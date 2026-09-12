import { PostHog } from "posthog-node";
import type { AnalyticsPort, TrackAnalyticsEventInput } from "@passasorte/application";

export interface PostHogAnalyticsAdapterConfig {
  apiKey: string;
  host: string;
}

/**
 * TASK-045 Product Analytics SDK. Thin wrapper around `posthog-node`
 * (server-side capture only - no client SDK decision is made here, see
 * analytics.port.ts's header comment). `posthog-node` batches/flushes
 * asynchronously on its own; `shutdown()` must be called before process
 * exit (apps/api/apps/worker both do this) so the last batch isn't lost.
 */
export class PostHogAnalyticsAdapter implements AnalyticsPort {
  private readonly client: PostHog;

  constructor(config: PostHogAnalyticsAdapterConfig) {
    this.client = new PostHog(config.apiKey, { host: config.host });
  }

  track(input: TrackAnalyticsEventInput): Promise<void> {
    // posthog-node's capture() enqueues synchronously and flushes on its
    // own internal timer/batch - nothing here to await.
    this.client.capture({
      distinctId: input.distinctId,
      event: input.event,
      properties: input.properties,
    });
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}
