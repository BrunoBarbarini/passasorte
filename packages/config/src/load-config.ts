import { EnvSchema, type Env, type FeatureFlags } from "./env.schema.js";

export class ConfigValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid application configuration:\n- ${issues.join("\n- ")}`);
    this.name = "ConfigValidationError";
  }
}

export interface AppConfig {
  env: Env["NODE_ENV"];
  serviceName: string;
  http: {
    port: number;
    host: string;
  };
  database: {
    url: string;
  };
  redis: {
    url: string;
  };
  supabase: {
    url: string;
  };
  logging: {
    level: Env["LOG_LEVEL"];
  };
  otel: {
    exporterOtlpEndpoint?: string | undefined;
    tracesSamplerRatio: number;
  };
  worker: {
    pollIntervalMs: number;
    outboxBatchSize: number;
  };
  analytics: {
    posthogApiKey: string | undefined;
    posthogHost: string;
  };
  security: {
    requireMfaForPrivilegedRoles: boolean;
    rateLimit: {
      max: number;
      windowMs: number;
    };
    corsAllowedOrigins: string[];
  };
  featureFlags: FeatureFlags;
}

/**
 * Parses and validates `process.env` (or the given record) into a strongly
 * typed, structured AppConfig. Fails fast with a descriptive error rather
 * than letting an invalid/missing value surface later as a runtime bug -
 * CLAUDE.md #37 NFR-012/#42 expect config to be validated up front.
 */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = EnvSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map(
      (issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`,
    );
    throw new ConfigValidationError(issues);
  }

  const env = result.data;

  return {
    env: env.NODE_ENV,
    serviceName: env.SERVICE_NAME,
    http: {
      port: env.PORT,
      host: env.HOST,
    },
    database: {
      url: env.DATABASE_URL,
    },
    redis: {
      url: env.REDIS_URL,
    },
    supabase: {
      url: env.SUPABASE_URL,
    },
    logging: {
      level: env.LOG_LEVEL,
    },
    otel: {
      exporterOtlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      tracesSamplerRatio: env.OTEL_TRACES_SAMPLER_RATIO,
    },
    worker: {
      pollIntervalMs: env.WORKER_POLL_INTERVAL_MS,
      outboxBatchSize: env.WORKER_OUTBOX_BATCH_SIZE,
    },
    analytics: {
      posthogApiKey: env.POSTHOG_API_KEY,
      posthogHost: env.POSTHOG_HOST,
    },
    security: {
      requireMfaForPrivilegedRoles:
        env.REQUIRE_MFA_FOR_PRIVILEGED_ROLES === undefined ||
        env.REQUIRE_MFA_FOR_PRIVILEGED_ROLES === ""
          ? env.NODE_ENV === "production"
          : env.REQUIRE_MFA_FOR_PRIVILEGED_ROLES === "true" ||
            env.REQUIRE_MFA_FOR_PRIVILEGED_ROLES === "1",
      rateLimit: {
        max: env.RATE_LIMIT_MAX,
        windowMs: env.RATE_LIMIT_WINDOW_MS,
      },
      corsAllowedOrigins: (env.CORS_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    },
    featureFlags: {
      ENABLE_NEW_PARTICIPATIONS: env.ENABLE_NEW_PARTICIPATIONS,
      ENABLE_PAID_PARTICIPATION: env.ENABLE_PAID_PARTICIPATION,
      ENABLE_MOVEMENTS: env.ENABLE_MOVEMENTS,
      ENABLE_GAME_AUTO_ADVANCE: env.ENABLE_GAME_AUTO_ADVANCE,
      ENABLE_BENEFIT_REDEMPTION: env.ENABLE_BENEFIT_REDEMPTION,
      ENABLE_PAYMENT_CAPTURE: env.ENABLE_PAYMENT_CAPTURE,
    },
  };
}
