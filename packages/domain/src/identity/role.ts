/**
 * Fixed role set (CLAUDE.md #17). Not user-extensible data — extending
 * this list is a CLAUDE.md/product change, not a runtime configuration
 * change (see docs/adr/0008-managed-identity.md).
 */
export const ROLE_KEYS = [
  "PARTICIPANT",
  "MERCHANT_OPERATOR",
  "SUPPORT",
  "OPERATOR",
  "FINANCE",
  "COMPLIANCE",
  "ADMIN",
] as const;

export type RoleKey = (typeof ROLE_KEYS)[number];

export function isRoleKey(value: string): value is RoleKey {
  return (ROLE_KEYS as readonly string[]).includes(value);
}

/**
 * Roles CLAUDE.md #17 requires MFA for in production ("privileged roles").
 * PARTICIPANT is the only role with no backoffice/operational access, so
 * every other role is privileged.
 */
export const PRIVILEGED_ROLE_KEYS: readonly RoleKey[] = ROLE_KEYS.filter(
  (role) => role !== "PARTICIPANT",
);
