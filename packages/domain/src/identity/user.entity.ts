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

/**
 * Authentication Assurance Level of the current request's Supabase
 * session (RFC 9470-ish: "aal1" = single factor, "aal2" = MFA
 * challenge completed). Supabase Auth issues this as the JWT's `aal`
 * claim; PassaSorte never implements MFA itself (CLAUDE.md #17), it only
 * reads this to decide whether a privileged action may proceed
 * (CLAUDE.md #17 "Privileged roles require MFA in production" - see
 * RolesGuard/PRIVILEGED_ROLE_KEYS).
 */
export type AuthenticationAssuranceLevel = "aal1" | "aal2";

/** A User together with the roles currently granted to it. */
export interface AuthenticatedUser {
  user: User;
  roles: RoleKey[];
  authenticationAssuranceLevel: AuthenticationAssuranceLevel;
}

export function hasRole(authenticated: AuthenticatedUser, role: RoleKey): boolean {
  return authenticated.roles.includes(role);
}

export function hasAnyRole(authenticated: AuthenticatedUser, roles: readonly RoleKey[]): boolean {
  return roles.some((role) => authenticated.roles.includes(role));
}
