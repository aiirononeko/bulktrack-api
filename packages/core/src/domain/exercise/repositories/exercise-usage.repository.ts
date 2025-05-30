import type {
  ExerciseIdVO,
  UserIdVO,
} from "../../shared/value-objects/identifier";

export interface IExerciseUsageRepository {
  recordUsage(
    userId: UserIdVO,
    exerciseId: ExerciseIdVO,
    performedDate: Date,
  ): Promise<void>;
}
