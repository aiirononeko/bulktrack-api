import { drizzle } from "drizzle-orm/d1";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../../main.router"; // Adjust if AppEnv is moved

import { ListRecentExercisesHandler } from "../../../../app/query/exercise/list-recent-exercises"; // For /me/exercises/recent
import { SearchExercisesHandler } from "../../../../app/query/exercise/search-exercise";
import { ExerciseService } from "../../../../domain/exercise/service";
import { DrizzleExerciseRepository } from "../../../../infrastructure/db/repository/exercise-repository";
import * as tablesSchema from "../../../../infrastructure/db/schema";

export function setupExerciseDependencies(
  env: AppEnv["Bindings"],
  c: Context<AppEnv>,
) {
  if (!env.DB) {
    console.error(
      "CRITICAL: Missing DB environment binding for exercise services.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Exercises",
    });
  }
  const db = drizzle(env.DB, { schema: tablesSchema });
  const exerciseRepository = new DrizzleExerciseRepository(db, tablesSchema);
  const exerciseService = new ExerciseService(exerciseRepository);

  // For /v1/exercises (search)
  const searchExercisesHandler = new SearchExercisesHandler(exerciseService);
  c.set("searchExercisesHandler", searchExercisesHandler);

  // For general exercise operations if needed by other handlers under /v1/exercises
  c.set("exerciseService", exerciseService);

  // For /v1/me/exercises/recent
  const listRecentExercisesHandler = new ListRecentExercisesHandler(
    exerciseService,
  );
  c.set("listRecentExercisesHandler", listRecentExercisesHandler);

  // Make db available if other exercise handlers need it directly, though ideally they use services
  c.set("db", db);
}
