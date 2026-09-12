/**
 * @passasorte/analytics
 *
 * Concrete adapter side of the AnalyticsPort defined in
 * @passasorte/application (CLAUDE.md #20, TASK-045). See that port's
 * header comment for the full event catalog and what is/isn't wired yet.
 */
export * from "./posthog-analytics.adapter.js";
export * from "./noop-analytics.adapter.js";
export * from "./create-analytics-adapter.js";
