import { PrismaClient } from "@prisma/client";

/**
 * A plain PrismaClient instance (CLAUDE.md #15) — no NestJS DI/lifecycle
 * here (the worker is a standalone process, not a Nest app); main.ts
 * calls $connect/$disconnect directly around the scheduler loop.
 */
export const prisma = new PrismaClient();
