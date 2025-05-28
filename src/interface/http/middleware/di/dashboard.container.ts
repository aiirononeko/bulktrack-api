import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../../main.router"; // Adjust if AppEnv is moved

import { GetDashboardDataQueryHandler } from "../../../../app/query/dashboard/get-dashboard-data";
import { DashboardDataCompletionService } from "../../../../app/services/dashboard-data-completion.service";
import { DashboardMuscleGroupAggregationService } from "../../../../app/services/dashboard-muscle-group-aggregation.service";
import { DashboardRepository } from "../../../../infrastructure/db/repository/dashboard-repository";
import * as tablesSchema from "../../../../infrastructure/db/schema";

export function setupDashboardDependencies(
  env: AppEnv["Bindings"],
  c: Context<AppEnv>,
) {
  if (!env.DB) {
    console.error(
      "CRITICAL: Missing DB environment binding for dashboard services.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Dashboard",
    });
  }

  const db = drizzle(env.DB, { schema: tablesSchema });

  const dashboardRepository = new DashboardRepository(
    db as DrizzleD1Database<typeof tablesSchema>,
  );
  const dashboardQueryHandler = new GetDashboardDataQueryHandler(
    dashboardRepository,
  );
  const dashboardMuscleGroupAggregationService =
    new DashboardMuscleGroupAggregationService();
  const dashboardDataCompletionService = new DashboardDataCompletionService(
    dashboardRepository,
  );

  c.set("db", db);
  c.set("dashboardQueryHandler", dashboardQueryHandler);
  c.set(
    "dashboardMuscleGroupAggregationService",
    dashboardMuscleGroupAggregationService,
  );
  c.set("dashboardDataCompletionService", dashboardDataCompletionService);
}
