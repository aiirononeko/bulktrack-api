import { drizzle } from "drizzle-orm/d1";
import { SearchExercisesHandler } from "../../../../src/application/query/exercise/search-exercise";
import { ExerciseService } from "../../../../src/domain/exercise/service";
import { DrizzleExerciseRepository } from "../../../../src/infrastructure/db/repository/exercise-repository";
import { FtsService } from "../../../../src/infrastructure/service/fts-service";
import type { WorkerEnv } from "../types/env";

export interface ExerciseContainer {
  searchExercisesHandler: SearchExercisesHandler;
}

export function createExerciseContainer(env: WorkerEnv): ExerciseContainer {
  const db = drizzle(env.DB);

  // Initialize services
  const ftsService = new FtsService(db);
  const exerciseRepository = new DrizzleExerciseRepository(db, ftsService);
  const exerciseService = new ExerciseService(exerciseRepository);

  // Initialize handlers
  const searchExercisesHandler = new SearchExercisesHandler(exerciseService);

  return {
    searchExercisesHandler,
  };
}
