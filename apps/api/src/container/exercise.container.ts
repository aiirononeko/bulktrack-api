import { SearchExercisesUseCase } from "@bulktrack/core";
import { ExerciseRepository } from "@bulktrack/infrastructure";
import { drizzle } from "drizzle-orm/d1";
import type { WorkerEnv } from "../types/env";

export interface ExerciseContainer {
  searchExercisesUseCase: SearchExercisesUseCase;
}

export function createExerciseContainer(env: WorkerEnv): ExerciseContainer {
  const db = drizzle(env.DB);

  // Initialize repositories
  const exerciseRepository = new ExerciseRepository(env.DB);

  // Initialize use cases
  const searchExercisesUseCase = new SearchExercisesUseCase(exerciseRepository);

  return {
    searchExercisesUseCase,
  };
}
