/**
 * Verifies an access token issued by the identity provider (Supabase
 * Auth, ADR-008) without this package ever importing a Supabase SDK
 * (CLAUDE.md #11/#46) — the concrete verification (JWKS, etc.) lives in
 * the adapter implementing this port inside apps/api.
 */
export interface VerifiedIdentity {
  supabaseUserId: string;
  email: string;
  /**
   * Supabase Auth's JWT `aal` claim ("aal1"/"aal2" - CLAUDE.md #17
   * privileged-role MFA). Adapters that cannot determine it (e.g. a
   * legacy token predating MFA) must default to "aal1", the more
   * restrictive assumption.
   */
  authenticationAssuranceLevel: "aal1" | "aal2";
}

export class InvalidAccessTokenError extends Error {
  constructor(reason: string) {
    super(`Token de acesso inválido: ${reason}`);
    this.name = "InvalidAccessTokenError";
  }
}

export interface AuthPort {
  verifyAccessToken(token: string): Promise<VerifiedIdentity>;
}
