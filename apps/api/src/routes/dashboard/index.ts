import { Hono } from "hono";
import type { Variables, WorkerEnv } from "../../types/env";
import { triggerAggregation } from "./debug-aggregation";
import { getDashboard } from "./handlers";

export const dashboardRoutes = new Hono<{
  Bindings: WorkerEnv;
  Variables: Variables;
}>();

// GET /dashboard - Get dashboard data
dashboardRoutes.get("/", getDashboard);

// POST /dashboard/debug-aggregation - Manually trigger aggregation (dev only)
// TODO: Remove this endpoint in production
dashboardRoutes.post("/debug-aggregation", triggerAggregation);
