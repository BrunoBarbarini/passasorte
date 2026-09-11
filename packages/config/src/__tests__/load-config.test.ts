import { describe, expect, it } from "vitest";
import { loadConfig, ConfigValidationError } from "../load-config.js";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/passasorte",
  REDIS_URL: "redis://localhost:6379",
};

describe("loadConfig", () => {
  it("applies safe defaults when optional vars are missing", () => {
    const config = loadConfig(baseEnv);

    expect(config.env).toBe("local");
    expect(config.http.port).toBe(3000);
    expect(config.logging.level).toBe("info");
  });

  it("defaults every legally-gated feature flag to disabled", () => {
    const config = loadConfig(baseEnv);

    expect(config.featureFlags.ENABLE_PAID_PARTICIPATION).toBe(false);
    expect(config.featureFlags.ENABLE_PAYMENT_CAPTURE).toBe(false);
    expect(config.featureFlags.ENABLE_BENEFIT_REDEMPTION).toBe(false);
  });

  it("keeps a feature flag disabled unless explicitly set to true", () => {
    const config = loadConfig({ ...baseEnv, ENABLE_PAID_PARTICIPATION: "false" });

    expect(config.featureFlags.ENABLE_PAID_PARTICIPATION).toBe(false);
  });

  it("allows explicitly enabling a feature flag", () => {
    const config = loadConfig({ ...baseEnv, ENABLE_MOVEMENTS: "true" });

    expect(config.featureFlags.ENABLE_MOVEMENTS).toBe(true);
  });

  it("throws a descriptive ConfigValidationError when required vars are missing", () => {
    expect(() => loadConfig({})).toThrow(ConfigValidationError);
  });
});
