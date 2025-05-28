import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { jwtAuthMiddleware } from "../../middleware/auth.middleware";
import { setupDashboardDependencies } from "../../middleware/di/dashboard.container";

// Assuming dashboardStatsApp from the original handlers is a Hono sub-application
import dashboardStatsApp from "../../handlers/dashboard/stats";

const dashboardApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this dashboard module
dashboardApp.use("*", async (c, next) => {
  setupDashboardDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all dashboard routes
dashboardApp.use("*", jwtAuthMiddleware);

// Mount the existing dashboard stats handler app
// Original: dashboardRoutes.route("/", dashboardStatsApp);
// This means dashboardStatsApp handles routes relative to /v1/dashboard/
// For example, if dashboardStatsApp has a GET '/summary', it becomes GET /v1/dashboard/summary
dashboardApp.route("/", dashboardStatsApp);

export default dashboardApp;
