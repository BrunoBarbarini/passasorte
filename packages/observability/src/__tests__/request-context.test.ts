import { describe, expect, it } from "vitest";
import { getRequestContext, runWithRequestContext } from "../request-context.js";

describe("runWithRequestContext", () => {
  it("makes the context readable via getRequestContext inside the callback", () => {
    runWithRequestContext({ requestId: "req_1" }, () => {
      expect(getRequestContext()).toEqual({
        requestId: "req_1",
        correlationId: "req_1",
      });
    });
  });

  it("defaults correlationId to requestId when not provided", () => {
    runWithRequestContext({ requestId: "req_2" }, () => {
      expect(getRequestContext()?.correlationId).toBe("req_2");
    });
  });

  it("keeps an explicit correlationId distinct from requestId", () => {
    runWithRequestContext({ requestId: "req_3", correlationId: "cor_3" }, () => {
      expect(getRequestContext()).toMatchObject({
        requestId: "req_3",
        correlationId: "cor_3",
      });
    });
  });

  it("is not visible outside the callback", () => {
    runWithRequestContext({ requestId: "req_4" }, () => {});
    expect(getRequestContext()).toBeUndefined();
  });

  it("propagates across an async boundary inside the callback", async () => {
    await runWithRequestContext({ requestId: "req_5" }, async () => {
      await Promise.resolve();
      expect(getRequestContext()?.requestId).toBe("req_5");
    });
  });
});
