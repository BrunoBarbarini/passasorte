import { describe, expect, it } from "vitest";
import { HealthController } from "../health.controller.js";

describe("HealthController", () => {
  it("reports ok status with a service name and timestamp", () => {
    const controller = new HealthController();
    const result = controller.check();

    expect(result.status).toBe("ok");
    expect(typeof result.service).toBe("string");
    expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
  });
});
