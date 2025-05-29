import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { authMiddleware } from "./middleware/auth.middleware";
import { authRoutes } from "./routes/auth";
import { exerciseRoutes } from "./routes/exercise";
import { trainingSetRoutes } from "./routes/training-set";
import { userRoutes } from "./routes/user";
import type { WorkerEnv } from "./types/env";

export type AppEnv = {
  Bindings: WorkerEnv;
  Variables: {
    userId?: string;
  };
};

const app = new Hono<AppEnv>();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    environment: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (no middleware)
app.route("/api/v1/auth", authRoutes);

// Protected API routes
const protectedRoutes = new Hono<AppEnv>();
protectedRoutes.use("*", authMiddleware);
protectedRoutes.route("/exercises", exerciseRoutes);
protectedRoutes.route("/me", userRoutes);
protectedRoutes.route("/training-sets", trainingSetRoutes);

app.route("/api/v1", protectedRoutes);

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "The requested resource was not found",
      },
    },
    404,
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Application error:", err);
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An internal error occurred",
      },
    },
    500,
  );
});

export default app;
