interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string; details?: Record<string, unknown> };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL precisa estar definido (veja apps/web/.env.example).");
}

/** Thrown for any non-2xx apps/api response, carrying its pt-BR message (CLAUDE.md #16 envelope). */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  accessToken?: string;
}

/** Thin fetch wrapper mirroring apps/mobile's api-client.ts — same envelope, same error shape. */
export async function apiRequest<TResponse>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<TResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    const errorBody = payload as ApiErrorBody | undefined;
    throw new ApiError(
      response.status,
      errorBody?.error.code ?? "UNKNOWN_ERROR",
      errorBody?.error.message ?? "Ocorreu um erro inesperado.",
      errorBody?.error.details ?? {},
    );
  }

  return payload as TResponse;
}
