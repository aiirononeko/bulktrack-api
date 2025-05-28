import type { ExerciseIdVO, UserIdVO } from "../../shared/vo/identifier";

export interface IExerciseUsageRepository {
  recordUsage(
    userId: UserIdVO,
    exerciseId: ExerciseIdVO,
    performedDate: Date,
  ): Promise<void>;
}
