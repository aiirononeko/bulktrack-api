import type { Result } from "@bulktrack/shared-kernel";
import type { ExerciseId, Exercise, ExerciseTranslation } from "../exercise-full.entity";

/**
 * Port for administrative exercise operations (full CRUD)
 * Following Interface Segregation Principle
 * This interface is for admin/management use cases
 */
export interface ExerciseAdminPort {
  /**
   * Save (create or update) a complete exercise with all related data
   */
  saveFullExercise(exercise: Exercise): Promise<Result<void, Error>>;

  /**
   * Delete an exercise and all its related data
   */
  deleteFullExerciseById(exerciseId: ExerciseId): Promise<Result<void, Error>>;

  /**
   * Save or update exercise translation
   */
  saveExerciseTranslation(
    exerciseId: ExerciseId,
    translation: ExerciseTranslation,
  ): Promise<Result<void, Error>>;

  /**
   * Delete exercise translation for a specific locale
   */
  deleteExerciseTranslation(
    exerciseId: ExerciseId,
    locale: string,
  ): Promise<Result<void, Error>>;
}