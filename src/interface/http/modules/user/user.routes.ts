import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { jwtAuthMiddleware } from "../../middleware/auth.middleware";
import { setupUserDependencies } from "../../middleware/di/user.container";
import { createWorkoutContainer } from "../../middleware/di/workout.container";
import { createListRecentExercisesHttpHandler } from "./user.handlers";

const userApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this user module
userApp.use("*", async (c, next) => {
  setupUserDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all /v1/me routes
userApp.use("*", jwtAuthMiddleware);

// GET /v1/me/exercises/recent - List recent exercises for the authenticated user
userApp.get("/exercises/recent", createListRecentExercisesHttpHandler());

// Setup workout history routes middleware
userApp.use("/workouts/*", async (c, next) => {
  const db = c.get("db");
  if (!db) {
    throw new Error("Database not initialized");
  }

  const schema = await import("../../../../infrastructure/db/schema");
  const workoutContainer = createWorkoutContainer(db, schema);
  c.set("workoutHandlers", workoutContainer.handlers);
  await next();
});

// Workout history routes: /v1/me/workouts
userApp.get("/workouts", async (c) => {
  const handlers = c.get("workoutHandlers");
  if (!handlers) {
    throw new Error("Workout handlers not initialized");
  }
  return handlers.getWorkoutSummaries(c);
});

userApp.get("/workouts/:date", async (c) => {
  const handlers = c.get("workoutHandlers");
  if (!handlers) {
    throw new Error("Workout handlers not initialized");
  }
  return handlers.getWorkoutDetail(c);
});

// Add other /v1/me routes here in the future

export default userApp;
