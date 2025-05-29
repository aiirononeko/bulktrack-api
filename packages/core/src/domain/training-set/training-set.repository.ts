import type { Result, WorkoutSetIdVO } from "@bulktrack/shared-kernel";
import type { TrainingSet } from "./entities/training-set";

export interface TrainingSetRepository {
  save(trainingSet: TrainingSet): Promise<Result<void, Error>>;

  findById(id: WorkoutSetIdVO): Promise<Result<TrainingSet | null, Error>>;

  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<Result<TrainingSet[], Error>>;

  findByExerciseId(
    exerciseId: string,
    options?: {
      limit?: number;
      offset?: number;
    },
  ): Promise<Result<TrainingSet[], Error>>;
}
