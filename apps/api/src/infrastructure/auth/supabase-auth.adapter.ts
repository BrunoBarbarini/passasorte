import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import {
  InvalidAccessTokenError,
  type AuthPort,
  type VerifiedIdentity,
} from "@passasorte/application";

/**
 * Verifies Supabase Auth access tokens against the project's JWKS
 * endpoint (ADR-008) - no shared secret handled by this API at all,
 * only the public signing keys Supabase publishes.
 *
 * NOTE: this requires the Supabase project to have "JWT Signing Keys"
 * (asymmetric, ES256/RS256) enabled in Auth settings. A project still on
 * the legacy shared-secret (HS256) mode has no JWKS endpoint to verify
 * against - if `verifyAccessToken` starts failing for every request,
 * check that setting first.
 */
export class SupabaseAuthAdapter implements AuthPort {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(supabaseUrl: string) {
    const base = supabaseUrl.replace(/\/$/, "");
    this.jwks = createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`));
    this.issuer = `${base}/auth/v1`;
  }

  async verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    let payload: JWTPayload;
    try {
      ({ payload } = await jwtVerify(token, this.jwks, { issuer: this.issuer }));
    } catch (error) {
      throw new InvalidAccessTokenError(
        error instanceof Error ? error.message : "verificação falhou",
      );
    }

    const supabaseUserId = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;

    if (!supabaseUserId || !email) {
      throw new InvalidAccessTokenError("claims obrigatórias (sub, email) ausentes no token");
    }

    // CLAUDE.md #17: "Privileged roles require MFA in production."
    // Supabase issues this as the `aal` claim once a user completes an
    // MFA challenge ("aal2"); a token that predates MFA enrollment, or
    // any unrecognized value, is treated as the more restrictive "aal1"
    // rather than trusting an absent/malformed claim.
    const authenticationAssuranceLevel = payload.aal === "aal2" ? "aal2" : "aal1";

    return { supabaseUserId, email, authenticationAssuranceLevel };
  }
}
