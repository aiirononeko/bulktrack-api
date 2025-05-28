import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../../main.router"; // Adjust if AppEnv is moved

import * as tablesSchema from "../../../../infrastructure/db/schema";
import { FtsService as AppFtsService } from "../../../../infrastructure/service/fts-service";

export function setupAdminDependencies(
  env: AppEnv["Bindings"],
  c: Context<AppEnv>,
) {
  console.log("Entered setupAdminDependencies for /v1/admin/*");
  if (!env.DB) {
    console.error(
      "CRITICAL: Missing DB environment binding for admin services.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Admin Services",
    });
  }
  const db = drizzle(env.DB, { schema: tablesSchema });
  const ftsService = new AppFtsService(db);
  c.set("ftsService", ftsService);
  console.log(
    "FtsService set in context for /v1/admin/* by setupAdminDependencies",
  );
}
