import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { getRequestContext, type Logger } from "@passasorte/observability";

/**
 * Normalizes every error response into the global error envelope defined
 * in CLAUDE.md #16, and never leaks a stack trace to the client
 * (CLAUDE.md #26). Unexpected (non-HttpException) errors are logged with
 * full detail server-side but returned to the client as a generic 500 with
 * only the requestId, so it can be looked up in logs/traces.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = getRequestContext()?.requestId;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === "string"
          ? response
          : ((response as { message?: string }).message ?? exception.message);

      void reply.status(status).send({
        error: {
          code: HttpStatus[status] ?? "HTTP_ERROR",
          message,
          requestId,
          details: typeof response === "object" ? response : {},
        },
      });
      return;
    }

    this.logger.error({ err: exception, operation: "unhandled_exception" }, "Unhandled exception");

    void reply.status(500).send({
      error: {
        code: "UNEXPECTED_ERROR",
        message: "Ocorreu um erro inesperado.",
        requestId,
        details: {},
      },
    });
  }
}
