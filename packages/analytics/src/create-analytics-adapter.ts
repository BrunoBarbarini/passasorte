import type { AnalyticsPort } from "@passasorte/application";
import { PostHogAnalyticsAdapter } from "./posthog-analytics.adapter.js";
import { NoopAnalyticsAdapter } from "./noop-analytics.adapter.js";

export interface CreateAnalyticsAdapterInput {
  apiKey: string | undefined;
  host: string;
}

/**
 * Same "empty/inert-by-default pluggable registry" shape already used
 * for notification providers and eligibility rules (CLAUDE.md #58):
 * PostHog is CLAUDE.md #13's ASSUMPTION, not (yet) a confirmed DECISION
 * like Supabase Auth, so this factory returns a real, working adapter
 * only once a project key is actually configured - never a hard
 * dependency a deployment is forced to satisfy.
 */
export function createAnalyticsAdapter(input: CreateAnalyticsAdapterInput): AnalyticsPort {
  if (!input.apiKey) {
    return NoopAnalyticsAdapter;
  }
  return new PostHogAnalyticsAdapter({ apiKey: input.apiKey, host: input.host });
}
