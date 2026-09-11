import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

/**
 * Request/correlation ID propagation (CLAUDE.md #26, NFR-010/NFR-011).
 *
 * - requestId identifies a single inbound HTTP request/command.
 * - correlationId identifies a logical flow that may span multiple requests
 *   and async jobs (e.g. checkout -> webhook -> worker). It defaults to the
 *   requestId when the caller does not supply one (e.g. an external caller
 *   started the flow), so every log line always has both fields populated.
 *
 * AsyncLocalStorage lets any code (services, repositories, loggers) read the
 * current request context without threading it through every function
 * signature, while staying correct across async/await boundaries.
 */
export interface RequestContext {
  requestId: string;
  correlationId: string;
  userId?: string | undefined;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function generateRequestId(): string {
  return `req_${randomUUID()}`;
}

export function generateCorrelationId(): string {
  return `cor_${randomUUID()}`;
}

export interface RunWithRequestContextInput {
  requestId?: string | undefined;
  correlationId?: string | undefined;
  userId?: string | undefined;
}

export function runWithRequestContext<T>(input: RunWithRequestContextInput, fn: () => T): T {
  const requestId = input.requestId ?? generateRequestId();
  const context: RequestContext = {
    requestId,
    correlationId: input.correlationId ?? requestId,
    userId: input.userId,
  };

  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}
