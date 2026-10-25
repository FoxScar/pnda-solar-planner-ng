import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Db } from "./db/client";
import * as schema from "./db/schema";

export interface AuthConfig {
  db: Db;
  secret: string;
  baseURL: string;
  trustedOrigins?: string[];
}

export function createAuth({ db, secret, baseURL, trustedOrigins = [] }: AuthConfig) {
  return betterAuth({
    secret,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [baseURL, ...trustedOrigins],
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8, // PRD §20.1
    },
    databaseHooks: {
      user: {
        create: {
          // Every account starts as a consumer. Roles are only raised by an admin.
          after: async (created) => {
            await db
              .insert(schema.userProfiles)
              .values({ userId: created.id, role: "consumer" })
              .onConflictDoNothing();
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
