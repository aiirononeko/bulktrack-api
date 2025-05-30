import type { Result } from "@bulktrack/shared-kernel";
import type { ExerciseId } from "../exercise-full.entity";
import type { Exercise } from "../exercise-full.entity";

export interface SearchParams {
  query: string | null;
  locale: string;
  limit?: number;
  offset?: number;
}

export interface RecentExerciseParams {
  userId: string;
  locale: string;
  limit?: number;
  offset?: number;
}

/**
 * Port for querying exercises (read operations)
 * Following Interface Segregation Principle
 */
export interface ExerciseQueryPort {
  /**
   * Find an exercise by its ID
   */
  findById(id: ExerciseId): Promise<Result<Exercise | null, Error>>;

  /**
   * Search exercises by query string
   */
  search(params: SearchParams): Promise<Result<Exercise[], Error>>;

  /**
   * Find exercises recently used by a user
   */
  findRecentByUserId(
    params: RecentExerciseParams,
  ): Promise<Result<Exercise[], Error>>;
}