import type { RoleKey } from "./role.js";

/**
 * A PassaSorte account (CLAUDE.md #17, FR-001..FR-006). Credentials/MFA
 * live in Supabase Auth (ADR-008); this is PassaSorte's own record,
 * mirrored on first verified request.
 */
export interface User {
  id: string;
  supabaseUserId: string;
  email: string;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  id: string;
  userId: string;
  displayName: string | null;
  phone: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRoleGrant {
  id: string;
  userId: string;
  role: RoleKey;
  grantedAt: Date;
  grantedByUserId: string | null;
}

/** A User together with the roles currently granted to it. */
export interface AuthenticatedUser {
  user: User;
  roles: RoleKey[];
}

export function hasRole(authenticated: AuthenticatedUser, role: RoleKey): boolean {
  return authenticated.roles.includes(role);
}

export function hasAnyRole(authenticated: AuthenticatedUser, roles: readonly RoleKey[]): boolean {
  return roles.some((role) => authenticated.roles.includes(role));
}
