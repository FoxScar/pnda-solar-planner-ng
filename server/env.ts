import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  /** Public web origin for share links; defaults to BETTER_AUTH_URL. */
  PUBLIC_APP_URL: z.string().url().optional(),
  PORT: z.coerce.number().int().positive().default(8787),
  /** When set, the API also serves the built frontend from this directory (single-service deploys). */
  STATIC_DIR: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  // On Render the public URL is provided automatically.
  const parsed = envSchema.safeParse({ ...source, BETTER_AUTH_URL: source.BETTER_AUTH_URL || source.RENDER_EXTERNAL_URL });
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}
