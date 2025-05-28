import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { setupAdminDependencies } from "../../middleware/di/admin.container";
// Admin routes might have different auth, e.g., an admin-specific JWT or API key.
// For now, let's assume they might also use the standard jwtAuthMiddleware or none if IP restricted etc.
// import { jwtAuthMiddleware } from '../../middleware/auth.middleware';

// Assuming createPopulateFtsHandler configures routes on the passed Hono app
import { createPopulateFtsHandler } from "../../handlers/admin/populateFtsHandler";

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

// Configure admin routes using the existing handler setup function
createPopulateFtsHandler(adminApp);

export default adminApp;
