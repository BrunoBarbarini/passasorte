import { z } from "zod";

/** Cursor pagination query params (CLAUDE.md #16). */
export const CursorPaginationQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(50).optional(),
});
export type CursorPaginationQuery = z.infer<typeof CursorPaginationQuerySchema>;
