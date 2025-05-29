import {
  type ExerciseRepository,
  RecordTrainingSetUseCase,
  type TrainingSetRepository,
} from "@bulktrack/core";
import {
  CloudflareQueueEventPublisher,
  D1TrainingSetRepository,
} from "@bulktrack/infrastructure";
import type { WorkerEnv } from "./types/env";

export interface Container {
  // Repositories
  trainingSetRepository: TrainingSetRepository;
  exerciseRepository: ExerciseRepository;

  // Use Cases
  recordTrainingSetUseCase: RecordTrainingSetUseCase;
}

export function createContainer(env: WorkerEnv): Container {
  // Initialize repositories
  const trainingSetRepository = new D1TrainingSetRepository(env.DB);
  // TODO: Implement D1ExerciseRepository
  const exerciseRepository = {} as ExerciseRepository; // Placeholder

  // Initialize event publisher
  const eventPublisher = new CloudflareQueueEventPublisher({
    VOLUME_AGGREGATION_QUEUE: env.VOLUME_AGGREGATION_QUEUE,
    AI_ANALYSIS_QUEUE: env.AI_ANALYSIS_QUEUE,
    WEBHOOK_NOTIFICATIONS_QUEUE: env.WEBHOOK_NOTIFICATIONS_QUEUE,
  });

  // Initialize use cases
  const recordTrainingSetUseCase = new RecordTrainingSetUseCase(
    trainingSetRepository,
    exerciseRepository,
    eventPublisher,
  );

  return {
    // Repositories
    trainingSetRepository,
    exerciseRepository,

    // Use Cases
    recordTrainingSetUseCase,
  };
}
