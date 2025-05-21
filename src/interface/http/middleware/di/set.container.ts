import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { drizzle } from 'drizzle-orm/d1';
import type { AppEnv } from '../../main.router'; // Adjust if AppEnv is moved

import * as tablesSchema from '../../../../infrastructure/db/schema';
import { WorkoutService as AppWorkoutService } from "../../../../application/services/workout.service";
import { DrizzleWorkoutSetRepository } from "../../../../infrastructure/db/repository/workout-set-repository";
import { DrizzleExerciseUsageRepository } from "../../../../infrastructure/db/repository/drizzle-exercise-usage-repository";
import { DashboardStatsService } from '../../../../app/services/dashboard-stats-service';

export function setupSetDependencies(env: AppEnv['Bindings'], c: Context<AppEnv>) {
  if (!env.DB) {
    console.error("CRITICAL: Missing DB environment binding for set services.");
    throw new HTTPException(500, { message: "Internal Server Configuration Error for Sets" });
  }
  const db = drizzle(env.DB, { schema: tablesSchema });

  const workoutSetRepository = new DrizzleWorkoutSetRepository(db, tablesSchema);
  const exerciseUsageRepository = new DrizzleExerciseUsageRepository(db);
  
  const appWorkoutService = new AppWorkoutService(workoutSetRepository, exerciseUsageRepository);
  c.set("workoutService", appWorkoutService);

  const statsUpdateService = new DashboardStatsService(db);
  c.set("statsUpdateService", statsUpdateService);
  
  // Make db available if other set handlers need it directly
  c.set("db", db);
}
