import type { ErrorCode } from "../../shared/domain";

/** Typed, user-presentable engine failure (PRD §23.2). */
export class EngineError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly field?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EngineError";
  }
}
