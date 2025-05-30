import {
  type DomainEventPublisher,
  type Result,
  UseCaseError,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import { ExerciseIdVO } from "../domain/shared/value-objects/identifier";
import type { ExerciseQueryPort } from "../domain/exercise/ports/exercise-query.port";
import { TrainingSet } from "../domain/training-set/entities/training-set";
import type { TrainingSetRepository } from "../domain/training-set/training-set.repository";

export interface RecordTrainingSetCommand {
  userId: string;
  exerciseId: string;
  weight: number;
  reps: number;
  rpe?: number;
  restSeconds?: number;
  notes?: string;
  performedAt?: Date;
}

export interface RecordTrainingSetResult {
  setId: string;
  volume: number;
}

/**
 * Use case for recording a new training set
 * Orchestrates the business logic and domain events
 */
export class RecordTrainingSetUseCase {
  constructor(
    private readonly trainingSetRepository: TrainingSetRepository,
    private readonly exerciseRepository: ExerciseQueryPort,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    command: RecordTrainingSetCommand,
  ): Promise<Result<RecordTrainingSetResult, UseCaseError>> {
    try {
      console.log("RecordTrainingSet command:", command);

      // Verify exercise exists
      const exerciseResult = await this.exerciseRepository.findById(
        new ExerciseIdVO(command.exerciseId),
      );
      console.log("Exercise lookup result:", exerciseResult);

      if (exerciseResult.isErr()) {
        return err(
          new UseCaseError(
            "RecordTrainingSet",
            "Failed to verify exercise existence",
            { error: exerciseResult.error },
          ),
        );
      }

      if (!exerciseResult.unwrap()) {
        return err(
          new UseCaseError("RecordTrainingSet", "Exercise not found", {
            exerciseId: command.exerciseId,
          }),
        );
      }

      // Create training set
      console.log("Creating training set...");
      const trainingSetResult = TrainingSet.create({
        userId: command.userId,
        exerciseId: command.exerciseId,
        weight: command.weight,
        reps: command.reps,
        rpe: command.rpe,
        restSeconds: command.restSeconds,
        notes: command.notes,
        performedAt: command.performedAt,
      });

      if (trainingSetResult.isErr()) {
        console.error("Training set creation failed:", trainingSetResult.error);
        return err(
          new UseCaseError(
            "RecordTrainingSet",
            "Failed to create training set",
            { error: trainingSetResult.error.message },
          ),
        );
      }

      const trainingSet = trainingSetResult.unwrap();
      console.log("Training set created:", trainingSet.id.value);

      // Save to repository
      console.log("Saving to repository...");
      const saveResult = await this.trainingSetRepository.save(trainingSet);
      if (saveResult.isErr()) {
        console.error("Save failed:", saveResult.error);
        return err(
          new UseCaseError("RecordTrainingSet", "Failed to save training set", {
            error: saveResult.error,
          }),
        );
      }
      console.log("Training set saved successfully");

      // Publish domain events
      console.log("Publishing domain events...");
      const events = trainingSet.domainEvents;
      for (const event of events) {
        await this.eventPublisher.publish(event);
      }
      console.log("Domain events published");

      // Clear events after publishing
      trainingSet.clearDomainEvents();

      return ok({
        setId: trainingSet.id.value,
        volume: trainingSet.calculateVolume().value,
      });
    } catch (error) {
      console.error("RecordTrainingSet error:", error);
      return err(
        new UseCaseError("RecordTrainingSet", "Unexpected error occurred", {
          error: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        }),
      );
    }
  }
}
