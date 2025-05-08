import { Hono, type Next, type Context } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { StatusCode } from "hono/utils/http-status";
import { drizzle } from 'drizzle-orm/d1';
import { jwt } from 'hono/jwt';
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

import { startSessionHttpHandler } from "./handlers/session/start";
import { StartSessionHandler } from "../../app/command/session/start-session";
import { FinishSessionCommand, FinishSessionHandler } from "../../app/command/session/finish-session";
import { AddSetToSessionCommand, AddSetToSessionHandler } from "../../app/command/session/add-set-to-session"; // AddSetToSession をインポート
import { WorkoutSessionService } from "../../domain/workout/service";
import { DrizzleWorkoutSessionRepository } from "../../infrastructure/db/repository/workout-session-repository";
import { UserIdVO, WorkoutSessionIdVO, ExerciseIdVO } from "../../domain/shared/vo/identifier"; // ExerciseIdVO をインポート
import { AddSetRequestSchema, type AddSetResponseDto } from "../../app/dto/set.dto"; // DTO とスキーマをインポート

// Define types for c.var
type AppEnv = {
  Variables: {
    activateDeviceCommand: ActivateDeviceCommand;
    refreshTokenCommand: RefreshTokenCommand;
    searchExercisesHandler: SearchExercisesHandler;
    startSessionHandler: StartSessionHandler;
    finishSessionHandler: FinishSessionHandler;
    addSetToSessionHandler: AddSetToSessionHandler; // addSetToSessionHandler を追加
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
  // Drizzleインスタンスの準備
  const db = drizzle(c.env.DB, { schema: tablesSchema });

  // WorkoutSessionRepositoryの実装をインスタンス化
  const workoutSessionRepository = new DrizzleWorkoutSessionRepository(db, tablesSchema);
  
  // WorkoutSessionService にリポジトリを注入
  const workoutSessionService = new WorkoutSessionService(workoutSessionRepository); 
  
  const startSessionHandler = new StartSessionHandler(
    workoutSessionService,
    workoutSessionRepository
  );

  // FinishSessionHandler をインスタンス化してセット
  const finishSessionHandler = new FinishSessionHandler(
    workoutSessionRepository, // DrizzleWorkoutSessionRepository を使用
    workoutSessionService   // 正しく初期化された WorkoutSessionService を使用
  );

  const addSetToSessionHandler = new AddSetToSessionHandler( // AddSetToSessionHandler をインスタンス化
    workoutSessionRepository
  );

  c.set("startSessionHandler", startSessionHandler);
  c.set("finishSessionHandler", finishSessionHandler); // c.var にセット
  c.set("addSetToSessionHandler", addSetToSessionHandler); // c.var にセット
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

  if (!jwtPayload || !jwtPayload.sub) {
    throw new HTTPException(401, { message: "Unauthorized: Missing or invalid token payload" });
  }

  try {
    const command = new FinishSessionCommand(
      new WorkoutSessionIdVO(sessionIdParam),
      new UserIdVO(jwtPayload.sub)
    );
    const resultDto = await handler.execute(command);
    return c.json(resultDto);
  } catch (error) {
    // ドメインやアプリケーション層からのエラーを適切に処理
    if (error instanceof Error && (error.message.includes("not found") || error.message.includes("Forbidden"))) {
      // 例: セッションが見つからない、または権限がない場合
      throw new HTTPException(404, { message: error.message });
    }
    if (error instanceof Error && error.message.includes("already been finished")) {
      throw new HTTPException(400, { message: error.message }); // Bad Request
    }
    if (error instanceof Error && error.message.includes("earlier than start time")) {
      throw new HTTPException(400, { message: error.message }); // Bad Request
    }
    // その他の予期せぬエラーはグローバルエラーハンドラに任せる
    throw error;
  }
});

// POST /v1/sessions/:sessionId/sets ルートを追加
sessionsRoutes.post("/:sessionId/sets", async (c) => {
  const handler = c.var.addSetToSessionHandler;
  if (!handler) {
    console.error("AddSetToSessionHandler not found for /:sessionId/sets");
    throw new HTTPException(500, { message: "Handler not configured" });
  }

  const sessionIdParam = c.req.param("sessionId");
  const jwtPayload = c.get("jwtPayload");
  if (!jwtPayload || !jwtPayload.sub) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  try {
    const body = await c.req.json();
    const validatedBody = await v.parseAsync(AddSetRequestSchema, body);

    const command = new AddSetToSessionCommand(
      new WorkoutSessionIdVO(sessionIdParam),
      new UserIdVO(jwtPayload.sub),
      new ExerciseIdVO(validatedBody.exerciseId),
      validatedBody.reps,
      validatedBody.weight,
      validatedBody.notes,
      validatedBody.performedAt ? new Date(validatedBody.performedAt) : undefined
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

app.route("/v1/sessions", sessionsRoutes);

// Root path or health check (optional)
app.get("/", (c) => {
  return c.text("BulkTrack API is running!");
});

export default app;
