import type { Result } from "@bulktrack/shared-kernel";
import type { ExerciseId, Exercise, ExerciseTranslation } from "../exercise-full.entity";

/**
 * Port for exercise commands (write operations)
 * Following Interface Segregation Principle
 */
export interface ExerciseCommandPort {
  /**
   * Create a new exercise
   */
  create(exercise: Exercise): Promise<Result<void, Error>>;

  /**
   * Update exercise usage statistics
   */
  updateUsage(
    userId: string,
    exerciseId: ExerciseId,
    usedAt: Date,
    incrementUseCount?: boolean,
  ): Promise<Result<void, Error>>;
}