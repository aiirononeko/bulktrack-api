import {
  type DomainEventPublisher,
  type ExerciseIdVO,
  type Result,
  type UserIdVO,
  type WorkoutSetIdVO,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import type { TrainingSet } from "../../domain/training-set/entities/training-set";
import type { TrainingSetRepository } from "../../domain/training-set/training-set.repository";
import { Reps } from "../../domain/training-set/value-objects/reps";
import { RPE } from "../../domain/training-set/value-objects/rpe";
import type { Volume } from "../../domain/training-set/value-objects/volume";
import { Weight } from "../../domain/training-set/value-objects/weight";

export interface UpdateTrainingSetCommand {
  setId: string;
  userId: string;
  exerciseId?: string;
  weight?: number;
  reps?: number;
  rpe?: number | null;
  restSeconds?: number | null;
  notes?: string | null;
  performedAt?: Date;
}

export interface UpdateTrainingSetResult {
  id: WorkoutSetIdVO;
  exerciseId: ExerciseIdVO;
  userId: UserIdVO;
  weight: Weight;
  reps: Reps;
  rpe?: RPE;
  notes?: string;
  performedAt: Date;
  calculateVolume(): Volume;
}

export class UpdateTrainingSetUseCase {
  constructor(
    private trainingSetRepository: TrainingSetRepository,
    private eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    command: UpdateTrainingSetCommand,
  ): Promise<Result<TrainingSet, Error>> {
    // Fetch existing training set
    const trainingSetResult = await this.trainingSetRepository.findById(
      command.setId,
    );

    if (trainingSetResult.isErr()) {
      return err(trainingSetResult.error);
    }

    const trainingSet = trainingSetResult.unwrap();

    // Verify ownership
    if (trainingSet.userId.value !== command.userId) {
      return err(
        new Error("You don't have permission to update this training set"),
      );
    }

    // Update fields if provided
    if (command.weight !== undefined) {
      const weightResult = Weight.create(command.weight);
      if (weightResult.isErr()) {
        return err(weightResult.error);
      }
      trainingSet.updateWeight(weightResult.unwrap());
    }

    if (command.reps !== undefined) {
      const repsResult = Reps.create(command.reps);
      if (repsResult.isErr()) {
        return err(repsResult.error);
      }
      trainingSet.updateReps(repsResult.unwrap());
    }

    if (command.rpe !== undefined) {
      if (command.rpe === null) {
        trainingSet.updateRPE(undefined);
      } else {
        const rpeResult = RPE.create(command.rpe);
        if (rpeResult.isErr()) {
          return err(rpeResult.error);
        }
        trainingSet.updateRPE(rpeResult.unwrap());
      }
    }

    if (command.restSeconds !== undefined) {
      trainingSet.updateRestSeconds(command.restSeconds || undefined);
    }

    if (command.notes !== undefined) {
      trainingSet.updateNotes(command.notes || undefined);
    }

    if (command.performedAt !== undefined) {
      trainingSet.updatePerformedAt(command.performedAt);
    }

    // Save updated training set
    const saveResult = await this.trainingSetRepository.update(trainingSet);
    if (saveResult.isErr()) {
      return err(saveResult.error);
    }

    // Publish domain events
    const events = trainingSet.pullDomainEvents();
    for (const event of events) {
      await this.eventPublisher.publish(event);
    }

    return ok(trainingSet);
  }
}
