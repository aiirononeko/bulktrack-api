import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { jwtAuthMiddleware } from "../../middleware/auth.middleware";
import { setupDashboardDependencies } from "../../middleware/di/dashboard.container";
import { getDashboardStatsHandler } from "./dashboard.handlers";

const dashboardApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this dashboard module
dashboardApp.use("*", async (c, next) => {
  setupDashboardDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all dashboard routes
dashboardApp.use("*", jwtAuthMiddleware);

// Define dashboard routes
dashboardApp.get("/", getDashboardStatsHandler);

export default dashboardApp;
