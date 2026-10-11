import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import type { ZodSchema } from "zod";
import { ApiError } from "./http";

/** zValidator that reports failures in the standard INVALID_PAYLOAD envelope. */
export function validate<T extends ZodSchema, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      const issues = result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      throw new ApiError(
        400,
        "INVALID_PAYLOAD",
        "Some of the information sent was not valid.",
        issues[0]?.field,
        issues,
      );
    }
  });
}
