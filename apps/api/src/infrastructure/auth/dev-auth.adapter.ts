import { createHash } from "node:crypto";
import {
  InvalidAccessTokenError,
  type AuthPort,
  type VerifiedIdentity,
} from "@passasorte/application";

/** Only e-mails in this reserved test domain are accepted. */
export const DEV_AUTH_EMAIL_DOMAIN = "dev.passasorte.test";

/** users.supabase_user_id is a UUID column: derive a stable, name-based UUID (namespaced, never random). */
export function devSupabaseUserId(name: string): string {
  const bytes = createHash("sha256").update(`passasorte-dev-auth:${name}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const DEV_TOKEN = /^dev:([a-z0-9._-]{1,64})@dev\.passasorte\.test$/;

/**
 * LOCAL-ONLY test sign-in (the real login is deferred, see CLAUDE.md 2026-11-13).
 * Accepts `dev:<name>@dev.passasorte.test` as the bearer token and returns a plain
 * participant identity (aal1, never privileged: roles still come from the database).
 *
 * It is wired only when `DEV_AUTH_ENABLED=true`, and `loadConfig` refuses that flag unless
 * NODE_ENV is "local", so this class cannot be reached in development/staging/production.
 */
export class DevAuthAdapter implements AuthPort {
  verifyAccessToken(token: string): Promise<VerifiedIdentity> {
    const match = DEV_TOKEN.exec(token);
    if (!match) {
      return Promise.reject(
        new InvalidAccessTokenError(`use dev:<nome>@${DEV_AUTH_EMAIL_DOMAIN} no login de teste`),
      );
    }
    const email = `${match[1]}@${DEV_AUTH_EMAIL_DOMAIN}`;
    return Promise.resolve({
      supabaseUserId: devSupabaseUserId(match[1]!),
      email,
      authenticationAssuranceLevel: "aal1",
    });
  }
}
