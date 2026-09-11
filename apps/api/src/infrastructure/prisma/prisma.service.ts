import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Thin Nest lifecycle wrapper around PrismaClient (CLAUDE.md #15). This is
 * the ONLY place in the codebase that imports `@prisma/client` outside
 * the repository adapters that use it - domain/application never do
 * (CLAUDE.md #11/#46).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
