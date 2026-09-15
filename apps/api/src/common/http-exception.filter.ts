import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from "@nestjs/common";
import type { FastifyReply } from "fastify";
import { getRequestContext, type Logger } from "@passasorte/observability";
import { ApplicationError, DomainError, ValidationError } from "@passasorte/application";
import {
  InvalidCampaignTransitionError,
  InvalidParticipationTransitionError,
  InvalidRoomTransitionError,
} from "@passasorte/domain";

/**
 * Normalizes every error response into the global error envelope defined
 * in CLAUDE.md #16, and never leaks a stack trace to the client
 * (CLAUDE.md #26). Messages are pt-BR (BR-048) since they reach the
 * client. Handles, in order: @passasorte/application's ApplicationError
 * taxonomy (CLAUDE.md #26 - Domain/Validation/Authorization/NotFound/
 * Conflict/Unauthenticated), Nest's HttpException (validation pipes,
 * framework-level errors), Fastify-level errors that carry their own
 * valid 4xx statusCode (body/content-type parsing, payload too large -
 * TASK-062), and everything else as an opaque 500 that is logged in full
 * server-side but never detailed to the client.
 */
@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const reply = ctx.getResponse<FastifyReply>();
    const requestId = getRequestContext()?.requestId;

    if (exception instanceof ApplicationError) {
      void reply.status(exception.httpStatus).send({
        error: {
          code: exception.code,
          message: exception.message,
          requestId,
          details: exception instanceof ValidationError ? exception.details : {},
        },
      });
      return;
    }

    // Erros de maquina de estado (transicao invalida de Campaign/GameRoom/
    // Participation) sao Error simples do @passasorte/domain, nao uma
    // ApplicationError - cairiam no catch-all como 500 opaco sem este
    // bloco, apesar do proprio comentario de DomainError em errors.ts ja
    // citar "an illegal campaign transition" como o exemplo canonico dela.
    // Achado no teste E2E do backoffice (15/09/2026): tentar travar
    // entradas/iniciar uma sala em DRAFT virava "erro inesperado" 500 em
    // vez do 422 com mensagem clara que o dominio ja produzia.
    if (
      exception instanceof InvalidCampaignTransitionError ||
      exception instanceof InvalidRoomTransitionError ||
      exception instanceof InvalidParticipationTransitionError
    ) {
      const domainError = new DomainError(exception.message);
      void reply.status(domainError.httpStatus).send({
        error: {
          code: domainError.code,
          message: domainError.message,
          requestId,
          details: {},
        },
      });
      return;
    }

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

    // Erros de nivel Fastify (parsing de body/content-type, payload grande
    // demais, etc.) sao Error simples com .statusCode/.code, nao um
    // HttpException do Nest - cairiam no catch-all como 500 opaco sem este
    // bloco. Bug real encontrado no teste E2E do backoffice (15/09/2026):
    // POST sem corpo em rota que nao exige corpo (lock-entries, start)
    // virava "UNEXPECTED_ERROR" 500 em vez do 400 correto que o proprio
    // Fastify ja tinha identificado - contraria CLAUDE.md #16 (nunca
    // esconder um erro de cliente atras de um 500 generico).
    if (
      exception instanceof Error &&
      "statusCode" in exception &&
      typeof (exception as { statusCode: unknown }).statusCode === "number" &&
      (exception as { statusCode: number }).statusCode >= 400 &&
      (exception as { statusCode: number }).statusCode < 500
    ) {
      const status = (exception as { statusCode: number }).statusCode;
      const code =
        "code" in exception && typeof (exception as { code: unknown }).code === "string"
          ? (exception as { code: string }).code
          : "BAD_REQUEST";
      void reply.status(status).send({
        error: {
          code,
          message: exception.message,
          requestId,
          details: {},
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
