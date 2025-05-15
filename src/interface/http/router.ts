import { Hono, type Next, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { StatusCode } from "hono/utils/http-status";
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { jwt } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import * as v from 'valibot'; // valibot をインポート

import { ApplicationError } from "../../app/errors";

import deviceAuthRoutes from "./handlers/auth/device";
import refreshAuthRoutes from "./handlers/auth/refresh";

import { ActivateDeviceCommand } from "../../app/command/auth/activate-device-command";
import { RefreshTokenCommand } from "../../app/command/auth/refresh-token-command";
import { AuthService as DomainAuthService } from "../../domain/auth/service";

// --- DI Setup ---
// Import services and commands
import { JwtServiceImpl } from "../../infrastructure/auth/jwt-service";
import { DeviceRepositoryImpl } from "../../infrastructure/db/repository/device-repository";
import { UserRepositoryImpl } from "../../infrastructure/db/repository/user-repository";
import { KvTokenStoreImpl } from "../../infrastructure/kv/token-store";

import { DrizzleExerciseRepository } from "../../infrastructure/db/repository/exercise-repository";
import * as tablesSchema from "../../infrastructure/db/schema";
import { ExerciseService } from "../../domain/exercise/service";
import { SearchExercisesHandler } from "../../app/query/exercise/search-exercise";
import { createSearchExercisesHandler } from "./handlers/exercise/search";
import { ListRecentExercisesHandler } from "../../app/query/exercise/list-recent-exercises";
import { createListRecentExercisesHandler } from "./handlers/exercise/list-recent";

import { startSessionHttpHandler } from "./handlers/session/start";
import { StartSessionHandler } from "../../app/command/session/start-session";
import { FinishSessionCommand, FinishSessionHandler } from "../../app/command/session/finish-session";
import { AddSetToSessionCommand, AddSetToSessionHandler } from "../../app/command/session/add-set-to-session"; // AddSetToSession をインポート
import { WorkoutSessionService } from "../../domain/workout/service";
import { WorkoutService as AppWorkoutService } from "../../application/services/workout.service"; // Renamed to avoid conflict
import { DrizzleWorkoutSessionRepository } from "../../infrastructure/db/repository/workout-session-repository";
import { UserIdVO, WorkoutSessionIdVO, ExerciseIdVO } from "../../domain/shared/vo/identifier"; // ExerciseIdVO をインポート
import { AddSetRequestSchema } from "../../app/dto/set.dto";
import { AggregationService } from "../../app/services/aggregation-service";

// Import Dashboard specific items
import dashboardStatsApp from "./handlers/dashboard/stats";
import { GetDashboardDataQueryHandler } from "../../app/query/dashboard/get-dashboard-data";
import { DashboardRepository } from "../../infrastructure/db/repository/dashboard-repository";

import { updateSetHttpHandler } from "./handlers/session/update-set"; // Import the new handler
import { deleteSetHttpHandler } from "./handlers/session/delete-set"; // deleteSetHttpHandler をインポート

// Define types for c.var
export type AppEnv = {
  Variables: {
    activateDeviceCommand: ActivateDeviceCommand;
    refreshTokenCommand: RefreshTokenCommand;
    searchExercisesHandler: SearchExercisesHandler;
    listRecentExercisesHandler?: ListRecentExercisesHandler;
    startSessionHandler: StartSessionHandler;
    finishSessionHandler: FinishSessionHandler;
    addSetToSessionHandler: AddSetToSessionHandler;
    workoutService?: AppWorkoutService; // Added workoutService
    db?: DrizzleD1Database<typeof tablesSchema>; // For general DB access if needed by handlers
    dashboardQueryHandler?: GetDashboardDataQueryHandler; // Specifically for dashboard
    jwtPayload?: JWTPayload; // Added jwtPayload for JWT middleware
    // userId?: string; // Removed direct userId if jwtPayload is used as source
  };
  // Define CloudflareBindings if not already globally defined
  // This usually comes from a .d.ts file (e.g. hono/bindings or custom)
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    REFRESH_TOKENS_KV: KVNamespace;
    // Add other bindings as needed
  };
};

const app = new Hono<AppEnv>();

