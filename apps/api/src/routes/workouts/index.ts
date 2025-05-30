import { Hono } from "hono";
import type { Variables, WorkerEnv } from "../../types/env";
import { getWorkoutDetail, getWorkoutSummaries } from "./handlers";

export const workoutRoutes = new Hono<{
  Bindings: WorkerEnv;
  Variables: Variables;
}>();

// GET /me/workouts - Get workout summaries
workoutRoutes.get("/", getWorkoutSummaries);

// GET /me/workouts/:date - Get workout detail for specific date
workoutRoutes.get("/:date", getWorkoutDetail);
