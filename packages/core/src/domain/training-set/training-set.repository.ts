import type { Result, WorkoutSetIdVO } from "@bulktrack/shared-kernel";
import type { TrainingSet } from "./entities/training-set";

export interface TrainingSetRepository {
  save(trainingSet: TrainingSet): Promise<Result<void, Error>>;

  findById(id: string): Promise<Result<TrainingSet, Error>>;

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

  update(trainingSet: TrainingSet): Promise<Result<void, Error>>;

  delete(id: string, userId: string): Promise<Result<void, Error>>;
}
