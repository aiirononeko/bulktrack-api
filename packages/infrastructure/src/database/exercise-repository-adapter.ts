import type { ExerciseRepository } from "@bulktrack/core";
import { type Result, ok } from "@bulktrack/shared-kernel";
import type { D1ExerciseRepositoryV2 } from "./d1-exercise-repository-v2";

/**
 * Adapter that wraps D1ExerciseRepositoryV2 to implement the domain ExerciseRepository interface.
 * This is a temporary solution until the architecture is clarified regarding which Exercise entity to use.
 */
export class ExerciseRepositoryAdapter implements ExerciseRepository {
  constructor(private readonly repository: D1ExerciseRepositoryV2) {}

  async findById(id: any): Promise<Result<any, Error>> {
    // Handle ExerciseId type - extract the value
    const exerciseId = id.getValue ? id.getValue() : id;

    // Create an object that matches what D1ExerciseRepositoryV2 expects
    const idParam = { getValue: () => exerciseId };

    // Delegate to the V2 repository
    const result = await this.repository.findById(idParam);

    // The RecordTrainingSetUseCase only checks if the exercise exists
    // So we just need to return whether it's found or not
    if (result.isOk() && result.getValue()) {
      // Return a minimal object that satisfies the check
      return ok({ id });
    }

    return result;
  }

  async search(params: any): Promise<Result<any[], Error>> {
    // This shouldn't be called by RecordTrainingSetUseCase
    return this.repository.search(params);
  }

  async findRecentByUserId(params: any): Promise<Result<any[], Error>> {
    // This shouldn't be called by RecordTrainingSetUseCase
    return this.repository.findRecentByUserId(params);
  }

  async save(exercise: any): Promise<Result<void, Error>> {
    return this.repository.save(exercise);
  }

  async delete(id: any): Promise<Result<void, Error>> {
    return this.repository.delete(id);
  }

  async updateUsage(
    userId: string,
    exerciseId: any,
  ): Promise<Result<void, Error>> {
    return this.repository.updateUsage(userId, exerciseId);
  }
}
