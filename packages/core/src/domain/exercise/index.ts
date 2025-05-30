// Entity exports
export {
  ExerciseId,
  ExerciseName as ExerciseNameEntity,
  ExerciseTranslation,
  ExerciseMuscle as ExerciseMuscleEntity,
  Exercise,
} from "./exercise.entity";
export {
  Exercise as ExerciseFull,
  type ExerciseTranslation as ExerciseFullTranslation,
} from "./exercise-full.entity";

// Repository exports
export type { ExerciseRepository } from "./exercise.repository";
export type { IExerciseRepository } from "./exercise-full.repository";

// Service exports
export * from "./exercise.service";

// Value object exports
export { ExerciseName } from "./value-objects/exercise-name";
export { ExerciseNameVO } from "./value-objects/exercise-name-vo";
export * from "./value-objects/exercise-muscle.vo";
export * from "./repositories/exercise-usage.repository";