// Middleware for Dependency Injection for Auth routes
// This middleware will run for all routes starting with /v1/auth
app.use("/v1/auth/*", async (c, next) => {
  // Instantiate services (these could be singletons if Hono context allows for app-level singletons)
  // For workers, these are effectively request-scoped if instantiated here without further caching.
  // However, CloudflareBindings (c.env) are available, so services can be initialized using them.

  // Check for necessary bindings first
  if (!c.env.JWT_SECRET || !c.env.REFRESH_TOKENS_KV || !c.env.DB) {
    console.error(
      "CRITICAL: Missing one or more environment bindings (JWT_SECRET, REFRESH_TOKENS_KV, DB) for auth services.",
    );
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Auth",
    });
  }

  const jwtService = new JwtServiceImpl({ jwtSecret: c.env.JWT_SECRET });
  const tokenRepository = new KvTokenStoreImpl({ kv: c.env.REFRESH_TOKENS_KV });
  const authService = new DomainAuthService(jwtService);
  const userRepository = new UserRepositoryImpl(c.env.DB);
  const deviceRepository = new DeviceRepositoryImpl(c.env.DB);

  // Instantiate commands
  const activateDeviceCommand = new ActivateDeviceCommand({
    authService,
    tokenRepository,
    userRepository,
    deviceRepository,
  });
  const refreshTokenCommand = new RefreshTokenCommand({
    authService,
    jwtService, // RefreshTokenCommand needs jwtService directly for verification
    tokenRepository,
  });

  // Set commands in c.var
  c.set("activateDeviceCommand", activateDeviceCommand);
  c.set("refreshTokenCommand", refreshTokenCommand);

  await next();
});

// Middleware for Dependency Injection for Exercise routes
app.use("/v1/exercises", async (c, next) => {
  if (!c.env.DB) {
    console.error("CRITICAL: Missing DB environment binding for exercise services.");
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Exercises",
    });
  }
  const db = drizzle(c.env.DB, { schema: tablesSchema }); // Wrap D1Database with Drizzle
  const exerciseRepository = new DrizzleExerciseRepository(db, tablesSchema);
  const exerciseService = new ExerciseService(exerciseRepository);
  const searchExercisesHandler = new SearchExercisesHandler(exerciseService);

  c.set("searchExercisesHandler", searchExercisesHandler);

  await next();
});

// Middleware for Dependency Injection for Session routes
app.use("/v1/sessions/*", async (c, next) => {
  if (!c.env.DB) {
    console.error("CRITICAL: Missing DB environment binding for session services.");
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Sessions",
    });
  }
  const db = drizzle(c.env.DB, { schema: tablesSchema });

  const workoutSessionRepository = new DrizzleWorkoutSessionRepository(db, tablesSchema);
  const workoutSessionService = new WorkoutSessionService(workoutSessionRepository); 
  const appWorkoutService = new AppWorkoutService(workoutSessionRepository); // Instantiate AppWorkoutService
  
  const aggregationService = new AggregationService(db);

  // ExerciseService is needed by FinishSessionHandler for recording exercise usage
  // It might have been instantiated in a higher scope middleware (e.g., for /v1/me/* or /v1/exercises)
  // For simplicity here, we ensure it's available. If already set in c.var, we could use that.
  // However, creating it here ensures it uses the same DB instance as other session services.
  const exerciseRepository = new DrizzleExerciseRepository(db, tablesSchema); // Ensure this is the correct repo
  const exerciseService = new ExerciseService(exerciseRepository);

  const startSessionHandler = new StartSessionHandler(
    workoutSessionService,
    workoutSessionRepository
  );

  const finishSessionHandler = new FinishSessionHandler(
    workoutSessionRepository,
    workoutSessionService,
    aggregationService,
    exerciseService // Inject ExerciseService
  );

  const addSetToSessionHandler = new AddSetToSessionHandler(
    workoutSessionRepository
  );

  c.set("startSessionHandler", startSessionHandler);
  c.set("finishSessionHandler", finishSessionHandler);
  c.set("addSetToSessionHandler", addSetToSessionHandler);
  c.set("workoutService", appWorkoutService); // Set workoutService in context
  await next();
});

// Middleware for Dependency Injection for Dashboard routes
app.use("/v1/dashboard/*", async (c, next) => {
  if (!c.env.DB) {
    console.error("CRITICAL: Missing DB environment binding for dashboard services.");
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for Dashboard",
    });
  }
  // Ensure db instance is created if not already (e.g. by a more generic middleware)
  // For this specific path, we'll create it.
  const db = drizzle(c.env.DB, { schema: tablesSchema });
  
  // This assumes DashboardRepository can accept DrizzleD1Database.
  // If DashboardRepository strictly expects LibSQLDatabase, this will be a type error
  // and DashboardRepository's constructor or this instantiation will need adjustment.
  const dashboardRepository = new DashboardRepository(db); 
  const dashboardQueryHandler = new GetDashboardDataQueryHandler(dashboardRepository);

  c.set("db", db); // Make db available in context, useful for dashboardStatsApp internal DI
  c.set("dashboardQueryHandler", dashboardQueryHandler);

  await next();
});

