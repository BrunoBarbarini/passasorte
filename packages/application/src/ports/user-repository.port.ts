import type { AuthenticatedUser, User } from "@passasorte/domain";

export interface CreateUserInput {
  supabaseUserId: string;
  email: string;
}

export interface UserRepository {
  findBySupabaseUserId(supabaseUserId: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  /** User + currently granted roles, for authorization decisions. */
  findAuthenticatedById(userId: string): Promise<AuthenticatedUser | null>;
}
