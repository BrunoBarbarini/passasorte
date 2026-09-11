import pino, { type Logger as PinoLogger } from "pino";
import { getRequestContext } from "./request-context.js";

/**
 * Structured JSON logging (CLAUDE.md #23).
 *
 * Every log line must carry, at minimum: timestamp, level, service,
 * environment, requestId, correlationId, userId (when safe), operation,
 * durationMs, errorCode. This module guarantees the request/correlation
 * fields are always present (pulled from the current async request
 * context) so call sites never have to remember to pass them, and keeps a
 * fixed deny-list of keys that must never be logged (#23, #20, NFR-020).
 */
export interface LoggerOptions {
  serviceName: string;
  environment: string;
  level: pino.LevelWithSilent;
}

const NEVER_LOG_KEYS = new Set([
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "secret",
  "authorization",
  "cardNumber",
  "cvv",
  "seed",
]);

function redactUnsafeKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (NEVER_LOG_KEYS.has(key)) {
      result[key] = "[REDACTED]";
      continue;
    }
    result[key] = value;
  }
  return result;
}

export function createLogger(options: LoggerOptions): PinoLogger {
  return pino({
    level: options.level,
    base: {
      service: options.serviceName,
      environment: options.environment,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
      log(payload) {
        const context = getRequestContext();
        return redactUnsafeKeys({
          ...payload,
          requestId: context?.requestId,
          correlationId: context?.correlationId,
          ...(context?.userId ? { userId: context.userId } : {}),
        });
      },
    },
  });
}

export type { PinoLogger as Logger };
