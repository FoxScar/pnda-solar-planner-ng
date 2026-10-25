import { ENGINE_VERSION } from "../engine/constants";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ApiFailure, ApiSuccess, ErrorCode } from "../../shared/domain";



export class ApiError extends Error {
  constructor(
    public readonly status: ContentfulStatusCode,
    public readonly code: ErrorCode,
    message: string,
    public readonly field?: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  const body: ApiSuccess<T> = {
    success: true,
    data,
    meta: { requestId: c.get("requestId") as string, engineVersion: ENGINE_VERSION },
  };
  return c.json(body, status);
}

export function fail(c: Context, err: ApiError) {
  const body: ApiFailure = {
    success: false,
    error: {
      code: err.code,
      message: err.message,
      ...(err.field ? { field: err.field } : {}),
      ...(err.details !== undefined ? { details: err.details } : {}),
    },
  };
  return c.json(body, err.status);
}
