import {
  ActivateDeviceUseCase,
  type DeviceRepository,
  type ExerciseRepository,
  ListRecentExercisesUseCase,
  RecordTrainingSetUseCase,
  SearchExercisesUseCase,
  type TrainingSetRepository,
  type UserRepository,
} from "@bulktrack/core";
import {
  CloudflareQueueEventPublisher,
  D1DeviceRepository,
  D1ExerciseRepository,
  D1TrainingSetRepository,
  D1UserRepository,
  JwtService,
  TokenRepository,
} from "@bulktrack/infrastructure";
import { AuthHandlers } from "./routes/auth/handlers";
import { ExerciseHandlers } from "./routes/exercise/handlers";
import type { WorkerEnv } from "./types/env";

export interface Container {
  // Repositories
  trainingSetRepository: TrainingSetRepository;
  exerciseRepository: ExerciseRepository;
  userRepository: UserRepository;
  deviceRepository: DeviceRepository;
  tokenRepository: TokenRepository;

  // Services
  jwtService: JwtService;

  // Use Cases
  recordTrainingSetUseCase: RecordTrainingSetUseCase;
  activateDeviceUseCase: ActivateDeviceUseCase;
  searchExercisesUseCase: SearchExercisesUseCase;
  listRecentExercisesUseCase: ListRecentExercisesUseCase;

  // Handlers
  authHandlers: AuthHandlers;
  exerciseHandlers: ExerciseHandlers;
}

export function createContainer(env: WorkerEnv): Container {
  // Initialize repositories
  const trainingSetRepository = new D1TrainingSetRepository(env.DB);
  const exerciseRepository = new D1ExerciseRepository(env.DB);
  const userRepository = new D1UserRepository(env.DB);
  const deviceRepository = new D1DeviceRepository(env.DB);
  const tokenRepository = new TokenRepository(env.REFRESH_TOKEN_STORE);

  // Initialize services
  const jwtService = new JwtService({ secret: env.JWT_SECRET });

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

  const activateDeviceUseCase = new ActivateDeviceUseCase(
    deviceRepository,
    userRepository,
  );

  const searchExercisesUseCase = new SearchExercisesUseCase(exerciseRepository);

  const listRecentExercisesUseCase = new ListRecentExercisesUseCase(
    exerciseRepository,
  );

  // Initialize handlers
  const authHandlers = new AuthHandlers(
    activateDeviceUseCase,
    jwtService,
    tokenRepository,
  );

  const exerciseHandlers = new ExerciseHandlers(
    searchExercisesUseCase,
    listRecentExercisesUseCase,
  );

  return {
    // Repositories
    trainingSetRepository,
    exerciseRepository,
    userRepository,
    deviceRepository,
    tokenRepository,

    // Services
    jwtService,

    // Use Cases
    recordTrainingSetUseCase,
    activateDeviceUseCase,
    searchExercisesUseCase,
    listRecentExercisesUseCase,

    // Handlers
    authHandlers,
    exerciseHandlers,
  };
}
