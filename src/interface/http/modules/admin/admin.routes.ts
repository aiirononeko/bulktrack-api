import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { setupAdminDependencies } from "../../middleware/di/admin.container";
import { populateFtsHandler } from "./admin.handlers";

const adminApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this admin module
adminApp.use("*", async (c, next) => {
  console.log("Applying admin DI middleware in admin.routes.ts");
  setupAdminDependencies(c.env, c);
  await next();
  console.log("Exited admin DI middleware in admin.routes.ts");
});

// TODO: Determine and apply appropriate authentication for admin routes.
// For example, if admin actions require standard user JWT:
// adminApp.use('*', jwtAuthMiddleware);
// Or if it's a separate admin auth, that middleware would be used here.
// If it's protected by other means (e.g. Cloudflare Access, IP Whitelisting), no JWT auth here.

// Define admin routes
adminApp.post("/fts/populate", populateFtsHandler);

export default adminApp;
