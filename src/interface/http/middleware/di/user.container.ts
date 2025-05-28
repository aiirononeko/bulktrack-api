import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../../main.router"; // Adjust if AppEnv is moved

import { ListRecentExercisesHandler } from "../../../../application/query/exercise/list-recent-exercises";
import { ExerciseService } from "../../../../domain/exercise/service";
import { DrizzleExerciseRepository } from "../../../../infrastructure/db/repository/exercise-repository";
import * as tablesSchema from "../../../../infrastructure/db/schema";

export function setupUserDependencies(
  env: AppEnv["Bindings"],
  c: Context<AppEnv>,
) {
  if (!env.DB) {
    console.error(
      "CRITICAL: Missing DB environment binding for /v1/me services.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for User Services",
    });
  }
  const db = drizzle(env.DB, { schema: tablesSchema });
  const exerciseRepository = new DrizzleExerciseRepository(db, tablesSchema);
  const exerciseService = new ExerciseService(exerciseRepository);

  // Handler for recent exercises under /v1/me
  const listRecentExercisesHandler = new ListRecentExercisesHandler(
    exerciseService,
  );
  c.set("listRecentExercisesHandler", listRecentExercisesHandler);

  // Make db available if other /v1/me handlers need it directly
  c.set("db", db);

  // Add other dependencies for /v1/me/* routes here if needed in the future
}
