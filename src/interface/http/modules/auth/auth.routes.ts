import { Hono } from "hono";
import type { AppEnv } from "../../main.router"; // Assuming AppEnv is in main.router.ts
import { setupAuthDependencies } from "../../middleware/di/auth.container";

// Import existing handlers. Paths might need adjustment based on final handler locations.
// These are assumed to be Hono instances themselves, as per original app.route() usage.
import deviceAuthRoutes from "../../handlers/auth/device";
import refreshAuthRoutes from "../../handlers/auth/refresh";
// Note: jwtAuthMiddleware is typically applied *selectively* to routes that require authentication.
// Auth routes like /login or /register usually don't have JWT auth.
// /refresh might or might not, depending on design. /device activation likely doesn't.

const authApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this auth module
authApp.use("*", async (c, next) => {
  setupAuthDependencies(c.env, c);
  await next();
});

// Mount the existing handler modules.
// The original router.ts did:
// app.route("/v1/auth", deviceAuthRoutes);
// app.route("/v1/auth", refreshAuthRoutes);
// This means both were mounted at the same base path "/v1/auth".
// Hono allows multiple sub-apps on the same path prefix; routes are matched in order of registration.
// So, if deviceAuthRoutes has e.g. POST /activate and refreshAuthRoutes has POST /token,
// they will be distinct.
authApp.route("/", deviceAuthRoutes); // Mounted at the root of authApp (e.g., /v1/auth/device-routes...)
authApp.route("/", refreshAuthRoutes); // Mounted at the root of authApp (e.g., /v1/auth/refresh-routes...)

export default authApp;
