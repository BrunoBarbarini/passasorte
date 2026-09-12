import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { IdempotencyPort } from "@passasorte/application";
import { PrismaService } from "../prisma.service.js";

/** FR-038/BR-037: `record` inserts `key`; a unique-constraint violation means it was already seen. */
@Injectable()
export class PrismaIdempotencyRepository implements IdempotencyPort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(key: string): Promise<boolean> {
    try {
      await this.prisma.idempotencyKey.create({ data: { key } });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return false;
      }
      throw error;
    }
  }
}
