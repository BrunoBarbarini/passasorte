import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AuthenticatedUser } from "@passasorte/domain";
import type { FastifyRequest } from "fastify";

export interface RequestWithAuth extends FastifyRequest {
  authenticatedUser?: AuthenticatedUser;
}

/** Injects the AuthenticatedUser set by AuthGuard. Only valid on routes guarded by AuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.authenticatedUser) {
      throw new Error(
        "CurrentUser() usado numa rota sem AuthGuard - authenticatedUser não está definido.",
      );
    }
    return request.authenticatedUser;
  },
);
