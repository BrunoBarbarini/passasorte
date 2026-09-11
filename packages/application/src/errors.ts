/**
 * Error taxonomy (CLAUDE.md #26): DomainError, ValidationError,
 * AuthorizationError, ConflictError, InfrastructureError,
 * IntegrationError, UnexpectedError. apps/api's global exception filter
 * maps `httpStatus` to the CLAUDE.md #16 error envelope; messages are
 * pt-BR (BR-048) since they are user-facing.
 */
export abstract class ApplicationError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
}

/** A business rule was violated (e.g. an illegal campaign transition). */
export class DomainError extends ApplicationError {
  readonly code = "DOMAIN_ERROR";
  readonly httpStatus = 422;
}

/** Input failed validation before it ever reached domain rules. */
export class ValidationError extends ApplicationError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 400;

  constructor(
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

/** Authenticated, but not allowed to perform this action (RBAC). */
export class AuthorizationError extends ApplicationError {
  readonly code = "AUTHORIZATION_ERROR";
  readonly httpStatus = 403;

  constructor(message = "Você não tem permissão para executar esta ação.") {
    super(message);
  }
}

/** Not authenticated at all, or the token is invalid/expired. */
export class UnauthenticatedError extends ApplicationError {
  readonly code = "UNAUTHENTICATED";
  readonly httpStatus = 401;

  constructor(message = "Autenticação necessária.") {
    super(message);
  }
}

export class NotFoundError extends ApplicationError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(entityType: string, id: string) {
    super(`${entityType} "${id}" não foi encontrado(a).`);
  }
}

/** The request conflicts with the current state (e.g. concurrent update). */
export class ConflictError extends ApplicationError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
}
