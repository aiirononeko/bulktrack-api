import { Hono, type Next, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { StatusCode } from "hono/utils/http-status";
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { jwt } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import * as v from 'valibot';

// ValibotのIssuePathの要素の型定義 (valibotから直接エクスポートされていないためローカルで定義)
interface PathItem {
  type: string;
  origin: 'key' | 'value';
  input: unknown;
  key?: unknown;
  value: unknown;
}

import { ApplicationError } from "../../app/errors";

import deviceAuthRoutes from "./handlers/auth/device";
import refreshAuthRoutes from "./handlers/auth/refresh";

import { ActivateDeviceCommand } from "../../app/command/auth/activate-device-command";
import { RefreshTokenCommand } from "../../app/command/auth/refresh-token-command";
import { AuthService as DomainAuthService } from "../../domain/auth/service";

// --- DI Setup ---
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

import { WorkoutService as AppWorkoutService, type AddWorkoutSetCommand } from "../../application/services/workout.service";
import { DrizzleWorkoutSetRepository } from "../../infrastructure/db/repository/workout-set-repository";
import { UserIdVO, ExerciseIdVO, WorkoutSetIdVO } from "../../domain/shared/vo/identifier";
import { AddSetRequestSchema } from "../../app/dto/set.dto";

import dashboardStatsApp from "./handlers/dashboard/stats";
import { GetDashboardDataQueryHandler } from "../../app/query/dashboard/get-dashboard-data";
import { DashboardRepository } from "../../infrastructure/db/repository/dashboard-repository";

import { updateSetHttpHandler } from "./handlers/sets/update-set";
import { deleteSetHttpHandler } from "./handlers/sets/delete-set";

// DashboardStatsService をインポート
import { DashboardStatsService } from "../../app/services/dashboard-stats-service";

export type AppEnv = {
  Variables: {
    activateDeviceCommand: ActivateDeviceCommand;
    refreshTokenCommand: RefreshTokenCommand;
    searchExercisesHandler: SearchExercisesHandler;
    listRecentExercisesHandler?: ListRecentExercisesHandler;
    workoutService?: AppWorkoutService;
    db?: DrizzleD1Database<typeof tablesSchema>;
    dashboardQueryHandler?: GetDashboardDataQueryHandler;
    jwtPayload?: JWTPayload;
    statsUpdateService?: DashboardStatsService;
  };
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    REFRESH_TOKENS_KV: KVNamespace;
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

// Middleware for Dependency Injection for Session routes (改め Set routes)
app.use("/v1/sets/*", async (c, next) => {
  if (!c.env.DB) {
    console.error("CRITICAL: Missing DB environment binding for set services.");
    throw new HTTPException(500, { message: "Internal Server Configuration Error for Sets" });
  }
  const db = drizzle(c.env.DB, { schema: tablesSchema });

  const workoutRepository = new DrizzleWorkoutSetRepository(db, tablesSchema);
  const appWorkoutService = new AppWorkoutService(workoutRepository);
  
  // StatsUpdateService (DashboardStatsService) のインスタンス化
  const statsUpdateService = new DashboardStatsService(db);
  c.set("statsUpdateService", statsUpdateService);
  
  c.set("workoutService", appWorkoutService);
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

// Routes for Sets (旧 Sessions)
const setsRoutes = new Hono<AppEnv>();
setsRoutes.use("*", jwtAuthMiddleware);

// POST /v1/sets/ (旧 /v1/sessions/:sessionId/sets)
setsRoutes.post("/", async (c) => {
  const workoutService = c.var.workoutService;
  if (!workoutService) {
    console.error("WorkoutService not found for POST /sets");
    throw new HTTPException(500, { message: "Service not configured" });
  }

  const jwtPayload = c.get("jwtPayload");
  
  if (!jwtPayload || typeof jwtPayload.sub !== 'string') {
    throw new HTTPException(401, { message: "Unauthorized: Missing or invalid user identifier in token" });
  }
  const userId = jwtPayload.sub;

  try {
    const body = await c.req.json();
    const validatedBody = await v.parseAsync(AddSetRequestSchema, body);

    const performedAtString = validatedBody.performedAt;
    let performedAtDate: Date | undefined = undefined;
    if (performedAtString) {
      performedAtDate = new Date(performedAtString);
      if (Number.isNaN(performedAtDate.getTime())) {
        performedAtDate = undefined;
      }
    }
    if (performedAtDate === undefined) {
      performedAtDate = new Date();
    }

    const commandData: AddWorkoutSetCommand = {
      userId: new UserIdVO(userId),
      exerciseId: new ExerciseIdVO(validatedBody.exerciseId),
      reps: validatedBody.reps,
      weight: validatedBody.weight,
      notes: validatedBody.notes,
      performedAt: performedAtDate,
      rpe: validatedBody.rpe,
      restSec: validatedBody.restSec,
      setNo: validatedBody.setNo
    };

    const resultDto = await workoutService.addWorkoutSet(commandData);

    // 統計更新処理の呼び出し
    const statsUpdater = c.var.statsUpdateService;
    const currentUserId = new UserIdVO(userId); // UserIdVOインスタンスを生成
    if (statsUpdater) {
      try {
        await statsUpdater.updateStatsForUser(currentUserId);
      } catch (statsError) {
        console.error("Error updating dashboard stats after adding set:", statsError);
        // ここでのエラーはメインのレスポンスに影響させない（ログ出力に留める）
      }
    } else {
      // DIミドルウェアで既に警告ログを出しているが、念のためここでもログを出すか、何もしない
      // console.warn("StatsUpdateService not found, skipping stats update for user:", userId);
    }

    return c.json(resultDto, 201);

  } catch (error) {
    if (error instanceof v.ValiError) {
      c.status(400);
      return c.json({
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map(issue => ({ path: issue.path?.map((p: PathItem) => p.key).join('.'), message: issue.message })),
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
    console.error("Error in POST /sets:", error);
    c.status(500);
    return c.json({
      error: {
        message: "Internal server error while adding set.",
        code: "INTERNAL_SERVER_ERROR",
      },
    });
  }
});

// PATCH /v1/sets/:setId (旧 /v1/sessions/:sessionId/sets/:setId)
setsRoutes.patch("/:setId", updateSetHttpHandler);

// DELETE /v1/sets/:setId (旧 /v1/sessions/:sessionId/sets/:setId)
setsRoutes.delete("/:setId", deleteSetHttpHandler);

app.route("/v1/sets", setsRoutes);

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
