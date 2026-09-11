import type { ZodSchema } from "zod";
import { ZodError } from "zod";
import { ValidationError } from "@passasorte/application";

/**
 * Validates `input` against `schema`, throwing ValidationError (mapped to
 * a 400 with the CLAUDE.md #16 error envelope by GlobalHttpExceptionFilter)
 * with a pt-BR message and per-field details on failure, instead of
 * letting a raw ZodError reach the client.
 */
export function parseWithSchema<T>(schema: ZodSchema<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) {
      const details: Record<string, string> = {};
      for (const issue of error.issues) {
        details[issue.path.join(".") || "(root)"] = issue.message;
      }
      throw new ValidationError("Dados inválidos.", details);
    }
    throw error;
  }
}
