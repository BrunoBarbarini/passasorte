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
  logging: {
    level: Env["LOG_LEVEL"];
  };
  otel: {
    exporterOtlpEndpoint?: string | undefined;
    tracesSamplerRatio: number;
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
    logging: {
      level: env.LOG_LEVEL,
    },
    otel: {
      exporterOtlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
      tracesSamplerRatio: env.OTEL_TRACES_SAMPLER_RATIO,
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
