import {
  type DomainEventPublisher,
  ExerciseIdVO,
  type Result,
  UseCaseError,
  WorkoutSetIdVO,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import type { ExerciseRepository } from "../domain/exercise/exercise.repository";
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
    private readonly exerciseRepository: ExerciseRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    command: RecordTrainingSetCommand,
  ): Promise<Result<RecordTrainingSetResult, UseCaseError>> {
    try {
      // Verify exercise exists
      const { ExerciseId } = await import("../domain/exercise");
      const exerciseResult = await this.exerciseRepository.findById(
        ExerciseId.create(command.exerciseId),
      );

      if (exerciseResult.isFailure()) {
        return err(
          new UseCaseError(
            "RecordTrainingSet",
            "Failed to verify exercise existence",
            { error: exerciseResult.getError() },
          ),
        );
      }

      if (!exerciseResult.getValue()) {
        return err(
          new UseCaseError("RecordTrainingSet", "Exercise not found", {
            exerciseId: command.exerciseId,
          }),
        );
      }

      // Create training set
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

      if (trainingSetResult.isFailure()) {
        return err(
          new UseCaseError(
            "RecordTrainingSet",
            "Failed to create training set",
            { error: trainingSetResult.getError().message },
          ),
        );
      }

      const trainingSet = trainingSetResult.getValue();

      // Save to repository
      const saveResult = await this.trainingSetRepository.save(trainingSet);
      if (saveResult.isFailure()) {
        return err(
          new UseCaseError("RecordTrainingSet", "Failed to save training set", {
            error: saveResult.getError(),
          }),
        );
      }

      // Publish domain events
      const events = trainingSet.domainEvents;
      for (const event of events) {
        await this.eventPublisher.publish(event);
      }

      // Clear events after publishing
      trainingSet.clearDomainEvents();

      return ok({
        setId: trainingSet.id.value,
        volume: trainingSet.calculateVolume().value,
      });
    } catch (error) {
      return err(
        new UseCaseError("RecordTrainingSet", "Unexpected error occurred", {
          error: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }
}
