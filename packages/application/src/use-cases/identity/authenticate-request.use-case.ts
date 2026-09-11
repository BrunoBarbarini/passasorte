import type { AuthenticatedUser } from "@passasorte/domain";
import type { AuthPort } from "../../ports/auth.port.js";
import type { UserRepository } from "../../ports/user-repository.port.js";
import { UnauthenticatedError } from "../../errors.js";

/**
 * Verifies a bearer token (Supabase Auth, via AuthPort) and resolves it to
 * PassaSorte's own AuthenticatedUser, creating the local `users` row on
 * first sight (ADR-008). Used by the API's auth guard on every protected
 * request — never trust a client-supplied user id (CLAUDE.md #2.6).
 */
export class AuthenticateRequestUseCase {
  constructor(
    private readonly authPort: AuthPort,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(bearerToken: string): Promise<AuthenticatedUser> {
    const identity = await this.authPort.verifyAccessToken(bearerToken).catch(() => {
      throw new UnauthenticatedError();
    });

    let user = await this.userRepository.findBySupabaseUserId(identity.supabaseUserId);
    if (!user) {
      user = await this.userRepository.create({
        supabaseUserId: identity.supabaseUserId,
        email: identity.email,
      });
    }

    const authenticated = await this.userRepository.findAuthenticatedById(user.id);
    if (!authenticated) {
      // Created the row ourselves immediately above - this would indicate
      // an infrastructure inconsistency, not a normal "not found".
      throw new UnauthenticatedError();
    }

    return authenticated;
  }
}
