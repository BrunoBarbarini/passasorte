import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { InvalidAccessTokenError, type AuthPort, type VerifiedIdentity } from "@passasorte/application";

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
      throw new InvalidAccessTokenError(error instanceof Error ? error.message : "verificação falhou");
    }

    const supabaseUserId = typeof payload.sub === "string" ? payload.sub : undefined;
    const email = typeof payload.email === "string" ? payload.email : undefined;

    if (!supabaseUserId || !email) {
      throw new InvalidAccessTokenError("claims obrigatórias (sub, email) ausentes no token");
    }

    return { supabaseUserId, email };
  }
}
