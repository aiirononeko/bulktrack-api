import { SearchExercisesUseCase } from "@bulktrack/core";
import { D1ExerciseRepositoryV2 } from "@bulktrack/infrastructure";
import { drizzle } from "drizzle-orm/d1";
import type { WorkerEnv } from "../types/env";

export interface ExerciseContainer {
  searchExercisesUseCase: SearchExercisesUseCase;
}

export function createExerciseContainer(env: WorkerEnv): ExerciseContainer {
  const db = drizzle(env.DB);

  // Initialize repositories
  const exerciseRepository = new D1ExerciseRepositoryV2(env.DB);

  // Initialize use cases
  const searchExercisesUseCase = new SearchExercisesUseCase(exerciseRepository);

  return {
    searchExercisesUseCase,
  };
}
