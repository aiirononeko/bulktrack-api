import {
  type DomainEventPublisher,
  type Result,
  err,
  ok,
} from "@bulktrack/shared-kernel";
import type { TrainingSetRepository } from "../../domain/training-set/training-set.repository";

export interface DeleteTrainingSetCommand {
  setId: string;
  userId: string;
}

export class DeleteTrainingSetUseCase {
  constructor(
    private trainingSetRepository: TrainingSetRepository,
    private eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    command: DeleteTrainingSetCommand,
  ): Promise<Result<void, Error>> {
    // Fetch existing training set to verify ownership
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
        new Error("You don't have permission to delete this training set"),
      );
    }

    // Delete the training set
    const deleteResult = await this.trainingSetRepository.delete(
      command.setId,
      command.userId,
    );

    if (deleteResult.isErr()) {
      return err(deleteResult.error);
    }

    // TODO: Publish domain event if needed (TrainingSetDeleted)
    // For now, we'll skip this as the domain doesn't have delete events yet

    return ok(undefined);
  }
}
