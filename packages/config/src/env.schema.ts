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

  ...FeatureFlagsSchema.shape,
});
export type Env = z.infer<typeof EnvSchema>;