// Middleware for Dependency Injection for /v1/me/* routes (including recent exercises)
// This is a new middleware group for user-specific authenticated routes under /v1/me
app.use("/v1/me/*", async (c, next) => {
  if (!c.env.DB) {
    console.error("CRITICAL: Missing DB environment binding for /v1/me services.");
    throw new HTTPException(500, {
      message: "Internal Server Configuration Error for User Services",
    });
  }
  const db = drizzle(c.env.DB, { schema: tablesSchema });
  const exerciseRepository = new DrizzleExerciseRepository(db, tablesSchema);
  const exerciseService = new ExerciseService(exerciseRepository);

  // Handler for recent exercises
  const listRecentExercisesHandler = new ListRecentExercisesHandler(exerciseService);
  c.set("listRecentExercisesHandler", listRecentExercisesHandler);
  
  // Add other handlers for /v1/me/* routes here if needed in the future

  await next();
});

// --- 認証ミドルウェア (hono/jwt を使用) ---
const jwtAuthMiddleware = (c: Context<AppEnv>, next: Next) => {
  if (!c.env.JWT_SECRET) {
    console.error("CRITICAL: Missing JWT_SECRET for token verification.");
    throw new HTTPException(500, { message: "JWT secret not configured." });
  }
  // jwt() はミドルウェアファクトリなので、それを呼び出す
  const middleware = jwt({ secret: c.env.JWT_SECRET });
  return middleware(c, next); // 生成されたミドルウェアを実行
};
// --- 認証ミドルウェアここまで ---

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*",
    allowHeaders: ["X-Device-Id", "Content-Type", "X-Platform", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
  }),
);

