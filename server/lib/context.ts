import type { Role } from "../../shared/domain";
import type { Auth } from "../auth";
import type { Db } from "../db/client";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: "active" | "suspended";
}

export interface AppEnv {
  Variables: {
    requestId: string;
    db: Db;
    auth: Auth;
    user: SessionUser | null;
  };
}
