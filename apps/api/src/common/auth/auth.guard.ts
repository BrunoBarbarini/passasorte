import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import {
  AuthenticateRequestUseCase,
  type AuthPort,
  type UserRepository,
} from "@passasorte/application";
import { AUTH_PORT, USER_REPOSITORY } from "../tokens.js";
import type { RequestWithAuth } from "./current-user.decorator.js";

/**
 * Verifies the `Authorization: Bearer <token>` header (Supabase Auth,
 * ADR-008) and attaches the resulting AuthenticatedUser to the request.
 * Missing/invalid tokens surface as UnauthenticatedError, mapped to 401
 * by the global exception filter.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly useCase: AuthenticateRequestUseCase;

  constructor(
    @Inject(AUTH_PORT) authPort: AuthPort,
    @Inject(USER_REPOSITORY) userRepository: UserRepository,
  ) {
    this.useCase = new AuthenticateRequestUseCase(authPort, userRepository);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    // Throws UnauthenticatedError (via the use case) when missing/invalid -
    // let it propagate to the global exception filter rather than
    // returning false, so the response carries a proper pt-BR message.
    const authenticatedUser = await this.useCase.execute(token ?? "");
    request.authenticatedUser = authenticatedUser;
    return true;
  }
}
