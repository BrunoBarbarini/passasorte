import { Inject, Injectable } from "@nestjs/common";
import type { AuthenticatedUser, User } from "@passasorte/domain";
import type { CreateUserInput, UserRepository } from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";
import type { User as PrismaUser } from "@prisma/client";

function toDomainUser(row: PrismaUser): User {
  return {
    id: row.id,
    supabaseUserId: row.supabaseUserId,
    email: row.email,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findBySupabaseUserId(supabaseUserId: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { supabaseUserId } });
    return row ? toDomainUser(row) : null;
  }

  async create(input: CreateUserInput): Promise<User> {
    const row = await this.prisma.user.create({
      data: { supabaseUserId: input.supabaseUserId, email: input.email },
    });
    return toDomainUser(row);
  }

  async findAuthenticatedById(userId: string): Promise<AuthenticatedUser | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    if (!row) return null;

    return {
      user: toDomainUser(row),
      roles: row.roles.map((r) => r.role),
      // Not known at the persistence layer - this is a per-request token
      // claim, not stored per user. AuthenticateRequestUseCase overwrites
      // it with the real value from the verified access token right
      // after this call returns (see auth.port.ts/roles.guard.ts).
      authenticationAssuranceLevel: "aal1",
    };
  }
}
