import type { ApiResponse, ErrorCode } from "../../shared/domain";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode | "NETWORK_ERROR",
    message: string,
    public readonly field?: string,
  ) {
    super(message);
  }
}

/**
 * Calls the PandaSolution API (same origin; Vite proxies /api in development).
 * Unwraps the response envelope and throws ApiClientError on failure.
 */
export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("content-type", "application/json");

  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      ...rest,
      headers,
      credentials: "include",
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiClientError(0, "NETWORK_ERROR", "We couldn't reach the server. Check your connection and try again.");
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body) throw new ApiClientError(res.status, "INTERNAL_ERROR", "Unexpected response from the server.");
  if ("error" in body) {
    throw new ApiClientError(res.status, body.error.code, body.error.message, body.error.field);
  }
  return body.data;
}
