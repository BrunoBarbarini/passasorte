import { NOOP_ANALYTICS_PORT, type AnalyticsPort } from "@passasorte/application";

/** Re-exported so callers of @passasorte/analytics never need to reach into @passasorte/application directly for this. */
export const NoopAnalyticsAdapter: AnalyticsPort = NOOP_ANALYTICS_PORT;
