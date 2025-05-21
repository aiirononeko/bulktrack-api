import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import type { StatusCode } from "hono/utils/http-status";
import type { JWTPayload } from 'hono/utils/jwt/types';

import { ApplicationError } from "../../app/errors";

// ValibotのIssuePathの要素の型定義 (valibotから直接エクスポートされていないためローカルで定義)
// This might be better in a shared types file if used elsewhere, but for now, keep it close.
interface PathItem {
  type: string;
  origin: 'key' | 'value';
  input: unknown;
  key?: unknown;
  value: unknown;
}

// --- AppEnv Definition ---
// Import specific command/handler/service types as they are defined in their respective DI containers/modules
// For now, keep the structure from the original router.ts and refine later.
import type { ActivateDeviceCommand } from "../../app/command/auth/activate-device-command";
import type { RefreshTokenCommand } from "../../app/command/auth/refresh-token-command";
import type { SearchExercisesHandler } from "../../app/query/exercise/search-exercise";
import type { ListRecentExercisesHandler } from "../../app/query/exercise/list-recent-exercises";
import type { ExerciseService } from "../../domain/exercise/service";
import type { WorkoutService } from "../../application/services/workout.service";
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as tablesSchema from "../../infrastructure/db/schema";
import type { GetDashboardDataQueryHandler } from "../../app/query/dashboard/get-dashboard-data";
import type { DashboardStatsService } from "../../app/services/dashboard-stats-service";
import type { FtsService } from "../../application/service/FtsService";

export type AppEnv = {
  Variables: {
    // Auth
    activateDeviceCommand?: ActivateDeviceCommand;
    refreshTokenCommand?: RefreshTokenCommand;
    // Exercise
    searchExercisesHandler?: SearchExercisesHandler;
    listRecentExercisesHandler?: ListRecentExercisesHandler;
    exerciseService?: ExerciseService;
    // Workout/Set
    workoutService?: WorkoutService;
    // Dashboard
    dashboardQueryHandler?: GetDashboardDataQueryHandler;
    statsUpdateService?: DashboardStatsService; // For updating stats after set creation
    // Admin
    ftsService?: FtsService;
    // General
    db?: DrizzleD1Database<typeof tablesSchema>; // Made optional as not all routes might need it directly
    jwtPayload?: JWTPayload;
  };
  Bindings: {
    DB: D1Database;
    JWT_SECRET: string;
    REFRESH_TOKENS_KV: KVNamespace;
  };
};

const app = new Hono<AppEnv>();

// --- Global Middleware ---
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "*", // Adjust as per your security requirements
    allowHeaders: ["X-Device-Id", "Content-Type", "X-Platform", "Authorization"],
    allowMethods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
  }),
);

// --- Global Error Handler ---
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
  
  // Handle Valibot errors specifically if they reach here
  // Note: Individual route handlers should ideally catch and format Valibot errors.
  // This is a fallback.
  if (err.name === 'ValiError' && 'issues' in err) { // Basic check for Valibot error
    const valibotError = err as any; // Cast to any to access issues
    c.status(400);
    return c.json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: valibotError.issues.map((issue: any) => ({ // Use any for issue type
            path: issue.path?.map((p: PathItem) => p.key).join('.'), 
            message: issue.message 
        })),
      }
    });
  }

  // Fallback for other unexpected errors
  c.status(500 as StatusCode);
  return c.json({
    error: {
      message: "An unexpected internal server error occurred.",
      code: "INTERNAL_SERVER_ERROR",
    },
  });
});

// --- Feature Routers ---
import authApp from './modules/auth/auth.routes';
import exerciseApp from './modules/exercise/exercise.routes';
import setApp from './modules/set/set.routes';
import userApp from './modules/user/user.routes'; // For /v1/me routes
import dashboardApp from './modules/dashboard/dashboard.routes';
import adminApp from './modules/admin/admin.routes';

app.route('/v1/auth', authApp);
app.route('/v1/exercises', exerciseApp);
app.route('/v1/sets', setApp);
app.route('/v1/me', userApp);
app.route('/v1/dashboard', dashboardApp);
app.route('/v1/admin', adminApp);


// --- Root Path ---
app.get("/", (c) => {
  return c.text("BulkTrack API is running!");
});

export default app;
