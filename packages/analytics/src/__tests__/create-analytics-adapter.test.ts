import { describe, expect, it } from "vitest";
import { createAnalyticsAdapter } from "../create-analytics-adapter.js";
import { NoopAnalyticsAdapter } from "../noop-analytics.adapter.js";
import { PostHogAnalyticsAdapter } from "../posthog-analytics.adapter.js";

describe("createAnalyticsAdapter (Phase 8 / TASK-045)", () => {
  it("returns the no-op adapter when no PostHog API key is configured", () => {
    const adapter = createAnalyticsAdapter({ apiKey: undefined, host: "https://us.i.posthog.com" });
    expect(adapter).toBe(NoopAnalyticsAdapter);
  });

  it("returns a real PostHogAnalyticsAdapter once an API key is configured", () => {
    const adapter = createAnalyticsAdapter({
      apiKey: "phc_test",
      host: "https://us.i.posthog.com",
    });
    expect(adapter).toBeInstanceOf(PostHogAnalyticsAdapter);
  });

  it("the no-op adapter's track() resolves without throwing", async () => {
    await expect(
      NoopAnalyticsAdapter.track({ event: "app_opened", distinctId: "u1" }),
    ).resolves.toBeUndefined();
  });
});
