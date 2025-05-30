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

// Repository exports (legacy - to be removed)
// These are deprecated and replaced by the port interfaces below

// Port exports (ISP compliant interfaces)
export type { ExerciseQueryPort, SearchParams, RecentExerciseParams } from "./ports/exercise-query.port";
export type { ExerciseCommandPort } from "./ports/exercise-command.port";
export type { ExerciseAdminPort } from "./ports/exercise-admin.port";

// Service exports
export * from "./exercise.service";

// Value object exports
export { ExerciseName } from "./value-objects/exercise-name";
export { ExerciseNameVO } from "./value-objects/exercise-name-vo";
export * from "./value-objects/exercise-muscle.vo";
export * from "./repositories/exercise-usage.repository";
