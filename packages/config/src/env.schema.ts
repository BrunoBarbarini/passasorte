import { z } from "zod";

/**
 * Environments PassaSorte can run in.
 *
 * CLAUDE.md #42: minimum set is local, development, staging, production.
 * CLAUDE.md #42: never hard-code business behavior based solely on NODE_ENV -
 * this enum only selects infra/config defaults, never product/business rules
 * (those belong in explicit feature flags, see FeatureFlagsSchema below).
 */
export const AppEnvironmentSchema = z.enum(["local", "development", "staging", "production"]);
export type AppEnvironment = z.infer<typeof AppEnvironmentSchema>;

/**
 * Strict env-var boolean: only "true"/"1" (case-insensitive) parse as true
 * and only "false"/"0"/unset parse as false - anything else is a
 * validation error. Deliberately NOT `z.coerce.boolean()`, whose JS
 * `Boolean(value)` coercion treats the *string* "false" as truthy, which
 * would silently turn every legally-gated flag on the moment someone
 * wrote `ENABLE_PAID_PARTICIPATION=false` in an .env file.
 */
function booleanEnvFlag(defaultValue: false) {
  return z
    .string()
    .optional()
    .transform((value) => value?.trim().toLowerCase())
    .pipe(z.enum(["true", "1", "false", "0", ""]).optional())
    .transform((value) => {
      if (value === undefined || value === "") return defaultValue;
      return value === "true" || value === "1";
    });
}

/**
 * Feature flags / kill switches.
 *
 * CLAUDE.md #22 lists the critical kill switches. CLAUDE.md #1.9 (LEGAL GATE)
 * requires that flags related to paid promotional participation default to
 * disabled until formally approved - that default is encoded here, not left
 * to each environment's .env file, so a missing env var can never silently
 * turn on a legally gated feature.
 */
export const FeatureFlagsSchema = z.object({
  ENABLE_NEW_PARTICIPATIONS: booleanEnvFlag(false),
  ENABLE_PAID_PARTICIPATION: booleanEnvFlag(false),
  ENABLE_MOVEMENTS: booleanEnvFlag(false),
  ENABLE_GAME_AUTO_ADVANCE: booleanEnvFlag(false),
  ENABLE_BENEFIT_REDEMPTION: booleanEnvFlag(false),
  ENABLE_PAYMENT_CAPTURE: booleanEnvFlag(false),
});
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;

/**
 * Raw process.env shape this package knows how to validate.
 *
 * Only wiring/infra concerns belong here (ports, connection strings, log
 * level, OTel exporter target). Business constants (board size, price,
 * movement count, etc.) must never live in env vars - CLAUDE.md #2.11 and
 * #58 require those to be configurable per-campaign/room data, not global
 * process configuration, and Claude must not invent defaults for them.
 */
export const EnvSchema = z.object({
  NODE_ENV: AppEnvironmentSchema.default("local"),
  SERVICE_NAME: z.string().min(1).default("passasorte-api"),

  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),

  /// Supabase project URL (ADR-008). The API derives the Auth JWKS
  /// endpoint from it (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
  /// to verify access tokens - no shared secret is stored server-side.
  SUPABASE_URL: z.string().url(),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  OTEL_TRACES_SAMPLER_RATIO: z.coerce.number().min(0).max(1).default(1),

  /// apps/worker scheduler cadence (TASK-034). This is infra/operational
  /// pacing (how often the worker wakes up to check for eligible work),
  /// NOT the per-room business pacing in room-operations-config.ts, so an
  /// env var is appropriate here (CLAUDE.md #42 only forbids env vars
  /// for BUSINESS constants).
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000),
  WORKER_OUTBOX_BATCH_SIZE: z.coerce.number().int().positive().default(50),

  /// Phase 8 / TASK-045 Product Analytics SDK. CLAUDE.md #13 lists
  /// PostHog as an ASSUMPTION (not yet a confirmed DECISION like
  /// Supabase Auth) - so, mirroring the notification-provider registry
  /// pattern (CLAUDE.md #3.12), the adapter is real but stays inert
  /// (no-op) until a project key is actually configured. No default key
  /// is invented here.
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com"),

  /// Phase 8 / TASK-061 Privileged MFA. CLAUDE.md #17: "Privileged roles
  /// require MFA in production" - a FACT, not a toggle a deployer should
  /// be able to silently disable in prod. Left unset, this defaults to
  /// on in production and off elsewhere (local/dev/staging can still run
  /// without every operator having enrolled MFA yet); an explicit value
  /// always wins in either direction.
  REQUIRE_MFA_FOR_PRIVILEGED_ROLES: z
    .string()
    .optional()
    .transform((value) => value?.trim().toLowerCase())
    .pipe(z.enum(["true", "1", "false", "0", ""]).optional()),

  /// Phase 8 / TASK-060 Rate Limiting. Operational/infra pacing (like
  /// WORKER_POLL_INTERVAL_MS above), never a business rule, so an env
  /// var is appropriate (CLAUDE.md #42 only forbids env vars for
  /// business constants). Applied globally by @fastify/rate-limit in
  /// apps/api's bootstrap - see main.ts.
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),

  /// Phase 8 / TASK-059 Security Hardening. Comma-separated allow-list of
  /// origins allowed to call this API from a browser (apps/web is the
  /// only known browser caller so far). Empty by default - "deny by
  /// default" (CLAUDE.md #18) - a deployment must explicitly opt an
  /// origin in.
  CORS_ALLOWED_ORIGINS: z.string().optional(),

  ...FeatureFlagsSchema.shape,
});
export type Env = z.infer<typeof EnvSchema>;
