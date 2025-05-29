import type { Result } from "@bulktrack/shared-kernel";
import type { Exercise, ExerciseId } from "./exercise.entity";

export interface SearchParams {
  query: string;
  locale: string;
  limit?: number;
  offset?: number;
}

export interface RecentExerciseParams {
  userId: string;
  muscleId?: string;
  limit?: number;
  offset?: number;
}

export interface ExerciseRepository {
  findById(id: ExerciseId): Promise<Result<Exercise | null, Error>>;

  search(params: SearchParams): Promise<Result<Exercise[], Error>>;

  findRecentByUserId(
    params: RecentExerciseParams,
  ): Promise<Result<Exercise[], Error>>;

  save(exercise: Exercise): Promise<Result<void, Error>>;

  delete(id: ExerciseId): Promise<Result<void, Error>>;

  updateUsage(
    userId: string,
    exerciseId: ExerciseId,
  ): Promise<Result<void, Error>>;
}
