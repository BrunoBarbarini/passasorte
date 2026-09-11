import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { generateRequestId, runWithRequestContext } from "@passasorte/observability";

/**
 * Assigns/propagates requestId and correlationId for every inbound request
 * (CLAUDE.md #26, NFR-010, NFR-011) and echoes requestId back in the
 * response headers so clients can correlate support requests with logs.
 *
 * correlationId is read from an inbound `x-correlation-id` header when
 * present (e.g. a worker or another service continuing a flow); otherwise
 * it defaults to the new requestId.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: FastifyRequest["raw"], res: FastifyReply["raw"], next: () => void): void {
    const requestId = generateRequestId();
    const correlationHeader = req.headers["x-correlation-id"];
    const correlationId = Array.isArray(correlationHeader)
      ? correlationHeader[0]
      : correlationHeader;

    res.setHeader("x-request-id", requestId);

    runWithRequestContext({ requestId, correlationId }, () => {
      next();
    });
  }
}
