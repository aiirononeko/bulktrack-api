import { Hono } from "hono";
import type { AppEnv } from "../../main.router";
import { jwtAuthMiddleware } from "../../middleware/auth.middleware";
import { setupExerciseDependencies } from "../../middleware/di/exercise.container";
import {
  createCreateExerciseHttpHandler,
  createSearchExercisesHttpHandler,
} from "./exercise.handlers";

const exerciseApp = new Hono<AppEnv>();

// Apply DI middleware for all routes in this exercise module
exerciseApp.use("*", async (c, next) => {
  setupExerciseDependencies(c.env, c);
  await next();
});

// Apply JWT authentication for all exercise routes
exerciseApp.use("*", jwtAuthMiddleware);

// GET /v1/exercises - Search exercises
exerciseApp.get("/", createSearchExercisesHttpHandler());

// POST /v1/exercises - Create new exercise
exerciseApp.post("/", createCreateExerciseHttpHandler());

export default exerciseApp;
