import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAnyRole, type RoleKey } from "@passasorte/domain";
import { AuthorizationError, UnauthenticatedError } from "@passasorte/application";
import { ROLES_METADATA_KEY } from "./roles.decorator.js";
import type { RequestWithAuth } from "./current-user.decorator.js";

/** Enforces @Roles(...) against the AuthenticatedUser set by AuthGuard - always register AFTER AuthGuard. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleKey[] | undefined>(
      ROLES_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    if (!request.authenticatedUser) {
      throw new UnauthenticatedError();
    }
    if (!hasAnyRole(request.authenticatedUser, requiredRoles)) {
      throw new AuthorizationError();
    }
    return true;
  }
}
