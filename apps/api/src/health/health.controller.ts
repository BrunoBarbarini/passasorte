import { Controller, Get } from "@nestjs/common";

/**
 * Liveness/readiness probe for orchestrators and uptime checks.
 * Deliberately has no dependencies yet (no DB/Redis ping) - Phase 0 only
 * needs to prove the foundation (config, logging, request IDs, OTel)
 * boots end-to-end. Dependency health checks are added once apps/api
 * actually talks to Postgres/Redis (Phase 1+).
 */
@Controller("health")
export class HealthController {
  @Get()
  check(): { status: "ok"; service: string; timestamp: string } {
    return {
      status: "ok",
      service: process.env.SERVICE_NAME ?? "passasorte-api",
      timestamp: new Date().toISOString(),
    };
  }
}
