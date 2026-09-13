import { describe, expect, it } from "vitest";
import { loadConfig, ConfigValidationError } from "../load-config.js";

const baseEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/passasorte",
  REDIS_URL: "redis://localhost:6379",
  SUPABASE_URL: "https://example.supabase.co",
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

  it("Phase 8/TASK-045: analytics adapter stays unconfigured (no key) by default", () => {
    const config = loadConfig(baseEnv);
    expect(config.analytics.posthogApiKey).toBeUndefined();
    expect(config.analytics.posthogHost).toBe("https://us.i.posthog.com");
  });

  it("Phase 8/TASK-061: defaults MFA-for-privileged-roles to on in production, off elsewhere", () => {
    expect(
      loadConfig({ ...baseEnv, NODE_ENV: "production" }).security.requireMfaForPrivilegedRoles,
    ).toBe(true);
    expect(loadConfig(baseEnv).security.requireMfaForPrivilegedRoles).toBe(false);
  });

  it("Phase 8/TASK-061: an explicit value always overrides the NODE_ENV-based default", () => {
    expect(
      loadConfig({
        ...baseEnv,
        NODE_ENV: "production",
        REQUIRE_MFA_FOR_PRIVILEGED_ROLES: "false",
      }).security.requireMfaForPrivilegedRoles,
    ).toBe(false);
    expect(
      loadConfig({ ...baseEnv, REQUIRE_MFA_FOR_PRIVILEGED_ROLES: "true" }).security
        .requireMfaForPrivilegedRoles,
    ).toBe(true);
  });

  it("Phase 8/TASK-060: applies safe rate-limit defaults", () => {
    const config = loadConfig(baseEnv);
    expect(config.security.rateLimit.max).toBe(100);
    expect(config.security.rateLimit.windowMs).toBe(60_000);
  });

  it("Phase 8/TASK-059: denies every CORS origin by default", () => {
    expect(loadConfig(baseEnv).security.corsAllowedOrigins).toEqual([]);
  });

  it("Phase 8/TASK-059: parses a comma-separated CORS allow-list, trimming whitespace", () => {
    const config = loadConfig({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: "https://app.passasorte.com, https://staging.passasorte.com ",
    });
    expect(config.security.corsAllowedOrigins).toEqual([
      "https://app.passasorte.com",
      "https://staging.passasorte.com",
    ]);
  });

  it("Phase 9: pilot mode is disabled by default with no allow-list and no room cap", () => {
    const config = loadConfig(baseEnv);
    expect(config.pilot.enabled).toBe(false);
    expect(config.pilot.allowedMerchantIds).toEqual([]);
    expect(config.pilot.maxActiveRooms).toBeNull();
  });

  it("Phase 9: parses a comma-separated pilot merchant allow-list and a numeric room cap", () => {
    const config = loadConfig({
      ...baseEnv,
      PILOT_MODE_ENABLED: "true",
      PILOT_ALLOWED_MERCHANT_IDS: " merchant-a, merchant-b ",
      PILOT_MAX_ACTIVE_ROOMS: "5",
    });
    expect(config.pilot.enabled).toBe(true);
    expect(config.pilot.allowedMerchantIds).toEqual(["merchant-a", "merchant-b"]);
    expect(config.pilot.maxActiveRooms).toBe(5);
  });
});
