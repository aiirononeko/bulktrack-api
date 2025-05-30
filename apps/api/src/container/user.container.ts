import { ListRecentExercisesUseCase } from "@bulktrack/core";
import { ExerciseRepository } from "@bulktrack/infrastructure";
import { drizzle } from "drizzle-orm/d1";
import type { WorkerEnv } from "../types/env";

export interface UserContainer {
  listRecentExercisesUseCase: ListRecentExercisesUseCase;
}

export function createUserContainer(env: WorkerEnv): UserContainer {
  const db = drizzle(env.DB);

  // Initialize repositories
  const exerciseRepository = new ExerciseRepository(env.DB);

  // Initialize use cases
  const listRecentExercisesUseCase = new ListRecentExercisesUseCase(
    exerciseRepository,
  );

  return {
    listRecentExercisesUseCase,
  };
}