// Global Error Handler
app.onError((err, c) => {
  console.error("[GlobalErrorHandler]", err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  if (err instanceof ApplicationError) {
    c.status(err.statusCode as StatusCode);
    return c.json({
      error: {
        message: err.message,
        code: err.code,
        details: err.details,
      },
    });
  }

  // その他の予期せぬエラー (プログラムのバグなど)
  c.status(500 as StatusCode);
  return c.json({
    error: {
      message: "An unexpected internal server error occurred.",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
});

// Route modules
app.route("/v1/auth", deviceAuthRoutes);
app.route("/v1/auth", refreshAuthRoutes);

// Route for Exercises
app.get("/v1/exercises", async (c) => {
  const handler = c.var.searchExercisesHandler;
  if (!handler) {
    console.error("SearchExercisesHandler not found in c.var for /v1/exercises route.");
    throw new HTTPException(500, { message: "Internal Configuration Error - Handler not set" });
  }
  const actualHandler = createSearchExercisesHandler(handler);
  return actualHandler(c);
});

// Route for recently used exercises for the authenticated user
app.get("/v1/me/exercises/recent", jwtAuthMiddleware, async (c) => {
  const handler = c.var.listRecentExercisesHandler;
  if (!handler) {
    console.error("ListRecentExercisesHandler not found in c.var for /v1/me/exercises/recent route.");
    throw new HTTPException(500, { message: "Internal Configuration Error - Handler not set" });
  }
  // Ensure createListRecentExercisesHandler is correctly imported and used
  const actualHandler = createListRecentExercisesHandler(handler);
  return actualHandler(c);
});

// Routes for Sessions
const sessionsRoutes = new Hono<AppEnv>();
sessionsRoutes.use("*", jwtAuthMiddleware); // ★ 実際の認証ミドルウェアを使用
sessionsRoutes.post("/", startSessionHttpHandler);

// POST /v1/sessions/:sessionId/finish ルートを追加
sessionsRoutes.post("/:sessionId/finish", async (c) => {
  const handler = c.var.finishSessionHandler;
  if (!handler) {
    console.error("FinishSessionHandler not found in c.var for /v1/sessions/:sessionId/finish route.");
    throw new HTTPException(500, { message: "Internal Configuration Error - Handler not set" });
  }

  const sessionIdParam = c.req.param("sessionId");
  const jwtPayload = c.get("jwtPayload");

  // Ensure jwtPayload and its sub property (user id) exist and sub is a string
  if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
    throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user identifier in token" });
  }
  const userId = jwtPayload.sub; // userId is now definitely a string

  try {
    const command = new FinishSessionCommand(
      new WorkoutSessionIdVO(sessionIdParam),
      new UserIdVO(userId)
    );
    const { responseDto, backgroundTask } = await handler.execute(command);

    if (backgroundTask) {
      c.executionCtx.waitUntil(backgroundTask.then(result => {
        if (result.success) {
          console.log(`Background aggregation for user ${command.userId.value} completed successfully: ${result.message}`);
        } else {
          console.error(`Background aggregation for user ${command.userId.value} failed: ${result.message}`);
        }
      }).catch(err => {
        console.error(`Unhandled error in background aggregation task for user ${command.userId.value}:`, err);
      }));
    }

    return c.json(responseDto);
  } catch (error) {
    if (error instanceof v.ValiError) {
      c.status(400);
      return c.json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map(issue => ({ path: issue.path?.map((p: { key: string | number | symbol }) => p.key).join('.'), message: issue.message })),
        }
      });
    }
    if (error instanceof ApplicationError) {
      c.status(error.statusCode as StatusCode);
      return c.json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      });
    }
    console.error("Error in POST /:sessionId/sets:", error);
    c.status(500);
    return c.json({
      error: {
        message: "Internal server error while adding set.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// POST /v1/sessions/:sessionId/sets ルートを追加 (ここからが復元するコード)
sessionsRoutes.post("/:sessionId/sets", async (c) => {
  const handler = c.var.addSetToSessionHandler;
  if (!handler) {
    console.error("AddSetToSessionHandler not found for /:sessionId/sets");
    throw new HTTPException(500, { message: "Handler not configured" });
  }

  const sessionIdParam = c.req.param("sessionId");
  const jwtPayload = c.get("jwtPayload");
  
  // Ensure jwtPayload and its sub property (user id) exist and sub is a string
  if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
    throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user identifier in token" });
  }
  const userId = jwtPayload.sub; // userId is now definitely a string

  try {
    const body = await c.req.json();
    const validatedBody = await v.parseAsync(AddSetRequestSchema, body);

    const performedAtString = validatedBody.performedAt;
    let performedAtDate: Date | undefined = undefined;
    if (performedAtString) {
      performedAtDate = new Date(performedAtString);
      if (Number.isNaN(performedAtDate.getTime())) {
        console.warn(`Invalid performedAt string received: ${performedAtString}. Setting to undefined.`);
        performedAtDate = undefined;
        // Consider throwing HTTPException(400, { message: `Invalid performedAt date format: ${performedAtString}` });
      }
    }
    // If performedAtDate is still undefined (either not provided or invalid string), default to current date
    if (!performedAtDate) {
      console.warn('performedAt was not provided or invalid, defaulting to current Date.');
      performedAtDate = new Date();
    }

    const command = new AddSetToSessionCommand(
      new WorkoutSessionIdVO(sessionIdParam),
      new UserIdVO(userId),
      new ExerciseIdVO(validatedBody.exerciseId),
      validatedBody.reps,
      validatedBody.weight,
      validatedBody.notes,
      performedAtDate, // Use the validated and possibly corrected performedAtDate
      undefined, // customSetId is undefined or a specific value
      validatedBody.rpe, // rpe
      validatedBody.restSec, // restSec
      validatedBody.deviceId, // deviceId
      validatedBody.setNo // ★ validatedBody から setNo を渡す
    );

    const resultDto = await handler.execute(command);
    return c.json(resultDto, 201);

  } catch (error) {
    if (error instanceof v.ValiError) {
      c.status(400);
      return c.json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map(issue => ({ path: issue.path?.map((p: { key: string | number | symbol }) => p.key).join('.'), message: issue.message })),
        }
      });
    }
    if (error instanceof ApplicationError) {
      c.status(error.statusCode as StatusCode);
      return c.json({
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      });
    }
    // エラーログのパスを修正
    console.error("Error in POST /:sessionId/sets:", error);
    c.status(500);
    return c.json({
      error: {
        message: "Internal server error while adding set.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

sessionsRoutes.patch("/:sessionId/sets/:setId", updateSetHttpHandler); // Add the PATCH route
sessionsRoutes.delete("/:sessionId/sets/:setId", deleteSetHttpHandler); // Add delete route

app.route("/v1/sessions", sessionsRoutes);

// Routes for Dashboard
const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", jwtAuthMiddleware); // Apply JWT auth to all dashboard routes
dashboardRoutes.route("/", dashboardStatsApp); // Mounts the stats handler at /v1/dashboard/stats

app.route("/v1/dashboard", dashboardRoutes);

// Root path or health check (optional)
app.get("/", (c) => {
  return c.text("BulkTrack API is running!");
});

export default app;
