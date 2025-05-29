import { drizzle } from "drizzle-orm/d1";
import { ListRecentExercisesHandler } from "../../../../src/application/query/exercise/list-recent-exercises";
import { ExerciseService } from "../../../../src/domain/exercise/service";
import { DrizzleExerciseRepository } from "../../../../src/infrastructure/db/repository/exercise-repository";
import { FtsService } from "../../../../src/infrastructure/service/fts-service";
import type { WorkerEnv } from "../types/env";

export interface UserContainer {
  listRecentExercisesHandler: ListRecentExercisesHandler;
}

export function createUserContainer(env: WorkerEnv): UserContainer {
  const db = drizzle(env.DB);

  // Initialize services
  const ftsService = new FtsService(db);
  const exerciseRepository = new DrizzleExerciseRepository(db, ftsService);
  const exerciseService = new ExerciseService(exerciseRepository);

  // Initialize handlers
  const listRecentExercisesHandler = new ListRecentExercisesHandler(
    exerciseService,
  );

  return {
    listRecentExercisesHandler,
  };
}
