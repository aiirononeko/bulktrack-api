import {
  ActivateDeviceUseCase,
  type DashboardRepository,
  DeleteTrainingSetUseCase,
  type DeviceRepository,
  GetDashboardQuery,
  GetWorkoutDetailQuery,
  GetWorkoutSummariesQuery,
  ListRecentExercisesUseCase,
  RecordTrainingSetUseCase,
  SearchExercisesUseCase,
  type TrainingSetRepository,
  UpdateTrainingSetUseCase,
  type UserRepository,
} from "@bulktrack/core";
import {
  CloudflareQueueEventPublisher,
  D1DashboardRepository,
  D1DeviceRepository,
  ExerciseRepository,
  D1TrainingSetRepository,
  D1UserRepository,
  JwtService,
  KvTokenRepository,
  type TokenRepository,
} from "@bulktrack/infrastructure";
import { dbSchema as schema } from "@bulktrack/infrastructure";
import { drizzle } from "drizzle-orm/d1";
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
  dashboardRepository: DashboardRepository;

  // Services
  jwtService: JwtService;

  // Use Cases
  recordTrainingSetUseCase: RecordTrainingSetUseCase;
  updateTrainingSetUseCase: UpdateTrainingSetUseCase;
  deleteTrainingSetUseCase: DeleteTrainingSetUseCase;
  activateDeviceUseCase: ActivateDeviceUseCase;
  searchExercisesUseCase: SearchExercisesUseCase;
  listRecentExercisesUseCase: ListRecentExercisesUseCase;
  getDashboardQuery: GetDashboardQuery;
  getWorkoutSummariesQuery: GetWorkoutSummariesQuery;
  getWorkoutDetailQuery: GetWorkoutDetailQuery;

  // Handlers
  authHandlers: AuthHandlers;
  exerciseHandlers: ExerciseHandlers;
}

export function createContainer(env: WorkerEnv): Container {
  // Initialize repositories
  const trainingSetRepository = new D1TrainingSetRepository(env.DB);
  const exerciseRepository = new ExerciseRepository(env.DB);
  const userRepository = new D1UserRepository(env.DB);
  const deviceRepository = new D1DeviceRepository(env.DB);
  const tokenRepository = new KvTokenRepository(env.REFRESH_TOKENS_KV);
  const dashboardRepository = new D1DashboardRepository(env.DB);

  // Initialize services
  const jwtService = new JwtService({
    secret: env.JWT_SECRET,
    accessTokenTtl: 900, // 15 minutes
    refreshTokenTtl: 2592000, // 30 days
  });

  // Initialize event publisher
  const eventPublisher = new CloudflareQueueEventPublisher({
    VOLUME_AGGREGATION_QUEUE: env.VOLUME_AGGREGATION_QUEUE as any,
    AI_ANALYSIS_QUEUE: env.AI_ANALYSIS_QUEUE as any,
    WEBHOOK_NOTIFICATIONS_QUEUE: env.WEBHOOK_NOTIFICATIONS_QUEUE as any,
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

  const updateTrainingSetUseCase = new UpdateTrainingSetUseCase(
    trainingSetRepository,
    eventPublisher,
  );

  const deleteTrainingSetUseCase = new DeleteTrainingSetUseCase(
    trainingSetRepository,
    eventPublisher,
  );

  const getDashboardQuery = new GetDashboardQuery(dashboardRepository);

  // Create proper DB instance
  const db = drizzle(env.DB);

  // Pass the raw DB and schema for now - these queries need refactoring
  const getWorkoutSummariesQuery = new GetWorkoutSummariesQuery(
    db as any,
    schema,
  );

  const getWorkoutDetailQuery = new GetWorkoutDetailQuery(db as any, schema);

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
    dashboardRepository,

    // Services
    jwtService,

    // Use Cases
    recordTrainingSetUseCase,
    updateTrainingSetUseCase,
    deleteTrainingSetUseCase,
    activateDeviceUseCase,
    searchExercisesUseCase,
    listRecentExercisesUseCase,
    getDashboardQuery,
    getWorkoutSummariesQuery,
    getWorkoutDetailQuery,

    // Handlers
    authHandlers,
    exerciseHandlers,
  };
}
