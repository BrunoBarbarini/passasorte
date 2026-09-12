import { Inject, Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hasAnyRole, PRIVILEGED_ROLE_KEYS, type RoleKey } from "@passasorte/domain";
import { AuthorizationError, UnauthenticatedError } from "@passasorte/application";
import type { AppConfig } from "@passasorte/config";
import { ROLES_METADATA_KEY } from "./roles.decorator.js";
import type { RequestWithAuth } from "./current-user.decorator.js";
import { SECURITY_CONFIG } from "../tokens.js";

export type SecurityConfig = AppConfig["security"];

/**
 * Enforces @Roles(...) against the AuthenticatedUser set by AuthGuard -
 * always register AFTER AuthGuard. CLAUDE.md #17 "Privileged roles
 * require MFA in production" (TASK-061): every @Roles(...) route in this
 * codebase only ever lists roles other than PARTICIPANT (see
 * PRIVILEGED_ROLE_KEYS), so any route this guard actually gates is, by
 * construction, a privileged one - when
 * config.requireMfaForPrivilegedRoles is on, it additionally requires the
 * Supabase session backing the request to be "aal2" (MFA challenge
 * completed), never re-implementing MFA itself (CLAUDE.md #17).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SECURITY_CONFIG) private readonly security: SecurityConfig,
  ) {}

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

    const isPrivilegedRoute = requiredRoles.some((role) => PRIVILEGED_ROLE_KEYS.includes(role));
    if (
      isPrivilegedRoute &&
      this.security.requireMfaForPrivilegedRoles &&
      request.authenticatedUser.authenticationAssuranceLevel !== "aal2"
    ) {
      throw new AuthorizationError(
        "Esta ação exige verificação em duas etapas (MFA) para papéis privilegiados.",
      );
    }

    return true;
  }
}
