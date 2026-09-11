import { SetMetadata } from "@nestjs/common";
import type { RoleKey } from "@passasorte/domain";

export const ROLES_METADATA_KEY = "passasorte:roles";

/** Marks a route as requiring at least one of the given roles (CLAUDE.md #17). Use after @UseGuards(AuthGuard, RolesGuard). */
export const Roles = (...roles: RoleKey[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
